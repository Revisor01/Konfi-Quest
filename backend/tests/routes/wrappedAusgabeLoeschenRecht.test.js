// Rueckblick-Ausgabe loeschen verlangt dasselbe Recht wie anlegen
// (Audit 26.09.2026, Fachlogik Chat/Challenges/Rueckblick BF-13).
//
// POST /wrapped/generate/:jahrgangId verlangt darfJahrgang(..., { edit: true })
// -- eine Zuweisung MIT can_edit. DELETE /wrapped/ausgabe/:id liess fuer
// Konfi-Ausgaben dagegen irgendeine Zeile in user_jahrgang_assignments
// genuegen: Ein Admin, der den Jahrgang nur lesen darf, konnte den Rueckblick
// samt aller Snapshots loeschen, aber keinen anlegen.
//
// Verboten: Lese-Zuweisung, keine Zuweisung, Konfi. Erlaubt: Zuweisung mit
// can_edit, org_admin. Teamer-Ausgaben bleiben org_admin vorbehalten.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('DELETE /api/wrapped/ausgabe/:id: Schreibrecht auf den Jahrgang', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  afterAll(async () => {
    await closePool();
  });

  const zuweisen = async (userKey, { canView, canEdit }) => {
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, $3, $4)`,
      [USERS[userKey].id, JAHRGAENGE.jahrgang1.id, canView, canEdit]
    );
    invalidateUserCache(USERS[userKey].id);
  };

  // Die Ausgabe legt die Gemeindeleitung an -- unabhaengig vom Recht dessen,
  // der danach loeschen will.
  const konfiAusgabe = async () => {
    const lauf = await request(app)
      .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(lauf.status).toBe(200);
    const { rows: [a] } = await db.query(
      `SELECT id FROM wrapped_ausgaben WHERE jahrgang_id = $1 AND wrapped_type = 'konfi'`,
      [JAHRGAENGE.jahrgang1.id]
    );
    return a.id;
  };

  const loeschen = (id, userKey) =>
    request(app).delete(`/api/wrapped/ausgabe/${id}`).set('Authorization', `Bearer ${generateToken(userKey)}`);

  const gibtEsNoch = async (id) =>
    (await db.query('SELECT 1 FROM wrapped_ausgaben WHERE id = $1', [id])).rowCount;

  describe('verboten', () => {
    it('Admin mit reiner Lese-Zuweisung: 403, die Ausgabe bleibt', async () => {
      await zuweisen('admin1', { canView: true, canEdit: false });
      const id = await konfiAusgabe();

      const res = await loeschen(id, 'admin1');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Kein Zugriff auf diesen Jahrgang' });
      expect(await gibtEsNoch(id)).toBe(1);
    });

    it('Admin ohne Zuweisung: 403', async () => {
      const id = await konfiAusgabe();

      const res = await loeschen(id, 'admin1');

      expect(res.status).toBe(403);
      expect(await gibtEsNoch(id)).toBe(1);
    });

    it('Gegenstueck beim Anlegen: dieselbe Lese-Zuweisung darf auch nicht anlegen', async () => {
      await zuweisen('admin1', { canView: true, canEdit: false });

      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`);

      expect(res.status).toBe(403);
    });
  });

  describe('erlaubt', () => {
    it('Admin mit Schreib-Zuweisung: 200, die Ausgabe ist weg', async () => {
      await zuweisen('admin1', { canView: true, canEdit: true });
      const id = await konfiAusgabe();

      const res = await loeschen(id, 'admin1');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(2);
      expect(await gibtEsNoch(id)).toBe(0);
    });

    it('Gemeindeleitung ohne Zuweisung: 200', async () => {
      const id = await konfiAusgabe();

      const res = await loeschen(id, 'orgAdmin1');

      expect(res.status).toBe(200);
      expect(await gibtEsNoch(id)).toBe(0);
    });
  });
});
