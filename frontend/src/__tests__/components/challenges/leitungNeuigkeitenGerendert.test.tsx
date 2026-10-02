import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Challenges wie der Chat -- auch fuer die Leitung (Simon, 27.09.2026):
// "Neue Nachricht: ein Abzeichen, ein Badge. Ich will sehen, ob da etwas
// Neues passiert." Gerendert: Die Leitungsliste zeigt neue Beitraege als rote
// Kugel am Symbol und wartende Freigaben als oranges Feld mit Uhr. Seit
// 29.09.2026 zaehlt die Kugel jeden neuen Beitrag seit dem letzten Oeffnen,
// auch wartende (neueBeitraege aus challengeNeueBeitraege).

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'admin', role_name: 'org_admin' } }),
}));

const tag = 24 * 60 * 60 * 1000;
// EIN Zeitpunkt fuer alle Fixtures: Die Liste sortiert laufende Challenges
// nach starts_at (neueste zuerst). Mit Date.now() je Aufruf lag der Start der
// zweiten Challenge gelegentlich eine Millisekunde spaeter, und die
// Reihenfolge kippte (in der vollen Suite gesehen, 02.10.2026).
const jetzt = Date.now();
const laufend = (id: number, title: string): AdminChallenge => ({
  id,
  title,
  description: 'd',
  challenge_type: 'frei',
  visibility: 'public',
  audience: 'konfis_und_team',
  moderated: false,
  allowed_media: ['text'],
  allow_multiple: true,
  badge_icon: 'flag',
  badge_name: 'A',
  starts_at: new Date(jetzt - tag).toISOString(),
  ends_at: new Date(jetzt + 7 * tag).toISOString(),
  is_draft: false,
} as unknown as AdminChallenge);

afterEach(() => cleanup());

const zeige = (neueBeitraege: Record<number, number>, offeneFreigaben: Record<number, number>) => render(
  <ChallengesManageView
    challenges={[laufend(3, 'Ohne Freigabe'), laufend(4, 'Mit Freigabe')]}
    neueBeitraege={neueBeitraege}
    offeneFreigaben={offeneFreigaben}
    onSelectChallenge={() => {}}
    onEditChallenge={() => {}}
    onDeleteChallenge={() => {}}
  />
);

describe('Leitungsliste: neue Beitraege als rote Kugel', () => {
  it('ein neuer Beitrag: Kugel mit 1 an genau dieser Challenge', () => {
    const { container } = zeige({ 3: 1 }, {});
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln.length).toBe(1);
    expect(kugeln[0].textContent).toBe('1');
    expect(kugeln[0].getAttribute('aria-label')).toBe('1 neuer Beitrag');
    expect(kugeln[0].closest('.app-list-item')?.textContent).toContain('Ohne Freigabe');
  });

  it('neuer wartender Beitrag: oranges Feld mit Uhr UND rote Kugel am Eintrag, Neues ohne Freigabe nur als Kugel', () => {
    const { container } = zeige({ 3: 2, 4: 1 }, { 4: 1 });
    const kugeln = [...container.querySelectorAll('.app-zaehler-kugel')];
    expect(kugeln.map((k) => k.textContent)).toEqual(['2', '1']);
    expect(kugeln[0].closest('.app-list-item')?.textContent).toContain('Ohne Freigabe');
    expect(kugeln[1].closest('.app-list-item')?.textContent).toContain('Mit Freigabe');
    const freigabe = container.querySelector('.app-corner-badge[aria-label*="Freigabe"]');
    // Eck-Badge ohne Zahl (Simon, 29.09.2026); die Zahl steht nur im Vorlesetext.
    expect(freigabe?.getAttribute('aria-label')).toBe('1 Beitrag wartet auf Freigabe');
    expect(freigabe?.textContent).toBe('');
    expect(freigabe?.closest('.app-list-item')?.textContent).toContain('Mit Freigabe');
  });

  it('nichts Neues: keine Kugel', () => {
    const { container } = zeige({}, {});
    expect(container.querySelectorAll('.app-zaehler-kugel').length).toBe(0);
  });
});

describe('Leitungsliste: jede der drei Zielgruppen steht in der Meta-Zeile', () => {
  it('„Nur Konfis", „Konfis und Team" und „Nur Team" werden benannt', () => {
    const mit = (id: number, title: string, audience: string) =>
      ({ ...laufend(id, title), audience } as unknown as AdminChallenge);
    const { container } = render(
      <ChallengesManageView
        challenges={[mit(5, 'Konfi-Runde', 'konfis'), mit(6, 'Gemischt', 'konfis_und_team'), mit(7, 'Teamrunde', 'nur_team')]}
        neuigkeiten={{}}
        offeneFreigaben={{}}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    const eintrag = (titel: string) =>
      [...container.querySelectorAll('.app-list-item')].find((e) => e.textContent?.includes(titel))?.textContent;
    expect(eintrag('Konfi-Runde')).toContain('Nur Konfis');
    expect(eintrag('Gemischt')).toContain('Konfis und Team');
    expect(eintrag('Teamrunde')).toContain('Nur Team');
  });
});
