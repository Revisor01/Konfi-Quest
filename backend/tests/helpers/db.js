// backend/tests/helpers/db.js — Test-Pool + TRUNCATE-Helper
const { Pool } = require('pg');

// bigint (OID 20) als Zahl statt als String liefern — identisch zu
// backend/database.js:7, das die Produktion konfiguriert.
//
// Ohne diese Zeile verhaelt sich der Test-Pool ANDERS als die Anwendung: pg
// gibt bigint per Default als String zurück (JavaScript-Zahlen können nicht
// jeden bigint-Wert darstellen). Das alte Test-Schema nutzte durchgaengig
// integer und verdeckte den Unterschied; das Produktions-Schema hat 111
// bigint-Spalten, und plötzlich verglichen Tests '1' gegen 1
// (Audit 22.08.2026).
require('pg').types.setTypeParser(20, (val) => parseInt(val, 10));

const TEST_DB_NAME = 'konfi_test';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);

let pool = null;

/**
 * Gibt Test-DB-Pool zurück (Singleton).
 * Interface identisch mit backend/database.js: query(), getClient(), end()
 */
function getTestPool() {
  if (!pool) {
    // Sitzungszone Europe/Berlin als Voreinstellung. ACHTUNG, gemessen am
    // 27.09.2026: Produktion rechnet NICHT so. postgresql.conf gibt dort
    // timezone = 'UTC' vor, die Sitzungen der App laufen in UTC, der
    // Node-Prozess ebenso (TZ/PGTZ des Datenbank-Containers wirken nur auf
    // psql; die Annahme unten, Produktion trage Europe/Berlin, war falsch).
    // Die volle Suite mit TZ=UTC und TEST_DB_SITZUNGSZONE=UTC lief am
    // 27.09.2026 bis auf zwei Tests in utils/zeitzone.test.js grün, die genau
    // diese Annahme pruefen -- der Code rechnet seine Kalendertage selbst in
    // Berliner Zeit (utils/zeitformat.js). Berlin bleibt hier Voreinstellung,
    // weil die Fixtures ueber CURRENT_DATE anlegen (siehe unten). Die Test-DB
    // (docker-compose.test.yml) und die Postgres-Instanz der CI liefen dagegen
    // in UTC. Zwischen 00:00 und 02:00 Berliner Zeit lieferte CURRENT_DATE
    // deshalb noch den Vortag, waehrend heuteBerlin() im Code bereits den neuen
    // Tag nannte -- Fixtures und Service-Query trafen verschiedene Kalendertage
    // (Terminhinweis-Tests, 02.09.2026). Hier gesetzt statt nur im Compose,
    // damit es AUCH in der CI gilt, die ihren eigenen Postgres-Dienst startet.
    pool = new Pool({
      connectionString: TEST_DB_URL,
      max: 5,
      // Wie database.js (PG_CONN_TIMEOUT, Vorgabe 5000): Wer auf eine freie
      // Verbindung wartet, gibt nach 5 s mit Fehler auf, statt ewig zu
      // warten. Ohne diese Grenze haengt pool.end() fuer immer, sobald ein
      // Nachlauf eine Verbindung haelt und auf eine zweite wartet (siehe
      // closePool unten).
      connectionTimeoutMillis: 5000,
      // TEST_DB_SITZUNGSZONE=UTC bildet die Produktion ab, wie sie am
      // 27.09.2026 gemessen wurde: postgresql.conf gibt dort timezone = 'UTC'
      // vor, die Sitzungen der App laufen in UTC (TZ/PGTZ des
      // Datenbank-Containers wirken nur auf psql). Siehe Kommentar oben.
      options: `-c timezone=${process.env.TEST_DB_SITZUNGSZONE || 'Europe/Berlin'}`,
    });
  }
  return {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    end: () => pool.end(),
    // Wie database.js: Zustand des Verbindungspools. Ohne diese Zeile faellt
    // die Metrik-Route im Test in den Notweg und dbPool fehlt — dann wuerde der
    // Test etwas anderes pruefen als die Produktion tut.
    poolZustand: () => ({
      gesamt: pool.totalCount,
      frei: pool.idleCount,
      wartend: pool.waitingCount,
      max: pool.options.max,
    }),
  };
}

// Feste Lock-ID, an der sich alle parallelen Test-Suites anstellen.
// Verhindert, dass zwei TRUNCATE-CASCADE-Statements gleichzeitig dieselben
// Tabellen (die ganze Liste unten) sperren und sich gegenseitig zum Deadlock
// verriegeln.
const TRUNCATE_LOCK_ID = 4711;

/**
 * TRUNCATE alle Tabellen mit CASCADE und RESTART IDENTITY.
 * Per D-01: TRUNCATE CASCADE vor jedem Test für sauberen Zustand.
 * schema_migrations wird NICHT truncated (soll bestehen bleiben).
 *
 * Laeuft in EINER Transaktion mit vorgeschaltetem Advisory-Lock: parallele
 * vitest-Suites serialisieren so ihr TRUNCATE und können nicht mehr in einen
 * "deadlock detected" laufen. Der Lock wird beim COMMIT/ROLLBACK autom. frei.
 */
// Die Liste muss ALLE Tabellen der Produktion abdecken (Stand 22.08.2026):
// Fehlt eine, bleiben ihre Daten zwischen den Suites stehen und erzeugen
// Abhaengigkeiten von der Testreihenfolge. konfi_activities/konfi_badges sind
// hier bewusst NICHT mehr aufgefuehrt — die Tabellen gab es nur im alten,
// handgepflegten Test-Schema; in Produktion heißen sie user_activities /
// user_badges (nur die alten Sequenz-Namen leben dort als Altlast weiter).
const TRUNCATE_SQL = `TRUNCATE
    chat_poll_votes, chat_polls, chat_read_status,
    challenge_read_status,
    chat_message_reactions,
    chat_messages, chat_participants, chat_rooms,
    event_points, event_bookings, event_timeslots,
    event_unregistrations, event_jahrgang_assignments, event_categories,
    user_activities, activity_requests, activity_categories,
    user_badges, bonus_points,
    konfspruch_uebersetzungen,
    konfsprueche,
    konfi_profiles, user_jahrgang_assignments,
    material_links, material_files, material_jahrgaenge, material_events, materials,
    user_certificates, certificate_types,
    wrapped_snapshots, wrapped_ausgaben,
    bewahrte_stempel, konfi_historie,
    challenge_submissions, challenge_jahrgang_assignments, challenges,
    push_tokens, event_reminders, password_resets,
    invite_codes, refresh_tokens, notifications,
    user_organizations, org_einladungen,
    settings, daily_verses, apm_snapshots, socket_io_attachments, rate_limit_zaehler,
    users, activities, custom_badges, events,
    jahrgaenge, categories, levels,
    role_permissions, permissions, roles,
    organizations
    RESTART IDENTITY CASCADE`;

async function truncateAll(db) {
  // Der Advisory-Lock serialisiert TRUNCATE zwischen parallelen Suites — er
  // schuetzt aber NICHT gegen Deadlocks mit fire-and-forget-Queries DESSELBEN
  // Tests (z.B. die nicht-awaited Push-Notification in chat.js:654, die noch
  // einen Share-Lock auf push_tokens/chat_messages haelt, während TRUNCATE den
  // Exclusive-Lock will). Deshalb: kurzer lock_timeout + Retry bei
  // Deadlock (40P01) / Lock-Timeout (55P03). So wartet TRUNCATE den Background-
  // Query ab, statt die Suite mit "deadlock detected" rot zu faerben.
  // ZUERST die Nachlaeufer abwarten, DANN leeren. Der Advisory-Lock unten
  // schuetzt nur davor, dass zwei TRUNCATE sich blockieren — nicht davor, dass
  // ein Seiteneffekt NACH dem Leeren noch schreibt. Dann steht im naechsten
  // Test eine Zeile, die es nicht geben duerfte (belegt am 01.09.2026:
  // ein 404-Test auf eine nicht existierende ID schlug sporadisch fehl,
  // bei gleichem Code mal gruen, mal rot).
  //
  // require() erst hier: helpers/testApp laedt createApp und damit die halbe
  // Anwendung. Oben in der Datei wuerde das einen Ringschluss erzeugen, weil
  // createApp seinerseits gegen die DB-Helfer laeuft.
  try {
    const { warteAufAlleNachwehen } = require('./testApp');
    await warteAufAlleNachwehen();
  } catch {
    // Kein testApp im Spiel (reine Unit-Suite) — dann gibt es nichts zu warten.
  }

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [TRUNCATE_LOCK_ID]);
      await client.query("SET LOCAL lock_timeout = '4s'");
      await client.query(TRUNCATE_SQL);
      await client.query('COMMIT');
      return;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const retryable = err.code === '40P01' || err.code === '55P03'; // deadlock / lock_timeout
      if (!retryable || attempt === MAX_ATTEMPTS) throw err;
      // kurzer Backoff, damit der Background-Query fertig wird
      await new Promise((r) => setTimeout(r, 100 * attempt));
    } finally {
      client.release();
    }
  }
}

/**
 * Pool sauber schliessen (afterAll in Test-Suites).
 *
 * ERST WARTEN, DANN SCHLIESSEN (29.09.2026, Audit CI "Unklar": Test-Deadlocks).
 * Die beiden roten backend-test-Laeufe 931 und 938 scheiterten NICHT am
 * "deadlock detected" im Postgres-Log -- die Deadlocks fangen truncateAll
 * (Wiederholung) und berechneBadgesFuerAlle (catch) ab. Rot war beide Male
 * derselbe Hook: afterAll(closePool) in teamerZaehlerNachAbmeldung.test.js,
 * "Hook timed out in 10000ms".
 *
 * Der Grund: Die Zusage-Route (routes/teamer.js) haelt ihre
 * Transaktions-Verbindung nach dem COMMIT, schickt die Antwort und wartet
 * dann noch auf den Event-Chat (weitere Abfragen ueber den Pool); parallel
 * laeuft der Push an die Leitung (nachAntwort) mit bis zu zehn Abfragen.
 * Endet die Datei in diesem Moment, ruft afterAll pool.end() -- und ein
 * endender Pool bedient seine Warteschlange nicht mehr. Die Route wartet
 * auf eine Verbindung, die nie kommt, gibt ihre eigene nie zurueck, und
 * pool.end() wartet auf genau diese. Nachgestellt mit zwei Verbindungen:
 * pool.end() haengt; mit connectionTimeoutMillis endet es nach der Grenze.
 *
 * Deshalb: Nachwehen abwarten, dann warten, bis keine Verbindung mehr
 * ausgeliehen ist und niemand mehr wartet (hoechstens 4 s), erst dann end().
 * Die Zeitgrenze oben ist das Netz darunter.
 */
async function closePool() {
  if (pool) {
    try {
      const { warteAufAlleNachwehen } = require('./testApp');
      await warteAufAlleNachwehen();
    } catch {
      // Kein testApp im Spiel (reine Unit-Suite).
    }
    const bis = Date.now() + 4000;
    while ((pool.totalCount > pool.idleCount || pool.waitingCount > 0) && Date.now() < bis) {
      await new Promise((r) => setTimeout(r, 20));
    }
    await pool.end();
    pool = null;
  }
}

module.exports = { getTestPool, truncateAll, closePool };
