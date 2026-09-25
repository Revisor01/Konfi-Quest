import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Freigaben-Badge am einzelnen Challenge-Eintrag der Leitung: das orange
// Eck-Badge (Zahl + Uhr), nicht die rote Kugel am Symbol. Simon, 25.09.2026:
// "Das corner badge darf bleiben, das verweist ja auch auf Freigaben. Die
// kann man auch spaeter machen. Also fuer Freigaben ja, sonst nur der rote
// Badge." Die Zahl kommt je Challenge-ID aus dem BadgeContext
// (pendingChallengesByChallenge) -- dieselbe Quelle wie der Reiter, damit
// Reiter und Eintrag nie verschiedene Zahlen zeigen. Gegenstueck zu
// neuigkeitenAmEintrag.test.tsx fuer die Konfi-Liste (dort die rote Kugel).

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
  // Bewusst gesetzt: Das Badge darf NICHT aus der Liste zaehlen, sondern nur
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

/** Die orange Eck-Badge-Farbe, an der sich die Legende ("Zahl mit Uhr") orientiert. */
const ORANGE = 'var(--app-color-warning)';

describe('ChallengesManageView: Freigaben-Badge am Eintrag', () => {
  it('zeigt das orange Eck-Badge nur an der Challenge, an der Beitraege warten', () => {
    const { getByLabelText, queryAllByLabelText } = renderListe({ 31: 1 });

    const badge = getByLabelText('1 Beitrag wartet auf Freigabe');
    expect(badge.textContent).toBe('1');
    expect(badge.className).toBe('app-corner-badge');
    expect(badge.style.backgroundColor).toBe(ORANGE);
    // Challenge 40 traegt kein Badge -- insgesamt genau eines im Baum.
    expect(queryAllByLabelText(/Freigabe$/)).toHaveLength(1);
  });

  it('mehrere Beitraege: Mehrzahl im Text, Zahl im Badge', () => {
    const { getByLabelText } = renderListe({ 40: 2 });
    expect(getByLabelText('2 Beiträge warten auf Freigabe').textContent).toBe('2');
  });

  it('zeigt auch ab zehn die volle Zahl -- anders als die Kugel am Reiter', () => {
    const { getByLabelText } = renderListe({ 40: 12 });
    expect(getByLabelText('12 Beiträge warten auf Freigabe').textContent).toBe('12');
  });

  it('sitzt in der Eck-Badge-Leiste, nicht als rote Kugel am Symbol', () => {
    const { getByLabelText, container } = renderListe({ 31: 3 });
    const badge = getByLabelText('3 Beiträge warten auf Freigabe');
    expect(badge.closest('.app-corner-badges')).not.toBeNull();
    // Die rote Kugel (ZaehlerKugel) legt sich als span.app-zaehler-kugel ans
    // Symbol; hier keine.
    expect(container.querySelectorAll('.app-zaehler-kugel')).toHaveLength(0);
  });

  it('haelt den Titel vom Badge frei: breiterer Freiraum nur mit offenen Freigaben', () => {
    const mit = renderListe({ 31: 1 });
    const titelMit = mit.getByText('Zeig uns deinen Lieblingsplatz') as HTMLElement;
    const titelOhne = mit.getByText('Text-Challenge') as HTMLElement;
    expect(titelMit.style.paddingRight).toBe('var(--app-freiraum-aktion-xxl-plus)');
    expect(titelOhne.style.paddingRight).toBe('var(--app-freiraum-aktion-xl)');
  });

  it('ohne offene Freigaben kein Badge -- auch nicht aus pending_count der Liste', () => {
    const { queryAllByLabelText } = renderListe({ 31: 0 });
    expect(queryAllByLabelText(/Freigabe$/)).toHaveLength(0);

    const ohneProp = renderListe(undefined);
    expect(ohneProp.queryAllByLabelText(/Freigabe$/)).toHaveLength(0);
  });
});
