// Fehler beim Lesen des Anfrage-Koerpers sind 4xx, nicht 500
// (Audit Sicherheit BF-17, 29.09.2026).
//
// Vorher kannte der Fehlerhandler in createApp.js nur LIMIT_FILE_SIZE:
// ungueltiges JSON und ein Koerper ueber 100 kB endeten als
// 500 "Something went wrong!", mit vollem Stack im Log je Anfrage und als
// Serverfehler in den Betriebszahlen. Jetzt der Status des Body-Parsers mit
// deutscher Meldung und ohne Log-Zeile.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');

describe('Fehler im Anfrage-Koerper', () => {
  let app;
  let db;
  let errorSpy;

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
    errorSpy = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function login() {
    return request(app).post('/api/auth/login').set('Content-Type', 'application/json');
  }

  it('ungueltiges JSON -> 400 mit deutscher Meldung, kein Stack im Log', async () => {
    const res = await login().send('{"username": "konfi1", "password": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Die Anfrage enthält kein gültiges JSON.' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Koerper ueber 100 kB -> 413, kein Stack im Log', async () => {
    const gross = JSON.stringify({ username: 'konfi1', password: 'x', pad: 'a'.repeat(200 * 1024) });
    const res = await login().send(gross);
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Die Anfrage ist zu groß.' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('fremder Zeichensatz -> 415', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{"username":"konfi1"}');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Der Zeichensatz der Anfrage wird nicht unterstützt.' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('unbekannte Kodierung -> 415', async () => {
    const res = await login()
      .set('Content-Encoding', 'compress')
      .send('{"username":"konfi1"}');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Die Kodierung der Anfrage wird nicht unterstützt.' });
  });

  it('gilt vor jeder Route, auch vor der Doku-Anmeldung', async () => {
    const res = await request(app)
      .post('/api/docs-auth/anmelden')
      .set('Content-Type', 'application/json')
      .send('{kaputt');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Die Anfrage enthält kein gültiges JSON.' });
  });

  it('ERLAUBT: gueltiges JSON knapp unter 100 kB erreicht die Route', async () => {
    const res = await login().send(JSON.stringify({
      username: USERS.konfi1.username,
      password: PASSWORD,
      pad: 'a'.repeat(90 * 1024),
    }));
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('ERLAUBT: leerer Koerper bleibt ein Fall der Route (400 aus der Validierung, kein Parser-Fehler)', async () => {
    const res = await login().send('');
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe('Die Anfrage enthält kein gültiges JSON.');
  });
});
