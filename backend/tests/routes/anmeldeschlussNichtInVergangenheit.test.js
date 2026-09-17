// Ein Anmeldeschluss, der beim Anlegen schon abgelaufen ist (Befund Simon, 17.09.2026)
//
// SIMONS BEFUND: "wenn Termin Anmeldung zu sofort muss das Endstadium in der
// Zukunft liegen. Tut es gerade nicht."
//
// GEGEN PRODUKTION GEMESSEN: Ein Termin, der in drei Stunden beginnt, mit
// Anmeldeschluss 24 Stunden davor (= gestern), wird kommentarlos angelegt.
// GET /api/events liefert ihn danach mit registration_status = 'closed' —
// der Termin ist in derselben Sekunde zu, in der er entsteht. Niemand kann
// sich anmelden, und nichts im Formular hat davor gewarnt.
//
// WOHER DIE VERGANGENHEIT KOMMT: Das Formular (EventModal.tsx) setzt den
// Anmeldeschluss beim Neuanlegen auf "24 Stunden vor Beginn". Bei jedem
// Termin, der in weniger als 24 Stunden beginnt, liegt der Schluss damit
// automatisch in der Vergangenheit. Das ist kein Sonderfall: "heute Abend
// noch eine Konfistunde eintragen" ist der Normalfall.
//
// WAS HIER GEPRUEFT WIRD — zwei Seiten derselben Regel:
//   VERBOTEN:  ein ZUKUENFTIGER Termin mit bereits abgelaufenem Anmeldeschluss
//              (400, klare Meldung, nichts wird angelegt)
//   ERLAUBT:   ein VERGANGENER Termin mit vergangenem Anmeldeschluss — genau
//              so sieht jede nachtraegliche Bearbeitung eines alten Termins
//              aus, und die darf nicht gesperrt werden.
//
// Und der Nachweis, dass der gute Fall wirklich gut ist: Ein Termin in drei
// Stunden mit einem Schluss kurz vor Beginn steht auf 'open', nicht 'closed'.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Anmeldeschluss darf beim Anlegen nicht schon abgelaufen sein', () => {
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

  // Stunden ab jetzt als ISO-Zeitstempel (negativ = Vergangenheit).
  const inStunden = (stunden) =>
    new Date(Date.now() + stunden * 60 * 60 * 1000).toISOString();

  const grundtermin = {
    name: 'Konfistunde heute Abend',
    description: 'Kurzfristig eingetragen',
    location: 'Gemeindehaus',
    points: 1,
    point_type: 'gemeinde',
    type: 'event',
    max_participants: 10,
    category_ids: [],
    jahrgang_ids: [],
  };

  it('VERBOTEN: Termin in 3 Stunden, Anmeldeschluss 24 Stunden davor (= gestern) — 400, nichts angelegt', async () => {
    // Genau Simons Fall: Die Voreinstellung "24 Stunden vor Beginn" trifft
    // auf einen Termin, der in drei Stunden anfaengt.
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        event_date: inStunden(3),
        event_end_time: inStunden(5),
        registration_closes_at: inStunden(-21),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'Der Anmeldeschluss liegt in der Vergangenheit — so wäre die Anmeldung von Anfang an geschlossen.'
    );

    const { rows } = await db.query(
      'SELECT id FROM events WHERE name = $1',
      [grundtermin.name]
    );
    expect(rows.length).toBe(0);
  });

  it('ERLAUBT: Termin in 3 Stunden mit Anmeldeschluss eine Stunde vor Beginn — registration_status ist "open"', async () => {
    // Die Gegenrichtung: So soll die Voreinstellung kurzfristige Termine
    // behandeln. Geprueft wird nicht nur der 201er, sondern der Status, den
    // die Terminliste danach ausliefert — daran haengt, ob sich jemand
    // anmelden kann.
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        event_date: inStunden(3),
        event_end_time: inStunden(5),
        registration_closes_at: inStunden(2),
      });

    expect(res.status).toBe(201);
    const eventId = res.body.id;
    expect(typeof eventId).toBe('number');

    const liste = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(liste.status).toBe(200);
    const angelegt = liste.body.find((e) => e.id === eventId);
    expect(angelegt).toBeDefined();
    expect(angelegt.registration_status).toBe('open');
  });

  it('ERLAUBT: ein VERGANGENER Termin darf einen vergangenen Anmeldeschluss haben (Nachtragen alter Termine)', async () => {
    // Keine harte Sperre auf "Schluss in der Vergangenheit" an sich: Wer
    // einen Termin von letzter Woche nachtraegt, hat zwangslaeufig beides in
    // der Vergangenheit. Verboten ist nur der Widerspruch — Termin kommt
    // noch, Anmeldung war schon zu.
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        name: 'Konfistunde letzte Woche',
        event_date: inStunden(-24 * 7),
        event_end_time: inStunden(-24 * 7 + 2),
        registration_closes_at: inStunden(-24 * 8),
      });

    expect(res.status).toBe(201);

    const { rows } = await db.query(
      'SELECT id FROM events WHERE name = $1',
      ['Konfistunde letzte Woche']
    );
    expect(rows.length).toBe(1);
  });

  it('ERLAUBT: gar kein Anmeldeschluss (null) bleibt zulaessig', async () => {
    // Pflicht-Events und reine Teamer-Termine senden null — die Pruefung
    // darf sie nicht mitreissen.
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        name: 'Termin ohne Anmeldefenster',
        event_date: inStunden(3),
        event_end_time: inStunden(5),
        registration_closes_at: null,
      });

    expect(res.status).toBe(201);
  });

  it('VERBOTEN auch beim Bearbeiten: ein zukuenftiger Termin bekommt keinen abgelaufenen Schluss verpasst', async () => {
    const angelegt = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        name: 'Termin naechste Woche',
        event_date: inStunden(24 * 7),
        event_end_time: inStunden(24 * 7 + 2),
        registration_closes_at: inStunden(24 * 6),
      });
    expect(angelegt.status).toBe(201);
    const id = angelegt.body.id;

    const res = await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        name: 'Termin naechste Woche',
        event_date: inStunden(24 * 7),
        event_end_time: inStunden(24 * 7 + 2),
        registration_closes_at: inStunden(-1),
      });

    expect(res.status).toBe(400);

    // Der alte Wert steht unveraendert in der Datenbank.
    const { rows } = await db.query(
      'SELECT registration_closes_at FROM events WHERE id = $1',
      [id]
    );
    expect(new Date(rows[0].registration_closes_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('ERLAUBT beim Bearbeiten: ein VERGANGENER Termin bekommt einen Schluss in der Vergangenheit', async () => {
    const angelegt = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        name: 'Alter Termin',
        event_date: inStunden(-48),
        event_end_time: inStunden(-46),
        registration_closes_at: inStunden(-72),
      });
    expect(angelegt.status).toBe(201);

    const res = await request(app)
      .put(`/api/events/${angelegt.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...grundtermin,
        name: 'Alter Termin, korrigiert',
        event_date: inStunden(-48),
        event_end_time: inStunden(-46),
        registration_closes_at: inStunden(-70),
      });

    expect(res.status).toBe(200);
  });
});
