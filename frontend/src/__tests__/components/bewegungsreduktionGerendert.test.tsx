import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { render, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-12 -- gerenderte Gegenprobe zum Scan
// (bewegungsreduktion.test.ts):
//   - Die Einfuehrung (OnboardingTour) wischt mit 300 ms von Folie zu Folie;
//     bei „Bewegung reduzieren" springt sie (Swiper speed 0). Swiper ist
//     gestubbt, damit der uebergebene Wert sichtbar wird -- die Folien selbst
//     rendern echt.
//   - Die Ladepunkte des Vollbild-Laders pulsieren per Inline-animation; der
//     globale CSS-Block greift ueber [style*="animation"]. Der Test haelt
//     fest, dass die Punkte diesen Haken im gerenderten DOM wirklich tragen.
// ---------------------------------------------------------------------------

vi.mock('swiper/react', () => ({
  Swiper: (p: { children?: ReactNode; speed?: number }) => <div data-testid="swiper" data-speed={String(p.speed)}>{p.children}</div>,
  SwiperSlide: (p: { children?: ReactNode }) => <div>{p.children}</div>,
}));
vi.mock('swiper/modules', () => ({ Pagination: {} }));
vi.mock('swiper/css', () => ({}));
vi.mock('swiper/css/pagination', () => ({}));

import OnboardingTour from '../../components/shared/OnboardingTour';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ICON_STERN } from '../../components/shared/icons';

const original = window.matchMedia;
afterEach(() => { cleanup(); window.matchMedia = original; });

const bewegung = (reduziert: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduziert, media: '', addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
};

const folien = [
  { icon: ICON_STERN, color: '#5b21b6', rgb: '91, 33, 182', title: 'Willkommen', text: 'Los geht es.' },
  { icon: ICON_STERN, color: '#5b21b6', rgb: '91, 33, 182', title: 'Termine', text: 'Alles im Blick.' },
];

describe('Bewegung reduzieren im gerenderten Baum (UI BF-12)', () => {
  it('Einfuehrung: ohne die Einstellung wischt der Swiper mit 300 ms', () => {
    bewegung(false);
    render(<OnboardingTour slides={folien} onClose={() => {}} />);
    expect(document.body.querySelector('[data-testid="swiper"]')!.getAttribute('data-speed')).toBe('300');
  });

  it('Einfuehrung: mit „Bewegung reduzieren" springt sie (speed 0)', () => {
    bewegung(true);
    render(<OnboardingTour slides={folien} onClose={() => {}} />);
    expect(document.body.querySelector('[data-testid="swiper"]')!.getAttribute('data-speed')).toBe('0');
    // Die Folien sind trotzdem da -- reduziert heisst ruhig, nicht leer.
    expect(document.body.textContent).toContain('Willkommen');
  });

  it('Vollbild-Lader: die drei Ladepunkte tragen ihre Animation im style-Attribut', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    const punkte = [...container.querySelectorAll<HTMLElement>('[style*="animation"]')];
    expect(punkte.length).toBe(3);
    for (const p of punkte) expect(p.style.animation).toMatch(/pulse 1\.5s infinite/);
  });
});
