// backend/tests/routes/statusBetrieb.test.js
//
// GET /api/status als Betriebsanzeige: Migrationsstand (Audit 26.09.2026,
// Datenbank BF-04), Cron-Leader (Betrieb BF-10) und die Nachlauf-
// Warteschlange (Simon, 08.10.2026).
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
      // Die App-Version, nicht eine interne Paketnummer: backend/package.json folgt
      // frontend/version.json (CLAUDE.md, Abschnitt Versionsnummern; bis 27.09.2026
      // stand hier 1.0.1 auf einem 2.3.0-System, Audit S-13).
      const quelle = require('../../../frontend/version.json');
      expect(res.body.version).toBe(quelle.version);
      expect(typeof res.body.commit).toBe('string');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(typeof res.body.responseTimeMs).toBe('number');
      expect(Object.keys(res.body).sort()).toEqual(
        // nachlauf kam am 08.10.2026 hinzu (additiv); alle bisherigen Schluessel bleiben.
        // support_mail kam am 10.10.2026 hinzu (additiv, ohne Stack-Variablen 'nicht_eingerichtet').
        ['checks', 'commit', 'migrationen', 'nachlauf', 'responseTimeMs', 'status', 'support_mail', 'uptimeSeconds', 'version']
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
  describe('Nachlauf-Warteschlange', () => {
    const { truncateAll } = require('../helpers/db');
    const T = 'nachlauf_auftraege';
    const app = () => createApp(db, { uploadsDir: require('os').tmpdir() });

    beforeEach(async () => { await truncateAll(db); });

    const anlegen = (status, { erstellt = 'NOW()', erledigt = 'NULL' } = {}) => db.query(
      `INSERT INTO ${T} (art, status, erstellt_am, faellig_ab, erledigt_am)
       VALUES ('x', $1, ${erstellt}, ${erstellt}, ${erledigt})`, [status]);

    it('leere Schlange: nachlauf = {haengend: 0, fehlgeschlagen: 0}, checks unveraendert', async () => {
      const res = await request(app()).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.nachlauf).toEqual({ haengend: 0, fehlgeschlagen: 0 });
      expect(res.body.checks).toEqual({ database: 'ok', cron_leader: 'fehlt' });
    });

    it('zaehlt haengend erst ab 15 Minuten und fehlgeschlagen nur der letzten 24 Stunden', async () => {
      await anlegen('offen', { erstellt: "NOW() - INTERVAL '16 minutes'" });          // haengt
      await anlegen('laeuft', { erstellt: "NOW() - INTERVAL '2 hours'" });            // haengt
      await anlegen('offen', { erstellt: "NOW() - INTERVAL '14 minutes'" });          // noch nicht
      await anlegen('erledigt', { erstellt: "NOW() - INTERVAL '3 hours'", erledigt: 'NOW()' }); // fertig
      await anlegen('fehlgeschlagen', { erstellt: "NOW() - INTERVAL '1 hour'", erledigt: "NOW() - INTERVAL '1 hour'" });
      await anlegen('fehlgeschlagen', { erstellt: "NOW() - INTERVAL '3 days'", erledigt: "NOW() - INTERVAL '25 hours'" }); // zu alt

      const res = await request(app()).get('/api/status');
      expect(res.body.nachlauf).toEqual({ haengend: 2, fehlgeschlagen: 1 });
    });

    it('Status und checks bleiben bei haengenden und gescheiterten Auftraegen unberuehrt', async () => {
      await anlegen('offen', { erstellt: "NOW() - INTERVAL '1 hour'" });
      await anlegen('fehlgeschlagen', { erledigt: 'NOW()' });
      const res = await request(app()).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.checks).toEqual({ database: 'ok', cron_leader: 'fehlt' });
      expect(res.body.nachlauf).toEqual({ haengend: 1, fehlgeschlagen: 1 });
    });

    it('haelt den Stand 30 Sekunden (oeffentlicher Pfad, Abfrage gemessen 17 ms bei 300.000 Zeilen)', async () => {
      const eine = app();
      expect((await request(eine).get('/api/status')).body.nachlauf).toEqual({ haengend: 0, fehlgeschlagen: 0 });
      await anlegen('offen', { erstellt: "NOW() - INTERVAL '1 hour'" });
      expect((await request(eine).get('/api/status')).body.nachlauf).toEqual({ haengend: 0, fehlgeschlagen: 0 });
      // Eine frische App (oder 30 s spaeter) sieht den neuen Stand.
      expect((await request(app()).get('/api/status')).body.nachlauf).toEqual({ haengend: 1, fehlgeschlagen: 0 });
    });

    it('fehlt die Tabelle (Abfrage scheitert), fehlt das Feld -- der Status bleibt 200', async () => {
      const ohneTabelle = createApp({
        query: (t, p) => (String(t).includes(T) ? Promise.reject(Object.assign(new Error('relation does not exist'), { code: '42P01' })) : db.query(t, p)),
        getClient: () => db.getClient(),
      }, { uploadsDir: require('os').tmpdir() });
      const res = await request(ohneTabelle).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.nachlauf).toBeUndefined();
      expect(res.body.status).toBe('OK');
    });
  });
});
