// QR-Code und Live-Zaehler eines Termins nur fuer die, die den Termin sehen
// (29.09.2026, Audit Fachlogik Punkte/Termine, Abschnitt „Unklar").
//
// Dass Teamer:innen den Check-in-Code zeigen, ist gewollt (Simon 27.09.2026,
// Sicherheit BF-21). POST /events/:id/generate-qr war aber die einzige
// Schreibroute an Terminen ohne darfTermin: Jede Teamer:in und jede Admin der
// Gemeinde holte den Code jedes Termins, auch aus Jahrgaengen, die sie in der
// Liste gar nicht sieht. Der Zaehler GET /events/:id/attendance-count gehoert
// zum Code und bekommt dieselbe Grenze; fremde Termine sind dort 404 statt
// 200 mit Nullen (Sicherheit BF-16).
//
// Ausgenommen wie in der Liste: „Nur Team", Termine ohne Jahrgang und die
// Gemeindeleitung (org_admin).
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const JG_A = 311;       // eigener Jahrgang
const JG_B = 312;       // fremder Jahrgang
const TEAMER_A = 411;
const ADMIN_A = 412;

function tokenFuer(id, roleId, type) {
  return jwt.sign(
    { id, type, display_name: `Person ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('QR-Code und Zaehler: Jahrgangs-Bindung', () => {
  let app;
  let db;
  let teamerA;
  let adminA;
  let orgAdmin;
  let teamerFremd;

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

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, 'QR-A', 1, '2027-05-01'), ($2, 'QR-B', 1, '2027-05-01')`,
      [JG_A, JG_B]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'qr_teamer', 'x', 'QR Teamer', 2, 1, true),
              ($2, 'qr_admin', 'x', 'QR Admin', 3, 1, true)`,
      [TEAMER_A, ADMIN_A]
    );
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $3, true, false), ($2, $3, true, true)`,
      [TEAMER_A, ADMIN_A, JG_A]
    );

    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(TEAMER_A);
    invalidateUserCache(ADMIN_A);

    teamerA = tokenFuer(TEAMER_A, 2, 'teamer');
    adminA = tokenFuer(ADMIN_A, 3, 'admin');
    orgAdmin = generateToken('orgAdmin1');
    teamerFremd = generateToken('teamer2');
  });

  async function termin({ jahrgaenge = [], teamerOnly = false } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, teamer_only, max_participants)
       VALUES ('QR-Termin', NOW() + INTERVAL '2 days', 1, $1, 20) RETURNING id`,
      [teamerOnly]
    );
    for (const jg of jahrgaenge) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, jg]
      );
    }
    return e.id;
  }

  async function tokenInDb(eventId) {
    const { rows: [e] } = await db.query('SELECT qr_token FROM events WHERE id = $1', [eventId]);
    return e.qr_token;
  }

  function qr(eventId, token) {
    return request(app).post(`/api/events/${eventId}/generate-qr`).set('Authorization', `Bearer ${token}`);
  }

  function zaehler(eventId, token) {
    return request(app).get(`/api/events/${eventId}/attendance-count`).set('Authorization', `Bearer ${token}`);
  }

  describe('POST /api/events/:id/generate-qr', () => {
    it('VERBOTEN: Teamer:in holt keinen Code fuer einen Termin fremden Jahrgangs — 403, nichts erzeugt', async () => {
      const id = await termin({ jahrgaenge: [JG_B] });
      const res = await qr(id, teamerA);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Kein Zugriff auf dieses Event' });
      expect(await tokenInDb(id)).toBeNull();
    });

    it('VERBOTEN: Admin holt keinen Code fuer einen Termin fremden Jahrgangs — 403', async () => {
      const id = await termin({ jahrgaenge: [JG_B] });
      const res = await qr(id, adminA);
      expect(res.status).toBe(403);
      expect(await tokenInDb(id)).toBeNull();
    });

    it('VERBOTEN: ein schon erzeugter Code wird an fremde Jahrgaenge nicht herausgegeben', async () => {
      const id = await termin({ jahrgaenge: [JG_B] });
      const erst = await qr(id, orgAdmin);
      expect(erst.status).toBe(200);

      const res = await qr(id, teamerA);
      expect(res.status).toBe(403);
      expect(res.body.qr_token).toBeUndefined();
    });

    it('ERLAUBT: Teamer:in im eigenen Jahrgang — 200 mit Code', async () => {
      const id = await termin({ jahrgaenge: [JG_A] });
      const res = await qr(id, teamerA);
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
      expect(await tokenInDb(id)).toBe(res.body.qr_token);
    });

    it('ERLAUBT: Termin fuer zwei Jahrgaenge, einer davon der eigene — 200', async () => {
      const id = await termin({ jahrgaenge: [JG_A, JG_B] });
      const res = await qr(id, adminA);
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
    });

    it('ERLAUBT: Termin ohne Jahrgang (ganze Gemeinde) — 200', async () => {
      const id = await termin();
      const res = await qr(id, teamerA);
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
    });

    it('ERLAUBT: Termin „Nur Team" — 200', async () => {
      const id = await termin({ teamerOnly: true });
      const res = await qr(id, teamerA);
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
    });

    it('ERLAUBT: Org-Admin auch ohne Jahrgang fuer jeden Termin der Gemeinde — 200', async () => {
      const id = await termin({ jahrgaenge: [JG_B] });
      const res = await qr(id, orgAdmin);
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
    });

    it('zweiter Abruf liefert denselben Code', async () => {
      const id = await termin({ jahrgaenge: [JG_A] });
      const eins = await qr(id, teamerA);
      const zwei = await qr(id, adminA);
      expect(zwei.status).toBe(200);
      expect(zwei.body.qr_token).toBe(eins.body.qr_token);
    });
  });

  describe('GET /api/events/:id/attendance-count', () => {
    it('VERBOTEN: Teamer:in liest den Zaehler eines Termins fremden Jahrgangs nicht — 403', async () => {
      const id = await termin({ jahrgaenge: [JG_B] });
      const res = await zaehler(id, teamerA);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Kein Zugriff auf dieses Event' });
    });

    it('VERBOTEN: Termin einer anderen Gemeinde — 404 statt 200 mit Nullen', async () => {
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status) VALUES ($1, $2, 'confirmed')`,
        [EVENTS.gottesdienstEvent.id, USERS.konfi1.id]
      );
      const res = await zaehler(EVENTS.gottesdienstEvent.id, teamerFremd);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Event nicht gefunden' });
    });

    it('VERBOTEN: unbekannter Termin — 404', async () => {
      const res = await zaehler(999999, orgAdmin);
      expect(res.status).toBe(404);
    });

    it('ERLAUBT: eigener Jahrgang — 200 mit den Zahlen', async () => {
      const id = await termin({ jahrgaenge: [JG_A] });
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status)
         VALUES ($1, $2, 'confirmed', 'present'), ($1, $3, 'confirmed', NULL)`,
        [id, USERS.konfi1.id, USERS.konfi2.id]
      );
      const res = await zaehler(id, teamerA);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ checked_in: 1, total: 2 });
    });

    it('ERLAUBT: „Nur Team", ohne Jahrgang und Org-Admin — je 200', async () => {
      const nurTeam = await termin({ teamerOnly: true });
      const ohne = await termin();
      const fremd = await termin({ jahrgaenge: [JG_B] });

      expect((await zaehler(nurTeam, teamerA)).status).toBe(200);
      expect((await zaehler(ohne, teamerA)).status).toBe(200);
      const leitung = await zaehler(fremd, orgAdmin);
      expect(leitung.status).toBe(200);
      expect(leitung.body).toEqual({ checked_in: 0, total: 0 });
    });
  });
});
