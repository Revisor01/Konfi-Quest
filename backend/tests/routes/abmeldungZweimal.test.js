// Die zweite Abmeldung ist ein Erfolg, kein Fehler (Audit 26.09.2026,
// Punkte/Termine BF-03)
//
// DER FALL: Eine Konfi meldet sich im Funkloch ab. Die Anfrage kommt an, die
// Antwort geht auf dem Rueckweg verloren, die Warteschlange der App legt die
// Abmeldung erneut vor. Die Buchung ist da schon weg -- und
// DELETE /konfi/events/:id/register antwortete 400 "Du bist nicht fuer
// dieses Event angemeldet". Die App (writeQueue: 4xx -> verworfen,
// Fehl-Toast, Liste fehlgeschlagener Aktionen) meldete damit einen
// Fehlschlag fuer eine Abmeldung, die laengst gelungen war.
//
// Die Route hatte den Zweig `bereits_abgemeldet` schon (seit 28.08.2026) --
// er sass aber HINTER einem aelteren Vorab-Check, der zuerst griff, und war
// fuer den Wiederholungsfall toter Code. DELETE /events/:id/book und
// POST /konfi/events/:id/opt-out loesen denselben Fall laengst mit 200.
//
// DIE REGEL jetzt wie in buchung.js:
//   Event der eigenen Gemeinde existiert, keine Buchung (mehr) -> 200
//     { message: 'Abmeldung erfolgreich', bereits_abgemeldet: true }
//     -- ohne zweites Protokoll, ohne zweite Mitteilung, ohne Nachruecken
//   Event gibt es nicht (oder nicht in dieser Gemeinde)         -> 404
//
// ANTWORTFORM: Die Erfolgsantwort bleibt { message }, dazu das Feld
// bereits_abgemeldet -- dieselbe Form wie im inneren Zweig und beim Opt-out.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ROLES, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Zweite Abmeldung (Offline-Wiederholung) antwortet 200', () => {
  let app;
  let db;
  let konfiToken;
  let pushKonfi;
  let pushLeitung;
  let pushNachruecken;

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
    konfiToken = generateToken('konfi1');
    pushKonfi = vi.spyOn(PushService, 'sendEventUnregisteredToKonfi').mockResolvedValue(undefined);
    pushLeitung = vi.spyOn(PushService, 'sendEventUnregistrationToLeadership').mockResolvedValue(undefined);
    pushNachruecken = vi.spyOn(PushService, 'sendWaitlistPromotionToKonfi').mockResolvedValue(undefined);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  /** Freiwilliges Event in zwei Wochen (ausserhalb der Zwei-Tage-Frist). */
  async function termin({ max = 10, orgId = ORGS.testGemeinde.id, jahrgang = JAHRGAENGE.jahrgang1.id } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           waitlist_enabled, max_waitlist_size, points, point_type)
       VALUES ('Konfifreizeit', NOW() + interval '14 days', $1, false, $2, true, 10, 0, 'gemeinde')
       RETURNING id`,
      [orgId, max]
    );
    if (jahrgang) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, jahrgang]
      );
    }
    return e.id;
  }

  async function bucht(eventId, userId, status = 'confirmed', vorMinuten = 0) {
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date)
       VALUES ($1, $2, $3, $4, NOW() - make_interval(mins => $5))`,
      [userId, eventId, status, ORGS.testGemeinde.id, vorMinuten]
    );
  }

  const abmelden = (eventId) => request(app)
    .delete(`/api/konfi/events/${eventId}/register`)
    .set('Authorization', `Bearer ${konfiToken}`)
    .send({ reason: 'Bin krank' });

  /** Mitteilungen gehen nach der Antwort raus -- kurz auf sie warten. */
  async function wartetAufAufrufe(spy, anzahl, timeoutMs = 2000) {
    const start = Date.now();
    while (spy.mock.calls.length < anzahl && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  const protokolle = async (eventId) => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM event_unregistrations WHERE event_id = $1 AND user_id = $2',
      [eventId, USERS.konfi1.id]
    );
    return r.n;
  };

  it('erste Abmeldung 200, zweite 200 mit bereits_abgemeldet', async () => {
    const eventId = await termin();
    await bucht(eventId, USERS.konfi1.id);

    const erste = await abmelden(eventId);
    expect(erste.status).toBe(200);
    expect(erste.body).toEqual({ message: 'Abmeldung erfolgreich' });

    const zweite = await abmelden(eventId);
    expect(zweite.status).toBe(200);
    expect(zweite.body).toEqual({ message: 'Abmeldung erfolgreich', bereits_abgemeldet: true });
  });

  it('die Wiederholung schreibt kein zweites Protokoll und schickt keine zweite Mitteilung', async () => {
    const eventId = await termin();
    await bucht(eventId, USERS.konfi1.id);

    await abmelden(eventId).expect(200);
    await wartetAufAufrufe(pushLeitung, 1);
    expect(pushKonfi).toHaveBeenCalledTimes(1);
    expect(pushLeitung).toHaveBeenCalledTimes(1);

    await abmelden(eventId).expect(200);
    // Die Mitteilungen der ersten Abmeldung liefen nach der Antwort -- eine
    // zweite muesste ebenso nach der Antwort kommen. Genug Zeit dafuer lassen.
    await new Promise((r) => setTimeout(r, 200));

    expect(await protokolle(eventId)).toBe(1);
    expect(pushKonfi).toHaveBeenCalledTimes(1);
    expect(pushLeitung).toHaveBeenCalledTimes(1);
  });

  it('die Wiederholung laesst niemanden zusaetzlich nachruecken', async () => {
    const eventId = await termin({ max: 1 });
    const { rows: [k] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ('warte_a', 'Konfi A', 'x', $1, $2) RETURNING id`,
      [ROLES.konfi.id, ORGS.testGemeinde.id]
    );
    const { rows: [k2] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ('warte_b', 'Konfi B', 'x', $1, $2) RETURNING id`,
      [ROLES.konfi.id, ORGS.testGemeinde.id]
    );
    await bucht(eventId, USERS.konfi1.id, 'confirmed', 30);
    await bucht(eventId, k.id, 'waitlist', 20);
    await bucht(eventId, k2.id, 'waitlist', 10);

    await abmelden(eventId).expect(200);
    await abmelden(eventId).expect(200);

    const { rows } = await db.query(
      'SELECT user_id, status FROM event_bookings WHERE event_id = $1 ORDER BY user_id',
      [eventId]
    );
    const status = Object.fromEntries(rows.map((r) => [Number(r.user_id), r.status]));
    expect(status).toEqual({ [k.id]: 'confirmed', [k2.id]: 'waitlist' });
    expect(pushNachruecken).toHaveBeenCalledTimes(1);
  });

  it('nie angemeldet, Event existiert: ebenfalls 200 bereits_abgemeldet, nichts geschrieben', async () => {
    const eventId = await termin();

    const res = await abmelden(eventId);
    expect(res.status).toBe(200);
    expect(res.body.bereits_abgemeldet).toBe(true);
    expect(await protokolle(eventId)).toBe(0);
  });

  it('Event gibt es nicht: 404', async () => {
    const res = await abmelden(999999);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Event nicht gefunden');
  });

  it('Event einer fremden Gemeinde: 404, kein bereits_abgemeldet', async () => {
    const res = await abmelden(EVENTS.event2.id);
    expect(res.status).toBe(404);
    expect(res.body.bereits_abgemeldet).toBeUndefined();
  });

  it('Pflicht-Event ohne Buchung: weiterhin 400 (Abmeldung nur per Opt-out)', async () => {
    const res = await abmelden(EVENTS.pflichtEvent.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Pflicht-Events können nur über Opt-out abgemeldet werden');
  });
});
