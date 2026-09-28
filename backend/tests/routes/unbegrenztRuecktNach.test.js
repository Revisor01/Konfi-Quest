// Konfi-Plaetze auf "unbegrenzt" -> alle Wartenden ruecken nach
// (Audit 26.09.2026, Punkte/Termine BF-06)
//
// DER BEFUND: Erhoeht die Leitung die Konfi-Plaetze auf eine Zahl, ruecken
// Wartende nach. Stellt sie auf "unbegrenzt" (0), rueckte niemand nach --
// `else if (max_participants > 0)` liess die 0 durchfallen. Derselbe Aufruf
// hat fuer das Team-Kontingent laengst die Regel "0 = unbegrenzt -> alle
// Wartenden ruecken nach". Die Wartenden blieben 'waitlist', waehrend jede
// neue Anmeldung sofort bestaetigt wurde; wer frueh dran war, sah spaeter
// Angemeldete vor sich. Die siebte Stelle zum behobenen Befund #9
// ("Warteliste rueckte an sechs Stellen nicht nach").
//
// GEPRUEFT: alle Wartenden ruecken nach -- mit Push, war_auf_warteliste und
// in der Reihenfolge der Warteliste; wartende Teamer:innen bleiben, wo sie
// sind (eigenes Kontingent); die Team-Seite als Gegenprobe.

const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Konfi-Plaetze auf unbegrenzt: die Warteliste rueckt nach', () => {
  let app;
  let db;
  let adminToken;
  let pushKonfi;
  let pushTeam;

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
    pushKonfi = vi.spyOn(PushService, 'sendWaitlistPromotionToKonfi').mockResolvedValue(undefined);
    pushTeam = vi.spyOn(PushService, 'sendWaitlistPromotionToTeamer').mockResolvedValue(undefined);
    vi.spyOn(PushService, 'sendEventChangedToKonfis').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await warteAufNachwehen(app);
    vi.restoreAllMocks();
  });

  async function person(username, rolle) {
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
       VALUES ($1, $2, 'x', $3, $4, true) RETURNING id`,
      [username, `Person ${username}`, rolle === 'konfi' ? ROLES.konfi.id : ROLES.teamer.id, ORGS.testGemeinde.id]
    );
    if (rolle === 'konfi') {
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [u.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
      );
    }
    return u.id;
  }

  const EVENT_DATUM = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  async function event({ max = 1, teamerMax = 0 } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants, waitlist_enabled,
                           max_waitlist_size, teamer_needed, teamer_max_participants,
                           teamer_waitlist_enabled, teamer_max_waitlist_size, points, point_type)
       VALUES ('Konfifahrt', $2, $1, $3, true, 10, true, $4, true, 10, 0, 'gemeinde')
       RETURNING id`,
      [ORGS.testGemeinde.id, EVENT_DATUM, max, teamerMax]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    return e.id;
  }

  async function bucht(eventId, userId, status, vorMinuten) {
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date)
       VALUES ($1, $2, $3, $4, NOW() - make_interval(mins => $5))`,
      [userId, eventId, status, ORGS.testGemeinde.id, vorMinuten]
    );
  }

  const bearbeiten = (eventId, felder) => request(app)
    .put(`/api/events/${eventId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Konfifahrt',
      event_date: EVENT_DATUM,
      jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
      category_ids: [],
      points: 0,
      point_type: 'gemeinde',
      type: 'event',
      waitlist_enabled: true,
      max_waitlist_size: 10,
      teamer_needed: true,
      ...felder
    });

  const buchung = async (eventId, userId) => {
    const { rows: [r] } = await db.query(
      'SELECT status, war_auf_warteliste FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return r;
  };

  it('Konfi-Plaetze 1 -> 0: alle Wartenden sind bestaetigt, mit Push und war_auf_warteliste', async () => {
    const eventId = await event({ max: 1 });
    const k2 = await person('k2', 'konfi');
    const k3 = await person('k3', 'konfi');
    await bucht(eventId, USERS.konfi1.id, 'confirmed', 30);
    await bucht(eventId, k2, 'waitlist', 20);
    await bucht(eventId, k3, 'waitlist', 10);

    const res = await bearbeiten(eventId, { max_participants: 0 });

    expect(res.status).toBe(200);
    expect(res.body.promoted_count).toBe(2);
    expect(res.body.promoted_teamer_count).toBe(0);
    for (const id of [k2, k3]) {
      expect(await buchung(eventId, id)).toEqual({ status: 'confirmed', war_auf_warteliste: true });
    }
    await warteAufNachwehen(app);
    // Dieselbe Mitteilung wie beim Erhoehen auf eine Zahl -- in der
    // Reihenfolge der Warteliste.
    expect(pushKonfi.mock.calls.map((c) => Number(c[1]))).toEqual([k2, k3]);
  });

  it('eine spaetere Anmeldung ueberholt danach niemanden mehr', async () => {
    const eventId = await event({ max: 1 });
    const k2 = await person('k2', 'konfi');
    await bucht(eventId, USERS.konfi1.id, 'confirmed', 30);
    await bucht(eventId, k2, 'waitlist', 20);

    await bearbeiten(eventId, { max_participants: 0 }).expect(200);

    const anmeldung = await request(app)
      .post(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${generateToken('konfi2')}`)
      .send({});
    expect(anmeldung.body.status).toBe('confirmed');
    expect((await buchung(eventId, k2)).status).toBe('confirmed');

    const { rows: [z] } = await db.query(
      'SELECT konfi_confirmed, konfi_waitlist FROM event_booking_stats WHERE event_id = $1', [eventId]
    );
    expect({ bestaetigt: Number(z.konfi_confirmed), wartend: Number(z.konfi_waitlist) })
      .toEqual({ bestaetigt: 3, wartend: 0 });
  });

  it('wartende Teamer:innen ruecken dabei NICHT nach (eigenes Kontingent)', async () => {
    const eventId = await event({ max: 1, teamerMax: 1 });
    const k2 = await person('k2', 'konfi');
    const t2 = await person('t2', 'teamer');
    await bucht(eventId, USERS.konfi1.id, 'confirmed', 30);
    await bucht(eventId, k2, 'waitlist', 20);
    await bucht(eventId, USERS.teamer1.id, 'confirmed', 30);
    await bucht(eventId, t2, 'waitlist', 25);

    const res = await bearbeiten(eventId, { max_participants: 0, teamer_max_participants: 1 });

    expect(res.status).toBe(200);
    expect(res.body.promoted_count).toBe(1);
    expect(res.body.promoted_teamer_count).toBe(0);
    expect((await buchung(eventId, k2)).status).toBe('confirmed');
    expect((await buchung(eventId, t2)).status).toBe('waitlist');
    expect(pushTeam).not.toHaveBeenCalled();
  });

  it('GEGENPROBE Team-Seite: Teamer-Plaetze auf 0 lassen die Team-Warteliste nachruecken', async () => {
    const eventId = await event({ max: 5, teamerMax: 1 });
    const t2 = await person('t2', 'teamer');
    await bucht(eventId, USERS.teamer1.id, 'confirmed', 30);
    await bucht(eventId, t2, 'waitlist', 20);

    const res = await bearbeiten(eventId, { max_participants: 5, teamer_max_participants: 0 });

    expect(res.status).toBe(200);
    expect(res.body.promoted_teamer_count).toBe(1);
    expect(res.body.promoted_count).toBe(0);
    expect((await buchung(eventId, t2)).status).toBe('confirmed');
  });

  it('Plaetze unveraendert (1 -> 1): niemand rueckt nach', async () => {
    const eventId = await event({ max: 1 });
    const k2 = await person('k2', 'konfi');
    await bucht(eventId, USERS.konfi1.id, 'confirmed', 30);
    await bucht(eventId, k2, 'waitlist', 20);

    const res = await bearbeiten(eventId, { max_participants: 1 });

    expect(res.status).toBe(200);
    expect(res.body.promoted_count).toBe(0);
    expect((await buchung(eventId, k2)).status).toBe('waitlist');
  });
});
