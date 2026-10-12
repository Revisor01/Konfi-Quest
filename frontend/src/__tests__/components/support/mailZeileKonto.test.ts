// „Support“ bleibt ganz, das Konto kürzt zuerst -- die obere Zeile einer
// ausgehenden Mail im Verlauf (components/support/MailGespraeche.css):
// „Support · Test Super-Admin  [Gesendet]  10.10., 17:23“.
//
// GEFUNDEN am 12.10.2026 beim Ansehen der Detailseiten: „Support“ und das Konto
// kürzten beide (flex-shrink 1, Grundbreite auto), Flexbox verteilt das Kürzen
// dann nach Breite. In der App stand „Support“ bei 390 px mit 44,7 bzw. 29,2
// statt 55,2 px da („Sup…“, „S…“), bei 360 px mit 34,6 bzw. 19,2 px -- iOS und
// Android gleich, im Browser ganz.
//
// jsdom rechnet kein Layout. Der Test liest die Regeln aus der Datei und rechnet
// die Breiten nach dem Algorithmus der Spezifikation (CSS Flexbox 1, 9.7
// „Resolving Flexible Lengths“) mit den gemessenen Breiten der Texte nach. Dass
// die Rechnung den Browser trifft, zeigt der erste Fall: Mit dem alten Stand
// ergibt sie genau die gemessenen Breiten.
//
// Gemessen am 12.10.2026 mit Playwright (Chromium, iPhone- und Android-Kennung,
// Testdaten, Vorgänge 1 und 3): Text „Support“ 55,16 px, „· Test Super-Admin“
// 109,31 px, Marke „Gesendet“ 59,36 px, Zeit „10.10., 17:23“ 65,33 px bzw.
// „gestern, 09:53“ 71,53 px, Abstand 6 px. Die Zeile ist bei 390 px 276 px breit
// (eingeklappte Mail) bzw. 236 px (offene Mail mit Menü), bei 360 px 246 bzw.
// 206 px. Ändern sich Schrift oder Abstände, fällt der erste Fall -- dann neu
// messen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(process.cwd(), 'src/components/support/MailGespraeche.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Die Deklarationen der einen Regel mit genau diesem Selektor. */
const regel = (selektor: string): Record<string, string> => {
  const bloecke = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim().replace(/\s+/g, ' ') === selektor));
  expect(bloecke, selektor).toHaveLength(1);
  return Object.fromEntries(bloecke[0][2].split(';')
    .map((d) => d.split(':').map((t) => t.trim()))
    .filter((p) => p.length === 2 && p[0]));
};

interface Flex { grow: number; shrink: number; basis: 'auto' | number; min: number; max: 'max-content' | number }

/** flex, flex-grow, flex-shrink, flex-basis, min-width und max-width einer Regel; was fehlt, steht auf der Vorgabe. */
const flexVon = (d: Record<string, string>): Flex => {
  const f: Flex = { grow: 0, shrink: 1, basis: 'auto', min: 0, max: Number.POSITIVE_INFINITY };
  const basisVon = (w: string): 'auto' | number => {
    if (w === 'auto') return 'auto';
    const px = /^(-?[\d.]+)(px|%)?$/.exec(w);
    if (!px) throw new Error(`flex-basis ${w} rechnet der Test nicht`);
    if (px[2] === '%' && Number(px[1]) !== 0) throw new Error(`flex-basis ${w} rechnet der Test nicht`);
    return Number(px[1]);
  };
  if (d.flex) {
    const teile = d.flex.split(/\s+/);
    if (teile.length !== 3) throw new Error(`flex: ${d.flex} -- der Test rechnet nur die Form „grow shrink basis“`);
    [f.grow, f.shrink, f.basis] = [Number(teile[0]), Number(teile[1]), basisVon(teile[2])];
  }
  if (d['flex-grow']) f.grow = Number(d['flex-grow']);
  if (d['flex-shrink']) f.shrink = Number(d['flex-shrink']);
  if (d['flex-basis']) f.basis = basisVon(d['flex-basis']);
  // Ohne min-width gilt „auto“: bei overflow hidden 0, sonst die Breite des Inhalts.
  if (d['min-width'] !== undefined) f.min = Number(d['min-width'].replace(/px$/, ''));
  else if (d.overflow !== 'hidden') f.min = Number.NaN; // steht für „Inhalt“, siehe zeile()
  if (d['max-width'] === 'max-content') f.max = 'max-content';
  else if (d['max-width'] !== undefined && d['max-width'] !== 'none') throw new Error(`max-width ${d['max-width']} rechnet der Test nicht`);
  return f;
};

interface Kind { name: string; text: number; flex: Flex }

/**
 * Die Breiten der Kinder einer Flex-Zeile nach CSS Flexbox 1, 9.7: Grundbreite,
 * hypothetische Breite (zwischen min und max), dann wachsen oder kürzen nach
 * flex-grow bzw. flex-shrink mal Grundbreite, bis keine Grenze mehr verletzt
 * ist. Auto-Ränder (die Zeit steht mit margin-left: auto rechts) nehmen nur
 * Platz, der danach übrig ist, und ändern keine Breite.
 */
const zeile = (breite: number, abstand: number, kinder: Kind[]): Record<string, number> => {
  const basis = kinder.map((k) => (k.flex.basis === 'auto' ? k.text : k.flex.basis));
  const min = kinder.map((k) => (Number.isNaN(k.flex.min) ? k.text : k.flex.min));
  const max = kinder.map((k) => (k.flex.max === 'max-content' ? k.text : k.flex.max));
  const klemmen = (i: number, x: number) => Math.max(min[i], Math.min(max[i], x));
  const hypothetisch = basis.map((b, i) => klemmen(i, b));
  const innen = breite - abstand * (kinder.length - 1);
  const wachsen = hypothetisch.reduce((s, x) => s + x, 0) < innen;
  const groesse = [...hypothetisch];
  const fest = kinder.map((k, i) => (wachsen
    ? k.flex.grow === 0 || basis[i] > hypothetisch[i]
    : k.flex.shrink === 0 || basis[i] < hypothetisch[i]));
  for (let runde = 0; runde < 10 && fest.includes(false); runde += 1) {
    const offen = kinder.map((_, i) => i).filter((i) => !fest[i]);
    const frei = innen - kinder.reduce((s, _, i) => s + (fest[i] ? groesse[i] : basis[i]), 0);
    const gewicht = offen.map((i) => (wachsen ? kinder[i].flex.grow : kinder[i].flex.shrink * basis[i]));
    const summe = gewicht.reduce((s, g) => s + g, 0);
    const roh = offen.map((i, j) => basis[i] + (summe > 0 ? (frei * gewicht[j]) / summe : 0));
    const ziel = offen.map((i, j) => klemmen(i, roh[j]));
    const verstoss = ziel.reduce((s, z, j) => s + z - roh[j], 0);
    offen.forEach((i, j) => {
      groesse[i] = ziel[j];
      if (Math.abs(verstoss) < 1e-9 || (verstoss > 0 && ziel[j] > roh[j]) || (verstoss < 0 && ziel[j] < roh[j])) fest[i] = true;
    });
  }
  return Object.fromEntries(kinder.map((k, i) => [k.name, Math.round(groesse[i] * 100) / 100]));
};

const TEXT = { support: 55.16, konto: 109.31, gesendet: 59.36, zeitAlt: 65.33, zeitGestern: 71.53 };
const ABSTAND = 6;
const ZEILEN = [
  { fall: '390 px, eingeklappt', breite: 276, zeit: TEXT.zeitAlt },
  { fall: '390 px, offen', breite: 236, zeit: TEXT.zeitGestern },
  { fall: '360 px, eingeklappt', breite: 246, zeit: TEXT.zeitAlt },
  { fall: '360 px, offen', breite: 206, zeit: TEXT.zeitGestern },
];

/** Die obere Zeile einer ausgehenden Mail mit den Regeln der Datei (oder abweichenden für Absender und Konto). */
const ausgehend = (breite: number, zeit: number, abweichend?: { absender: Flex; konto: Flex }) => zeile(breite, ABSTAND, [
  { name: 'absender', text: TEXT.support, flex: abweichend?.absender ?? flexVon(regel('.mail-zeile__absender')) },
  { name: 'konto', text: TEXT.konto, flex: abweichend?.konto ?? flexVon(regel('.mail-zeile__konto')) },
  { name: 'gesendet', text: TEXT.gesendet, flex: flexVon(regel('.mail-marke')) },
  { name: 'zeit', text: zeit, flex: flexVon(regel('.mail-zeile__zeit')) },
]);

describe('Verlauf: „Support“ bleibt ganz, das Konto kürzt zuerst', () => {
  it('die Rechnung trifft den Browser: mit dem alten Stand (beide flex-shrink 1) ergibt sie die gemessenen Breiten', () => {
    const alt: Flex = { grow: 0, shrink: 1, basis: 'auto', min: 0, max: Number.POSITIVE_INFINITY };
    const gemessen = [[44.7, 88.61], [29.22, 57.89], [34.64, 68.67], [19.16, 37.95]];
    ZEILEN.forEach((z, i) => {
      const b = ausgehend(z.breite, z.zeit, { absender: alt, konto: alt });
      expect(b.absender, z.fall).toBeCloseTo(gemessen[i][0], 1);
      expect(b.konto, z.fall).toBeCloseTo(gemessen[i][1], 1);
    });
  });

  it.each(ZEILEN)('$fall: „Support“ steht mit 55,16 px ganz da, das Konto bekommt den Rest', ({ breite, zeit }) => {
    const b = ausgehend(breite, zeit);
    expect(b.absender).toBe(TEXT.support);
    // Genau der Platz, der neben „Support“, „Gesendet“, Zeit und drei Abständen bleibt.
    expect(b.konto).toBeCloseTo(breite - TEXT.support - TEXT.gesendet - zeit - 3 * ABSTAND, 2);
    expect(b.gesendet).toBe(TEXT.gesendet);
    expect(b.zeit).toBe(zeit);
  });

  it('mit Platz (Browser) stehen „Support“ und das Konto ganz; den Rest nimmt der Rand vor der Zeit', () => {
    const b = ausgehend(560, TEXT.zeitAlt);
    expect(b.absender).toBe(TEXT.support);
    expect(b.konto).toBe(TEXT.konto);
  });

  it('reicht der Platz auch ohne Konto nicht, kürzt „Support“ als Letztes -- die Zeile läuft nicht über', () => {
    const b = ausgehend(150, TEXT.zeitAlt);
    expect(b.konto).toBe(0);
    expect(b.absender).toBeCloseTo(150 - TEXT.gesendet - TEXT.zeitAlt - 3 * ABSTAND, 2);
    expect(b.absender + b.konto + b.gesendet + b.zeit + 3 * ABSTAND).toBeCloseTo(150, 2);
  });

  it('eine eingehende Zeile ohne Konto: ein langer Name kürzt wie bisher, die Zeit bleibt ganz', () => {
    const b = zeile(276, ABSTAND, [
      { name: 'absender', text: 300, flex: flexVon(regel('.mail-zeile__absender')) },
      { name: 'neu', text: 30, flex: flexVon(regel('.mail-marke')) },
      { name: 'zeit', text: TEXT.zeitAlt, flex: flexVon(regel('.mail-zeile__zeit')) },
    ]);
    expect(b.absender).toBeCloseTo(276 - 30 - TEXT.zeitAlt - 2 * ABSTAND, 2);
    expect(b.zeit).toBe(TEXT.zeitAlt);
  });
});
