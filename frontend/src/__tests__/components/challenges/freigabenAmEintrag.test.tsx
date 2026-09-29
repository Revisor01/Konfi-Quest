import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Freigaben-Badge am einzelnen Challenge-Eintrag der Leitung: das orange
// Eck-Badge (Zahl + Uhr). Simon, 25.09.2026: "Das corner badge darf bleiben,
// das verweist ja auch auf Freigaben." Seit 28.09.2026 zaehlen dieselben
// Freigaben ZUSAETZLICH in der roten Kugel am Symbol (Simon: "Ich erwarte
// auch einen roten Kreis auf dem Listen Element"; roteKugelMitFreigaben.test.tsx).
// Die Zahl kommt je Challenge-ID aus dem BadgeContext
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
    // Challenge 40 traegt kein Badge -- insgesamt genau ein oranges Feld im
    // Baum (die rote Kugel nennt die Freigabe ebenfalls, sitzt aber am Symbol).
    expect(queryAllByLabelText(/Freigabe$/).filter((el) => el.classList.contains('app-corner-badge'))).toHaveLength(1);
  });

  it('mehrere Beitraege: Mehrzahl im Text, Zahl im Badge', () => {
    const { getByLabelText } = renderListe({ 40: 2 });
    expect(getByLabelText('2 Beiträge warten auf Freigabe').textContent).toBe('2');
  });

  it('zeigt auch ab zehn die volle Zahl -- anders als die Kugel am Reiter', () => {
    const { getByLabelText } = renderListe({ 40: 12 });
    expect(getByLabelText('12 Beiträge warten auf Freigabe').textContent).toBe('12');
  });

  it('sitzt in der Eck-Badge-Leiste -- die Zahl NUR dort, am Symbol ein roter Punkt', () => {
    // Simon, TestFlight 233 (29.09.2026): "Zahl nur auf der corner badge."
    // Die rote Kugel (ZaehlerKugel punkt) legt sich als Punkt ohne Ziffer ans
    // Symbol; der Vorlesetext nennt die Zahl weiter.
    const { getByLabelText, container } = renderListe({ 31: 3 });
    const badge = getByLabelText('3 Beiträge warten auf Freigabe');
    expect(badge.closest('.app-corner-badges')).not.toBeNull();
    expect(badge.textContent).toBe('3');
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln).toHaveLength(1);
    expect(kugeln[0].classList.contains('app-zaehler-kugel--punkt')).toBe(true);
    expect(kugeln[0].textContent).toBe('');
    expect(kugeln[0].getAttribute('role')).toBe('img');
    expect(kugeln[0].getAttribute('aria-label')).toBe('3 offen: 3 Beiträge warten auf Freigabe');
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
