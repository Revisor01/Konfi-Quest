import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ChallengesView from '../../../components/konfi/views/ChallengesView';
import type { KonfiChallenge } from '../../../types/challenges';

// Neuigkeiten-Kugel am einzelnen Challenge-Eintrag (24.09.2026, Simon:
// "auf der Challenge ... genau wie beim Chat"). Die Zahl kommt je
// Challenge-ID aus dem BadgeContext; hier wird geprueft, dass die Liste sie
// am richtigen Eintrag zeigt -- und nur dort.

const vorEinerWoche = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const challenge = (id: number, title: string): KonfiChallenge => ({
  id,
  title,
  description: '',
  starts_at: vorEinerWoche,
  ends_at: inEinerWoche,
  has_submission: false,
  badge_icon: null,
  author_freetext: null,
  author_display_name: null,
} as unknown as KonfiChallenge);

const renderListe = (neuigkeiten?: Record<number, number>) =>
  render(
    <ChallengesView
      active={[challenge(1, 'Foto-Challenge'), challenge(2, 'Text-Challenge')]}
      archive={[]}
      marks={[]}
      neuigkeiten={neuigkeiten}
      onSelectChallenge={vi.fn()}
    />
  );

describe('ChallengesView: Neuigkeiten-Kugel am Eintrag', () => {
  it('zeigt die Zahl nur an der Challenge, die Neues hat', () => {
    const { getByLabelText, queryAllByLabelText } = renderListe({ 1: 2 });

    const kugel = getByLabelText('2 Neuigkeiten');
    expect(kugel.textContent).toBe('2');
    // Challenge 2 traegt keine Kugel -- insgesamt genau eine im Baum.
    expect(queryAllByLabelText(/Neuigkeiten$/)).toHaveLength(1);
  });

  it('kuerzt ab zehn auf "9+", wie die Reiter', () => {
    const { getByLabelText } = renderListe({ 2: 12 });

    expect(getByLabelText('12 Neuigkeiten').textContent).toBe('9+');
  });

  it('ohne Neuigkeiten keine Kugel', () => {
    const { queryAllByLabelText } = renderListe({ 1: 0 });
    expect(queryAllByLabelText(/Neuigkeiten$/)).toHaveLength(0);

    const ohneProp = renderListe(undefined);
    expect(ohneProp.queryAllByLabelText(/Neuigkeiten$/)).toHaveLength(0);
  });
});
