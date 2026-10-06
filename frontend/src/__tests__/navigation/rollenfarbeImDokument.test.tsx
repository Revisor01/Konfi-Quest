import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { useRollenfarbeImDokument } from '../../navigation/rollenfarbeImDokument';

// Simon, 06.10.2026: Gewählte Filter im Browser stehen in der Rollenfarbe der
// angemeldeten Person, nicht in der Grundfarbe. Der Hook schreibt die Farbe
// der Rolle (utils/rollenNamen.ts, rollenFarbe) als data-rolle an <html>;
// theme/web-ansicht.css leitet daraus --web-rolle ab, und die Filter lesen es.

const Probe: React.FC<{ rolle?: string | null }> = ({ rolle }) => {
  useRollenfarbeImDokument(rolle);
  return null;
};

afterEach(() => {
  delete document.documentElement.dataset.rolle;
});

describe('useRollenfarbeImDokument', () => {
  it.each([
    ['konfi', 'konfis'],
    ['teamer', 'teamer'],
    ['admin', 'leitung'],
    ['org_admin', 'users'],
  ])('Rolle %s -> data-rolle="%s"', (rolle, farbe) => {
    render(<Probe rolle={rolle} />);
    expect(document.documentElement.dataset.rolle).toBe(farbe);
  });

  it('ohne bekannte Rolle (Support-Konto, nicht angemeldet) steht kein data-rolle -- die Filter bleiben in der Grundfarbe', () => {
    const { rerender } = render(<Probe rolle="super_admin" />);
    expect(document.documentElement.dataset.rolle).toBeUndefined();
    rerender(<Probe rolle={null} />);
    expect(document.documentElement.dataset.rolle).toBeUndefined();
  });

  it('wechselt mit der Rolle (Gemeinde gewechselt) und räumt beim Abmelden auf', () => {
    const { rerender, unmount } = render(<Probe rolle="teamer" />);
    expect(document.documentElement.dataset.rolle).toBe('teamer');
    rerender(<Probe rolle="org_admin" />);
    expect(document.documentElement.dataset.rolle).toBe('users');
    unmount();
    expect(document.documentElement.dataset.rolle).toBeUndefined();
  });
});
