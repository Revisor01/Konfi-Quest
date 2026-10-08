import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// Eine Klasse gehoert genau einer Stylesheet-Datei der Web-Fassungen
// (theme/web-ansicht.css und theme/web/*.css).
//
// Warum: Die Dateien liegen im selben Buendel, jede Klasse gilt dort fuer die
// ganze App. Setzen zwei Dateien dieselbe Klasse, mischen sich ihre Regeln --
// ohne Fehlermeldung und ohne dass ein Test der einen Seite es merkt, denn jeder
// Test laedt nur die Dateien seiner Seite. So geschehen am 06.10.2026: Die
// Konfi-Liste der Leitung (leitung.css) und das Profil der Konfis (start.css)
// nannten beide eine Klasse `web-avatar` und `web-fortschritt`. Im Buendel
// wurde der Kreis vor dem Namen 64 px gross und ohne Grund (eine leere Flaeche)
// und der Balken ein 8-px-Streifen mit overflow: hidden, in dem die Zahl abgeschnitten
// wurde. Der Test liest die Quellen, nicht die Seiten.

const theme = resolve(process.cwd(), 'src/theme');
const dateien = [
  'web-ansicht.css',
  ...readdirSync(join(theme, 'web')).filter((n) => n.endsWith('.css')).map((n) => `web/${n}`),
].sort();

const ohneKommentare = (quelle: string) => quelle.replace(/\/\*[\s\S]*?\*\//g, '');

// Eine Regel, die nur eine Klasse nennt (mit Pseudo-Klasse, Pseudo-Element oder
// Attribut): ".web-chip", ".web-chip:hover", ".web-link--zeile::after",
// ".web-chip[aria-pressed='true']". Das ist ein Besitz der Klasse. Regeln mit
// Vorfahren (".web-person-hero .web-initialen") veraendern eine Klasse nur im
// Umfeld und gehoeren nicht dazu.
const EIGENE_REGEL = /^\.([\w-]+)(?:::?[\w-]+(?:\([^)]*\))?|\[[^\]]*\])*$/;

/** Klasse -> die Dateien, die sie als eigene Regel setzen. */
function besitzer(quellen: Record<string, string>): Map<string, string[]> {
  const karte = new Map<string, Set<string>>();
  for (const [datei, quelle] of Object.entries(quellen)) {
    for (const regel of ohneKommentare(quelle).matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const selektor of regel[1].split(',')) {
        const klasse = EIGENE_REGEL.exec(selektor.trim())?.[1];
        if (klasse) karte.set(klasse, (karte.get(klasse) ?? new Set<string>()).add(datei));
      }
    }
  }
  return new Map([...karte].map(([klasse, ds]) => [klasse, [...ds].sort()]));
}

const doppelt = (karte: Map<string, string[]>) => [...karte].filter(([, ds]) => ds.length > 1);

const quellen = Object.fromEntries(dateien.map((d) => [d, readFileSync(join(theme, d), 'utf8')]));
const alle = besitzer(quellen);

// Die Altlast vom 06.10.2026 (web-beschreibung, web-menue, web-rolle,
// web-rolle--leitung) ist am 08.10.2026 aufgeloest: Rollenmarke der
// Benutzerliste heisst web-rollenmarke, die Materialbeschreibung
// web-material-beschreibung, das Menue im Teilnehmer-Fenster
// web-teilnehmer-menue. Keine Ausnahme mehr.

describe('Stylesheets der Web-Fassungen: eine Klasse, eine Datei', () => {
  it('der Pruefer erkennt eine Doppelung (Gegenprobe), auch mit Pseudo-Klasse und Attribut, und laesst Regeln mit Vorfahren in Ruhe', () => {
    const karte = besitzer({
      'a.css': '.web-x { height: 8px; }\n/* .web-nur-im-kommentar { } */\n.web-y { color: red; }',
      'b.css': '.web-x:hover, .web-z { color: blue; }\n.web-y[aria-pressed=\'true\'] { color: red; }\n.web-vorfahr .web-x { color: green; }\n.web-q::after { content: \'\'; }',
      'c.css': '@container (max-width: 10px) {\n  .web-q { display: none; }\n}\n.web-nur-im-kommentar-c { }',
    });
    expect(doppelt(karte)).toEqual([
      ['web-x', ['a.css', 'b.css']],
      ['web-y', ['a.css', 'b.css']],
      ['web-q', ['b.css', 'c.css']],
    ]);
    // Ein Kommentar besitzt nichts; eine Regel mit Vorfahr auch nicht.
    expect(karte.has('web-nur-im-kommentar')).toBe(false);
    expect(karte.get('web-z')).toEqual(['b.css']);
  });

  it('der Pruefer liest alle Dateien und findet die Klassen (nicht leer gelaufen)', () => {
    expect(dateien).toContain('web-ansicht.css');
    expect(dateien).toContain('web/leitung.css');
    expect(dateien).toContain('web/start.css');
    expect(dateien.length).toBeGreaterThanOrEqual(7);
    expect(alle.size).toBeGreaterThan(600);
  });

  it('keine Klasse steht in zwei Dateien', () => {
    expect(doppelt(alle)).toEqual([]);
  });

  it('die aufgeloeste Altlast: jede der vier Klassen gehoert genau einer Datei', () => {
    expect(alle.get('web-beschreibung')).toEqual(['web/termine.css']);
    expect(alle.get('web-material-beschreibung')).toEqual(['web/leitung.css']);
    expect(alle.get('web-menue')).toEqual(['web/chat.css']);
    expect(alle.get('web-teilnehmer-menue')).toEqual(['web/termine.css']);
    expect(alle.get('web-rolle')).toEqual(['web/start.css']);
    expect(alle.get('web-rolle--leitung')).toEqual(['web/start.css']);
    expect(alle.get('web-rollenmarke')).toEqual(['web/leitung.css']);
    expect(alle.get('web-rollenmarke--leitung')).toEqual(['web/leitung.css']);
  });

  it('der Fehler vom 06.10.2026: Kreis und Balken der Konfi-Liste gehoeren leitung.css, das Profil und der Balken der Konfi-Seite start.css', () => {
    expect(alle.get('web-initialen')).toEqual(['web/leitung.css']);
    expect(alle.get('web-punktebalken')).toEqual(['web/leitung.css']);
    expect(alle.get('web-avatar')).toEqual(['web/start.css']);
    expect(alle.get('web-fortschritt')).toEqual(['web/start.css']);
    expect(alle.get('web-fortschritt__fuellung')).toEqual(['web/start.css']);
  });
});
