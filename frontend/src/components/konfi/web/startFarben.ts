// Die Abschnitte der Startseite und ihre Farbkacheln (Web-Fassung): welcher
// Verlauf der App, welches blasse Wort, welches Symbol. Getrennt von den
// Komponenten in WebStartKarten.tsx, damit dort nur Komponenten stehen.

import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_BUCH,
  ICON_CHALLENGE,
  ICON_FUNKELN_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_SCHILD_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../../shared/icons';

/**
 * Die Abschnitte der Startseite mit ihrem Farbverlauf. Der Name ist der
 * Zusatz der App-Klasse `app-dashboard-section--<name>` (theme/variables.css),
 * die den Verlauf und den Schatten trägt.
 */
export type StartFarbe =
  | 'konfirmation'
  | 'challenges'
  | 'konfispruch'
  | 'events'
  | 'tageslosung'
  | 'badges'
  | 'ranking'
  | 'zertifikate';

/** Das blasse Wort im Hintergrund, wie in der App („DEINE / EVENTS"). */
export const START_WASSERZEICHEN: Record<StartFarbe, readonly [string, string]> = {
  konfirmation: ['DEINE', 'KONFIRMATION'],
  challenges: ['DEINE', 'CHALLENGE'],
  konfispruch: ['DEIN', 'KONFISPRUCH'],
  events: ['DEINE', 'EVENTS'],
  tageslosung: ['TAGES', 'LOSUNG'],
  badges: ['DEINE', 'BADGES'],
  ranking: ['DEIN', 'RANKING'],
  zertifikate: ['DEINE', 'ZERTIFIKATE'],
};

/** Das Symbol im Kopf jeder Farbkachel. */
export const START_SYMBOL: Record<StartFarbe, string> = {
  konfirmation: ICON_TERMIN_GEFUELLT,
  challenges: ICON_CHALLENGE,
  konfispruch: ICON_FUNKELN_GEFUELLT,
  events: ICON_TERMIN_GEFUELLT,
  tageslosung: ICON_BUCH,
  badges: ICON_ABZEICHEN_GEFUELLT,
  ranking: ICON_POKAL_GEFUELLT,
  zertifikate: ICON_SCHILD_GEFUELLT,
};
