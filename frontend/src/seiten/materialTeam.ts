// Material fürs Team (/teamer/profile/material bzw. der Reiter Material).
// App: components/teamer/pages/TeamerMaterialPage.tsx. Web:
// components/teamer/web/material/WebTeamerMaterial.tsx (bekommt die schon
// gefilterte Liste von der Seite). Die Seite filtert auf dem Gerät; das
// Prädikat steht hier, damit beide Fassungen dieselbe Liste zeigen.
//
// Die Suchfelder selbst (Beschriftung, Platzhalter) stehen als Literale in
// den Seiten: begriffeEinheitlich.test.ts und rollenGleichbehandlung.test.ts
// lesen sie dort.

import { suchTreffer, suchbegriff } from '../utils/supportWeb';

/** Titel der App. */
export const MATERIAL_TEAM_TITEL = 'Material';
/**
 * Titel der Web-Fassung. Bewusst anders: Im Browser steht über dem Titel
 * schon der Bereich „Material"; „Material" darunter noch einmal sagte nichts.
 */
export const MATERIAL_TEAM_TITEL_WEB = 'Material fürs Team';
export const MATERIAL_TEAM_UNTERTITEL = 'Dokumente und Dateien';

export const MATERIAL_ALLE_JAHRGAENGE = 'Alle Jahrgänge';

interface Durchsuchbar {
  title: string;
  description?: string | null;
  jahrgaenge?: ReadonlyArray<{ id: number }>;
}

/**
 * Passt ein Material zu Suche und Jahrgang? Gesucht wird in Titel und
 * Beschreibung, ohne Leerzeichen am Rand und mit gefalteten Umlauten
 * („mueller" findet „Müller") -- wie die übrigen Suchen der Web-Fassung.
 * Bis 09.10.2026 verglich die Seite roh: Eine Suche aus Leerzeichen fand
 * nichts, und der Browser meldete „Noch keine Materialien vorhanden.".
 */
export function materialPasst(m: Durchsuchbar, suche: string, jahrgangId?: number): boolean {
  if (jahrgangId !== undefined && !m.jahrgaenge?.some((j) => j.id === jahrgangId)) return false;
  if (!suchbegriff(suche)) return true;
  return suchTreffer(m.title, suche).length > 0 || suchTreffer(m.description ?? '', suche).length > 0;
}

/** Der Leerzustand der Liste: ohne oder mit Suche bzw. Jahrgang. */
export function materialTeamLeer(eingegrenzt: boolean): { titel: string; text: string } {
  return {
    titel: 'Keine Materialien',
    text: eingegrenzt ? 'Versuche andere Suchbegriffe oder einen anderen Jahrgang.' : 'Noch keine Materialien vorhanden.',
  };
}
