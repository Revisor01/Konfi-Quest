import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { FARBEN, QR_FARBEN } from '../../theme/colors';

// Farb-Konsolidierung 05.09.2026. Vorgeschichte, dreimal derselbe Fehler:
//
//   11.08.2026  Drei verschiedene "Teamer-Pink"-Verlaeufe an drei Stellen
//               (Profil, Detail-Header, Dashboard-Kachel).
//   05.09.2026  Die Wrapped-Kachel im Teamer-Dashboard war beim
//               Vereinheitlichen uebersehen worden (#db2777/#ec4899/#f472b6).
//   05.09.2026  Wenige Stunden spaeter: Der Dashboard-Kopfbereich derselben
//               Seite hatte AUCH noch einen eigenen Verlauf (#e11d48).
//
// Diese Tests lesen die Quellen und pruefen die Verdrahtung, damit es kein
// viertes Mal gibt: (a) keine rohe Hexfarbe mehr in .tsx-Komponenten,
// (b) je Rolle GENAU EIN Verlauf, als Token, (c) die Rollen-Seiten ziehen
// aus den Tokens, (d) der JS-Spiegel theme/colors.ts stimmt mit den Tokens
// in variables.css ueberein.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle Dateien mit Endung unterhalb eines Verzeichnisses, rekursiv. */
function dateienUnter(verzeichnis: string, endung = '.tsx'): string[] {
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

/**
 * Quelltext ohne Kommentare. Kommentare DUERFEN alte Farbwerte nennen —
 * sie erklaeren die Historie. Ohne diesen Filter schluege der Test auf
 * seine eigene Dokumentation an (genau das ist am 05.09.2026 passiert).
 */
function ohneKommentare(quelle: string): string {
  const ohneBlock = quelle.replace(/\/\*[\s\S]*?\*\//g, '');
  // Zeilenkommentare ab "//", aber nicht "://" (URLs)
  return ohneBlock
    .split('\n')
    .map((zeile) => {
      const m = zeile.match(/(?<!:)\/\/(?!\/)/);
      return m && m.index !== undefined ? zeile.slice(0, m.index) : zeile;
    })
    .join('\n');
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

describe('Farben kommen aus Tokens', () => {
  it('keine .tsx-Komponente enthaelt eine rohe Hexfarbe', () => {
    // JS-Sonderfaelle (SVG-Attribute, QR, Alpha-Suffix-Rechnungen) liegen
    // in theme/colors.ts bzw. utils/badgeCriteria.ts und
    // components/chat/constants.ts — alles .ts, kein Komponentencode.
    const treffer: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = ohneKommentare(lies(datei));
      for (const hex of code.match(HEX) ?? []) {
        treffer.push(`${datei}: ${hex}`);
      }
    }
    expect(treffer).toEqual([]);
  });

  it('keine CSS-REGEL enthaelt eine rohe Farbe', () => {
    // DIE LUECKE, die diese Pruefung schliesst (Simon, 06.09.2026):
    // Bis hierher sah der Test nur .tsx-Dateien an. In variables.css selbst
    // standen 179 rohe Werte in den Regeln -- darunter zwei Kopfbereiche, die
    // hart auf #be123c endeten. Nach dem Wechsel der Challenges-Farbe auf
    // Indigo lief dieser Verlauf von Blau nach Rot; Simon sah einen
    // "blau lila" Header. Der Test war gruen, weil er an der falschen Stelle
    // suchte.
    //
    // Erlaubt bleiben: Token-DEFINITIONEN (dort MUSS der Wert stehen) und
    // Ionic-Rueckfallwerte der Form var(--ion-x, #abc) -- das ist Ionics
    // eigener Vertrag, kein Wert von uns.
    const treffer: string[] = [];
    for (const datei of ['src/theme/variables.css', 'src/theme/typografie.css', 'src/theme/abstaende.css']) {
      const roh = lies(datei);
      const ohneBlock = roh.replace(/\/\*[\s\S]*?\*\//g, '');
      ohneBlock.split('\n').forEach((zeile, i) => {
        const t = zeile.trim();
        if (t.startsWith('--app-') || t.startsWith('--ion-')) return;   // Definition
        if (/var\(--ion-[a-z-]+,\s*#/.test(zeile)) return;              // Ionic-Rueckfall
        for (const hex of zeile.match(HEX) ?? []) {
          treffer.push(`${datei}:${i + 1} ${hex}`);
        }
      });
    }
    expect(treffer).toEqual([]);
  });

  it('es gibt fuer jede Rolle genau EINEN Verlauf, definiert in variables.css', () => {
    const css = lies('src/theme/variables.css');
    const anzahl = (name: string) => (css.match(new RegExp(`--app-gradient-${name}:`, 'g')) ?? []).length;
    expect(anzahl('teamer')).toBe(1);
    expect(anzahl('konfi')).toBe(1);
    expect(anzahl('admin')).toBe(1);
    // Und zwar mit exakt diesen Werten (optische Gleichheit zur Zeit der
    // Konsolidierung — wer die Farbe aendern will, aendert sie HIER bewusst):
    expect(css).toContain('--app-gradient-teamer: linear-gradient(135deg, #be185d 0%, #9d174d 55%, #831843 100%);');
    expect(css).toContain('--app-gradient-konfi: linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%);');
    expect(css).toContain('--app-gradient-admin: linear-gradient(135deg, #818cf8 0%, #667eea 50%, #4f46e5 100%);');
  });

  it('die Rollen-Seiten ziehen ihre Verlaeufe aus den Tokens', () => {
    // Teamer: Profilkopf und Dashboard
    expect(lies('src/components/teamer/pages/TeamerProfilePage.tsx')).toContain('var(--app-gradient-teamer)');
    expect(lies('src/components/teamer/pages/TeamerDashboardPage.tsx')).toContain('var(--app-gradient-teamer)');
    // Konfi: eigener Profilkopf und die Admin-Sicht auf ein Konfi-Profil
    expect(lies('src/components/konfi/views/ProfileView.tsx')).toContain('var(--app-gradient-konfi)');
    const konfiDetail = lies('src/components/admin/views/KonfiDetailSections.tsx');
    expect(konfiDetail).toContain('var(--app-gradient-konfi)');
    expect(konfiDetail).toContain('var(--app-gradient-teamer)'); // Teamer:in im Konfi-Detail
    // Admin: Profilkopf
    expect(lies('src/components/admin/pages/AdminProfilePage.tsx')).toContain('var(--app-gradient-admin)');
  });

  it('die Rollen-Grundfarben stehen als Token in variables.css', () => {
    const css = lies('src/theme/variables.css');
    expect(css).toContain('--app-color-teamer: #be185d;');
    expect(css).toContain('--app-color-konfis: #5b21b6;');
    expect(css).toContain('--app-color-users: #667eea;');
  });

  it('mehrfach definierte Tokens tragen ueberall denselben Wert', () => {
    // variables.css hat einen zweiten :root-Block (iOS26-Abschnitt), der
    // einige Tokens wiederholt. Laufen die Werte auseinander, gewinnt je
    // nach Reihenfolge mal der eine, mal der andere — genau die Sorte
    // stiller Drift, die diese Konsolidierung beenden soll.
    const css = lies('src/theme/variables.css');
    const werte = new Map<string, Set<string>>();
    // Nur die App-Farbfamilien; klassen-gebundene Ionic-Properties
    // (z.B. --ion-color-base je Utility-Klasse) duerfen abweichen.
    for (const m of css.matchAll(/--(app-(?:color|gradient|text|surface|border|auth|wrapped)-[a-z0-9-]+):\s*([^;]+);/g)) {
      const [, name, wert] = m;
      if (!werte.has(name)) werte.set(name, new Set());
      werte.get(name)!.add(wert.trim());
    }
    const drift = [...werte.entries()]
      .filter(([, v]) => v.size > 1)
      .map(([name, v]) => `${name}: ${[...v].join(' vs ')}`);
    expect(drift).toEqual([]);
  });
});

describe('theme/colors.ts spiegelt variables.css', () => {
  const css = lies('src/theme/variables.css');
  /** Erster (massgeblicher) Wert eines Tokens in variables.css. */
  const token = (name: string): string => {
    const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (!m) throw new Error(`Token --${name} fehlt in variables.css`);
    return m[1].trim();
  };

  // Konstante in colors.ts -> Token in variables.css. Bewusst als explizite
  // Liste: Jede neue Konstante muss hier verdrahtet werden.
  const PAARE: Array<[keyof typeof FARBEN, string]> = [
    ['events', 'app-color-events'],
    ['eventsDunkel', 'app-color-events-dunkel'],
    ['activities', 'app-color-activities'],
    ['activitiesDunkel', 'app-color-activities-dunkel'],
    ['konfis', 'app-color-konfis'],
    ['konfisDunkel', 'app-color-konfis-dunkel'],
    ['teamer', 'app-color-teamer'],
    ['teamerDunkel', 'app-color-teamer-dunkel'],
    ['challenges', 'app-color-challenges'],
    ['challengesDunkel', 'app-color-challenges-dunkel'],
    ['users', 'app-color-users'],
    ['usersDunkel', 'app-color-users-dunkel'],
    ['badges', 'app-color-badges'],
    ['badgesDunkel', 'app-color-badges-dunkel'],
    ['jahrgang', 'app-color-jahrgang'],
    ['jahrgangDunkel', 'app-color-jahrgang-dunkel'],
    ['categories', 'app-color-categories'],
    ['categoriesDunkel', 'app-color-categories-dunkel'],
    ['level', 'app-color-level'],
    ['levelDunkel', 'app-color-level-dunkel'],
    ['chat', 'app-color-chat'],
    ['chatDunkel', 'app-color-chat-dunkel'],
    ['material', 'app-color-material'],
    ['materialDunkel', 'app-color-material-dunkel'],
    ['wrapped', 'app-color-wrapped'],
    ['wrappedDunkel', 'app-color-wrapped-dunkel'],
    ['gottesdienst', 'app-color-gottesdienst'],
    ['gemeinde', 'app-color-gemeinde'],
    ['danger', 'app-color-danger'],
    ['warning', 'app-color-warning'],
    ['success', 'app-color-success'],
    ['successStrong', 'app-color-success-strong'],
    ['successFresh', 'app-color-success-fresh'],
    ['neutral', 'app-color-neutral'],
    ['neutralHell', 'app-color-neutral-hell'],
    ['textSystem', 'app-text-system'],
    ['gold', 'app-color-gold'],
    ['goldHell', 'app-color-gold-hell'],
    ['silber', 'app-color-silber'],
    ['silberHell', 'app-color-silber-hell'],
    ['bronze', 'app-color-bronze'],
    ['bronzeHell', 'app-color-bronze-hell'],
    ['abzeichenFallback', 'app-color-users'],
  ];

  it('jede FARBEN-Konstante traegt exakt den Token-Wert', () => {
    const abweichungen: string[] = [];
    for (const [konstante, tokenName] of PAARE) {
      if (FARBEN[konstante] !== token(tokenName)) {
        abweichungen.push(`${konstante} (${FARBEN[konstante]}) != --${tokenName} (${token(tokenName)})`);
      }
    }
    expect(abweichungen).toEqual([]);
  });

  it('jede FARBEN-Konstante ist verdrahtet (kein Eintrag vergessen)', () => {
    const verdrahtet = new Set(PAARE.map(([k]) => k));
    const fehlend = Object.keys(FARBEN).filter((k) => !verdrahtet.has(k as keyof typeof FARBEN));
    expect(fehlend).toEqual([]);
  });

  it('QR-Farben sind Schwarz auf Weiss (Scanner-Kontrast)', () => {
    expect(QR_FARBEN.dunkel).toBe('#000000');
    expect(QR_FARBEN.hell).toBe('#ffffff');
  });
});
