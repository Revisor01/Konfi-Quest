import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Rote Kugel am Listeneintrag zaehlt auch wartende Freigaben (Simon,
// 28.09.2026, Messung am Geraet, iOS, Leitung in Org 4): "Ich erwarte auch
// einen roten Kreis auf dem Listen Element." Der Reiter zeigte eine rote 1,
// der Eintrag nur das orange Feld -- die Summe der Eintraege muss der
// Reiterzahl entsprechen (pendingChallenges + challengeUpdatesTotal). Das
// orange Eck-Badge bleibt zusaetzlich stehen -- seit 29.09.2026 nur mit Uhr,
// ohne Zahl (Simon: "Das reicht dann. Das Corner Badge."); die Zahl steht
// in der Kugel.

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'admin', role_name: 'org_admin' } }),
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

const zeige = (offeneFreigaben: Record<number, number>, neuigkeiten: Record<number, number>) => render(
  <ChallengesManageView
    challenges={[laufend(1, 'Ein Wort, das dich begleitet'), laufend(2, 'Ruhige Challenge')]}
    offeneFreigaben={offeneFreigaben}
    neuigkeiten={neuigkeiten}
    onSelectChallenge={() => {}}
    onEditChallenge={() => {}}
    onDeleteChallenge={() => {}}
  />
);

const eintrag = (container: HTMLElement, titel: string) =>
  [...container.querySelectorAll('.app-list-item')].find((e) => e.textContent?.includes(titel)) as HTMLElement;

describe('Leitungsliste: rote Kugel = wartende Freigaben + Neuigkeiten', () => {
  it('eine wartende Freigabe, nichts Neues: rote Kugel mit 1 UND oranges Feld ohne Zahl', () => {
    const { container } = zeige({ 1: 1 }, {});
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('1');
    expect(kugeln[0].getAttribute('aria-label')).toBe('1 offen: 1 Beitrag wartet auf Freigabe');
    const liste = eintrag(container, 'Ein Wort, das dich begleitet');
    expect(liste.querySelector('.app-zaehler-anker .app-zaehler-kugel')).toBe(kugeln[0]);
    // Das orange Eck-Badge bleibt zusaetzlich stehen -- ohne Zahl.
    const orange = liste.querySelector('.app-corner-badges [aria-label="1 Beitrag wartet auf Freigabe"]');
    expect(orange).not.toBeNull();
    expect(orange!.textContent).toBe('');
    // Die andere Challenge traegt keine Kugel.
    expect(eintrag(container, 'Ruhige Challenge').querySelector('.app-zaehler-kugel')).toBeNull();
  });

  it('zwei wartende und drei neue: Kugel zeigt 5 und nennt beides', () => {
    const { container } = zeige({ 1: 2 }, { 1: 3 });
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('5');
    expect(kugeln[0].getAttribute('aria-label')).toBe('5 offen: 2 Beiträge warten auf Freigabe, 3 neue Beiträge');
    const orange = eintrag(container, 'Ein Wort, das dich begleitet')
      .querySelector('.app-corner-badges [aria-label="2 Beiträge warten auf Freigabe"]');
    expect(orange).not.toBeNull();
    expect(orange!.textContent).toBe('');
  });

  it('nur Neues: Kugel und Vorlesetext wie bisher', () => {
    const { container } = zeige({}, { 2: 4 });
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('4');
    expect(kugeln[0].getAttribute('aria-label')).toBe('4 neue Beiträge');
  });

  it('Summe der Kugeln ueber alle Eintraege = Reiterzahl (Freigaben + Neuigkeiten)', () => {
    const { container } = zeige({ 1: 2, 2: 1 }, { 1: 3 });
    const summe = [...container.querySelectorAll('.app-zaehler-kugel')]
      .reduce((s, k) => s + Number(k.textContent), 0);
    // Reiter (MainTabs): pendingChallengesCount (3) + challengeUpdatesTotal (3)
    expect(summe).toBe(6);
  });
});
