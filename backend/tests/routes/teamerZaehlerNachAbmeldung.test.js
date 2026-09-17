// DIE TEAM-ZAHL DARF ABGEMELDETE NICHT MITZAEHLEN (17.09.2026, Simons Befund)
//
// WOERTLICH: "Teamer ist angemeldet im Event hat sich aber selber wieder
// abgemeldet. In der Liste steht dennoch 1/8."
//
// GEGEN PRODUKTION GEMESSEN (Termin 162, Org 4). Bei einer Zusage und einer
// Selbstabmeldung lieferte:
//
//   GET /api/events      (Liste)  -> teamer_count = 2   FALSCH
//   GET /api/events/:id  (Detail) -> teamer_count = 1   RICHTIG
//
// Dieselbe Zahl, zwei Antworten: Die Liste zaehlte die Abmeldung mit.
//
// WARUM DIESER TEST WICHTIG IST, AUCH WENN ER GRUEN BLEIBT: Die Liste liest
// ihre Zahl aus der Sicht event_booking_stats, und deren Definition in
// Migration 154 filtert ausdruecklich auf status = 'confirmed' -- eine
// abgemeldete Buchung kann dort nicht mitzaehlen. Bleibt dieser Test gruen,
// ist der Repo-Code also in Ordnung und der Fehler steckt in der
// PRODUKTIONSDATENBANK: dort laeuft dann noch eine aeltere Fassung der Sicht
// (Migration 128 oder 136), die den Statusfilter nicht hat. Genau diese
// Unterscheidung soll der Test treffen -- ein gruener Lauf ist hier ein
// Befund, kein "nichts gefunden".
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Team-Zahl nach einer Abmeldung', () => {
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
  });

  async function teamTermin() {
    const inZweiWochen = new Date();
    inZweiWochen.setDate(inZweiWochen.getDate() + 14);
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Adventsbasteln',
        event_date: inZweiWochen.toISOString(),
        max_participants: 24,
        points: 0,
        teamer_needed: true,
        teamer_max_participants: 8,
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
      });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const zusage = (eventId, token, koerper) =>
    request(app)
      .post(`/api/teamer/events/${eventId}/zusage`)
      .set('Authorization', `Bearer ${token}`)
      .send(koerper);

  async function ausListe(eventId) {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    return res.body.find((e) => e.id === eventId);
  }

  async function ausDetail(eventId) {
    const res = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('nach der Selbstabmeldung zaehlt die Liste die Person NICHT mehr', async () => {
    const eventId = await teamTermin();
    const teamerToken = generateToken('teamer1');

    await zusage(eventId, teamerToken, { dabei: true }).expect(200);
    expect((await ausListe(eventId)).teamer_count).toBe(1);

    await zusage(eventId, teamerToken, { dabei: false, reason: 'Doch verhindert' }).expect(200);

    // DAS ist Simons "1/8": Die Zahl muss auf 0 fallen.
    expect((await ausListe(eventId)).teamer_count).toBe(0);
  });

  it('Liste und Detailansicht sagen dieselbe Zahl', async () => {
    // Der messbare Widerspruch aus Produktion.
    const eventId = await teamTermin();
    const teamerToken = generateToken('teamer1');

    await zusage(eventId, teamerToken, { dabei: true }).expect(200);
    await zusage(eventId, teamerToken, { dabei: false, reason: 'Doch verhindert' }).expect(200);

    const liste = await ausListe(eventId);
    const detail = await ausDetail(eventId);

    expect(liste.teamer_count).toBe(detail.teamer_count);
    expect(liste.teamer_count).toBe(0);
  });

  it('eine Zusage neben einer Abmeldung zaehlt genau einmal', async () => {
    // Der Stand, den ich in Produktion hergestellt habe: eine Person dabei,
    // eine abgemeldet. Die Liste sagte 2.
    const eventId = await teamTermin();

    await zusage(eventId, generateToken('teamer1'), { dabei: true }).expect(200);
    await zusage(eventId, generateToken('orgAdmin1'), { dabei: true }).expect(200);
    await zusage(eventId, generateToken('teamer1'), { dabei: false, reason: 'Krank' }).expect(200);

    const liste = await ausListe(eventId);
    const detail = await ausDetail(eventId);

    expect(liste.teamer_count).toBe(1);
    expect(detail.teamer_count).toBe(1);
  });

  it('auch die Abmeldung DURCH DIE LEITUNG zaehlt nicht mehr mit', async () => {
    // Migration 153 setzt dabei status = 'excused' statt 'opted_out'. Die
    // Sicht muss beide Arten gleich behandeln -- eine abgemeldete Person
    // belegt keinen Platz.
    const eventId = await teamTermin();
    const teamerToken = generateToken('teamer1');
    await zusage(eventId, teamerToken, { dabei: true }).expect(200);

    const { rows: [b] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, USERS.teamer1.id]
    );
    await request(app)
      .put(`/api/events/${eventId}/participants/${b.id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendance_status: 'excused', excuse_reason: 'krank gemeldet' })
      .expect(200);

    expect((await ausListe(eventId)).teamer_count).toBe(0);
    expect((await ausDetail(eventId)).teamer_count).toBe(0);
  });

  it('die Sicht selbst zaehlt eine abgemeldete Buchung nicht als bestaetigt', async () => {
    // Direkt an der Quelle geprueft: Wenn dieser Test gruen ist, die App
    // aber trotzdem falsch zaehlt, laeuft in Produktion eine aeltere Fassung
    // der Sicht. Genau das ist die offene Frage zu diesem Befund.
    const eventId = await teamTermin();
    const teamerToken = generateToken('teamer1');
    await zusage(eventId, teamerToken, { dabei: true }).expect(200);
    await zusage(eventId, teamerToken, { dabei: false, reason: 'Doch verhindert' }).expect(200);

    const { rows } = await db.query(
      'SELECT teamer_confirmed, teamer_opted_out FROM event_booking_stats WHERE event_id = $1',
      [eventId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].teamer_confirmed).toBe(0);
    expect(rows[0].teamer_opted_out).toBe(1);
  });
});
