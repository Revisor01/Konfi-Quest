const express = require('express');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { challengeNeuigkeitenJeChallenge } = require('../utils/challengeNeuigkeiten');

module.exports = (db, verifyTokenRBAC) => {
  const router = express.Router();

  // Validierungsregeln
  const validateDeviceToken = [
    body('token').notEmpty().withMessage('Push-Token ist erforderlich'),
    body('platform').isIn(['ios', 'android', 'web']).withMessage('Ungültige Plattform'),
    // App-Fassung (23.09.2026, Migration 156): OPTIONAL, weil ausgelieferte
    // Versionen die Felder nicht kennen. Laenge begrenzt, damit hier nichts
    // Beliebiges in der Datenbank landet.
    body('app_version').optional({ nullable: true }).isString().isLength({ max: 32 }),
    body('app_build').optional({ nullable: true }).isString().isLength({ max: 32 }),
    handleValidationErrors
  ];

  const validateDeleteToken = [
    body('device_id').notEmpty().withMessage('Geräte-ID ist erforderlich'),
    body('platform').notEmpty().withMessage('Plattform ist erforderlich'),
    handleValidationErrors
  ];

  // Leichtgewichtige Badge-Zähler für die Tab-Leiste (Audit Achse 4, Fund 3).
  // Ersetzt im BadgeContext die frueheren Voll-Fetches von /chat/rooms +
  // /admin/activities/requests + /events, die nur für Zähler geladen wurden.
  // WICHTIG für Konsistenz mit den Listen-Ansichten:
  // - chat.byRoom repliziert EXAKT die unread_count-Semantik der
  //   GET /chat/rooms-Query (inkl. Mitzaehlen eigener Nachrichten) — die Werte
  //   speisen chatUnreadByRoom, das ChatRoom/ChatOverview konsumieren.
  //   BEWUSST OHNE Mitgliedschafts-Sync (der läuft TTL-gesteuert in /rooms).
  // - pendingRequests entspricht dem pending-Filter der Admin-Antragsliste
  //   (GET /admin/activities/requests ist org-weit über activities.organization_id).
  // - pendingEvents entspricht der Frontend-Logik "unprocessed_count > 0 UND
  //   event_date < jetzt" (unprocessed = bestaetigte Buchung ohne attendance_status).
  router.get('/badge-counts', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;

      const chatQuery = `
        SELECT r.id AS room_id,
               (
                 SELECT COUNT(*)
                 FROM chat_messages m
                 WHERE m.room_id = r.id
                 AND m.deleted_at IS NULL
                 AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01')
                 AND m.created_at <= NOW()
                 -- Eigene Nachrichten zählen nicht als ungelesen. Ohne diese
                 -- Zeile stand nach der eigenen letzten Nachricht eine Eins am
                 -- Reiter, die erst beim Oeffnen des Raums verschwand — und wer
                 -- ihn nicht mehr oeffnete, sah sie dauerhaft. Die Zählung im
                 -- Hintergrunddienst schließt sie seit jeher aus
                 -- (backgroundService.js), diese hier nicht (Befund 24.08.2026).
                 AND NOT (m.user_id = $1 AND m.user_type = $2)
               ) AS unread_count
        FROM chat_rooms r
        INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = $1 AND p.user_type = $2
        LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = $1 AND crs.user_type = $2
        WHERE r.organization_id = $3
      `;

      // Pending-Zähler nur für Admin-Typen (Konfis/Teamer nutzen sie im
      // Frontend nicht — BadgeContext zeigt sie nur für isAdmin).
      const isAdminType = userType === 'admin';
      const zero = Promise.resolve({ rows: [{ c: 0 }] });

      // Jahrgangs-Bindung (01.09.2026): Die Rolle 'admin' zaehlt seit Simons
      // Regel vom 31.08. nur noch, was sie in ihren Listen auch SIEHT —
      // sonst stuende eine rote Zahl am Reiter, hinter der eine leere Liste
      // wartet (dieselbe Fehlerklasse wie Befund H4, nur andersherum).
      // org_admin und is_super_admin-Flag bleiben org-weit.
      //
      // BEWUSST OHNE den Hinweis-Header X-Kein-Jahrgang-Zugewiesen
      // (Entscheidung 01.09.2026): Ein Admin ohne Zuweisung bekommt hier
      // ueberall 0 -- aber ein Zaehler von 0 ist der Normal- und
      // Wunschzustand ("nichts offen") und wirkt, anders als eine leere
      // Liste, nicht wie ein Fehler. Es gibt auch keine Stelle, an der die
      // Oberflaeche den Grund zeigen koennte: Die Zahlen landen als rote
      // Punkte an Reitern (BadgeContext), nicht in einer Ansicht mit
      // Leerzustand. Die Listen HINTER den Zaehlern (Antraege, Challenges,
      // Konfis) nennen den Grund bereits ueber ihre eigenen Routen.
      const istGebundenerAdmin = req.user.role_name === 'admin' && !req.user.is_super_admin;

      // Offene Challenge-Freigaben: org_admin org-weit; Teamer und gebundene
      // Admins nur für Challenges ihrer zugewiesenen Jahrgänge (gleiche
      // Grenze wie viewableJahrgangIds in routes/challenges.js — niemand soll
      // auf Freigaben gestupst werden, deren Challenge er gar nicht oeffnen
      // darf).
      const eigeneJahrgangIds = (userType === 'teamer' || istGebundenerAdmin)
        ? (req.user.assigned_jahrgaenge || []).filter(j => j.can_view).map(j => j.id)
        : [];
      // JE CHALLENGE gruppiert (25.09.2026, Simon: "Auf der Challenge muss
      // auch ein Badge sein wie bei den Chats"): Die Summe speist weiter
      // pendingChallenges (Alt-App-Vertrag, Zahl bleibt Zahl), die Zeilen
      // je Challenge das neue Feld challengeApprovals.byChallenge -- das
      // Gegenstueck zu challengeUpdates.byChallenge der Konfis. Welche
      // Beitraege als offen gelten und wessen Challenges zaehlen, aendert
      // sich hier NICHT: dieselben WHERE-Bedingungen wie zuvor.
      let challengesPromise = Promise.resolve({ rows: [] });
      if (isAdminType && !istGebundenerAdmin) {
        challengesPromise = db.query(
          `SELECT cs.challenge_id, COUNT(*)::int AS c
           FROM challenge_submissions cs
           JOIN challenges c ON cs.challenge_id = c.id
           WHERE c.organization_id = $1 AND cs.moderation_status = 'pending'
           GROUP BY cs.challenge_id`,
          [organizationId]
        );
      } else if (userType === 'teamer' || istGebundenerAdmin) {
        // 'nur_team'-Challenges laufen org-weit ueber die Rolle (Migration 121):
        // Jede:r Teamer:in der Organisation darf sie sehen und moderieren, auch
        // ohne Jahrgangs-Zuordnung -- die es dort per Definition nicht gibt.
        // Dieselbe Ausnahme steht in challenges.js (leadershipMayAccess und die
        // Listen-Abfrage).
        //
        // Bis 27.08.2026 zaehlte dieser Zweig ausschliesslich ueber
        // challenge_jahrgang_assignments und lief bei Teamer:innen ohne
        // zugewiesene Jahrgaenge gar nicht erst an (Bedingung
        // teamerJahrgangIds.length > 0). Ergebnis: Ein Teamer konnte eine
        // Team-Runde moderieren, wurde aber nie per Reiter-Zaehler darauf
        // gestossen (Befund H4).
        challengesPromise = db.query(
          `SELECT cs.challenge_id, COUNT(*)::int AS c
           FROM challenge_submissions cs
           JOIN challenges c ON cs.challenge_id = c.id
           WHERE c.organization_id = $1
             AND cs.moderation_status = 'pending'
             AND (
               c.audience = 'nur_team'
               OR EXISTS (
                 SELECT 1 FROM challenge_jahrgang_assignments cja
                 WHERE cja.challenge_id = c.id AND cja.jahrgang_id = ANY($2::int[])
               )
             )
           GROUP BY cs.challenge_id`,
          [organizationId, eigeneJahrgangIds]
        );
      }

      // Ungesehene Abzeichen (Befund B1/Konsolidierung 27.08.2026).
      // Vorher lud MainTabs diese Zahl selbst -- Konfis ueber die volle
      // Abzeichenliste, Teamer:innen ueber einen eigenen Endpunkt -- und sie
      // hing damit als EINZIGE nicht am BadgeContext, sondern an
      // useLiveRefresh('badges'). Wer nach einer Aktion refreshAllCounts()
      // rief (das Naheliegende), bewirkte nichts: die rote Zahl blieb stehen.
      // Genau daran krankte der Konfi-Zaehler seit dem 03.07.2026 unbemerkt.
      //
      // Die Fortschrittsberechnung braucht es dafuer NICHT: user_badges.seen
      // gilt fuer beide Rollen, custom_badges.target_role trennt sie. Eine
      // COUNT-Abfrage genuegt.
      // Die Leitung kann keine Abzeichen verdienen -> immer 0.
      const badgesPromise = (userType === 'konfi' || userType === 'teamer')
        ? db.query(
            `SELECT COUNT(*)::int AS c
             FROM user_badges ub
             JOIN custom_badges cb ON ub.badge_id = cb.id
             WHERE ub.user_id = $1
               AND ub.organization_id = $2
               AND ub.seen = false
               AND COALESCE(cb.target_role, 'konfi') = $3`,
            [userId, organizationId, userType]
          )
        : zero;

      // pendingRequests: fuer gebundene Admins mit demselben Filter wie die
      // Antragsliste (GET /admin/activities/requests) — Teamer-Antraege
      // zaehlen immer (Teamer-Ausnahme), Konfi-Antraege nur aus zugewiesenen
      // Jahrgaengen. ANY auf leerem Array trifft nichts: Ein Admin ohne
      // Jahrgang zaehlt nur Teamer-Antraege, wie seine Liste.
      let requestsPromise = zero;
      if (isAdminType && !istGebundenerAdmin) {
        requestsPromise = db.query(
          `SELECT COUNT(*)::int AS c
           FROM activity_requests ar
           JOIN activities a ON ar.activity_id = a.id
           WHERE a.organization_id = $1 AND ar.status = 'pending'`,
          [organizationId]
        );
      } else if (istGebundenerAdmin) {
        requestsPromise = db.query(
          `SELECT COUNT(*)::int AS c
           FROM activity_requests ar
           JOIN activities a ON ar.activity_id = a.id
           LEFT JOIN konfi_profiles kp ON kp.user_id = ar.user_id
           WHERE a.organization_id = $1 AND ar.status = 'pending'
             AND (a.target_role = 'teamer' OR kp.jahrgang_id = ANY($2::int[]))`,
          [organizationId, eigeneJahrgangIds]
        );
      }

      // pendingEvents: fuer gebundene Admins mit demselben Sichtbarkeits-
      // Filter wie die Terminliste (events/lesen.js) — Termine ohne Jahrgang
      // und Teamer-Termine zaehlen immer, jahrgangsgebundene nur aus
      // zugewiesenen Jahrgaengen.
      //
      // Abgesagte Termine zaehlen NICHT: Der "Verbuchen"-Tab blendet sie aus,
      // also stuende sonst eine rote Zahl am Reiter, hinter der eine leere
      // Liste wartet — dieselbe Fehlerklasse wie oben bei der
      // Jahrgangs-Bindung. `IS NOT TRUE` statt `= FALSE`, weil die Spalte
      // nullable ist: Termine aus dem Altbestand haben dort NULL und sind
      // damit nicht abgesagt.
      let eventsPromise = zero;
      if (isAdminType) {
        const eventSichtFilter = istGebundenerAdmin
          ? `AND (
               e.teamer_only OR e.teamer_needed
               OR NOT EXISTS (SELECT 1 FROM event_jahrgang_assignments eja
                              WHERE eja.event_id = e.id)
               OR EXISTS (SELECT 1 FROM event_jahrgang_assignments eja
                          WHERE eja.event_id = e.id
                            AND eja.jahrgang_id = ANY($2::int[]))
             )`
          : '';
        const eventParams = istGebundenerAdmin
          ? [organizationId, eigeneJahrgangIds]
          : [organizationId];
        eventsPromise = db.query(
          `SELECT COUNT(*)::int AS c
           FROM events e
           WHERE e.organization_id = $1
           AND e.event_date < NOW()
           AND e.cancelled IS NOT TRUE
           AND EXISTS (
             SELECT 1 FROM event_bookings eb
             WHERE eb.event_id = e.id
             AND eb.status = 'confirmed'
             AND eb.attendance_status IS NULL
           )
           ${eventSichtFilter}`,
          eventParams
        );
      }

      // Challenge-Neuigkeiten (24.09.2026, Simon: "genau wie beim Chat"):
      // je Challenge, was seit dem letzten Oeffnen dazukam -- neue Challenge,
      // fremde Galerie-Beitraege, Moderation eigener Beitraege. Nur fuer
      // Konfis; die Leitung hat am selben Reiter ihre Freigaben (oben).
      // Die Regel steht EINMAL in utils/challengeNeuigkeiten.js, dieselbe
      // Fassung speist die App-Icon-Summe fuer Pushes (Paritaet B2b).
      const neuigkeitenPromise = (userType === 'konfi')
        ? challengeNeuigkeitenJeChallenge(db, [{ id: userId, type: userType, organization_id: organizationId }])
        : Promise.resolve([]);

      // Postfach (25.09.2026): ungelesene Mitteilungen des KONTOS ueber alle
      // Organisationen -- dieselbe Zaehlung wie GET /postfach.ungelesen, damit
      // Glocke und Liste nie auseinanderlaufen. Bewusst OHNE Org-Filter (siehe
      // Begruendung an der Postfach-Route). Bewusst NICHT in die
      // App-Icon-Summe (utils/appIconBadge.js) eingerechnet: Die Glocke ist ein
      // eigener Zaehler neben den Reitern, keine Reiter-Zahl; die
      // Paritaetstests (appIconBadgeParitaet.test.js) bleiben unangetastet.
      const postfachPromise = db.query(
        `SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
        [userId]
      );

      const [chatRes, requestsRes, eventsRes, challengesRes, badgesRes, neuigkeiten, postfachRes] = await Promise.all([
        db.query(chatQuery, [userId, userType, organizationId]),
        requestsPromise,
        eventsPromise,
        challengesPromise,
        badgesPromise,
        neuigkeitenPromise,
        postfachPromise
      ]);

      const byRoom = {};
      let total = 0;
      chatRes.rows.forEach((r) => {
        const unread = parseInt(r.unread_count, 10) || 0;
        byRoom[r.room_id] = unread;
        total += unread;
      });

      // Wie chat.byRoom: Zahl je Challenge fuer den Listeneintrag, Summe
      // fuer Reiter und App-Icon.
      const byChallenge = {};
      let neuigkeitenTotal = 0;
      neuigkeiten.forEach((r) => {
        byChallenge[r.challenge_id] = r.c;
        neuigkeitenTotal += r.c;
      });

      // Offene Freigaben der Leitung, dieselbe Form. Fuer Konfis bleibt es
      // leer/0 -- ihr Anteil steht in challengeUpdates. Die beiden Zahlen
      // meinen Verschiedenes (Neuigkeiten vs. zu erledigende Freigaben) und
      // werden deshalb NIE in ein Feld gemischt; der Server liefert je
      // Rolle nur den passenden Anteil.
      const freigabenByChallenge = {};
      let freigabenTotal = 0;
      challengesRes.rows.forEach((r) => {
        freigabenByChallenge[r.challenge_id] = r.c;
        freigabenTotal += r.c;
      });

      res.json({
        chat: { total, byRoom },
        pendingRequests: requestsRes.rows[0]?.c || 0,
        pendingEvents: eventsRes.rows[0]?.c || 0,
        // Unveraendert eine Zahl: Store-Apps 2.2.x lesen sie so.
        pendingChallenges: freigabenTotal,
        newBadges: badgesRes.rows[0]?.c || 0,
        // NEU 24.09.2026, additiv (Alt-App-Vertrag: kein bestehendes Feld
        // aendert Form oder Typ; aeltere Apps ignorieren das Feld).
        challengeUpdates: { total: neuigkeitenTotal, byChallenge },
        // NEU 25.09.2026, additiv: dieselbe Summe wie pendingChallenges,
        // dazu die Aufschluesselung je Challenge fuer den Listeneintrag.
        challengeApprovals: { total: freigabenTotal, byChallenge: freigabenByChallenge },
        // NEU 25.09.2026, additiv: ungelesene Postfach-Mitteilungen (Glocke).
        // Nur ein Objekt, damit spaeter Aufschluesselungen dazukommen koennen,
        // ohne die Form zu aendern.
        postfach: { ungelesen: postfachRes.rows[0]?.c || 0 }
      });
    } catch (err) {
      console.error('Database error in GET /notifications/badge-counts:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ==========================================================================
  // POSTFACH (25.09.2026)
  //
  // Die Tabelle notifications wurde bis dahin an sechs Stellen GESCHRIEBEN
  // (Antragsentscheid, Abzeichen, Konfi- und Teamer-Meldungen), aber nirgends
  // gelesen: Wer eine Push-Nachricht wegwischte, hatte sie verloren. Diese
  // Routen machen daraus ein Postfach.
  //
  // ENTSCHEIDUNG ORG-BEZUG: Das Postfach ist PERSOENLICH wie das
  // Mitteilungszentrum des Handys -- Push-Nachrichten kommen ja auch
  // unabhaengig von der gerade aktiven Gemeinde an. Simon betreut drei
  // Gemeinden (org_admin in Org 1, 2 und 4); ein "Neuer Antrag" aus Gemeinde 2
  // muss sichtbar sein, waehrend er in Gemeinde 1 arbeitet. Deshalb liest die
  // Route ueber ALLE Organisationen des Kontos (nur user_id, KEIN Filter auf
  // req.user.organization_id). Jeder Eintrag traegt organization_id und
  // organization_name; die App wechselt beim Antippen bei Bedarf die Gemeinde
  // ueber den vorhandenen Push-Weg (resolveOrgForPush).
  //
  // Sicherheitsgrenze ist ausschliesslich notifications.user_id aus dem
  // geprueften Token -- dieselbe Grenze wie bei device-token und preferences.
  // ==========================================================================

  const POSTFACH_LIMIT_DEFAULT = 30;
  const POSTFACH_LIMIT_MAX = 100;

  // Liefert eine positive Ganzzahl oder null. Query-Parameter kommen als
  // Strings; "30abc" oder "-5" gelten als ungueltig, nicht als 30 bzw. 5.
  const positiveGanzzahl = (wert) => {
    if (typeof wert !== 'string' || !/^\d+$/.test(wert)) return null;
    const zahl = parseInt(wert, 10);
    return zahl > 0 && Number.isSafeInteger(zahl) ? zahl : null;
  };

  // data ist jsonb (prod-schema.sql): pg liefert bereits ein Objekt oder
  // null. Die App verlaesst sich auf "immer ein Objekt" -- deshalb NULL -> {}.
  // Der String-Zweig faengt den Fall ab, dass eine Schreibstelle doppelt
  // serialisiert hat (jsonb mit einem JSON-String als Wert); ein Parse-Fehler
  // ergibt ebenfalls {}, nie einen 500er fuer die ganze Liste.
  const alsObjekt = (data) => {
    if (data === null || data === undefined) return {};
    if (typeof data === 'string') {
      try {
        const geparst = JSON.parse(data);
        return geparst && typeof geparst === 'object' && !Array.isArray(geparst) ? geparst : {};
      } catch {
        return {};
      }
    }
    return typeof data === 'object' && !Array.isArray(data) ? data : {};
  };

  // GET /postfach?limit=30&vor=<id>
  // Neueste zuerst, Cursor ueber die id (monoton steigend, deshalb stabil
  // auch wenn waehrend des Blaetterns neue Eintraege dazukommen -- ein
  // OFFSET wuerde dann Eintraege doppelt oder gar nicht zeigen).
  router.get('/postfach', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = Math.min(positiveGanzzahl(req.query.limit) || POSTFACH_LIMIT_DEFAULT, POSTFACH_LIMIT_MAX);
      const vor = positiveGanzzahl(req.query.vor);

      const params = [userId];
      let cursorFilter = '';
      if (vor !== null) {
        params.push(vor);
        cursorFilter = `AND n.id < $${params.length}`;
      }
      // limit + 1: ein Eintrag mehr als angezeigt verraet, ob es weitere gibt,
      // ohne eine zweite COUNT-Abfrage.
      params.push(limit + 1);

      const [eintraegeRes, ungelesenRes] = await Promise.all([
        db.query(
          `SELECT n.id, n.title, n.message, n.type, n.data, n.read_at, n.created_at,
                  n.organization_id,
                  COALESCE(o.display_name, o.name) AS organization_name
           FROM notifications n
           LEFT JOIN organizations o ON o.id = n.organization_id
           WHERE n.user_id = $1 ${cursorFilter}
           ORDER BY n.id DESC
           LIMIT $${params.length}`,
          params
        ),
        // Unabhaengig von der Seite: die Glocke zeigt alles Ungelesene, nicht
        // nur das der ersten 30.
        db.query(
          `SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
          [userId]
        )
      ]);

      const weitere = eintraegeRes.rows.length > limit;
      const eintraege = eintraegeRes.rows.slice(0, limit).map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        type: r.type,
        data: alsObjekt(r.data),
        read_at: r.read_at,
        created_at: r.created_at,
        organization_id: r.organization_id,
        organization_name: r.organization_name ?? null
      }));

      res.json({ eintraege, ungelesen: ungelesenRes.rows[0]?.c || 0, weitere });
    } catch (err) {
      console.error('Database error in GET /notifications/postfach:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PUT /postfach/gelesen -- alle eigenen ungelesenen auf einmal.
  // Steht bewusst VOR /postfach/:id/gelesen. Die Pfade kollidieren zwar nicht
  // (zwei gegen drei Segmente), aber so kann "gelesen" nie als :id gelesen
  // werden, falls die Einzelroute je auf zwei Segmente gekuerzt wird.
  router.put('/postfach/gelesen', verifyTokenRBAC, async (req, res) => {
    try {
      const { rowCount } = await db.query(
        `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
        [req.user.id]
      );
      res.json({ success: true, anzahl: rowCount });
    } catch (err) {
      console.error('Database error in PUT /notifications/postfach/gelesen:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PUT /postfach/:id/gelesen -- eine eigene Mitteilung.
  // Idempotent: eine bereits gelesene Mitteilung liefert 200 mit dem
  // vorhandenen read_at. Fremde und nicht vorhandene Mitteilungen sind beide
  // 404 -- ein 403 wuerde verraten, dass die id existiert.
  router.put('/postfach/:id/gelesen', verifyTokenRBAC, async (req, res) => {
    const id = positiveGanzzahl(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Ungültige Mitteilungs-ID' });
    }
    try {
      const userId = req.user.id;
      const { rows } = await db.query(
        `UPDATE notifications SET read_at = NOW()
         WHERE id = $1 AND user_id = $2 AND read_at IS NULL
         RETURNING read_at`,
        [id, userId]
      );
      if (rows.length > 0) {
        return res.json({ success: true, id, read_at: rows[0].read_at });
      }
      // 0 Zeilen: entweder schon gelesen (dann idempotent 200) oder nicht
      // vorhanden bzw. fremd (404).
      const { rows: vorhanden } = await db.query(
        `SELECT read_at FROM notifications WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (vorhanden.length === 0) {
        return res.status(404).json({ error: 'Mitteilung nicht gefunden' });
      }
      res.json({ success: true, id, read_at: vorhanden[0].read_at });
    } catch (err) {
      console.error('Database error in PUT /notifications/postfach/:id/gelesen:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Liefert den globalen Push-Master-Schalter des eingeloggten Users
  router.get('/preferences', verifyTokenRBAC, async (req, res) => {
    try {
      const { rows: [row] } = await db.query(
        'SELECT push_enabled FROM users WHERE id = $1',
        [req.user.id]
      );
      res.json({ push_enabled: row ? row.push_enabled : true });
    } catch (err) {
      console.error('Database error in GET /preferences:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Setzt den globalen Push-Master-Schalter des eingeloggten Users
  router.put('/preferences', verifyTokenRBAC, [
    body('push_enabled').isBoolean().withMessage('push_enabled muss true oder false sein'),
    handleValidationErrors
  ], async (req, res) => {
    const { push_enabled } = req.body;
    try {
      await db.query(
        'UPDATE users SET push_enabled = $1 WHERE id = $2',
        [push_enabled, req.user.id]
      );
      res.json({ success: true, push_enabled });
    } catch (err) {
      console.error('Database error in PUT /preferences:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Speichert oder aktualisiert einen Geräte-Token für Push-Benachrichtigungen
  router.post('/device-token', verifyTokenRBAC, validateDeviceToken, async (req, res) => {
    const { token, platform, device_id, app_version, app_build } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    /*
     * JEDE Registrierung wird protokolliert (23.09.2026).
     *
     * Vorher loggte diese Route NUR Fehler. Ein erfolgreicher POST hinterliess
     * keine Spur, und "die App hat sich nie gemeldet" war von "die App hat
     * sich gemeldet und es lief" nicht zu unterscheiden. Bei der Fehlersuche
     * am 23.09.2026 hat genau das Stunden gekostet: drei Anmeldungen eines
     * Testers, kein Eintrag, und keine Moeglichkeit zu sagen, ob die App
     * ueberhaupt fragt.
     *
     * Absichtlich OHNE den Token selbst -- der ist ein Zugangsschluessel zum
     * Zustellen von Nachrichten und gehoert in kein Protokoll. Die letzten
     * sechs Zeichen genuegen, um zwei Registrierungen zu unterscheiden.
     */
    console.log(
      '[PUSH] Registrierung: user=%s (%s) platform=%s app=%s/%s geraet=%s token=…%s',
      userId, userType, platform,
      app_version || 'unbekannt', app_build || '?',
      (device_id || 'ohne').slice(0, 12),
      String(token).slice(-6)
    );

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token und Plattform erforderlich' });
    }

    try {
      // Device ID generieren falls nicht vorhanden
      const finalDeviceId = device_id || `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Ein FCM-Token darf nur GENAU EINMAL existieren: weder bei einem anderen
      // User (Account-Wechsel) noch beim selben User unter anderer device_id
      // (z.B. neue identifierForVendor nach App-Neuinstallation) — sonst wird
      // derselbe Push mehrfach an dasselbe Geraet gesendet.
      await db.query(
        `DELETE FROM push_tokens
         WHERE token = $1
           AND NOT (user_id = $2 AND platform = $3 AND device_id = $4)`,
        [token, userId, platform, finalDeviceId]
      );

      // Upsert: Token speichern oder aktualisieren
      await db.query(`
        INSERT INTO push_tokens (user_id, user_type, token, platform, device_id, updated_at,
                                 app_version, app_build)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        ON CONFLICT (user_id, platform, device_id)
        DO UPDATE SET
          token = EXCLUDED.token,
          user_type = EXCLUDED.user_type,
          updated_at = NOW(),
          -- COALESCE, nicht blind ueberschreiben: Meldet sich eine aeltere
          -- App-Fassung ohne die Felder, soll die zuletzt BEKANNTE Angabe
          -- stehen bleiben statt durch NULL ersetzt zu werden.
          app_version = COALESCE(EXCLUDED.app_version, push_tokens.app_version),
          app_build = COALESCE(EXCLUDED.app_build, push_tokens.app_build)`,
        [userId, userType, token, platform, finalDeviceId,
         app_version || null, app_build || null]
      );


      res.json({ success: true, message: 'Token erfolgreich gespeichert' });

    } catch (err) {
      console.error('Database error in POST /device-token:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Token für diesen Benutzer und dieses Gerät existiert bereits.' });
      }
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  /*
   * Die App meldet, WARUM keine Registrierung zustande kam (23.09.2026).
   *
   * Der eigentliche Grund, aus dem die Android-Fehlersuche so zaeh war: Wenn
   * gar kein Token entsteht, gibt es auch keinen POST /device-token — und
   * damit serverseitig KEINE Spur. "Die App fragt nicht" und "die App fragt,
   * bekommt aber nichts" sahen identisch aus, naemlich wie Stille.
   *
   * Diese Route nimmt genau diese Stille auf. Sie speichert nichts, sie
   * protokolliert nur: Damit lassen sich die Faelle unterscheiden, ohne dass
   * jemand ein Geraet an den Rechner haengen muss.
   *
   * Absichtlich anspruchslos: kein Schema, keine Pflichtfelder ausser dem
   * Grund. Was die App schickt, landet im Protokoll — sie soll melden koennen,
   * auch wenn sie selbst nicht weiss, was schiefgeht.
   */
  router.post('/push-diagnose', verifyTokenRBAC, async (req, res) => {
    const { grund, berechtigung, plattform, app_version, app_build, hinweis } = req.body || {};
    console.log(
      '[PUSH-DIAGNOSE] user=%s (%s) grund=%s berechtigung=%s plattform=%s app=%s/%s %s',
      req.user.id, req.user.type,
      grund || 'ohne-angabe',
      berechtigung || '?',
      plattform || '?',
      app_version || 'unbekannt', app_build || '?',
      hinweis ? `hinweis=${String(hinweis).slice(0, 200)}` : ''
    );
    res.json({ success: true });
  });

  // Entfernt einen Geräte-Token beim Logout
  router.delete('/device-token', verifyTokenRBAC, validateDeleteToken, async (req, res) => {
    const { device_id, platform } = req.body;
    const userId = req.user.id;

    if (!device_id || !platform) {
      return res.status(400).json({ error: 'Geräte-ID und Plattform erforderlich' });
    }

    try {
      // Ein Geraete-Token gehoert dem Nutzer und dem Geraet, nicht einer
      // Organisation — `push_tokens` hat gar keine `organization_id`. Die
      // fruehere Verengung ueber `users.organization_id` verglich die PRIMAER-Org
      // des Kontos mit der AKTIVEN Org aus dem Token. Bei Mehrfach-Mitgliedschaft
      // sind das verschiedene Werte: Das DELETE traf 0 Zeilen, meldete aber
      // Erfolg, und das abgemeldete Geraet bekam weiter Push-Nachrichten.
      // Die Absicherung ist `pt.user_id = $1` aus dem geprueften Token — mehr
      // braucht es nicht, und `/auth/logout` loescht bereits genauso.
      const { rowCount } = await db.query(
        `DELETE FROM push_tokens
         WHERE user_id = $1
           AND platform = $2
           AND device_id = $3`,
        [userId, platform, device_id]
      );

      res.json({
        success: true,
        message: 'Push-Token für dieses Gerät entfernt',
        changes: rowCount
      });

    } catch (err) {
      console.error('Database error in DELETE /device-token:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
