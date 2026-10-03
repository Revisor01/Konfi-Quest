// POST /api/anfragen -- das Anfrageformular auf konfi-quest.de (03.10.2026).
//
// Simon, 02.10.2026 (docs/planung/web-version.md, Entscheidung 4): Die
// verantwortliche Person einer Gemeinde traegt auf der Homepage ein, was zum
// Anlegen noetig ist; jede Anfrage landet in der Support-Ansicht
// (routes/support.js) und wird dort zur Gemeinde. Das ersetzt den Weg per
// Mail.
//
// OEFFENTLICH, OHNE ANMELDUNG. Deshalb:
//   - HONIGTOPF: Das Feld `website` ist im Formular unsichtbar. Ist es
//     gefuellt, war es ein Programm -- die Antwort ist trotzdem 201
//     { ok: true }, damit es nichts lernt, aber nichts wird gespeichert und
//     keine Mail geht hinaus.
//   - GRENZE JE ADRESSE: 5 angenommene Anfragen je Stunde und Client-IP
//     (clientIp: X-Real-IP nur aus dem Docker-Netz, hinter Traefik die echte
//     Adresse; Zaehler im gemeinsamen Store beider Replicas), danach 429.
//     Abgewiesene Eingaben (400) zaehlen nicht -- wer sich vertippt, soll es
//     erneut versuchen koennen; sie kosten weder Speicher noch Mail.
//   - GRENZE JE ZIEL-ADRESSE: 3 angenommene Anfragen je Tag und E-Mail-
//     Adresse, ueber alle Client-Adressen. Die Bestaetigung geht an die
//     eingetragene Adresse; ohne diese Grenze liesse sich ueber viele
//     Verbindungen ein fremdes Postfach fuellen. Gezaehlt wird ein Pruefwert
//     der Adresse (SHA-256), nicht die Adresse selbst.
//   - EINWILLIGUNG: einwilligung muss genau true sein; der Zeitpunkt steht
//     in gemeinde_anfragen.einwilligung_am.
//   - LAENGEN begrenzt (FELDER unten), Zahlen 0 bis 100.000.
//   - WUNSCHLIZENZ (Simon, 03.10.2026): leer oder einer der Schluessel aus
//     utils/lizenzen.js; die Gemeinde waehlt, welche Lizenz sie nach der
//     Testphase moechte.
//   - PROTOKOLL: nur die Kennung der Anfrage, keine Daten daraus -- auch
//     nicht bei Fehlern der Datenbank (deren detail nennt die Zeile) oder
//     des Mailservers (sendEmail mit `protokoll`).
//
// Die Antwort nennt keine Kennung ({ ok: true }); danach, NACH der Antwort,
// gehen die Bestaetigung an die anfragende Adresse und ein Hinweis an jedes
// aktive Super-Admin-Konto mit Adresse. Scheitert eine Mail, bleibt die
// Anfrage gespeichert.
//
// Aufbewahrung (docs/betrieb/support-ansicht.md, Datenschutzerklaerung 9c):
// abgelehnte Anfragen loescht der naechtliche Lauf 180 Tage nach der
// Ablehnung (BackgroundService.cleanupAbgelehnteAnfragen); aus einer
// angelegten wird die Gemeinde, die Anfrage geht mit ihr. Neue und in Arbeit
// befindliche gehen nach 365 Tagen ohne Aenderung
// (BackgroundService.cleanupUnbewegteAnfragen).

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { clientIp } = require('../utils/clientIp');
const { PostgresRateLimitStore } = require('../utils/rateLimitStore');
const { nachAntwort } = require('../utils/nachAntwort');
const { aktiveSuperAdminAdressen } = require('../utils/superAdminKonten');
const emailService = require('../services/emailService');
const { LIZENZ_SCHLUESSEL } = require('../utils/lizenzen');

const ANFRAGEN_JE_STUNDE = 5;
const ANFRAGEN_JE_ADRESSE_UND_TAG = 3;

// Was gespeichert wird, mit Hoechstlaenge (Zeichen). Die
// Datenschutzerklaerung nennt genau diese Felder (Abschnitt 9c,
// frontend/src/__tests__/config/datenschutzGegenCode.test.ts).
const FELDER = {
  gemeinde: 200,
  kirchenkreis: 200,
  landeskirche: 200,
  kontakt_name: 200,
  funktion: 200,
  email: 254,
  mobil: 40,
  anzahl_konfis: null,
  anzahl_teamer: null,
  wunsch_lizenz: null,
  nachricht: 5000,
};
const PFLICHT = ['gemeinde', 'kontakt_name', 'email'];
const ZAHLEN = ['anzahl_konfis', 'anzahl_teamer'];
// Felder mit eigener Pruefung statt der fuer freien Text.
const EIGENE_PRUEFUNG = ['email', 'wunsch_lizenz', ...ZAHLEN];
const ZAHL_MAX = 100000;

const OK = { ok: true };
const MELDUNG_EMAIL = 'Gültige E-Mail-Adresse erforderlich';

/** Pruefwert einer Adresse fuer den Zaehler (ohne Gross/klein und Leerraum). */
const adressSchluessel = (email) =>
  `adresse:${crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')}`;

const textFeld = (feld) => {
  const pflicht = PFLICHT.includes(feld);
  let kette = body(feld);
  kette = pflicht
    ? kette.isString().withMessage('Pflichtfeld').bail().trim().notEmpty().withMessage('Pflichtfeld').bail()
    : kette.optional({ values: 'null' }).isString().withMessage('Text erwartet').bail().trim();
  return kette.isLength({ max: FELDER[feld] }).withMessage(`Höchstens ${FELDER[feld]} Zeichen`);
};

const zahlFeld = (feld) => body(feld)
  .optional({ values: 'falsy' })
  .isInt({ min: 0, max: ZAHL_MAX }).withMessage(`Eine ganze Zahl von 0 bis ${ZAHL_MAX.toLocaleString('de-DE')}`)
  .toInt();

module.exports = (db) => {
  const router = express.Router();

  const ipGrenze = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: ANFRAGEN_JE_STUNDE,
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    // Nur angenommene Anfragen zaehlen (auch der Honigtopf: 201).
    skipFailedRequests: true,
    message: { error: 'Zu viele Anfragen von dieser Verbindung. Bitte versucht es in einer Stunde erneut oder schreibt uns an moin@konfi-quest.de.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(db, { prefix: 'anfragen-ip' }),
  });

  const adressGrenze = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: ANFRAGEN_JE_ADRESSE_UND_TAG,
    keyGenerator: (req) => adressSchluessel(req.body.email),
    // Ohne Adresse greift die Pruefung dahinter (400); der Honigtopf zaehlt
    // hier nicht, an ihn geht keine Mail.
    skip: (req) => typeof req.body.email !== 'string' || !req.body.email.trim()
      || (req.body.website !== undefined && req.body.website !== ''),
    skipFailedRequests: true,
    message: { error: 'Für diese E-Mail-Adresse sind heute schon mehrere Anfragen eingegangen. Bitte versucht es morgen erneut oder schreibt uns an moin@konfi-quest.de.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new PostgresRateLimitStore(db, { prefix: 'anfragen-adresse' }),
  });

  // Honigtopf VOR der Pruefung: Ein Programm, das alles ausfuellt, bekommt
  // dieselbe Antwort wie ein Mensch -- auch bei sonst ungueltigen Feldern.
  const honigtopf = (req, res, next) => {
    const w = req.body.website;
    if (w !== undefined && w !== null && w !== '') {
      console.log('Gemeinde-Anfrage verworfen: Honigtopf gefüllt');
      return res.status(201).json(OK);
    }
    return next();
  };

  const pruefung = [
    ...Object.keys(FELDER).filter((f) => !EIGENE_PRUEFUNG.includes(f)).map(textFeld),
    body('email')
      .isString().withMessage(MELDUNG_EMAIL).bail()
      .trim().isLength({ min: 3, max: FELDER.email }).withMessage(MELDUNG_EMAIL).bail()
      .isEmail().withMessage(MELDUNG_EMAIL),
    body('mobil').optional({ values: 'falsy' }).matches(/^[0-9+()/ -]+$/).withMessage('Nur Ziffern, Leerzeichen und + ( ) / -'),
    ...ZAHLEN.map(zahlFeld),
    // Ausdruecklich ein Text: isIn allein prueft bei einer Liste jedes
    // Element und liesse ['klein'] durch (danach 500 beim Speichern).
    body('wunsch_lizenz').optional({ values: 'falsy' })
      .custom((wert) => typeof wert === 'string' && LIZENZ_SCHLUESSEL.includes(wert))
      .withMessage('Bitte eine Lizenz aus der Liste wählen'),
    body('einwilligung').custom((wert) => wert === true).withMessage('Die Einwilligung ist erforderlich'),
    handleValidationErrors,
  ];

  router.post('/', ipGrenze, honigtopf, adressGrenze, pruefung, async (req, res) => {
    const leer = (wert) => (wert === undefined || wert === null || wert === '' ? null : wert);
    const werte = Object.keys(FELDER).map((f) => leer(req.body[f]));

    let anfrage;
    try {
      ({ rows: [anfrage] } = await db.query(
        `INSERT INTO gemeinde_anfragen (${Object.keys(FELDER).join(', ')}, einwilligung_am)
         VALUES (${Object.keys(FELDER).map((_, i) => `$${i + 1}`).join(', ')}, NOW())
         RETURNING id, gemeinde, kirchenkreis, landeskirche, email`,
        werte
      ));
    } catch (err) {
      // Nur Code und Meldung: err.detail nennt bei einem CHECK die ganze Zeile.
      console.error('Gemeinde-Anfrage nicht gespeichert: %s %s', err.code || '', err.message);
      return res.status(500).json({ error: 'Die Anfrage konnte nicht gespeichert werden. Bitte versucht es später erneut.' });
    }

    console.log('Gemeinde-Anfrage %d eingegangen', anfrage.id);
    res.status(201).json(OK);

    nachAntwort(req, async () => {
      const kennung = `Anfrage ${anfrage.id}`;
      try {
        await emailService.sendAnfrageBestaetigungEmail(anfrage.email, { protokoll: kennung });
      } catch (err) {
        console.error('Gemeinde-Anfrage %d: Bestätigung nicht versandt (%s)', anfrage.id, err.code || 'ohne Code');
      }
      const empfaenger = await aktiveSuperAdminAdressen(db);
      for (const admin of empfaenger) {
        try {
          await emailService.sendAnfrageHinweisEmail(admin.email, admin.display_name, anfrage);
        } catch (err) {
          console.error('Gemeinde-Anfrage %d: Hinweis an ein Super-Admin-Konto nicht versandt (%s)', anfrage.id, err.code || 'ohne Code');
        }
      }
    }, 'POST /anfragen (Mails)');
  });

  return router;
};

module.exports.FELDER = FELDER;
module.exports.ANFRAGEN_JE_STUNDE = ANFRAGEN_JE_STUNDE;
module.exports.ANFRAGEN_JE_ADRESSE_UND_TAG = ANFRAGEN_JE_ADRESSE_UND_TAG;
