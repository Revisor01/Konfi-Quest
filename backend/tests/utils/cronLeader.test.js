// backend/tests/utils/cronLeader.test.js
//
// Cron-Leader per Advisory-Lock (Audit 26.09.2026, Betrieb BF-10).
//
// BEFUND: Der Leader war per RUN_BACKGROUND_JOBS fest vergeben. Fiel die
// Replica `backend` aus, liefen weder Erinnerungen noch Token-Bereinigung,
// Auto-Loeschung, Lizenz-Erinnerungen noch APM-Schnappschuesse -- und
// niemand sah es, weil `backend2` weiter antwortete.
//
// Hier laufen zwei Wahlen (wie zwei Replicas) mit eigenen pg-Verbindungen
// gegen die Test-DB: Genau eine wird Leader; endet sie, uebernimmt die
// zweite innerhalb eines Takts; bricht die Datenbankverbindung des Leaders
// ab, gibt er die Rolle ab (sonst liefen nach einem Datenbank-Neustart zwei
// Leader). cronLeaderVorhanden liest aus pg_locks, ob irgendjemand den Lock
// haelt -- das ist der Wert fuer /api/status.
const { Client } = require('pg');
const { getTestPool, closePool } = require('../helpers/db');
const {
  CRON_LEADER_LOCK_ID,
  starteCronLeaderWahl,
  cronLeaderVorhanden,
} = require('../../utils/cronLeader');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

const TAKT_MS = 150;
const stumm = { warn: () => {}, error: () => {} };
const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

async function warteBis(bedingung, maxMs = 2000) {
  const bis = Date.now() + maxMs;
  while (Date.now() < bis) {
    if (bedingung()) return true;
    await schlafen(20);
  }
  return bedingung();
}

describe('Cron-Leader per Advisory-Lock', () => {
  let db;
  const wahlen = [];

  const wahl = (name, extra = {}) => {
    const w = starteCronLeaderWahl({
      verbinde: () => new Client({ connectionString: TEST_DB_URL, application_name: `cron-test-${name}` }),
      taktMs: TAKT_MS,
      log: stumm,
      ...extra,
    });
    wahlen.push(w);
    return w;
  };

  beforeAll(() => {
    db = getTestPool();
  });

  afterEach(async () => {
    while (wahlen.length) {
      await wahlen.pop().stopp();
    }
  });

  afterAll(async () => {
    await closePool();
  });

  it('von zwei Replicas wird genau eine Leader, und /api/status kann es von jeder aus sehen', async () => {
    expect(await cronLeaderVorhanden(db)).toBe(false);

    const uebernahmen = [];
    const a = wahl('a', { beiUebernahme: () => uebernahmen.push('a') });
    const b = wahl('b', { beiUebernahme: () => uebernahmen.push('b') });
    await Promise.all([a.bereit, b.bereit]);

    expect([a.istLeader(), b.istLeader()].filter(Boolean)).toHaveLength(1);
    expect(uebernahmen).toHaveLength(1);
    expect(await cronLeaderVorhanden(db)).toBe(true);

    // Ein weiterer Takt aendert nichts: Der Leader bleibt, die andere wartet.
    await Promise.all([a.takt(), b.takt()]);
    expect([a.istLeader(), b.istLeader()].filter(Boolean)).toHaveLength(1);
    expect(uebernahmen).toHaveLength(1);
  });

  it('endet der Leader geordnet, uebernimmt die andere innerhalb eines Takts', async () => {
    const a = wahl('a');
    const b = wahl('b');
    await Promise.all([a.bereit, b.bereit]);
    const leader = a.istLeader() ? a : b;
    const andere = leader === a ? b : a;

    const verluste = [];
    const start = Date.now();
    await leader.stopp();

    expect(leader.istLeader()).toBe(false);
    expect(await warteBis(() => andere.istLeader(), TAKT_MS * 3)).toBe(true);
    expect(Date.now() - start).toBeLessThan(TAKT_MS * 3);
    expect(await cronLeaderVorhanden(db)).toBe(true);
    expect(verluste).toEqual([]);
  });

  it('stirbt der Leader-Prozess (Verbindung weg, ohne Unlock), uebernimmt die andere', async () => {
    const a = wahl('a');
    const b = wahl('b');
    await Promise.all([a.bereit, b.bereit]);
    const leader = a.istLeader() ? a : b;
    const andere = leader === a ? b : a;
    const leaderName = leader === a ? 'a' : 'b';

    // Wie ein Prozess-Tod: Postgres beendet die Sitzung, kein Unlock laeuft.
    const { rowCount } = await db.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1`,
      [`cron-test-${leaderName}`]
    );
    expect(rowCount).toBe(1);

    expect(await warteBis(() => andere.istLeader(), TAKT_MS * 4)).toBe(true);
    expect(await cronLeaderVorhanden(db)).toBe(true);
  });

  it('verliert der Leader seine Datenbankverbindung, gibt er die Rolle ab und bewirbt sich neu', async () => {
    const verluste = [];
    const uebernahmen = [];
    const a = wahl('solo', {
      beiUebernahme: () => uebernahmen.push(Date.now()),
      beiVerlust: () => verluste.push(Date.now()),
    });
    await a.bereit;
    expect(a.istLeader()).toBe(true);

    await db.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'cron-test-solo'`
    );

    // Rolle weg (Jobs angehalten) ...
    expect(await warteBis(() => verluste.length === 1, TAKT_MS * 4)).toBe(true);
    // ... und beim naechsten Takt wieder da, mit neuer Verbindung.
    expect(await warteBis(() => a.istLeader(), TAKT_MS * 4)).toBe(true);
    expect(uebernahmen).toHaveLength(2);
  });

  it('nimmt einen fremden Lock-Halter wahr (kein zweiter Leader) und meldet ihn in cronLeaderVorhanden', async () => {
    const fremd = new Client({ connectionString: TEST_DB_URL });
    await fremd.connect();
    try {
      await fremd.query('SELECT pg_advisory_lock($1)', [CRON_LEADER_LOCK_ID]);
      expect(await cronLeaderVorhanden(db)).toBe(true);

      const a = wahl('a');
      await a.bereit;
      expect(a.istLeader()).toBe(false);
    } finally {
      await fremd.end();
    }
    expect(await cronLeaderVorhanden(db)).toBe(false);
  });
});
