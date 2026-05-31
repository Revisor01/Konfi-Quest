// backend/utils/konfiLimit.js
// Gemeinsame Konfi-Limit-Pruefung (Single Source of Truth).
// Wird von beiden Anlage-Wegen genutzt (Wave 2): POST-Konfi-Route (Leitung legt an)
// und Invite-Code-Selbstregistrierung. Analog deleteKonfiCascade aus Phase 114 wird
// die Logik EINMAL gebaut, damit die Durchsetzung nicht auseinanderlaeuft.

// Kulanz-Puffer ueber dem Tarif-Limit (D-05): bis zu GRACE_BUFFER weitere Konfis
// duerfen mit Bestaetigung angelegt werden, danach harte Grenze.
const GRACE_BUFFER = 5;

/**
 * Ermittelt die Limit-Stufe einer Organisation anhand der aktiven Konfi-Anzahl.
 *
 * Stufen (D-05/D-06):
 *   - max_konfis IS NULL                         -> { stufe: 'under_limit', count, limit: null }
 *   - count < max_konfis                         -> { stufe: 'under_limit', count, limit }
 *   - max_konfis <= count < max_konfis + 5       -> { stufe: 'grace',       count, limit }
 *   - count >= max_konfis + 5                    -> { stufe: 'hard_block',  count, limit }
 *
 * Gezaehlt werden ausschliesslich aktive Konfis (Rolle 'konfi') der Org mit
 * deleted_at IS NULL (D-07) — soft-geloeschte Konfis (Phase 114) zaehlen NICHT.
 * Die Zaehlung ist org-isoliert (organization_id = $1).
 *
 * db kann ein Pool ODER ein laufender Client (aus db.getClient()) sein, damit die
 * Pruefung in eine Transaktion des Aufrufers eingebettet werden kann (Util-Muster Phase 114).
 *
 * @param {{ query: Function }} db - DB-Pool oder Client
 * @param {number} organizationId - Organisation, deren Limit geprueft wird
 * @returns {Promise<{ count: number, limit: number|null, stufe: 'under_limit'|'grace'|'hard_block' }>}
 */
async function checkKonfiLimit(db, organizationId) {
  // 1. Limit der Org lesen.
  const { rows: orgRows } = await db.query(
    'SELECT max_konfis FROM organizations WHERE id = $1',
    [organizationId]
  );
  const limit = orgRows.length > 0 && orgRows[0].max_konfis !== null
    ? Number(orgRows[0].max_konfis)
    : null;

  // 2. Aktive Konfis der Org zaehlen (NICHT konfi_profiles — das filtert deleted_at nicht).
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'konfi'
        AND u.organization_id = $1
        AND u.deleted_at IS NULL`,
    [organizationId]
  );
  const count = countRows[0].count;

  // 3. Stufe bestimmen.
  if (limit === null) {
    return { count, limit: null, stufe: 'under_limit' };
  }
  if (count < limit) {
    return { count, limit, stufe: 'under_limit' };
  }
  if (count < limit + GRACE_BUFFER) {
    return { count, limit, stufe: 'grace' };
  }
  return { count, limit, stufe: 'hard_block' };
}

module.exports = { checkKonfiLimit, GRACE_BUFFER };
