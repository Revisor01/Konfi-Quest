import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Reiter-Beschriftungen mit Unterlaenge ganz sichtbar (Simon, TestFlight 233,
 * 29.09.2026): "unten in der Navigation ist das G bei Challenges
 * abgeschnitten, zumindest auf iOS. Da liegt irgendwas drueber."
 *
 * Es liegt nichts darueber -- die Beschriftung beschneidet sich selbst. Sie
 * traegt `overflow: hidden` (fuer die Auslassungspunkte) und ist ein
 * Flex-Kind in einem Reiter fester Hoehe. Seit die Schrift auf 0.7rem
 * gewachsen ist (UI-Audit BF-07, 27.09.2026), passt ihre Zeile nicht mehr in
 * den Rest, und Flexbox staucht den Kasten -- die Zeile darin bleibt so hoch
 * wie vorher, ihr unteres Ende wird abgeschnitten, und mit ihm die
 * Unterlaengen (g, j, p, y).
 *
 * Gemessen (Playwright, lokaler Web-Build, alle drei Rollen, 360 und 393 px):
 *   iOS, Wurzel 17 px (Standard-Textgroesse): Kasten 12,00 px, Zeile 14,28 px;
 *     die Tinte von "Challenges" und "Badges" reicht 2,14 px unter den Kasten.
 *   Android: Kasten 11,80 px (Wurzel 16: 10,67 px), Zeile 14,00 px.
 * Mit `flex-shrink: 0` bekommt die Beschriftung ihre ganze Zeile: 0 von 60
 * Beschriftungen ragen noch unter ihren Kasten (vorher alle mit Unterlaenge).
 *
 * jsdom rechnet kein Layout; der Test prueft die Regel und die Rechnung
 * gegen die Werte der ausgelieferten Themes. Aendert ein Theme-Update die
 * Werte, faellt er -- dann neu messen.
 */
const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ohneKommentare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const css = ohneKommentare(lies('src/theme/variables.css'));
const bloecke = (selektor: string): string[] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim().replace(/\s+/g, ' ') === selektor))
    .map((m) => m[2]);

describe('Reiter: die Beschriftung wird nicht gestaucht', () => {
  it('iOS-Theme: Reiter 54 px, Innenabstand 7/7, Symbol 26 px + 2 px, Zeile 1.2 -- die Beschriftung muesste schrumpfen', () => {
    const ios = lies('node_modules/@rdlabo/ionic-theme-ios27/dist/css/components/ion-tabs.css');
    expect(ios).toMatch(/ion-tab-button\.ios:not\(\.ios-theme-disabled,\.ios26-disabled\)\{background:[^}]*height:54px/);
    expect(ios).toMatch(/\.tab-layout-icon-top\.tab-has-icon\.tab-has-label\{--padding-top: 7px;--padding-bottom: 7px;justify-content:flex-start\}/);
    expect(ios).toMatch(/ion-tab-button\.ios:not\(\.ios-theme-disabled,\.ios26-disabled\) ion-icon\{font-size:26px\}/);
    expect(ios).toMatch(/tab-has-label ion-icon\{flex-shrink:0;margin-block:0 2px\}/);
    expect(ios).toMatch(/tab-has-label ion-label\{margin:0;font-size:inherit;line-height:1\.2;min-height:0\}/);

    // Platz fuer die Beschriftung: 54 - 7 - 7 - 26 - 2 = 12 px.
    const platz = 54 - 7 - 7 - 26 - 2;
    expect(platz).toBe(12);
    // Ihre Zeile bei der Obergrenze 12 px (unsere Regel unten): 14,4 px.
    // Bei Standard-Textgroesse (Wurzel 17 px) 0.7rem = 11,9 px -> 14,28 px.
    expect(12 * 1.2).toBeGreaterThan(platz);
    expect(17 * 0.7 * 1.2).toBeGreaterThan(platz);
    // Deshalb darf sie nicht schrumpfen -- und das Symbol tut es auf iOS
    // ohnehin nicht (flex-shrink:0 im Theme), der Reiter-Knopf gibt den
    // Ueberstand frei (::part(native) overflow visible).
    expect(ios).toMatch(/::part\(native\)\{overflow:visible;min-height:54px\}/);
  });

  it.each(['ios', 'md'])('%s: ion-label im Reiter schrumpft nicht', (look) => {
    // Je Look in seinem Block -- jede Reiter-Regel ist auf EINEN Look
    // eingegrenzt (md3LayoutPasst.test.ts).
    const regel = bloecke(`ion-tab-bar.${look} ion-tab-button ion-label`);
    expect(regel).toHaveLength(1);
    expect(regel[0]).toMatch(/flex-shrink:\s*0\s*!important/);
  });

  it('die Auslassungspunkte bleiben (waagerecht): overflow hidden steht weiter an der Android-Beschriftung', () => {
    const md = bloecke('ion-tab-bar.md ion-tab-button ion-label');
    expect(md).toHaveLength(1);
    expect(md[0]).toMatch(/overflow:\s*hidden\s*!important/);
    expect(md[0]).toMatch(/text-overflow:\s*ellipsis\s*!important/);
  });

  it('Android: 4 px Abstand unter der Beschriftung statt 6 -- das Symbol behaelt seine Hoehe', () => {
    // MD3: Symbol margin-top 6 + 24 + 2 x 4 Innenabstand, Beschriftung
    // margin 2/6, Leiste 56 px (unsere Regel). Mit ganzer Zeile (12 px bei
    // Wurzel 16) waeren das 58 px; ohne den Ausgleich staucht Flexbox das
    // Symbol von gemessen 29,33 auf 28 px. Mit 4 px unten: 30 px.
    const md3 = lies('node_modules/@rdlabo/ionic-theme-md3/dist/css/ionic-theme-md3.css');
    expect(md3).toMatch(/ion-tab-bar\.md:not\(\.md3-disabled\) ion-tab-button ion-label\{margin-top:2px;margin-bottom:6px\}/);
    const md = bloecke('ion-tab-bar.md ion-tab-button ion-label');
    expect(md[0]).toMatch(/margin-bottom:\s*4px\s*!important/);
  });
});
