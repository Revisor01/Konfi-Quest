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
// Zwei Befunde von Simon am Geraet, am selben Tag:
//  1. "der blaue Indikator ist oben abgeschnitten." -- Die Glas-Pille des
//     ios27-Themes um die Knoepfe rechts (ion-buttons, border-radius 25px,
//     overflow hidden) beschneidet: Pille 46px hoch, Kappe ein Halbkreis
//     mit Radius 23. Die Zahl (18px, Radius 9) ist nur dann ganz sichtbar,
//     wenn ihr rechtes Kappenzentrum hoechstens 14px (23 - 9) vom
//     Kappenmittelpunkt der Pille entfernt liegt.
//  2. Mit top 4 / right 4 (Abstand 9,9): "liegt jetzt zu sehr auf dem Icon.
//     Es muss ueber das Icon gehen." -- Der Symbolmittelpunkt IST der
//     Kappenmittelpunkt; ganz ueber dem Symbol geht also nicht. Das Beste
//     ist die Ecke: so weit nach oben rechts, wie der 14px-Kreis erlaubt.
//
// jsdom rechnet kein Layout, deshalb prueft der Test die CSS-Werte gegen
// dieselbe Geometrie. Vertrag: Abstand zwischen 13 (an der Ecke) und 14
// (nicht angeschnitten). Wer Richtung 0/0 schiebt, faellt an 14; wer
// zurueck Richtung 4/4 geht, faellt an 13.
describe('Zahl an der Glocke: an der Ecke des Symbols, ganz in der Glas-Pille', () => {
  const css = readFileSync(join(process.cwd(), 'src/theme/variables.css'), 'utf8');
  const block = css.match(/\.app-postfach-glocke__zahl \{([^}]*)\}/)?.[1] ?? '';
  const wert = (name: string): number => {
    const m = block.match(new RegExp(`\\b${name}:\\s*(-?[\\d.]+)px`));
    if (!m) throw new Error(`${name} fehlt am Block .app-postfach-glocke__zahl`);
    return parseFloat(m[1]);
  };

  // Gemessen im Browser: Pille 46px hoch, Knopf 44px, .button-inner 40px
  // (Einzug 2px), Zahl 18px. Der Kappenmittelpunkt liegt 23px von Pillen-
  // Oberkante und rechter Kante; die Zahl haengt an .button-inner, dessen
  // Oberkante 3px und rechte Kante 3px innerhalb der Pille liegen.
  const PILLE_RADIUS = 23;
  const INNER_EINZUG = 3;
  const ZAHL = 18;

  // Abstand des rechten Kappenzentrums der Zahl vom Kappenmittelpunkt der
  // Pille, beide Achsen von der Pillenkante aus gerechnet. Bei mehr als
  // einer Ziffer wird die Zahl nach links breiter -- das rechte Zentrum
  // bleibt.
  const abstand = (top: number, right: number): number => {
    const dx = PILLE_RADIUS - (INNER_EINZUG + right + ZAHL / 2);
    const dy = PILLE_RADIUS - (INNER_EINZUG + top + ZAHL / 2);
    return Math.hypot(dx, dy);
  };
  const SICHTBAR = PILLE_RADIUS - ZAHL / 2; // 14: alles darueber wird angeschnitten
  const AN_DER_ECKE = 13;                   // darunter liegt sie wieder auf dem Symbol

  it('die Werte sind die gemessenen: top 1px, right 2px, 18px gross', () => {
    expect(wert('top')).toBe(1);
    expect(wert('right')).toBe(2);
    expect(wert('height')).toBe(ZAHL);
    expect(wert('min-width')).toBe(ZAHL);
  });

  it('ganz sichtbar UND an der Ecke: Abstand 13,45 -- zwischen 13 und 14', () => {
    const a = abstand(wert('top'), wert('right'));
    expect(a).toBeCloseTo(13.45, 1);
    expect(a).toBeLessThanOrEqual(SICHTBAR);
    expect(a).toBeGreaterThanOrEqual(AN_DER_ECKE);
  });

  it('Gegenprobe der Formel: 2/0 und 1/1 schneiden an, 4/4 liegt auf dem Symbol', () => {
    // Der Ausgangszustand (Simon: "oben abgeschnitten") und der naechste
    // ganze Pixel Richtung Ecke.
    expect(abstand(2, 0)).toBeGreaterThan(SICHTBAR);
    expect(abstand(1, 1)).toBeGreaterThan(SICHTBAR);
    // Der erste Versuch (Simon: "zu sehr auf dem Icon").
    expect(abstand(4, 4)).toBeCloseTo(9.9, 1);
    expect(abstand(4, 4)).toBeLessThan(AN_DER_ECKE);
  });

  it('Android hebt die Zahl an, weil .button-inner dort 12px tiefer beginnt', () => {
    const md = css.match(/\.app-postfach-glocke\.md \.app-postfach-glocke__zahl \{([^}]*)\}/)?.[1] ?? '';
    expect(md).toMatch(/top:\s*-8px/);
  });
});
