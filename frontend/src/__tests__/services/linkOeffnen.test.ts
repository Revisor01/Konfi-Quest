import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// Links nach draussen (Karten, Store, Musik, Weblinks) laufen durch EINE Hülle:
// linkOeffnen in services/systemDialoge.ts. Sie meldet den Abstecher bei der
// App-Sperre an. Bis zum 29.09.2026 stand linkOeffnen bereit, aber jede Stelle
// rief window.open selbst — bei App-Sperre „Sofort" stand man nach jedem
// Blick in die Karte vor dem Sperrbildschirm (Nebenbefund zu Simons Befund
// „Dateiauswahl ist auch noch nicht als Ausnahme beim Biometrie öffnen",
// Android-Testbuild 128).

import { linkOeffnen } from '../../services/systemDialoge';
import { laeuftAusflug } from '../../services/appSperre';

describe('linkOeffnen', () => {
  let offen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    offen = vi.fn();
    vi.stubGlobal('open', offen);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('öffnet sofort (im selben Tipp, sonst blockt der Browser) und in neuem Fenster', () => {
    linkOeffnen('https://maps.apple.com/?q=Kirche');
    expect(offen).toHaveBeenCalledTimes(1);
    expect(offen).toHaveBeenCalledWith('https://maps.apple.com/?q=Kirche', '_blank');
  });

  it('meldet den Abstecher an, solange die App in den Hintergrund wechselt, und danach wieder ab', async () => {
    expect(laeuftAusflug()).toBe(false);
    linkOeffnen('https://example.org');
    expect(laeuftAusflug()).toBe(true);
    await vi.advanceTimersByTimeAsync(1499);
    expect(laeuftAusflug()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(laeuftAusflug()).toBe(false);
  });
});

// Leitplanke: window.open nur in der Hülle; ein <a target="_blank"> nur in
// Dateien, die den Tipp über linkOeffnen leiten.
const WURZEL = resolve(process.cwd(), 'src');
const HUELLE = 'services/systemDialoge.ts';

const quelldateien = (ordner: string): string[] => readdirSync(ordner).flatMap((name) => {
  const pfad = join(ordner, name);
  if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : quelldateien(pfad);
  return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
});

const codeZeilen = (inhalt: string) => inhalt.split('\n').map((zeile, i) => ({ zeile, nr: i + 1 }))
  .filter(({ zeile }) => {
    const code = zeile.trim();
    return !(code.startsWith('//') || code.startsWith('*') || code.startsWith('/*'));
  });

describe('Links nach draussen nur über die Hülle', () => {
  it('ausserhalb von services/systemDialoge.ts ruft niemand window.open', () => {
    const funde = quelldateien(WURZEL).flatMap((pfad) => {
      const datei = relative(WURZEL, pfad).split('\\').join('/');
      if (datei === HUELLE) return [];
      return codeZeilen(readFileSync(pfad, 'utf8'))
        .filter(({ zeile }) => /\bwindow\.open\s*\(/.test(zeile))
        .map(({ nr }) => `${datei}:${nr}`);
    });
    expect(funde).toEqual([]);
  });

  it('ein Link mit target="_blank" steht nur in Dateien, die linkOeffnen nutzen', () => {
    const funde = quelldateien(WURZEL).flatMap((pfad) => {
      const inhalt = readFileSync(pfad, 'utf8');
      const hatBlank = codeZeilen(inhalt).some(({ zeile }) => /target\s*=\s*\{?\s*["'`]_blank["'`]/.test(zeile));
      return hatBlank && !inhalt.includes('linkOeffnen(') ? [relative(WURZEL, pfad)] : [];
    });
    expect(funde).toEqual([]);
  });

  it('die Hülle selbst öffnet das Fenster — sonst prüfte die Leitplanke ins Leere', () => {
    const huelle = readFileSync(join(WURZEL, HUELLE), 'utf8');
    expect(huelle).toMatch(/export const linkOeffnen[\s\S]*ohneSperre[\s\S]*window\.open\(url, '_blank'\)/);
  });
});
