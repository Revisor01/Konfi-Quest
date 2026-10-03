// Wohin gehoert eine eingehende Mail? -- EINE Stelle (docs/planung/
// support-vorgaenge.md, Entscheidung 2; davor docs/planung/support-mail.md;
// Simon, 03.10.2026). Eine Mail gehoert zu einem VORGANG oder liegt im
// Posteingang.
//
// In dieser Reihenfolge; die erste Regel, die greift, gilt:
//
//   1. In-Reply-To oder References nennt die Message-ID einer gespeicherten
//      Mail -> derselbe Vorgang wie diese Mail. Das gilt auch, wenn jene
//      Mail im Posteingang liegt (kein Vorgang): Der Faden bleibt beisammen,
//      und "Einsortieren" nimmt ihn spaeter als Ganzes mit. Nennt die Mail
//      mehrere gespeicherte, zaehlt In-Reply-To vor References und dort die
//      juengste (die letzte in der Liste).
//   2. Betreff enthaelt "[Vorgang 12]" und den Vorgang gibt es -> Vorgang 12.
//      Sonst die alten Kennungen: "[Anfrage 12]" und die Anfrage gibt es ->
//      der Vorgang der Anfrage; sonst "[Gemeinde 7]" und die Gemeinde gibt es
//      -> der juengste offene Vorgang der Gemeinde, SONST POSTEINGANG (die
//      Regeln danach gelten dann nicht mehr).
//   3. Postfach "moin": Absender ist die E-Mail-Adresse einer Anfrage, die
//      nicht abgelehnt ist -> der Vorgang der juengsten solchen Anfrage. So
//      landen auch Antworten auf die Bestaetigungsmail des Formulars bei
//      ihrer Anfrage (die Systemmails gehen von moin@ hinaus).
//   4. Postfach "support": Absender ist die E-Mail-Adresse GENAU EINES
//      aktiven Kontos (nicht Konfi) mit Gemeinde -> NEUER VORGANG dieser
//      Gemeinde (neuer_vorgang: true; ihn legt der Aufrufer zusammen mit der
//      Mail an). Beide Quellen der Zugehoerigkeit (users.organization_id und
//      user_organizations, utils/orgMitglieder.js), die Rolle je Gemeinde.
//      Hat das eine Konto mehrere Gemeinden, ist die Zuordnung nicht
//      eindeutig -> Regel 5.
//   5. Sonst: Posteingang (kein Vorgang).
//
// Ergebnis { vorgang_id, anfrage_id, organization_id, regel, neuer_vorgang }:
// anfrage_id und organization_id folgen dem Vorgang, weil die alten Routen
// sie an der Mail lesen (Vorgang einer Anfrage: anfrage_id; sonst die
// Gemeinde des Vorgangs; nie beides). Regel 5 = Posteingang, alles null.
//
// Adressen werden ohne Unterschied zwischen Gross- und Kleinschreibung und
// ohne Randleerzeichen verglichen. Die Funktion legt hoechstens den Vorgang
// einer Anfrage an, falls er fehlt (utils/supportVorgaenge.js,
// vorgangFuerAnfrage; idempotent); Speichern, den neuen Vorgang der Regel 4
// und die "Bewegung" erledigt der Aufrufer (services/mailAbholung.js).

const {
  vorgangFuerAnfrage, offenerVorgangDerGemeinde, vorgangFuerGemeinde, mailSpalten,
} = require('./supportVorgaenge');

const KENNUNG_VORGANG = /\[\s*Vorgang\s+(\d{1,15})\s*\]/i;
const KENNUNG_ANFRAGE = /\[\s*Anfrage\s+(\d{1,15})\s*\]/i;
const KENNUNG_GEMEINDE = /\[\s*Gemeinde\s+(\d{1,15})\s*\]/i;

/** Posteingang: kein Vorgang. */
const posteingang = () => ({ vorgang_id: null, anfrage_id: null, organization_id: null, regel: 5, neuer_vorgang: false });

/** Ergebnis einer Regel fuer einen Vorgang (Zeile mit id, anfrage_id, organization_id). */
const imVorgang = (regel, vorgang) => ({
  vorgang_id: Number(vorgang.id), ...mailSpalten(vorgang), regel, neuer_vorgang: false,
});

/** Adresse fuer den Vergleich: klein, ohne Rand; leer = null. */
function adresseNormal(adresse) {
  if (typeof adresse !== 'string') return null;
  const a = adresse.trim().toLowerCase();
  return a === '' ? null : a;
}

/** Zeile eines Vorgangs mit den Spalten, die die Mail erbt. */
async function vorgangLesen(db, id) {
  const { rows } = await db.query('SELECT id, anfrage_id, organization_id FROM support_vorgaenge WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Regel 1: Verweis auf eine gespeicherte Mail. */
async function regelFaden(db, inReplyTo, referenzen) {
  // Prioritaet: In-Reply-To, dann References von hinten (juengste zuerst).
  const kandidaten = [];
  if (inReplyTo) kandidaten.push(inReplyTo);
  for (const r of [...(referenzen || [])].reverse()) {
    if (r && !kandidaten.includes(r)) kandidaten.push(r);
  }
  if (kandidaten.length === 0) return null;
  const { rows } = await db.query(
    'SELECT message_id, vorgang_id, anfrage_id, organization_id FROM mail_nachrichten WHERE message_id = ANY($1::text[])',
    [kandidaten]);
  if (rows.length === 0) return null;
  const jeId = new Map(rows.map((r) => [r.message_id, r]));
  const treffer = kandidaten.map((k) => jeId.get(k)).find(Boolean);

  if (treffer.vorgang_id !== null) {
    const vorgang = await vorgangLesen(db, treffer.vorgang_id);
    if (vorgang) return imVorgang(1, vorgang);
  }
  // Eine Mail mit Anfrage oder Gemeinde, aber ohne Vorgang (ein aelterer
  // Server-Stand legte sie waehrend eines Deploys noch so ab): Der Vorgang
  // wird nachgeholt.
  if (treffer.anfrage_id !== null) {
    const vorgangId = await vorgangFuerAnfrage(db, treffer.anfrage_id);
    if (vorgangId !== null) return imVorgang(1, await vorgangLesen(db, vorgangId));
  }
  if (treffer.organization_id !== null) {
    const { id } = await vorgangFuerGemeinde(db, treffer.organization_id, { quelle: 'mail' });
    return imVorgang(1, await vorgangLesen(db, id));
  }
  // Der Faden liegt im Posteingang und bleibt dort.
  return { ...posteingang(), regel: 1 };
}

/** Regel 2: Kennung im Betreff. */
async function regelKennung(db, betreff) {
  if (typeof betreff !== 'string' || betreff === '') return null;
  const vorgang = betreff.match(KENNUNG_VORGANG);
  if (vorgang) {
    const v = await vorgangLesen(db, Number(vorgang[1]));
    if (v) return imVorgang(2, v);
  }
  const anfrage = betreff.match(KENNUNG_ANFRAGE);
  if (anfrage) {
    const vorgangId = await vorgangFuerAnfrage(db, Number(anfrage[1]));
    if (vorgangId !== null) return imVorgang(2, await vorgangLesen(db, vorgangId));
  }
  const gemeinde = betreff.match(KENNUNG_GEMEINDE);
  if (gemeinde) {
    const { rows } = await db.query('SELECT id FROM organizations WHERE id = $1', [Number(gemeinde[1])]);
    if (rows.length > 0) {
      // Der juengste offene Vorgang der Gemeinde, sonst Posteingang.
      const offen = await offenerVorgangDerGemeinde(db, rows[0].id);
      return offen !== null ? imVorgang(2, await vorgangLesen(db, offen)) : posteingang();
    }
  }
  return null;
}

/** Regel 3 (moin): Adresse einer nicht abgelehnten Anfrage, die juengste. */
async function regelAnfrageAdresse(db, adresse) {
  const { rows } = await db.query(
    `SELECT id FROM gemeinde_anfragen
      WHERE lower(btrim(email)) = $1 AND status <> 'abgelehnt'
      ORDER BY created_at DESC, id DESC
      LIMIT 1`, [adresse]);
  if (rows.length === 0) return null;
  const vorgangId = await vorgangFuerAnfrage(db, rows[0].id);
  return vorgangId === null ? null : imVorgang(3, await vorgangLesen(db, vorgangId));
}

/**
 * Die Gemeinde, zu der eine Adresse gehoert: das EINE aktive Konto (nicht
 * Konfi) mit Gemeinde -- sonst null. Beide Quellen der Zugehoerigkeit, die
 * Rolle je Gemeinde; ein Konto in mehreren Gemeinden oder mehrere Konten mit
 * derselben Adresse sind nicht eindeutig. Gebraucht fuer Regel 4 und fuer
 * das Formular auf der Homepage (routes/anliegen.js).
 *
 * @returns {Promise<number|null>} Kennung der Gemeinde
 */
async function gemeindeDesKontos(db, adresse) {
  const a = adresseNormal(adresse);
  if (!a) return null;
  const { rows } = await db.query(
    `SELECT DISTINCT k.user_id, k.organization_id FROM (
       SELECT u.id AS user_id, u.organization_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE lower(btrim(u.email)) = $1
          AND u.organization_id IS NOT NULL
          AND r.name <> 'konfi'
          AND u.is_active = true AND u.deleted_at IS NULL
       UNION
       SELECT u.id AS user_id, uo.organization_id
         FROM user_organizations uo
         JOIN users u ON u.id = uo.user_id
         JOIN roles r ON r.id = uo.role_id
        WHERE lower(btrim(u.email)) = $1
          AND r.name <> 'konfi'
          AND u.is_active = true AND u.deleted_at IS NULL
     ) k`, [a]);
  const konten = new Set(rows.map((r) => Number(r.user_id)));
  const gemeinden = new Set(rows.map((r) => Number(r.organization_id)));
  return konten.size === 1 && gemeinden.size === 1 ? [...gemeinden][0] : null;
}

/** Regel 4 (support): Adresse genau eines aktiven Kontos (nicht Konfi) mit Gemeinde -> neuer Vorgang. */
async function regelKontoAdresse(db, adresse) {
  const gemeinde = await gemeindeDesKontos(db, adresse);
  return gemeinde === null
    ? null
    : { vorgang_id: null, anfrage_id: null, organization_id: gemeinde, regel: 4, neuer_vorgang: true };
}

/**
 * Ordnet eine eingehende Mail zu.
 *
 * @param {{query: Function}} db
 * @param {object} mail
 * @param {'moin'|'support'} mail.postfach
 * @param {string|null} [mail.inReplyTo]   Message-ID in spitzen Klammern
 * @param {string[]} [mail.referenzen]     References, aelteste zuerst
 * @param {string|null} [mail.betreff]
 * @param {string|null} [mail.vonAdresse]
 * @returns {Promise<{vorgang_id: number|null, anfrage_id: number|null, organization_id: number|null,
 *   regel: number, neuer_vorgang: boolean}>}
 *   regel 1 bis 4, oder 5 = Posteingang (alles null); neuer_vorgang: der
 *   Aufrufer legt zusammen mit der Mail einen Vorgang fuer organization_id an
 */
async function mailZuordnen(db, { postfach, inReplyTo = null, referenzen = [], betreff = null, vonAdresse = null }) {
  const faden = await regelFaden(db, inReplyTo, referenzen);
  if (faden) return faden;

  const kennung = await regelKennung(db, betreff);
  if (kennung) return kennung;

  const adresse = adresseNormal(vonAdresse);
  if (adresse && postfach === 'moin') {
    const anfrage = await regelAnfrageAdresse(db, adresse);
    if (anfrage) return anfrage;
  }
  if (adresse && postfach === 'support') {
    const konto = await regelKontoAdresse(db, adresse);
    if (konto) return konto;
  }
  return posteingang();
}

module.exports = {
  mailZuordnen, adresseNormal, gemeindeDesKontos, KENNUNG_VORGANG, KENNUNG_ANFRAGE, KENNUNG_GEMEINDE,
};
