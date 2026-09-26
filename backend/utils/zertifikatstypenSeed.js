// backend/utils/zertifikatstypenSeed.js
//
// Standard-Zertifikatstypen fuer Organisationen, die noch keine haben.
//
// Laeuft bei jedem Backend-Start (routes/organizations.js) -- auf JEDER
// Replica. Bis zum 26.09.2026 stand der Insert dort ohne ON CONFLICT: Starten
// beide Replicas gleichzeitig gegen eine frische Gemeindemenge, verliert eine
// den Wettlauf je Zeile mit "duplicate key value violates unique constraint
// certificate_types_organization_id_name_key"; der catch schluckte den
// Fehler, der Rest der Schleife lief nicht mehr (Audit 26.09.2026, Betrieb
// BF-16). Funktional harmlos wegen des Unique-Index, aber Log-Rauschen und
// bei 200 Gemeinden 800 Einzel-Statements auf dem Anfragepfad.
//
// Jetzt: EIN Insert je Organisation mit allen vier Typen und
// ON CONFLICT (organization_id, name) DO NOTHING -- der zweite Start (oder
// die zweite Replica) fuegt nichts ein und wirft nichts.

const STANDARD_ZERTIFIKATSTYPEN = [
  { name: 'Teamer-Card', icon: 'card' },
  { name: 'JuLeiCa', icon: 'ribbon' },
  { name: 'Rettungsschwimmer', icon: 'water' },
  { name: 'Erste Hilfe', icon: 'medkit' },
];

/**
 * Legt die Standardtypen fuer EINE Organisation an. Idempotent: bereits
 * vorhandene Namen bleiben unangetastet.
 *
 * @returns {Promise<number>} Zahl der tatsaechlich eingefuegten Zeilen
 */
async function legeStandardZertifikatstypenAn(db, orgId) {
  const werte = [];
  const params = [];
  STANDARD_ZERTIFIKATSTYPEN.forEach((typ, i) => {
    werte.push(`($${i * 2 + 1}, $${i * 2 + 2}, $${STANDARD_ZERTIFIKATSTYPEN.length * 2 + 1})`);
    params.push(typ.name, typ.icon);
  });
  params.push(orgId);
  const { rowCount } = await db.query(
    `INSERT INTO certificate_types (name, icon, organization_id)
     VALUES ${werte.join(', ')}
     ON CONFLICT (organization_id, name) DO NOTHING`,
    params
  );
  return rowCount;
}

/**
 * Standardtypen fuer alle Organisationen ohne Zertifikatstypen nachziehen.
 * Fehler werden geworfen -- der Aufrufer entscheidet, ob er sie nur loggt.
 *
 * @returns {Promise<{organisationen: number, eingefuegt: number}>}
 */
async function seedeStandardZertifikatstypen(db) {
  const { rows: orgs } = await db.query(
    `SELECT o.id FROM organizations o
     WHERE NOT EXISTS (
       SELECT 1 FROM certificate_types ct WHERE ct.organization_id = o.id
     )`
  );
  let eingefuegt = 0;
  for (const org of orgs) {
    eingefuegt += await legeStandardZertifikatstypenAn(db, org.id);
  }
  return { organisationen: orgs.length, eingefuegt };
}

module.exports = {
  STANDARD_ZERTIFIKATSTYPEN,
  legeStandardZertifikatstypenAn,
  seedeStandardZertifikatstypen,
};
