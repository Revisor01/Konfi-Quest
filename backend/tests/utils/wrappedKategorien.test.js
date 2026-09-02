/**
 * Tests fuer die Kategorie- und Datumslogik des Jahresrueckblicks.
 *
 * Der wichtigste Test hier ist der LISTEN-ABGLEICH ganz unten: Laufen
 * STANDARD_SEITEN (wrappedKategorien.js) und defaultCategories
 * (routes/organizations.js) auseinander, entstehen Kategorien ohne Seite
 * oder Seiten ohne Kategorie -- und das faellt sonst niemandem auf, weil
 * beides fuer sich genommen funktioniert.
 */

const fs = require('fs');
const path = require('path');
const {
  ostersonntag,
  ersterAdvent,
  aschermittwoch,
  erntedank,
  datumsFenster,
  seiteFuerKategorie,
  STANDARD_SEITEN,
  NUR_TEAMER
} = require('../../utils/wrappedKategorien');

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('Bewegliche Feiertage', () => {
  // Sollwerte aus dem Kirchenkalender. Nicht aus dem Code abgeleitet --
  // sonst prueft der Test nur, dass der Code tut, was er tut.
  test.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'] // spaetestmoeglicher Ostertermin
  ])('Ostersonntag %i ist %s', (jahr, soll) => {
    expect(iso(ostersonntag(jahr))).toBe(soll);
  });

  test.each([
    [2023, '2023-12-03'], // spaetestmoeglicher 1. Advent
    [2025, '2025-11-30'],
    [2026, '2026-11-29'],
    [2027, '2027-11-28'] // frueher Fall
  ])('1. Advent %i ist %s', (jahr, soll) => {
    expect(iso(ersterAdvent(jahr))).toBe(soll);
  });

  test('1. Advent ist immer ein Sonntag', () => {
    for (let jahr = 2024; jahr <= 2040; jahr += 1) {
      expect(ersterAdvent(jahr).getDay()).toBe(0);
    }
  });

  test('Aschermittwoch liegt 46 Tage vor Ostern', () => {
    expect(iso(aschermittwoch(2026))).toBe('2026-02-18');
    const diff = (ostersonntag(2026) - aschermittwoch(2026)) / (24 * 60 * 60 * 1000);
    expect(Math.round(diff)).toBe(46);
  });

  test('Erntedank ist der erste Sonntag im Oktober', () => {
    expect(iso(erntedank(2026))).toBe('2026-10-04');
    expect(erntedank(2026).getDay()).toBe(0);
  });
});

describe('datumsFenster', () => {
  test('Heiligabend zaehlt als Weihnachten, nicht als Advent', () => {
    // Reihenfolge-Falle: Das Advent-Fenster (1. Advent bis 23.12.) darf den
    // 24.12. nicht schlucken.
    expect(datumsFenster(new Date(2026, 11, 24))).toBe('weihnachten');
    expect(datumsFenster(new Date(2026, 11, 26))).toBe('weihnachten');
  });

  test('Advent beginnt am 1. Advent und endet am 23.12.', () => {
    expect(datumsFenster(new Date(2026, 10, 29))).toBe('advent'); // 1. Advent 2026
    expect(datumsFenster(new Date(2026, 11, 23))).toBe('advent');
    expect(datumsFenster(new Date(2026, 10, 28))).not.toBe('advent'); // Tag davor
  });

  test('Jahreswechsel laeuft ueber den Jahresbruch', () => {
    expect(datumsFenster(new Date(2026, 11, 27))).toBe('jahreswechsel');
    expect(datumsFenster(new Date(2027, 0, 6))).toBe('jahreswechsel');
    expect(datumsFenster(new Date(2027, 0, 7))).toBeNull();
  });

  test('Passion und Ostern', () => {
    expect(datumsFenster(new Date(2026, 1, 18))).toBe('ostern'); // Aschermittwoch
    expect(datumsFenster(new Date(2026, 3, 5))).toBe('ostern');  // Ostersonntag
    expect(datumsFenster(new Date(2026, 3, 6))).toBe('ostern');  // Ostermontag
    expect(datumsFenster(new Date(2026, 3, 7))).toBeNull();      // Dienstag danach
  });

  test('Sommer sind Juli und August', () => {
    expect(datumsFenster(new Date(2026, 6, 15))).toBe('sommer');
    expect(datumsFenster(new Date(2026, 7, 31))).toBe('sommer');
    expect(datumsFenster(new Date(2026, 8, 1))).toBeNull();
  });

  test('gewoehnliche Termine treffen kein Fenster', () => {
    expect(datumsFenster(new Date(2026, 4, 15))).toBeNull();
    expect(datumsFenster(new Date(2026, 9, 20))).toBeNull();
  });

  test('Uhrzeit kippt einen Termin nicht aus dem Fenster', () => {
    // Ein Gottesdienst um 23 Uhr an Heiligabend bleibt Heiligabend.
    expect(datumsFenster(new Date(2026, 11, 24, 23, 30))).toBe('weihnachten');
  });

  test('kaputte Eingaben werfen nicht', () => {
    expect(datumsFenster(null)).toBeNull();
    expect(datumsFenster(undefined)).toBeNull();
    expect(datumsFenster('kein datum')).toBeNull();
  });
});

describe('seiteFuerKategorie', () => {
  test('erkennt jede unserer Standardkategorien', () => {
    for (const anzeigename of Object.values(STANDARD_SEITEN)) {
      expect(seiteFuerKategorie(anzeigename)).not.toBeNull();
    }
  });

  test('toleriert Schreibweise, aber erfindet keine Treffer', () => {
    expect(seiteFuerKategorie('freizeit')).toBe('freizeit');
    expect(seiteFuerKategorie('  Freizeit  ')).toBe('freizeit');
    expect(seiteFuerKategorie('FREIZEIT')).toBe('freizeit');
  });

  test('fremde Namen geben null -- das ist die Regel, kein Loch', () => {
    // Simon (03.09.2026): "Alles was andere anlegen ist uns egal. Dann
    // faellt es runter." Diese Namen existieren real in Org 1, 3 und 5.
    for (const fremd of ['Sonntag', 'Gruppen/ Treffen', 'Aktion', 'Konfitreff',
      'Urlauberseelsorge', 'Seniorinnen', 'Gottesdienst an Weihnachten']) {
      expect(seiteFuerKategorie(fremd)).toBeNull();
    }
  });

  test('"Unterricht" bekommt keine Seite', () => {
    // Simon: "Es heisst bewusst Konfi Zeit!" Der Begriff faellt ersatzlos weg.
    expect(seiteFuerKategorie('Unterricht')).toBeNull();
  });

  test('leere und kaputte Eingaben geben null', () => {
    expect(seiteFuerKategorie('')).toBeNull();
    expect(seiteFuerKategorie(null)).toBeNull();
    expect(seiteFuerKategorie(undefined)).toBeNull();
    expect(seiteFuerKategorie(42)).toBeNull();
  });

  test('Teamtreff ist als reine Teamer-Seite markiert', () => {
    expect(NUR_TEAMER.has('teamtreff')).toBe(true);
    expect(NUR_TEAMER.has('freizeit')).toBe(false);
  });
});

describe('Listen-Abgleich mit routes/organizations.js', () => {
  // Der Test, der die stille Fehlerquelle abdeckt: Wenn jemand eine
  // Standardkategorie ergaenzt oder umbenennt, ohne STANDARD_SEITEN
  // nachzuziehen, entsteht eine Kategorie ohne Seite -- sichtbar erst
  // dann, wenn eine Gemeinde sie benutzt und der Rueckblick sie ignoriert.
  const quelle = fs.readFileSync(
    path.join(__dirname, '../../routes/organizations.js'), 'utf8'
  );
  const block = quelle.slice(
    quelle.indexOf('const defaultCategories = ['),
    quelle.indexOf('];', quelle.indexOf('const defaultCategories = ['))
  );
  const standardNamen = [...block.matchAll(/name: '([^']+)'/g)].map(m => m[1]);

  test('die Liste in organizations.js ist lesbar', () => {
    expect(standardNamen.length).toBeGreaterThanOrEqual(10);
  });

  test('jede Standardkategorie hat eine Wrapped-Seite', () => {
    const ohneSeite = standardNamen.filter(n => seiteFuerKategorie(n) === null);
    expect(ohneSeite).toEqual([]);
  });

  test('jede Wrapped-Seite hat eine Standardkategorie', () => {
    const ohneKategorie = Object.values(STANDARD_SEITEN)
      .filter(anzeige => !standardNamen.includes(anzeige));
    expect(ohneKategorie).toEqual([]);
  });

  test('"Unterricht" steht nicht mehr im Standard', () => {
    expect(standardNamen).not.toContain('Unterricht');
  });
});
