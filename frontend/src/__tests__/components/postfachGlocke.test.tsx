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
// Zwei Quellen: ungelesene Mitteilungen (BadgeContext) und die
// Offline-Warteschlange (useWartendeVorgaenge). Die Dringlichkeit steckt in
// data-variante -- ein Fehlschlag ist eine Aufgabe (rot), eine
// Abzeichen-Mitteilung nur eine Nachricht.
//
// KEINE ZAHL FUER MITTEILUNGEN (28.09.2026, Simon): Ungelesene Mitteilungen
// zeigen keine Zahl -- fuer alle drei Rollen. Vorher stand dort die Summe
// aus Mitteilungen und Warteschlange. Zuerst ein blauer Kreis mit
// Briefumschlag, seit 29.09.2026 ein blauer PUNKT ohne Symbol (Simon,
// TestFlight 233: "Das Symbol der blauen Briefkaesten fuer die Post am
// Postfach gefaellt mir nicht"). Die Warteschlange behaelt ihre Zahl
// (orange/rot): Das sind Vorgaenge dieses Geraets, keine Mitteilungen, und
// ihre Zahl sagt, wie viel noch gesendet werden muss.

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

const item = (id: string): QueueItem => ({
  id, method: 'POST', url: '/x', maxRetries: 3, retryCount: 0,
  createdAt: 0, hasFileUpload: false,
  metadata: { type: 'request', clientId: id, label: 'Aktivität melden' },
});
const fehlschlag = (id: string): FailedAction => ({
  id, label: 'Abmeldung', type: 'opt-out', createdAt: 0, failedAt: 0,
  error: { status: 409, message: 'Konflikt' },
});

describe('glockeZustand -- die Regel, ohne Rendern', () => {
  it('zaehlt nur die Warteschlange -- ungelesene Mitteilungen tragen keine Zahl', () => {
    expect(glockeZustand(3, 1, 2).anzahl).toBe(3);
    expect(glockeZustand(3, 0, 0).anzahl).toBe(0);
    expect(glockeZustand(120, 0, 0).anzahl).toBe(0);
  });

  it('ab einer ungelesenen Mitteilung: der Punkt', () => {
    expect(glockeZustand(1, 0, 0).punkt).toBe(true);
    expect(glockeZustand(23, 0, 0).punkt).toBe(true);
    expect(glockeZustand(0, 0, 0).punkt).toBe(false);
    expect(glockeZustand(0, 2, 1).punkt).toBe(false);
  });

  it('nichts Neues: keine Zahl, kein Punkt, Variante ruhe', () => {
    const z = glockeZustand(0, 0, 0);
    expect(z.anzahl).toBe(0);
    expect(z.punkt).toBe(false);
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

  it('der Satz fuer Vorleseprogramme: Mitteilungen ohne Zahl, Warteschlange mit Zahl', () => {
    expect(glockeZustand(1, 0, 0).text).toBe('Ungelesene Mitteilungen im Postfach');
    expect(glockeZustand(23, 0, 0).text).toBe('Ungelesene Mitteilungen im Postfach');
    expect(glockeZustand(2, 1, 0).text).toBe('Ungelesene Mitteilungen im Postfach, 1 Vorgang wird gesendet');
    expect(glockeZustand(0, 2, 3).text).toBe('Postfach: 2 Vorgänge werden gesendet, 3 Vorgänge wurden nicht gesendet');
  });
});

describe('PostfachGlocke', () => {
  beforeEach(() => {
    mockUngelesen = 0;
    mockWartend = [];
    mockGescheitert = [];
  });

  it('steht auch ohne Neues da -- ohne Zahl, ohne Punkt', () => {
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke')).not.toBeNull();
    expect(container.querySelector('.app-postfach-glocke__zahl')).toBeNull();
    expect(container.querySelector('.app-postfach-glocke__punkt')).toBeNull();
  });

  it('ungelesene Mitteilungen: der Punkt -- keine Zahl', () => {
    mockUngelesen = 3;
    const { container } = render(<PostfachGlocke />);
    const punkt = container.querySelector('.app-postfach-glocke__punkt');
    expect(punkt).not.toBeNull();
    expect(punkt!.textContent).toBe('');
    expect(container.querySelector('.app-postfach-glocke__zahl')).toBeNull();
    expect(container.querySelector('.app-postfach-glocke')?.getAttribute('data-variante')).toBe('hinweis');
  });

  it('auch bei 120 ungelesenen steht keine Zahl, kein 99+ -- nur der Punkt', () => {
    mockUngelesen = 120;
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke__zahl')).toBeNull();
    expect(container.querySelector('.app-postfach-glocke__punkt')?.textContent).toBe('');
  });

  it('Warteschlange: Zahl der Vorgaenge -- ohne die Mitteilungen, der Punkt tritt zurueck', () => {
    mockUngelesen = 3;
    mockWartend = [item('a')];
    mockGescheitert = [fehlschlag('f')];
    const { container } = render(<PostfachGlocke />);
    const badge = container.querySelector('.app-postfach-glocke__zahl');
    expect(badge!.textContent).toBe('2');
    expect(container.querySelector('.app-postfach-glocke__punkt')).toBeNull();
    expect(container.querySelector('.app-postfach-glocke')?.getAttribute('data-variante')).toBe('warning');
  });

  it('Warteschlange ab 100: 99+', () => {
    mockWartend = Array.from({ length: 120 }, (_, i) => item(`w${i}`));
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke__zahl')?.textContent).toBe('99+');
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

  it('Punkt und Symbol sind fuer Vorleseprogramme ausgeblendet -- der Knopf spricht', () => {
    mockUngelesen = 1;
    const { container } = render(<PostfachGlocke />);
    expect(container.querySelector('.app-postfach-glocke__punkt')?.getAttribute('aria-hidden')).toBe('true');
    for (const icon of container.querySelectorAll('[data-testid="icon"]')) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
    expect(container.querySelector('.app-postfach-glocke')?.getAttribute('aria-label'))
      .toBe('Ungelesene Mitteilungen im Postfach — antippen öffnet das Postfach');
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

// Glocke und Punkt tragen keine feste Farbe: Hell und Dunkel kommen aus den
// Tokens (Hygiene, 15.10.2026 -- wie der Punkt aussieht, bleibt frei).
describe('Glocke und Punkt: keine feste Farbe im Stylesheet', () => {
  const css = readFileSync(join(process.cwd(), 'src/theme/variables.css'), 'utf8');
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('keine feste Farbe in den Regeln der Glocke und des Punkts', () => {
    const regeln = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].includes('.app-postfach-glocke') || m[1].includes('.app-ungelesen-punkt'))
      .map((m) => m[2])
      .join('');
    expect(regeln).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/);
  });
});
