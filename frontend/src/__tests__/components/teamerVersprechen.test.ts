import { describe, it, expect } from 'vitest';
import { slidesFuer } from '../../components/shared/MitmachenErklaerungModal';
import { SLIDES as TEAMER_ONBOARDING_SLIDES } from '../../components/teamer/modals/TeamerOnboardingModal';

// Befund 26.08.2026: Zwei Texte versprachen Teamer:innen Funktionen, die es
// fuer sie nicht gibt. Beides sieht jedes neue Teammitglied beim ersten Start.
//
// - Das Onboarding sagte "Umfragen erstellen" -- chat.js:1732 lehnt das fuer
//   alles ausser type 'admin' mit 403 ab.
// - Die Mitmachen-Erklaerung zeigte Teamer:innen den Slide der Leitung
//   ("Du bestaetigst oder lehnst ab") -- activities.js:473 ist requireAdmin,
//   Teamer:innen sind dort ausgeschlossen.
//
// Geprueft wird beides in beide Richtungen: Das falsche Versprechen darf nicht
// mehr auftauchen, die richtige Aussage muss da sein. Ohne den zweiten Teil
// wuerde ein leerer Text als repariert durchgehen.

describe('Teamer-Texte versprechen nichts, was die App nicht kann', () => {
  describe('Mitmachen-Erklaerung', () => {
    const textVon = (rolle: 'konfi' | 'teamer' | 'admin') => {
      const slides = slidesFuer(rolle);
      return slides[slides.length - 1];
    };

    it('Teamer:innen bekommen nicht den Bestaetigen-Slide der Leitung', () => {
      const slide = textVon('teamer');
      expect(slide.title).not.toBe('Aktivitäten: bestätigen');
      expect(slide.text).not.toContain('bestätigst oder lehnst ab');
    });

    it('Teamer:innen lesen, dass sie eigene Einsaetze melden', () => {
      const slide = textVon('teamer');
      expect(slide.title).toBe('Aktivitäten: hinterher melden');
      expect(slide.text).toContain('eigenen Einsätze');
      // Und wer wirklich bestaetigt, steht auch da.
      expect(slide.text).toContain('Leitung');
    });

    it('die Leitung bekommt weiterhin den Bestaetigen-Slide', () => {
      // Gegenprobe: Die Trennung darf den richtigen Fall nicht mitnehmen.
      const slide = textVon('admin');
      expect(slide.title).toBe('Aktivitäten: bestätigen');
      expect(slide.text).toContain('bestätigst oder lehnst ab');
    });

    it('Konfis bekommen weiterhin ihren eigenen Slide', () => {
      const slide = textVon('konfi');
      expect(slide.title).toBe('Aktivitäten: hinterher melden');
      expect(slide.text).toContain('Dein Team schaut drauf');
    });

    it('jede Rolle bekommt gleich viele Folien', () => {
      expect(slidesFuer('teamer').length).toBe(slidesFuer('admin').length);
      expect(slidesFuer('teamer').length).toBe(slidesFuer('konfi').length);
    });
  });

  describe('Teamer-Onboarding', () => {
    const chatSlide = () =>
      TEAMER_ONBOARDING_SLIDES.find((s) => s.title === 'Dein Chat');

    it('verspricht nicht mehr, dass Teamer:innen Umfragen erstellen koennen', () => {
      const slide = chatSlide();
      expect(slide).toBeTruthy();
      expect(slide!.text).not.toContain('Umfragen erstellen');
    });

    it('sagt stattdessen, wer Umfragen anlegt', () => {
      const slide = chatSlide();
      expect(slide!.text).toContain('Umfragen');
      expect(slide!.text).toContain('Leitung');
    });

    it('sagt weiterhin nicht, dass Teamer:innen Termine anlegen', () => {
      // Frueher stand hier das Gegenteil; der Text wurde bereits korrigiert.
      // Dieser Test haelt den Stand fest, damit er nicht zurueckfaellt.
      const events = TEAMER_ONBOARDING_SLIDES.find((s) => s.title === 'Mitmachen: Events');
      expect(events).toBeTruthy();
      expect(events!.text).toContain('Angelegt werden Termine von der Leitung');
    });
  });
});
