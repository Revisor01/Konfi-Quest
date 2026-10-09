// Konfis und Team der Leitung (/admin/konfis).
// App: components/admin/KonfisView.tsx (über admin/pages/AdminKonfisPage.tsx).
// Web: components/admin/web/leitung/WebKonfis.tsx.

import { wahlen } from './beschreibung';

/**
 * Konfis oder Team -- `?filter=team` in der Adresse. Die App führt den
 * Team-Reiter intern als `teamer` (Eigenschaften von KonfisView und
 * AdminKonfisPage); sie bildet ihn auf diesen Schlüssel ab.
 */
export const KONFIS_ANSICHT = wahlen([
  { schluessel: 'konfis', label: 'Konfis' },
  { schluessel: 'team', label: 'Team' },
]);
export type KonfisAnsichtSchluessel = (typeof KONFIS_ANSICHT)[number]['schluessel'];
export const KONFIS_ANSICHT_BESCHRIFTUNG = 'Konfis oder Team';

export const KONFIS_JAHRGANG_FILTER = { label: 'Jahrgang', alle: 'Alle Jahrgänge' } as const;

/** Die Leerzustände der Konfi-Liste -- dieselben Sätze in beiden Fassungen. */
export const KONFIS_LEER = {
  titel: 'Keine Konfis gefunden',
  keineTreffer: 'Versuche andere Suchbegriffe.',
  /** Es gibt Konfis, dieser Zugang darf sie nur nicht sehen (Rollen-Bericht 26.08.2026). */
  ohneJahrgangTitel: 'Kein Jahrgang zugewiesen',
  ohneJahrgang: 'Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.',
  /** Der gewählte Jahrgang ist leer -- bis 09.10.2026 sagte die App hier „Noch keine Konfis angelegt". */
  jahrgangLeer: 'In diesem Jahrgang gibt es noch keine Konfis.',
  keineKonfis: 'Noch keine Konfis angelegt.',
} as const;

/** Die Leerzustände der Team-Liste. */
export const TEAM_LEER = {
  titel: 'Niemand im Team gefunden',
  keineTreffer: 'Versuche andere Suchbegriffe.',
  keinTeam: 'Noch niemand im Team.',
} as const;

/** Der Leertext der Konfi-Liste: Suche vor fehlendem Jahrgang vor leerem Jahrgang. */
export function konfisLeerText(o: { sucht: boolean; ohneJahrgang: boolean; jahrgangGewaehlt: boolean }): { titel: string; text: string } {
  if (o.sucht) return { titel: KONFIS_LEER.titel, text: KONFIS_LEER.keineTreffer };
  if (o.ohneJahrgang) return { titel: KONFIS_LEER.ohneJahrgangTitel, text: KONFIS_LEER.ohneJahrgang };
  return { titel: KONFIS_LEER.titel, text: o.jahrgangGewaehlt ? KONFIS_LEER.jahrgangLeer : KONFIS_LEER.keineKonfis };
}
