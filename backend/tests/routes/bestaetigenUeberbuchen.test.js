// Wartende bewusst ueber die Grenze bestaetigen (Simon, 28.09.2026: Variante c).
//
// Seit dem 16.09.2026 lehnt PUT /events/:id/participants/:pid/status das
// Bestaetigen einer Wartenden ab, wenn das Event voll ist -- gegen die STILLE
// Ueberbuchung (bestaetigenKapazitaet.test.js). Am 28.09. hat Simon
// entschieden, dass Ueberbuchen gewollt ist ("kann ja sein das ich mehr
// brauche von der Warteliste") und fuer das Bestaetigen Variante c gewaehlt:
// erst nachfragen, dann bestaetigen.
//
// Deshalb zwei Wege:
//   - ohne `ueberbuchen: true` weiter 400 mit DEMSELBEN Text wie bisher (die
//     Store-Apps 2.2.x/2.3.0 zeigen ihn nicht, aber sie werten den Status
//     aus), dazu additiv error_code 'event_voll', max und belegt -- daran
//     erkennt die neue App den Fall und fragt nach;
//   - mit `ueberbuchen: true` (genau der Boolean, kein "true" als Text)
//     bestaetigt die Route trotz voller Plaetze.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const VOLL_TEXT = 'Das Event ist voll. Erhöhe die Teilnehmerzahl, um weitere Plätze zu vergeben.';

describe('Wartende bewusst ueber die Grenze bestaetigen', () => {
  let app;
  let db;
  let adminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  async function termin({ max, teilnehmer }) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Ueberbuchen-Termin',
        event_date: futureDate.toISOString(),
        max_participants: max,
        points: 0,
        point_type: 'gemeinde',
        waitlist_enabled: true,
        max_waitlist_size: 5
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id;
    for (const name of teilnehmer) {
      await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${generateToken(name)}`);
    }
    const { rows } = await db.query(
      'SELECT id, user_id, status FROM event_bookings WHERE event_id = $1 ORDER BY id',
      [eventId]
    );
    return { eventId, buchungen: rows };
  }

  const bestaetige = (eventId, bookingId, extra = {}) =>
    request(app)
      .put(`/api/events/${eventId}/participants/${bookingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed', ...extra });

  const lies = async (bookingId) => (await db.query(
    'SELECT status, war_auf_warteliste FROM event_bookings WHERE id = $1', [bookingId]
  )).rows[0];

  const bestaetigte = async (eventId) => (await db.query(
    "SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
    [eventId]
  )).rows[0].n;

  describe('ohne ausdrueckliches Ueberbuchen', () => {
    it('lehnt weiter ab, mit demselben Text und additiv error_code, max und belegt', async () => {
      const { eventId, buchungen } = await termin({ max: 1, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      expect(zwei.status).toBe('waitlist');

      const res = await bestaetige(eventId, zwei.id);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: VOLL_TEXT, error_code: 'event_voll', max: 1, belegt: 1, seite: 'konfi' });
      expect((await lies(zwei.id)).status).toBe('waitlist');
      expect(await bestaetigte(eventId)).toBe(1);
    });

    it('nimmt nur den Boolean true: "true" als Text oder 1 ueberbuchen nicht', async () => {
      const { eventId, buchungen } = await termin({ max: 1, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);

      for (const wert of ['true', 1, 'ja']) {
        const res = await bestaetige(eventId, zwei.id, { ueberbuchen: wert });
        expect(res.status).toBe(400);
        expect(res.body.error_code).toBe('event_voll');
      }
      expect((await lies(zwei.id)).status).toBe('waitlist');
      expect(await bestaetigte(eventId)).toBe(1);
    });
  });

  describe('mit ueberbuchen: true nach der Rueckfrage', () => {
    it('bestaetigt trotz voller Plaetze und merkt sich die Warteliste', async () => {
      const { eventId, buchungen } = await termin({ max: 1, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);

      const res = await bestaetige(eventId, zwei.id, { ueberbuchen: true });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Teilnehmer:in von Warteliste bestätigt', status: 'confirmed' });
      expect(await lies(zwei.id)).toEqual({ status: 'confirmed', war_auf_warteliste: true });
      expect(await bestaetigte(eventId)).toBe(2);
    });

    it('meldet danach belegt ueber max, wenn noch eine Wartende bestaetigt werden soll', async () => {
      const { eventId, buchungen } = await termin({ max: 1, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      expect((await bestaetige(eventId, zwei.id, { ueberbuchen: true })).status).toBe(200);
      // Eine dritte Wartende derselben Gemeinde (der Seed hat dort nur zwei
      // Konfis): Konto, Profil im Jahrgang, Buchung auf der Warteliste.
      const { rows: [u] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
         VALUES ('konfi-drei', 'Konfi Drei', 'x', $1, $2, true) RETURNING id`,
        [ROLES.konfi.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [u.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
      );
      const { rows: [drei] } = await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date)
         VALUES ($1, $2, 'waitlist', $3, NOW()) RETURNING id`,
        [u.id, eventId, ORGS.testGemeinde.id]
      );

      const res = await bestaetige(eventId, drei.id);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: VOLL_TEXT, error_code: 'event_voll', max: 1, belegt: 2, seite: 'konfi' });
    });

    it('aendert nichts, wo Platz ist: ohne und mit Flag wird bestaetigt', async () => {
      const { eventId, buchungen } = await termin({ max: 2, teilnehmer: ['konfi1', 'konfi2'] });
      // Beide sind bestaetigt; eine auf die Warteliste und zurueck.
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      expect(zwei.status).toBe('confirmed');
      const runter = await request(app)
        .put(`/api/events/${eventId}/participants/${zwei.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waitlist' });
      expect(runter.status).toBe(200);

      const res = await bestaetige(eventId, zwei.id, { ueberbuchen: true });

      expect(res.status).toBe(200);
      expect(await bestaetigte(eventId)).toBe(2);
    });
  });
});
