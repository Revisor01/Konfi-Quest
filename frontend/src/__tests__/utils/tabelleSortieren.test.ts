// Sortieren einer Tabelle nach einer Spalte (Simon, 07.10.2026: „bitte alle
// listen sortierbar machen durch klick auf den spaltennamen").
import { describe, it, expect } from 'vitest';
import { naechsteSortierung, sortiereZeilen, ariaSortVon } from '../../utils/tabelleSortieren';

const namen = (z: Array<{ n: string }>) => z.map((x) => x.n);

describe('sortiereZeilen', () => {
  it('Texte nach deutscher Ordnung: Umlaute, Gross/klein egal, Zahlen natuerlich', () => {
    const z = [{ n: 'Zoe' }, { n: 'Ömer' }, { n: 'anna' }, { n: 'Gruppe 10' }, { n: 'Gruppe 2' }, { n: 'Oliver' }];
    expect(namen(sortiereZeilen(z, (x) => x.n, 'auf'))).toEqual(['anna', 'Gruppe 2', 'Gruppe 10', 'Oliver', 'Ömer', 'Zoe']);
    expect(namen(sortiereZeilen(z, (x) => x.n, 'ab'))).toEqual(['Zoe', 'Ömer', 'Oliver', 'Gruppe 10', 'Gruppe 2', 'anna']);
  });

  it('Zahlen und Daten numerisch, nicht als Text', () => {
    const z = [{ n: 'a', p: 10 }, { n: 'b', p: 9 }, { n: 'c', p: 100 }];
    expect(namen(sortiereZeilen(z, (x) => x.p, 'auf'))).toEqual(['b', 'a', 'c']);
    const d = [{ n: 'spaet', d: new Date('2026-10-07') }, { n: 'frueh', d: new Date('2026-01-01') }];
    expect(namen(sortiereZeilen(d, (x) => x.d, 'auf'))).toEqual(['frueh', 'spaet']);
  });

  it('leere Werte stehen in beiden Richtungen unten; Gleiche behalten die Reihenfolge der Seite', () => {
    const z = [{ n: 'leer1', w: null }, { n: 'x1', w: 'x' }, { n: 'a', w: 'a' }, { n: 'leer2', w: '' }, { n: 'x2', w: 'x' }];
    expect(namen(sortiereZeilen(z, (x) => x.w, 'auf'))).toEqual(['a', 'x1', 'x2', 'leer1', 'leer2']);
    expect(namen(sortiereZeilen(z, (x) => x.w, 'ab'))).toEqual(['x1', 'x2', 'a', 'leer1', 'leer2']);
  });

  it('veraendert die uebergebene Liste nicht', () => {
    const z = [{ n: 'b' }, { n: 'a' }];
    sortiereZeilen(z, (x) => x.n, 'auf');
    expect(namen(z)).toEqual(['b', 'a']);
  });
});

describe('naechsteSortierung und ariaSortVon', () => {
  it('erster Klick aufsteigend, zweiter absteigend, andere Spalte wieder aufsteigend', () => {
    const eins = naechsteSortierung(null, 'name');
    expect(eins).toEqual({ schluessel: 'name', richtung: 'auf' });
    expect(naechsteSortierung(eins, 'name')).toEqual({ schluessel: 'name', richtung: 'ab' });
    expect(naechsteSortierung({ schluessel: 'name', richtung: 'ab' }, 'datum')).toEqual({ schluessel: 'datum', richtung: 'auf' });
  });

  it('aria-sort nur an sortierbaren Spalten', () => {
    expect(ariaSortVon(false, null, 'x')).toBeUndefined();
    expect(ariaSortVon(true, null, 'x')).toBe('none');
    expect(ariaSortVon(true, { schluessel: 'x', richtung: 'ab' }, 'x')).toBe('descending');
  });
});
