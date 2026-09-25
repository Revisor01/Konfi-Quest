import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { QueueItem, FailedAction } from '../../services/writeQueue';

// Die Glocke in der Kopfzeile (25.09.2026). Simon: "oben in einen Button in
// die Leiste packen über alle Seiten und die Glocke drauf legen. Für
// Hinweise. Auch Warteschlange?" -- "Für alle."
//
// Zwei Quellen, eine Zahl: ungelesene Mitteilungen (BadgeContext) und die
// Offline-Warteschlange (useWartendeVorgaenge). Die Dringlichkeit steckt in
// data-variante -- ein Fehlschlag ist eine Aufgabe (rot), eine
// Abzeichen-Mitteilung nur eine Nachricht.

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonButton: (props: StubProps & { onClick?: () => void; className?: string; 'aria-label'?: string; 'data-variante'?: string }) => (
    <button
      type="button"
      onClick={props.onClick}
      className={props.className}
      aria-label={props['aria-label']}
      data-variante={props['data-variante']}
    >
      {props.children}
    </button>
  ),
  IonIcon: (props: { icon?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) =>
    <span data-testid="icon" data-icon={props.icon} aria-hidden={props['aria-hidden']} />,
}));

let mockUngelesen = 0;
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ postfachUngelesen: mockUngelesen }),
}));

let mockWartend: QueueItem[] = [];
let mockGescheitert: FailedAction[] = [];
vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({
    wartend: mockWartend,
    gescheitert: mockGescheitert,
    vergessen: vi.fn(),
    alleVergessen: vi.fn(),
  }),
}));

import PostfachGlocke, { glockeZustand } from '../../components/shared/PostfachGlocke';
import { POSTFACH_OEFFNEN_EVENT } from '../../utils/postfach';
import { ICON_GLOCKE } from '../../components/shared/icons';

const item = (id: string): QueueItem => ({
  id, method: 'POST', url: '/x', maxRetries: 3, retryCount: 0,
  createdAt: 0, hasFileUpload: false,
  metadata: { type: 'konfi', clientId: id, label: 'Aktivität melden' },
});
const fehlschlag = (id: string): FailedAction => ({
  id, label: 'Abmeldung', type: 'opt-out', createdAt: 0, failedAt: 0,
  error: { status: 409, message: 'Konflikt' },
});

describe('glockeZustand -- die Regel, ohne Rendern', () => {
  it('zaehlt alle drei Quellen zusammen', () => {
    expect(glockeZustand(3, 1, 2).anzahl).toBe(6);
  });

  it('nichts Neues: keine Zahl, Variante ruhe', () => {
    const z = glockeZustand(0, 0, 0);
    expect(z.anzahl).toBe(0);
    expect(z.variante).toBe('ruhe');
    expect(z.text).toBe('Postfach: nichts Neues');
  });

  it('nur ungelesene Mitteilungen sind ein Hinweis, kein Alarm', () => {
    expect(glockeZustand(4, 0, 0).variante).toBe('hinweis');
  });

  it('etwas wartet: orange, wie beim frueheren Knopf', () => {
    expect(glockeZustand(0, 2, 0).variante).toBe('warning');
    // Auch wenn nebenbei schon etwas gescheitert ist -- solange gesendet
    // wird, bleibt es beim Warten (Regel der WartendeVorgaengeLeiste).
    expect(glockeZustand(0, 1, 1).variante).toBe('warning');
  });

  it('nur noch Fehlschlaege uebrig: rot -- das ist eine Aufgabe', () => {
    expect(glockeZustand(0, 0, 1).variante).toBe('danger');
    // Ungelesene Mitteilungen aendern daran nichts.
    expect(glockeZustand(5, 0, 1).variante).toBe('danger');
  });

  it('der Satz fuer Vorleseprogramme nennt jede Quelle einzeln, in Einzahl und Mehrzahl', () => {
    expect(glockeZustand(1, 0, 0).text).toBe('Postfach: 1 ungelesene Mitteilung');
    expect(glockeZustand(2, 1, 0).text).toBe('Postfach: 2 ungelesene Mitteilungen, 1 Vorgang wird gesendet');
    expect(glockeZustand(0, 2, 3).text).toBe('Postfach: 2 Vorgänge werden gesendet, 3 Vorgänge wurden nicht gesendet');
  });
});

describe('PostfachGlocke', () => {
  beforeEach(() => {
    mockUngelesen = 0;
    mockWartend = [];
    mockGescheitert = [];
  });

  it('steht auch ohne Neues da -- nur ohne Zahl', () => {
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke')).not.toBeNull();
    expect(container.querySelector('.app-postfach-glocke__zahl')).toBeNull();
    expect(container.querySelector('[data-testid="icon"]')?.getAttribute('data-icon')).toBe(ICON_GLOCKE);
  });

  it('zeigt die Summe aus Mitteilungen und Warteschlange', () => {
    mockUngelesen = 3;
    mockWartend = [item('a')];
    mockGescheitert = [fehlschlag('f')];
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke__zahl')?.textContent).toBe('5');
  });

  it('traegt die Dringlichkeit als data-variante', () => {
    mockUngelesen = 2;
    const a = render(<PostfachGlocke />);
    expect(a.container.querySelector('.app-postfach-glocke')?.getAttribute('data-variante')).toBe('hinweis');
    a.unmount();

    mockUngelesen = 0;
    mockGescheitert = [fehlschlag('f')];
    const b = render(<PostfachGlocke />);
    expect(b.container.querySelector('.app-postfach-glocke')?.getAttribute('data-variante')).toBe('danger');
  });

  it('ab 100 steht 99+', () => {
    mockUngelesen = 120;
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke__zahl')?.textContent).toBe('99+');
  });

  it('Zahl und Symbol sind fuer Vorleseprogramme ausgeblendet -- der Knopf spricht', () => {
    mockUngelesen = 1;
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke__zahl')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[data-testid="icon"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.app-postfach-glocke')?.getAttribute('aria-label'))
      .toBe('Postfach: 1 ungelesene Mitteilung — antippen öffnet das Postfach');
  });

  it('Antippen oeffnet das Postfach ueber das Fenster-Ereignis', () => {
    const gehoert = vi.fn();
    window.addEventListener(POSTFACH_OEFFNEN_EVENT, gehoert);
    const { container } = render(<PostfachGlocke />);
    fireEvent.click(container.querySelector('.app-postfach-glocke')!);
    expect(gehoert).toHaveBeenCalledTimes(1);
    window.removeEventListener(POSTFACH_OEFFNEN_EVENT, gehoert);
  });
});

// Wo die Zahl steht -- als Vertrag mit den gemessenen Massen (25.09.2026).
//
// Drei Befunde von Simon am Geraet, am selben Tag:
//  1. "der blaue Indikator ist oben abgeschnitten."
//  2. "liegt jetzt zu sehr auf dem Icon. Es muss ueber das Icon gehen."
//  3. "Postfach badge wird durch die Rundung des Icon abgeschnitten, kann man
//     das nicht drueber laufen lassen."
//
// Gemessen (Ionic 9.0.3, ios27-Theme, 393px, Playwright): Es beschneiden
// ZWEI Knoten mit demselben Mittelpunkt wie das Symbol -- die Glas-Pille
// (ion-buttons, Radius 23) und der Knopf selbst (.button-native im
// Shadow-DOM, overflow hidden, border-radius 24px bei 44px: Kreis mit
// Radius 22, also enger). Die Zahl (18px, Radius 9) waere im Knopfkreis nur
// bis Abstand 13 ganz sichtbar; top 1 / right 2 (749d39c3) lag bei 13,45 --
// die Spitze ragte 0,45px hinaus, am Geraet die abgeschnittene Ecke.
//
// Beide Knoten brauchen ihr overflow hidden auf iOS nicht (Bildvergleich:
// Pille ohne Zahl byte-identisch, Knopf in Ruhe byte-identisch, gedrueckt
// 15 von 65.340 Pixeln um Kanaldelta 1). Also geben beide frei, und die
// Zahl steht mit top 0 / right 0 genau auf der rechten oberen Ecke des
// Symbolkastens: Mitte (365, 70) gegen Ecke (365,2 / 69,8). Auf Android
// begrenzt dasselbe overflow hidden den Ripple; dort bleibt alles wie es
// war (eigene Werte top -8 / right 2, Lage 1px neben der Ecke).
//
// jsdom rechnet kein Layout, deshalb prueft der Test die CSS-Werte gegen
// dieselbe Geometrie.
describe('Zahl an der Glocke: auf der Ecke des Symbols, Pille und Knopf beschneiden nicht', () => {
  const css = readFileSync(join(process.cwd(), 'src/theme/variables.css'), 'utf8');
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selektor: string): string => {
    const treffer = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].trim().replace(/\s+/g, ' ') === selektor);
    if (treffer.length !== 1) throw new Error(`${selektor}: ${treffer.length} Bloecke`);
    return treffer[0][2];
  };
  const zahl = block('.app-postfach-glocke__zahl');
  const wert = (quelle: string, name: string): number => {
    const m = quelle.match(new RegExp(`\\b${name}:\\s*(-?[\\d.]+)(px|;)`));
    if (!m) throw new Error(`${name} fehlt im Block`);
    return parseFloat(m[1]);
  };

  // Gemessen im Browser, iOS: Knopf 44x44 (Kreis Radius 22 um seine Mitte),
  // .button-inner 40x40 bei 2px Einzug, Symbol 22,4px mittig darin (Ecke
  // oben rechts bei 31,2 / 8,8 im .button-inner), Zahl 18px. Die Zahl haengt
  // an .button-inner.
  const INNER = 40;
  const SYMBOL = 22.39;
  const KNOPF_RADIUS = 22;
  const ZAHL = 18;
  const symbolEcke = { x: (INNER + SYMBOL) / 2, y: (INNER - SYMBOL) / 2 };
  const knopfMitte = { x: INNER / 2, y: INNER / 2 };
  const zahlMitte = (top: number, right: number) => ({ x: INNER - right - ZAHL / 2, y: top + ZAHL / 2 });
  const abstandZurKnopfmitte = (top: number, right: number) => {
    const m = zahlMitte(top, right);
    return Math.hypot(m.x - knopfMitte.x, m.y - knopfMitte.y);
  };
  const SICHTBAR_IM_KNOPF = KNOPF_RADIUS - ZAHL / 2; // 13

  it('iOS: top 0 / right 0 -- die Mitte der Zahl liegt auf der Symbolecke (0,2px daneben)', () => {
    expect(wert(zahl, 'top')).toBe(0);
    expect(wert(zahl, 'right')).toBe(0);
    expect(wert(zahl, 'height')).toBe(ZAHL);
    expect(wert(zahl, 'min-width')).toBe(ZAHL);
    const m = zahlMitte(0, 0);
    expect(Math.hypot(m.x - symbolEcke.x, m.y - symbolEcke.y)).toBeLessThan(0.3);
  });

  it('dort ragt sie aus dem Knopfkreis (Abstand 15,56 > 13) -- deshalb muessen Pille UND Knopf freigeben', () => {
    expect(abstandZurKnopfmitte(0, 0)).toBeCloseTo(15.56, 1);
    expect(abstandZurKnopfmitte(0, 0)).toBeGreaterThan(SICHTBAR_IM_KNOPF);
    expect(block('ion-buttons:has(> .app-postfach-glocke)')).toMatch(/overflow:\s*visible/);
    expect(block('.app-postfach-glocke::part(native)')).toMatch(/overflow:\s*visible/);
  });

  it('Gegenprobe der Formel: 1/2 (749d39c3) ragte schon 0,45px hinaus, 4/4 lag auf dem Symbol', () => {
    expect(abstandZurKnopfmitte(1, 2)).toBeCloseTo(13.45, 1);
    expect(abstandZurKnopfmitte(1, 2)).toBeGreaterThan(SICHTBAR_IM_KNOPF);
    // 4/4: 9,9 vom Mittelpunkt, Ueberdeckung 13x13 -- Simon: "zu sehr auf dem Icon".
    expect(abstandZurKnopfmitte(4, 4)).toBeCloseTo(9.9, 1);
    const m = zahlMitte(4, 4);
    expect(symbolEcke.x - m.x).toBeGreaterThan(4);
    expect(m.y - symbolEcke.y).toBeGreaterThan(4);
  });

  it('nur die Pille mit der Glocke gibt frei -- nicht jede Pille im Theme', () => {
    const pillen = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /(^|[\s,])ion-buttons(\.|:|\s*\{|\s*$)/.test(m[1]) && /overflow:\s*visible/.test(m[2]))
      .map((m) => m[1].trim());
    expect(pillen).toEqual(['ion-buttons:has(> .app-postfach-glocke)']);
  });

  // Android (MD3): Knopf 48x48 (Kreis Radius 24), .button-inner 24px hoch
  // und mittig (12px Einzug oben), Symbol 24px, Zahl 18px an .button-inner.
  // Malte (25.09.2026): "auf android ist der blaue badge abgeschnitten."
  const MD = { KNOPF: 48, INNER_OBEN: 12, INNER_HOEHE: 24 };
  const mdAbstandZurKnopfmitte = (top: number, right: number): number => {
    const mitte = { x: MD.KNOPF - right - ZAHL / 2, y: MD.INNER_OBEN + top + ZAHL / 2 };
    return Math.hypot(mitte.x - MD.KNOPF / 2, mitte.y - MD.KNOPF / 2);
  };

  it('Android: top -8 / right 2 bleibt -- die Zahl ragt 2,03px aus dem Knopfkreis, deshalb gibt der Knopf auch dort frei', () => {
    const md = block('.app-postfach-glocke.md .app-postfach-glocke__zahl');
    expect(wert(md, 'top')).toBe(-8);
    expect(wert(md, 'right')).toBe(2);
    const abstand = mdAbstandZurKnopfmitte(-8, 2);
    expect(abstand).toBeCloseTo(17.03, 1);
    expect(abstand + ZAHL / 2 - MD.KNOPF / 2).toBeCloseTo(2.03, 1); // so weit stand die Spitze im Beschnitt
    // Die Freigabe gilt ohne Plattform-Klasse -- fuer .md wie fuer .ios.
    expect(ohneKommentare).not.toMatch(/\.app-postfach-glocke\.(ios|md)::part\(native\)/);
    expect(block('.app-postfach-glocke::part(native)')).toMatch(/overflow:\s*visible/);
  });

  it('Android: die verworfene Alternative top -7 / right 4 laege ganz im Kreis, aber 10x11px auf dem Symbol', () => {
    expect(mdAbstandZurKnopfmitte(-7, 4)).toBeCloseTo(14.87, 1);
    expect(mdAbstandZurKnopfmitte(-7, 4) + ZAHL / 2).toBeLessThan(MD.KNOPF / 2);
    // Symbolkasten 24px mittig im Knopf: Ecke oben rechts bei (36, 12).
    const mitte = { x: MD.KNOPF - 4 - ZAHL / 2, y: MD.INNER_OBEN - 7 + ZAHL / 2 };
    expect(36 - (mitte.x - ZAHL / 2)).toBe(10);
    expect(mitte.y + ZAHL / 2 - 12).toBe(11);
  });

  it('die Freigabe kostet auf Android keinen Ripple: Ionic zeichnet ihn "unbounded" bis maxDim, also genau bis zum Knopfkreis', () => {
    // Die Annahme steht in Ionics Quelle. Aendert Ionic sie, faellt dieser
    // Test -- dann ist der Ripple neu zu messen, nicht die Regel zu kippen.
    const ionic = 'node_modules/@ionic/core/dist/collection/components/';
    const ripple = readFileSync(join(process.cwd(), ionic, 'ripple-effect/ripple-effect.js'), 'utf8');
    const button = readFileSync(join(process.cwd(), ionic, 'button/button.js'), 'utf8');
    expect(ripple).toMatch(/const maxRadius = this\.unbounded \? maxDim :/);
    expect(ripple).toMatch(/posX = width \* 0\.5;\s*posY = height \* 0\.5;/);
    expect(ripple).toMatch(/surfaces for unbounded ripples should have it set to visible/);
    expect(button).toMatch(/if \(hasClearFill && this\.hasIconOnly && this\.inToolbar\) \{\s*return 'unbounded';/);
    // MD3 macht den Knopf rund: Kreis mit Radius 24 bei 48x48 -- derselbe Kreis wie der Ripple.
    const md3 = readFileSync(join(process.cwd(), 'node_modules/@rdlabo/ionic-theme-md3/dist/css/ionic-theme-md3.css'), 'utf8');
    expect(md3).toMatch(/ion-button\.md:not\(\.md3-disabled\)\{[^}]*--border-radius: 999px/);
    expect(md3).toMatch(/ion-toolbar\.md:not\(\.md3-disabled\) ion-button\.button-has-icon-only:not\(\.button-small\):not\(\.button-large\)::part\(native\)\{width:48px;height:48px\}/);
  });
});
