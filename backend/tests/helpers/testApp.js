// backend/tests/helpers/testApp.js — createTestApp Wrapper fuer supertest
// Per D-09: Tests rufen createApp(testDb) auf fuer saubere Express-App
const { createApp } = require('../../createApp');
const os = require('os');
const path = require('path');

/**
 * Erstellt eine supertest-faehige Express-App mit Test-DB.
 * Kein io, kein transporter, keine rateLimiters (Dummies in createApp).
 * Upload-Verzeichnis im OS-Temp (per Pitfall 6).
 *
 * @param {object} db - Test-DB Pool (aus getTestPool())
 * @returns {express.Application} Express-App fuer supertest
 */
function getTestApp(db) {
  const uploadsDir = path.join(os.tmpdir(), 'konfi-test-uploads');

  return createApp(db, {
    uploadsDir,
    // transporter, io, rateLimiters: nicht uebergeben -> createApp nutzt Dummies
  });
}

module.exports = { getTestApp };
