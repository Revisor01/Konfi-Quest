// KEIN ANMELDE-KNOPF AN EINEM ABGESAGTEN TERMIN (16.09.2026)
//
// Simons Befund, live am Geraet reproduziert:
//   "Ich habe [Termin] Pflicht-Nachruecken abgemeldet. Also als Konfi. Habe
//    mich selbst abgemeldet. Dann wurde das Event abgesagt. 'Wieder anmelden'
//    steht jetzt aber immer noch da, obwohl es abgesagt ist."
//
// Und auf die Rueckfrage zur Leitung: "Nein, gar nicht." Auch sie traegt an
// einem abgesagten Termin niemanden mehr ein.
//
// Das Backend lehnt beides inzwischen ab (tests/routes/
// anmeldungAnAbgesagtemTermin.test.js). Dieser Test haelt die ANDERE Haelfte
// fest: Die Knoepfe duerfen erst gar nicht dastehen. Ein Knopf, der
// verlaesslich in einen roten Fehler laeuft, ist kein Knopf.
//
// GEPRUEFT WIRD DIE QUELLE, nicht das gerenderte Bild: Beide Ansichten
// haengen an Ionic, Router, Kontexten und Netzwerk-Hooks: ein Render-Test
// braeuchte mehr Attrappe als Aussage. Dieselbe Entscheidung wie in
// abgesagteTermineAnsichten.test.ts, und mit derselben Absicherung.
//
// WICHTIG -- DER TEST DARF NICHT AM KOMMENTAR ANSCHLAGEN: Im Repo ist
// mehrfach passiert, dass eine Pruefung auf eine Zeichenkette ansprang, die
// nur in einem Kommentar stand. Deshalb wird jede Datei vor der Pruefung von
// Kommentaren befreit. Die Gegenprobe dazu steht ganz unten.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const code = (pfad: string) => ohneKommentare(lies(pfad));

const KONFI_DETAIL = 'src/components/konfi/views/EventDetailView.tsx';
const LEITUNG_DETAIL = 'src/components/admin/views/EventDetailView.tsx';

describe('Konfi-Detailansicht: kein Anmelde-Knopf am abgesagten Termin', () => {
  const quelle = code(KONFI_DETAIL);

  it('prueft die Absage ueber istAbgesagt(), nicht ueber eventData.cancelled von Hand', () => {
    // istAbgesagt() prueft BEIDE Felder (cancelled und registration_status),
    // weil die Listen- und die Detail-Route verschiedene liefern. Wer hier
    // von Hand `eventData.cancelled` liest, uebersieht die halbe Wirklichkeit.
    expect(quelle).toContain('istAbgesagt(eventData)');
    expect(quelle).not.toMatch(/eventData\.cancelled/);
  });

  /**
   * Der Pflicht-Zweig, und nur er. Von `const isOptedOut` bis zum Ende des
   * `mandatory`-Ausdrucks.
   *
   * Der Ausschnitt ist noetig, weil `if (istAbgesagt(eventData))` weiter oben
   * auch in den Farb- und Beschriftungs-Helfern steht. Ein indexOf ueber die
   * ganze Datei fand die — und lieferte eine kleine Zahl, mit der jeder
   * Reihenfolge-Vergleich durchging, auch nachdem der echte Zweig entfernt
   * war. Genau daran ist die erste Fassung dieses Tests in der Gegenprobe
   * NICHT gefallen.
   */
  const pflichtZweig = (() => {
    const start = quelle.indexOf('const isOptedOut =');
    expect(start).toBeGreaterThan(0);
    // Ende am Abschluss des mandatory-Ausdrucks. NICHT an 'Pflicht-Event':
    // die Zeichenkette steht schon im Vergangenheits-Zweig ("Pflicht-Event
    // (vergangen)") und schnitte den Ausschnitt vor isOptedOut ab.
    const ende = quelle.indexOf('})()', start);
    expect(ende).toBeGreaterThan(start);
    return quelle.slice(start, ende);
  })();

  it('der Pflicht-Zweig faengt die Absage ab, BEVOR "Wieder anmelden" erscheint', () => {
    // Genau Simons Fall: abgemeldet + abgesagt. Der Absage-Zweig muss vor dem
    // isOptedOut-Zweig stehen, sonst gewinnt weiterhin "Wieder anmelden".
    const absageZweig = pflichtZweig.indexOf('if (istAbgesagt(eventData))');
    const optedOutZweig = pflichtZweig.indexOf('if (isOptedOut)');
    expect(absageZweig).toBeGreaterThan(-1);
    expect(optedOutZweig).toBeGreaterThan(-1);
    expect(absageZweig).toBeLessThan(optedOutZweig);
    // Und "Wieder anmelden" steht wirklich noch dahinter — sonst prueft der
    // Vergleich oben eine Reihenfolge ohne Gegenstand.
    expect(pflichtZweig.indexOf('Wieder anmelden')).toBeGreaterThan(absageZweig);
  });

  it('der Absage-Zweig steht auch vor dem Vergangenheits-Zweig', () => {
    // Abgesagt schlaegt alles — egal, in welchem Zustand die eigene Buchung
    // ist und ob der Termin schon vorbei waere.
    const absageZweig = pflichtZweig.indexOf('if (istAbgesagt(eventData))');
    const vergangenZweig = pflichtZweig.indexOf('if (isPastEvent)');
    expect(absageZweig).toBeGreaterThan(-1);
    expect(vergangenZweig).toBeGreaterThan(-1);
    expect(absageZweig).toBeLessThan(vergangenZweig);
  });

  it('der freiwillige Zweig faengt die Absage vor allen Anmelde-Knoepfen ab', () => {
    // "Anmelden" und "Warteliste offen" haengen an can_register /
    // registration_status. Der Absage-Zweig muss davor greifen.
    const absageZweig = quelle.indexOf('istAbgesagt(eventData) ? (');
    const anmeldeZweig = quelle.indexOf('eventData.can_register');
    expect(absageZweig).toBeGreaterThan(0);
    expect(anmeldeZweig).toBeGreaterThan(0);
    expect(absageZweig).toBeLessThan(anmeldeZweig);
  });

  it('das ABMELDEN bleibt unangetastet', () => {
    // Der Riegel sperrt das Anmelden, nicht das Gegenteil. Wer weg will,
    // kommt weg — auch am abgesagten Termin.
    expect(quelle).toContain('handleOptOut');
    expect(quelle).toContain('handleUnregister');
    // Und keiner der beiden Wege haengt an istAbgesagt.
    expect(quelle).not.toMatch(/istAbgesagt\([^)]*\)\s*&&[^\n]*handleOptOut/);
    expect(quelle).not.toMatch(/istAbgesagt\([^)]*\)\s*&&[^\n]*handleUnregister/);
  });
});

describe('Leitungs-Detailansicht: kein "hinzufuegen" am abgesagten Termin', () => {
  const quelle = code(LEITUNG_DETAIL);

  it('kennt eine eigene Bedingung fuers Eintragen, die an istAbgesagt haengt', () => {
    expect(quelle).toContain('const darfEintragen = !istAbgesagt(eventData)');
  });

  it('JEDER "hinzufuegen"-Knopf steht hinter darfEintragen', () => {
    // Die Knoepfe liegen in vier Bloecken (noch niemand angemeldet, Konfi-
    // Liste, Team-Liste, Konfi-Nachzuegler). Wird einer vergessen, bleibt
    // genau dort der tote Knopf stehen — deshalb wird gezaehlt, nicht
    // stichprobenhaft geschaut.
    // Nur die Personen-Knoepfe, nicht "Notiz hinzufügen" im Aktionsmenue.
    const knopfZeilen = quelle.split('\n').filter(z =>
      /\b(Konfi|Team|Leitung) hinzufügen/.test(z)
    );
    // Sieben Beschriftungen in vier Bloecken: leerer Termin (Konfi, Team,
    // Leitung), Konfi-Liste (Konfi), Team-Liste (Team, Leitung) und der
    // Konfi-Nachzuegler-Block (Konfi).
    expect(knopfZeilen.length).toBe(7);
    // Und ebenso viele Stellen, an denen die Bedingung greift: die drei
    // Wrapper plus der vorzeitige Ausstieg im leeren Block.
    const wachen = quelle.split('darfEintragen').length - 1;
    // 1x Definition + 4x Verwendung.
    expect(wachen).toBe(5);
  });

  it('die Modale zum Eintragen werden nirgends ohne die Wache geoeffnet', () => {
    // presentKonfiModal / presentTeamerModal / presentLeitungModal sind die
    // einzigen Wege ins Eintragen. Jeder onClick darauf muss in einem Block
    // liegen, den darfEintragen schuetzt — geprueft ueber die Reihenfolge:
    // die Definition steht vor jeder Verwendung.
    const definition = quelle.indexOf('const darfEintragen');
    expect(definition).toBeGreaterThan(-1);
    for (const modal of ['presentKonfiModal(', 'presentTeamerModal(', 'presentLeitungModal(']) {
      const ersteVerwendung = quelle.indexOf(`() => ${modal}`);
      expect(ersteVerwendung).toBeGreaterThan(definition);
    }
  });

  it('das Entfernen von Teilnehmenden bleibt unangetastet', () => {
    // Gegenstueck zum Abmelden auf der Konfi-Seite: Die Leitung muss auch am
    // abgesagten Termin noch aufraeumen koennen.
    expect(quelle).not.toMatch(/darfEintragen[^\n]*bookings\//);
  });
});

describe('Gegenprobe: ein Vorkommen im Kommentar zaehlt nicht', () => {
  it('ohneKommentare entfernt JSX-, Block- und Zeilenkommentare', () => {
    const attrappe = [
      '{/* darfEintragen stand hier mal im Kommentar */}',
      '/* istAbgesagt(eventData) nur als Kommentar */',
      '// Konfi hinzufügen -- auch nur ein Kommentar',
      'const echt = true;',
    ].join('\n');
    const bereinigt = ohneKommentare(attrappe);
    expect(bereinigt).not.toContain('darfEintragen');
    expect(bereinigt).not.toContain('istAbgesagt');
    expect(bereinigt).not.toContain('hinzufügen');
    expect(bereinigt).toContain('const echt = true;');
  });
});
