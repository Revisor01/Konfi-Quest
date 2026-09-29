// Socket-Verdrahtung des Chatraums (useChatSocket) -- Verhaltenstest.
//
// Anlass: Audit Tests 26.09.2026, BF-10 -- der Chat-Socket hatte keinen
// eigenen Test, obwohl hier entschieden wird, welche Live-Nachricht in
// welchem Raum erscheint. Gerendert wird der echte Hook mit echtem
// React-Zustand fuer die Nachrichten; ersetzt ist nur der Socket selbst (ein
// Nachbau, der Ereignisse auf Kommando ausloest) und die Warteschlange.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import type { Message, Reaction } from '../../types/chat';

type Rueckruf = (daten: unknown) => void;
const socketNachbau = {
  connected: true,
  handler: new Map<string, Rueckruf[]>(),
  on(ereignis: string, fn: Rueckruf) {
    this.handler.set(ereignis, [...(this.handler.get(ereignis) ?? []), fn]);
  },
  off(ereignis: string) {
    this.handler.delete(ereignis);
  },
  ausloesen(ereignis: string, daten?: unknown) {
    for (const fn of this.handler.get(ereignis) ?? []) fn(daten);
  },
};
const joinRoom = vi.fn();
const leaveRoom = vi.fn();
let reconnectRueckruf: (() => void) | null = null;
const abmelden = vi.fn();
let token: string | null = 'sitzung';

vi.mock('../../services/websocket', () => ({
  initializeWebSocket: () => socketNachbau,
  getSocket: () => socketNachbau,
  joinRoom: (id: number) => joinRoom(id),
  leaveRoom: (id: number) => leaveRoom(id),
  onReconnect: (fn: () => void) => { reconnectRueckruf = fn; return abmelden; },
}));
vi.mock('../../services/tokenStore', () => ({ getToken: () => token }));
const forgetFailedChat = vi.fn();
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { forgetFailedChat: (id: string) => forgetFailedChat(id) },
}));

import { useChatSocket } from '../../components/chat/useChatSocket';

const RAUM = 7;
const FREMDER_RAUM = 8;

const nachricht = (id: number, zusatz: Partial<Message> = {}): Message => ({
  id,
  content: `Nachricht ${id}`,
  sender_id: 2,
  sender_name: 'Kim',
  sender_type: 'konfi',
  created_at: '2026-09-01T08:00:00.000Z',
  message_type: 'text',
  ...zusatz,
});

const refreshMessagesCache = vi.fn();
const markRoomAsRead = vi.fn();
const loadMessages = vi.fn(async () => undefined);
const loadMissedMessages = vi.fn(async (_nachId: number) => undefined);

interface Aufbau {
  // null = kein Raum (undefined wuerde den Standardwert nehmen)
  roomId?: number | null;
  start?: Message[];
  ungelesenImKontext?: Record<number, number>;
  ungelesenAmRaum?: number;
}

function starte({ roomId = RAUM, start = [nachricht(1), nachricht(2)], ungelesenImKontext = {}, ungelesenAmRaum }: Aufbau = {}) {
  return renderHook(({ raum }: { raum: number | undefined }) => {
    const [messages, setMessages] = useState<Message[]>(start);
    const initialUnreadRef = useRef<number | null>(null);
    const newDividerAnchorRef = useRef<number | null>(5);
    const pendingSendsRef = useRef(new Set<string>(['c-eigen']));
    useChatSocket({
      roomId: raum,
      roomUnreadCount: ungelesenAmRaum,
      userId: 3,
      chatUnreadByRoom: ungelesenImKontext,
      messages,
      initialUnreadRef,
      newDividerAnchorRef,
      pendingSendsRef,
      setMessages,
      refreshMessagesCache,
      markRoomAsRead,
      loadMessages,
      loadMissedMessages,
    });
    return { messages, initialUnreadRef, newDividerAnchorRef, pendingSendsRef };
  }, { initialProps: { raum: roomId ?? undefined } });
}

const ausloesen = (ereignis: string, daten?: unknown) => act(() => { socketNachbau.ausloesen(ereignis, daten); });
const ids = (m: Message[]) => m.map((n) => n.id);

beforeEach(() => {
  socketNachbau.handler.clear();
  socketNachbau.connected = true;
  token = 'sitzung';
  reconnectRueckruf = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Raum betreten und verlassen', () => {
  it('tritt dem Raum sofort bei, wenn der Socket verbunden ist, und meldet ihn als gelesen', () => {
    starte();
    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledWith(RAUM);
    expect(markRoomAsRead).toHaveBeenCalledTimes(1);
  });

  it('tritt nach jedem Wiederverbinden erneut bei', () => {
    socketNachbau.connected = false;
    starte();
    expect(joinRoom).not.toHaveBeenCalled();
    ausloesen('connect');
    ausloesen('connect');
    expect(joinRoom).toHaveBeenCalledTimes(2);
    expect(joinRoom).toHaveBeenLastCalledWith(RAUM);
  });

  it('friert die Ungelesen-Zahl beim Betreten ein -- zuerst aus dem Kontext, sonst vom Raum', () => {
    const ausKontext = starte({ ungelesenImKontext: { [RAUM]: 4 }, ungelesenAmRaum: 9 });
    expect(ausKontext.result.current.initialUnreadRef.current).toBe(4);
    ausKontext.unmount();

    const vomRaum = starte({ ungelesenImKontext: { [FREMDER_RAUM]: 4 }, ungelesenAmRaum: 9 });
    expect(vomRaum.result.current.initialUnreadRef.current).toBe(9);
    vomRaum.unmount();

    const ohne = starte();
    expect(ohne.result.current.initialUnreadRef.current).toBe(0);
  });

  it('verlaesst den Raum beim Schliessen, meldet alle Ereignisse ab und verwirft den Neu-Trenner', () => {
    const { result, unmount } = starte({ ungelesenAmRaum: 2 });
    const refs = result.current;
    expect(socketNachbau.handler.size).toBe(8);
    unmount();
    expect(leaveRoom).toHaveBeenCalledWith(RAUM);
    expect(socketNachbau.handler.size).toBe(0);
    expect(refs.initialUnreadRef.current).toBe(null);
    expect(refs.newDividerAnchorRef.current).toBe(null);
    expect(abmelden).toHaveBeenCalledTimes(1);
  });

  it('beim Raumwechsel: alten Raum verlassen, neuen betreten', () => {
    const { rerender } = starte();
    rerender({ raum: FREMDER_RAUM });
    expect(leaveRoom).toHaveBeenCalledWith(RAUM);
    expect(joinRoom).toHaveBeenLastCalledWith(FREMDER_RAUM);
  });

  it('ohne Raum passiert nichts', () => {
    starte({ roomId: null });
    expect(joinRoom).not.toHaveBeenCalled();
    expect(markRoomAsRead).not.toHaveBeenCalled();
    expect(socketNachbau.handler.size).toBe(0);
  });

  it('ohne Sitzung kein Socket -- der Raum wird trotzdem als gelesen gemeldet', () => {
    token = null;
    starte();
    expect(joinRoom).not.toHaveBeenCalled();
    expect(socketNachbau.handler.size).toBe(0);
    expect(markRoomAsRead).toHaveBeenCalledTimes(1);
  });
});

describe('Neue Nachrichten', () => {
  it('haengt eine Nachricht fuer DIESEN Raum an', () => {
    const { result } = starte();
    ausloesen('newMessage', { roomId: RAUM, message: nachricht(3) });
    expect(ids(result.current.messages)).toEqual([1, 2, 3]);
  });

  it('zeigt eine Nachricht aus einem ANDEREN Raum nicht an', () => {
    const { result } = starte();
    ausloesen('newMessage', { roomId: FREMDER_RAUM, message: nachricht(3, { content: 'Geheim' }) });
    expect(ids(result.current.messages)).toEqual([1, 2]);
    expect(result.current.messages.some((m) => m.content === 'Geheim')).toBe(false);
  });

  it('nimmt dieselbe Nachricht nicht zweimal auf', () => {
    const { result } = starte();
    ausloesen('newMessage', { roomId: RAUM, message: nachricht(2) });
    expect(ids(result.current.messages)).toEqual([1, 2]);
  });

  it('ersetzt die eigene optimistische Kopie an Ort und Stelle und vergisst den Fehlschlag-Merker', () => {
    const optimistisch = nachricht(-1, { clientId: 'c-eigen', content: 'Hallo', queueStatus: 'pending' });
    const { result } = starte({ start: [nachricht(1), optimistisch, nachricht(2)] });
    ausloesen('newMessage', { roomId: RAUM, message: nachricht(10, { client_id: 'c-eigen', content: 'Hallo' }) });

    expect(ids(result.current.messages)).toEqual([1, 10, 2]);
    expect(result.current.messages[1].queueStatus).toBe(undefined);
    expect(result.current.pendingSendsRef.current.has('c-eigen')).toBe(false);
    expect(forgetFailedChat).toHaveBeenCalledWith('c-eigen');
  });
});

describe('Loeschen, Leeren, Reaktionen, Umfragen', () => {
  it('eine geloeschte Nachricht zeigt den Platzhalter, die anderen bleiben', () => {
    const { result } = starte();
    ausloesen('messageDeleted', { roomId: RAUM, messageId: 2 });
    const [eins, zwei] = result.current.messages;
    expect(eins.content).toBe('Nachricht 1');
    expect(zwei.is_deleted).toBe(1);
    expect(zwei.content).toBe('Diese Nachricht wurde gelöscht');
  });

  it('Loeschen in einem anderen Raum aendert hier nichts', () => {
    const { result } = starte();
    ausloesen('messageDeleted', { roomId: FREMDER_RAUM, messageId: 2 });
    expect(result.current.messages[1].content).toBe('Nachricht 2');
  });

  it('ein geleerter Chat ist sofort leer und die Cache-Kopie wird aufgefrischt', () => {
    const { result } = starte();
    ausloesen('chatCleared', { roomId: FREMDER_RAUM });
    expect(ids(result.current.messages)).toEqual([1, 2]);
    expect(refreshMessagesCache).not.toHaveBeenCalled();

    ausloesen('chatCleared', { roomId: RAUM });
    expect(result.current.messages).toEqual([]);
    expect(refreshMessagesCache).toHaveBeenCalledTimes(1);
  });

  it('Reaktion dazu (ohne Doppel) und wieder weg -- nur die der Person mit diesem Zeichen', () => {
    const daumen: Reaction = { id: 50, emoji: '👍', user_id: 4, user_type: 'teamer', user_name: 'Tom' };
    const herz: Reaction = { id: 51, emoji: '❤️', user_id: 4, user_type: 'teamer', user_name: 'Tom' };
    const { result } = starte();
    ausloesen('reactionAdded', { roomId: RAUM, messageId: 1, reaction: daumen });
    ausloesen('reactionAdded', { roomId: RAUM, messageId: 1, reaction: daumen });
    ausloesen('reactionAdded', { roomId: RAUM, messageId: 1, reaction: herz });
    expect(result.current.messages[0].reactions?.map((r) => r.id)).toEqual([50, 51]);
    expect(result.current.messages[1].reactions).toBe(undefined);

    ausloesen('reactionRemoved', { roomId: RAUM, messageId: 1, userId: 4, userType: 'teamer', emoji: '👍' });
    expect(result.current.messages[0].reactions?.map((r) => r.id)).toEqual([51]);
  });

  it('eine aktualisierte Umfrage ersetzt nur den Umfrage-Teil ihrer Nachricht', () => {
    const umfrage = nachricht(2, { message_type: 'poll', question: 'Pizza?', options: ['Ja', 'Nein'], votes: [] });
    const { result } = starte({ start: [nachricht(1), umfrage] });
    const stimmen = [{ option_index: 0, user_id: 3, user_type: 'konfi', voter_name: 'Kim' }];
    ausloesen('pollUpdated', {
      roomId: RAUM,
      messageId: 2,
      poll: { poll_id: 9, message_id: 2, question: 'Pizza?', options: ['Ja', 'Nein'], multiple_choice: false, anonymous: false, exclusive_options: false, expires_at: null, votes: stimmen },
    });
    const neu = result.current.messages[1];
    expect(neu.votes).toEqual(stimmen);
    expect(neu.poll_id).toBe(9);
    expect(neu.content).toBe('Nachricht 2');
    expect(result.current.messages[0]).toEqual(nachricht(1));

    ausloesen('pollUpdated', { roomId: RAUM, messageId: 2, poll: null });
    expect(result.current.messages[1].votes).toEqual(stimmen);
  });
});

describe('Nachladen, wenn der Socket schweigt', () => {
  it('fragt alle 30 s nur nach Neuem ab der letzten Server-Kennung', async () => {
    vi.useFakeTimers();
    starte();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
    expect(loadMissedMessages).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(loadMissedMessages).toHaveBeenCalledTimes(1);
    expect(loadMissedMessages).toHaveBeenCalledWith(2);
    expect(loadMessages).not.toHaveBeenCalled();
  });

  it('laedt alles neu, wenn die letzte Nachricht noch keine Server-Kennung hat oder die Liste leer ist', async () => {
    vi.useFakeTimers();
    const ohneServerId = starte({ start: [nachricht(1), nachricht(-3, { clientId: 'c-x' })] });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(loadMessages).toHaveBeenCalledTimes(1);
    expect(loadMissedMessages).not.toHaveBeenCalled();
    ohneServerId.unmount();

    starte({ start: [] });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(loadMessages).toHaveBeenCalledTimes(2);
  });

  it('fragt nicht ab, solange die Seite im Hintergrund liegt', async () => {
    vi.useFakeTimers();
    const sichtbarkeit = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      starte();
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(loadMissedMessages).not.toHaveBeenCalled();
      expect(loadMessages).not.toHaveBeenCalled();
    } finally {
      sichtbarkeit.mockRestore();
    }
  });

  it('holt nach dem Wiederverbinden das Verpasste nach', () => {
    starte();
    expect(reconnectRueckruf).not.toBe(null);
    act(() => { reconnectRueckruf?.(); });
    expect(loadMissedMessages).toHaveBeenCalledWith(2);
  });

  it('nach dem Wiederverbinden mit leerer Liste: alles laden', () => {
    starte({ start: [] });
    act(() => { reconnectRueckruf?.(); });
    expect(loadMessages).toHaveBeenCalledTimes(1);
    expect(loadMissedMessages).not.toHaveBeenCalled();
  });
});
