// Antworten der Support-Ansicht versenden (docs/planung/support-mail.md,
// Abschnitt "Antworten"; Simon, 03.10.2026).
//
// Ablauf je Antwort:
//   1. Darf dieser Server senden? Nicht mit RUN_BACKGROUND_JOBS=false
//      (backend-test haengt an der Produktions-Datenbank und erbt dieselben
//      Zugangsdaten) -> 503. Ist das Postfach eingerichtet? Sonst 503.
//   2. Text + Fusszeile (Trenner "-- " nach der Signaturkonvention), eigene
//      Message-ID <kq-uuid@konfi-quest.de>, In-Reply-To/References auf die
//      letzte Mail des Verlaufs, die Kennung [Anfrage N] / [Gemeinde N] im
//      Betreff, wenn sie fehlt. From "<Absendername> <Postfach>", Reply-To
//      das Postfach.
//   3. Senden ueber SMTP mit der Anmeldung des Postfachs. Scheitert das ->
//      502, und es wird NICHTS gespeichert.
//   4. Speichern (richtung 'aus', gelesen_am = gesendet_am). Eine Antwort auf
//      eine Anfrage ist eine Bewegung (updated_at); steht sie auf "neu",
//      geht sie auf "in Arbeit".
//   5. Danach, ohne dass die Antwort darauf wartet: dieselbe Mail per IMAP
//      in den Gesendet-Ordner des Postfachs legen. Gesucht wird der Ordner
//      mit der Markierung \Sent, sonst einer mit dem Namen "Sent" (oder
//      "Gesendet", "Sent Items", "Gesendete Objekte" ...), sonst wird "Sent"
//      angelegt (Befund in der Produktion, 03.10.2026: moin@ hat "Sent" ohne
//      Markierung, support@ hat gar keinen). Scheitert das, bleibt die Mail
//      gesendet; der Fehler steht nur im Protokoll.
//
// Gesendet wird genau der Quelltext, der auch im Gesendet-Ordner landet
// (MailComposer baut ihn einmal).

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { postfachKonfig, smtpOptionen, imapOptionen, nichtEingerichtetMeldung } = require('../utils/mailPostfaecher');
const { einstellungenLesen } = require('../utils/mailEinstellungen');
const mailAbholung = require('./mailAbholung');

const { abmelden, fehlerText } = mailAbholung;

// Zur Laufzeit nachgeschlagen (nicht beim Laden kopiert), damit Tests den
// IMAP-Client ueber mailAbholung.standardImapFabrik ersetzen koennen.
const standardImapFabrik = (optionen) => mailAbholung.standardImapFabrik(optionen);
const { REFERENZEN_MAX, NACHRICHT_SPALTEN, NACHRICHT_FROM } = require('../utils/mailNachrichten');

const VERSAND_AUS_MELDUNG = 'Auf diesem Server ist der Versand aus.';
const VERSAND_GESCHEITERT_MELDUNG = 'Die Mail konnte nicht gesendet werden. Bitte versucht es später noch einmal.';
const BETREFF_MAX = 300;
const SIGNATUR_TRENNER = '-- ';

// Namen, unter denen ein Gesendet-Ordner ohne Markierung gefunden wird
// (klein geschrieben, in dieser Reihenfolge).
const GESENDET_NAMEN = Object.freeze(['sent', 'gesendet', 'sent items', 'sent messages', 'gesendete objekte', 'gesendete elemente']);
const GESENDET_NEU = 'Sent';

/** Fehler mit HTTP-Status fuer die Route. */
class VersandFehler extends Error {
  constructor(status, meldung) {
    super(meldung);
    this.status = status;
  }
}

/** Darf dieser Server Mails senden (und abholen)? */
const versandAufDiesemServer = (env = process.env) => env.RUN_BACKGROUND_JOBS !== 'false';

/** Eine Zeile ohne Zeilenumbrueche (Kopfzeilen). */
const einzeilig = (text) => String(text == null ? '' : text).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/** "Re: Betreff" ohne doppeltes Re:/AW:. */
function antwortBetreff(betreff) {
  const ohne = einzeilig(betreff).replace(/^((re|aw|antw|fwd?|wg)\s*(\[\d+\])?\s*:\s*)+/i, '').trim();
  return ohne ? `Re: ${ohne}` : 'Re:';
}

/** Kennung "[Anfrage 12]" / "[Gemeinde 7]" -- oder null ohne Zuordnung. */
function kennung({ anfrageId = null, organizationId = null }) {
  if (anfrageId !== null && anfrageId !== undefined) return `[Anfrage ${anfrageId}]`;
  if (organizationId !== null && organizationId !== undefined) return `[Gemeinde ${organizationId}]`;
  return null;
}

/** Betreff mit Kennung (angehaengt, wenn sie fehlt), einzeilig und begrenzt. */
function betreffMitKennung(betreff, zuordnung) {
  let ergebnis = einzeilig(betreff);
  const k = kennung(zuordnung);
  if (k && !ergebnis.toLowerCase().includes(k.toLowerCase())) {
    const platz = BETREFF_MAX - k.length - 1;
    ergebnis = `${ergebnis.slice(0, Math.max(platz, 0))} ${k}`.trim();
  }
  return ergebnis.slice(0, BETREFF_MAX);
}

/** Text mit Fusszeile darunter (Trenner "-- " auf eigener Zeile). */
function textMitFusszeile(text, fusszeile) {
  const rumpf = String(text).replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  const fuss = String(fusszeile || '').replace(/\r\n?/g, '\n').trim();
  return fuss ? `${rumpf}\n\n${SIGNATUR_TRENNER}\n${fuss}\n` : `${rumpf}\n`;
}

/** Neue Message-ID <kq-uuid@konfi-quest.de>. */
const neueMessageId = () => `<kq-${crypto.randomUUID()}@konfi-quest.de>`;

/** In-Reply-To und References auf eine Mail des Verlaufs (oder leer). */
function bezugKopf(bezug) {
  if (!bezug || !bezug.message_id) return { inReplyTo: null, referenzen: [] };
  const referenzen = [...(bezug.referenzen || []).filter((r) => r !== bezug.message_id), bezug.message_id]
    .slice(-REFERENZEN_MAX);
  return { inReplyTo: bezug.message_id, referenzen };
}

/**
 * Gesendet-Ordner finden oder anlegen und die Mail dort ablegen.
 * @returns {Promise<string>} Pfad des Ordners
 */
async function inGesendetAblegen(client, quelltext, datum) {
  const ordner = await client.list();
  const waehlbar = ordner.filter((o) => {
    const flags = o.flags instanceof Set ? o.flags : new Set(o.flags || []);
    return !flags.has('\\Noselect') && !flags.has('\\NonExistent');
  });
  let pfad = (waehlbar.find((o) => o.specialUse === '\\Sent') || {}).path || null;
  if (!pfad) {
    const name = (o) => String(o.name || String(o.path).split(o.delimiter || '/').pop()).trim().toLowerCase();
    for (const gesucht of GESENDET_NAMEN) {
      const treffer = waehlbar.find((o) => name(o) === gesucht);
      if (treffer) {
        pfad = treffer.path;
        break;
      }
    }
  }
  if (!pfad) {
    const angelegt = await client.mailboxCreate(GESENDET_NEU);
    pfad = (angelegt && angelegt.path) || GESENDET_NEU;
    console.log('Mail-Versand: Gesendet-Ordner fehlte und wurde angelegt');
  }
  await client.append(pfad, quelltext, ['\\Seen'], datum);
  return pfad;
}

/**
 * Sendet eine Antwort, speichert sie und legt sie (danach) in den
 * Gesendet-Ordner.
 *
 * @param {object} db
 * @param {object} a
 * @param {'moin'|'support'} a.postfach
 * @param {string} a.an               Empfaenger (eine Adresse)
 * @param {string|null} [a.betreff]   leer = Standardbetreff
 * @param {string} a.text
 * @param {number|null} [a.anfrageId]
 * @param {number|null} [a.organizationId]
 * @param {object|null} [a.bezug]     letzte Mail des Verlaufs (Zeile aus mail_nachrichten)
 * @param {string} a.standardBetreff  Betreff ohne Verlauf (ohne Kennung)
 * @param {number|null} a.verfasstVon
 * @param {object} [opt]
 * @param {object} [opt.env]
 * @param {(optionen: object) => object} [opt.imapFabrik]
 * @param {(arbeit: () => Promise<void>) => void} [opt.danach]  fuehrt das
 *   Ablegen im Gesendet-Ordner aus (Route: nachAntwort); ohne Angabe wartet
 *   die Funktion selbst darauf.
 * @returns {Promise<object>} die gespeicherte Mail (Felder wie GET /mail/nachrichten/:id)
 * @throws {VersandFehler} 503 (Versand aus, Postfach nicht eingerichtet), 502 (Versand gescheitert)
 */
async function antwortSenden(db, a, { env = process.env, imapFabrik = standardImapFabrik, danach = null } = {}) {
  if (!versandAufDiesemServer(env)) throw new VersandFehler(503, VERSAND_AUS_MELDUNG);
  const konfig = postfachKonfig(a.postfach, env);
  if (!konfig.versandBereit) throw new VersandFehler(503, nichtEingerichtetMeldung(konfig));

  const zuordnung = { anfrageId: a.anfrageId ?? null, organizationId: a.organizationId ?? null };
  const { fusszeile, absendername } = await einstellungenLesen(db);
  const gewuenscht = einzeilig(a.betreff);
  const grund = gewuenscht || (a.bezug ? antwortBetreff(a.bezug.betreff) : einzeilig(a.standardBetreff));
  const betreff = betreffMitKennung(grund, zuordnung);
  const text = textMitFusszeile(a.text, fusszeile);
  const messageId = neueMessageId();
  const { inReplyTo, referenzen } = bezugKopf(a.bezug);
  const gesendetAm = new Date();
  const an = String(a.an).trim().toLowerCase();
  const name = einzeilig(absendername) || 'Konfi Quest';

  const quelltext = await new MailComposer({
    from: { name, address: konfig.adresse },
    to: an,
    replyTo: konfig.adresse,
    subject: betreff,
    text,
    messageId,
    ...(inReplyTo ? { inReplyTo, references: referenzen } : {}),
    date: gesendetAm,
  }).compile().build();

  try {
    const transport = nodemailer.createTransport(smtpOptionen(konfig, env));
    await transport.sendMail({ envelope: { from: konfig.adresse, to: [an] }, raw: quelltext });
  } catch (err) {
    console.error(`Mail-Versand (${a.postfach}) gescheitert: ${err.code || err.responseCode || 'ohne Code'}`);
    throw new VersandFehler(502, VERSAND_GESCHEITERT_MELDUNG);
  }

  // Gespeichert wird, was hinausging -- Text samt Fusszeile.
  const client = await db.getClient();
  let id;
  try {
    await client.query('BEGIN');
    const { rows: [neu] } = await client.query(
      `INSERT INTO mail_nachrichten
         (postfach, richtung, anfrage_id, organization_id, message_id, in_reply_to, referenzen,
          von_adresse, von_name, an_adressen, betreff, text, anhaenge, gesendet_am, gelesen_am, verfasst_von)
       VALUES ($1, 'aus', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, $12, $12, $13)
       RETURNING id`,
      [a.postfach, zuordnung.anfrageId, zuordnung.organizationId, messageId, inReplyTo, referenzen,
        konfig.adresse, name, [an], betreff, text, gesendetAm, a.verfasstVon ?? null]);
    id = neu.id;
    if (zuordnung.anfrageId !== null) {
      await client.query(
        `UPDATE gemeinde_anfragen SET
           status = CASE WHEN status = 'neu' THEN 'in_arbeit' ELSE status END,
           status_seit = CASE WHEN status = 'neu' THEN NOW() ELSE status_seit END,
           bearbeitet_von = COALESCE($2, bearbeitet_von),
           updated_at = NOW()
         WHERE id = $1`, [zuordnung.anfrageId, a.verfasstVon ?? null]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Mail-Versand (${a.postfach}): gesendet, aber nicht gespeichert (${err.code || ''} ${err.message})`);
    throw new VersandFehler(500, 'Die Mail wurde gesendet, aber nicht gespeichert.');
  } finally {
    client.release();
  }

  const ablegen = async () => {
    let imap = null;
    try {
      imap = imapFabrik(imapOptionen(konfig, env));
      await imap.connect();
      await inGesendetAblegen(imap, quelltext, gesendetAm);
    } catch (err) {
      console.error(`Mail-Versand (${a.postfach}): nicht im Gesendet-Ordner abgelegt (${fehlerText(err)})`);
    } finally {
      if (imap) await abmelden(imap);
    }
  };
  if (danach) danach(ablegen);
  else await ablegen();

  const { rows: [gespeichert] } = await db.query(
    `SELECT ${NACHRICHT_SPALTEN} FROM ${NACHRICHT_FROM} WHERE m.id = $1`, [id]);
  return gespeichert;
}

module.exports = {
  VersandFehler,
  VERSAND_AUS_MELDUNG,
  VERSAND_GESCHEITERT_MELDUNG,
  GESENDET_NAMEN,
  BETREFF_MAX,
  versandAufDiesemServer,
  antwortBetreff,
  betreffMitKennung,
  textMitFusszeile,
  bezugKopf,
  inGesendetAblegen,
  antwortSenden,
};
