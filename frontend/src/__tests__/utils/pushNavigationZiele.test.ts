import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildPushTargetUrl } from '../../utils/pushNavigation';

// Befunde M2 und N1 (Push-Bericht 27.08.2026):
//
// M2: Von den 30 Typen, die das Backend sendet, kannte die Weiche nur 20.
// Die uebrigen 10 fielen in den default-Zweig und lieferten '' — der Tap
// oeffnete die App nur dort, wo sie zuletzt stand. Betroffen waren u.a.
// Termin-Aenderung, Pflichttermin, Stempel, Zertifikat und alle
// Teamer-Buchungsmeldungen an die Leitung.
//
// N1: Zwei Teamer-Ziele waren veraltet. Die Weiche schickte Teamer:innen
// aufs Dashboard bzw. ins Profil mit der Begruendung, es gebe keine
// Requests- bzw. Badges-Seite — beide existieren inzwischen.
//
// Der Paritaetstest unten ist der eigentliche Schutz: Er vergleicht die
// Typen, die pushService.js sendet, mit denen, die die Weiche kennt. Eine
// neue Push-Art ohne Ziel faellt damit sofort auf, statt erst jemandem
// beim Antippen.

const ROLLEN = ['admin', 'teamer', 'konfi'] as const;

describe('M2: Die zehn Typen ohne Ziel haben jetzt eines', () => {
  const fehlteFrueher = [
    'event_changed',
    'event_opt_in',
    'event_opt_out',
    'mandatory_event_created',
    'teamer_event_booking',
    'teamer_event_cancellation',
    'challenge_badge_earned',
    'challenge_submission_hidden',
    'certificate',
    'jahrgang_deletion_warning',
  ];

  for (const typ of fehlteFrueher) {
    for (const rolle of ROLLEN) {
      it(`${typ} liefert fuer ${rolle} ein Ziel`, () => {
        const ziel = buildPushTargetUrl(typ, {}, rolle);
        expect(ziel).not.toBe('');
        expect(ziel.startsWith('/')).toBe(true);
      });
    }
  }
});

describe('M2: Die Ziele passen zur Rolle', () => {
  it('Termin-Aenderung fuehrt zum Detail, wenn die ID mitkommt', () => {
    expect(buildPushTargetUrl('event_changed', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('event_changed', { event_id: 7 }, 'admin')).toBe('/admin/events/7');
  });

  it('Termin-Aenderung ohne ID fuehrt zur Liste', () => {
    expect(buildPushTargetUrl('event_changed', {}, 'konfi')).toBe('/konfi/events');
  });

  it('Teamer:innen haben keine Termin-Detailroute, also die Liste', () => {
    // MainTabs kennt /teamer/events, aber kein /teamer/events/:id.
    expect(buildPushTargetUrl('event_changed', { event_id: 7 }, 'teamer')).toBe('/teamer/events');
  });

  it('Zertifikat fuehrt ins Profil', () => {
    expect(buildPushTargetUrl('certificate', {}, 'teamer')).toBe('/teamer/profile');
  });

  it('Stempel fuehrt zu den Abzeichen', () => {
    expect(buildPushTargetUrl('challenge_badge_earned', {}, 'konfi')).toBe('/konfi/badges');
  });

  it('Ausgeblendeter Beitrag fuehrt zum Challenge-Bereich', () => {
    expect(buildPushTargetUrl('challenge_submission_hidden', {}, 'konfi')).toBe('/konfi/challenges');
  });

  it('Archivierungs-Warnung fuehrt die Leitung zu den Jahrgaengen', () => {
    expect(buildPushTargetUrl('jahrgang_deletion_warning', {}, 'admin')).toBe('/admin/settings/jahrgaenge');
  });
});

describe('N1: Die beiden veralteten Teamer-Ziele', () => {
  it('Antrags-Push fuehrt Teamer:innen auf ihre Antragsseite, nicht aufs Dashboard', () => {
    expect(buildPushTargetUrl('activity_request_status', {}, 'teamer')).toBe('/teamer/requests');
  });

  it('Abzeichen-Push fuehrt Teamer:innen zu den Abzeichen, nicht ins Profil', () => {
    expect(buildPushTargetUrl('badge_earned', {}, 'teamer')).toBe('/teamer/badges');
  });

  it('Die anderen Rollen bleiben, wo sie waren', () => {
    expect(buildPushTargetUrl('activity_request_status', {}, 'admin')).toBe('/admin/requests');
    expect(buildPushTargetUrl('activity_request_status', {}, 'konfi')).toBe('/konfi/requests');
    expect(buildPushTargetUrl('badge_earned', {}, 'admin')).toBe('/admin/badges');
    expect(buildPushTargetUrl('badge_earned', {}, 'konfi')).toBe('/konfi/badges');
  });
});

describe('Paritaet: Jeder gesendete Typ hat einen Fall in der Weiche', () => {
  it('kein Backend-Typ faellt in den default-Zweig', () => {
    const pushService = readFileSync(
      resolve(__dirname, '../../../../backend/services/pushService.js'),
      'utf-8'
    );
    const weiche = readFileSync(
      resolve(__dirname, '../../utils/pushNavigation.ts'),
      'utf-8'
    );

    const gesendet = new Set(
      [...pushService.matchAll(/type:\s*'([a-z_]+)'/g)].map((m) => m[1])
    );
    const bekannt = new Set(
      [...weiche.matchAll(/case\s*'([a-z_]+)'/g)].map((m) => m[1])
    );

    // Schutz gegen einen Test, der nichts mehr findet (z.B. nach einem
    // Umbau der Schreibweise): Ohne diese Zusicherung waere er still gruen.
    expect(gesendet.size).toBeGreaterThanOrEqual(30);

    const ohneZiel = [...gesendet].filter((t) => !bekannt.has(t)).sort();
    expect(ohneZiel).toEqual([]);
  });
});
