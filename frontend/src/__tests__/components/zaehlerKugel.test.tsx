import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ZaehlerKugel from '../../components/shared/ZaehlerKugel';

/**
 * Die rote Kugel am Listen-Symbol (Chat-Raum, Challenge): was sie zeigt und
 * wie sie Vorleseprogrammen ihre Zahl nennt. Ihre Lage am Symbol ist Layout
 * und wird nicht festgeschrieben (Simon, 15.10.2026).
 */
describe('ZaehlerKugel', () => {
  it('nennt Vorleseprogrammen Zahl und Gegenstand, ohne Inline-Stil', () => {
    const { container } = render(<ZaehlerKugel anzahl={2} label="ungelesene Nachrichten" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('style')).toBeNull();
    expect(el.getAttribute('aria-label')).toBe('2 ungelesene Nachrichten');
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
