// Die Symbole der Punktearten auf der Detailseite einer Person -- EINE Stelle
// fuer die Kreise vor Aktivitaeten, Events und Bonuspunkten, in der App
// (KonfiDetailSections.tsx) und im Browser (web/leitung/WebKonfiKarten.tsx;
// Simon, 13.10.2026: „aktivitaeten events bonus duerften gerne auch ein icon
// bekommen vorne und color coded entsprechend ihrer kategorien"). Die Farben
// dazu: Gottesdienst blau, Gemeinde gruen, Events rot, Bonus orange, eine
// Aktivitaet einer Teamer:in in der Teamer-Farbe.
//
// Eigene Datei statt Export aus KonfiDetailSections.tsx: Eine Datei mit
// Komponenten soll nur Komponenten exportieren (Fast Refresh).

import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_AKTION_GEFUELLT,
  ICON_BONUS_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_PODIUM,
} from '../../shared/icons';

/** Symbol einer verbuchten Aktivitaet. Teamer-Aktivitaeten haben keine Punkteart: das Abzeichen. */
export const aktivitaetSymbol = (art: string | undefined, istTeamer: boolean): string =>
  istTeamer ? ICON_ABZEICHEN_GEFUELLT : art === 'gottesdienst' ? ICON_GOTTESDIENST_GEFUELLT : ICON_AKTION_GEFUELLT;

/** Symbol eines Events in der Punkte-Liste der Person. */
export const EVENT_SYMBOL = ICON_PODIUM;

/** Symbol eines Bonuspunkte-Eintrags. */
export const BONUS_SYMBOL = ICON_BONUS_GEFUELLT;
