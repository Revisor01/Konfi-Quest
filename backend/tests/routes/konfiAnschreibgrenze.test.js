// Anschreibgrenze fuer Konfis (Simons Korrektur vom 01.09.2026), woertlich:
// "Konfis duerfen nur org Admins und Admins und Teamer ihres Jahrgangs
// anschreiben!"
//
// Regel (symmetrisch zu jahrgangsBindungAdmin.test.js):
//   - org_admin: immer erreichbar — verantwortet die Gemeinde als Ganzes.
//     Gilt auch fuer eine Leitung, die ihre Rolle NUR ueber
//     user_organizations traegt (Multi-Org, realer Fall in Produktion).
//   - super_admin-Rolle und is_super_admin-Flag: wie org_admin
//     (gleiche Quelle wie darfJahrgang in utils/jahrgangsZugriff.js).
//   - admin und teamer: nur mit gemeinsamem Jahrgang (can_view).
//   - Bestehende Direktchats bleiben nutzbar: darfRaumOeffnen prueft
//     Teilnehmerschaft, nicht Jahrgaenge — gebunden ist nur das ANLEGEN.
//
// Vorher durfte ein Konfi JEDEN Admin der Gemeinde anschreiben (nur
// Teamer:innen waren gebunden); Simon hat das am 01.09.2026 ausdruecklich
// symmetrisch entschieden.
//
// Fixtures wie in jahrgangsBindungAdmin.test.js bewusst hier statt im
// gemeinsamen Seed (der traegt ~30 andere Testdateien).

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs, damit nichts kollidiert.
const JG_A = 111;          // Jahrgang des Konfis
const JG_B = 112;          // fremder Jahrgang
const KONFI_A = 211;       // Konfi in JG_A
const ADMIN_MIT_JG = 213;  // admin, JG_A zugewiesen -> erreichbar
const ADMIN_FREMD = 214;   // admin, nur JG_B zugewiesen -> nicht erreichbar
const ADMIN_OHNE_JG = 215; // admin, keine Zuweisung -> nicht erreichbar
const ADMIN_SUPER = 216;   // admin-Rolle MIT is_super_admin-Flag -> erreichbar

function tokenFuer(id, roleId, orgId = 1, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: orgId, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Anschreibgrenze fuer Konfis (01.09.2026)', () => {
  let app;
  let db;
  let konfiAToken;

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
       VALUES ($1, 'Anschreib A', 1, '2027-05-01'), ($2, 'Anschreib B', 1, '2027-05-01')`,
      [JG_A, JG_B]
    );

    // Konfi in JG_A (role_id 1 = konfi in Org 1)
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'konfi_anschreib', 'x', 'Konfi Anschreib', 1, 1, true)`,
      [KONFI_A]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, 1)`,
      [KONFI_A, JG_A]
    );

    // Drei Admins (role_id 3 = admin in Org 1): zustaendig, fremd, unzugewiesen
    for (const [id, name] of [
      [ADMIN_MIT_JG, 'Admin zustaendig'],
      [ADMIN_FREMD, 'Admin fremder Jahrgang'],
      [ADMIN_OHNE_JG, 'Admin unzugewiesen'],
    ]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 3, 1, true)`,
        [id, `admin_a_${id}`, name]
      );
    }
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true), ($3, $4, true, true)`,
      [ADMIN_MIT_JG, JG_A, ADMIN_FREMD, JG_B]
    );

    // admin-Rolle MIT is_super_admin-Flag: muss wie org_admin erreichbar sein.
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active, is_super_admin)
       VALUES ($1, 'admin_a_super', 'x', 'Admin Super-Flag', 3, 1, true, true)`,
      [ADMIN_SUPER]
    );

    // Multi-Org-Leitung (Simons Konstellation): admin2 lebt primaer in Org 2,
    // ist aber ueber user_organizations org_admin in Org 1. rbac.js schreibt
    // die Rolle beim Org-Wechsel genauso um — die Konfis der Org 1 muessen
    // ihn erreichen koennen (role_id 4 = org_admin in Org 1).
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, 4)`,
      [USERS.admin2.id]
    );

    konfiAToken = tokenFuer(KONFI_A, 1, 1, 'konfi');

    // rbac cacht req.user 30 s — neue Nutzer sauber halten.
    const { invalidateUserCache } = require('../../middleware/rbac');
    for (const id of [KONFI_A, ADMIN_MIT_JG, ADMIN_FREMD, ADMIN_OHNE_JG, ADMIN_SUPER, USERS.admin2.id]) {
      invalidateUserCache(id);
    }
  });

  // Anzahl der Direktraeume, in denen BEIDE Nutzer Teilnehmer sind.
  const direktRaeume = async (userA, userB) => {
    const { rows } = await db.query(
      `SELECT COUNT(DISTINCT cr.id)::int AS c
         FROM chat_rooms cr
         JOIN chat_participants pa ON pa.room_id = cr.id AND pa.user_id = $1
         JOIN chat_participants pb ON pb.room_id = cr.id AND pb.user_id = $2
        WHERE cr.type = 'direct'`,
      [userA, userB]
    );
    return rows[0].c;
  };

  describe('POST /api/chat/direct (Konfi als Aufrufer)', () => {
    it('Admin des EIGENEN Jahrgangs -> 200, Raum entsteht', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: ADMIN_MIT_JG });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
      expect(await direktRaeume(KONFI_A, ADMIN_MIT_JG)).toBe(1);
    });

    it('Admin eines FREMDEN Jahrgangs -> 403, KEIN Raum', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: ADMIN_FREMD });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Dieser Admin ist nicht für deinen Jahrgang zuständig');
      expect(await direktRaeume(KONFI_A, ADMIN_FREMD)).toBe(0);
    });

    it('Admin OHNE jede Zuweisung -> 403 (der Fall aus Org 2/5)', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: ADMIN_OHNE_JG });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Dieser Admin ist nicht für deinen Jahrgang zuständig');
      expect(await direktRaeume(KONFI_A, ADMIN_OHNE_JG)).toBe(0);
    });

    it('org_admin ohne Zuweisung -> immer 200', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: USERS.orgAdmin1.id });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });

    it('admin-Rolle MIT is_super_admin-Flag -> 200 (wie org_admin)', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: ADMIN_SUPER });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });

    it('Multi-Org-Leitung (org_admin NUR via user_organizations) -> 200', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: USERS.admin2.id });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);

      // Teilnehmer-Typ folgt der EFFEKTIVEN Rolle (org_admin -> 'admin').
      const { rows: [teilnehmer] } = await db.query(
        `SELECT cp.user_type FROM chat_participants cp
           JOIN chat_rooms cr ON cr.id = cp.room_id
          WHERE cr.id = $1 AND cp.user_id = $2`,
        [res.body.room_id, USERS.admin2.id]
      );
      expect(teilnehmer.user_type).toBe('admin');
    });
  });

  describe('Kontaktlisten bieten nur an, was das Anschreiben erlaubt', () => {
    it('GET /api/chat/admins bleibt ein Array und filtert fremde Admins', async () => {
      const res = await request(app)
        .get('/api/chat/admins')
        .set('Authorization', `Bearer ${konfiAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map(u => u.id);
      expect(ids).toContain(ADMIN_MIT_JG);
      expect(ids).toContain(USERS.orgAdmin1.id);
      expect(ids).toContain(ADMIN_SUPER);
      expect(ids).toContain(USERS.admin2.id); // Multi-Org-Leitung
      expect(ids).not.toContain(ADMIN_FREMD);
      expect(ids).not.toContain(ADMIN_OHNE_JG);
      // teamer1 ist Jahrgang 1 zugewiesen, nicht JG_A -> unsichtbar.
      expect(ids).not.toContain(USERS.teamer1.id);
    });

    it('GET /api/chat/available-users filtert genauso (users bleibt ein Array)', async () => {
      const res = await request(app)
        .get('/api/chat/available-users')
        .set('Authorization', `Bearer ${konfiAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      const ids = res.body.users.map(u => u.id);
      expect(ids).toContain(ADMIN_MIT_JG);
      expect(ids).toContain(USERS.orgAdmin1.id);
      expect(ids).toContain(USERS.admin2.id); // Multi-Org-Leitung
      expect(ids).not.toContain(ADMIN_FREMD);
      expect(ids).not.toContain(ADMIN_OHNE_JG);
    });
  });

  describe('Bestand und Umgehungswege', () => {
    // Punkt 1 der Entscheidung: Ein VOR der Regel entstandener Direktchat
    // mit einem inzwischen fremden Admin bleibt fuer den Konfi nutzbar —
    // darfRaumOeffnen prueft Teilnehmerschaft, nicht Jahrgaenge.
    it('bestehender Direktchat mit fremdem Admin bleibt les- und beschreibbar', async () => {
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, created_by, organization_id)
         VALUES ('Altbestand', 'direct', $1, 1) RETURNING id`,
        [KONFI_A]
      );
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $2, 'konfi'), ($1, $3, 'admin')`,
        [raum.id, KONFI_A, ADMIN_FREMD]
      );

      const lesen = await request(app)
        .get(`/api/chat/rooms/${raum.id}/messages`)
        .set('Authorization', `Bearer ${konfiAToken}`);
      expect(lesen.status).toBe(200);
      expect(Array.isArray(lesen.body)).toBe(true);

      const schreiben = await request(app)
        .post(`/api/chat/rooms/${raum.id}/messages`)
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ content: 'Hallo, geht das noch?' });
      expect(schreiben.status).toBe(200);
      expect(schreiben.body.content).toBe('Hallo, geht das noch?');

      // Ein ERNEUTER Anlege-Versuch fuer dasselbe Paar gibt dagegen 403 —
      // die Pruefung laeuft vor dem Dedup; der Altbestand bleibt unberuehrt.
      const nochmal = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ target_user_id: ADMIN_FREMD });
      expect(nochmal.status).toBe(403);
      expect(await direktRaeume(KONFI_A, ADMIN_FREMD)).toBe(1);
    });

    // Punkt 2: Derselbe Umgehungsweg, der am 01.09.2026 fuer die Richtung
    // Team -> Konfi geschlossen wurde, gilt auch hier — ein Konfi kann die
    // Grenze nicht ueber POST /rooms (participants) umgehen.
    it('fremder Admin laesst sich nicht ueber POST /rooms eintragen -> 403, kein Raum', async () => {
      const vorher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');

      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfiAToken}`)
        .send({ type: 'direct', name: 'Umweg', participants: [ADMIN_FREMD] });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Dieser Admin ist nicht für deinen Jahrgang zuständig');

      const nachher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');
      expect(nachher.rows[0].c).toBe(vorher.rows[0].c);
    });
  });
});
