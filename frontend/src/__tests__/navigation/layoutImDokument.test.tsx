import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { useLayoutImDokument } from '../../navigation/layoutImDokument';

// Simon, 11.10.2026: „Web braucht eigene kompaktere Modale überall." Der
// Hook schreibt das breite Layout als data-layout="breit" an <html>;
// theme/web-modale.css stellt darunter jedes App-Modal kompakt dar. Wer
// den Rahmen dazu aufruft, prüft seitenleiste.test.tsx.

const Probe: React.FC<{ breit: boolean }> = ({ breit }) => {
  useLayoutImDokument(breit);
  return null;
};

afterEach(() => {
  delete document.documentElement.dataset.layout;
});

describe('useLayoutImDokument', () => {
  it('breit: data-layout="breit" an <html>', () => {
    render(<Probe breit />);
    expect(document.documentElement.dataset.layout).toBe('breit');
  });

  it('nicht breit: kein Merkmal', () => {
    render(<Probe breit={false} />);
    expect(document.documentElement.dataset.layout).toBeUndefined();
  });

  it('folgt dem Wert und räumt beim Abbau auf', () => {
    const { rerender, unmount } = render(<Probe breit />);
    expect(document.documentElement.dataset.layout).toBe('breit');
    rerender(<Probe breit={false} />);
    expect(document.documentElement.dataset.layout).toBeUndefined();
    rerender(<Probe breit />);
    expect(document.documentElement.dataset.layout).toBe('breit');
    unmount();
    expect(document.documentElement.dataset.layout).toBeUndefined();
  });
});
