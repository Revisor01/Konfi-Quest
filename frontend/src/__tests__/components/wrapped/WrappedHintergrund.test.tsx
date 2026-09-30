import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WrappedHintergrund from '../../../components/wrapped/WrappedHintergrund';
import { hintergrundFuer, zweitbildFuer } from '../../../components/wrapped/hintergrundbilder';

// Der bebilderte Hintergrund einer Rückblick-Seite: zwei Bildformen in
// gegenüberliegenden Ecken, darüber der Farbschleier der Seite (Audit Tests
// 26.09.2026, BF-10: ohne Test). Gerendert.

const VERLAUF = 'linear-gradient(135deg, rgb(10, 20, 30), rgb(40, 50, 60))';

const zeige = (props: Partial<React.ComponentProps<typeof WrappedHintergrund>> = {}) => {
  const { container } = render(<WrappedHintergrund kachel="intro" verlauf={VERLAUF} {...props} />);
  const wurzel = container.querySelector('.wrapped-bg') as HTMLElement;
  const bildVon = (klasse: string) => {
    const el = wurzel.querySelector(`.${klasse}`) as HTMLElement | null;
    // jsdom schreibt url("…") mit Anführungszeichen; verglichen wird der Pfad.
    return el ? el.style.backgroundImage.replace(/^url\("?(.*?)"?\)$/, '$1') : null;
  };
  return {
    wurzel,
    oben: bildVon('wrapped-bg-form--oben'),
    unten: bildVon('wrapped-bg-form--unten'),
    schleier: [...wurzel.querySelectorAll('.wrapped-bg-schleier')] as HTMLElement[],
  };
};

describe('WrappedHintergrund', () => {
  it('ist Schmuck: für Vorlesehilfen verborgen', () => {
    expect(zeige().wurzel.getAttribute('aria-hidden')).toBe('true');
  });

  it('ohne Verteilung: die feste Zuordnung der Kachel, oben und unten zwei verschiedene Motive', () => {
    const haupt = hintergrundFuer('intro');
    const zweit = zweitbildFuer('intro');
    expect(haupt).toBe('/assets/wrapped/watt-abend.webp');
    expect(zweit).toBe('/assets/wrapped/sterne.webp');

    const { oben, unten } = zeige();
    expect(oben).toBe(haupt);
    expect(unten).toBe(zweit);
  });

  it('die Verteilung des Rückblicks hat Vorrang vor der festen Zuordnung', () => {
    const { oben, unten } = zeige({ haupt: '/assets/wrapped/sprung.webp', zweit: '/assets/wrapped/regen.webp' });
    expect(oben).toBe('/assets/wrapped/sprung.webp');
    expect(unten).toBe('/assets/wrapped/regen.webp');
  });

  it('der Verlauf der Seite liegt ganz unten und als Schleier über dem Bild', () => {
    const { wurzel, schleier } = zeige();
    const grund = wurzel.firstElementChild as HTMLElement;
    expect(grund.getAttribute('style')).toContain(`background: ${VERLAUF}`);
    expect(schleier).toHaveLength(2);
    expect(schleier[0].getAttribute('style')).toContain(`background: ${VERLAUF}`);
    // Der Farbschleier deckt nur zum Teil ab: das Bild soll durchkommen.
    expect(schleier[0].style.opacity).toBe('0.55');
  });

  it('Kachel ohne Motiv: nur Verlauf und Lichtfleck, keine Bildform und kein Schleier', () => {
    expect(hintergrundFuer('momente')).toBeNull();
    const { wurzel, oben, unten, schleier } = zeige({ kachel: 'momente' });
    expect(oben).toBeNull();
    expect(unten).toBeNull();
    expect(schleier).toHaveLength(0);
    expect(wurzel.querySelector('.wrapped-bg-licht')).not.toBeNull();
    expect((wurzel.firstElementChild as HTMLElement).getAttribute('style')).toContain(`background: ${VERLAUF}`);
  });

  it('nur ein Hauptmotiv (Verteilung für eine Kachel ohne feste Zuordnung): eine Bildform oben, der Schleier bleibt', () => {
    expect(zweitbildFuer('momente')).toBeNull();
    const { oben, unten, schleier } = zeige({ kachel: 'momente', haupt: '/assets/wrapped/nordsee.webp' });
    expect(oben).toBe('/assets/wrapped/nordsee.webp');
    expect(unten).toBeNull();
    expect(schleier).toHaveLength(2);
  });
});
