import { describe, it, expect } from 'vitest';
import {
  baueChallengePayload,
  istChallengeFormularGueltig,
  zeitraumFehler,
  type ChallengeFormData
} from '../../utils/challengeForm';

const basis = (overrides: Partial<ChallengeFormData> = {}): ChallengeFormData => ({
  title: 'Sonnenaufgang festhalten',
  description: 'Fotografiert den Sonnenaufgang.',
  audience: 'konfis_und_team',
  visibility: 'konfi_choice',
  moderated: true,
  allowed_media: ['photo'],
  allow_multiple: true,
  badge_icon: 'sunny',
  badge_name: 'Hingeschaut',
  author_freetext: '',
  jahrgang_ids: [3],
  starts_at: '2026-09-01T09:00:00',
  ends_at: '2026-09-14T20:00:00',
  is_draft: false,
  ...overrides
});

describe('istChallengeFormularGueltig', () => {
  it('verlangt den Zeitraum, wenn die Challenge KEIN Entwurf ist', () => {
    expect(istChallengeFormularGueltig(basis({ starts_at: '', ends_at: '' }))).toBe(false);
    expect(istChallengeFormularGueltig(basis({ starts_at: '' }))).toBe(false);
    expect(istChallengeFormularGueltig(basis())).toBe(true);
  });

  it('Entwurf braucht KEINEN Zeitraum (Nutzerentscheid 24.08.2026)', () => {
    expect(istChallengeFormularGueltig(basis({ is_draft: true, starts_at: '', ends_at: '' }))).toBe(true);
  });

  it('Entwurf entbindet nicht von den übrigen Pflichtfeldern', () => {
    expect(istChallengeFormularGueltig(basis({ is_draft: true, title: '  ' }))).toBe(false);
    expect(istChallengeFormularGueltig(basis({ is_draft: true, badge_name: '' }))).toBe(false);
    expect(istChallengeFormularGueltig(basis({ is_draft: true, allowed_media: [] }))).toBe(false);
  });

  it('Jahrgänge sind nur außerhalb von "nur_team" Pflicht', () => {
    expect(istChallengeFormularGueltig(basis({ jahrgang_ids: [] }))).toBe(false);
    expect(istChallengeFormularGueltig(basis({ audience: 'nur_team', jahrgang_ids: [] }))).toBe(true);
  });
});

describe('zeitraumFehler', () => {
  it('meldet Ende vor Start, wenn der Zeitraum verbindlich ist', () => {
    expect(zeitraumFehler(basis({ ends_at: '2026-08-01T09:00:00' })))
      .toBe('Das Ende muss nach dem Start liegen.');
    expect(zeitraumFehler(basis())).toBeNull();
  });

  it('prüft Entwürfe nicht — deren Datum ist nur ein Platzhalter', () => {
    expect(zeitraumFehler(basis({ is_draft: true, ends_at: '2026-08-01T09:00:00' }))).toBeNull();
  });
});

describe('baueChallengePayload', () => {
  it('vor dem Start: sendet alle Felder inklusive starts_at (als UTC) und is_draft', () => {
    const payload = baueChallengePayload(basis({ is_draft: true }), false);
    expect(payload.is_draft).toBe(true);
    expect(payload.starts_at).toBe(new Date('2026-09-01T09:00:00').toISOString());
    expect(payload.ends_at).toBe(new Date('2026-09-14T20:00:00').toISOString());
    expect(payload.visibility).toBe('konfi_choice');
    expect(payload.moderated).toBe(true);
    expect(payload.allowed_media).toEqual(['photo']);
    expect(payload.audience).toBe('konfis_und_team');
  });

  it('nach dem Start: lässt die gesperrten Felder GANZ weg und fixiert is_draft auf false', () => {
    const payload = baueChallengePayload(basis({ is_draft: true }), true);
    expect(payload.is_draft).toBe(false);
    expect('starts_at' in payload).toBe(false);
    expect('visibility' in payload).toBe(false);
    expect('moderated' in payload).toBe(false);
    expect('allowed_media' in payload).toBe(false);
    expect('audience' in payload).toBe(false);
    // Was weiter änderbar ist, wird gesendet.
    expect(payload.title).toBe('Sonnenaufgang festhalten');
    expect(payload.ends_at).toBe(new Date('2026-09-14T20:00:00').toISOString());
  });

  it('nur_team: Jahrgangs-Zuordnung wird geleert', () => {
    const payload = baueChallengePayload(basis({ audience: 'nur_team', jahrgang_ids: [3, 4] }), false);
    expect(payload.jahrgang_ids).toEqual([]);
  });
});
