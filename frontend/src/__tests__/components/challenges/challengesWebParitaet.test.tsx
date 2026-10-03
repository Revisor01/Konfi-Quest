// Web-Fassung und App rechnen dasselbe: Die rote Zahl am Eintrag, das orange
// Feld fuer Wartendes und die Worte der leeren Zustaende der Challenge-Liste
// stehen in der App in ChallengesManageView, in der Web-Fassung in
// utils/challengesWeb.ts bzw. WebChallengesLeitung. Dieser Test rendert die
// App-Liste und haelt beide gegeneinander -- aendert eine Seite die Rechnung
// oder den Wortlaut, faellt er, statt dass die zwei Fassungen still
// auseinanderlaufen (CLAUDE.md: "Liste, Zaehler und Empfaenger lesen dieselbe
// Regel-Stelle").
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import { kugelAmEintrag } from '../../../utils/challengesWeb';
import { wartenAufFreigabe } from '../../../utils/challengeTexte';
import type { AdminChallenge } from '../../../types/challenges';

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 5, type: 'admin', role_name: 'org_admin' } }),
}));

const tag = 24 * 60 * 60 * 1000;
const laufend = (id: number, title: string): AdminChallenge => ({
  id,
  title,
  description: 'd',
  challenge_type: 'frei',
  visibility: 'public',
  audience: 'konfis_und_team',
  moderated: true,
  allowed_media: ['text'],
  allow_multiple: true,
  starts_at: new Date(Date.now() - tag).toISOString(),
  ends_at: new Date(Date.now() + 7 * tag).toISOString(),
  is_draft: false,
} as unknown as AdminChallenge);

afterEach(() => cleanup());

interface Zaehler {
  offeneFreigaben?: Record<number, number>;
  neuigkeiten?: Record<number, number>;
  neueBeitraege?: Record<number, number>;
  neueWartend?: Record<number, number>;
}

const MATRIX: Array<[string, Zaehler]> = [
  ['nur wartende neu', { offeneFreigaben: { 1: 2 }, neuigkeiten: {}, neueBeitraege: { 1: 2 }, neueWartend: { 1: 2 } }],
  ['neue freigegebene und wartende', { offeneFreigaben: { 1: 1 }, neuigkeiten: {}, neueBeitraege: { 1: 5 }, neueWartend: { 1: 1 } }],
  ['ein einzelner neuer Beitrag', { neueBeitraege: { 1: 1 }, neueWartend: {}, offeneFreigaben: {} }],
  ['gesehene wartende: nur das orange Feld', { offeneFreigaben: { 1: 2 }, neuigkeiten: {}, neueBeitraege: {}, neueWartend: {} }],
  ['aelterer Server ohne das Feld: wartend plus neu freigegeben', { offeneFreigaben: { 1: 2 }, neuigkeiten: { 1: 3 } }],
  ['aelterer Server, nur Neuigkeiten', { neuigkeiten: { 1: 4 } }],
  ['nichts', {}],
];

describe('Rote Zahl und orange Feld: App-Liste und Web-Fassung rechnen dasselbe', () => {
  it.each(MATRIX)('%s', (_name, zaehler) => {
    const { container } = render(
      <ChallengesManageView
        challenges={[laufend(1, 'Eine Challenge'), laufend(2, 'Eine andere')]}
        {...zaehler}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    const eintrag = [...container.querySelectorAll('.app-list-item')].find((e) => e.textContent?.includes('Eine Challenge')) as HTMLElement;
    const web = kugelAmEintrag(1, zaehler);

    // Die rote Kugel: gleiche Zahl, gleicher Satz fuer Vorleseprogramme.
    const kugel = eintrag.querySelector('.app-zaehler-kugel');
    expect(kugel?.getAttribute('aria-label') ?? null).toBe(web.anzahl > 0 ? `${web.anzahl} ${web.text}` : null);

    // Das orange Feld: genau dann, wenn Beitraege warten, mit demselben Satz.
    const orange = eintrag.querySelector(`.app-corner-badges [aria-label="${wartenAufFreigabe(web.wartend)}"]`);
    expect(orange !== null).toBe(web.wartend > 0);
  });

  it('die andere Challenge ohne Zahlen bleibt ruhig -- auch in der Rechnung', () => {
    const zaehler = { offeneFreigaben: { 1: 2 }, neueBeitraege: { 1: 2 }, neueWartend: { 1: 2 } };
    const { container } = render(
      <ChallengesManageView
        challenges={[laufend(1, 'Eine Challenge'), laufend(2, 'Eine andere')]}
        {...zaehler}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    const eintrag = [...container.querySelectorAll('.app-list-item')].find((e) => e.textContent?.includes('Eine andere')) as HTMLElement;
    expect(eintrag.querySelector('.app-zaehler-kugel')).toBeNull();
    expect(kugelAmEintrag(2, zaehler)).toEqual({ anzahl: 0, text: 'neue Beiträge', wartend: 0 });
  });
});

describe('Leere Zustaende: dieselben Worte in App und Web-Fassung', () => {
  // Die Web-Fassung (WebChallengesLeitung: LEER) nutzt genau diese Worte.
  const WORTE = {
    aktuell: ['Gerade läuft keine Challenge', 'Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können'],
    geplant: ['Nichts in Planung', 'Entwürfe und Challenges mit einem Startdatum in der Zukunft erscheinen hier'],
    archiv: ['Noch nichts im Archiv', 'Beendete Challenges sammeln sich hier — mit allen Beiträgen zum Nachlesen'],
  };

  const zeigeLeer = () => render(
    <ChallengesManageView challenges={[]} onSelectChallenge={() => {}} onEditChallenge={() => {}} onDeleteChallenge={() => {}} />
  );

  it('Aktuell', () => {
    zeigeLeer();
    for (const wort of WORTE.aktuell) expect(screen.getByText(wort)).toBeInTheDocument();
  });

  it('Geplant', () => {
    const { container } = zeigeLeer();
    fireEvent.click(screen.getByText('Geplant', { selector: '.app-stats-row__label, .app-stats-row__label *' }));
    expect(container.textContent).toContain(WORTE.geplant[0]);
    expect(container.textContent).toContain(WORTE.geplant[1]);
  });

  it('Archiv', () => {
    const { container } = zeigeLeer();
    fireEvent.click(screen.getByText('Archiv', { selector: '.app-stats-row__label, .app-stats-row__label *' }));
    expect(container.textContent).toContain(WORTE.archiv[0]);
    expect(container.textContent).toContain(WORTE.archiv[1]);
  });
});
