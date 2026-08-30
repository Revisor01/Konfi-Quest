import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Beim Typisieren aufgefallen (30.08.2026): Der Typ RankingEntry fuehrte
// `user_id` und `total_points`. GET /konfi/dashboard liefert die Ranking-Liste
// aber mit `id` und `points` (konfi.js, rankingSql). Der Widerspruch fiel nie
// auf, weil die Ranking-Ansicht ihre Liste intern als `any[]` fuehrte und die
// Eintraege vor der Ausgabe erneut per Inline-Cast beschrieb — mit den
// RICHTIGEN Namen. Der zentrale Typ war damit reine Fehlinformation fuer jeden,
// der ihn benutzt haette.
//
// Jetzt stimmt der Typ mit der Antwort ueberein; die Trennzeile ("...") ist als
// eigener Fall modelliert, statt ein Ranking-Eintrag ohne Pflichtfelder zu sein.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const typen = lies('src/types/dashboard.ts');
const abschnitte = lies('src/components/konfi/views/DashboardSections.tsx');
const route = lies('../backend/routes/konfi.js');

describe('Ranking-Feldnamen', () => {
  it('der Typ fuehrt id und points wie die API', () => {
    const block = typen.slice(
      typen.indexOf('export interface RankingEntry'),
      typen.indexOf('export interface RankingTrenner')
    );
    expect(block).toContain('id: number | string;');
    expect(block).toContain('points: number | null;');
    expect(block).not.toContain('user_id');
    expect(block).not.toContain('total_points');
  });

  it('das Backend liefert genau diese Felder', () => {
    const sql = route.slice(route.indexOf('const rankingSql'), route.indexOf('const rankingSql') + 600);
    expect(sql).toContain('SELECT u.id, u.display_name');
    expect(sql).toContain(') as points');
  });

  it('die Trennzeile ist ein eigener Fall statt eines luecken Eintrags', () => {
    expect(typen).toContain('export interface RankingTrenner');
    expect(typen).toContain('export type RankingZeile = RankingEntry | RankingTrenner;');
    expect(abschnitte).toContain('const playersToShow: RankingZeile[] = [];');
    expect(abschnitte).toContain("if ('separator' in item)");
  });
});
