import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MotivKontext, useMotive, type MotivZuweisung } from '../../../components/wrapped/MotivKontext';
import SlideBase from '../../../components/wrapped/slides/SlideBase';

// Die Motiv-Verteilung eines Rückblicks: EINMAL für alle Seiten berechnet
// (WrappedModal) und über diesen Kontext an jede Seite gereicht, damit sich
// kein Motiv wiederholt (Simon, 03.09.2026). Fehlt der Kontext, greift die
// feste Zuordnung (Audit Tests 26.09.2026, BF-10: ohne Test). Gerendert
// wird die echte SlideBase, die den Kontext liest.

const VERTEILUNG: Record<string, MotivZuweisung> = {
  intro: { haupt: '/assets/wrapped/sprung.webp', zweit: '/assets/wrapped/regen.webp' },
};

const Anzeige = () => {
  const m = useMotive();
  return <div data-testid="motive">{m === null ? 'keine' : JSON.stringify(m)}</div>;
};

// SlideBase liest den Verlauf der Seite aus dem CSS (--seiten-verlauf). jsdom
// lädt kein Stylesheet; die Variable wird hier geliefert.
let stilSpion: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  const echt = window.getComputedStyle.bind(window);
  stilSpion = vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
    const stil = echt(el);
    return new Proxy(stil, {
      get(ziel, name) {
        if (name === 'getPropertyValue') {
          return (p: string) => (p === '--seiten-verlauf' ? 'linear-gradient(red, blue)' : ziel.getPropertyValue(p));
        }
        const wert = Reflect.get(ziel, name);
        return typeof wert === 'function' ? wert.bind(ziel) : wert;
      },
    });
  });
});
afterEach(() => { stilSpion.mockRestore(); });

// jsdom schreibt url("…") mit Anführungszeichen; verglichen wird der Pfad.
const bild = (el: Element | null) =>
  el ? (el as HTMLElement).style.backgroundImage.replace(/^url\("?(.*?)"?\)$/, '$1') : null;
const formen = (c: HTMLElement) => ({
  oben: bild(c.querySelector('.wrapped-bg-form--oben')),
  unten: bild(c.querySelector('.wrapped-bg-form--unten')),
});

describe('MotivKontext', () => {
  it('ohne Anbieter gibt es keine Verteilung (null)', () => {
    render(<Anzeige />);
    expect(screen.getByTestId('motive').textContent).toBe('keine');
  });

  it('mit Anbieter bekommt jede Seite dieselbe Verteilung', () => {
    render(
      <MotivKontext.Provider value={VERTEILUNG}>
        <Anzeige />
      </MotivKontext.Provider>
    );
    expect(JSON.parse(screen.getByTestId('motive').textContent!)).toEqual(VERTEILUNG);
  });

  it('eine Seite im Rückblick zeigt die zugewiesenen Motive, nicht die feste Zuordnung', () => {
    const { container } = render(
      <MotivKontext.Provider value={VERTEILUNG}>
        <SlideBase isActive className="intro-slide"><p>Hallo</p></SlideBase>
      </MotivKontext.Provider>
    );
    expect(formen(container)).toEqual({
      oben: '/assets/wrapped/sprung.webp',
      unten: '/assets/wrapped/regen.webp',
    });
  });

  it('ohne Kontext greift die feste Zuordnung der Kachel', () => {
    const { container } = render(<SlideBase isActive className="intro-slide"><p>Hallo</p></SlideBase>);
    expect(formen(container)).toEqual({
      oben: '/assets/wrapped/watt-abend.webp',
      unten: '/assets/wrapped/sterne.webp',
    });
  });

  it('eine Kachel, die in der Verteilung fehlt, fällt auf die feste Zuordnung zurück', () => {
    const { container } = render(
      <MotivKontext.Provider value={VERTEILUNG}>
        <SlideBase isActive className="highlight-slide"><p>Hallo</p></SlideBase>
      </MotivKontext.Provider>
    );
    expect(formen(container)).toEqual({
      oben: '/assets/wrapped/konfetti-buehne.webp',
      unten: '/assets/wrapped/haende-hoch.webp',
    });
  });
});
