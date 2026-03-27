// backend/tests/helpers/db.js — Test-Pool + TRUNCATE-Helper
const { Pool } = require('pg');

const TEST_DB_NAME = 'konfi_test';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);

let pool = null;

/**
 * Gibt Test-DB-Pool zurueck (Singleton).
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

/**
 * TRUNCATE alle Tabellen mit CASCADE und RESTART IDENTITY.
 * Per D-01: TRUNCATE CASCADE vor jedem Test fuer sauberen Zustand.
 * schema_migrations wird NICHT truncated (soll bestehen bleiben).
 */
async function truncateAll(db) {
  await db.query(`TRUNCATE
    chat_poll_votes, chat_polls, chat_read_status,
    chat_messages, chat_participants, chat_rooms,
    event_points, event_bookings, event_timeslots,
    event_jahrgang_assignments, event_categories,
    user_activities, activity_requests, activity_categories,
    konfi_activities, konfi_badges, user_badges, bonus_points,
    konfi_profiles, user_jahrgang_assignments,
    material_file_tags, material_files, material_jahrgaenge, material_events, materials, material_tags,
    user_certificates, certificate_types,
    wrapped_snapshots,
    push_tokens, event_reminders, password_resets,
    invite_codes, refresh_tokens, notifications,
    users, activities, badges, events,
    jahrgaenge, categories, levels,
    role_permissions, permissions, roles,
    organizations
    RESTART IDENTITY CASCADE`);
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
