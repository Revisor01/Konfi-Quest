// Support-Vorgaenge (Migration 195; Simon, 03.10.2026;
// docs/planung/support-vorgaenge.md) -- EINE Stelle fuer Auswahlwerte, Anlegen,
// Statuslogik und die Verbindung zu Anfragen und Mails.
//
// DIE REGELN, EINMAL FESTGELEGT:
//
//   ERLEDIGT HEISST ARCHIV. Status 'erledigt' setzt archiviert_am (die DB
//     verlangt es, CHECK support_vorgaenge_erledigt_archiviert). Verlaesst ein
//     Vorgang 'erledigt' (Status von Hand, Wiederherstellen, neue Mail),
//     kommt er aus dem Archiv zurueck. Ein von Hand archivierter Vorgang
//     behaelt seinen Status.
//
//   MAILS: vorgang_id bindet eine Mail an ihren Vorgang. anfrage_id und
//     organization_id an der Mail folgen dem Vorgang, weil die alten Routen sie
//     lesen: Gehoert der Vorgang zu einer Anfrage, steht dort anfrage_id (nie
//     beides, CHECK mail_nachrichten_eine_zuordnung); sonst organization_id
//     der Gemeinde des Vorgangs, sonst beide leer (Vorgang ohne Gemeinde).
//     Eine Mail ohne vorgang_id UND ohne anfrage_id/organization_id liegt im
//     Posteingang.
//
//   ANFRAGE UND VORGANG HALTEN DEN STATUS GEMEINSAM. Anfrage -> Vorgang:
//     neu -> neu, in_arbeit -> in_arbeit (ein Vorgang 'wartet' bleibt),
//     angelegt/abgelehnt -> erledigt (archiviert). Vorgang -> Anfrage:
//     neu -> neu, in_arbeit/wartet -> in_arbeit, erledigt -> abgelehnt --
//     ausser bei einer angelegten Anfrage, die bleibt angelegt. Jede Aenderung
//     am Vorgang einer Anfrage ist eine Bewegung der Anfrage (updated_at):
//     Die 365-Tage-Frist unbewegter Anfragen beginnt neu. Notiz und
//     Gemeinde (angelegt) folgen ebenfalls.
//
//   VORGANG DER ANFRAGE: vorgangFuerAnfrage legt ihn an, wenn er fehlt
//     (idempotent). Das faengt Anfragen ab, die ein aelterer Server-Stand
//     waehrend eines Deploys ohne Vorgang gespeichert hat, und Mails, die er
//     ohne vorgang_id ablegte (verwaisteMailsNachziehen).
//
//   JUENGSTER OFFENER VORGANG EINER GEMEINDE (alte Kennung [Gemeinde N],
//     alte Antwort-Route): nicht archiviert, nicht erledigt, der zuletzt
//     angelegte.

const ARTEN = Object.freeze([
  'neue_gemeinde', 'frage', 'fehler', 'wunsch', 'zugang', 'lizenz', 'datenschutz', 'sonstiges',
]);
const BEREICHE = Object.freeze([
  'konfis', 'termine', 'punkte', 'challenges', 'chat', 'badges', 'material', 'konten', 'einstellungen', 'sonstiges',
]);
// Arten, bei denen der Bereich Pflicht ist (Formular auf der Homepage).
const ARTEN_MIT_BEREICH = Object.freeze(['frage', 'fehler', 'wunsch']);
const DRINGLICHKEITEN = Object.freeze(['normal', 'dringend']);
const STATUS = Object.freeze(['neu', 'in_arbeit', 'wartet', 'erledigt']);
const QUELLEN = Object.freeze(['anfrage', 'formular', 'mail', 'support']);

const BETREFF_MAX = 300;
const BESCHREIBUNG_MAX = 5000;
const NOTIZ_MAX = 5000;

/** Betreff einer Mail als Betreff eines Vorgangs: ohne Re:/AW:, einzeilig, begrenzt. */
function betreffAusMail(betreff) {
  const ohne = String(betreff || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^((re|aw|antw|fwd?|wg)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim();
  return (ohne || '(ohne Betreff)').slice(0, BETREFF_MAX);
}

/** Betreff des Vorgangs einer Anfrage. */
const anfrageBetreff = (gemeinde) => `Anfrage: ${String(gemeinde || '').trim()}`.slice(0, BETREFF_MAX);

// Anfrage-Status -> Vorgang-Status (Uebernahme und Folgen).
const VORGANG_ZU_ANFRAGE = Object.freeze({ neu: 'neu', in_arbeit: 'in_arbeit', wartet: 'in_arbeit', erledigt: 'abgelehnt' });

/** Status des Vorgangs, der zu einem Anfrage-Status gehoert. */
const vorgangStatusZuAnfrage = (anfrageStatus) => (
  anfrageStatus === 'neu' || anfrageStatus === 'in_arbeit' ? anfrageStatus : 'erledigt');

/**
 * Mail-Spalten, die dem Vorgang folgen (die alten Routen lesen sie).
 * @param {{anfrage_id: *, organization_id: *}} vorgang
 */
function mailSpalten(vorgang) {
  const anfrageId = vorgang.anfrage_id === null || vorgang.anfrage_id === undefined ? null : Number(vorgang.anfrage_id);
  const organizationId = vorgang.organization_id === null || vorgang.organization_id === undefined
    ? null : Number(vorgang.organization_id);
  return { anfrage_id: anfrageId, organization_id: anfrageId !== null ? null : organizationId };
}

/**
 * Legt einen Vorgang an. status 'erledigt' wird zugleich archiviert.
 * @param {{query: Function}} db  Pool oder Client
 * @returns {Promise<{id: number}>}
 */
async function vorgangAnlegen(db, f) {
  const status = f.status || 'neu';
  const { rows: [neu] } = await db.query(
    `INSERT INTO support_vorgaenge
       (art, bereich, dringlichkeit, status, betreff, beschreibung, quelle, organization_id, anfrage_id, erstellt_von,
        kontakt_name, kontakt_email, kontakt_funktion, gemeinde_angabe, einwilligung_am, notiz, archiviert_am)
     VALUES ($1, $2, $3, $4::text, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             CASE WHEN $4::text = 'erledigt' THEN NOW() END)
     RETURNING id`,
    [f.art, f.bereich ?? null, f.dringlichkeit || 'normal', status, String(f.betreff).slice(0, BETREFF_MAX),
      f.beschreibung ?? null, f.quelle, f.organizationId ?? null, f.anfrageId ?? null, f.erstelltVon ?? null,
      f.kontaktName ?? null, f.kontaktEmail ?? null, f.kontaktFunktion ?? null, f.gemeindeAngabe ?? null,
      f.einwilligungAm ?? null, f.notiz ?? null]);
  return { id: Number(neu.id) };
}

/**
 * Der Vorgang einer Anfrage -- angelegt, wenn er fehlt. Gleichzeitig ruft
 * nichts zweimal etwas an (UNIQUE auf anfrage_id, ON CONFLICT). Beim Anlegen
 * folgen Status, Archiv, Notiz und Gemeinde der Anfrage (wie die Uebernahme
 * in Migration 195), und Mails dieser Anfrage ohne vorgang_id werden gebunden.
 *
 * @returns {Promise<number|null>} die Kennung, null ohne Anfrage
 */
async function vorgangFuerAnfrage(db, anfrageId) {
  const { rows: [vorhanden] } = await db.query('SELECT id FROM support_vorgaenge WHERE anfrage_id = $1', [anfrageId]);
  if (vorhanden) return Number(vorhanden.id);
  const { rows: [a] } = await db.query(
    `SELECT id, gemeinde, status, status_seit, nachricht, notiz, organization_id, created_at, updated_at
       FROM gemeinde_anfragen WHERE id = $1`, [anfrageId]);
  if (!a) return null;
  const status = vorgangStatusZuAnfrage(a.status);
  const { rows: [neu] } = await db.query(
    `INSERT INTO support_vorgaenge
       (art, status, status_seit, betreff, beschreibung, quelle, organization_id, anfrage_id, notiz,
        archiviert_am, created_at, updated_at)
     VALUES ('neue_gemeinde', $2::text, $3::timestamptz, $4, $5, 'anfrage', $6, $1, $7,
             CASE WHEN $2::text = 'erledigt' THEN $3::timestamptz END, $8, $9)
     ON CONFLICT (anfrage_id) DO NOTHING
     RETURNING id`,
    [a.id, status, a.status_seit, anfrageBetreff(a.gemeinde), a.nachricht, a.organization_id, a.notiz,
      a.created_at, a.updated_at]);
  const id = neu ? Number(neu.id) : null;
  if (id === null) {
    const { rows: [jetzt] } = await db.query('SELECT id FROM support_vorgaenge WHERE anfrage_id = $1', [anfrageId]);
    return jetzt ? Number(jetzt.id) : null;
  }
  await db.query(
    'UPDATE mail_nachrichten SET vorgang_id = $2 WHERE anfrage_id = $1 AND vorgang_id IS NULL', [anfrageId, id]);
  return id;
}

/** Der juengste offene Vorgang einer Gemeinde (Kennung) oder null. */
async function offenerVorgangDerGemeinde(db, organizationId) {
  const { rows: [v] } = await db.query(
    `SELECT id FROM support_vorgaenge
      WHERE organization_id = $1 AND archiviert_am IS NULL AND status <> 'erledigt'
      ORDER BY created_at DESC, id DESC LIMIT 1`, [organizationId]);
  return v ? Number(v.id) : null;
}

/**
 * Der juengste offene Vorgang einer Gemeinde -- sonst ein neuer "Schriftwechsel"
 * (Art sonstiges), damit eine Mail an die Gemeinde immer in einem Vorgang
 * landet.
 *
 * @returns {Promise<{id: number, angelegt: boolean}>}
 */
async function vorgangFuerGemeinde(db, organizationId, { quelle = 'support', erstelltVon = null } = {}) {
  const offen = await offenerVorgangDerGemeinde(db, organizationId);
  if (offen !== null) return { id: offen, angelegt: false };
  const { id } = await vorgangAnlegen(db, {
    art: 'sonstiges', betreff: 'Schriftwechsel', quelle, organizationId, erstelltVon,
  });
  return { id, angelegt: true };
}

/**
 * Bindet Mails an einen Vorgang oder loest sie davon (vorgangId null =
 * Posteingang): vorgang_id, anfrage_id und organization_id folgen dem Vorgang;
 * eine archivierte Mail kommt aus dem Archiv (Archiv gibt es nur im
 * Posteingang). Der Vorgang gilt als bewegt.
 *
 * @returns {Promise<number>} Anzahl geaenderter Mails
 */
async function mailsBinden(client, mailIds, vorgangId) {
  if (mailIds.length === 0) return 0;
  if (vorgangId === null) {
    const { rowCount } = await client.query(
      `UPDATE mail_nachrichten SET vorgang_id = NULL, anfrage_id = NULL, organization_id = NULL, archiviert_am = NULL
        WHERE id = ANY($1::bigint[])`, [mailIds]);
    return rowCount;
  }
  const { rows: [v] } = await client.query(
    'SELECT anfrage_id, organization_id FROM support_vorgaenge WHERE id = $1', [vorgangId]);
  const spalten = mailSpalten(v);
  const { rowCount } = await client.query(
    `UPDATE mail_nachrichten SET vorgang_id = $2, anfrage_id = $3, organization_id = $4, archiviert_am = NULL
      WHERE id = ANY($1::bigint[])`,
    [mailIds, vorgangId, spalten.anfrage_id, spalten.organization_id]);
  await vorgangBewegt(client, vorgangId);
  return rowCount;
}

/**
 * Der Vorgang hat sich bewegt (updated_at); gehoert er zu einer Anfrage, ist
 * das auch eine Bewegung der Anfrage.
 */
async function vorgangBewegt(client, vorgangId, { bearbeitetVon = null } = {}) {
  const { rows: [v] } = await client.query(
    'UPDATE support_vorgaenge SET updated_at = NOW() WHERE id = $1 RETURNING anfrage_id', [vorgangId]);
  if (v && v.anfrage_id !== null) {
    await client.query(
      `UPDATE gemeinde_anfragen SET updated_at = NOW(), bearbeitet_von = COALESCE($2, bearbeitet_von) WHERE id = $1`,
      [v.anfrage_id, bearbeitetVon]);
  }
}

/**
 * Setzt den Status eines Vorgangs. status_seit laeuft neu, wenn er sich
 * aendert; 'erledigt' archiviert, ein Wechsel weg von 'erledigt' holt aus
 * dem Archiv zurueck; die Anfrage dahinter folgt (Regeln im Kopf).
 *
 * @returns {Promise<boolean>} false, wenn es den Vorgang nicht gibt
 */
async function statusSetzen(client, vorgangId, status, { userId = null } = {}) {
  const { rows: [v] } = await client.query(
    'SELECT id, status, anfrage_id FROM support_vorgaenge WHERE id = $1 FOR UPDATE', [vorgangId]);
  if (!v) return false;
  await client.query(
    `UPDATE support_vorgaenge SET
       status = $2::text,
       status_seit = CASE WHEN status <> $2::text THEN NOW() ELSE status_seit END,
       archiviert_am = CASE WHEN $2::text = 'erledigt' THEN COALESCE(archiviert_am, NOW())
                            WHEN status = 'erledigt' THEN NULL
                            ELSE archiviert_am END,
       updated_at = NOW()
     WHERE id = $1`, [vorgangId, status]);
  if (v.anfrage_id !== null) await anfrageFolgtVorgang(client, v.anfrage_id, status, { userId });
  return true;
}

/**
 * Die Anfrage dahinter folgt dem Status ihres Vorgangs (Regeln im Kopf);
 * jede Aenderung ist eine Bewegung der Anfrage.
 */
async function anfrageFolgtVorgang(client, anfrageId, vorgangStatus, { userId = null } = {}) {
  const ziel = VORGANG_ZU_ANFRAGE[vorgangStatus];
  await client.query(
    `UPDATE gemeinde_anfragen SET
       status = CASE WHEN status <> 'angelegt' THEN $2::text ELSE status END,
       status_seit = CASE WHEN status <> 'angelegt' AND status <> $2::text THEN NOW() ELSE status_seit END,
       bearbeitet_von = COALESCE($3, bearbeitet_von),
       updated_at = NOW()
     WHERE id = $1`, [anfrageId, ziel, userId]);
}

/**
 * Der Vorgang einer Anfrage folgt der Anfrage: Status, Notiz und -- bei einer
 * angelegten Anfrage -- die Gemeinde. Legt den Vorgang an, wenn er fehlt.
 * Aufruf nach jeder Aenderung an der Anfrage (PATCH /anfragen/:id, Anlegen
 * der Gemeinde).
 */
async function vorgangFolgtAnfrage(client, anfrageId) {
  const vorgangId = await vorgangFuerAnfrage(client, anfrageId);
  if (vorgangId === null) return null;
  const { rows: [a] } = await client.query(
    'SELECT status, notiz, organization_id FROM gemeinde_anfragen WHERE id = $1', [anfrageId]);
  const { rows: [v] } = await client.query('SELECT status FROM support_vorgaenge WHERE id = $1 FOR UPDATE', [vorgangId]);
  // Ein Vorgang "wartet" ist fuer die Anfrage "in Arbeit" -- das bleibt.
  const soll = a.status === 'in_arbeit' && v.status === 'wartet' ? 'wartet' : vorgangStatusZuAnfrage(a.status);
  await client.query(
    `UPDATE support_vorgaenge SET
       status = $2::text,
       status_seit = CASE WHEN status <> $2::text THEN NOW() ELSE status_seit END,
       archiviert_am = CASE WHEN $2::text = 'erledigt' THEN COALESCE(archiviert_am, NOW())
                            WHEN status = 'erledigt' THEN NULL
                            ELSE archiviert_am END,
       notiz = $3,
       organization_id = COALESCE($4::bigint, organization_id),
       updated_at = NOW()
     WHERE id = $1`, [vorgangId, soll, a.notiz, a.organization_id]);
  return vorgangId;
}

/**
 * Eine neue eingehende Mail im Vorgang: Bewegung; ein archivierter Vorgang
 * kommt zurueck (nicht mehr archiviert, Status "In Arbeit"). Die Anfrage
 * dahinter folgt.
 */
async function mailImVorgang(client, vorgangId) {
  const { rows: [v] } = await client.query(
    `UPDATE support_vorgaenge SET
       status = CASE WHEN archiviert_am IS NOT NULL THEN 'in_arbeit' ELSE status END,
       status_seit = CASE WHEN archiviert_am IS NOT NULL AND status <> 'in_arbeit' THEN NOW() ELSE status_seit END,
       archiviert_am = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING anfrage_id, status`, [vorgangId]);
  if (v && v.anfrage_id !== null) {
    await client.query('UPDATE gemeinde_anfragen SET updated_at = NOW() WHERE id = $1', [v.anfrage_id]);
    await client.query(
      `UPDATE gemeinde_anfragen SET status = 'in_arbeit', status_seit = NOW()
        WHERE id = $1 AND status = 'abgelehnt'`, [v.anfrage_id]);
  }
}

/**
 * Archiviert Vorgaenge (archiviert_am; bleibt ein vorhandener Zeitpunkt
 * stehen) oder stellt sie wieder her. Wiederherstellen setzt einen erledigten
 * Vorgang auf "In Arbeit". Aenderung = Bewegung.
 *
 * @returns {Promise<number[]>} Kennungen der betroffenen Vorgaenge
 */
async function vorgaengeArchivieren(client, vorgangIds, archivieren) {
  if (vorgangIds.length === 0) return [];
  if (archivieren) {
    const { rows } = await client.query(
      `UPDATE support_vorgaenge SET archiviert_am = COALESCE(archiviert_am, NOW()), updated_at = NOW()
        WHERE id = ANY($1::bigint[]) RETURNING id, anfrage_id`, [vorgangIds]);
    await bewegtAnfragen(client, rows);
    return rows.map((r) => Number(r.id)).sort((a, b) => a - b);
  }
  const { rows } = await client.query(
    `UPDATE support_vorgaenge SET
       archiviert_am = NULL,
       status = CASE WHEN status = 'erledigt' THEN 'in_arbeit' ELSE status END,
       status_seit = CASE WHEN status = 'erledigt' THEN NOW() ELSE status_seit END,
       updated_at = NOW()
      WHERE id = ANY($1::bigint[]) RETURNING id, anfrage_id, status`, [vorgangIds]);
  for (const r of rows) {
    if (r.anfrage_id !== null) await anfrageFolgtVorgang(client, r.anfrage_id, r.status);
  }
  return rows.map((r) => Number(r.id)).sort((a, b) => a - b);
}

async function bewegtAnfragen(client, vorgaenge) {
  const anfragen = vorgaenge.filter((r) => r.anfrage_id !== null).map((r) => r.anfrage_id);
  if (anfragen.length > 0) {
    await client.query('UPDATE gemeinde_anfragen SET updated_at = NOW() WHERE id = ANY($1::bigint[])', [anfragen]);
  }
}

/**
 * Loescht Vorgaenge samt Mails (ON DELETE CASCADE) und der daran haengenden
 * Anfrage. Im Postfach selbst wird nie etwas geloescht.
 *
 * @returns {Promise<number[]>} Kennungen der geloeschten Vorgaenge
 */
async function vorgaengeLoeschen(client, vorgangIds) {
  if (vorgangIds.length === 0) return [];
  const { rows: vorhanden } = await client.query(
    'SELECT id, anfrage_id FROM support_vorgaenge WHERE id = ANY($1::bigint[]) FOR UPDATE', [vorgangIds]);
  const anfragen = vorhanden.filter((v) => v.anfrage_id !== null).map((v) => v.anfrage_id);
  if (anfragen.length > 0) {
    // Mit der Anfrage gehen ihr Vorgang und dessen Mails (FK CASCADE).
    await client.query('DELETE FROM gemeinde_anfragen WHERE id = ANY($1::bigint[])', [anfragen]);
  }
  await client.query('DELETE FROM support_vorgaenge WHERE id = ANY($1::bigint[])', [vorhanden.map((v) => v.id)]);
  return vorhanden.map((v) => Number(v.id)).sort((a, b) => a - b);
}

/**
 * Mails mit Anfrage oder Gemeinde, aber ohne vorgang_id, an ihren Vorgang
 * binden. Sie entstehen nur, wenn ein Server-Stand vor Migration 195 sie
 * nach der Migration noch ablegt (Deploy mit zwei Replicas) oder jemand sie
 * von Hand setzt. Anfrage: deren Vorgang; Gemeinde: der juengste offene
 * Vorgang, sonst ein neuer "Schriftwechsel" (Status neu, wenn eine eingehende
 * Mail ungelesen ist). Laeuft vor jedem Abholen (services/mailAbholung.js).
 *
 * @returns {Promise<number>} Anzahl gebundener Mails
 */
async function verwaisteMailsNachziehen(db) {
  const ZAEHLEN = `SELECT COUNT(*)::int AS n FROM mail_nachrichten
                    WHERE vorgang_id IS NULL AND (anfrage_id IS NOT NULL OR organization_id IS NOT NULL)`;
  const { rows: [{ n: vorher }] } = await db.query(ZAEHLEN);
  if (vorher === 0) return 0;
  const { rows } = await db.query(
    `SELECT anfrage_id, organization_id,
            bool_or(richtung = 'ein' AND gelesen_am IS NULL) AS ungelesen
       FROM mail_nachrichten
      WHERE vorgang_id IS NULL AND (anfrage_id IS NOT NULL OR organization_id IS NOT NULL)
      GROUP BY anfrage_id, organization_id`);
  for (const r of rows) {
    let vorgangId;
    if (r.anfrage_id !== null) {
      // bindet die Mails der Anfrage gleich mit, wenn er sie neu anlegt
      vorgangId = await vorgangFuerAnfrage(db, r.anfrage_id);
    } else {
      vorgangId = await offenerVorgangDerGemeinde(db, r.organization_id);
      if (vorgangId === null) {
        ({ id: vorgangId } = await vorgangAnlegen(db, {
          art: 'sonstiges', betreff: 'Schriftwechsel', quelle: 'mail', organizationId: r.organization_id,
          status: r.ungelesen ? 'neu' : 'in_arbeit',
        }));
      }
    }
    if (vorgangId === null) continue;
    await db.query(
      `UPDATE mail_nachrichten SET vorgang_id = $3
        WHERE vorgang_id IS NULL AND anfrage_id IS NOT DISTINCT FROM $1 AND organization_id IS NOT DISTINCT FROM $2`,
      [r.anfrage_id, r.organization_id, vorgangId]);
  }
  const { rows: [{ n: nachher }] } = await db.query(ZAEHLEN);
  const gebunden = vorher - nachher;
  if (gebunden > 0) console.log(`Support-Vorgaenge: ${gebunden} Mails ohne Vorgang nachgezogen`);
  return gebunden;
}

module.exports = {
  ARTEN,
  BEREICHE,
  ARTEN_MIT_BEREICH,
  DRINGLICHKEITEN,
  STATUS,
  QUELLEN,
  BETREFF_MAX,
  BESCHREIBUNG_MAX,
  NOTIZ_MAX,
  betreffAusMail,
  anfrageBetreff,
  vorgangStatusZuAnfrage,
  mailSpalten,
  vorgangAnlegen,
  vorgangFuerAnfrage,
  offenerVorgangDerGemeinde,
  vorgangFuerGemeinde,
  mailsBinden,
  vorgangBewegt,
  statusSetzen,
  anfrageFolgtVorgang,
  vorgangFolgtAnfrage,
  mailImVorgang,
  vorgaengeArchivieren,
  vorgaengeLoeschen,
  verwaisteMailsNachziehen,
};
