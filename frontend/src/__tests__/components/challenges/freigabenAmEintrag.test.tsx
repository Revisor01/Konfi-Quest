import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Freigaben-Kugel am einzelnen Challenge-Eintrag der Leitung (25.09.2026,
// Simon: "Auf der Challenge muss auch ein Badge sein wie bei den Chats").
// Die Zahl kommt je Challenge-ID aus dem BadgeContext
// (pendingChallengesByChallenge); hier wird geprueft, dass die Liste sie am
// richtigen Eintrag zeigt -- und nur dort. Gegenstueck zu
// neuigkeitenAmEintrag.test.tsx fuer die Konfi-Liste.

// ChallengesManageView liest useApp nur fuer die Loeschen-Berechtigung.
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'admin' } }),
}));

const vorEinerWoche = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const challenge = (id: number, title: string): AdminChallenge => ({
  id,
  title,
  description: '',
  starts_at: vorEinerWoche,
  ends_at: inEinerWoche,
  is_draft: false,
  visibility: 'public',
  submission_count: 0,
  // Bewusst gesetzt: Die Kugel darf NICHT aus der Liste zaehlen, sondern nur
  // aus dem BadgeContext -- sonst zeigen Reiter und Eintrag zwei Zahlen.
  pending_count: 5,
  own_submission_count: 0,
  jahrgaenge: [],
} as unknown as AdminChallenge);

const renderListe = (offeneFreigaben?: Record<number, number>) =>
  render(
    <ChallengesManageView
      challenges={[challenge(31, 'Zeig uns deinen Lieblingsplatz'), challenge(40, 'Text-Challenge')]}
      offeneFreigaben={offeneFreigaben}
      onSelectChallenge={vi.fn()}
      onEditChallenge={vi.fn()}
      onDeleteChallenge={vi.fn()}
    />
  );

describe('ChallengesManageView: Freigaben-Kugel am Eintrag', () => {
  it('zeigt die Zahl nur an der Challenge, an der Beitraege warten', () => {
    const { getByLabelText, queryAllByLabelText } = renderListe({ 31: 1 });

    const kugel = getByLabelText('1 Beitrag wartet auf Freigabe');
    expect(kugel.textContent).toBe('1');
    // Challenge 40 traegt keine Kugel -- insgesamt genau eine im Baum.
    expect(queryAllByLabelText(/Freigabe$/)).toHaveLength(1);
  });

  it('mehrere Beitraege: Mehrzahl im Text, Zahl in der Kugel', () => {
    const { getByLabelText } = renderListe({ 40: 2 });
    expect(getByLabelText('2 Beiträge warten auf Freigabe').textContent).toBe('2');
  });

  it('kuerzt ab zehn auf "9+", wie die Reiter', () => {
    const { getByLabelText } = renderListe({ 40: 12 });
    expect(getByLabelText('12 Beiträge warten auf Freigabe').textContent).toBe('9+');
  });

  it('ohne offene Freigaben keine Kugel -- auch nicht aus pending_count der Liste', () => {
    const { queryAllByLabelText } = renderListe({ 31: 0 });
    expect(queryAllByLabelText(/Freigabe$/)).toHaveLength(0);

    const ohneProp = renderListe(undefined);
    expect(ohneProp.queryAllByLabelText(/Freigabe$/)).toHaveLength(0);
  });
});
