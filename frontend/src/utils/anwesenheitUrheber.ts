// Wer hat die Anwesenheit eingetragen? (Migration 148, 13.09.2026)
//
// Simons Fall: In der Teilnehmerliste steht "Abgemeldet: krank, Mutter hat
// angerufen". Wer das aufgenommen hat, war nicht zu sehen -- bei einer
// Rueckfrage half der Eintrag dann nicht weiter. Die Zeile steht klein unter
// Grund und Vermerk, ohne Tippen sichtbar (Entscheidung Simon).
//
// NULL HEISST UNBEKANNT, NICHT NIEMAND: Buchungen von vor der Migration und
// Selbst-Check-ins per QR-Code tragen keinen Urheber. Dann faellt die Zeile
// ersatzlos weg -- "Eingetragen von unbekannt" behauptet mehr, als bekannt
// ist, und stuende unter jedem alten Eintrag.

export interface UrheberAngabe {
  attendance_set_by_name?: string | null;
  attendance_set_at?: string | null;
}

/**
 * Die Zeile unter Grund/Vermerk, z. B. "Eingetragen von Simon Luthe, 13.09."
 * oder ohne Datum, wenn nur der Name bekannt ist.
 *
 * Gibt null zurueck, wenn kein Name vorliegt. Ohne Namen gibt es nichts zu
 * sagen: Ein blosses Datum beantwortet die Frage "wer war das?" nicht.
 */
export const urheberZeile = (angabe: UrheberAngabe | null | undefined): string | null => {
  const name = angabe?.attendance_set_by_name?.trim();
  if (!name) return null;

  const datum = kurzesDatum(angabe?.attendance_set_at);
  return datum ? `Eingetragen von ${name}, ${datum}` : `Eingetragen von ${name}`;
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
