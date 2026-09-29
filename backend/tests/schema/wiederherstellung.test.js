// backend/tests/schema/wiederherstellung.test.js
//
// Rueckspielprobe: Eine Sicherung, wie deploy/sicherung.sh sie schreibt
// (pg_dump -Fc --no-owner), kommt mit deploy/wiederherstellung.sh auf einer
// FRISCH aufgesetzten Instanz vollstaendig zurueck (Audit Datenbank BF-05).
//
// "Frisch aufgesetzt" heisst: Das postgres-Image hat beim ersten Start
// init-scripts/ eingespielt, es gibt also schon ein Schema, aber keine
// Daten. Genau dort scheiterte der naheliegende Weg -- nachgestellt am
// 29.09.2026 mit postgres:15-alpine und 20.000 Konten: 477 Fehlerzeilen,
// danach 0 Konten. Und der bis dahin beschriebene Weg
// (`pg_restore -j 4 < dump`) brach mit "parallel restore from standard input
// is not supported" ab, bevor er etwas einspielte.
//
// Der Test ruft das echte Skript auf, ohne Docker: Ohne PG_CONTAINER nimmt es
// psql und pg_restore direkt, verbunden ueber PGHOST/PGPORT/PGUSER. Er
// braucht deshalb pg_dump, pg_restore und psql auf dem Pfad (auf den
// GitHub-Runnern vorhanden, lokal mit dem Postgres-Client).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const { schemaFingerabdruck, vergleiche } = require('../../scripts/schemaVergleich');
const {
  ADMIN_URL, urlFuer, dbAnlegen, dbWegraeumen, neueInstanzAufbauen, nurInitScripts,
} = require('../helpers/schemaAufbau');
const { seed } = require('../helpers/seed');

const SKRIPT = path.join(__dirname, '..', '..', '..', 'deploy', 'wiederherstellung.sh');
const QUELLE = 'konfi_test_sicherung_quelle';
const ZIEL = 'konfi_test_sicherung_ziel';

// Verbindung fuer die Kommandozeilenwerkzeuge aus der Test-URL.
const url = new URL(ADMIN_URL);
const PG_UMGEBUNG = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
};

function lauf(befehl, args, extra = {}) {
  return spawnSync(befehl, args, { encoding: 'utf8', env: { ...PG_UMGEBUNG, ...extra } });
}

async function zeilenJeTabelle(pool) {
  const { rows: tabellen } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const ergebnis = {};
  for (const { tablename } of tabellen) {
    const { rows: [{ n }] } = await pool.query(`SELECT count(*)::int AS n FROM "${tablename}"`);
    ergebnis[tablename] = n;
  }
  return ergebnis;
}

async function mitPool(name, fn) {
  const pool = new Pool({ connectionString: urlFuer(name), max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

describe('Wiederherstellung einer Sicherung auf einer frisch aufgesetzten Instanz', () => {
  let ordner;
  let sicherung;
  let zeilenQuelle;
  let abdruckQuelle;

  beforeAll(async () => {
    for (const werkzeug of ['pg_dump', 'pg_restore', 'psql']) {
      const v = lauf(werkzeug, ['--version']);
      if (v.status !== 0) {
        throw new Error(`${werkzeug} fehlt auf dem Pfad -- der Test braucht den Postgres-Client.`);
      }
    }
    ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'wiederherstellung-'));
    sicherung = path.join(ordner, 'konfi_db_probe.dump');

    // Quelle: eine Instanz wie in Produktion, mit Daten.
    const quelle = await dbAnlegen(QUELLE);
    await neueInstanzAufbauen(quelle);
    await seed(quelle);
    await quelle.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
       VALUES (1, 1, 'konfi', 'text', 'Probe vor der Sicherung')`
    );
    zeilenQuelle = await zeilenJeTabelle(quelle);
    abdruckQuelle = await schemaFingerabdruck(quelle);
    await quelle.end();

    // Sicherung genau wie deploy/sicherung.sh: pg_dump -Fc --no-owner.
    const dump = lauf('pg_dump', ['-Fc', '--no-owner', '-d', QUELLE, '-f', sicherung]);
    if (dump.status !== 0) throw new Error(`pg_dump fehlgeschlagen: ${dump.stderr}`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(null, QUELLE);
    await dbWegraeumen(null, ZIEL);
    if (ordner) fs.rmSync(ordner, { recursive: true, force: true });
  }, 120000);

  // Die frische Instanz: init-scripts sind gelaufen, sonst nichts.
  async function frischeInstanz() {
    const ziel = await dbAnlegen(ZIEL);
    await nurInitScripts(ziel);
    await ziel.end();
  }

  it('Ausgangslage: Einspielen in die frische Datenbank scheitert (der Befund)', async () => {
    await frischeInstanz();
    const naiv = lauf('pg_restore', ['--no-owner', '-d', ZIEL, sicherung]);
    expect(naiv.status).not.toBe(0);
    // Jedes Objekt, das init-scripts schon angelegt hat, ist ein Fehler.
    // Was danach in der Datenbank steht, haengt davon ab, ob der Dump und
    // init-scripts denselben Stand haben: Hier (gleicher Stand) landen die
    // Zeilen trotzdem, schema_migrations bleibt aber der von init-scripts;
    // bei verschiedenen Staenden -- nachgestellt am 29.09.2026 -- scheiterte
    // das Kopieren der Daten, 0 Konten. Beides ist kein Weg.
    const fehler = (naiv.stderr.match(/already exists/g) || []).length;
    expect(fehler).toBeGreaterThan(100);
  }, 60000);

  it('Ausgangslage: parallel aus der Standardeingabe geht nicht (der alte Doku-Weg)', () => {
    const r = spawnSync('pg_restore', ['--no-owner', '-j', '2', '-d', ZIEL], {
      input: fs.readFileSync(sicherung), env: PG_UMGEBUNG,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr.toString()).toContain('parallel restore from standard input is not supported');
  });

  it('das Skript stellt auf der frischen Instanz alles wieder her', async () => {
    await frischeInstanz();
    const r = lauf('bash', [SKRIPT], {
      DUMP: sicherung, PG_DB: ZIEL, PG_USER: PG_UMGEBUNG.PGUSER, JOBS: '2',
    });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`OK: ${ZIEL} wiederhergestellt.`);

    await mitPool(ZIEL, async (ziel) => {
      // Jede Tabelle mit derselben Zeilenzahl -- nicht nur die Kerntabellen.
      expect(await zeilenJeTabelle(ziel)).toEqual(zeilenQuelle);
      expect(zeilenQuelle.users).toBeGreaterThan(5);
      expect(zeilenQuelle.chat_messages).toBe(1);
      // Und dasselbe Schema, Objekt fuer Objekt.
      expect(vergleiche(abdruckQuelle, await schemaFingerabdruck(ziel))).toEqual({});
    });
  }, 120000);

  it('ersetzt eine Datenbank mit Konten nur mit BESTAETIGT=ja', async () => {
    // Stand nach dem vorigen Fall: ZIEL enthaelt die wiederhergestellten Konten.
    const ohne = lauf('bash', [SKRIPT], { DUMP: sicherung, PG_DB: ZIEL, PG_USER: PG_UMGEBUNG.PGUSER });
    expect(ohne.status).toBe(1);
    expect(ohne.stderr).toContain('Die Wiederherstellung ERSETZT die Datenbank');

    const mit = lauf('bash', [SKRIPT], {
      DUMP: sicherung, PG_DB: ZIEL, PG_USER: PG_UMGEBUNG.PGUSER, BESTAETIGT: 'ja',
    });
    expect(mit.status).toBe(0);
    const konten = await mitPool(ZIEL, (p) => p.query('SELECT count(*)::int AS n FROM users'));
    expect(konten.rows[0].n).toBe(zeilenQuelle.users);
  }, 120000);

  it('bricht bei offener Verbindung auf der Zieldatenbank ab und laesst sie stehen', async () => {
    const offen = new Pool({ connectionString: urlFuer(ZIEL), max: 1 });
    try {
      await offen.query('SELECT 1');
      const r = lauf('bash', [SKRIPT], {
        DUMP: sicherung, PG_DB: ZIEL, PG_USER: PG_UMGEBUNG.PGUSER, BESTAETIGT: 'ja',
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Erst alle Backends anhalten');
      const { rows: [{ n }] } = await offen.query('SELECT count(*)::int AS n FROM users');
      expect(n).toBe(zeilenQuelle.users);
    } finally {
      await offen.end();
    }
  }, 60000);

  it('lehnt eine abgeschnittene Sicherung ab, bevor es etwas anfasst', async () => {
    const kaputt = path.join(ordner, 'kaputt.dump');
    fs.writeFileSync(kaputt, fs.readFileSync(sicherung).subarray(0, 4096));
    const r = lauf('bash', [SKRIPT], {
      DUMP: kaputt, PG_DB: ZIEL, PG_USER: PG_UMGEBUNG.PGUSER, BESTAETIGT: 'ja',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Sicherung unvollständig oder nicht lesbar');
    const konten = await mitPool(ZIEL, (p) => p.query('SELECT count(*)::int AS n FROM users'));
    expect(konten.rows[0].n).toBe(zeilenQuelle.users);
  }, 60000);
});
