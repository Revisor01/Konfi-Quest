// Mehrere Abfragen gebuendelt ausfuehren: ueber den Pool parallel, auf einem
// Client nacheinander (29.09.2026, Paket I2).
//
// WARUM: pg 8 reiht Abfragen, die gleichzeitig auf EINEM Client abgesetzt
// werden, intern ein und warnt dabei: "Calling client.query() when the client
// is already executing a query is deprecated and will be removed in pg@9.0".
// Mit pg 9 faellt diese Warteschlange weg. Gefunden per --trace-deprecation in
// checkAndAwardBadges (routes/badges.js), das seine Vorab-Abfragen mit
// Promise.all buendelt und aus Anwesenheit und Check-in mit dem Client der
// laufenden Transaktion gerufen wird.
//
// Ein Client (aus db.getClient(), erkennbar an release() -- dieselbe Pruefung
// wie verlangeClient in utils/bookingUtils.js) arbeitet ohnehin eine Abfrage
// nach der anderen ab; parallel bringt dort nichts. Der Pool verteilt auf
// mehrere Verbindungen -- dort bleibt es parallel, die Latenz der Routen
// aendert sich nicht.

/** Ist `db` ein einzelner Client (statt des Pools)? */
function istClient(db) {
  return Boolean(db) && typeof db.release === 'function';
}

/**
 * @param {object} db - Pool oder Client
 * @param {Array<() => Promise<any>>} aufgaben - je Abfrage eine Funktion
 * @returns {Promise<Array<any>>} Ergebnisse in der Reihenfolge der Aufgaben
 */
async function abfragenBuendeln(db, aufgaben) {
  if (!istClient(db)) {
    return Promise.all(aufgaben.map((aufgabe) => aufgabe()));
  }
  const ergebnisse = [];
  for (const aufgabe of aufgaben) {
    ergebnisse.push(await aufgabe());
  }
  return ergebnisse;
}

module.exports = { abfragenBuendeln, istClient };
