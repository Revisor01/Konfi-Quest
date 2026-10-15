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

  it('die Raster-Klasse steht genau einmal im CSS', () => {
    const css = lies('src/theme/variables.css');
    // Die Kachel-Klasse gibt es genau einmal -- eine zweite Definition waere
    // der Anfang des naechsten Auseinanderlaufens.
    expect(css.match(/^\.app-kachelraster \{/gm)?.length).toBe(1);
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

  it('markiert ein noch nicht verdientes Abzeichen als gesperrt', () => {
    const { container } = render(
      <KachelRaster eintraege={[
        { schluessel: 1, icon: 'a', name: 'Offen', farbe: '#ff0000', verdient: false },
      ]} />
    );
    expect(container.querySelectorAll('.app-kachel--gesperrt').length).toBe(1);
  });

  it('markiert einen Stempel NICHT als gesperrt', () => {
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
