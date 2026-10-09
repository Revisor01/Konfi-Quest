import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { regeln, teileObersteEbene, letzterVerbund, spezifitaet, vergleich } from '../cssSpezifitaet';

/**
 * Hinweis-Box (.app-info-box): dieselbe kleinere Schrift auf iOS und Android.
 *
 * GEMESSEN am 09.10.2026 (Playwright, Fenster "E-Mail ändern", Hinweistext):
 * iOS 16 px, Android 14 px -- angelegt ist die Box auf --app-text-basis
 * (0.9rem = 14,4 px). Auf iOS war der Hinweis damit groesser als die
 * Zeilentitel (15,2 px). Simon: "ja kleiner", app-weit.
 *
 * Ursache: Die Box steht als <IonCardContent className="app-info-box"> in
 * einer Karte, der Text in einem <p>. ionic-theme-ios27 setzt die Schrift an
 * ion-card-content mit Spezifitaet (0,3,2), Ionic selbst an .card-content-md p
 * mit (0,1,1); .app-info-box hatte (0,1,0) und verlor beide Male.
 *
 * Geprueft wird das Stylesheet wie in dunkelmodus.test.ts: Die App-Regel muss
 * JEDEN Theme- und Ionic-Selektor, der an ion-card-content (bzw. am <p> darin)
 * die Schrift setzt, echt an Spezifitaet schlagen. Dann ist die Ladereihenfolge
 * egal; jsdom rechnet keine Kaskade gegen die Theme-Dateien.
 */

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ohneKommentare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const APP = ohneKommentare(lies('src/theme/variables.css'));
const QUELLEN = [
  'node_modules/@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27.css',
  'node_modules/@ionic/core/dist/collection/components/card-content/card-content.ios.css',
  'node_modules/@ionic/core/dist/collection/components/card-content/card-content.md.css',
];

/**
 * Fremde Selektoren, die font-size an ion-card-content (ziel 'box') oder an
 * einem <p> darin (ziel 'p') setzen.
 */
function fremdeSelektoren(ziel: 'box' | 'p'): string[] {
  const raus: string[] = [];
  for (const quelle of QUELLEN) {
    for (const { selektor, rumpf } of regeln(ohneKommentare(lies(quelle)))) {
      if (!/(?:^|;)\s*font-size\s*:/.test(rumpf)) continue;
      for (const roh of teileObersteEbene(selektor)) {
        const einzeln = roh.trim();
        const letzter = letzterVerbund(einzeln);
        const istBox = /^(ion-card-content(?![\w-])|\.card-content-(ios|md)(?![\w-]))/.test(letzter);
        const istP = letzter === 'p' && /(ion-card-content|\.card-content-(ios|md))/.test(einzeln);
        if ((ziel === 'box' && istBox) || (ziel === 'p' && istP)) raus.push(einzeln);
      }
    }
  }
  return raus;
}

/**
 * Die App-Regel der Box: setzt die Schrift am Kasten und an den direkten <p>.
 * Liefert die Selektoren fuer das jeweilige Ziel und den Rumpf.
 */
function appRegel(ziel: 'box' | 'p'): { selektoren: string[]; rumpf: string } {
  const treffer = regeln(APP).filter((r) => /font-size\s*:/.test(r.rumpf)
    && teileObersteEbene(r.selektor).some((s) => s.trim().includes('.app-info-box:not(.ios-theme-disabled)')));
  expect(treffer, 'App-Regel fuer die Hinweis-Box nicht gefunden').toHaveLength(1);
  const alle = teileObersteEbene(treffer[0].selektor).map((s) => s.trim());
  return { selektoren: alle.filter((s) => (letzterVerbund(s) === 'p') === (ziel === 'p')), rumpf: treffer[0].rumpf };
}

function unterlegen(eigene: string[], fremde: string[]): string[] {
  const raus: string[] = [];
  for (const e of eigene) {
    for (const f of fremde) {
      if (vergleich(spezifitaet(e), spezifitaet(f)) <= 0) raus.push(`${e} (${spezifitaet(e)}) schlaegt nicht ${f} (${spezifitaet(f)})`);
    }
  }
  return raus;
}

function token(name: string): number {
  const m = new RegExp(`${name}:\\s*([\\d.]+)rem`).exec(lies('src/theme/typografie.css'));
  expect(m, `Token ${name} nicht gefunden`).not.toBeNull();
  return Number(m![1]);
}

describe('Hinweis-Box: Schrift auf iOS und Android gleich und kleiner als Zeilentitel', () => {
  it('die Regeln, gegen die gerechnet wird, existieren', () => {
    // Faellt eine beim naechsten Theme- oder Ionic-Update weg, muss die
    // Rechnung neu gemacht werden -- nicht still gruen bleiben.
    const box = fremdeSelektoren('box');
    expect(box).toContain('ion-card.ios:not(.ios-theme-disabled,.ios26-disabled)>ion-card-content:not(.ios-theme-disabled,.ios26-disabled)');
    expect(box).toContain('.card-content-md');
    expect(box).toContain('.card-content-ios');
    const p = fremdeSelektoren('p');
    expect(p).toContain('.card-content-md p');
    expect(p).toContain('.card-content-ios p');
    expect(p).toContain('ion-card.ios:not(.ios-theme-disabled,.ios26-disabled)>ion-card-content:not(.ios-theme-disabled,.ios26-disabled) p');
  });

  it('die Rechnung stimmt an den Selektoren des Befunds', () => {
    expect(spezifitaet('ion-card.ios:not(.ios-theme-disabled,.ios26-disabled)>ion-card-content:not(.ios-theme-disabled,.ios26-disabled)')).toEqual([0, 3, 2]);
    expect(spezifitaet('.card-content-md p')).toEqual([0, 1, 1]);
    // Die alte Regel: verlor gegen beide.
    expect(vergleich(spezifitaet('.app-info-box'), [0, 3, 2])).toBeLessThan(0);
    expect(spezifitaet(':root.ios .app-info-box:not(.ios-theme-disabled)')).toEqual([0, 4, 0]);
    expect(spezifitaet(':root.md .app-info-box:not(.ios-theme-disabled) > p')).toEqual([0, 4, 1]);
  });

  it('die Box-Regel setzt --app-text-basis und gilt fuer beide Plattformen', () => {
    const { selektoren, rumpf } = appRegel('box');
    expect(rumpf).toMatch(/font-size:\s*var\(--app-text-basis\)/);
    expect(rumpf).toMatch(/line-height:\s*1\.5/);
    expect(selektoren.filter((s) => s.startsWith(':root.ios '))).toHaveLength(1);
    expect(selektoren.filter((s) => s.startsWith(':root.md '))).toHaveLength(1);
  });

  it('die Box-Regel schlaegt jeden fremden Schrift-Selektor an ion-card-content', () => {
    expect(unterlegen(appRegel('box').selektoren, fremdeSelektoren('box'))).toEqual([]);
  });

  it('der Text im <p> traegt dieselbe Schrift und schlaegt jeden fremden <p>-Selektor', () => {
    const { selektoren, rumpf } = appRegel('p');
    expect(rumpf).toMatch(/font-size:\s*var\(--app-text-basis\)/);
    // Nur direkte <p>: Formularzeilen in der Box behalten ihre Groesse.
    expect(selektoren.every((s) => /\s>\s*p$/.test(s))).toBe(true);
    expect(selektoren.filter((s) => s.startsWith(':root.ios '))).toHaveLength(1);
    expect(selektoren.filter((s) => s.startsWith(':root.md '))).toHaveLength(1);
    expect(unterlegen(selektoren, fremdeSelektoren('p'))).toEqual([]);
  });

  it('die Box-Schrift ist 14,4 px und kleiner als die Zeilentitel (15,2 px)', () => {
    expect(token('--app-text-basis') * 16).toBeCloseTo(14.4, 5);
    expect(token('--app-text-betont') * 16).toBeCloseTo(15.2, 5);
    expect(token('--app-text-basis')).toBeLessThan(token('--app-text-betont'));
  });
});
