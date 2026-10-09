// Der Katalog der Aktivitäten unter Mehr (/admin/activities): die Vorlagen,
// für die es Punkte gibt.
// App: components/admin/pages/AdminActivitiesPage.tsx mit admin/ActivitiesView.tsx.
// Web: components/admin/web/termine/WebAktivitaetenSeite.tsx und WebAktivitaeten.tsx.

import { wahlen } from './beschreibung';

export const KATALOG_TITEL = 'Aktivitäten';

/** Für wen die Aktivitäten gelten. Team-Aktivitäten tragen keine Punkte und keine Art. */
export const KATALOG_ROLLE = wahlen([
  { schluessel: 'konfi', label: 'Konfis' },
  { schluessel: 'teamer', label: 'Team' },
]);
export const KATALOG_ROLLE_BESCHRIFTUNG = 'Aktivitäten für';

/**
 * Der Untertitel folgt der Rolle -- in App und Browser gleich. Bis 09.10.2026
 * sagte der Browser auch beim Team „Hier legst du fest, wofür es Punkte
 * gibt", obwohl Team-Aktivitäten keine Punkte tragen.
 */
export const katalogUntertitel = (rolle: 'konfi' | 'teamer'): string =>
  rolle === 'teamer' ? 'Aktivitäten fürs Team' : 'Punkte und Aufgaben';

interface MitArt { type?: string | null }

/** Die Art der Konfi-Aktivitäten; beim Team gibt es keine Art und keinen Filter. */
export const KATALOG_ART = wahlen([
  { schluessel: 'alle', label: 'Alle', passt: () => true },
  { schluessel: 'gemeinde', label: 'Gemeinde', passt: (a: MitArt) => a.type === 'gemeinde' },
  // Drei Reiter in der Breite eines Telefons; bis 09.10.2026 stand an der Kachel darüber „Godi".
  { schluessel: 'gottesdienst', label: 'Gottesdienst', kurz: 'GoDi', passt: (a: MitArt) => a.type === 'gottesdienst' },
]);
export const KATALOG_ART_BESCHRIFTUNG = 'Aktivitäten nach Art';
export type KatalogArt = (typeof KATALOG_ART)[number]['schluessel'];

export const KATALOG_LEER = {
  titel: 'Keine Aktivitäten gefunden',
  text: 'Noch keine Aktivitäten angelegt',
  /** Die Suche findet nichts -- dann stimmt „Noch keine angelegt" nicht. */
  suche: 'Versuche andere Suchbegriffe',
} as const;
