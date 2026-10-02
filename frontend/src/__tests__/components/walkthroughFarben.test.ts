import { describe, it, expect } from 'vitest';
import { SLIDES as admin230 } from '../../components/admin/modals/AdminUpdate230WalkthroughModal';
import { SLIDES as teamer230 } from '../../components/teamer/modals/TeamerUpdate230WalkthroughModal';
import { SLIDES as konfi230 } from '../../components/konfi/modals/KonfiUpdate230WalkthroughModal';
import {
  ICON_GLOCKE,
  ICON_BENACHRICHTIGUNG,
  ICON_MOND,
  ICON_TERMIN_GEFUELLT,
  ICON_CHALLENGE_GEFUELLT,
  ICON_GEMEINDE_GEFUELLT,
  ICON_TACHO,
} from '../../components/shared/icons';

// Simons Farbordnung: Jede Folie traegt die Farbe des Bereichs, von dem sie
// handelt -- nicht irgendeine. Zuerst festgelegt am 03.09.2026 (damals lagen
// Material auf Gruen und der Rueckblick auf Pink, beides gehoerte anderen
// Bereichen), fuer die Aenderungsanzeige 2.3.0 bekraeftigt (26.09.2026):
// "Farben immer entsprechend der Kategorie auf die es einzahlt."
//
// Geprueft wird die ausgelieferte Anzeige, also die 2.3.0-Modale. Bis zum
// 02.10.2026 stand hier die 2.1.1-Fassung, die keine Seite mehr einbindet --
// der Test lief gruen, waehrend die Folien, die tatsaechlich erscheinen,
// ungeprueft blieben.
//
// Den Bereich einer Folie nennt ihr SYMBOL. Farbe und Symbol muessen
// denselben Bereich meinen; sonst steht ein Kalender auf Indigo und das Auge
// liest "Challenge". onboardingSlides.test.ts prueft nur, dass jede Farbe
// aus der erlaubten Menge stammt -- eine vertauschte Farbe faellt erst hier
// auf.

type Slide = { title: string; text: string; icon: string; color?: string; rgb?: string };

const ALLE: [string, Slide[]][] = [
  ['Leitung', admin230 as Slide[]],
  ['Team', teamer230 as Slide[]],
  ['Konfi', konfi230 as Slide[]],
];

// Symbol -> Bereichsfarbe. Postfach, Push-Auswahl und Dunkelmodus betreffen
// die ganze App und haben keine eigene Kategorie: Sie tragen die
// Systemfarbe --app-color-users.
const FARBE_ZUM_SYMBOL: Array<{ symbol: string; bereich: string; farbe: string }> = [
  { symbol: ICON_GLOCKE, bereich: 'Postfach', farbe: 'users' },
  { symbol: ICON_BENACHRICHTIGUNG, bereich: 'Push-Auswahl', farbe: 'users' },
  { symbol: ICON_MOND, bereich: 'Dunkelmodus', farbe: 'users' },
  { symbol: ICON_TERMIN_GEFUELLT, bereich: 'Termine', farbe: 'events' },
  { symbol: ICON_CHALLENGE_GEFUELLT, bereich: 'Challenges', farbe: 'challenges' },
  { symbol: ICON_GEMEINDE_GEFUELLT, bereich: 'Gemeinden', farbe: 'organizations' },
  { symbol: ICON_TACHO, bereich: 'Betrieb', farbe: 'organizations' },
];

const regelFuer = (slide: Slide) => FARBE_ZUM_SYMBOL.find((r) => r.symbol === slide.icon);

describe('Aenderungsanzeige 2.3.0: Folienfarben folgen dem Bereich', () => {
  for (const [rolle, slides] of ALLE) {
    for (const slide of slides) {
      it(`${rolle}: "${slide.title}" traegt die Farbe seines Bereichs`, () => {
        const regel = regelFuer(slide);
        // Ein neues Symbol ohne Regel waere eine Folie, deren Farbe niemand
        // prueft. Die Regel wird dann hier bewusst ergaenzt.
        expect(regel, `kein Bereich fuer das Symbol von "${slide.title}"`).toBeTruthy();
        expect(slide.color, `${regel!.bereich}`).toBe(`var(--app-color-${regel!.farbe})`);
        expect(slide.rgb, `${regel!.bereich}`).toBe(`--app-color-${regel!.farbe}-rgb`);
      });
    }
  }

  it('alle drei Rollen haben Folien (sonst prueft der Test nichts)', () => {
    expect(ALLE.map(([, slides]) => slides.length)).toEqual([6, 5, 5]);
  });

  it('dieselbe Neuerung traegt in allen Rollen dieselbe Farbe', () => {
    // Postfach, Push-Auswahl und Dunkelmodus stehen in jeder Rolle. Waren sie
    // je Rolle verschieden gefaerbt, saehe dieselbe Funktion dreimal anders
    // aus -- genau das war bei der App-Sperre in 2.2.0 passiert.
    for (const symbol of [ICON_GLOCKE, ICON_BENACHRICHTIGUNG, ICON_MOND]) {
      const farben = ALLE.map(([, slides]) => slides.find((s) => s.icon === symbol)?.color);
      expect(farben).toEqual([
        'var(--app-color-users)',
        'var(--app-color-users)',
        'var(--app-color-users)',
      ]);
    }
  });
});
