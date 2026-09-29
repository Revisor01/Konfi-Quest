import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import { ICON_UHRZEIT } from '../../../components/shared/icons';
import type { AdminChallenge } from '../../../types/challenges';

// Die Zeichen am Challenge-Eintrag von Leitung und Team (Simon, 29.09.2026,
// nach zwei falschen Umsetzungen ausdruecklich bestaetigt):
//
//   "bei jeden Beitrag. Wie im Chat bei jeder Nachricht. Und zusaetzlich
//    Orangen bei Freigaben."
//
// - Am Symbol genau EIN Kreis, rot, mit Zahl, baugleich zum Chat
//   (ZaehlerKugel ohne Sonderform). Er zaehlt jeden neuen Beitrag seit dem
//   letzten Oeffnen, auch wartende (badge-counts.challengeNeueBeitraege).
// - Bereits gesehene wartende Beitraege stehen NICHT rot, nur orange.
// - Orange nur fuer Wartendes: das Eck-Badge mit Zahl und Uhr.
// - Fehlt das Feld (aelterer Server), gilt die Rechnung vom 28.09.2026:
//   wartend + neu freigegeben.

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

const zeige = (z: Zaehler) => render(
  <ChallengesManageView
    challenges={[laufend(1, 'Ein Wort, das dich begleitet'), laufend(2, 'Ruhige Challenge')]}
    {...z}
    onSelectChallenge={() => {}}
    onEditChallenge={() => {}}
    onDeleteChallenge={() => {}}
  />
);

const eintrag = (container: HTMLElement, titel: string) =>
  [...container.querySelectorAll('.app-list-item')].find((e) => e.textContent?.includes(titel)) as HTMLElement;

const EINS = 'Ein Wort, das dich begleitet';

describe('Rote Kugel = neue Beitraege seit dem letzten Oeffnen, wartende eingeschlossen', () => {
  it('nur wartende neu: Kugel zeigt ihre Zahl, das Eck-Badge dieselben orange', () => {
    const { container } = zeige({
      offeneFreigaben: { 1: 2 }, neuigkeiten: {}, neueBeitraege: { 1: 2 }, neueWartend: { 1: 2 }
    });
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('2');
    expect(kugeln[0].getAttribute('aria-label')).toBe('2 neue Beiträge, davon warten 2 auf Freigabe');
    expect(eintrag(container, EINS).querySelector('.app-zaehler-anker .app-zaehler-kugel')).toBe(kugeln[0]);
    const orange = eintrag(container, EINS).querySelector('.app-corner-badges [aria-label="2 Beiträge warten auf Freigabe"]');
    expect(orange?.textContent).toBe('2');
  });

  it('bereits gesehene wartende: KEINE rote Kugel, nur das orange Feld', () => {
    const { container } = zeige({
      offeneFreigaben: { 1: 3 }, neuigkeiten: {}, neueBeitraege: {}, neueWartend: {}
    });
    expect(container.querySelectorAll('.app-zaehler-kugel').length).toBe(0);
    const orange = eintrag(container, EINS).querySelector('.app-corner-badges [aria-label="3 Beiträge warten auf Freigabe"]');
    expect(orange?.textContent).toBe('3');
  });

  it('drei warten, einer davon neu, dazu ein neuer freigegebener: Kugel 2, nicht 3 + 1', () => {
    const { container } = zeige({
      offeneFreigaben: { 1: 3 }, neuigkeiten: { 1: 1 }, neueBeitraege: { 1: 2 }, neueWartend: { 1: 1 }
    });
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('2');
    expect(kugeln[0].getAttribute('aria-label')).toBe('2 neue Beiträge, davon wartet 1 auf Freigabe');
  });

  it('Vorlesetext in der Einzahl', () => {
    const nurFrei = zeige({ neueBeitraege: { 1: 1 }, neueWartend: {} });
    expect(nurFrei.container.querySelector('.app-zaehler-kugel')?.getAttribute('aria-label')).toBe('1 neuer Beitrag');
    cleanup();
    const nurWartend = zeige({ offeneFreigaben: { 1: 1 }, neueBeitraege: { 1: 1 }, neueWartend: { 1: 1 } });
    expect(nurWartend.container.querySelector('.app-zaehler-kugel')?.getAttribute('aria-label')).toBe('1 neuer Beitrag, wartet auf Freigabe');
  });

  it('nach dem Oeffnen (Eintrag entfernt) ist die Kugel weg, das orange Feld bleibt', () => {
    const { container, rerender } = zeige({
      offeneFreigaben: { 1: 1 }, neueBeitraege: { 1: 1 }, neueWartend: { 1: 1 }
    });
    expect(container.querySelectorAll('.app-zaehler-kugel').length).toBe(1);
    rerender(
      <ChallengesManageView
        challenges={[laufend(1, EINS), laufend(2, 'Ruhige Challenge')]}
        offeneFreigaben={{ 1: 1 }}
        neueBeitraege={{}}
        neueWartend={{}}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    expect(container.querySelectorAll('.app-zaehler-kugel').length).toBe(0);
    expect(eintrag(container, EINS).querySelector('.app-corner-badges [aria-label="1 Beitrag wartet auf Freigabe"]')?.textContent).toBe('1');
  });
});

describe('Am Symbol nur ein Kreis, rot, ohne Sonderform', () => {
  it('der Anker traegt Symbolkreis und genau eine Kugel -- kein oranger Kreis', () => {
    const { container } = zeige({
      offeneFreigaben: { 1: 2 }, neueBeitraege: { 1: 1 }, neueWartend: { 1: 1 }
    });
    const anker = eintrag(container, EINS).querySelector('.app-zaehler-anker') as HTMLElement;
    const kinder = [...anker.children];
    expect(kinder.map((k) => k.className)).toEqual(['app-icon-circle app-icon-circle--lg', 'app-zaehler-kugel']);
    // Baugleich zum Chat: dieselbe Klasse, kein Modifikator, kein Inline-Stil.
    const kugel = kinder[1] as HTMLElement;
    expect(kugel.tagName).toBe('SPAN');
    expect(kugel.getAttribute('style')).toBeNull();
    // Nichts Oranges am Symbol: weder die Segment-Zahl noch eine Warnfarbe.
    expect(anker.querySelector('.app-segment-zahl')).toBeNull();
    expect(anker.innerHTML).not.toContain('--app-color-warning');
  });

  it('auch nur mit wartenden (gesehen) kein oranger Kreis am Symbol', () => {
    const { container } = zeige({ offeneFreigaben: { 1: 2 }, neueBeitraege: {}, neueWartend: {} });
    const anker = eintrag(container, EINS).querySelector('.app-zaehler-anker') as HTMLElement;
    expect([...anker.children].map((k) => k.className)).toEqual(['app-icon-circle app-icon-circle--lg']);
  });
});

describe('Orange Eck-Badge: Zahl und Uhr', () => {
  it('traegt die Zahl der wartenden und das Uhr-Symbol', () => {
    const { container } = zeige({ offeneFreigaben: { 1: 4 }, neueBeitraege: {}, neueWartend: {} });
    const orange = eintrag(container, EINS).querySelector('.app-corner-badges [aria-label="4 Beiträge warten auf Freigabe"]') as HTMLElement;
    expect(orange.className).toBe('app-corner-badge');
    expect(orange.style.backgroundColor).toBe('var(--app-color-warning)');
    expect(orange.textContent).toBe('4');
    const uhr = orange.querySelector('ion-icon');
    expect(uhr).not.toBeNull();
    expect(uhr!.getAttribute('icon') ?? (uhr as unknown as { icon?: string }).icon).toBe(ICON_UHRZEIT);
  });
});

describe('Rueckfall: Server ohne challengeNeueBeitraege', () => {
  it('Kugel = wartend + neu freigegeben, Vorlesetext nennt beides', () => {
    const { container } = zeige({ offeneFreigaben: { 1: 2 }, neuigkeiten: { 1: 3 } });
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('5');
    expect(kugeln[0].getAttribute('aria-label')).toBe('5 offen: 2 Beiträge warten auf Freigabe, 3 neue Beiträge');
  });

  it('neueWartend allein schaltet den Rueckfall nicht ab', () => {
    const { container } = zeige({ offeneFreigaben: { 1: 1 }, neueWartend: { 1: 1 } });
    expect(container.querySelector('.app-zaehler-kugel')?.textContent).toBe('1');
    expect(container.querySelector('.app-zaehler-kugel')?.getAttribute('aria-label')).toBe('1 offen: 1 Beitrag wartet auf Freigabe');
  });
});
