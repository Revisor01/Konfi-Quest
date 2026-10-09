// backend/tests/routes/zuordnungsrechtNachRolle.test.js
//
// can_edit an einer Jahrgangs-Zuweisung ist das ZUORDNUNGSRECHT (Konfis
// anlegen und verschieben, Termine an den Jahrgang binden, Teamer:innen ihm
// zuordnen, Rueckblick freigeben; utils/jahrgangsZugriff.js mit
// { edit: true }). Sehen und Bearbeiten haengen an can_view.
//
// Befund 09.10.2026 (Simon: "aufnehmen und lösen"): Das Benutzerfenster
// schickte bei jeder Zuweisung can_edit: true mit, auch fuer Teamer:innen,
// und die Route schrieb den Wert ungeprueft -- wer im Fenster gespeichert
// wurde, bekam still das Zuordnungsrecht. Dasselbe beim Anlegen eines
// Jahrgangs mit Direkt-Zuweisung.
//
// Regel seither: can_edit folgt der Rolle der Person in DIESER Gemeinde.
//   admin / org_admin -> true (die Leitung ordnet in ihren Jahrgaengen zu)
//   teamer / konfi    -> false
// Ein mitgeschickter Wert (Store-Apps 2.2.x/2.3.x schicken true) aendert
// daran nichts; die Antwortform bleibt.
//
// Seed: teamer1 (Org 1) in jahrgang1 mit can_edit false, admin1 (Org 1)
// ohne Jahrgang, orgAdmin1 org_admin in Org 1, teamer2 zuhause in Org 2.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const J1 = JAHRGAENGE.jahrgang1.id;

describe('Zuordnungsrecht (can_edit) folgt der Rolle', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });

  afterAll(async () => { await closePool(); });

  const auth = (schluessel) => ({ Authorization: `Bearer ${generateToken(schluessel)}` });

  const zuweisen = (wer, ziel, jahrgang_assignments) => request(app)
    .post(`/api/admin/users/${ziel}/jahrgaenge`)
    .set(auth(wer))
    .send({ jahrgang_assignments });

  const canEdit = async (userId, jahrgangId = J1) => {
    const { rows } = await db.query(
      'SELECT can_view, can_edit FROM user_jahrgang_assignments WHERE user_id = $1 AND jahrgang_id = $2',
      [userId, jahrgangId]
    );
    return rows.length === 1 ? rows[0].can_edit : null;
  };

  // ------------------------------------------------------------------
  // POST /users/:id/jahrgaenge -- das Benutzerfenster
  // ------------------------------------------------------------------
  describe('POST /users/:id/jahrgaenge', () => {
    it('verboten: Store-App schickt can_edit true fuer eine Teamer:in -> gespeichert wird false', async () => {
      const res = await zuweisen('orgAdmin1', USERS.teamer1.id, [{ jahrgang_id: J1, can_view: true, can_edit: true }]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Jahrgangs-Zuweisungen aktualisiert', assignments_count: 1 });
      expect(await canEdit(USERS.teamer1.id)).toBe(false);
    });

    it('Teamer:in, deren Zuweisung schon can_edit true traegt, verliert es beim naechsten Speichern', async () => {
      await db.query('UPDATE user_jahrgang_assignments SET can_edit = true WHERE user_id = $1', [USERS.teamer1.id]);
      const res = await zuweisen('orgAdmin1', USERS.teamer1.id, [{ jahrgang_id: J1, can_view: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.teamer1.id)).toBe(false);
    });

    it('erlaubt: neues Fenster ohne Feld -> ein Admin bekommt das Zuordnungsrecht', async () => {
      const res = await zuweisen('orgAdmin1', USERS.admin1.id, [{ jahrgang_id: J1, can_view: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.admin1.id)).toBe(true);
    });

    it('erlaubt: und damit darf der Admin in diesem Jahrgang wirklich zuordnen', async () => {
      await zuweisen('orgAdmin1', USERS.admin1.id, [{ jahrgang_id: J1, can_view: true }]);
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.admin1.id);

      const res = await zuweisen('admin1', USERS.teamer1.id, [{ jahrgang_id: J1, can_view: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.teamer1.id)).toBe(false);
    });

    it('Store-App schickt can_edit true fuer einen Admin -> bleibt true', async () => {
      const res = await zuweisen('orgAdmin1', USERS.admin1.id, [{ jahrgang_id: J1, can_view: true, can_edit: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.admin1.id)).toBe(true);
    });

    it('Rollenwechsel im Fenster: aus Teamer:in wird Admin -> Zuordnungsrecht kommt dazu', async () => {
      const put = await request(app).put(`/api/admin/users/${USERS.teamer1.id}`)
        .set(auth('orgAdmin1')).send({ role_id: ROLES.admin.id });
      expect(put.status).toBe(200);

      const res = await zuweisen('orgAdmin1', USERS.teamer1.id, [{ jahrgang_id: J1, can_view: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.teamer1.id)).toBe(true);
    });

    it('Rollenwechsel im Fenster: aus Admin wird Teamer:in -> Zuordnungsrecht faellt weg', async () => {
      await zuweisen('orgAdmin1', USERS.admin1.id, [{ jahrgang_id: J1, can_view: true }]);
      expect(await canEdit(USERS.admin1.id)).toBe(true);

      const put = await request(app).put(`/api/admin/users/${USERS.admin1.id}`)
        .set(auth('orgAdmin1')).send({ role_id: ROLES.teamer.id });
      expect(put.status).toBe(200);

      const res = await zuweisen('orgAdmin1', USERS.admin1.id, [{ jahrgang_id: J1, can_view: true, can_edit: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.admin1.id)).toBe(false);
    });

    it('zaehlt die Rolle in DIESER Gemeinde: zuhause Teamer:in, hier Admin -> true', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.teamer2.id, ORGS.testGemeinde.id, ROLES.admin.id]
      );
      invalidateUserCache(USERS.teamer2.id);
      const res = await zuweisen('orgAdmin1', USERS.teamer2.id, [{ jahrgang_id: J1, can_view: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.teamer2.id)).toBe(true);
    });

    it('zaehlt die Rolle in DIESER Gemeinde: zuhause Admin, hier Teamer:in -> false', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.admin2.id, ORGS.testGemeinde.id, ROLES.teamer.id]
      );
      invalidateUserCache(USERS.admin2.id);
      const res = await zuweisen('orgAdmin1', USERS.admin2.id, [{ jahrgang_id: J1, can_view: true, can_edit: true }]);
      expect(res.status).toBe(200);
      expect(await canEdit(USERS.admin2.id)).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // POST /admin/jahrgaenge -- Direkt-Zuweisung beim Anlegen
  // ------------------------------------------------------------------
  describe('POST /admin/jahrgaenge mit user_assignments', () => {
    it('Teamer:in mit can_edit true -> false, Admin ohne Feld -> true', async () => {
      const res = await request(app).post('/api/admin/jahrgaenge').set(auth('orgAdmin1')).send({
        name: '2028/2029',
        user_assignments: [
          { user_id: USERS.teamer1.id, can_view: true, can_edit: true },
          { user_id: USERS.admin1.id, can_view: true }
        ]
      });
      expect(res.status).toBe(201);
      expect(res.body.assigned_user_ids).toEqual([USERS.teamer1.id, USERS.admin1.id]);
      expect(await canEdit(USERS.teamer1.id, res.body.id)).toBe(false);
      expect(await canEdit(USERS.admin1.id, res.body.id)).toBe(true);
    });
  });
});
