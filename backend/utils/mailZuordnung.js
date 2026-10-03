// Wohin gehoert eine eingehende Mail? -- EINE Stelle (docs/planung/
// support-mail.md, Abschnitt "Zuordnen eingehender Mails"; Simon, 03.10.2026).
//
// In dieser Reihenfolge; die erste Regel, die greift, gilt:
//
//   1. In-Reply-To oder References nennt die Message-ID einer gespeicherten
//      Mail -> dieselbe Zuordnung wie diese Mail. Das gilt auch, wenn jene
//      Mail im Posteingang liegt (keine Zuordnung): Der Faden bleibt
//      beisammen, und "Zuordnen" nimmt ihn spaeter als Ganzes mit. Nennt die
//      Mail mehrere gespeicherte, zaehlt In-Reply-To vor References und dort
//      die juengste (die letzte in der Liste).
//   2. Betreff enthaelt "[Anfrage 12]" und die Anfrage gibt es -> Anfrage 12;
//      sonst "[Gemeinde 7]" und die Gemeinde gibt es -> Gemeinde 7.
//   3. Postfach "moin": Absender ist die E-Mail-Adresse einer Anfrage, die
//      nicht abgelehnt ist -> die juengste solche Anfrage. So landen auch
//      Antworten auf die Bestaetigungsmail des Formulars bei ihrer Anfrage
//      (die Systemmails gehen von moin@ hinaus).
//   4. Postfach "support": Absender ist die E-Mail-Adresse GENAU EINES
//      aktiven Kontos (nicht Konfi) mit Gemeinde -> diese Gemeinde. Beide
//      Quellen der Zugehoerigkeit (users.organization_id und
//      user_organizations, utils/orgMitglieder.js), die Rolle je Gemeinde.
//      Hat das eine Konto mehrere Gemeinden, ist die Zuordnung nicht
//      eindeutig -> Regel 5.
//   5. Sonst: Posteingang (nicht zugeordnet).
//
// Adressen werden ohne Unterschied zwischen Gross- und Kleinschreibung und
// ohne Randleerzeichen verglichen. Die Funktion liest nur, sie schreibt
// nichts -- Speichern und die "Bewegung" der Anfrage (updated_at) erledigt
// der Aufrufer (services/mailAbholung.js).

const KENNUNG_ANFRAGE = /\[\s*Anfrage\s+(\d{1,15})\s*\]/i;
const KENNUNG_GEMEINDE = /\[\s*Gemeinde\s+(\d{1,15})\s*\]/i;

const KEINE = Object.freeze({ anfrage_id: null, organization_id: null });

/** Ergebnis einer Regel. */
const ergebnis = (regel, anfrageId, organizationId) => ({
  anfrage_id: anfrageId === null || anfrageId === undefined ? null : Number(anfrageId),
  organization_id: organizationId === null || organizationId === undefined ? null : Number(organizationId),
  regel,
});

/** Adresse fuer den Vergleich: klein, ohne Rand; leer = null. */
function adresseNormal(adresse) {
  if (typeof adresse !== 'string') return null;
  const a = adresse.trim().toLowerCase();
  return a === '' ? null : a;
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
    'SELECT message_id, anfrage_id, organization_id FROM mail_nachrichten WHERE message_id = ANY($1::text[])',
    [kandidaten]);
  if (rows.length === 0) return null;
  const jeId = new Map(rows.map((r) => [r.message_id, r]));
  const treffer = kandidaten.map((k) => jeId.get(k)).find(Boolean);
  return ergebnis(1, treffer.anfrage_id, treffer.organization_id);
}

/** Regel 2: Kennung im Betreff. */
async function regelKennung(db, betreff) {
  if (typeof betreff !== 'string' || betreff === '') return null;
  const anfrage = betreff.match(KENNUNG_ANFRAGE);
  if (anfrage) {
    const { rows } = await db.query('SELECT id FROM gemeinde_anfragen WHERE id = $1', [Number(anfrage[1])]);
    if (rows.length > 0) return ergebnis(2, rows[0].id, null);
  }
  const gemeinde = betreff.match(KENNUNG_GEMEINDE);
  if (gemeinde) {
    const { rows } = await db.query('SELECT id FROM organizations WHERE id = $1', [Number(gemeinde[1])]);
    if (rows.length > 0) return ergebnis(2, null, rows[0].id);
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
  return rows.length > 0 ? ergebnis(3, rows[0].id, null) : null;
}

/** Regel 4 (support): Adresse genau eines aktiven Kontos (nicht Konfi) mit Gemeinde. */
async function regelKontoAdresse(db, adresse) {
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
     ) k`, [adresse]);
  const konten = new Set(rows.map((r) => Number(r.user_id)));
  const gemeinden = new Set(rows.map((r) => Number(r.organization_id)));
  if (konten.size === 1 && gemeinden.size === 1) {
    return ergebnis(4, null, [...gemeinden][0]);
  }
  return null;
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
 * @returns {Promise<{anfrage_id: number|null, organization_id: number|null, regel: number}>}
 *   regel 1 bis 4, oder 5 = Posteingang (beide null)
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
  return { ...KEINE, regel: 5 };
}

module.exports = { mailZuordnen, adresseNormal, KENNUNG_ANFRAGE, KENNUNG_GEMEINDE };
