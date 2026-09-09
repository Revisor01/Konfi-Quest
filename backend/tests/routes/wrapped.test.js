const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ORGS, BADGES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Wrapped Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let orgAdmin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    orgAdmin2Token = generateToken('orgAdmin2');

    // Jahrgangs-Bindung (01.09.2026): Freigeben (POST /generate/:jahrgangId)
    // und die Historie fremder Konfis verlangen seither eine Zuweisung —
    // admin1 hat im Seed bewusst keine. Fuer die Bestandstests bekommt er
    // jahrgang1; der Fall OHNE Zuweisung steht in
    // jahrgangsBindungAdmin.test.js.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    // Die Zuweisung haengt sonst im rbac-Cache (30 s TTL) des vorigen Tests.
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /me
  // ================================================================
  describe('GET /api/wrapped/me', () => {
    it('Authentifizierter User bekommt 404 wenn kein Wrapped vorhanden', async () => {
      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Kein Wrapped');
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/wrapped/me');

      expect(res.status).toBe(401);
    });

    // Frueher stand hier "200 oder 404" mit dem Hinweis "wenn Snapshot
    // fehlschlägt". Genau das trat immer ein: activities.category fehlte im
    // Test-Schema, jeder Snapshot scheiterte still, und die gesamte
    // Wrapped-Inhaltslogik war ungetestet. Seit das Schema aus Produktion
    // kommt, muss die Generierung wirklich durchlaufen (Audit 22.08.2026).
    it('Nach Generierung bekommt Konfi seine Wrapped-Daten', async () => {
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(genRes.status).toBe(200);
      expect(genRes.body.generated).toBeGreaterThan(0);

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.wrapped_type).toBe('konfi');
    });

    // Drei-Ansichten-Befund M7 (26.08.2026): Das Freigabe-Gate
    // (wrapped_released_at auf jahrgaenge) prüfte nur das Konfi-Dashboard —
    // der Datenendpunkt lieferte den Snapshot auch ohne Freigabe aus.
    it('Ohne Freigabe (wrapped_released_at NULL) bekommt Konfi 403 statt Daten', async () => {
      // Snapshots erzeugen (setzt wrapped_released_at auf NOW()) ...
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(genRes.status).toBe(200);

      // ... und die Freigabe zurueckziehen, der Snapshot bleibt liegen
      // (entspricht z.B. einem Jahrgangswechsel des Konfis).
      await db.query(
        'UPDATE jahrgaenge SET wrapped_released_at = NULL WHERE id = $1',
        [JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Wrapped ist noch nicht freigegeben');
      expect(res.body.data).toBe(undefined);
    });

    it('Freigabe in der Zukunft zaehlt nicht: 403', async () => {
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(genRes.status).toBe(200);

      await db.query(
        "UPDATE jahrgaenge SET wrapped_released_at = NOW() + INTERVAL '1 day' WHERE id = $1",
        [JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer-Wrapped kennt keine Freigabe: 200 auch ohne freigegebenen Jahrgang', async () => {
      const genRes = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(genRes.status).toBe(200);

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.wrapped_type).toBe('teamer');
    });
  });

  // ================================================================
  // POST /generate/:jahrgangId
  // ================================================================
  describe('POST /api/wrapped/generate/:jahrgangId', () => {
    it('Admin generiert Konfi-Wrapped -> 200', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Nicht nur "definiert": Bei fehlender Spalte lieferte die Route
      // generated=0 mit errors>0 und der Test blieb trotzdem gruen.
      expect(res.body.generated).toBeGreaterThan(0);
      expect(res.body.jahrgang).toBeDefined();
      expect(res.body.year).toBeDefined();
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierender Jahrgang gibt 404', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Jahrgang aus anderer Org gibt 404', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang2.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /generate-teamer
  // ================================================================
  describe('POST /api/wrapped/generate-teamer', () => {
    it('OrgAdmin generiert Teamer-Wrapped -> 200', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      // Harte Zahl statt toBeDefined: Der Seed legt zwei Teamer:innen in Org 1
      // an (teamer1, teamer2 gehoert zu Org 2). Ein stiller Fehlschlag der
      // Generierung liefe sonst als "definiert" durch.
      expect(res.body.generated).toBe(1);
      expect(res.body.errors).toBe(0);
      // Ohne Angabe: das zuletzt ABGESCHLOSSENE Kalenderjahr (Simon,
      // 07.09.2026). Das laufende Jahr ist noch nicht vorbei.
      expect(res.body.year).toBe(new Date().getFullYear() - 1);
    });

    it('Admin (nicht OrgAdmin) bekommt 403', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // Zahlen im Teamer-Snapshot: der Zeitraum (Befund 06.09.2026)
  // ================================================================
  //
  // generateTeamerSnapshot filterte KEINE ihrer sechs Abfragen auf den
  // Zeitraum -- das `year` landete nur in slides.zeitraum.year. Der
  // "Jahresrueckblick" zaehlte damit die gesamte Kontolebenszeit: Wer seit
  // vier Jahren im Team ist, sah Termine, Abzeichen und Zertifikate aus vier
  // Jahren unter einer Jahreszahl.
  describe('Zahlen im Teamer-Snapshot', () => {
    const JAHR = new Date().getFullYear();
    // SEIT DEM 07.09.2026 ist der Teamer-Zeitraum das zuletzt abgeschlossene
    // KALENDERJAHR (Simon: "Teamer der Rueckblick des Jahres. Also immer
    // zurueck auf den 1.1. des Jahres."). Ohne Angabe rechnet die Route also
    // vom 1.1.(JAHR-1) bis zum 31.12.(JAHR-1).
    const RUECKBLICK_JAHR = JAHR - 1;
    const IM_ZEITRAUM = `${JAHR - 1}-11-15`;
    const VOR_ZEITRAUM = `${JAHR - 2}-06-15`; // ein volles Jahr davor
    const NACH_ZEITRAUM = `${JAHR}-10-15`;

    async function termin(name, datum) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, $2::timestamp, $3, false, 0, 'gemeinde', 1) RETURNING id`,
        [name, `${datum} 10:00:00`, ORGS.testGemeinde.id]
      );
      return e.id;
    }

    async function buchung(userId, eventId) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status, booking_date)
         VALUES ($1, $2, $3, 'confirmed', 'present', NOW())`,
        [userId, eventId, ORGS.testGemeinde.id]
      );
    }

    async function abzeichen(userId, badgeId, datum) {
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [userId, badgeId, ORGS.testGemeinde.id, `${datum} 10:00:00`]
      );
    }

    async function zertifikat(userId, name, datum) {
      const { rows: [ct] } = await db.query(
        `INSERT INTO certificate_types (name, organization_id) VALUES ($1, $2) RETURNING id`,
        [name, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date)
         VALUES ($1, $2, $3, $4::date)`,
        [userId, ct.id, ORGS.testGemeinde.id, datum]
      );
    }

    /** Erzeugt Teamer-Wrapped und gibt den Snapshot von teamer1 zurueck. */
    async function snapshotVonTeamer1() {
      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(gen.status).toBe(200);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'teamer'`,
        [USERS.teamer1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    beforeEach(async () => {
      // Der Seed legt vier Termine 7 Tage in der Zukunft an -- die liegen
      // je nach Kalendertag im oder ausserhalb des Zeitraums. Fuer eine
      // bekannte Datenlage raeumen wir das Feld leer.
      await db.query('DELETE FROM event_bookings');
      await db.query('DELETE FROM event_jahrgang_assignments');
      await db.query('DELETE FROM events');
      await db.query('DELETE FROM user_badges');
    });

    it('Termine vor und nach dem Zeitraum zaehlen nicht mit', async () => {
      const drin = await termin('Konfitreff im Zeitraum', IM_ZEITRAUM);
      const davor = await termin('Konfitreff im Vorjahr', VOR_ZEITRAUM);
      const danach = await termin('Konfitreff im Folgejahr', NACH_ZEITRAUM);
      await buchung(USERS.teamer1.id, drin);
      await buchung(USERS.teamer1.id, davor);
      await buchung(USERS.teamer1.id, danach);

      const snap = await snapshotVonTeamer1();
      // Drei Termine gebucht, genau einer liegt im Rueckblicksjahr.
      expect(snap.slides.events_geleitet.total).toBe(1);
    });

    it('Der Termin mit den meisten Teilnehmenden stammt aus dem Zeitraum', async () => {
      // Der groessere Termin liegt im VORJAHR. Ungefiltert haette er
      // gewonnen und der Rueckblick haette einen fremden Termin gefeiert.
      const gross = await termin('Grosse Freizeit im Vorjahr', VOR_ZEITRAUM);
      const klein = await termin('Kleiner Treff im Zeitraum', IM_ZEITRAUM);
      await buchung(USERS.teamer1.id, gross);
      await buchung(USERS.konfi1.id, gross);
      await buchung(USERS.konfi2.id, gross);
      await buchung(USERS.teamer1.id, klein);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.events_geleitet.meiste_teilnehmer_event).not.toBe(null);
      expect(snap.slides.events_geleitet.meiste_teilnehmer_event.name)
        .toBe('Kleiner Treff im Zeitraum');
    });

    // Bis zum 06.09.2026 stand hier die Erwartung, ein Abzeichen aus dem
    // Vorjahr falle heraus. Das war dieselbe Verwechslung wie im
    // Konfi-Zweig: Abzeichen sind ein BESTAND, kein Ereignis -- wer eins
    // hat, hat es weiter. Der Rueckblick zeigte deshalb systematisch zu
    // wenige.
    it('Abzeichen aus anderen Zeitraeumen bleiben im Bestand', async () => {
      await abzeichen(USERS.teamer1.id, BADGES.streak.id, IM_ZEITRAUM);
      await abzeichen(USERS.teamer1.id, BADGES.categoryBased.id, VOR_ZEITRAUM);
      await abzeichen(USERS.teamer1.id, BADGES.timeBased.id, NACH_ZEITRAUM);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.badges.total_earned).toBe(3);
      expect(snap.slides.badges.badges.map(b => b.name).sort()).toEqual([
        BADGES.categoryBased.name, BADGES.streak.name, BADGES.timeBased.name
      ].sort());
    });

    // "Das erste Abzeichen" ist das Gegenstueck: Sie will ausdruecklich das
    // FRUEHESTE des Zeitraums und behaelt deshalb ihren Zeitfilter.
    it('Das erste Abzeichen bleibt an den Zeitraum gebunden', async () => {
      await abzeichen(USERS.teamer1.id, BADGES.categoryBased.id, VOR_ZEITRAUM);
      await abzeichen(USERS.teamer1.id, BADGES.streak.id, IM_ZEITRAUM);

      const snap = await snapshotVonTeamer1();
      // Der Bestand kennt beide ...
      expect(snap.slides.badges.total_earned).toBe(2);
      // ... die Seite "womit es losging" nennt das erste IM Zeitraum.
      expect(snap.slides.erstes_abzeichen.name).toBe(BADGES.streak.name);
    });

    // Der Seed legt vier Abzeichen fuer Org 1 an -- alle mit der Vorgabe
    // target_role = 'konfi'. Fuer Teamer:innen gibt es also zunaechst keins.
    it('Konfi-Abzeichen zaehlen nicht in total_available der Teamer:innen', async () => {
      const snap = await snapshotVonTeamer1();
      expect(snap.slides.badges.total_available).toBe(0);
    });

    it('total_available zaehlt nur die aktiven Teamer-Abzeichen', async () => {
      await db.query("UPDATE custom_badges SET target_role = 'teamer' WHERE id = ANY($1::int[])",
        [[BADGES.streak.id, BADGES.categoryBased.id, BADGES.timeBased.id]]);
      await db.query('UPDATE custom_badges SET is_active = false WHERE id = $1', [BADGES.timeBased.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.badges.total_available).toBe(2);
    });

    it('Ein Zertifikat aus dem Vorjahr gehoert nicht in diesen Rueckblick', async () => {
      await zertifikat(USERS.teamer1.id, 'Juleica im Zeitraum', IM_ZEITRAUM);
      await zertifikat(USERS.teamer1.id, 'Erste Hilfe im Vorjahr', VOR_ZEITRAUM);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.zertifikate.total).toBe(1);
      expect(snap.slides.zertifikate.zertifikate.map(z => z.name))
        .toEqual(['Juleica im Zeitraum']);
    });

    it('Das gewaehlte Jahr schlaegt bis in die Teamer-Zahlen durch', async () => {
      // Nicht nur die Anzeige: Die Zahlen darunter muessen zum Jahr passen.
      const drin = await termin('November im Rueckblicksjahr', IM_ZEITRAUM);
      const draussen = await termin('Juni im Folgejahr', `${JAHR}-06-15`);
      await buchung(USERS.teamer1.id, drin);
      await buchung(USERS.teamer1.id, draussen);

      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: RUECKBLICK_JAHR });
      expect(gen.status).toBe(200);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'teamer' AND ausgabe_id = $2`,
        [USERS.teamer1.id, gen.body.ausgabe_id]
      );
      expect(rows).toHaveLength(1);
      const snap = rows[0].data;
      expect(snap.slides.zeitraum.start).toBe(`${RUECKBLICK_JAHR}-01-01`);
      expect(snap.slides.zeitraum.ende).toBe(`${RUECKBLICK_JAHR}-12-31`);
      // Nur der Termin im Rueckblicksjahr -- der aus dem Folgejahr nicht.
      expect(snap.slides.events_geleitet.total).toBe(1);
    });

    it('Der Anfang ist der FRUEHESTE Termin im Zeitraum, nicht der letzte', async () => {
      const spaet = await termin('Spaeter Termin', `${RUECKBLICK_JAHR}-03-01`);
      const frueh = await termin('Erster Termin', `${RUECKBLICK_JAHR}-01-20`);
      const davor = await termin('Noch im Vorjahr', VOR_ZEITRAUM);
      await buchung(USERS.teamer1.id, spaet);
      await buchung(USERS.teamer1.id, frueh);
      await buchung(USERS.teamer1.id, davor);

      const snap = await snapshotVonTeamer1();
      // Der Termin aus dem Vorjahr liegt ausserhalb und darf nicht gewinnen.
      expect(snap.slides.anfang.name).toBe('Erster Termin');
      expect(snap.kacheln).toContain('teamer-anfang');
    });

    it('Das erste Abzeichen ist das FRUEHESTE im Zeitraum', async () => {
      await abzeichen(USERS.teamer1.id, BADGES.categoryBased.id, `${JAHR}-02-01`);
      await abzeichen(USERS.teamer1.id, BADGES.streak.id, `${JAHR - 1}-10-05`);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.erstes_abzeichen.name).toBe(BADGES.streak.name);
      expect(snap.kacheln).toContain('teamer-erstes-abzeichen');
    });

    it('Ohne Termine und Abzeichen fehlen beide Seiten', async () => {
      const snap = await snapshotVonTeamer1();
      expect(snap.slides.anfang).toBe(null);
      expect(snap.slides.erstes_abzeichen).toBe(null);
      expect(snap.kacheln).not.toContain('teamer-anfang');
      expect(snap.kacheln).not.toContain('teamer-erstes-abzeichen');
    });

    it('Freigaben zaehlen nur mit ausdruecklichem approved_by', async () => {
      const { rows: [ch] } = await db.query(
        `INSERT INTO challenges
           (title, description, badge_name, organization_id, created_by, starts_at, ends_at, moderated)
         VALUES ('Moderiert', 'Zeig es', 'Stempel', $1, $2,
                 NOW() - INTERVAL '1 year', NOW() + INTERVAL '1 year', true)
         RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      const einreichen = async (opts = {}) => {
        const { rows: [sub] } = await db.query(
          `INSERT INTO challenge_submissions
             (challenge_id, user_id, organization_id, media_type, moderation_status,
              approved_by, approved_at, created_at)
           VALUES ($1, $2, $3, 'text', 'approved', $4, $5, $6::timestamptz)
           RETURNING id`,
          [ch.id, USERS.konfi1.id, ORGS.testGemeinde.id,
           opts.approvedBy || null,
           opts.approvedAt || null,
           `${IM_ZEITRAUM} 10:00:00`]
        );
        return sub.id;
      };
      // Fuenf von teamer1 freigegeben ...
      for (let i = 0; i < 5; i++) {
        await einreichen({ approvedBy: USERS.teamer1.id, approvedAt: `${IM_ZEITRAUM} 12:00:00` });
      }
      // ... eine von jemand anderem ...
      await einreichen({ approvedBy: USERS.admin1.id, approvedAt: `${IM_ZEITRAUM} 12:00:00` });
      // ... und eine mit NULL (Bestandszeile oder unmoderierte Challenge).
      await einreichen();

      const snap = await snapshotVonTeamer1();
      // Genau die fuenf eigenen -- fremde und unbekannte zaehlen nicht.
      expect(snap.slides.moderation.freigegeben).toBe(5);

      // SIMON, 09.09.2026: "Und wie viele freigegeben kommt weg."
      // DIE ZAHL BLEIBT IM SNAPSHOT -- ausgelieferte App-Versionen lesen
      // slides.moderation. Nur die Seite entfaellt (ALT-APP-VERTRAG).
      expect(snap.kacheln).not.toContain('teamer-moderation');
    });



    it('Der Snapshot enthaelt KEINE Ablehnungsquote', async () => {
      // SIMONS REGEL (Konzept): nur die eigene Leistung, nie eine
      // Ablehnungsquote. Der Rueckblick darf Moderation nicht bewerten.
      const snap = await snapshotVonTeamer1();
      const alsText = JSON.stringify(snap);
      expect(alsText).not.toContain('abgelehnt');
      expect(alsText).not.toContain('hidden');
      expect(alsText).not.toContain('quote');
      expect(Object.keys(snap.slides.moderation)).toEqual(['freigegeben']);
    });

    it('Das Team zaehlt nur Teamer:innen -- keine Admins', async () => {
      // DER EIGENTLICHE FALLSTRICK: Ohne Rollenfilter zaehlte der Self-Join
      // ueber user_jahrgang_assignments auch Admins und die Leitung mit --
      // die Zahl waere dann keine Aussage ueber das Team, sondern ueber die
      // Zugriffsrechte. admin1 steht im Seed (beforeEach) auf jahrgang1,
      // teamer1 ebenfalls.
      //
      // Eine zweite Teamer:in in DERSELBEN Organisation und auf demselben
      // Jahrgang -- sie ist es, die zaehlen soll.
      const { rows: [kollegin] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
         VALUES ('teamer1b', 'Zweite Teamerin', 'x', $1, $2) RETURNING id`,
        [USERS.teamer1.role_id, ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [kollegin.id, JAHRGAENGE.jahrgang1.id]
      );

      const snap = await snapshotVonTeamer1();
      // Genau EINE: die zweite Teamer:in. admin1 sitzt auf demselben
      // Jahrgang, zaehlt aber nicht mit.
      expect(snap.slides.team.mitstreitende).toBe(1);
      expect(snap.kacheln).toContain('teamer-team');
    });

    it('Eine Teamer:in aus einer fremden Gemeinde zaehlt nicht zum Team', async () => {
      // Mandantengrenze: teamer2 gehoert zu Org 2.
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [USERS.teamer2.id, JAHRGAENGE.jahrgang1.id]
      );

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.team.mitstreitende).toBe(0);
      expect(snap.kacheln).not.toContain('teamer-team');
    });

    it('Im ersten Jahr erscheint "Neu dabei" statt "seit x Jahren"', async () => {
      // Der Rueckblick gilt dem abgeschlossenen Kalenderjahr -- "neu dabei"
      // ist also, wer IN DIESEM Jahr angefangen hat.
      await db.query('UPDATE users SET teamer_since = $1::date WHERE id = $2',
        [`${RUECKBLICK_JAHR}-02-01`, USERS.teamer1.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.neu_dabei.erstes_jahr).toBe(true);
      expect(snap.slides.neu_dabei.start_jahr).toBe(RUECKBLICK_JAHR);
      expect(snap.kacheln).toContain('teamer-neu-dabei');
      expect(snap.kacheln).not.toContain('teamer-jahre');
    });

    it('Ohne Eintrittsdatum und ohne Teamer-Aktivitaet bleibt das Startjahr unbekannt', async () => {
      // "Unbekannt" ist NICHT "neu" -- niemand wird faelschlich als Neuling
      // begruesst.
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.neu_dabei.start_jahr).toBe(null);
      expect(snap.slides.neu_dabei.erstes_jahr).toBe(false);
      expect(snap.kacheln).not.toContain('teamer-neu-dabei');
    });

    it('Antworten zaehlen -- eigene Nachrichten ohne Bezug nicht', async () => {
      // Raum 3 ist die Team-Gruppe aus dem Seed (teamer1 ist Teilnehmer).
      const schreib = async (userId, datum, replyTo = null) => {
        const { rows: [m] } = await db.query(
          `INSERT INTO chat_messages (room_id, user_id, content, reply_to, created_at)
           VALUES (3, $1, 'text', $2, $3::timestamptz) RETURNING id`,
          [userId, replyTo, `${datum} 10:00:00`]
        );
        return m.id;
      };
      const fremd = await schreib(USERS.admin1.id, IM_ZEITRAUM);
      // Fuenf echte Antworten im Zeitraum ...
      for (let i = 0; i < 5; i++) await schreib(USERS.teamer1.id, IM_ZEITRAUM, fremd);
      // ... eine eigene Nachricht OHNE Bezug (zaehlt nicht) ...
      await schreib(USERS.teamer1.id, IM_ZEITRAUM);
      // ... und eine Antwort im Vorjahr (ausserhalb des Zeitraums).
      await schreib(USERS.teamer1.id, VOR_ZEITRAUM, fremd);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.chat.antworten).toBe(5);
      expect(snap.kacheln).toContain('teamer-antworten');
    });

    it('Eine geloeschte Antwort zaehlt nicht mit', async () => {
      const { rows: [fremd] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, content, created_at)
         VALUES (3, $1, 'text', $2::timestamptz) RETURNING id`,
        [USERS.admin1.id, `${IM_ZEITRAUM} 10:00:00`]
      );
      for (let i = 0; i < 5; i++) {
        await db.query(
          `INSERT INTO chat_messages (room_id, user_id, content, reply_to, created_at)
           VALUES (3, $1, 'text', $2, $3::timestamptz)`,
          [USERS.teamer1.id, fremd.id, `${IM_ZEITRAUM} 10:00:00`]
        );
      }
      // Was jemand zurueckgenommen hat, soll ihm der Rueckblick nicht
      // vorrechnen.
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, content, reply_to, created_at, deleted_at)
         VALUES (3, $1, 'text', $2, $3::timestamptz, NOW())`,
        [USERS.teamer1.id, fremd.id, `${IM_ZEITRAUM} 10:00:00`]
      );

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.chat.antworten).toBe(5);
    });

    it('Wer selbst Konfi war, bekommt die Seite "Wie alles anfing"', async () => {
      // konfi_profiles bleibt beim Rollenwechsel stehen -- geloescht wird die
      // Zeile nur mit dem ganzen Menschen (routes/users.js, purgeHistory).
      // Genau darauf stuetzt sich die Seite; der Test haelt die Annahme gegen
      // eine echte Datenbank fest.
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id)
         VALUES ($1, $2, $3)`,
        [USERS.teamer1.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
      );

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.konfi_zeit).not.toBe(null);
      expect(snap.slides.konfi_zeit.jahrgang).toBe(JAHRGAENGE.jahrgang1.name);
      expect(snap.kacheln).toContain('teamer-konfi-zeit');
    });

    it('Wer von aussen ins Team kam, bekommt die Seite nicht', async () => {
      // teamer1 hat im Seed KEIN konfi_profiles -- der Normalfall fuer
      // jemanden, der nie Konfi dieser Gemeinde war.
      const snap = await snapshotVonTeamer1();
      expect(snap.slides.konfi_zeit).toBe(null);
      expect(snap.kacheln).not.toContain('teamer-konfi-zeit');
    });

    it('Eine Konfi-Zeit in einer FREMDEN Gemeinde zaehlt nicht', async () => {
      // Mandantengrenze: Ein Profil aus einer anderen Organisation erzaehlt
      // nicht die Geschichte DIESER Gemeinde.
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id)
         VALUES ($1, $2, $3)`,
        [USERS.teamer1.id, JAHRGAENGE.jahrgang2.id, ORGS.andereGemeinde.id]
      );

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.konfi_zeit).toBe(null);
      expect(snap.kacheln).not.toContain('teamer-konfi-zeit');
    });

    it('Der Snapshot traegt seine Seitenauswahl', async () => {
      // Ab Version 3 waehlt das Backend die Seiten (waehleTeamerKacheln)
      // und legt sie als `kacheln` in den Snapshot -- vorher zeigte das
      // Frontend sieben feste Seiten, auch wenn fuenf davon eine Null
      // trugen.
      const snap = await snapshotVonTeamer1();
      expect(snap.version).toBe(3);
      expect(Array.isArray(snap.kacheln)).toBe(true);
      expect(snap.kacheln[0]).toBe('teamer-intro');
      expect(snap.kacheln[snap.kacheln.length - 1]).toBe('teamer-abschluss');
    });

    it('Ein Team-Mitglied ohne alles bekommt den Zuspruch statt einer Bilanz', async () => {
      // SIMON, 09.09.2026: "Angenommen es gibt einen Teamer fuer den nichts
      // zu berechnen ist in dem Jahr. Dann soll der was bekommen aber keinen
      // Rueckblick und kein wir vermissen dich. Eher ein Segen, ein
      // positiver Zuspruch."
      //
      // Vorher endete dieser Fall auf 'teamer-abschluss' -- der fasst
      // Termine, Konfis und Abzeichen zusammen, also genau die Nullen.
      //
      // teamer1 hat im leergeraeumten Zustand keine Termine, keine
      // Abzeichen, keine Zertifikate und kein Eintrittsdatum.
      await db.query('DELETE FROM user_certificates');
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.kacheln).toEqual(['teamer-intro', 'teamer-segen', 'teamer-segen-abschluss']);
      expect(snap.kacheln).not.toContain('teamer-abschluss');
    });

    it('Zum Zuspruch gehoert auch sein Text im Snapshot', async () => {
      // Ohne den Text rendert die Seite nichts -- die Kachel allein
      // genuegt nicht.
      await db.query('DELETE FROM user_certificates');
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.segen).toBeDefined();
      expect(typeof snap.slides.segen.text).toBe('string');
      expect(snap.slides.segen.text.length).toBeGreaterThan(10);
      expect(snap.slides.segen.quelle.length).toBeGreaterThan(0);
    });

    it('Wer etwas vorzuweisen hat, bekommt keinen Zuspruch, sondern den Rueckblick', async () => {
      // Simons Schwelle: nur bei WIRKLICH nichts.
      const snap = await snapshotVonTeamer1();
      expect(snap.kacheln).not.toContain('teamer-segen');
      expect(snap.slides.segen).toBeUndefined();
    });

    /** Der heutige Tag als ISO-Datum, nach Ortszeit wie im Backend. */
    function heuteIso() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('Der Rueckblick umfasst das ganze Kalenderjahr, 1.1. bis 31.12.', async () => {
      // SIMONS REGEL (07.09.2026), woertlich: "Teamer der Rueckblick des
      // Jahres. Also immer zurueck auf den 1.1. des Jahres."
      //
      // VORHER war es eine lueckenlose Kette: Jede Ausgabe begann am Ende der
      // vorigen, die erste beim Eintritt ins Team. Korrekt gerechnet, aber
      // man konnte einer Ausgabe nicht ansehen, welchen Abschnitt sie
      // abdeckt. Das Kalenderjahr erklaert sich selbst.
      await db.query('UPDATE users SET teamer_since = $1::date WHERE id = $2',
        [`${JAHR - 3}-09-01`, USERS.teamer1.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.zeitraum.year).toBe(RUECKBLICK_JAHR);
      expect(snap.slides.zeitraum.start).toBe(`${RUECKBLICK_JAHR}-01-01`);
      expect(snap.slides.zeitraum.ende).toBe(`${RUECKBLICK_JAHR}-12-31`);
    });

    it('Der Eintritt ins Team verschiebt den Zeitraum NICHT', async () => {
      // Der frueher hier gerechnete Fallback auf teamer_since bzw. die
      // aelteste Teamer-Aktivitaet greift nicht mehr: Das Kalenderjahr gilt
      // fuer alle gleich. Wer erst im Juni dazukam, bekommt trotzdem einen
      // Rueckblick ueber das Jahr -- er zaehlt eben nur, was seither war.
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);
      const { rows: [akt] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ('Teamer-Schulung', 1, 'gemeinde', $1, 'teamer') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id, completed_date)
         VALUES ($1, $2, $3, $4, $5::date)`,
        [USERS.teamer1.id, akt.id, USERS.admin1.id, ORGS.testGemeinde.id, `${JAHR - 2}-03-15`]
      );

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.zeitraum.start).toBe(`${RUECKBLICK_JAHR}-01-01`);
      expect(snap.slides.zeitraum.ende).toBe(`${RUECKBLICK_JAHR}-12-31`);
    });

    it('Die Leitung waehlt das Jahr -- und bekommt genau dieses', async () => {
      await db.query('UPDATE users SET teamer_since = $1::date WHERE id = $2',
        [`${JAHR - 5}-09-01`, USERS.teamer1.id]);

      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: JAHR - 2 });
      expect(gen.status).toBe(200);
      expect(gen.body.year).toBe(JAHR - 2);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'teamer' AND ausgabe_id = $2`,
        [USERS.teamer1.id, gen.body.ausgabe_id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].data.slides.zeitraum.start).toBe(`${JAHR - 2}-01-01`);
      expect(rows[0].data.slides.zeitraum.ende).toBe(`${JAHR - 2}-12-31`);
    });

    it('Das LAUFENDE Jahr wird abgelehnt -- es ist noch nicht vorbei', async () => {
      // Die Oberflaeche zeigt es gesperrt mit dem Hinweis "verfuegbar ab
      // 1.1.<naechstes Jahr>". Dass es auch das Backend ablehnt, macht aus
      // der Anzeige eine Regel.
      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: JAHR });
      expect(gen.status).toBe(400);
      expect(gen.body.error).toContain(`1.1.${JAHR + 1}`);
    });

    it('Ein kuenftiges Jahr wird ebenfalls abgelehnt', async () => {
      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: JAHR + 1 });
      expect(gen.status).toBe(400);
    });

    it('Der Zeitraum der Ausgabe ist derselbe wie der im Snapshot', async () => {
      // Sonst staende in der Verwaltung eine Spanne, die zu den Zahlen
      // darunter nicht passt.
      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: JAHR - 1 });
      expect(gen.status).toBe(200);

      const { rows: [ausgabe] } = await db.query(
        `SELECT zeitraum_start, zeitraum_ende FROM wrapped_ausgaben WHERE id = $1`,
        [gen.body.ausgabe_id]
      );
      // Die DATE-Spalte kommt als JS-Date in ORTSZEIT zurueck.
      // toISOString() rechnete sie nach UTC und machte aus dem 1.1. den
      // 31.12. des Vorjahres -- dieselbe Falle, gegen die berechneZeitraum()
      // sich wehrt.
      const iso = (d) => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };
      expect(iso(ausgabe.zeitraum_start)).toBe(`${JAHR - 1}-01-01`);
      expect(iso(ausgabe.zeitraum_ende)).toBe(`${JAHR - 1}-12-31`);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND ausgabe_id = $2`,
        [USERS.teamer1.id, gen.body.ausgabe_id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].data.slides.zeitraum.start).toBe(`${JAHR - 1}-01-01`);
      expect(rows[0].data.slides.zeitraum.ende).toBe(`${JAHR - 1}-12-31`);
    });

    // BEWUSST OHNE ZEITFILTER -- kein Versehen, sondern eine Entscheidung:
    // "seit 4 Jahren dabei" IST der Lebenszeitwert und die Aussage der
    // Seite. Auf ein Jahr eingegrenzt kaeme dort immer 1 heraus.
    it('Die Jahre im Team bleiben ein Lebenszeitwert -- gerechnet bis zum Zeitraum-Ende', async () => {
      // Eintritt genau vier Jahre vor dem 31.12. des Rueckblicksjahres.
      await db.query('UPDATE users SET teamer_since = $1::date WHERE id = $2',
        [`${RUECKBLICK_JAHR - 4}-12-31`, USERS.teamer1.id]);

      const snap = await snapshotVonTeamer1();
      expect(snap.slides.engagement.jahre_aktiv).toBe(4);
    });

    // "Konfis betreut" ist ein ZUSTAND, kein Ereignis: die Zuweisung
    // user_jahrgang_assignments traegt kein Datum. Der Wert bleibt deshalb
    // ungefiltert -- der Test haelt das fest, damit es niemand versehentlich
    // "mitfiltert".
    it('Die betreuten Konfis bleiben ungefiltert -- die Zuweisung hat kein Datum', async () => {
      const snap = await snapshotVonTeamer1();
      // Der Seed weist teamer1 den Jahrgang 1 zu; dort liegen konfi1 und konfi2.
      expect(snap.slides.konfis_betreut.total_konfis).toBe(2);
      expect(snap.slides.konfis_betreut.jahrgaenge).toContain(JAHRGAENGE.jahrgang1.name);
    });
  });

  // ================================================================
  // DELETE /:jahrgangId
  // ================================================================
  describe('DELETE /api/wrapped/:jahrgangId', () => {
    it('OrgAdmin loescht Wrapped -> 200', async () => {
      // Zuerst generieren
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      // Der Seed hat zwei Konfis in Jahrgang 1 (konfi1, konfi2) -- genau deren
      // Snapshots muessen weg sein. `toBeDefined()` haette auch bei 0 gegruent,
      // also gerade dann, wenn das Loeschen gar nichts trifft.
      expect(res.body.deleted).toBe(2);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierender Jahrgang gibt 404', async () => {
      const res = await request(app)
        .delete('/api/wrapped/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Befund W-D (01.09.2026): Schluessel, Push und Loeschweg
  // ================================================================
  describe('Snapshot-Schluessel, Push und Loeschweg (W-D)', () => {
    it('haelt fuer zwei Jahrgaenge im selben Jahr zwei Snapshots', async () => {
      // Der Schluessel lautete UNIQUE(user_id, wrapped_type, year) -- ohne
      // Jahrgang. Gehoerte eine Konfi im selben Jahr zu zwei Jahrgaengen,
      // ueberschrieb der zweite Lauf den ersten still: kein Fehler, der
      // Zaehler meldete trotzdem Erfolg, und der erste Jahrgang verlor
      // seinen Rueckblick. Migration 140 nimmt den Jahrgang in den Schluessel.
      const zweiterJahrgang = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id) VALUES ($1, $2) RETURNING id`,
        ['Zweiter Jahrgang', ORGS.testGemeinde.id]
      );
      const jgZwei = zweiterJahrgang.rows[0].id;

      const jahr = new Date().getFullYear();
      const daten = JSON.stringify({ version: 1 });

      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data)
         VALUES ($1, $2, 'konfi', $3, $4, $5)`,
        [USERS.konfi1.id, ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id, jahr, daten]
      );
      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data)
         VALUES ($1, $2, 'konfi', $3, $4, $5)`,
        [USERS.konfi1.id, ORGS.testGemeinde.id, jgZwei, jahr, daten]
      );

      const { rows } = await db.query(
        `SELECT jahrgang_id FROM wrapped_snapshots
         WHERE user_id = $1 AND wrapped_type = 'konfi' AND year = $2
         ORDER BY jahrgang_id`,
        [USERS.konfi1.id, jahr]
      );

      // Vor der Migration stand hier genau eine Zeile.
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.jahrgang_id).sort((a, b) => a - b))
        .toEqual([JAHRGAENGE.jahrgang1.id, jgZwei].sort((a, b) => a - b));
    });

    it('haelt Teamer-Snapshots eindeutig INNERHALB einer Ausgabe', async () => {
      // GEAENDERT AM 03.09.2026 (Migration 144, Simons Mehrfach-Ausgaben):
      // Frueher pruefte dieser Test "genau eine Zeile pro Person und Jahr" --
      // richtig fuer das alte Modell, in dem es je Jahr nur EINEN Rueckblick
      // gab. Seit es Ausgaben gibt ("Zwischenstand", "Abschluss"), sind zwei
      // Laeufe zwei Ausgaben und damit bewusst zwei Zeilen.
      //
      // Die Eigenschaft, die WEITER gelten muss: Innerhalb EINER Ausgabe
      // bleibt es bei einer Zeile pro Person -- ein erneuter Lauf auf
      // dieselbe Ausgabe korrigiert, statt zu doppeln. Und COALESCE
      // (jahrgang_id, 0) muss weiter greifen, sonst waeren Teamer-Snapshots
      // (jahrgang_id IS NULL) gar nicht mehr eindeutig.
      //
      // ZWEI VERSCHIEDENE JAHRE (08.09.2026): Zweimal dasselbe Jahr ergibt
      // seit dem Fix keine zweite Ausgabe mehr -- der Team-Rueckblick eines
      // Jahres existiert genau einmal, sonst bekaeme das Team zwei Pushes.
      // Zwei Ausgaben entstehen jetzt ueber zwei JAHRE, und genau die
      // muessen weiter getrennte Snapshot-Zeilen haben.
      const letztes = new Date().getFullYear() - 1;
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: letztes });
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: letztes - 1 });

      // Zwei Ausgaben -> zwei Zeilen, aber je Ausgabe genau eine.
      const { rows } = await db.query(
        `SELECT ausgabe_id, COUNT(*)::int AS anzahl FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'teamer'
          GROUP BY ausgabe_id`,
        [USERS.teamer1.id]
      );

      expect(rows).toHaveLength(2);
      for (const zeile of rows) expect(zeile.anzahl).toBe(1);
    });

    it('ein erneuter Lauf auf DIESELBE Ausgabe doppelt nicht', async () => {
      // Die Idempotenz, die der ON-CONFLICT-Schluessel sichern muss.
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { rows: [vorher] } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi1.id]
      );
      expect(vorher.anzahl).toBe(1);
    });

    // Der Push wird am echten Versand geprueft, nicht an der Antwortmarke:
    // Wer den Aufruf aendert und `benachrichtigt` stehen laesst, wuerde sonst
    // nicht auffallen. (Beim Schreiben dieser Tests genau so passiert -- die
    // Gegenprobe blieb gruen, bis auch die Marke zurueckgedreht war.)
    it('benachrichtigt bei der ersten Freigabe', async () => {
      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.benachrichtigt).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      // An beide Konfis des Jahrgangs, als Konfi-Wrapped.
      const [, userIds, typ] = spy.mock.calls[0];
      expect([...userIds].sort((a, b) => a - b)).toEqual([USERS.konfi1.id, USERS.konfi2.id]);
      expect(typ).toBe('konfi');

      spy.mockRestore();
    });

    // GEDREHT AM 08.09.2026 (Simon). Bis hierher schwieg der zweite Lauf.
    //
    // Die Regel stammt vom 01.09.2026 (f226dce0) und hatte damals recht: Ein
    // erneuter Lauf ueberschrieb DENSELBEN Rueckblick, ein zweiter Push haette
    // "ist da!" gemeldet, obwohl nichts Neues da war.
    //
    // Seit Migration 144 (03.09.) stimmt diese Voraussetzung nicht mehr: Jeder
    // Lauf legt eine EIGENE Ausgabe an, die neben der alten stehen bleibt und
    // in der Liste der Konfis auftaucht. Es IST etwas Neues da -- und niemand
    // erfuhr davon. Simon: "warum gibt es keinen zweiten push, verstehe ich
    // nicht?"
    it('benachrichtigt bei JEDER neuen Ausgabe', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const zweiter = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(zweiter.status).toBe(200);
      expect(zweiter.body.benachrichtigt).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      // An beide Konfis des Jahrgangs, wie beim ersten Lauf.
      const [, userIds, typ] = spy.mock.calls[0];
      expect([...userIds].sort((a, b) => a - b)).toEqual([USERS.konfi1.id, USERS.konfi2.id]);
      expect(typ).toBe('konfi');
      expect(zweiter.body.generated).toBe(2);
      expect(zweiter.body.errors).toBe(0);

      spy.mockRestore();
    });

    it('benachrichtigt wieder, nachdem die Freigabe zurueckgenommen wurde', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const erneut = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(erneut.body.benachrichtigt).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    // Dasselbe fuer den TEAM-Rueckblick. Der Konfi-Weg prueft
    // `wrapped_released_at` am Jahrgang und schweigt beim zweiten Lauf; der
    // Team-Rueckblick haengt an keinem Jahrgang und hatte diese Bremse nicht:
    // Er legte bei jedem Aufruf eine weitere Ausgabe an und schickte jedes
    // Mal "Dein Teamer-Jahr ist da!" an das ganze Team. Der Cron am 6.1.
    // ueberspringt ein schon vorhandenes Jahr (generateAllTeamerWrapped),
    // die Route dahinter tat es nicht -- obwohl der Kommentar dort behauptet,
    // die Pruefung gelte "auch fuer den manuellen Weg".
    it('legt denselben Team-Rueckblick nicht zweimal an und benachrichtigt nur einmal', async () => {
      const jahr = new Date().getFullYear() - 1;

      const erster = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr });
      expect(erster.status).toBe(200);
      expect(erster.body.benachrichtigt).toBe(true);

      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const zweiter = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr });

      // Der zweite Lauf laeuft durch, tut aber nichts: kein Push ...
      expect(zweiter.status).toBe(200);
      expect(zweiter.body.benachrichtigt).toBe(false);
      expect(spy).not.toHaveBeenCalled();

      // ... und vor allem keine zweite Ausgabe fuer dasselbe Jahr.
      const { rows: [ausgaben] } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_ausgaben
          WHERE organization_id = $1 AND wrapped_type = 'teamer'
            AND zeitraum_start = $2::date AND zeitraum_ende = $3::date`,
        [ORGS.testGemeinde.id, `${jahr}-01-01`, `${jahr}-12-31`]
      );
      expect(ausgaben.anzahl).toBe(1);

      spy.mockRestore();
    });

    // Die Gegenprobe zur Sperre: Ein ANDERES Jahr muss weiterhin durchgehen.
    // Eine Sperre, die pauschal jeden zweiten Lauf abweist, waere schlimmer
    // als der Fehler -- dann liesse sich nie ein zweites Jahr anlegen.
    it('legt fuer ein anderes Jahr sehr wohl einen zweiten Team-Rueckblick an', async () => {
      const jahr = new Date().getFullYear() - 1;

      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr });

      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const anderes = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: jahr - 1 });

      expect(anderes.status).toBe(200);
      expect(anderes.body.benachrichtigt).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      const { rows: [ausgaben] } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_ausgaben
          WHERE organization_id = $1 AND wrapped_type = 'teamer'`,
        [ORGS.testGemeinde.id]
      );
      expect(ausgaben.anzahl).toBe(2);

      spy.mockRestore();
    });


    it('loescht Teamer-Snapshots ueber DELETE /teamer', async () => {
      // Teamer-Snapshots haben keinen Jahrgang. DELETE /:jahrgangId filtert
      // auf jahrgang_id und traf sie deshalb nie -- einmal erzeugt, blieben
      // sie fuer immer stehen.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const vorher = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(vorher.rows[0].anzahl).toBe(1);

      const res = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(1);

      const nachher = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(nachher.rows[0].anzahl).toBe(0);
    });

    it('laesst beim Loeschen eines Jahrgangs die Teamer-Snapshots stehen', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Nur die beiden Konfi-Zeilen des Jahrgangs, nicht die Teamer-Zeile.
      expect(res.body.deleted).toBe(2);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(rows[0].anzahl).toBe(1);
    });

    it('loescht keine Teamer-Snapshots einer fremden Organisation', async () => {
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      const res = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.body.deleted).toBe(1);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
         WHERE wrapped_type = 'teamer' AND organization_id = $1`,
        [ORGS.andereGemeinde.id]
      );
      expect(rows[0].anzahl).toBe(1);
    });

    it('loescht nur das angefragte Jahr und laesst aeltere Teamer-Wrappeds stehen', async () => {
      // Teamer bekommen JEDES Jahr einen neuen Rückblick, und die alten
      // müssen erhalten bleiben (Simons Regel 02.09.2026). Bei den Konfis
      // leistet das der Jahrgangsfilter in DELETE /:jahrgangId — Teamer haben
      // keinen Jahrgang, dort ist das Jahr die einzige Trennlinie.
      //
      // Ohne den Filter löschte die Route ALLE Jahre der Organisation auf
      // einmal: Ein "neu erzeugen" im nächsten Jahr hätte die gesamte
      // Historie aller Teamer:innen vernichtet, ohne Rückfrage und ohne Spur.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Einen Snapshot aus dem Vorjahr danebenlegen (so entsteht er im echten
      // Betrieb: der Lauf des letzten Jahres).
      const { rows: [vorhanden] } = await db.query(
        `SELECT user_id, organization_id, data FROM wrapped_snapshots
         WHERE wrapped_type = 'teamer' LIMIT 1`
      );
      // Der Lauf oben legt den Rueckblick des zuletzt abgeschlossenen
      // Jahres an; daneben kommt der des Jahres davor.
      const erzeugtesJahr = new Date().getFullYear() - 1;
      const aelteresJahr = erzeugtesJahr - 1;
      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
         VALUES ($1, $2, 'teamer', $3, $4, NOW())`,
        [vorhanden.user_id, vorhanden.organization_id, aelteresJahr, vorhanden.data]
      );

      const res = await request(app)
        .delete(`/api/wrapped/teamer?year=${erzeugtesJahr}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(1);

      const { rows } = await db.query(
        `SELECT year FROM wrapped_snapshots WHERE wrapped_type = 'teamer' ORDER BY year`
      );
      expect(rows.map(r => r.year)).toEqual([aelteresJahr]);
    });

    it('loescht ohne Jahresangabe weiterhin alle Jahre (bisheriges Verhalten)', async () => {
      // Der Vertrag der ausgelieferten Oberfläche: Ein DELETE ohne year
      // räumt wie bisher komplett auf. Nur so bleibt der vorhandene
      // Aufruf in der Leitungsansicht gültig.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const { rows: [vorhanden] } = await db.query(
        `SELECT user_id, organization_id, data FROM wrapped_snapshots
         WHERE wrapped_type = 'teamer' LIMIT 1`
      );
      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
         VALUES ($1, $2, 'teamer', 2025, $3, NOW())`,
        [vorhanden.user_id, vorhanden.organization_id, vorhanden.data]
      );

      const res = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.body.deleted).toBe(2);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(rows[0].anzahl).toBe(0);
    });

    it('weist ein unsinniges Jahr ab', async () => {
      const res = await request(app)
        .delete('/api/wrapped/teamer?year=abc')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(400);
    });

    it('laesst Admin und Konfi nicht an DELETE /teamer', async () => {
      const alsAdmin = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(alsAdmin.status).toBe(403);

      const alsKonfi = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(alsKonfi.status).toBe(403);
    });
  });

  // ================================================================
  // GET /history/:userId
  // ================================================================
  describe('GET /api/wrapped/history/:userId', () => {
    it('Admin bekommt 200 + Wrapped-History', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Eigene History abrufen -> 200', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi kann History anderer User nicht abrufen -> 403', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi2.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`);

      expect(res.status).toBe(401);
    });

    it('Nach Generierung zeigt History Eintraege', async () => {
      // Vorher stand hier ein `if (res.body.length > 0)` mit dem Vermerk
      // "kann leer sein wenn Generierung fehlschlug". Damit war der Test
      // still gruen, sobald die Generierung kaputt ging -- also genau dann,
      // wenn er haette anschlagen muessen. Jetzt hart geprueft (27.08.2026).
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(genRes.status).toBe(200);

      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].wrapped_type).toBe('konfi');
      expect(res.body[0].data).toBeDefined();
    });

    // Befund N5 (27.08.2026): Die Leitung bekommt in der Konfi-Detailseite
    // eine Ansicht des Konfi-Wrapped. Der Endpunkt prueft selbst NICHT, ob
    // der Jahrgang freigegeben ist -- das ist nur deshalb unbedenklich, weil
    // Snapshot-Erzeugung und wrapped_released_at in derselben Transaktion
    // laufen (wrapped.js:513-537). Ein Konfi-Snapshot existiert also nie vor
    // der Freigabe.
    //
    // Faellt diese Kopplung, wird aus der neuen Ansicht eine
    // Datenschutzluecke: Die Leitung saehe einen Rueckblick, den die Konfi
    // selbst noch nicht sehen darf. Diese Tests halten die Kopplung fest.
    describe('Freigabe-Kopplung (Grundlage von N5)', () => {
      it('ohne Generierung gibt es weder Snapshot noch Freigabe', async () => {
        const { rows: [jahrgang] } = await db.query(
          'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1',
          [JAHRGAENGE.jahrgang1.id]
        );
        expect(jahrgang.wrapped_released_at).toBeNull();

        const res = await request(app)
          .get(`/api/wrapped/history/${USERS.konfi1.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
      });

      it('die Generierung setzt die Freigabe im selben Zug', async () => {
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const { rows: [jahrgang] } = await db.query(
          'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1',
          [JAHRGAENGE.jahrgang1.id]
        );
        expect(jahrgang.wrapped_released_at).not.toBeNull();
      });

      it('kein Snapshot liegt jemals ohne Freigabe seines Jahrgangs vor', async () => {
        // Der Kern der Zusicherung, unabhaengig vom Weg der Erzeugung.
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const { rows } = await db.query(
          `SELECT COUNT(*)::int AS anzahl
             FROM wrapped_snapshots ws
             JOIN jahrgaenge j ON ws.jahrgang_id = j.id
            WHERE ws.wrapped_type = 'konfi'
              AND j.wrapped_released_at IS NULL`
        );
        expect(rows[0].anzahl).toBe(0);
      });

      it('das Zuruecknehmen der Freigabe loescht die Snapshots mit', async () => {
        // Gegenprobe in die andere Richtung: Nach dem Zuruecknehmen darf
        // auch die Leitung nichts mehr sehen.
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Das Zuruecknehmen ist org_admin vorbehalten -- admin bekommt hier
        // bewusst 403 (siehe DELETE-Tests oben).
        await request(app)
          .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(403);

        await request(app)
          .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${orgAdminToken}`)
          .expect(200);

        const res = await request(app)
          .get(`/api/wrapped/history/${USERS.konfi1.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);

        const { rows: [jahrgang] } = await db.query(
          'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1',
          [JAHRGAENGE.jahrgang1.id]
        );
        expect(jahrgang.wrapped_released_at).toBeNull();
      });

      it('die Leitung einer FREMDEN Organisation bekommt weiterhin 403', async () => {
        // Die neue Ansicht darf die Org-Grenze nicht aufweichen.
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const res = await request(app)
          .get(`/api/wrapped/history/${USERS.konfi1.id}`)
          .set('Authorization', `Bearer ${orgAdmin2Token}`);
        expect(res.status).toBe(403);
      });
    });
  });

  // ================================================================
  // ZAHLEN (Befunde W-A / W-B / W-C, 01.09.2026)
  //
  // Die Suite prueft bis hier ausschliesslich Rechte, Isolation und
  // Freigabe -- keine einzige Zahl. Genau deshalb standen W-A und W-B
  // bei gruenen Tests im Code. Alles hier prueft konkrete Werte.
  // ================================================================
  describe('Zahlen im Konfi-Snapshot', () => {
    const JAHR = new Date().getFullYear();

    // Zeitraum ohne Konfirmations-Termin: 1.9.(JAHR-1) .. 31.8.(JAHR).
    const IM_ZEITRAUM = `${JAHR - 1}-11-15`;
    const AUGUST = `${JAHR}-08-15`;          // frueher aus dem Fallback gefallen
    const VOR_ZEITRAUM = `${JAHR - 1}-06-15`; // liegt davor
    const NACH_ZEITRAUM = `${JAHR}-10-15`;    // liegt danach

    /** Termin anlegen und dem Jahrgang zuordnen; gibt die Event-ID zurueck. */
    async function termin(name, datum, opts = {}) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, $2::timestamp, $3, $4, 0, $5, 1) RETURNING id`,
        [name, `${datum} 10:00:00`, opts.orgId || ORGS.testGemeinde.id, opts.mandatory || false, opts.pointType || 'gemeinde']
      );
      const jgId = opts.jahrgangId === null ? null : (opts.jahrgangId || JAHRGAENGE.jahrgang1.id);
      if (jgId !== null) {
        await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jgId]);
      }
      return e.id;
    }

    async function buchung(userId, eventId, opts = {}) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status, booking_date)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, eventId, opts.orgId || ORGS.testGemeinde.id, opts.status || 'confirmed', opts.attendance || null]
      );
    }

    /** Erzeugt Wrapped fuer Jahrgang 1 und gibt den Snapshot von konfi1 zurueck. */
    async function snapshotVonKonfi1() {
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);

      // Der zuletzt erzeugte Snapshot: Jeder Lauf legt eine eigene Ausgabe
      // an (Migration 144), zwei Laeufe in einem Test stehen also
      // nebeneinander.
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'konfi'
          ORDER BY computed_at DESC, id DESC LIMIT 1`,
        [USERS.konfi1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    /**
     * Snapshot mit AUSDRUECKLICHEM Zeitraum -- Simons Option fuer
     * Zwischenberichte (07.09.2026).
     *
     * Seit der neuen Regel laeuft der automatische Zeitraum vom Beginn der
     * Konfi-Zeit bis heute und schneidet nichts mehr ab. Wer pruefen will,
     * DASS ein Zeitraum ueberhaupt greift, muss ihn also angeben -- das ist
     * seither die einzige Stelle, an der ein Fenster enger wird.
     */
    /**
     * Snapshot von konfi1, wobei der BEGINN DER KONFI-ZEIT gesetzt wird.
     *
     * SEIT DEM 07.09.2026 gibt es keine Datumsfelder mehr (Simon: "wir
     * lassen das mit dem Datum"). Der Konfi-Rueckblick laeuft immer vom
     * Beginn der Konfi-Zeit bis heute -- und dieser Beginn ist das einzige,
     * was den Zeitraum noch verschiebt. Genau deshalb setzen die Tests ihn
     * hier: Sie pruefen die Regel, die es wirklich gibt, statt eine
     * Eingabemoeglichkeit, die es nicht mehr gibt.
     */
    async function snapshotVonKonfi1AbBeginn(beginn) {
      await db.query(
        'UPDATE konfi_profiles SET created_at = $1::timestamp WHERE user_id = $2',
        [`${beginn} 00:00:00`, USERS.konfi1.id]
      );
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'konfi'
          ORDER BY computed_at DESC, id DESC LIMIT 1`,
        [USERS.konfi1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    /**
     * Der Beginn der Konfi-Zeit fuer die Zeitraum-Tests. Alles davor faellt
     * heraus, alles danach bis heute zaehlt.
     */
    const KONFI_BEGINN = `${JAHR - 1}-09-01`;

    beforeEach(async () => {
      // Der Seed legt vier Termine 7 Tage in der Zukunft an und bucht nichts.
      // Fuer die Zahlen-Tests raeumen wir das Feld leer und stellen eine
      // bekannte Datenlage her.
      await db.query('DELETE FROM event_bookings');
      await db.query('DELETE FROM event_jahrgang_assignments');
      await db.query('DELETE FROM events');
    });

    // ------------------------------------------------------------
    // Der Name der Kirchengemeinde im Snapshot (additiv ab 07.09.2026).
    //
    // Simons Vorgabe: "Die Uebersicht die geteilt wird sollte die
    // Kirchengemeinde enthalten." Die Abschluss-Seite und die Teilen-Karte
    // lesen `slides.gemeinde` -- steht der Name nicht im Snapshot, bleibt
    // die Zeile leer, ohne dass irgendetwas kaputtgeht. Genau deshalb
    // braucht es hier einen Test: Ein fehlendes Feld faellt sonst nicht auf.
    // ------------------------------------------------------------
    it('der Snapshot traegt den Anzeigenamen der Kirchengemeinde', async () => {
      const snap = await snapshotVonKonfi1();
      // Der Seed setzt display_name = 'Test-Gemeinde St. Martin' und
      // name = 'Test-Gemeinde'. Auf ein Bild, das jemand weitergibt,
      // gehoert der Anzeigename, nicht der interne Bezeichner.
      expect(snap.slides.gemeinde).toBe(ORGS.testGemeinde.display_name);
      expect(snap.slides.gemeinde).toBe('Test-Gemeinde St. Martin');
    });

    it('ohne Anzeigename faellt der Snapshot auf den Gemeindenamen zurueck', async () => {
      // COALESCE(NULLIF(TRIM(display_name), ''), name): Eine Gemeinde, die
      // keinen Anzeigenamen gepflegt hat, bekommt ihren name -- nicht null
      // und erst recht keine leere Zeile auf dem geteilten Bild.
      await db.query('UPDATE organizations SET display_name = NULL WHERE id = $1', [ORGS.testGemeinde.id]);
      const snap = await snapshotVonKonfi1();
      expect(snap.slides.gemeinde).toBe('Test-Gemeinde');
    });

    it('ein Anzeigename aus Leerzeichen zaehlt nicht als Name', async () => {
      await db.query("UPDATE organizations SET display_name = '   ' WHERE id = $1", [ORGS.testGemeinde.id]);
      const snap = await snapshotVonKonfi1();
      expect(snap.slides.gemeinde).toBe('Test-Gemeinde');
    });

    it('das Feld lieblings_event bleibt im Snapshot, obwohl es niemand mehr zeigt', async () => {
      // VERTRAGSTREUE GEGENUEBER AUSGELIEFERTEN APPS: Die Anzeige ist am
      // 07.09.2026 entfallen (Simon: "Dein letzter Termin kann weg") -- auf
      // der Termin-Seite und auf der Teilen-Karte. Das FELD bleibt: Auf den
      // Geraeten laufen App-Versionen, die es lesen, und ein weggelassenes
      // Feld ist ein Bruch der Antwortform.
      //
      // Dieser Test steht ausdruecklich hier, damit niemand das Feld beim
      // naechsten Aufraeumen "als ungenutzt" streicht: Im Repo hat es seit
      // dem 07.09.2026 tatsaechlich keinen Leser mehr.
      const e = await termin('Der eine Termin', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, e);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events).toHaveProperty('lieblings_event');
      expect(snap.slides.events.lieblings_event.name).toBe('Der eine Termin');
    });

    // ------------------------------------------------------------
    // W-A: Wrapped und Dashboard zaehlen dieselbe Sache gleich.
    // ------------------------------------------------------------
    it('Wrapped und Dashboard liefern fuer dieselbe Person dieselbe Terminzahl', async () => {
      // Genau die Mischung, die in Produktion den Faktor 15 erzeugte:
      // gebucht ohne gepflegte Anwesenheit, gebucht + present, und ein
      // Termin OHNE Jahrgangszuordnung.
      const a = await termin('Gebucht ohne Anwesenheit', IM_ZEITRAUM);
      const b = await termin('Gebucht und anwesend', IM_ZEITRAUM);
      const c = await termin('Ohne Jahrgangszuordnung', IM_ZEITRAUM, { jahrgangId: null });
      await buchung(USERS.konfi1.id, a);
      await buchung(USERS.konfi1.id, b, { attendance: 'present' });
      await buchung(USERS.konfi1.id, c);

      const dash = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(dash.status).toBe(200);
      expect(dash.body.event_count).toBe(3);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.total_attended).toBe(3);
      expect(snap.slides.events.total_attended).toBe(dash.body.event_count);
    });

    it('gottesdienst_count zaehlt nach derselben Regel wie die Termine', async () => {
      // Frueher zaehlte gottesdienst_count in DERSELBEN Funktion nach einer
      // dritten Regel (present, aber ohne Jahrgangs-JOIN).
      const gd1 = await termin('Gottesdienst gebucht', IM_ZEITRAUM, { pointType: 'gottesdienst' });
      const gd2 = await termin('Gottesdienst anwesend', IM_ZEITRAUM, { pointType: 'gottesdienst' });
      const gem = await termin('Gemeindeabend', IM_ZEITRAUM, { pointType: 'gemeinde' });
      await buchung(USERS.konfi1.id, gd1);
      await buchung(USERS.konfi1.id, gd2, { attendance: 'present' });
      await buchung(USERS.konfi1.id, gem);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.gottesdienst.count).toBe(2);
      expect(snap.slides.events.total_attended).toBe(3);
    });

    // ------------------------------------------------------------
    // W-B: Der Jahresrueckblick filtert nach Jahr.
    // ------------------------------------------------------------
    it('Ein Termin AUSSERHALB des Zeitraums zaehlt nicht mit', async () => {
      const drin = await termin('Im Zeitraum', IM_ZEITRAUM);
      const davor = await termin('Vor dem Zeitraum', VOR_ZEITRAUM);
      const danach = await termin('Nach dem Zeitraum', NACH_ZEITRAUM);
      await buchung(USERS.konfi1.id, drin);
      await buchung(USERS.konfi1.id, davor);
      await buchung(USERS.konfi1.id, danach);

      // Der Rueckblick laeuft vom Beginn der Konfi-Zeit bis HEUTE: Der
      // Termin davor faellt heraus, der in der Zukunft ebenfalls.
      const snap = await snapshotVonKonfi1AbBeginn(KONFI_BEGINN);
      // Das Dashboard zaehlt weiterhin alle drei -- es kennt keinen Zeitraum.
      expect(snap.slides.events.total_attended).toBe(1);
      expect(snap.slides.events.lieblings_event.name).toBe('Im Zeitraum');
    });

    it('Absagen ausserhalb des Zeitraums zaehlen nicht mit', async () => {
      const drin = await termin('Abgesagt im Zeitraum', IM_ZEITRAUM);
      const davor = await termin('Abgesagt davor', VOR_ZEITRAUM);
      await buchung(USERS.konfi1.id, drin, { status: 'cancelled' });
      await buchung(USERS.konfi1.id, davor, { status: 'cancelled' });

      const snap = await snapshotVonKonfi1AbBeginn(KONFI_BEGINN);
      expect(snap.slides.events.abgesagt).toBe(1);
    });

    it('aktivster_monat mittelt nicht ueber mehrere Jahre', async () => {
      // Zwei Termine im November des VORJAHRES (im Zeitraum) und drei im
      // Dezember eines noch frueheren Jahres (ausserhalb). Ohne Zeitfilter
      // gewaenne der Dezember mit 3 -- obwohl er gar nicht zum Rueckblick
      // gehoert.
      const nov1 = await termin('November A', `${JAHR - 1}-11-05`);
      const nov2 = await termin('November B', `${JAHR - 1}-11-20`);
      const dez1 = await termin('Dezember alt A', `${JAHR - 3}-12-05`);
      const dez2 = await termin('Dezember alt B', `${JAHR - 3}-12-10`);
      const dez3 = await termin('Dezember alt C', `${JAHR - 3}-12-15`);
      for (const id of [nov1, nov2, dez1, dez2, dez3]) {
        await buchung(USERS.konfi1.id, id);
      }

      const snap = await snapshotVonKonfi1AbBeginn(KONFI_BEGINN);
      expect(snap.slides.aktivster_monat.monat).toBe(11);
      expect(snap.slides.aktivster_monat.monat_name).toBe('November');
      expect(snap.slides.aktivster_monat.aktivitaeten).toBe(2);
    });

    // ------------------------------------------------------------
    // SIMONS KONFI-REGEL (07.09.2026): "Immer vom anfang an bis zum jetzigen
    // zeitpunkt." Der Zeitraum beginnt am Anfang der Konfi-Zeit
    // (konfi_profiles.created_at) und endet HEUTE -- der Konfirmationstermin
    // schneidet nichts mehr ab.
    // ------------------------------------------------------------
    /** Der heutige Tag als ISO-Datum, nach Ortszeit wie im Backend. */
    function heuteIso() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('Ohne Konfirmationstermin laeuft der Zeitraum vom Beginn der Konfi-Zeit bis heute', async () => {
      const { rows: [k] } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM events WHERE is_konfirmation = true'
      );
      expect(k.anzahl).toBe(0);

      // Beginn der Konfi-Zeit ausdruecklich setzen, damit die Erwartung eine
      // Zahl ist und kein "ungefaehr".
      await db.query(
        `UPDATE konfi_profiles SET created_at = $1::timestamptz
          WHERE user_id = $2 AND jahrgang_id = $3`,
        [`${JAHR - 2}-09-01 08:00:00+02`, USERS.konfi1.id, JAHRGAENGE.jahrgang1.id]
      );

      const imAugust = await termin('Sommerfreizeit im August', AUGUST);
      await buchung(USERS.konfi1.id, imAugust);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.zeitraum.start).toBe(`${JAHR - 2}-09-01`);
      expect(snap.slides.zeitraum.ende).toBe(heuteIso());
      // Ohne Konfirmations-Termin gibt es KEINEN Konfirmationstermin.
      expect(snap.slides.zeitraum.konfirmation).toBe(null);
      expect(snap.slides.events.total_attended).toBe(1);
    });

    it('Der Konfirmationstermin schneidet den Zeitraum NICHT mehr ab', async () => {
      // GENAU DER PRODUKTIONSFALL (Org 1, Jahrgang 12, gemessen 07.09.2026):
      // Konfirmation im kommenden Mai, die Abzeichen liegen im Sommer davor.
      // Die alte Regel setzte start = (Jahr des Termins - 1) + '-09-01' und
      // ende = Termin -- alles davor fiel heraus, die Abzeichen-Seite zeigte
      // eine glatte 0.
      await db.query(
        `UPDATE konfi_profiles SET created_at = $1::timestamptz
          WHERE user_id = $2 AND jahrgang_id = $3`,
        [`${JAHR - 1}-05-01 08:00:00+02`, USERS.konfi1.id, JAHRGAENGE.jahrgang1.id]
      );
      const konf = await termin('Konfirmation', `${JAHR + 1}-05-10`);
      await db.query('UPDATE events SET is_konfirmation = true WHERE id = $1', [konf]);

      // Ein Termin aus dem Sommer VOR dem alten Fenster (1.9.JAHR .. 10.5.JAHR+1).
      const frueher = await termin('Sommerfreizeit weit davor', `${JAHR - 1}-07-15`);
      await buchung(USERS.konfi1.id, frueher);

      const snap = await snapshotVonKonfi1();
      // Der Zeitraum beginnt an der Konfi-Zeit, nicht am 1.9. vor dem Termin.
      expect(snap.slides.zeitraum.start).toBe(`${JAHR - 1}-05-01`);
      // Und er endet heute, nicht am Konfirmationstermin in der Zukunft.
      expect(snap.slides.zeitraum.ende).toBe(heuteIso());
      // Der Termin bleibt als ANGABE erhalten -- die Konfirmations-Seite
      // zeigt ihn weiterhin.
      expect(snap.slides.zeitraum.konfirmation).toBe(`${JAHR + 1}-05-10`);
      // Und das Entscheidende: der frueher abgeschnittene Termin zaehlt mit.
      expect(snap.slides.events.total_attended).toBe(1);
    });

    it('Ein Abzeichen vor dem Konfirmations-Fenster faellt nicht mehr heraus', async () => {
      // Dieselbe Lage wie oben, aber auf der Seite, an der es in Produktion
      // auffiel: 20 Abzeichen aus dem Sommer, Abzeichen-Seite zeigte 0.
      await db.query(
        `UPDATE konfi_profiles SET created_at = $1::timestamptz
          WHERE user_id = $2 AND jahrgang_id = $3`,
        [`${JAHR - 1}-05-01 08:00:00+02`, USERS.konfi1.id, JAHRGAENGE.jahrgang1.id]
      );
      const konf = await termin('Konfirmation', `${JAHR + 1}-05-10`);
      await db.query('UPDATE events SET is_konfirmation = true WHERE id = $1', [konf]);

      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [USERS.konfi1.id, BADGES.streak.id, ORGS.testGemeinde.id, `${JAHR - 1}-07-20 10:00:00`]
      );

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.badges.total_earned).toBe(1);
    });

    // ------------------------------------------------------------
    // ABZEICHEN SIND EIN BESTAND, KEIN EREIGNIS (Befund 06.09.2026).
    //
    // Gemessen in der Demo-Gemeinde (Org 4): 146 von 162 Verleihungen
    // tragen ein Datum in der Zukunft. Mit Zeitfilter blieb bei allen 13
    // Rueckblicken genau eins uebrig -- total_earned = 1, obwohl die Leute
    // 8 bis 19 Abzeichen hatten.
    // ------------------------------------------------------------
    it('Abzeichen ausserhalb des Zeitraums zaehlen mit -- vorher, nachher, mittendrin', async () => {
      async function abzeichen(badgeId, datum) {
        await db.query(
          `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
           VALUES ($1, $2, $3, $4::timestamptz)`,
          [USERS.konfi1.id, badgeId, ORGS.testGemeinde.id, `${datum} 10:00:00`]
        );
      }
      await abzeichen(BADGES.streak.id, VOR_ZEITRAUM);
      await abzeichen(BADGES.categoryBased.id, IM_ZEITRAUM);
      await abzeichen(BADGES.timeBased.id, NACH_ZEITRAUM);
      // Und der Fall aus Org 4: ein Datum weit in der Zukunft.
      await abzeichen(BADGES.yearly.id, `${JAHR + 2}-03-01`);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.badges.total_earned).toBe(4);
      expect(snap.slides.badges.badges.map(b => b.name).sort()).toEqual([
        BADGES.categoryBased.name,
        BADGES.streak.name,
        BADGES.timeBased.name,
        BADGES.yearly.name
      ].sort());
    });

    // ------------------------------------------------------------
    // DER NENNER: dieselben Grenzen wie die Abzeichen-Ansicht der App
    // (routes/badges.js) -- nur aktive, nur die der eigenen Rolle.
    // Gemessen Org 1: 56 gesamt, 45 aktiv+konfi. Org 4: 31 gegen 27.
    // ------------------------------------------------------------
    it('Inaktive und Teamer-Abzeichen zaehlen nicht in total_available', async () => {
      // Der Seed legt vier Abzeichen fuer Org 1 an, alle aktiv und (per
      // Spalten-Default) fuer Konfis.
      const vorher = await snapshotVonKonfi1();
      expect(vorher.slides.badges.total_available).toBe(4);

      // Eins stillgelegt, eins auf die Teamer-Rolle umgestellt.
      await db.query('UPDATE custom_badges SET is_active = false WHERE id = $1', [BADGES.streak.id]);
      await db.query("UPDATE custom_badges SET target_role = 'teamer' WHERE id = $1", [BADGES.categoryBased.id]);
      // Ein verstecktes bleibt drin -- es ist erreichbar, nur nicht sichtbar.
      await db.query('UPDATE custom_badges SET is_hidden = true WHERE id = $1', [BADGES.timeBased.id]);

      const nachher = await snapshotVonKonfi1();
      expect(nachher.slides.badges.total_available).toBe(2);
    });

    it('Alle Abzeichen verdient: verdient und verfuegbar sind dieselbe Zahl', async () => {
      // Die Stufe "Alle. Wirklich alle." braucht total_earned >= total_available.
      // Mit ungefiltertem Nenner (56 statt 45) war sie unerreichbar.
      await db.query('UPDATE custom_badges SET is_active = false WHERE id = $1', [BADGES.yearly.id]);
      for (const b of [BADGES.streak, BADGES.categoryBased, BADGES.timeBased]) {
        await db.query(
          `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
           VALUES ($1, $2, $3, $4::timestamptz)`,
          [USERS.konfi1.id, b.id, ORGS.testGemeinde.id, `${JAHR + 2}-03-01 10:00:00`]
        );
      }

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.badges.total_available).toBe(3);
      expect(snap.slides.badges.total_earned).toBe(3);
    });

    // ------------------------------------------------------------
    // Warteliste-Held:in (Migration 145).
    // ------------------------------------------------------------
    it('Nur ein echtes Nachruecken zaehlt -- NULL heisst unbekannt, nicht nein', async () => {
      const nachgerueckt = await termin('Nachgerueckt', IM_ZEITRAUM);
      const normal = await termin('Von Anfang an', IM_ZEITRAUM);
      const alt = await termin('Bestandsbuchung', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, nachgerueckt);
      await buchung(USERS.konfi1.id, normal);
      await buchung(USERS.konfi1.id, alt);

      // Eine Buchung ist nachgerueckt, eine ausdruecklich NICHT, eine
      // traegt NULL wie jede Bestandszeile vor der Migration.
      await db.query(
        `UPDATE event_bookings SET war_auf_warteliste = true WHERE event_id = $1`, [nachgerueckt]);
      await db.query(
        `UPDATE event_bookings SET war_auf_warteliste = false WHERE event_id = $1`, [normal]);
      // 'alt' bleibt NULL.

      const snap = await snapshotVonKonfi1();
      // Genau EINE -- weder die ausdrueckliche false noch die unbekannte NULL.
      expect(snap.slides.warteliste.nachgerueckt).toBe(1);
      expect(snap.kacheln).toContain('warteliste');
    });

    it('Ohne Nachruecken fehlt die Seite', async () => {
      const t = await termin('Ganz normal', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, t);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.warteliste.nachgerueckt).toBe(0);
      expect(snap.kacheln).not.toContain('warteliste');
    });

    // ------------------------------------------------------------
    // EINE FEHLENDE SPALTE DARF DEN RUECKBLICK NICHT SPRENGEN.
    //
    // BEFUND 07.09.2026, gemessen: Produktion stand auf Migration 144,
    // event_bookings.war_auf_warteliste existierte dort nicht. Die Abfrage
    // in generateKonfiSnapshot hatte kein try/catch -- sie waere fuer JEDE
    // Konfi mit "column does not exist" abgebrochen.
    //
    // Dass die Migrationen beim Start automatisch laufen, rettet das NICHT:
    // runMigrations faengt Fehler ab und laesst den Server weiterlaufen
    // (database.js, "Server laeuft weiter"). Schlaegt 145 fehl, startet das
    // Backend trotzdem -- und der Rueckblick faellt still komplett aus.
    //
    // Diese Tests stellen den Fall WIRKLICH her (Spalte droppen), statt ihn
    // zu mocken: Ein Mock haette nicht gezeigt, ob der Snapshot danach
    // durchlaeuft.
    // ------------------------------------------------------------
    describe('Fehlende Spalten aus neuen Migrationen', () => {
      // Die Spalten kommen nach jedem Test zurueck. truncateAll leert nur
      // Zeilen, es stellt kein Schema wieder her -- ohne dieses afterEach
      // liefe der Rest der Datei gegen eine kaputte Test-DB.
      afterEach(async () => {
        await db.query(
          'ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS war_auf_warteliste BOOLEAN'
        );
        await db.query(
          `ALTER TABLE challenge_submissions
             ADD COLUMN IF NOT EXISTS approved_by INTEGER,
             ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE`
        );
      });

      it('Ohne war_auf_warteliste (Migration 145) laeuft der Snapshot durch und die Seite fehlt', async () => {
        const t = await termin('Ganz normal', IM_ZEITRAUM);
        await buchung(USERS.konfi1.id, t);

        await db.query('ALTER TABLE event_bookings DROP COLUMN war_auf_warteliste');
        // Wirklich weg, nicht nur leer.
        const { rows: weg } = await db.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'event_bookings' AND column_name = 'war_auf_warteliste'`
        );
        expect(weg).toHaveLength(0);

        const snap = await snapshotVonKonfi1();

        // Der Rueckblick entsteht vollstaendig -- das ist der Kern.
        expect(snap.slides.events.total_attended).toBe(1);
        expect(snap.slides.punkte.total).toBeGreaterThanOrEqual(0);
        // Die Warteliste-Zahl faellt auf 0 zurueck, nicht auf undefined.
        expect(snap.slides.warteliste.nachgerueckt).toBe(0);
        // Und die Seite erscheint deshalb gar nicht -- das richtige Verhalten.
        expect(snap.kacheln).not.toContain('warteliste');
        // Die tragenden Seiten sind da.
        expect(snap.kacheln).toContain('intro');
        expect(snap.kacheln).toContain('abschluss');
      });

      it('Ohne approved_by (Migration 146) laeuft der Teamer-Snapshot durch und die Seite fehlt', async () => {
        await db.query('ALTER TABLE challenge_submissions DROP COLUMN approved_by');
        const { rows: weg } = await db.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'challenge_submissions' AND column_name = 'approved_by'`
        );
        expect(weg).toHaveLength(0);

        const gen = await request(app)
          .post('/api/wrapped/generate-teamer')
          .set('Authorization', `Bearer ${orgAdminToken}`);
        expect(gen.status).toBe(200);

        const { rows } = await db.query(
          `SELECT data FROM wrapped_snapshots
            WHERE user_id = $1 AND wrapped_type = 'teamer'
            ORDER BY computed_at DESC, id DESC LIMIT 1`,
          [USERS.teamer1.id]
        );
        expect(rows).toHaveLength(1);
        const snap = rows[0].data;

        expect(snap.slides.moderation.freigegeben).toBe(0);
        expect(snap.kacheln).not.toContain('teamer-moderation');
        expect(snap.kacheln).toContain('teamer-intro');
      });
    });

    // ------------------------------------------------------------
    // Zeit-/Rhythmus-Seiten: Spanne und Wochentag.
    // ------------------------------------------------------------
    it('Der lange Atem misst die Spanne zwischen erstem und letztem Termin', async () => {
      // 14.09. bis 12.04. -- 210 Tage.
      const daten = [`${JAHR - 1}-09-14`, `${JAHR - 1}-12-01`, `${JAHR}-01-10`,
                     `${JAHR}-02-20`, `${JAHR}-04-12`];
      for (const d of daten) await buchung(USERS.konfi1.id, await termin(`T ${d}`, d));

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.langer_atem.termine).toBe(5);
      expect(snap.slides.langer_atem.erster).toBe(`${JAHR - 1}-09-14`);
      expect(snap.slides.langer_atem.letzter).toBe(`${JAHR}-04-12`);
      expect(snap.slides.langer_atem.tage).toBe(210);
    });

    it('Der Wochentag kommt aus dem Berliner Kalendertag', async () => {
      // Vier Termine an Montagen, jeweils kurz nach Mitternacht Berliner
      // Zeit -- also genau die Zeitstempel, bei denen sich UTC und Berlin
      // im Kalendertag unterscheiden.
      const montagsNaechte = [`${JAHR - 1}-11-17`, `${JAHR - 1}-11-24`,
                              `${JAHR - 1}-12-01`, `${JAHR - 1}-12-08`];
      for (const d of montagsNaechte) {
        const { rows: [e] } = await db.query(
          `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
           VALUES ($1, $2::timestamptz, $3, false, 0, 'gemeinde', 1) RETURNING id`,
          [`Nachtcafe ${d}`, `${d} 00:30:00+01`, ORGS.testGemeinde.id]
        );
        await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
          [e.id, JAHRGAENGE.jahrgang1.id]);
        await buchung(USERS.konfi1.id, e.id);
      }

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.wochentag.tag).toBe(1);
      expect(snap.slides.wochentag.name).toBe('Montag');
      expect(snap.slides.wochentag.anzahl).toBe(4);
    });

    it('AT TIME ZONE ist die Absicherung gegen eine Datenbank ausserhalb Berlins', async () => {
      // WARUM DIESER TEST DIREKT AUF SQL GEHT statt ueber den Snapshot:
      //
      // GEMESSEN am 07.09.2026: events.event_date ist timestamptz, und
      // Test- WIE Produktionsdatenbank laufen auf Europe/Berlin
      // (docker-compose.test.yml, deploy/compose.konfi_quest.yml). Dort
      // liefert EXTRACT(DOW ...) bereits den Berliner Wochentag -- die
      // Umrechnung ist wirkungsgleich und ueber den Snapshot NICHT
      // pruefbar. Ein Test, der es dennoch behauptet, waere gruen, ohne
      // etwas zu zeigen (erst versucht, dann verworfen: ALTER DATABASE
      // erreicht bestehende Pool-Verbindungen nicht).
      //
      // Die Absicherung gilt einer Datenbank, die NICHT auf Berlin steht.
      // Genau diese Lage stellt die Abfrage hier her -- und misst beide
      // Wege nebeneinander.
      const client = await db.getClient();
      try {
        await client.query("SET TIME ZONE 'UTC'");
        const { rows: [r] } = await client.query(
          `SELECT EXTRACT(DOW FROM $1::timestamptz)::int AS ohne_umrechnung,
                  EXTRACT(DOW FROM ($1::timestamptz AT TIME ZONE 'Europe/Berlin'))::int AS mit_umrechnung`,
          [`${JAHR - 1}-11-17 00:30:00+01`]
        );
        // Ohne Umrechnung: Sonntag (0) -- der Termin rutscht auf den Vortag.
        expect(r.ohne_umrechnung).toBe(0);
        // Mit Umrechnung: Montag (1) -- der Berliner Kalendertag.
        expect(r.mit_umrechnung).toBe(1);
      } finally {
        // Die Zone WIEDER ZURUECKSETZEN, bevor die Verbindung in den Pool
        // zurueckgeht: SET TIME ZONE gilt fuer die Sitzung, und eine
        // ausgeliehene Verbindung wird spaeter von anderen Tests
        // weiterbenutzt. Ohne das Zuruecksetzen laeuft irgendein spaeterer
        // Test unbemerkt in UTC.
        await client.query("SET TIME ZONE 'Europe/Berlin'").catch(() => {});
        client.release();
      }
    });

    it('Die Medienarten zaehlen jede Art nur einmal', async () => {
      const { rows: [ch] } = await db.query(
        `INSERT INTO challenges
           (title, description, badge_name, organization_id, created_by, starts_at, ends_at)
         VALUES ('Vielfalt', 'Zeig es', 'Bunt', $1, $2,
                 NOW() - INTERVAL '1 year', NOW() + INTERVAL '1 year')
         RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      const beitrag = (art) => db.query(
        `INSERT INTO challenge_submissions
           (challenge_id, user_id, organization_id, media_type, moderation_status, created_at)
         VALUES ($1, $2, $3, $4, 'approved', $5::timestamptz)`,
        [ch.id, USERS.konfi1.id, ORGS.testGemeinde.id, art, `${IM_ZEITRAUM} 10:00:00`]
      );
      await beitrag('text');
      await beitrag('text');
      await beitrag('photo');

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.medienarten).toEqual(['photo', 'text']);
      expect(snap.kacheln).toContain('vielseitig');
    });

    // ------------------------------------------------------------
    // DER ZEITRAUM DES KONFI-RUECKBLICKS -- vom Beginn der Konfi-Zeit
    // bis heute, und nichts anderes.
    //
    // SIMONS REGEL (07.09.2026), woertlich: "wir lassen das mit dem Datum.
    // Wir machen einfach immer Konfi bis jetzt von Beginn." Die frei
    // setzbaren Datumsfelder sind damit entfallen. Was den Zeitraum noch
    // verschiebt, ist allein der Beginn der Konfi-Zeit.
    // ------------------------------------------------------------
    it('Der Beginn der Konfi-Zeit entscheidet, welche Termine zaehlen', async () => {
      const drin = await termin('Nach dem Beginn', IM_ZEITRAUM);
      const draussen = await termin('Vor dem Beginn', `${JAHR - 2}-06-15`);
      await buchung(USERS.konfi1.id, drin);
      await buchung(USERS.konfi1.id, draussen);

      // Beginn NACH dem frueheren Termin: nur der eine zaehlt.
      const spaet = await snapshotVonKonfi1AbBeginn(`${JAHR - 1}-09-01`);
      expect(spaet.slides.events.total_attended).toBe(1);

      // Beginn DAVOR: beide zaehlen. Genau das war vorher unmoeglich --
      // das alte Ein-Jahres-Fenster schnitt den frueheren immer ab.
      const frueh = await snapshotVonKonfi1AbBeginn(`${JAHR - 3}-09-01`);
      expect(frueh.slides.events.total_attended).toBe(2);
    });

    it('Der Beginn der Konfi-Zeit schlaegt bis in die Challenge-Zahlen durch', async () => {
      // Die Challenge-Queries filtern laengst -- aber auf den Zeitraum, den
      // die Generierung kennt. Bekaeme sie den falschen, zaehlten auch sie
      // falsch. Der Test haelt die Kette fest, nicht nur die Query.
      const { rows: [ch] } = await db.query(
        `INSERT INTO challenges
           (title, description, badge_name, organization_id, created_by,
            starts_at, ends_at)
         VALUES ('Mutprobe', 'Trau dich', 'Mutig', $1, $2,
                 NOW() - INTERVAL '4 years', NOW() + INTERVAL '1 year')
         RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      const beitrag = async (datum) => db.query(
        `INSERT INTO challenge_submissions
           (challenge_id, user_id, organization_id, media_type, moderation_status, created_at)
         VALUES ($1, $2, $3, 'text', 'approved', $4::timestamptz)`,
        [ch.id, USERS.konfi1.id, ORGS.testGemeinde.id, `${datum} 10:00:00`]
      );
      await beitrag(IM_ZEITRAUM);              // 15.11. im Vorjahr
      await beitrag(`${JAHR - 2}-06-15`);      // vor dem spaeteren Beginn

      const spaet = await snapshotVonKonfi1AbBeginn(`${JAHR - 1}-09-01`);
      expect(spaet.slides.challenges.beitraege).toBe(1);
      expect(spaet.slides.challenge_momente).toHaveLength(1);

      const frueh = await snapshotVonKonfi1AbBeginn(`${JAHR - 3}-09-01`);
      expect(frueh.slides.challenges.beitraege).toBe(2);
      expect(frueh.slides.challenge_momente).toHaveLength(2);
    });

    it('Bonuspunkte zaehlen nur im Zeitraum', async () => {
      // Diese Query war die einzige Ereignis-Query ohne Zeitfilter: Sie
      // summierte alle Bonuspunkte seit Kontobeginn. Der Seed legt bereits
      // 3 Punkte mit completed_date = heute an.
      await db.query('DELETE FROM bonus_points');
      await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, completed_date)
         VALUES ($1, 5, 'gemeinde', 'Im Zeitraum', $2, $3, $4::date)`,
        [USERS.konfi1.id, USERS.admin1.id, ORGS.testGemeinde.id, IM_ZEITRAUM]
      );
      await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, completed_date)
         VALUES ($1, 7, 'gemeinde', 'Im Vorjahr', $2, $3, $4::date)`,
        [USERS.konfi1.id, USERS.admin1.id, ORGS.testGemeinde.id, VOR_ZEITRAUM]
      );

      const snap = await snapshotVonKonfi1AbBeginn(KONFI_BEGINN);
      // Nur die 5 aus dem Zeitraum, nicht 12.
      expect(snap.slides.punkte.bonus).toBe(5);
    });

    it('Ohne Angabe laeuft der Zeitraum vom Beginn der Konfi-Zeit bis heute', async () => {
      // Simons Regel (07.09.2026). Vorher stand hier das Fenster
      // 1.9.(JAHR-1) .. 31.8.(JAHR) -- es schnitt jede Konfi-Zeit ab, die
      // laenger als ein Jahr war.
      await db.query(
        `UPDATE konfi_profiles SET created_at = $1::timestamptz
          WHERE user_id = $2 AND jahrgang_id = $3`,
        [`${JAHR - 2}-09-01 08:00:00+02`, USERS.konfi1.id, JAHRGAENGE.jahrgang1.id]
      );
      const heute = new Date();
      const heuteStr = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.zeitraum.start).toBe(`${JAHR - 2}-09-01`);
      expect(snap.slides.zeitraum.ende).toBe(heuteStr);
    });

    it('Eine Konfi-Zeit ueber zwei Jahre wird vollstaendig erfasst', async () => {
      // Simon: "den ganzen zeitraum, bei manchen sind das auch zwei jahre."
      await db.query(
        `UPDATE konfi_profiles SET created_at = $1::timestamptz
          WHERE user_id = $2 AND jahrgang_id = $3`,
        [`${JAHR - 2}-09-01 08:00:00+02`, USERS.konfi1.id, JAHRGAENGE.jahrgang1.id]
      );
      // Je ein Termin im ersten und im zweiten Konfi-Jahr.
      const jahr1 = await termin('Erstes Konfi-Jahr', `${JAHR - 2}-11-15`);
      const jahr2 = await termin('Zweites Konfi-Jahr', `${JAHR - 1}-11-15`);
      await buchung(USERS.konfi1.id, jahr1);
      await buchung(USERS.konfi1.id, jahr2);

      const snap = await snapshotVonKonfi1();
      // Beide. Das alte Ein-Jahres-Fenster haette nur einen gezaehlt.
      expect(snap.slides.events.total_attended).toBe(2);
    });

    it('Der Zeitraum der Ausgabe und der des Snapshots sind derselbe', async () => {
      // Sonst staende in der Verwaltung eine Spanne, unter der Zahlen aus
      // einer anderen liegen. Der Konfi-Rueckblick beginnt je Person am
      // eigenen Eintritt; die AUSGABE nennt den fruehesten im Jahrgang.
      await db.query(
        `UPDATE konfi_profiles SET created_at = $1::timestamptz
          WHERE user_id = $2 AND jahrgang_id = $3`,
        [`${JAHR - 2}-09-01 08:00:00+02`, USERS.konfi1.id, JAHRGAENGE.jahrgang1.id]
      );
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);

      const { rows: [ausgabe] } = await db.query(
        `SELECT a.zeitraum_start, a.zeitraum_ende, s.data
           FROM wrapped_snapshots s
           JOIN wrapped_ausgaben a ON a.id = s.ausgabe_id
          WHERE s.user_id = $1 AND s.wrapped_type = 'konfi'
          ORDER BY s.computed_at DESC, s.id DESC LIMIT 1`,
        [USERS.konfi1.id]
      );
      // Die DATE-Spalte kommt als JS-Date in Ortszeit zurueck.
      // toISOString() rechnete sie nach UTC und machte aus dem 1.10. den
      // 30.9. -- dieselbe Falle, gegen die berechneZeitraum() sich wehrt.
      const iso = (d) => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };
      // DAS ENDE ist fuer alle dasselbe: der Tag der Erzeugung.
      expect(iso(ausgabe.zeitraum_ende)).toBe(ausgabe.data.slides.zeitraum.ende);
      // DER ANFANG der Ausgabe ist der FRUEHESTE Beginn im Jahrgang -- die
      // Spanne, die sie insgesamt abdeckt. Der einzelne Rueckblick beginnt
      // am eigenen Eintritt und kann deshalb spaeter liegen, nie frueher.
      expect(iso(ausgabe.zeitraum_start) <= ausgabe.data.slides.zeitraum.start).toBe(true);
      // konfi1s Beginn steht oben auf dem 1.9. -- genau das muss im
      // Snapshot stehen, nicht der eines anderen Konfis.
      expect(ausgabe.data.slides.zeitraum.start).toBe(`${JAHR - 2}-09-01`);
    });

    // ------------------------------------------------------------
    // Mandantengrenze: die Absagen-Query hatte keinen Org-Filter.
    // ------------------------------------------------------------
    it('Die Absagen-Query liefert nichts aus einer fremden Organisation', async () => {
      // konfi1 gehoert zu Org 1, bekommt aber zusaetzlich eine abgesagte
      // Buchung in Org 2 -- genau die Konstellation eines Kontos, das in
      // mehreren Gemeinden auftaucht.
      const eigen = await termin('Eigene Org abgesagt', IM_ZEITRAUM);
      const fremd = await termin('Fremde Org abgesagt', IM_ZEITRAUM, {
        orgId: ORGS.andereGemeinde.id,
        jahrgangId: JAHRGAENGE.jahrgang2.id
      });
      await buchung(USERS.konfi1.id, eigen, { status: 'cancelled' });
      await buchung(USERS.konfi1.id, fremd, { status: 'cancelled', orgId: ORGS.andereGemeinde.id });

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.abgesagt).toBe(1);
    });

    it('Auch die Terminzahl zaehlt keine fremde Organisation mit', async () => {
      const eigen = await termin('Eigene Org', IM_ZEITRAUM);
      const fremd = await termin('Fremde Org', IM_ZEITRAUM, {
        orgId: ORGS.andereGemeinde.id,
        jahrgangId: JAHRGAENGE.jahrgang2.id
      });
      await buchung(USERS.konfi1.id, eigen);
      await buchung(USERS.konfi1.id, fremd, { orgId: ORGS.andereGemeinde.id });

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.total_attended).toBe(1);
    });
  });

  // ================================================================
  // PERSOENLICHE HIGHLIGHTS (Snapshot-Version 3, 01.09.2026)
  // ================================================================
  // Simons Wunsch: Der Rueckblick soll sich von Konfi zu Konfi dynamisch
  // unterscheiden. Gewaehlt wird nicht mehr der groesste Rohwert, sondern
  // das, worin jemand im Vergleich zum eigenen Jahrgang heraussticht.
  describe('Persoenliche Highlights (Version 3)', () => {
    const JAHR = new Date().getFullYear();
    const IM_ZEITRAUM = `${JAHR - 1}-11-15`;
    const VOR_ZEITRAUM = `${JAHR - 1}-06-15`;

    async function termin(name, datum, opts = {}) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, $2::timestamp, $3, false, 0, $4, 1) RETURNING id`,
        [name, `${datum} 10:00:00`, opts.orgId || ORGS.testGemeinde.id, opts.pointType || 'gemeinde']
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, opts.jahrgangId || JAHRGAENGE.jahrgang1.id]);
      return e.id;
    }

    async function buchung(userId, eventId, opts = {}) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, booking_date)
         VALUES ($1, $2, $3, 'confirmed', NOW())`,
        [userId, eventId, opts.orgId || ORGS.testGemeinde.id]
      );
    }

    /** Chat-Nachricht in Raum 1 (Jahrgangs-Chat Org 1), Datum frei waehlbar. */
    async function nachricht(userId, datum, opts = {}) {
      const { rows: [m] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at, deleted_at)
         VALUES ($1, $2, 'konfi', 'text', $3, $4::timestamp, $5) RETURNING id`,
        [opts.roomId || 1, userId, opts.content || 'Hallo', `${datum} 12:00:00`,
         opts.geloescht ? `${datum} 13:00:00` : null]
      );
      return m.id;
    }

    async function reaktion(messageId, userId, datum, opts = {}) {
      await db.query(
        `INSERT INTO chat_message_reactions (message_id, user_id, user_type, emoji, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamp)`,
        [messageId, userId, opts.userType || 'konfi', opts.emoji || ':like:', `${datum} 12:30:00`]
      );
    }

    async function challenge(title) {
      const { rows: [c] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, challenge_type, badge_name, badge_icon, starts_at, ends_at, is_draft)
         VALUES ($1, $2, 'Testbeschreibung', 'frei', $2, 'flag', NOW() - INTERVAL '1 year', NOW() + INTERVAL '1 year', false)
         RETURNING id`,
        [ORGS.testGemeinde.id, title]
      );
      return c.id;
    }

    async function beitrag(userId, challengeId, datum, opts = {}) {
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status, created_at)
         VALUES ($1, $2, $3, 'text', 'Mein Beitrag', $4, $5::timestamp)`,
        [challengeId, userId, ORGS.testGemeinde.id, opts.status || 'approved', `${datum} 15:00:00`]
      );
    }

    async function abmeldung(userId, eventId, datum) {
      await db.query(
        `INSERT INTO event_unregistrations (user_id, event_id, reason, unregistered_at, organization_id)
         VALUES ($1, $2, 'Testgrund', $3::timestamp, $4)`,
        [userId, eventId, `${datum} 09:00:00`, ORGS.testGemeinde.id]
      );
    }

    /**
     * Erzeugt Wrapped fuer Jahrgang 1 und gibt den Snapshot eines Konfis
     * zurueck. `beginn` setzt den Beginn der Konfi-Zeit -- seit dem
     * 07.09.2026 das einzige, was den Zeitraum noch verschiebt (die
     * Datumsfelder sind entfallen).
     */
    async function snapshotVon(userId, beginn = null) {
      if (beginn) {
        await db.query(
          'UPDATE konfi_profiles SET created_at = $1::timestamp WHERE user_id = $2',
          [`${beginn} 00:00:00`, userId]
        );
      }
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [userId]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    /** Der Beginn der Konfi-Zeit fuer die Zeitraum-Tests. */
    const KONFI_BEGINN = `${JAHR - 1}-09-01`;

    beforeEach(async () => {
      // Bekannte Datenlage: Seed-Termine raus (wie im Zahlen-describe).
      await db.query('DELETE FROM event_bookings');
      await db.query('DELETE FROM event_jahrgang_assignments');
      await db.query('DELETE FROM events');
    });

    // ------------------------------------------------------------
    // chat_star
    // ------------------------------------------------------------
    it('Wer den Jahrgangs-Chat traegt, wird chat_star -- wer kaum schreibt, nicht', async () => {
      for (let i = 0; i < 25; i++) await nachricht(USERS.konfi1.id, IM_ZEITRAUM);
      for (let i = 0; i < 2; i++) await nachricht(USERS.konfi2.id, IM_ZEITRAUM);

      const snap1 = await snapshotVon(USERS.konfi1.id);
      expect(snap1.highlight_type).toBe('chat_star');
      expect(snap1.slides.chat.nachrichten_gesendet).toBe(25);
      expect(snap1.slides.highlight.type).toBe('chat_star');
      expect(snap1.slides.highlight.wert).toBe(25);
      // Jahrgangsschnitt: (25 + 2) / 2 Konfis = 13.5 -- anonym, keine Namen.
      expect(snap1.slides.highlight.jahrgangsschnitt).toBe(13.5);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;
      // 2 Nachrichten sind kein Highlight (Mindestwert 20) -> Default.
      expect(snap2.highlight_type).toBe('events_held');
      expect(snap2.slides.chat.nachrichten_gesendet).toBe(2);
    });

    it('Geloeschte Nachrichten zaehlen nicht, fremde Organisationen auch nicht', async () => {
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM);
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM, { geloescht: true });
      // Raum 4 gehoert Org 2 -- die Nachricht darf nicht mitzaehlen.
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM, { roomId: 4 });

      const snap = await snapshotVon(USERS.konfi1.id);
      expect(snap.slides.chat.nachrichten_gesendet).toBe(1);
    });

    // ------------------------------------------------------------
    // reaktions_magnet
    // ------------------------------------------------------------
    it('Viel Zustimmung BEKOMMEN macht den reaktions_magnet -- eigene Reaktionen zaehlen nicht', async () => {
      // konfi1 schreibt 6 Nachrichten, konfi2 reagiert auf jede.
      const ids = [];
      for (let i = 0; i < 6; i++) ids.push(await nachricht(USERS.konfi1.id, IM_ZEITRAUM));
      for (const id of ids) await reaktion(id, USERS.konfi2.id, IM_ZEITRAUM);
      // Selbst-Reaktion auf die eigene Nachricht: zaehlt NICHT als bekommen.
      await reaktion(ids[0], USERS.konfi1.id, IM_ZEITRAUM, { emoji: ':herz:' });

      const snap1 = await snapshotVon(USERS.konfi1.id);
      expect(snap1.highlight_type).toBe('reaktions_magnet');
      expect(snap1.slides.chat.reaktionen_bekommen).toBe(6);
      expect(snap1.slides.chat.reaktionen_gegeben).toBe(1);
      expect(snap1.slides.highlight.wert).toBe(6);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;
      expect(snap2.highlight_type).not.toBe('reaktions_magnet');
      expect(snap2.slides.chat.reaktionen_bekommen).toBe(0);
      expect(snap2.slides.chat.reaktionen_gegeben).toBe(6);
    });

    // ------------------------------------------------------------
    // challenge_fan
    // ------------------------------------------------------------
    it('Viele Challenge-Beitraege machen den challenge_fan, samt Top-Challenge -- versteckte zaehlen nicht', async () => {
      const foto = await challenge('Foto-Challenge');
      const mut = await challenge('Mut-Challenge');
      await beitrag(USERS.konfi1.id, foto, IM_ZEITRAUM);
      await beitrag(USERS.konfi1.id, foto, IM_ZEITRAUM);
      await beitrag(USERS.konfi1.id, mut, IM_ZEITRAUM);
      // Versteckter Beitrag: von der Moderation aus dem Rueckblick genommen.
      await beitrag(USERS.konfi1.id, mut, IM_ZEITRAUM, { status: 'hidden' });

      const snap1 = await snapshotVon(USERS.konfi1.id);
      expect(snap1.highlight_type).toBe('challenge_fan');
      expect(snap1.slides.challenges.beitraege).toBe(3);
      expect(snap1.slides.challenges.top_challenge.title).toBe('Foto-Challenge');
      expect(snap1.slides.challenges.top_challenge.count).toBe(2);
      expect(snap1.slides.highlight.wert).toBe(3);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;
      expect(snap2.highlight_type).toBe('events_held');
      expect(snap2.slides.challenges.beitraege).toBe(0);
      expect(snap2.slides.challenges.top_challenge).toBe(null);
    });

    // ------------------------------------------------------------
    // verlaesslich -- und Simons Kernszenario: zwei Konfis mit
    // aehnlichem Verhalten bekommen NACHWEISLICH verschiedene Seiten.
    // ------------------------------------------------------------
    it('Nie abgesagt bei genug Buchungen wird verlaesslich -- wer abgesagt hat, bekommt ein anderes Highlight', async () => {
      // Beide buchen dieselben 6 Termine; konfi2 meldet sich zweimal ab.
      const termine = [];
      for (let i = 0; i < 6; i++) termine.push(await termin(`Termin ${i}`, IM_ZEITRAUM));
      for (const t of termine) {
        await buchung(USERS.konfi1.id, t);
        await buchung(USERS.konfi2.id, t);
      }
      await abmeldung(USERS.konfi2.id, termine[0], IM_ZEITRAUM);
      await abmeldung(USERS.konfi2.id, termine[1], IM_ZEITRAUM);

      const snap1 = await snapshotVon(USERS.konfi1.id);
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;

      // konfi1: 0 Absagen bei 6 Buchungen -> Fels in der Brandung.
      expect(snap1.highlight_type).toBe('verlaesslich');
      expect(snap1.slides.verlaesslichkeit.nie_abgesagt).toBe(true);
      expect(snap1.slides.verlaesslichkeit.abmeldungen).toBe(0);

      // konfi2: KEIN beschaemendes Absage-Highlight -- die Absagen stehen
      // nur neutral im Snapshot, das Highlight ist das naechstbeste.
      expect(snap2.highlight_type).toBe('events_held');
      expect(snap2.slides.verlaesslichkeit.nie_abgesagt).toBe(false);
      expect(snap2.slides.verlaesslichkeit.abmeldungen).toBe(2);

      // Der eigentliche Test fuer Simons Wunsch: zwei Konfis, fast gleiches
      // Verhalten, nachweislich verschiedene Highlights.
      expect(snap1.highlight_type).not.toBe(snap2.highlight_type);
    });

    it('Wenige Buchungen sind keine Verlaesslichkeits-Aussage', async () => {
      // 2 Buchungen ohne Absage: "nie abgesagt" waere eine Aussage ueber
      // fehlende Gelegenheit, nicht ueber die Person.
      const a = await termin('Termin A', IM_ZEITRAUM);
      const b = await termin('Termin B', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, a);
      await buchung(USERS.konfi1.id, b);

      const snap = await snapshotVon(USERS.konfi1.id);
      expect(snap.slides.verlaesslichkeit.nie_abgesagt).toBe(false);
      expect(snap.highlight_type).not.toBe('verlaesslich');
    });

    // ------------------------------------------------------------
    // Zeitraum-Grenze
    // ------------------------------------------------------------
    it('Chat-Nachrichten und Abmeldungen VOR dem Zeitraum zaehlen nicht', async () => {
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM);
      await nachricht(USERS.konfi1.id, VOR_ZEITRAUM);
      await nachricht(USERS.konfi1.id, VOR_ZEITRAUM);

      const termine = [];
      for (let i = 0; i < 5; i++) termine.push(await termin(`Termin ${i}`, IM_ZEITRAUM));
      for (const t of termine) await buchung(USERS.konfi1.id, t);
      // Abmeldung aus dem VORIGEN Konfi-Jahr: gehoert nicht in diesen Rueckblick.
      await abmeldung(USERS.konfi1.id, termine[0], VOR_ZEITRAUM);

      // Der Rueckblick laeuft vom Beginn der Konfi-Zeit bis heute -- was
      // davor liegt, gehoert nicht dazu.
      const snap = await snapshotVon(USERS.konfi1.id, KONFI_BEGINN);
      expect(snap.slides.chat.nachrichten_gesendet).toBe(1);
      expect(snap.slides.verlaesslichkeit.abmeldungen).toBe(0);
      expect(snap.slides.verlaesslichkeit.nie_abgesagt).toBe(true);
    });

    // ------------------------------------------------------------
    // Formwaechter: Version 3 ist ADDITIV -- alle bisherigen Felder
    // sind noch da und haben denselben Typ (ausgelieferte Apps!).
    // ------------------------------------------------------------
    it('Version 3 behaelt alle bisherigen Snapshot-Felder mit denselben Typen', async () => {
      const a = await termin('Ein Termin', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, a);

      const snap = await snapshotVon(USERS.konfi1.id);

      expect(snap.version).toBe(3);
      expect(typeof snap.highlight_type).toBe('string');
      expect(typeof snap.formulierung_seed).toBe('number');

      // Bestandsfelder (Version 2) -- Form und Typ unveraendert.
      expect(typeof snap.slides.punkte.gottesdienst).toBe('number');
      expect(typeof snap.slides.punkte.gemeinde).toBe('number');
      expect(typeof snap.slides.punkte.total).toBe('number');
      expect(typeof snap.slides.punkte.bonus).toBe('number');
      expect(snap.slides.events.total_attended).toBe(1);
      expect(typeof snap.slides.events.total_available).toBe('number');
      expect(typeof snap.slides.events.abgesagt).toBe('number');
      expect(snap.slides.events.lieblings_event.name).toBe('Ein Termin');
      expect(typeof snap.slides.badges.total_earned).toBe('number');
      expect(Array.isArray(snap.slides.badges.badges)).toBe(true);
      expect(typeof snap.slides.pflicht.besucht).toBe('number');
      expect(typeof snap.slides.pflicht.gesamt).toBe('number');
      expect(typeof snap.slides.aktivster_monat.monat).toBe('number');
      expect(typeof snap.slides.aktivster_monat.monat_name).toBe('string');
      expect(typeof snap.slides.endspurt.aktiv).toBe('boolean');
      expect(typeof snap.slides.endspurt.fehlende_punkte).toBe('number');
      expect(typeof snap.slides.zeitraum.start).toBe('string');
      expect(typeof snap.slides.zeitraum.ende).toBe('string');
      expect(typeof snap.slides.gottesdienst.count).toBe('number');
      expect(Array.isArray(snap.slides.kategorie.verteilung)).toBe(true);
      expect(Array.isArray(snap.slides.challenge_momente)).toBe(true);

      // Neue Felder (Version 3) -- vorhanden und richtig getypt.
      expect(typeof snap.slides.chat.nachrichten_gesendet).toBe('number');
      expect(typeof snap.slides.chat.reaktionen_gegeben).toBe('number');
      expect(typeof snap.slides.chat.reaktionen_bekommen).toBe('number');
      expect(typeof snap.slides.challenges.beitraege).toBe('number');
      expect(typeof snap.slides.verlaesslichkeit.abmeldungen).toBe('number');
      expect(typeof snap.slides.verlaesslichkeit.nie_abgesagt).toBe('boolean');
      expect(snap.slides.highlight.type).toBe(snap.highlight_type);
      expect(typeof snap.slides.highlight.wert).toBe('number');
    });
  });

  // ================================================================
  // SONDERSEITE STAVANGER 2026 (Sommerfreizeit)
  // ================================================================
  //
  // SIMONS VORGABE (07.09.2026): "kannst du bitte eine seite bauen fuer
  // sommerfreizeit 2026 stavanger norwegen. das sehen dann nur die teamer
  // und konfis die dabei waren. ich lege das als aktivitaet an mit
  // sommerfrezeit als kategorie."
  //
  // WICHTIG BEIM LESEN: Die Kategorie "Sommerfreizeit" existiert in KEINER
  // Gemeinde -- sie wird erst per SQL angelegt. Der erste Test hier prueft
  // deshalb genau das: Solange es sie nicht gibt, erscheint die Seite
  // nirgends. Kein Fehler, keine leere Seite.
  describe('Sonderseite Stavanger 2026', () => {
    // Der Zeitraum der Fahrt (utils/wrappedKategorien.js):
    // 01.06.2026 bis 30.09.2026.
    const IN_DER_FAHRT = '2026-07-15';
    const NACH_DER_FAHRT = '2026-11-15';  // liegt ausserhalb des Fahrt-Fensters

    /** Legt die Kategorie "Sommerfreizeit" an und gibt ihre ID zurueck. */
    async function sommerfreizeitKategorie(orgId = ORGS.testGemeinde.id) {
      const { rows: [c] } = await db.query(
        `INSERT INTO categories (name, type, organization_id)
         VALUES ('Sommerfreizeit', 'both', $1) RETURNING id`,
        [orgId]
      );
      return c.id;
    }

    /**
     * Termin mit Kategorie anlegen und die Person darauf buchen.
     * Die Fahrt kann als Termin ODER als Aktivitaet gefuehrt sein -- hier
     * der Termin-Weg.
     */
    async function fahrtAlsTermin(userId, datum, kategorieId) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ('Sommerfreizeit Norwegen', $1::timestamp, $2, false, 0, 'gemeinde', 1) RETURNING id`,
        [`${datum} 10:00:00`, ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, JAHRGAENGE.jahrgang1.id]
      );
      await db.query(
        'INSERT INTO event_categories (event_id, category_id) VALUES ($1, $2)',
        [e.id, kategorieId]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status, booking_date)
         VALUES ($1, $2, $3, 'confirmed', 'present', NOW())`,
        [userId, e.id, ORGS.testGemeinde.id]
      );
      return e.id;
    }

    /** Der Aktivitaets-Weg -- so, wie Simon es anlegen will. */
    async function fahrtAlsAktivitaet(userId, datum, kategorieId) {
      const { rows: [a] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id)
         VALUES ('Sommerfreizeit Norwegen', 5, 'gemeinde', $1) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO activity_categories (activity_id, category_id) VALUES ($1, $2)',
        [a.id, kategorieId]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id)
         VALUES ($1, $2, $3, $4::date, $5)`,
        [userId, a.id, USERS.admin1.id, datum, ORGS.testGemeinde.id]
      );
      return a.id;
    }

    /**
     * Konfi-Snapshot von konfi1, mit gesetztem Beginn der Konfi-Zeit.
     *
     * Datumsfelder gibt es seit dem 07.09.2026 nicht mehr -- der Zeitraum
     * laeuft vom Beginn der Konfi-Zeit bis heute. Der Beginn wird deshalb
     * direkt gesetzt.
     */
    async function konfiSnapshot(start = '2026-01-01') {
      await db.query(
        'UPDATE konfi_profiles SET created_at = $1::timestamp WHERE user_id = $2',
        [`${start} 00:00:00`, USERS.konfi1.id]
      );
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'konfi'
          ORDER BY computed_at DESC, id DESC LIMIT 1`,
        [USERS.konfi1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    /**
     * Teamer-Snapshot von teamer1 fuer ein KALENDERJAHR.
     *
     * Der Team-Rueckblick umfasst seit dem 07.09.2026 immer ein volles
     * Jahr; gewaehlt wird nur noch dieses.
     */
    async function teamerSnapshot(jahr = new Date().getFullYear() - 1) {
      // generate-teamer verlangt OrgAdmin -- ein Admin bekommt 403.
      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr });
      expect(gen.status).toBe(200);
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'teamer'
          ORDER BY computed_at DESC, id DESC LIMIT 1`,
        [USERS.teamer1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    it('ohne die Kategorie erscheint die Seite nirgends -- der heutige Stand', async () => {
      // DER WICHTIGSTE TEST. "Sommerfreizeit" gibt es in keiner Gemeinde;
      // sie wird erst per SQL angelegt. Bis dahin muss die Seite sauber
      // verschwinden: kein Fehler, keine leere Seite.
      const snap = await konfiSnapshot();
      expect(snap.slides.stavanger_2026).toBe(false);
      expect(snap.kacheln).not.toContain('stavanger-2026');
    });

    it('wer die Fahrt als Termin hat, bekommt die Seite', async () => {
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsTermin(USERS.konfi1.id, IN_DER_FAHRT, kat);

      const snap = await konfiSnapshot();
      expect(snap.slides.stavanger_2026).toBe(true);
      expect(snap.kacheln).toContain('stavanger-2026');
    });

    it('wer die Fahrt als Aktivitaet hat, bekommt die Seite ebenfalls', async () => {
      // Simon legt sie als AKTIVITAET an -- dieser Weg muss genauso
      // funktionieren wie der Termin-Weg.
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsAktivitaet(USERS.konfi1.id, IN_DER_FAHRT, kat);

      const snap = await konfiSnapshot();
      expect(snap.slides.stavanger_2026).toBe(true);
      expect(snap.kacheln).toContain('stavanger-2026');
    });

    it('wer nicht dabei war, bekommt sie nicht -- auch wenn es die Kategorie gibt', async () => {
      // Die Kategorie existiert, die Fahrt ist eingetragen -- aber fuer
      // konfi2, nicht fuer konfi1. Genau das ist Simons Vorgabe: "nur die
      // teamer und konfis die dabei waren".
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsAktivitaet(USERS.konfi2.id, IN_DER_FAHRT, kat);

      const snap = await konfiSnapshot();
      expect(snap.slides.stavanger_2026).toBe(false);
      expect(snap.kacheln).not.toContain('stavanger-2026');
    });

    it('eine spaetere Sommerfreizeit loest die Norwegen-Seite NICHT aus', async () => {
      // Die Kategorie bleibt und wird wiederverwendet. Ohne das
      // Fahrt-Fenster wuerde die Freizeit 2027 dieselbe Seite ueber
      // Norwegen 2026 erzeugen -- fuer jemanden, der nie dort war.
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsAktivitaet(USERS.konfi1.id, NACH_DER_FAHRT, kat);

      const snap = await konfiSnapshot();
      expect(snap.slides.stavanger_2026).toBe(false);
      expect(snap.kacheln).not.toContain('stavanger-2026');
    });

    it('ein Rueckblick, dessen Zeitraum die Fahrt nicht enthaelt, zeigt sie nicht', async () => {
      // Simons Regel (07.09.2026): Der Rueckblick zeigt nur, was in seiner
      // Spanne liegt. Wer erst NACH der Fahrt Konfi wurde, war nicht dabei
      // -- auch wenn die Gemeinde die Kategorie hat.
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsAktivitaet(USERS.konfi1.id, IN_DER_FAHRT, kat);

      const snap = await konfiSnapshot('2026-10-01');
      expect(snap.slides.stavanger_2026).toBe(false);
      expect(snap.kacheln).not.toContain('stavanger-2026');
    });

    it('das Team bekommt die Seite genauso', async () => {
      // "das sehen dann nur die teamer und konfis die dabei waren."
      //
      // DER TEAM-RUECKBLICK UMFASST EIN ABGESCHLOSSENES KALENDERJAHR
      // (07.09.2026). Die Fahrt war im Juli 2026 -- sie erscheint also im
      // Rueckblick auf 2026, den es ab dem 1.1.2027 gibt. Solange 2026
      // laeuft, kann dieser Rueckblick gar nicht erzeugt werden; der Test
      // prueft dann, dass die Route das auch sagt.
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsAktivitaet(USERS.teamer1.id, IN_DER_FAHRT, kat);

      const fahrtJahr = Number(IN_DER_FAHRT.slice(0, 4));
      if (fahrtJahr >= new Date().getFullYear()) {
        const abgelehnt = await request(app)
          .post('/api/wrapped/generate-teamer')
          .set('Authorization', `Bearer ${orgAdminToken}`)
          .send({ jahr: fahrtJahr });
        expect(abgelehnt.status).toBe(400);
        return;
      }

      const snap = await teamerSnapshot(fahrtJahr);
      expect(snap.slides.stavanger_2026).toBe(true);
      expect(snap.kacheln).toContain('stavanger-2026');
    });

    it('ein Teamer ohne die Fahrt bekommt sie nicht', async () => {
      const kat = await sommerfreizeitKategorie();
      await fahrtAlsAktivitaet(USERS.konfi1.id, IN_DER_FAHRT, kat);

      // Ein abgeschlossenes Jahr -- der Rueckblick laesst sich erzeugen,
      // und teamer1 war nicht dabei.
      const snap = await teamerSnapshot(new Date().getFullYear() - 1);
      expect(snap.slides.stavanger_2026).toBe(false);
      expect(snap.kacheln).not.toContain('stavanger-2026');
    });

    it('eine Kategorie derselben Schreibweise in einer FREMDEN Gemeinde zaehlt nicht', async () => {
      // Org-Isolation: Wer in einer anderen Gemeinde eine "Sommerfreizeit"
      // fuehrt, darf hier niemandem eine Norwegen-Seite verschaffen.
      const fremdeKat = await sommerfreizeitKategorie(ORGS.andereGemeinde.id);
      const { rows: [a] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id)
         VALUES ('Sommerfreizeit', 5, 'gemeinde', $1) RETURNING id`,
        [ORGS.andereGemeinde.id]
      );
      await db.query(
        'INSERT INTO activity_categories (activity_id, category_id) VALUES ($1, $2)',
        [a.id, fremdeKat]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id)
         VALUES ($1, $2, $3, $4::date, $5)`,
        [USERS.konfi1.id, a.id, USERS.admin1.id, IN_DER_FAHRT, ORGS.andereGemeinde.id]
      );

      const snap = await konfiSnapshot();
      expect(snap.slides.stavanger_2026).toBe(false);
      expect(snap.kacheln).not.toContain('stavanger-2026');
    });

    it('das Feld ist ADDITIV -- die uebrigen Snapshot-Felder bleiben unveraendert', async () => {
      // Ausgelieferte Apps lesen diesen Snapshot. Ein neues Feld ist
      // erlaubt, eine geaenderte Form nicht.
      const snap = await konfiSnapshot();
      expect(typeof snap.slides.stavanger_2026).toBe('boolean');
      expect(Array.isArray(snap.slides.kategorie.verteilung)).toBe(true);
      expect(Array.isArray(snap.kacheln)).toBe(true);
      expect(typeof snap.slides.punkte.total).toBe('number');
    });
  });

  // ================================================================
  // JEDER TERMIN ZAEHLT NUR EINMAL (Simon, 07.09.2026)
  // ================================================================
  //
  // BEFUND: Die Vorrang-Regel "Datum schlaegt Kategorie" stand seit dem
  // 02.09.2026 in wrappedKategorien.js ("Eine Person bekommt nie zwei
  // Seiten ueber denselben Termin"), steuerte aber nur die REIHENFOLGE der
  // Seiten -- nicht die Zahlen. Ein Gottesdienst in der Passionszeit
  // zaehlte auf der Oster-Seite UND auf der Gottesdienst-Seite: dieselbe
  // Stunde in derselben Kirche, zweimal erzaehlt.
  describe('Vorrang Datum vor Kategorie -- bis in die Zahlen', () => {
    const jahr = 2026;
    // Ostern 2026 ist der 05.04. Aschermittwoch der 17.02. -- der 15.03.
    // liegt mitten in der Passionszeit.
    const IN_DER_PASSIONSZEIT = `${jahr}-03-15`;
    // Ein ganz gewoehnlicher Sonntag ausserhalb jedes Datums-Fensters.
    const OHNE_FENSTER = `${jahr}-05-17`;

    async function kategorie(name) {
      const { rows: [c] } = await db.query(
        `INSERT INTO categories (name, type, organization_id)
         VALUES ($1, 'both', $2) RETURNING id`,
        [name, ORGS.testGemeinde.id]
      );
      return c.id;
    }

    async function terminMitKategorie(userId, datum, kategorieId, name = 'Gottesdienst') {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, $2::timestamp, $3, false, 0, 'gottesdienst', 1) RETURNING id`,
        [name, `${datum} 10:00:00`, ORGS.testGemeinde.id]
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, JAHRGAENGE.jahrgang1.id]);
      if (kategorieId) {
        await db.query('INSERT INTO event_categories (event_id, category_id) VALUES ($1, $2)',
          [e.id, kategorieId]);
      }
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, booking_date)
         VALUES ($1, $2, $3, 'confirmed', NOW())`,
        [userId, e.id, ORGS.testGemeinde.id]
      );
      return e.id;
    }

    async function snapshot(start = `${jahr}-01-01`) {
      // Datumsfelder gibt es nicht mehr -- der Beginn der Konfi-Zeit setzt
      // den Zeitraum (07.09.2026).
      await db.query(
        'UPDATE konfi_profiles SET created_at = $1::timestamp WHERE user_id = $2',
        [`${start} 00:00:00`, USERS.konfi1.id]
      );
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots
          WHERE user_id = $1 AND wrapped_type = 'konfi'
          ORDER BY computed_at DESC, id DESC LIMIT 1`,
        [USERS.konfi1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    /** Wie oft zaehlt diese Kategorie in der Verteilung? */
    const zaehlerFuer = (snap, name) => {
      const e = (snap.slides.kategorie.verteilung || []).find(v => v.kategorie === name);
      return e ? e.count : 0;
    };

    beforeEach(async () => {
      await db.query('DELETE FROM event_bookings');
      await db.query('DELETE FROM event_categories');
      await db.query('DELETE FROM event_jahrgang_assignments');
      await db.query('DELETE FROM events');
      await db.query('DELETE FROM user_activities');
      await db.query(`DELETE FROM categories WHERE name IN ('Gottesdienst', 'Kasualien')`);
    });

    it('ein Termin in der Passionszeit zaehlt bei Ostern -- und NICHT bei der Kategorie', async () => {
      // DER BEFUND, mit echten Zahlen: Vorher stand hier 1 UND 1.
      const kat = await kategorie('Gottesdienst');
      await terminMitKategorie(USERS.konfi1.id, IN_DER_PASSIONSZEIT, kat);

      const snap = await snapshot();
      expect(snap.slides.datums_fenster.ostern).toBe(1);
      expect(zaehlerFuer(snap, 'Gottesdienst')).toBe(0);
    });

    it('ein Termin ausserhalb jedes Fensters zaehlt bei der Kategorie', async () => {
      // DIE GEGENPROBE ZUM TEST DARUEBER: Die Vorrang-Regel darf nicht
      // einfach alle Kategorie-Zahlen leeren.
      const kat = await kategorie('Gottesdienst');
      await terminMitKategorie(USERS.konfi1.id, OHNE_FENSTER, kat);

      const snap = await snapshot();
      expect(snap.slides.datums_fenster.ostern).toBeUndefined();
      expect(zaehlerFuer(snap, 'Gottesdienst')).toBe(1);
    });

    it('die Summe bleibt erhalten -- kein Termin geht verloren, keiner zaehlt doppelt', async () => {
      // DREI Termine: zwei in der Passionszeit, einer ausserhalb. Zusammen
      // muessen sie GENAU dreimal gezaehlt werden, ueber alle Seiten hinweg.
      const kat = await kategorie('Gottesdienst');
      await terminMitKategorie(USERS.konfi1.id, IN_DER_PASSIONSZEIT, kat, 'Passion 1');
      await terminMitKategorie(USERS.konfi1.id, `${jahr}-03-22`, kat, 'Passion 2');
      await terminMitKategorie(USERS.konfi1.id, OHNE_FENSTER, kat, 'Gewoehnlich');

      const snap = await snapshot();
      const ausDatum = Object.values(snap.slides.datums_fenster || {}).reduce((a, b) => a + b, 0);
      const ausKategorie = (snap.slides.kategorie.verteilung || [])
        .reduce((a, v) => a + (v.aus_terminen || 0), 0);

      expect(snap.slides.datums_fenster.ostern).toBe(2);
      expect(zaehlerFuer(snap, 'Gottesdienst')).toBe(1);
      expect(ausDatum + ausKategorie).toBe(3);
      expect(snap.slides.events.total_attended).toBe(3);
    });

    it('ein Termin mit ZWEI Kategorien im Datums-Fenster zaehlt bei keiner von beiden', async () => {
      // Er bleibt EIN Termin. Faellt er ins Fenster, gehoert er dem Datum --
      // und zwar ganz, nicht anteilig.
      const gd = await kategorie('Gottesdienst');
      const kas = await kategorie('Kasualien');
      const eventId = await terminMitKategorie(USERS.konfi1.id, IN_DER_PASSIONSZEIT, gd);
      await db.query('INSERT INTO event_categories (event_id, category_id) VALUES ($1, $2)',
        [eventId, kas]);

      const snap = await snapshot();
      expect(snap.slides.datums_fenster.ostern).toBe(1);
      expect(zaehlerFuer(snap, 'Gottesdienst')).toBe(0);
      expect(zaehlerFuer(snap, 'Kasualien')).toBe(0);
    });

    it('ein Termin OHNE Kategorie zaehlt trotzdem im Datums-Fenster', async () => {
      // Frueher las die Datums-Seite aus einer eigenen Abfrage ohne
      // Kategorie-Bedingung, die Kategorie-Seite aus einer mit INNER JOIN.
      // Jetzt ist es eine Abfrage -- ein Termin ohne Kategorie darf dabei
      // nicht unter den Tisch fallen.
      await terminMitKategorie(USERS.konfi1.id, IN_DER_PASSIONSZEIT, null);

      const snap = await snapshot();
      expect(snap.slides.datums_fenster.ostern).toBe(1);
      expect(snap.slides.events.total_attended).toBe(1);
    });

    it('die gemessene Seltenheit liegt im Snapshot und ist additiv', async () => {
      // SIMONS ENTSCHEIDUNG 07.09.2026: Die Seitenauswahl richtet sich nach
      // der Seltenheit -- "wie viele andere bekommen diese Seite auch".
      // Das Backend misst das je Jahrgang und legt es als
      // slides.seiten_haeufigkeit ab (utils/wrappedKacheln.js liest es).
      //
      // ERST AB 5 KONFIS: Darunter waere jeder Anteil eine Zahl ohne
      // Aussage -- bei zweien entweder 50 % oder 100 %. Dieselbe Schwelle
      // wie beim seltensten Abzeichen. Der Testjahrgang ist klein, das Feld
      // ist deshalb null -- und die Auswahl rechnet mit den geschaetzten
      // Grundhaeufigkeiten weiter.
      const kat = await kategorie('Gottesdienst');
      await terminMitKategorie(USERS.konfi1.id, OHNE_FENSTER, kat);

      const snap = await snapshot();
      const h = snap.slides.seiten_haeufigkeit;
      expect(h === null || typeof h === 'object').toBe(true);
      if (h) {
        // Wenn gemessen, dann als Prozentzahlen zwischen 1 und 100.
        for (const [seite, wert] of Object.entries(h)) {
          expect(Number.isInteger(wert), `${seite} ist keine ganze Zahl`).toBe(true);
          expect(wert).toBeGreaterThanOrEqual(1);
          expect(wert).toBeLessThanOrEqual(100);
        }
      }

      // Additiv: Das neue Feld aendert nichts an den bestehenden.
      expect(Array.isArray(snap.kacheln)).toBe(true);
      expect(typeof snap.slides.punkte.total).toBe('number');
      expect(Array.isArray(snap.slides.kategorie.verteilung)).toBe(true);
    });

    it('ein Rueckblick hat hoechstens zehn Seiten', async () => {
      // Simons Vorgabe 07.09.2026: "jeder kriegt maximal 10 Folien."
      // Vorher waren es bis zu 19, im Schnitt 14,5.
      const kat = await kategorie('Gottesdienst');
      for (const tag of ['05', '12', '19', '26']) {
        await terminMitKategorie(USERS.konfi1.id, `${jahr}-05-${tag}`, kat, `Sonntag ${tag}`);
      }
      await terminMitKategorie(USERS.konfi1.id, IN_DER_PASSIONSZEIT, kat, 'Passion');
      await terminMitKategorie(USERS.konfi1.id, `${jahr}-12-24`, kat, 'Christvesper');

      const snap = await snapshot();
      expect(snap.kacheln.length).toBeLessThanOrEqual(10);
      // Auftakt und Abschluss sind dabei -- Simons roter Faden.
      expect(snap.kacheln[0]).toBe('intro');
      expect(snap.kacheln).toContain('abschluss');
    });

    it('die Verteilung behaelt Form und Feldnamen -- ausgelieferte Apps lesen sie', async () => {
      const kat = await kategorie('Gottesdienst');
      await terminMitKategorie(USERS.konfi1.id, OHNE_FENSTER, kat);

      const snap = await snapshot();
      const eintrag = snap.slides.kategorie.verteilung.find(v => v.kategorie === 'Gottesdienst');
      expect(typeof eintrag.kategorie).toBe('string');
      expect(typeof eintrag.count).toBe('number');
      expect(typeof eintrag.aus_terminen).toBe('number');
      expect(typeof eintrag.aus_aktivitaeten).toBe('number');
      expect(eintrag.seite).toBe('kategorie:gottesdienst');
      expect(typeof snap.slides.kategorie.top_kategorie).toBe('string');
    });
  });


  // ================================================================
  // AUSGABEN (Migration 143, Simons Vorgabe: mehrfach freigeben + benennen)
  // ================================================================
  describe('Rueckblick-Ausgaben', () => {
    it('jeder Lauf legt eine EIGENE Ausgabe an -- der zweite ueberschreibt den ersten nicht', async () => {
      // Der Kern von Simons Anforderung: Ein Jahrgang laeuft ueber mehrere
      // Jahre und bekommt mehrere Rueckblicke. Vorher gab es genau EINEN
      // Stand pro Jahrgang, der zweite Lauf ueberschrieb den ersten.
      //
      // BENANNT werden sie seit dem 07.09.2026 nicht mehr (Simon: "Dann
      // braucht es auch keine Titel.") -- unterschieden werden sie ueber
      // ihre id und den Zeitpunkt.
      const ersterLauf = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ersterLauf.status).toBe(200);

      const zweiterLauf = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(zweiterLauf.status).toBe(200);

      const res = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const eigene = res.body.filter(a => a.jahrgang_id === JAHRGAENGE.jahrgang1.id);
      expect(eigene).toHaveLength(2);
      // Zwei VERSCHIEDENE Ausgaben, jede mit eigenen Snapshots.
      expect(new Set(eigene.map(a => a.id)).size).toBe(2);
      for (const a of eigene) expect(a.snapshots).toBeGreaterThan(0);
    });

    it('die Ausgabe traegt einen sachlichen Namen, den niemand eingeben muss', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].titel).toBeTruthy();
      expect(res.body[0].titel.length).toBeGreaterThan(3);
    });

    it('eine erzeugte Ausgabe ist freigegeben und traegt ihre Snapshots', async () => {
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);

      const res = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const ausgabe = res.body.find(a => a.jahrgang_id === JAHRGAENGE.jahrgang1.id);
      expect(ausgabe).toBeDefined();
      expect(ausgabe.freigegeben).toBe(true);
      expect(ausgabe.snapshots).toBeGreaterThan(0);
      expect(ausgabe.jahrgang_id).toBe(JAHRGAENGE.jahrgang1.id);
    });

    it('die Teamer-Ausgabe nennt ihr Jahr', async () => {
      // Kein freier Titel mehr (07.09.2026) -- der Name sagt schlicht,
      // welches Jahr die Ausgabe abdeckt.
      const jahrDavor = new Date().getFullYear() - 1;
      const gen = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahr: jahrDavor });

      expect(gen.status).toBe(200);
      expect(gen.body.titel).toBe(`Team-Rückblick ${jahrDavor}`);

      const res = await request(app)
        .get('/api/wrapped/ausgaben?typ=teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.map(a => a.titel)).toContain(`Team-Rückblick ${jahrDavor}`);
    });

    it('Teamer-Ausgaben sieht ein einfacher Admin NICHT', async () => {
      // Simons Rechte-Entscheidung: Teamer-Ausgaben nur org_admin.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`)


      const res = await request(app)
        .get('/api/wrapped/ausgaben?typ=teamer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('ein Admin sieht nur Ausgaben SEINER Jahrgaenge', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const admin2Token = generateToken('admin2');
      const res = await request(app)
        .get('/api/wrapped/ausgaben')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.map(a => a.jahrgang_id)).not.toContain(JAHRGAENGE.jahrgang1.id);
    });

    it('Konfis kommen an die Ausgaben-Liste nicht heran', async () => {
      const res = await request(app)
        .get('/api/wrapped/ausgaben')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('die Leitung sieht die mehreren Ausgaben im Profil eines Konfis', async () => {
      // Simon (03.09.2026): "Auch der Admin soll die mehreren im Profil von
      // Konfis und Teamern sehen koennen."
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // BEIDE Ausgaben stehen im Profil -- der zweite Lauf hat den ersten
      // nicht ueberschrieben.
      expect(res.body).toHaveLength(2);
      expect(new Set(res.body.map(r => r.ausgabe_id)).size).toBe(2);
    });

    it('history bleibt ein Array mit den bisherigen Feldern (Alt-App-Vertrag)', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Die Felder, auf die ausgelieferte App-Versionen zugreifen.
      for (const feld of ['id', 'wrapped_type', 'year', 'data', 'computed_at']) {
        expect(res.body[0]).toHaveProperty(feld);
      }
    });

    it('ein Konfi sieht seine eigenen Ausgaben', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/wrapped/meine')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // Beide sind freigegeben und tragen ihren Zeitraum.
      for (const r of res.body) {
        expect(r.ausgabe_id).toBeGreaterThan(0);
        expect(r.zeitraum_start).toBeTruthy();
        expect(r.zeitraum_ende).toBeTruthy();
      }
    });

    it('eine einzelne Ausgabe laesst sich loeschen, ohne die anderen mitzunehmen', async () => {
      // Simon: "Ich will auch alle Wrapped eines Zustandes loeschen koennen."
      const ersterLauf = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ersterLauf.status).toBe(200);
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const liste = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const eigene = liste.body.filter(a => a.jahrgang_id === JAHRGAENGE.jahrgang1.id);
      expect(eigene).toHaveLength(2);
      // Die AELTERE der beiden loeschen -- die juengere muss stehen bleiben.
      const [aelter, juenger] = [...eigene].sort((a, b) => a.id - b.id);

      const del = await request(app)
        .delete(`/api/wrapped/ausgabe/${aelter.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(del.status).toBe(200);
      expect(del.body.deleted).toBeGreaterThan(0);

      const danach = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const idsDanach = danach.body.map(a => a.id);
      expect(idsDanach).not.toContain(aelter.id);
      expect(idsDanach).toContain(juenger.id);
    });

    it('ein Konfi darf keine Ausgabe loeschen', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const liste = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const id = liste.body[0].id;

      const res = await request(app)
        .delete(`/api/wrapped/ausgabe/${id}`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(403);
    });

    it('eine Ausgabe fremder Organisation ist nicht loeschbar -> 404', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const liste = await request(app)
        .get('/api/wrapped/ausgaben?typ=konfi')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const id = liste.body[0].id;

      const res = await request(app)
        .delete(`/api/wrapped/ausgabe/${id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);
      expect(res.status).toBe(404);
    });

    it('Ausgaben einer fremden Organisation sind unsichtbar', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/wrapped/ausgaben')
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.map(a => a.titel)).not.toContain('Org1 Ausgabe');
    });
  });

  // ================================================================
  // GET /ausgaben — der Hinweis fuer Admins ohne Jahrgang
  // ================================================================
  describe('GET /api/wrapped/ausgaben ohne Jahrgangs-Zuweisung', () => {
    // SIMONS ENTSCHEIDUNG (31.08.2026): Ein Admin OHNE Jahrgang ist ein
    // gueltiger Fall -- "angenommen ich will nur einen admin haben der mit
    // dem teamer spricht". Dann muss die Oberflaeche aber erklaeren koennen,
    // warum eine Liste leer ist, sonst haelt man die App fuer kaputt.
    //
    // Dasselbe Muster wie GET /admin/konfis, /events, /material,
    // /challenges: der Header X-Kein-Jahrgang-Zugewiesen. Als HEADER, damit
    // die Antwortform ein Array bleibt (ALT-APP-VERTRAG).
    it('Admin ohne Jahrgang bekommt den Hinweis-Header', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.admin1.id]);
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .get('/api/wrapped/ausgaben')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Admin MIT Jahrgang bekommt ihn nicht', async () => {
      const res = await request(app)
        .get('/api/wrapped/ausgaben')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('Die Leitung bekommt ihn nie — sie sieht ohnehin alles', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.orgAdmin1.id]);
      require('../../middleware/rbac').invalidateUserCache(USERS.orgAdmin1.id);

      const res = await request(app)
        .get('/api/wrapped/ausgaben')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });
  });

  // ================================================================
  // GET /team-jahre
  // ================================================================
  describe('GET /api/wrapped/team-jahre', () => {
    // SIMON, 09.09.2026: "Ich meine das mir in meiner org 2022 angeboten
    // wird. Da existierte nichtmal ein Teamer." -- Die Auswahl zaehlte
    // organisationsweit und bot deshalb Jahre an, in denen es nur
    // Konfi-Daten gab. Der Rueckblick waere leer geblieben.
    const JAHR_OHNE_TEAMER = 2022;

    async function terminMitAnwesenheit(userId, datum) {
      const { rows: [ev] } = await db.query(
        `INSERT INTO events (organization_id, name, event_date, points, created_by)
         VALUES ($1, $2, $3::date, 0, $4) RETURNING id`,
        [ORGS.testGemeinde.id, 'Termin ' + datum, datum, USERS.orgAdmin1.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status)
         VALUES ($1, $2, 'confirmed', 'present')`,
        [ev.id, userId]
      );
      return ev.id;
    }

    it('ein Jahr mit reinem Konfi-Termin wird NICHT angeboten', async () => {
      await terminMitAnwesenheit(USERS.konfi1.id, JAHR_OHNE_TEAMER + '-05-01');

      const res = await request(app)
        .get('/api/wrapped/team-jahre')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.map(j => j.jahr)).not.toContain(JAHR_OHNE_TEAMER);
    });

    it('dasselbe Jahr wird angeboten, sobald eine Teamer:in dabei war', async () => {
      await terminMitAnwesenheit(USERS.teamer1.id, JAHR_OHNE_TEAMER + '-05-01');

      const res = await request(app)
        .get('/api/wrapped/team-jahre')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const jahr = res.body.find(j => j.jahr === JAHR_OHNE_TEAMER);
      expect(jahr).toBeDefined();
      expect(jahr.gesperrt).toBe(false);
    });

    it('ein Zertifikat allein macht das Jahr lieferbar -- es hat eine eigene Seite', async () => {
      const { rows: [typ] } = await db.query(
        `INSERT INTO certificate_types (name, icon, organization_id)
         VALUES ('JuLeiCa', 'ribbon', $1) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date)
         VALUES ($1, $2, $3, $4::date)`,
        [USERS.teamer1.id, typ.id, ORGS.testGemeinde.id, JAHR_OHNE_TEAMER + '-11-20']
      );

      const res = await request(app)
        .get('/api/wrapped/team-jahre')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.map(j => j.jahr)).toContain(JAHR_OHNE_TEAMER);
    });

    it('das laufende Jahr steht in der Liste, aber gesperrt', async () => {
      const res = await request(app)
        .get('/api/wrapped/team-jahre')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      const laufend = res.body.find(j => j.jahr === new Date().getFullYear());
      expect(laufend).toBeDefined();
      expect(laufend.gesperrt).toBe(true);
    });
  });

  // ================================================================
  // ORG-ISOLATION
  // ================================================================
  describe('Org-Isolation', () => {
    it('OrgAdmin2 kann Jahrgang1 nicht loeschen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
    });

    it('Admin aus Org2 kann nicht fuer Jahrgang aus Org1 generieren -> 404', async () => {
      const admin2Token = generateToken('admin2');
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
