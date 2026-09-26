import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { transform } from 'lightningcss';

/**
 * Jedes Stylesheet muss sich BAUEN lassen, nicht nur lesen.
 *
 * GEFUNDEN AM 26.09.2026, in der CI, nach dem Push: Der Frontend-Build brach
 * mit `SyntaxError: [lightningcss minify] Invalid qualified rule`. Ursache war
 * eine Klammer zu viel im Dunkelblock von variables.css -- `:root` wurde
 * geschlossen, danach stand `--app-schatten-karte-flaeche` nackt im
 * `@media`-Block, ohne Selektor.
 *
 * Warum kein bestehender Test das fand: Alle CSS-Tests dieses Verzeichnisses
 * (farbTokens, abstaendeTokens, dunkelmodus, typografieTokens, popoverBreite)
 * lesen die Datei als TEXT und suchen mit regulaeren Ausdruecken darin. Eine
 * kaputte Klammerstruktur faellt dabei nicht auf -- die gesuchten Zeichenketten
 * stehen ja alle da. Erst der Bundler parst wirklich.
 *
 * Der Fehler kostete einen CI-Lauf und haette, unbemerkt gepusht, den
 * Backend-Deploy still uebersprungen (die CI koppelt beides).
 *
 * Dieser Test schliesst die Luecke auf der richtigen Ebene: Er ruft denselben
 * Parser auf, den Vite im Build benutzt, mit `minify: true` wie dort -- ein
 * Fehler faellt damit in Sekunden statt erst im Runner.
 */

const THEME = 'src/theme';

const stylesheets = readdirSync(resolve(process.cwd(), THEME))
  .filter((d) => d.endsWith('.css'))
  .sort();

describe('Stylesheets: baubar, nicht nur lesbar', () => {
  it('es gibt ueberhaupt welche zu pruefen', () => {
    // Ohne diese Zusicherung waere der Test darunter gruen, wenn das
    // Verzeichnis umzieht -- und pruefte dann nichts mehr.
    expect(stylesheets.length).toBeGreaterThan(0);
    expect(stylesheets).toContain('variables.css');
  });

  it.each(stylesheets)('%s parst mit demselben Parser wie der Build', (datei) => {
    const pfad = join(THEME, datei);
    const code = readFileSync(resolve(process.cwd(), pfad));
    // minify: true wie in der Vite-Konfiguration -- ohne das meldet
    // lightningcss die "Invalid qualified rule" nicht.
    expect(() => transform({ filename: datei, code, minify: true })).not.toThrow();
  });

  it('die Gegenprobe: eine Deklaration ohne Selektor faellt auf', () => {
    // Genau der Fehler vom 26.09.2026, nachgebaut: :root geschlossen, die
    // Deklaration steht danach nackt im @media.
    const kaputt = Buffer.from(`
      @media (prefers-color-scheme: dark) {
        :root {
          --a: #fff;
        }
        --b: var(--a);
      }
    `);
    expect(() => transform({ filename: 'kaputt.css', code: kaputt, minify: true })).toThrow();

    // Und dasselbe richtig geschachtelt geht durch -- sonst wuerde der Test
    // oben auch bei gesundem CSS anschlagen.
    const heil = Buffer.from(`
      @media (prefers-color-scheme: dark) {
        :root {
          --a: #fff;
          --b: var(--a);
        }
      }
    `);
    expect(() => transform({ filename: 'heil.css', code: heil, minify: true })).not.toThrow();
  });
});
