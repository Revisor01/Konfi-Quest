import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  buildPushTargetUrl,
  waehleRueckblick,
  PUNKTE_PARAMETER,
  RUECKBLICK_PARAMETER,
  RUECKBLICK_NEUESTER,
} from '../../utils/pushNavigation';

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

  it('Teamer:innen kommen ebenfalls zum Termin -- seit es /teamer/events/:id gibt', () => {
    // Bis zum 24.09.2026 stand hier die Liste: rollenBaeume kannte kein
    // /teamer/events/:id, ein Link dorthin fiel in den Catch-all und landete
    // auf dem Dashboard. Die Route gibt es jetzt (Umleitung auf ?eventId=).
    expect(buildPushTargetUrl('event_changed', { event_id: 7 }, 'teamer')).toBe('/teamer/events/7');
  });

  it('Teamer:innen ohne Kennung bleiben auf der Liste', () => {
    expect(buildPushTargetUrl('event_changed', {}, 'teamer')).toBe('/teamer/events');
  });

  it('Absage fuehrt zum Termin, wenn die Kennung mitkommt', () => {
    // Bis zum 15.09.2026 landete die Absage immer auf der Terminliste --
    // der Push trug als einziger Termin-Push keine Kennung. Am Termin steht
    // der Grund ausfuehrlich, samt "Abgesagt von ...".
    expect(buildPushTargetUrl('event_cancelled', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('event_cancelled', { event_id: 7 }, 'admin')).toBe('/admin/events/7');
  });

  it('Absage ohne Kennung fuehrt weiter zur Liste', () => {
    // So kommt sie beim LOESCHEN eines Termins an: Den Termin gibt es nicht
    // mehr, ein Sprung dorthin fuehrte ins Leere.
    expect(buildPushTargetUrl('event_cancelled', {}, 'konfi')).toBe('/konfi/events');
    expect(buildPushTargetUrl('event_cancelled', {}, 'admin')).toBe('/admin/events');
  });

  it('Absage fuehrt auch Teamer:innen zum Termin', () => {
    expect(buildPushTargetUrl('event_cancelled', { event_id: 7 }, 'teamer')).toBe('/teamer/events/7');
    expect(buildPushTargetUrl('event_cancelled', {}, 'teamer')).toBe('/teamer/events');
  });

  it('Zuruecknahme der Absage fuehrt zum Termin — dort meldet man sich ab', () => {
    // "Findet doch statt. Du bist wieder angemeldet – prüf bitte, ob du Zeit
    // hast, und melde dich sonst ab." Genau das geht nur am Termin, nicht auf
    // der Liste. Dasselbe Ziel wie die Absage, aus demselben Grund.
    expect(buildPushTargetUrl('event_reactivated', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('event_reactivated', { event_id: 7 }, 'admin')).toBe('/admin/events/7');
    expect(buildPushTargetUrl('event_reactivated', { event_id: 7 }, 'teamer')).toBe('/teamer/events/7');
  });

  it('Zuruecknahme ohne Kennung fuehrt zur Liste', () => {
    expect(buildPushTargetUrl('event_reactivated', {}, 'konfi')).toBe('/konfi/events');
  });

  // --- Anmeldung, Teilnahme, Erinnerung: zum Termin statt zur Liste ---
  //
  // Simons Befund am Geraet (24.09.2026), zwei Wege, dasselbe Bild:
  //   "Wenn ich mich mit meinem Teamer bei einem Konfi-Treffen anmelde,
  //    kriege ich den Push auf dem Admin, der leitet mich aber nur zur
  //    allgemeinen Events-Liste und nicht ins Event."
  //   "Konfi via Web zum Ereignis hinzufuegen -> Push kommt, Klick aber
  //    auch wieder nur in die Ereignisliste."
  //
  // Das Backend sendet die Kennung in ALLEN diesen Pushes mit (pushService.js:
  // event_id bei den Konfi-/Teamer-Meldungen, eventId bei den Meldungen an die
  // Leitung). Die Weiche hat sie bei diesen Typen nur nie gelesen und hart die
  // Liste zurueckgegeben -- waehrend event_changed und event_cancelled es
  // laengst richtig machen. Dasselbe Muster, nur nicht ueberall ausgerollt.
  //
  // Teamer:innen blieben bis zum 24.09.2026 ueberall auf der Liste, weil
  // /teamer/events/:id fehlte -- ein Link dorthin fiel in den Catch-all und
  // landete auf /teamer/dashboard, schlechter als die Liste. Seit die Route
  // existiert (rollenBaeume.ts, Umleitung auf ?eventId=), gilt fuer alle
  // drei Rollen dasselbe Ziel.
  it('Anmeldebestaetigung fuehrt zum Termin', () => {
    expect(buildPushTargetUrl('event_registered', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('event_registered', { event_id: 7 }, 'admin')).toBe('/admin/events/7');
    expect(buildPushTargetUrl('event_registered', { event_id: 7 }, 'teamer')).toBe('/teamer/events/7');
  });

  it('Abmeldung, Nachrueckung und Erinnerung fuehren zum Termin', () => {
    // event_attendance stand bis zum 25.09.2026 mit in dieser Reihe -- seit
    // Simons Durchsicht fuehrt es zur Punkte-Uebersicht (siehe unten).
    expect(buildPushTargetUrl('event_unregistered', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('waitlist_promotion', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('event_reminder', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
  });

  it('Alle Termin-Pushes mit Kennung fuehren Teamer:innen zum Termin', () => {
    // Die sechs Typen aus dem Befund vom 24.09.2026 -- vorher endeten sie
    // fuer Teamer:innen ausnahmslos auf der Liste.
    for (const typ of [
      'event_registered', 'waitlist_promotion', 'event_cancelled',
      'event_reactivated', 'event_changed', 'event_reminder',
    ]) {
      expect(buildPushTargetUrl(typ, { event_id: 7 }, 'teamer'), typ).toBe('/teamer/events/7');
      expect(buildPushTargetUrl(typ, {}, 'teamer'), `${typ} ohne Kennung`).toBe('/teamer/events');
    }
  });

  it('Ohne Kennung bleibt es bei der Liste', () => {
    expect(buildPushTargetUrl('event_registered', {}, 'konfi')).toBe('/konfi/events');
    expect(buildPushTargetUrl('event_unregistered', {}, 'admin')).toBe('/admin/events');
  });

  // Die Meldungen an die Leitung tragen die Kennung als `eventId` (camelCase,
  // pushService.js:2261) statt als `event_id`. Die Weiche muss beide lesen --
  // sonst faellt genau Simons erster Fall durch.
  it('Teamer-Buchung fuehrt die Leitung zum Termin, auch mit camelCase-Kennung', () => {
    expect(buildPushTargetUrl('teamer_event_booking', { eventId: '7' }, 'admin')).toBe('/admin/events/7');
    expect(buildPushTargetUrl('teamer_event_cancellation', { eventId: '7' }, 'admin')).toBe('/admin/events/7');
  });

  it('Zertifikat fuehrt ins Profil', () => {
    expect(buildPushTargetUrl('certificate', {}, 'teamer')).toBe('/teamer/profile');
  });

  it('Stempel fuehrt zu den Challenges -- dort ist "Deine Stempel"', () => {
    // Bis zum 25.09.2026 zu den Abzeichen; Stempel sind aber keine
    // Abzeichen und stehen dort nicht.
    expect(buildPushTargetUrl('challenge_badge_earned', {}, 'konfi')).toBe('/konfi/challenges');
  });

  it('Ausgeblendeter Beitrag fuehrt zum Challenge-Bereich', () => {
    expect(buildPushTargetUrl('challenge_submission_hidden', {}, 'konfi')).toBe('/konfi/challenges');
  });

  it('Archivierungs-Warnung fuehrt die Leitung zu den Jahrgaengen', () => {
    expect(buildPushTargetUrl('jahrgang_deletion_warning', {}, 'admin')).toBe('/admin/settings/jahrgaenge');
  });
});

// Simons Durchsicht der Postfach-Ziele (25.09.2026), woertlich:
//   "Verbuchen und Bonus muss die Punkte Übersicht aufrufen."
//   "Aktivität eingetragen meint verbucht? Dann wäre Punkte Übersicht richtig."
//   "Level ist richtig mit Startseite."
//   "Rückblick zeigt das jeweilige wrapped."
//   "Challenge Stempel muss auf die Challenge Seite da sind die Stempel."
//
// Punkte-Uebersicht und Rueckblick sind Modale ohne Route. Das Ziel ist
// deshalb das Profil mit einem Parameter, den die Profilseite liest und
// daraufhin ihr Modal oeffnet -- dasselbe Muster wie /teamer/events?eventId=.
describe('Durchsicht 25.09.2026: Punkte, Rueckblick, Stempel', () => {
  it('Punkte aus einem Termin fuehren Konfis in die Punkte-Uebersicht, nicht zum Termin', () => {
    expect(buildPushTargetUrl('event_attendance', { event_id: 7 }, 'konfi')).toBe('/konfi/profile?punkte=1');
    expect(buildPushTargetUrl('event_attendance', {}, 'konfi')).toBe('/konfi/profile?punkte=1');
  });

  it('Bonuspunkte fuehren Konfis in die Punkte-Uebersicht, nicht aufs Dashboard', () => {
    expect(buildPushTargetUrl('bonus_points', { points: '3' }, 'konfi')).toBe('/konfi/profile?punkte=1');
  });

  it('Zugewiesene Aktivitaet ist eine Verbuchung -> Punkte-Uebersicht', () => {
    // assign-activity schreibt user_activities UND addiert die Punkte in
    // derselben Transaktion; der Push heisst "+3 Punkte!". Keine Zuweisung
    // zum spaeteren Erledigen -- deshalb nicht die Aktivitaetenliste.
    expect(buildPushTargetUrl('activity_assigned', { points: '3' }, 'konfi')).toBe('/konfi/profile?punkte=1');
  });

  it('Teamer:innen haben keine Punkte-Uebersicht -> Startseite; Leitung -> Konfi-Liste', () => {
    for (const typ of ['event_attendance', 'bonus_points', 'activity_assigned']) {
      expect(buildPushTargetUrl(typ, {}, 'teamer'), typ).toBe('/teamer/dashboard');
      expect(buildPushTargetUrl(typ, {}, 'admin'), typ).toBe('/admin/konfis');
    }
  });

  it('Level bleibt auf der Startseite', () => {
    expect(buildPushTargetUrl('level_up', { level_id: '2' }, 'konfi')).toBe('/konfi/dashboard');
    expect(buildPushTargetUrl('level_up', {}, 'teamer')).toBe('/teamer/dashboard');
    expect(buildPushTargetUrl('level_up', {}, 'admin')).toBe('/admin/konfis');
  });

  it('Rueckblick fuehrt ins Profil zur JEWEILIGEN Ausgabe', () => {
    expect(buildPushTargetUrl('wrapped', { ausgabe_id: '42', wrappedType: 'konfi' }, 'konfi')).toBe('/konfi/profile?rueckblick=42');
    expect(buildPushTargetUrl('wrapped', { ausgabe_id: '17', wrappedType: 'teamer' }, 'teamer')).toBe('/teamer/profile?rueckblick=17');
  });

  it('Rueckblick ohne Ausgabe-Kennung (aeltere Eintraege) oeffnet den neuesten', () => {
    expect(buildPushTargetUrl('wrapped', { wrappedType: 'konfi' }, 'konfi')).toBe('/konfi/profile?rueckblick=neuester');
    expect(buildPushTargetUrl('wrapped', {}, 'teamer')).toBe('/teamer/profile?rueckblick=neuester');
  });

  it('Die Leitung hat keinen eigenen Rueckblick -> Startseite', () => {
    expect(buildPushTargetUrl('wrapped', { ausgabe_id: '42' }, 'admin')).toBe('/admin/dashboard');
  });

  it('Stempel fuehrt alle Rollen zu den Challenges', () => {
    expect(buildPushTargetUrl('challenge_badge_earned', { challengeId: '5' }, 'konfi')).toBe('/konfi/challenges');
    expect(buildPushTargetUrl('challenge_badge_earned', {}, 'teamer')).toBe('/teamer/challenges');
    expect(buildPushTargetUrl('challenge_badge_earned', {}, 'admin')).toBe('/admin/challenges');
  });

  it('Zertifikat fuehrt weiter ins Profil (dort liegen die Zertifikate)', () => {
    expect(buildPushTargetUrl('certificate', { organization_id: '1' }, 'teamer')).toBe('/teamer/profile');
  });

  // Die Parameternamen sind der Vertrag zwischen Weiche und Profilseite.
  it('Die Ziele benutzen die exportierten Parameternamen', () => {
    expect(buildPushTargetUrl('bonus_points', {}, 'konfi')).toBe(`/konfi/profile?${PUNKTE_PARAMETER}=1`);
    expect(buildPushTargetUrl('wrapped', {}, 'konfi')).toBe(`/konfi/profile?${RUECKBLICK_PARAMETER}=${RUECKBLICK_NEUESTER}`);
  });
});

describe('waehleRueckblick: welcher Eintrag aus "Meine Rückblicke" aufgeht', () => {
  // Reihenfolge wie GET /wrapped/history: neueste Ausgabe zuerst.
  const liste = [
    { id: 3, ausgabe_id: 42, titel: 'Dein Abschluss' },
    { id: 2, ausgabe_id: 17, titel: 'Zwischenstand' },
    { id: 1, ausgabe_id: null, titel: null },
  ];

  it('Kennung trifft eine Ausgabe -> genau diese', () => {
    expect(waehleRueckblick(liste, '17')?.id).toBe(2);
    expect(waehleRueckblick(liste, '42')?.id).toBe(3);
  });

  it('"neuester" -> der erste Eintrag', () => {
    expect(waehleRueckblick(liste, RUECKBLICK_NEUESTER)?.id).toBe(3);
  });

  it('unbekannte Kennung -> der neueste statt nichts', () => {
    expect(waehleRueckblick(liste, '999')?.id).toBe(3);
  });

  it('Alt-Snapshot ohne ausgabe_id wird nicht ueber "null" getroffen', () => {
    expect(waehleRueckblick(liste, 'null')?.id).toBe(3);
  });

  it('leere Liste -> null', () => {
    expect(waehleRueckblick([], '42')).toBeNull();
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
