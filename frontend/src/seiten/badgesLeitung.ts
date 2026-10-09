// Badges verwalten (/admin/badges).
// App: components/admin/BadgesView.tsx (über admin/pages/AdminBadgesPage.tsx).
// Web: components/admin/web/start/WebAdminBadges.tsx -- bekommt Suche und
// Stand von der App-Fassung hereingereicht, das Prädikat ist also eins.

import { wahlen } from './beschreibung';

export const LEITUNG_BADGES_TITEL = 'Badges';
export const LEITUNG_BADGES_UNTERTITEL = 'Auszeichnungen und Erfolge';

/** Für wen die Badges sind -- die Liste kommt je Gruppe vom Server (`?target_role=`). */
export const BADGES_GRUPPE = wahlen([
  { schluessel: 'konfi', label: 'Konfis' },
  { schluessel: 'teamer', label: 'Team' },
]);
export type BadgesGruppe = (typeof BADGES_GRUPPE)[number]['schluessel'];
export const BADGES_GRUPPE_BESCHRIFTUNG = 'Für wen';

interface BadgeSchalter { is_active: boolean; is_hidden: boolean }

/** Der Stand eines Badges. */
export const LEITUNG_BADGES_STATUS = wahlen([
  { schluessel: 'alle', label: 'Alle', passt: () => true },
  { schluessel: 'aktiv', label: 'Aktiv', passt: (b: BadgeSchalter) => b.is_active && !b.is_hidden },
  { schluessel: 'versteckt', label: 'Geheim', passt: (b: BadgeSchalter) => b.is_hidden },
  { schluessel: 'inaktiv', label: 'Inaktiv', passt: (b: BadgeSchalter) => !b.is_active },
]);
export type LeitungBadgesStatus = (typeof LEITUNG_BADGES_STATUS)[number]['schluessel'];
export const LEITUNG_BADGES_STATUS_BESCHRIFTUNG = 'Status';

/**
 * Leertext: ohne ein einziges Badge die Aufforderung, eins anzulegen; sonst
 * gibt es zu Suche und Stand keins. Bis 09.10.2026 sagte die App in beiden
 * Fällen „Erstelle deinen ersten Badge!".
 */
export const LEITUNG_BADGES_LEER = {
  titel: 'Keine Badges gefunden',
  ohneBadges: 'Lege das erste Badge an.',
  ohneTreffer: 'Zu Suche und Filter gibt es kein Badge.',
} as const;
