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
const NACHRICHT_SPALTEN = `m.id, m.postfach, m.richtung, m.anfrage_id, m.organization_id, m.message_id,
  m.in_reply_to, m.referenzen, m.von_adresse, m.von_name, m.an_adressen, m.betreff, m.text, m.anhaenge,
  m.gesendet_am, m.gelesen_am, m.verfasst_von, vu.display_name AS verfasst_von_name, m.created_at`;

const NACHRICHT_FROM = 'mail_nachrichten m LEFT JOIN users vu ON vu.id = m.verfasst_von';

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
  auszug,
  kuerzen,
  NACHRICHT_SPALTEN,
  NACHRICHT_FROM,
  fadenIds,
  nachrichtLaden,
  nachrichtenLaden,
  verlaufLaden,
};
