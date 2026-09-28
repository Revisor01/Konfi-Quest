// "Teilnehmende von Hand hinzufuegen": Status pruefen, Ueberbuchen bewusst
// erlaubt (Audit 26.09.2026, Punkte/Termine BF-04)
//
// DER BEFUND, zwei Teile:
//
// 1. Der `status` aus dem Rumpf ging ungeprueft ins INSERT. 'foo' scheiterte
//    erst am CHECK der Datenbank -> 500 "Datenbankfehler". Werte, die der
//    CHECK kennt ('cancelled', 'opted_out', ...), legten sogar eine Buchung
//    an, die dieser Weg nie anlegen soll. BEHOBEN: nur auto | confirmed |
//    waitlist, sonst 400 mit error_code 'status_ungueltig'.
//
// 2. 'confirmed' prueft keine Kapazitaet -- das Admin-Modal schickt immer
//    'confirmed', der Termin wird also still ueberbucht. BEWUSST SO (Simon,
//    28.09.2026): "Überbuchen ist gewollt, kann ja sein das ich mehr brauche
//    von der Warteliste." Die Tests unten halten das fest, damit niemand es
//    fuer einen vergessenen Riegel haelt. Das Bestaetigen EINER WARTENDEN
//    (PUT .../status) prueft die Kapazitaet weiterhin (Entscheidung
//    16.09.2026, bestaetigenKapazitaet.test.js).
//
// Welche Werte die Apps schicken: 'confirmed' (ParticipantManagementModal,
// Stand 2.2.0, 2.3.0 und heute). 'auto' ist der Vorgabewert der Route.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Teilnehmende von Hand hinzufuegen: Status', () => {
  let app;
  let db;
  let adminToken;

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
    adminToken = generateToken('orgAdmin1');
    vi.spyOn(PushService, 'sendEventRegisteredToKonfi').mockResolvedValue(undefined);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  /** Event mit EINEM Konfi-Platz, konfi1 belegt ihn. */
  async function vollesEvent() {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants,
                           waitlist_enabled, max_waitlist_size, points, point_type)
       VALUES ('Konfifahrt', NOW() + interval '14 days', $1, 1, true, 5, 0, 'gemeinde')
       RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [USERS.konfi1.id, e.id, ORGS.testGemeinde.id]
    );
    return e.id;
  }

  const hinzufuegen = (eventId, rumpf) => request(app)
    .post(`/api/events/${eventId}/participants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ user_id: USERS.konfi2.id, ...rumpf });

  const buchungVon = async (eventId, userId) => {
    const { rows } = await db.query(
      'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return rows[0] || null;
  };

  const bestaetigteKonfis = async (eventId) => {
    const { rows: [r] } = await db.query(
      'SELECT konfi_confirmed FROM event_booking_stats WHERE event_id = $1',
      [eventId]
    );
    return Number(r.konfi_confirmed);
  };

  describe('VERBOTEN: ungueltiger Status', () => {
    it.each([
      ['foo'],
      ['cancelled'],
      ['opted_out'],
      ['excused'],
      ['pending'],
      [''],
      [7],
    ])('status %j -> 400 status_ungueltig, keine Buchung', async (wert) => {
      const eventId = await vollesEvent();

      const res = await hinzufuegen(eventId, { status: wert });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Ungültiger Status. Erlaubt sind auto, confirmed und waitlist',
        error_code: 'status_ungueltig'
      });
      expect(await buchungVon(eventId, USERS.konfi2.id)).toBeNull();
    });
  });

  describe('ERLAUBT', () => {
    it('confirmed am vollen Event: 201, bewusst ueberbucht (2 Bestaetigte auf 1 Platz)', async () => {
      const eventId = await vollesEvent();

      const res = await hinzufuegen(eventId, { status: 'confirmed' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect((await buchungVon(eventId, USERS.konfi2.id)).status).toBe('confirmed');
      expect(await bestaetigteKonfis(eventId)).toBe(2);
    });

    it('waitlist: 201, steht auf der Warteliste', async () => {
      const eventId = await vollesEvent();

      const res = await hinzufuegen(eventId, { status: 'waitlist' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('waitlist');
      expect((await buchungVon(eventId, USERS.konfi2.id)).status).toBe('waitlist');
    });

    it('ohne status (auto): am vollen Event mit Warteliste landet die Person auf der Warteliste', async () => {
      const eventId = await vollesEvent();

      const res = await hinzufuegen(eventId, {});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('waitlist');
      expect(await bestaetigteKonfis(eventId)).toBe(1);
    });

    it('status null gilt wie fehlend (auto)', async () => {
      const eventId = await vollesEvent();

      const res = await hinzufuegen(eventId, { status: null });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('waitlist');
    });

    it('auto mit freiem Platz: bestaetigt', async () => {
      const eventId = await vollesEvent();
      await db.query('UPDATE events SET max_participants = 5 WHERE id = $1', [eventId]);

      const res = await hinzufuegen(eventId, { status: 'auto' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
    });
  });
});
