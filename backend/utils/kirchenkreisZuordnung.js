// Kirchenkreis als Zuordnung an der Gemeinde (Migration 191, 03.10.2026).
//
// organizations.kirchenkreis_id verweist auf kirchenkreise; die alte
// Textspalte organizations.kirchenkreis bleibt, weil die Apps bis 2.3.0 nur
// sie lesen und schreiben. DIE REGEL, an allen Stellen gleich:
//
//   - Wer die Zuordnung setzt (POST /organizations, POST
//     /support/anfragen/:id/anlegen, PUT /organizations/:id -- nur
//     Super-Admin), schreibt den Namen des Kirchenkreises in die Textspalte;
//     ohne Zuordnung ist sie leer.
//   - Heisst ein Kirchenkreis um, ziehen die Textspalten seiner Gemeinden mit;
//     wird er geloescht, werden Zuordnung und Text leer
//     (PUT/DELETE /support/kirchenkreise/:id).
//   - Schickt eine App nur den Text (PUT /organizations/:id ohne
//     kirchenkreis_id), wird er gespeichert wie bisher. Weicht er vom Namen
//     des zugeordneten Kirchenkreises ab (ohne Gross/klein und Randleerzeichen),
//     endet die Zuordnung -- der Text sagt dann etwas anderes als die
//     Struktur, und die Statistik soll nicht weiter mit dem alten Kreis
//     zaehlen. Derselbe Text laesst sie stehen.

const MELDUNG_KIRCHENKREIS_FEHLT = 'Kirchenkreis nicht gefunden';

/**
 * @param {{query: Function}} db  Pool oder Client einer Transaktion
 * @param {number|string} id
 * @returns {Promise<{id: number, name: string} | null>}
 */
async function kirchenkreisFinden(db, id) {
  const { rows: [kk] } = await db.query('SELECT id, name FROM kirchenkreise WHERE id = $1', [id]);
  return kk ? { id: Number(kk.id), name: kk.name } : null;
}

/**
 * Ist `wert` eine gueltige Angabe fuer kirchenkreis_id? null (keine
 * Zuordnung) oder eine positive ganze Zahl.
 */
function kirchenkreisIdGueltig(wert) {
  if (wert === null) return true;
  if (typeof wert === 'number') return Number.isSafeInteger(wert) && wert > 0;
  return typeof wert === 'string' && /^[1-9]\d{0,15}$/.test(wert);
}

module.exports = { MELDUNG_KIRCHENKREIS_FEHLT, kirchenkreisFinden, kirchenkreisIdGueltig };
