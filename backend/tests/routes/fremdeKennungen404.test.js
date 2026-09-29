// Fremde Kennungen bekommen 404, nicht 200/leer oder 409 (Audit Sicherheit
// BF-16, Rest; 29.09.2026).
//
// Reproduziert im Audit: DELETE einer Kategorie bzw. eines Zertifikat-Typs
// einer ANDEREN Gemeinde antwortete 409 mit ihrer Nutzung ("1 Aktivität(en)
// zugeordnet", "bereits im Team vergeben") -- das verriet Existenz und
// Nutzung fremder Kennungen. Weitere Routen antworteten 200 mit leerer
// Liste, und POST /chat/rooms liess fremde Teilnehmende still weg: Der Raum
// entstand ohne sie.
//
// Seit 27.09. schon behoben (hier nicht wiederholt): konfi/events/:id/
// participants, event-points. attendance-count steht in
// qrCodeJahrgangsBindung.test.js.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, EVENTS, CATEGORIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const EVENT_ORG2 = 900;

describe('Fremde Kennungen: 404 statt 200/leer oder 409', () => {
  let app;
  let db;
  let orgAdmin1;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdmin1 = generateToken('orgAdmin1');
  });

  const als = (token) => (r) => r.set('Authorization', `Bearer ${token}`);

  // ------------------------------------------------------------------
  describe('DELETE /api/admin/categories/:id', () => {
    it('VERBOTEN: Kategorie einer anderen Gemeinde (mit Aktivitaet) -> 404, ohne Nutzungszahlen, bleibt bestehen', async () => {
      const res = await als(orgAdmin1)(request(app).delete(`/api/admin/categories/${CATEGORIES.gottesdienst2.id}`));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Kategorie nicht gefunden' });
      const { rows } = await db.query('SELECT id FROM categories WHERE id = $1', [CATEGORIES.gottesdienst2.id]);
      expect(rows).toHaveLength(1);
    });

    it('ERLAUBT: eigene genutzte Kategorie -> weiter 409 mit Nutzung', async () => {
      const res = await als(orgAdmin1)(request(app).delete(`/api/admin/categories/${CATEGORIES.gottesdienst1.id}`));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Kategorie kann nicht gelöscht werden: 2 Aktivität(en) zugeordnet.');
    });

    it('ERLAUBT: eigene ungenutzte Kategorie -> 200, geloescht', async () => {
      const { rows: [k] } = await db.query(
        "INSERT INTO categories (name, type, organization_id) VALUES ('Frei', 'activity', 1) RETURNING id"
      );
      const res = await als(orgAdmin1)(request(app).delete(`/api/admin/categories/${k.id}`));
      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT id FROM categories WHERE id = $1', [k.id]);
      expect(rows).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  describe('Zertifikate', () => {
    async function typ(orgId, name) {
      const { rows: [t] } = await db.query(
        'INSERT INTO certificate_types (name, organization_id) VALUES ($1, $2) RETURNING id', [name, orgId]
      );
      return t.id;
    }
    async function vergeben(typId, userId, orgId) {
      await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date)
         VALUES ($1, $2, $3, '2026-09-01')`,
        [userId, typId, orgId]
      );
    }

    it('VERBOTEN: DELETE certificate-types eines vergebenen Typs einer anderen Gemeinde -> 404', async () => {
      const fremd = await typ(2, 'Juleica');
      await vergeben(fremd, USERS.teamer2.id, 2);
      const res = await als(orgAdmin1)(request(app).delete(`/api/teamer/certificate-types/${fremd}`));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Zertifikat-Typ nicht gefunden' });
    });

    it('ERLAUBT: DELETE eines eigenen vergebenen Typs -> weiter 409', async () => {
      const eigen = await typ(1, 'Erste Hilfe');
      await vergeben(eigen, USERS.teamer1.id, 1);
      const res = await als(orgAdmin1)(request(app).delete(`/api/teamer/certificate-types/${eigen}`));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Zertifikat-Typ kann nicht gelöscht werden: bereits im Team vergeben.');
    });

    it('VERBOTEN: GET /teamer/:userId/certificates fuer eine Person einer anderen Gemeinde -> 404', async () => {
      const res = await als(orgAdmin1)(request(app).get(`/api/teamer/${USERS.teamer2.id}/certificates`));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Person nicht gefunden' });
    });

    it('ERLAUBT: eigene Teamer:in -> 200 mit den Zertifikaten', async () => {
      const eigen = await typ(1, 'Erste Hilfe');
      await vergeben(eigen, USERS.teamer1.id, 1);
      const res = await als(orgAdmin1)(request(app).get(`/api/teamer/${USERS.teamer1.id}/certificates`));
      expect(res.status).toBe(200);
      expect(res.body.map((c) => c.name)).toEqual(['Erste Hilfe']);
    });

    it('ERLAUBT: Teamer:in, die nur ueber user_organizations zur Gemeinde gehoert -> 200 []', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.teamer2.id, ROLES.teamer.id]
      );
      const res = await als(orgAdmin1)(request(app).get(`/api/teamer/${USERS.teamer2.id}/certificates`));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  describe('GET /api/admin/konfis/:id/attendance-stats', () => {
    it('VERBOTEN: Konfi einer anderen Gemeinde -> 404 (vorher 403, das die Kennung bestaetigte)', async () => {
      const res = await als(orgAdmin1)(request(app).get(`/api/admin/konfis/${USERS.konfi3.id}/attendance-stats`));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Konfi nicht gefunden' });
    });

    it('VERBOTEN: Admin ohne Jahrgang, eigene Gemeinde -> weiter 403', async () => {
      const res = await als(generateToken('admin1'))(request(app).get(`/api/admin/konfis/${USERS.konfi1.id}/attendance-stats`));
      expect(res.status).toBe(403);
    });

    it('ERLAUBT: eigene Konfi -> 200 mit der Statistik', async () => {
      const res = await als(orgAdmin1)(request(app).get(`/api/admin/konfis/${USERS.konfi1.id}/attendance-stats`));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total_mandatory: 0, attended: 0, percentage: 100, missed_events: [] });
    });
  });

  // ------------------------------------------------------------------
  describe('GET /api/material/by-event/:eventId', () => {
    beforeEach(async () => {
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id) VALUES ($1, 'Fremder Termin', NOW() + interval '3 days', 2)`,
        [EVENT_ORG2]
      );
      const { rows: [m] } = await db.query(
        "INSERT INTO materials (title, organization_id, created_by) VALUES ('Ablaufplan', 1, $1) RETURNING id",
        [USERS.orgAdmin1.id]
      );
      await db.query('INSERT INTO material_events (material_id, event_id) VALUES ($1, $2)', [m.id, EVENTS.gottesdienstEvent.id]);
    });

    it('VERBOTEN: Termin einer anderen Gemeinde -> 404 statt 200 []', async () => {
      const res = await als(orgAdmin1)(request(app).get(`/api/material/by-event/${EVENT_ORG2}`));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Event nicht gefunden' });
    });

    it('ERLAUBT: eigener Termin -> 200 mit dem Material', async () => {
      const res = await als(orgAdmin1)(request(app).get(`/api/material/by-event/${EVENTS.gottesdienstEvent.id}`));
      expect(res.status).toBe(200);
      expect(res.body.map((m) => m.title)).toEqual(['Ablaufplan']);
    });

    it('ERLAUBT: eigener Termin ohne Material -> 200 []', async () => {
      const res = await als(orgAdmin1)(request(app).get(`/api/material/by-event/${EVENTS.pflichtEvent.id}`));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  describe('POST /api/chat/rooms', () => {
    const raeume = async () => (await db.query('SELECT COUNT(*)::int AS n FROM chat_rooms')).rows[0].n;

    it('VERBOTEN: Person einer anderen Gemeinde in der Gruppe -> 400, kein Raum entsteht', async () => {
      const vorher = await raeume();
      const res = await als(orgAdmin1)(request(app).post('/api/chat/rooms')).send({
        type: 'group', name: 'Freizeit-Team',
        participants: [{ user_id: USERS.teamer1.id }, { user_id: USERS.teamer2.id }],
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Mindestens eine ausgewählte Person gehört nicht zu dieser Gemeinde.',
        error_code: 'teilnehmende_nicht_in_gemeinde',
      });
      expect(await raeume()).toBe(vorher);
    });

    it('VERBOTEN: unbekannte Kennung -> 400', async () => {
      const res = await als(orgAdmin1)(request(app).post('/api/chat/rooms')).send({
        type: 'group', name: 'Gruppe', participants: [{ user_id: USERS.teamer1.id }, { user_id: 999999 }],
      });
      expect(res.status).toBe(400);
    });

    it('ERLAUBT: nur Personen der Gemeinde (auch ueber user_organizations) -> Raum mit allen', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.teamer2.id, ROLES.teamer.id]
      );
      const res = await als(orgAdmin1)(request(app).post('/api/chat/rooms')).send({
        type: 'group', name: 'Freizeit-Team',
        participants: [{ user_id: USERS.teamer1.id }, { user_id: USERS.teamer2.id }, USERS.admin1.id, USERS.teamer1.id],
      });
      expect(res.status).toBe(200);
      const { rows } = await db.query(
        'SELECT user_id FROM chat_participants WHERE room_id = $1 ORDER BY user_id', [res.body.room_id]
      );
      expect(rows.map((r) => Number(r.user_id))).toEqual(
        [USERS.teamer1.id, USERS.admin1.id, USERS.orgAdmin1.id, USERS.teamer2.id].sort((a, b) => a - b)
      );
    });
  });

  it('Seed-Annahmen', () => {
    expect(ORGS.testGemeinde.id).toBe(1);
    expect(CATEGORIES.gottesdienst2.org_id).toBe(2);
  });
});
