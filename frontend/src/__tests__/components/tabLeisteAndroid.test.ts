import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Android-Tab-Leiste: deckend, 56px hoch, ein Inset — nicht zwei.
 *
 * Simons Befund am Samsung (25.09.2026, 3-Tasten-Navigation): Die Leiste war
 * 152 dp hoch statt 104, die Reiter standen 24 dp zu hoch, die Zaehler
 * schwebten 40 dp ueber den Symbolen, und hinter den Beschriftungen schien
 * die Konfi-Liste durch. Zwei Regeln, ein Bild:
 *
 *   height: calc(56px + <Inset>) + padding-bottom: <Inset>  -> Inset doppelt
 *   :root { --ion-tab-bar-background: rgba(..., 0.72) }      -> auch auf Android
 *                                                              durchsichtig, ohne
 *                                                              den iOS-Blur
 *
 * Geprueft wird die REGEL im Stylesheet (wie in md3LayoutPasst.test.ts): Ein
 * gerenderter Test braeuchte ein Geraet mit WebView >= 140, denn erst dort
 * reicht Capacitor den Inset durch — genau deshalb fiel der Fehler drei
 * Monate lang nicht auf.
 */
describe('Android-Tab-Leiste: Inset einfach, Hintergrund deckend', () => {
  const css = lies('src/theme/variables.css');

  // Alle Bloecke mit genau diesem Selektor (Kommentare vorher entfernen,
  // damit ein Beispiel im Kommentar nicht als Regel zaehlt).
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke = (selektor: string) =>
    [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].trim() === selektor)
      .map((m) => m[2]);

  describe('ion-tab-bar.md', () => {
    const md = bloecke('ion-tab-bar.md');

    it('gibt es genau einmal', () => {
      expect(md).toHaveLength(1);
    });

    it('die Hoehe ist 56px ohne Inset — der Inset steckt allein im Innenabstand', () => {
      // content-box: Hoehe + padding-bottom. Steht der Inset in beiden, ist
      // die Leiste 56px + 2 * Inset hoch (gemessen: 152 dp statt 104).
      expect(md[0]).toMatch(/height:\s*56px\s*!important/);
      expect(md[0]).not.toMatch(/height:\s*calc\(/);
      expect(md[0]).toMatch(/box-sizing:\s*content-box/);
    });

    it('der Innenabstand unten kommt aus Ionics Inset-Variable', () => {
      // Ionic speist --ion-safe-area-bottom aus der Variable, die Capacitors
      // System-Bars-Plugin schreibt — stimmt auch auf WebViews unter 140, wo
      // env(safe-area-inset-bottom) laut Capacitor-Doku falsch ist.
      expect(md[0]).toMatch(/padding-bottom:\s*var\(--ion-safe-area-bottom, 0px\)\s*!important/);
      expect(md[0]).not.toMatch(/env\(safe-area-inset-bottom/);
    });

    it('der Hintergrund ist deckend', () => {
      expect(md[0]).toMatch(/--background:\s*var\(--ion-background-color, #fff\)/);
      expect(md[0]).not.toMatch(/rgba\(/);
    });
  });

  describe('der iOS-Glaswert bleibt bei iOS', () => {
    const glasRegeln = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /--ion-tab-bar-background\s*:/.test(m[2]))
      .map((m) => ({ selektor: m[1].trim(), regeln: m[2] }));

    it('genau eine Regel setzt --ion-tab-bar-background', () => {
      expect(glasRegeln).toHaveLength(1);
    });

    it('sie haengt an ion-tab-bar.ios, nicht an :root', () => {
      // Auf :root gilt der Wert auch fuer Android — dort gibt es keinen Blur,
      // und 72 % Deckkraft ohne Blur heisst: die Liste scheint durch.
      expect(glasRegeln[0].selektor).toBe('ion-tab-bar.ios');
      // Der Ton kommt seit dem Dunkelmodus (25.09.2026) aus einem Token,
      // damit er im Dunkeln mitgeht; hell ist er unveraendert 247/247/247.
      expect(glasRegeln[0].regeln).toMatch(/rgba\(var\(--app-glasleiste-rgb\), 0\.72\)/);
      expect(css).toMatch(/^\s*--app-glasleiste-rgb: 247, 247, 247;/m);
    });
  });
});
