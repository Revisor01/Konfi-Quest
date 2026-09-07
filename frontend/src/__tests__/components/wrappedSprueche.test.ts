import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Jede Seite hat FÜNF unterschiedliche Sprüche.
 *
 * SIMONS VORGABE (03.09.2026): "Die Sprüche brauchen Unterschiede. Immer mal
 * aufgetaucht bei weniger als 5, bei mehr als 10 das. Also pro Seite 5
 * Optionen."
 *
 * WARUM DAS EIN TEST IST: Beim ersten Anlauf hatte ich bei `datum:erntedank`
 * versehentlich denselben Spruch zweimal eingetragen — eine Person mit einem
 * Termin und eine mit zwölf hätten dort dasselbe gelesen. Das fällt beim
 * Lesen nicht auf, weil die Liste lang ist, und in der App auch nicht: Man
 * sieht ja immer nur die eigene Stufe.
 */

// Die Texte liegen seit dem 06.09.2026 in einer eigenen Datei: Die
// Teilen-Karte braucht dieselben Sprueche wie die Seite, und ein Bauteil,
// das nebenher Konstanten ausgibt, haengt das schnelle Neuladen im
// Entwicklungsbetrieb aus.
const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/wrapped/slides/kategorieSeitenTexte.ts'),
  'utf8'
);

// Jede Seite mit ihren fünf Stufen aus dem Quelltext lesen.
const seiten = [...quelle.matchAll(/'([\w:-]+)':\s*\{\s*auge:\s*'([^']+)',\s*stufen:\s*\[([\s\S]*?)\]/g)]
  .map(([, key, auge, roh]) => ({
    key,
    auge,
    stufen: [...roh.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]),
  }));

describe('Sprüche der Rückblick-Seiten', () => {
  it('es werden überhaupt Seiten gefunden', () => {
    // Schutz vor einem stillen Fehlschlag: Ändert sich die Schreibweise,
    // liefe die Regex ins Leere und alle Tests wären grün ohne zu prüfen.
    expect(seiten.length).toBeGreaterThanOrEqual(19);
  });

  it.each(seiten.map(s => [s.key, s] as const))('%s hat genau 5 Stufen', (_key, seite) => {
    expect(seite.stufen).toHaveLength(5);
  });

  it.each(seiten.map(s => [s.key, s] as const))('%s hat 5 VERSCHIEDENE Sprüche', (_key, seite) => {
    const einzigartig = new Set(seite.stufen);
    expect(einzigartig.size, `doppelter Spruch: ${[...einzigartig].join(' / ')}`).toBe(5);
  });

  it.each(seiten.map(s => [s.key, s] as const))('%s: kein Spruch ist leer', (_key, seite) => {
    for (const spruch of seite.stufen) {
      expect(spruch.trim().length).toBeGreaterThan(3);
    }
  });

  it('kein Spruch enthält eine Negativ-Aussage', () => {
    // Simons Regel, die über allem steht: keine Fehlzeiten, kein Absagen,
    // kein Vergleich nach unten.
    const verboten = /abgesagt|verpasst|leider|nur wenig|zu selten|nicht geschafft|schade/i;
    for (const seite of seiten) {
      for (const spruch of seite.stufen) {
        expect(verboten.test(spruch), `${seite.key}: "${spruch}"`).toBe(false);
      }
    }
  });
});

/**
 * KEINE WORTDOPPELUNG ZWISCHEN SEITEN, DIE ZUSAMMEN AUFTRETEN.
 *
 * BEFUND 06.09.2026: Auf der Termin-Seite stand "Immer wieder aufgetaucht"
 * mit dem Nachsatz "Nicht einmal, nicht zweimal — immer wieder", und zwei
 * Seiten weiter las dieselbe Person "Immer wieder dabei" auf der
 * Jugend-Seite. Dazu kam die Highlight-Seite, die Wort fuer Wort die Labels
 * der Challenge- und der Termin-Seite trug ("Du hast dich getraut", "Auf
 * dich war Verlass").
 *
 * Warum ein Test und kein Blick: Man sieht immer nur den eigenen Rueckblick,
 * und welche Seiten zusammenfallen, haengt an den Daten. Beim Lesen der
 * Dateien nebeneinander faellt es nicht auf -- sie liegen in verschiedenen
 * Ordnern.
 *
 * Geprueft werden die Sprueche des KONFI-Zweigs untereinander. Der
 * Teamer-Zweig ist eine eigene Kette; seine Seiten treffen nie auf die des
 * Konfi-Rueckblicks.
 */
const KONFI_TEXTQUELLEN = [
  'src/components/wrapped/slides/kategorieSeitenTexte.ts',
  'src/components/wrapped/slides/EventsSlide.tsx',
  'src/components/wrapped/slides/PunkteSlide.tsx',
  'src/components/wrapped/slides/BadgesSlide.tsx',
  'src/components/wrapped/slides/ChallengesSlide.tsx',
  'src/components/wrapped/slides/HighlightSlide.tsx',
  'src/components/wrapped/slides/LangerAtemSlide.tsx',
];
// Nicht dabei: WochentagSlide.tsx -- die Seite hat ihren Text direkt im
// JSX stehen, ohne eine einzige Zeichenkette, und liesse sich hier nur mit
// einem eigenen Parser lesen.

/** Normalisiert einen Spruch auf seine Wortfolge -- ohne Satzzeichen und Umbrueche. */
function woerter(text: string): string[] {
  return text
    .replace(/\\n/g, ' ')
    .toLowerCase()
    .match(/[a-zäöüß]+/g) || [];
}

describe('Keine Wortdoppelung zwischen Seiten, die zusammen auftreten', () => {
  // Je Datei alle Sprueche einsammeln: Slogan-Zeilen, Nachsaetze, Labels.
  const proDatei = KONFI_TEXTQUELLEN.map(pfad => {
    // Kommentare zuerst raus: Sie zitieren gern die Saetze, um die es geht
    // (dieser Test tut es selbst), und waeren sonst falsche Treffer.
    const inhalt = readFileSync(resolve(process.cwd(), pfad), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');
    // Nur Zeilen aus den Textfeldern -- Klassennamen und Importpfade
    // enthalten keine deutschen Saetze mit Leerzeichen und Umlauten.
    // Einfache Anfuehrungszeichen UND Backticks: Seiten, die Datum oder
    // Zahl einsetzen, schreiben ihren Nachsatz als Template-Literal.
    const kandidaten = [
      ...[...inhalt.matchAll(/'((?:[^'\\\n]|\\.){6,140})'/g)].map(m => m[1]),
      ...[...inhalt.matchAll(/`((?:[^`\n]){6,140})`/g)].map(m => m[1]),
    ];
    const texte = kandidaten.filter(t =>
      !/import |var\(|className|=>|\.\.\/|@ionic|-slide|kat-|wrapped-|w-/.test(t)
      && /[ \\]/.test(t)
      && (woerter(t).length >= 3)
    );
    return { pfad, texte };
  });

  it('die Sprueche werden ueberhaupt gefunden', () => {
    for (const d of proDatei) {
      expect(d.texte.length, `keine Texte in ${d.pfad}`).toBeGreaterThan(1);
    }
  });

  it('keine Wendung aus drei Woertern steht auf zwei verschiedenen Seiten', () => {
    // Funktionswoerter allein sind keine Wendung, sondern Grammatik: "mal
    // hast du" oder "und das ist" stehen zwangslaeufig oefter da und sagen
    // nichts. Gezaehlt wird nur, was mindestens ein INHALTSWORT traegt --
    // genau das macht eine Wendung wiedererkennbar.
    const FUNKTIONSWOERTER = new Set([
      'und', 'das', 'ist', 'der', 'die', 'den', 'dem', 'des', 'du', 'dir',
      'dich', 'ein', 'eine', 'einen', 'einem', 'hast', 'hat', 'haben', 'war',
      'warst', 'bist', 'sein', 'an', 'auf', 'in', 'im', 'mit', 'von', 'zu',
      'zum', 'zur', 'bei', 'fuer', 'es', 'sie', 'er', 'wir', 'ihr', 'mal',
      'nicht', 'noch', 'schon', 'auch', 'aber', 'wenn', 'dass', 'was', 'wie',
      'so', 'als', 'am', 'nur', 'sich', 'dein', 'deine', 'deinen', 'einmal',
    ]);
    const traegtInhalt = (w: string[]) => w.some(x => !FUNKTIONSWOERTER.has(x));

    const gesehen = new Map<string, { pfad: string; text: string }>();
    const treffer: string[] = [];

    for (const { pfad, texte } of proDatei) {
      // Innerhalb einer Datei darf sich etwas wiederholen -- die Stufen
      // schliessen einander aus, es sieht nie jemand zwei davon.
      const inDieserDatei = new Set<string>();
      for (const text of texte) {
        const w = woerter(text);
        for (let i = 0; i + 2 < w.length; i++) {
          const teile = w.slice(i, i + 3);
          if (!traegtInhalt(teile)) continue;
          const wendung = teile.join(' ');
          if (inDieserDatei.has(wendung)) continue;
          inDieserDatei.add(wendung);
          const vorher = gesehen.get(wendung);
          if (vorher && vorher.pfad !== pfad) {
            treffer.push(`"${wendung}" -- ${vorher.pfad}: "${vorher.text}" / ${pfad}: "${text}"`);
          } else if (!vorher) {
            gesehen.set(wendung, { pfad, text });
          }
        }
      }
    }

    expect(treffer, treffer.join('\n')).toEqual([]);
  });

  // Der eigentliche Befund war KUERZER als drei Woerter: "Immer wieder"
  // stand auf der Termin-Seite (Slogan und Nachsatz) und auf der
  // Jugend-Seite -- zwei Woerter, beide Inhaltswoerter, und trotzdem eine
  // Wendung, die man wiedererkennt. Deshalb dieselbe Pruefung noch einmal
  // fuer Zweierketten, in denen KEIN Funktionswort steckt.
  it('keine auffaellige Zweierwendung steht auf zwei verschiedenen Seiten', () => {
    const FUNKTIONSWOERTER = new Set([
      'und', 'das', 'ist', 'der', 'die', 'den', 'dem', 'des', 'du', 'dir',
      'dich', 'ein', 'eine', 'einen', 'einem', 'hast', 'hat', 'haben', 'war',
      'warst', 'bist', 'sein', 'an', 'auf', 'in', 'im', 'mit', 'von', 'zu',
      'zum', 'zur', 'bei', 'fuer', 'für', 'es', 'sie', 'er', 'wir', 'ihr',
      'mal', 'nicht', 'noch', 'schon', 'auch', 'aber', 'wenn', 'dass', 'was',
      'wie', 'so', 'als', 'am', 'nur', 'sich', 'dein', 'deine', 'deinen',
      'einmal', 'da', 'dabei', 'jeder', 'jede', 'alle', 'kein', 'keine',
      'zwei', 'drei', 'vier', 'zweimal', 'dreimal', 'stück', 'mehr',
    ]);

    const gesehen = new Map<string, { pfad: string; text: string }>();
    const treffer: string[] = [];

    for (const { pfad, texte } of proDatei) {
      const inDieserDatei = new Set<string>();
      for (const text of texte) {
        const w = woerter(text);
        for (let i = 0; i + 1 < w.length; i++) {
          const teile = w.slice(i, i + 2);
          if (teile.some(x => FUNKTIONSWOERTER.has(x))) continue;
          const wendung = teile.join(' ');
          if (inDieserDatei.has(wendung)) continue;
          inDieserDatei.add(wendung);
          const vorher = gesehen.get(wendung);
          if (vorher && vorher.pfad !== pfad) {
            treffer.push(`"${wendung}" -- ${vorher.pfad}: "${vorher.text}" / ${pfad}: "${text}"`);
          } else if (!vorher) {
            gesehen.set(wendung, { pfad, text });
          }
        }
      }
    }

    expect(treffer, treffer.join('\n')).toEqual([]);
  });
});

/**
 * "DAS JAHR" IST KEINE ABGESCHLOSSENE EINHEIT.
 *
 * SIMONS KRITIK (06.09.2026, woertlich): "Das Jahr ist noch nicht zu Ende
 * ist ne seltsame Ansage bei zweistellig. Weil wir das ja nie richtig auf
 * das Konfi Jahr rechnen."
 *
 * Der Rueckblickszeitraum laeuft seither von Anfang an bis jetzt. Ein
 * "Jahr, das noch nicht vorbei ist", gibt es in dieser Rechnung nicht mehr,
 * und die Konfi-Zeit dauert bei vielen zwei Jahre.
 *
 * ERLAUBT BLEIBT das KALENDARISCHE Jahr -- "die vollste Zeit des Jahres" im
 * Advent, "Jahr fuer Jahr Danke gesagt" beim Erntedank, "zwischen den
 * Jahren". Gemeint ist dort der Kalender, nicht der Rueckblickszeitraum.
 * Ebenso das NAECHSTE Jahr in der Einladung ins Team: Das ist eine
 * Zukunftsangabe, kein Zeitraum, ueber den abgerechnet wird.
 */
describe('Kein "Jahr" als abgeschlossene Einheit im Konfi-Rueckblick', () => {
  // Wendungen, die den Rueckblickszeitraum als Jahr behandeln.
  const VERBOTEN = [
    /\bdas Jahr ist\b/i,
    /\bJahr ist noch nicht\b/i,
    /\bdein Jahr\b/i,
    /\bein Jahr, in dem\b/i,
    /\büber das ganze Jahr\b/i,
    /\bim Laufe des Jahres\b/i,
  ];

  it.each(KONFI_TEXTQUELLEN)('%s spricht nicht vom Jahr als Zeitraum', (pfad) => {
    const inhalt = readFileSync(resolve(process.cwd(), pfad), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');
    for (const muster of VERBOTEN) {
      const treffer = inhalt.match(muster);
      expect(treffer, `${pfad}: "${treffer?.[0]}"`).toBe(null);
    }
  });

  it('das kalendarische Jahr bleibt erlaubt', () => {
    // Gegenprobe zur Regel oben: Waeren diese Stellen mit verschwunden,
    // haette der Test zu grob gegriffen und echte Texte mitgerissen.
    const kategorien = readFileSync(
      resolve(process.cwd(), 'src/components/wrapped/slides/kategorieSeitenTexte.ts'),
      'utf8'
    );
    expect(kategorien).toContain('vollsten Zeit des Jahres');
    expect(kategorien).toContain('Jahr für Jahr');
    expect(kategorien).toContain('zwischen den Jahren');
  });
});
