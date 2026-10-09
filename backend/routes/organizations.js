const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, param } = require('express-validator');
const { handleValidationErrors, benutzernameRegel } = require('../middleware/validation');
const { invalidateUserCache } = require('../middleware/rbac');
const { validatePassword } = require('../utils/passwordUtils');
const liveUpdate = require('../utils/liveUpdate');
const { deletePhotoFile, deleteChallengeFile, deleteChatFile, deleteMaterialFile } = require('../utils/photoStorage');
const { syncTeamChat } = require('../utils/teamChat');
const { syncJahrgangChat } = require('../utils/jahrgangChat');
const chatSyncCache = require('../utils/chatSyncCache');
const { gemeindeZugehoerigkeitRaeumen, inWeitereGemeindeUmziehen } = require('../utils/mitgliedschaftEnde');
const { kontenDatenLoeschen, kontoDateienLoeschen, meldeNachKontoLoeschungEinreihen } = require('../utils/kontoLoeschen');
const { kontoSperreAufheben } = require('../utils/kontoSperre');
const { pruefeKonfiOderTeam } = require('../utils/konfiOderTeam');
const { MITGLIEDSCHAFTEN_SQL } = require('../utils/orgMitglieder');
const { systemnameFuerNeueGemeinde, systemnameBeimBearbeiten } = require('../utils/gemeindeSystemname');
const { benutzernameSperrenUndPruefen, MELDUNG_VERGEBEN } = require('../utils/benutzernameSperre');
const { gemeindeAnlegen, konfiLimitLesen, laufzeitLesen, fehlerAlsAntwort } = require('../utils/gemeindeAnlegen');
const { kirchenkreisFinden, kirchenkreisIdGueltig, MELDUNG_KIRCHENKREIS_FEHLT } = require('../utils/kirchenkreisZuordnung');

const MELDUNG_KIRCHENKREIS_UNGUELTIG = 'Ungültiger Kirchenkreis';

// Organizations routes
// ============================================
// super_admin: Kann ALLE Orgs sehen, erstellen, löschen
// org_admin: Kann NUR eigene Org sehen und bearbeiten
// ============================================
module.exports = (db, rbacVerifier, { requireSuperAdmin, requireTeamer }) => {

  // Verwaltungszugriff auf Organisationsdaten: super_admin (org-uebergreifend
  // zustaendig) ODER eine Verwaltungsrolle der Organisation. requireTeamer
  // allein wuerde den super_admin aussperren, dessen Rolle in requireRole
  // nicht gelistet ist; requireSuperAdmin allein wuerde org_admin/admin/teamer
  // aussperren. Die Org-Zugehoerigkeit selbst prüfen die Routen weiterhin
  // inline (is_super_admin ODER eigene Org).
  const requireOrgVerwaltung = (req, res, next) => {
    if (req.user && req.user.is_super_admin) return next();
    return requireTeamer(req, res, next);
  };

  // Zentrale Passwort-Policy auch hier anwenden (Audit 22.08.2026, LÜCKE N6):
  // Diese beiden Routen prüfen bisher nur eine Mindestlaenge von 6 Zeichen —
  // schwaecher als jede andere Stelle, an der Passwoerter gesetzt werden, und
  // das ausgerechnet für org_admin-Konten. validatePassword verlangt 8 Zeichen,
  // Gross-/Kleinbuchstaben, Ziffer, Sonderzeichen und keine Leerzeichen.
  // Die automatisch erzeugten Passwoerter (generateBiblicalPassword, z.B.
  // "Offenbarung23,8") erfuellen die Policy — gegen 300 Stichproben geprüft.
  const passwortPolicy = (feld) => body(feld).custom((wert) => {
    const fehler = validatePassword(wert || '');
    if (fehler) throw new Error(fehler);
    return true;
  });

  // Validierungsregeln
  const validateCreateOrg = [
    body('name').trim().notEmpty().withMessage('Name ist erforderlich'),
    body('slug').trim().notEmpty().withMessage('Slug ist erforderlich'),
    body('display_name').trim().notEmpty().withMessage('Anzeigename ist erforderlich'),
    benutzernameRegel('admin_username'),
    passwortPolicy('admin_password'),
    body('admin_display_name').trim().notEmpty().withMessage('Admin-Anzeigename ist erforderlich'),
    // Zuordnung zu einem Kirchenkreis (seit 03.10.2026, additiv): fehlt sie,
    // bleibt alles wie vorher.
    body('kirchenkreis_id').optional({ values: 'null' }).custom(kirchenkreisIdGueltig).withMessage(MELDUNG_KIRCHENKREIS_UNGUELTIG),
    handleValidationErrors
  ];

  const validateUpdateOrg = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('name').trim().notEmpty().withMessage('Name ist erforderlich'),
    body('slug').trim().notEmpty().withMessage('Slug ist erforderlich'),
    body('display_name').trim().notEmpty().withMessage('Anzeigename ist erforderlich'),
    handleValidationErrors
  ];

  const validateOrgId = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors
  ];

  const validateCreateOrgAdmin = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige Gemeinde-ID'),
    benutzernameRegel('username'),
    body('display_name').trim().notEmpty().withMessage('Anzeigename ist erforderlich'),
    passwortPolicy('password'),
    handleValidationErrors
  ];

  // Get all organizations - NUR super_admin
  //
  // INTERNE GEMEINDEN (organizations.intern, Migration 194, 03.10.2026): Die
  // Review- und Test-Gemeinden fuer die Stores stehen nicht in dieser Liste --
  // sie ist die Gemeinde-Auswahl der Support-Ansicht und der Verwaltung. Die
  // Antwortform bleibt GLEICH (nur weniger Eintraege; das Feld intern, das
  // organizations.* mitbringt, wird entfernt -- hier immer false). Zugriff
  // ueber die Kennung (GET und PUT /:id) bleibt moeglich.
  router.get('/', rbacVerifier, requireSuperAdmin, async (req, res) => {
    try {
      // user_count (Team) zählt BEIDE Quellen: Primaer-User (users.organization_id)
      // UND Multi-Org-Mitglieder (user_organizations), jeweils ohne Konfis und
      // über DISTINCT dedupliziert (ein User, der primaer + Mapping in derselben
      // Org hängt, zählt nur einmal). Als Sub-Query, damit der konfi_count-JOIN
      // die Zählung nicht verzerrt.
      //
      // Zuordnung (Migration 191, 03.10.2026, nur neue Felder): o.* bringt
      // kirchenkreis_id mit, dazu landeskirche_id und landeskirche aus dem
      // Kirchenkreis. Als Subselects, damit GROUP BY o.id bleibt.
      const query = `
        SELECT o.*,
               (SELECT k.landeskirche_id FROM kirchenkreise k WHERE k.id = o.kirchenkreis_id) AS landeskirche_id,
               (SELECT l.name FROM kirchenkreise k JOIN landeskirchen l ON l.id = k.landeskirche_id
                 WHERE k.id = o.kirchenkreis_id) AS landeskirche,
               (
                 SELECT COUNT(*) FROM (
                   SELECT u.id
                   FROM users u JOIN roles r ON u.role_id = r.id
                   WHERE u.organization_id = o.id AND u.is_active = true AND r.name != 'konfi'
                   UNION
                   SELECT u.id
                   FROM user_organizations uo
                   JOIN users u ON uo.user_id = u.id AND u.is_active = true
                   JOIN roles r ON uo.role_id = r.id
                   WHERE uo.organization_id = o.id AND r.name != 'konfi'
                 ) team
               ) as user_count,
               COUNT(DISTINCT kp.user_id) as konfi_count,
               COUNT(DISTINCT e.id) as event_count
        FROM organizations o
        LEFT JOIN konfi_profiles kp ON o.id = kp.organization_id
        LEFT JOIN events e ON o.id = e.organization_id
        WHERE NOT o.intern
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `;

      const { rows: organizations } = await db.query(query);
      // Die Form bleibt, wie sie war: intern ist hier immer false und sagt
      // nichts; das Feld steht nur in GET /:id.
      for (const o of organizations) delete o.intern;
      res.json(organizations);
    } catch (err) {
 console.error('Database error in GET /organizations:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET /search-users?q= — bestehende User systemweit suchen (für Multi-Org-
  // Zuweisung). Konfis ausgenommen. MUSS vor /:id stehen, sonst faengt /:id den Pfad.
  router.get('/search-users', rbacVerifier, requireSuperAdmin, async (req, res) => {
    try {
      const q = (req.query.q || '').toString().trim();
      if (q.length < 2) {
        return res.json([]);
      }
      const { rows } = await db.query(`
        SELECT u.id, u.username, u.display_name, u.email,
               o.name as primary_organization_name,
               r.name as primary_role_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE (r.name IS NULL OR r.name != 'konfi')
          AND u.is_active = true
          AND (u.username ILIKE $1 OR u.display_name ILIKE $1)
        ORDER BY u.display_name ASC
        LIMIT 20
      `, [`%${q}%`]);
      res.json(rows);
    } catch (err) {
      console.error('Database error in GET /organizations/search-users:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Support-Konten ohne Gemeinde (nur Super-Admins, routes/supportKonten.js).
  // MUSS vor /:id stehen, sonst faengt /:id den Pfad.
  router.use('/support-konten', require('./supportKonten')(db, rbacVerifier, { requireSuperAdmin }));

  // Get current organization details (muss VOR /:id stehen, sonst wird "current" als ID gefangen)
  // requireTeamer wie bei GET /:id: Die Route liefert o.* der eigenen
  // Organisation und damit dieselben Kontakt-, Lizenz- und Trial-Daten.
  // Ohne diesen Guard wäre der Schutz an GET /:id wirkungslos — derselbe
  // Datensatz wäre hier weiterhin für jede Konfi abrufbar gewesen
  // (Audit 22.08.2026, LÜCKE N5).
  router.get('/current', rbacVerifier, requireOrgVerwaltung, async (req, res) => {
    try {
      const organizationId = req.user.organization_id;

      // Zähler als korrelierte Subselects statt fünf unkorrelierter LEFT JOINs:
      // Die Joins bildeten das Kreuzprodukt kp x j x a x e x cb — in der
      // Produktions-Org 4 waren das 77.376 Zwischenzeilen und 198 ms pro
      // Aufruf. Dieselben Zahlen per Subselect: 0,9 ms (gemessen 24.08.2026,
      // EXPLAIN ANALYZE gegen Produktion). Die COUNT(*)-Subselects liefern wie
      // vorher bigint (node-pg: String), das Antwortformat ändert sich nicht.
      const query = `
        SELECT o.*,
               (
                 SELECT COUNT(*) FROM (
                   SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
                   WHERE u.organization_id = o.id AND u.is_active = true AND r.name != 'konfi'
                   UNION
                   SELECT u.id FROM user_organizations uo
                   JOIN users u ON uo.user_id = u.id AND u.is_active = true
                   JOIN roles r ON uo.role_id = r.id
                   WHERE uo.organization_id = o.id AND r.name != 'konfi'
                 ) team
               ) as user_count,
               (SELECT COUNT(*) FROM konfi_profiles kp WHERE kp.organization_id = o.id) as konfi_count,
               (SELECT COUNT(*) FROM jahrgaenge j WHERE j.organization_id = o.id) as jahrgang_count,
               (SELECT COUNT(*) FROM activities a WHERE a.organization_id = o.id) as activity_count,
               (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id) as event_count,
               (SELECT COUNT(*) FROM custom_badges cb WHERE cb.organization_id = o.id) as badge_count
        FROM organizations o
        WHERE o.id = $1
      `;

      const { rows: [organization] } = await db.query(query, [organizationId]);

      if (!organization) {
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      res.json(organization);
    } catch (err) {
 console.error('Database error in GET /organizations/current:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Get single organization by ID
  // super_admin: alle, org_admin: nur eigene
  // OPTIMIERT: Parallele Queries statt JOIN-Monster
  // requireTeamer: Die Route liefert SELECT * der Organisation — Kontaktdaten
  // (Name, Telefon, Privatadresse der Leitung), Lizenz- und Trial-Angaben.
  // Geprueft wurde bisher nur die Org-Zugehoerigkeit, nicht die Rolle: damit
  // bekam auch jede Konfi diese Daten (Audit 22.08.2026, LÜCKE N5).
  router.get('/:id', rbacVerifier, requireOrgVerwaltung, async (req, res) => {
    try {
      const { id } = req.params;

      // Zugriffsprüfung
      const isSuperAdmin = req.user.is_super_admin === true;
      const isOwnOrg = req.user.organization_id === parseInt(id);

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      // Basis-Organisation laden
      const orgQuery = "SELECT * FROM organizations WHERE id = $1";

      // Statistiken parallel laden (viel schneller als JOINs)
      // Team-Zähler beziehen BEIDE Quellen ein: Primaer-User (users.organization_id)
      // UND Multi-Org-Mitglieder (user_organizations), dedupliziert per UNION/DISTINCT.
      // Sonst zeigen Orgs mit ausschliesslich zugewiesenen (nicht primaeren) Admins
      // faelschlich "0 Team".
      const countQueries = {
        user_count: `SELECT COUNT(*)::int as count FROM (
                       SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
                       WHERE u.organization_id = $1 AND u.is_active = true AND r.name != 'konfi'
                       UNION
                       SELECT u.id FROM user_organizations uo
                       JOIN users u ON uo.user_id = u.id AND u.is_active = true
                       JOIN roles r ON uo.role_id = r.id
                       WHERE uo.organization_id = $1 AND r.name != 'konfi'
                     ) team`,
        teamer_count: `SELECT COUNT(*)::int as count FROM (
                       SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
                       WHERE u.organization_id = $1 AND u.is_active = true AND r.name = 'teamer'
                       UNION
                       SELECT u.id FROM user_organizations uo
                       JOIN users u ON uo.user_id = u.id AND u.is_active = true
                       JOIN roles r ON uo.role_id = r.id
                       WHERE uo.organization_id = $1 AND r.name = 'teamer'
                     ) t`,
        admin_count: `SELECT COUNT(*)::int as count FROM (
                       SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
                       WHERE u.organization_id = $1 AND u.is_active = true AND r.name IN ('admin', 'org_admin')
                       UNION
                       SELECT u.id FROM user_organizations uo
                       JOIN users u ON uo.user_id = u.id AND u.is_active = true
                       JOIN roles r ON uo.role_id = r.id
                       WHERE uo.organization_id = $1 AND r.name IN ('admin', 'org_admin')
                     ) a`,
        konfi_count: "SELECT COUNT(*)::int as count FROM konfi_profiles WHERE organization_id = $1",
        jahrgang_count: "SELECT COUNT(*)::int as count FROM jahrgaenge WHERE organization_id = $1",
        activity_count: "SELECT COUNT(*)::int as count FROM activities WHERE organization_id = $1",
        event_count: "SELECT COUNT(*)::int as count FROM events WHERE organization_id = $1",
        badge_count: "SELECT COUNT(*)::int as count FROM custom_badges WHERE organization_id = $1"
      };

      // Wunschlizenz aus der Anfrage, aus der die Gemeinde entstanden ist
      // (Simon, 03.10.2026; Migration 192). Das Formular "Gemeinde" belegt
      // damit das Konfi-Limit nach der Testphase vor. NULL ohne Anfrage oder
      // ohne Angabe. Nur ein zusaetzliches Feld -- die Antwort bleibt sonst,
      // wie sie war.
      const wunschQuery = `SELECT wunsch_lizenz FROM gemeinde_anfragen
                            WHERE organization_id = $1
                            ORDER BY status_seit DESC, id DESC LIMIT 1`;

      // Alle Queries parallel ausführen
      const [orgResult, wunschResult, ...countResults] = await Promise.all([
        db.query(orgQuery, [id]),
        db.query(wunschQuery, [id]),
        ...Object.values(countQueries).map(q => db.query(q, [id]))
      ]);

      const organization = orgResult.rows[0];

      if (!organization) {
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      // Statistiken zum Ergebnis hinzufügen
      const countKeys = Object.keys(countQueries);
      countResults.forEach((result, index) => {
        organization[countKeys[index]] = result.rows[0]?.count || 0;
      });
      organization.wunsch_lizenz = wunschResult.rows[0]?.wunsch_lizenz ?? null;

      res.json(organization);
    } catch (err) {
 console.error('Database error in GET /organizations/:id:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Create new organization (super admin only)
  //
  // Die Anlage selbst -- Gemeinde, Rollen, erste Gemeindeleitung und alle
  // Vorlagen in EINER Transaktion, Benutzername systemweit geprueft -- steht
  // seit dem 03.10.2026 in utils/gemeindeAnlegen.js. Dieselbe Funktion ruft
  // die Support-Ansicht, wenn sie eine Gemeinde aus einer Anfrage anlegt
  // (routes/support.js); Begruendungen dort.
  //
  // DER SYSTEMNAME behaelt Umlaute als ae/oe/ue/ss (utils/gemeindeSystemname.js).
  router.post('/', rbacVerifier, requireSuperAdmin, validateCreateOrg, async (req, res) => {
    const {
      name, slug, display_name, description, contact_name, contact_email,
      contact_phone, address, website_url, kirchenkreis, max_konfis, admin_username,
      admin_password, admin_display_name
    } = req.body;

    if (!name || !slug || !display_name) {
      return res.status(400).json({ error: 'Name, Slug und Anzeigename sind erforderlich' });
    }

    if (!admin_username || !admin_password || !admin_display_name) {
      return res.status(400).json({ error: 'Admin-Benutzername, Passwort und Anzeigename sind erforderlich' });
    }

    const konfiLimit = konfiLimitLesen(max_konfis);
    if (konfiLimit.fehler) {
      return res.status(konfiLimit.fehler.status).json(konfiLimit.fehler.body);
    }
    const { trialEndsAt, isTrial } = laufzeitLesen(req.body);

    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(admin_password, 10);
    } catch (err) {
      console.error('Error hashing password in POST /organizations:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    const client = await db.getClient();
    let ergebnis;
    try {
      await client.query('BEGIN');
      ergebnis = await gemeindeAnlegen(client, {
        name: systemnameFuerNeueGemeinde(name, display_name),
        slug: systemnameFuerNeueGemeinde(slug, display_name),
        display_name, description, contact_name, contact_email, contact_phone,
        address, website_url, kirchenkreis,
        kirchenkreis_id: req.body.kirchenkreis_id,
        max_konfis: konfiLimit.wert,
        trial_ends_at: trialEndsAt,
        is_trial: isTrial,
        // Die erste Gemeindeleitung bekommt die Kontakt-Adresse der Gemeinde.
        admin: { username: admin_username, email: contact_email, display_name: admin_display_name, passwortHash: hashedPassword },
      });
      await client.query(ergebnis.fehler ? 'ROLLBACK' : 'COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const antwort = fehlerAlsAntwort(err);
      if (antwort) {
        return res.status(antwort.status).json(antwort.body);
      }
      console.error('Error creating organization:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }

    if (ergebnis.fehler) {
      return res.status(ergebnis.fehler.status).json(ergebnis.fehler.body);
    }

    const { anzahl } = ergebnis;
    res.status(201).json({
      id: ergebnis.organizationId,
      admin_user_id: ergebnis.adminId,
      default_badges_created: anzahl.abzeichen,
      default_certificates_created: anzahl.zertifikate,
      default_levels_created: anzahl.stufen,
      default_categories_created: anzahl.kategorien,
      default_activities_created: anzahl.aktivitaeten,
      default_challenges_created: anzahl.challenges,
      message: `Gemeinde erfolgreich erstellt (Standard-Rollen, Admin, ${anzahl.abzeichen} Badges, ${anzahl.zertifikate} Zertifikate, ${anzahl.stufen} Levels, ${anzahl.kategorien} Kategorien, ${anzahl.aktivitaeten} Aktivitäten, ${anzahl.challenges} Beispiel-Challenges)`
    });

    // Live-Update NACH der Response: nur an den ausfuehrenden Super-Admin selbst
    // (Multi-Device-Sync seiner eigenen Sitzung). Die Organisations-Verwaltung ist
    // super-admin-only und org-uebergreifend; ein Org-Broadcast passt hier nicht.
    // Andere Super-Admins sind selten und aktualisieren beim nächsten Seitenaufruf.
    liveUpdate.sendToUserByRole(req.user.id, 'organizations', 'create', null, req.user.organization_id);
  });

  // Update organization
  // super_admin: alle, org_admin: nur eigene
  router.put('/:id', rbacVerifier, validateUpdateOrg, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, slug, display_name, description, contact_name, contact_email,
        contact_phone, address, website_url, kirchenkreis, is_active
      } = req.body;

      // Zugriffsprüfung
      const isSuperAdmin = req.user.is_super_admin === true;
      const isOwnOrg = req.user.organization_id === parseInt(id) && req.user.role_name === 'org_admin';

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      // KIRCHENKREIS ALS ZUORDNUNG (Migration 191, 03.10.2026; Regel in
      // utils/kirchenkreisZuordnung.js). kirchenkreis_id setzt nur der
      // Super-Admin -- wie Sperre und Laufzeit; von anderen wird das Feld
      // uebergangen. Mit kirchenkreis_id steht dessen Name in der Textspalte
      // (die Apps bis 2.3.0 lesen nur sie), ein geschickter Text zaehlt dann
      // nicht; null hebt die Zuordnung auf und leert den Text.
      let kirchenkreisText = kirchenkreis || null;
      const setztZuordnung = isSuperAdmin && Object.prototype.hasOwnProperty.call(req.body, 'kirchenkreis_id');
      let kirchenkreisId = null;
      if (setztZuordnung) {
        if (!kirchenkreisIdGueltig(req.body.kirchenkreis_id)) {
          return res.status(400).json({ error: MELDUNG_KIRCHENKREIS_UNGUELTIG });
        }
        kirchenkreisText = null;
        if (req.body.kirchenkreis_id !== null) {
          const kk = await kirchenkreisFinden(db, req.body.kirchenkreis_id);
          if (!kk) {
            return res.status(400).json({ error: MELDUNG_KIRCHENKREIS_FEHLT });
          }
          kirchenkreisId = kk.id;
          kirchenkreisText = kk.name;
        }
      }

      // SYSTEMNAME (name, slug) wie die App ab 2.3.0 ihn bildet
      // (utils/gemeindeSystemname.js, systemnameBeimBearbeiten, 09.10.2026):
      // Die Store-App 2.2.x schickt ihn bei jedem Speichern neu und ohne
      // Umlaute; sonst stuende nach dem Speichern `travemnde` statt
      // `travemuende` da.
      const { rows: [bisher] } = await db.query(
        'SELECT name, slug, display_name FROM organizations WHERE id = $1', [id]
      );
      const systemName = systemnameBeimBearbeiten(name, display_name,
        bisher ? { wert: bisher.name, anzeigename: bisher.display_name } : null);
      const systemSlug = systemnameBeimBearbeiten(slug, display_name,
        bisher ? { wert: bisher.slug, anzeigename: bisher.display_name } : null);

      // Basis-Felder (von super_admin UND org_admin editierbar)
      const setClauses = [
        'name = $1', 'slug = $2', 'display_name = $3', 'description = $4',
        'contact_name = $5', 'contact_email = $6', 'contact_phone = $7', 'address = $8',
        'website_url = $9', 'kirchenkreis = $10', 'updated_at = NOW()'
      ];
      const params = [
        systemName, systemSlug, display_name, description, contact_name || null, contact_email, contact_phone,
        address, website_url, kirchenkreisText
      ];

      if (setztZuordnung) {
        params.push(kirchenkreisId);
        setClauses.push(`kirchenkreis_id = $${params.length}`);
      } else {
        // Nur Text (alle Apps bis 2.3.0): Weicht er vom Namen des
        // zugeordneten Kirchenkreises ab, endet die Zuordnung; derselbe Text
        // (ohne Gross/klein und Randleerzeichen) laesst sie stehen.
        setClauses.push(`kirchenkreis_id = CASE
          WHEN lower(btrim(COALESCE($10::text, ''))) = (SELECT lower(btrim(k.name)) FROM kirchenkreise k WHERE k.id = organizations.kirchenkreis_id)
          THEN kirchenkreis_id ELSE NULL END`);
      }

      // is_active darf NUR der super_admin setzen (Audit 22.08.2026).
      // Eine inaktive Organisation fuehrt in rbac.js:177 für JEDEN Zugang zu
      // 401 "Organization is inactive" — ein org_admin konnte damit sich selbst
      // und die gesamte Gemeinde aussperren, ohne den Schritt zurueckdrehen zu
      // können: dazu braeuchte es wieder einen Zugang, den es dann nicht mehr
      // gibt. Nur der super_admin kaeme noch heran.
      if (isSuperAdmin && Object.prototype.hasOwnProperty.call(req.body, 'is_active')) {
        params.push(is_active);
        setClauses.push(`is_active = $${params.length}`);
      }

      // trial_ends_at + is_trial darf NUR der super_admin ändern.
      //   trial_ends_at: null = unbegrenzt, Datum = Zugang bis dahin.
      //   is_trial:      true = Dashboard-Hinweis an, false = aus (Lizenz/unbegrenzt).
      if (isSuperAdmin && Object.prototype.hasOwnProperty.call(req.body, 'trial_ends_at')) {
        params.push(req.body.trial_ends_at || null);
        setClauses.push(`trial_ends_at = $${params.length}`);
        // Bei jeder Laufzeit-Änderung den Erinnerungs-Marker zuruecksetzen,
        // damit die nächste anstehende Lizenz-Erinnerung wieder verschickt wird.
        setClauses.push('license_reminder_sent_at = NULL');
      }
      if (isSuperAdmin && Object.prototype.hasOwnProperty.call(req.body, 'is_trial')) {
        params.push(req.body.is_trial === true);
        setClauses.push(`is_trial = $${params.length}`);
      }

      params.push(id);
      const query = `UPDATE organizations SET ${setClauses.join(', ')} WHERE id = $${params.length}`;

      const { rowCount } = await db.query(query, params);
        
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }
        
      res.json({ message: 'Gemeinde erfolgreich aktualisiert' });

      // Live-Update NACH der Response an den Ausfuehrenden selbst (Multi-Device).
      // Passt für super_admin (org-uebergreifende Verwaltung) und org_admin (eigene Org).
      liveUpdate.sendToUserByRole(req.user.id, 'organizations', 'update', null, req.user.organization_id);
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Gemeinde-Slug existiert bereits' });
      }
 console.error('Error updating organization:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Delete organization (super admin only) - Vollständige CASCADE-Löschkette
  router.delete('/:id', rbacVerifier, requireSuperAdmin, validateOrgId, async (req, res) => {
    const client = await db.getClient();
    try {
      const { id } = req.params;
      await client.query('BEGIN');

      // Prüfen ob Organisation existiert
      const { rows: [org] } = await client.query('SELECT id FROM organizations WHERE id = $1', [id]);
      if (!org) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      // NICHT DIE EIGENE GEMEINDE, WENN DAS KONTO NUR DORT MITGLIED IST
      // (29.09.2026, Nebenbefund Paket E). Die Kontoloeschung unten nimmt
      // jedes Konto mit, das nur hier Mitglied ist -- auch das des
      // ausfuehrenden Super-Admins. Er loeschte sich damit selbst und war
      // ausgesperrt; als einziger Super-Admin konnte danach niemand mehr
      // Gemeinden verwalten. Gezaehlt wird die STAMM-Gemeinde aus der
      // Datenbank (users.organization_id), nicht die gerade aktive
      // (req.user.organization_id nach switch-org). Mit einer weiteren
      // Mitgliedschaft zieht das Konto um (inWeitereGemeindeUmziehen) und
      // behaelt is_super_admin -- das bleibt erlaubt.
      const { rows: [selbst] } = await client.query(
        `SELECT u.organization_id,
                EXISTS (SELECT 1 FROM user_organizations uo
                         WHERE uo.user_id = u.id AND uo.organization_id <> u.organization_id) AS anderswo
           FROM users u WHERE u.id = $1`,
        [req.user.id]
      );
      if (selbst && Number(selbst.organization_id) === Number(id) && !selbst.anderswo) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Deine eigene Gemeinde kannst du nicht löschen: Dein Konto ist nur dort Mitglied und würde mitgelöscht. ' +
            'Lass die Löschung von einer anderen Person mit Super-Admin-Recht ausführen.'
        });
      }

      // VOLLSTAENDIGE LOESCHUNG aller Org-Daten in abhaengigkeitssicherer
      // Reihenfolge (Blaetter -> Wurzel). Reihenfolge ist bewusst explizit statt
      // sich auf FK-CASCADE zu verlassen, da viele FKs NO ACTION sind (created_by,
      // admin_id, *.organization_id auf chat_rooms/materials/settings/...). Eine
      // einzige nicht abgeraeumte NO-ACTION-Referenz wuerde sonst die ganze
      // Löschung blockieren (Rollback). Alles läuft in EINER Transaktion.
      //
      // DIE KONTEN (29.09.2026, Nebenbefund der Pakete vom 29.09.):
      //  - Gast-Mitgliedschaften FREMDER Konten in dieser Gemeinde
      //    (user_organizations.organization_id = id) enden; die Konten bleiben
      //    in ihrer Stamm-Gemeinde.
      //  - Hier zuhause, aber AUCH anderswo Mitglied: Das Konto zieht um, wie
      //    beim Entfernen aus der eigenen Gemeinde (users.js, Fall 2; Simon,
      //    27.09.2026: "Die andere [...] Organisation muss dann den Account
      //    behalten."). Gleich zu Beginn, damit die Abfragen unten ueber
      //    users.organization_id seine Geraete und Anmeldungen nicht treffen.
      //    Bis zum 29.09.2026 verschwand es ganz -- samt Mitgliedschaft und
      //    Arbeit in der anderen Gemeinde.
      //  - NUR hier Mitglied: dieselbe Kontoloeschung wie auf allen anderen
      //    Wegen (utils/kontoLoeschen.js), ganz am Ende, wenn die Daten der
      //    Gemeinde schon weg sind. Bis dahin endete hier alles mit
      //    `DELETE FROM users WHERE organization_id`: Spuren in einer anderen
      //    Gemeinde (Antrag, angelegter Termin aus einer beendeten
      //    Mitgliedschaft) liessen das am Fremdschluessel scheitern (500, die
      //    Gemeinde blieb stehen), und Dateien und Zweiergespraeche dort
      //    blieben liegen.
      const { rows: mitWeitererGemeinde } = await client.query(
        `SELECT u.id
           FROM users u
          WHERE u.organization_id = $1
            AND EXISTS (SELECT 1 FROM user_organizations uo
                         WHERE uo.user_id = u.id AND uo.organization_id <> $1)
          ORDER BY u.id
          FOR UPDATE OF u`,
        [id]
      );
      const umgezogen = [];
      for (const { id: userId } of mitWeitererGemeinde) {
        const ziel = await inWeitereGemeindeUmziehen(client, userId, id);
        if (ziel) umgezogen.push({ userId: Number(userId), organizationId: ziel.organization_id });
      }

      // Chat-Anhaenge VOR den DB-Deletes einsammeln, damit die Dateien nach
      // dem COMMIT vom Datenträger entfernt werden können (DSGVO Art. 17,
      // Befund 26.08.2026 — vorher überlebten sie die Org-Löschung dauerhaft).
      const { rows: orgChatFiles } = await client.query(
        'SELECT file_path FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1) AND file_path IS NOT NULL', [id]);

      // 1. Chat-System (Blaetter zuerst). chat_polls hängt an message_id (NICHT
      // room_id) -> über chat_messages der Org-Rooms aufloesen.
      await client.query('DELETE FROM chat_poll_votes WHERE poll_id IN (SELECT id FROM chat_polls WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1)))', [id]);
      await client.query('DELETE FROM chat_polls WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1))', [id]);
      await client.query('DELETE FROM chat_message_reactions WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1))', [id]);
      await client.query('DELETE FROM chat_read_status WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM chat_participants WHERE room_id IN (SELECT id FROM chat_rooms WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM chat_rooms WHERE organization_id = $1', [id]);

      // 2. Material-System (hängt an events/jahrgaenge/users der Org).
      // Auch hier: Dateinamen vor dem DB-Delete sichern (Befund 26.08.2026).
      const { rows: orgMaterialFiles } = await client.query(
        'SELECT mf.stored_name FROM material_files mf JOIN materials m ON mf.material_id = m.id WHERE m.organization_id = $1', [id]);
      await client.query('DELETE FROM material_files WHERE material_id IN (SELECT id FROM materials WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM material_events WHERE material_id IN (SELECT id FROM materials WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM material_jahrgaenge WHERE material_id IN (SELECT id FROM materials WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM materials WHERE organization_id = $1', [id]);

      // 3. Event-Daten
      await client.query('DELETE FROM event_points WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM event_reminders WHERE event_id IN (SELECT id FROM events WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM event_unregistrations WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM event_bookings WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM event_categories WHERE event_id IN (SELECT id FROM events WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM event_jahrgang_assignments WHERE event_id IN (SELECT id FROM events WHERE organization_id = $1)', [id]);
      // Ueber organization_id loeschen, NICHT nur ueber event_id: die Spalte
      // event_timeslots.organization_id traegt den Fremdschluessel und ist
      // nullable. Ein Timeslot ohne event_id wuerde vom Beziehungs-Subquery
      // nie erfasst und liesse das Loeschen der Organisation am Fremdschluessel
      // scheitern (nachgemessen 26.08.2026).
      await client.query('DELETE FROM event_timeslots WHERE organization_id = $1 OR event_id IN (SELECT id FROM events WHERE organization_id = $2)', [id, id]);
      // Serien-Selbstreferenz (events.series_id NO ACTION) entkoppeln, dann löschen
      await client.query('UPDATE events SET series_id = NULL WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM events WHERE organization_id = $1', [id]);

      // 4. Konfi-/Aktivitaets-Daten
      await client.query('DELETE FROM user_activities WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM bonus_points WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM user_badges WHERE organization_id = $1', [id]);
      // Dateipfade VOR den DB-Deletes einsammeln, damit die verschluesselten
      // Dateien nach dem COMMIT vom Datenträger entfernt werden können
      // (DSGVO Art. 17 — Security-Review 04.08.2026).
      const { rows: orgRequestPhotos } = await client.query(
        'SELECT photo_filename FROM activity_requests WHERE organization_id = $1 AND photo_filename IS NOT NULL', [id]);
      const { rows: orgChallengeFiles } = await client.query(
        'SELECT file_path FROM challenge_submissions WHERE organization_id = $1 AND file_path IS NOT NULL', [id]);
      await client.query('DELETE FROM activity_requests WHERE organization_id = $1', [id]);
      // Challenges explizit (statt CASCADE), passend zum Stil dieser Löschung
      await client.query('DELETE FROM challenge_submissions WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM challenge_jahrgang_assignments WHERE challenge_id IN (SELECT id FROM challenges WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM challenges WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM wrapped_snapshots WHERE organization_id = $1', [id]);

      // 5. Zertifikate (user_certificates -> certificate_types)
      await client.query('DELETE FROM user_certificates WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM certificate_types WHERE organization_id = $1', [id]);

      // 6. Notifications, Tokens, Resets (hängen an org-Usern)
      // Auch hier ueber organization_id: bei Multi-Org schreibt die App
      // Benachrichtigungen mit der AKTIVEN Organisation (rbac.js setzt
      // req.user.organization_id um), waehrend users.organization_id die
      // Heimat-Organisation bleibt. Eine Zeile mit organization_id = dieser Org
      // und einem Nutzer aus einer anderen faende der Subquery nicht -- sie
      // bliebe stehen und blockierte das Loeschen (nachgemessen 26.08.2026).
      await client.query('DELETE FROM notifications WHERE organization_id = $1 OR user_id IN (SELECT id FROM users WHERE organization_id = $2)', [id, id]);
      await client.query('DELETE FROM push_tokens WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)', [id]);

      // 7. User-Zuweisungen + Multi-Org-Mitgliedschaften
      await client.query('DELETE FROM user_jahrgang_assignments WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)', [id]);
      // ALLE Mitgliedschaften in dieser Org (auch Gast-User fremder Orgs).
      // Die betroffenen User VORHER einsammeln: Ihr gecachtes req.user trägt
      // noch die Rolle in dieser Org, und ohne Invalidierung könnten sie bis
      // zu 30 Sekunden weiterarbeiten (Audit 22.08.2026).
      const { rows: exMitglieder } = await client.query(
        'SELECT DISTINCT user_id FROM user_organizations WHERE organization_id = $1',
        [id]
      );
      await client.query('DELETE FROM user_organizations WHERE organization_id = $1', [id]);

      // 8. Konfsprueche (org-gescopt; konfi_profiles.konfspruch_id ist SET NULL)
      await client.query('DELETE FROM konfspruch_uebersetzungen WHERE spruch_id IN (SELECT id FROM konfsprueche WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM konfsprueche WHERE organization_id = $1', [id]);

      // 9. Stammdaten, die per created_by/admin_id (NO ACTION) auf users zeigen,
      // MUESSEN vor DELETE FROM users weg, sonst blockiert der FK das Löschen.
      await client.query('DELETE FROM activity_categories WHERE activity_id IN (SELECT id FROM activities WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM activities WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM categories WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM user_badges WHERE organization_id = $1', [id]); // vor custom_badges (badge_id NO ACTION)
      await client.query('DELETE FROM custom_badges WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM levels WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM invite_codes WHERE organization_id = $1', [id]);
      await client.query('DELETE FROM settings WHERE organization_id = $1', [id]);

      // 10. Konfi-Profile, dann die Konten, die nur hier Mitglied sind --
      // jedes mit der gemeinsamen Kontoloeschung (Kopf dieser Route). Ihre
      // Buchungen in DIESER Gemeinde sind oben schon weg; Nachruecken gibt es
      // deshalb nur noch in anderen Gemeinden.
      await client.query('DELETE FROM konfi_profiles WHERE organization_id = $1', [id]);
      // Alle in einem Durchgang (kontenDatenLoeschen): einzeln waren es rund
      // 70 Abfragen je Konto.
      const { rows: nurHier } = await client.query(
        'SELECT id FROM users WHERE organization_id = $1 ORDER BY id', [id]);
      const kontoLoeschung = await kontenDatenLoeschen(client, nurHier.map((k) => k.id));

      // 11. Jahrgänge (nach users; user_jahrgang_assignments ist weg)
      await client.query('DELETE FROM jahrgaenge WHERE organization_id = $1', [id]);

      // 12. Rollen (role_permissions + user_organizations.role_id RESTRICT sind
      // bereits oben abgeraeumt)
      await client.query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE organization_id = $1)', [id]);
      await client.query('DELETE FROM roles WHERE organization_id = $1', [id]);

      // 13. Die Anfrage vom Formular, aus der die Gemeinde entstanden ist
      // (03.10.2026): Sie bleibt, solange die Gemeinde besteht, und geht mit
      // ihr -- ohne Gemeinde gibt es keinen Grund mehr, die Kontaktdaten der
      // anfragenden Person zu halten (Datenschutzerklaerung 9c). Der
      // Fremdschluessel (ON DELETE SET NULL) liesse sie sonst ohne Bezug stehen.
      await client.query('DELETE FROM gemeinde_anfragen WHERE organization_id = $1', [id]);

      // 14. Organisation selbst
      const { rowCount } = await client.query('DELETE FROM organizations WHERE id = $1', [id]);
      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      await client.query('COMMIT');

      // Cache der ehemaligen Mitglieder leeren — erst nach dem COMMIT, damit
      // ein Rollback keinen unnötig geleerten Cache hinterlaesst. Ohne das
      // könnten Gast-User fremder Organisationen bis zu 30 Sekunden mit ihrer
      // alten Rolle weiterarbeiten (Audit 22.08.2026).
      for (const m of exMitglieder) {
        invalidateUserCache(m.user_id);
      }
      // Umgezogene Konten arbeiten ab der naechsten Anfrage in ihrer neuen
      // Stamm-Gemeinde (Rechte-Cache leer); ihre Sockets sitzen noch in den
      // Raeumen dieser Gemeinde und verbinden neu -- wie in users.js.
      // Geloeschte Konten: sofort 401 statt bis zu 30 Sekunden weiter.
      try {
        for (const u of umgezogen) {
          invalidateUserCache(u.userId);
          chatSyncCache.invalidate(u.organizationId, u.userId);
          liveUpdate.disconnectUserSockets(u.userId);
          liveUpdate.sendToOrgAdmins(u.organizationId, 'users', 'update', { userId: u.userId });
        }
        for (const userId of kontoLoeschung.geloescht) {
          invalidateUserCache(userId);
          liveUpdate.disconnectUserSockets(userId);
        }
      } catch (nachErr) {
        console.error('Org-Delete: Nacharbeit an den Konten fehlgeschlagen:', nachErr.message);
      }
      // Dateien der geloeschten Konten aus anderen Gemeinden (wirft nie,
      // protokolliert ohne Dateinamen), wie auf allen Loeschwegen vor der
      // Antwort.
      await kontoDateienLoeschen(kontoLoeschung.dateien);

      // konten_geloescht/konten_umgezogen (29.09.2026) additiv.
      res.json({
        message: 'Gemeinde und alle zugehörigen Daten erfolgreich gelöscht',
        konten_geloescht: kontoLoeschung.geloescht.length,
        konten_umgezogen: umgezogen.length,
      });

      // Nachgerueckte in anderen Gemeinden benachrichtigen, Chatlisten der
      // Gespraechspartner:innen auffrischen. Wirft nie.
      meldeNachKontoLoeschungEinreihen(db, kontoLoeschung,
        { req, bezeichnung: 'DELETE /organizations/:id (Meldungen nach Kontoloeschung)' });

      // Dateien nach dem COMMIT entfernen (nicht blockierend — ein fehlendes
      // File darf die bereits erfolgte Löschung nicht scheitern lassen).
      for (const row of orgRequestPhotos) {
        try { await deletePhotoFile(row.photo_filename); } catch (e) { console.warn('Org-Delete: Antragsfoto nicht entfernbar:', e.message); }
      }
      for (const row of orgChallengeFiles) {
        try { await deleteChallengeFile(row.file_path); } catch (e) { console.warn('Org-Delete: Challenge-Datei nicht entfernbar:', e.message); }
      }
      for (const row of orgChatFiles) {
        try { await deleteChatFile(row.file_path); } catch (e) { console.warn('Org-Delete: Chat-Anhang nicht entfernbar:', e.message); }
      }
      for (const row of orgMaterialFiles) {
        try { await deleteMaterialFile(row.stored_name); } catch (e) { console.warn('Org-Delete: Material-Datei nicht entfernbar:', e.message); }
      }

      // Live-Update NACH der Response an den ausfuehrenden Super-Admin selbst (Multi-Device).
      liveUpdate.sendToUserByRole(req.user.id, 'organizations', 'delete', null, req.user.organization_id);

    } catch (err) {
      await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
      console.error('Error deleting organization:', err);
      res.status(500).json({ error: 'Datenbankfehler beim Löschen der Gemeinde' });
    } finally {
      client.release();
    }
  });

  // Set Konfi-Limit (max_konfis) der Organisation - NUR super_admin (D-03/D-04)
  // Eigener Endpunkt, damit org_admin (der die PUT-Route für die eigene Org nutzen darf)
  // das Limit NICHT setzen und den Tarif aushebeln kann.
  // Body: { max_konfis: <nicht-negativer Integer | null> }. null = unbegrenzt.
  router.patch('/:id/limit', rbacVerifier, requireSuperAdmin, validateOrgId, async (req, res) => {
    try {
      const { id } = req.params;
      const { max_konfis } = req.body;

      // Validierung: null erlaubt (unbegrenzt), sonst nicht-negativer Integer.
      if (max_konfis !== null && max_konfis !== undefined) {
        if (typeof max_konfis !== 'number' || !Number.isInteger(max_konfis) || max_konfis < 0) {
          return res.status(400).json({ error: 'max_konfis muss null oder eine nicht-negative ganze Zahl sein' });
        }
      }

      const value = (max_konfis === undefined) ? null : max_konfis;

      const { rowCount } = await db.query(
        'UPDATE organizations SET max_konfis = $1, updated_at = NOW() WHERE id = $2',
        [value, id]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      res.json({ message: 'Konfi-Limit erfolgreich aktualisiert', max_konfis: value });

      // Live-Update NACH der Response an den ausfuehrenden Super-Admin selbst (Multi-Device).
      liveUpdate.sendToUserByRole(req.user.id, 'organizations', 'update', null, req.user.organization_id);
    } catch (err) {
      console.error('Error setting organization limit:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Get organization users - org_admin für eigene Org, super_admin für alle
  router.get('/:id/users', rbacVerifier, async (req, res) => {
    const isSuperAdmin = req.user.is_super_admin === true;
    const isOwnOrg = req.user.organization_id === parseInt(req.params.id);
    const isOrgAdmin = req.user.role_name === 'org_admin';

    // Zugriffsprüfung: super_admin oder org_admin der eigenen Org
    if (!isSuperAdmin && !(isOwnOrg && isOrgAdmin)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    try {
      const { id } = req.params;

      // BEIDE Quellen der Zugehoerigkeit, Rolle und Sperre DIESER Gemeinde,
      // nur Jahrgaenge dieser Gemeinde (08.10.2026, Planung mehrfach-konten;
      // Regel in MITGLIEDSCHAFTEN_SQL, utils/orgMitglieder.js). Vorher
      // `u.organization_id = $1` mit der Rolle am Konto: Wer die Gemeinde
      // ueber user_organizations betreut, fehlte. Antwortform unveraendert.
      const query = `
        SELECT u.id, u.username, u.email, u.display_name, m.is_active,
               u.last_login_at, u.created_at,
               r.name as role_name, r.display_name as role_display_name,
               COUNT(DISTINCT j.id) as assigned_jahrgaenge_count
        FROM (${MITGLIEDSCHAFTEN_SQL}) m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN roles r ON r.organization_id = m.organization_id AND r.name = m.rolle
        LEFT JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
        LEFT JOIN jahrgaenge j ON j.id = uja.jahrgang_id AND j.organization_id = $1
        WHERE m.organization_id = $1
        GROUP BY u.id, m.is_active, r.name, r.display_name
        ORDER BY u.created_at DESC
      `;

      const { rows: users } = await db.query(query, [id]);
      res.json(users);
    } catch (err) {
 console.error('Error fetching organization users:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Get organization admins (org_admin role) - super_admin oder org_admin der eigenen Org
  router.get('/:id/admins', rbacVerifier, async (req, res) => {
    try {
      const { id } = req.params;

      // Zugriffsprüfung: super_admin oder org_admin der eigenen Org
      const isSuperAdmin = req.user.is_super_admin === true;
      const isOwnOrg = req.user.organization_id === parseInt(id) && req.user.role_name === 'org_admin';

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      // BEIDE Quellen der Zugehoerigkeit, die Rolle DIESER Gemeinde
      // (08.10.2026, Planung mehrfach-konten). Hier stand
      // `u.organization_id = $1` mit der Rolle am Konto: Wer die Gemeinde
      // ueber user_organizations leitet, fehlte im Abschnitt
      // "Gemeindeleitung" -- in Produktion hat Organisation 2 ihre ganze
      // Leitung nur dort (gemessen 25.09.2026). Regel in
      // MITGLIEDSCHAFTEN_SQL (utils/orgMitglieder.js); is_active ist dort der
      // Stand in DIESER Gemeinde. Geloeschte Konten fehlen. Antwortform
      // unveraendert.
      const query = `
        SELECT u.id, u.username, u.email, u.display_name, m.is_active,
               u.last_login_at, u.created_at
        FROM (${MITGLIEDSCHAFTEN_SQL}) m
        JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = $1 AND m.rolle = 'org_admin'
        ORDER BY u.created_at ASC
      `;

      const { rows: admins } = await db.query(query, [id]);
      res.json(admins);
    } catch (err) {
 console.error('Error fetching organization admins:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Add new org_admin to organization - super_admin oder org_admin der eigenen Org
  router.post('/:id/admins', rbacVerifier, validateCreateOrgAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, display_name, password, email } = req.body;

      // Zugriffsprüfung: super_admin oder org_admin der eigenen Org
      const isSuperAdmin = req.user.is_super_admin === true;
      const isOwnOrg = req.user.organization_id === parseInt(id) && req.user.role_name === 'org_admin';

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      if (!username || !display_name || !password) {
        return res.status(400).json({ error: 'Benutzername, Name und Passwort sind erforderlich' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
      }

      // Prüfen ob Organisation existiert
      const { rows: [org] } = await db.query("SELECT id FROM organizations WHERE id = $1", [id]);
      if (!org) {
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      // org_admin Rolle für diese Organisation finden
      const { rows: [role] } = await db.query(
        "SELECT id FROM roles WHERE organization_id = $1 AND name = 'org_admin'",
        [id]
      );

      if (!role) {
        return res.status(500).json({ error: 'Rolle der Gemeindeleitung für die Gemeinde nicht gefunden' });
      }

      // Benutzername GLOBAL eindeutig (ohne Gross/klein). Pruefen und Anlegen
      // in EINER Transaktion unter einer Sperre je Namen
      // (utils/benutzernameSperre.js) -- bis 30.09.2026 ohne: Zwei
      // gleichzeitige Anlagen desselben Namens kamen beide durch. Das Passwort
      // wird vorher gehasht, damit die Verbindung nicht waehrend bcrypt belegt
      // ist.
      const hashedPassword = await bcrypt.hash(password, 10);
      const client = await db.getClient();
      let newAdmin;
      try {
        await client.query('BEGIN');
        if (await benutzernameSperrenUndPruefen(client, username)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: MELDUNG_VERGEBEN });
        }
        ({ rows: [newAdmin] } = await client.query(`
          INSERT INTO users (organization_id, role_id, username, email, password_hash, display_name, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id, username, display_name, email, is_active, created_at
        `, [id, role.id, username, email || null, hashedPassword, display_name]));
        // Ein vorher durchprobierter Benutzername startet frei (utils/kontoSperre.js).
        await kontoSperreAufheben(client, newAdmin.id);
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }

      res.status(201).json(newAdmin);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Benutzername oder E-Mail existiert bereits' });
      }
 console.error('Error creating org admin:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ============================================
  // MULTI-ORG MITGLIEDSCHAFTEN (nur super_admin)
  // ============================================
  // Weist BESTEHENDE User (Admin/Teamer/Org-Admin) zusaetzlichen Organisationen
  // zu, sodass sie per Org-Switcher zwischen ihnen wechseln können. Konfis sind
  // ausgenommen (Switcher ist ein Verwaltungs-Feature).

  const validateAddMember = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige Gemeinde-ID'),
    body('user_id').isInt({ min: 1 }).withMessage('Ungültige Benutzer-ID'),
    body('role_name').trim().notEmpty().withMessage('Rolle ist erforderlich'),
    handleValidationErrors
  ];

  // GET /:id/members — alle Multi-Org-Mitglieder dieser Organisation
  router.get('/:id/members', rbacVerifier, requireSuperAdmin, validateOrgId, async (req, res) => {
    try {
      const { id } = req.params;
      // Beide Quellen vereinen und pro User EINMAL ausgeben:
      //  1) Primaer-User der Org (users.organization_id) — haben i.d.R. KEINEN
      //     user_organizations-Eintrag, wuerden sonst hier fehlen (z.B. der
      //     Org-eigene Admin).
      //  2) Multi-Org-Mitglieder (user_organizations-Mapping).
      // is_primary kennzeichnet die Primaer-Org (kann hier nicht entfernt werden).
      // Bei Doppelung (User primaer UND Mapping) gewinnt der Primaer-Eintrag
      // (is_primary=true) per DISTINCT ON + ORDER.
      // COALESCE (03.10.2026): Bei einem Konto ohne Gemeinde ergab der
      // Vergleich NULL statt false -- is_primary ist ein Boolean (Vertrag).
      const { rows } = await db.query(`
        SELECT DISTINCT ON (m.id)
               m.id, m.username, m.display_name, m.email,
               m.role_name, m.role_display_name, m.is_primary, m.created_at
        FROM (
          SELECT u.id, u.username, u.display_name, u.email,
                 r.name as role_name, r.display_name as role_display_name,
                 true as is_primary, u.created_at
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.organization_id = $1 AND u.is_active = true AND r.name != 'konfi'
          UNION ALL
          SELECT u.id, u.username, u.display_name, u.email,
                 r.name as role_name, r.display_name as role_display_name,
                 COALESCE(u.organization_id = uo.organization_id, false) as is_primary, uo.created_at
          FROM user_organizations uo
          JOIN users u ON uo.user_id = u.id AND u.is_active = true
          JOIN roles r ON uo.role_id = r.id
          WHERE uo.organization_id = $1 AND r.name != 'konfi'
        ) m
        ORDER BY m.id, m.is_primary DESC
      `, [id]);
      // Sekundaer nach Anzeigename sortieren (DISTINCT ON erzwingt Sortierung nach m.id)
      rows.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '', 'de'));
      res.json(rows);
    } catch (err) {
      console.error('Database error in GET /organizations/:id/members:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /:id/members — bestehenden User dieser Organisation zuweisen.
  // role_name (org_admin | admin | teamer) wird in der ZIEL-Org aufgeloest.
  router.post('/:id/members', rbacVerifier, requireSuperAdmin, validateAddMember, async (req, res) => {
    const { id } = req.params;
    const { user_id, role_name } = req.body;
    const orgId = parseInt(id);

    if (role_name === 'konfi' || role_name === 'super_admin') {
      return res.status(400).json({ error: 'Nur org_admin, admin oder teamer sind als Mitglieds-Rolle erlaubt' });
    }

    try {
      // User existiert + ist kein Konfi?
      const { rows: [user] } = await db.query(`
        SELECT u.id, u.organization_id, r.name as role_name
        FROM users u LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [user_id]);
      if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }
      if (user.role_name === 'konfi') {
        return res.status(400).json({ error: 'Konfis können nicht mehreren Gemeinden zugewiesen werden' });
      }

      // Organisation existiert?
      const { rows: [org] } = await db.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
      if (!org) {
        return res.status(404).json({ error: 'Gemeinde nicht gefunden' });
      }

      // Rolle in der ZIEL-Org aufloesen
      const { rows: [role] } = await db.query(
        'SELECT id FROM roles WHERE organization_id = $1 AND name = $2',
        [orgId, role_name]
      );
      if (!role) {
        return res.status(400).json({ error: `Rolle '${role_name}' existiert in dieser Gemeinde nicht` });
      }

      // KONFI UND TEAM NIE ZUGLEICH, auch nicht ueber eine weitere Gemeinde
      // (Simon, 28.09.2026). Oben steht nur die Stammrolle; ein Konto, das
      // zuhause Team und anderswo Konfi ist (Altbestand), kaeme sonst in
      // eine weitere Gemeinde. Status 400 wie die Konfi-Ablehnung oben.
      const konflikt = await pruefeKonfiOderTeam(db, { userId: user_id, organizationId: orgId, rolle: role_name });
      if (konflikt) {
        return res.status(400).json(konflikt);
      }

      // Upsert: vorhandene Mitgliedschaft aktualisiert die Rolle
      await db.query(`
        INSERT INTO user_organizations (user_id, organization_id, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, organization_id)
        DO UPDATE SET role_id = EXCLUDED.role_id
      `, [user_id, orgId, role.id]);

      invalidateUserCache(parseInt(user_id));
      res.status(201).json({ message: 'Mitgliedschaft gespeichert' });

      // Chat-Mitgliedschaft der Ziel-Org INLINE pflegen (TTL-Cache verlässt
      // sich darauf): neues Mitglied sofort in Team-Chat, Org-Admins zusaetzlich
      // in alle Jahrgangs-Chats der Ziel-Org.
      try {
        chatSyncCache.invalidate(orgId, parseInt(user_id));
        await syncTeamChat(db, orgId, req.user.id);
        if (role_name === 'org_admin') {
          const { rows: jgs } = await db.query(
            'SELECT id FROM jahrgaenge WHERE organization_id = $1', [orgId]
          );
          for (const jg of jgs) {
            await syncJahrgangChat(db, jg.id, orgId, req.user.id);
          }
        }
      } catch (syncErr) {
        console.error('Chat-Sync nach Mitgliedschafts-Zuweisung fehlgeschlagen:', syncErr.message);
      }
    } catch (err) {
      console.error('Database error in POST /organizations/:id/members:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // DELETE /:id/members/:userId — Mitgliedschaft entfernen.
  // Die PRIMAER-Org eines Users kann nicht entfernt werden (das wäre ein User-
  // Löschen, nicht ein Multi-Org-Entzug) -> dafuer die User-Verwaltung nutzen.
  router.delete('/:id/members/:userId', rbacVerifier, requireSuperAdmin, async (req, res) => {
    const orgId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    if (!Number.isInteger(orgId) || !Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Ungültige ID' });
    }
    try {
      const { rows: [user] } = await db.query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }
      if (user.organization_id === orgId) {
        return res.status(400).json({ error: 'Die Stamm-Gemeinde kann hier nicht entfernt werden' });
      }
      // Mitgliedschaft, Zuweisungen und Chat-Plaetze DIESER Gemeinde in einer
      // Transaktion -- dieselbe Funktion wie auf dem Weg ueber die Leitung
      // (users.js). Bis zum 27.09.2026 entfernte dieser Weg nur
      // user_organizations; Gruppen, Zweierraeume und Jahrgangs-Chats ohne
      // Zuweisung blieben, und die Person bekam weiter jede Nachricht als
      // Push (Audit "Wer bekommt was" BF-08). Auch die Zuweisungen blieben
      // stehen und galten bei erneuter Aufnahme sofort wieder.
      let betroffeneJahrgaenge = [];
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        const { rowCount } = await client.query(
          'DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
          [userId, orgId]
        );
        if (rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
        }
        ({ jahrgangIds: betroffeneJahrgaenge } =
          await gemeindeZugehoerigkeitRaeumen(client, userId, orgId));
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }

      // Zusaetzlich zum Cache-Leeren die bestehenden Access-Tokens sperren.
      // Der Cache-Reset allein genuegt heute, hängt aber daran, dass genau
      // EIN Backend-Prozess läuft und dass jeder Verbraucher des
      // active_organization_id-Claims durch rbacVerifier geht. Der Soft-Revoke
      // kostet nichts pro Request (die Prüfung existiert in rbac.js) und
      // macht den Entzug davon unabhaengig.
      //
      // Niemand wird dadurch ausgesperrt: Das Refresh-Token bleibt gueltig,
      // der Client holt still ein neues Access-Token — und dieses trägt den
      // entzogenen Claim nicht mehr, weil die Refresh-Route die Mitgliedschaft
      // erneut prüft.
      await db.query('UPDATE users SET token_invalidated_at = NOW() WHERE id = $1', [userId]);
      invalidateUserCache(userId);
      res.json({ message: 'Mitgliedschaft entfernt' });

      // Danach wie auf dem Weg ueber die Leitung (users.js): Sync-Merker,
      // Team-Chat und die Jahrgaenge, deren Zuweisung ging, abgleichen, und
      // offene Sockets trennen -- sie sitzen noch in den Raeumen dieser
      // Gemeinde und bekaemen dort jede neue Nachricht live.
      try {
        chatSyncCache.invalidate(orgId, userId);
        await syncTeamChat(db, orgId, req.user.id);
        for (const jahrgangId of betroffeneJahrgaenge) {
          await syncJahrgangChat(db, jahrgangId, orgId, req.user.id);
        }
      } catch (syncErr) {
        console.error('Chat-Sync nach Mitgliedschafts-Entzug fehlgeschlagen:', syncErr.message);
      }
      liveUpdate.disconnectUserSockets(userId);
    } catch (err) {
      console.error('Database error in DELETE /organizations/:id/members/:userId:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Get organization statistics - nur eigene Org
  // requireTeamer aus demselben Grund wie bei GET /:id: Die Zähler (u.a.
  // pending_requests) sind Verwaltungsdaten und gehen Konfis nichts an.
  router.get('/:id/stats', rbacVerifier, requireOrgVerwaltung, async (req, res) => {
    try {
      const { id } = req.params;

      // Zugriffsprüfung: nur eigene Org (oder super_admin für alle)
      const isSuperAdmin = req.user.is_super_admin === true;
      const isOwnOrg = req.user.organization_id === parseInt(id);

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      
      const statsQueries = {
        konfis: "SELECT COUNT(*)::int as count FROM konfi_profiles WHERE organization_id = $1",
        activities: "SELECT COUNT(*)::int as count FROM activities WHERE organization_id = $1",
        events: "SELECT COUNT(*)::int as count FROM events WHERE organization_id = $1",
        badges: "SELECT COUNT(*)::int as count FROM custom_badges WHERE organization_id = $1",
        requests: "SELECT COUNT(*)::int as count FROM activity_requests ar JOIN konfi_profiles kp ON ar.user_id = kp.user_id WHERE kp.organization_id = $1",
        pending_requests: "SELECT COUNT(*)::int as count FROM activity_requests ar JOIN konfi_profiles kp ON ar.user_id = kp.user_id WHERE kp.organization_id = $1 AND ar.status = 'pending'"
      };
      
      // Execute all queries in parallel
      const queryPromises = Object.values(statsQueries).map(query => db.query(query, [id]));
      const results = await Promise.all(queryPromises);
      
      const stats = {};
      const keys = Object.keys(statsQueries);

      results.forEach((result, index) => {
        const key = keys[index];
        stats[key] = result.rows[0]?.count || 0;
      });
      
      res.json(stats);
    } catch (err) {
 console.error('Database error in GET /organizations/:id/stats:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Standard-Zertifikatstypen für Organisationen nachziehen, die noch keine
  // haben (einmalige Datenmigration für Bestandsorganisationen). Der Insert
  // steht in utils/zertifikatstypenSeed.js -- mit ON CONFLICT DO NOTHING,
  // damit zwei gleichzeitig startende Replicas sich nicht mit duplicate-key
  // in die Quere kommen (Audit 26.09.2026, Betrieb BF-16).
  //
  // Laeuft bewusst NICHT in Tests: Der Aufruf am Ende dieser Datei ist nicht
  // awaited und hängt am Router-Load. In der Testsuite wird createApp() pro
  // Datei neu aufgerufen, während beforeEach die Organisationen löscht und
  // neu anlegt — die noch laufende Schleife schrieb dann gegen bereits
  // geloeschte org-IDs ("violates foreign key constraint
  // certificate_types_organization_id_fkey"). Traf das den
  // POST /certificate-types im beforeEach von teamer.test.js, blieb certTypeId
  // undefined und die Folgetests fielen um — ein sporadisch roter Build, der
  // Deploys blockierte, ohne dass am Code etwas kaputt war.
  // Die Funktion selbst ist in tests/utils/zertifikatstypenSeed.test.js geprueft.
  if (process.env.NODE_ENV !== 'test') {
    const { seedeStandardZertifikatstypen } = require('../utils/zertifikatstypenSeed');
    seedeStandardZertifikatstypen(db)
      .then(({ organisationen, eingefuegt }) => {
        if (organisationen > 0) {
          console.log(`Seeded default certificates for ${organisationen} organization(s) (${eingefuegt} rows)`);
        }
      })
      .catch((err) => console.error('Error seeding default certificates:', err.message));
  }

  return router;
};