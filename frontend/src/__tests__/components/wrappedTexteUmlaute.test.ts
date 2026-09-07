import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Nutzersichtbare Texte des Rueckblicks tragen echte Umlaute -- und keine
 * Ersatzschreibung.
 *
 * BEFUND 07.09.2026 (Simon am Geraet, plus Nachmessung im Teamer-Zweig):
 * Vier Stellen zeigten Ersatzschreibungen auf dem Bildschirm, eine davon
 * sogar eine rohe Escape-Sequenz:
 *
 *   TeamerEventsSlide      "×" stand LITERAL im JSX statt "×" --
 *                          React gibt JSX-Text woertlich aus, die Seite
 *                          zeigte also die sechs Zeichen ×.
 *   TeamerAbschlussSlide   "gaebe" auf der letzten Seite des Rueckblicks.
 *   TeamerZertifikateSlide "weiss", "fuer", "zaehlt", "ausserhalb" --
 *                          waehrend die Zeile darunter korrekt "für" schrieb.
 *   KategorieSlide         "Aktivitaeten".
 *
 * Beim Nachmessen kam eine fuenfte dazu, die niemand gemeldet hatte:
 * AktivsterMonatSlide zeigte ebenfalls "Aktivitaeten".
 *
 * WARUM ES NIEMANDEM AUFFIEL: Der ganze Teamer-Zweig war unsichtbar (kein
 * v3-Teamer-Snapshot in Produktion). Und in Kommentaren IST die
 * Ersatzschreibung Konvention in diesem Repo -- das Auge liest darueber
 * hinweg, bis dieselbe Schreibweise in einem Anzeigetext landet.
 *
 * DIESER TEST PRUEFT NUR ANZEIGETEXTE. Kommentare und Bezeichner bleiben
 * ausdruecklich frei: 'const ueberschrift' und '// waehleKacheln' sind
 * richtig so und duerfen nie rot werden.
 */

const WRAPPED = resolve(__dirname, '../../components/wrapped');

/** Alle .ts/.tsx unterhalb von components/wrapped. */
function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) { gefunden.push(...quelldateien(pfad)); continue; }
    if (/\.tsx?$/.test(eintrag)) gefunden.push(pfad);
  }
  return gefunden;
}

/**
 * Sammelt aus einer Quelldatei NUR das, was auf dem Bildschirm landet:
 * deutsche Saetze in Zeichenketten und JSX-Textknoten.
 *
 * WARUM SO ENG UND NICHT EINFACH "die Datei ohne Kommentare": Der erste
 * Versuch nahm die ganze Datei und schlug bei 'ueber-das-ziel' (ein
 * Seiten-Schluessel), `const ueberschrift` und `ueberschuss` an -- alles
 * richtig geschriebene Bezeichner. Ein Test, der bei korrektem Code rot
 * wird, wird nach der zweiten Ausnahme abgeschaltet.
 *
 * Die Regel jetzt: Ein Stueck zaehlt als Anzeigetext, wenn es ein
 * LEERZEICHEN enthaelt. Seiten-Schluessel ('ueber-das-ziel'), Klassennamen
 * und Bezeichner haben keins, deutsche Saetze immer.
 */
function anzeigetexte(quelle: string): Array<{ zeile: number; text: string }> {
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, ' ');

  const gefunden: Array<{ zeile: number; text: string }> = [];
  for (const [i, zeile] of ohneKommentare.split('\n').entries()) {
    if (/^\s*import\b/.test(zeile)) continue;
    const stuecke: string[] = [];
    // Zeichenketten aller drei Sorten.
    for (const m of zeile.match(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g) || []) {
      stuecke.push(m.slice(1, -1));
    }
    // JSX-Textknoten: zwischen > und <, ohne Ausdruecke.
    for (const m of zeile.match(/>[^<>{}"'`]+</g) || []) {
      stuecke.push(m.slice(1, -1));
    }
    for (const stueck of stuecke) {
      // Kein Leerzeichen = Bezeichner, Schluessel, Klassenname, Pfad.
      if (!/\s/.test(stueck.trim()) || !stueck.trim()) continue;
      // className="a b c" ist zwar mehrteilig, aber kein Satz.
      if (/^[a-z0-9-]+(\s+[a-z0-9-]+)*$/.test(stueck.trim())) continue;
      gefunden.push({ zeile: i + 1, text: stueck });
    }
  }
  return gefunden;
}

/**
 * Die Ersatzschreibungen, die hier tatsaechlich vorkamen. Bewusst eine
 * benannte Liste statt einer Regel wie /ae/: 'Teamer', 'Israel' und
 * 'Baeckerei' enthalten die Buchstabenfolge voellig zu Recht, und eine
 * Regel, die staendig falsch anschlaegt, wird nach der zweiten Ausnahme
 * abgeschaltet.
 */
const ERSATZSCHREIBUNGEN = [
  'Aktivitaeten', 'gaebe', 'zaehlt', 'zaehlen', 'ausserhalb', 'weiss',
  'fuer', 'ueber', 'koennen', 'moechte', 'muessen', 'wuerde', 'haette',
  'naechste', 'groesste', 'schoen', 'Rueckblick', 'taeglich', 'jaehrlich',
  'waehlen', 'Groesse', 'strasse', 'heisst', 'laesst', 'haeufigste'
];

describe('Rueckblick: nutzersichtbare Texte tragen echte Umlaute', () => {
  const dateien = quelldateien(WRAPPED);

  it('findet die Quelldateien ueberhaupt', () => {
    // Ohne diese Zusicherung waere ein leeres Verzeichnis (falscher Pfad
    // nach einem Umbau) ein gruener Test, der nichts geprueft hat.
    expect(dateien.length).toBeGreaterThan(20);
  });

  it.each(ERSATZSCHREIBUNGEN)('kein "%s" in einem Anzeigetext', (wort) => {
    const treffer: string[] = [];
    for (const pfad of dateien) {
      for (const { zeile, text } of anzeigetexte(readFileSync(pfad, 'utf8'))) {
        if (text.includes(wort)) treffer.push(`${pfad.slice(WRAPPED.length + 1)}:${zeile}: ${text.trim()}`);
      }
    }
    expect(treffer, `Ersatzschreibung "${wort}" in Anzeigetexten:\n${treffer.join('\n')}`).toEqual([]);
  });

  it('keine rohe \\u-Escape-Sequenz im JSX-Text', () => {
    // TeamerEventsSlide zeigte "×" woertlich auf dem Bildschirm.
    // In einem JSX-Textknoten ist × keine Escape-Sequenz, sondern
    // sechs Zeichen -- der Unterschied zu einem String-Literal, in dem es
    // funktioniert haette.
    const treffer: string[] = [];
    for (const pfad of dateien) {
      const quelle = readFileSync(pfad, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
      // JSX-Text: zwischen > und < , ausserhalb von Anfuehrungszeichen.
      for (const [nr, zeile] of quelle.split('\n').entries()) {
        for (const stueck of zeile.match(/>[^<>{}"'`]*</g) || []) {
          if (/\\u[0-9a-fA-F]{4}/.test(stueck)) {
            treffer.push(`${pfad.slice(WRAPPED.length + 1)}:${nr + 1}: ${stueck}`);
          }
        }
      }
    }
    expect(treffer, `rohe \\u-Sequenz im JSX-Text:\n${treffer.join('\n')}`).toEqual([]);
  });
});
