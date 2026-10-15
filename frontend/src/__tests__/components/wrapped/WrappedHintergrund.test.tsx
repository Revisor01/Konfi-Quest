import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WrappedHintergrund from '../../../components/wrapped/WrappedHintergrund';
import { hintergrundFuer, zweitbildFuer } from '../../../components/wrapped/hintergrundbilder';

// Der bebilderte Hintergrund einer Rückblick-Seite: welche Motive eine Seite
// zeigt (Audit Tests 26.09.2026, BF-10: ohne Test). Gerendert. Wie Bild,
// Verlauf und Schleier übereinander liegen, ist Layout und wird nicht
// festgeschrieben (Simon, 15.10.2026).

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

  it('Kachel ohne Motiv: keine Bildform', () => {
    expect(hintergrundFuer('momente')).toBeNull();
    const { oben, unten } = zeige({ kachel: 'momente' });
    expect(oben).toBeNull();
    expect(unten).toBeNull();
  });

  it('nur ein Hauptmotiv (Verteilung für eine Kachel ohne feste Zuordnung): eine Bildform oben', () => {
    expect(zweitbildFuer('momente')).toBeNull();
    const { oben, unten } = zeige({ kachel: 'momente', haupt: '/assets/wrapped/nordsee.webp' });
    expect(oben).toBe('/assets/wrapped/nordsee.webp');
    expect(unten).toBeNull();
  });
});
