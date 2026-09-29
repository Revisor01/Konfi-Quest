import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// Leitplanke: Eine Dateiauswahl entsteht nur in der Hülle
// services/systemDialoge.ts (dateiAuswaehlen).
//
// Simons Befund 29.09.2026 (Android-Testbuild 128): „Dateiauswahl ist auch
// noch nicht als Ausnahme beim Biometrie öffnen." Chat, Material und Anträge
// öffneten ein verstecktes <input type="file"> an der Hülle vorbei — ohne
// Ausflug-Merker. Bei App-Sperre „Sofort" stand man nach jeder Auswahl vor
// dem Sperrbildschirm. Nur die Challenge-Abgabe hatte den Merker, von Hand.
//
// Dieser Test liest den Quelltext und schlägt an, sobald irgendwo sonst eine
// Datei-Eingabe entsteht — als JSX-Attribut, als Zuweisung oder über
// setAttribute. Wer eine Auswahl braucht, ruft dateiAuswaehlen.

const WURZEL = resolve(process.cwd(), 'src');
const HUELLE = 'services/systemDialoge.ts';

const MUSTER: RegExp[] = [
  // <input type="file"> / type={'file'} / { type: 'file' }
  /\btype\s*[=:]\s*\{?\s*["'`]file["'`]/,
  // feld.type = 'file'
  /\.type\s*=\s*["'`]file["'`]/,
  // setAttribute('type', 'file')
  /setAttribute\(\s*["'`]type["'`]\s*,\s*["'`]file["'`]/,
];

const quelldateien = (ordner: string): string[] => readdirSync(ordner).flatMap((name) => {
  const pfad = join(ordner, name);
  if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : quelldateien(pfad);
  return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
});

/** Fundstellen ausserhalb von Kommentaren, als "datei:zeile". */
const fundstellen = (): string[] => quelldateien(WURZEL).flatMap((pfad) => {
  const datei = relative(WURZEL, pfad).split('\\').join('/');
  if (datei === HUELLE) return [];
  return readFileSync(pfad, 'utf8').split('\n').flatMap((zeile, i) => {
    const code = zeile.trim();
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return [];
    return MUSTER.some((m) => m.test(zeile)) ? [`${datei}:${i + 1}`] : [];
  });
});

describe('Dateiauswahl nur über die Hülle', () => {
  it('ausserhalb von services/systemDialoge.ts entsteht keine Datei-Eingabe', () => {
    expect(fundstellen()).toEqual([]);
  });

  it('die Hülle selbst legt eine an — sonst prüfte die Leitplanke ins Leere', () => {
    const huelle = readFileSync(join(WURZEL, HUELLE), 'utf8');
    expect(huelle).toContain('export const dateiAuswaehlen');
    expect(MUSTER.some((m) => m.test(huelle))).toBe(true);
  });

  // Gegenprobe: Die Muster erkennen genau die Formen, die es vor dem
  // 29.09.2026 in der App gab (ChatRoomSections, MaterialFormModal,
  // ActivityRequestModal, ChallengeSubmitModal).
  it.each([
    ['JSX-Attribut', '        <input ref={fileInputRef} type="file" onChange={onFileSelect} />'],
    ['JSX-Attribut über mehrere Zeilen', '                type="file"'],
    ['Zuweisung', "    input.type = 'file';"],
    ['setAttribute', "feld.setAttribute('type', 'file');"],
    ['Objekt', "Object.assign(document.createElement('input'), { type: 'file' })"],
  ])('erkennt %s', (_form, zeile) => {
    expect(MUSTER.some((m) => m.test(zeile))).toBe(true);
  });

  it.each([
    ["const typ = datei.type || 'application/octet-stream';"],
    ["<input type=\"color\" value={farbe} />"],
    ["message_type: 'file'"],
  ])('lässt Ähnliches in Ruhe: %s', (zeile) => {
    expect(MUSTER.some((m) => m.test(zeile))).toBe(false);
  });
});
