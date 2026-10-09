// POST /api/csp-meldung -- hierhin meldet der Browser Verstoesse gegen die
// Content-Security-Policy der Web-App (Simon, 09.10.2026).
//
// Die CSP steht in frontend/nginx.conf und nennt diese Adresse zweimal:
// `report-uri /api/csp-meldung` (alle Browser, Format application/csp-report)
// und `report-to csp` mit der Kopfzeile `Reporting-Endpoints` (Reporting API,
// Chromium, Format application/reports+json). Was gezaehlt und gespeichert
// wird, steht in utils/cspMeldungen.js; zu sehen ist es unter /admin/metrics,
// Reiter "Fehler" (docs/betrieb/csp-meldungen.md).
//
// OEFFENTLICH, OHNE ANMELDUNG: Der Browser schickt Meldungen ohne Token und
// ohne Cookies. Deshalb:
//   - GRENZE JE CLIENT-ADRESSE: JE_STUNDE Sendungen je Stunde und Adresse
//     (clientIp, Zaehler im gemeinsamen Store beider Replicas), danach 429.
//     Es zaehlt jede Sendung, auch abgewiesene -- hier gibt es nichts zu
//     vertippen. Ein Gemeinde-WLAN teilt sich eine Adresse; eine Seite mit
//     einem Verstoss erzeugt beim Laden eine Meldung je blockiertem Aufruf,
//     120 je Stunde reichen fuer eine Gruppe, die dieselbe Luecke trifft.
//   - GROESSE: hoechstens MAX_BYTES; eine Meldung ist rund 1 KB, die Reporting
//     API buendelt mehrere. Groesser: 413, gelesen wird nichts.
//   - FORMAT: application/csp-report, application/reports+json und (aeltere
//     Firefox-Fassungen) application/json. Anderes: 415.
//   - ANTWORT: 204 ohne Inhalt, auch wenn keine der Meldungen eine CSP-Meldung
//     war -- der Browser wertet die Antwort nicht aus.
//
// Die Route steht in createApp.js VOR dem allgemeinen JSON-Leser: Der liest
// application/json bis 100 KB und haette die Groessengrenze hier unterlaufen.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { clientIp } = require('../utils/clientIp');
const { PostgresRateLimitStore } = require('../utils/rateLimitStore');
const { lies, aufnehmen } = require('../utils/cspMeldungen');

const JE_STUNDE = 120;
const MAX_BYTES = 16 * 1024;
const FORMATE = ['application/csp-report', 'application/reports+json', 'application/json'];

module.exports = (db) => {
  const router = express.Router();

  const grenze = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: JE_STUNDE,
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    message: { error: 'Zu viele Meldungen.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(db, { prefix: 'csp-meldung-ip' }),
  });

  const leser = express.json({ type: FORMATE, limit: MAX_BYTES });

  router.post('/', grenze, leser, (req, res) => {
    if (!req.is(FORMATE)) {
      return res.status(415).json({ error: 'Erwartet wird application/csp-report oder application/reports+json.' });
    }
    const meldungen = lies(req.body);
    if (meldungen === null) {
      return res.status(400).json({ error: 'Keine CSP-Meldung.' });
    }
    for (const g of aufnehmen(meldungen)) {
      // Eine Zeile je NEUER Gruppe -- nur die bereinigten Felder, ohne
      // Adresse und Browserkennung. Wiederholungen zaehlen still.
      console.warn(`[CSP] ${g.direktive} blockiert ${g.blockiert} auf ${g.seite}`);
    }
    return res.status(204).end();
  });

  // Fehler des Lesers: zu gross, kein JSON, falsche Zeichenkodierung.
  router.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Meldung zu groß.' });
    }
    if (err && (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err.type === 'charset.unsupported')) {
      return res.status(400).json({ error: 'Meldung nicht lesbar.' });
    }
    return next(err);
  });

  return router;
};

module.exports.JE_STUNDE = JE_STUNDE;
module.exports.MAX_BYTES = MAX_BYTES;
