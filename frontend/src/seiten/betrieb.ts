// Betrieb (/admin/metrics, nur mit Super-Admin-Recht).
// App: components/admin/pages/AdminMetricsPage.tsx.
// Web: components/admin/web/leitung/WebBetrieb.tsx (Reiter und Sortierung
// kommen als Zustand aus der App-Fassung).

import { wahlen, zahlwort } from './beschreibung';

export const BETRIEB_TITEL = 'Betrieb';

/**
 * Die Reiter. Die Zahl an „Fehler" zählt die Fehlergruppen seit dem letzten
 * Neustart; die App schreibt sie in Klammern hinter den Namen, der Browser
 * als rote Zahl am Chip -- dieselbe Zahl, zwei Darstellungen.
 */
export const BETRIEB_REITER = wahlen([
  { schluessel: 'ueberblick', label: 'Überblick' },
  { schluessel: 'fehler', label: 'Fehler', zahlText: zahlwort('Fehlerart seit dem letzten Neustart', 'Fehlerarten seit dem letzten Neustart') },
  { schluessel: 'routen', label: 'Routen' },
  { schluessel: 'verlauf', label: 'Verlauf' },
  { schluessel: 'sprueche', label: 'Sprüche' },
]);
export type BetriebsReiterSchluessel = (typeof BETRIEB_REITER)[number]['schluessel'];
export const BETRIEB_REITER_BESCHRIFTUNG = 'Ansicht';

/** Die zwei Sortierungen der Routen (utils/betriebsKennzahlen.ts, routenListe). */
export const ROUTEN_SORTIERUNG = wahlen([
  { schluessel: 'langsam', label: 'Langsamste' },
  { schluessel: 'haeufig', label: 'Häufigste' },
]);
export const ROUTEN_SORTIERUNG_BESCHRIFTUNG = 'Sortierung der Routen';
