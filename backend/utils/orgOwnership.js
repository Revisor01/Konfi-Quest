// Schutz gegen Cross-Org-Referenzen in Request-Bodies (Org-Isolation).
//
// Endpoints, die ID-Arrays entgegennehmen (jahrgang_ids, category_ids,
// event_ids, tag_ids, ...), muessen pruefen, dass ALLE IDs zur Organisation
// des Aufrufers gehoeren — sonst kann ein Admin aus Org A Zuordnungen auf
// Datensaetze aus Org B anlegen (gefunden 05.07.2026: Event in Org 4 mit
// Jahrgang aus Org 1).
//
// WICHTIG: `table` darf AUSSCHLIESSLICH als String-Literal aus den Routes
// kommen (nie aus User-Input) — es wird in das SQL interpoliert.

async function allIdsBelongToOrg(db, table, ids, organizationId) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) return true;
  const unique = [...new Set(ids.map(Number))];
  if (unique.some((n) => !Number.isInteger(n))) return false;
  const { rows: [row] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE id = ANY($1::int[]) AND organization_id = $2`,
    [unique, organizationId]
  );
  return row.n === unique.length;
}

module.exports = { allIdsBelongToOrg };
