import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Dunkelmodus, zweiter Teil (25.09.2026): Farben aus JavaScript.
 *
 * dunkelmodus.test.ts prueft das Stylesheet. Diese Datei prueft die andere
 * Luecke, die der Dunkelmodus-Commit selbst gemeldet hatte: Der JS-Spiegel
 * theme/colors.ts haelt die HELLEN Hexwerte, und wer sie als Textfarbe,
 * Rahmen oder feine Linie auf eine Karte schreibt, bekommt im Dunkeln ein
 * zu dunkles Ergebnis -- die CSS-Tokens wechseln, der JS-Wert nicht.
 *
 *   (a) Chat-Reaktionen und Metrik-Ampel (Text-/Symbolfarben) sind
 *       CSS-Variablen, und jedes Token dahinter hat eine dunkle Entsprechung.
 *   (b) Die Kopfbereiche (SectionHeader) lesen keine Tokens mehr beim Laden
 *       des Moduls, sondern geben var() an den Browser weiter; jeder
 *       Preset hat sein -rgb-Tripel fuer den Schatten.
 *   (c) FARBEN aus theme/colors.ts darf nur noch dort in Komponenten
 *       vorkommen, wo die Farbe eine FLAECHE MIT WEISSEM TEXT ist oder eine
 *       Bibliothek selbst malt. Jede Datei steht mit Grund in der Liste;
 *       eine neue Datei ohne Eintrag macht den Test rot.
 */

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ohneKommentare = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function dateienUnter(verzeichnis: string, endung: string): string[] {
  const voll = resolve(process.cwd(), verzeichnis);
  const raus: string[] = [];
  for (const eintrag of readdirSync(voll)) {
    if (eintrag === 'node_modules' || eintrag === '__tests__' || eintrag === '__mocks__') continue;
    const pfad = join(voll, eintrag);
    if (statSync(pfad).isDirectory()) raus.push(...dateienUnter(join(verzeichnis, eintrag), endung));
    else if (eintrag.endsWith(endung)) raus.push(join(verzeichnis, eintrag));
  }
  return raus;
}

const css = ohneKommentare(lies('src/theme/variables.css'));
const dunkelBlock = /@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
const hell = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/g, '');
const tokenNamen = (quelle: string) => new Set([...quelle.matchAll(/^\s*(--app-[a-z0-9-]+):/gm)].map((m) => m[1]));
const helleTokens = tokenNamen(hell);
const dunkleTokens = tokenNamen(dunkelBlock);

/** Alle var(--app-color-…)-Verweise in einem Quelltext. */
const varVerweise = (code: string) => [...code.matchAll(/var\((--app-color-[a-z0-9-]+)\)/g)].map((m) => m[1]);
const HEX = /#[0-9a-fA-F]{6}\b/g;

/**
 * Komponenten, die FARBEN (helle Hexwerte) noch beziehen duerfen -- jede mit
 * dem Grund, warum der Wert im Dunkelmodus NICHT wechseln muss.
 */
const FARBEN_ERLAUBT: Record<string, string> = {
  'src/components/konfi/views/DashboardSections.tsx': 'Abzeichen-Stufen und Level-Kacheln: Verlaufsflaeche mit weissem Symbol, Alpha-Suffix aus dem Hex',
  'src/components/konfi/views/BadgesView.tsx': 'Abzeichen-Stufen: Verlaufsflaeche mit weissem Symbol, Alpha-Suffix aus dem Hex',
  'src/components/admin/views/KonfiBadgesSection.tsx': 'Abzeichen-Stufen: Verlaufsflaeche mit weissem Symbol (Raster rechnet mit Hex)',
  'src/components/shared/BadgePopoverContent.tsx': 'Abzeichen-Stufen: Verlaufsflaeche mit weissem Symbol, Alpha-Suffix aus dem Hex',
  'src/components/teamer/pages/TeamerKonfiStatsPage.tsx': 'Gruppenkacheln und Abzeichen-Raster: Verlaufsflaeche mit weissem Symbol, Hex fuer Alpha-Suffix',
};

describe('Dunkelmodus: Chat-Reaktionen und Metrik-Ampel kommen aus Tokens', () => {
  const chat = ohneKommentare(lies('src/components/chat/constants.ts'));
  const colors = ohneKommentare(lies('src/theme/colors.ts'));
  const ampel = colors.slice(colors.indexOf('export const METRIK_AMPEL'));

  it('chat/constants.ts enthaelt keinen Hexwert mehr, nur var(--app-color-…)', () => {
    expect(chat.match(HEX) ?? []).toEqual([]);
    expect(chat).toContain('color: `var(--app-color-${token})`');
    expect(chat).toContain('rgb: `var(--app-color-${token}-rgb)`');
    // Sechs Reaktionen, jede mit Farbe UND -rgb-Tripel fuer den Hintergrund.
    expect((chat.match(/\.\.\.farbe\('/g) ?? []).length).toBe(6);
  });

  it('METRIK_AMPEL besteht aus fuenf var()-Werten ohne Hex', () => {
    expect(ampel.match(HEX) ?? []).toEqual([]);
    expect(varVerweise(ampel)).toHaveLength(5);
  });

  it('jedes Token dahinter existiert hell UND dunkel (Farbe und -rgb-Tripel)', () => {
    const reaktionen = [...chat.matchAll(/farbe\('([a-z0-9-]+)'\)/g)].map((m) => `--app-color-${m[1]}`);
    const fehlt: string[] = [];
    for (const name of [...reaktionen, ...varVerweise(ampel)]) {
      if (!helleTokens.has(name)) fehlt.push(`${name} fehlt (hell)`);
      if (!dunkleTokens.has(name)) fehlt.push(`${name} fehlt (dunkel)`);
    }
    for (const name of reaktionen) {
      if (!helleTokens.has(`${name}-rgb`)) fehlt.push(`${name}-rgb fehlt (hell)`);
      if (!dunkleTokens.has(`${name}-rgb`)) fehlt.push(`${name}-rgb fehlt (dunkel)`);
    }
    expect(fehlt).toEqual([]);
  });

  it('MessageBubble haengt kein Alpha-Suffix mehr an die Reaktionsfarbe', () => {
    const code = ohneKommentare(lies('src/components/chat/MessageBubble.tsx'));
    expect(code).not.toMatch(/\$\{data\.color\}[0-9a-f]{2}/);
    expect(code).toContain('rgba(${data.rgb}, 0.1)');
  });
});

describe('Dunkelmodus: Kopfbereiche geben var() an den Browser weiter', () => {
  const code = ohneKommentare(lies('src/components/shared/SectionHeader.tsx'));

  it('liest keine Tokens mehr beim Laden des Moduls und importiert FARBEN nicht', () => {
    expect(code).not.toContain('getComputedStyle');
    expect(code).not.toMatch(/\bFARBEN\b/);
  });

  it('jeder Preset nennt ein Token mit -dunkel-Partner und -rgb-Tripel, alle dreifach vorhanden', () => {
    const presets = [...code.matchAll(/preset\('([a-z-]+)', '([a-z-]+)'\)/g)];
    expect(presets.length).toBe(13);
    const fehlt: string[] = [];
    for (const [, primaer, sekundaer] of presets) {
      for (const name of [`--app-color-${primaer}`, `--app-color-${sekundaer}`, `--app-color-${primaer}-rgb`]) {
        if (!helleTokens.has(name)) fehlt.push(`${name} (hell)`);
        if (!dunkleTokens.has(name)) fehlt.push(`${name} (dunkel)`);
      }
    }
    expect(fehlt).toEqual([]);
  });

  it('Aufrufer mit eigenen colors reichen ebenfalls var() durch (Chat, Einstellungen, vergangene Termine)', () => {
    const aufrufer = [
      'src/components/chat/ChatOverview.tsx',
      'src/components/admin/pages/AdminDashboardSettingsPage.tsx',
      'src/components/konfi/views/EventDetailView.tsx',
      'src/components/admin/views/EventDetailView.tsx',
      'src/components/teamer/pages/TeamerEventsPage.tsx',
    ];
    for (const datei of aufrufer) {
      const quelle = ohneKommentare(lies(datei));
      expect(quelle, datei).not.toMatch(/\bFARBEN\b/);
    }
  });
});

describe('Dunkelmodus: FARBEN nur noch fuer Flaechen mit weissem Text', () => {
  it('Text-, Rahmen- und Linienfarben (TrialBanner, Rollenfarben, Badge-Ringe) beziehen kein FARBEN mehr', () => {
    for (const datei of [
      'src/components/shared/TrialBanner.tsx',
      'src/components/admin/UsersView.tsx',
      'src/components/admin/modals/UserManagementModal.tsx',
    ]) {
      expect(ohneKommentare(lies(datei)), datei).not.toMatch(/\bFARBEN\b/);
    }
    // BadgesView darf FARBEN fuer die Stufen-Flaechen behalten -- aber nicht
    // als SVG-Ring auf Kartengrund: dort muss die Linie mit dem Modus wechseln.
    const badges = ohneKommentare(lies('src/components/konfi/views/BadgesView.tsx'));
    expect(badges).not.toMatch(/stroke=\{FARBEN\./);
    expect(badges).toContain("style={{ stroke: 'var(--app-border)' }}");
    expect(badges).toContain("style={{ stroke: 'var(--app-color-users)' }}");
  });

  it('jede Komponente, die FARBEN importiert, steht mit Grund in der Liste -- und kein Eintrag ist tot', () => {
    const importiert = dateienUnter('src', '.tsx').filter((d) =>
      /import \{[^}]*\bFARBEN\b[^}]*\} from '[./]*theme\/colors'/.test(ohneKommentare(lies(d))),
    );
    const ohneGrund = importiert.filter((d) => !(d in FARBEN_ERLAUBT));
    const tot = Object.keys(FARBEN_ERLAUBT).filter((d) => !importiert.includes(d));
    expect(ohneGrund).toEqual([]);
    expect(tot).toEqual([]);
    expect(importiert).toHaveLength(Object.keys(FARBEN_ERLAUBT).length);
  });

  it('keine Komponente setzt eine FARBEN-Konstante als Text- oder Rahmenfarbe', () => {
    // `color: FARBEN.x` in einem style={{}} oder ein `stroke={FARBEN.x}`
    // waere genau der Fehler: heller Hexwert als Textfarbe auf dunklem Grund.
    const treffer: string[] = [];
    for (const datei of Object.keys(FARBEN_ERLAUBT)) {
      const code = ohneKommentare(lies(datei));
      for (const m of code.matchAll(/(?:^|[\s{,])(color|borderColor|borderLeftColor|stroke|fill):\s*FARBEN\.[a-zA-Z]+/g)) {
        // `color:` als Feld einer Gruppen-Konfiguration ({ key, title, icon, color }) ist eine Flaeche;
        // nur innerhalb eines style={{…}} ist es eine Textfarbe.
        const davor = code.slice(Math.max(0, m.index! - 200), m.index!);
        if (/style=\{\{[^}]*$/.test(davor)) treffer.push(`${datei}: ${m[0].trim()}`);
      }
      for (const m of code.matchAll(/(?:stroke|fill)=\{FARBEN\.[a-zA-Z]+\}/g)) treffer.push(`${datei}: ${m[0]}`);
    }
    expect(treffer).toEqual([]);
  });
});
