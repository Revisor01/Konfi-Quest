import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { ICON_ZURUECK } from '../../components/shared/icons';

// Simons Rückmeldungen vom 05.09.2026, gebündelt:
//
//   "In den wrapped Folien stehen noch ae ue oe es gilt die klare Regel das
//    Ä ö ü ordentlich geschrieben werden."
//   "Und ich will das du einen coolen zurückpfeil findest und in die App
//    packst. ... Heroicons finde ich gut."
//
// Diese Tests lesen die Quellen, statt zu rendern: Geprüft wird, dass keine
// Ersatzschreibweise in ANGEZEIGTEM Text zurückkommt. In Bezeichnern und
// Kommentaren ist "ue" weiter erlaubt (spruchFuer, hintergrundFuer) — die
// sieht niemand.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle .tsx unterhalb eines Verzeichnisses, rekursiv. */
function dateienUnter(verzeichnis: string, endung = '.tsx'): string[] {
  const voll = resolve(process.cwd(), verzeichnis);
  const raus: string[] = [];
  for (const eintrag of readdirSync(voll)) {
    const pfad = join(voll, eintrag);
    if (statSync(pfad).isDirectory()) raus.push(...dateienUnter(join(verzeichnis, eintrag), endung));
    else if (eintrag.endsWith(endung)) raus.push(join(verzeichnis, eintrag));
  }
  return raus;
}

/**
 * Angezeigte Texte einer Datei: Zeichenketten und JSX-Text, ohne Kommentare.
 *
 * Bewusst grob — der Test soll Ersatzschreibweisen finden, nicht JSX parsen.
 * Bezeichner (ein Wort, keine Leerzeichen) fallen raus, sonst schlüge jedes
 * `spruchFuer` an.
 */
function angezeigteTexte(quelle: string): string[] {
  const ohneBlock = quelle.replace(/\/\*[\s\S]*?\*\//g, '');
  const ohneZeile = ohneBlock.replace(/^\s*\/\/.*$/gm, '');
  const texte: string[] = [];
  for (const zeile of ohneZeile.split('\n')) {
    if (/^\s*import\b/.test(zeile)) continue;
    for (const [, , inhalt] of zeile.matchAll(/(['"`])((?:[^'"`\\\n]|\\.)*?)\1/g)) {
      if (/\s/.test(inhalt)) texte.push(inhalt);
    }
    for (const [, inhalt] of zeile.matchAll(/>([^<>{}\n]{4,})</g)) {
      texte.push(inhalt.trim());
    }
  }
  return texte;
}

// Deutsche Wörter, bei denen "ae/oe/ue" fast immer ein ersetzter Umlaut ist.
// Bewusst eine Wortliste statt eines Musters auf "ae": sonst schlügen
// "Familie", "Museum" oder englische Brocken wie "value" an.
const ERSATZSCHREIBWEISEN = new RegExp(
  [
    'fuer', 'zaehl', 'naechst', 'schoen', 'gehoer', 'persoenlich',
    'faeng', 'waer', 'laesslich', 'gaenge', 'koenn', 'muess', 'wuerd',
    'haett', 'groess', 'spaet', 'staerk', 'oeffn', 'moecht', 'zurueck',
    'rueckblick', 'geloescht', 'ueberpruef', 'anhaeng', 'traeg',
  ].join('|'),
  'i',
);

describe('Umlaute in angezeigten Texten', () => {
  it('keine Ersatzschreibweise in den Wrapped-Folien', () => {
    // Der eigentliche Befund: Die Teamer-Folien waren durchgehend ohne
    // Umlaute geschrieben ("Ein Abzeichen fuer deinen Einsatz.",
    // "Dein groesster Termin"), die Konfi-Folien nicht. Aufgefallen ist es
    // erst im Betrieb — kein Test sah hin.
    const treffer: string[] = [];
    for (const datei of dateienUnter('src/components/wrapped')) {
      for (const text of angezeigteTexte(lies(datei))) {
        if (ERSATZSCHREIBWEISEN.test(text)) treffer.push(`${datei}: ${text}`);
      }
    }
    expect(treffer).toEqual([]);
  });

  it('keine Ersatzschreibweise in den Titeln, die das Backend vergibt', () => {
    // Diese Titel stehen in der Oberfläche, sobald jemand eine Ausgabe ohne
    // eigenen Namen anlegt — also im Regelfall. Sie standen als
    // 'Rueckblick ...' im SQL und im Fallback.
    const wrapped = lies('../backend/routes/wrapped.js');
    // SQL raus: `jahrgaenge` ist ein Tabellenname, kein angezeigter Text.
    // Umbenennen kaeme einer Migration gleich und hat mit der Schreibregel
    // nichts zu tun.
    const istSql = (t: string) =>
      /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|COALESCE|GROUP BY|ORDER BY)\b/.test(t);
    const treffer = angezeigteTexte(wrapped)
      .filter(t => !istSql(t))
      .filter(t => ERSATZSCHREIBWEISEN.test(t));
    expect(treffer).toEqual([]);
  });
});

describe('Zurueck-Icon', () => {
  it('ist ein eigenes SVG, kein Ionicons-Name', () => {
    // Ionicons zeichnet mit stroke-width 48 auf 512 (= 2.25 auf 24) und hat
    // keine dünnere Variante — deshalb das eigene SVG.
    expect(ICON_ZURUECK.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('zeichnet mit der duennen Heroicons-Strichstaerke', () => {
    const svg = decodeURIComponent(ICON_ZURUECK.replace('data:image/svg+xml,', ''));
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it('erbt die Farbe der Umgebung', () => {
    // Ohne currentColor bliebe der Pfeil im Dunkelmodus schwarz auf dunklem
    // Grund — der Fehler wäre erst auf dem Gerät aufgefallen.
    const svg = decodeURIComponent(ICON_ZURUECK.replace('data:image/svg+xml,', ''));
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toContain('stroke="#');
  });

  it('ist als Data-URL gueltig kodiert', () => {
    // Ein rohes '#' oder '"' in der URL bricht das Icon still: IonIcon zeigt
    // dann gar nichts an, ohne Fehlermeldung.
    expect(ICON_ZURUECK).not.toContain('#');
    expect(ICON_ZURUECK).not.toContain('"');
    expect(ICON_ZURUECK).not.toContain('<');
  });
});

describe('Teamer-Farbe', () => {
  it('der gemeinsame Verlauf startet auf der Teamer-Farbe, nicht heller', () => {
    // Simon: "Ist zu pink! Eher dies dunkle das wir sonst als Teamer Farbe
    // haben". Der Verlauf startete auf #ec4899 — deutlich heller als
    // --app-color-teamer (#be185d).
    const css = lies('src/theme/variables.css');
    const zeile = css.split('\n').find(z => z.includes('--app-gradient-teamer:')) || '';
    expect(zeile).toContain('#be185d');
    expect(zeile).not.toContain('#ec4899');
  });

  it('die Wrapped-Kachel nutzt den gemeinsamen Verlauf statt eines eigenen', () => {
    // Sie war beim Vereinheitlichen am 11.08.2026 als einzige übersehen
    // worden und hatte ihren eigenen, helleren Verlauf behalten.
    const dash = lies('src/components/teamer/pages/TeamerDashboardPage.tsx');
    expect(dash).toContain('var(--app-gradient-teamer)');
    expect(dash).not.toContain('#f472b6');
  });
});
