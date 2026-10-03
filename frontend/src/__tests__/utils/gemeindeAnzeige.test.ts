import { describe, it, expect } from 'vitest';
import { gemeindeInitiale, gemeindeName, rolleInGemeinde } from '../../utils/gemeindeAnzeige';

// Wie eine Gemeinde im Umschalter der Leiste aussieht (Web-Version,
// 03.10.2026): voller Name, Rolle dort, ein Buchstabe fuers Symbol.

describe('gemeindeName', () => {
  it('der Anzeigename, sonst der Name -- wie in der Liste der Kopfzeile', () => {
    expect(gemeindeName({ name: 'kirchspiel-west', display_name: 'Kirchspiel West' })).toBe('Kirchspiel West');
    expect(gemeindeName({ name: 'Kirchengemeinde Musterdorf' })).toBe('Kirchengemeinde Musterdorf');
    expect(gemeindeName({ name: 'Kirchengemeinde Musterdorf', display_name: '' })).toBe('Kirchengemeinde Musterdorf');
  });

  it('ohne Gemeinde: leer, kein Fehler', () => {
    expect(gemeindeName(undefined)).toBe('');
  });
});

describe('gemeindeInitiale', () => {
  it.each([
    // Das allgemeine Vorwort unterscheidet nichts -- der Ort zaehlt.
    ['Kirchengemeinde Musterdorf', 'M'],
    ['Kirchengemeinde Beispielstadt', 'B'],
    ['Kirchspiel West', 'W'],
    ['Evangelisch-Lutherische Kirchengemeinde Musterdorf', 'M'],
    ['Ev.-Luth. Kirchengemeinde Nordheim', 'N'],
    ['Ev. Kirchengemeinde Ostfeld', 'O'],
    ['Gemeinde Sued', 'S'],
    // Kein Vorwort: der erste Buchstabe.
    ['Test-Demo', 'T'],
    ['musterdorf', 'M'],
    ['Östlich', 'Ö'],
    // Ein Wort, das nur mit dem Vorwort beginnt, ist kein Vorwort.
    ['Kirchenkreis Mitte', 'K'],
    ['Gemeindehaus Mitte', 'G'],
  ])('%s -> %s', (name, erwartet) => {
    expect(gemeindeInitiale(name)).toBe(erwartet);
  });

  it('besteht der Name nur aus dem Vorwort, gilt der volle Name', () => {
    expect(gemeindeInitiale('Kirchengemeinde')).toBe('K');
    expect(gemeindeInitiale('Kirchspiel ')).toBe('K');
  });

  it('Ziffern zaehlen, Satzzeichen nicht; ohne Zeichen ein G', () => {
    expect(gemeindeInitiale('  "St. Petri"')).toBe('S');
    expect(gemeindeInitiale('2. Gemeinde')).toBe('2');
    expect(gemeindeInitiale('')).toBe('G');
    expect(gemeindeInitiale('---')).toBe('G');
  });
});

describe('rolleInGemeinde', () => {
  it('mit den Begriffen der App: Gemeindeleitung, Leitung, Teamer:in, Konfi', () => {
    expect(rolleInGemeinde({ role_name: 'org_admin' })).toBe('Gemeindeleitung');
    expect(rolleInGemeinde({ role_name: 'admin' })).toBe('Leitung');
    expect(rolleInGemeinde({ role_name: 'teamer' })).toBe('Teamer:in');
    expect(rolleInGemeinde({ role_name: 'konfi' })).toBe('Konfi');
  });

  it('unbekannt oder ohne Rolle: nichts -- kein technischer Name auf dem Bildschirm', () => {
    expect(rolleInGemeinde({ role_name: 'super_admin' })).toBe('');
    expect(rolleInGemeinde({ role_name: '' })).toBe('');
    expect(rolleInGemeinde(undefined)).toBe('');
  });
});
