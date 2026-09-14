import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Abstand zwischen Listeneintraegen in den "Konto-Einstellungen" (14.09.2026).
//
// DER FEHLER: "App sperren" hing in der Leitungs-Ansicht ohne Abstand am
// Eintrag darueber. Der Grund liegt in zwei Bauformen, die in derselben Liste
// nebeneinander stehen:
//
//   A) ein direktes <div className="app-list-item">
//   B) ein <IonItem>, das INNEN ein <div className="app-list-item"> traegt
//
// Bei A kommt der Abstand aus `.app-list-item { margin-bottom }` und faellt
// beim letzten Eintrag per :last-child weg. Bei B ist das innere div IMMER
// :last-child seines IonItem -- es hat also nie einen Abstand, und der muss
// vom IonItem selbst kommen. Solange das ein handgesetzter Inline-Style war,
// fehlte er genau dann, wenn jemand hinter dem bis dahin letzten IonItem noch
// einen Eintrag anhaengte. Genau das geschah mit "App sperren" hinter
// "Medien-Cache leeren".
//
// SEITDEM traegt der Wrapper die Klasse `app-list-wrapper`, die den Abstand an
// dieselbe Bedingung haengt wie Bauform A: an die Stellung in der Liste, nicht
// an das Gedaechtnis der schreibenden Person. Diese Tests halten das fest --
// nicht den CSS-Wert, sondern die Bauform.

const lies = (pfad: string) => readFileSync(resolve(__dirname, '../../..', pfad), 'utf-8');

const profilSeiten: { rolle: string; datei: string }[] = [
  { rolle: 'Leitung', datei: 'src/components/admin/pages/AdminProfilePage.tsx' },
  { rolle: 'Teamer:innen', datei: 'src/components/teamer/pages/TeamerProfilePage.tsx' },
  { rolle: 'Konfis', datei: 'src/components/konfi/views/ProfileView.tsx' },
];

/**
 * Schneidet den Bereich heraus, in dem der Schalter steht: vom oeffnenden
 * Flex-Container der "Konto-Einstellungen" bis zum <AppSperreSchalter/>.
 * Das ist genau die Geschwisterfolge, in der der Abstand entsteht.
 */
function listeBisZumSchalter(quelle: string): string {
  const ende = quelle.indexOf('<AppSperreSchalter');
  expect(ende, 'AppSperreSchalter steht nicht in der Datei').toBeGreaterThan(-1);
  const anfang = quelle.lastIndexOf("flexDirection: 'column'", ende);
  expect(anfang, 'kein Flex-Container vor dem Schalter gefunden').toBeGreaterThan(-1);
  return quelle.slice(anfang, ende);
}

describe('Listen-Abstaende in den Konto-Einstellungen', () => {
  for (const { rolle, datei } of profilSeiten) {
    const quelle = lies(datei);
    const liste = listeBisZumSchalter(quelle);

    it(`${rolle}: kein Eintrag vor "App sperren" setzt seinen Abstand von Hand`, () => {
      // DAS ist der Fehler von Build 189: ein Eintrag, dessen Abstand nach
      // unten an einem Inline-Style haengt, verliert ihn stillschweigend,
      // sobald jemand die Reihenfolge aendert oder hinten anbaut.
      const vonHand = [...liste.matchAll(/marginBottom:\s*'var\(--app-abstand-[a-z]+\)'/g)];
      expect(vonHand.map((m) => m[0])).toEqual([]);
    });

    it(`${rolle}: jedes IonItem vor "App sperren" traegt app-list-wrapper`, () => {
      // Bauform B ohne diese Klasse hat keinen Abstand nach unten -- das
      // innere div kann ihn nicht liefern, es ist dort immer :last-child.
      // Der Vergleich laeuft ueber die Zahl: ein Attribut-genaues Zerlegen
      // des Tags scheitert an Pfeilfunktionen im onClick ("() =>").
      const ionItems = [...liste.matchAll(/<IonItem\b/g)].length;
      const wrapper = [...liste.matchAll(/className="app-list-wrapper"/g)].length;
      expect(wrapper).toBe(ionItems);
    });
  }

  it('die Leitungs-Ansicht hat genau die vier Wrapper vor dem Schalter', () => {
    // Gegenprobe gegen einen leeren Treffer: Der Test oben waere auch dann
    // gruen, wenn gar kein IonItem mehr in der Liste stuende.
    const liste = listeBisZumSchalter(lies('src/components/admin/pages/AdminProfilePage.tsx'));
    expect([...liste.matchAll(/className="app-list-wrapper"/g)]).toHaveLength(4);
  });

  it('die Teamer-Ansicht hat genau die fuenf Wrapper vor dem Schalter', () => {
    const liste = listeBisZumSchalter(lies('src/components/teamer/pages/TeamerProfilePage.tsx'));
    expect([...liste.matchAll(/className="app-list-wrapper"/g)]).toHaveLength(5);
  });

  it('die Konfi-Ansicht kommt ohne Wrapper aus -- dort ist alles Bauform A', () => {
    const liste = listeBisZumSchalter(lies('src/components/konfi/views/ProfileView.tsx'));
    expect([...liste.matchAll(/<IonItem\b/g)]).toHaveLength(0);
    // ... und sie hat sehr wohl Eintraege, sonst waere die Zeile darueber
    // wertlos.
    expect(
      [...liste.matchAll(/className="app-list-item app-list-item--purple"/g)].length
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('Der Wrapper liefert den Abstand nach Stellung, nicht nach Hand', () => {
  const css = lies('src/theme/variables.css');

  it('app-list-wrapper traegt den Listen-Abstand', () => {
    expect(css).toMatch(
      /ion-item\.app-list-wrapper\s*\{[^}]*margin-bottom:\s*var\(--app-abstand-eng\);/
    );
  });

  it('und laesst ihn beim letzten Eintrag weg -- wie .app-list-item auch', () => {
    expect(css).toMatch(/ion-item\.app-list-wrapper:last-child\s*\{\s*margin-bottom:\s*0;/);
  });

  it('app-item-transparent bleibt ohne Abstand', () => {
    // Die Klasse dient anderswo auch Formularfeldern (z.B. der
    // Einladungs-Seite). Bekaeme sie den Listen-Abstand, verschoebe sich
    // dort etwas, das mit Listen nichts zu tun hat.
    const block = css.match(/ion-item\.app-item-transparent\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0]).not.toContain('margin-bottom');
  });

  it('der Schalter selbst setzt keinen eigenen Abstand', () => {
    // Er ist eine geteilte Komponente und steht in drei verschiedenen
    // Listen. Einen Abstand mitzubringen hiesse, ihn auch dort zu haben,
    // wo er als letzter Eintrag steht.
    const schalter = lies('src/components/shared/AppSperreSchalter.tsx');
    expect(schalter).not.toContain('marginBottom');
    expect(schalter).not.toContain('marginTop');
  });
});
