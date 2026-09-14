import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import KachelRaster from '../../components/shared/KachelRaster';

// Simon, 14.09.2026: "bei den Stempeln in der Konfi-Profil- und
// Teamer-Profil-Ansicht des Admins [haben wir] eine huebsche Ansicht, aber
// irgendwie machen wir die gleiche Ansicht bei den Badges nicht. Die Badges
// sollten genauso aussehen wie bei den Konfis, also drei nebeneinander und
// dann auf die Breite gezogen. Auch da waere es dann ja einfach, dass wir nur
// einen CSS haben." Nachtrag: "Und die Stempel bei den Konfis sollten auch
// drei nebeneinander sein und den gleichen Look haben." Und: "Konfi und
// Teamer und Admin unter Challenges, da sollten wir dann auch das gleiche
// Grid nutzen."
//
// Geprueft wird die STRUKTUR, nicht einzelne CSS-Werte: dass alle Stellen
// dasselbe Raster nutzen und keine eigenen Inline-Raster mehr aufmachen.
// Genau daran ist es vorher auseinandergelaufen -- acht Inline-Raster, davon
// eins mit VIER Spalten und zwei gar ohne Raster.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle Ansichten, die Abzeichen oder Stempel als Kacheln zeigen. */
const KACHEL_ANSICHTEN: Array<[string, string]> = [
  ['Stempel-Abschnitt (Konfi-Profil, Teamer-Profil, Leitungs-Detailansicht)',
    'src/components/shared/ChallengeStempelSektion.tsx'],
  ['Abzeichen-Uebersicht (Konfi- und Teamer-Badges-Seite)',
    'src/components/konfi/views/BadgesView.tsx'],
  ['Abzeichen in der Detailansicht der Leitung (Konfi UND Teamer:in)',
    'src/components/admin/views/KonfiBadgesSection.tsx'],
  ['Konfi-Abzeichen in der Teamer-Statistik',
    'src/components/teamer/pages/TeamerKonfiStatsPage.tsx'],
  ['Stempel unter Challenges (Konfi-Sicht)',
    'src/components/konfi/views/ChallengesView.tsx'],
  ['Stempel unter Challenges (Teamer- und Leitungs-Sicht)',
    'src/components/admin/views/ChallengesManageView.tsx'],
];

describe('Kachelraster: eine Loesung fuer Abzeichen und Stempel', () => {
  it.each(KACHEL_ANSICHTEN)('%s nutzt das gemeinsame Raster', (_name, pfad) => {
    const quelle = lies(pfad);
    // Entweder direkt das Raster -- oder der gemeinsame Stempel-Abschnitt,
    // der es seinerseits nutzt. Seit dem 14.09.2026 gilt Letzteres fuer die
    // Konfi-Sicht unter Challenges: sie baute das Raster vorher ein zweites
    // Mal selbst auf und haette den Stempel-Popover und die grauen Kacheln
    // erneut nachziehen muessen. Die Absicht des Tests bleibt dieselbe --
    // niemand macht sein eigenes Raster auf.
    expect(
      quelle.includes('<KachelRaster') || quelle.includes('<ChallengeStempelSektion'),
      `weder <KachelRaster noch <ChallengeStempelSektion in ${pfad}`
    ).toBe(true);
  });

  it('der gemeinsame Stempel-Abschnitt landet wirklich beim Raster', () => {
    // GEGENPROBE zur gelockerten Zeile darueber: der Umweg ueber den
    // Abschnitt darf kein Schlupfloch sein.
    expect(lies('src/components/shared/ChallengeStempelSektion.tsx'))
      .toContain('<KachelRaster');
  });

  it.each(KACHEL_ANSICHTEN)('%s macht kein eigenes Raster mehr auf', (_name, pfad) => {
    const quelle = lies(pfad);
    // Kein eigenes Spalten-Raster per Inline-Style. Genau das war der Fehler:
    // die Detailansicht der Leitung stand auf VIER Spalten, waehrend alles
    // andere drei zeigte.
    expect(quelle).not.toMatch(/gridTemplateColumns:\s*'repeat\(\d/);
  });

  it('die Stempel unter Challenges scrollen nicht mehr seitlich weg', () => {
    // Vorher eine Flex-Reihe mit overflowX:auto und fester Kachelbreite --
    // dieselben Stempel sahen dadurch anders aus als im Profil.
    for (const pfad of [
      'src/components/konfi/views/ChallengesView.tsx',
      'src/components/admin/views/ChallengesManageView.tsx',
    ]) {
      expect(lies(pfad)).not.toContain("minWidth: '74px', maxWidth: '92px'");
    }
  });

  it('das Aussehen steht genau einmal im CSS', () => {
    const css = lies('src/theme/variables.css');
    expect(css).toContain('.app-kachelraster {');
    expect(css).toContain('grid-template-columns: repeat(3, 1fr);');
    // Die Kachel-Klasse gibt es genau einmal -- eine zweite Definition waere
    // der Anfang des naechsten Auseinanderlaufens.
    expect(css.match(/^\.app-kachelraster \{/gm)?.length).toBe(1);
  });

  it('das Raster kommt ohne color-mix aus', () => {
    // Die App laeuft ab Android minSdk 24; auf alten System-WebViews faellt
    // color-mix ersatzlos aus und die Kachel waere durchsichtig statt
    // getoent. Die Farben werden deshalb als fertige Werte uebergeben.
    const css = lies('src/theme/variables.css');
    const block = css.slice(css.indexOf('.app-kachelraster {'));
    expect(block).not.toContain('color-mix(');
  });
});

describe('Kachelraster: Namen brechen nicht mitten im Wort, Kacheln bleiben gleich hoch', () => {
  // Simon, 14.09.2026 am Geraet (Build 191): "Wenn einer der Titel umbricht
  // bei den Badges, dann wird die ganze Zeile hoeher. Und 'Punktemeiste-r'
  // wird vor dem r umgebrochen. Das geht nicht."
  //
  // Nachgemessen (14.09.2026, Browser, 390px Viewport): fuer den Namen
  // bleiben je nach Verschachtelung 70-91 px. "Punktemeister" ist 81 px
  // breit, das laengste tatsaechlich vergebene Einzelwort
  // "Gottesdienstbesucher" 124 px (125 verschiedene Namen aus der
  // Produktion, laengster Name 29 Zeichen).
  //
  // Die Ursache war NICHT eine falsche Umbruchstelle, sondern eine fehlende:
  // ohne overflow-wrap bricht ein zu breites Wort gar nicht um, laeuft aus
  // der Kachel heraus und die Kuerzung schneidet es mitten im Wort ab.
  // Gemessen: scrollWidth 81 px in einer 78 px breiten Box, Namensbereich
  // 13,4 px statt 26,9 px.
  const css = lies('src/theme/variables.css');
  /** Block ohne Kommentare -- sonst trifft eine Suche die Begruendung statt
   *  der Regel (genau darueber ist dieser Test beim Schreiben gestolpert). */
  const ohneKommentare = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');
  const nameBlock = (() => {
    const start = css.indexOf('.app-kachel__name {');
    expect(start, '.app-kachel__name fehlt').toBeGreaterThan(-1);
    return ohneKommentare(css.slice(start, css.indexOf('}', start)));
  })();
  const rasterBlock = (() => {
    const start = css.indexOf('.app-kachelraster {');
    return ohneKommentare(css.slice(start, css.indexOf('}', start)));
  })();

  it('zerlegt ein langes Wort NICHT mitten drin', () => {
    // KORRIGIERTE ERWARTUNG (14.09.2026, nachgemessen statt aufgeweicht):
    // Dieser Test verlangte zuvor `overflow-wrap: break-word`. Die Regel
    // beseitigt zwar den Ueberlauf, bricht das Wort aber per Definition
    // MITTEN DRIN -- am Geraet gemeldet und im Browser bestaetigt:
    // "Punktemeister" wurde zu "Punktemeiste" / "r",
    // "Gemeinde-Unterstuetzer" zu "Gemeinde-" / "Unterstuetze" / "r".
    // Die Erwartung war also selbst falsch und wird umgedreht, nicht
    // gelockert: gekuerzt wird gemessen in useKachelName, mit "…".
    expect(nameBlock).toContain('overflow-wrap: normal;');
    expect(nameBlock).not.toContain('overflow-wrap: break-word');
    expect(nameBlock).not.toContain('word-break: break-word');
  });

  it('setzt keine Silbentrennung, die je nach Geraet anders bricht', () => {
    // Nachgemessen: hyphens:auto bricht "Gottesdienstb-esucher" -- derselbe
    // harte Schnitt wie overflow-wrap, nur unzuverlaessig obendrein. Die
    // Seite steht auf lang="en", und auf Android-WebViews ist das deutsche
    // Woerterbuch nicht garantiert.
    expect(nameBlock).not.toContain('hyphens:');
    expect(nameBlock).not.toContain('hyphens :');
  });

  it('bricht an keiner Stelle innerhalb eines Wortes', () => {
    // anywhere/break-all trennen mitten im Wort -- genau das, was der
    // gemeldete Fehler ist.
    expect(nameBlock).not.toContain('overflow-wrap: anywhere');
    expect(nameBlock).not.toContain('word-break: break-all');
    expect(nameBlock).toContain('word-break: normal;');
  });

  it('haelt fuer den Namen immer zwei Zeilen frei', () => {
    // Sonst sitzt der Fortschritt in der Nachbarkachel eine Zeile hoeher.
    // Gemessen: 26,9 px bei line-height 1.2 -- ein- wie zweizeilig.
    expect(nameBlock).toContain('min-height: calc(2 * 1.2em);');
    // Die Zeilenhoehe, auf die sich die Rechnung stuetzt.
    expect(nameBlock).toContain('line-height: 1.2;');
    // Mehr als zwei Zeilen darf der Name weiterhin nicht bekommen.
    expect(nameBlock).toContain('-webkit-line-clamp: 2;');
  });

  it('gibt allen Kacheln einer Reihe dieselbe Hoehe', () => {
    // Ohne das richtet sich die Grid-Zeile am hoechsten Kind aus und eine
    // zweizeilige Beschriftung zieht die Nachbarn mit in die Hoehe.
    expect(rasterBlock).toContain('grid-auto-rows: 1fr;');
  });
});

describe('Kachelraster: die inhaltlichen Unterschiede bleiben', () => {
  const STEMPEL = [
    { schluessel: 1, icon: 'star', name: 'Nachtwanderer', farbe: 'var(--app-color-challenges)' },
  ];

  it('zeichnet drei Kacheln als drei Kacheln', () => {
    const { container } = render(
      <KachelRaster eintraege={[
        { schluessel: 1, icon: 'a', name: 'Eins', farbe: '#ff0000' },
        { schluessel: 2, icon: 'b', name: 'Zwei', farbe: '#ff0000' },
        { schluessel: 3, icon: 'c', name: 'Drei', farbe: '#ff0000' },
      ]} />
    );
    expect(container.querySelectorAll('.app-kachel').length).toBe(3);
    expect(container.querySelectorAll('.app-kachelraster').length).toBe(1);
  });

  it('graut ein noch nicht verdientes Abzeichen aus', () => {
    const { container } = render(
      <KachelRaster eintraege={[
        { schluessel: 1, icon: 'a', name: 'Offen', farbe: '#ff0000', verdient: false },
      ]} />
    );
    expect(container.querySelectorAll('.app-kachel--gesperrt').length).toBe(1);
  });

  it('laesst einen Stempel NICHT ausgegraut aussehen', () => {
    // Stempel gibt es nur verdient; ohne ausdrueckliche Angabe muss die
    // Kachel deshalb als verdient gelten.
    const { container } = render(<KachelRaster eintraege={STEMPEL} />);
    expect(container.querySelectorAll('.app-kachel--gesperrt').length).toBe(0);
  });

  it('zeigt den Fortschritt eines angefangenen Abzeichens', () => {
    const { container } = render(
      <KachelRaster eintraege={[
        { schluessel: 1, icon: 'a', name: 'Halb', farbe: '#ff0000', verdient: false, fortschritt: 42 },
      ]} />
    );
    expect(container.querySelector('.app-kachel__fortschritt')?.textContent).toBe('42%');
  });

  it('zeigt bei einem Stempel keinen Fortschritt', () => {
    const { container } = render(<KachelRaster eintraege={STEMPEL} />);
    expect(container.querySelectorAll('.app-kachel__fortschritt').length).toBe(0);
  });

  it('meldet den angeklickten Eintrag zurueck (Abzeichen-Popover)', () => {
    const gesehen: React.Key[] = [];
    const { container } = render(
      <KachelRaster
        eintraege={[
          { schluessel: 7, icon: 'a', name: 'Sieben', farbe: '#ff0000' },
          { schluessel: 9, icon: 'b', name: 'Neun', farbe: '#ff0000' },
        ]}
        onKachelClick={(s) => gesehen.push(s)}
      />
    );
    const kacheln = container.querySelectorAll('.app-kachel');
    (kacheln[1] as HTMLElement).click();
    expect(gesehen).toEqual([9]);
  });

  it('macht Kacheln ohne Klick-Handler nicht anklickbar', () => {
    const { container } = render(<KachelRaster eintraege={STEMPEL} />);
    expect(container.querySelectorAll('.app-kachel--klickbar').length).toBe(0);
  });

  it('bleibt ohne Eintraege ganz weg', () => {
    const { container } = render(<KachelRaster eintraege={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('traegt den Zusatzinhalt mit (Eselsohr, Verleihdatum)', () => {
    const { container } = render(
      <KachelRaster eintraege={[
        { schluessel: 1, icon: 'a', name: 'Geheim', farbe: '#ff0000', zusatz: <span data-testid="zusatz">14. Sep</span> },
      ]} />
    );
    expect(container.querySelector('[data-testid="zusatz"]')?.textContent).toBe('14. Sep');
  });
});

describe('Punkte-Uebersicht: Titel brechen nicht zu frueh um', () => {
  // Simon, 14.09.2026: "In der Ansicht als Konfi, Deine Punkteuebersicht ...
  // Die Titel brechen viel zu frueh um und brauchen dann zwei oder drei oder
  // vier Zeilen. In den anderen Listen gehen die viel weiter rueber. Die
  // absolute Breite ist falsch eingestellt."
  //
  // Gemessen (14.09.2026, Browser): das Punkte-Badge ist 48,0-55,5 px breit,
  // mit Typ-Badge 74,0-81,5 px. Freigehalten waren 70 bzw. 120 px.
  const modal = lies('src/components/konfi/modals/PointsHistoryModal.tsx');

  it('haelt keinen geschaetzten Freiraum mehr frei', () => {
    expect(modal).not.toContain('var(--app-freiraum-aktion-xxxl)');
    expect(modal).not.toContain("paddingRight: typeBadgeColor");
  });

  it('nutzt die gemeinsamen Klassen statt eines Inline-Abstands', () => {
    expect(modal).toContain('app-list-item__title--punkte-badge-doppelt');
    expect(modal).toContain('app-list-item__title--punkte-badge');
  });

  it('haelt fuer beide Faelle genug, aber nicht zu viel Platz frei', () => {
    const css = lies('src/theme/variables.css');
    const wert = (klasse: string) => {
      const treffer = css.match(new RegExp(`\\.${klasse} \\{\\s*padding-right: (\\d+)px;`));
      expect(treffer, `Klasse fehlt: ${klasse}`).not.toBeNull();
      return Number(treffer![1]);
    };
    const einzeln = wert('app-list-item__title--punkte-badge');
    const doppelt = wert('app-list-item__title--punkte-badge-doppelt');

    // Breiter als das breiteste gemessene Badge (55,5 bzw. 81,5 px) -- sonst
    // verschwindet der Titel darunter.
    expect(einzeln).toBeGreaterThan(56);
    expect(doppelt).toBeGreaterThan(82);
    // Aber deutlich schmaler als vorher (70 bzw. 120 px), sonst bricht der
    // Titel weiterhin zu frueh um.
    expect(einzeln).toBeLessThan(70);
    expect(doppelt).toBeLessThan(120);
  });
});
