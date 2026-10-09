const jwt = require('jsonwebtoken');
const { ladeMitgliedschaftenMitSperre, waehleGemeinde } = require('../utils/orgMitglieder');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// ============================================
// LRU-CACHE für User-Objekte (30s TTL, max 500 Eintraege)
// ============================================
const USER_CACHE_TTL = 30 * 1000; // 30 Sekunden
const USER_CACHE_MAX = 500;
const userCache = new Map();

// Stand je Anfrage, auch bei gespeichertem Nutzer (08.10.2026, siehe
// verifyTokenRBAC): Konto frei (nicht gesperrt, nicht geloescht), in der
// gespeicherten Gemeinde Mitglied und dort nicht gesperrt, Rolle dort, Gemeinde
// nicht gesperrt, Soft-Revoke. $2 ist die gespeicherte aktive Gemeinde; ein
// Konto ohne Gemeinde (Support) hat dort NULL.
const STAND_SQL = `
  SELECT (COALESCE(u.is_active, false) AND u.deleted_at IS NULL
          AND COALESCE(ug.is_active, true)) AS frei,
         ($2::bigint IS NULL OR u.organization_id = $2 OR ug.id IS NOT NULL) AS mitglied,
         CASE WHEN $2::bigint IS NULL OR u.organization_id = $2 THEN u.role_id ELSE ug.role_id END AS role_id,
         ($2::bigint IS NULL OR COALESCE(o.is_active, true)) AS org_aktiv,
         u.token_invalidated_at
    FROM users u
    LEFT JOIN user_organizations ug ON ug.user_id = u.id AND ug.organization_id = $2
    LEFT JOIN organizations o ON o.id = $2
   WHERE u.id = $1`;

// ============================================
// ABLEHNUNG "nicht Mitglied der aktiven Gemeinde" (403)
// ============================================
// Eine Antwort fuer rbac.js und die beiden Datei-Routen mit eigener
// Anmeldung (challenges.js und chat.js, GET /files/:filename).
//
// DER TEXT BLEIBT "... Organisation" -- als einziger Server-Text (Begriffe
// "Gemeinde statt Organisation", 29.09.2026): Die Store-Apps 2.2.0 und
// 2.3.0 vergleichen ihn in services/api.ts woertlich und fallen nur damit in
// die Stamm-Gemeinde zurueck. Mit anderem Wortlaut blieben sie in der
// entzogenen Gemeinde haengen und zeigten ueberall leere Listen.
//
// error_code kam am 29.09.2026 dazu. Die App wertet ihn seitdem vor dem Text
// aus; sobald keine App ohne diese Pruefung mehr ruft, darf der Text
// "Kein Zugriff auf diese Gemeinde" heissen.
const ORG_KEIN_ZUGRIFF = Object.freeze({
  error: 'Kein Zugriff auf diese Organisation',
  error_code: 'org_kein_zugriff',
});

// Cache-Key haelt die AKTIVE Org mit rein: ein User kann (Multi-Org) je nach
// aktivem Org-Kontext ein voellig anderes req.user-Objekt haben (andere Org,
// andere Rolle, andere Jahrgänge). Ohne Org im Key wuerde der 30s-Cache nach
// einem Org-Switch die alte Org ausliefern.
const cacheKey = (userId, activeOrgId) => `${userId}:${activeOrgId || 'default'}`;

const getCachedUser = (key) => {
  const entry = userCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > USER_CACHE_TTL) {
    userCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCachedUser = (key, data) => {
  // Evict aelteste Eintraege wenn Max erreicht
  if (userCache.size >= USER_CACHE_MAX) {
    const firstKey = userCache.keys().next().value;
    userCache.delete(firstKey);
  }
  userCache.set(key, { data, timestamp: Date.now() });
};

// Cache invalidieren bei User-Änderungen (Export für andere Module).
// Loescht ALLE Org-Varianten eines Users (Praefix-Match), da der Key
// "userId:orgId" lautet. Ohne userId: kompletter Cache-Clear.
const invalidateUserCache = (userId) => {
  if (userId) {
    const prefix = `${userId}:`;
    for (const key of userCache.keys()) {
      if (key.startsWith(prefix)) userCache.delete(key);
    }
  } else {
    userCache.clear();
  }
};

// ============================================
// ROLLEN-HIERARCHIE (vereinfacht)
// ============================================
// super_admin (5) - Organisations-übergreifend, nur Org-Verwaltung
// org_admin (4)   - Volle Rechte in eigener Organisation
// admin (3)       - Konfis, Events, Badges, Aktivitäten, Requests
// teamer (2)      - Events, Konfis ansehen, Punkte vergeben
// konfi (1)       - Nur eigene Daten
// ============================================

// Token verification - lädt User-Daten ohne Permissions aus DB
const verifyTokenRBAC = (db) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    try {
      // AKTIVE Organisation bestimmen (Multi-Org): Client sendet die gewuenschte
      // Org per Header X-Active-Organization (oder als Claim im Access-Token, der
      // beim Switch neu ausgestellt wird). Validierung (Mitgliedschaft) erfolgt
      // unten gegen user_organizations. Ohne Angabe -> Primaer-Org aus users.
      const headerOrg = parseInt(req.headers['x-active-organization']);
      const tokenOrg = decoded.active_organization_id ? parseInt(decoded.active_organization_id) : null;
      const requestedActiveOrg = Number.isInteger(headerOrg) ? headerOrg
        : (Number.isInteger(tokenOrg) ? tokenOrg : null);

      // Cache-Check (Key inkl. aktiver Org).
      //
      // SPERRE, LOESCHUNG, ROLLE UND MITGLIEDSCHAFT KOMMEN NIE AUS DEM
      // ZWISCHENSPEICHER (08.10.2026, Befund "Sperre wirkt auf der zweiten
      // Replica erst nach 30 s", Sicherheit BF-10). invalidateUserCache leert
      // nur die Replica, die die Sperre bearbeitet; die andere arbeitete bis
      // zu 30 s mit dem alten Stand weiter. Jetzt prueft jede Anfrage mit
      // EINER Abfrage ueber zwei Primaerschluessel (users.id und den
      // UNIQUE-Index user_organizations(user_id, organization_id)) den Stand
      // -- unabhaengig davon, welche Replica gesperrt hat. Nur wenn alles
      // gleich ist, gilt der gespeicherte Rest (Name, Jahrgaenge, Gemeinde).
      // Gemessen am 08.10.2026 (lokale Test-Datenbank, 2 000 Aufrufe): siehe
      // tests/routes/rbacSperreSofort.test.js und Commit-Nachricht.
      const ckey = cacheKey(decoded.id, requestedActiveOrg);
      const cached = getCachedUser(ckey);
      if (cached) {
        const { rows: [stand] } = await db.query(STAND_SQL, [decoded.id, cached.userObj.organization_id]);
        const gleich = stand
          && stand.frei === true
          && stand.mitglied === true
          && (stand.org_aktiv === true || cached.userObj.role_name === 'super_admin')
          && Number(stand.role_id) === Number(cached.role_id);
        if (gleich) {
          if (stand.token_invalidated_at) {
            const invalidatedAt = Math.floor(new Date(stand.token_invalidated_at).getTime() / 1000);
            if (decoded.iat < invalidatedAt) {
              return res.status(401).json({ error: 'Token invalidated' });
            }
          }
          req.user = cached.userObj;
          return next();
        }
        // Etwas hat sich geaendert: neu aufloesen, mit den Antworten unten.
        userCache.delete(ckey);
      }

      // User-Query mit LEFT JOIN für super_admin (organization_id kann NULL sein)
      const userQuery = `
        SELECT u.id, u.organization_id, u.role_id, u.username, u.display_name, u.is_active, u.deleted_at,
               u.role_title, u.is_super_admin, u.token_invalidated_at,
               r.name as role_name, r.display_name as role_display_name,
               o.name as organization_name, o.slug as organization_slug,
               COALESCE(o.is_active, true) as organization_active
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;
      const { rows: [user] } = await db.query(userQuery, [decoded.id]);

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Soft-geloescht (deleted_at, Auto-Loeschlauf 60 Tage nach der
      // Konfirmation) zaehlt wie deaktiviert -- gleiche Antwort, kein Hinweis,
      // dass es das Konto noch gibt. Socket-Auth (server.js) und die Datei-
      // Auslieferung (chat.js) filterten deleted_at laengst, diese Middleware
      // nicht: Ein ausgeblendetes Konto bediente die API bis zur harten
      // Loeschung weiter (Audit 26.09.2026, Sicherheit BF-07).
      if (!user.is_active || user.deleted_at) {
        return res.status(401).json({ error: 'User account is inactive' });
      }

      // Soft-Revoke: Token vor Invalidierung ausgestellt -> 401
      if (user.token_invalidated_at) {
        const tokenIssuedAt = decoded.iat; // Unix-Timestamp aus JWT
        const invalidatedAt = Math.floor(new Date(user.token_invalidated_at).getTime() / 1000);
        if (tokenIssuedAt < invalidatedAt) {
          return res.status(401).json({ error: 'Token invalidated' });
        }
      }

      // AKTIVE Org anwenden (Multi-Org): die gewuenschte Gemeinde, sonst die
      // Stamm-Gemeinde -- und ist die Person NUR dort gesperrt, die erste freie
      // weitere (utils/orgMitglieder.js, waehleGemeinde; 08.10.2026). Rolle,
      // Funktionsbezeichnung und Gemeinde gelten danach fuer die AKTIVE
      // Gemeinde; alle nachgelagerten Abfragen lesen req.user.organization_id.
      //
      // Nicht Mitglied ODER dort gesperrt -> 403 wie beim Verlust einer
      // Mitgliedschaft (kein stilles Zurueckfallen bei ausdruecklichem
      // Wunsch; die App faellt mit error_code org_kein_zugriff selbst zurueck).
      // Ein Konto ohne Gemeinde (Support) arbeitet ohne Wunsch weiter ohne
      // Gemeinde.
      let rolleId = user.role_id;
      if (requestedActiveOrg || user.organization_id !== null) {
        const mitgliedschaften = await ladeMitgliedschaftenMitSperre(db, decoded.id);
        const gewuenscht = requestedActiveOrg || null;
        const { gemeinde, grund } = waehleGemeinde(mitgliedschaften, gewuenscht);
        if (grund === 'kein_mitglied' || grund === 'gesperrt') {
          return res.status(403).json(ORG_KEIN_ZUGRIFF);
        }
        if (grund === 'keine_freie' || !gemeinde) {
          return res.status(401).json({ error: 'User account is inactive' });
        }
        user.organization_id = gemeinde.organization_id;
        user.role_name = gemeinde.role_name;
        user.role_display_name = gemeinde.role_display_name;
        user.organization_name = gemeinde.organization_name;
        user.organization_slug = gemeinde.organization_slug;
        user.organization_active = gemeinde.organization_active;
        user.role_title = gemeinde.role_title;
        rolleId = gemeinde.role_id;
      }

      // Super-Admin hat keine Organization - Skip org check
      if (user.role_name !== 'super_admin' && !user.organization_active) {
        return res.status(401).json({ error: 'Organization is inactive' });
      }

      // Jahrgänge laden (nur für nicht-super_admin) — für die AKTIVE Org gescopt,
      // damit Teamer-Zuweisungen aus der falschen Org nicht durchschlagen.
      let assignedJahrgaenge = [];
      if (user.organization_id) {
        const jahrgaengeQuery = `
          SELECT j.id, j.name, uja.can_view, uja.can_edit,
                 uja.darf_antraege_entscheiden, uja.darf_events_verbuchen, uja.darf_challenges_freigeben
          FROM user_jahrgang_assignments uja
          JOIN jahrgaenge j ON uja.jahrgang_id = j.id
          WHERE uja.user_id = $1 AND j.organization_id = $2
        `;
        const { rows } = await db.query(jahrgaengeQuery, [decoded.id, user.organization_id]);
        assignedJahrgaenge = rows;
      }

      // User-Objekt für Request
      req.user = {
        id: user.id,
        organization_id: user.organization_id,
        username: user.username,
        display_name: user.display_name,
        role_name: user.role_name,
        role_title: user.role_title,
        role_display_name: user.role_display_name,
        organization_name: user.organization_name,
        organization_slug: user.organization_slug,
        assigned_jahrgaenge: assignedJahrgaenge,
        // Backward compatibility
        type: user.role_name === 'konfi' ? 'konfi' : user.role_name === 'teamer' ? 'teamer' : 'admin',
        // is_super_admin: Rolle ODER DB-Flag
        is_super_admin: user.role_name === 'super_admin' || user.is_super_admin === true,
        is_org_admin: user.role_name === 'org_admin'
      };

      // User-Objekt cachen (30s TTL, Key inkl. aktiver Org)
      setCachedUser(ckey, {
        role_id: rolleId,
        userObj: req.user
      });

      next();
    } catch (err) {
 console.error('Database error in verifyTokenRBAC middleware:', err);
      res.status(500).json({ error: 'Database error' });
    }
  };
};

// ============================================
// ROLLEN-BASIERTE ZUGRIFFSKONTROLLE (NEU)
// ============================================

/**
 * Generische Rollen-Prüfung
 * @param {...string} allowedRoles - Erlaubte Rollennamen
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    next();
  };
};

// ============================================
// ROLLEN-CHECKS (KORRIGIERT)
// ============================================
// super_admin: NUR Organisations-Verwaltung, sonst KEIN Zugriff
// org_admin: Alles in eigener Organisation (inkl. User)
// admin: Alles AUSSER User-Verwaltung
// teamer: Events, Konfis ansehen, Punkte vergeben
// ============================================

// requireSuperAdmin: super_admin-Rolle ODER gesetztes is_super_admin-Flag.
// Das Flag erlaubt es, einem org_admin zusaetzlich die Org-Verwaltung zu geben,
// ohne die Rolle zu wechseln (verifyTokenRBAC setzt req.user.is_super_admin
// = role_name==='super_admin' || users.is_super_admin === true).
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }
  if (!req.user.is_super_admin) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }
  next();
};
const requireOrgAdmin = requireRole('org_admin');               // User-Verwaltung in Org
const requireAdmin = requireRole('org_admin', 'admin');         // Konfis, Requests, Badges, etc.
const requireTeamer = requireRole('org_admin', 'admin', 'teamer'); // Events, Punkte vergeben

// ============================================
// JAHRGANG-ZUGRIFF
// ============================================
//
// Hier standen bis zum 01.09.2026 zwei Helfer (checkJahrgangAccess,
// filterByJahrgangAccess), die NIE eingehaengt waren: der eine in keiner
// Route als Middleware, der andere zwar per createApp.js an konfi-management
// durchgereicht, dort aber nie aufgerufen. Sie trugen ein eigenes Warnschild
// ("nur vorbereitet, nicht erledigt") und sind GELOESCHT — nicht, weil die
// Regel gestrichen waere, sondern weil sie inzwischen an anderer Stelle
// wirksam ist: utils/jahrgangsZugriff.js (darfJahrgang/darfKonfi) ist die
// eine Quelle der Semantik, und die Routen rufen sie direkt auf (Listen
// filtern per assigned_jahrgaenge, Einzelzugriffe pruefen per darfJahrgang).
// Wer eine Route jahrgangs-gebunden machen will: darfJahrgang nutzen, keinen
// neuen Middleware-Helfer bauen.

// ============================================
// ORGANISATIONS-ISOLATION
// ============================================
// Hier stand bis zum 10.09.2026 eine Middleware requireSameOrganization. Sie
// war an keiner Route verdrahtet und deshalb wirkungslos. Die Trennung laeuft
// tatsaechlich ueber die Abfragen: 474-mal (gezaehlt am 26.09.2026 in routes,
// utils, services und createApp.js) wird die Organisation aus dem Token
// genommen (req.user.organization_id), nur einmal aus der Anfrage -- in
// POST /auth/switch-org, und dort prueft die Route die Mitgliedschaft selbst
// gegen user_organizations und lehnt sonst mit 403 ab.

module.exports = {
  verifyTokenRBAC,
  invalidateUserCache,
  ORG_KEIN_ZUGRIFF,
  // Rollen-Checks
  requireRole,
  requireSuperAdmin,
  requireOrgAdmin,
  requireAdmin,
  requireTeamer
  // Jahrgang-Zugriff: siehe utils/jahrgangsZugriff.js (darfJahrgang/darfKonfi)
};
