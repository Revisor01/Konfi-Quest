const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Configure pg to parse bigint as integer
const types = require('pg').types;
types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint

// Pool-Konfiguration: PG_POOL_MAX (Standard 20), PG_IDLE_TIMEOUT (Standard 30s), PG_CONN_TIMEOUT (Standard 5s)
//
// Stand in Produktion nachgemessen (24.09.2026): PG_POOL_MAX ist NICHT gesetzt,
// der Pool laeuft also auf 20. Gesetzt ist nur PG_IDLE_TIMEOUT=600000 (10 min).
// Fuer die EKD-Ausrollung gehoert PG_POOL_MAX ins Compose. Rechenweg:
// max_connections ist 200, davon 3 fuer den Superuser reserviert -> 197
// nutzbar. Es laufen DREI Backend-Container, jeder mit diesem Pool plus dem
// Socket-Adapter-Pool (server.js, max 2). Mit 20 Reserve fuer Wartung,
// psql und Migrationen: 3 x (P + 2) + 20 <= 197 -> P <= 57. 50 passt also
// (3 x 52 + 20 = 176) und laesst 21 Verbindungen frei.
//
// ZEITGRENZEN (30 s). In Produktion nachgemessen: statement_timeout und
// idle_in_transaction_session_timeout stehen serverseitig auf 0 (unbegrenzt) —
// eine haengende Abfrage haelt ihren Pool-Platz also ewig, und ein
// Dashboard-Aufruf belegt allein zehn Plaetze (neun parallele Abfragen plus
// die aeussere Verbindung). Zwei solche Aufrufe fuellen einen Pool von 20.
//
// Warum 30 s und nicht weniger: Gemessen an Produktion (36 h, APM-Verlauf)
// lag die langsamste Route bei 1718 ms SERVERZEIT, der Durchschnitt der
// Spitzenwerte bei 1127 ms. Die schwerste Einzelabfrage des
// Konfi-Dashboards braucht 10,5 ms, die Chat-Zaehlung 2,2 ms. 30 s ist damit
// rund das 17-fache der gemessenen Spitze — kein legitimer Aufruf stirbt
// daran, auch nicht bei zehnfacher Datenmenge.
//
// Geprueft, ob es legitim lange Abfragen gibt, die denselben Pool nutzen:
//   - Wrapped-Berechnung (routes/wrapped.js): laeuft pro Person in EINER
//     Transaktion auf getClient(), aber aus VIELEN kleinen Einzelabfragen.
//     statement_timeout begrenzt die einzelne Abfrage, nicht die Transaktion —
//     ein Jahrgangslauf mit hunderten Personen bleibt also unberuehrt.
//   - Hintergrundjobs (services/backgroundService.js): Token-Aufraeumen,
//     Auto-Loeschung, APM-Schnappschuesse. Alles DELETEs auf Tabellen mit
//     wenigen tausend Zeilen (groesste: apm_snapshots, 10.972 Zeilen).
//   - Chat-/Datei-Abrufe: lesen von der Platte, nicht aus der Datenbank.
// Keine dieser Stellen braucht eine Ausnahme. Wer spaeter eine wirklich lange
// Abfrage baut, setzt sie per `SET LOCAL statement_timeout` in ihrer eigenen
// Transaktion hoch — nicht den Pool-Wert fuer alle.
//
// query_timeout wirkt clientseitig (pg gibt den Platz frei, auch wenn der
// Server nicht antwortet), statement_timeout serverseitig (Postgres bricht die
// Abfrage wirklich ab). Beide zusammen, weil keiner allein genuegt: ohne
// serverseitigen Wert rechnet Postgres weiter, ohne clientseitigen bleibt der
// Pool-Platz bei einer abgerissenen Verbindung haengen.
const PG_STATEMENT_TIMEOUT = parseInt(process.env.PG_STATEMENT_TIMEOUT || '30000', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10),
  statement_timeout: PG_STATEMENT_TIMEOUT,
  query_timeout: PG_STATEMENT_TIMEOUT,
  // Eine Transaktion, die offen liegen bleibt (Fehler zwischen BEGIN und
  // COMMIT, ohne dass ROLLBACK durchkommt), haelt sonst ebenfalls ihren Platz.
  idle_in_transaction_session_timeout: parseInt(process.env.PG_IDLE_TX_TIMEOUT || '60000', 10),
});

// Ein Verbindungsfehler auf einer LEERLAUFENDEN Pool-Verbindung (Datenbank
// neugestartet, Netz weg) kommt bei keinem await an. Ohne diesen Zuhoerer
// wirft Node ein unbehandeltes 'error'-Event — und beendet den Prozess.
// pg entfernt die kaputte Verbindung selbst; hier wird nur laut geloggt.
pool.on('error', (err) => {
  console.error('Postgres-Pool: Fehler auf leerlaufender Verbindung:', err.message);
});

// App-weite Lock-ID für den Migrations-Advisory-Lock (beliebig, aber fest).
const MIGRATION_ADVISORY_LOCK_ID = 723001;

async function runMigrations(pool) {
  // Advisory-Lock (Audit 03.07.2026): Beide Backend-Replikas starten beim Deploy
  // PARALLEL und rasten sonst um neue Migrationen (beobachtet bei Migration 109:
  // eine Replika gewann, die andere warf duplicate-key auf pg_type). Der Lock
  // serialisiert die Läufe; die zweite Replika liest danach die frisch
  // eingetragenen schema_migrations und ueberspringt sauber.
  // Session-Lock auf dedizierter Connection — wird im finally freigegeben,
  // bei Prozess-Tod räumt Postgres den Lock automatisch.
  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_ID]);

    // Tracking-Tabelle sicherstellen (idempotent)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await runMigrationsLocked(pool);
  } finally {
    try {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_ID]);
    } catch (unlockErr) {
      // Connection evtl. tot — Postgres gibt Session-Locks dann selbst frei.
      console.error('Migrations-Lock unlock fehlgeschlagen:', unlockErr.message);
    }
    lockClient.release();
  }
}

async function runMigrationsLocked(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Bereits ausgefuehrte Migrationen laden — bewusst NACH dem Advisory-Lock,
  // damit die zweite Replika die Eintraege der ersten sieht.
  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  let newCount = 0;
  const failed = [];
  for (const file of files) {
    if (appliedSet.has(file)) {
      continue; // Bereits ausgefuehrt, ueberspringen
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Jede Migration läuft in EINER Transaktion auf EINER dedizierten Connection
    // (pool.query() kann sonst verschiedene Connections nutzen -> Multi-Statement-SQL
    // wäre nicht transaktional). Schlaegt eine Migration mittendrin fehl, wird sie
    // KOMPLETT zurueckgerollt — kein Halb-Zustand mehr (Lehre aus Incident 13.06.2026:
    // 097/098/099 wurden ausgeführt aber nicht sauber als applied vermerkt).
    // Migration + schema_migrations-INSERT liegen in DERSELBEN Transaktion, damit
    // beides atomar gemeinsam committed oder gemeinsam verworfen wird.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newCount++;
      console.log(`Migration applied: ${file}`);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* Connection evtl. tot */ }
      // NICHT-BLOCKIEREND (User-Forderung, Incident 13.06.2026): eine fehlerhafte
      // Migration darf NIE den Serverstart killen und damit alle Logins blockieren.
      // Wir loggen laut, merken sie als fehlgeschlagen vor und machen mit den
      // nächsten Migrationen weiter. Der Server kommt hoch, App bleibt erreichbar.
      // Fehlgeschlagene Migration wird NICHT als applied vermerkt -> wird beim
      // nächsten Start (nach Fix) erneut versucht.
      console.error(`Migration FAILED (uebersprungen, Server startet trotzdem): ${file}`, err.message);
      failed.push({ file, message: err.message });
    } finally {
      client.release();
    }
  }
  if (newCount > 0) {
    console.log(`Migrations applied: ${newCount} new (${files.length} total)`);
  } else {
    console.log(`Migrations: keine neuen (${files.length} total)`);
  }
  if (failed.length > 0) {
    console.error(`ACHTUNG: ${failed.length} Migration(en) fehlgeschlagen und uebersprungen:`);
    failed.forEach(f => console.error(`  - ${f.file}: ${f.message}`));
    console.error('Server laeuft weiter. Bitte fehlgeschlagene Migration(en) pruefen und fixen.');
  }
}

// Einmaliger Test beim Starten der Anwendung, um sicherzustellen, dass die DB erreichbar ist.
// Migrationsfehler killen den Start NICHT mehr (siehe runMigrations) — nur eine
// voellig unerreichbare DB ist noch ein harter Startup-Fehler.
pool.query('SELECT NOW()')
  .then(() => runMigrations(pool))
  .catch(err => {
    console.error('Database startup failed (DB nicht erreichbar):', err);
    // In Tests NICHT den Prozess killen: Dieser Selbsttest laeuft beim
    // MODUL-LADEN als unbeaufsichtigter Promise. utils/liveUpdate.js laedt das
    // Singleton lazy mitten im Testlauf; schlaegt der Test dann fehl (z.B.
    // weil globalTeardown die Test-DB gerade droppt), riss process.exit(1)
    // den ganzen vitest-Worker mit — etwa jeder vierte Lauf brach so ohne
    // Fehlermeldung ab. In Produktion bleibt der harte Abbruch gewollt.
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  });

module.exports = {
  // Die primäre Methode zum Ausführen von Abfragen
  query: (text, params) => pool.query(text, params),

  // Dedizierter Client für Transaktionen (BEGIN/COMMIT/ROLLBACK)
  // pool.query() kann verschiedene Connections nutzen - bei Transaktionen
  // MUSS alles auf derselben Connection laufen!
  getClient: () => pool.connect(),

  // Wir exportieren auch die 'end'-Methode des Pools,
  // damit wir die Verbindungen beim Herunterfahren des Servers sauber beenden können.
  end: () => pool.end(),

  /**
   * Zustand des Verbindungs-Pools.
   *
   * wartend > 0 heisst: Anfragen stehen an, weil alle Plaetze belegt sind —
   * die Zahl, an der sich die Pool-Groesse ablesen laesst. Sie taucht in
   * GET /api/metrics auf (nur super_admin), NICHT in /api/health: der Pfad ist
   * oeffentlich und dient Traefik als Gesundheitspruefung.
   */
  poolZustand: () => ({
    gesamt: pool.totalCount,
    frei: pool.idleCount,
    wartend: pool.waitingCount,
    max: pool.options.max,
  }),
};