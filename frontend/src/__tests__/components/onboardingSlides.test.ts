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
    // Das Team ist von der Jahrgangs-Bindung ausgenommen.
    expect(text).toMatch(/Das Team bleibt davon ausgenommen/);
  });

  it('keine Folie verspricht Punkte für Challenges', () => {
    // Challenges sind bewusst ohne Punkte und ohne Zähler (Migration 118).
    for (const [name, slides] of WALKTHROUGHS_211) {
      const text = slides.map(s => s.text).join(' ');
      expect(text, name).not.toMatch(/Punkte für (Challenges|Beiträge)/);
    }
  });
});

// ---------------------------------------------------------------------------
// Änderungsanzeige 2.2.0 (14.09.2026)
// ---------------------------------------------------------------------------
// Aus dem CHANGELOG-Abschnitt 2.2.0 wurde je Rolle ausgewählt, was sie in der
// App auch merkt. Diese Tests halten fest, dass die Auswahl zur Rolle passt
// und die Texte an der Wirklichkeit bleiben.
import { SLIDES as konfi220 } from '../../components/konfi/modals/KonfiUpdate220WalkthroughModal';
import { SLIDES as teamer220 } from '../../components/teamer/modals/TeamerUpdate220WalkthroughModal';
import { SLIDES as admin220 } from '../../components/admin/modals/AdminUpdate220WalkthroughModal';

const WALKTHROUGHS_220: [string, Slide[]][] = [
  ['Konfi 2.2.0', konfi220],
  ['Teamer 2.2.0', teamer220],
  ['Leitung 2.2.0', admin220],
];

const text220 = (slides: Slide[]) => slides.map((s) => `${s.title} ${s.text}`).join(' ');

describe('Änderungsanzeige 2.2.0', () => {
  it.each(WALKTHROUGHS_220)('%s hat Folien mit Titel und Text', (_name, slides) => {
    expect(slides.length).toBeGreaterThanOrEqual(3);
    for (const s of slides) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.text.trim().length).toBeGreaterThan(40);
    }
  });

  it.each(WALKTHROUGHS_220)('%s bleibt kurz genug zum Lesen', (_name, slides) => {
    // Höchstens 4-6 Punkte je Rolle, lieber weniger. Fünf Folien sind die
    // Grenze, ab der man wegtippt.
    expect(slides.length).toBeLessThanOrEqual(5);
    for (const s of slides) {
      expect(s.text.length).toBeLessThanOrEqual(520);
    }
  });

  it.each(WALKTHROUGHS_220)('%s enthält keine Unicode-Emojis', (_name, slides) => {
    for (const s of slides) {
      expect(s.title).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s.text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it.each(WALKTHROUGHS_220)('%s nennt die App-Sperre — sie betrifft alle', (_name, slides) => {
    const text = text220(slides);
    expect(text).toContain('Face ID');
    // Wo die Sperre eingestellt wird, muss dabeistehen: eine Funktion, die
    // man nicht findet, ist keine.
    expect(text).toContain('Profil');
    // Die Sperre ist von Haus aus AUS -- das ist die Zusage.
    expect(text).toMatch(/von Haus aus (ist die Sperre )?aus/);
  });

  it.each(WALKTHROUGHS_220)('%s verspricht keine Abmeldung durch die Sperre', (_name, slides) => {
    // Angemeldet bleibt man, das ist der Unterschied zum Abmelden.
    // Gross/klein egal -- am Satzanfang steht "Angemeldet bleibst du dabei".
    expect(text220(slides)).toMatch(/angemeldet bleibst du dabei/i);
  });

  it.each(WALKTHROUGHS_220)('%s nennt keine Interna', (_name, slides) => {
    // Messung, Migrationen, Testumgebung und Verbindungsfreigabe stehen im
    // CHANGELOG unter "Sonstiges" und interessieren niemanden in der App.
    const text = text220(slides);
    for (const wort of ['Messung', 'Migration', 'Testumgebung', 'Verbindungsfreigabe', 'Datenbank', 'Server']) {
      expect(text, wort).not.toContain(wort);
    }
  });

  it('Konfi-Folien nennen Stempel und Tempo, nicht die Arbeit der Leitung', () => {
    const text = text220(konfi220);
    expect(text).toContain('Challenge-Stempel');
    // Dateien aus dem Chat nur noch einmal laden.
    expect(text).toMatch(/nur noch einmal|zweiten Antippen/);
    expect(text).toContain('schneller');
    // Abzeichen mit Emoji im Rückblick.
    expect(text).toContain('Emoji');
    // Was die Leitung tut, gehört nicht in die Konfi-Fassung.
    expect(text).not.toContain('Abgemeldet');
    expect(text).not.toContain('95 Symbole');
    expect(text).not.toContain('Jahrgäng');
  });

  it('Teamer-Folien nennen Abmeldung, Notiz und wer eingetragen hat', () => {
    const text = text220(teamer220);
    expect(text).toContain('Abgemeldet');
    expect(text).toContain('Notiz');
    // Der Grund landet in der Teilnehmerliste, damit das Team ihn sieht.
    expect(text).toContain('Teilnehmerliste');
    // Wer eingetragen hat -- der Punkt, wegen dem man bei Rückfragen weiß,
    // wen man fragt.
    expect(text).toMatch(/wer die Anwesenheit zuletzt eingetragen hat/);
    // Punkte gibt es bei einer Abmeldung keine, schon vergebene gehen zurück.
    expect(text).toMatch(/Punkte gibt es dabei keine|zurückgenommen/);
    // Die Symbolauswahl legt die Leitung an, nicht das Team.
    expect(text).not.toContain('95 Symbole');
  });

  it('Leitungs-Folien nennen die Jahrgangsgrenzen als Grenze, nicht als Fehler', () => {
    const text = text220(admin220);
    expect(text).toContain('Jahrgäng');
    // Eine leere Liste ist kein Fehler -- dieselbe Zusage wie in 2.1.1.
    expect(text).toContain('kein Fehler');
    // Allgemeine und Team-Termine bleiben offen; ohne diesen Satz klänge die
    // Grenze schärfer, als sie ist.
    expect(text).toMatch(/Team-Termine bleiben für alle offen/);
    expect(text).toContain('95 Symbole');
    expect(text).toContain('Abgemeldet');
  });

  it('nur die Leitung bekommt die Folie zu den Jahrgangsgrenzen', () => {
    // Konfis und Teamer:innen legen keine Termine an -- die Grenze betrifft
    // sie nicht, und ein Hinweis darauf wäre nur Lärm.
    expect(text220(admin220)).toContain('Serientermine');
    expect(text220(konfi220)).not.toContain('Serientermine');
    expect(text220(teamer220)).not.toContain('Serientermine');
  });

  it('keine Folie verspricht Punkte für Challenges', () => {
    for (const [name, slides] of WALKTHROUGHS_220) {
      expect(text220(slides), name).not.toMatch(/Punkte für (Challenges|Beiträge)/);
    }
  });

  it('echte Umlaute, keine Umschreibungen', () => {
    for (const [name, slides] of WALKTHROUGHS_220) {
      const text = text220(slides);
      expect(text, name).not.toMatch(/\b(ae|oe|ue|ss)\b/);
      expect(text, name).not.toContain('Jahrgaeng');
      expect(text, name).not.toContain('spuerbar');
    }
  });
});
