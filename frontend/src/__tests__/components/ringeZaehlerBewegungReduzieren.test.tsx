import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { render, renderHook, cleanup, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// „Ringe und Zähler beachten ‚Bewegung reduzieren' nicht" (offene Befunde,
// geprüft 08.10.2026): Die Punkte-Ringe (ActivityRings) zeichneten sich über
// 1,5 s von 0 bis zum Ziel, die Zahlen im Rückblick (useCountUp) zählten
// hoch -- auch wenn das System „Bewegung reduzieren" verlangte. Der
// CSS-Block in theme/barrierefreiheit.css erreicht beides nicht, weil
// requestAnimationFrame die Werte setzt. Dazu wischte der Rückblick mit
// 500 ms und 3D-Effekt von Seite zu Seite (Swiper speed).
//
// Jetzt fragen alle drei utils/bewegung.ts: reduziert heißt sofort der
// Endstand, kein Zwischenbild. Gegenprobe je Fall: ohne die Einstellung
// beginnt die Animation weiterhin bei 0.
// ---------------------------------------------------------------------------

vi.mock('swiper/react', () => ({
  Swiper: (p: { children?: ReactNode; speed?: number }) => <div data-testid="swiper" data-speed={String(p.speed)}>{p.children}</div>,
  SwiperSlide: (p: { children?: ReactNode }) => <div>{p.children}</div>,
}));
vi.mock('swiper/modules', () => ({ EffectCreative: {} }));
vi.mock('swiper/css', () => ({}));
vi.mock('swiper/css/pagination', () => ({}));
vi.mock('swiper/css/effect-creative', () => ({}));

import { useCountUp } from '../../hooks/useCountUp';
import ActivityRings from '../../components/admin/views/ActivityRings';
import EventsSlide from '../../components/wrapped/slides/EventsSlide';
import WrappedModal from '../../components/wrapped/WrappedModal';
import type { KonfiWrappedData, KonfiEventsSlide } from '../../types/wrapped';

const original = window.matchMedia;
const bewegung = (reduziert: boolean) => {
  window.matchMedia = vi.fn((abfrage: string) => ({
    matches: abfrage === '(prefers-reduced-motion: reduce)' ? reduziert : false,
    media: abfrage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

// requestAnimationFrame von Hand weiterdrehen: jeder Aufruf rückt die Zeit vor.
let rahmen: Array<FrameRequestCallback> = [];
let jetzt = 1000;
const drehe = (ms: number) => {
  jetzt += ms;
  const faellig = rahmen;
  rahmen = [];
  act(() => { for (const f of faellig) f(jetzt); });
};

beforeEach(() => {
  rahmen = [];
  jetzt = 1000; // nicht 0: ActivityRings hält einen Startwert 0 für „noch nicht gestartet"
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => { rahmen.push(f); return rahmen.length; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockImplementation(() => jetzt);
});

afterEach(() => {
  cleanup();
  window.matchMedia = original;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useCountUp', () => {
  it('mit „Bewegung reduzieren": sofort der Endstand, kein Bildwechsel angefordert', () => {
    bewegung(true);
    const { result } = renderHook(() => useCountUp(137, true));
    expect(result.current).toBe(137);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('ohne die Einstellung: beginnt bei 0 und zählt hoch bis zum Ziel', () => {
    bewegung(false);
    const { result } = renderHook(() => useCountUp(137, true));
    expect(result.current).toBe(0);
    drehe(0);
    drehe(750);
    // ease-out cubic bei 50 %: 1 - 0,5^3 = 0,875 -> floor(0,875 * 137) = 119
    expect(result.current).toBe(119);
    drehe(750);
    expect(result.current).toBe(137);
  });

  it('inaktive Seite bleibt auch reduziert bei 0', () => {
    bewegung(true);
    const { result } = renderHook(() => useCountUp(137, false));
    expect(result.current).toBe(0);
  });
});

describe('Seite im Rückblick (EventsSlide, nutzt useCountUp)', () => {
  const EVENTS = { total_attended: 23, total_available: 30, abgesagt: 0 } as KonfiEventsSlide;
  // Die Zahl steht mit einem „×" dahinter („23×").
  const zahl = (c: HTMLElement) => (c.querySelector('.kat-zahl')?.textContent || '').trim();

  it('reduziert: die Zahl steht im ersten Bild auf 23', () => {
    bewegung(true);
    const { container } = render(<EventsSlide isActive events={EVENTS} />);
    expect(zahl(container)).toBe('23×');
  });

  it('Gegenprobe ohne Einstellung: im ersten Bild steht 0', () => {
    bewegung(false);
    const { container } = render(<EventsSlide isActive events={EVENTS} />);
    expect(zahl(container)).toBe('0×');
  });
});

describe('ActivityRings', () => {
  // size 160: strokeWidth 12, äußerer Radius 160/2 - 6 - 4 = 70
  const umfang = 2 * Math.PI * 70;
  // Erster farbiger Kreis = erste Runde des äußeren Rings (Gesamt).
  const versatzAussen = (c: HTMLElement) => Number(c.querySelectorAll('circle')[1].getAttribute('stroke-dashoffset'));
  const props = { totalPoints: 10, gottesdienstPoints: 5, gemeindePoints: 5, gottesdienstGoal: 10, gemeindeGoal: 10 };

  it('reduziert: der Ring steht im ersten Bild auf dem Endstand (10 von 20 = 50 %)', () => {
    bewegung(true);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { container } = render(<ActivityRings {...props} />);
    expect(versatzAussen(container)).toBeCloseTo(umfang * 0.5, 6);
    // Auch nach der Zeit, in der sonst die Animation liefe, bleibt er dort.
    act(() => { vi.advanceTimersByTime(200); });
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(versatzAussen(container)).toBeCloseTo(umfang * 0.5, 6);
  });

  it('Gegenprobe ohne Einstellung: beginnt leer (Versatz = Umfang) und zeichnet sich bis 50 %', () => {
    bewegung(false);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { container } = render(<ActivityRings {...props} />);
    expect(versatzAussen(container)).toBeCloseTo(umfang, 6);
    act(() => { vi.advanceTimersByTime(100); });
    drehe(0);
    drehe(1500);
    expect(versatzAussen(container)).toBeCloseTo(umfang * 0.5, 6);
  });
});

describe('Rückblick: Wisch von Seite zu Seite', () => {
  const KONFI = {
    version: 3,
    highlight_type: 'events_held',
    formulierung_seed: 0,
    slides: {
      gemeinde: 'Kirchspiel Westerdeich',
      punkte: { gottesdienst: 81, gemeinde: 56, total: 137, bonus: 0 },
      events: { total_attended: 23, total_available: 30, abgesagt: 0 },
      badges: { total_earned: 9, total_available: 20, badges: [] },
      aktivster_monat: { monat: 5, monat_name: 'Mai', aktivitaeten: 11 },
      endspurt: { aktiv: false, fehlende_punkte: 0, ziel_total: 100, aktuell_total: 137 },
      zeitraum: { start: '2025-09-01', ende: '2026-05-10', konfirmation: '2026-05-10' },
      kategorie: { verteilung: [], top_kategorie: null },
    },
  } as unknown as KonfiWrappedData;

  const geschwindigkeit = () => document.body.querySelector('[data-testid="swiper"]')!.getAttribute('data-speed');

  it('reduziert: springt (speed 0)', () => {
    bewegung(true);
    render(<WrappedModal onClose={() => {}} displayName="Emilia" initialData={KONFI} initialYear={2026} wrappedType="konfi" />);
    expect(geschwindigkeit()).toBe('0');
  });

  it('Gegenprobe ohne Einstellung: wischt mit 500 ms', () => {
    bewegung(false);
    render(<WrappedModal onClose={() => {}} displayName="Emilia" initialData={KONFI} initialYear={2026} wrappedType="konfi" />);
    expect(geschwindigkeit()).toBe('500');
  });
});
