// Ein Pflichttermin ohne Jahrgang bucht niemanden -- und faellt nicht auf
//
// SIMONS BEFUND (26.09.2026, in Produktion gemessen): In Hennstedt standen
// bei den Konfisamstagen nur 4 von 12 Konfis, obwohl es Pflichttermine sind.
//
// Die Kette: Die Termine waren ohne Zeilen in event_jahrgang_assignments
// entstanden. Die Auto-Anmeldung haengt genau daran
// (verwaltung.js: `if (mandatory && jahrgang_ids && jahrgang_ids.length > 0)`)
// -- kein Jahrgang, keine Buchung.
//
// GLEICHZEITIG ist ein Termin OHNE Jahrgang fuer ALLE Konfis sichtbar
// (lesen.js:261: "Allgemeine Events (keine Jahrgang-Zuweisung) sind fuer alle
// sichtbar"). Vier Konfis meldeten sich deshalb selbst an, waehrend die
// Automatik schwieg. Der Termin sah aus wie jeder andere; der Fehlbestand
// faellt nur auf, wenn jemand die Teilnehmerliste zaehlt.
//
// Beide Regeln fuer sich sind richtig. Ihre KOMBINATION ist die Falle, und
// sie laesst sich nur beim Speichern abfangen: Ein Pflichttermin ohne
// Jahrgang ist ein Widerspruch -- "alle muessen" ohne "wer".

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Pflichttermin braucht einen Jahrgang', () => {
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

  const termin = (felder) => ({
    name: 'Konfisamstag',
    description: 'Test',
    event_date: '2027-05-01T10:00:00Z',
    location: 'Gemeindehaus',
    points: 1,
    type: 'gemeinde',
    max_participants: 0,
    ...felder
  });

  const anlegen = (felder) =>
    request(app).post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(termin(felder));

  // ---- der verbotene Fall -------------------------------------------------

  it('weist einen Pflichttermin OHNE Jahrgang ab', async () => {
    const res = await anlegen({ mandatory: true, jahrgang_ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('pflicht_ohne_jahrgang');
  });

  it('weist ihn auch ab, wenn jahrgang_ids ganz fehlt', async () => {
    const ohne = termin({ mandatory: true });
    delete ohne.jahrgang_ids;
    const res = await request(app).post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`).send(ohne);
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('pflicht_ohne_jahrgang');
  });

  it('laesst einem bestehenden Pflichttermin den Jahrgang nicht wegnehmen', async () => {
    const neu = await anlegen({ mandatory: true, jahrgang_ids: [JAHRGAENGE.jahrgang1.id] });
    expect(neu.status).toBe(201);

    const res = await request(app).put(`/api/events/${neu.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(termin({ mandatory: true, jahrgang_ids: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('pflicht_ohne_jahrgang');

    // Die Buchungen bleiben unangetastet.
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM event_bookings WHERE event_id = $1`,
      [neu.body.id]
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });

  // ---- die erlaubten Faelle ----------------------------------------------

  it('legt einen Pflichttermin MIT Jahrgang an und bucht alle Konfis', async () => {
    const res = await anlegen({ mandatory: true, jahrgang_ids: [JAHRGAENGE.jahrgang1.id] });
    expect(res.status).toBe(201);

    // Der Seed legt zwei Konfis in jahrgang1 -- beide sind gebucht.
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM event_bookings
        WHERE event_id = $1 AND status = 'confirmed'`,
      [res.body.id]
    );
    expect(rows[0].n).toBe(2);
  });

  it('ein FREIWILLIGER Termin darf weiterhin ohne Jahrgang bestehen', async () => {
    // Das ist der gewollte Fall: ein Termin fuer die ganze Gemeinde. Er ist
    // fuer alle sichtbar (lesen.js:261) und bucht niemanden -- beides richtig.
    const res = await anlegen({ mandatory: false, jahrgang_ids: [] });
    expect(res.status).toBe(201);

    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM event_bookings WHERE event_id = $1`,
      [res.body.id]
    );
    expect(rows[0].n).toBe(0);
  });

  it('ein Pflichttermin laesst sich zu einem freiwilligen ohne Jahrgang machen', async () => {
    const neu = await anlegen({ mandatory: true, jahrgang_ids: [JAHRGAENGE.jahrgang1.id] });
    expect(neu.status).toBe(201);

    const res = await request(app).put(`/api/events/${neu.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(termin({ mandatory: false, jahrgang_ids: [] }));
    expect(res.status).toBe(200);
  });
});
