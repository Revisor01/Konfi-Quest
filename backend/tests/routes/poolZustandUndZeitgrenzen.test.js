// Datenbank-Pool: Zeitgrenzen und Sichtbarkeit.
//
// Anlass (EKD-Ausrollung): Ein Konfi-Dashboard-Aufruf belegt zehn Pool-Plaetze
// (neun parallele Abfragen plus die aeussere Verbindung), der Pool hat 20 —
// zwei gleichzeitige Aufrufe fuellen ihn also. In Produktion nachgemessen
// stehen statement_timeout und idle_in_transaction_session_timeout auf 0
// (unbegrenzt): Eine haengende Abfrage haelt ihren Platz ewig.
//
// Was hier geprueft wird:
//   1. /api/health bleibt UNVERAENDERT — Traefik prueft genau diesen Pfad alle
//      5 Sekunden als Gesundheitspruefung. Form und Felder sind Vertrag.
//   2. Pool-Innereien stehen NICHT im oeffentlichen /api/health, sondern in
//      der angemeldeten Metrik-Route, und dort nur fuer super_admin.
//   3. Die Zeitgrenzen sind am Pool gesetzt (statement_timeout serverseitig,
//      query_timeout clientseitig) und brechen eine haengende Abfrage ab,
//      statt ihren Platz zu halten.
const request = require('supertest');
const { Pool } = require('pg');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Datenbank-Pool: Zeitgrenzen und Sichtbarkeit', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // 1. /api/health ist Vertrag — Traefik haengt daran
  // ================================================================
  describe('/api/health bleibt unveraendert', () => {
    it('antwortet ohne Anmeldung mit genau status und message', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.message).toBe('Konfi Points API is running');
      // Genau diese zwei Felder — nicht mehr. Wuerde hier etwas dazukommen,
      // waere der Traefik-Healthcheck (Intervall 5 s) teurer als noetig.
      expect(Object.keys(res.body).sort()).toEqual(['message', 'status']);
    });

    it('gibt KEINE Pool-Innereien preis (der Pfad ist oeffentlich)', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('dbPool');
      expect(text).not.toContain('wartend');
      expect(text).not.toContain('idleCount');
    });
  });

  // ================================================================
  // 2. Pool-Zustand in der angemeldeten Metrik-Route
  // ================================================================
  describe('Pool-Zustand in /api/metrics', () => {
    it('super_admin sieht gesamt, frei, wartend und max', async () => {
      const res = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`);

      expect(res.status).toBe(200);
      expect(res.body.dbPool).toBeTruthy();
      expect(typeof res.body.dbPool.gesamt).toBe('number');
      expect(typeof res.body.dbPool.frei).toBe('number');
      expect(typeof res.body.dbPool.wartend).toBe('number');
      // Der Test-Pool laeuft ohne belegte Plaetze -> niemand wartet.
      expect(res.body.dbPool.wartend).toBe(0);
      // Alle bisherigen Felder bleiben: nur hinzugefuegt, nichts weggelassen.
      expect(typeof res.body.totalRequests).toBe('number');
      expect(Array.isArray(res.body.routesSlowest)).toBe(true);
      expect(Array.isArray(res.body.replicas)).toBe(true);
    });

    it('derselbe Zustand steht auch in /api/metrics/local', async () => {
      const res = await request(app)
        .get('/api/metrics/local')
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.dbPool.wartend).toBe('number');
    });

    it('admin ohne super_admin-Flag bekommt 403 — auch fuer den Pool-Zustand', async () => {
      const res = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${generateToken('admin1')}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Zugriff verweigert');
      expect(res.body.dbPool).toBeUndefined();
    });

    it('ohne Token 401', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // 3. Die Zeitgrenzen greifen wirklich
  // ================================================================
  describe('statement_timeout bricht eine haengende Abfrage ab', () => {
    it('pg_sleep laenger als die Grenze scheitert, statt den Platz zu halten', async () => {
      // Eigener Pool mit derselben Konfiguration wie database.js, nur mit
      // kurzer Grenze: Die 30 s aus der Produktion liessen den Test 30 s
      // haengen. Geprueft wird der MECHANISMUS (Pool-Option greift), nicht
      // der Zahlenwert.
      const kurz = new Pool({
        connectionString: process.env.TEST_DATABASE_URL
          || 'postgresql://postgres:postgres@localhost:5433/postgres',
        max: 2,
        statement_timeout: 300,
        query_timeout: 300,
      });
      try {
        await expect(kurz.query('SELECT pg_sleep(3)')).rejects.toThrow(
          /statement timeout|Query read timeout/i
        );
        // Entscheidend: Der Platz ist danach wieder frei, nicht blockiert.
        const { rows } = await kurz.query('SELECT 1 AS eins');
        expect(rows[0].eins).toBe(1);
        expect(kurz.waitingCount).toBe(0);
      } finally {
        await kurz.end();
      }
    });

    it('eine kurze Abfrage laeuft unter derselben Grenze durch', async () => {
      // Der erlaubte Fall: Die Grenze darf keine legitime Abfrage killen.
      // Gemessen an Produktion liegt die schwerste Dashboard-Abfrage bei
      // 10,5 ms, die langsamste Route bei 1718 ms Serverzeit — 30 s ist rund
      // das 17-fache der gemessenen Spitze.
      const pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL
          || 'postgresql://postgres:postgres@localhost:5433/postgres',
        max: 2,
        statement_timeout: 30000,
        query_timeout: 30000,
      });
      try {
        const { rows } = await pool.query('SELECT pg_sleep(0.2), 42 AS antwort');
        expect(rows[0].antwort).toBe(42);
      } finally {
        await pool.end();
      }
    });
  });

  // ================================================================
  // 4. wartend > 0 ist die Zahl, an der sich ein voller Pool ablesen laesst
  // ================================================================
  describe('poolZustand zeigt anstehende Anfragen', () => {
    it('wartend steigt, wenn mehr Abfragen laufen als Plaetze da sind', async () => {
      // Genau der Fall aus dem Befund, nur im Kleinen: 2 Plaetze, 4 gleich-
      // zeitige Abfragen. Ohne Sichtbarkeit merkt niemand, dass der Pool
      // voll ist — in Produktion belegt EIN Dashboard-Aufruf zehn Plaetze.
      const pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL
          || 'postgresql://postgres:postgres@localhost:5433/postgres',
        max: 2,
        statement_timeout: 30000,
        query_timeout: 30000,
      });
      try {
        const laufend = [
          pool.query('SELECT pg_sleep(0.6)'),
          pool.query('SELECT pg_sleep(0.6)'),
          pool.query('SELECT pg_sleep(0.6)'),
          pool.query('SELECT pg_sleep(0.6)'),
        ];
        // Kurz warten, damit die ersten zwei die Plaetze haben.
        await new Promise((r) => setTimeout(r, 150));
        expect(pool.totalCount).toBe(2);
        expect(pool.waitingCount).toBe(2);

        await Promise.all(laufend);
        expect(pool.waitingCount).toBe(0);
      } finally {
        await pool.end();
      }
    });

    it('ein Fehler auf einer leerlaufenden Verbindung beendet den Prozess nicht', async () => {
      // pg wirft auf dem Pool ein 'error'-Event, wenn eine LEERLAUFENDE
      // Verbindung stirbt (Datenbank neugestartet). Ohne Zuhoerer ist das in
      // Node ein unbehandeltes Event und der Prozess endet.
      const pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL
          || 'postgresql://postgres:postgres@localhost:5433/postgres',
        max: 1,
      });
      const gesehen = [];
      pool.on('error', (err) => gesehen.push(err));
      try {
        const client = await pool.connect();
        const { rows } = await client.query('SELECT pg_backend_pid() AS pid');
        client.release();

        // Die jetzt leerlaufende Verbindung von aussen abschiessen.
        await db.query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
        await new Promise((r) => setTimeout(r, 300));

        // Der Zuhoerer hat den Fehler bekommen, der Prozess laeuft weiter.
        expect(gesehen.length).toBeGreaterThan(0);
        const { rows: weiter } = await pool.query('SELECT 7 AS sieben');
        expect(weiter[0].sieben).toBe(7);
      } finally {
        await pool.end();
      }
    });
  });
});
