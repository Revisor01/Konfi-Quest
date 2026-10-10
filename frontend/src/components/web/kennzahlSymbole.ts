// Die Symbole der Kennzahlen in der Web-Fassung -- EINE Stelle (Simon,
// 10.10.2026): Kennzahl-Kachel (WebKachel), Tabellenzelle (WebZahlMitSymbol)
// und Karten-Angabe (WebBildKarte) lesen dasselbe Paar aus Symbol und
// Bereichsfarbe. Bis 10.10.2026 war das Badge-Symbol auf der Karte farbig und
// in der Tabelle grau, weil jede Ansicht ihre Farbe selbst setzte.
//
// Die Symbole sind die der App (Konfi-Liste, Detailkopf, Punkte-Arten), die
// Farben ausschliesslich Bereichsfarben aus variables.css.

import {
  ICON_ABZEICHEN,
  ICON_DATEI,
  ICON_GEMEINDE,
  ICON_GOTTESDIENST,
  ICON_GRUPPE,
  ICON_JAHRGANG,
  ICON_POKAL,
  ICON_TERMIN,
  ICON_ZUSAGE,
} from '../shared/icons';

export interface KennzahlSymbol {
  icon: string;
  /** CSS-Farbwert, immer eine Bereichsfarbe (var(--app-color-…)). */
  farbe: string;
}

export const KENNZAHL_SYMBOL = {
  konfis: { icon: ICON_GRUPPE, farbe: 'var(--app-color-konfis)' },
  team: { icon: ICON_GRUPPE, farbe: 'var(--app-color-teamer)' },
  punkte: { icon: ICON_POKAL, farbe: 'var(--app-color-warning)' },
  zielErreicht: { icon: ICON_ZUSAGE, farbe: 'var(--app-color-success-strong)' },
  jahrgaenge: { icon: ICON_JAHRGANG, farbe: 'var(--app-color-jahrgang)' },
  badges: { icon: ICON_ABZEICHEN, farbe: 'var(--app-color-badges)' },
  zertifikate: { icon: ICON_DATEI, farbe: 'var(--app-color-zertifikate)' },
  events: { icon: ICON_TERMIN, farbe: 'var(--app-color-events)' },
  gottesdienst: { icon: ICON_GOTTESDIENST, farbe: 'var(--app-color-gottesdienst)' },
  gemeinde: { icon: ICON_GEMEINDE, farbe: 'var(--app-color-gemeinde)' },
} satisfies Record<string, KennzahlSymbol>;
