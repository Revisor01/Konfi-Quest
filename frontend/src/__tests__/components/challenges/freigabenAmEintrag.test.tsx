import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import { ICON_UHRZEIT } from '../../../components/shared/icons';
import type { AdminChallenge } from '../../../types/challenges';

// Freigaben-Badge am einzelnen Challenge-Eintrag der Leitung: das orange
// Eck-Badge mit Uhr. Simon, 25.09.2026: "Das corner badge darf bleiben,
// das verweist ja auch auf Freigaben." Seit 29.09.2026 OHNE Zahl (Simon,
// TestFlight 233: "kann das Symbol bei Freigabe warten, bei Challenges ohne
// Zahl ausgeliefert werden. Das reicht dann. Das Corner Badge.") -- die
// Zahl steht in der roten Kugel und am Umschalter; wie viele warten, sagt
// der Vorlesetext weiter in ganzen Worten. Seit 28.09.2026 zaehlen dieselben
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

/** Die orange Eck-Badge-Farbe, an der sich die Legende ("Uhr") orientiert. */
const ORANGE = 'var(--app-color-warning)';

describe('ChallengesManageView: Freigaben-Badge am Eintrag', () => {
  it('zeigt das orange Eck-Badge nur an der Challenge, an der Beitraege warten', () => {
    const { getByLabelText, queryAllByLabelText } = renderListe({ 31: 1 });

    const badge = getByLabelText('1 Beitrag wartet auf Freigabe');
    expect(badge.className).toBe('app-corner-badge');
    expect(badge.style.backgroundColor).toBe(ORANGE);
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.getAttribute('title')).toBe('1 Beitrag wartet auf Freigabe');
    // Challenge 40 traegt kein Badge -- insgesamt genau ein oranges Feld im
    // Baum (die rote Kugel nennt die Freigabe ebenfalls, sitzt aber am Symbol).
    expect(queryAllByLabelText(/Freigabe$/).filter((el) => el.classList.contains('app-corner-badge'))).toHaveLength(1);
  });

  it('traegt nur die Uhr, keine Zahl -- bei einem wie bei zwoelf Beitraegen', () => {
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

  it('so breit wie die anderen Symbol-Badges der Leiste (Innenabstand mini/kompakt)', () => {
    const { getByLabelText } = renderListe({ 31: 1 });
    expect(getByLabelText('1 Beitrag wartet auf Freigabe').style.padding)
      .toBe('var(--app-abstand-mini) var(--app-abstand-kompakt)');
  });

  it('sitzt in der Eck-Badge-Leiste -- und zaehlt zusaetzlich in der roten Kugel am Symbol', () => {
    const { getByLabelText, container } = renderListe({ 31: 3 });
    const badge = getByLabelText('3 Beiträge warten auf Freigabe');
    expect(badge.closest('.app-corner-badges')).not.toBeNull();
    // Die rote Kugel (ZaehlerKugel) legt sich als span.app-zaehler-kugel ans
    // Symbol; seit 28.09.2026 zaehlt sie die wartenden Freigaben mit.
    const kugeln = container.querySelectorAll('.app-zaehler-kugel');
    expect(kugeln).toHaveLength(1);
    expect(kugeln[0].textContent).toBe('3');
    expect(kugeln[0].getAttribute('aria-label')).toBe('3 offen: 3 Beiträge warten auf Freigabe');
  });

  it('haelt den Titel vom Badge frei: mit und ohne Freigaben derselbe Freiraum', () => {
    // Das Feld ist ohne Zahl so breit wie jedes andere Symbol-Badge; drei
    // davon (Freigabe, Eingereicht, Status) passen in xl plus Kartenrand.
    const mit = renderListe({ 31: 1 });
    const titelMit = mit.getByText('Zeig uns deinen Lieblingsplatz') as HTMLElement;
    const titelOhne = mit.getByText('Text-Challenge') as HTMLElement;
    expect(titelMit.style.paddingRight).toBe('var(--app-freiraum-aktion-xl)');
    expect(titelOhne.style.paddingRight).toBe('var(--app-freiraum-aktion-xl)');
  });

  it('ohne offene Freigaben kein Badge -- auch nicht aus pending_count der Liste', () => {
    const { queryAllByLabelText } = renderListe({ 31: 0 });
    expect(queryAllByLabelText(/Freigabe$/)).toHaveLength(0);

    const ohneProp = renderListe(undefined);
    expect(ohneProp.queryAllByLabelText(/Freigabe$/)).toHaveLength(0);
  });
});
