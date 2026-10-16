// Die Legende der Events: welche Farbe und welches Symbol an einem Event was
// bedeutet, je Rolle. Eine Stelle für das Modal der App (EventLegendModal) und
// das Fenster des Browsers ab 992 px (web/termine/WebLegendeDialog.tsx; Simon,
// 15.10.2026) -- beide zeigen dieselben Einträge in derselben Reihenfolge.

import {
  ICON_ABSAGE,
  ICON_ANWESEND,
  ICON_FLAMME_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_INFO_GEFUELLT,
  ICON_KREIS_LEER,
  ICON_PLUS_KREIS_GEFUELLT,
  ICON_SCHUTZ_GEFUELLT,
  ICON_SPERRE_GEFUELLT,
  ICON_UHRZEIT,
  ICON_WARTEND,
  ICON_ZUSAGE_GEFUELLT,
} from './icons';

export type EventLegendVariant = 'konfi' | 'teamer' | 'admin';

export interface LegendEntry {
  color: string;
  icon: string;
  label: string;
  description: string;
  variants: EventLegendVariant[];
}

// Status-Legende für Events. Farbe UND Icon müssen mit den EventsViews
// uebereinstimmen (gleiche --app-color-Tokens, Icons aus StatusBadge-Map).
// Reihenfolge: erst "Zusatz-Marker" (Team/Konfirmation/Pflicht als Eck-Badges),
// dann die eigentlichen Status-Farben des Balkens.
const ENTRIES: LegendEntry[] = [
  // --- Status-Farben (Balken + grosses Icon) ---
  {
    color: 'var(--app-color-success)',
    icon: ICON_PLUS_KREIS_GEFUELLT,
    label: 'Anmeldung möglich',
    description: 'Du kannst dich für dieses Event anmelden.',
    variants: ['konfi', 'admin'],
  },
  {
    color: 'var(--app-color-teamer)',
    icon: ICON_PLUS_KREIS_GEFUELLT,
    label: 'Anmeldung möglich (Team)',
    description: 'Für dieses Event wird Team gesucht. Du kannst dich anmelden.',
    variants: ['teamer'],
  },
  {
    color: 'var(--app-color-neutral-hell)',
    icon: ICON_INFO_GEFUELLT,
    label: 'Nur zur Info',
    description: 'Ein Konfi-Event, zu dem du dich nicht anmelden kannst.',
    variants: ['teamer'],
  },
  {
    color: 'var(--app-color-info)',
    icon: ICON_ZUSAGE_GEFUELLT,
    label: 'Angemeldet',
    description: 'Du bist für dieses Event angemeldet.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-success)',
    icon: ICON_ANWESEND,
    label: 'Anwesend',
    description: 'Deine Teilnahme wurde bestätigt.',
    variants: ['konfi', 'teamer'],
  },
  {
    color: 'var(--app-color-bonus)',
    icon: ICON_UHRZEIT,
    label: 'Anmeldung bald',
    description: 'Die Anmeldung für dieses Event ist noch nicht geöffnet.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-bonus)',
    icon: ICON_WARTEND,
    label: 'Warteliste',
    description: 'Das Event ist voll, du stehst auf der Warteliste.',
    variants: ['konfi', 'admin'],
  },
  {
    color: 'var(--app-color-bonus)',
    icon: ICON_WARTEND,
    label: 'Ausstehend',
    description: 'Das Event ist vorbei, die Anwesenheit wird noch geprüft.',
    variants: ['konfi', 'teamer'],
  },
  {
    color: 'var(--app-color-info)',
    icon: ICON_KREIS_LEER,
    label: 'Verbuchen',
    description: 'Das Event ist vorbei und muss noch verbucht werden. Wie viele es sind, zeigt die orange Zahl an den Umschaltern „Events" und „Verbuchen".',
    variants: ['admin'],
  },
  {
    color: 'var(--app-color-danger)',
    icon: ICON_ABSAGE,
    label: 'Absage / Abmeldung',
    description: 'Abgesagt, abgemeldet oder nicht anwesend gewesen.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-danger)',
    icon: ICON_SPERRE_GEFUELLT,
    label: 'Ausgebucht',
    description: 'Das Event ist voll, eine Anmeldung ist nicht mehr möglich.',
    variants: ['konfi', 'admin'],
  },
  {
    color: 'var(--app-color-neutral)',
    icon: ICON_UHRZEIT,
    label: 'Vergangen',
    description: 'Dieses Event liegt in der Vergangenheit.',
    variants: ['konfi', 'teamer', 'admin'],
  },
];

// Zusatz-Marker, die als kleine Eck-Badges (oben rechts) zusätzlich erscheinen.
const MARKERS: LegendEntry[] = [
  {
    color: 'var(--app-color-teamer)',
    icon: ICON_GRUPPE_GEFUELLT,
    label: 'Team',
    description: 'Für dieses Event wird Team gesucht (oder es ist nur für das Team).',
    // Konfis geht das nichts an -> nur Teamer/Admin.
    variants: ['teamer', 'admin'],
  },
  {
    color: 'var(--app-color-konfis)',
    icon: ICON_FLAMME_GEFUELLT,
    label: 'Konfirmation',
    description: 'Ein Event zur Konfirmation.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-events)',
    icon: ICON_SCHUTZ_GEFUELLT,
    label: 'Pflicht',
    description: 'Ein Pflicht-Event – die Teilnahme ist verbindlich.',
    variants: ['konfi', 'teamer', 'admin'],
  },
];

/**
 * Die Einträge der Legende für eine Rolle: Status-Farben und Zusatz-Marker.
 * Eine Stelle für das Modal der App und das Fenster des Browsers ab 992 px
 * (web/termine/WebLegendeDialog.tsx; Simon, 15.10.2026) -- beide zeigen
 * dieselben Einträge in derselben Reihenfolge.
 */
export const legendeFuer = (variant: EventLegendVariant): { eintraege: LegendEntry[]; markierungen: LegendEntry[] } => ({
  eintraege: ENTRIES.filter((e) => e.variants.includes(variant)),
  markierungen: MARKERS.filter((e) => e.variants.includes(variant)),
});

