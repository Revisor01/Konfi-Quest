// Die Badge-Seite von Konfis und Team (/konfi/badges, /teamer/badges).
// App: components/konfi/views/BadgesView.tsx (beide Rollen, über
// konfi/pages/KonfiBadgesPage.tsx und teamer/pages/TeamerBadgesPage.tsx).
// Web: components/konfi/web/WebBadgesRaster.tsx.

import { wahlen } from './beschreibung';

export const BADGES_TITEL = 'Deine Badges';
export const BADGES_UNTERTITEL = 'Sammle alle Erfolge!';

interface BadgeStand {
  is_earned?: boolean;
  progress_percentage?: number | null;
}

/** Ein Badge mit Fortschritt, das noch nicht erreicht ist. */
export const badgeInArbeit = (b: BadgeStand): boolean => !b.is_earned && (b.progress_percentage ?? 0) > 0;

/** Der Stand der Badges -- „Status" über der Liste. */
export const BADGES_STATUS = wahlen([
  { schluessel: 'alle', label: 'Alle', leer: 'Sammle Punkte für deine ersten Badges!', passt: () => true },
  {
    schluessel: 'erhalten', label: 'Erhalten', leer: 'Sammle Punkte für deine ersten Badges!',
    passt: (b: BadgeStand) => b.is_earned === true,
    nurIn: 'web',
    warum: 'Die App zeigt die erreichten Badges oben als Zahl und in jeder Kategorie markiert; drei Reiter passen in die Breite eines Telefons, vier mit „Erhalten" nicht.',
  },
  { schluessel: 'offen', label: 'Offen', leer: 'Du hast alle sichtbaren Badges eingesammelt.', passt: (b: BadgeStand) => !b.is_earned },
  { schluessel: 'arbeit', label: 'In Arbeit', leer: 'Sammle Punkte, um den Fortschritt bei Badges zu starten!', passt: badgeInArbeit },
]);
export type BadgesStatus = (typeof BADGES_STATUS)[number]['schluessel'];
export const BADGES_STATUS_BESCHRIFTUNG = 'Status';

/** Die Überschrift über dem Leertext, je Stand. */
export const BADGES_LEER_TITEL: Record<BadgesStatus, string> = {
  alle: 'Keine Badges gefunden',
  erhalten: 'Noch keine Badges erhalten',
  offen: 'Alle Badges erreicht!',
  arbeit: 'Keine Badges in Arbeit',
};

/** Findet die Suche nichts, gilt das vor dem Leertext des Stands -- in beiden Fassungen. */
export const BADGES_KEINE_TREFFER = {
  titel: 'Keine Badges gefunden',
  text: 'Zu diesem Suchbegriff gibt es kein Badge. Versuch es mit einem anderen Wort.',
} as const;

/** Kategorie-Auswahl (nur im Browser: dort stehen die Kategorien nebeneinander, in der App untereinander). */
export const BADGES_KATEGORIE_FILTER = { label: 'Kategorie', alle: 'Alle Kategorien' } as const;
