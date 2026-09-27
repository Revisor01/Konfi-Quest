/**
 * Die Positivliste der Fehlertexte veraltet nicht.
 *
 * Die anonyme Fehlermessung uebertraegt einen Meldungstext nur, wenn er in
 * `utils/bekannteFehlertexte.ts` steht (Befund B1, docs/messung/umami.md).
 * Eine Liste, die man von Hand pflegt, laeuft dem Code davon: Ein neuer Text
 * fehlt, ein geloeschter bleibt stehen. Dieser Test liest deshalb den
 * Quelltext und vergleicht in BEIDE Richtungen:
 *
 *   - Jeder feste Text, den die App an eine Fehleranzeige gibt, steht in der
 *     Liste (sonst kommt er nur als `andere-meldung` an).
 *   - Jeder Eintrag der Liste steht noch im Code (sonst ist er Ballast).
 *
 * Gesucht wird an den Aufrufstellen
 *   `setError(…)`                          — erstes Argument,
 *   `fehlerText(err, …)`,
 *   `fehlerTextOderMessage(err, …)`        — der Ersatztext,
 *   `onError(…)`, `onErrorRef.current?.(…)` — Chat, reicht an setError weiter.
 * Aus dem Argument zaehlen die Texte, die es als GANZES sein koennen: ein
 * Literal selbst, die Zweige von `a ? 'x' : 'y'` und `x || 'y'`, eine lokale
 * Konstante (`const meldung = …`) und eine Konstante in Grossbuchstaben
 * (`OFFLINE_AKTION_MELDUNG`). NICHT dazu zaehlen Template-Strings mit
 * `${…}`, Verkettungen mit `+` und Literale in fremden Aufrufen — daraus
 * entsteht ein zusammengesetzter Text, und der darf nicht in die Liste: er
 * kann Namen, Zahlen oder Titel enthalten.
 *
 * Die zugelassenen Server-Texte stehen getrennt und werden gegen das Backend
 * geprueft: Sie muessen dort WOERTLICH als Literal stehen.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BEKANNTE_FEHLERTEXTE, ZUGELASSENE_SERVERTEXTE } from '../../utils/bekannteFehlertexte';
import { ERLAUBTE_STELLEN, STELLE_ANDERE_MELDUNG, fehlerStelle } from '../../services/analytics';
import { erlaubteStellenAus, sqlFuer } from '../../../scripts/fehlerstellen-sql.mjs';

const WURZEL = resolve(__dirname, '../../..');
const SRC = resolve(WURZEL, 'src');
const BACKEND = resolve(WURZEL, '../backend');

/* ------------------------------------------------------------------ *
 * Ein kleiner Leser fuer TypeScript-Ausdruecke — genug fuer Argumente
 * ------------------------------------------------------------------ */

function quelldateien(ordner: string): string[] {
  const dateien: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      if (name === '__tests__' || name === '__mocks__') continue;
      dateien.push(...quelldateien(pfad));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$|\.d\.ts$|^setupTests\.ts$/.test(name)) {
      dateien.push(pfad);
    }
  }
  return dateien;
}

/** Index hinter einem '…'- oder "…"-Literal, das bei `i` beginnt. */
function stringEnde(q: string, i: number): number {
  const zeichen = q[i];
  let j = i + 1;
  while (j < q.length && q[j] !== zeichen) {
    if (q[j] === '\\') j++;
    j++;
  }
  return j + 1;
}

/** Index hinter einem Template-String, der bei `i` beginnt (mit `${…}`). */
function templateEnde(q: string, i: number): number {
  let j = i + 1;
  while (j < q.length && q[j] !== '`') {
    if (q[j] === '\\') { j += 2; continue; }
    if (q[j] === '$' && q[j + 1] === '{') {
      j = klammerEnde(q, j + 2);
      continue;
    }
    j++;
  }
  return j + 1;
}

/** Steht bei `i` ein regulaerer Ausdruck (und keine Division)? */
function istRegex(q: string, i: number): boolean {
  const davor = q.slice(0, i).trimEnd();
  return davor === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(davor) || /(^|[^\w$])(return|typeof|in|of)$/.test(davor);
}

/** Index hinter einem regulaeren Ausdruck, der bei `i` beginnt. */
function regexEnde(q: string, i: number): number {
  let j = i + 1;
  let inKlasse = false;
  while (j < q.length) {
    const c = q[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '[') inKlasse = true;
    else if (c === ']') inKlasse = false;
    else if (c === '/' && !inKlasse) break;
    j++;
  }
  j++;
  while (/[a-z]/.test(q[j] ?? '')) j++;
  return j;
}

/**
 * Ueberspringt ab `i` ein Literal, einen Kommentar oder einen regulaeren
 * Ausdruck. Liefert den Index dahinter, oder -1, wenn dort nichts davon steht.
 */
function ueberspringe(q: string, i: number): number {
  const c = q[i];
  if (c === "'" || c === '"') return stringEnde(q, i);
  if (c === '`') return templateEnde(q, i);
  if (c === '/' && q[i + 1] === '/') { const ende = q.indexOf('\n', i); return ende === -1 ? q.length : ende; }
  if (c === '/' && q[i + 1] === '*') return q.indexOf('*/', i + 2) + 2;
  if (c === '/' && istRegex(q, i)) return regexEnde(q, i);
  return -1;
}

/** Index hinter der schliessenden Klammer auf Tiefe 0 ab `i`. */
function klammerEnde(q: string, i: number): number {
  let tiefe = 0;
  let j = i;
  while (j < q.length) {
    const weiter = ueberspringe(q, j);
    if (weiter !== -1) { j = weiter; continue; }
    const c = q[j];
    if (c === '(' || c === '[' || c === '{') tiefe++;
    else if (c === ')' || c === ']' || c === '}') {
      if (tiefe === 0) return j + 1;
      tiefe--;
    }
    j++;
  }
  return j;
}

/** Die Argumente eines Aufrufs; `start` steht direkt hinter der `(`. */
function argumente(q: string, start: number): string[] {
  const args: string[] = [];
  let anfang = start;
  let tiefe = 0;
  let j = start;
  while (j < q.length) {
    const weiter = ueberspringe(q, j);
    if (weiter !== -1) { j = weiter; continue; }
    const c = q[j];
    if (c === '(' || c === '[' || c === '{') tiefe++;
    else if (c === ')' || c === ']' || c === '}') {
      if (tiefe === 0) { args.push(q.slice(anfang, j)); return args; }
      tiefe--;
    } else if (c === ',' && tiefe === 0) {
      args.push(q.slice(anfang, j));
      anfang = j + 1;
    }
    j++;
  }
  return args;
}

/** Der Initialisierer von `const name = …` bis zum `;` auf Tiefe 0. */
function initialisierer(q: string, start: number): string {
  let tiefe = 0;
  let j = start;
  while (j < q.length) {
    const weiter = ueberspringe(q, j);
    if (weiter !== -1) { j = weiter; continue; }
    const c = q[j];
    if (c === '(' || c === '[' || c === '{') tiefe++;
    else if (c === ')' || c === ']' || c === '}') tiefe--;
    else if (c === ';' && tiefe === 0) break;
    j++;
  }
  return q.slice(start, j);
}

function entschluessele(roh: string): string {
  return roh.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, e: string) => {
    if (e[0] === 'u' && e.length > 1) return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
    return ({ n: '\n', t: '\t' } as Record<string, string>)[e] ?? e;
  });
}

const SCHLUESSELWOERTER = new Set([
  'instanceof', 'typeof', 'null', 'undefined', 'true', 'false', 'new', 'await', 'void', 'as', 'in',
]);

/**
 * Texte und Namen, die ein Ausdruck als GANZES annehmen kann: Literale und
 * Bezeichner auf oberster Ebene oder in Klammern — nicht in Aufrufen, Objekten,
 * Arrays, nicht als Vergleichsoperand, nicht in einer Verkettung.
 */
function ganzeWerte(a: string): { texte: string[]; namen: string[] } {
  const texte: string[] = [];
  const namen: string[] = [];
  const stapel: Array<'gruppe' | 'anderes'> = [];
  const aufOberster = () => stapel.every((s) => s === 'gruppe');
  let j = 0;
  while (j < a.length) {
    const c = a[j];
    if (c === "'" || c === '"' || c === '`') {
      const ende = c === '`' ? templateEnde(a, j) : stringEnde(a, j);
      const roh = a.slice(j + 1, ende - 1);
      const davor = a.slice(0, j).trimEnd();
      const danach = a.slice(ende).trimStart();
      const vergleich = /[=!]==?$/.test(davor) || /^[=!]==?/.test(danach);
      const verkettung = /\+$/.test(davor) || /^\+/.test(danach);
      const methode = danach.startsWith('.');
      const mitPlatzhalter = c === '`' && roh.includes('${');
      if (aufOberster() && !vergleich && !verkettung && !methode && !mitPlatzhalter) {
        texte.push(entschluessele(roh));
      }
      j = ende;
      continue;
    }
    const weiter = ueberspringe(a, j);
    if (weiter !== -1) { j = weiter; continue; }
    const bezeichner = /^[A-Za-z_$][\w$]*/.exec(a.slice(j));
    if (bezeichner && !/[\w$]/.test(a[j - 1] ?? '')) {
      const name = bezeichner[0];
      const davor = a.slice(0, j).trimEnd();
      const danach = a.slice(j + name.length).trimStart();
      const istZugriff = davor.endsWith('.') || /^(\?\.|\.|\(|\[)/.test(danach);
      const vergleich = /[=!]==?$/.test(davor) || /^[=!]==?/.test(danach);
      if (aufOberster() && !istZugriff && !vergleich && !SCHLUESSELWOERTER.has(name)) namen.push(name);
      j += name.length;
      continue;
    }
    if (c === '(') {
      const davor = a.slice(0, j).trimEnd();
      const istAufruf = /[\w$)\]]$/.test(davor) && !/(^|[^\w$])(return|typeof|await|void)$/.test(davor);
      stapel.push(istAufruf ? 'anderes' : 'gruppe');
    } else if (c === '[' || c === '{') {
      stapel.push('anderes');
    } else if (c === ')' || c === ']' || c === '}') {
      stapel.pop();
    }
    j++;
  }
  return { texte, namen };
}

/** Konstanten in Grossbuchstaben mit einem Literal als Wert, aus allen Dateien. */
function konstanten(dateien: Array<{ quelle: string }>): Map<string, string> {
  const werte = new Map<string, string>();
  const muster = /\bconst\s+([A-Z][A-Z0-9_]+)\s*(?::\s*string\s*)?=\s*(['"])((?:\\.|(?!\2).)*)\2/g;
  for (const { quelle } of dateien) {
    for (const m of quelle.matchAll(muster)) werte.set(m[1], entschluessele(m[3]));
  }
  return werte;
}

/** Wo gesucht wird, und welches Argument der Text ist. */
const AUFRUFE: Array<{ muster: RegExp; argument: number }> = [
  { muster: /(?<![\w$.])setError\(/g, argument: 0 },
  { muster: /(?<![\w$.])fehlerText\(/g, argument: 1 },
  { muster: /(?<![\w$.])fehlerTextOderMessage\(/g, argument: 1 },
  { muster: /(?<![\w$.])onError\(/g, argument: 0 },
  { muster: /(?<![\w$.])onErrorRef\.current\?\.\(/g, argument: 0 },
];

/** Alle festen Fehlertexte an den Aufrufstellen, mit einer Fundstelle je Text. */
function fehlertexteImCode(): Map<string, string> {
  const dateien = quelldateien(SRC).map((pfad) => ({ pfad, quelle: readFileSync(pfad, 'utf8') }));
  const grosseKonstanten = konstanten(dateien);
  const gefunden = new Map<string, string>();
  const merke = (text: string, wo: string) => {
    if (text && !gefunden.has(text)) gefunden.set(text, wo);
  };

  for (const { pfad, quelle } of dateien) {
    for (const { muster, argument } of AUFRUFE) {
      for (const treffer of quelle.matchAll(muster)) {
        const index = treffer.index ?? 0;
        const zeilenanfang = quelle.lastIndexOf('\n', index) + 1;
        const zeileDavor = quelle.slice(zeilenanfang, index);
        // Kommentarzeilen und die Definitionen selbst
        if (/^\s*(\/\/|\*|\/\*)/.test(zeileDavor) || /\bfunction\s+$/.test(zeileDavor)) continue;

        const arg = argumente(quelle, index + treffer[0].length)[argument];
        if (arg === undefined) continue;
        const wo = `${relative(WURZEL, pfad)}:${quelle.slice(0, index).split('\n').length}`;

        const { texte, namen } = ganzeWerte(arg);
        texte.forEach((t) => merke(t, wo));
        for (const name of namen) {
          // Lokale Konstante derselben Datei (alle gleichnamigen)
          for (const decl of quelle.matchAll(new RegExp(`\\bconst\\s+${name.replace(/\$/g, '\\$')}\\s*(?::[^=]+)?=`, 'g'))) {
            const init = initialisierer(quelle, (decl.index ?? 0) + decl[0].length);
            const innen = ganzeWerte(init);
            innen.texte.forEach((t) => merke(t, `${wo} (${name})`));
            innen.namen.forEach((n) => { const w = grosseKonstanten.get(n); if (w) merke(w, `${wo} (${n})`); });
          }
          const wert = grosseKonstanten.get(name);
          if (wert) merke(wert, `${wo} (${name})`);
        }
      }
    }
  }
  return gefunden;
}

const IM_CODE = fehlertexteImCode();

/* ------------------------------------------------------------------ *
 * Die Pruefungen
 * ------------------------------------------------------------------ */

describe('Positivliste der Fehlertexte: vollständig und nicht veraltet', () => {
  it('der Scan findet die Aufrufstellen überhaupt (Gegenprobe gegen einen leeren Scan)', () => {
    // Bekannte Stellen aus drei Mustern — faellt der Leser aus, faellt das auf.
    expect(IM_CODE.get('Fehler bei der Anmeldung')).toMatch(/konfi\/views\/EventDetailView\.tsx/);
    expect(IM_CODE.has('Das geht nur mit Internetverbindung. Bitte versuche es später noch einmal.')).toBe(true);
    expect(IM_CODE.has('Das Passwort muss ein Sonderzeichen enthalten')).toBe(true);
    expect(IM_CODE.has('Video kann nicht abgespielt werden')).toBe(true);
    expect(IM_CODE.size).toBeGreaterThan(150);
  });

  it('kein Template-String und keine Verkettung wird als fester Text gezählt', () => {
    for (const text of IM_CODE.keys()) {
      expect(text).not.toContain('${');
    }
    // Stichproben aus dem Code: zusammengesetzt, also NICHT in der Liste.
    const zusammengesetzt = [...IM_CODE.keys()].filter((t) =>
      t.startsWith('Fehler beim Erstellen des Gruppenchats:') || t.startsWith('Fehler beim Laden des Videos:')
    );
    expect(zusammengesetzt).toEqual([]);
  });

  it('jeder feste Fehlertext aus dem Code steht in der Liste', () => {
    const liste = new Set(BEKANNTE_FEHLERTEXTE);
    const fehlend = [...IM_CODE.entries()]
      .filter(([text]) => !liste.has(text))
      .map(([text, wo]) => `${JSON.stringify(text)}  (${wo})`);
    expect(fehlend, 'in utils/bekannteFehlertexte.ts ergänzen').toEqual([]);
  });

  it('jeder Eintrag der Liste steht noch an einer Aufrufstelle', () => {
    const veraltet = BEKANNTE_FEHLERTEXTE.filter((text) => !IM_CODE.has(text));
    expect(veraltet, 'aus utils/bekannteFehlertexte.ts entfernen').toEqual([]);
  });

  it('keine Dubletten, keine leeren Einträge, keine Platzhalter', () => {
    const alle = [...BEKANNTE_FEHLERTEXTE, ...ZUGELASSENE_SERVERTEXTE];
    expect(new Set(alle).size).toBe(alle.length);
    for (const text of alle) {
      expect(text.trim()).toBe(text);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\$\{|%s|\{\w+\}/);
      expect(text).not.toBe(STELLE_ANDERE_MELDUNG);
    }
  });
});

describe('Zugelassene Server-Texte: wörtlich und ohne Platzhalter im Backend', () => {
  const buchung = readFileSync(resolve(BACKEND, 'utils/bookingUtils.js'), 'utf8');

  it('es sind wenige, und alle stammen aus der Event-Anmeldung und -Abmeldung', () => {
    expect(ZUGELASSENE_SERVERTEXTE).toHaveLength(18);
  });

  it.each([...ZUGELASSENE_SERVERTEXTE])('%s', (text) => {
    // Als EIGENES Literal, nicht nur als Teil eines laengeren Textes.
    const alsLiteral = [`'${text.replace(/'/g, "\\'")}'`, `"${text}"`, `\`${text}\``];
    expect(alsLiteral.some((l) => buchung.includes(l))).toBe(true);
  });
});

describe('ERLAUBTE_STELLEN: die einzigen Werte, die `stelle` annehmen kann', () => {
  it('besteht aus den entschärften Texten beider Listen und dem Platzhalter', () => {
    const erwartet = new Set([
      ...[...BEKANNTE_FEHLERTEXTE, ...ZUGELASSENE_SERVERTEXTE].map((t) => t.replace(/\d+/g, '#').slice(0, 80)),
      STELLE_ANDERE_MELDUNG,
    ]);
    expect([...ERLAUBTE_STELLEN].sort()).toEqual([...erwartet].sort());
  });

  it('fehlerStelle liefert für jede Eingabe ein Element davon', () => {
    const eingaben = [
      ...BEKANNTE_FEHLERTEXTE,
      'Emilia Mustermann gehört zu keinem Jahrgang dieses Events',
      'Fehler beim Speichern Emilia',
      '',
      'andere-meldung',
      'x'.repeat(500),
    ];
    for (const e of eingaben) expect(ERLAUBTE_STELLEN.has(fehlerStelle(e))).toBe(true);
  });

  it('fehlerStelle ist idempotent (zweite Sperre in trackFehler)', () => {
    for (const e of [...BEKANNTE_FEHLERTEXTE, 'Emilia Mustermann']) {
      expect(fehlerStelle(fehlerStelle(e))).toBe(fehlerStelle(e));
    }
  });

  it('das Skript für die Umami-Bereinigung liest dieselbe Menge aus der Datei', () => {
    const quelle = readFileSync(resolve(SRC, 'utils/bekannteFehlertexte.ts'), 'utf8');
    const ausSkript: string[] = erlaubteStellenAus(quelle);
    expect([...ausSkript].sort()).toEqual([...ERLAUBTE_STELLEN].sort());

    const sql: string = sqlFuer(ausSkript);
    // Jeder Wert genau einmal, Hochkommas verdoppelt.
    for (const wert of ERLAUBTE_STELLEN) {
      expect(sql).toContain(`('${wert.replace(/'/g, "''")}')`);
    }
    expect(sql).toMatch(/^CREATE TEMP TABLE erlaubte_stelle/m);
  });
});
