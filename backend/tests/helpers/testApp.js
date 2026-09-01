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
// Alle in diesem Worker erzeugten Test-Apps. truncateAll (helpers/db.js)
// wartet vor jedem Leeren darauf, dass ihre Nachlaeufer durch sind — sonst
// schreibt ein Seiteneffekt aus dem VORIGEN Test NACH dem TRUNCATE und der
// naechste Test sieht Daten, die es nicht geben duerfte.
//
// Genau das war der sporadische Fehlschlag, der am 01.09.2026 viermal
// auftrat: "PUT /api/teamer/certificate-types/99999 gibt 404" schlug im
// Suitenlauf fehl und war allein gruen — bei GLEICHEM Code und gleicher
// Suiten-Auswahl mal so, mal so. maxWorkers ist 1, es war also keine
// Parallelitaet, sondern ein Nachlaeufer.
//
// Ein Set, keine Liste: dieselbe App wird pro Datei einmal erzeugt.
const erzeugteApps = new Set();

function getTestApp(db) {
  const uploadsDir = path.join(os.tmpdir(), 'konfi-test-uploads');

  const app = createApp(db, {
    uploadsDir,
    // transporter, io, rateLimiters: nicht uebergeben -> createApp nutzt Dummies
  });

  erzeugteApps.add(app);
  return app;
}

/**
 * Wartet auf die Nachlaeufer ALLER Test-Apps dieses Workers.
 * Wird von truncateAll gerufen — so muss keine der 65 Testdateien daran denken.
 */
async function warteAufAlleNachwehen() {
  for (const app of erzeugteApps) {
    await warteAufNachwehen(app);
  }
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

module.exports = { getTestApp, warteAufNachwehen, warteAufAlleNachwehen };
