import { describe, it, expect } from 'vitest';

// Textbaustein-Test für Onboarding und Update-Walkthrough ALLER drei Rollen.
// Hintergrund (24.08.2026): Der Tab unten heißt "Mitmachen" und bündelt die
// Reiter "Events" und "Aktivitäten". Die Touren sprachen teilweise noch vom
// "Events-Tab", als wäre das der ganze Bereich — dieser Test verhindert, dass
// die alte Benennung zurückrutscht, und sichert den Kernunterschied
// (Events: vorher anmelden · Aktivitäten: hinterher melden) in den Texten ab.
import { SLIDES as konfiOnboarding } from '../../components/konfi/modals/KonfiOnboardingModal';
import { SLIDES as konfiUpdate } from '../../components/konfi/modals/KonfiUpdateWalkthroughModal';
import { SLIDES as teamerOnboarding } from '../../components/teamer/modals/TeamerOnboardingModal';
import { SLIDES as teamerUpdate } from '../../components/teamer/modals/TeamerUpdateWalkthroughModal';
import { SLIDES as adminOnboarding } from '../../components/admin/modals/AdminOnboardingModal';
import { SLIDES as adminUpdate } from '../../components/admin/modals/AdminUpdateWalkthroughModal';

type Slide = { title: string; text: string };

const ALLE_TOUREN: [string, Slide[]][] = [
  ['Konfi-Onboarding', konfiOnboarding],
  ['Konfi-Update-Walkthrough', konfiUpdate],
  ['Teamer-Onboarding', teamerOnboarding],
  ['Teamer-Update-Walkthrough', teamerUpdate],
  ['Leitungs-Onboarding', adminOnboarding],
  ['Leitungs-Update-Walkthrough', adminUpdate],
];

const ONBOARDINGS: [string, Slide[]][] = [
  ['Konfi-Onboarding', konfiOnboarding],
  ['Teamer-Onboarding', teamerOnboarding],
  ['Leitungs-Onboarding', adminOnboarding],
];

const WALKTHROUGHS: [string, Slide[]][] = [
  ['Konfi-Update-Walkthrough', konfiUpdate],
  ['Teamer-Update-Walkthrough', teamerUpdate],
  ['Leitungs-Update-Walkthrough', adminUpdate],
];

describe('Onboarding- und Walkthrough-Texte: Mitmachen-Tab', () => {
  it.each(ALLE_TOUREN)('%s nennt den Bereich nirgends mehr "Events-Tab"', (_name, slides) => {
    for (const slide of slides) {
      expect(slide.title).not.toContain('Events-Tab');
      expect(slide.text).not.toContain('Events-Tab');
    }
  });

  it.each(ALLE_TOUREN)('%s enthält keine Unicode-Emojis', (_name, slides) => {
    // Projektregel: keine Emojis in UI-Texten. Der Punkt (·) und der
    // Gedankenstrich sind erlaubt und werden von \p{Extended_Pictographic}
    // nicht erfasst.
    for (const slide of slides) {
      expect(slide.title).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(slide.text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it.each(ONBOARDINGS)('%s erklärt Events und Aktivitäten als Reiter des Mitmachen-Tabs', (_name, slides) => {
    const eventsIndex = slides.findIndex((s) => s.title === 'Mitmachen: Events');
    const aktivitaetenIndex = slides.findIndex((s) => s.title === 'Mitmachen: Aktivitäten');
    expect(eventsIndex).toBeGreaterThan(-1);
    expect(aktivitaetenIndex).toBe(eventsIndex + 1);

    // Der Events-Slide führt den Tab-Namen ein und nennt beide Reiter.
    const events = slides[eventsIndex];
    expect(events.text).toContain('"Mitmachen"');
    expect(events.text).toContain('Aktivitäten');
    expect(events.text).toContain('vorher');

    // Der Aktivitäten-Slide verortet sich im Mitmachen-Tab und trägt den
    // Kernunterschied: nicht anmelden, sondern hinterher melden.
    const aktivitaeten = slides[aktivitaetenIndex];
    expect(aktivitaeten.text).toContain('Mitmachen-Tab');
    expect(aktivitaeten.text).toContain('hinterher');
  });

  it.each(WALKTHROUGHS)('%s stellt den Mitmachen-Tab mit beiden Reitern vor', (_name, slides) => {
    const tabSlides = slides.filter((s) => s.title === 'Neu: der Mitmachen-Tab');
    expect(tabSlides).toHaveLength(1);
    const text = tabSlides[0].text;
    expect(text).toContain('Mitmachen');
    expect(text).toContain('Events');
    expect(text).toContain('Aktivitäten');
    // Kernunterschied muss auch im Was-ist-neu stehen.
    expect(text).toContain('vorher');
    expect(text).toContain('hinterher');
  });

  it('Teamer-Walkthrough nennt die echte Tab-Leiste', () => {
    const text = teamerUpdate.map((s) => s.text).join(' ');
    expect(text).toContain('Start · Chat · Mitmachen · Challenges · Badges');
  });

  it('Leitungs-Walkthrough nennt die echte Tab-Leiste', () => {
    const text = adminUpdate.map((s) => s.text).join(' ');
    expect(text).toContain('Konfis · Chat · Mitmachen · Challenges · Mehr');
  });
});
