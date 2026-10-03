// Der Chatraum raeumt beim Verlassen NUR seine eigenen Socket-Horcher ab.
//
// Anlass: Web-Fassung des Chats (03.10.2026). Dort bleibt die Raumliste mit
// ihren roten Zahlen neben dem Raum stehen, und jeder Raumwechsel verlaesst
// einen Raum. useChatSocket rief beim Verlassen socket.off('newMessage') ohne
// den Horcher -- das entfernt ALLE Horcher dieses Ereignisses, auch den des
// BadgeContext (der die Zahlen aktualisiert) und das 'connect' aus
// services/websocket.ts. Danach kam keine rote Zahl mehr live an, bis die
// Verbindung neu aufgebaut wurde. In der App fiel das kaum auf, weil man nach
// dem Verlassen in der Liste landet und sie neu laedt.
//
// Der Socket-Nachbau kennt, anders als der in chatSocketVerhalten, den
// Unterschied zwischen "diesen Horcher entfernen" und "alle entfernen".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRef, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import type { Message } from '../../types/chat';

type Rueckruf = (daten: unknown) => void;
const socketNachbau = {
  connected: true,
  handler: new Map<string, Rueckruf[]>(),
  on(ereignis: string, fn: Rueckruf) {
    this.handler.set(ereignis, [...(this.handler.get(ereignis) ?? []), fn]);
  },
  off(ereignis: string, fn?: Rueckruf) {
    if (!fn) this.handler.delete(ereignis);
    else this.handler.set(ereignis, (this.handler.get(ereignis) ?? []).filter((h) => h !== fn));
  },
  ausloesen(ereignis: string, daten?: unknown) {
    for (const fn of [...(this.handler.get(ereignis) ?? [])]) fn(daten);
  },
};

vi.mock('../../services/websocket', () => ({
  initializeWebSocket: () => socketNachbau,
  getSocket: () => socketNachbau,
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  onReconnect: () => () => undefined,
}));
vi.mock('../../services/tokenStore', () => ({ getToken: () => 'sitzung' }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { forgetFailedChat: vi.fn() } }));

import { useChatSocket } from '../../components/chat/useChatSocket';

const EREIGNISSE = ['connect', 'newMessage', 'messageDeleted', 'chatCleared', 'userTyping', 'reactionAdded', 'reactionRemoved', 'pollUpdated'];

const nachricht = (id: number): Message => ({
  id, content: `Nachricht ${id}`, sender_id: 2, sender_name: 'Kim', sender_type: 'konfi',
  created_at: '2026-09-01T08:00:00.000Z', message_type: 'text',
});

function starte() {
  return renderHook(({ raum }: { raum: number }) => {
    const [messages, setMessages] = useState<Message[]>([nachricht(1)]);
    useChatSocket({
      roomId: raum,
      roomUnreadCount: 0,
      userId: 3,
      chatUnreadByRoom: {},
      messages,
      initialUnreadRef: useRef<number | null>(null),
      newDividerAnchorRef: useRef<number | null>(null),
      pendingSendsRef: useRef(new Set<string>()),
      setMessages,
      refreshMessagesCache: vi.fn(),
      markRoomAsRead: vi.fn(),
      loadMessages: vi.fn(async () => undefined),
      loadMissedMessages: vi.fn(async () => undefined),
    });
    return messages;
  }, { initialProps: { raum: 7 } });
}

beforeEach(() => {
  socketNachbau.handler.clear();
  socketNachbau.connected = true;
});

describe('Chatraum verlassen: fremde Socket-Horcher bleiben', () => {
  it('der Horcher des BadgeContext (newMessage) und der des Sockets (connect) ueberleben das Verlassen', () => {
    const badge = vi.fn();
    const verbindung = vi.fn();
    socketNachbau.on('newMessage', badge);
    socketNachbau.on('connect', verbindung);

    const { unmount } = starte();
    // Der Raum haengt seine eigenen Horcher dazu ...
    expect(socketNachbau.handler.get('newMessage')).toHaveLength(2);
    expect(socketNachbau.handler.get('connect')).toHaveLength(2);

    unmount();
    // ... und nimmt beim Verlassen nur die eigenen wieder weg.
    expect(socketNachbau.handler.get('newMessage')).toEqual([badge]);
    expect(socketNachbau.handler.get('connect')).toEqual([verbindung]);

    socketNachbau.ausloesen('newMessage', { roomId: 7, message: nachricht(2) });
    expect(badge).toHaveBeenCalledTimes(1);
  });

  it('ein Raumwechsel (Web: zweiter Raum in der geteilten Ansicht) laesst die fremden Horcher stehen', () => {
    const badge = vi.fn();
    socketNachbau.on('newMessage', badge);

    const { rerender, result } = starte();
    rerender({ raum: 8 });

    // Der fremde Horcher plus genau EIN eigener des neuen Raums (der alte ist weg).
    expect(socketNachbau.handler.get('newMessage')).toHaveLength(2);
    expect(socketNachbau.handler.get('newMessage')).toContain(badge);

    // Der neue Raum bekommt seine Nachrichten weiter.
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 8, message: nachricht(5) }); });
    expect(result.current.map((m) => m.id)).toEqual([1, 5]);
    expect(badge).toHaveBeenCalledTimes(1);
  });

  it('nach dem Verlassen ist von jedem Ereignis des Raums nichts uebrig, was ihm gehoert', () => {
    const { unmount } = starte();
    unmount();
    for (const ereignis of EREIGNISSE) {
      expect(socketNachbau.handler.get(ereignis) ?? [], ereignis).toEqual([]);
    }
  });
});
