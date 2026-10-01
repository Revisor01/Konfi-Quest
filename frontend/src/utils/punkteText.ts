/**
 * „1 Punkt", aber „0 Punkte", „2 Punkte" -- an EINER Stelle.
 *
 * Simon, 01.10.2026: Auf der Konfi-Startseite stand „noch 1 Punkte". Die
 * Einzahl fing bis dahin jede Ansicht selbst ab (Antrag, Konfi-Zeit,
 * Rückblick) -- oder vergaß es. Wer eine Zahl mit „Punkte" beschriftet,
 * nimmt `punkteText()` (Zahl samt Wort) oder `punktWort()` (nur das Wort).
 */

/** „Punkt" bei genau 1, sonst „Punkte" (auch bei 0 und bei Abzügen). */
export const punktWort = (anzahl: number): string => (anzahl === 1 ? 'Punkt' : 'Punkte');

/** Zahl samt passendem Wort: „1 Punkt", „3 Punkte". */
export const punkteText = (anzahl: number): string => `${anzahl} ${punktWort(anzahl)}`;
