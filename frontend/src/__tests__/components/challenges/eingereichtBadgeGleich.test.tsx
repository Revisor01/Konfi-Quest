import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import ChallengesView from '../../../components/konfi/views/ChallengesView';
import type { AdminChallenge, KonfiChallenge } from '../../../types/challenges';

// Befund M3 (27.08.2026): Das Papierflieger-Badge "Du hast bereits
// eingereicht" bedeutete je Baum etwas anderes.
//
// Die Konfi-Liste prueft `has_submission` -- eingereicht ist eingereicht,
// auch unmoderiert. Die geteilte Leitungs-/Teamer-Liste pruefte `has_badge`,
// das seit dem 24.08.2026 nur noch FREIGEGEBENE Beitraege zaehlt. Folge bei
// einer moderierten Challenge: Eine Teamer:in sah nach dem eigenen
// Einreichen kein Haekchen, eine Konfi in derselben Lage schon -- bei
// wortgleichem Tooltip. Die geteilte Liste nutzt seitdem
// `own_submission_count`, das GET /challenges/admin seit jeher mitliefert.
//
// Gerendert (Umstellung von Quelltext auf Verhalten, 09.10.2026): beide
// Listen bekommen dieselbe Lage -- eingereicht, aber noch nicht freigegeben
// -- und muessen dasselbe Badge zeigen. Dass der Server beide Felder in
// derselben Lage setzt (has_badge false, has_submission true,
// own_submission_count 1), pruefen die Backend-Tests an der Antwort:
// backend/tests/routes/challenges.test.js, "Abzeichen erst nach Freigabe"
// (Konfi-Route und Leitungs-Route).

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'teamer', role_name: 'teamer' } }),
}));

afterEach(() => cleanup());

const tag = 24 * 60 * 60 * 1000;
const BADGE = 'Du hast bereits eingereicht';

const leitungsChallenge = (id: number, title: string, extra: Partial<AdminChallenge>): AdminChallenge => ({
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
  ...extra,
} as unknown as AdminChallenge);

const konfiChallenge = (id: number, title: string, extra: Partial<KonfiChallenge>): KonfiChallenge => ({
  id,
  title,
  description: '',
  starts_at: new Date(Date.now() - tag).toISOString(),
  ends_at: new Date(Date.now() + 7 * tag).toISOString(),
  has_submission: false,
  badge_icon: null,
  author_freetext: null,
  author_display_name: null,
  ...extra,
} as unknown as KonfiChallenge);

const eintrag = (container: HTMLElement, titel: string) => {
  const treffer = [...container.querySelectorAll('.app-list-item')].filter((e) => e.textContent?.includes(titel));
  expect(treffer, `Eintrag ${titel}`).toHaveLength(1);
  return treffer[0] as HTMLElement;
};
const badgeZahl = (el: HTMLElement) => el.querySelectorAll(`[aria-label="${BADGE}"]`).length;

const zeigeLeitung = (challenges: AdminChallenge[]) => render(
  <ChallengesManageView
    challenges={challenges}
    onSelectChallenge={() => {}}
    onEditChallenge={() => {}}
    onDeleteChallenge={() => {}}
  />
);

describe('"Bereits eingereicht" bedeutet ueberall dasselbe (M3)', () => {
  it('die geteilte Liste haengt das Badge an die eigene Einreichung', () => {
    const { container } = zeigeLeitung([
      leitungsChallenge(1, 'Eingereicht, wartet auf Freigabe', { own_submission_count: 1, has_badge: false }),
      leitungsChallenge(2, 'Nichts eingereicht', { own_submission_count: 0, has_badge: false }),
    ]);
    expect(badgeZahl(eintrag(container, 'Eingereicht, wartet auf Freigabe'))).toBe(1);
    expect(badgeZahl(eintrag(container, 'Nichts eingereicht'))).toBe(0);
  });

  it('die geteilte Liste nutzt dafuer NICHT mehr has_badge', () => {
    // Der Kern des Befunds: has_badge steht fuer das verdiente Abzeichen,
    // nicht fuer die Einreichung. Ohne eigene Einreichung kein
    // Papierflieger -- auch wenn has_badge gesetzt ist.
    const { container } = zeigeLeitung([
      leitungsChallenge(3, 'Abzeichen, Zahl 0', { own_submission_count: 0, has_badge: true }),
      leitungsChallenge(4, 'Abzeichen, Zahl fehlt', { has_badge: true }),
    ]);
    expect(badgeZahl(eintrag(container, 'Abzeichen, Zahl 0'))).toBe(0);
    expect(badgeZahl(eintrag(container, 'Abzeichen, Zahl fehlt'))).toBe(0);
  });

  it('die Konfi-Liste bleibt bei has_submission', () => {
    // Gegenprobe: Diese Seite war richtig und darf sich nicht aendern.
    const { container } = render(
      <ChallengesView
        active={[
          konfiChallenge(1, 'Eingereicht, wartet auf Freigabe', { has_submission: true }),
          konfiChallenge(2, 'Nichts eingereicht', { has_submission: false }),
        ]}
        archive={[]}
        marks={[]}
        onSelectChallenge={vi.fn()}
      />
    );
    expect(badgeZahl(eintrag(container, 'Eingereicht, wartet auf Freigabe'))).toBe(1);
    expect(badgeZahl(eintrag(container, 'Nichts eingereicht'))).toBe(0);
  });

  it('beide Wege zeigen in derselben Lage dasselbe Badge', () => {
    // Moderierte Challenge, eigener Beitrag wartet: So liefert der Server die
    // Lage je Route (siehe Kopf). Konfi und Team sehen dasselbe Zeichen mit
    // demselben Text.
    const leitung = zeigeLeitung([
      leitungsChallenge(5, 'Foto der Woche', { own_submission_count: 1, has_badge: false }),
    ]);
    const leitungsBadge = eintrag(leitung.container, 'Foto der Woche').querySelector(`[aria-label="${BADGE}"]`);
    cleanup();
    const konfi = render(
      <ChallengesView
        active={[konfiChallenge(5, 'Foto der Woche', { has_submission: true })]}
        archive={[]}
        marks={[]}
        onSelectChallenge={vi.fn()}
      />
    );
    const konfiBadge = eintrag(konfi.container, 'Foto der Woche').querySelector(`[aria-label="${BADGE}"]`);
    expect(leitungsBadge?.getAttribute('title')).toBe(BADGE);
    expect(konfiBadge?.getAttribute('title')).toBe(BADGE);
    expect(leitungsBadge?.className).toBe('app-corner-badge app-corner-badge--queue');
    expect(konfiBadge?.className).toBe('app-corner-badge app-corner-badge--queue');
  });
});
