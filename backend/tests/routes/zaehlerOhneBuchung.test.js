// "Anmelden (null/4)" — die Zaehler eines Termins OHNE jede Buchung
// (16.09.2026).
//
// DER FEHLER: An einem frisch angelegten Termin, zu dem sich noch niemand
// angemeldet hat, stand auf dem Anmelde-Knopf in der Konfi-Ansicht
// "Anmelden (null/4)" statt "Anmelden (0/4)".
//
// DIE URSACHE: GET /konfi/events holt die Zahlen aus einer LATERAL-
// Unterabfrage auf die View event_booking_stats. Die View entsteht mit
// GROUP BY ueber event_bookings — ein Termin ohne Buchung hat dort KEINE
// Zeile. Die Unterabfrage liefert dann null Zeilen, `ON true` fuellt alle
// Spalten mit NULL auf, und das COALESCE INNERHALB der Unterabfrage wird
// nie ausgewertet: Es schuetzt vor einer NULL-SPALTE, nicht vor einer
// FEHLENDEN ZEILE.
//
// Die Detailroute GET /konfi/events/:id/status hatte den Fehler nie: dort
// steht das COALESCE auf der aeusseren Ebene ueber einem normalen LEFT JOIN.
// Beide Antworten muessen dieselbe Zahl liefern — sonst zeigt dieselbe
// Konfi in Liste und Detailansicht zwei verschiedene Staende.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Zaehler an einem Termin ohne jede Buchung', () => {
  let app, db, konfiToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
  });

  async function termin({ max = 4 } = {}) {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           point_type, points, cancelled, waitlist_enabled, max_waitlist_size)
       VALUES ('Konfistunde', NOW() + interval '14 days', $1, false, $2,
               'gemeinde', 0, false, true, 10)
       RETURNING id`,
      [ORGS.testGemeinde.id, max]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [event.id, JAHRGAENGE.jahrgang1.id]
    );
    return event.id;
  }

  const ausListe = async (eventId) => {
    const res = await request(app)
      .get('/api/konfi/events')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(res.status).toBe(200);
    const e = res.body.find(x => x.id === eventId);
    expect(e).toBeTruthy();
    return e;
  };

  it('die View hat fuer diesen Termin wirklich keine Zeile', async () => {
    // Die Vorbedingung des Fehlers, ausdruecklich festgehalten: Faellt
    // dieser Test eines Tages, weil die View auch leere Termine fuehrt,
    // ist der Rest hier nicht mehr die scharfe Pruefung, die er sein soll.
    const eventId = await termin();
    const { rows } = await db.query(
      'SELECT event_id FROM event_booking_stats WHERE event_id = $1', [eventId]
    );
    expect(rows).toHaveLength(0);
  });

  it('liefert registered_count als 0, nicht als null', async () => {
    const eventId = await termin({ max: 4 });
    const e = await ausListe(eventId);
    expect(e.registered_count).toBe(0);
  });

  it('liefert waitlist_count als 0, nicht als null', async () => {
    const eventId = await termin();
    expect((await ausListe(eventId)).waitlist_count).toBe(0);
  });

  it('liefert teamer_count als 0, nicht als null', async () => {
    const eventId = await termin();
    expect((await ausListe(eventId)).teamer_count).toBe(0);
  });

  it('liefert abgemeldet_count als 0, nicht als null', async () => {
    const eventId = await termin();
    expect((await ausListe(eventId)).abgemeldet_count).toBe(0);
  });

  it('die Detailansicht liefert dieselbe Zahl wie die Liste', async () => {
    // Zwei Antworten fuer denselben Termin in derselben Rolle duerfen sich
    // nicht widersprechen.
    const eventId = await termin({ max: 4 });
    const liste = await ausListe(eventId);

    const detail = await request(app)
      .get(`/api/konfi/events/${eventId}/status`)
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(detail.status).toBe(200);

    // Die Detailroute nennt die Bestaetigten confirmed_count.
    expect(detail.body.confirmed_count).toBe(0);
    expect(detail.body.confirmed_count).toBe(liste.registered_count);
    expect(detail.body.waitlist_count).toBe(0);
    expect(detail.body.waitlist_count).toBe(liste.waitlist_count);
  });

  it('GEGENPROBE: mit Buchungen stehen die echten Zahlen da', async () => {
    // Beweist, dass oben nicht einfach ueberall 0 herauskommt: Sobald die
    // View eine Zeile hat, zaehlt sie, und zwar getrennt nach Rolle.
    const eventId = await termin({ max: 4 });
    const bucht = (userId, status) => db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, created_at)
       VALUES ($1, $2, $3, $4, NOW()::text)`,
      [userId, eventId, status, ORGS.testGemeinde.id]
    );
    await bucht(USERS.konfi1.id, 'confirmed');
    await bucht(USERS.konfi2.id, 'waitlist');
    await bucht(USERS.teamer1.id, 'confirmed');

    const e = await ausListe(eventId);
    expect(e.registered_count).toBe(1);
    expect(e.waitlist_count).toBe(1);
    expect(e.teamer_count).toBe(1);
    expect(e.abgemeldet_count).toBe(0);
  });

  it('GEGENPROBE: eine Abmeldung landet in abgemeldet_count', async () => {
    const eventId = await termin({ max: 4 });
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, attendance_status,
                                   organization_id, created_at)
       VALUES ($1, $2, 'excused', 'excused', $3, NOW()::text)`,
      [USERS.konfi1.id, eventId, ORGS.testGemeinde.id]
    );

    const e = await ausListe(eventId);
    expect(e.registered_count).toBe(0);
    expect(e.abgemeldet_count).toBe(1);
  });
});
