import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Der Gemeinde-Umschalter gehoert NICHT in eine Detailansicht.
 *
 * SIMON AM GERAET (26.09.2026): "In Events Details kein org switcher zeigen."
 * und "Material sub Seiten auch weg damit."
 *
 * WARUM: Eine Detailansicht zeigt EINEN Gegenstand -- einen Termin, ein
 * Material -- und der gehoert zu genau einer Gemeinde. Ein Wechsel fuehrt
 * dort ins Leere: Den Termin gibt es in der anderen Gemeinde nicht. Die
 * Listen behalten den Umschalter, dort ist er richtig.
 *
 * AppKopfzeile hat `gemeindeUmschalter = true` als Standard (bewusst: die
 * meisten Seiten sind Listen). Eine Detailansicht muss ihn deshalb selbst
 * abschalten -- und genau das prueft dieser Test, Kopfzeile fuer Kopfzeile.
 */

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle <AppKopfzeile ...>-Aufrufe einer Datei, je als Text. */
function kopfzeilen(quelle: string): string[] {
  const raus: string[] = [];
  const muster = /<AppKopfzeile(?![a-zA-Z])/g;
  let treffer: RegExpExecArray | null;
  while ((treffer = muster.exec(quelle)) !== null) {
    // Bis zum schliessenden > des Tags -- Verschachtelung in Props (etwa
    // rechts={<IonButton ...>}) mitzaehlen, sonst endet das Tag zu frueh.
    let tiefe = 0;
    let i = treffer.index;
    for (; i < quelle.length; i++) {
      const z = quelle[i];
      if (z === '{') tiefe++;
      else if (z === '}') tiefe--;
      else if (z === '>' && tiefe === 0) break;
    }
    raus.push(quelle.slice(treffer.index, i + 1));
  }
  return raus;
}

// Detailansichten: EIN Gegenstand, EINE Gemeinde.
const DETAILANSICHTEN = [
  'src/components/konfi/views/EventDetailView.tsx',
  'src/components/admin/views/EventDetailView.tsx',
  'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
  'src/components/admin/views/KonfiDetailView.tsx',
];

// Seiten der Leitung, auf denen ein Wechsel nichts zu suchen hat
// (Handbuch 05-rollen.md: Profil gehoert zum Konto, die drei anderen sind
// gemeindeuebergreifend).
const OHNE_WECHSEL = [
  'src/components/admin/pages/AdminProfilePage.tsx',
  'src/components/admin/pages/AdminUsersPage.tsx',
  'src/components/admin/pages/AdminOrganizationsPage.tsx',
  'src/components/admin/pages/AdminMetricsPage.tsx',
];

describe('Gemeinde-Umschalter: nicht in Detailansichten (26.09.2026)', () => {
  it.each(DETAILANSICHTEN)('%s schaltet ihn in JEDER Kopfzeile ab', (datei) => {
    const gefunden = kopfzeilen(lies(datei));
    expect(gefunden.length, `${datei}: keine AppKopfzeile gefunden`).toBeGreaterThan(0);
    for (const kopf of gefunden) {
      // Auch die Zustaende "laedt" und "nicht gefunden" -- sie sind dieselbe
      // Seite und wuerden den Umschalter sonst kurz aufblitzen lassen.
      expect(kopf, `${datei}: eine Kopfzeile ohne gemeindeUmschalter={false}`)
        .toMatch(/gemeindeUmschalter=\{false\}/);
    }
  });

  it.each(OHNE_WECHSEL)('%s schaltet ihn ab (gemeindeuebergreifende Seite)', (datei) => {
    const gefunden = kopfzeilen(lies(datei));
    expect(gefunden.length, `${datei}: keine AppKopfzeile gefunden`).toBeGreaterThan(0);
    for (const kopf of gefunden) {
      expect(kopf, `${datei}: eine Kopfzeile ohne gemeindeUmschalter={false}`)
        .toMatch(/gemeindeUmschalter=\{false\}/);
    }
  });

  it('die Material-Detailansicht im Teamer-Tab schaltet ihn ab, die Liste behaelt ihn', () => {
    // Eine Datei, zwei Ansichten: oben die Detailansicht eines Materials
    // (selectedMaterial), unten die Liste. Nur die Detailansicht gibt ihn ab.
    const quelle = lies('src/components/teamer/pages/TeamerMaterialPage.tsx');
    const gefunden = kopfzeilen(quelle);
    const detail = gefunden.filter((k) => k.includes('selectedMaterial.title'));
    const liste = gefunden.filter((k) => k.includes('titel={MATERIAL_TEAM_TITEL}'));

    expect(detail.length, 'Detail-Kopfzeile nicht gefunden').toBe(1);
    expect(liste.length, 'Listen-Kopfzeile nicht gefunden').toBe(1);
    expect(detail[0]).toMatch(/gemeindeUmschalter=\{false\}/);
    expect(liste[0]).not.toMatch(/gemeindeUmschalter=\{false\}/);
  });

  // SIMON, 28.09.2026: "Gemeinde Umschalter kommt nie in Details."
  //
  // Die Termin-Detailansicht der Teamer:innen lebt -- anders als bei Konfi
  // und Leitung -- inline in TeamerEventsPage (renderDetail), dazu der
  // Hinweis "Nicht deinem Jahrgang zugeordnet" (renderJahrgangHinweis). Bis
  // zum 28.09.2026 stand die GANZE Datei unten unter "die Listen behalten
  // ihn" -- der Waechter verlangte damit, dass auch die Detailansicht den
  // Umschalter traegt (Befund Screens Konfi/Teamer BF-05). Jetzt wie
  // TeamerMaterialPage: Liste behaelt, Detail schaltet ab.
  it('die Termin-Detailansicht im Teamer-Tab schaltet ihn ab, die Liste behaelt ihn', () => {
    const quelle = lies('src/components/teamer/pages/TeamerEventsPage.tsx');
    const gefunden = kopfzeilen(quelle);
    const detail = gefunden.filter((k) => k.includes('titel={selectedEvent.name}'));
    const jahrgangHinweis = gefunden.filter((k) => k.includes('titel="Event"'));
    const liste = gefunden.filter((k) => k.includes('titel={pageTitle}'));

    expect(detail.length, 'Detail-Kopfzeile nicht gefunden').toBe(1);
    expect(jahrgangHinweis.length, 'Kopfzeile des Jahrgang-Hinweises nicht gefunden').toBe(1);
    expect(liste.length, 'Listen-Kopfzeile nicht gefunden').toBe(1);
    // Jede Kopfzeile der Datei ist einer der drei Ansichten zugeordnet --
    // eine vierte faellt auf, statt ungeprueft durchzurutschen.
    expect(gefunden.length).toBe(3);
    expect(detail[0]).toMatch(/gemeindeUmschalter=\{false\}/);
    expect(jahrgangHinweis[0]).toMatch(/gemeindeUmschalter=\{false\}/);
    expect(liste[0]).not.toMatch(/gemeindeUmschalter=\{false\}/);
  });

  // DIE ALLGEMEINE REGEL, ueber alle drei Rollen (28.09.2026): Eine
  // Kopfzeile mit Zurueck-Knopf gehoert zu einer Unter- oder Detailseite --
  // dort gibt es keinen Wechsel. So faellt eine Detailansicht auf, die
  // niemand in die Liste oben eingetragen hat (genau so blieb die
  // Teamer-Terminansicht zwei Tage stehen).
  //
  // Die einzige Ausnahme: die Material-LISTE der Teamer:innen. Laeuft
  // Material nicht als eigener Reiter, fuehrt ein Zurueck zur Startseite --
  // es bleibt aber die Liste der Gemeinde, und die behaelt den Umschalter
  // (Test oben).
  const AUSNAHMEN_MIT_ZURUECK: Array<{ datei: string; merkmal: string }> = [
    { datei: 'src/components/teamer/pages/TeamerMaterialPage.tsx', merkmal: 'titel={MATERIAL_TEAM_TITEL}' },
  ];

  it('jede Kopfzeile mit Zurueck-Knopf schaltet ihn ab (Konfi, Teamer, Leitung)', () => {
    const alleDateien = (verzeichnis: string): string[] =>
      readdirSync(resolve(process.cwd(), verzeichnis), { withFileTypes: true }).flatMap((e) => {
        const pfad = `${verzeichnis}/${e.name}`;
        if (e.isDirectory()) return alleDateien(pfad);
        return pfad.endsWith('.tsx') ? [pfad] : [];
      });

    const verstoesse: string[] = [];
    let geprueft = 0;
    for (const datei of alleDateien('src/components')) {
      if (datei.endsWith('shared/AppKopfzeile.tsx')) continue;
      for (const kopf of kopfzeilen(lies(datei))) {
        if (!/onZurueck=/.test(kopf)) continue;
        if (AUSNAHMEN_MIT_ZURUECK.some((a) => a.datei === datei && kopf.includes(a.merkmal))) continue;
        geprueft++;
        if (!/gemeindeUmschalter=\{false\}/.test(kopf)) {
          verstoesse.push(`${datei}: ${kopf.split('\n')[0]} ${kopf.match(/titel=\S+/)?.[0] ?? ''}`);
        }
      }
    }

    // Stand 28.09.2026: 35 Kopfzeilen mit Zurueck-Knopf. Die Untergrenze
    // stellt sicher, dass die Suche ueberhaupt etwas findet.
    expect(geprueft).toBeGreaterThanOrEqual(30);
    expect(verstoesse).toEqual([]);
  });

  // REITER-SEITEN behalten ihn, Unterseiten nicht -- was eine Reiter-Seite
  // ist, steht in navigation/rollenBaeume.ts (tabs je Rolle).
  //
  // AdminMaterialPage stand hier bis zum 26.09.2026 als "Liste" und musste
  // den Umschalter TRAGEN. Das war falsch: Bei der Leitung ist Material
  // keine Reiter-Seite, sondern eine Unterseite unter "Mehr"
  // (AdminSettingsPage -> /admin/material); die Reiter sind Konfis, Chat,
  // Mitmachen, Challenges und Mehr. Beim Teamer ist Material dagegen sehr
  // wohl ein Reiter ('teamer-material') -- deshalb steht TeamerMaterialPage
  // weiter oben und behaelt ihn fuer die Liste.
  //
  // TeamerEventsPage steht seit dem 28.09.2026 nicht mehr hier, sondern im
  // eigenen Test oben: Die Datei traegt auch die Detailansicht.
  it('die Listen behalten ihn -- dort ist der Wechsel sinnvoll', () => {
    for (const datei of [
      'src/components/konfi/pages/KonfiEventsPage.tsx',
      'src/components/admin/pages/AdminEventsPage.tsx',
    ]) {
      for (const kopf of kopfzeilen(lies(datei))) {
        expect(kopf, `${datei}: eine Liste gibt den Umschalter ab`)
          .not.toMatch(/gemeindeUmschalter=\{false\}/);
      }
    }
  });

  it('die Gegenprobe der Pruefhilfe: sie findet verschachtelte Props', () => {
    // Eine Kopfzeile mit einem Knopf in `rechts` darf nicht vorzeitig enden,
    // sonst laege gemeindeUmschalter ausserhalb des gefundenen Tags.
    const beispiel = `
      <AppKopfzeile
        titel="Test"
        rechts={<IonButton onClick={() => tu({ a: 1 })}>x</IonButton>}
        gemeindeUmschalter={false}
      />`;
    const gefunden = kopfzeilen(beispiel);
    expect(gefunden).toHaveLength(1);
    expect(gefunden[0]).toMatch(/gemeindeUmschalter=\{false\}/);
  });
});
