// backend/tests/routes/konfiTerminOhneJahrgang.test.js
//
// Welche Termine eine Konfi sieht, oeffnet und bucht -- EINE Regel
// (utils/konfiTerminSicht.js).
//
// Simon, 27.09.2026 (Audit "Wer bekommt was", F-05): Ein Termin ohne jeden
// Jahrgang gilt der ganzen Gemeinde -- alle Konfis sehen ihn, bekommen
// "Neues Event!" und koennen ihn buchen, auch eine Konfi ohne Jahrgang.
// Termine fremder Jahrgaenge und "Nur Team" bleiben unsichtbar.
//
// Bis dahin zeigte die Liste einen Termin ohne Jahrgang keiner Konfi. Und
// zwei Luecken lagen daneben:
//   - Buchen pruefte fuer Konfis keinen Jahrgang: Mit der Kennung eines
//     Termins eines anderen Jahrgangs meldete sich eine Konfi an.
//   - Status, Teilnehmende und Zeitfenster prueften nur die Gemeinde: Die
//     Teilnehmenden ("Vorname N.") eines fremden Jahrgangs waren lesbar.
//
// Die Assertions pruefen konkrete Werte: die genaue Terminmenge der Liste,
// den Statuscode UND ob eine Buchungszeile entstanden ist.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const ORG1 = ORGS.testGemeinde.id;

const JG_B = 311;           // zweiter Jahrgang derselben Gemeinde
const KONFI_B = 511;        // Konfi im Jahrgang B
const KONFI_OHNE_JG = 512;  // Konfi ohne Jahrgang

const konfiToken = (id) => jwt.sign(
  { id, type: 'konfi', display_name: `Konfi ${id}`, organization_id: ORG1, role_id: 1 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('Konfi-Termine: eigener Jahrgang und Termine ohne Jahrgang (F-05)', () => {
  let db;
  let app;
  let termine;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  async function termin({ jahrgaenge = [], teamerOnly = false, name = 'Termin', zeitfenster = false } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, teamer_only, mandatory, max_participants,
                           has_timeslots, point_type, points)
       VALUES ($1, NOW() + INTERVAL '10 days', $2, $3, false, 20, $4, 'gemeinde', 1)
       RETURNING id`,
      [name, ORG1, teamerOnly, zeitfenster]
    );
    for (const j of jahrgaenge) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, j]);
    }
    return e.id;
  }

  const buchungen = async (eventId, userId) => {
    const { rows } = await db.query(
      'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return rows.map((r) => r.status);
  };

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 B', $2, '2027-05-01')`,
      [JG_B, ORG1]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'konfi_b', 'x', 'Berta Beispiel', 1, $3, true),
              ($2, 'konfi_ohne', 'x', 'Otto Ohne', 1, $3, true)`,
      [KONFI_B, KONFI_OHNE_JG, ORG1]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id)
       VALUES ($1, $2, $4), ($3, NULL, $4)`,
      [KONFI_B, JG_B, KONFI_OHNE_JG, ORG1]
    );
    for (const id of [KONFI_B, KONFI_OHNE_JG, USERS.konfi1.id]) invalidateUserCache(id);

    termine = {
      jahrgang1: await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id], name: 'Jahrgang 1' }),
      jahrgangB: await termin({ jahrgaenge: [JG_B], name: 'Jahrgang B' }),
      ohneJahrgang: await termin({ name: 'Gemeindefest' }),
      nurTeam: await termin({ teamerOnly: true, name: 'Teamtreffen' }),
    };
  });

  const listeVon = async (konfiId) => {
    const res = await request(app).get('/api/konfi/events').set('Authorization', `Bearer ${konfiToken(konfiId)}`);
    expect(res.status).toBe(200);
    return res.body.map((e) => e.id).filter((id) => Object.values(termine).includes(id)).sort((a, b) => a - b);
  };

  describe('Liste', () => {
    it('Konfi mit Jahrgang: eigener Jahrgang und der Termin ohne Jahrgang, sonst nichts', async () => {
      expect(await listeVon(USERS.konfi1.id)).toEqual([termine.jahrgang1, termine.ohneJahrgang].sort((a, b) => a - b));
      expect(await listeVon(KONFI_B)).toEqual([termine.jahrgangB, termine.ohneJahrgang].sort((a, b) => a - b));
    });

    it('Konfi ohne Jahrgang: genau der Termin ohne Jahrgang', async () => {
      expect(await listeVon(KONFI_OHNE_JG)).toEqual([termine.ohneJahrgang]);
    });
  });

  describe('Buchen', () => {
    const anmelden = (konfiId, eventId) => request(app)
      .post(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${konfiToken(konfiId)}`)
      .send({});

    it('verboten: Konfi meldet sich zu einem Termin eines fremden Jahrgangs an -- 403, keine Buchung', async () => {
      const res = await anmelden(USERS.konfi1.id, termine.jahrgangB);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Dieses Event gehört zu einem anderen Jahrgang');
      expect(await buchungen(termine.jahrgangB, USERS.konfi1.id)).toEqual([]);
    });

    it('verboten: auch ueber POST /events/:id/book', async () => {
      const res = await request(app)
        .post(`/api/events/${termine.jahrgangB}/book`)
        .set('Authorization', `Bearer ${konfiToken(USERS.konfi1.id)}`)
        .send({});
      expect(res.status).toBe(403);
      expect(await buchungen(termine.jahrgangB, USERS.konfi1.id)).toEqual([]);
    });

    it('verboten: Konfi ohne Jahrgang meldet sich zu einem Jahrgangstermin an -- 403', async () => {
      const res = await anmelden(KONFI_OHNE_JG, termine.jahrgang1);
      expect(res.status).toBe(403);
      expect(await buchungen(termine.jahrgang1, KONFI_OHNE_JG)).toEqual([]);
    });

    it('erlaubt: Termin des eigenen Jahrgangs', async () => {
      const res = await anmelden(USERS.konfi1.id, termine.jahrgang1);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
      expect(await buchungen(termine.jahrgang1, USERS.konfi1.id)).toEqual(['confirmed']);
    });

    it('erlaubt: Termin ohne Jahrgang -- fuer Konfis mit und ohne Jahrgang', async () => {
      for (const konfi of [USERS.konfi1.id, KONFI_B, KONFI_OHNE_JG]) {
        const res = await anmelden(konfi, termine.ohneJahrgang);
        expect({ konfi, status: res.status }).toEqual({ konfi, status: 200 });
        expect(await buchungen(termine.ohneJahrgang, konfi)).toEqual(['confirmed']);
      }
    });
  });

  describe('Status, Teilnehmende, Zeitfenster', () => {
    const lesen = (konfiId, eventId, pfad) => request(app)
      .get(`/api/konfi/events/${eventId}/${pfad}`)
      .set('Authorization', `Bearer ${konfiToken(konfiId)}`);

    it('verboten: Termin eines fremden Jahrgangs -- 404 wie ein unbekannter Termin, keine Namen', async () => {
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [termine.jahrgangB, KONFI_B, ORG1]
      );
      for (const pfad of ['status', 'participants', 'timeslots']) {
        const res = await lesen(USERS.konfi1.id, termine.jahrgangB, pfad);
        expect({ pfad, status: res.status }).toEqual({ pfad, status: 404 });
        expect(JSON.stringify(res.body)).not.toContain('Berta');
      }
    });

    it('verboten: "Nur Team" -- 404', async () => {
      for (const pfad of ['status', 'participants', 'timeslots']) {
        const res = await lesen(USERS.konfi1.id, termine.nurTeam, pfad);
        expect({ pfad, status: res.status }).toEqual({ pfad, status: 404 });
      }
    });

    it('erlaubt: Termin ohne Jahrgang -- Teilnehmende aus allen Jahrgaengen, abgekuerzt', async () => {
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [termine.ohneJahrgang, KONFI_B, ORG1]
      );
      const teilnehmende = await lesen(KONFI_OHNE_JG, termine.ohneJahrgang, 'participants');
      expect(teilnehmende.status).toBe(200);
      expect(teilnehmende.body).toEqual([{ id: KONFI_B, display_name: 'Berta B.' }]);

      const status = await lesen(KONFI_OHNE_JG, termine.ohneJahrgang, 'status');
      expect(status.status).toBe(200);
      expect(status.body.is_registered).toBe(false);
      expect(status.body.confirmed_count).toBe(1);

      const zeitfenster = await lesen(KONFI_OHNE_JG, termine.ohneJahrgang, 'timeslots');
      expect(zeitfenster.status).toBe(200);
      expect(zeitfenster.body).toEqual([]);
    });

    it('erlaubt: Termin des eigenen Jahrgangs', async () => {
      const res = await lesen(USERS.konfi1.id, termine.jahrgang1, 'status');
      expect(res.status).toBe(200);
      expect(res.body.can_register).toBe(true);
    });

    it('erlaubt: eigene Buchung bleibt lesbar, auch wenn der Jahrgang inzwischen ein anderer ist', async () => {
      // Die Konfi war in Jahrgang B gebucht und ist danach in Jahrgang 1
      // gewechselt (vergangene Buchungen mit Anwesenheit bleiben dabei stehen).
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [termine.jahrgangB, USERS.konfi1.id, ORG1]
      );
      const res = await lesen(USERS.konfi1.id, termine.jahrgangB, 'status');
      expect(res.status).toBe(200);
      expect(res.body.is_registered).toBe(true);
    });
  });
});
