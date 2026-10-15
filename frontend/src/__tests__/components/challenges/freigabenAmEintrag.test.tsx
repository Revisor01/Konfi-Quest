import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import { ICON_UHRZEIT } from '../../../components/shared/icons';
import type { AdminChallenge } from '../../../types/challenges';

// Freigaben-Badge am einzelnen Challenge-Eintrag der Leitung: das orange
// Eck-Badge mit Uhr, OHNE Zahl (Simon, 29.09.2026: "Im corner badge soll
// keine Zahl stehen!"). Wie viele warten, zeigen die orangen Zahlen am
// Umschalter und am Reiter "Wartet" (wartetSegmentZahl.test.tsx); hier sagt
// es nur der Vorlesetext. Simon, 25.09.2026: "Das corner badge darf bleiben,
// das verweist ja auch auf Freigaben." Orange steht nur fuer Wartendes
// (Simon, 29.09.2026); die rote Kugel am Symbol zaehlt neue Beitraege seit
// dem letzten Oeffnen -- ein gesehener wartender Beitrag steht nur orange
// (roteKugelNeueBeitraege.test.tsx; Rueckfall ohne Server-Feld:
// roteKugelMitFreigaben.test.tsx).
// Die Zahl kommt je Challenge-ID aus dem BadgeContext
// (pendingChallengesByChallenge) -- dieselbe Quelle wie der Reiter, damit
// Reiter und Eintrag nie verschiedene Zahlen zeigen. Gegenstueck zu
// neuigkeitenAmEintrag.test.tsx fuer die Konfi-Liste (dort die rote Kugel).

// ChallengesManageView liest useApp nur fuer die Loeschen-Berechtigung.
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'admin' } }),
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
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

const renderListe = (offeneFreigaben?: Record<number, number>, neueBeitraege?: Record<number, number>) =>
  render(
    <ChallengesManageView
      challenges={[challenge(31, 'Zeig uns deinen Lieblingsplatz'), challenge(40, 'Text-Challenge')]}
      offeneFreigaben={offeneFreigaben}
      neueBeitraege={neueBeitraege}
      onSelectChallenge={vi.fn()}
      onEditChallenge={vi.fn()}
      onDeleteChallenge={vi.fn()}
    />
  );

describe('ChallengesManageView: Freigaben-Badge am Eintrag', () => {
  it('zeigt das Eck-Badge nur an der Challenge, an der Beitraege warten', () => {
    const { getByLabelText, queryAllByLabelText } = renderListe({ 31: 1 });

    const badge = getByLabelText('1 Beitrag wartet auf Freigabe');
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.getAttribute('title')).toBe('1 Beitrag wartet auf Freigabe');
    // Challenge 40 traegt kein Badge -- insgesamt genau ein oranges Feld im
    // Baum (die rote Kugel nennt die Freigabe ebenfalls, sitzt aber am Symbol).
    expect(queryAllByLabelText(/Freigabe$/).filter((el) => el.classList.contains('app-corner-badge'))).toHaveLength(1);
  });

  it('traegt nur die Uhr, keine Zahl -- bei einem wie bei zwoelf Beitraegen; die Zahl steht im Vorlesetext', () => {
    // Die Uhr ist neben der Farbe das einzige, was dieses Feld von den
    // anderen Eck-Badges (Eingereicht, Status) unterscheidet; die Legende
    // erklaert es als "Oranges Feld mit Uhr". Ohne sie truege nur noch die
    // Farbe die Information (WCAG 1.4.1).
    for (const n of [1, 2, 12]) {
      const { getByLabelText, unmount } = renderListe({ 40: n });
      const badge = getByLabelText(n === 1 ? '1 Beitrag wartet auf Freigabe' : `${n} Beiträge warten auf Freigabe`);
      expect(badge.textContent).toBe('');
      const symbole = badge.querySelectorAll('[data-testid="icon"]');
      expect(symbole).toHaveLength(1);
      expect(symbole[0].getAttribute('data-icon')).toBe(ICON_UHRZEIT);
      unmount();
    }
  });

  it('gesehene wartende stehen NICHT in der roten Kugel', () => {
    // Der Server meldet nichts Neues (neueBeitraege leer): Die drei warten
    // schon, seit die Challenge zuletzt offen war.
    const { getByLabelText, container } = renderListe({ 31: 3 }, {});
    getByLabelText('3 Beiträge warten auf Freigabe');
    expect(container.querySelectorAll('.app-zaehler-kugel')).toHaveLength(0);
  });

  it('ohne offene Freigaben kein Badge -- auch nicht aus pending_count der Liste', () => {
    const { queryAllByLabelText } = renderListe({ 31: 0 });
    expect(queryAllByLabelText(/Freigabe$/)).toHaveLength(0);

    const ohneProp = renderListe(undefined);
    expect(ohneProp.queryAllByLabelText(/Freigabe$/)).toHaveLength(0);
  });
});
