import { describe, it, expect } from 'vitest';
import { autoCapitalize } from '../../components/chat/ChatRoomSections';

// Großschreibung im Chat-Eingabefeld (Befund Simon, 27.09.2026): Nach einem
// einzelnen Zeilenumbruch wurde der nächste Buchstabe groß, auch mitten im
// Satz („asjjkdfss,⏎x" → „asjjkdfss,⏎X"). Ursache: Die Regex zählte jeden
// Umbruch als Satzende (Zweig `|\n`).
//
// Entscheidung Simon (27.09.2026): Variante A — groß nur am Textanfang und
// nach . ! ? (beliebig viel Leerraum dahinter, auch Umbrüche). Ein oder
// mehrere Umbrüche ohne Satzzeichen bleiben klein. Leerraum am Textanfang
// zählt als Textanfang.
//
// autoCapitalize bekommt den ganzen Text nach jedem Tastendruck und prüft
// nur das zuletzt getippte Zeichen — so wird hier getestet: Text davor +
// ein kleines Zeichen.
const getippt = (davor: string, zeichen: string) => autoCapitalize(davor + zeichen);

describe('Chat-Großschreibung (Variante A)', () => {
  it.each([
    // [Text davor, getipptes Zeichen, Erwartung]
    ['asjjkdfss,\n', 'x', 'asjjkdfss,\nx'],
    ['abc\n', 'x', 'abc\nx'],
    ['abc\n\n', 'x', 'abc\n\nx'],
    ['abc\n \n', 'x', 'abc\n \nx'],
    ['abc\n\n\n', 'x', 'abc\n\n\nx'],
    ['abc.\n', 'x', 'abc.\nX'],
    ['abc.\n\n\n', 'x', 'abc.\n\n\nX'],
    ['abc. ', 'x', 'abc. X'],
    ['abc! ', 'x', 'abc! X'],
    ['abc? ', 'x', 'abc? X'],
    ['abc, ', 'x', 'abc, x'],
  ])('%j + %j → %j', (davor, zeichen, erwartet) => {
    expect(getippt(davor, zeichen)).toBe(erwartet);
  });

  it('Textanfang: erstes Zeichen groß, auch Umlaute', () => {
    expect(getippt('', 'a')).toBe('A');
    expect(getippt('', 'ä')).toBe('Ä');
  });

  it('Leerraum am Textanfang zählt als Textanfang', () => {
    expect(getippt('\n', 'x')).toBe('\nX');
    expect(getippt('\n\n', 'x')).toBe('\n\nX');
    expect(getippt('  ', 'x')).toBe('  X');
  });

  it('ohne Leerraum nach dem Punkt bleibt klein (z.B. mitten in „z.B.")', () => {
    expect(getippt('z.', 'b')).toBe('z.b');
  });

  it('bereits große Buchstaben, Zahlen und Sonderzeichen bleiben unverändert', () => {
    expect(getippt('abc. ', 'X')).toBe('abc. X');
    expect(getippt('abc. ', '3')).toBe('abc. 3');
    expect(getippt('', '#')).toBe('#');
    expect(autoCapitalize('')).toBe('');
  });
});
