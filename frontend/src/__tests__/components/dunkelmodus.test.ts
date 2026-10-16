import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { CRITERIA_COLORS, getCriteriaTextColor } from '../../utils/badgeCriteria';
import { regeln } from '../cssSpezifitaet';

/**
 * Dunkelmodus (25.09.2026): folgt der Systemeinstellung.
 *
 * Simons Auftrag war doppelt: ein Dunkelmodus UND ein Pruefstein fuer die
 * Farb-Konsolidierung -- "ueber diesen Weg wuerden wir ja auch direkt
 * erfahren, wo wir vielleicht doch noch was Verstreutes haben." Was im
 * Dunkeln weiss leuchtet, ist eine verstreute Farbe. Beim Einbau fanden sich
 * 22 Inline-Styles mit `white` als Hintergrund und 4 Regeln im Stylesheet.
 *
 * Geprueft wird das STYLESHEET: jsdom wertet keine Media-Queries aus, und
 * der Fehler entsteht erst am Geraet.
 *
 * Seit 15.10.2026 nur noch, was Barrierefreiheit und Hygiene ist: Lesbarkeit
 * (Kontrast), kein festes Weiss/Schwarz, Tokens an einer Stelle. Wie hell
 * eine Flaeche ist, welche Farbe ein Bereich traegt und wie Popover oder
 * Karten aussehen, bleibt frei aenderbar (Simon, 15.10.2026).
 *
 *   (a) Grundlage: Ionic-Palette und Theme-Variante, beide "system".
 *   (b) Jedes Farbtoken hat eine dunkle Entsprechung -- oder steht mit
 *       Begruendung in der Ausnahmeliste unten. Kein drittes.
 *   (c) Die dunklen -rgb-Tripel passen zu ihren Hexwerten.
 *   (d) Text auf Kartengrund ist lesbar (WCAG 4,5:1).
 *   (e) Kein Weiss und kein Schwarz mehr als fester Hintergrund/Text --
 *       weder in Komponenten noch im Stylesheet.
 */

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ohneKommentare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

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

/** Alle @media-(dark)-Bloecke, jeweils der Text innerhalb der aeusseren Klammern. */
const dunkelBloecke = [...css.matchAll(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
// Signalfarben (success/warning/danger/info/neutral/ampel) stehen als Text und
// feine Flaeche -- sie werden weiterhin aufgehellt. Bereichsfarben sind grosse
// Flaechen (Kopfbereiche, Dashboard-Verlaeufe) und bleiben seit 26.09.2026
// original, sonst blenden sie auf schwarzem Grund.
const SIGNAL = ['success', 'warning', 'danger', 'info', 'neutral', 'ampel'];
const istBereichsfarbe = (name: string) => {
  if (!name.startsWith('--app-color-')) return false;
  const kern = name.slice('--app-color-'.length);
  return !SIGNAL.some((sig) => kern.startsWith(sig));
};

const hell = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/g, '');
// Die Schatten-Skala lebt in theme/abstaende.css, ihre dunklen Werte stehen
// aber im einen Dunkelblock hier (26.09.2026) -- sonst gaelten sie als verwaist.
const hellMitSchatten = hell + '\n' + ohneKommentare(lies('src/theme/abstaende.css'));

/** Token-Definitionen (Name -> erster Wert) aus einem CSS-Ausschnitt. */
function tokens(quelle: string): Map<string, string> {
  const raus = new Map<string, string>();
  for (const m of quelle.matchAll(/^\s*(--app-[a-z0-9-]+):\s*([^;]+);/gm)) {
    if (!raus.has(m[1])) raus.set(m[1], m[2].trim());
  }
  return raus;
}

/** Ein Token ist ein FARB-Token, wenn sein Wert nach Farbe aussieht. */
const istFarbe = (wert: string) =>
  /#[0-9a-fA-F]{3,8}\b/.test(wert) || /rgba?\(/.test(wert) || /gradient\(/.test(wert) || /^\d+,\s*\d+,\s*\d+$/.test(wert);

/**
 * Tokens, die in beiden Modi ABSICHTLICH gleich bleiben. Jede Zeile traegt
 * ihren Grund; ein Token ohne Grund gehoert nicht hierher, sondern in den
 * Dunkelblock.
 */
const GLEICH_IN_BEIDEN_MODI: Record<string, string> = {
  '--app-weiss': 'echtes Weiss: QR-Code, Text und Knoepfe auf Farbflaechen',
  '--app-schwarz': 'echtes Schwarz: Hintergrund hinter Videos',
  '--app-color-gold': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-gold-hell': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-silber': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-silber-hell': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-bronze': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-bronze-hell': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-medaille-bronze': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-rakete': 'Akzent auf dem Raketen-Verlauf (weisser Text darauf)',
  '--app-color-rakete-hell': 'Akzent auf dem Raketen-Verlauf (weisser Text darauf)',
  '--app-auth-akzent': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-auth-rosa': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-auth-rosa-hell': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-wrapped-gold': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-gold-rgb': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-gold-hell': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-orange': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-rose': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-aurora-tuerkis-rgb': 'Schatten des Aurora-Verlaufs, der gleich bleibt',
  '--app-surface-dark': 'Video-Platzhalter, ist schon dunkel',
  '--app-gradient-teamer': 'Rollen-Verlauf mit weissem Text; farbTokens.test.ts haelt genau einen Verlauf je Rolle fest',
  '--app-gradient-konfi': 'Rollen-Verlauf mit weissem Text; farbTokens.test.ts haelt genau einen Verlauf je Rolle fest',
  '--app-gradient-admin': 'Rollen-Verlauf mit weissem Text; farbTokens.test.ts haelt genau einen Verlauf je Rolle fest',
  '--app-gradient-neutral': 'Schieferverlauf mit weissem Text',
  '--app-gradient-wrapped': 'farbige Kachel mit weissem Text',
  '--app-gradient-wrapped-hover': 'farbige Kachel mit weissem Text',
  '--app-gradient-badges': 'farbige Kachel mit weissem Text',
  '--app-gradient-success': 'Neu-Punkt, Ring auf Farbflaeche',
  '--app-gradient-auth-fehler': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-gradient-rakete': 'farbige Kachel mit weissem Text',
  '--app-gradient-rakete-quer': 'farbige Kachel mit weissem Text',
  '--app-gradient-aurora': 'Sperr- und Abdeckflaeche, bewusst farbig',
  '--app-gradient-nacht': 'ist schon ein Nachtverlauf',
  '--app-schatten-punkt-erfolg': 'gruener Glow des Status-Punkts, haengt an der Erfolgsfarbe',
  '--app-schatten-glow-challenges': 'farbiger Glow, folgt der Bereichsfarbe ueber ihr -rgb-Token',
  '--app-color-kriterium-total-points': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-gottesdienst-points': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-gemeinde-points': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-bonus-points': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-both-categories': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-activity-count': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-unique-activities': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-activity-combination': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-category-activities': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-category-combination': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-specific-activity': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-streak': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-time-based': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-event-count': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-mandatory-event-count': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-teamer-year': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
  '--app-color-kriterium-standard': 'Abzeichen-Kriterium als Flaeche (Symbolkreis, Ring) mit weissem Symbol, bleibt wie die Bereichsfarben; Schrift ueber --app-text-kriterium-*',
};

const helleTokens = tokens(hellMitSchatten);
const helleFarbTokens = [...helleTokens.entries()].filter(([, wert]) => istFarbe(wert)).map(([name]) => name);

describe('Dunkelmodus: Grundlage', () => {
  it('Ionics System-Palette wird in App.tsx geladen, VOR variables.css', () => {
    const app = ohneKommentare(lies('src/App.tsx'));
    const palette = app.indexOf("import '@ionic/react/css/palettes/dark.system.css';");
    const variablen = app.indexOf("import './theme/variables.css';");
    expect(palette).toBeGreaterThan(-1);
    expect(variablen).toBeGreaterThan(palette);
  });

  it('das iOS-Theme laedt dieselbe Variante (-dark-system), nach dem Theme selbst', () => {
    const roh = lies('src/theme/variables.css');
    const theme = roh.indexOf("@import '@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27.css';");
    const dunkel = roh.indexOf("@import '@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27-dark-system.css';");
    expect(dunkel).toBeGreaterThan(theme);
    expect(roh).not.toMatch(/ionic-theme-ios27-dark-(class|always)/);
  });

  it('die dunklen Tokens stehen an EINER Stelle -- ein einziger @media-Block in variables.css', () => {
    expect(dunkelBloecke).toHaveLength(1);
    expect(dunkelBloecke[0]).toMatch(/^\s*:root \{/);
  });
});

describe('Dunkelmodus: jedes Farbtoken hat eine dunkle Entsprechung', () => {
  const dunkleTokens = tokens(dunkelBloecke[0] ?? '');

  it('es gibt genau die erwartete Menge heller Farbtokens (Gegenprobe fuer die Erkennung)', () => {
    // Sinkt die Zahl, erkennt istFarbe() etwas nicht mehr; steigt sie, kam
    // ein Token dazu, das unten eine Entscheidung braucht.
    expect(helleFarbTokens.length).toBeGreaterThanOrEqual(150);
    expect(helleFarbTokens).toContain('--app-color-events');
    expect(helleFarbTokens).toContain('--app-color-events-rgb');
    expect(helleFarbTokens).toContain('--app-gradient-teamer');
    expect(helleFarbTokens).not.toContain('--app-schriftart-ueberschrift');
  });

  it('kein Farbtoken ohne dunkle Entsprechung und ohne Begruendung', () => {
    const fehlend = helleFarbTokens.filter((n) => !dunkleTokens.has(n) && !(n in GLEICH_IN_BEIDEN_MODI));
    expect(fehlend).toEqual([]);
  });

  it('die Ausnahmeliste widerspricht dem Dunkelblock nicht und nennt keine toten Tokens', () => {
    const doppelt = Object.keys(GLEICH_IN_BEIDEN_MODI).filter((n) => dunkleTokens.has(n));
    const tot = Object.keys(GLEICH_IN_BEIDEN_MODI).filter((n) => !helleTokens.has(n));
    expect(doppelt).toEqual([]);
    expect(tot).toEqual([]);
  });

  it('kein dunkles Token ohne helles Gegenstueck (Tippfehler im Namen)', () => {
    const verwaist = [...dunkleTokens.keys()].filter((n) => !helleTokens.has(n));
    expect(verwaist).toEqual([]);
  });

  it('die dunklen Werte unterscheiden sich von den hellen', () => {
    // Eine Kopie des hellen Werts waere kein Dunkelmodus, sondern Ballast.
    //
    // AUSGENOMMEN seit 26.09.2026 die BEREICHSFARBEN: Sie sollen ausdruecklich
    // gleich bleiben (Simon am Geraet: "Die Farben sind furchtbar, koennen
    // original bleiben"). Sie stehen als grosse Flaeche -- ein aufgehellter
    // Wert laesst den Kopfbereich auf schwarzem Grund blenden. Ob sie gleich
    // bleiben, ist Gestaltung und wird nicht geprueft (Simon, 15.10.2026);
    // hier geht es nur darum, dass jedes andere Token seinen eigenen dunklen
    // Wert hat.
    const gleich = [...dunkleTokens.entries()]
      .filter(([n, w]) => helleTokens.get(n) === w)
      .map(([n]) => n)
      .filter((n) => !istBereichsfarbe(n));
    expect(gleich).toEqual([]);
  });

  it('jedes -rgb-Tripel im Dunkelblock passt exakt zu seinem Hexwert', () => {
    const abweichungen: string[] = [];
    for (const [name, wert] of dunkleTokens) {
      if (!name.endsWith('-rgb')) continue;
      // Eigenstaendige RGB-Tokens ohne Hex-Geschwister (Glasleiste) haben
      // nichts, wogegen man rechnen koennte.
      if (!helleTokens.has(name.slice(0, -4))) continue;
      const hex = dunkleTokens.get(name.slice(0, -4));
      if (!hex) { abweichungen.push(`${name}: Hexwert fehlt im Dunkelblock`); continue; }
      const erwartet = hexZuRgb(hex).join(', ');
      if (wert !== erwartet) abweichungen.push(`${name}: ${wert} != ${erwartet} (${hex})`);
    }
    expect(abweichungen).toEqual([]);
  });

  it('Text auf Kartengrund ist lesbar: mindestens 4,5:1', () => {
    const grund = dunkleTokens.get('--app-surface-card')!;
    const schwach: string[] = [];
    // --app-text-muted fehlte hier bis 26.09.2026 als einziges Grau-Token --
    // und stand dunkel bei 3,74:1 auf der Karte (Audit BF-05).
    for (const name of ['--app-text-primary', '--app-text-secondary', '--app-text-tertiary', '--app-text-muted', '--app-text-system', '--app-text-emphasis', '--app-text-body', '--app-text-ios', '--app-text-dunkelgrau', '--app-text-mittelgrau', '--app-text-konfis']) {
      const k = kontrast(dunkleTokens.get(name)!, grund);
      if (k < 4.5) schwach.push(`${name}: ${k.toFixed(2)}`);
    }
    expect(schwach).toEqual([]);
    // Und die Statusflaechen mit ihrem Text:
    for (const [flaeche, text] of [['--app-flaeche-fehler', '--app-text-fehler'], ['--app-flaeche-warnung', '--app-text-warnung'], ['--app-flaeche-hinweis', '--app-text-hinweis-dunkel'], ['--app-flaeche-erfolg', '--app-color-success-tief']]) {
      expect(kontrast(dunkleTokens.get(text)!, dunkleTokens.get(flaeche)!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Dunkelmodus: kein festes Weiss oder Schwarz mehr als Flaeche', () => {
  // Weisse HINTERGRUENDE und schwarzer TEXT brechen im Dunkeln. Weisser Text
  // auf Farbflaechen ist in beiden Modi richtig und bleibt erlaubt.
  const FLAECHE_TSX = /(?:background|backgroundColor|'--background')\s*:\s*'(?:white|black|#fff|#ffffff|#000|#000000)'/g;
  const TEXT_TSX = /(?:\bcolor|'--color')\s*:\s*'(?:black|#000|#000000)'/g;

  it('keine .tsx-Komponente setzt inline einen weissen/schwarzen Hintergrund oder schwarzen Text', () => {
    const treffer: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.match(FLAECHE_TSX) ?? []) treffer.push(`${datei}: ${m}`);
      for (const m of code.match(TEXT_TSX) ?? []) treffer.push(`${datei}: ${m}`);
    }
    expect(treffer).toEqual([]);
  });

  // Hinter einem Bedingungsoperator fand die Regel darueber nichts: Sie
  // verlangt das Literal direkt nach dem Doppelpunkt. So standen die Antworten
  // einer Chat-Umfrage auf `… : takenByOther ? '…' : 'white'`, der Rahmen der
  // eigenen Umfrage und das Zitat in der eigenen Blase auf `isOwnMessage ?
  // 'white' : …` -- mit Schrift aus --app-text-emphasis, im Dunkeln fast
  // Weiss auf Weiss (27.09.2026). Der Wert reicht bis zum naechsten Komma
  // AUSSERHALB einer Zeichenkette; rgba(…) in Anfuehrungszeichen stoert nicht.
  const FLAECHE_BEDINGT_TSX = new RegExp(
    "(?:background|backgroundColor|'--background')\\s*:\\s*(?:[^'\\n,}]*'[^'\\n]*')*?[^'\\n,}]*'(?:white|black|#fff|#ffffff|#000|#000000)'",
    'g'
  );

  it('auch hinter einem Bedingungsoperator setzt keine .tsx-Komponente einen weissen/schwarzen Hintergrund', () => {
    const treffer: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.match(FLAECHE_BEDINGT_TSX) ?? []) treffer.push(`${datei}: ${m}`);
    }
    expect(treffer).toEqual([]);
  });

  it('die Erkennung hinter dem Bedingungsoperator findet den Fehlerfall -- und nur ihn (Gegenprobe der Suchfunktion)', () => {
    const findet = (zeile: string) => (zeile.match(FLAECHE_BEDINGT_TSX) ?? []).length > 0;
    // Die Zeilen von vorher:
    expect(findet("background: userVoted ? 'rgba(var(--app-color-chat-rgb), 0.12)' : takenByOther ? 'rgba(0,0,0,0.04)' : 'white',")).toBe(true);
    expect(findet("backgroundColor: isOwnMessage ? 'white' : 'rgba(var(--app-color-chat-rgb), 0.08)',")).toBe(true);
    expect(findet("background: aktiv ? '#fff' : 'var(--app-surface-soft)'")).toBe(true);
    // Weisse SCHRIFT hinter einem Hintergrund in derselben Zeile ist erlaubt:
    expect(findet("style={{ background: 'var(--app-color-chat)', color: 'white' }}")).toBe(false);
    expect(findet("background: aktiv ? 'var(--app-color-chat)' : 'var(--app-surface-card)', color: 'white'")).toBe(false);
    expect(findet("background: userVoted ? 'rgba(var(--app-color-chat-rgb), 0.12)' : takenByOther ? 'var(--app-surface-muted)' : 'var(--app-surface-card)',")).toBe(false);
  });

  // Schwarz mit Deckkraft ist auch Schwarz. `rgba(0,0,0,0.75)` als Textfarbe
  // war der Reaktionszaehler an fremden Chat-Nachrichten -- gedacht fuer die
  // weisse Blase; auf der dunklen (#242426) 1,25:1 (Dunkelmodus-Audit BF-07,
  // 26.09.2026). Die Pruefung darueber sucht nur die Literale black/#000 und
  // fand es nicht. Bestand, der noch umzustellen ist, steht hier mit Zahl und
  // Grund; die Liste darf nur schrumpfen (Nebenbefund des Audits: Hinweistexte
  // der Anmeldeseiten, im Dunkeln ebenso Schwarz auf der dunklen Karte).
  const SCHWARZ_MIT_DECKKRAFT_BESTAND: Record<string, number> = {
    'src/components/auth/ResetPasswordPage.tsx': 2, // "Passwort geaendert" / "Ungueltiger Link"
    'src/components/auth/ForgotPasswordPage.tsx': 1, // "E-Mail gesendet"
    'src/components/auth/KonfiRegisterPage.tsx': 1, // "Schon einen Account?" im zweiten Schritt
  };

  it('kein .tsx setzt inline Schwarz mit Deckkraft als Textfarbe -- ausser dem gezaehlten Bestand', () => {
    // Auch hinter einem Bedingungsoperator: `color: eigene ? '…' : 'rgba(0,0,0,…)'`.
    const TEXT_SCHWARZ_ALPHA = /(?:\bcolor|'--color')\s*:[^\n]*'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/g;
    const gezaehlt: Record<string, number> = {};
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const n = (code.match(TEXT_SCHWARZ_ALPHA) ?? []).length;
      if (n) gezaehlt[datei] = n;
    }
    expect(gezaehlt).toEqual(SCHWARZ_MIT_DECKKRAFT_BESTAND);
  });

  // Ein IonButton, der nur --background setzt, erbt Ionics Kontrastfarbe der
  // Primaerfarbe -- hell Weiss, in der Dunkelpalette #000. "Zur Teamer:in
  // befoerdern" tat das mit Konfi-Lila: schwarze Schrift auf #5b21b6, 2,34:1
  // (Dunkelmodus-Audit BF-08, 26.09.2026); gleiches Muster am Knopf
  // "Hinzufuegen" der Organisationsverwaltung. Erlaubt ist es nur, wo der
  // Hintergrund Ionics Primaerfarbe SELBST ist -- dazu passt die geerbte
  // Kontrastfarbe in beiden Paletten. Jede Ausnahme mit Grund; die Liste
  // darf nur schrumpfen.
  const HINTERGRUND_OHNE_COLOR_ERLAUBT: Record<string, number> = {
    'src/components/admin/modals/MaterialFormModal.tsx': 1, // "Datei auswaehlen": --background ist var(--ion-color-primary), Ionics eigenes Paar
  };

  it('kein IonButton setzt inline --background ohne --color -- ausser auf Ionics eigener Primaerfarbe', () => {
    const gezaehlt: Record<string, number> = {};
    const fremd: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      for (const tag of jsxOeffnendeTags(lies(datei), 'IonButton')) {
        if (!/'--background'\s*:/.test(tag) || /'--color'\s*:/.test(tag)) continue;
        gezaehlt[datei] = (gezaehlt[datei] ?? 0) + 1;
        if (!/'--background'\s*:\s*'var\(--ion-color-primary\)'/.test(tag)) fremd.push(`${datei}: ${tag.replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
    // Kein Knopf mit eigener Flaechenfarbe ohne eigene Schriftfarbe ...
    expect(fremd).toEqual([]);
    // ... und der Bestand auf Ionics Primaerfarbe ist genau der bekannte.
    expect(gezaehlt).toEqual(HINTERGRUND_OHNE_COLOR_ERLAUBT);
  });

  it('keine Regel im Theme-Stylesheet setzt white/black als Hintergrund oder schwarzen Text', () => {
    const treffer: string[] = [];
    for (const datei of ['src/theme/variables.css', 'src/theme/typografie.css', 'src/theme/abstaende.css']) {
      ohneKommentare(lies(datei)).split('\n').forEach((zeile, i) => {
        const t = zeile.trim();
        if (t.startsWith('--app-') || t.startsWith('--ion-')) return; // Token-Definition
        if (/^(?:--)?background(?:-color)?\s*:\s*(?:white|black|#fff\b|#ffffff|#000\b|#000000)\b/.test(t)) treffer.push(`${datei}:${i + 1} ${t}`);
        if (/^(?:--)?color\s*:\s*(?:black|#000\b|#000000)\b/.test(t)) treffer.push(`${datei}:${i + 1} ${t}`);
      });
    }
    expect(treffer).toEqual([]);
  });

  it('das Kartengrund-Token ist im Dunkeln dunkel', () => {
    expect(relativeHelligkeit(tokens(dunkelBloecke[0] ?? '').get('--app-surface-card')!)).toBeLessThan(0.05);
  });

  // Der Seitengrund kommt aus Ionics dark.system.css und ist
  // plattformabhaengig: `:root.ios` #000000, `:root.md` #121212. Die
  // Kontrast-Rechnungen unten (Text auf beiden Seitengruenden) haengen daran.
  it('der Seitengrund steht wirklich, wo wir ihn vermuten -- Ionic, nicht wir', () => {
    // Aendert Ionic die Palette oder setzt das Theme doch einen eigenen
    // Grund, muessen die Kontrast-Rechnungen neu gemacht werden.
    const palette = lies('node_modules/@ionic/core/css/palettes/dark.system.css');
    expect(palette).toMatch(/:root\.ios\{--ion-background-color:\s*#000000/);
    expect(palette).toMatch(/:root\.md\{--ion-background-color:\s*#121212/);
    // Und wir selbst setzen keinen EIGENEN Wert (nur als Rueckfall lesen ist
    // ok). Die einzige Zeile, die die Variable anfasst, nimmt mit `inherit`
    // Ionics angehobene Modal-Stufe (step-100) ZURUECK auf den Seitengrund --
    // sie definiert keinen dritten Grund.
    const eigene = ohneKommentare(lies('src/theme/variables.css'))
      .split('\n')
      .filter((z) => /^\s*--ion-background-color\s*:/.test(z))
      .map((z) => z.trim());
    expect(eigene).toEqual(['--ion-background-color: inherit;']);
  });

  it('Text auf der gedaempften Flaeche bleibt lesbar: mindestens 4,5:1', () => {
    // --app-flaeche-gedaempft ist die fixierte Kopfzeile der
    // Anwesenheitsmatrix; sie liegt AUF einer Karte.
    const d = tokens(dunkelBloecke[0] ?? '');
    for (const name of ['--app-text-primary', '--app-text-mittelgrau']) {
      expect(kontrast(d.get(name)!, d.get('--app-flaeche-gedaempft')!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // BEFUND AM GERAET (Simon, 26.09.2026): "Dark Mode Login Seite und
  // vermutlich auch User erstellen Passwort etc. sind noch hell!"
  //
  // Die Pruefung darueber fand es nicht: Sie sucht die LITERALE white/#fff.
  // `.app-auth-card` schrieb aber `background: var(--app-weiss)` — ein Token,
  // das bewusst KEINE dunkle Entsprechung hat (echtes Weiss fuer QR-Codes und
  // Text auf Farbflaechen). Als Flaechenhintergrund ist es damit ein fest
  // eingebautes Weiss, das der Dunkelmodus nie erreicht. Dasselbe gilt fuer
  // --app-surface-dark als Textfarbe: dunkel auf dunkel.
  //
  // Die Anmeldeseiten stehen ausserhalb der App-Struktur (eigene Seiten vor
  // dem Login), deshalb fielen sie beim Einbau durch.
  const NUR_AUF_FARBFLAECHE = ['--app-weiss'];

  // Weisse Elemente AUF einer Farbflaeche sind richtig so -- sie liegen auf
  // dem lila Anmelde-Verlauf beziehungsweise dem Sperrbildschirm, die in
  // beiden Modi farbig bleiben. Nur Flaechen, die den Seitenhintergrund
  // bilden, muessen dem Dunkelmodus folgen.
  const WEISS_AUF_FARBFLAECHE = [
    '.app-auth-hero__divider-icon',  // Raute auf dem Anmelde-Verlauf
    '.app-sperrbildschirm__knopf',   // weisser Knopf auf dem Verlauf
  ];

  it('kein Weiss-Token dient als Flaechenhintergrund im Stylesheet', () => {
    const treffer: string[] = [];
    for (const datei of ['src/theme/variables.css', 'src/theme/typografie.css', 'src/theme/abstaende.css']) {
      const zeilen = ohneKommentare(lies(datei)).split('\n');
      let selektor = '';
      zeilen.forEach((zeile, i) => {
        const t = zeile.trim();
        const auf = t.match(/^([.#a-zA-Z:[][^{]*)\{/);
        if (auf) selektor = auf[1].trim();
        if (t.startsWith('--app-weiss:')) return; // die Definition selbst
        if (WEISS_AUF_FARBFLAECHE.some((s) => selektor.includes(s))) return;
        for (const token of NUR_AUF_FARBFLAECHE) {
          if (!/^(?:--)?background(?:-color)?\s*:/.test(t) || !t.includes(`var(${token})`)) continue;
          // Als RUECKFALL ist es in Ordnung: `var(--ion-background-color,
          // var(--app-weiss))` nimmt Ionics Wert, sobald er da ist, und faellt
          // nur vor dem Laden auf Weiss zurueck (.app-laedt, Startbildschirm).
          // Getroffen wird nur, wo --app-weiss die erste Wahl ist.
          if (new RegExp(`var\\([^,)]+,\\s*var\\(${token}\\)`).test(t)) continue;
          treffer.push(`${datei}:${i + 1} ${selektor} -> ${t}`);
        }
      });
    }
    expect(treffer).toEqual([]);
  });

  it('die Anmelde-Karte folgt dem Dunkelmodus', () => {
    // Sie ist von `ion-card.app-card` ausgenommen (eigene Breite und
    // Zentrierung) und braucht die Oberflaechen-Tokens deshalb selbst.
    const regel = css.match(/\.app-auth-card \{([\s\S]*?)\}/);
    expect(regel, '.app-auth-card nicht gefunden').toBeTruthy();
    expect(regel![1]).toMatch(/--background:\s*var\(--app-surface-card\)/);
    expect(regel![1]).not.toMatch(/var\(--app-weiss\)/);
    // Textfarbe: --app-surface-dark ist der Video-Platzhalter (#1e1e1e) und
    // bleibt im Dunkeln dunkel -- unlesbar auf dunklem Grund.
    expect(regel![1]).not.toMatch(/--color:\s*var\(--app-surface-dark\)/);
  });
});

describe('Dunkelmodus: Bereichsfarbe als Text (Anmeldeseiten)', () => {
  // GEMESSEN am 26.09.2026 (Dunkelmodus-Audit BF-01, messen.cjs, iOS und
  // Android identisch): "Anmelden" in Konfi-Lila #5b21b6 auf der dunklen
  // Karte #242426 = 1,72:1; "Passwort vergessen?" (0,7 Deckkraft) = 1,40:1;
  // "Noch keinen Account?", "Zurueck zum Login" = 1,72:1. Hell 8,98:1.
  //
  // Die Bereichsfarben sind FLAECHEN. Als SCHRIFT auf einer Karte brauchen
  // sie ein eigenes Text-Token, das im Dunkeln aufhellt. Erstes Token dieser
  // Art: --app-text-konfis.
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const regel = (selektor: string) => {
    const roh = selektor.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const m = css.match(new RegExp(`(?:^|\\n)${roh} \\{([^}]*)\\}`));
    expect(m, `${selektor} nicht gefunden`).toBeTruthy();
    return m![1];
  };

  it('dunkel liest es sich auf der Karte: mindestens 4,5:1, auch mit 0,7 Deckkraft', () => {
    const karte = dunkel.get('--app-surface-card')!;
    const text = dunkel.get('--app-text-konfis')!;
    expect(kontrast(text, karte)).toBeGreaterThanOrEqual(4.5);
    // .app-auth-link--muted legt das Token mit 0,7 Deckkraft auf die Karte.
    expect(kontrast(mische(text, 0.7, karte), karte)).toBeGreaterThanOrEqual(4.5);
    // Und es ist wirklich ein eigener, hellerer Ton -- kein Alias der Flaeche.
    expect(text).not.toBe(dunkel.get('--app-color-konfis'));
  });

  it('Ueberschrift, Feldbeschriftung und Links der Anmeldeseiten schreiben mit dem Text-Token', () => {
    for (const selektor of ['.app-auth-card__heading h2', '.app-auth-input__label', '.app-auth-link']) {
      const r = regel(selektor);
      expect(r, selektor).toMatch(/color:\s*var\(--app-text-konfis\)/);
      expect(r, selektor).not.toMatch(/--app-color-(?:konfis|requests|purple)\b/);
    }
    const gedaempft = regel('.app-auth-link--muted');
    expect(gedaempft).toMatch(/color:\s*rgba\(var\(--app-text-konfis-rgb\),\s*0\.7\)/);
    expect(gedaempft).not.toMatch(/--app-color-(?:konfis|requests|purple)-rgb/);
  });
});

describe('Dunkelmodus: Dashboard-Verlaeufe enden auf Flaechen, nicht auf Text', () => {
  // GEMESSEN am 26.09.2026 (Dunkelmodus-Audit BF-02, computed.cjs): Die
  // Ranking-Karte lief von #34c759 nach #a7f3d0 (Mint), die Events-Karte von
  // #dc2626 nach #fca5a5 (Rosa) -- weisse Schrift darauf 1,28:1 bzw. 1,90:1
  // (hell 8,68 / 8,31). Ursache: Die Verlaeufe endeten auf TEXT-Tokens
  // (--app-color-success-tief, --app-text-fehler), die der Dunkelblock fuer
  // ihren Zweck -- Schrift auf dunkler Statusflaeche -- richtig aufhellt.
  // Ein Verlaufsende ist eine Flaeche und braucht ein Flaechen-Token.
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const verlauf = (klasse: string) => {
    const regel = css.match(new RegExp(`\\.${klasse} \\{([^}]*)\\}`));
    expect(regel, `.${klasse} nicht gefunden`).toBeTruthy();
    const bg = /background:\s*linear-gradient\(([^;]*)\);/.exec(regel![1]);
    expect(bg, `.${klasse} hat keinen Verlauf`).toBeTruthy();
    return bg![1];
  };

  it('kein Text-Token steht als Stufe in einem Verlauf -- nirgends im Stylesheet', () => {
    const treffer = [...css.matchAll(/gradient\(([^;]*)\)/g)]
      .map((m) => m[1])
      .filter((stufen) => /var\(--app-text-|var\(--app-color-success-tief\)/.test(stufen));
    expect(treffer).toEqual([]);
  });

  it('Events- und Ranking-Karte enden auf ihren Flaechen-Tokens', () => {
    expect(verlauf('app-dashboard-section--events')).toMatch(/var\(--app-color-events-tief\) 100%/);
    expect(verlauf('app-dashboard-section--ranking')).toMatch(/var\(--app-color-success-klassisch-dunkel\) 100%/);
  });

  it('weisse Schrift auf den Verlaufsenden: mindestens 4,5:1, hell wie dunkel', () => {
    for (const name of ['--app-color-events-tief', '--app-color-success-klassisch-dunkel']) {
      expect(kontrast('#ffffff', helleTokens.get(name)!), `${name} hell`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast('#ffffff', dunkel.get(name)!), `${name} dunkel`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Dunkelmodus: kein Inline-Flicken fuer den Kartengrund', () => {
  it('keine app-card traegt einen Inline-Flicken fuer den Kartengrund', () => {
    // PostfachModal.tsx hatte vom 25. bis 26.09.2026 `style={{ '--background':
    // 'var(--app-surface-card)' }}` an der IonCard -- ein Symptom-Fix, der die
    // Ursache in der Kartenregel verdeckte. Den Kartengrund setzt das
    // Stylesheet an einer Stelle; ein Inline-Wert waere wieder ein Flicken.
    const treffer: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      for (const m of code.matchAll(/<IonCard\b[^>]*>/g)) {
        if (/className=["'{`][^"'}]*\bapp-card\b/.test(m[0]) && /'--background'\s*:/.test(m[0])) {
          treffer.push(`${datei}: ${m[0].replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }
    expect(treffer).toEqual([]);
  });
});

describe('Dunkelmodus: Text-Token-Familie je Bereichsfarbe (Baustein 2)', () => {
  // GEMESSEN am 26.09.2026 (Dunkelmodus-Audit BF-06, messen.cjs, 94 Zustaende):
  // Bereichsfarben standen an 234 Stellen als SCHRIFT auf Karten und
  // Hinweiskaesten -- im Hellen lesbar (Konfi-Lila auf Weiss 8,98:1), im
  // Dunkeln nicht (auf der Karte #242426: konfis 1,72, challenges 2,46,
  // teamer 2,57, wrapped 2,72, activities 2,83, events 3,21, jahrgang 3,86,
  // gemeinde 4,11, gottesdienst 4,21, users 4,23). Fuer Schrift gibt es je
  // Bereich ein Text-Token, dunkel ein aufgehellter Ton mit mindestens 4,5:1
  // auf der Karte UND auf beiden Seitengruenden. Die Textstellen wurden per Codemod
  // umgestellt (nur `color`/`--color*` in style={{}} und im Stylesheet, keine
  // Flaechen, keine Datenfelder).
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const FAMILIE = ['events', 'activities', 'konfis', 'teamer', 'challenges', 'users', 'leitung', 'badges', 'wrapped', 'bonus', 'group', 'jahrgang', 'categories', 'material', 'chat', 'level', 'gottesdienst', 'gemeinde', 'organizations', 'requests', 'purple'];
  const GRUND_IOS = '#000000';
  const GRUND_ANDROID = '#121212';

  it('jede Bereichsfarbe, die als Text vorkommt, hat ein Text-Token -- hell UND dunkel, mit -rgb', () => {
    const fehlend: string[] = [];
    for (const b of FAMILIE) {
      for (const name of [`--app-text-${b}`, `--app-text-${b}-rgb`]) {
        if (!helleTokens.has(name)) fehlend.push(`${name} hell`);
        if (!dunkel.has(name)) fehlend.push(`${name} dunkel`);
      }
    }
    expect(fehlend).toEqual([]);
  });

  it('dunkel liest sich jedes Text-Token auf Karte und beiden Seitengruenden: mindestens 4,5:1', () => {
    const schwach: string[] = [];
    for (const b of FAMILIE) {
      const t = dunkel.get(`--app-text-${b}`)!;
      for (const [grundName, grund] of [['Karte', dunkel.get('--app-surface-card')!], ['iOS-Grund', GRUND_IOS], ['Android-Grund', GRUND_ANDROID], ['Verlaufsende', '#1f1f22']]) {
        const k = kontrast(t, grund);
        if (k < 4.5) schwach.push(`${b} ${t} auf ${grundName} ${grund}: ${k.toFixed(2)}`);
      }
      // Ein eigener, hellerer Ton -- kein Alias der Flaechenfarbe.
      if (t === dunkel.get(`--app-color-${b}`)) schwach.push(`${b}: dunkel identisch mit der Flaechenfarbe`);
    }
    expect(schwach).toEqual([]);
  });

  // Bestand, der bewusst bleibt -- jede Zeile mit Grund; die Liste darf nur schrumpfen.
  const BEREICHSFARBE_ALS_TEXT_BESTAND: Record<string, number> = {
    // ShareCard rendert ein Bild mit eigenem dunklen Grund in BEIDEN Modi;
    // --app-color-wrapped-hell ist dort der helle Akzent und hat keine Text-Variante.
    'src/components/wrapped/share/ShareCard.tsx': 3,
    // Symbol auf dem dunklen Wrapped-Verlauf der Dashboard-Kachel, in beiden Modi gleich.
    'src/components/teamer/pages/TeamerDashboardPage.tsx': 1,
  };

  /** Text-Eigenschaften in style={{ … }}-Bloecken, deren Wert eine Bereichsfarbe traegt. */
  function bereichsfarbenAlsText(code: string): string[] {
    const treffer: string[] = [];
    for (const m of code.matchAll(/style=\{\{/g)) {
      const start = m.index! + 'style={'.length;
      let tiefe = 0; let anf: string | null = null; let ende = start;
      for (let i = start; i < code.length; i++) {
        const c = code[i];
        if (anf) { if (c === anf && code[i - 1] !== '\\') anf = null; continue; }
        if (c === "'" || c === '"' || c === '`') { anf = c; continue; }
        if (c === '{' || c === '(' || c === '[') tiefe++;
        else if (c === '}' || c === ')' || c === ']') { tiefe--; if (tiefe === 0) { ende = i; break; } }
      }
      const block = code.slice(start, ende + 1);
      for (const p of block.matchAll(/(?:\bcolor|'--color(?:-checked|-hover|-focused|-activated)?')\s*:\s*([^,}]*(?:\([^)]*\)[^,}]*)*)/g)) {
        for (const v of p[1].matchAll(/var\(--app-color-([a-z-]+?)(?:-rgb)?\)/g)) {
          if (istBereichsfarbe(`--app-color-${v[1]}`)) treffer.push(`${p[0].trim().slice(0, 80)}`);
        }
      }
    }
    return treffer;
  }

  it('keine Bereichsfarbe steht mehr als Textfarbe in einem style-Block -- ausser dem gezaehlten Bestand', () => {
    const gezaehlt: Record<string, number> = {};
    for (const datei of dateienUnter('src', '.tsx')) {
      const n = bereichsfarbenAlsText(lies(datei).replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).length;
      if (n) gezaehlt[datei] = n;
    }
    expect(gezaehlt).toEqual(BEREICHSFARBE_ALS_TEXT_BESTAND);
  });

  // Bereichsfarbe als Schrift auf einer Flaeche, die in BEIDEN Modi weiss ist:
  // dort waere das aufgehellte Text-Token im Dunkeln unlesbar (#c4b5fd auf
  // Weiss 1,6:1). Jede Zeile mit Grund; die Liste darf nur schrumpfen.
  const BEREICHSFARBE_AUF_WEISS: Record<string, string> = {
    '.app-sperrbildschirm__knopf': 'weisser Knopf (--app-weiss) auf dem Aurora-Verlauf, Konfi-Lila als Schrift in beiden Modi',
  };

  it('keine Bereichsfarbe steht mehr als Textfarbe im Stylesheet -- ausser auf Flaechen, die in beiden Modi weiss sind', () => {
    // Zeilen `color:` / `--color*:` mit var(--app-color-<bereich>); Signalfarben
    // (success/warning/danger/info/neutral/ampel) sind keine Bereichsfarben.
    const treffer: string[] = [];
    const ausnahmenGetroffen = new Set<string>();
    let selektor = '';
    css.split('\n').forEach((zeile, i) => {
      const auf = zeile.trim().match(/^([.#a-zA-Z:[][^{]*)\{/);
      if (auf) selektor = auf[1].trim();
      const m = /^\s*(?:--color(?:-checked|-hover|-focused|-activated)?|color)\s*:\s*(.*)$/.exec(zeile);
      if (!m) return;
      for (const v of m[1].matchAll(/var\(--app-color-([a-z-]+?)(?:-rgb)?\)/g)) {
        if (!istBereichsfarbe(`--app-color-${v[1]}`)) continue;
        if (selektor in BEREICHSFARBE_AUF_WEISS) { ausnahmenGetroffen.add(selektor); continue; }
        treffer.push(`variables.css:${i + 1} ${selektor} -> ${zeile.trim()}`);
      }
    });
    expect(treffer).toEqual([]);
    // Und jede Ausnahme trifft noch etwas -- sonst ist sie tot.
    expect([...ausnahmenGetroffen].sort()).toEqual(Object.keys(BEREICHSFARBE_AUF_WEISS).sort());
    // Die Ausnahme ist wirklich ein weisser Knopf, kein Freibrief.
    for (const sel of Object.keys(BEREICHSFARBE_AUF_WEISS)) {
      const rumpf = regeln(css).find((r) => r.selektor === sel)?.rumpf ?? '';
      expect(rumpf, `${sel} traegt kein --background: var(--app-weiss)`).toMatch(/--background:\s*var\(--app-weiss\)/);
    }
  });

  it('die Erkennung findet den Fehlerfall (Gegenprobe der Suchfunktion)', () => {
    expect(bereichsfarbenAlsText(`<div style={{ color: 'var(--app-color-events)' }} />`)).toHaveLength(1);
    expect(bereichsfarbenAlsText(`<div style={{ color: x ? 'var(--app-text-events)' : 'var(--app-color-chat)' }} />`)).toHaveLength(1);
    expect(bereichsfarbenAlsText(`<IonButton style={{ '--color': 'var(--app-color-users)' }} />`)).toHaveLength(1);
    // Flaechen und Signalfarben zaehlen nicht:
    expect(bereichsfarbenAlsText(`<div style={{ background: 'var(--app-color-events)', color: 'var(--app-color-danger)' }} />`)).toHaveLength(0);
    // Datenfelder ausserhalb von style={{}} zaehlen nicht (OnboardingTour legt sie auf einen weissen Knopf):
    expect(bereichsfarbenAlsText(`const SLIDES = [{ color: 'var(--app-color-konfis)' }];`)).toHaveLength(0);
  });
});

describe('Dunkelmodus: Grautoene lesbar -- hell wie dunkel (Baustein 3)', () => {
  // GEMESSEN am 26.09.2026: Dunkelmodus-Audit BF-05 -- --app-text-muted war
  // dunkel #7c7c82 (fuer den Dunkelblock ABGEDUNKELT statt aufgehellt): auf
  // der gedaempften Flaeche #323234 3,08:1, auf der Karte #242426 3,74:1, 44
  // Stellen in 94 Zustaenden. UI-Audit BF-04 -- hell lagen --app-text-muted
  // #999 (2,85:1), --app-text-system #8e8e93 (3,26:1) und --app-text-tertiary
  // #888 (3,54:1) auf Weiss unter 4,5:1, 119 Stellen. Beide Modi muessen auf
  // Karte UND Seitengrund halten; dunkel zusaetzlich auf der gedaempften
  // Flaeche (Stempel-Kacheln, Platzhalter), auf der 22 der 44 Stellen lagen.
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const GRAU = ['--app-text-secondary', '--app-text-tertiary', '--app-text-muted', '--app-text-system'];

  it('hell: mindestens 4,5:1 auf Karte, weichem und gedaempftem Grund und dem Ionic-Seitengrund', () => {
    const schwach: string[] = [];
    for (const name of GRAU) {
      const t = helleTokens.get(name)!;
      for (const [grundName, grund] of [['Karte', helleTokens.get('--app-surface-card')!], ['soft', helleTokens.get('--app-surface-soft')!], ['muted', helleTokens.get('--app-surface-muted')!], ['Seitengrund', '#f4f5f8']]) {
        const k = kontrast(t, grund);
        if (k < 4.5) schwach.push(`${name} ${t} auf ${grundName} ${grund}: ${k.toFixed(2)}`);
      }
    }
    expect(schwach).toEqual([]);
  });

  it('dunkel: mindestens 4,5:1 auf Karte, gedaempfter Flaeche, Kopfzeile der Matrix und beiden Seitengruenden', () => {
    const schwach: string[] = [];
    for (const name of GRAU) {
      const t = dunkel.get(name)!;
      for (const [grundName, grund] of [['Karte', dunkel.get('--app-surface-card')!], ['muted', dunkel.get('--app-surface-muted')!], ['gedaempft', dunkel.get('--app-flaeche-gedaempft')!], ['iOS-Grund', '#000000'], ['Android-Grund', '#121212']]) {
        const k = kontrast(t, grund);
        if (k < 4.5) schwach.push(`${name} ${t} auf ${grundName} ${grund}: ${k.toFixed(2)}`);
      }
    }
    expect(schwach).toEqual([]);
  });

  it('das -rgb-Tripel von --app-text-system passt hell wie dunkel zum Hexwert', () => {
    expect(helleTokens.get('--app-text-system-rgb')).toBe(hexZuRgb(helleTokens.get('--app-text-system')!).join(', '));
    expect(dunkel.get('--app-text-system-rgb')).toBe(hexZuRgb(dunkel.get('--app-text-system')!).join(', '));
  });
});

describe('Dunkelmodus: Eck-Marken -- weisse Schrift auf Datenfarbe (Paket K2)', () => {
  // GEMESSEN am 26.09.2026 (Nachmessung nach den Bausteinen 1-3, 94
  // Zustaende dunkel, iOS = Android): Die kleinen Pillen (.app-corner-badge,
  // `color: white`) tragen ihre Flaechenfarbe inline aus den Daten --
  // Kategorie-, Level- oder Bereichsfarbe, in beiden Modi dieselbe. Weiss
  // darauf: "20P" auf #f59e0b 2,15:1, "0P" auf #10b981 2,54, "+1P" auf
  // #0a84ff 3,65, "5P"/"+3P" auf #3b82f6 3,68, "+2P" auf #059669 3,77, "10P"
  // auf #8b5cf6 4,23 -- acht Stellen. Eine Regel kann eine Inline-Farbe nicht
  // ersetzen, wohl aber ueberlagern: Im Dunkeln liegt eine flache schwarze
  // Schicht als background-image auf jeder Marke. Hell bleibt die Marke, wie
  // sie ist (UI-Audit BF-04, Eck-Marken, offen).
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const DATENFARBEN: Record<string, string> = {
    '#10b981': 'Level "Novize" 0P',
    '#3b82f6': 'Level "Lehrling" 5P, Bonus "+3P"',
    '#8b5cf6': 'Level "Gehilfe" 10P',
    '#f59e0b': 'Level "Experte" 20P',
    '#059669': 'Aktivitaet "+2P"',
    '#0a84ff': 'Aktivitaet "+1P"',
  };
  const markeHell = regeln(hell).filter((r) => r.selektor === '.app-corner-badge');
  const markeDunkel = regeln(dunkelBloecke[0] ?? '').filter((r) => r.selektor === '.app-corner-badge');
  /** Deckkraft der schwarzen Schicht im Dunkeln -- 0, wenn es keine gibt. */
  function deckkraft(): number {
    const m = /background-image:\s*linear-gradient\(\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)\s*,\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)\s*\)/.exec(markeDunkel.map((r) => r.rumpf).join('\n'));
    return m && m[1] === m[2] ? +m[1] : 0;
  }
  const unterSchicht = (farbe: string) => mische('#000000', deckkraft(), farbe);

  it('die Marke schreibt weiss -- das ist die Paarung, gegen die gerechnet wird', () => {
    expect(markeHell).toHaveLength(1);
    expect(markeHell[0].rumpf).toMatch(/color:\s*white/);
  });

  it('dunkel liegt eine flache schwarze Schicht darauf: ein Verlauf mit zwei gleichen Stops', () => {
    expect(deckkraft()).toBeGreaterThan(0);
  });

  it('Weiss haelt unter der Schicht auf jeder Datenfarbe der Messung mindestens 4,5:1 -- ohne Schicht keine', () => {
    const schwach: string[] = [];
    const bestandOhne: string[] = [];
    for (const [farbe, wo] of Object.entries(DATENFARBEN)) {
      const k = kontrast('#ffffff', unterSchicht(farbe));
      if (k < 4.5) schwach.push(`${wo}: Weiss auf ${farbe} unter der Schicht (${unterSchicht(farbe)}) ${k.toFixed(2)}`);
      // Gegenprobe der Messung: jede dieser Farben fiel OHNE Schicht durch.
      if (kontrast('#ffffff', farbe) >= 4.5) bestandOhne.push(`${wo}: ${farbe} bestand schon ohne Schicht`);
    }
    expect(schwach).toEqual([]);
    expect(bestandOhne).toEqual([]);
  });

  it('... und auf jeder Klassenfarbe der Marken (.app-corner-badge--*), mit ihrem dunklen Wert', () => {
    const varianten = [...hell.matchAll(/\.app-corner-badge--([a-z-]+)\s*\{\s*background-color:\s*var\((--app-color-[a-z-]+)\)/g)];
    expect(varianten.length).toBeGreaterThanOrEqual(15);
    const schwach: string[] = [];
    for (const [, variante, token] of varianten) {
      const farbe = dunkel.get(token) ?? helleTokens.get(token);
      expect(farbe, `${token} ohne Wert`).toMatch(/^#[0-9a-f]{6}$/i);
      const k = kontrast('#ffffff', unterSchicht(farbe!));
      if (k < 4.5) schwach.push(`--${variante} (${token} ${farbe}): ${k.toFixed(2)}`);
    }
    expect(schwach).toEqual([]);
  });
});

describe('Dunkelmodus: Kriterienfarbe als Text im Abzeichen-Ring (Paket K2, Audit BF-10)', () => {
  // GEMESSEN am 26.09.2026 (Nachmessung, /konfi/badges, iOS = Android): Die
  // Prozentzahl im Fortschrittsring der Abzeichen ("0%") schrieb mit der
  // Kriterienfarbe aus utils/badgeCriteria.ts -- rohe Hexwerte, in beiden
  // Modi gleich. Auf der dunklen Karte #242426: streak #eb445a 4,06:1
  // (gemessen); gerechnet event_count #e63946 3,72, both_categories #5856d6
  // 2,74, mandatory_event_count #b91c1c 2,39, teamer_year #5b21b6 1,72. Wie
  // bei den Bereichsfarben gibt es je Kriterium ein Text-Token: hell die
  // Kriterienfarbe selbst (im Hellen aendert sich nichts), dunkel eine
  // aufgehellte Stufe mit mindestens 4,5:1 auf Karte und beiden
  // Seitengruenden. Ring und Symbolkachel behalten die Kriterienfarbe als
  // Flaeche.
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const TYPEN = Object.keys(CRITERIA_COLORS);
  function tokenName(typ: string): string {
    const m = /^var\((--app-text-kriterium-[a-z-]+)\)$/.exec(getCriteriaTextColor(typ));
    expect(m, `${typ} -> ${getCriteriaTextColor(typ)}`).not.toBeNull();
    return m![1];
  }

  it('der Rueckfall fuer unbekannte Typen ist das Standard-Token', () => {
    expect(getCriteriaTextColor('gibt-es-nicht')).toBe('var(--app-text-kriterium-standard)');
  });

  it('dunkel liest sich jedes Token auf Karte und beiden Seitengruenden: mindestens 4,5:1', () => {
    const schwach: string[] = [];
    for (const typ of [...TYPEN, 'gibt-es-nicht']) {
      const t = tokenName(typ);
      const d = dunkel.get(t);
      if (!d) { schwach.push(`${t}: kein dunkler Wert`); continue; }
      for (const [grundName, grund] of [['Karte', dunkel.get('--app-surface-card')!], ['iOS-Grund', '#000000'], ['Android-Grund', '#121212']]) {
        const k = kontrast(d, grund);
        if (k < 4.5) schwach.push(`${t} ${d} auf ${grundName} ${grund}: ${k.toFixed(2)}`);
      }
    }
    expect(schwach).toEqual([]);
  });

  it('die Prozentzahl im Ring schreibt mit dem Text-Token', () => {
    const code = lies('src/components/konfi/views/BadgesView.tsx');
    expect(code).toMatch(/color:\s*getCriteriaTextColor\(category\.key\)/);
    expect(code).not.toMatch(/\bcolor:\s*category\.color\b/);
  });
});

describe('Dunkelmodus: gerenderte Messung als wiederholbarer Test (Baustein 4, Audit BF-09)', () => {
  // Die Tests in dieser Datei lesen das Stylesheet als Text. Was im Browser
  // daraus wird -- Spezifitaet gegen das Theme, Flaechen im Shadow-DOM,
  // gemischte Schichten -- misst scripts/dunkelmodus-messen.mjs in einem
  // echten Chromium: 47 Seitenzustaende x hell/dunkel x iOS/Android, gegen
  // die Restliste in scripts/dunkelmodus-restliste.json, Exit 1 bei einem
  // Verstoss ausserhalb der Liste (Audit BF-09: 104 Verstoesse bei gruenen
  // Tests). Es braucht einen laufenden Stack und laeuft deshalb nicht in der
  // CI; hier steht, was ohne Stack pruefbar ist: Die Restliste ist
  // wohlgeformt und begruendet, das Skript misst, was es verspricht.
  const restliste = JSON.parse(lies('scripts/dunkelmodus-restliste.json')) as { eintraege: Record<string, string>[] };
  const skript = lies('scripts/dunkelmodus-messen.mjs');
  const MERKMALE = ['scheme', 'platform', 'seite', 'vorder', 'hinter', 'text', 'pfad'];

  it('jeder Eintrag der Restliste nennt einen Grund und mindestens ein Merkmal, an dem er greift', () => {
    expect(restliste.eintraege.length).toBeGreaterThan(0);
    for (const e of restliste.eintraege) {
      expect(typeof e.grund, JSON.stringify(e)).toBe('string');
      expect(e.grund.length, e.grund).toBeGreaterThan(60);
      expect(MERKMALE.filter((k) => k in e).length, `Eintrag ohne Merkmal: ${e.grund.slice(0, 60)}`).toBeGreaterThan(0);
      expect(Object.keys(e).filter((k) => k !== 'grund' && !MERKMALE.includes(k)), e.grund.slice(0, 60)).toEqual([]);
    }
  });

  it('jedes /RegExp/-Feld kompiliert, jeder feste Farbwert ist ein kleingeschriebener Hexwert', () => {
    for (const e of restliste.eintraege) {
      for (const k of ['vorder', 'hinter', 'text', 'pfad']) {
        const w = e[k];
        if (w === undefined) continue;
        const m = /^\/(.*)\/([a-z]*)$/s.exec(w);
        if (m) expect(() => new RegExp(m[1], m[2]), `${k}: ${w}`).not.toThrow();
        else expect(w, `${k}: ${w}`).toMatch(k === 'vorder' || k === 'hinter' ? /^#[0-9a-f]{6}$/ : /^\/.*\/[a-z]*$/s);
      }
      if (e.scheme !== undefined) expect(['dark', 'light']).toContain(e.scheme);
      if (e.platform !== undefined) expect(['ios', 'android']).toContain(e.platform);
    }
  });

  it('die eigene Chat-Blase steht in der Restliste: Weiss auf Chat-Tuerkis, in beiden Modi, als Entscheidung', () => {
    const chat = restliste.eintraege.find((e) => e.vorder === '#ffffff' && e.hinter === helleTokens.get('--app-color-chat'));
    expect(chat).toBeDefined();
    expect(chat!.scheme).toBeUndefined(); // gilt hell UND dunkel -- kein Dunkelmodus-Befund
    expect(chat!.grund).toMatch(/Entscheidung/);
  });

  it('kein Eintrag deckt den Dunkelmodus pauschal ab -- ohne Farbe, Text oder Pfad', () => {
    for (const e of restliste.eintraege) {
      if (e.scheme === 'light') continue;
      expect(['vorder', 'hinter', 'text', 'pfad'].some((k) => k in e), e.grund.slice(0, 60)).toBe(true);
    }
  });

  it('das Skript misst die 47 Zustaende des Audits, beide Modi und Plattformen, liest genau diese Restliste und endet mit dem Exit-Code der Auswertung', () => {
    const seiten = /const SEITEN = \{([\s\S]*?)\n\};/.exec(skript);
    expect(seiten).not.toBeNull();
    expect((seiten![1].match(/'\//g) ?? []).length).toBe(47);
    expect(skript).toContain("'dunkelmodus-restliste.json'");
    expect(skript).toMatch(/argWert\('schemes', 'dark,light'\)/);
    expect(skript).toMatch(/argWert\('platforms', 'ios,android'\)/);
    expect(skript).toMatch(/argWert\('out'/);
    expect(skript).toMatch(/process\.exit\(ok \? 0 : 1\)/);
    // Ionics Flaechen im Shadow-DOM und flache Schichten werden eingerechnet -- sonst
    // misst es "Anmelden (0/50)" wieder gegen die Karte (1,36 statt 10,78:1).
    expect(skript).toMatch(/\.button-native, \.item-native/);
    expect(skript).toMatch(/flacheSchicht/);
  });

  it('npm run dunkelmodus:messen zeigt auf das Skript', () => {
    const pkg = JSON.parse(lies('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['dunkelmodus:messen']).toBe('node scripts/dunkelmodus-messen.mjs');
  });
});

/* --- WCAG-Rechnung --------------------------------------------------- */

function hexZuRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function relativeHelligkeit(hex: string): number {
  const [r, g, b] = hexZuRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const [l1, l2] = [relativeHelligkeit(a), relativeHelligkeit(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Farbe `oben` mit Deckkraft `alpha` auf `unten` gelegt -- so rechnet der Browser rgba(). */
function mische(oben: string, alpha: number, unten: string): string {
  const o = hexZuRgb(oben);
  const u = hexZuRgb(unten);
  return '#' + o.map((c, i) => Math.round(c * alpha + u[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

/* --- JSX lesen ------------------------------------------------------- */

/**
 * Alle oeffnenden JSX-Tags `<Name …>` einer Datei samt Attributen -- auch wenn
 * in einem {…}-Ausdruck ein `>` steht (Pfeilfunktion, Vergleich) oder ein
 * String eine Klammer enthaelt.
 */
function jsxOeffnendeTags(code: string, name: string): string[] {
  const raus: string[] = [];
  for (const m of code.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))) {
    let tiefe = 0;
    let anfuehrung: string | null = null;
    for (let i = m.index! + m[0].length; i < code.length; i++) {
      const c = code[i];
      if (anfuehrung) { if (c === anfuehrung && code[i - 1] !== '\\') anfuehrung = null; continue; }
      if (tiefe > 0 && (c === '"' || c === "'" || c === '`')) { anfuehrung = c; continue; }
      if (c === '{') tiefe++;
      else if (c === '}') tiefe--;
      else if (c === '>' && tiefe === 0) { raus.push(code.slice(m.index!, i + 1)); break; }
    }
  }
  return raus;
}
