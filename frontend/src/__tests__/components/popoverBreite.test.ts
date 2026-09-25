import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Abzeichen-, Stempel- und Level-Popover: feste Breite, kein `--width: auto`.
 *
 * Simons Befund am iPhone (25.09.2026): "Popover ueber Badges und Challenges
 * sind kaputt." Auf den Bildern ragte die weisse Flaeche ueber die
 * Glas-Sprechblase des ios27-Themes hinaus, der Pfeil sass neben der Kachel.
 *
 * Gemessen im Browser (Ionic 9.0.3, ios27-Theme, 393px breit): Die
 * Popover-Animation liest Breite und Hoehe des Inhalts per
 * getBoundingClientRect() BEVOR sie `left` setzt -- Ionics eigene Animation
 * wie die des Themes, das daraus zusaetzlich die Sprechblase als SVG mit
 * festen Massen zeichnet. Mit `--width: auto` steht der Inhalt in dem Moment
 * an seiner statischen Position (mittig, 196,5px Platz nach rechts), also
 * greift `min-width: 200px`: gemessen 200 x 223px. Nach dem Setzen von
 * `left` waechst er auf 320 x 175px. Sprechblase 200 breit, Inhalt 320 breit,
 * Pfeil 19px neben der Kachelmitte -- genau Simons Bilder.
 *
 * Mit fester Breite: vorher wie nachher 320px, Sprechblase 320 x 175.
 * Geprueft wird die REGEL im Stylesheet (wie in tabLeisteAndroid.test.ts):
 * jsdom hat kein Layout, und der Fehler entsteht erst in der Animation.
 */
describe('Popover-Breite: fest statt auto', () => {
  const css = lies('src/theme/variables.css');
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke = (selektor: string) =>
    [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].trim().replace(/\s+/g, ' ') === selektor)
      .map((m) => m[2]);

  const block = bloecke('.badge-popover-auto-width, .badge-detail-popover');

  it('gibt es genau einmal, fuer beide Klassen gemeinsam', () => {
    expect(block).toHaveLength(1);
  });

  it('setzt eine feste, vom Bildschirm abgeleitete Breite: min(320px, 85vw)', () => {
    // 320px auf jedem Geraet ab 377px Breite; darunter 85 % der Breite.
    // Ein intrinsischer Wert (auto, max-content, fit-content) haette in der
    // Animation wieder die 200px aus min-width -- oder 0, wie Ionic selbst im
    // Stylesheet zu select-popover-rich-content warnt.
    expect(block[0]).toMatch(/--width:\s*min\(320px, 85vw\)\s*;/);
    expect(block[0]).not.toMatch(/--width:\s*(auto|max-content|fit-content)/);
  });

  it('max-width ist derselbe Wert -- nichts, was die Animation nachtraeglich schrumpfen laesst', () => {
    expect(block[0]).toMatch(/--max-width:\s*min\(320px, 85vw\)\s*;/);
  });

  it('kein min-width mehr -- bei fester Breite waere es nur die naechste Falle', () => {
    expect(block[0]).not.toMatch(/--min-width/);
  });

  it('kein Popover im Stylesheet hat eine intrinsische Breite', () => {
    // Sonst kaeme derselbe Fehler an anderer Stelle zurueck.
    const intrinsisch = [...ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /--width:\s*(auto|max-content|fit-content)/.test(m[2]))
      .map((m) => m[1].trim());
    expect(intrinsisch).toEqual([]);
  });
});

describe('Level-Popover der Konfi-Startseite: dieselbe feste Breite', () => {
  // Simon: "Bei Leveln muss es nur spaeter umbrechen in der Sub-Zeile."
  // Ohne Klasse ist der Popover 200px breit, die Textspalte neben dem
  // 48px-Symbol 116px -- "30 Punkte erforderlich" (134px) brach nach
  // "Punkte" um. Mit 320px ist die Spalte 236px breit, eine Zeile.
  const quelle = lies('src/components/konfi/views/DashboardView.tsx');
  const aufruf = quelle.slice(quelle.indexOf('presentLevelPopover({'));
  const argumente = aufruf.slice(0, aufruf.indexOf('});'));

  it('uebergibt cssClass badge-detail-popover', () => {
    expect(argumente).toMatch(/cssClass:\s*'badge-detail-popover'/);
  });
});
