// WebInfoTipp: Info bei Darueberfahren, Fokus und Tippen; mit `href` ein Link.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('@ionic/react', () => ({ useIonRouter: () => ({ push }) }));

import WebInfoTipp from '../../components/web/WebInfoTipp';

afterEach(() => { vi.restoreAllMocks(); push.mockReset(); });

describe('WebInfoTipp', () => {
  it('mit href ein Link: Klick oeffnet das Ziel in der App, die Info haengt trotzdem daran', () => {
    render(<WebInfoTipp info="Zur Challenge" href="/konfi/challenges/3">Stempel</WebInfoTipp>);
    const link = screen.getByRole('link', { name: 'Stempel' });
    expect(link).toHaveAttribute('href', '/konfi/challenges/3');
    const blase = document.getElementById(link.getAttribute('aria-describedby')!)!;
    fireEvent.focus(link);
    expect(blase).toBeVisible();
    fireEvent.click(link, { button: 0 });
    expect(push).toHaveBeenCalledWith('/konfi/challenges/3', 'none', 'push');
    // Strg-Klick bleibt beim Browser (neuer Tab).
    push.mockReset();
    fireEvent.click(link, { button: 0, ctrlKey: true });
    expect(push).not.toHaveBeenCalled();
  });
});
