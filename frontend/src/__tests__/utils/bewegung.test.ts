import { describe, it, expect, afterEach, vi } from 'vitest';
import { bewegungReduziert } from '../../utils/bewegung';

// „Bewegung reduzieren" aus dem System lesen -- fuer Ionics Seitenuebergaenge
// und den Swiper der Einfuehrung, die kein CSS erreicht (Audit 26.09.2026,
// UI BF-12). Ohne matchMedia gilt: nicht reduziert, App wie bisher.

const original = window.matchMedia;
afterEach(() => { window.matchMedia = original; });

const mitMatchMedia = (matches: boolean) => {
  const mm = vi.fn().mockReturnValue({ matches, media: '', addEventListener: vi.fn(), removeEventListener: vi.fn() });
  window.matchMedia = mm as unknown as typeof window.matchMedia;
  return mm;
};

describe('bewegungReduziert', () => {
  it('true, wenn das System Bewegung reduzieren will -- und fragt genau diese Einstellung ab', () => {
    const mm = mitMatchMedia(true);
    expect(bewegungReduziert()).toBe(true);
    expect(mm).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('false, wenn nicht', () => {
    mitMatchMedia(false);
    expect(bewegungReduziert()).toBe(false);
  });

  it('false ohne matchMedia (alte WebViews, nackte Tests)', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(bewegungReduziert()).toBe(false);
  });
});
