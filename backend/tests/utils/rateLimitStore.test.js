// backend/tests/utils/rateLimitStore.test.js
//
// Gemeinsamer Zaehler fuer die Rate-Limiter aller Replicas (Audit 26.09.2026,
// Betrieb BF-09 / Sammelbefund S-10).
//
// BEFUND: Alle rateLimit(...)-Bloecke in server.js liefen mit dem MemoryStore
// je Prozess. Hinter Traefik mit zwei Replicas galt jedes Limit doppelt und
// 429 kam scheinbar zufaellig. Reproduziert: 21 falsche Doku-Passwoerter an
// Replica A -> 429, direkt danach an B -> 401.
//
// Hier stehen zwei App-Instanzen (zwei createApp, je ein eigener Store wie
// zwei Prozesse) auf DERSELBEN Datenbank. Der Doku-Limiter ist der
// Messpunkt, weil die Passwortpruefung dort keine Datenbank braucht und der
// Limiter die einzige Bremse ist.
//
// GEGENPROBE: Mit `store` weggelassen (MemoryStore je Instanz) faellt der
// erste Test mit "expected 401 to be 429" -- der Test darunter zeigt genau
// diesen alten Stand bewusst als Vergleich.
const os = require('os');
const request = require('supertest');
const rateLimit = require('express-rate-limit');
const { createApp } = require('../../createApp');
const { getTestPool, closePool } = require('../helpers/db');
const { PostgresRateLimitStore, aufraeumen, TABELLE } = require('../../utils/rateLimitStore');

const PASSWORT = process.env.DOCS_PASSWORD || 'test-docs-passwort';
const FALSCH = 'definitiv-falsch';
const MELDUNG = { error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' };

describe('PostgresRateLimitStore', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM ${TABELLE}`);
  });

  afterAll(async () => {
    await closePool();
  });

  // Eine App-Instanz mit dem Doku-Limiter -- wie server.js ihn baut, nur mit
  // festem Schluessel (eine "IP") und kurzen Zahlen.
  function instanz({ max, windowMs = 60 * 1000, store }) {
    const limiter = rateLimit({
      store,
      windowMs,
      max,
      keyGenerator: () => 'eine-ip',
      message: MELDUNG,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      validate: false,
    });
    return createApp(db, { uploadsDir: os.tmpdir(), rateLimiters: { docsLoginLimiter: limiter } });
  }

  const anmelden = (app, passwort) =>
    request(app).post('/api/docs-auth/anmelden').send({ passwort });

  it('zwei Instanzen teilen den Zaehler: die N+1-te Anfrage ueber die zweite Instanz bekommt 429', async () => {
    const a = instanz({ max: 3, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });
    const b = instanz({ max: 3, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });

    for (let i = 0; i < 3; i++) {
      expect((await anmelden(a, FALSCH)).status).toBe(401);
    }
    const res = await anmelden(b, FALSCH);

    expect(res.status).toBe(429);
    expect(res.body).toEqual(MELDUNG);
  });

  it('zum Vergleich der alte Stand: mit dem Speicher je Instanz zaehlt die zweite Instanz bei null', async () => {
    const a = instanz({ max: 3, store: undefined });
    const b = instanz({ max: 3, store: undefined });

    for (let i = 0; i < 3; i++) {
      expect((await anmelden(a, FALSCH)).status).toBe(401);
    }

    // Genau das ist BF-09: A ist voll, B laesst durch.
    expect((await anmelden(b, FALSCH)).status).toBe(401);
  });

  it('die RateLimit-Header zeigen den gemeinsamen Stand', async () => {
    const a = instanz({ max: 3, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });
    const b = instanz({ max: 3, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });

    expect((await anmelden(a, FALSCH)).headers['ratelimit-remaining']).toBe('2');
    expect((await anmelden(a, FALSCH)).headers['ratelimit-remaining']).toBe('1');
    const res = await anmelden(b, FALSCH);
    expect(res.headers['ratelimit-limit']).toBe('3');
    expect(res.headers['ratelimit-remaining']).toBe('0');
  });

  it('das Fenster laeuft ab: danach zaehlt der Schluessel von vorn', async () => {
    const a = instanz({ max: 2, windowMs: 300, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });

    expect((await anmelden(a, FALSCH)).status).toBe(401);
    expect((await anmelden(a, FALSCH)).status).toBe(401);
    expect((await anmelden(a, FALSCH)).status).toBe(429);

    await new Promise((r) => setTimeout(r, 350));

    expect((await anmelden(a, FALSCH)).status).toBe(401);
  });

  it('erfolgreiche Anmeldungen zaehlen nicht (skipSuccessfulRequests nimmt den Treffer zurueck)', async () => {
    const a = instanz({ max: 2, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });
    const b = instanz({ max: 2, store: new PostgresRateLimitStore(db, { prefix: 'docs' }) });

    for (let i = 0; i < 3; i++) {
      expect((await anmelden(a, PASSWORT)).status).toBe(200);
    }
    expect((await anmelden(b, FALSCH)).status).toBe(401);
    expect((await anmelden(a, FALSCH)).status).toBe(401);
    expect((await anmelden(b, FALSCH)).status).toBe(429);
  });

  it('verschiedene Limiter trennen ihren Schluesselraum ueber das Praefix', async () => {
    const docs = new PostgresRateLimitStore(db, { prefix: 'docs' });
    const auth = new PostgresRateLimitStore(db, { prefix: 'auth' });
    docs.init({ windowMs: 60000 });
    auth.init({ windowMs: 60000 });

    await docs.increment('k');
    await docs.increment('k');
    const { totalHits } = await auth.increment('k');

    expect(totalHits).toBe(1);
    expect((await docs.get('k')).totalHits).toBe(2);
  });

  it('resetKey loescht den Zaehler', async () => {
    const store = new PostgresRateLimitStore(db, { prefix: 'docs' });
    const a = instanz({ max: 1, store });

    expect((await anmelden(a, FALSCH)).status).toBe(401);
    expect((await anmelden(a, FALSCH)).status).toBe(429);

    await store.resetKey('eine-ip');

    expect((await anmelden(a, FALSCH)).status).toBe(401);
  });

  it('faellt bei Datenbankfehlern auf den Speicher je Prozess zurueck statt 500 zu liefern', async () => {
    const meldungen = [];
    const kaputt = { query: async () => { throw new Error('connection refused'); } };
    const store = new PostgresRateLimitStore(kaputt, { prefix: 'docs', log: (...a) => meldungen.push(a.join(' ')) });
    store.init({ windowMs: 60000 });

    // Werte sofort lesen: Der MemoryStore gibt sein internes Objekt zurueck
    // und zaehlt darin weiter -- so liest es auch die Middleware.
    const eins = (await store.increment('k')).totalHits;
    const zwei = (await store.increment('k')).totalHits;
    const drei = await store.increment('k');

    expect([eins, zwei, drei.totalHits]).toEqual([1, 2, 3]);
    expect(drei.resetTime).toBeInstanceOf(Date);
    // Einmal gemeldet, nicht je Treffer.
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]).toContain('zaehle je Replica im Speicher weiter');
    store.shutdown();
  });

  it('aufraeumen entfernt Zeilen, deren Fenster laenger als eine Stunde vorbei ist', async () => {
    await db.query(
      `INSERT INTO ${TABELLE} (schluessel, treffer, ablauf) VALUES
         ('docs:alt', 5, NOW() - interval '2 hours'),
         ('docs:frisch', 1, NOW() + interval '10 minutes')`
    );

    const geloescht = await aufraeumen(db);

    expect(geloescht).toBe(1);
    const { rows } = await db.query(`SELECT schluessel FROM ${TABELLE} ORDER BY schluessel`);
    expect(rows.map((r) => r.schluessel)).toEqual(['docs:frisch']);
  });
});
