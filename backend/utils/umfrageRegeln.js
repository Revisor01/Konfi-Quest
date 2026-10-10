// Was für eine Umfrage im Chat gilt -- EINE Stelle für alle Leser
// (GET /chat/rooms/:id/messages, Socket 'pollUpdated', Anlegen, Aufdecken).
//
// Simon, 10.10.2026: „einmalige antwort. name öffentlich (aber erst später
// veröffentlichen) die beiden optionen."
//
// NAMEN SPÄTER: Die Umfrage ist nicht anonym, die Namen bleiben aber
// verborgen, bis sie aufgedeckt sind -- von Hand (namen_aufgedeckt_at) oder
// durch den Ablauf (expires_at vorbei). Der Ablauf wird hier beim Lesen
// ausgewertet; ein Zeitplan-Lauf, der eine Spalte umschreibt, ist nicht nötig.
//
// Vor dem Aufdecken bekommt NIEMAND die Namen, auch nicht die Leitung und
// nicht, wer die Umfrage erstellt hat ("erst später veröffentlichen" gilt für
// alle gleich). Die Auslieferung meldet dann `anonymous: true` -- dieselbe
// Form wie eine anonyme Umfrage. Die Store-Apps (2.2.x, 2.3.0) kennen die
// neuen Felder nicht und zeigen die Umfrage deshalb wie eine anonyme: Zahlen
// ohne Namen, keine leeren Namenszeilen. Nach dem Aufdecken meldet
// `anonymous` false und die Namen kommen mit -- auch für die alten Apps.

/** Sind die Namen einer "Namen später"-Umfrage aufgedeckt? */
const namenAufgedeckt = (poll, jetzt = new Date()) => {
  if (!poll || !poll.namen_spaeter) return false;
  if (poll.namen_aufgedeckt_at) return true;
  return !!poll.expires_at && new Date(poll.expires_at) <= jetzt;
};

/**
 * Die Felder, die jede Auslieferung einer Umfrage trägt. `anonymous` ist der
 * WIRKSAME Wert (bei "Namen später" bis zum Aufdecken true); die übrigen
 * sind neu und sagen neuen Apps, was für die Umfrage gilt.
 */
const umfrageFelder = (poll, jetzt = new Date()) => {
  const spaeter = Boolean(poll.namen_spaeter);
  const aufgedeckt = namenAufgedeckt(poll, jetzt);
  let aufgedecktAm = null;
  if (aufgedeckt) aufgedecktAm = poll.namen_aufgedeckt_at || poll.expires_at;
  return {
    anonymous: spaeter ? !aufgedeckt : Boolean(poll.anonymous),
    einmalige_antwort: Boolean(poll.einmalige_antwort),
    namen_spaeter: spaeter,
    namen_aufgedeckt: aufgedeckt,
    namen_aufgedeckt_at: aufgedecktAm,
  };
};

module.exports = { namenAufgedeckt, umfrageFelder };
