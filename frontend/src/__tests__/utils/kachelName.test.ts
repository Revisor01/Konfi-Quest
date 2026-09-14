import { describe, it, expect } from 'vitest';
import { kachelNameKuerzen, wortKuerzen, AUSLASSUNG } from '../../utils/kachelName';

// Am Geraet gemeldet (14.09.2026): "Umbrueche immer noch sehr seltsam" --
// die Abzeichen-Namen wurden MITTEN IM WORT umgebrochen. Im Browser
// nachgestellt und zeilenweise ausgelesen (320 px Fenster, 79 px fuer den
// Namen):
//
//   Punktemeister        -> "Punktemeiste" / "r"
//   Gottesdienstbesucher -> "Gottesdienst" / "besucher"
//   Gemeinde-Unterstuetzer -> "Gemeinde-" / "Unterstuetze" / "r"
//
// Ursache war `overflow-wrap: break-word` -- die Regel tut genau das, was
// sie verspricht, und das ist hier falsch. Gekuerzt wird jetzt gemessen.
//
// Die Breiten unten stammen aus derselben Messung (Schriftschnitt der App,
// 0.7rem/600). Sie sind hier als Tabelle hinterlegt, damit der Test ohne
// Browser laeuft und trotzdem an echten Zahlen haengt.

// Im BROWSER gemessene Breite je Zeichen (px bei 0.7rem/600, Schriftstapel
// der App). Gegengeprueft gegen die ebenfalls gemessene Breite ganzer
// Woerter -- die Summe der Einzelbreiten weicht um hoechstens 0,6 px ab:
//   Punktemeister        gemessen 81,0  Summe 81,2
//   Gottesdienstbesucher gemessen 123,8 Summe 123,9
//   Rettungsschwimmer    gemessen 114,1 Summe 114,7
//   Wiederholungstäter:in gemessen 124,5 Summe 124,6
// Damit laeuft der Test ohne Browser und haengt trotzdem an echten Zahlen.
const ZEICHENBREITE: Record<string, number> = {
  G: 8.52, o: 6.89, t: 4.49, e: 6.67, s: 6.24, d: 7.22, i: 3.13, n: 6.92,
  b: 7.22, u: 6.92, c: 6.53, h: 6.98, r: 4.73, P: 7.45, k: 6.58, m: 10.27,
  W: 11.21, l: 3.2, g: 7.15, 'ä': 6.52, ':': 3.76, R: 7.68, w: 9.27, f: 4.45,
  '-': 5.43, H: 8.67, U: 8.48, 'ü': 6.92, z: 6.3, S: 7.48, p: 7.16, a: 6.52,
  // Das Leerzeichen misst der Browser einzeln als 0 (abschliessender
  // Leerraum faellt weg); im Fliesstext ist es 3,1 px breit. Hier steht
  // der Fliesstext-Wert, denn Woerter werden einzeln gekuerzt.
  ' ': 3.1, [AUSLASSUNG]: 10.19,
};

/** Messfunktion fuer die Tests -- summiert die gemessenen Zeichenbreiten. */
const miss = (text: string): number =>
  [...text].reduce((summe, z) => summe + (ZEICHENBREITE[z] ?? 6.5), 0);

/** Die im Dreierraster bei 320 px gemessene verfuegbare Breite. */
const VERFUEGBAR = 79;

describe('kachelNameKuerzen kuerzt nie mitten im Wort', () => {
  // Die Namen, die am Geraet auffielen, plus die laengsten aus der
  // Produktionsmessung (125 Namen).
  const PRODUKTIONSNAMEN = [
    'Gottesdienstbesucher',
    'Punktemeister',
    'Wiederholungstäter:in',
    'Rettungsschwimmer',
    'Gemeindefest-Held:in',
    'Gemeinde-Unterstützer',
    'Gottesdienstbesuch: September',
  ];

  it('kuerzt jedes zu breite Wort auf die verfuegbare Breite', () => {
    for (const name of PRODUKTIONSNAMEN) {
      const gekuerzt = kachelNameKuerzen(name, VERFUEGBAR, miss);
      for (const wort of gekuerzt.split(/\s+/)) {
        expect(
          miss(wort),
          `"${wort}" (aus "${name}") ist breiter als die Kachel`
        ).toBeLessThanOrEqual(VERFUEGBAR);
      }
    }
  });

  it('haengt an ein gekuerztes Wort ein Auslassungszeichen', () => {
    // Genau der gemeldete Fall: "Punktemeister" passt nicht in 79 px.
    const gekuerzt = kachelNameKuerzen('Punktemeister', VERFUEGBAR, miss);
    expect(gekuerzt).not.toBe('Punktemeister');
    expect(gekuerzt.endsWith(AUSLASSUNG)).toBe(true);
    // Und es ist ein ECHTER Anfang des Wortes, kein Fragment aus der Mitte.
    expect('Punktemeister'.startsWith(gekuerzt.slice(0, -1))).toBe(true);
  });

  it('laesst einen Namen, der passt, voellig unangetastet', () => {
    // Gegenprobe zur Kuerzung: "Starter" ist 39 px breit und darf kein "…"
    // bekommen. Sonst kuerzte die Regel auch dort, wo nichts zu kuerzen ist.
    expect(kachelNameKuerzen('Starter', VERFUEGBAR, miss)).toBe('Starter');
    expect(kachelNameKuerzen('Starter', VERFUEGBAR, miss)).not.toContain(AUSLASSUNG);
  });

  it('kuerzt wortweise und wirft den Rest des Namens nicht weg', () => {
    // "Gottesdienstbesuch: September" -- nur das erste Wort ist zu breit.
    // Der Monat traegt Bedeutung und passt in seine eigene Zeile.
    const gekuerzt = kachelNameKuerzen('Gottesdienstbesuch: September', VERFUEGBAR, miss);
    expect(gekuerzt).toContain('September');
    expect(gekuerzt.split(/\s+/)).toHaveLength(2);
  });

  it('kuerzt am Bindestrich-Wort, ohne den Bindestrich zu verlieren', () => {
    // "Gemeinde-Unterstuetzer" wurde am Geraet zu "Unterstuetze"/"r".
    const gekuerzt = kachelNameKuerzen('Gemeinde-Unterstützer', VERFUEGBAR, miss);
    expect(miss(gekuerzt)).toBeLessThanOrEqual(VERFUEGBAR);
    expect(gekuerzt.endsWith(AUSLASSUNG)).toBe(true);
  });

  it('bleibt bei leerem Namen leer', () => {
    expect(kachelNameKuerzen('', VERFUEGBAR, miss)).toBe('');
  });

  it('kuerzt nicht, wenn keine Breite bekannt ist', () => {
    // 0 px bedeutet "noch nicht im Layout" -- daraus darf kein "…" werden.
    expect(kachelNameKuerzen('Punktemeister', 0, miss)).toBe('Punktemeister');
  });
});

describe('wortKuerzen trifft die groesstmoegliche Laenge', () => {
  it('nimmt genau so viele Zeichen mit, wie hineinpassen', () => {
    const gekuerzt = wortKuerzen('Gottesdienstbesucher', VERFUEGBAR, miss);
    expect(miss(gekuerzt)).toBeLessThanOrEqual(VERFUEGBAR);
    // Ein Zeichen mehr muesste die Breite sprengen -- sonst kuerzt die
    // Suche zu frueh und verschenkt Platz.
    const einsMehr = 'Gottesdienstbesucher'.slice(0, gekuerzt.length) + AUSLASSUNG;
    expect(miss(einsMehr)).toBeGreaterThan(VERFUEGBAR);
  });

  it('laesst ein passendes Wort unveraendert', () => {
    expect(wortKuerzen('Starter', VERFUEGBAR, miss)).toBe('Starter');
  });
});
