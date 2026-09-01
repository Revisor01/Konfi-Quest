import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { materialStats } from '../../utils/materialStats';

// Simons Wunsch (01.09.2026): Der Kopf der Materialseite soll neben Material
// und Dateien auch die Links zaehlen. Seit Migration 135 kann ein Material
// statt Dateien einen Link tragen (link_url) -- diese Eintraege tauchten in
// keiner der beiden Kacheln auf: 0 Dateien, und der Link blieb unsichtbar.
//
// Drei Werte passen ins Layout: die Stats-Zeile des SectionHeader bleibt bis
// vier Eintraege einzeilig (app-stats-row, Grid erst ab >4).

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('materialStats zaehlt Material, Dateien und Links', () => {
  it('nur Datei-Material: Links sind 0', () => {
    const s = materialStats([
      { file_count: 2 },
      { file_count: 3, link_url: null },
    ]);
    expect(s.material).toBe(2);
    expect(s.dateien).toBe(5);
    expect(s.links).toBe(0);
  });

  it('nur Link-Material: Dateien sind 0', () => {
    const s = materialStats([
      { link_url: 'https://konfi-quest.de/gottesbilder' },
      { file_count: 0, link_url: 'https://example.org' },
    ]);
    expect(s.material).toBe(2);
    expect(s.dateien).toBe(0);
    expect(s.links).toBe(2);
  });

  it('gemischt: jede Kachel zaehlt ihr eigenes', () => {
    const s = materialStats([
      { file_count: 4 },
      { link_url: 'https://konfi-quest.de/gottesbilder' },
      { file_count: 1 },
      // Alter Offline-Cache-Eintrag ohne link_url-Feld: zaehlt als Datei-
      // Material ohne Dateien, nie als Fehler.
      {},
    ]);
    expect(s.material).toBe(4);
    expect(s.dateien).toBe(5);
    expect(s.links).toBe(1);
  });

  it('leere Liste: alles 0', () => {
    const s = materialStats([]);
    expect(s.material).toBe(0);
    expect(s.dateien).toBe(0);
    expect(s.links).toBe(0);
  });
});

describe('beide Materialseiten zeigen die dritte Kachel', () => {
  it('Leitung: Kachel "Links" aus materialStats', () => {
    const seite = lies('src/components/admin/pages/AdminMaterialPage.tsx');
    expect(seite).toContain('materialStats(materials || [])');
    expect(seite).toContain("label: 'Links'");
  });

  it('Teamer: Kachel "Links" aus materialStats', () => {
    const seite = lies('src/components/teamer/pages/TeamerMaterialPage.tsx');
    expect(seite).toContain('materialStats(materials)');
    expect(seite).toContain("label: 'Links'");
  });
});
