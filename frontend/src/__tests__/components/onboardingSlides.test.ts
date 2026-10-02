import { describe, it, expect } from 'vitest';

// Textbaustein-Test für Onboarding und Update-Walkthrough ALLER drei Rollen.
// Die Walkthroughs sind seit 02.10.2026 die von 2.3.0; die Fassungen 2.0,
// 2.1.1 und 2.2.0 sind entfernt, mit ihnen die Prüfungen auf deren Inhalt
// („Neu: der Mitmachen-Tab", die Tab-Leisten von 2.0).
// Hintergrund (24.08.2026): Der Tab unten heißt "Mitmachen" und bündelt die
// Reiter "Events" und "Aktivitäten". Die Touren sprachen teilweise noch vom
// "Events-Tab", als wäre das der ganze Bereich — dieser Test verhindert, dass
// die alte Benennung zurückrutscht, und sichert den Kernunterschied
// (Events: vorher anmelden · Aktivitäten: hinterher melden) in den Texten ab.
import { SLIDES as konfiOnboarding } from '../../components/konfi/modals/KonfiOnboardingModal';
import { SLIDES as konfiUpdate } from '../../components/konfi/modals/KonfiUpdate230WalkthroughModal';
import { SLIDES as teamerOnboarding } from '../../components/teamer/modals/TeamerOnboardingModal';
import { SLIDES as teamerUpdate } from '../../components/teamer/modals/TeamerUpdate230WalkthroughModal';
import { SLIDES as adminOnboarding } from '../../components/admin/modals/AdminOnboardingModal';
import { SLIDES as adminUpdate } from '../../components/admin/modals/AdminUpdate230WalkthroughModal';

type Slide = { title: string; text: string; color?: string; rgb?: string };

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

});

// ---------------------------------------------------------------------------
// Änderungsanzeige 2.3.0 (26.09.2026)
// ---------------------------------------------------------------------------
// NEUE FARBREGEL (Simon, 26.09.2026): "Farben immer entsprechend der
// Kategorie auf die es einzahlt." Das loest die Dreifarben-Regel von 2.2.0
// ab -- dort trug jedes Systemthema dasselbe Blau. Eine Folie ueber Termine
// ist rot, eine ueber Challenges indigo, eine ueber Gemeinden traegt die
// Organisationsfarbe.
//
// Die Systemfarbe --app-color-users bleibt fuer das, was die GANZE App
// betrifft und keine eigene Kategorie hat: Postfach (faerbt sich sonst je
// Mitteilung, postfachBereich() faellt auf 'info' zurueck), Push-Auswahl und
// Dunkelmodus.
import { SLIDES as konfi230 } from '../../components/konfi/modals/KonfiUpdate230WalkthroughModal';
import { SLIDES as teamer230 } from '../../components/teamer/modals/TeamerUpdate230WalkthroughModal';
import { SLIDES as admin230 } from '../../components/admin/modals/AdminUpdate230WalkthroughModal';

const WALKTHROUGHS_230: [string, Slide[]][] = [
  ['Konfi 2.3.0', konfi230],
  ['Teamer 2.3.0', teamer230],
  ['Leitung 2.3.0', admin230],
];

const text230 = (slides: Slide[]) => slides.map((s) => `${s.title} ${s.text}`).join(' ');

describe('Änderungsanzeige 2.3.0', () => {
  it.each(WALKTHROUGHS_230)('%s hat Folien mit Titel und Text', (_name, slides) => {
    expect(slides.length).toBeGreaterThanOrEqual(3);
    for (const s of slides) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.text.trim().length).toBeGreaterThan(40);
    }
  });

  it.each(WALKTHROUGHS_230)('%s bleibt kurz genug zum Lesen', (_name, slides) => {
    // Unveraenderte Grenzen aus 2.2.0: hoechstens sechs Folien, keine ueber
    // 300 Zeichen ("die Leute sind faul zu lesen").
    expect(slides.length).toBeLessThanOrEqual(6);
    for (const s of slides) {
      expect(s.text.length, `zu lang: "${s.title}"`).toBeLessThanOrEqual(300);
    }
  });

  it.each(WALKTHROUGHS_230)('%s faerbt jede Folie nach ihrer Kategorie', (_name, slides) => {
    // Jede Folie traegt ein Bereichstoken -- kein Hexwert, keine erfundene
    // Farbe. Die Liste nennt die Bereiche, die in 2.3.0 vorkommen; eine
    // weitere Kategorie wird hier bewusst ergaenzt, nicht stillschweigend.
    const erlaubt = [
      'var(--app-color-events)',         // Termine
      'var(--app-color-challenges)',     // Challenges, Stempel
      'var(--app-color-organizations)',  // Gemeinden, Betrieb
      'var(--app-color-users)',          // app-weite Systemfunktionen
    ];
    for (const s of slides) {
      expect(erlaubt, `unerwartete Farbe bei "${s.title}": ${s.color}`).toContain(s.color);
    }
  });

  it.each(WALKTHROUGHS_230)('%s traegt zu jeder Farbe die passende rgb-Variable', (_name, slides) => {
    // `${color}d9` waere ungueltiges CSS -- die Tour baut den Verlauf ueber
    // rgb(var(--...-rgb)). Ein Paar, das nicht zusammenpasst, faerbt den
    // Hintergrund anders als das Symbol.
    for (const s of slides) {
      const erwartet = (s.color ?? '').replace('var(', '').replace(')', '') + '-rgb';
      expect(s.rgb, `Farbpaar passt nicht bei "${s.title}"`).toBe(erwartet);
      expect((s.rgb ?? '').startsWith('--'), `rgb muss der nackte Name sein: "${s.title}"`).toBe(true);
    }
  });

  it.each(WALKTHROUGHS_230)('%s nutzt NICHT das kraeftige Jahrgangs-Blau als Systemfarbe', (_name, slides) => {
    for (const s of slides) {
      expect(s.color).not.toBe('var(--app-color-jahrgang)');
    }
  });

  it.each(WALKTHROUGHS_230)('%s faerbt das Postfach app-weit, nicht nach einem Bereich', (_name, slides) => {
    // Das Postfach sammelt ALLE Bereiche -- es traegt deshalb die
    // Systemfarbe, nicht die eines einzelnen Bereichs.
    const folie = slides.find((s) => s.title.includes('Postfach'));
    expect(folie, 'jede Rolle braucht die Postfach-Folie').toBeTruthy();
    expect(folie!.color).toBe('var(--app-color-users)');
  });

  it('die drei grossen Neuerungen stehen in ALLEN Rollen', () => {
    // Postfach, Push-Auswahl und Dunkelmodus betreffen jede Rolle. Fehlt
    // eine davon irgendwo, sieht diese Rolle die groesste Aenderung nicht.
    for (const [name, slides] of WALKTHROUGHS_230) {
      const text = text230(slides);
      expect(text, `${name}: Postfach fehlt`).toMatch(/Postfach/);
      expect(text, `${name}: Push-Auswahl fehlt`).toMatch(/aufs Handy/);
      expect(text, `${name}: Dunkelmodus fehlt`).toMatch(/[Dd]unkel/);
    }
  });

  it('die Push-Auswahl sagt in JEDER Rolle, dass das Postfach bleibt', () => {
    // Der haeufigste Irrtum: "abgeschaltet" klingt nach "weg". Abgeschaltet
    // wird nur der Weg aufs Handy.
    for (const [name, slides] of WALKTHROUGHS_230) {
      const folie = slides.find((s) => s.text.includes('aufs Handy'));
      expect(folie, `${name}: Folie zur Push-Auswahl fehlt`).toBeTruthy();
      expect(folie!.text, name).toMatch(/im Postfach steht trotzdem alles/i);
    }
  });

  it('der Gemeinde-Umschalter steht NICHT bei den Konfis', () => {
    // Konfis gehoeren immer genau einer Gemeinde an.
    expect(text230(konfi230)).not.toMatch(/mehrere Gemeinden|Gemeinde-Umschalter|Umschalter/i);
    expect(text230(teamer230)).toMatch(/Gemeinden/);
    expect(text230(admin230)).toMatch(/Gemeinden/);
  });

  it('der Betriebs-Ueberblick steht NUR bei der Leitung', () => {
    expect(text230(admin230)).toMatch(/Betriebs-Überblick|Antwortzeiten/);
    expect(text230(konfi230)).not.toMatch(/Betriebs|Antwortzeiten|Auslastung/i);
    expect(text230(teamer230)).not.toMatch(/Betriebs|Antwortzeiten|Auslastung/i);
  });

  it.each(WALKTHROUGHS_230)('%s nennt keine Interna', (_name, slides) => {
    const text = text230(slides);
    for (const wort of ['Migration', 'Testumgebung', 'Datenbank', 'Server', 'R8', 'Crashlytics', 'Umami']) {
      expect(text, `Interna genannt: ${wort}`).not.toContain(wort);
    }
  });

  it.each(WALKTHROUGHS_230)('%s enthaelt keine Unicode-Emojis', (_name, slides) => {
    for (const s of slides) {
      expect(s.title).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s.text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('echte Umlaute, keine Umschreibungen', () => {
    for (const [name, slides] of WALKTHROUGHS_230) {
      const text = text230(slides);
      expect(text, name).not.toMatch(/\b(ae|oe|ue|ss)\b/);
      expect(text, name).not.toContain('Jahrgaeng');
      expect(text, name).not.toContain('spuerbar');
    }
  });
});
