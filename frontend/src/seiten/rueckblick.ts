// Jahresrückblick verwalten (/admin/settings/wrapped).
// App: components/admin/pages/AdminWrappedPage.tsx.
// Web: components/admin/web/leitung/WebRueckblick.tsx (Reiter und Ausgaben
// kommen aus der App-Fassung).

import { wahlen, type Fassung } from './beschreibung';

export const RUECKBLICK_TITEL = 'Jahresrückblick';
export const RUECKBLICK_UNTERTITEL = 'Ausgaben verwalten';

/**
 * Für wen die Ausgaben sind. Ausgaben fürs Team betreffen die ganze Gemeinde
 * und gehören der Gemeindeleitung (RUECKBLICK_NUR_LEITUNG): die App zeigt den
 * Reiter dann ausgegraut, der Browser lässt den Chip weg.
 */
export const RUECKBLICK_FUER = wahlen([
  { schluessel: 'konfi', label: 'Konfis' },
  { schluessel: 'teamer', label: 'Team' },
]);
export type RueckblickFuer = (typeof RUECKBLICK_FUER)[number]['schluessel'];
export const RUECKBLICK_FUER_BESCHRIFTUNG = 'Rückblicke für';
export const RUECKBLICK_NUR_LEITUNG: RueckblickFuer = 'teamer';

export const RUECKBLICK_LEER_TITEL = 'Noch kein Rückblick';
export const RUECKBLICK_OHNE_JAHRGANG = {
  titel: 'Kein Jahrgang zugewiesen',
  text: 'Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.',
} as const;

/**
 * Der Leertext. Er nennt den Knopf, mit dem man anlegt -- der heißt in der
 * App „Plus oben", im Browser „Neuer Rückblick" (bewusster Unterschied).
 */
export function rueckblickLeerText(fassung: Fassung, fuer: RueckblickFuer, istLeitung: boolean): string {
  const anlegen = fassung === 'app' ? 'Über das Plus oben legst du einen an' : 'Mit „Neuer Rückblick“ legst du einen an';
  if (fuer === 'konfi') return `${anlegen} — du wählst nur den Jahrgang, alles andere steht fest.`;
  if (istLeitung) return `${anlegen} — fürs ganze Team gemeinsam, du wählst nur das Jahr.`;
  return 'Für das Team ist noch keiner erstellt. Rückblicke fürs Team legt die Gemeindeleitung an.';
}
