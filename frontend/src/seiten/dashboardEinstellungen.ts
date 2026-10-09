// Startseiten der Konfis und des Teams einstellen (/admin/settings/dashboard).
// App: components/admin/pages/AdminDashboardSettingsPage.tsx -- zwei Reiter,
// darunter die Liste zum Ziehen. Web: components/admin/web/leitung/
// WebDashboardEinstellungen.tsx -- bewusst ohne Reiter: beide Listen stehen
// als Karten nebeneinander, die Reihenfolge ändern Pfeile statt Ziehen.

import { wahlen } from './beschreibung';

export const DASHBOARD_TITEL = 'Dashboard';

/** Wessen Startseite. Der Browser zeigt keine Reiter, sondern beide Listen; ihre Titel stehen in DASHBOARD_LISTE_TITEL. */
export const DASHBOARD_FUER = wahlen([
  { schluessel: 'konfi', label: 'Konfi' },
  { schluessel: 'teamer', label: 'Team' },
]);
export type DashboardFuer = (typeof DASHBOARD_FUER)[number]['schluessel'];

/** Die Überschrift der Liste: in der App über der Liste des Reiters, im Browser als Kartentitel. */
export const DASHBOARD_LISTE_TITEL: Record<DashboardFuer, string> = {
  konfi: 'Konfi-Dashboard',
  teamer: 'Team-Dashboard',
};
