import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Zaehler an den Reitern: auf iOS oben rechts am Symbol, nicht mittig darauf.
 *
 * Simons Befund am iPhone (25.09.2026): "die badges auf ios haengen ganz
 * schoen tief in der navigationsbar fast mittig auf dem icon."
 *
 * Der Badge haengt an `.button-inner` im Shadow-DOM des Knopfs, und das
 * Symbol steht darin je Look woanders — gemessen im Browser (Ionic 9.0.3,
 * beide Themes, Reiter mit Symbol und Text):
 *
 *   Android  Symbol-Oberkante 10px unter .button-inner (Rand 6 + Innenabstand 4)
 *            -> `top: 4px` beginnt 6px UEBER dem Symbol.        Richtig.
 *   iOS      Symbol-Oberkante bei 0 (justify-content: flex-start, kein Rand)
 *            -> `top: 4px` beginnt 4px UNTER dem Symbol, endet bei 20 von 26px.
 *
 * Dieselbe Beziehung wie auf Android (Oberkante = Symbol - 6px) heisst auf
 * iOS `top: -6px`. Geprueft wird die REGEL im Stylesheet (wie in
 * tabLeisteAndroid.test.ts): Das gerenderte Ergebnis haengt am Theme-CSS im
 * Shadow-DOM, das jsdom nicht layoutet.
 */
describe('Reiter-Zaehler auf iOS: oben rechts am Symbol', () => {
  const css = lies('src/theme/variables.css');

  // Kommentare vorher entfernen, damit ein Beispiel im Kommentar nicht als
  // Regel zaehlt.
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke = (selektor: string) =>
    [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].trim() === selektor)
      .map((m) => m[2]);

  describe('die gemeinsame Regel (gilt fuer Android)', () => {
    const gemeinsam = bloecke('ion-tab-button ion-badge');

    it('gibt es genau einmal', () => {
      expect(gemeinsam).toHaveLength(1);
    });

    it('bleibt bei top: 4px — Android ist seit dem 25.09.2026 nachweislich richtig', () => {
      // Von Simon im Emulator bestaetigt. Wer hier dreht, verschiebt Android.
      expect(gemeinsam[0]).toMatch(/top:\s*4px\s*;/);
      expect(gemeinsam[0]).toMatch(/position:\s*absolute/);
    });

    it('die waagerechte Position bleibt gemeinsam', () => {
      // 24px rechts der Knopfmitte: Symbol endet bei +12 (MD) bzw. +13 (iOS),
      // der Badge ragt auf beiden um 11-12px darueber hinaus. Kein Unterschied,
      // der einen eigenen iOS-Wert rechtfertigt.
      expect(gemeinsam[0]).toMatch(/right:\s*calc\(50% - 24px\)/);
    });
  });

  describe('die iOS-Regel', () => {
    const ios = bloecke('ion-tab-bar.ios ion-tab-button ion-badge');

    it('gibt es genau einmal', () => {
      expect(ios).toHaveLength(1);
    });

    it('hebt den Badge um 10px an: top: -6px', () => {
      // Symbol-Oberkante bei 0 im Bezugskasten; Badge-Oberkante 6px darueber,
      // wie auf Android. Bleibt 1px unter der Knopf-Oberkante — nicht
      // abgeschnitten.
      expect(ios[0]).toMatch(/top:\s*-6px\s*;/);
    });

    it('setzt NUR top — Groesse, Farbe und waagerechte Lage bleiben gemeinsam', () => {
      const eigenschaften = ios[0]
        .split(';')
        .map((z) => z.split(':')[0].trim())
        .filter(Boolean);
      expect(eigenschaften).toEqual(['top']);
    });

    it('steht nach der gemeinsamen Regel, damit sie im Zweifel gewinnt', () => {
      // Sie gewinnt schon durch die hoehere Spezifitaet; die Reihenfolge ist
      // die zweite Sicherung.
      expect(ohneKommentare.indexOf('ion-tab-bar.ios ion-tab-button ion-badge')).toBeGreaterThan(
        ohneKommentare.indexOf('ion-tab-button ion-badge {'),
      );
    });
  });

  it('keine andere Regel setzt top am Reiter-Badge', () => {
    // Sonst gaebe es eine dritte Quelle, und die Herleitung oben stimmt nicht mehr.
    const mitTop = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /ion-badge/.test(m[1]) && /ion-tab/.test(m[1]) && /(^|;)\s*top\s*:/.test(m[2]))
      .map((m) => m[1].trim());
    expect(mitTop.sort()).toEqual(['ion-tab-bar.ios ion-tab-button ion-badge', 'ion-tab-button ion-badge']);
  });
});
