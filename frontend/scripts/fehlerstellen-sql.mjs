#!/usr/bin/env node
// Die erlaubten Werte von `fehler.stelle` als SQL — fuer die Bereinigung der
// Umami-Datenbank (docs/betrieb/routinen.md, Abschnitt „Umami bereinigen").
//
// Bis zum 27.09.2026 schickte die App den angezeigten Fehlertext als
// `stelle` an Umami, auch Texte des Servers mit Namen, Dateinamen und
// Event-Namen (Befund B1, docs/messung/umami.md). Seitdem gehen nur noch die
// Texte der Positivliste in src/utils/bekannteFehlertexte.ts raus, entschaerft
// wie in der App (Ziffernfolgen zu `#`, hoechstens 80 Zeichen), sonst
// `andere-meldung`. Alles andere in der Umami-Datenbank ist Altbestand — oder
// kommt von einer App-Fassung ohne diese Korrektur.
//
// Aufruf (aus der Repo-Wurzel; das Skript findet die Liste selbst):
//   node frontend/scripts/fehlerstellen-sql.mjs > erlaubte_stelle.sql
// Ergebnis: CREATE TEMP TABLE erlaubte_stelle + INSERT aller erlaubten Werte.
// In DERSELBEN psql-Sitzung einlesen (\i), in der die Abfragen laufen — die
// Tabelle ist temporaer.
//
// Der Test bekannteFehlertexte.test.ts prueft, dass dieses Skript genau die
// Menge liest, die die App als ERLAUBTE_STELLEN verwendet.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LISTE = resolve(dirname(fileURLToPath(import.meta.url)), '../src/utils/bekannteFehlertexte.ts');
const PLATZHALTER = 'andere-meldung';

/** Wie `entschaerft` in src/services/analytics.ts. */
function entschaerft(text) {
  return text.replace(/\d+/g, '#').slice(0, 80);
}

/** Die Literale eines `export const NAME … = [ … ];` aus dem Quelltext. */
function literaleDerListe(quelle, name) {
  const anfang = quelle.indexOf(`export const ${name}`);
  if (anfang === -1) throw new Error(`${name} nicht gefunden`);
  const auf = quelle.indexOf('[', quelle.indexOf('=', anfang));
  const zu = quelle.indexOf('\n];', auf);
  const koerper = quelle.slice(auf + 1, zu);
  const texte = [];
  for (const m of koerper.matchAll(/^\s*'((?:\\.|[^'\\])*)',?\s*(?:\/\/.*)?$/gm)) {
    texte.push(m[1].replace(/\\(.)/g, '$1'));
  }
  return texte;
}

/** Alle erlaubten Werte von `stelle`, sortiert, ohne Dubletten. */
export function erlaubteStellenAus(quelle) {
  const texte = [
    ...literaleDerListe(quelle, 'BEKANNTE_FEHLERTEXTE'),
    ...literaleDerListe(quelle, 'ZUGELASSENE_SERVERTEXTE'),
  ];
  return [...new Set([...texte.map(entschaerft), PLATZHALTER])].sort();
}

/** SQL fuer eine temporaere Tabelle `erlaubte_stelle(wert)`. */
export function sqlFuer(werte) {
  const zeilen = werte.map((w) => `  ('${w.replace(/'/g, "''")}')`);
  return [
    '-- Erzeugt von frontend/scripts/fehlerstellen-sql.mjs — nicht von Hand ändern.',
    'CREATE TEMP TABLE erlaubte_stelle (wert text PRIMARY KEY);',
    'INSERT INTO erlaubte_stelle (wert) VALUES',
    zeilen.join(',\n') + ';',
    `-- ${werte.length} Werte`,
    '',
  ].join('\n');
}

const istHauptmodul = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (istHauptmodul) {
  process.stdout.write(sqlFuer(erlaubteStellenAus(readFileSync(LISTE, 'utf8'))));
}
