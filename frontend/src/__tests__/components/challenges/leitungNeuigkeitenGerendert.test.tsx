import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Challenges wie der Chat -- auch fuer die Leitung (Simon, 27.09.2026):
// "Neue Nachricht: ein Abzeichen, ein Badge. Ich will sehen, ob da etwas
// Neues passiert." Gerendert: Die Leitungsliste zeigt neue Beitraege als rote
// Kugel am Symbol und wartende Freigaben weiter als oranges Feld mit Uhr --
// zwei Zeichen, zwei Bedeutungen.

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
  moderated: false,
  allowed_media: ['text'],
  allow_multiple: true,
  badge_icon: 'flag',
  badge_name: 'A',
  starts_at: new Date(Date.now() - tag).toISOString(),
  ends_at: new Date(Date.now() + 7 * tag).toISOString(),
  is_draft: false,
} as unknown as AdminChallenge);

afterEach(() => cleanup());

const zeige = (neuigkeiten: Record<number, number>, offeneFreigaben: Record<number, number>) => render(
  <ChallengesManageView
    challenges={[laufend(3, 'Ohne Freigabe'), laufend(4, 'Mit Freigabe')]}
    neuigkeiten={neuigkeiten}
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
    expect(kugeln[0].getAttribute('aria-label')).toBe('1 neue Beiträge');
    expect(kugeln[0].closest('.app-list-item')?.textContent).toContain('Ohne Freigabe');
  });

  it('Freigabe und Neues stehen getrennt: oranges Feld mit Uhr an der einen, Kugel an der anderen', () => {
    const { container } = zeige({ 3: 2 }, { 4: 1 });
    expect(container.querySelectorAll('.app-zaehler-kugel').length).toBe(1);
    const freigabe = container.querySelector('[aria-label*="Freigabe"]');
    expect(freigabe).not.toBeNull();
    expect(freigabe?.closest('.app-list-item')?.textContent).toContain('Mit Freigabe');
  });

  it('nichts Neues: keine Kugel', () => {
    const { container } = zeige({}, {});
    expect(container.querySelectorAll('.app-zaehler-kugel').length).toBe(0);
  });
});
