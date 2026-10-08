// Dauerhafte Warteschlange fuer die Arbeit nach der Antwort
// (Migration 202, Tabelle nachlauf_auftraege).
//
// WARUM (Befund "Mitteilungen nach der Antwort gehen bei einem Neustart
// verloren"): utils/nachAntwort.js fuehrt Push, Postfach-Eintrag und E-Mail
// nach res.json() im Speicher des Prozesses aus. Startet der Container in
// dieser Zeit neu -- jeder Deploy beendet beide Replicas nacheinander --, war
// die Arbeit weg. Die eigentliche Aenderung (Punkte, Abzeichen, Buchung) stand
// in der Datenbank, nur erfuhr niemand davon.
//
// WIE:
//   1. Eine Route ruft nach der Antwort `einreihen(db, art, parameter, {req})`.
//      Das legt EINE Zeile an (Art + Parameter als JSON) und stoesst den
//      Auftrag sofort im eigenen Prozess an -- die Mitteilung kommt so schnell
//      wie bisher, sie ist nur vorher aufgeschrieben.
//   2. Ein Arbeiter je Replica (`starteArbeiter`, server.js) holt alle paar
//      Sekunden ab, was liegen blieb: Auftraege eines beendeten Prozesses
//      (Sperre abgelaufen) und solche, die nach einem Fehler wiederholt
//      werden sollen.
//   3. Annehmen geschieht mit FOR UPDATE SKIP LOCKED in EINER Anweisung: Zwei
//      Replicas nehmen denselben Auftrag nie gleichzeitig an. Die Zeile ist
//      danach 'laeuft' und fuer gesperrt_von bis gesperrt_bis reserviert; die
//      Sperre wird waehrend der Arbeit verlaengert. Keine offene Transaktion
//      waehrend der Arbeit -- ein Push an 300 Geraete belegt keinen
//      Pool-Platz.
//   4. Was eine Art tut, steht als registrierte Funktion im Code
//      (`registriereArt`), nicht als Closure in der Datenbank. Ein Prozess
//      nimmt nur Arten an, die er kennt: Waehrend eines Rolling Deploys laesst
//      der alte Stand die neuen Arten liegen, statt sie zu verwerfen.
//   5. Wiederholen: Scheitert ein Auftrag (die Funktion wirft), geht er mit
//      wachsendem Abstand (30 s, 1, 2, 4 ... min, hoechstens 1 h) zurueck in
//      die Schlange, nach max_versuche ist er 'fehlgeschlagen'. Ein Auftrag,
//      der den Prozess mitnimmt, zaehlt ebenfalls als Versuch.
//   6. Doppelt senden vermeiden: Teile eines Auftrags laufen ueber
//      `kontext.schritt('push', fn)`. Ein erledigter Schritt steht in
//      erledigte_schritte und laeuft bei einer Wiederholung nicht noch einmal.
//      Uebrig bleibt nur der Augenblick zwischen Ende eines Schritts und
//      seinem Vermerk (eine Abfrage): Bricht der Prozess genau dort ab, kann
//      dieser eine Schritt doppelt kommen. Lieber einmal doppelt als nie.
//   7. Aufraeumen: Erledigte Auftraege verlieren ihre Parameter sofort (es
//      stehen Namen und Texte darin) und gehen nach 7 Tagen, fehlgeschlagene
//      nach 30 Tagen.
//   8. Herunterfahren (SIGTERM): `stopp()` nimmt nichts Neues mehr an, wartet
//      kurz auf die angenommenen Auftraege und gibt, was dann noch laeuft,
//      zurueck in die Schlange -- die andere Replica macht weiter.
//
// FAELLT DIE TABELLE AUS (Migration nicht durch, Datenbank weg beim
// Einreihen), laeuft die Arbeit wie bisher im Prozess. Schlechter als vorher
// wird es nicht.
//
// Was NICHT hierher gehoert: Live-Updates (Socket) und Cache-Leerungen. Sie
// sind fluechtig -- eine App, die nach dem Neustart wieder verbindet, laedt
// ohnehin neu --, und bleiben bei utils/nachAntwort.js.

const os = require('os');
const { nachAntwort } = require('./nachAntwort');

const TABELLE = 'nachlauf_auftraege';

// Wer ich bin (fuer gesperrt_von): Container-Name und Prozess.
const ICH = `${os.hostname()}:${process.pid}`;

const zahl = (wert, vorgabe) => {
  const n = parseInt(wert, 10);
  return Number.isFinite(n) && n >= 0 ? n : vorgabe;
};

// Sperre eines angenommenen Auftrags. Laeuft er laenger, wird sie im Drittel
// dieser Zeit verlaengert; stirbt der Prozess, holt ihn eine andere Replica
// nach Ablauf.
const SPERRE_MS = zahl(process.env.NACHLAUF_SPERRE_MS, 2 * 60 * 1000);
const TAKT_MS = zahl(process.env.NACHLAUF_TAKT_MS, 5000);
const STOPP_WARTEN_MS = zahl(process.env.NACHLAUF_STOPP_MS, 3000);
const JE_TAKT = 10;
const ERLEDIGTE_TAGE = 7;
const FEHLGESCHLAGENE_TAGE = 30;
const AUFRAEUMEN_ALLE_MS = 60 * 60 * 1000;

/** Abstand bis zur naechsten Wiederholung nach `versuche` Versuchen. */
function wartezeitMs(versuche) {
  const n = Math.max(1, versuche);
  return Math.min(30 * 1000 * 2 ** (n - 1), 60 * 60 * 1000);
}

// ---------------------------------------------------------------------
// Arten
// ---------------------------------------------------------------------

/** @type {Map<string, {ausfuehren: Function, maxVersuche: number}>} */
const arten = new Map();

/**
 * Meldet eine Art an. Ein zweites Anmelden derselben Art ersetzt die erste
 * (createApp laeuft im Test je Datei neu).
 *
 * @param {string} name
 * @param {(db: object, parameter: object, kontext: {auftragId: number|null, versuch: number, schritt: (name: string, fn: () => Promise<any>) => Promise<boolean>}) => Promise<void>} ausfuehren
 * @param {{maxVersuche?: number}} [optionen]
 */
function registriereArt(name, ausfuehren, { maxVersuche = 5 } = {}) {
  if (typeof name !== 'string' || !name) throw new Error('Art braucht einen Namen');
  if (typeof ausfuehren !== 'function') throw new Error(`Art ${name}: keine Funktion`);
  arten.set(name, { ausfuehren, maxVersuche });
}

const bekannteArten = () => [...arten.keys()];

/**
 * Ein Zeitpunkt aus den Parametern zurueck als Date. JSON macht aus einem
 * Date eine Zeichenkette; die Funktionen der Arten bekommen so wieder
 * denselben Wert wie vorher im Prozess. null/undefined bleiben.
 */
const alsDatum = (wert) => (wert === null || wert === undefined ? wert : new Date(wert));

// ---------------------------------------------------------------------
// Laufende Arbeit dieses Prozesses (fuer stopp())
// ---------------------------------------------------------------------

const laufende = new Set();
let lokalAngehalten = false;

function merken(lauf) {
  laufende.add(lauf);
  lauf.finally(() => laufende.delete(lauf));
  return lauf;
}

// ---------------------------------------------------------------------
// Ausfuehren eines angenommenen Auftrags
// ---------------------------------------------------------------------

/**
 * Kontext fuer die Funktion einer Art.
 *
 * schritt(name, fn): fuehrt fn aus, wenn der Schritt in diesem Auftrag noch
 * nicht erledigt ist, und vermerkt ihn danach. Scheitert fn, wird der Fehler
 * gemeldet und gesammelt, die uebrigen Schritte laufen trotzdem (so wie
 * bisher ein gescheiterter Level-Up-Push den Postfach-Eintrag nicht
 * verhinderte); am Ende gilt der Auftrag als gescheitert und wird spaeter
 * wiederholt -- dann nur mit den Schritten, die fehlen.
 *
 * Ohne auftragId (Notweg im Prozess) wird nichts vermerkt.
 */
function neuerKontext(db, auftragId, versuch, erledigt = new Set()) {
  const fehler = [];
  return {
    auftragId,
    versuch,
    async schritt(name, fn) {
      if (erledigt.has(name)) return true;
      try {
        await fn();
      } catch (err) {
        fehler.push({ name, err });
        console.error(`Nachlauf ${auftragId ?? '(im Prozess)'}: Schritt "${name}" fehlgeschlagen:`, err);
        return false;
      }
      erledigt.add(name);
      if (auftragId === null) return true;
      await db.query(
        `UPDATE ${TABELLE} SET erledigte_schritte = erledigte_schritte || $2::jsonb WHERE id = $1`,
        [auftragId, JSON.stringify([name])]
      );
      return true;
    },
    fehlerWerfen() {
      if (fehler.length === 0) return;
      const err = new Error(`Schritt ${fehler.map((f) => `"${f.name}"`).join(', ')} fehlgeschlagen: ${fehler.map((f) => f.err && f.err.message).join('; ')}`);
      err.schritte = fehler;
      throw err;
    },
  };
}

async function bearbeite(db, auftrag) {
  const art = arten.get(auftrag.art);
  const erledigt = new Set(Array.isArray(auftrag.erledigte_schritte) ? auftrag.erledigte_schritte : []);

  // Zu oft angenommen, ohne fertig zu werden (der Auftrag nimmt den Prozess
  // mit): nicht noch einmal anfassen.
  if (auftrag.versuche > auftrag.max_versuche) {
    await db.query(
      `UPDATE ${TABELLE}
          SET status = 'fehlgeschlagen', erledigt_am = NOW(), gesperrt_bis = NULL,
              letzter_fehler = COALESCE(letzter_fehler, 'Abgebrochen, ohne fertig zu werden')
        WHERE id = $1 AND gesperrt_von = $2`,
      [auftrag.id, ICH]
    );
    console.error(`Nachlauf ${auftrag.id} (${auftrag.art}): nach ${auftrag.max_versuche} Versuchen aufgegeben.`);
    return;
  }

  const verlaengern = setInterval(() => {
    db.query(
      `UPDATE ${TABELLE} SET gesperrt_bis = NOW() + $3 * INTERVAL '1 millisecond'
        WHERE id = $1 AND gesperrt_von = $2 AND status = 'laeuft'`,
      [auftrag.id, ICH, SPERRE_MS]
    ).catch(() => {});
  }, Math.max(1000, Math.floor(SPERRE_MS / 3)));
  verlaengern.unref();

  const kontext = neuerKontext(db, auftrag.id, auftrag.versuche, erledigt);

  try {
    await art.ausfuehren(db, auftrag.parameter || {}, kontext);
    kontext.fehlerWerfen();
    clearInterval(verlaengern);
    await db.query(
      `UPDATE ${TABELLE}
          SET status = 'erledigt', erledigt_am = NOW(), gesperrt_bis = NULL,
              letzter_fehler = NULL, parameter = '{}'::jsonb
        WHERE id = $1 AND gesperrt_von = $2`,
      [auftrag.id, ICH]
    );
  } catch (err) {
    clearInterval(verlaengern);
    const endgueltig = auftrag.versuche >= auftrag.max_versuche;
    const meldung = String((err && (err.stack || err.message)) || err).slice(0, 2000);
    console.error(
      `Nachlauf ${auftrag.id} (${auftrag.bezeichnung || auftrag.art}) fehlgeschlagen, Versuch ${auftrag.versuche}/${auftrag.max_versuche}${endgueltig ? ' -- aufgegeben' : ''}:`,
      err
    );
    await db.query(
      `UPDATE ${TABELLE}
          SET status = $3, letzter_fehler = $4, gesperrt_bis = NULL, gesperrt_von = NULL,
              faellig_ab = NOW() + $5 * INTERVAL '1 millisecond',
              erledigt_am = CASE WHEN $3 = 'fehlgeschlagen' THEN NOW() ELSE NULL END
        WHERE id = $1 AND gesperrt_von = $2`,
      [auftrag.id, ICH, endgueltig ? 'fehlgeschlagen' : 'offen', meldung, wartezeitMs(auftrag.versuche)]
    ).catch((e) => console.error(`Nachlauf ${auftrag.id}: Fehlschlag nicht vermerkt:`, e.message));
  }
}

/**
 * Nimmt faellige Auftraege an (hoechstens `anzahl`, nur bekannte Arten), mit
 * SKIP LOCKED -- was eine andere Replica gerade annimmt, wird uebersprungen.
 * Mit `id` genau diesen einen (das Anstossen direkt nach dem Einreihen).
 */
async function annehmen(db, { id = null, anzahl = JE_TAKT } = {}) {
  const namen = bekannteArten();
  if (namen.length === 0) return [];
  const { rows } = await db.query(
    `UPDATE ${TABELLE} a
        SET status = 'laeuft', versuche = a.versuche + 1, gesperrt_von = $1,
            gesperrt_bis = NOW() + $2 * INTERVAL '1 millisecond'
      WHERE a.id IN (
        SELECT id FROM ${TABELLE}
         WHERE art = ANY($3::text[])
           AND ($4::bigint IS NULL OR id = $4::bigint)
           AND ((status = 'offen' AND faellig_ab <= NOW())
             OR (status = 'laeuft' AND gesperrt_bis < NOW()))
         ORDER BY faellig_ab, id
         LIMIT $5
         FOR UPDATE SKIP LOCKED)
      RETURNING a.*`,
    [ICH, SPERRE_MS, namen, id, anzahl]
  );
  return rows;
}

// ---------------------------------------------------------------------
// Einreihen
// ---------------------------------------------------------------------

/**
 * Reiht einen Auftrag ein und stoesst ihn sofort an. Wirft nie; Fehler werden
 * gemeldet (wie nachAntwort). Im Test laesst sich der Lauf ueber
 * warteAufNachwehen(app) abwarten.
 *
 * Der Auftrag steht in der Datenbank, sobald das INSERT durch ist -- eine
 * Abfrage nach der Antwort. Bis dahin (Millisekunden) lebt er nur im Prozess;
 * ein geordnetes Herunterfahren wartet darauf (stopp()), nur ein harter
 * Abbruch genau in diesem Augenblick verliert ihn.
 *
 * @param {object} db  Pool (query)
 * @param {string} art  registrierte Art
 * @param {object} parameter  nur JSON-Werte (Zahlen, Texte, Listen, Objekte)
 * @param {object} [optionen]
 * @param {import('express').Request} [optionen.req]  fuer die Test-Nachwehen
 * @param {string} [optionen.bezeichnung]  steht in Protokoll und Tabelle
 * @param {string} [optionen.schluessel]  eindeutig: ein zweites Einreihen mit
 *   demselben Schluessel legt nichts an
 * @returns {Promise<void>}
 */
function einreihen(db, art, parameter = {}, { req = null, bezeichnung = null, schluessel = null } = {}) {
  const eintrag = arten.get(art);
  const titel = bezeichnung || art;
  const lauf = nachAntwort(req, async () => {
    if (!eintrag) throw new Error(`Unbekannte Nachlauf-Art "${art}"`);

    let id;
    try {
      const { rows } = await db.query(
        `INSERT INTO ${TABELLE} (art, parameter, bezeichnung, schluessel, max_versuche)
         VALUES ($1, $2::jsonb, $3, $4, $5)
         ON CONFLICT (schluessel) WHERE schluessel IS NOT NULL DO NOTHING
         RETURNING id`,
        [art, JSON.stringify(parameter), bezeichnung, schluessel, eintrag.maxVersuche]
      );
      if (rows.length === 0) return; // schon eingereiht (gleicher Schluessel)
      id = rows[0].id;
    } catch (err) {
      // Tabelle fehlt oder Datenbank hakt: wie bisher im Prozess arbeiten.
      console.error(`Nachlauf "${titel}": Einreihen gescheitert (${err.code || err.message}), laeuft im Prozess.`);
      const kontext = neuerKontext(db, null, 1);
      await eintrag.ausfuehren(db, parameter, kontext);
      kontext.fehlerWerfen();
      return;
    }

    // Faehrt dieser Prozess gerade herunter, bleibt der Auftrag fuer die
    // andere Replica liegen.
    if (lokalAngehalten) return;
    const [angenommen] = await annehmen(db, { id, anzahl: 1 });
    if (angenommen) await bearbeite(db, angenommen);
  }, titel);
  return merken(lauf);
}

// ---------------------------------------------------------------------
// Arbeiter
// ---------------------------------------------------------------------

/** Ein Takt: faellige Auftraege annehmen und nacheinander abarbeiten. */
async function einTakt(db) {
  const auftraege = await annehmen(db);
  for (const auftrag of auftraege) {
    await bearbeite(db, auftrag);
  }
  return auftraege.length;
}

/** Erledigte nach 7, fehlgeschlagene nach 30 Tagen loeschen. */
async function aufraeumen(db) {
  const { rowCount } = await db.query(
    `DELETE FROM ${TABELLE}
      WHERE (status = 'erledigt' AND erledigt_am < NOW() - $1 * INTERVAL '1 day')
         OR (status = 'fehlgeschlagen' AND erledigt_am < NOW() - $2 * INTERVAL '1 day')`,
    [ERLEDIGTE_TAGE, FEHLGESCHLAGENE_TAGE]
  );
  return rowCount;
}

// ---------------------------------------------------------------------
// Zustand fuer GET /api/status
// ---------------------------------------------------------------------

// HAENGEND heisst: seit mehr als 15 Minuten eingereiht und noch nicht fertig
// (status 'offen' oder 'laeuft'). Begruendung der Schwelle: Ein Auftrag
// laeuft sonst sofort; die Wiederholungen nach Fehlern liegen 30 s, 1, 2 und
// 4 min auseinander, nach dem fuenften Versuch ist er 'fehlgeschlagen' --
// zusammen rund 7,5 Minuten plus Laufzeit. Wer nach 15 Minuten noch offen
// ist, wird von keinem Arbeiter mehr angenommen (keiner laeuft, oder keiner
// kennt die Art).
// FEHLGESCHLAGEN zaehlt die der letzten 24 Stunden -- sie liegen 30 Tage
// zum Nachsehen; ohne Zeitfenster stuende die Zahl einen Monat lang still
// auf dem Stand einer laengst behobenen Stoerung.
const HAENGEND_MINUTEN = 15;
const FEHLGESCHLAGEN_STUNDEN = 24;

/**
 * Zahlen fuer /api/status. Beide Abfragen laufen ueber die Teilindizes
 * (nachlauf_auftraege_faellig_idx bzw. _erledigt_idx).
 *
 * @returns {Promise<{haengend: number, fehlgeschlagen: number}>}
 */
async function zustand(db) {
  const { rows: [z] } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM ${TABELLE}
         WHERE status IN ('offen', 'laeuft')
           AND erstellt_am < NOW() - $1 * INTERVAL '1 minute')::int AS haengend,
       (SELECT COUNT(*) FROM ${TABELLE}
         WHERE status = 'fehlgeschlagen'
           AND erledigt_am > NOW() - $2 * INTERVAL '1 hour')::int AS fehlgeschlagen`,
    [HAENGEND_MINUTEN, FEHLGESCHLAGEN_STUNDEN]
  );
  return { haengend: z.haengend, fehlgeschlagen: z.fehlgeschlagen };
}

/**
 * Startet den Arbeiter dieser Replica.
 *
 * @param {object} db
 * @param {{taktMs?: number}} [optionen]
 * @returns {{stopp: (optionen?: {wartenMs?: number}) => Promise<{zurueckgegeben: number}>, takt: () => Promise<number>}}
 */
function starteArbeiter(db, { taktMs = TAKT_MS } = {}) {
  lokalAngehalten = false;
  let laeuft = true;
  let aktiverTakt = null;
  let letztesAufraeumen = 0;

  const takt = () => {
    if (!laeuft) return Promise.resolve(0);
    if (aktiverTakt) return aktiverTakt;
    aktiverTakt = merken((async () => {
      try {
        const anzahl = await einTakt(db);
        if (Date.now() - letztesAufraeumen > AUFRAEUMEN_ALLE_MS) {
          letztesAufraeumen = Date.now();
          const weg = await aufraeumen(db);
          if (weg > 0) console.log(`Nachlauf: ${weg} alte Auftraege geloescht.`);
        }
        return anzahl;
      } catch (err) {
        console.error('Nachlauf-Arbeiter: Takt fehlgeschlagen:', err.message);
        return 0;
      }
    })()).finally(() => { aktiverTakt = null; });
    return aktiverTakt;
  };

  const timer = setInterval(() => { takt(); }, Math.max(100, taktMs));
  timer.unref();

  return {
    takt,
    /**
     * Nichts Neues mehr annehmen, kurz auf die angenommenen Auftraege warten,
     * den Rest zurueck in die Schlange geben.
     */
    async stopp({ wartenMs = STOPP_WARTEN_MS } = {}) {
      laeuft = false;
      lokalAngehalten = true;
      clearInterval(timer);
      const offen = [...laufende];
      if (offen.length > 0) {
        let zeit;
        await Promise.race([
          Promise.allSettled(offen),
          new Promise((resolve) => { zeit = setTimeout(resolve, wartenMs); }),
        ]);
        clearTimeout(zeit);
      }
      // Was jetzt noch 'laeuft' und mir gehoert, geht zurueck. Der Versuch
      // zaehlt nicht: Der Auftrag ist nicht gescheitert, der Prozess geht.
      const { rowCount } = await db.query(
        `UPDATE ${TABELLE}
            SET status = 'offen', gesperrt_bis = NULL, gesperrt_von = NULL,
                versuche = GREATEST(versuche - 1, 0), faellig_ab = NOW()
          WHERE status = 'laeuft' AND gesperrt_von = $1`,
        [ICH]
      );
      if (rowCount > 0) console.warn(`Nachlauf: ${rowCount} angefangene Auftraege an die Schlange zurueckgegeben.`);
      return { zurueckgegeben: rowCount };
    },
  };
}

// Nur fuer Tests: simuliert einen Prozess, der direkt nach dem Einreihen
// endet (true) -- der Auftrag steht dann nur in der Tabelle.
function _lokalAnhalten(wert = true) {
  lokalAngehalten = wert;
}

function _zuruecksetzen() {
  lokalAngehalten = false;
}

module.exports = {
  TABELLE,
  ICH,
  registriereArt,
  bekannteArten,
  alsDatum,
  einreihen,
  annehmen,
  bearbeite,
  einTakt,
  aufraeumen,
  starteArbeiter,
  wartezeitMs,
  zustand,
  HAENGEND_MINUTEN,
  FEHLGESCHLAGEN_STUNDEN,
  _lokalAnhalten,
  _zuruecksetzen,
};
