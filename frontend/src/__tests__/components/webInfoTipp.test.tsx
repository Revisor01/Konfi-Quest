// WebInfoTipp: Info bei Darueberfahren, Fokus und Tippen; mit `href` ein Link.
// Am Rand des Inhalts rueckt die Info ein, statt abgeschnitten zu werden
// (Simon, 07.10.2026: links lief sie unter die Leiste).
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('@ionic/react', () => ({ useIonRouter: () => ({ push }) }));

import WebInfoTipp from '../../components/web/WebInfoTipp';

const rechteck = (left: number, right: number) => ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

afterEach(() => { vi.restoreAllMocks(); push.mockReset(); });

describe('WebInfoTipp', () => {
  it('am linken Rand rueckt die Info nach rechts ein, am rechten nach links, in der Mitte gar nicht', () => {
    const lage = { left: -40, right: 260 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'tooltip' ? rechteck(lage.left, lage.right) : rechteck(0, 0);
    });
    vi.stubGlobal('innerWidth', 1000);
    const { unmount } = render(<WebInfoTipp info="Info">Stempel</WebInfoTipp>);
    const knopf = screen.getByRole('button', { name: 'Stempel' });
    const blase = screen.getByRole('tooltip', { hidden: true });
    fireEvent.focus(knopf);
    expect(blase.style.getPropertyValue('--web-infotipp-versatz')).toBe('48px');
    fireEvent.blur(knopf);

    lage.left = 800; lage.right = 1100;
    fireEvent.focus(knopf);
    expect(blase.style.getPropertyValue('--web-infotipp-versatz')).toBe('-108px');
    fireEvent.blur(knopf);

    lage.left = 300; lage.right = 600;
    fireEvent.focus(knopf);
    expect(blase.style.getPropertyValue('--web-infotipp-versatz')).toBe('0px');
    unmount();
    vi.unstubAllGlobals();
  });

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
