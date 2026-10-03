// POST /api/anliegen -- das Support-Formular auf konfi-quest.de (03.10.2026).
//
// Simon, 03.10.2026 (docs/planung/support-vorgaenge.md, Entscheidung 4):
// "Support kommt auf die HP." Wer Hilfe braucht -- Frage zur Bedienung, Fehler,
// Wunsch, Zugang, Lizenz, Datenschutz --, fuellt auf der Homepage ein Formular
// mit Auswahlfeldern aus, damit das Anliegen gleich sortiert ankommt. Jedes
// Anliegen wird ein Vorgang (Quelle "formular", Status "neu") in der
// Support-Ansicht (routes/supportVorgaenge.js). Die Apps verweisen unter "Mehr"
// auf dieses Formular; ein eigenes Formular in der App gibt es nicht.
//
// OEFFENTLICH, OHNE ANMELDUNG -- gebaut wie das Anfrageformular
// (routes/anfragen.js), mit denselben Schutzvorrichtungen
// (utils/oeffentlicheGrenzen.js):
//   - HONIGTOPF: Das Feld `website` ist unsichtbar; ist es gefuellt, bekommt der
//     Absender dieselbe Antwort, gespeichert und verschickt wird nichts.
//   - GRENZE JE CLIENT-ADRESSE: 5 angenommene Anliegen je Stunde und
//     Client-IP, danach 429; abgewiesene Eingaben (400) zaehlen nicht.
//   - GRENZE JE E-MAIL-ADRESSE: 3 angenommene Anliegen je Tag (Pruefwert der
//     Adresse, nicht die Adresse), ueber alle Client-Adressen.
//   - EINWILLIGUNG: einwilligung muss genau true sein; der Zeitpunkt steht in
//     support_vorgaenge.einwilligung_am.
//   - LAENGEN begrenzt (unten), Auswahlfelder gegen die Listen geprueft.
//   - PROTOKOLL: nur die Nummer des Vorgangs, keine Daten daraus -- auch nicht
//     bei Fehlern der Datenbank (deren detail nennt die Zeile) oder des
//     Mailservers.
//
// FELDER: gemeinde (Freitext, Pflicht), name (Pflicht), email (Pflicht),
// funktion (freiwillig), art, bereich (Pflicht bei Frage, Fehler, Wunsch),
// dringlichkeit, betreff (hoechstens 120 Zeichen), beschreibung (hoechstens
// 5.000 Zeichen), einwilligung. Die Art "Neue Gemeinde" gibt es hier nie --
// dafuer ist das Anfrageformular.
//
// ZUORDNUNG: Gehoert die E-Mail-Adresse zu GENAU EINEM aktiven Konto (nicht
// Konfi) einer Gemeinde, bekommt der Vorgang diese Gemeinde (beide Quellen der
// Zugehoerigkeit, utils/mailZuordnung.js, gemeindeDesKontos); sonst bleibt sie
// leer, und der Support ordnet sie im Vorgang zu. Die Angabe der Person
// (gemeinde_angabe) bleibt in jedem Fall am Vorgang.
//
// ANTWORT: 201 { ok: true } -- ohne Nummer und ohne Zuordnung. Danach, NACH der
// Antwort, geht die Bestaetigung an die eingetragene Adresse: ein FESTER Text
// ohne jede Eingabe aus dem Formular (ueber das oeffentliche Formular liesse
// sich sonst beliebiger Text ueber unseren Server an fremde Adressen
// schicken), vom Postfach support@ mit [Vorgang N] im Betreff, damit Antworten
// im Vorgang landen (services/mailVersand.js). Auf einem Server mit
// RUN_BACKGROUND_JOBS=false (backend-test) geht nichts hinaus; das Anliegen
// bleibt gespeichert. Scheitert die Mail, bleibt es ebenfalls gespeichert.
//
// Aufbewahrung (Datenschutzerklaerung 9e): Ein Vorgang wird erledigt und damit
// archiviert; archivierte Vorgaenge loescht der naechtliche Lauf 730 Tage nach
// dem Archivieren, wenn sie sich seitdem nicht geaendert haben
// (BackgroundService.cleanupArchivierteVorgaenge).

const express = require('express');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { formularGrenzen, honigtopf } = require('../utils/oeffentlicheGrenzen');
const { nachAntwort } = require('../utils/nachAntwort');
const { gemeindeDesKontos } = require('../utils/mailZuordnung');
const { einstellungenLesen } = require('../utils/mailEinstellungen');
const {
  ARTEN, BEREICHE, ARTEN_MIT_BEREICH, DRINGLICHKEITEN, BESCHREIBUNG_MAX, vorgangAnlegen,
} = require('../utils/supportVorgaenge');
const { antwortSenden } = require('../services/mailVersand');
const { ANFRAGEN_JE_STUNDE, ANFRAGEN_JE_ADRESSE_UND_TAG } = require('./anfragen');

// Dieselbe Grenze je Absender wie beim Anfrageformular.
const ANLIEGEN_JE_STUNDE = ANFRAGEN_JE_STUNDE;
const ANLIEGEN_JE_ADRESSE_UND_TAG = ANFRAGEN_JE_ADRESSE_UND_TAG;

// Was gespeichert wird, mit Hoechstlaenge (Zeichen). Die
// Datenschutzerklaerung nennt genau diese Felder (Abschnitt 9e,
// frontend/src/__tests__/config/datenschutzGegenCode.test.ts).
const FELDER = {
  gemeinde: 200,
  name: 200,
  email: 254,
  funktion: 200,
  betreff: 120,
  beschreibung: BESCHREIBUNG_MAX,
};
// Die Art "Neue Gemeinde" gibt es hier nicht.
const ARTEN_ERLAUBT = ARTEN.filter((a) => a !== 'neue_gemeinde');

const OK = { ok: true };
const MELDUNG_EMAIL = 'Gültige E-Mail-Adresse erforderlich';

/** Eine Zeile ohne Zeilenumbrueche (Betreff). */
const einzeilig = (text) => String(text).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

const textFeld = (feld, pflicht) => {
  let kette = body(feld);
  kette = pflicht
    ? kette.isString().withMessage('Pflichtfeld').bail().trim().notEmpty().withMessage('Pflichtfeld').bail()
    : kette.optional({ values: 'null' }).isString().withMessage('Text erwartet').bail().trim();
  return kette.isLength({ max: FELDER[feld] }).withMessage(`Höchstens ${FELDER[feld]} Zeichen`);
};

/** Die feste Bestaetigung: kein Zeichen aus dem Formular, nur die Nummer. */
const bestaetigungText = (nummer, absendername) => [
  'Hallo,',
  '',
  `euer Anliegen ist bei uns angekommen. Es hat die Nummer ${nummer}.`,
  '',
  'Wir melden uns, sobald wir uns darum gekümmert haben. Möchtet ihr etwas ergänzen, antwortet einfach auf diese Mail – sie landet dann direkt in eurem Anliegen.',
  '',
  'Antworten zur Bedienung findet ihr auch im Handbuch: konfi-quest.de/docs',
  '',
  'Viele Grüße',
  absendername,
].join('\n');

module.exports = (db) => {
  const router = express.Router();

  const { ipGrenze, adressGrenze } = formularGrenzen(db, {
    prefix: 'anliegen',
    jeStunde: ANLIEGEN_JE_STUNDE,
    jeAdresseUndTag: ANLIEGEN_JE_ADRESSE_UND_TAG,
    meldungIp: 'Zu viele Anliegen von dieser Verbindung. Bitte versucht es in einer Stunde erneut oder schreibt uns an support@konfi-quest.de.',
    meldungAdresse: 'Für diese E-Mail-Adresse sind heute schon mehrere Anliegen eingegangen. Bitte versucht es morgen erneut oder schreibt uns an support@konfi-quest.de.',
  });

  const pruefung = [
    textFeld('gemeinde', true),
    textFeld('name', true),
    body('email')
      .isString().withMessage(MELDUNG_EMAIL).bail()
      .trim().isLength({ min: 3, max: FELDER.email }).withMessage(MELDUNG_EMAIL).bail()
      .isEmail().withMessage(MELDUNG_EMAIL),
    textFeld('funktion', false),
    // Ausdruecklich ein Text: isIn allein prueft bei einer Liste jedes
    // Element und liesse ['frage'] durch (danach 500 beim Speichern).
    body('art')
      .custom((wert) => typeof wert === 'string' && ARTEN_ERLAUBT.includes(wert))
      .withMessage('Bitte eine Art aus der Liste wählen'),
    body('bereich').custom((wert, { req }) => {
      if (wert === undefined || wert === null || wert === '') {
        if (ARTEN_MIT_BEREICH.includes(req.body.art)) throw new Error('Bitte einen Bereich wählen');
        return true;
      }
      if (typeof wert !== 'string' || !BEREICHE.includes(wert)) throw new Error('Bitte einen Bereich aus der Liste wählen');
      return true;
    }),
    body('dringlichkeit').optional({ values: 'falsy' })
      .custom((wert) => typeof wert === 'string' && DRINGLICHKEITEN.includes(wert))
      .withMessage('Bitte eine Dringlichkeit aus der Liste wählen'),
    body('betreff')
      .isString().withMessage('Pflichtfeld').bail()
      .customSanitizer(einzeilig)
      .notEmpty().withMessage('Pflichtfeld').bail()
      .isLength({ max: FELDER.betreff }).withMessage(`Höchstens ${FELDER.betreff} Zeichen`),
    textFeld('beschreibung', true),
    body('einwilligung').custom((wert) => wert === true).withMessage('Die Einwilligung ist erforderlich'),
    handleValidationErrors,
  ];

  router.post('/', ipGrenze, honigtopf('Anliegen verworfen: Honigtopf gefüllt'), adressGrenze, pruefung, async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    let vorgangId;
    try {
      const organizationId = await gemeindeDesKontos(db, email);
      ({ id: vorgangId } = await vorgangAnlegen(db, {
        art: req.body.art,
        bereich: req.body.bereich || null,
        dringlichkeit: req.body.dringlichkeit || 'normal',
        betreff: req.body.betreff,
        beschreibung: req.body.beschreibung,
        quelle: 'formular',
        organizationId,
        kontaktName: req.body.name,
        kontaktEmail: req.body.email,
        kontaktFunktion: req.body.funktion || null,
        gemeindeAngabe: req.body.gemeinde,
        einwilligungAm: new Date(),
      }));
    } catch (err) {
      // Nur Code und Meldung: err.detail nennt bei einem CHECK die ganze Zeile.
      console.error('Anliegen nicht gespeichert: %s %s', err.code || '', err.message);
      return res.status(500).json({ error: 'Das Anliegen konnte nicht gespeichert werden. Bitte versucht es später erneut.' });
    }

    console.log('Anliegen %d eingegangen', vorgangId);
    res.status(201).json(OK);

    nachAntwort(req, async () => {
      try {
        const { absendername } = await einstellungenLesen(db);
        await antwortSenden(db, {
          postfach: 'support',
          an: email,
          text: bestaetigungText(vorgangId, absendername),
          vorgangId,
          standardBetreff: 'Euer Anliegen ist angekommen',
          // Die Bestaetigung ist keine Antwort des Supports: Der Vorgang bleibt "neu".
          statusFolgen: false,
          verfasstVon: null,
        });
      } catch (err) {
        console.error('Anliegen %d: Bestätigung nicht versandt (%s)', vorgangId, err.status || err.code || 'ohne Code');
      }
    }, 'POST /anliegen (Bestätigung)');
  });

  return router;
};

module.exports.FELDER = FELDER;
module.exports.ANLIEGEN_JE_STUNDE = ANLIEGEN_JE_STUNDE;
module.exports.ANLIEGEN_JE_ADRESSE_UND_TAG = ANLIEGEN_JE_ADRESSE_UND_TAG;
module.exports.ARTEN_ERLAUBT = ARTEN_ERLAUBT;
