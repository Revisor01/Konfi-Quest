// Startseiten der Konfis und des Teams einstellen (/admin/settings/dashboard).
// App: components/admin/pages/AdminDashboardSettingsPage.tsx -- zwei Reiter,
// darunter die Liste zum Ziehen. Web: components/admin/web/leitung/
// WebDashboardEinstellungen.tsx -- bewusst ohne Reiter: beide Listen stehen
// als Karten nebeneinander, die Reihenfolge ändern Pfeile statt Ziehen.

import { wahlen } from './beschreibung';

// Ein Name je Bereich, ueberall derselbe (Kachel unter „Mehr" = Seitentitel =
// Eintrag der App; 15.10.2026): „Startseiten" statt „Dashboard".
export const DASHBOARD_TITEL = 'Startseiten';

/** Wessen Startseite. Der Browser zeigt keine Reiter, sondern beide Listen; ihre Titel stehen in DASHBOARD_LISTE_TITEL. */
export const DASHBOARD_FUER = wahlen([
  { schluessel: 'konfi', label: 'Konfi' },
  { schluessel: 'teamer', label: 'Team' },
]);
export type DashboardFuer = (typeof DASHBOARD_FUER)[number]['schluessel'];

/** Die Überschrift der Liste: in der App über der Liste des Reiters, im Browser als Kartentitel. */
export const DASHBOARD_LISTE_TITEL: Record<DashboardFuer, string> = {
  konfi: 'Startseite der Konfis',
  teamer: 'Startseite des Teams',
};
