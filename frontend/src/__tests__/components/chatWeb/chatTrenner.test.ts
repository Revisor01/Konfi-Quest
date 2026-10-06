// Tages-Trenner und der einmalige "Neue Nachrichten"-Trenner
// (components/chat/chatVerlauf.ts): die App-Liste und die der Web-Fassung
// verankern ihn mit derselben Funktion.
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { Message } from '../../../types/chat';
import { gezeigteTrennerAnkerLeeren, neuenTrennerVerankern, tagesTrennerText } from '../../../components/chat/chatVerlauf';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const n = (id: number): Message => ({
  id, content: `Nachricht ${id}`, sender_id: 2, sender_name: 'Kim', sender_type: 'konfi',
  created_at: '2026-10-03T08:00:00.000Z', message_type: 'text',
});
const reihe = (von: number, bis: number) => Array.from({ length: bis - von + 1 }, (_, i) => n(von + i));
const ref = <T,>(wert: T) => ({ current: wert });

beforeEach(() => gezeigteTrennerAnkerLeeren());

describe('Tages-Trenner', () => {
  const jetzt = new Date('2026-10-03T12:00:00+02:00');

  it('Heute, Gestern, sonst das Datum', () => {
    expect(tagesTrennerText(new Date('2026-10-03T08:00:00+02:00'), jetzt)).toBe('Heute');
    expect(tagesTrennerText(new Date('2026-10-02T23:00:00+02:00'), jetzt)).toBe('Gestern');
    expect(tagesTrennerText(new Date('2026-09-30T08:00:00+02:00'), jetzt)).toBe('30.09.2026');
  });

  it('"Gestern" gilt auch ueber einen Monatswechsel', () => {
    expect(tagesTrennerText(new Date('2026-09-30T20:00:00+02:00'), new Date('2026-10-01T09:00:00+02:00'))).toBe('Gestern');
  });
});

describe('Anker des "Neue Nachrichten"-Trenners', () => {
  it('die erste ungelesene Nachricht ist die N-te von hinten', () => {
    const anker = ref<number | null>(null);
    const ungelesen = ref<number | null>(3);
    neuenTrennerVerankern(reihe(1, 10), 7, ungelesen, anker);
    expect(anker.current).toBe(8);
    expect(ungelesen.current).toBe(3);
  });

  it('einmal verankert, wandert er mit neuen Nachrichten nicht mit', () => {
    const anker = ref<number | null>(null);
    const ungelesen = ref<number | null>(3);
    neuenTrennerVerankern(reihe(1, 10), 7, ungelesen, anker);
    neuenTrennerVerankern(reihe(1, 14), 7, ungelesen, anker);
    expect(anker.current).toBe(8);
  });

  it('ohne Ungelesene, oder mit mehr Ungelesenen als Nachrichten da sind, kein Trenner', () => {
    const anker = ref<number | null>(null);
    neuenTrennerVerankern(reihe(1, 10), 7, ref<number | null>(0), anker);
    neuenTrennerVerankern(reihe(1, 10), 7, ref<number | null>(null), anker);
    neuenTrennerVerankern(reihe(1, 3), 7, ref<number | null>(5), anker);
    expect(anker.current).toBeNull();
  });

  it('eine eigene, noch nicht gesendete Nachricht (negative id) wird nie zum Anker', () => {
    const anker = ref<number | null>(null);
    const liste = [...reihe(1, 4), n(-1000)];
    neuenTrennerVerankern(liste, 7, ref<number | null>(1), anker);
    expect(anker.current).toBeNull();
  });

  it('derselbe Anker erscheint in demselben Raum nur einmal -- nach dem Wiederbetreten ist er unterdrueckt, ein neuer zaehlt', () => {
    const erster = ref<number | null>(null);
    const ungelesen = ref<number | null>(3);
    neuenTrennerVerankern(reihe(1, 10), 7, ungelesen, erster);
    expect(erster.current).toBe(8);

    // Raum verlassen und wieder betreten: derselbe Stand, derselbe Anker -> unterdrueckt.
    const zweiter = ref<number | null>(null);
    const ungelesen2 = ref<number | null>(3);
    neuenTrennerVerankern(reihe(1, 10), 7, ungelesen2, zweiter);
    expect(zweiter.current).toBeNull();
    expect(ungelesen2.current).toBe(0);

    // Seither kamen zwei Nachrichten dazu: ein neuer Anker, der Trenner steht wieder.
    const dritter = ref<number | null>(null);
    neuenTrennerVerankern(reihe(1, 12), 7, ref<number | null>(2), dritter);
    expect(dritter.current).toBe(11);

    // Ein anderer Raum ist unabhaengig.
    const anderer = ref<number | null>(null);
    neuenTrennerVerankern(reihe(1, 10), 8, ref<number | null>(3), anderer);
    expect(anderer.current).toBe(8);
  });
});
