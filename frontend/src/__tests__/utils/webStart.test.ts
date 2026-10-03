// Rechenhilfen der Web-Fassung von Start, Badges und Profil
// (utils/webStart.ts, 03.10.2026): Restzeit einer Challenge, Prozente gegen
// ein Ziel, Zeile eines Events, Datumsblock, Naehe und die Auswahl der
// Rangliste. Die Erwartungen stehen als konkrete Werte da -- keine weichen
// Pruefungen.
import { describe, it, expect } from 'vitest';
import {
  challengeRestzeit,
  datumsBlock,
  istNeu,
  naehe,
  rangAuswahl,
  startEvent,
  zielProzent,
} from '../../utils/webStart';
import type { Event } from '../../types/event';
import type { RankingEntry } from '../../types/dashboard';

const JETZT = new Date('2026-10-03T08:30:00Z');

describe('challengeRestzeit', () => {
  const ende = (ms: number) => new Date(JETZT.getTime() + ms).toISOString();

  it('nennt Tage, Stunden und den letzten Tag', () => {
    expect(challengeRestzeit(ende(5 * 86_400_000 + 3600_000), JETZT.getTime())).toBe('noch 5 Tage');
    expect(challengeRestzeit(ende(86_400_000 + 1000), JETZT.getTime())).toBe('noch 1 Tag');
    expect(challengeRestzeit(ende(3 * 3_600_000 + 1000), JETZT.getTime())).toBe('noch 3 Stunden');
    expect(challengeRestzeit(ende(3_600_000 + 1000), JETZT.getTime())).toBe('noch 1 Stunde');
    expect(challengeRestzeit(ende(20 * 60_000), JETZT.getTime())).toBe('endet heute');
  });

  it('sagt „Zeit abgelaufen" bei Vergangenem und bei Muell', () => {
    expect(challengeRestzeit(ende(-1000), JETZT.getTime())).toBe('Zeit abgelaufen');
    expect(challengeRestzeit('kein Datum', JETZT.getTime())).toBe('Zeit abgelaufen');
    expect(challengeRestzeit(null, JETZT.getTime())).toBe('Zeit abgelaufen');
  });
});

describe('zielProzent', () => {
  it('rechnet gerundet gegen das Ziel, auch darueber hinaus', () => {
    expect(zielProzent(8, 10)).toBe(80);
    expect(zielProzent(1, 3)).toBe(33);
    expect(zielProzent(14, 10)).toBe(140);
  });

  it('gibt ohne Ziel oder bei Unsinn 0 zurueck', () => {
    expect(zielProzent(5, 0)).toBe(0);
    expect(zielProzent(5, -2)).toBe(0);
    expect(zielProzent(Number.NaN, 10)).toBe(0);
    expect(zielProzent(-3, 10)).toBe(0);
  });
});

describe('istNeu', () => {
  it('ist jünger als eine Woche', () => {
    expect(istNeu('2026-09-30T08:30:00Z', JETZT.getTime())).toBe(true);
    expect(istNeu('2026-09-26T08:30:00Z', JETZT.getTime())).toBe(false);
    expect(istNeu(null, JETZT.getTime())).toBe(false);
    expect(istNeu('Unsinn', JETZT.getTime())).toBe(false);
  });
});

describe('startEvent', () => {
  const basis = (extra: Partial<Event>): Event => ({
    id: 5, name: 'Konfi-Samstag', title: 'Konfi-Samstag', event_date: '2026-10-05T08:00:00.000Z',
    points: 2, type: 'event', max_participants: 30, registered_count: 4, ...extra,
  });

  it('bereitet ein bestaetigtes Event auf', () => {
    const e = startEvent(basis({ booking_status: 'confirmed', location: ' Gemeindehaus ', bring_items: 'Stifte' }), JETZT);
    expect(e).toMatchObject({
      id: 5, titel: 'Konfi-Samstag', datum: 'Mo., 05.10.2026', zeit: '10:00', ort: 'Gemeindehaus',
      mitbringen: 'Stifte', status: 'dabei', wartePlatz: null, grund: null, tage: 2,
    });
  });

  it('nimmt das gebuchte Zeitfenster statt des Beginns', () => {
    const e = startEvent(basis({
      booked_timeslot_start: '2026-10-05T17:00:00.000Z', booked_timeslot_end: '2026-10-05T18:00:00.000Z',
    }), JETZT);
    expect(e.zeit).toBe('19:00 – 20:00');
  });

  it('erkennt Warteliste samt Platz und Absage samt Grund', () => {
    expect(startEvent(basis({ booking_status: 'waitlist', waitlist_position: 2 }), JETZT))
      .toMatchObject({ status: 'warteliste', wartePlatz: 2 });
    expect(startEvent(basis({ booking_status: 'pending' }), JETZT)).toMatchObject({ status: 'warteliste', wartePlatz: null });
    expect(startEvent(basis({ cancelled: true, cancelled_reason: ' Wasserschaden ' }), JETZT))
      .toMatchObject({ status: 'abgesagt', grund: 'Wasserschaden' });
  });

  it('faellt ohne title auf name und ohne Ort auf null', () => {
    const e = startEvent(basis({ title: undefined, name: 'Nur Name', location: '  ' }), JETZT);
    expect(e.titel).toBe('Nur Name');
    expect(e.ort).toBeNull();
  });
});

describe('datumsBlock und naehe', () => {
  it('liest Wochentag, Tag ohne fuehrende Null und Monat als Wort', () => {
    expect(datumsBlock('2026-10-05T08:00:00.000Z')).toEqual({ wochentag: 'Mo.', tag: '5', monat: 'Okt.' });
    expect(datumsBlock('2026-03-14T12:00:00.000Z')).toEqual({ wochentag: 'Sa.', tag: '14', monat: 'März' });
    expect(datumsBlock('2026-09-09T12:00:00.000Z')).toEqual({ wochentag: 'Mi.', tag: '9', monat: 'Sept.' });
  });

  it('gibt bei einem ungueltigen Datum null zurueck', () => {
    expect(datumsBlock('kein Datum')).toBeNull();
  });

  it('nennt die Naehe in einem Wort', () => {
    expect(naehe(-1)).toBe('läuft');
    expect(naehe(0)).toBe('heute');
    expect(naehe(1)).toBe('morgen');
    expect(naehe(6)).toBe('in 6 Tagen');
    expect(naehe(21)).toBe('in 3 Wochen');
    expect(naehe(120)).toBe('in 4 Monaten');
  });
});

describe('rangAuswahl', () => {
  const liste: RankingEntry[] = [
    { id: 21, display_name: 'Lena Muster', points: 31, initials: 'LM' },
    { id: 22, display_name: 'Ben Vorlage', points: 27, initials: 'BV' },
    { id: 23, display_name: 'Nele Probe', points: 24, initials: 'NP' },
  ];
  const initialen = (n: string) => n.split(' ').map((w) => w[0]).join('');
  const waehle = (eigenerPlatz: number, gesamt = 24, ranking = liste) => rangAuswahl({
    ranking, eigenerPlatz, gesamtImJahrgang: gesamt, konfiId: 7, konfiName: 'Mia Beispiel', konfiPunkte: 19, initialen,
  });

  it('auf Platz 1 bis 3: die ersten drei Plaetze des Servers', () => {
    const z = waehle(2);
    expect(z.map((r) => ('separator' in r ? '…' : `${r.actualRank}:${r.display_name}`))).toEqual([
      '1:Lena Muster', '2:Ben Vorlage', '3:Nele Probe',
    ]);
  });

  it('weiter hinten: Platz 1, Trenner, Vorgaenger, man selbst mit Punkten, Nachfolger ohne Punkte', () => {
    const z = waehle(5);
    expect(z).toHaveLength(5);
    expect(z[1]).toEqual({ separator: true });
    expect(z[2]).toMatchObject({ actualRank: 4, display_name: 'Konfi vor dir', points: null, isNeighbor: true });
    expect(z[3]).toMatchObject({ actualRank: 5, display_name: 'Mia Beispiel', points: 19, initials: 'MB', isCurrentUser: true });
    expect(z[4]).toMatchObject({ actualRank: 6, display_name: 'Konfi nach dir', points: null, isNeighbor: true });
  });

  it('auf dem letzten Platz gibt es keinen Nachfolger', () => {
    const z = waehle(24, 24);
    expect(z.filter((r) => !('separator' in r)).map((r) => (r as RankingEntry).actualRank)).toEqual([1, 23, 24]);
  });

  it('ohne Ranking-Liste bleibt es bei den Zeilen um den eigenen Platz', () => {
    const z = waehle(1, 1, []);
    expect(z).toEqual([]);
  });
});
