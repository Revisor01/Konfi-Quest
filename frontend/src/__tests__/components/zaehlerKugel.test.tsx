import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ZaehlerKugel from '../../components/shared/ZaehlerKugel';

/**
 * Die rote Kugel am Listen-Symbol (Chat-Raum, Challenge): auf der Ecke des
 * Symbols, in beiden Listen gleich.
 *
 * Simon am iPhone (25.09.2026), zweite Runde: "Badge auf den Listen icons
 * bei challenges und Chat weiter hoch weiter rechts und in beiden Ansichten
 * gleich positioniert auf dem Icon. Die weissen Anteile muessten schmaler."
 *
 * Gemessen im Browser (Karte .app-list-item, Zeile, Anker, Kreis 28 bzw.
 * 32px, Kugel 16px): Der Vertrag ist GEOMETRISCH -- Kugelmittelpunkt auf
 * der 45-Grad-Diagonale, 3px ausserhalb des Kreisrands, also 5 der 16px auf
 * dem Symbol. Weil die Kreise verschieden gross sind, braucht das je Kreis
 * eigene Werte; der Test rechnet beide aus dem Stylesheet nach. jsdom hat
 * kein Layout, deshalb die Regel im Stylesheet, nicht das Bild.
 *
 * Die Regelbloecke werden IN den Tests gelesen, nicht beim Laden der Datei:
 * Fehlt einer, faellt der Test mit Meldung -- statt dass die Suite gar
 * nicht laedt und "no tests" meldet.
 */
const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');
const css = lies('src/theme/variables.css');
const abstaende = lies('src/theme/abstaende.css');
const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
const block = (selektor: string): string => {
  const treffer = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].trim().replace(/\s+/g, ' ') === selektor);
  if (treffer.length !== 1) throw new Error(`${selektor}: ${treffer.length} Bloecke`);
  return treffer[0][2];
};
const px = (quelle: string, muster: RegExp): number => {
  const m = quelle.match(muster);
  if (!m) throw new Error(`nicht gefunden: ${muster}`);
  return parseFloat(m[1]);
};

const KUGEL = 16;
const KREIS = px(css, /\.app-icon-circle \{[^}]*?\bwidth:\s*(\d+)px/);
const KREIS_LG = px(css, /\.app-icon-circle--lg \{[^}]*?\bwidth:\s*(\d+)px/);
const KREIS_MARGIN = px(abstaende, /--app-abstand-mini:\s*(\d+)px/);
const LUFT = 3; // so weit liegt der Kugelmittelpunkt ausserhalb des Kreisrands

const KUGEL_REGEL = '.app-zaehler-kugel';
const KUGEL_LG_REGEL = '.app-zaehler-anker:has(> .app-icon-circle--lg) > .app-zaehler-kugel';

/** top (px) und der Versatz der Mitte von der rechten Ankerkante, aus einem Regelblock. */
const lage = (regel: string) => ({
  top: px(regel, /\btop:\s*(-?[\d.]+)px/),
  mitteVonRechts: px(regel, /\bleft:\s*calc\(100% - ([\d.]+)px\)/),
});

/** Kugelmitte relativ zur Kreismitte, im Koordinatensystem des Ankers (so breit wie der Kreis). */
const versatz = (kreis: number, l: { top: number; mitteVonRechts: number }) => {
  const kugelMitte = { x: kreis - l.mitteVonRechts, y: l.top + KUGEL / 2 };
  const kreisMitte = { x: kreis / 2, y: KREIS_MARGIN + kreis / 2 };
  const dx = kugelMitte.x - kreisMitte.x;
  const dy = kugelMitte.y - kreisMitte.y;
  return { dx, dy, abstand: Math.hypot(dx, dy), winkel: (Math.atan2(-dy, dx) * 180) / Math.PI };
};

describe('ZaehlerKugel: Lage am Symbolkreis', () => {
  it('die Stylesheet-Masse sind die gemessenen: Kreis 28/32px, Rand oben 4px', () => {
    expect(KREIS).toBe(28);
    expect(KREIS_LG).toBe(32);
    expect(KREIS_MARGIN).toBe(4);
  });

  it('rendert nur die Klasse -- keine Inline-Lage, die die Regel je Kreis ueberstimmen koennte', () => {
    const { container } = render(<ZaehlerKugel anzahl={2} label="ungelesene Nachrichten" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toBe('app-zaehler-kugel');
    expect(el.getAttribute('style')).toBeNull();
    expect(el.getAttribute('aria-label')).toBe('2 ungelesene Nachrichten');
  });

  it('die Mitte haengt an left + translateX(-50%), nicht an right: "9+" ist breiter als "2"', () => {
    const kugel = block(KUGEL_REGEL);
    expect(kugel).toMatch(/\bleft:\s*calc\(100% - 2px\)/);
    expect(kugel).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(kugel).not.toMatch(/\bright:/);
    expect(kugel).toMatch(/\btop:\s*-2px/);
  });

  it('Chat-Liste (--lg) bekommt eigene Werte: top -1,4px, Mitte 2,6px von rechts', () => {
    const kugelLg = block(KUGEL_LG_REGEL);
    expect(kugelLg).toMatch(/\btop:\s*-1\.4px/);
    expect(kugelLg).toMatch(/\bleft:\s*calc\(100% - 2\.6px\)/);
  });

  it.each([
    ['Challenge-Liste', KREIS, KUGEL_REGEL],
    ['Chat-Liste (--lg)', KREIS_LG, KUGEL_LG_REGEL],
  ])('%s: Mitte auf der 45-Grad-Diagonale, 3px ausserhalb des Kreisrands', (_name, kreis, regel) => {
    const v = versatz(kreis, lage(block(regel)));
    const r = kreis / 2;
    expect(v.abstand).toBeCloseTo(r + LUFT, 1);   // 16,97 bzw. 18,94
    expect(v.winkel).toBeCloseTo(45, 0);
    expect(r + KUGEL / 2 - v.abstand).toBeCloseTo(KUGEL / 2 - LUFT, 1); // 5px der Kugel auf dem Symbol
  });

  it('beide Listen auf 0,05px gleich -- das ist Simons "in beiden Ansichten gleich"', () => {
    const a = versatz(KREIS, lage(block(KUGEL_REGEL)));
    const b = versatz(KREIS_LG, lage(block(KUGEL_LG_REGEL)));
    expect(Math.abs((KREIS / 2 - a.abstand) - (KREIS_LG / 2 - b.abstand))).toBeLessThan(0.05);
    expect(Math.abs(a.winkel - b.winkel)).toBeLessThan(0.5);
  });

  it('Gegenprobe der Formel: die alten Werte (top 0, right -4px) lagen AUF dem Rand', () => {
    // 749d39c3: right -4px bei 16px Breite -> die Kugel ragt 4px ueber die
    // Ankerkante, ihre Mitte liegt also 4px LINKS davon.
    const alt = { top: 0, mitteVonRechts: 4 };
    expect(versatz(KREIS, alt).abstand).toBeCloseTo(14.14, 1);
    expect(versatz(KREIS_LG, alt).abstand).toBeCloseTo(16.97, 1);
    // ... also 0 bis 1px ausserhalb statt 3 -- und im Chat 0,8px anders als bei den Challenges.
    expect(versatz(KREIS, alt).abstand - KREIS / 2).toBeLessThan(1);
    expect(Math.abs((versatz(KREIS, alt).abstand - KREIS / 2) - (versatz(KREIS_LG, alt).abstand - KREIS_LG / 2))).toBeGreaterThan(0.5);
  });

  it('weisser Rand 1px, Kugel bleibt 16px (border-box)', () => {
    const kugel = block(KUGEL_REGEL);
    expect(kugel).toMatch(/\bborder:\s*1px solid var\(--app-weiss\)/);
    expect(kugel).toMatch(/\bheight:\s*16px/);
    expect(kugel).toMatch(/\bmin-width:\s*16px/);
    expect(kugel).toMatch(/box-sizing:\s*border-box/);
  });
});

describe('ZaehlerKugel: die Zeile beschneidet sie nicht mehr', () => {
  // .app-list-item__main hat overflow: hidden (seit d457325e). Mit top -2px
  // laege die Kugel 2px ueber dessen Oberkante und wuerde beschnitten
  // (gemessen: 97,3 % / 96 % sichtbar). Die Zeile hebt das Beschneiden auf,
  // sobald ein Anker in ihr steht -- nur dort, das Sicherheitsnetz fuer
  // alle anderen Zeilen bleibt.
  it('__main behaelt overflow hidden, gibt es aber frei, wenn ein Anker darin steht', () => {
    expect(block('.app-list-item__main')).toMatch(/overflow:\s*hidden/);
    expect(block('.app-list-item__main:has(> .app-zaehler-anker)')).toMatch(/overflow:\s*visible/);
  });

  it('der Anker ist der Bezugspunkt: position relative, schrumpft nicht', () => {
    const anker = block('.app-zaehler-anker');
    expect(anker).toMatch(/position:\s*relative/);
    expect(anker).toMatch(/flex-shrink:\s*0/);
  });

  it.each([
    ['Chat-Liste', 'src/components/chat/ChatOverview.tsx'],
    ['Challenge-Liste', 'src/components/konfi/views/ChallengesView.tsx'],
  ])('%s: Kreis und Kugel stehen in einem .app-zaehler-anker direkt in __main', (_name, datei) => {
    const quelle = lies(datei);
    const ab = quelle.indexOf('className="app-zaehler-anker"');
    expect(ab).toBeGreaterThan(-1);
    // Direkt davor die Zeile, direkt danach Kreis und Kugel.
    expect(quelle.slice(ab - 400, ab)).toMatch(/className="app-list-item__main"[\s\S]*$/);
    const danach = quelle.slice(ab, ab + 400);
    expect(danach).toMatch(/className=[{"`][^>]*app-icon-circle/);
    expect(danach).toContain('<ZaehlerKugel');
    // Kein Inline-Style mehr am Anker, sonst laufen beide Listen wieder auseinander.
    expect(quelle).not.toContain("style={{ position: 'relative', flexShrink: 0 }}");
  });

  it('bei 0 wird nichts gerendert', () => {
    const { container } = render(<ZaehlerKugel anzahl={0} label="x" />);
    expect(container.firstChild).toBeNull();
  });

  it('ab zehn steht 9+', () => {
    const { container } = render(<ZaehlerKugel anzahl={12} label="x" />);
    expect((container.firstChild as HTMLElement).textContent).toBe('9+');
  });
});
