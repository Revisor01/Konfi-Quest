import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Regel vom 05.09.2026, woertlich:
//
//   "wenn ich noch nichts gesagt habe, beide knoepfe einer rot einer gruen
//    in line. wenn ich dann gruen gewaehlt habe, dann machst du doch nur
//    einen button. und zwar einen roten ich bin doch nicht dabei und
//    andersrum auch ich bin doch dabei. und mach bitte die buttons immer als
//    line buttons. nie vollfarbe ... und immer immer immer nur line buttons."
//
// Also:
//   noch nichts gewaehlt -> zwei Knoepfe: "Dabei" (gruen) / "Nicht dabei" (rot)
//   zugesagt             -> EIN Knopf, rot:   "Nicht mehr dabei"
//   abgesagt             -> EIN Knopf, gruen: "Doch dabei"
//
// Vorher standen die Knoepfe VIERMAL im JSX (Kontingent frei, Warteliste
// offen, kein Platz mehr, bereits angemeldet) und liefen auseinander: Im
// Warteliste-Zweig und bei "kein Platz mehr frei" fehlte der Absage-Knopf
// ganz, nach einer Absage verschwand er ebenfalls. Genau dort ist eine klare
// Absage aber am wertvollsten -- die Leitung will wissen, wer nachruecken
// wuerde. Jetzt gibt es eine Komponente fuer alle vier Faelle.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const seite = lies('src/components/teamer/pages/TeamerEventsPage.tsx');

/** Der Rumpf der ZusageKnoepfe-Komponente. */
const komponente = seite.slice(
  seite.indexOf('const ZusageKnoepfe'),
  seite.indexOf('  // Status-Infos für Event-Karten'),
);

describe('Teamer: Zusage- und Absage-Knoepfe', () => {
  it('stehen an EINER Stelle, nicht je Zweig kopiert', () => {
    expect(seite).toContain('const ZusageKnoepfe');
    // Alle vier Faelle rufen dieselbe Komponente auf.
    const aufrufe = [...seite.matchAll(/<ZusageKnoepfe\b/g)];
    expect(aufrufe.length).toBe(4);
  });

  it('sind IMMER Outline-Knoepfe, nie vollfarbig', () => {
    // Simons Regel: "immer immer immer nur line buttons".
    const fills = [...komponente.matchAll(/fill="([^"]*)"/g)].map(m => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every(f => f === 'outline')).toBe(true);
    // Kein bedingtes Umschalten auf solid.
    expect(komponente).not.toContain("'solid'");
  });

  it('zeigen beide Knoepfe, solange nichts gewaehlt ist', () => {
    const offen = komponente.slice(komponente.indexOf('// Noch nichts gesagt'));
    expect(offen).toContain('{zusageKnopf}');
    expect(offen).toContain('{absageKnopf}');
  });

  it('zeigen nach einer Zusage nur noch die Absage', () => {
    expect(komponente).toContain('if (zugesagt) return');
    const zeile = komponente.split('\n').find(z => z.includes('if (zugesagt) return')) || '';
    expect(zeile).toContain('{absageKnopf}');
    expect(zeile).not.toContain('{zusageKnopf}');
  });

  it('zeigen nach einer Absage nur noch die Zusage', () => {
    expect(komponente).toContain('if (abgesagt) return');
    const zeile = komponente.split('\n').find(z => z.includes('if (abgesagt) return')) || '';
    expect(zeile).toContain('{zusageKnopf}');
    expect(zeile).not.toContain('{absageKnopf}');
  });

  it('beschriften den Gegenknopf als "Doch dabei" bzw. "Nicht mehr dabei"', () => {
    expect(komponente).toContain("abgesagt ? 'Doch dabei'");
    expect(komponente).toContain("zugesagt ? 'Nicht mehr dabei' : 'Nicht dabei'");
  });

  it('faerben Zusage gruen und Absage rot', () => {
    const zusage = komponente.slice(komponente.indexOf('const zusageKnopf'), komponente.indexOf('const absageKnopf'));
    const absage = komponente.slice(komponente.indexOf('const absageKnopf'));
    expect(zusage).toContain('color="success"');
    expect(absage).toContain('color="danger"');
  });

  it('erlauben eine Absage auch dann, wenn kein Platz mehr frei ist', () => {
    // Der Absage-Knopf haengt NICHT an zusageMoeglich -- nur die Zusage tut
    // das. Vorher stand bei vollem Kontingent nur "Kein Platz mehr frei" da.
    expect(seite).toContain('zusageMoeglich={false}');
    const absage = komponente.slice(komponente.indexOf('const absageKnopf'));
    const disabled = absage.slice(absage.indexOf('disabled={'), absage.indexOf('disabled={') + 80);
    expect(disabled).not.toContain('zusageMoeglich');
  });

  it('sperren die Zusage offline, die Absage nicht', () => {
    // Absagen laeuft ueber die Warteschlange, Buchen braucht das Netz
    // (Befund H2, 27.08.2026).
    const zusage = komponente.slice(komponente.indexOf('const zusageKnopf'), komponente.indexOf('const absageKnopf'));
    expect(zusage).toContain('!isOnline');
  });
});

describe('Eck-Zeichen der eigenen Absage', () => {
  it('zeigt ein Symbol statt des langen Textes', () => {
    // "Abgesagt von dir" fehlte in der Zuordnung, deshalb fiel das Badge auf
    // die Text-Variante zurueck, waehrend jeder andere Zustand ein Symbol
    // zeigt (Simon, 05.09.2026).
    const badge = lies('src/components/shared/StatusBadge.tsx');
    expect(badge).toContain("'Abgesagt von dir': closeCircle");
  });
});
