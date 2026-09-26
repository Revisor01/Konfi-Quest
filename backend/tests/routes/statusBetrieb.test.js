// backend/tests/routes/statusBetrieb.test.js
//
// GET /api/status als Betriebsanzeige: Migrationsstand (Audit 26.09.2026,
// Datenbank BF-04) und Cron-Leader (Betrieb BF-10).
//
// Beides ADDITIV: Die bestehenden Felder (status, version, commit,
// uptimeSeconds, checks.database, responseTimeMs) bleiben unveraendert, der
// Deploy-Verify in ci.yml liest checks.database weiter wie bisher.
const request = require('supertest');
const { createApp } = require('../../createApp');
const { getTestPool, closePool } = require('../helpers/db');

describe('GET /api/status als Betriebsanzeige', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  afterAll(async () => {
    await closePool();
  });

  // Ein db-Objekt wie database.js, mit steuerbarem Migrationsstand.
  const appMit = (migrationsstand) => createApp({
    query: (t, p) => db.query(t, p),
    getClient: () => db.getClient(),
    poolZustand: () => db.poolZustand(),
    migrationsstand: () => migrationsstand,
  }, { uploadsDir: require('os').tmpdir() });

  describe('Migrationsstand', () => {
    it('meldet checks.migrations = ok, wenn der Lauf ohne Fehlschlag durch ist', async () => {
      const res = await request(appMit({ neu: 2, gesamt: 90, fehlgeschlagen: [] })).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body.checks).toEqual({ database: 'ok', migrations: 'ok', cron_leader: 'fehlt' });
      expect(res.body.migrationen).toEqual({ gesamt: 90, neu: 2, fehlgeschlagen: [] });
    });

    it('meldet checks.migrations = fehler und die Dateinamen, wenn eine uebersprungen wurde', async () => {
      const res = await request(appMit({
        neu: 1,
        gesamt: 90,
        fehlgeschlagen: [{ file: '170_kaputt.sql', message: 'relation "x" does not exist' }],
      })).get('/api/status');

      // Status bleibt 200: Die Datenbank ist da. Der Deploy-Verify liest das
      // Feld getrennt und bricht dort ab.
      expect(res.status).toBe(200);
      expect(res.body.checks.database).toBe('ok');
      expect(res.body.checks.migrations).toBe('fehler');
      expect(res.body.migrationen.fehlgeschlagen).toEqual(['170_kaputt.sql']);
      // Die Fehlermeldung selbst bleibt im Log -- der Pfad ist oeffentlich.
      expect(JSON.stringify(res.body)).not.toContain('does not exist');
    });

    it('meldet checks.migrations = laeuft, solange der Startlauf noch nicht durch ist', async () => {
      const res = await request(appMit(null)).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body.checks.migrations).toBe('laeuft');
      expect(res.body.migrationen).toBeUndefined();
    });

    it('laesst die Felder weg, wenn das db-Objekt keinen Migrationsstand kennt (Test-Pool)', async () => {
      const app = createApp(db, { uploadsDir: require('os').tmpdir() });
      const res = await request(app).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body.checks).toEqual({ database: 'ok', cron_leader: 'fehlt' });
      expect(res.body.migrationen).toBeUndefined();
    });

    it('behaelt die bisherigen Felder unveraendert (Deploy-Verify liest checks.database)', async () => {
      const res = await request(appMit({ neu: 0, gesamt: 90, fehlgeschlagen: [] })).get('/api/status');

      expect(res.body.status).toBe('OK');
      expect(typeof res.body.version).toBe('string');
      expect(typeof res.body.commit).toBe('string');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(typeof res.body.responseTimeMs).toBe('number');
      expect(Object.keys(res.body).sort()).toEqual(
        ['checks', 'commit', 'migrationen', 'responseTimeMs', 'status', 'uptimeSeconds', 'version']
      );
    });
  });

  describe('Cron-Leader', () => {
    const { Client } = require('pg');
    const { starteCronLeaderWahl } = require('../../utils/cronLeader');
    const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
    const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');
    const stumm = { warn: () => {}, error: () => {} };

    const appMitLeader = (istCronLeader) => createApp(db, {
      uploadsDir: require('os').tmpdir(),
      ...(istCronLeader ? { istCronLeader } : {}),
    });

    it('meldet checks.cron_leader = fehlt, wenn keine Replica den Lock haelt', async () => {
      const res = await request(appMitLeader(null)).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body.checks.cron_leader).toBe('fehlt');
      // Ohne Funktion aus server.js kein Feld fuer DIESE Replica.
      expect(res.body.cron_leader).toBeUndefined();
    });

    it('meldet cron_leader = true und checks.cron_leader = ok auf der Leader-Replica', async () => {
      const wahl = starteCronLeaderWahl({
        verbinde: () => new Client({ connectionString: TEST_DB_URL }),
        taktMs: 60000,
        log: stumm,
      });
      try {
        await wahl.bereit;
        expect(wahl.istLeader()).toBe(true);

        const res = await request(appMitLeader(() => wahl.istLeader())).get('/api/status');

        expect(res.status).toBe(200);
        expect(res.body.cron_leader).toBe(true);
        expect(res.body.checks.cron_leader).toBe('ok');
      } finally {
        await wahl.stopp();
      }
    });

    it('meldet cron_leader = false, aber checks.cron_leader = ok auf der anderen Replica', async () => {
      const wahl = starteCronLeaderWahl({
        verbinde: () => new Client({ connectionString: TEST_DB_URL }),
        taktMs: 60000,
        log: stumm,
      });
      try {
        await wahl.bereit;
        // Die ANDERE Replica: haelt den Lock nicht, sieht ihn aber in pg_locks.
        const res = await request(appMitLeader(() => false)).get('/api/status');

        expect(res.body.cron_leader).toBe(false);
        expect(res.body.checks.cron_leader).toBe('ok');
      } finally {
        await wahl.stopp();
      }
      const danach = await request(appMitLeader(() => false)).get('/api/status');
      expect(danach.body.checks.cron_leader).toBe('fehlt');
    });
  });
});
