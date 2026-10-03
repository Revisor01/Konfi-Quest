// backend/tests/helpers/kontoOhneGemeinde.js -- ein Konto ohne Gemeinde fuer
// Tests (Support-Konto: Super-Admin ohne Stamm-Gemeinde, Entscheidung Simon
// 03.10.2026, docs/planung/web-version.md Punkt 12).
//
// Ein solches Konto traegt organization_id NULL, die gemeindefreie Systemrolle
// `super_admin` (roles.organization_id NULL) und das Merkmal is_super_admin.
//
// BIS ZUR MIGRATION 190 verbietet das Schema die Zeile (users.organization_id
// NOT NULL). Die Stellen im Code, die ein solches Konto falsch behandeln,
// werden VOR dem Schemawechsel behoben (einzeln auslieferbar). Damit die Tests
// das zeigen koennen, erlaubt `kontoOhneGemeindeErmoeglichen` die NULL fuer
// die Dauer einer Testdatei und `wiederherstellen` setzt den Stand zurueck --
// ist die Spalte schon nullbar (Migration 190), tun beide nichts.
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const PASSWORT_SUPPORT = 'Support-Passwort1!';
const PASSWORD_HASH_SUPPORT = bcrypt.hashSync(PASSWORT_SUPPORT, 10);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// Feste IDs ausserhalb des Seeds (seed.js nutzt 1 bis 11 und Rollen 1 bis 9).
const SYSTEMROLLE_ID = 90;
const SUPPORT = Object.freeze({ id: 50, username: 'support1', display_name: 'Test Support' });

/**
 * Erlaubt users.organization_id NULL, falls das Schema es (noch) verbietet.
 * @returns {Promise<() => Promise<void>>} stellt den vorigen Stand wieder her
 */
async function kontoOhneGemeindeErmoeglichen(db) {
  const { rows: [spalte] } = await db.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_id'`
  );
  if (spalte.is_nullable === 'YES') return async () => {};
  await db.query('ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL');
  return async () => {
    await db.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE organization_id IS NULL)');
    await db.query('DELETE FROM user_organizations WHERE user_id IN (SELECT id FROM users WHERE organization_id IS NULL)');
    await db.query('DELETE FROM users WHERE organization_id IS NULL');
    await db.query('ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL');
  };
}

/** Die gemeindefreie Systemrolle super_admin (wie Migration 190 sie anlegt). */
async function systemrolleAnlegen(db) {
  const { rows: [vorhanden] } = await db.query(
    "SELECT id FROM roles WHERE organization_id IS NULL AND name = 'super_admin'"
  );
  if (vorhanden) return Number(vorhanden.id);
  await db.query(
    `INSERT INTO roles (id, organization_id, name, display_name, description, is_system_role)
     VALUES ($1, NULL, 'super_admin', 'Super-Admin', 'Betrieb und Support aller Gemeinden, ohne eigene Gemeinde', true)`,
    [SYSTEMROLLE_ID]
  );
  return SYSTEMROLLE_ID;
}

/**
 * Legt ein Konto ohne Gemeinde an.
 * @param {object} db
 * @param {{id?: number, username?: string, display_name?: string, is_active?: boolean}} [daten]
 * @returns {Promise<{id: number, username: string, passwort: string, role_id: number}>}
 */
async function supportKontoAnlegen(db, daten = {}) {
  const roleId = await systemrolleAnlegen(db);
  const konto = { ...SUPPORT, ...daten };
  await db.query(
    `INSERT INTO users (id, organization_id, role_id, username, display_name, password_hash, is_active, is_super_admin)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, true)`,
    [konto.id, roleId, konto.username, konto.display_name, PASSWORD_HASH_SUPPORT, daten.is_active !== false]
  );
  return { id: konto.id, username: konto.username, passwort: PASSWORT_SUPPORT, role_id: roleId };
}

/** Zugangs-Token wie aus POST /auth/login fuer ein Konto ohne Gemeinde. */
function supportToken(id = SUPPORT.id, claims = {}) {
  return jwt.sign({
    id, type: 'admin', organization_id: null, role_name: 'super_admin', is_super_admin: true, ...claims,
  }, JWT_SECRET, { expiresIn: '1h' });
}

/** Ein Refresh-Token direkt in der Datenbank, ohne Anmeldung. */
async function refreshTokenAnlegen(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')",
    [userId, hash]
  );
  return token;
}

module.exports = {
  SUPPORT,
  SYSTEMROLLE_ID,
  PASSWORT_SUPPORT,
  kontoOhneGemeindeErmoeglichen,
  systemrolleAnlegen,
  supportKontoAnlegen,
  supportToken,
  refreshTokenAnlegen,
};
