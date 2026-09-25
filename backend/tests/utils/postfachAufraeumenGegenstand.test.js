// backend/tests/utils/postfachAufraeumenGegenstand.test.js
//
// Mitteilungen sterben mit ihrem Gegenstand (utils/postfachAufraeumen.js).
// Seit der Push-Weg ins Postfach schreibt (25.09.2026), gilt das auch fuer
// Termine, Challenges und Jahrgaenge:
//
//   - Ein geloeschter Termin nimmt ALLE seine Mitteilungen mit -- egal ob die
//     Kennung als event_id (Konfi-Meldungen) oder eventId (Team-Buchungen)
//     im data-Teil liegt.
//   - Eine geloeschte Challenge nimmt Stempel, "ausgeblendet" und "Neuer
//     Beitrag" mit.
//   - Ein geloeschter Jahrgang nimmt die Loeschwarnung mit; "Neue
//     Registrierung" bleibt (zeigt auf die Konfi-Liste, die es weiter gibt).
//
// Geprueft werden die Funktionen direkt UND der Weg ueber die Loeschroute
// eines Termins.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const {
  loescheMitteilungenZuTermin,
  loescheMitteilungenZuChallenge,
  loescheMitteilungenZuJahrgang,
  ARTEN_AM_TERMIN
} = require('../../utils/postfachAufraeumen');
const { POSTFACH_ARTEN } = require('../../utils/postfachArten');

describe('Postfach: Mitteilungen gehen mit Termin, Challenge und Jahrgang', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  async function mitteilung(userId, type, data, orgId = ORGS.testGemeinde.id) {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'T', 'M', $2, $3::jsonb, $4) RETURNING id`,
      [userId, type, JSON.stringify(data), orgId]
    );
    return id;
  }

  async function verbliebene() {
    const { rows } = await db.query('SELECT id, type FROM notifications ORDER BY id');
    return rows;
  }

  it('Termin: alle Arten am Termin gehen, ob event_id oder eventId; andere Termine und Arten bleiben', async () => {
    const T = EVENTS.gottesdienstEvent.id;
    const ANDERER = EVENTS.pflichtEvent.id;

    const gehen = [
      await mitteilung(USERS.konfi1.id, 'event_registered', { event_id: String(T) }),
      await mitteilung(USERS.konfi1.id, 'event_attendance', { event_id: T, points: '2' }),
      await mitteilung(USERS.konfi1.id, 'event_cancelled', { event_id: String(T) }),
      await mitteilung(USERS.admin1.id, 'teamer_event_booking', { eventId: String(T) }),
      await mitteilung(USERS.admin1.id, 'event_unregistration', { event_id: String(T) }),
      await mitteilung(USERS.admin1.id, 'event_opt_out', { event_id: String(T) })
    ];
    const bleiben = [
      await mitteilung(USERS.konfi1.id, 'event_registered', { event_id: String(ANDERER) }),
      await mitteilung(USERS.konfi1.id, 'bonus_points', { points: '2' }),
      await mitteilung(USERS.admin1.id, 'events_pending_approval', { count: '1' }),
      // Ohne Kennung (Loeschroute meldet abgesagte Termine ohne event_id):
      await mitteilung(USERS.konfi1.id, 'event_cancelled', { event_name: 'X' })
    ];

    const geloescht = await loescheMitteilungenZuTermin(db, T);

    expect(geloescht).toBe(gehen.length);
    expect((await verbliebene()).map((r) => r.id)).toEqual(bleiben);
  });

  it('Termin: jede Termin-Art der Positivliste steht in ARTEN_AM_TERMIN', () => {
    const terminArten = [...POSTFACH_ARTEN].filter((a) =>
      a.startsWith('event_') || a === 'waitlist_promotion' || a.startsWith('teamer_event_'));
    // events_pending_approval zeigt auf keinen einzelnen Termin.
    const erwartet = terminArten.filter((a) => a !== 'events_pending_approval');
    for (const art of erwartet) {
      expect(ARTEN_AM_TERMIN).toContain(art);
    }
    expect(ARTEN_AM_TERMIN).not.toContain('events_pending_approval');
  });

  it('Termin ueber die Loeschroute: DELETE /api/events/:id raeumt das Postfach mit auf', async () => {
    const T = EVENTS.gottesdienstEvent.id;
    await mitteilung(USERS.konfi1.id, 'event_registered', { event_id: String(T) });
    await mitteilung(USERS.admin1.id, 'teamer_event_booking', { eventId: String(T) });
    const bleibt = await mitteilung(USERS.konfi1.id, 'bonus_points', { points: '1' });

    const res = await request(app)
      .delete(`/api/events/${T}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);

    expect((await verbliebene()).map((r) => r.id)).toEqual([bleibt]);
  });

  it('Challenge: Stempel, ausgeblendet und neuer Beitrag gehen; andere Challenge bleibt', async () => {
    const gehen = [
      await mitteilung(USERS.konfi1.id, 'challenge_badge_earned', { challengeId: '7' }),
      await mitteilung(USERS.konfi1.id, 'challenge_submission_hidden', { challengeId: '7' }),
      await mitteilung(USERS.admin1.id, 'challenge_submission', { challengeId: '7' })
    ];
    const bleiben = [
      await mitteilung(USERS.konfi1.id, 'challenge_badge_earned', { challengeId: '8' }),
      await mitteilung(USERS.konfi1.id, 'bonus_points', { points: '1' })
    ];

    const geloescht = await loescheMitteilungenZuChallenge(db, 7);

    expect(geloescht).toBe(gehen.length);
    expect((await verbliebene()).map((r) => r.id)).toEqual(bleiben);
  });

  it('Jahrgang: die Loeschwarnung geht, die Registrierung bleibt', async () => {
    const J = JAHRGAENGE.jahrgang1.id;
    await mitteilung(USERS.admin1.id, 'jahrgang_deletion_warning', { jahrgang_id: String(J), days_left: '3' });
    const registrierung = await mitteilung(USERS.admin1.id, 'new_konfi_registration', { jahrgang_id: String(J) });
    const andererJahrgang = await mitteilung(USERS.admin2.id, 'jahrgang_deletion_warning', { jahrgang_id: String(JAHRGAENGE.jahrgang2.id) }, ORGS.andereGemeinde.id);

    const geloescht = await loescheMitteilungenZuJahrgang(db, J);

    expect(geloescht).toBe(1);
    expect((await verbliebene()).map((r) => r.id)).toEqual([registrierung, andererJahrgang]);
  });

  it('ohne Kennung passiert nichts', async () => {
    await mitteilung(USERS.konfi1.id, 'event_registered', { event_id: '1' });
    expect(await loescheMitteilungenZuTermin(db, null)).toBe(0);
    expect(await loescheMitteilungenZuChallenge(db, undefined)).toBe(0);
    expect(await loescheMitteilungenZuJahrgang(db, '')).toBe(0);
    expect(await verbliebene()).toHaveLength(1);
  });
});
