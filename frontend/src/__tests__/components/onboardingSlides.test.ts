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

// ---------------------------------------------------------------------------
// Update-Walkthrough 2.1.1 (02.09.2026)
// ---------------------------------------------------------------------------
// Aus 73 CHANGELOG-Einträgen seit 2.1.0 wurde ausgewählt, was die jeweilige
// Rolle in der App auch merkt. Diese Tests halten fest, dass die Texte an der
// Wirklichkeit bleiben — und dass die Zusagen, die wir den Konfis geben,
// nicht stillschweigend verschwinden.
import { SLIDES as konfi211 } from '../../components/konfi/modals/KonfiUpdate211WalkthroughModal';
import { SLIDES as teamer211 } from '../../components/teamer/modals/TeamerUpdate211WalkthroughModal';
import { SLIDES as admin211 } from '../../components/admin/modals/AdminUpdate211WalkthroughModal';

const WALKTHROUGHS_211: [string, Slide[]][] = [
  ['Konfi 2.1.1', konfi211],
  ['Teamer 2.1.1', teamer211],
  ['Leitung 2.1.1', admin211],
];

describe('Update-Walkthrough 2.1.1', () => {
  it.each(WALKTHROUGHS_211)('%s hat Folien mit Titel und Text', (_name, slides) => {
    expect(slides.length).toBeGreaterThanOrEqual(3);
    for (const s of slides) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.text.trim().length).toBeGreaterThan(40);
    }
  });

  it.each(WALKTHROUGHS_211)('%s bleibt kurz genug zum Lesen', (_name, slides) => {
    // Ein Hinweis, der alles aufzählt, wird nicht gelesen. Fünf Folien sind
    // die Grenze, ab der man wegtippt.
    expect(slides.length).toBeLessThanOrEqual(5);
    for (const s of slides) {
      expect(s.text.length).toBeLessThanOrEqual(520);
    }
  });

  it('Konfi-Folien erklären den persönlichen Rückblick ohne Rangliste', () => {
    const text = konfi211.map(s => s.text).join(' ');
    expect(text).toContain('Jahrgang');
    // Der Vergleich ist anonym und nur nach oben — diese Zusage steht im
    // Code (routes/wrapped.js) und muss auch im Hinweis stehen.
    expect(text).toMatch(/ohne Namen|anonym/);
    // "keine Rangliste" ist die Zusage, "eine Rangliste" waere der Bruch.
    // Seit der Challenges-Folie (03.09.2026) kommt das Wort verneint vor --
    // gepruefte Absicht bleibt, dass NIRGENDS eine Rangliste versprochen
    // wird, nicht dass das Wort fehlt.
    expect(text).not.toMatch(/(?<!keine )Rangliste/);
    expect(text).not.toMatch(/Platz \d|besser als/);
  });

  it('Teamer-Folien nennen die Pflicht zum Grund nur nach einer Zusage', () => {
    const text = teamer211.map(s => s.text).join(' ');
    expect(text).toContain('Bin dabei');
    expect(text).toContain('freiwillig');
    // Der Grund ist NUR nach einer vorherigen Zusage Pflicht. Stünde das
    // falsch da, klänge die Absage nach einer Hürde, die sie nicht ist.
    expect(text).toMatch(/nach einer Zusage|nach einer vorherigen Zusage/);
  });

  it('Leitungs-Folien erklären die leere Liste als Grenze, nicht als Fehler', () => {
    const text = admin211.map(s => s.text).join(' ');
    expect(text).toContain('Jahrgang');
    expect(text).toContain('kein Fehler');
    // Teamer:innen sind von der Jahrgangs-Bindung ausgenommen.
    expect(text).toMatch(/Teamer:innen bleiben davon ausgenommen|erreichst du alle/);
  });

  it('keine Folie verspricht Punkte für Challenges', () => {
    // Challenges sind bewusst ohne Punkte und ohne Zähler (Migration 118).
    for (const [name, slides] of WALKTHROUGHS_211) {
      const text = slides.map(s => s.text).join(' ');
      expect(text, name).not.toMatch(/Punkte für (Challenges|Beiträge)/);
    }
  });
});
