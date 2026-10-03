// Schutz der oeffentlichen Formulare auf konfi-quest.de -- EINE Stelle fuer
// POST /api/anfragen (routes/anfragen.js) und POST /api/anliegen
// (routes/anliegen.js), damit beide dieselbe Grenze je Absender haben
// (Simon, 03.10.2026: "gebaut wie das Anfrageformular").
//
//   - GRENZE JE CLIENT-ADRESSE: `jeStunde` angenommene Eingaben je Stunde
//     und Client-IP (clientIp: X-Real-IP nur aus dem Docker-Netz, hinter
//     Traefik die echte Adresse; Zaehler im gemeinsamen Store beider
//     Replicas), danach 429. Abgewiesene Eingaben (400) zaehlen nicht -- wer
//     sich vertippt, soll es erneut versuchen koennen; sie kosten weder
//     Speicher noch Mail.
//   - GRENZE JE ZIEL-ADRESSE: `jeAdresseUndTag` angenommene Eingaben je Tag
//     und E-Mail-Adresse, ueber alle Client-Adressen. Die Bestaetigung geht
//     an die eingetragene Adresse; ohne diese Grenze liesse sich ueber viele
//     Verbindungen ein fremdes Postfach fuellen. Gezaehlt wird ein Pruefwert
//     der Adresse (SHA-256), nicht die Adresse selbst.
//   - HONIGTOPF: Das Feld `website` ist im Formular unsichtbar. Ist es
//     gefuellt, war es ein Programm -- die Antwort ist trotzdem 201
//     { ok: true }, damit es nichts lernt, aber nichts wird gespeichert und
//     keine Mail geht hinaus.

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { clientIp } = require('./clientIp');
const { PostgresRateLimitStore } = require('./rateLimitStore');

/** Pruefwert einer Adresse fuer den Zaehler (ohne Gross/klein und Leerraum). */
const adressSchluessel = (email) =>
  `adresse:${crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')}`;

/**
 * Die beiden Grenzen eines Formulars.
 *
 * @param {object} db
 * @param {object} opt
 * @param {string} opt.prefix  Schluesselraum im Store (je Formular eigener, z. B. 'anfragen')
 * @param {number} opt.jeStunde
 * @param {number} opt.jeAdresseUndTag
 * @param {string} opt.meldungIp      Text bei 429 je Client-Adresse
 * @param {string} opt.meldungAdresse Text bei 429 je E-Mail-Adresse
 */
function formularGrenzen(db, { prefix, jeStunde, jeAdresseUndTag, meldungIp, meldungAdresse }) {
  const ipGrenze = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: jeStunde,
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    // Nur angenommene Eingaben zaehlen (auch der Honigtopf: 201).
    skipFailedRequests: true,
    message: { error: meldungIp },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(db, { prefix: `${prefix}-ip` }),
  });

  const adressGrenze = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: jeAdresseUndTag,
    keyGenerator: (req) => adressSchluessel(req.body.email),
    // Ohne Adresse greift die Pruefung dahinter (400); der Honigtopf zaehlt
    // hier nicht, an ihn geht keine Mail.
    skip: (req) => typeof req.body.email !== 'string' || !req.body.email.trim()
      || (req.body.website !== undefined && req.body.website !== ''),
    skipFailedRequests: true,
    message: { error: meldungAdresse },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(db, { prefix: `${prefix}-adresse` }),
  });

  return { ipGrenze, adressGrenze };
}

/**
 * Honigtopf VOR der Pruefung: Ein Programm, das alles ausfuellt, bekommt
 * dieselbe Antwort wie ein Mensch -- auch bei sonst ungueltigen Feldern.
 *
 * @param {string} protokoll  Zeile fuers Protokoll (ohne Daten aus der Eingabe)
 */
const honigtopf = (protokoll) => (req, res, next) => {
  const w = req.body.website;
  if (w !== undefined && w !== null && w !== '') {
    console.log(protokoll);
    return res.status(201).json({ ok: true });
  }
  return next();
};

module.exports = { adressSchluessel, formularGrenzen, honigtopf };
