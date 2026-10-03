import { describe, it, expect, vi } from 'vitest';
import { buildPushTargetUrl, resolveOrgForPush } from '../../utils/pushNavigation';
import type { PushUserType } from '../../utils/pushNavigation';

// Challenges als eigene Seiten (2.4.0). Simon, 02.10.2026, woertlich:
// "der umbau von challenges, so dass es analog zu events funktioniert. also
// challenge nicht in modal öffnen, sondern in unterseite, damit man direkt
// auf die challenge linken kann aus einem push."
//
// Die vier Challenge-Mitteilungen trugen die Kennung schon immer
// (pushService: challengeId in den Daten aller vier Arten); die Weiche
// schickte trotzdem jede nur auf die Liste. Jetzt fuehrt sie in die
// Challenge -- und ohne Kennung (aeltere Postfach-Eintraege) wie bisher auf
// die Liste. Das Postfach navigiert ueber dieselbe Funktion.

const ARTEN = [
  'challenge_started',
  'challenge_submission',
  'challenge_badge_earned',
  'challenge_submission_hidden',
] as const;

const ROLLEN: Array<[PushUserType, string]> = [
  ['konfi', '/konfi'],
  ['teamer', '/teamer'],
  ['admin', '/admin'],
];

describe('Challenge-Mitteilungen fuehren in die Challenge', () => {
  for (const art of ARTEN) {
    for (const [rolle, praefix] of ROLLEN) {
      it(`${art} mit Kennung: ${rolle} landet auf ${praefix}/challenges/5`, () => {
        // FCM-Daten sind immer Strings.
        expect(buildPushTargetUrl(art, { challengeId: '5' }, rolle)).toBe(`${praefix}/challenges/5`);
      });

      it(`${art} ohne Kennung: ${rolle} bleibt auf der Liste`, () => {
        expect(buildPushTargetUrl(art, {}, rolle)).toBe(`${praefix}/challenges`);
        expect(buildPushTargetUrl(art, undefined, rolle)).toBe(`${praefix}/challenges`);
      });
    }
  }

  it('eine Kennung als Zahl (Postfach-Daten aus der Datenbank) fuehrt ebenso hin', () => {
    expect(buildPushTargetUrl('challenge_submission', { challengeId: 12, organization_id: '1', user_id: '3' }, 'teamer'))
      .toBe('/teamer/challenges/12');
  });

  it('der Feed-Hinweis ("Neuer Beitrag bei ...") ist ein challenge_started und fuehrt in dieselbe Challenge', () => {
    expect(buildPushTargetUrl('challenge_started', { anlass: 'challenge_feed', challengeId: '9' }, 'konfi'))
      .toBe('/konfi/challenges/9');
  });

  it('eine unbrauchbare Kennung fuehrt auf die Liste statt auf eine kaputte Adresse', () => {
    for (const kaputt of ['', 'abc', '0', '-3', '5/../7', '5?x=1', null]) {
      expect(buildPushTargetUrl('challenge_badge_earned', { challengeId: kaputt }, 'konfi'), String(kaputt))
        .toBe('/konfi/challenges');
    }
  });
});

// "Andere Gemeinde: so machen, wie es die Events bei Push/Postfach tun."
// Beide Wege (Push-Tipp in AppContext, Eintrag im Postfach) rufen erst
// resolveOrgForPush und bauen das Ziel dann mit der Rolle in der Gemeinde
// des Inhalts -- fuer Events wie fuer Challenges, ohne Sonderweg.
describe('Andere Gemeinde: erst wechseln, dann in die Challenge -- wie bei Events', () => {
  const wechselnAlsTeamer = () => ({
    getActiveOrgId: () => 1,
    getUserOrgId: () => 1,
    switchOrg: vi.fn().mockResolvedValue({ ok: true, type: 'teamer' as PushUserType }),
  });

  it('Challenge aus Gemeinde 2: Wechsel, dann die Seite der Rolle in Gemeinde 2', async () => {
    const deps = wechselnAlsTeamer();
    const daten = { challengeId: '9', organization_id: '2' };
    const rolle = await resolveOrgForPush(daten, 'admin', deps);
    expect(deps.switchOrg).toHaveBeenCalledWith(2);
    expect(buildPushTargetUrl('challenge_submission', daten, rolle)).toBe('/teamer/challenges/9');
  });

  it('Gegenstueck Event: derselbe Ablauf, dieselbe Form des Ziels', async () => {
    const deps = wechselnAlsTeamer();
    const daten = { event_id: '7', organization_id: '2' };
    const rolle = await resolveOrgForPush(daten, 'admin', deps);
    expect(deps.switchOrg).toHaveBeenCalledWith(2);
    expect(buildPushTargetUrl('event_changed', daten, rolle)).toBe('/teamer/events/7');
  });

  it('gleiche Gemeinde: kein Wechsel, direkt in die Challenge', async () => {
    const deps = wechselnAlsTeamer();
    const daten = { challengeId: '9', organization_id: '1' };
    const rolle = await resolveOrgForPush(daten, 'konfi', deps);
    expect(deps.switchOrg).not.toHaveBeenCalled();
    expect(buildPushTargetUrl('challenge_started', daten, rolle)).toBe('/konfi/challenges/9');
  });
});
