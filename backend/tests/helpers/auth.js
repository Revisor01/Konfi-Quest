// backend/tests/helpers/auth.js — Token-Factory fuer alle RBAC-Rollen
// Per D-10: RBAC wird NIEMALS gemockt. Tokens enthalten echte User-IDs aus dem Seed.
const jwt = require('jsonwebtoken');
const { USERS } = require('./seed');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

/**
 * Generiert einen gueltigen JWT fuer einen Seed-User.
 * Token-Payload identisch mit Produktion (auth.js + rbac.js).
 *
 * @param {string} userKey - Key aus USERS (z.B. 'konfi1', 'admin1', 'superAdmin')
 * @param {string} expiresIn - Token-Laufzeit (Default: '1h')
 * @returns {string} JWT-Token
 */
function generateToken(userKey, expiresIn = '1h') {
  const user = USERS[userKey];
  if (!user) throw new Error(`Unbekannter Seed-User: ${userKey}`);

  return jwt.sign({
    id: user.id,
    type: user.type,
    display_name: user.display_name,
    organization_id: user.org_id,
    role_id: user.role_id,
  }, JWT_SECRET, { expiresIn });
}

/**
 * Generiert Tokens fuer alle Seed-Users.
 * @returns {Object} { konfi1: 'token...', admin1: 'token...', ... }
 */
function getAllTokens() {
  const tokens = {};
  for (const key of Object.keys(USERS)) {
    tokens[key] = generateToken(key);
  }
  return tokens;
}

module.exports = { generateToken, getAllTokens, SEED_USERS: USERS };
