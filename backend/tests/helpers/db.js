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
    pool = new Pool({ connectionString: TEST_DB_URL, max: 5 });
  }
  return {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    end: () => pool.end(),
  };
}

// Feste Lock-ID, an der sich alle parallelen Test-Suites anstellen.
// Verhindert, dass zwei TRUNCATE-CASCADE-Statements gleichzeitig dieselben
// ~45 Tabellen sperren und sich gegenseitig zum Deadlock verriegeln.
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
    chat_message_reactions,
    chat_messages, chat_participants, chat_rooms,
    event_points, event_bookings, event_timeslots,
    event_unregistrations, event_jahrgang_assignments, event_categories,
    user_activities, activity_requests, activity_categories,
    user_badges, bonus_points,
    konfspruch_uebersetzungen,
    konfsprueche,
    konfi_profiles, user_jahrgang_assignments,
    material_files, material_jahrgaenge, material_events, materials,
    user_certificates, certificate_types,
    wrapped_snapshots,
    challenge_submissions, challenge_jahrgang_assignments, challenges,
    push_tokens, event_reminders, password_resets,
    invite_codes, refresh_tokens, notifications,
    user_organizations,
    settings, daily_verses, apm_snapshots, socket_io_attachments,
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
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getTestPool, truncateAll, closePool };
