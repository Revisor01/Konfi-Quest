import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Android-Kopfleiste: deckend in BEIDEN Modi, iOS bleibt Glas.
 *
 * Befund (Play-Bildschirmfoto der Challenge-Seite, 10.10.2026): Im hellen
 * Modus schien der Inhalt beim Rollen scharf durch die Kopfleiste -- die
 * Reiter Feed/Meins lagen ueber dem Plus-Knopf. Ursache: `:root` setzt
 * `--ion-toolbar-background` auf Glas mit 72 % Deckkraft; den Weichzeichner
 * dazu gibt es nur im iOS-Look. Die deckende md-Regel stand allein im
 * Dunkelblock, im Hellen galt auf Android also das Glas ohne Blur.
 *
 * Geprueft wird die Regel im Stylesheet (wie tabLeisteAndroid.test.ts): Was
 * AUSSERHALB von `@media (prefers-color-scheme: dark)` steht, ist der Hellmodus
 * -- und gilt im Dunkeln weiter, soweit der Dunkelblock nichts Spezifischeres
 * setzt.
 */
describe('Android-Kopfleiste: deckend auch im hellen Modus', () => {
  const css = lies('src/theme/variables.css').replace(/\/\*[\s\S]*?\*\//g, '');

  /** Entfernt jeden `@media (prefers-color-scheme: dark) { ... }`-Block samt Inhalt. */
  const ohneDunkelbloecke = (text: string) => {
    let aus = '';
    let i = 0;
    const kopf = /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = kopf.exec(text))) {
      aus += text.slice(i, m.index);
      let tiefe = 1;
      let j = m.index + m[0].length;
      while (tiefe > 0 && j < text.length) {
        if (text[j] === '{') tiefe++;
        else if (text[j] === '}') tiefe--;
        j++;
      }
      i = j;
      kopf.lastIndex = j;
    }
    return aus + text.slice(i);
  };

  const hell = ohneDunkelbloecke(css);
  const regeln = [...hell.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selektor: m[1].trim(), rumpf: m[2] }));
  const leistenRegeln = regeln.filter((r) => /--ion-toolbar-background\s*:/.test(r.rumpf));
  const wert = (rumpf: string) => /--ion-toolbar-background\s*:\s*([^;]+);/.exec(rumpf)![1].trim();

  it('der Dunkelblock wurde tatsaechlich herausgeschnitten -- sonst prueft der Test den falschen Modus', () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
    expect(hell).not.toMatch(/prefers-color-scheme:\s*dark/);
    // Der Dunkelton der Leiste steht nur im Dunkelblock.
    expect(css).toMatch(/--app-glasleiste-rgb:\s*28, 28, 30;/);
    expect(hell).not.toMatch(/--app-glasleiste-rgb:\s*28, 28, 30;/);
  });

  it('im Hellmodus setzen genau zwei Regeln die Kopfleiste: Glas auf :root, deckend auf html:root.md', () => {
    expect(leistenRegeln.map((r) => r.selektor)).toEqual([':root', 'html:root.md']);
  });

  it('md: deckend im Leisten-Ton der App, ohne Alpha', () => {
    const md = leistenRegeln.find((r) => r.selektor === 'html:root.md')!;
    expect(wert(md.rumpf)).toBe('rgb(var(--app-glasleiste-rgb))');
  });

  it('iOS behaelt das Glas: :root mit 72 % Deckkraft, keine iOS-Regel im Hellmodus deckt es zu', () => {
    const root = leistenRegeln.find((r) => r.selektor === ':root')!;
    expect(wert(root.rumpf)).toBe('rgba(var(--app-glasleiste-rgb), 0.72)');
    expect(leistenRegeln.some((r) => /\.ios\b/.test(r.selektor))).toBe(false);
  });

  it('die md-Regel ist spezifischer als :root und als Ionics :root.md der Dunkel-Palette', () => {
    // html:root.md = 1 Element + Pseudoklasse + Klasse = (0,2,1);
    // :root = (0,1,0); Ionics `:root.md` = (0,2,0). Damit ist die
    // Ladereihenfolge egal -- variables.css kommt zwar nach der Palette,
    // darauf soll sich die Leiste aber nicht verlassen.
    const spez = (s: string) => {
      const klassen = (s.match(/[.:][\w-]+/g) ?? []).length;
      const elemente = (s.replace(/[.:][\w-]+/g, '').match(/[a-z][\w-]*/gi) ?? []).length;
      return klassen * 10 + elemente;
    };
    expect(spez('html:root.md')).toBe(21);
    expect(spez('html:root.md')).toBeGreaterThan(spez(':root'));
    expect(spez('html:root.md')).toBeGreaterThan(spez(':root.md'));
  });
});
