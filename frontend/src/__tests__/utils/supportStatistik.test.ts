import { describe, it, expect } from 'vitest';
import { kennzahlenBaum, summeKurz, summeVon, OHNE_KIRCHENKREIS, OHNE_LANDESKIRCHE } from '../../utils/supportStatistik';
import type { GemeindeKennzahlen } from '../../types/support';

// Zusammenfassen der Kennzahlen je Landeskirche und Kirchenkreis (Support-
// Ansicht, Web-Version). Der Server liefert je Gemeinde; Gesamtzeile, Baum
// und "ohne Zuordnung" rechnet die Oberflaeche an einer Stelle.

const g = (
  id: number, name: string, kk: [number, string] | null, lk: [number, string] | null,
  [konfi, teamer, admin, org_admin]: number[], aktiv = 0, jahrgaenge = 0, is_active = true
): GemeindeKennzahlen => ({
  id, name, is_active,
  kirchenkreis_id: kk?.[0] ?? null, kirchenkreis: kk?.[1] ?? null,
  landeskirche_id: lk?.[0] ?? null, landeskirche: lk?.[1] ?? null,
  konten: { konfi, teamer, admin, org_admin }, aktiv_30_tage: aktiv, jahrgaenge,
});

const NORD: [number, string] = [1, 'Nordkirche'];
const BAYERN: [number, string] = [2, 'Bayern'];

describe('summeVon', () => {
  it('zaehlt die vier Rollen zu Konten zusammen, aktive Gemeinde als 1', () => {
    expect(summeVon(g(1, 'A', null, null, [10, 3, 2, 1], 7, 2))).toEqual({
      gemeinden: 1, aktiveGemeinden: 1, konfis: 10, teamer: 3, leitung: 2, gemeindeleitung: 1,
      konten: 16, aktiv30: 7, jahrgaenge: 2,
    });
  });

  it('ein fehlendes oder kaputtes Feld zaehlt 0 statt NaN', () => {
    const kaputt = { ...g(1, 'A', null, null, [1, 1, 1, 1]), konten: { konfi: 4 } as never, aktiv_30_tage: null as never };
    const s = summeVon(kaputt);
    expect(s.konten).toBe(4);
    expect(s.aktiv30).toBe(0);
  });

  it('eine gesperrte Gemeinde zaehlt, aber nicht als aktiv', () => {
    expect(summeVon(g(1, 'A', null, null, [1, 0, 0, 0], 0, 0, false))).toMatchObject({ gemeinden: 1, aktiveGemeinden: 0 });
  });
});

describe('kennzahlenBaum', () => {
  const gemeinden = [
    g(3, 'Wesselburen', [11, 'Dithmarschen'], NORD, [30, 8, 2, 1], 25, 2),
    g(1, 'Büsum', [11, 'Dithmarschen'], NORD, [20, 4, 1, 1], 10, 1),
    g(2, 'Plön', [12, 'Plön-Segeberg'], NORD, [5, 1, 0, 1], 2, 1),
    g(4, 'München', [21, 'München'], BAYERN, [8, 2, 1, 1], 3, 1),
    g(5, 'Dom Schwerin', null, null, [12, 3, 0, 1], 5, 1, false),
    g(6, 'Rostock', [31, 'Mecklenburg'], null, [2, 0, 0, 1], 1, 1),
  ];
  const baum = kennzahlenBaum(gemeinden);

  it('Gesamt ist die Summe aller Gemeinden; "ohne Zuordnung" zaehlt Gemeinden ohne Kirchenkreis', () => {
    expect(baum.gesamt).toEqual({
      gemeinden: 6, aktiveGemeinden: 5, konfis: 77, teamer: 18, leitung: 4, gemeindeleitung: 6,
      konten: 105, aktiv30: 46, jahrgaenge: 7,
    });
    expect(baum.ohneZuordnung).toBe(1);
  });

  it('Landeskirchen alphabetisch, "Ohne Landeskirche" zuletzt', () => {
    expect(baum.landeskirchen.map((l) => l.name)).toEqual(['Bayern', 'Nordkirche', OHNE_LANDESKIRCHE]);
  });

  it('je Landeskirche die Summe ihrer Kirchenkreise, je Kirchenkreis seiner Gemeinden', () => {
    const nord = baum.landeskirchen[1];
    expect(nord.summe).toMatchObject({ gemeinden: 3, konfis: 55, konten: 74 });
    expect(nord.kirchenkreise.map((k) => [k.name, k.summe.gemeinden, k.summe.konfis])).toEqual([
      ['Dithmarschen', 2, 50],
      ['Plön-Segeberg', 1, 5],
    ]);
    // Gemeinden alphabetisch, mit deutscher Sortierung (Büsum vor Wesselburen).
    expect(nord.kirchenkreise[0].gemeinden.map((x) => x.name)).toEqual(['Büsum', 'Wesselburen']);
  });

  it('ohne Landeskirche: Kirchenkreise ohne Landeskirche und dahinter "Ohne Kirchenkreis"', () => {
    const ohne = baum.landeskirchen[2];
    expect(ohne.id).toBeNull();
    expect(ohne.kirchenkreise.map((k) => k.name)).toEqual(['Mecklenburg', OHNE_KIRCHENKREIS]);
    expect(ohne.kirchenkreise[1].gemeinden.map((x) => x.name)).toEqual(['Dom Schwerin']);
  });

  it('die Summen der Landeskirchen ergeben das Gesamt', () => {
    const summe = baum.landeskirchen.reduce((s, l) => s + l.summe.konten, 0);
    expect(summe).toBe(baum.gesamt.konten);
  });

  it('Schluessel sind eindeutig, auch fuer zwei "Ohne Kirchenkreis"-Gruppen', () => {
    const zweiOhne = kennzahlenBaum([
      g(1, 'A', null, null, [1, 0, 0, 0]),
      { ...g(2, 'B', null, NORD, [1, 0, 0, 0]) },
    ]);
    const schluessel = zweiOhne.landeskirchen.flatMap((l) => [l.schluessel, ...l.kirchenkreise.map((k) => k.schluessel)]);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });

  it('leer: alles 0, keine Gruppen', () => {
    const leer = kennzahlenBaum([]);
    expect(leer.gesamt.gemeinden).toBe(0);
    expect(leer.landeskirchen).toEqual([]);
    expect(leer.ohneZuordnung).toBe(0);
  });
});

describe('summeKurz', () => {
  it('Einzahl und Mehrzahl, Leitung mit Gemeindeleitung zusammen', () => {
    expect(summeKurz(summeVon(g(1, 'A', null, null, [1, 2, 1, 1], 1234)))).toBe('1 Konfi · 2 Team · 2 Leitung · 1.234 aktiv');
  });
});
