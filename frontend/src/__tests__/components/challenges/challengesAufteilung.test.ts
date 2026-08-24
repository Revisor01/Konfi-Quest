import { describe, it, expect } from 'vitest';
import {
  getChallengeStatus,
  teileChallengesAuf
} from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge } from '../../../types/challenges';

// Feste Uhr für alle Fälle: 24.08.2026, 12:00 UTC.
const NOW = new Date('2026-08-24T12:00:00Z').getTime();

const tage = (n: number) => new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

const challenge = (overrides: Partial<AdminChallenge> & { id: number }): AdminChallenge => ({
  title: `Challenge ${overrides.id}`,
  description: 'Test',
  challenge_type: 'frei',
  visibility: 'konfi_choice',
  moderated: true,
  allowed_media: ['text'],
  allow_multiple: true,
  badge_icon: 'flag',
  badge_name: 'Testabzeichen',
  starts_at: tage(-1),
  ends_at: tage(1),
  is_draft: false,
  ...overrides
});

// Die vier Zustände einmal konkret.
const aktiv = challenge({ id: 1, starts_at: tage(-1), ends_at: tage(1) });
const geplantNah = challenge({ id: 2, starts_at: tage(2), ends_at: tage(10) });
const geplantFern = challenge({ id: 3, starts_at: tage(5), ends_at: tage(12) });
// Entwürfe: das Startdatum ist nur ein technischer Platzhalter — auch ein
// Datum in der Vergangenheit macht aus einem Entwurf keine aktive Challenge.
const entwurfAlt = challenge({
  id: 4, is_draft: true, starts_at: tage(-3), ends_at: tage(3),
  created_at: tage(-10)
});
const entwurfNeu = challenge({
  id: 5, is_draft: true, starts_at: tage(1), ends_at: tage(8),
  created_at: tage(-2)
});
const beendet = challenge({ id: 6, starts_at: tage(-10), ends_at: tage(-1) });

describe('getChallengeStatus', () => {
  it('leitet die vier Zustände aus is_draft/starts_at/ends_at ab', () => {
    expect(getChallengeStatus(aktiv, NOW)).toBe('active');
    expect(getChallengeStatus(geplantNah, NOW)).toBe('scheduled');
    expect(getChallengeStatus(beendet, NOW)).toBe('ended');
  });

  it('is_draft schlägt jedes Datum — auch ein Start in der Vergangenheit', () => {
    expect(getChallengeStatus(entwurfAlt, NOW)).toBe('draft');
    expect(getChallengeStatus(entwurfNeu, NOW)).toBe('draft');
  });
});

describe('teileChallengesAuf', () => {
  const alle = [beendet, entwurfAlt, geplantFern, aktiv, geplantNah, entwurfNeu];
  const { current, planned, archived } = teileChallengesAuf(alle, NOW);

  it('Aktuell enthält NUR laufende Challenges — keine Entwürfe', () => {
    expect(current.map((c) => c.id)).toEqual([1]);
  });

  it('Entwürfe stehen unter Geplant (Nutzerentscheid 24.08.2026)', () => {
    expect(planned.map((c) => c.id)).toContain(4);
    expect(planned.map((c) => c.id)).toContain(5);
  });

  it('Geplant: Entwürfe zuerst (jüngster oben), dann Geplante mit dem nächsten Start oben', () => {
    expect(planned.map((c) => c.id)).toEqual([5, 4, 2, 3]);
  });

  it('Archiv enthält genau die beendeten', () => {
    expect(archived.map((c) => c.id)).toEqual([6]);
  });

  it('die Zähler der Kacheln stimmen (1 aktuell, 4 geplant, 1 Archiv)', () => {
    expect(current.length).toBe(1);
    expect(planned.length).toBe(4);
    expect(archived.length).toBe(1);
  });

  it('Entwürfe ohne created_at fallen nicht um — Sortierung bleibt stabil über die id', () => {
    const a = challenge({ id: 7, is_draft: true });
    const b = challenge({ id: 8, is_draft: true });
    delete a.created_at;
    delete b.created_at;
    const { planned: nurEntwuerfe } = teileChallengesAuf([a, b], NOW);
    expect(nurEntwuerfe.map((c) => c.id)).toEqual([8, 7]);
  });
});
