// Passt die HINZUGEFUEGTE Person zum Jahrgang des Termins? (25.09.2026)
//
// POST /api/events/:id/participants pruefte seit dem 14.09.2026 den HANDELNDEN
// Admin (darfTermin) — die Person, die er eintraegt, wurde nur ueber
// organization_id geholt. Ein Konfi aus Jahrgang B liess sich in einen Termin
// von Jahrgang A eintragen, eine Teamer:in ohne Zuweisung ebenso.
//
// Simons Ansage: "Das muss fuer die Konfi-Hinzufuegen-Liste gelten, und das
// muss fuer die Team-Hinzufuegen-Liste gelten. Es muss geprueft werden, ob
// dieser Termin zu den zugewiesenen Jahrgaengen passt. Denkt daran: Ein Termin
// kann auch mehrere Jahrgaenge haben."
//
// Regel (utils/jahrgangsZugriff.js, gehoertZumTermin):
//   - EIN gemeinsamer Jahrgang genuegt (Termine sind n:m)
//   - Termin ohne Jahrgang: immer erlaubt
//   - teamer_only: immer erlaubt
//   - org_admin / super_admin (Rolle oder Flag): immer erlaubt
//   - Konfis ueber konfi_profiles.jahrgang_id, Team ueber
//     user_jahrgang_assignments — beide Wege werden hier getrennt geprueft.
//
// Der Aufrufer ist in fast allen Faellen ein Admin, der den Termin SEHEN darf
// (JG_A). So faellt jede 403 nachweislich auf die eingetragene Person, nicht
// auf den Aufrufer.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const JG_A = 311;            // Jahrgang des Termins und des Admins
const JG_B = 312;            // fremder Jahrgang
const ADMIN_MIT_JG_A = 411;  // handelnder Admin, nur JG_A
const KONFI_A = 412;         // Konfi in JG_A
const KONFI_B = 413;         // Konfi in JG_B
const TEAMER_A = 414;        // Teamer:in nur in JG_A
const TEAMER_B = 415;        // Teamer:in nur in JG_B
const TEAMER_AB = 416;       // Teamer:in in JG_A UND JG_B
const TEAMER_OHNE = 417;     // Teamer:in ohne jede Zuweisung
const ADMIN_B = 418;         // Leitung (admin) nur in JG_B

function tokenFuer(id, roleId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Hinzugefuegte Person muss zum Jahrgang des Termins passen', () => {
  let app;
  let db;
  let adminToken;
  let orgAdminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 TP-A', 1, '2027-05-01'), ($2, '2026/2027 TP-B', 1, '2027-05-01')`,
      [JG_A, JG_B]
    );

    // Rollen aus seed.js: konfi=1, teamer=2, admin=3
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'tp_admin_a',  'x', 'Leitung A',     3, 1, true),
              ($2, 'tp_konfi_a',  'x', 'Konfi Anna',    1, 1, true),
              ($3, 'tp_konfi_b',  'x', 'Konfi Bela',    1, 1, true),
              ($4, 'tp_teamer_a', 'x', 'Teamer Ada',    2, 1, true),
              ($5, 'tp_teamer_b', 'x', 'Teamer Ben',    2, 1, true),
              ($6, 'tp_teamer_ab','x', 'Teamer Chris',  2, 1, true),
              ($7, 'tp_teamer_0', 'x', 'Teamer Dana',   2, 1, true),
              ($8, 'tp_admin_b',  'x', 'Leitung B',     3, 1, true)`,
      [ADMIN_MIT_JG_A, KONFI_A, KONFI_B, TEAMER_A, TEAMER_B, TEAMER_AB, TEAMER_OHNE, ADMIN_B]
    );

    // Konfis: EIN Jahrgang ueber konfi_profiles
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id, gottesdienst_points, gemeinde_points)
       VALUES ($1, $3, 1, 0, 0), ($2, $4, 1, 0, 0)`,
      [KONFI_A, KONFI_B, JG_A, JG_B]
    );

    // Team und Leitung: MEHRERE Jahrgaenge ueber user_jahrgang_assignments
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $6, true, true),
              ($2, $6, true, false),
              ($3, $7, true, false),
              ($4, $6, true, false), ($4, $7, true, false),
              ($5, $7, true, true)`,
      [ADMIN_MIT_JG_A, TEAMER_A, TEAMER_B, TEAMER_AB, ADMIN_B, JG_A, JG_B]
    );

    adminToken = tokenFuer(ADMIN_MIT_JG_A, 3);
    orgAdminToken = generateToken('orgAdmin1');

    const { invalidateUserCache } = require('../../middleware/rbac');
    [ADMIN_MIT_JG_A, USERS.orgAdmin1.id].forEach(invalidateUserCache);
  });

  // Termin anlegen, wahlweise mit einem oder mehreren Jahrgaengen.
  async function terminAnlegen({ jahrgangIds = [], teamerOnly = false, teamerNeeded = true } = {}) {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, description, event_date, location, organization_id,
                           teamer_only, teamer_needed, max_participants, teamer_max_participants)
       VALUES ('Passungstest', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, $1, $2, 20, 0)
       RETURNING id`,
      // teamer_only und teamer_needed schliessen sich aus (events_teamer_exclusive).
      [teamerOnly, teamerOnly ? false : teamerNeeded]
    );
    for (const jg of jahrgangIds) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, jg]
      );
    }
    return event.id;
  }

  async function eintragen(eventId, userId, token = adminToken) {
    return request(app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: userId, status: 'confirmed' });
  }

  async function buchungen(eventId, userId) {
    const { rows } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return rows.length;
  }

  // ------------------------------------------------------------------
  // Konfis: der Weg ueber konfi_profiles.jahrgang_id
  // ------------------------------------------------------------------
  describe('Konfi-Liste (konfi_profiles.jahrgang_id)', () => {
    it('VERBOTEN: Konfi aus Jahrgang B kommt nicht in einen Termin von Jahrgang A — 403 mit Namen, keine Buchung', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, KONFI_B);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Konfi Bela gehört zu keinem Jahrgang dieses Termins');
      expect(res.body.error_code).toBe('person_jahrgang_fremd');
      expect(await buchungen(id, KONFI_B)).toBe(0);
    });

    it('VERBOTEN: auch der Org-Admin als Aufrufer aendert daran nichts — es geht um die Person, nicht den Aufrufer', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, KONFI_B, orgAdminToken);

      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('person_jahrgang_fremd');
      expect(await buchungen(id, KONFI_B)).toBe(0);
    });

    it('ERLAUBT: Konfi aus Jahrgang A kommt in den Termin von Jahrgang A — 201, Buchung bestaetigt', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, KONFI_A);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(await buchungen(id, KONFI_A)).toBe(1);
    });

    it('ERLAUBT: Termin mit ZWEI Jahrgaengen (A und B) — Konfi aus B passt zu einem davon', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A, JG_B] });

      const res = await eintragen(id, KONFI_B);

      expect(res.status).toBe(201);
      expect(await buchungen(id, KONFI_B)).toBe(1);
    });

    it('ERLAUBT: Termin OHNE Jahrgang nimmt Konfi aus jedem Jahrgang', async () => {
      const id = await terminAnlegen({ jahrgangIds: [] });

      const res = await eintragen(id, KONFI_B);

      expect(res.status).toBe(201);
      expect(await buchungen(id, KONFI_B)).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Team: der Weg ueber user_jahrgang_assignments
  // ------------------------------------------------------------------
  describe('Team-Liste (user_jahrgang_assignments)', () => {
    it('VERBOTEN: Teamer:in nur in Jahrgang B kommt nicht in einen Termin von Jahrgang A — 403, keine Buchung', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, TEAMER_B);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Teamer Ben gehört zu keinem Jahrgang dieses Termins');
      expect(res.body.error_code).toBe('person_jahrgang_fremd');
      expect(await buchungen(id, TEAMER_B)).toBe(0);
    });

    it('VERBOTEN: Teamer:in ohne jede Zuweisung kommt nicht in einen Jahrgangstermin', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, TEAMER_OHNE);

      expect(res.status).toBe(403);
      expect(await buchungen(id, TEAMER_OHNE)).toBe(0);
    });

    it('VERBOTEN: Leitung (admin) nur in Jahrgang B kommt nicht in einen Termin von Jahrgang A', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, ADMIN_B);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Leitung B gehört zu keinem Jahrgang dieses Termins');
      expect(await buchungen(id, ADMIN_B)).toBe(0);
    });

    it('ERLAUBT: Teamer:in in Jahrgang A kommt in den Termin von Jahrgang A — 201', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, TEAMER_A);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(await buchungen(id, TEAMER_A)).toBe(1);
    });

    it('ERLAUBT: Teamer:in mit MEHREREN Jahrgaengen (A und B) passt zum Termin von Jahrgang A', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, TEAMER_AB);

      expect(res.status).toBe(201);
      expect(await buchungen(id, TEAMER_AB)).toBe(1);
    });

    it('ERLAUBT: Termin mit ZWEI Jahrgaengen (A und B) — Teamer:in nur in B passt zu einem davon', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A, JG_B] });

      const res = await eintragen(id, TEAMER_B);

      expect(res.status).toBe(201);
      expect(await buchungen(id, TEAMER_B)).toBe(1);
    });

    it('ERLAUBT: Termin OHNE Jahrgang nimmt auch die Teamer:in ohne Zuweisung', async () => {
      const id = await terminAnlegen({ jahrgangIds: [] });

      const res = await eintragen(id, TEAMER_OHNE);

      expect(res.status).toBe(201);
      expect(await buchungen(id, TEAMER_OHNE)).toBe(1);
    });

    it('ERLAUBT: "Nur Team"-Termin mit Jahrgang A nimmt die Teamer:in aus Jahrgang B', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A], teamerOnly: true });

      const res = await eintragen(id, TEAMER_B);

      expect(res.status).toBe(201);
      expect(await buchungen(id, TEAMER_B)).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Gemeindeleitung: ausgenommen
  // ------------------------------------------------------------------
  describe('org_admin / super_admin sind ausgenommen', () => {
    it('ERLAUBT: org_admin ohne Jahrgangszuweisung laesst sich in einen Termin von Jahrgang A eintragen', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, USERS.orgAdmin1.id);

      expect(res.status).toBe(201);
      expect(await buchungen(id, USERS.orgAdmin1.id)).toBe(1);
    });

    it('ERLAUBT: Konto mit is_super_admin-Flag laesst sich in einen Termin von Jahrgang A eintragen', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });

      const res = await eintragen(id, USERS.orgAdminSuper.id);

      expect(res.status).toBe(201);
      expect(await buchungen(id, USERS.orgAdminSuper.id)).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Der Baustein selbst, ohne Route: beide Datenwege
  // ------------------------------------------------------------------
  describe('gehoertZumTermin (utils/jahrgangsZugriff.js)', () => {
    const { gehoertZumTermin } = require('../../utils/jahrgangsZugriff');

    it('Konfi ueber konfi_profiles: A passt, B nicht', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });
      expect(await gehoertZumTermin(db, KONFI_A, id)).toBe(true);
      expect(await gehoertZumTermin(db, KONFI_B, id)).toBe(false);
    });

    it('Teamer:in ueber user_jahrgang_assignments: A und AB passen, B und ohne nicht', async () => {
      const id = await terminAnlegen({ jahrgangIds: [JG_A] });
      expect(await gehoertZumTermin(db, TEAMER_A, id)).toBe(true);
      expect(await gehoertZumTermin(db, TEAMER_AB, id)).toBe(true);
      expect(await gehoertZumTermin(db, TEAMER_B, id)).toBe(false);
      expect(await gehoertZumTermin(db, TEAMER_OHNE, id)).toBe(false);
    });
  });
});
