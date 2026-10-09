// Benutzer:innen der Gemeinde (/admin/users): Leitung und Team.
// App: components/admin/UsersView.tsx (über admin/pages/AdminUsersPage.tsx).
// Web: components/admin/web/leitung/WebBenutzer.tsx.

import { wahlen } from './beschreibung';

export const BENUTZER_TITEL = 'Benutzer:innen';
/** Leitung und Org-Leitung zusammen heißen „Leitung" (Simon, 28.09.2026). */
export const BENUTZER_UNTERTITEL = 'Leitung, Team und Rollen';

interface Konto { is_active?: boolean; role_name: string }

/** Wer auf der Liste steht. Bis 09.10.2026 kannte die App zusätzlich einen Zweig „inaktiv" ohne Reiter. */
export const BENUTZER_FILTER = wahlen([
  { schluessel: 'alle', label: 'Alle', passt: () => true },
  { schluessel: 'aktiv', label: 'Aktiv', passt: (u: Konto) => !!u.is_active },
  { schluessel: 'admin', label: 'Leitung', passt: (u: Konto) => u.role_name === 'admin' || u.role_name === 'org_admin' },
  { schluessel: 'teamer', label: 'Team', passt: (u: Konto) => u.role_name === 'teamer' },
]);
export type BenutzerFilterSchluessel = (typeof BENUTZER_FILTER)[number]['schluessel'];
export const BENUTZER_FILTER_BESCHRIFTUNG = 'Ansicht';

/**
 * Leertext: Ohne Suche und Filter gibt es noch niemanden; sonst liegt es an
 * Suche oder Filter. Bis 09.10.2026 sagte die App immer „Noch keine
 * Teammitglieder angelegt".
 */
export const BENUTZER_LEER = {
  titel: 'Keine Benutzer:innen gefunden',
  keineTreffer: 'Versuche andere Suchbegriffe oder einen anderen Filter.',
  niemand: 'Noch keine Teammitglieder angelegt.',
} as const;
