// Wer hat die Anwesenheit eingetragen? (Migration 148, 13.09.2026)
//
// Simons Fall: In der Teilnehmerliste steht "Abgemeldet: krank, Mutter hat
// angerufen". Wer das aufgenommen hat, war nicht zu sehen -- bei einer
// Rueckfrage half der Eintrag dann nicht weiter. Die Zeile steht klein unter
// Grund und Notiz, ohne Tippen sichtbar (Entscheidung Simon).
//
// ZWEI URHEBER, GETRENNT GEFUEHRT (Migration 149, 13.09.2026):
// Simons Rueckfrage: "Was ist wenn einer einen Vermerk schreibt und einer den
// Grund. Wie wird das angezeigt." Mit einem gemeinsamen Urheber gar nicht --
// wer zuletzt schrieb, ueberschrieb den anderen, und die Zeile behauptete,
// er habe beides eingetragen. Seither gilt attendance_set_by fuer den STATUS
// samt Abmeldegrund und note_set_by fuer die NOTIZ. Jede Zeile nennt ihren
// eigenen Urheber, klein darunter.
//
// NULL HEISST UNBEKANNT, NICHT NIEMAND: Buchungen von vor der Migration und
// Selbst-Check-ins per QR-Code tragen keinen Urheber. Dann faellt die Zeile
// ersatzlos weg -- "Eingetragen von unbekannt" behauptet mehr, als bekannt
// ist, und stuende unter jedem alten Eintrag.

export interface UrheberAngabe {
  attendance_set_by_name?: string | null;
  attendance_set_at?: string | null;
  note_set_by_name?: string | null;
  note_set_at?: string | null;
}

/**
 * Die Zeile unter Status und Grund, z. B. "Eingetragen von Simon Luthe, 13.09."
 * oder ohne Datum, wenn nur der Name bekannt ist.
 *
 * Gibt null zurueck, wenn kein Name vorliegt. Ohne Namen gibt es nichts zu
 * sagen: Ein blosses Datum beantwortet die Frage "wer war das?" nicht.
 */
export const urheberZeile = (angabe: UrheberAngabe | null | undefined): string | null =>
  zeile('Eingetragen von', angabe?.attendance_set_by_name, angabe?.attendance_set_at);

/**
 * Die Zeile unter der Notiz, z. B. "Notiz von Anna Meier, 13.09."
 *
 * Eigener Wortlaut statt "Eingetragen von": Stehen beide Zeilen untereinander
 * -- weil verschiedene Leute Status und Notiz geschrieben haben --, muss auf
 * einen Blick klar sein, welcher Name zu welchem Eintrag gehoert.
 */
export const notizUrheberZeile = (angabe: UrheberAngabe | null | undefined): string | null =>
  zeile('Notiz von', angabe?.note_set_by_name, angabe?.note_set_at);

const zeile = (
  vorspann: string,
  name: string | null | undefined,
  zeitstempel: string | null | undefined
): string | null => {
  const sauber = name?.trim();
  if (!sauber) return null;

  const datum = kurzesDatum(zeitstempel);
  return datum ? `${vorspann} ${sauber}, ${datum}` : `${vorspann} ${sauber}`;
};

/**
 * Tag und Monat, mehr nicht ("13.09."). Das Jahr wuerde die Zeile laenger
 * machen, ohne etwas beizutragen -- sie steht an einem Termin, dessen Datum
 * eine Zeile darueber schon sichtbar ist.
 *
 * Ein unlesbarer Zeitstempel fuehrt zu null statt zu "Invalid Date": lieber
 * nur der Name als eine kaputte Angabe.
 */
const kurzesDatum = (zeitstempel: string | null | undefined): string | null => {
  if (!zeitstempel) return null;
  const d = new Date(zeitstempel);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};
