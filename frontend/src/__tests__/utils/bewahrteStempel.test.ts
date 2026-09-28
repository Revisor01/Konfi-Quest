// Bewahrte Stempel stehen neben den lebenden (28.09.2026).
//
// Loescht die Leitung einen Jahrgang, gehen die Challenges mit, die nur an
// ihm hingen. Die Stempel des Teams daraus liefert der Server aus einer
// eigenen Liste (bewahrte_stempel). Die Challenge-Seite und die
// Detailansicht der Leitung haengen sie an die abgeleiteten an -- sonst
// waeren sie mit der Challenge verschwunden (Simon: "Teamer und Admins
// sollten aber ihre Stempel behalten aus den Challenges").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { mitBewahrtenStempeln } from '../../utils/bewahrteStempel';
import type { ChallengeMark } from '../../types/challenges';

const stempel = (challenge_id: number, extra: Partial<ChallengeMark> = {}): ChallengeMark => ({
  challenge_id, badge_icon: 'leaf', badge_name: `Stempel ${challenge_id}`, title: `Challenge ${challenge_id}`, ...extra
});

describe('mitBewahrtenStempeln', () => {
  it('haengt die bewahrten an die lebenden an', () => {
    const ergebnis = mitBewahrtenStempeln([stempel(1)], [stempel(7, { bewahrt: true })]);
    expect(ergebnis.map((s) => s.challenge_id)).toEqual([1, 7]);
    expect(ergebnis[1].bewahrt).toBe(true);
  });

  it('zeigt denselben Stempel nie doppelt -- die lebende Fassung gewinnt', () => {
    const ergebnis = mitBewahrtenStempeln([stempel(1)], [stempel(1, { bewahrt: true, badge_name: 'alt' })]);
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0].badge_name).toBe('Stempel 1');
  });

  it('nimmt alles, was keine Liste ist, als leer (aelterer Server, Fehler, noch nicht geladen)', () => {
    const lebende = [stempel(1)];
    expect(mitBewahrtenStempeln(lebende, null)).toEqual(lebende);
    expect(mitBewahrtenStempeln(lebende, undefined)).toEqual(lebende);
    expect(mitBewahrtenStempeln(lebende, { error: 'Not found' })).toEqual(lebende);
    expect(mitBewahrtenStempeln(lebende, [null, { challenge_id: 'x' }])).toEqual(lebende);
  });
});

describe('beide Stempel-Stellen des Teams lesen die bewahrten mit', () => {
  const ohneKommentare = (pfad: string) => readFileSync(resolve(__dirname, '../../', pfad), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('Challenge-Seite ("Deine Stempel"): eigene Route und Zusammenfuehrung', () => {
    const seite = ohneKommentare('components/shared/ChallengesPage.tsx');
    expect(seite).toContain("api.get('/challenges/bewahrte-stempel')");
    expect(seite).toMatch(/mitBewahrtenStempeln\(abgeleiteteMarks, bewahrteStempel\)/);
  });

  it('Detailansicht der Leitung: bewahrte Stempel einer Teamer:in', () => {
    const detail = ohneKommentare('components/admin/views/KonfiDetailView.tsx');
    expect(detail).toContain('/challenges/admin/bewahrte-stempel/${konfiId}');
    expect(detail).toMatch(/marks=\{mitBewahrtenStempeln\(currentKonfi\?\.challengeMarks \|\| \[\], bewahrteStempel\)\}/);
  });
});
