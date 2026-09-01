// backend/tests/routes/konfiTeamerParitaet.test.js
//
// Sichert die am 01.09.2026 zusammengelegten Konfi/Teamer-Kopien ab
// (Befunde M1-M4): Beide Wege muessen bei gleicher Ausgangslage DASSELBE
// liefern, die Antwortformen bleiben unveraendert, und die Mandantengrenze
// greift jetzt auf BEIDEN Wegen.
//
// Warum ein eigener Test: Die Kopien liefen dreifach nachweisbar
// auseinander (Org-Filter Punkte-Historie, Tageslosungs-Fallback,
// bible-translation-Whitelist), ohne dass ein Test das gemerkt haette.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfi/Teamer-Paritaet (zusammengelegte Logik)', () => {
  let app;
  let db;
  let konfiToken;
  let teamerToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    teamerToken = generateToken('teamer1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // M1 — PUNKTE-HISTORIE
  // Beide Routen speisen dasselbe Frontend-Modal (PointsHistoryModal.tsx).
  // ================================================================
  describe('Punkte-Historie: /konfi/points-history und /teamer/konfi-history', () => {
    // Legt fuer einen User dieselbe Ausgangslage an: 1 Aktivitaet,
    // 1 Bonuspunkt, 1 Event-Punkt und einen Profil-Punktestand.
    async function gleicheAusgangslage(userId, orgId) {
      // Der Seed bringt fuer konfi1 bereits Bonuspunkte mit. Fuer den
      // Paritaets-Vergleich muessen beide Seiten wirklich gleich starten.
      await db.query('DELETE FROM bonus_points WHERE konfi_id = $1', [userId]);
      await db.query('DELETE FROM user_activities WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM event_points WHERE konfi_id = $1', [userId]);
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, NULL, 7, 3, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET gottesdienst_points = 7, gemeinde_points = 3, organization_id = $2`,
        [userId, orgId]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, comment, organization_id)
         VALUES ($1, $2, $3, '2026-03-01', 'Testkommentar', $4)`,
        [userId, ACTIVITIES.sonntagsgottesdienst.id, USERS.admin1.id, orgId]
      );
      await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date, organization_id)
         VALUES ($1, 2, 'gemeinde', 'Sonderleistung', $2, '2026-02-01', $3)`,
        [userId, USERS.admin1.id, orgId]
      );
      await db.query(
        `INSERT INTO event_points (konfi_id, event_id, points, point_type, description, admin_id, awarded_date, organization_id)
         VALUES ($1, 1, 2, 'gottesdienst', 'Event-Punkte', $2, '2026-01-01', $3)`,
        [userId, USERS.admin1.id, orgId]
      );
    }

    it('liefert bei gleicher Ausgangslage auf beiden Wegen dasselbe', async () => {
      await gleicheAusgangslage(USERS.konfi1.id, ORGS.testGemeinde.id);
      await gleicheAusgangslage(USERS.teamer1.id, ORGS.testGemeinde.id);

      const konfiRes = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.status).toBe(200);
      expect(teamerRes.status).toBe(200);

      // Gleiche Gesamtstaende
      expect(konfiRes.body.totals).toEqual({ gottesdienst: 7, gemeinde: 3, total: 10 });
      expect(teamerRes.body.totals).toEqual({ gottesdienst: 7, gemeinde: 3, total: 10 });

      // Gleiche Anzahl und gleiche Reihenfolge (neueste zuerst)
      expect(konfiRes.body.history).toHaveLength(3);
      expect(teamerRes.body.history).toHaveLength(3);
      expect(konfiRes.body.history.map((h) => h.source_type)).toEqual(['activity', 'bonus', 'event']);
      expect(teamerRes.body.history.map((h) => h.source_type)).toEqual(['activity', 'bonus', 'event']);

      // Gleiche Inhalte Feld fuer Feld (nur die IDs unterscheiden sich)
      const ohneIds = (body) => body.history.map(({ id, ...rest }) => rest);
      expect(ohneIds(teamerRes.body)).toEqual(ohneIds(konfiRes.body));
    });

    it('Antwortform unveraendert: {history, totals} mit genau diesen Eintrags-Feldern', async () => {
      await gleicheAusgangslage(USERS.konfi1.id, ORGS.testGemeinde.id);
      await gleicheAusgangslage(USERS.teamer1.id, ORGS.testGemeinde.id);

      const felder = ['id', 'title', 'points', 'category', 'date', 'comment', 'source_type'];

      for (const [pfad, token] of [
        ['/api/konfi/points-history', konfiToken],
        ['/api/teamer/konfi-history', teamerToken],
      ]) {
        const res = await request(app).get(pfad).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['history', 'totals']);
        expect(Array.isArray(res.body.history)).toBe(true);
        expect(Object.keys(res.body.totals).sort()).toEqual(['gemeinde', 'gottesdienst', 'total']);
        for (const eintrag of res.body.history) {
          expect(Object.keys(eintrag).sort()).toEqual([...felder].sort());
        }
      }
    });

    it('Mandantengrenze: der Gesamtstand einer FREMDEN Org zaehlt auf BEIDEN Wegen nicht mit', async () => {
      // Der konkrete Drift-Fall (Befund M1): Bis 01.09.2026 las nur der
      // Konfi-Weg konfi_profiles mit organization_id-Filter. Steht die
      // Profilzeile auf einer fremden Org, lieferte der Teamer-Weg die
      // fremden Punkte weiter aus.
      for (const userId of [USERS.konfi1.id, USERS.teamer1.id]) {
        await db.query('DELETE FROM bonus_points WHERE konfi_id = $1', [userId]);
        await db.query('DELETE FROM user_activities WHERE user_id = $1', [userId]);
        await db.query('DELETE FROM event_points WHERE konfi_id = $1', [userId]);
        // Die Profilzeile liegt auf der FREMDEN Organisation
        await db.query(
          `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
           VALUES ($1, NULL, 99, 99, $2)
           ON CONFLICT (user_id) DO UPDATE
           SET gottesdienst_points = 99, gemeinde_points = 99,
               jahrgang_id = NULL, organization_id = EXCLUDED.organization_id`,
          [userId, ORGS.andereGemeinde.id]
        );
      }

      const konfiRes = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.status).toBe(200);
      expect(teamerRes.status).toBe(200);
      expect(konfiRes.body.totals).toEqual({ gottesdienst: 0, gemeinde: 0, total: 0 });
      expect(teamerRes.body.totals).toEqual({ gottesdienst: 0, gemeinde: 0, total: 0 });
    });

    it('Mandantengrenze: Eintraege einer fremden Org tauchen auf keinem Weg auf', async () => {
      await gleicheAusgangslage(USERS.konfi1.id, ORGS.testGemeinde.id);
      await gleicheAusgangslage(USERS.teamer1.id, ORGS.testGemeinde.id);

      // Zusaetzlicher Bonuspunkt, aber auf die FREMDE Organisation gebucht
      for (const userId of [USERS.konfi1.id, USERS.teamer1.id]) {
        await db.query(
          `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date, organization_id)
           VALUES ($1, 50, 'gemeinde', 'Fremde Org', $2, '2026-04-01', $3)`,
          [userId, USERS.admin2.id, ORGS.andereGemeinde.id]
        );
      }

      const konfiRes = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.body.history).toHaveLength(3);
      expect(teamerRes.body.history).toHaveLength(3);
      expect(konfiRes.body.history.some((h) => h.title === 'Fremde Org')).toBe(false);
      expect(teamerRes.body.history.some((h) => h.title === 'Fremde Org')).toBe(false);
    });

    it('leere Ausgangslage: beide Wege liefern leere Historie und Nullstaende', async () => {
      for (const userId of [USERS.konfi1.id, USERS.teamer1.id]) {
        await db.query('DELETE FROM bonus_points WHERE konfi_id = $1', [userId]);
        await db.query('DELETE FROM user_activities WHERE user_id = $1', [userId]);
        await db.query('DELETE FROM event_points WHERE konfi_id = $1', [userId]);
      }

      const konfiRes = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.status).toBe(200);
      expect(teamerRes.status).toBe(200);
      expect(konfiRes.body.history).toEqual([]);
      expect(teamerRes.body.history).toEqual([]);
      expect(konfiRes.body.totals).toEqual({ gottesdienst: 0, gemeinde: 0, total: 0 });
      expect(teamerRes.body.totals).toEqual({ gottesdienst: 0, gemeinde: 0, total: 0 });
    });
  });
  // ================================================================
  // M3 — POST /requests: Idempotenz und client_id-Race
  // Der 23505-Catch fehlte im Teamer-Pfad (Befund M3, 01.09.2026):
  // Ein Wiederholungsversuch lieferte dort einen 500er statt des
  // bereits gestellten Antrags.
  // ================================================================
  describe('POST /requests: Wiederholungsversuch mit derselben client_id', () => {
    const KONFI_CLIENT_ID = '11111111-1111-4111-8111-111111111111';
    const TEAMER_CLIENT_ID = '22222222-2222-4222-8222-222222222222';
    let teamerActivityId;

    beforeEach(async () => {
      // Der Seed kennt nur Konfi-Aktivitaeten; der Teamer-Weg verlangt
      // target_role='teamer'.
      const { rows: [act] } = await db.query(
        `INSERT INTO activities (name, points, type, target_role, organization_id)
         VALUES ('Teamer-Schulung', 2, 'gemeinde', 'teamer', $1) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      teamerActivityId = act.id;
    });

    // Stellt den Race nach: Der Antrag existiert bereits, wenn der
    // Vorab-Check laeuft, ist aber noch nicht sichtbar — genau das, was
    // zwischen SELECT und INSERT passieren kann. Nachgestellt wird das,
    // indem der Vorab-Check einmalig uebersprungen wird.
    async function raceNachstellen(clientId, insertFn) {
      // 1. Antrag reell anlegen (das ist der "erste" Versuch, dessen
      //    Antwort die App nie erreicht hat)
      await insertFn(clientId);
      // 2. Der Wiederholungsversuch laeuft nun in den UNIQUE-Index
    }

    it('Konfi: zweiter Versuch liefert 200 mit dem vorhandenen Antrag, kein zweiter Antrag', async () => {
      const senden = () => request(app)
        .post('/api/konfi/requests')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          activity_id: ACTIVITIES.sonntagsgottesdienst.id,
          requested_date: '2026-03-01',
          client_id: KONFI_CLIENT_ID,
        });

      const ersteAntwort = await senden();
      expect(ersteAntwort.status).toBe(201);

      const zweiteAntwort = await senden();
      expect(zweiteAntwort.status).toBe(200);
      expect(zweiteAntwort.body.client_id).toBe(KONFI_CLIENT_ID);
      expect(zweiteAntwort.body.id).toBe(ersteAntwort.body.id);

      const { rows } = await db.query(
        'SELECT id FROM activity_requests WHERE client_id = $1', [KONFI_CLIENT_ID]
      );
      expect(rows).toHaveLength(1);
    });

    it('Teamer: zweiter Versuch liefert 200 mit dem vorhandenen Antrag, kein zweiter Antrag', async () => {
      const senden = () => request(app)
        .post('/api/teamer/requests')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          activity_id: teamerActivityId,
          requested_date: '2026-03-01',
          client_id: TEAMER_CLIENT_ID,
        });

      const ersteAntwort = await senden();
      expect(ersteAntwort.status).toBe(201);

      const zweiteAntwort = await senden();
      expect(zweiteAntwort.status).toBe(200);
      expect(zweiteAntwort.body.client_id).toBe(TEAMER_CLIENT_ID);
      expect(zweiteAntwort.body.id).toBe(ersteAntwort.body.id);

      const { rows } = await db.query(
        'SELECT id FROM activity_requests WHERE client_id = $1', [TEAMER_CLIENT_ID]
      );
      expect(rows).toHaveLength(1);
    });

    it('Teamer: die ECHTE Race (Antrag entsteht zwischen Vorab-Check und Insert) liefert 200 statt 500', async () => {
      // Der Vorab-Check kann den Antrag nicht sehen, weil er zu diesem
      // Zeitpunkt noch nicht existiert; angelegt wird er erst waehrend der
      // Anfrage. Nachgestellt ueber db.query: Der erste SELECT auf
      // activity_requests liefert leer, unmittelbar danach legt der Test den
      // Antrag an. Das INSERT der Route laeuft dann in den UNIQUE-Index.
      const echteRaceId = '33333333-3333-4333-8333-333333333333';
      const originalQuery = db.query.bind(db);
      let schonEingefuegt = false;

      db.query = async (text, params) => {
        const ergebnis = await originalQuery(text, params);
        if (!schonEingefuegt && typeof text === 'string'
            && text.includes('FROM activity_requests WHERE client_id')) {
          schonEingefuegt = true;
          // Konkurrierender Antrag, angelegt NACH dem Vorab-Check
          await originalQuery(
            `INSERT INTO activity_requests (user_id, activity_id, requested_date, comment, photo_filename, status, organization_id, client_id)
             VALUES ($1, $2, '2026-03-01', NULL, NULL, 'pending', $3, $4)`,
            [USERS.teamer1.id, teamerActivityId, ORGS.testGemeinde.id, echteRaceId]
          );
        }
        return ergebnis;
      };

      try {
        const antwort = await request(app)
          .post('/api/teamer/requests')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({
            activity_id: teamerActivityId,
            requested_date: '2026-03-01',
            client_id: echteRaceId,
          });

        expect(antwort.status).toBe(200);
        expect(antwort.body.client_id).toBe(echteRaceId);
        expect(antwort.body.status).toBe('pending');
      } finally {
        db.query = originalQuery;
      }

      const { rows } = await db.query(
        'SELECT id FROM activity_requests WHERE client_id = $1', [echteRaceId]
      );
      expect(rows).toHaveLength(1);
    });

    it('Antwortform des Wiederholungsversuchs unveraendert (beide Wege, dieselben Felder)', async () => {
      const felder = ['id', 'user_id', 'activity_id', 'requested_date', 'comment',
        'photo_filename', 'status', 'organization_id', 'client_id', 'created_at', 'updated_at'];

      const faelle = [
        ['/api/konfi/requests', konfiToken, ACTIVITIES.sonntagsgottesdienst.id, KONFI_CLIENT_ID],
        ['/api/teamer/requests', teamerToken, teamerActivityId, TEAMER_CLIENT_ID],
      ];

      for (const [pfad, token, activityId, clientId] of faelle) {
        const koerper = { activity_id: activityId, requested_date: '2026-03-01', client_id: clientId };
        const erste = await request(app).post(pfad).set('Authorization', `Bearer ${token}`).send(koerper);
        expect(erste.status).toBe(201);
        // Erstanlage: {id, message} — Vertrag der ausgelieferten Apps
        expect(Object.keys(erste.body).sort()).toEqual(['id', 'message']);

        const zweite = await request(app).post(pfad).set('Authorization', `Bearer ${token}`).send(koerper);
        expect(zweite.status).toBe(200);
        expect(Object.keys(zweite.body).sort()).toEqual([...felder].sort());
      }
    });
  });
  // ================================================================
  // M4 — Konfsprueche und Bibeluebersetzungs-Whitelist
  // Die Whitelist lag doppelt im Code; die RVR60-Entfernung am 27.08.2026
  // musste an beiden Stellen passieren (dokumentierte Drift-Geschichte).
  // ================================================================
  describe('Konfsprueche und Bibeluebersetzung', () => {
    beforeEach(async () => {
      // Ein org-eigener und ein globaler Spruch, mit Uebersetzungen
      await db.query(
        `INSERT INTO konfsprueche (id, reference, book, chapter, verse, is_active, sort_order, organization_id)
         VALUES (1, 'Psalm 23,1', 'Psalm', 23, 1, true, 1, $1),
                (2, 'Joh 3,16', 'Johannes', 3, 16, true, 2, NULL)`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
         VALUES (1, 'luther2017', 'Der HERR ist mein Hirte.'),
                (1, 'bigs', 'Adonaj weidet mich.'),
                (2, 'luther2017', 'Also hat Gott die Welt geliebt.')`
      );
    });

    it('GET /konfsprueche liefert auf beiden Wegen exakt dasselbe', async () => {
      const konfiRes = await request(app)
        .get('/api/konfi/konfsprueche')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/konfsprueche')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.status).toBe(200);
      expect(teamerRes.status).toBe(200);
      expect(konfiRes.body).toEqual(teamerRes.body);

      // Antwortform: ARRAY (nicht Objekt) — Vertrag der ausgelieferten Apps
      expect(Array.isArray(konfiRes.body)).toBe(true);
      expect(Array.isArray(teamerRes.body)).toBe(true);
      expect(konfiRes.body).toHaveLength(2);

      const ersteFelder = ['id', 'reference', 'book', 'chapter', 'verse', 'uebersetzungen'];
      expect(Object.keys(konfiRes.body[0]).sort()).toEqual([...ersteFelder].sort());

      // Alle vier Uebersetzungs-Keys sind da, fehlende als leerer String
      expect(konfiRes.body[0].uebersetzungen).toEqual({
        luther2017: 'Der HERR ist mein Hirte.',
        bigs: 'Adonaj weidet mich.',
        gute_nachricht: '',
        elberfelder: '',
      });
    });

    it('GET /konfsprueche: Sprueche einer FREMDEN Org tauchen auf keinem Weg auf', async () => {
      await db.query(
        `INSERT INTO konfsprueche (id, reference, book, chapter, verse, is_active, sort_order, organization_id)
         VALUES (3, 'Fremd 1,1', 'Fremd', 1, 1, true, 3, $1)`,
        [ORGS.andereGemeinde.id]
      );

      const konfiRes = await request(app)
        .get('/api/konfi/konfsprueche')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/konfsprueche')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.body).toHaveLength(2);
      expect(teamerRes.body).toHaveLength(2);
      expect(konfiRes.body.some((sp) => sp.reference === 'Fremd 1,1')).toBe(false);
      expect(teamerRes.body.some((sp) => sp.reference === 'Fremd 1,1')).toBe(false);
    });

    it('PUT /bible-translation: dieselbe Whitelist auf beiden Wegen', async () => {
      const erlaubt = ['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG'];
      // RVR60 wurde am 27.08.2026 entfernt und muss auf BEIDEN Wegen fehlen.
      // Der Leerstring bleibt bewusst aussen vor: Der Konfi-Weg hat davor
      // eine notEmpty-Middleware, der Teamer-Weg nicht (dokumentierter
      // Unterschied, Befund N6) — hier geht es um die Whitelist selbst.
      const verboten = ['RVR60', 'XYZ', 'rvr60'];

      for (const [pfad, token] of [
        ['/api/konfi/bible-translation', konfiToken],
        ['/api/teamer/bible-translation', teamerToken],
      ]) {
        for (const translation of erlaubt) {
          const res = await request(app).put(pfad)
            .set('Authorization', `Bearer ${token}`).send({ translation });
          expect(res.status).toBe(200);
          expect(res.body.translation).toBe(translation);
          expect(res.body.success).toBe(true);
        }
        for (const translation of verboten) {
          const res = await request(app).put(pfad)
            .set('Authorization', `Bearer ${token}`).send({ translation });
          expect(res.status).toBe(400);
          expect(res.body.valid_translations).toEqual(erlaubt);
        }
      }
    });

    it('PATCH /profile: Listen-Wahl setzt auf beiden Wegen denselben Spruch', async () => {
      const koerper = { konfspruch_id: 1, translation: 'luther2017' };

      const konfiRes = await request(app).patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`).send(koerper);
      const teamerRes = await request(app).patch('/api/teamer/profile')
        .set('Authorization', `Bearer ${teamerToken}`).send(koerper);

      expect(konfiRes.status).toBe(200);
      expect(teamerRes.status).toBe(200);
      expect(konfiRes.body).toEqual({
        success: true,
        konfspruch: { source: 'liste', id: 1, translation: 'luther2017' },
      });
      expect(teamerRes.body).toEqual(konfiRes.body);
    });

    it('PATCH /profile: ungueltige Uebersetzung wird auf beiden Wegen mit 400 abgelehnt', async () => {
      const koerper = { konfspruch_id: 1, translation: 'LUT' }; // Tageslosungs-Kuerzel, kein Spruch-Key
      const erwartet = ['luther2017', 'bigs', 'gute_nachricht', 'elberfelder'];

      for (const [pfad, token] of [
        ['/api/konfi/profile', konfiToken],
        ['/api/teamer/profile', teamerToken],
      ]) {
        const res = await request(app).patch(pfad)
          .set('Authorization', `Bearer ${token}`).send(koerper);
        expect(res.status).toBe(400);
        expect(res.body.valid_translations).toEqual(erwartet);
      }
    });

    it('PATCH /profile: Spruch einer FREMDEN Org wird auf beiden Wegen mit 404 abgelehnt', async () => {
      await db.query(
        `INSERT INTO konfsprueche (id, reference, book, chapter, verse, is_active, sort_order, organization_id)
         VALUES (3, 'Fremd 1,1', 'Fremd', 1, 1, true, 3, $1)`,
        [ORGS.andereGemeinde.id]
      );
      const koerper = { konfspruch_id: 3, translation: 'luther2017' };

      for (const [pfad, token] of [
        ['/api/konfi/profile', konfiToken],
        ['/api/teamer/profile', teamerToken],
      ]) {
        const res = await request(app).patch(pfad)
          .set('Authorization', `Bearer ${token}`).send(koerper);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Konfispruch nicht gefunden');
      }
    });

    it('PATCH /profile: Freitext verlangt auf beiden Wegen eine Referenz', async () => {
      for (const [pfad, token] of [
        ['/api/konfi/profile', konfiToken],
        ['/api/teamer/profile', teamerToken],
      ]) {
        const ohneReferenz = await request(app).patch(pfad)
          .set('Authorization', `Bearer ${token}`)
          .send({ konfspruch_freitext: 'Mein eigener Spruch' });
        expect(ohneReferenz.status).toBe(400);
        expect(ohneReferenz.body.error).toBe(
          'Bei einem eigenen Spruch ist die Stellenangabe (Referenz) verpflichtend'
        );

        const mitReferenz = await request(app).patch(pfad)
          .set('Authorization', `Bearer ${token}`)
          .send({ konfspruch_freitext: 'Mein eigener Spruch', konfspruch_freitext_referenz: 'Mk 1,1' });
        expect(mitReferenz.status).toBe(200);
        expect(mitReferenz.body).toEqual({
          success: true,
          konfspruch: { source: 'freitext', text: 'Mein eigener Spruch', reference: 'Mk 1,1' },
        });
      }
    });

    it('Listen-Wahl und Freitext schliessen sich auf beiden Wegen aus', async () => {
      const faelle = [
        ['/api/konfi/profile', konfiToken, USERS.konfi1.id],
        ['/api/teamer/profile', teamerToken, USERS.teamer1.id],
      ];

      for (const [pfad, token, userId] of faelle) {
        await request(app).patch(pfad).set('Authorization', `Bearer ${token}`)
          .send({ konfspruch_freitext: 'Erst Freitext', konfspruch_freitext_referenz: 'Mk 1,1' });
        await request(app).patch(pfad).set('Authorization', `Bearer ${token}`)
          .send({ konfspruch_id: 1, translation: 'bigs' });

        const { rows: [profil] } = await db.query(
          `SELECT konfspruch_id, konfspruch_translation, konfspruch_freitext, konfspruch_freitext_referenz
           FROM konfi_profiles WHERE user_id = $1`,
          [userId]
        );
        expect(profil.konfspruch_id).toBe(1);
        expect(profil.konfspruch_translation).toBe('bigs');
        expect(profil.konfspruch_freitext).toBeNull();
        expect(profil.konfspruch_freitext_referenz).toBeNull();
      }
    });
  });
});
