import { describe, it, expect } from 'vitest';
import { normalisiereTeamerBadges } from '../../components/teamer/teamerBadges';

// Vorfall 29.08.2026, Abend des Rollouts: GET /teamer/badges wurde am 28.08.
// von einem Array auf { available, earned, stats } umgestellt. Die
// AUSGELIEFERTEN Apps (iOS 2.0.0, Android versionCode 81) rufen darauf
// `.filter()` auf — auf einem Objekt ein TypeError. Das Teamer-Dashboard
// stuerzte sofort nach dem Login ab, auf beiden Plattformen. Im Browser fiel
// es nicht auf, dort lief die neue Oberflaeche.
//
// Die Route liefert deshalb wieder ein Array. Diese Oberflaeche liest beide
// Formen, damit weder die heutige Antwort noch eine spaetere Umstellung
// bricht.

const b = (id: number, earned: boolean, hidden = false, unreachable = false) =>
  ({ id, earned, is_hidden: hidden, unreachable });

describe('Array-Form (was die Route heute liefert)', () => {
  const liste = [b(1, true), b(2, false), b(3, true, true), b(4, false, true)];

  it('trennt verdient und offen', () => {
    const r = normalisiereTeamerBadges(liste);
    expect(r.earned.map(x => x.id)).toEqual([1, 3]);
    expect(r.available.map(x => x.id)).toEqual([2]);
  });

  it('laesst unerreichbare Abzeichen aus den offenen heraus', () => {
    const r = normalisiereTeamerBadges([b(9, false, false, true)]);
    expect(r.available).toHaveLength(0);
  });

  it('nimmt die Zahlen aus den Kopfzeilen', () => {
    const r = normalisiereTeamerBadges(liste, {
      'x-badges-visible-total': '7',
      'x-badges-secret-total': '2',
    });
    expect(r.stats).toEqual({ totalVisible: 7, totalSecret: 2 });
  });

  it('rechnet sie aus der Liste, wenn die Kopfzeilen fehlen', () => {
    const r = normalisiereTeamerBadges(liste);
    expect(r.stats.totalVisible).toBe(2);
    expect(r.stats.totalSecret).toBe(2);
  });
});

describe('Objektform (falls die Route spaeter versioniert umgestellt wird)', () => {
  it('wird unveraendert durchgereicht', () => {
    const o = { available: [b(2, false)], earned: [b(1, true)], stats: { totalVisible: 5, totalSecret: 1 } };
    expect(normalisiereTeamerBadges(o)).toEqual(o);
  });

  it('fuellt fehlende Teile auf', () => {
    const r = normalisiereTeamerBadges({ available: [b(2, false)] });
    expect(r.earned).toEqual([]);
    expect(r.stats).toEqual({ totalVisible: 0, totalSecret: 0 });
  });
});

describe('Nichts kommt zurueck', () => {
  it('null und undefined stuerzen nicht ab', () => {
    for (const wert of [null, undefined, '', 0]) {
      const r = normalisiereTeamerBadges(wert);
      expect(r.available).toEqual([]);
      expect(r.earned).toEqual([]);
    }
  });

  it('ein unbekanntes Objekt liefert Leeres statt zu werfen', () => {
    const r = normalisiereTeamerBadges({ irgendwas: 1 });
    expect(r.available).toEqual([]);
  });
});
