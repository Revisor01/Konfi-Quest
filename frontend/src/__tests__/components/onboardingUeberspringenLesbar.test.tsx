import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// "Überspringen" in jeder Einführung (Simon, 10.10.2026): "nicht zu lesen
// weil dunkel. Muss weiß sein." Der Knopf stand in --app-text-system (Grau)
// auf dem farbigen Verlauf der Folie; Titel und Text daneben sind weiß.
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

describe('Einführung: „Überspringen" ist auf dem farbigen Grund lesbar', () => {
  it('der Knopf ist weiß wie Titel und Text der Folie, nicht grau', () => {
    render(<OnboardingTour slides={folien} onClose={() => {}} />);
    const knopf = screen.getByText('Überspringen').closest('ion-button') as HTMLElement;
    expect(knopf.style.getPropertyValue('--color')).toBe('white');
    expect(knopf.getAttribute('style')).not.toContain('--app-text-system');
    const titel = screen.getByRole('heading', { name: 'Willkommen' });
    expect(titel.style.color).toBe('white');
  });
});
