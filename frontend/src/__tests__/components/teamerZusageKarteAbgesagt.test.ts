// "BIST DU DABEI?" AN EINEM ABGESAGTEN ODER VERGANGENEN TERMIN
// (17.09.2026, Simons Befund)
//
// WOERTLICH: "Außerdem steht in abgesagten Elementen noch die Card mit
// [Bist du dabei] aber ohne Button. Ganze Card muss raus."
//
// ZWEI FEHLER AN DERSELBEN STELLE (TeamerEventsPage, renderDetail):
//
// 1. LEERE KARTE. Der Zweig fuer vergangene Termine endete mit `) : null` --
//    wer nicht angemeldet war, sah die Ueberschrift "Bist du dabei?" ueber
//    einer voellig leeren weissen Karte. Kein Knopf, kein Text, kein Icon.
//    Abgesagte Termine trifft das besonders oft: Die Absage hebt alle
//    Anmeldungen auf (hebeAbsageAbmeldungenAuf), und seit dem 16.09.2026
//    bleiben abgesagte Termine an ihrem Datum stehen statt zu verschwinden.
//
// 2. DIE TEAMER-SEITE KANNTE `cancelled` UEBERHAUPT NICHT. Ein grep nach
//    "cancelled" fand in der ganzen Datei keinen Treffer; istAbgesagt() war
//    nur fuer Farbe und Status-Label im Einsatz, nie als Riegel. An einem
//    abgesagten, aber noch nicht vergangenen Termin standen die
//    Zusage-Knoepfe deshalb weiter da und luden zur Anmeldung ein. Das
//    Backend lehnt das seit dem 16.09.2026 ab (bucheTermin, "ABGESAGT
//    SCHLAEGT ALLES") -- die Oberflaeche bot es trotzdem an.
//
//    Der Commit, der genau diesen Riegel in die Oberflaeche gebracht hat
//    (6111c141), fasste nur admin/ und konfi/ an. Die Teamer-Seite fiel
//    durchs Raster.
//
// SO IST ES JETZT -- gleich in allen drei Rollen, wie von Simon gefordert
// ("so wie es bei allen ist gleich machen"):
//   abgesagt  -> Hinweis "Dieser Termin ist abgesagt", keine Knoepfe
//   vergangen und nicht dabei gewesen -> gar keine Karte
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const quelle = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const TEAMER = 'src/components/teamer/pages/TeamerEventsPage.tsx';
const KONFI = 'src/components/konfi/views/EventDetailView.tsx';
const ADMIN = 'src/components/admin/views/EventDetailView.tsx';

describe('Die Teamer-Seite kennt abgesagte Termine', () => {
  it('sie prueft istAbgesagt vor der Zusage-Karte, nicht nur fuer die Farbe', () => {
    const code = quelle(TEAMER);
    // Vor dem Fix gab es genau vier istAbgesagt-Vorkommen: Import, Farbe,
    // Status-Label und Ausgrauung in der Liste -- keines davor.
    expect(code).toContain('zusageKarteInhalt');
  });

  it('der Hinweis haengt WIRKLICH an istAbgesagt, nicht nur irgendwo im Code', () => {
    // GEGENPROBE-HAERTUNG (17.09.2026): Ein blosses toContain auf den
    // Hinweistext war zu schwach -- es blieb gruen, als die Bedingung
    // testweise durch `false` ersetzt wurde. Geprueft wird deshalb der
    // Ausdruck selbst: Der Inhalt der Karte muss an istAbgesagt(selectedEvent)
    // haengen.
    const code = quelle(TEAMER);
    expect(code).toMatch(
      /const\s+zusageKarteInhalt\s*=\s*istAbgesagt\(selectedEvent\)\s*\?/
    );
  });

  it('zeigt an einem abgesagten Termin den Hinweis statt der Knoepfe', () => {
    const code = quelle(TEAMER);
    // Der Hinweis muss im ERSTEN Zweig stehen, also direkt hinter der
    // istAbgesagt-Bedingung -- nicht irgendwo weiter unten.
    const bedingung = code.search(/const\s+zusageKarteInhalt\s*=\s*istAbgesagt\(selectedEvent\)\s*\?/);
    const hinweis = code.indexOf('Dieser Termin ist abgesagt');
    expect(bedingung).toBeGreaterThan(-1);
    expect(hinweis).toBeGreaterThan(bedingung);
    // Zwischen Bedingung und Hinweis darf KEIN WEITERER ZWEIG liegen -- der
    // Hinweis muss im ersten stehen.
    //
    // Geprueft wird das an der Sache, nicht an der Zeichenzahl (17.09.2026):
    // Hier stand ein Abstand von unter 1500 Zeichen, und schon ein laengerer
    // Begruendungskommentar liess den Test fallen, obwohl die Struktur
    // stimmte. Kommentare duerfen wachsen; ein zweiter Fragezeichen-Operator
    // darf nicht dazwischenrutschen.
    // Ab HINTER dem Fragezeichen der Bedingung schneiden -- sonst zaehlt
    // man ihr eigenes mit.
    const nachFrage = code.indexOf('?', bedingung) + 1;
    const dazwischen = code.slice(nachFrage, hinweis).replace(/\/\/[^\n]*/g, '');
    expect(dazwischen).not.toContain('?');
  });

  it('bietet dort KEINE Zusage mehr an', () => {
    // Der entscheidende Punkt: Der Abgesagt-Zweig muss VOR den
    // ZusageKnoepfen stehen, sonst laedt die Seite weiter zur Anmeldung an
    // einem Termin ein, den das Backend ablehnt.
    const code = quelle(TEAMER);
    const abgesagtStelle = code.indexOf('Dieser Termin ist abgesagt');
    const ersteKnoepfe = code.indexOf('<ZusageKnoepfe');
    expect(abgesagtStelle).toBeGreaterThan(-1);
    expect(ersteKnoepfe).toBeGreaterThan(-1);
    expect(abgesagtStelle).toBeLessThan(ersteKnoepfe);
  });
});

describe('Keine leere Karte mehr', () => {
  it('der null-Ausgang raeumt jetzt die ganze Karte weg, nicht nur den Inhalt', () => {
    // Frueher endete der Vergangenheits-Zweig mit `) : null` INNERHALB der
    // Karte -- die Ueberschrift "Bist du dabei?" blieb ueber einem leeren
    // weissen Rahmen stehen. Die Unterscheidung "war ich dabei?" gehoert
    // weiterhin in den Zweig; entscheidend ist, dass ein null-Ergebnis jetzt
    // VOR dem Rendern der Karte abgefangen wird.
    const code = quelle(TEAMER);
    expect(code).toContain('if (!zusageKarteInhalt) return null;');
  });

  it('die ganze Karte haengt an der Inhaltspruefung, nicht nur ihr Inhalt', () => {
    // Die Ueberschrift darf erst NACH dem Riegel kommen -- sonst stuende sie
    // wieder ueber einem leeren Rahmen.
    const code = quelle(TEAMER);
    const riegel = code.indexOf('if (!zusageKarteInhalt) return null;');
    const ueberschrift = code.indexOf('<IonLabel>Bist du dabei?</IonLabel>');
    expect(riegel).toBeGreaterThan(-1);
    expect(ueberschrift).toBeGreaterThan(-1);
    expect(riegel).toBeLessThan(ueberschrift);
  });
});

describe('Alle drei Rollen sagen dasselbe', () => {
  it('jede Ansicht nennt den abgesagten Termin beim Namen', () => {
    // Konfi und Leitung konnten es seit dem 16.09.2026, die Teamer-Seite
    // erst jetzt. Faellt dieser Test, ist eine Rolle wieder ausgeschert.
    for (const datei of [TEAMER, KONFI, ADMIN]) {
      const code = quelle(datei);
      expect(code, `${datei} kennt abgesagte Termine nicht`).toMatch(/istAbgesagt/);
    }
  });

  it('Konfi und Teamer zeigen denselben Wortlaut', () => {
    expect(quelle(KONFI)).toContain('Dieser Termin ist abgesagt');
    expect(quelle(TEAMER)).toContain('Dieser Termin ist abgesagt');
  });
});
