// Kleine Helfer ohne eigenen Test (Audit Tests 26.09.2026, BF-10):
// Zaehler je Gemeinde, Dateigroessen, Suche in Verwaltungslisten,
// Grossschreibung im Chat. Aufgerufen wird die echte Funktion.
import { describe, it, expect } from 'vitest';
import { offenJeOrgAusAntwort, summeAllerGemeindenAusAntwort } from '../../utils/offenJeGemeinde';
import { formatFileSize, filterBySearchTerm, filterByJahrgang } from '../../utils/helpers';
import { autoCapitalize } from '../../utils/chatGrossschreibung';

describe('Offenes je Gemeinde (rote Zahl am Gemeinde-Umschalter und am App-Symbol)', () => {
  // So antwortet GET /notifications/badge-counts/je-organisation.
  const antwort = { jeOrganisation: { 1: { offen: 3 }, 2: { offen: 0 }, 5: { offen: 7 } } };

  it('liest je Gemeinde die Zahl; Gemeinden ohne Offenes stehen nicht darin', () => {
    expect(offenJeOrgAusAntwort(antwort)).toEqual({ 1: 3, 5: 7 });
  });

  it('das App-Symbol zeigt die Summe ueber alle Gemeinden', () => {
    expect(summeAllerGemeindenAusAntwort(antwort)).toBe(10);
  });

  it('nichts offen: am Umschalter keine Zahl, am Symbol 0 (nicht "unbekannt")', () => {
    const leer = { jeOrganisation: { 1: { offen: 0 } } };
    expect(offenJeOrgAusAntwort(leer)).toEqual({});
    expect(summeAllerGemeindenAusAntwort(leer)).toBe(0);
  });

  it('aelterer Server ohne das Feld: am Umschalter nichts, am Symbol null (die alte Zahl bleibt)', () => {
    for (const alt of [{}, null, undefined, { jeOrganisation: null }, { jeOrganisation: 'kaputt' }]) {
      expect(offenJeOrgAusAntwort(alt)).toEqual({});
      expect(summeAllerGemeindenAusAntwort(alt)).toBe(null);
    }
  });

  it('Unsinn in einzelnen Eintraegen zaehlt als 0, statt die Summe zu verderben', () => {
    const gemischt = { jeOrganisation: { 1: { offen: 'zwei' }, 2: null, 3: { offen: 4 }, x: { offen: 9 } } };
    expect(offenJeOrgAusAntwort(gemischt)).toEqual({ 3: 4 });
    expect(summeAllerGemeindenAusAntwort(gemischt)).toBe(4);
  });
});

describe('Dateigroessen (Chat, Material, Medien-Cache)', () => {
  it.each([
    [0, '0 Bytes'],
    [512, '512 Bytes'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
    [1.25 * 1024 * 1024 * 1024, '1.25 GB'],
  ])('%i Bytes -> %s', (bytes, erwartet) => {
    expect(formatFileSize(bytes)).toBe(erwartet);
  });
});

describe('Suche in den Verwaltungslisten', () => {
  const liste = [
    { name: 'Anna Meier', username: 'anna.m', jahrgang: '2025/26' },
    { name: 'Ben Krause', username: 'benk', jahrgang: '2026/27' },
    { name: 'Clara', username: null, jahrgang: '2026/27' },
  ];

  it('findet ohne Ruecksicht auf Gross- und Kleinschreibung im Namen', () => {
    expect(filterBySearchTerm(liste, 'MEIER').map((p) => p.name)).toEqual(['Anna Meier']);
  });

  it('sucht in allen angegebenen Feldern und uebergeht leere Felder', () => {
    expect(filterBySearchTerm(liste, 'benk', ['name', 'username']).map((p) => p.name)).toEqual(['Ben Krause']);
    expect(filterBySearchTerm(liste, 'null', ['username'])).toEqual([]);
  });

  it('ohne Suchbegriff bleibt die Liste, wie sie ist', () => {
    expect(filterBySearchTerm(liste, '')).toBe(liste);
  });

  it('Jahrgangsfilter: "alle" oder leer zeigt alle, sonst genau den Jahrgang', () => {
    expect(filterByJahrgang(liste, 'alle')).toBe(liste);
    expect(filterByJahrgang(liste, '')).toBe(liste);
    expect(filterByJahrgang(liste, '2026/27').map((p) => p.name)).toEqual(['Ben Krause', 'Clara']);
  });
});

describe('Grossschreibung beim Tippen im Chat', () => {
  it.each([
    ['h', 'H'],
    ['  h', '  H'],
    ['Hallo. w', 'Hallo. W'],
    ['Echt? j', 'Echt? J'],
    ['Super! ü', 'Super! Ü'],
  ])('am Satzanfang: %j -> %j', (eingabe, erwartet) => {
    expect(autoCapitalize(eingabe)).toBe(erwartet);
  });

  it.each([
    ['Hallo w'],
    ['Hallo.w'],
    ['www.beispiel.d'],
    ['5'],
    ['Hallo. '],
    [''],
  ])('mitten im Satz, ohne Leerzeichen nach dem Punkt oder kein Buchstabe: %j bleibt', (eingabe) => {
    expect(autoCapitalize(eingabe)).toBe(eingabe);
  });
});
