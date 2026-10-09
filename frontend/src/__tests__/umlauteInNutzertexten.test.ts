import { describe, it, expect } from 'vitest';
import {
  sichtbareTexteDerApp,
  nutzertexteDesBackendsGesamt,
  type SichtbarerText,
} from './sichtbareTexte';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-11: Ersatzschreibungen in Nutzertexten.
//
// CLAUDE.md: "Umlaute in Nutzertexten sind echte Umlaute." Gefunden wurden
// "Anmeldungen, Aenderungen, Absagen und Erinnerungen" und "... und der
// Rueckblick" -- die Beschreibungen der Android-Mitteilungskanaele, woertlich
// sichtbar unter Einstellungen > Apps > Konfi Quest > Benachrichtigungen --
// und aria-label="Aenderungen speichern", das Vorlesehilfen als
// "A-e-nderungen" sprechen.
//
// Beim Nachmessen fuer diesen Test kamen weitere dazu, die das Audit nicht
// sah, weil es nur nach Wortlisten suchte: die Namen der Badge-Symbole
// ("Gluehbirne", "Heissgetraenk"), die Chat-Reaktion "Gefaellt mir", eine
// Fehlermeldung im Badge-Formular ("Pruefung") und drei Fehlermeldungen des
// Backends ("loeschen", "enthaelt", "ungueltige").
//
// Der Rest (27.09.2026): Die Pruefregeln der Eingaben (express-validator,
// .withMessage) und die Meldungen der Anfragegrenzen in server.js las der
// Parser nicht -- dort standen "groesser", "hoechstens", "enthaelt" und
// fuenfmal "spaeter". Seitdem zaehlen withMessage-Argumente, middleware/,
// server.js und createApp.js mit.
//
// Die aelteren Pruefungen (wrappedTexteUmlaute, umlauteUndZurueckIcon) decken
// nur den Rueckblick ab und arbeiten mit Wortlisten. Dieser Test deckt die
// ganze App und die Nutzertexte des Backends ab und arbeitet mit einer
// REGEL statt einer Liste:
//
//   "ae", "oe", "ue" ist eine Ersatzschreibung, wenn davor ein Konsonant
//   steht oder das Wort damit beginnt (Rueckblick, Aenderung, Oeffnen).
//   Nicht, wenn ein Vokal oder q davorsteht (neue, Feuer, Abenteuer, Quest)
//   und nicht vor "ll" (aktuell, manuell, individuell).
//
// Fuer "ss" statt "ß" gibt es keine solche Regel ("muss", "dass", "Schlüssel"
// sind richtig) -- dort eine Liste der Wortstaemme, die mit ß geschrieben
// werden.
//
// Welche Texte zaehlen, entscheidet sichtbareTexte.ts (Parser statt Regex,
// Kommentare und Bezeichner bleiben frei: 'const ueberschrift' ist richtig).
// ---------------------------------------------------------------------------

/**
 * Woerter, die die Regel faelschlich traefe -- jedes mit Grund. Kurz halten:
 * Eine Ausnahme, die niemand mehr braucht, meldet der letzte Test.
 */
const AUSNAHMEN: Record<string, string> = {
  zuerst: '"zu" + "erst", kein Umlaut',
  Zuerst: '"zu" + "erst", kein Umlaut',
  pmueller: 'Beispiel-Benutzername; Benutzernamen erlauben nur a-z, 0-9, Punkt und Bindestrich (USERNAME_REGEX)',
  true: 'englisches Schluesselwort in einer Fehlermeldung an Entwickler:innen ("als true oder false angeben")',
  sprueche: 'Wert des Parameters type in POST /jahrgaenge/:id/matrix-email ("type muss \'anwesenheit\' oder \'sprueche\' sein") -- so steht er in der Schnittstelle',
};

/** Wortstaemme, die mit ß geschrieben werden, als ss-Schreibung. */
const SS_STATT_SZ = /^(gross|grösse|groess|heiss|weiss|schliess|strasse|gruess|gruss|ausser|gemäss|gemaess|spass|bloss|fuss|massnahm|süss|suess|draussen|reiss|giess|geniess|fliess)/i;

const WORT = /[A-Za-zÄÖÜäöüß]+/g;

/** Die Ersatzschreibungen in einem Text (leer, wenn keine). */
function ersatzschreibungen(text: string): string[] {
  const raus: string[] = [];
  for (const [wort] of text.matchAll(WORT)) {
    if (wort in AUSNAHMEN) continue;
    let verdaechtig = SS_STATT_SZ.test(wort);
    for (const m of wort.matchAll(/ae|oe|ue/gi)) {
      const i = m.index ?? 0;
      const davor = wort[i - 1];
      if (i > 0 && /[aeiouyäöüq]/i.test(davor)) continue;
      if (/^ue$/i.test(m[0]) && /^ll/i.test(wort.slice(i + 2))) continue;
      verdaechtig = true;
    }
    if (verdaechtig) raus.push(wort);
  }
  return raus;
}

function funde(texte: SichtbarerText[]): string[] {
  return texte.flatMap(({ ort, text }) =>
    ersatzschreibungen(text).map((wort) => `${ort}: "${wort}" in „${text.slice(0, 80)}"`));
}

// seiten/: die gemeinsamen Beschreibungen von App und Web (Reiter, Filter, Leertexte), seit 09.10.2026.
const APP = sichtbareTexteDerApp(['components', 'seiten', 'services', 'navigation', 'utils', 'contexts', 'hooks']);
const BACKEND = nutzertexteDesBackendsGesamt();

describe('Die Regel erkennt Ersatzschreibungen', () => {
  // Gegenprobe der Regel selbst: Die Befunde aus dem Bericht MUESSEN
  // anschlagen, die richtig geschriebenen Nachbarn duerfen es nicht.
  it.each([
    ['Anmeldungen, Aenderungen, Absagen und Erinnerungen', ['Aenderungen']],
    ['Punkte, Badges, Level, Challenges und der Rueckblick', ['Rueckblick']],
    ['Aenderungen speichern', ['Aenderungen']],
    ['Heissgetraenk', ['Heissgetraenk']],
    ['Gefaellt mir', ['Gefaellt']],
    ['Fehler beim Loeschen der Ausgabe', ['Loeschen']],
    ['Uebersicht oeffnen', ['Uebersicht', 'oeffnen']],
    ['Fussball und Strasse', ['Fussball', 'Strasse']],
  ])('„%s" -> %j', (text, erwartet) => {
    expect(ersatzschreibungen(text)).toEqual(erwartet);
  });

  it.each([
    'Neue Events und aktuelle Badges',
    'Dein Abenteuer am Lagerfeuer dauert',
    'Konfi Quest',
    'Zuerst die Fehler ansehen',
    'Schlüssel, Kopfhörer, Fußball, Glühbirne',
    'Das muss dass lassen Interesse',
    'individuell, manuell, eventuell',
    'Zuschauer freuen sich über Frauen',
  ])('„%s" ist richtig geschrieben', (text) => {
    expect(ersatzschreibungen(text)).toEqual([]);
  });
});

describe('Umlaute in Nutzertexten', () => {
  it('findet die Texte ueberhaupt', () => {
    // Ohne diese Zusicherung waere ein falscher Pfad nach einem Umbau ein
    // gruener Test, der nichts geprueft hat. Gemessen 27.09.2026: 5 283
    // Texte in der App, 1 450 im Backend. Nachgemessen am selben Tag, als die
    // Pruefregeln (withMessage), middleware/ und server.js dazukamen:
    // 5 517 in der App, im Backend 1 470 -> 1 733.
    expect(APP.length).toBeGreaterThan(4000);
    expect(BACKEND.length).toBeGreaterThan(1000);
  });

  it('die App zeigt keine Ersatzschreibung', () => {
    expect(funde(APP)).toEqual([]);
  });

  it('das Backend schickt keine Ersatzschreibung', () => {
    expect(funde(BACKEND)).toEqual([]);
  });

  it('jede Ausnahme wird noch gebraucht', () => {
    // Eine Ausnahme, deren Wort nirgends mehr steht, deckt beim naechsten
    // Mal einen echten Fehler zu. Dann raus damit.
    const alleTexte = [...APP, ...BACKEND].map((t) => t.text).join(' ');
    const ungenutzt = Object.keys(AUSNAHMEN)
      .filter((wort) => !new RegExp(`(^|[^A-Za-zÄÖÜäöüß])${wort}([^A-Za-zÄÖÜäöüß]|$)`).test(alleTexte));
    expect(ungenutzt).toEqual([]);
  });
});
