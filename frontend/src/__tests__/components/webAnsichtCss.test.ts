import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spezifitaet, vergleich, regeln as themeRegeln, teileObersteEbene } from '../cssSpezifitaet';

// Das eigene Stylesheet der Web-Fassungen (theme/web-ansicht.css, 03.10.2026,
// docs/planung/support-web.md, Entscheidung 2). Es gilt nur dort, wo eine
// Seite ihre web-Klassen setzt, und haelt sich an die Regeln der App: nur
// Tokens, keine eigenen Farbwerte (der Dunkelmodus kommt dadurch von selbst),
// keine Bewegung (die Regel fuer reduzierte Bewegung greift nur an
// app-Klassen), keine fremden Ionic-Regeln. Der Test liest die Quelle.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const css = lies('src/theme/web-ansicht.css');
/** Ohne Kommentare: dort duerfen alte Werte und Begriffe stehen. */
const ohneKommentare = (quelle: string) => quelle.replace(/\/\*[\s\S]*?\*\//g, '');
const rein = ohneKommentare(css);

const regeln = (quelle: string): Array<[string, string]> =>
  [...quelle.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

describe('theme/web-ansicht.css: eigenes Stylesheet der Web-Fassungen', () => {
  it('wird global eingebunden, nach variables.css (dessen Tokens es liest)', () => {
    const app = lies('src/App.tsx');
    expect(app).toContain("import './theme/web-ansicht.css';");
    expect(app.indexOf("import './theme/web-ansicht.css';")).toBeGreaterThan(app.indexOf("import './theme/variables.css';"));
  });

  it('jede Klasse traegt das Praefix web- (einzige Ausnahme: der Punkt der App fuer Ungelesenes)', () => {
    const klassen = new Set([...rein.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    // Zahlen wie 0.01 oder 1.5 sind keine Klassen: nur Namen mit Buchstaben am Anfang zaehlen.
    const fremd = [...klassen].filter((k) => !k.startsWith('web-') && k !== 'app-ungelesen-punkt');
    expect(fremd).toEqual([]);
    expect(klassen.size).toBeGreaterThan(60);
  });

  it('keine eigenen Farbwerte: weder #hex noch rgb(), rgba(), hsl() -- nur Tokens (der Dunkelmodus kommt von selbst)', () => {
    expect(rein.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(rein.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []).toEqual([]);
    // Benannte Farben ausser transparent/currentColor/inherit gibt es auch nicht.
    const benannt = [...rein.matchAll(/(?:^|;|\{)\s*(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*([a-z]+)\s*[;}]/g)].map((m) => m[1]);
    expect(benannt.filter((n) => !['transparent', 'currentColor', 'inherit', 'none', 'currentcolor'].includes(n))).toEqual([]);
  });

  it('Farben und Schatten stehen als var(--app-…), var(--ion-…) oder var(--web-…)', () => {
    const unerlaubt: string[] = [];
    for (const [, rumpf] of regeln(rein)) {
      for (const m of rumpf.matchAll(/var\((--[\w-]+)/g)) {
        if (!/^--(?:app|ion|web)-/.test(m[1])) unerlaubt.push(m[1]);
      }
    }
    expect(unerlaubt).toEqual([]);
    // Jedes --web-Token, das gelesen wird, ist auch definiert.
    const definiert = new Set([...rein.matchAll(/(--web-[\w-]+)\s*:/g)].map((m) => m[1]));
    const gelesen = new Set([...rein.matchAll(/var\((--web-[\w-]+)/g)].map((m) => m[1]));
    expect([...gelesen].filter((t) => !definiert.has(t))).toEqual([]);
  });

  // Gemessen 11.10.2026: „Neuer Jahrgang" (520 px, ohne breit) bei 1280 x 800
  // -- die Knoepfe lagen bei 809-845 px, der Dialog endete bei 776 px.
  it('die Knopfleiste jedes Dialogs bleibt beim Scrollen unten im Bild, nicht nur im breiten', () => {
    const alle = regeln(rein);
    const leiste = alle.find(([s]) => s === '.web-dialog__aktionen')?.[1] ?? '';
    expect(leiste).toMatch(/position:\s*sticky;/);
    expect(leiste).toMatch(/bottom:\s*calc\(-1 \* var\(--app-abstand-gross\)\);/);
    expect(leiste).toMatch(/background:\s*var\(--web-karte\);/);
    expect(alle.filter(([s]) => /\.web-dialog--breit\s+\.web-dialog__aktionen/.test(s))).toEqual([]);
    // Was den Fokus bekommt, scrollt der Browser ueber die Leiste statt dahinter.
    const dialog = alle.find(([s]) => s === '.web-dialog')?.[1] ?? '';
    expect(dialog).toMatch(/scroll-padding-bottom:\s*calc\(6 \* var\(--app-abstand-gross\)\);/);
  });

  it('der Dunkelmodus legt nur Aliasse um -- Seitengrund und Hover --, keine Farbwerte', () => {
    const von = rein.indexOf('@media (prefers-color-scheme: dark)');
    expect(von).toBeGreaterThan(-1);
    // Die schliessende Klammer des Blocks steht als einzige in Spalte 0.
    const block = rein.slice(von, rein.indexOf('\n}', von));
    expect(block).toContain('--web-grund');
    expect(block).toContain('--web-hover');
    const werte = [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
    expect(werte.map(([name]) => name)).toEqual(['--web-grund', '--web-hover']);
    expect(werte.filter(([, wert]) => !/^var\(--(?:app|ion)-[\w-]+\)$/.test(wert))).toEqual([]);
  });

  it('keine Uebergaenge und Animationen -- die Regel fuer reduzierte Bewegung greift nur an app-Klassen', () => {
    expect(rein).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z]+)?\s*:/);
    expect(rein).not.toContain('@keyframes');
    // Auch im Kommentar kein zweiter Fundort fuer die Zaehlmethode von bewegungsreduktion.test.ts.
    expect(css).not.toContain('prefers-reduced-motion');
  });

  it('greift in keinen Ionic-Baustein ein ausser in den Inhalt der Seite (ion-content.web-inhalt)', () => {
    const ionRegeln = regeln(rein).filter(([selektor]) => /(^|[\s,>+~(])ion-[a-z]/.test(selektor));
    expect(ionRegeln.map(([s]) => s)).toEqual(['ion-content.web-inhalt']);
  });

  it('Schriftgroessen nur als Token; Abstaende, Radien und Schatten ebenso (Breiten und Hoehen duerfen Pixel sein)', () => {
    const zeilen = rein.split('\n');
    const roheSchrift = zeilen.filter((z) => /^\s*font-size\s*:\s*[\d.]+(?:px|rem|em)\b/.test(z));
    expect(roheSchrift).toEqual([]);
    const roheAbstaende = zeilen.filter((z) => /^\s*(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*[^;]*(?<![\w(-])[1-9]\d*px/.test(z) && !/var\(/.test(z));
    expect(roheAbstaende).toEqual([]);
    expect(zeilen.filter((z) => /^\s*border-radius\s*:\s*[1-9]\d*px/.test(z))).toEqual([]);
    expect(zeilen.filter((z) => /^\s*box-shadow\s*:\s*[^;]*rgba/.test(z))).toEqual([]);
  });

  it('sichtbarer Fokus an allem Bedienbaren: Links, Knoepfe, Chips, Akkordeons, Suchfeld, Diagrammflaeche, Kacheln', () => {
    const fokus = regeln(rein).filter(([s]) => s.includes(':focus-visible')).map(([s]) => s).join('\n');
    for (const klasse of ['.web-link', '.web-knopf', '.web-chip', '.web-akkordeon__kopf', '.web-suche__eingabe', '.web-diagramm__flaeche', 'a.web-kachel']) {
      expect(fokus, klasse).toContain(`${klasse}:focus-visible`);
    }
  });
});

describe('Bausteine der Web-Fassung: Ionic nur, wo es Arbeit leistet', () => {
  const alle = (ordner: string): string[] =>
    readdirSync(ordner).flatMap((n) => {
      const p = join(ordner, n);
      return statSync(p).isDirectory() ? alle(p) : p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : [];
    });
  // Die allgemeinen Bausteine (components/web/, seit 03.10.2026 fuer alle
  // Bereiche) und jede Web-Fassung eines Bereichs (components/<bereich>/web/).
  const webOrdner = (ordner: string): string[] =>
    readdirSync(ordner).flatMap((n) => {
      const p = join(ordner, n);
      if (!statSync(p).isDirectory()) return [];
      return n === 'web' ? [p] : webOrdner(p);
    });
  const dateien = webOrdner(resolve(process.cwd(), 'src/components')).flatMap(alle);

  it('keine IonList, IonItem, IonCard, IonListHeader in den Web-Varianten', () => {
    expect(dateien.length).toBeGreaterThan(30);
    const funde: string[] = [];
    for (const d of dateien) {
      const text = readFileSync(d, 'utf8');
      for (const m of text.matchAll(/<(IonList|IonItem|IonCard|IonCardContent|IonListHeader|IonLabel|IonSegment|IonRefresher)\b/g)) funde.push(`${d}: ${m[1]}`);
    }
    expect(funde).toEqual([]);
  });

  it('Links sind echte <a href> mit dem Router-Muster der Leiste (useIonRouter, kein onClick auf Nicht-Links)', () => {
    const link = readFileSync(resolve(process.cwd(), 'src/components/web/WebLink.tsx'), 'utf8');
    expect(link).toContain('<a href={href}');
    expect(link).toContain('useIonRouter');
    expect(link).toContain("router.push(href, 'none', 'push')");
    expect(link).toMatch(/ereignis\.button !== 0 \|\| ereignis\.metaKey \|\| ereignis\.ctrlKey/);
  });
});

// Stylesheets der Bereiche (theme/web/<bereich>.css, Web-Fassung aller
// Bereiche, docs/planung/web-alle-bereiche.md): dieselben Regeln wie
// web-ansicht.css -- Praefix web-, nur Tokens, keine Bewegung, kein Eingriff
// in Ionic. Ihre --web-Tokens kommen aus web-ansicht.css oder aus der Datei
// selbst.
describe('theme/web/*.css: Stylesheets der Bereiche', () => {
  const ordner = resolve(process.cwd(), 'src/theme/web');
  const dateien = (() => {
    try {
      return readdirSync(ordner).filter((n) => n.endsWith('.css')).map((n) => join(ordner, n));
    } catch {
      return [];
    }
  })();
  const basisTokens = new Set([...rein.matchAll(/(--web-[\w-]+)\s*:/g)].map((m) => m[1]));

  it.each(dateien.length ? dateien : ['(keine)'])('%s haelt die Regeln ein', (datei) => {
    if (datei === '(keine)') return;
    const text = ohneKommentare(readFileSync(datei, 'utf8'));
    const klassen = new Set([...text.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    expect([...klassen].filter((k) => !k.startsWith('web-'))).toEqual([]);
    expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(text.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []).toEqual([]);
    const fremdeVars = [...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((v) => !/^--(?:app|ion|web)-/.test(v));
    expect(fremdeVars).toEqual([]);
    const eigene = new Set([...text.matchAll(/(--web-[\w-]+)\s*:/g)].map((m) => m[1]));
    const gelesen = [...text.matchAll(/var\((--web-[\w-]+)/g)].map((m) => m[1]);
    expect(gelesen.filter((t) => !basisTokens.has(t) && !eigene.has(t))).toEqual([]);
    expect(text).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z]+)?\s*:/);
    expect(text).not.toContain('@keyframes');
    const ionRegeln = regeln(text).filter(([selektor]) => /(^|[\s,>+~(])ion-[a-z]/.test(selektor));
    expect(ionRegeln.map(([sel]) => sel)).toEqual([]);
    expect(text.split('\n').filter((z) => /^\s*font-size\s*:\s*[\d.]+(?:px|rem|em)\b/.test(z))).toEqual([]);
  });

  // Filterzeile der Challenges (offene Befunde, 07.10.2026: zweizeilig bis
  // etwa 1400 px Fensterbreite). Ursache: Suche und Umschalter meldeten mit
  // der Wunschbreite der Suche (360 px) rund 470 px an und brachen die Zeile
  // unter 1100 px Inhaltsbreite um. Gemessen am 08.10.2026 im Browser an der
  // gerenderten Leiste: vorher einzeilig ab 1100 px, jetzt ab 910 px.
  // jsdom rechnet kein Layout; festgehalten werden die Werte, die das tragen.
  it('challenges.css: Suche und Umschalter der Filterzeile melden hoechstens 280 px an', () => {
    const text = ohneKommentare(readFileSync(join(ordner, 'challenges.css'), 'utf8'));
    const regel = (selektor: string) => regeln(text).find(([sel]) => sel === selektor)?.[1] ?? '';
    const rechts = regel('.web-challenge-filter__zeile > .web-werkzeuge__rechts');
    expect(rechts).toMatch(/flex:\s*1 1 280px;/);
    expect(rechts).toMatch(/min-width:\s*0;/);
    const suche = regel('.web-challenge-filter__zeile > .web-werkzeuge__rechts > .web-suche');
    expect(suche).toMatch(/flex:\s*1 1 200px;/);
    expect(suche).toMatch(/min-width:\s*200px;/);
  });
});

// Die Modale der App im breiten Browserfenster (theme/web-modale.css,
// Simon 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Die
// Datei setzt als einzige Regeln auf ion-modal -- deshalb eine eigene Datei
// und nicht web-ansicht.css (Regel oben: kein Eingriff in Ionic). Damit sie
// nie die Apps trifft, beginnt jeder Selektor mit html[data-layout='breit'];
// das Merkmal setzt nur die Web-Version ab 992 px (layoutImDokument.ts,
// geprüft in seitenleiste.test.tsx). Wie groß die Modale dann sind, misst
// jsdom nicht; gemessen im Browser am 11.10.2026 (1440 x 900): Neue
// Kategorie 600 x 600 -> 560 x 350, Neues Event 600 x 600 -> 560 x 804
// (scrollt), auf dem iPad 936 x 836 -> 560 x 349.
describe('theme/web-modale.css: App-Modale im breiten Browserfenster', () => {
  const quelle = lies('src/theme/web-modale.css');
  const text = ohneKommentare(quelle);
  const alle = regeln(text);
  const BREIT = "html[data-layout='breit']";
  const KERN = "html[data-layout='breit'] ion-modal:is(.modal-default, .modal-card):not(.ion-datetime-button-overlay, .wrapped-modal-fullscreen, .file-viewer-modal, .web-chat-modal):not(:has([data-dialogname]))";

  it('wird global eingebunden, nach web-ansicht.css', () => {
    const app = lies('src/App.tsx');
    expect(app).toContain("import './theme/web-modale.css';");
    expect(app.indexOf("import './theme/web-modale.css';")).toBeGreaterThan(app.indexOf("import './theme/web-ansicht.css';"));
  });

  it('jeder Selektor beginnt mit dem Merkmal des breiten Layouts -- die Apps bleiben unberührt', () => {
    expect(alle.length).toBe(8);
    const fremd = alle.flatMap(([sel]) => teileObersteEbene(sel)).filter((teil) => !teil.startsWith(`${BREIT} ion-modal`));
    expect(fremd).toEqual([]);
  });

  it('nimmt Vollbild-Ansichten, Chat-Fenster und Datumswähler aus der allgemeinen Regel aus', () => {
    const kern = alle.find(([sel]) => sel === KERN)?.[1] ?? '';
    expect(kern).toMatch(/--width:\s*min\(560px, calc\(100% - 48px\)\);/);
    expect(kern).toMatch(/--height:\s*auto;/);
    expect(kern).toMatch(/--max-height:\s*calc\(100% - 96px\);/);
    // Ohne die Regel fuer die innere Seite fiel jedes Hook-Modal bei Hoehe auto auf 0 px.
    const innen = alle.find(([sel]) => sel === `${KERN} > .ion-page > .ion-page`)?.[1] ?? '';
    expect(innen).toMatch(/position:\s*relative;/);
    expect(innen).toMatch(/contain:\s*layout style;/);
  });

  it('nur Tokens für Radius und Schatten, keine Abdunklung, keine Bewegung, keine Farbwerte', () => {
    expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(text.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []).toEqual([]);
    expect([...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((v) => !/^--(?:app|ion)-/.test(v))).toEqual([]);
    const radien = [...text.matchAll(/--border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(radien).toEqual(['var(--app-radius-karte)', 'var(--app-radius-karte)']);
    const schatten = [...text.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(schatten).toEqual(['var(--app-schatten-modal)', 'var(--app-schatten-modal)']);
    // Ionic nimmt dem zweiten von zwei Modalen die Abdunklung; eine eigene liesse jede Stufe nachdunkeln.
    expect(text).not.toContain('--backdrop-opacity');
    expect(text).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z]+)?\s*:/);
    expect(text).not.toContain('@keyframes');
  });

  // Die Themes setzen Groesse und Radius der Modale selbst (ios27: Karte
  // 936 px, md3: Radius 24 px). Die eigene Regel muss jede ihrer Regeln
  // rechnerisch schlagen -- dann ist die Ladereihenfolge egal.
  it('schlägt jede Größen- und Radius-Regel der Themes ios27 und md3', () => {
    const themeDateien = [
      'node_modules/@rdlabo/ionic-theme-ios27/dist/css/components/ion-modal.css',
      'node_modules/@rdlabo/ionic-theme-md3/dist/css/components/ion-modal.css',
    ];
    const gegner = themeDateien.flatMap((datei) => themeRegeln(lies(datei)))
      .filter(({ rumpf }) => /--(?:width|height|border-radius)\s*:/.test(rumpf))
      .flatMap(({ selektor }) => teileObersteEbene(selektor))
      .filter((sel) => /ion-modal/.test(sel) && !/modal-sheet|datetime/.test(sel));
    expect(gegner.length).toBeGreaterThan(2);
    const verlierer = gegner.filter((sel) => vergleich(spezifitaet(KERN), spezifitaet(sel)) <= 0);
    expect(verlierer).toEqual([]);
    // Die Datumswaehler-Regel schlaegt das ios27-Fenster von 580 x 660 px.
    const datum = `${BREIT} ion-modal.ion-datetime-button-overlay`;
    const ios = gegner.filter((sel) => /\.ios/.test(sel) && !/modal-card/.test(sel));
    expect(ios.length).toBeGreaterThan(0);
    expect(ios.filter((sel) => vergleich(spezifitaet(datum), spezifitaet(sel)) <= 0)).toEqual([]);
  });
});
