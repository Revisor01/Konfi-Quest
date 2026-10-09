// Kennung und Name als Paare -- fuer categories[] und jahrgaenge[] der
// Terminlisten (09.10.2026).
//
// Bis dahin bauten die Routen die Paare aus zwei getrennten STRING_AGG: die
// Kennungen als Text sortiert, die Namen alphabetisch. Zusammengefuegt wurde
// ueber die Stelle -- Kennung 5 ("Musik") bekam so den Namen von Kennung 6
// ("Freizeit"), sobald beide Reihenfolgen auseinanderliefen. Getrennt wurde
// zudem an ',' statt an ', ': Jeder Name ab dem zweiten begann mit einem
// Leerzeichen, und ein Name mit Komma zerfiel.
//
// Jetzt liefert die Abfrage die Paare selbst (paareSql) und hier werden sie
// nur geordnet: nach Name wie category_names/jahrgang_names, bei gleichem
// Namen nach Kennung.

/**
 * SQL-Ausdruck: alle Paare einer Gruppe als JSON-Array, ohne Doppelte und
 * ohne die NULL-Zeilen eines LEFT JOIN.
 */
const paareSql = (alias) =>
  `JSON_AGG(DISTINCT jsonb_build_object('id', ${alias}.id, 'name', ${alias}.name)) FILTER (WHERE ${alias}.id IS NOT NULL)`;

/** Die Paare aus der Abfrage, nach Name und Kennung geordnet; ohne Paare ein leeres Array. */
function idNamePaare(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((p) => p && p.id !== null && p.id !== undefined)
    .map((p) => ({ id: Number(p.id), name: p.name }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'de') || a.id - b.id);
}

module.exports = { paareSql, idNamePaare };
