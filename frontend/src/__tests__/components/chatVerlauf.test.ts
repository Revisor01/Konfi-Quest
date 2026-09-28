import { describe, it, expect, vi } from 'vitest';

// chatOutbox (mergeMitLokalen) zieht Filesystem und writeQueue mit herein —
// fuer die reine Zusammenfuehrung werden sie nicht gebraucht.
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: { Data: 'DATA' } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: {} }));

import {
  AELTERE_SEITE,
  ERSTER_BLOCK,
  aeltereVoranstellen,
  aeltesteServerId,
  anfangErreicht,
  juengstenBlockEinpflegen,
} from '../../components/chat/chatVerlauf';
import type { Message } from '../../types/chat';

// ---------------------------------------------------------------------------
// Blaettern im Chatverlauf (Audit 26.09.2026, app-screens-konfi-teamer BF-04;
// Simon, 28.09.2026: „Chat lädt nur 100 und kein Nachladen. Das muss anders.")
//
// Die reine Zusammenfuehrung: aeltere Seite oben einfuegen ohne Dubletten,
// den juengsten Block einpflegen ohne die bereits nachgeladenen aelteren
// Nachrichten wegzuwerfen, und erkennen, wann der Anfang erreicht ist.
// Gerendert (Nachladen beim Hochscrollen, Scrollposition, Hinweis) prueft es
// chatAeltereNachrichten.test.tsx.
// ---------------------------------------------------------------------------

const n = (id: number, extra: Partial<Message> = {}): Message => ({
  id,
  content: `Nachricht ${id}`,
  sender_id: 1,
  sender_name: 'Kim',
  sender_type: 'konfi',
  created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, id)).toISOString(),
  message_type: 'text',
  ...extra,
});
const reihe = (von: number, bis: number) => Array.from({ length: bis - von + 1 }, (_, i) => n(von + i));
const lokal = (localId: string, status: 'pending' | 'error' = 'pending'): Message =>
  n(-Number(localId.replace(/\D/g, '') || 1), { localId, clientId: localId, queueStatus: status });
const ids = (liste: Message[]) => liste.map(m => m.id);

describe('Seitengroessen', () => {
  it('oeffnet mit 100 (wie die ausgelieferten Apps) und laedt je 50 aeltere nach', () => {
    expect(ERSTER_BLOCK).toBe(100);
    expect(AELTERE_SEITE).toBe(50);
  });
});

describe('aeltesteServerId', () => {
  it('nimmt die erste Server-Nachricht der chronologischen Liste', () => {
    expect(aeltesteServerId(reihe(40, 45))).toBe(40);
  });

  it('ueberspringt lokale Nachrichten (negative id) — der Server kennt sie nicht', () => {
    expect(aeltesteServerId([lokal('a1'), ...reihe(7, 9)])).toBe(7);
  });

  it('ohne Server-Nachricht: null (dann gibt es keinen Anker)', () => {
    expect(aeltesteServerId([])).toBeNull();
    expect(aeltesteServerId([lokal('a1')])).toBeNull();
  });
});

describe('aeltereVoranstellen', () => {
  it('setzt die aeltere Seite vor die vorhandene Liste', () => {
    const neu = aeltereVoranstellen(reihe(51, 60), reihe(41, 50));
    expect(ids(neu)).toEqual(ids(reihe(41, 60)));
  });

  it('fuehrt nach id zusammen: keine Nachricht zweimal', () => {
    // Zwei Antworten, die sich ueberholen, oder eine Nachricht, die schon da
    // ist: 50 und 51 stehen in beiden.
    const neu = aeltereVoranstellen(reihe(50, 60), reihe(41, 51));
    expect(ids(neu)).toEqual(ids(reihe(41, 60)));
    expect(new Set(ids(neu)).size).toBe(neu.length);
  });

  it('die vorhandene Fassung gewinnt (sie kann per Socket neuer sein)', () => {
    const vorhanden = [n(50, { content: 'Diese Nachricht wurde gelöscht', is_deleted: 1 }), ...reihe(51, 52)];
    const neu = aeltereVoranstellen(vorhanden, [n(49), n(50, { content: 'alter Stand' })]);
    expect(neu.find(m => m.id === 50)?.content).toBe('Diese Nachricht wurde gelöscht');
  });

  it('nichts Neues: dieselbe Liste (kein unnoetiges Neuzeichnen)', () => {
    const vorhanden = reihe(1, 5);
    expect(aeltereVoranstellen(vorhanden, [])).toBe(vorhanden);
    expect(aeltereVoranstellen(vorhanden, reihe(1, 3))).toBe(vorhanden);
  });

  it('lokale Nachrichten am Ende bleiben am Ende', () => {
    const neu = aeltereVoranstellen([...reihe(51, 52), lokal('x9')], reihe(49, 50));
    expect(ids(neu)).toEqual([49, 50, 51, 52, -9]);
  });
});

describe('juengstenBlockEinpflegen', () => {
  it('behaelt bereits nachgeladene aeltere Nachrichten, wenn der Block anschliesst', () => {
    // Geladen: 1..150 (100 beim Oeffnen + 50 nachgeladen). Der Block nach
    // dem Loeschen einer Nachricht oder einem Pull-to-Refresh: 52..151.
    const vorher = reihe(1, 150);
    const block = reihe(52, 151);

    const neu = juengstenBlockEinpflegen(block, vorher);

    expect(ids(neu)).toEqual(ids(reihe(1, 151)));
  });

  it('uebernimmt den Serverstand im Block (etwa eine inzwischen geloeschte Nachricht)', () => {
    const vorher = reihe(1, 150);
    const block = reihe(51, 150).map(m => (m.id === 60 ? { ...m, content: 'Diese Nachricht wurde gelöscht' } : m));

    const neu = juengstenBlockEinpflegen(block, vorher);

    expect(neu).toHaveLength(150);
    expect(neu.find(m => m.id === 60)?.content).toBe('Diese Nachricht wurde gelöscht');
  });

  it('wirft die aelteren weg, wenn der Block NICHT anschliesst (keine unsichtbare Luecke)', () => {
    // Lange weg: Zwischen 150 und dem neuen Block liegen Nachrichten, die
    // niemand geladen hat. Behielte die Liste 1..150, fehlten 151..199 still.
    const vorher = reihe(1, 150);
    const block = reihe(200, 299);

    expect(ids(juengstenBlockEinpflegen(block, vorher))).toEqual(ids(block));
  });

  it('ein Block unter der angeforderten Groesse ist der ganze Chat — nichts Aelteres behalten', () => {
    const vorher = reihe(1, 60);
    const block = reihe(30, 60);

    expect(ids(juengstenBlockEinpflegen(block, vorher, 100))).toEqual(ids(block));
  });

  it('beim ersten Laden (leere Liste) gilt der Block', () => {
    expect(ids(juengstenBlockEinpflegen(reihe(1, 100), []))).toEqual(ids(reihe(1, 100)));
  });

  it('leerer Block (Chat geleert): nur noch lokale Nachrichten', () => {
    const wartend = lokal('w3');
    expect(juengstenBlockEinpflegen([], [...reihe(1, 150), wartend])).toEqual([wartend]);
  });

  it('noch nicht zugestellte lokale Nachrichten stehen genau einmal am Ende', () => {
    // Die lokale Nachricht steht MITTEN in der Liste, weil danach per Socket
    // noch Nachrichten anderer ankamen.
    const wartend = lokal('w5');
    const vorher = [...reihe(1, 120), wartend, ...reihe(121, 150)];
    const block = reihe(51, 150);

    const neu = juengstenBlockEinpflegen(block, vorher);

    expect(ids(neu)).toEqual([...ids(reihe(1, 150)), -5]);
  });

  it('keine Dubletten, auch wenn die Liste den Block schon ganz enthaelt', () => {
    const vorher = reihe(1, 150);
    const neu = juengstenBlockEinpflegen(reihe(51, 150), vorher);
    expect(new Set(ids(neu)).size).toBe(neu.length);
    expect(neu).toHaveLength(150);
  });
});

describe('anfangErreicht', () => {
  it('ja, solange die gemerkte Nachricht die aelteste ist', () => {
    expect(anfangErreicht(reihe(1, 10), 1)).toBe(true);
  });

  it('nein, wenn die Liste inzwischen anders anfaengt (Block ohne Anschluss)', () => {
    expect(anfangErreicht(reihe(200, 299), 1)).toBe(false);
  });

  it('nein ohne Merker und bei leerer Liste', () => {
    expect(anfangErreicht(reihe(1, 10), null)).toBe(false);
    expect(anfangErreicht([], 1)).toBe(false);
  });
});
