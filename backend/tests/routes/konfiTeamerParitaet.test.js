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
});
