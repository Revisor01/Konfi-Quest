// Gespeicherte Mails der Support-Mail (mail_nachrichten, Migration 193):
// Zerlegen einer abgeholten Mail, Felder der Antwort, Faeden und Verlauf.
//
// EIN FADEN sind alle Mails, die ueber Message-ID, In-Reply-To und
// References miteinander verbunden sind -- auch ueber eine Mail, die
// Konfi Quest selbst nicht gespeichert hat (etwa die erste Mail aus dem
// Mailprogramm, auf die zwei Antworten verweisen). Zwei Mails gehoeren
// zusammen, wenn sich ihre Schluessel {message_id, in_reply_to,
// references...} ueberschneiden; der Faden ist alles, was so erreichbar ist.
// GET /support/mail/nachrichten/:id zeigt ihn als Verlauf, und Zuordnen
// nimmt ihn als Ganzes mit (routes/supportMail.js).

const { simpleParser } = require('mailparser');

// Grenzen (Vertrag: Text hoechstens 50.000 Zeichen; der Rest schuetzt die
// Tabelle vor beliebig langen Kopfzeilen).
const TEXT_MAX = 50000;
const BETREFF_MAX = 1000;
const NAME_MAX = 300;
const ADRESSE_MAX = 320;
const ADRESSEN_MAX = 50;
const MESSAGE_ID_MAX = 998;
const REFERENZEN_MAX = 100;
const ANHAENGE_MAX = 100;
const AUSZUG_MAX = 200;

/** Postgres nimmt kein NUL-Zeichen in TEXT an -- raus damit. */
const ohneNul = (text) => String(text).replaceAll(String.fromCharCode(0), '');

/** Text auf hoechstens `max` Zeichen, ohne NUL; null bleibt null. */
function kuerzen(text, max) {
  if (text === null || text === undefined) return null;
  const sauber = ohneNul(text);
  return sauber.length > max ? sauber.slice(0, max) : sauber;
}

/**
 * Message-IDs aus einem Kopfzeilenwert: jede in spitzen Klammern. Ein Wert
 * ohne Klammern gilt als eine einzige ID und bekommt sie.
 * @returns {string[]}
 */
function messageIds(wert) {
  if (wert === null || wert === undefined) return [];
  const teile = Array.isArray(wert) ? wert : [wert];
  const ids = [];
  for (const teil of teile) {
    const text = ohneNul(teil).trim();
    if (text === '') continue;
    const inKlammern = text.match(/<[^<>\s]+>/g);
    if (inKlammern) ids.push(...inKlammern);
    else ids.push(...text.split(/\s+/).filter(Boolean).map((t) => `<${t}>`));
  }
  return ids.filter((id) => id.length <= MESSAGE_ID_MAX);
}

/** Adressen aus einem mailparser-Adressobjekt (oder einer Liste davon), flach. */
function adressenAus(feld) {
  const objekte = Array.isArray(feld) ? feld : (feld ? [feld] : []);
  const ergebnis = [];
  const sammeln = (eintraege) => {
    for (const e of eintraege || []) {
      if (e.group) sammeln(e.group);
      else if (e.address) ergebnis.push({ address: e.address, name: e.name || '' });
    }
  };
  for (const o of objekte) sammeln(o.value);
  return ergebnis;
}

/** Eine Adresse fuer die Tabelle: klein, ohne Rand, begrenzt. */
const adresseSpeichern = (a) => kuerzen(String(a).trim().toLowerCase(), ADRESSE_MAX);

/**
 * Zerlegt eine abgeholte Mail (Quelltext) in die Felder der Tabelle.
 *
 * Text: der Klartext-Teil; hat die Mail nur HTML, erzeugt mailparser den
 * Klartext daraus. Hoechstens TEXT_MAX Zeichen. Anhaenge: nur Name, Groesse
 * und Typ -- die Inhalte werden nicht gespeichert.
 *
 * @param {Buffer|string} quelle
 * @param {{ersatzId: string, eingang?: Date|null}} opt
 *   ersatzId: stabile Message-ID, falls die Mail keine hat
 *   eingang:  Zeitpunkt des Eingangs im Postfach (INTERNALDATE), falls die
 *             Mail kein Datum traegt
 */
async function mailZerlegen(quelle, { ersatzId, eingang = null }) {
  const p = await simpleParser(quelle, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true });
  const [messageId] = messageIds(p.messageId);
  const [inReplyTo] = messageIds(p.inReplyTo);
  const referenzen = messageIds(p.references).slice(-REFERENZEN_MAX);
  const [von] = adressenAus(p.from);
  const an = [...adressenAus(p.to), ...adressenAus(p.cc)]
    .map((a) => adresseSpeichern(a.address))
    .filter(Boolean)
    .slice(0, ADRESSEN_MAX);
  const datum = p.date instanceof Date && !Number.isNaN(p.date.getTime())
    ? p.date
    : (eingang instanceof Date && !Number.isNaN(eingang.getTime()) ? eingang : new Date());

  return {
    messageId: messageId || ersatzId,
    inReplyTo: inReplyTo || null,
    referenzen,
    vonAdresse: von ? adresseSpeichern(von.address) : null,
    vonName: von && von.name ? kuerzen(von.name.trim(), NAME_MAX) : null,
    anAdressen: an,
    betreff: kuerzen((p.subject || '').trim(), BETREFF_MAX),
    text: kuerzen(p.text || '', TEXT_MAX),
    anhaenge: (p.attachments || []).slice(0, ANHAENGE_MAX).map((a) => ({
      name: a.filename ? kuerzen(a.filename, 255) : null,
      groesse: Number.isFinite(a.size) ? a.size : null,
      typ: a.contentType ? kuerzen(a.contentType, 255) : null,
    })),
    gesendetAm: datum,
  };
}

/** Groesse in MB mit einer Nachkommastelle und deutschem Komma ("40,0"). */
const megabyte = (bytes) => (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');

/** Hinweis statt des Textes einer Mail, die zu gross fuer die Uebernahme ist. */
function zuGrossText(bytes) {
  return Number.isFinite(bytes)
    ? `Diese Mail ist zu groß für die Übernahme (${megabyte(bytes)} MB). Bitte im Mailprogramm ansehen.`
    : 'Diese Mail ist zu groß für die Übernahme. Bitte im Mailprogramm ansehen.';
}

/**
 * Anhaenge aus dem Aufbau der Mail (IMAP BODYSTRUCTURE, wie imapflow ihn
 * liefert): jeder Teil mit Dateinamen oder "attachment", eine eingebettete
 * Mail (message/rfc822) als ein Anhang. Die Groesse meldet der Server
 * kodiert; bei base64 ist der Inhalt rund drei Viertel davon (geschaetzt).
 */
function anhaengeAusAufbau(knoten, ergebnis = []) {
  if (!knoten || ergebnis.length >= ANHAENGE_MAX) return ergebnis;
  const typ = String(knoten.type || '').toLowerCase();
  const name = (knoten.dispositionParameters && knoten.dispositionParameters.filename)
    || (knoten.parameters && knoten.parameters.name) || null;
  const istAnhang = typ === 'message/rfc822' || knoten.disposition === 'attachment' || Boolean(name);
  if (Array.isArray(knoten.childNodes) && knoten.childNodes.length > 0 && !istAnhang) {
    for (const kind of knoten.childNodes) anhaengeAusAufbau(kind, ergebnis);
    return ergebnis;
  }
  if (istAnhang) {
    const roh = Number.isFinite(knoten.size) ? knoten.size : null;
    const base64 = String(knoten.encoding || '').toLowerCase() === 'base64';
    ergebnis.push({
      name: name ? kuerzen(name, 255) : null,
      groesse: roh === null ? null : (base64 ? Math.floor((roh * 3) / 4) : roh),
      typ: typ ? kuerzen(typ, 255) : null,
    });
  }
  return ergebnis;
}

/**
 * Eintrag fuer eine Mail, deren Quelltext zu gross ist -- nur aus dem, was
 * der Server ohne Quelltext liefert (services/mailAbholung.js): Umschlag
 * (Absender, Empfaenger, Betreff, Message-ID, In-Reply-To; References gibt
 * es dort nicht) und Aufbau (Anhaenge). Der Text ist ein Hinweis mit der
 * Groesse.
 *
 * @param {{size?: number, envelope?: object, bodyStructure?: object}} kopf
 * @param {{ersatzId: string, eingang?: Date|null}} opt
 */
function mailAusKopf(kopf, { ersatzId, eingang = null }) {
  const u = kopf.envelope || {};
  const [messageId] = messageIds(u.messageId);
  const [inReplyTo] = messageIds(u.inReplyTo);
  const adressen = (liste) => (Array.isArray(liste) ? liste : []).filter((a) => a && a.address);
  const [von] = adressen(u.from);
  const an = [...adressen(u.to), ...adressen(u.cc)]
    .map((a) => adresseSpeichern(a.address))
    .filter(Boolean)
    .slice(0, ADRESSEN_MAX);
  const alsDatum = (wert) => {
    if (!wert) return null;
    const d = wert instanceof Date ? wert : new Date(wert);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return {
    messageId: messageId || ersatzId,
    inReplyTo: inReplyTo || null,
    referenzen: [],
    vonAdresse: von ? adresseSpeichern(von.address) : null,
    vonName: von && von.name ? kuerzen(String(von.name).trim(), NAME_MAX) : null,
    anAdressen: an,
    betreff: kuerzen(String(u.subject || '').trim(), BETREFF_MAX),
    text: zuGrossText(kopf.size),
    anhaenge: anhaengeAusAufbau(kopf.bodyStructure),
    gesendetAm: alsDatum(u.date) || alsDatum(eingang) || new Date(),
  };
}

/**
 * Kurzer Auszug fuer Listen: ohne zitierte Zeilen ("> ..."), Leerraum
 * zusammengefasst, hoechstens AUSZUG_MAX Zeichen (dann mit "…").
 */
function auszug(text) {
  const ohneZitate = String(text || '')
    .split('\n')
    .filter((z) => !/^\s*>/.test(z))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ohneZitate.length > AUSZUG_MAX ? `${ohneZitate.slice(0, AUSZUG_MAX - 1)}…` : ohneZitate;
}

// Die Felder einer Mail in den Antworten (alle Spalten ausser imap_uid, dazu
// der Name des Kontos, das eine Antwort geschrieben hat).
// vorgang_id und archiviert_am (Migration 195, additiv): der Vorgang der Mail
// und -- nur im Posteingang -- wann sie archiviert wurde.
const NACHRICHT_SPALTEN = `m.id, m.postfach, m.richtung, m.anfrage_id, m.organization_id, m.vorgang_id, m.message_id,
  m.in_reply_to, m.referenzen, m.von_adresse, m.von_name, m.an_adressen, m.betreff, m.text, m.anhaenge,
  m.gesendet_am, m.gelesen_am, m.archiviert_am, m.verfasst_von, vu.display_name AS verfasst_von_name, m.created_at`;

const NACHRICHT_FROM = 'mail_nachrichten m LEFT JOIN users vu ON vu.id = m.verfasst_von';

// Wohin eine Mail gehoert, fuer die Listen der Support-Ansicht (Posteingang,
// Uebersicht; 03.10.2026): anfrage_id und organization_id wie gespeichert,
// dazu gemeinde_name -- bei Zuordnung zu einer Gemeinde deren Anzeigename
// (display_name, sonst name), bei Zuordnung zu einer Anfrage der Gemeindename
// aus der Anfrage, sonst null. Hinter FROM mail_nachrichten m einsetzen:
// `SELECT ${ZUORDNUNG_SPALTEN} FROM mail_nachrichten m ${ZUORDNUNG_JOINS}`.
// Nach `intern` wird nicht gefiltert: Mails zu internen Gemeinden bleiben da.
const ZUORDNUNG_SPALTEN = `m.anfrage_id, m.organization_id,
  COALESCE(NULLIF(btrim(zg.display_name), ''), zg.name, za.gemeinde) AS gemeinde_name`;
const ZUORDNUNG_JOINS = `LEFT JOIN organizations zg ON zg.id = m.organization_id
  LEFT JOIN gemeinde_anfragen za ON za.id = m.anfrage_id`;

// Ungelesene eingehende Mails einer Anfrage -- Feld `ungelesen` an der
// Anfrage. Gehoert in eine Abfrage mit gemeinde_anfragen unter dem Namen `a`.
const UNGELESEN_JE_ANFRAGE_SQL = `(SELECT COUNT(*)::int FROM mail_nachrichten um
    WHERE um.anfrage_id = a.id AND um.richtung = 'ein' AND um.gelesen_am IS NULL)`;

// Die Felder einer Anfrage in der Antwort (Vertrag der Pakete, 03.10.2026) --
// GET /support/anfragen und der Vorgang einer Anfrage (GET /support/vorgaenge/:id).
// ungelesen (seit 03.10.2026, Support-Mail, additiv): ungelesene eingehende
// Mails zu dieser Anfrage (docs/planung/support-mail.md). Gehoert in eine
// Abfrage mit gemeinde_anfragen unter dem Namen `a`.
const ANFRAGE_SPALTEN = `a.id, a.gemeinde, a.kirchenkreis, a.landeskirche, a.kontakt_name, a.funktion,
  a.email, a.mobil, a.anzahl_konfis, a.anzahl_teamer, a.nachricht, a.status, a.notiz,
  a.organization_id, a.created_at, a.updated_at, a.wunsch_lizenz,
  ${UNGELESEN_JE_ANFRAGE_SQL} AS ungelesen`;

/**
 * Kennungen aller Mails im Faden der Mail `id` (sie selbst eingeschlossen),
 * aufsteigend. Leer, wenn es die Mail nicht gibt.
 */
async function fadenIds(db, id) {
  const { rows } = await db.query(
    `WITH RECURSIVE faden(id, schluessel) AS (
       SELECT m.id, array_remove(ARRAY[m.message_id, m.in_reply_to] || m.referenzen, NULL)
         FROM mail_nachrichten m WHERE m.id = $1
       UNION
       SELECT m.id, array_remove(ARRAY[m.message_id, m.in_reply_to] || m.referenzen, NULL)
         FROM mail_nachrichten m
         JOIN faden f
           ON m.message_id = ANY(f.schluessel)
           OR m.in_reply_to = ANY(f.schluessel)
           OR m.referenzen && f.schluessel
     )
     SELECT DISTINCT id FROM faden ORDER BY id`, [id]);
  return rows.map((r) => Number(r.id));
}

/** Eine Mail mit allen Feldern, oder null. */
async function nachrichtLaden(db, id) {
  const { rows } = await db.query(`SELECT ${NACHRICHT_SPALTEN} FROM ${NACHRICHT_FROM} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

/** Mails zu einer Liste von Kennungen, aelteste zuerst. */
async function nachrichtenLaden(db, ids) {
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    `SELECT ${NACHRICHT_SPALTEN} FROM ${NACHRICHT_FROM}
      WHERE m.id = ANY($1::bigint[]) ORDER BY m.gesendet_am, m.id`, [ids]);
  return rows;
}

/** Verlauf einer Anfrage bzw. Gemeinde, aelteste zuerst. */
async function verlaufLaden(db, { anfrageId = null, organizationId = null }) {
  const [spalte, wert] = anfrageId !== null ? ['anfrage_id', anfrageId] : ['organization_id', organizationId];
  const { rows } = await db.query(
    `SELECT ${NACHRICHT_SPALTEN} FROM ${NACHRICHT_FROM}
      WHERE m.${spalte} = $1 ORDER BY m.gesendet_am, m.id`, [wert]);
  return rows;
}

module.exports = {
  TEXT_MAX,
  AUSZUG_MAX,
  REFERENZEN_MAX,
  messageIds,
  mailZerlegen,
  mailAusKopf,
  anhaengeAusAufbau,
  zuGrossText,
  auszug,
  kuerzen,
  NACHRICHT_SPALTEN,
  NACHRICHT_FROM,
  ZUORDNUNG_SPALTEN,
  ZUORDNUNG_JOINS,
  UNGELESEN_JE_ANFRAGE_SQL,
  ANFRAGE_SPALTEN,
  fadenIds,
  nachrichtLaden,
  nachrichtenLaden,
  verlaufLaden,
};
