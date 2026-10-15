import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// "Überspringen" in jeder Einführung (Simon, 10.10.2026): "nicht zu lesen
// weil dunkel." Der Knopf stand in --app-text-system (Grau) auf dem farbigen
// Verlauf der Folie (WCAG 1.4.3); Titel und Text daneben waren lesbar.
// Welche Farbe die Folie und ihre Schrift tragen, ist Gestaltung (Simon,
// 15.10.2026). Festgehalten wird die Beziehung: "Überspringen" ist so lesbar
// wie der Titel daneben -- dieselbe Farbe auf demselben Grund.
// Alle Einführungen und Update-Rundgänge laufen über die geteilte
// OnboardingTour (onboardingTourGeteilt.test.ts) -- ein Test deckt alle ab.
// ---------------------------------------------------------------------------

vi.mock('swiper/react', () => ({
  Swiper: (p: { children?: ReactNode }) => <div>{p.children}</div>,
  SwiperSlide: (p: { children?: ReactNode }) => <div>{p.children}</div>,
}));
vi.mock('swiper/modules', () => ({ Pagination: {} }));
vi.mock('swiper/css', () => ({}));
vi.mock('swiper/css/pagination', () => ({}));

import OnboardingTour from '../../components/shared/OnboardingTour';
import { ICON_STERN } from '../../components/shared/icons';

afterEach(() => cleanup());

const folien = [
  { icon: ICON_STERN, color: '#5b21b6', rgb: '91, 33, 182', title: 'Willkommen', text: 'Los geht es.' },
  { icon: ICON_STERN, color: '#5b21b6', rgb: '91, 33, 182', title: 'Termine', text: 'Alles im Blick.' },
];

/** Eine Farbe so, wie der Browser sie berechnet -- "white", "#fff" und rgb() werden vergleichbar. */
const alsFarbe = (wert: string) => {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = wert.trim();
  const farbe = probe.style.color ? getComputedStyle(probe).color : '';
  probe.remove();
  return farbe;
};

describe('Einführung: „Überspringen" ist auf dem farbigen Grund lesbar', () => {
  it('der Knopf trägt dieselbe Schriftfarbe wie der Titel der Folie', () => {
    render(<OnboardingTour slides={folien} onClose={() => {}} />);
    const titelFarbe = alsFarbe(screen.getByRole('heading', { name: 'Willkommen' }).style.color);
    expect(titelFarbe, 'der Titel der Folie setzt seine Farbe selbst').not.toBe('');
    const knopf = screen.getByText('Überspringen').closest('ion-button') as HTMLElement;
    expect(alsFarbe(knopf.style.getPropertyValue('--color'))).toBe(titelFarbe);
  });
});
