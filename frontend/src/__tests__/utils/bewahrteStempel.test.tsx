// Bewahrte Stempel stehen neben den lebenden (28.09.2026).
//
// Loescht die Leitung einen Jahrgang, gehen die Challenges mit, die nur an
// ihm hingen. Die Stempel des Teams daraus liefert der Server aus einer
// eigenen Liste (bewahrte_stempel). Die Challenge-Seite und die
// Detailansicht der Leitung haengen sie an die abgeleiteten an -- sonst
// waeren sie mit der Challenge verschwunden (Simon: "Teamer und Admins
// sollten aber ihre Stempel behalten aus den Challenges").
//
// Seit 09.10.2026 gerendert: die Detailansicht der Leitung hier (Geruest
// gerueste/leitungKonfiDetail), die Challenge-Seite des Teams in
// components/stempelEineStelle.test.tsx ("bewahrte Stempel stehen neben den
// lebenden") -- dort steht schon die Seite samt Stempel-Raster.
import { zustand, api, konfi, zuruecksetzen, oeffne, KONFI_ID } from '../components/gerueste/leitungKonfiDetail';
import { describe, it, expect, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
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

describe('Detailansicht der Leitung: bewahrte Stempel einer Teamer:in', () => {
  const ROUTE = `/challenges/admin/bewahrte-stempel/${KONFI_ID}`;
  const stempelNamen = () =>
    [...document.querySelectorAll('.app-kachel .app-kachel__name')].map((n) => n.getAttribute('title'));

  beforeEach(() => {
    cleanup();
    zuruecksetzen();
  });

  it('holt sie ueber die eigene Route und zeigt sie hinter den lebenden', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({
      role_name: 'teamer', name: 'Tom', display_name: 'Tom',
      challengeMarks: [stempel(1, { badge_name: 'Lebender Stempel' })],
    }));
    zustand.antworten.set(ROUTE, [stempel(7, { badge_name: 'Aus geloeschtem Jahrgang', bewahrt: true })]);
    await oeffne();
    expect(api.get).toHaveBeenCalledWith(ROUTE);
    expect(stempelNamen()).toEqual(['Lebender Stempel', 'Aus geloeschtem Jahrgang']);
  });

  it('derselbe Stempel steht nicht doppelt', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({
      role_name: 'teamer', name: 'Tom', display_name: 'Tom',
      challengeMarks: [stempel(1, { badge_name: 'Lebender Stempel' })],
    }));
    zustand.antworten.set(ROUTE, [stempel(1, { badge_name: 'Alte Fassung', bewahrt: true })]);
    await oeffne();
    expect(stempelNamen()).toEqual(['Lebender Stempel']);
  });

  it('ein aelterer Server ohne die Route kippt die Ansicht nicht', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({
      role_name: 'teamer', name: 'Tom', display_name: 'Tom',
      challengeMarks: [stempel(1, { badge_name: 'Lebender Stempel' })],
    }));
    zustand.antworten.set(ROUTE, new Error('404'));
    await oeffne();
    expect(stempelNamen()).toEqual(['Lebender Stempel']);
  });

  it('bei Konfis wird die Route gar nicht gefragt -- bewahrt werden nur Stempel des Teams', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({
      challengeMarks: [stempel(1, { badge_name: 'Konfi-Stempel' })],
    }));
    await oeffne();
    expect(api.get).not.toHaveBeenCalledWith(ROUTE);
    expect(stempelNamen()).toEqual(['Konfi-Stempel']);
  });
});
