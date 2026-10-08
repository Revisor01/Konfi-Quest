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
// VORGANG (Migration 195): Mit der Anfrage entsteht in derselben Transaktion
// ihr Vorgang (Art "Neue Gemeinde", Quelle "anfrage"); die Anfrage bleibt mit
// ihren Feldern daran haengen (utils/supportVorgaenge.js).
//
// Aufbewahrung (docs/betrieb/support-ansicht.md, Datenschutzerklaerung 9c):
// abgelehnte Anfragen loescht der naechtliche Lauf 180 Tage nach der
// Ablehnung (BackgroundService.cleanupAbgelehnteAnfragen); aus einer
// angelegten wird die Gemeinde, die Anfrage geht mit ihr. Neue und in Arbeit
// befindliche gehen nach 365 Tagen ohne Aenderung
// (BackgroundService.cleanupUnbewegteAnfragen).

const express = require('express');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { formularGrenzen, honigtopf } = require('../utils/oeffentlicheGrenzen');
const { vorgangFuerAnfrage } = require('../utils/supportVorgaenge');
const { registriereArt, einreihen } = require('../utils/warteschlange');
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

// Mails nach einer Anfrage: Bestaetigung an die anfragende Adresse, Hinweis
// an jedes aktive Super-Admin-Konto. Protokolliert wird nur der Fehlercode,
// keine Adresse. Scheitert die Bestaetigung, wird sie spaeter wiederholt;
// die Hinweise bilden einen Schritt und werden -- wie bisher -- einzeln
// gemeldet, aber nicht wiederholt (sonst bekaemen die uebrigen sie doppelt).
registriereArt('anfrage_eingegangen', async (db, p, k) => {
  const { anfrage } = p;
  await k.schritt('bestaetigung', async () => {
    try {
      await emailService.sendAnfrageBestaetigungEmail(anfrage.email, { protokoll: `Anfrage ${anfrage.id}` });
    } catch (err) {
      console.error('Gemeinde-Anfrage %d: Bestätigung nicht versandt (%s)', anfrage.id, err.code || 'ohne Code');
      // Ohne cause: Der Versandfehler nennt Adressen; Protokoll und Tabelle
      // bekommen nur den Code.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`Bestätigung nicht versandt (${err.code || 'ohne Code'})`);
    }
  });
  await k.schritt('hinweise', async () => {
    const empfaenger = await aktiveSuperAdminAdressen(db);
    for (const admin of empfaenger) {
      try {
        await emailService.sendAnfrageHinweisEmail(admin.email, admin.display_name, anfrage);
      } catch (err) {
        console.error('Gemeinde-Anfrage %d: Hinweis an ein Super-Admin-Konto nicht versandt (%s)', anfrage.id, err.code || 'ohne Code');
      }
    }
  });
});

module.exports = (db) => {
  const router = express.Router();

  const { ipGrenze, adressGrenze } = formularGrenzen(db, {
    prefix: 'anfragen',
    jeStunde: ANFRAGEN_JE_STUNDE,
    jeAdresseUndTag: ANFRAGEN_JE_ADRESSE_UND_TAG,
    meldungIp: 'Zu viele Anfragen von dieser Verbindung. Bitte versucht es in einer Stunde erneut oder schreibt uns an moin@konfi-quest.de.',
    meldungAdresse: 'Für diese E-Mail-Adresse sind heute schon mehrere Anfragen eingegangen. Bitte versucht es morgen erneut oder schreibt uns an moin@konfi-quest.de.',
  });

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

  router.post('/', ipGrenze, honigtopf('Gemeinde-Anfrage verworfen: Honigtopf gefüllt'), adressGrenze, pruefung, async (req, res) => {
    const leer = (wert) => (wert === undefined || wert === null || wert === '' ? null : wert);
    const werte = Object.keys(FELDER).map((f) => leer(req.body[f]));

    // Die Anfrage und ihr Vorgang (Art "Neue Gemeinde", Quelle "anfrage")
    // entstehen in EINER Transaktion: Es gibt keine Anfrage ohne Vorgang.
    let anfrage;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      ({ rows: [anfrage] } = await client.query(
        `INSERT INTO gemeinde_anfragen (${Object.keys(FELDER).join(', ')}, einwilligung_am)
         VALUES (${Object.keys(FELDER).map((_, i) => `$${i + 1}`).join(', ')}, NOW())
         RETURNING id, gemeinde, kirchenkreis, landeskirche, email`,
        werte
      ));
      await vorgangFuerAnfrage(client, anfrage.id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      // Nur Code und Meldung: err.detail nennt bei einem CHECK die ganze Zeile.
      console.error('Gemeinde-Anfrage nicht gespeichert: %s %s', err.code || '', err.message);
      return res.status(500).json({ error: 'Die Anfrage konnte nicht gespeichert werden. Bitte versucht es später erneut.' });
    } finally {
      client.release();
    }

    console.log('Gemeinde-Anfrage %d eingegangen', anfrage.id);
    res.status(201).json(OK);

    // Als Auftrag der dauerhaften Warteschlange (Art 'anfrage_eingegangen'
    // oben): Ein Neustart direkt nach der Antwort verliert die Mails nicht.
    einreihen(db, 'anfrage_eingegangen', {
      anfrage: {
        id: anfrage.id,
        gemeinde: anfrage.gemeinde,
        kirchenkreis: anfrage.kirchenkreis,
        landeskirche: anfrage.landeskirche,
        email: anfrage.email,
      },
    }, { req, bezeichnung: 'POST /anfragen (Mails)' });
  });

  return router;
};

module.exports.FELDER = FELDER;
module.exports.ANFRAGEN_JE_STUNDE = ANFRAGEN_JE_STUNDE;
module.exports.ANFRAGEN_JE_ADRESSE_UND_TAG = ANFRAGEN_JE_ADRESSE_UND_TAG;
