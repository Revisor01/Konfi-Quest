// appVersion.js — GET /api/app-version: meldet der App, welche Version
// aktuell in den Stores veroeffentlicht ist (fuer den dezenten Update-Hinweis),
// ab welcher Version sie noch unterstuetzt wird und ob ein Wartungshinweis
// ansteht.
//
// BEWUSST OHNE AUTHENTIFIZIERUNG (wie /api/health und /api/status):
// Die veroeffentlichte Store-Version ist oeffentlich — jede:r kann sie im
// Store nachsehen. Der Hinweis soll ausserdem VOR dem Login funktionieren
// koennen; eine Auth-Pflicht wuerde nur die Antwortkette verkomplizieren.
// Der globale Rate-Limiter (createApp) gilt trotzdem.
//
// ANTWORTFORM (Vertrag fuer ausgelieferte Apps, nie aendern, nur ergaenzen):
//   {
//     "ios":     { "version": "2.1.1" | null, "url": "https://apps.apple.com/...",
//                  "min_version": "2.3.0" | null },
//     "android": { "version": "2.1.1" | null, "url": "https://play.google.com/...",
//                  "min_version": "2.3.0" | null },
//     "wartung": { "aktiv": true | false, "text": "..." | null }
//   }
// min_version und wartung sind am 27.09.2026 dazugekommen (E-05, Quelle und
// Begruendung in utils/betriebshinweise.js). Die Store-Apps 2.1.1 und 2.2.0
// lesen nur ios/android.version/url und pruefen deren Typ
// (frontend/src/services/updateCheck.ts, an beiden Tags unveraendert) —
// die zusaetzlichen Felder sehen sie nicht. Erst 2.3.0 wertet sie aus.
// version=null heisst: Store-Version gerade nicht bekannt (Lookup down) —
// die App zeigt dann einfach keinen Hinweis. Beide Plattformen tragen
// dieselbe Version, weil beide Apps im Gleichschritt aus version.json
// released werden (Begruendung in utils/storeVersion.js). Getrennte Felder
// trotzdem von Anfang an, damit ein spaeterer plattformgetrennter Abgleich
// KEINE Formaenderung braucht.

const express = require('express');
const {
  holeStoreVersion: holeStoreVersionStandard,
  APP_STORE_URL_FALLBACK,
  PLAY_STORE_URL,
} = require('../utils/storeVersion');
const { betriebshinweise } = require('../utils/betriebshinweise');

module.exports = (deps = {}) => {
  // Injektion fuer Tests: nie echtes Netz im Test (Muster wie musikLinks).
  const holeStoreVersion = deps.holeStoreVersion || holeStoreVersionStandard;
  const router = express.Router();

  router.get('/', async (req, res) => {
    const store = await holeStoreVersion();
    // Bei JEDER Anfrage aus der Umgebung, nicht beim Start gemerkt.
    const hinweise = betriebshinweise(process.env);
    res.json({
      ios: {
        version: store ? store.version : null,
        url: store && store.iosUrl ? store.iosUrl : APP_STORE_URL_FALLBACK,
        min_version: hinweise.minVersion.ios,
      },
      android: {
        version: store ? store.version : null,
        url: PLAY_STORE_URL,
        min_version: hinweise.minVersion.android,
      },
      wartung: hinweise.wartung,
    });
  });

  return router;
};
