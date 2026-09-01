// Kennzahlen fuer den Kopf der Materialseite (AdminMaterialPage).
//
// Simons Wunsch (01.09.2026): neben Material und Dateien auch die Links
// zaehlen. Seit Migration 135 kann ein Material statt Dateien einen Link
// tragen (link_url) -- die Zahl der Materialien MIT Link ist die dritte
// Angabe. Die Rechnung steht hier als eigene Funktion, damit sie mit
// konkreten Zahlen testbar ist und die Seite nur noch anzeigt.
//
// Eintraege aus einem aelteren Offline-Cache koennen link_url gar nicht
// haben -- fehlend zaehlt wie leer, also "kein Link", nie ein Fehler.

export interface MaterialFuerStats {
  file_count?: number;
  link_url?: string | null;
}

export interface MaterialKennzahlen {
  material: number;
  dateien: number;
  links: number;
}

export const materialStats = (materials: MaterialFuerStats[]): MaterialKennzahlen => ({
  material: materials.length,
  dateien: materials.reduce((sum, m) => sum + (m.file_count || 0), 0),
  links: materials.filter((m) => !!m.link_url).length,
});
