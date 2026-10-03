// Mails aus den Postfaechern "moin" und "support" abholen, zuordnen und
// speichern (docs/planung/support-mail.md, Abschnitt "Abholen"; Simon,
// 03.10.2026).
//
// NUR LESEN: INBOX wird schreibgeschuetzt geoeffnet (EXAMINE statt SELECT,
// imapflow mailboxOpen(..., { readOnly: true })), der Inhalt per
// BODY.PEEK[] geholt -- nichts wird geloescht, verschoben oder als gelesen
// markiert. Das Mailprogramm bleibt, wie es ist.
//
// AB EINRICHTUNG: Der erste Lauf (und jeder Wechsel der UIDVALIDITY) setzt
// nur den Stand auf die letzte vorhandene UID; der Altbestand bleibt im
// Postfach. Danach kommt jede neue Mail dazu, hoechstens MAX_JE_LAUF je Lauf
// (der Rest im naechsten).
//
// NUR AUF DEM CRON-LEADER: Den Takt startet BackgroundService.startAllServices
// (services/backgroundService.js), und das ruft nur die Replica, die die
// Leader-Wahl gewonnen hat (server.js, utils/cronLeader.js). backend und
// backend2 holen nie gleichzeitig ab. Ein Server mit
// RUN_BACKGROUND_JOBS=false (backend-test an der Produktions-Datenbank)
// holt nie ab -- auch dann nicht, wenn jemand alleAbholen() direkt ruft.
//
// PROTOKOLL OHNE INHALTE UND OHNE ADRESSEN (utils/protokoll.js): nur
// Postfach, Anzahlen, UID und Fehlercodes. Fehler (Anmeldung, Netz) stehen
// ausserdem in mail_abholstand.fehler -- die Support-Ansicht zeigt sie
// (GET /api/support/mail/status). Derselbe Fehler wird nur beim ersten Mal
// protokolliert, nicht alle zwei Minuten.
//
// TESTBAR OHNE NETZ: Der IMAP-Client kommt aus einer Fabrik (imapFabrik),
// die Tests durch eine Attrappe ersetzen (tests/services/mailAbholung.test.js).

const { ImapFlow } = require('imapflow');
const { allePostfaecher, imapOptionen } = require('../utils/mailPostfaecher');
const { mailZerlegen } = require('../utils/mailNachrichten');
const { mailZuordnen } = require('../utils/mailZuordnung');
const { adresseFuersProtokoll } = require('../utils/protokoll');

const MAX_JE_LAUF = 200;
const FEHLER_MAX = 300;

/** Netzfehler, die ohne Meldungstext genug sagen. */
const NETZ_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EHOSTUNREACH',
  'ENETUNREACH', 'EPIPE', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN',
]);

/**
 * Fehler als kurzer Text ohne Adressen (fuer mail_abholstand.fehler und das
 * Protokoll). Adressen in der Meldung des Servers werden auf die Domain
 * gekuerzt.
 */
function fehlerText(err) {
  if (!err) return 'Unbekannter Fehler';
  if (err.authenticationFailed) return 'Anmeldung gescheitert (Benutzer oder Passwort falsch)';
  if (err.code && NETZ_CODES.has(err.code)) return `Verbindung gescheitert (${err.code})`;
  const meldung = String(err.responseText || err.message || '')
    .replace(/[^\s@<>"'(),;:]+@([^\s@<>"'(),;:]+)/g, (_t, domain) => adresseFuersProtokoll(`x@${domain}`))
    .replace(/\s+/g, ' ')
    .trim();
  const text = [err.code || err.name || 'Fehler', meldung].filter(Boolean).join(': ');
  return text.length > FEHLER_MAX ? text.slice(0, FEHLER_MAX) : text;
}

/** Der echte IMAP-Client. 'error'-Ereignisse werden abgefangen (sonst beendeten sie den Prozess). */
function standardImapFabrik(optionen) {
  const client = new ImapFlow(optionen);
  client.on('error', (err) => {
    console.error('Mail-Abholung: IMAP-Verbindung meldet %s', fehlerText(err));
  });
  return client;
}

/** Verbindung beenden, ohne dass ein Fehler dabei stoert. */
async function abmelden(client) {
  try {
    await client.logout();
  } catch {
    try { client.close?.(); } catch { /* schon zu */ }
  }
}

/** Stand setzen (Erstlauf oder neue UIDVALIDITY). */
async function standSetzen(db, postfach, uidValidity, letzteUid) {
  await db.query(
    `INSERT INTO mail_abholstand (postfach, uidvalidity, letzte_uid, abgeholt_am, fehler, fehler_am)
     VALUES ($1, $2, $3, NOW(), NULL, NULL)
     ON CONFLICT (postfach) DO UPDATE SET
       uidvalidity = EXCLUDED.uidvalidity, letzte_uid = EXCLUDED.letzte_uid,
       abgeholt_am = NOW(), fehler = NULL, fehler_am = NULL`,
    [postfach, uidValidity, letzteUid]);
}

/** Eine Mail speichern und den Stand fortschreiben -- in einer Transaktion. */
async function mailSpeichern(db, { postfach, uid, mail, zuordnung }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO mail_nachrichten
         (postfach, richtung, anfrage_id, organization_id, message_id, in_reply_to, referenzen,
          von_adresse, von_name, an_adressen, betreff, text, anhaenge, gesendet_am, imap_uid)
       VALUES ($1, 'ein', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
       ON CONFLICT (message_id) DO NOTHING
       RETURNING id`,
      [postfach, zuordnung.anfrage_id, zuordnung.organization_id, mail.messageId, mail.inReplyTo,
        mail.referenzen, mail.vonAdresse, mail.vonName, mail.anAdressen, mail.betreff, mail.text,
        JSON.stringify(mail.anhaenge), mail.gesendetAm, uid]);
    const gespeichert = rows.length > 0;
    // Eine eingehende Mail zu einer Anfrage ist eine Bewegung: Die
    // 365-Tage-Frist unbewegter Anfragen beginnt neu
    // (BackgroundService.cleanupUnbewegteAnfragen).
    if (gespeichert && zuordnung.anfrage_id !== null) {
      await client.query('UPDATE gemeinde_anfragen SET updated_at = NOW() WHERE id = $1', [zuordnung.anfrage_id]);
    }
    await client.query('UPDATE mail_abholstand SET letzte_uid = GREATEST(letzte_uid, $2) WHERE postfach = $1', [postfach, uid]);
    await client.query('COMMIT');
    return gespeichert;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Nur den Stand fortschreiben (uebersprungene Mail). */
async function uidFortschreiben(db, postfach, uid) {
  await db.query('UPDATE mail_abholstand SET letzte_uid = GREATEST(letzte_uid, $2) WHERE postfach = $1', [postfach, uid]);
}

/**
 * Holt die neuen Mails eines Postfachs ab.
 *
 * @param {object} db
 * @param {ReturnType<import('../utils/mailPostfaecher').postfachKonfig>} konfig
 * @param {object} [opt]
 * @param {(optionen: object) => object} [opt.imapFabrik]
 * @param {object} [opt.env]
 * @param {number} [opt.maxJeLauf]
 * @returns {Promise<{postfach: string, erstlauf: boolean, neu: number, doppelt: number,
 *   eigene: number, unlesbar: number, fehler: string|null}>}
 */
async function postfachAbholen(db, konfig, { imapFabrik = standardImapFabrik, env = process.env, maxJeLauf = MAX_JE_LAUF } = {}) {
  const { postfach } = konfig;
  const ergebnis = { postfach, erstlauf: false, neu: 0, doppelt: 0, eigene: 0, unlesbar: 0, fehler: null };
  const { rows: [vorher] } = await db.query(
    'SELECT uidvalidity, letzte_uid, fehler FROM mail_abholstand WHERE postfach = $1', [postfach]);

  let client = null;
  try {
    client = imapFabrik(imapOptionen(konfig, env));
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX', { readOnly: true });
    const uidValidity = String(mailbox.uidValidity);
    const uidNext = Number(mailbox.uidNext);
    const hoechsteBekannte = Number.isInteger(uidNext) && uidNext > 0 ? uidNext - 1 : null;

    // Erster Lauf oder neue UIDVALIDITY: nur den Stand setzen, nichts
    // uebernehmen. Ohne UIDNEXT vom Server gilt die hoechste vorhandene UID.
    if (!vorher || vorher.uidvalidity === null || vorher.letzte_uid === null
        || String(vorher.uidvalidity) !== uidValidity) {
      let stand = hoechsteBekannte;
      if (stand === null) {
        stand = 0;
        if (mailbox.exists > 0) {
          for await (const msg of client.fetch('*', { uid: true }, { uid: false })) stand = Math.max(stand, msg.uid);
        }
      }
      await standSetzen(db, postfach, uidValidity, stand);
      ergebnis.erstlauf = true;
      if (vorher && vorher.uidvalidity !== null && String(vorher.uidvalidity) !== uidValidity) {
        console.warn(`Mail-Abholung (${postfach}): UIDVALIDITY hat gewechselt -- Stand neu gesetzt, nichts uebernommen`);
      }
      return ergebnis;
    }

    const letzte = Number(vorher.letzte_uid);
    const von = letzte + 1;
    // Mit UIDNEXT ein festes Fenster (hoechstens maxJeLauf UIDs); die Luecken
    // darin zaehlen mit, der Stand rueckt danach ans Ende des Fensters.
    // Ohne UIDNEXT bis zum Ende ("*").
    let bis = null;
    if (hoechsteBekannte !== null) {
      if (hoechsteBekannte < von) {
        await db.query(
          'UPDATE mail_abholstand SET abgeholt_am = NOW(), fehler = NULL, fehler_am = NULL WHERE postfach = $1', [postfach]);
        return ergebnis;
      }
      bis = Math.min(hoechsteBekannte, letzte + maxJeLauf);
    }
    const bereich = `${von}:${bis === null ? '*' : bis}`;

    for await (const msg of client.fetch(bereich, { uid: true, source: true, internalDate: true }, { uid: true })) {
      // "*" trifft die hoechste vorhandene UID, auch wenn sie alt ist.
      if (!Number.isInteger(msg.uid) || msg.uid <= letzte || (bis !== null && msg.uid > bis)) continue;
      const uid = msg.uid;
      let mail;
      try {
        mail = await mailZerlegen(msg.source, {
          ersatzId: `<kq-ersatz-${postfach}-${uidValidity}-${uid}@konfi-quest.de>`,
          eingang: msg.internalDate || null,
        });
      } catch (err) {
        ergebnis.unlesbar += 1;
        console.error(`Mail-Abholung (${postfach}): Mail UID ${uid} nicht lesbar, uebersprungen (${fehlerText(err)})`);
        await uidFortschreiben(db, postfach, uid);
        continue;
      }
      // Eigene Mails (Absender = Adresse des Postfachs) nicht speichern.
      if (mail.vonAdresse && mail.vonAdresse === konfig.adresse) {
        ergebnis.eigene += 1;
        await uidFortschreiben(db, postfach, uid);
        continue;
      }
      const zuordnung = await mailZuordnen(db, {
        postfach,
        inReplyTo: mail.inReplyTo,
        referenzen: mail.referenzen,
        betreff: mail.betreff,
        vonAdresse: mail.vonAdresse,
      });
      if (await mailSpeichern(db, { postfach, uid, mail, zuordnung })) ergebnis.neu += 1;
      else ergebnis.doppelt += 1;
    }

    await db.query(
      `UPDATE mail_abholstand
          SET letzte_uid = GREATEST(letzte_uid, COALESCE($2::bigint, letzte_uid)),
              abgeholt_am = NOW(), fehler = NULL, fehler_am = NULL
        WHERE postfach = $1`, [postfach, bis]);
    if (ergebnis.neu + ergebnis.doppelt + ergebnis.eigene + ergebnis.unlesbar > 0) {
      console.log(`Mail-Abholung (${postfach}): ${ergebnis.neu} neu, ${ergebnis.doppelt} schon vorhanden, `
        + `${ergebnis.eigene} eigene, ${ergebnis.unlesbar} nicht lesbar`);
    }
    return ergebnis;
  } catch (err) {
    ergebnis.fehler = fehlerText(err);
    if (!vorher || vorher.fehler !== ergebnis.fehler) {
      console.error(`Mail-Abholung (${postfach}) gescheitert: ${ergebnis.fehler}`);
    }
    try {
      await db.query(
        `INSERT INTO mail_abholstand (postfach, fehler, fehler_am) VALUES ($1, $2, NOW())
         ON CONFLICT (postfach) DO UPDATE SET fehler = EXCLUDED.fehler, fehler_am = NOW()`,
        [postfach, ergebnis.fehler]);
    } catch (dbErr) {
      console.error(`Mail-Abholung (${postfach}): Fehler nicht gespeichert (${dbErr.code || ''} ${dbErr.message})`);
    }
    return ergebnis;
  } finally {
    if (client) await abmelden(client);
  }
}

/**
 * Holt alle eingerichteten Postfaecher nacheinander ab. Auf einem Server mit
 * RUN_BACKGROUND_JOBS=false nie (Rueckgabe leer).
 */
async function alleAbholen(db, { env = process.env, ...opt } = {}) {
  if (env.RUN_BACKGROUND_JOBS === 'false') return [];
  const ergebnisse = [];
  for (const konfig of allePostfaecher(env)) {
    if (!konfig.eingerichtet) continue;
    ergebnisse.push(await postfachAbholen(db, konfig, { env, ...opt }));
  }
  return ergebnisse;
}

module.exports = {
  MAX_JE_LAUF,
  fehlerText,
  standardImapFabrik,
  abmelden,
  postfachAbholen,
  alleAbholen,
};
