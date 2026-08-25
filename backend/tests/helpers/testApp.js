// backend/tests/helpers/testApp.js — createTestApp Wrapper für supertest
// Per D-09: Tests rufen createApp(testDb) auf für saubere Express-App
const { createApp } = require('../../createApp');
const os = require('os');
const path = require('path');

/**
 * Erstellt eine supertest-faehige Express-App mit Test-DB.
 * Kein io, kein transporter, keine rateLimiters (Dummies in createApp).
 * Upload-Verzeichnis im OS-Temp (per Pitfall 6).
 *
 * @param {object} db - Test-DB Pool (aus getTestPool())
 * @returns {express.Application} Express-App für supertest
 */
function getTestApp(db) {
  const uploadsDir = path.join(os.tmpdir(), 'konfi-test-uploads');

  const app = createApp(db, {
    uploadsDir,
    // transporter, io, rateLimiters: nicht uebergeben -> createApp nutzt Dummies
  });

  return app;
}

/**
 * Wartet, bis die Seiteneffekte durch sind, die eine Route NACH ihrer Antwort
 * erledigt (Push, Badges, Live-Updates — siehe utils/nachAntwort.js).
 *
 * Warum das noetig ist: supertest schliesst die Verbindung, sobald die Antwort
 * da ist. Laeuft der Handler dann noch, riss der Abbruch sporadisch den
 * naechsten Test mit ("Parse Error: Expected HTTP/, RTSP/ or ICE/",
 * 1 von rund 1200, wechselnd welcher).
 *
 * In einem Test nach dem letzten Request aufrufen:
 *   await request(app).delete(`/api/events/${id}`)...;
 *   await warteAufNachwehen(app);
 *
 * @param {import('express').Application} app
 */
const { warteAufNachwehen } = require('../../utils/nachAntwort');

module.exports = { getTestApp, warteAufNachwehen };
