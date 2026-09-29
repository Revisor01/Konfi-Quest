// Chat-Raum als gelesen markieren (BadgeContext.markRoomAsRead) -- am echten
// Provider geprueft (Audit Tests 26.09.2026, BF-02). Ersetzt
// badgeMarkRoomAsRead.test.ts und badgeMarkReadWettlauf.test.ts, die
// dieselben Zusagen als Zeichenketten im Quelltext suchten.
//
// Die Befunde dahinter:
//  - 02.09.2026: Die Gesamtzahl wurde um einen veralteten Wert verringert
//    (Closure) -- der Raum sprang auf 0, der Tab-Badge blieb stehen.
//  - 02.09.2026: Der zwischengespeicherte Raum-Stand ('chat:rooms:<id>')
//    brachte nach dem Neustart Badge und "Neu"-Trenner zurueck.
//  - 03.09.2026: Der POST lief ohne await; die anschliessende Zaehlung holte
//    den alten Stand und ueberschrieb die optimistische Null.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => mockApiGet(...a), post: (...a: unknown[]) => mockApiPost(...a) },
}));
const mockEnqueue = vi.fn();
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => mockEnqueue(...a) } }));
let online = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return online; }, subscribe: vi.fn(() => () => {}) },
}));
vi.mock('../../services/websocket', () => ({
  initializeWebSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  getSocket: vi.fn(() => null),
}));
vi.mock('../../services/tokenStore', () => ({ getToken: vi.fn(() => 'test-token') }));
const entferneZugestellte = vi.fn();
vi.mock('../../services/notifications', () => ({ removeDeliveredForChatRoom: (id: number) => entferneZugestellte(id) }));
const cacheEntfernen = vi.fn();
vi.mock('../../services/offlineCache', () => ({ offlineCache: { remove: (k: string) => cacheEntfernen(k) } }));
vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
// Stabile Objekte wie im echten Kontext -- sonst stoesst jedes Rendern eine
// neue Zaehlung an und ueberschreibt, was der Test pruefen will.
const { NUTZER, GEMEINDEN } = vi.hoisted(() => ({
  NUTZER: { id: 41, type: 'konfi', role_name: 'konfi' },
  GEMEINDEN: [] as unknown[],
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: NUTZER, organizations: GEMEINDEN }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ socketEpoch: 0 }), useLiveRefresh: vi.fn() }));

import { BadgeProvider, useBadge } from '../../contexts/BadgeContext';

const ctx: { current: ReturnType<typeof useBadge> | null } = { current: null };
const Verbraucher: React.FC = () => {
  const badge = useBadge();
  React.useEffect(() => { ctx.current = badge; });
  return null;
};

const zaehlung = (byRoom: Record<number, number>) => ({
  data: {
    chat: { total: Object.values(byRoom).reduce((s, n) => s + n, 0), byRoom },
    pendingRequests: 0, pendingEvents: 0, pendingChallenges: 0, newBadges: 0, postfach: { ungelesen: 0 },
  },
});
const offen = () => {
  let erfuellen!: () => void;
  const promise = new Promise<{ data: object }>((r) => { erfuellen = () => r({ data: {} }); });
  return { promise, erfuellen };
};

async function starte(byRoom: Record<number, number>) {
  mockApiGet.mockResolvedValue(zaehlung(byRoom));
  render(<BadgeProvider><Verbraucher /></BadgeProvider>);
  await waitFor(() => expect(ctx.current?.chatUnreadByRoom).toEqual(byRoom));
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = null;
  online = true;
  mockApiPost.mockResolvedValue({ data: {} });
});

describe('Raum gelesen: Zaehler', () => {
  it('der Raum faellt auf 0, die Gesamtzahl um genau seinen Stand', async () => {
    await starte({ 7: 3, 8: 2 });
    expect(ctx.current?.chatUnreadTotal).toBe(5);
    await act(async () => { await ctx.current!.markRoomAsRead(7); });
    expect(ctx.current?.chatUnreadByRoom).toEqual({ 7: 0, 8: 2 });
    expect(ctx.current?.chatUnreadTotal).toBe(2);
  });

  it('rechnet mit dem AKTUELLEN Stand des Raums, nicht mit einem veralteten (Befund 02.09.2026)', async () => {
    await starte({ 7: 1, 8: 2 });
    const alteFunktion = ctx.current!.markRoomAsRead;
    // Neue Nachricht im Raum 7 -- der Zaehler steht jetzt bei 4.
    mockApiGet.mockResolvedValue(zaehlung({ 7: 4, 8: 2 }));
    await act(async () => { await ctx.current!.refreshAllCounts(); });
    expect(ctx.current?.chatUnreadTotal).toBe(6);
    // Aufgerufen wird die Funktion, die der Raum beim Oeffnen in der Hand hatte.
    await act(async () => { await alteFunktion(7); });
    expect(ctx.current?.chatUnreadByRoom[7]).toBe(0);
    expect(ctx.current?.chatUnreadTotal).toBe(2);
  });

  it('ein Raum ohne Ungelesenes aendert nichts', async () => {
    await starte({ 7: 0, 8: 2 });
    await act(async () => { await ctx.current!.markRoomAsRead(7); });
    expect(ctx.current?.chatUnreadTotal).toBe(2);
    expect(ctx.current?.chatUnreadByRoom).toEqual({ 7: 0, 8: 2 });
  });

  it('die Mitteilungen dieses Raums verschwinden aus dem Mitteilungszentrum', async () => {
    await starte({ 7: 3 });
    await act(async () => { await ctx.current!.markRoomAsRead(7); });
    expect(entferneZugestellte).toHaveBeenCalledWith(7);
  });
});

describe('Raum gelesen: Server und Zwischenspeicher', () => {
  it('wartet den POST ab, bevor das Versprechen erfuellt ist (Befund 03.09.2026)', async () => {
    await starte({ 7: 3 });
    const post = offen();
    mockApiPost.mockReturnValueOnce(post.promise);
    let fertig = false;
    let lauf!: Promise<void>;
    act(() => { lauf = ctx.current!.markRoomAsRead(7).then(() => { fertig = true; }); });
    await act(async () => { await Promise.resolve(); });
    expect(mockApiPost).toHaveBeenCalledWith('/chat/rooms/7/mark-read');
    expect(fertig).toBe(false);
    // Solange der Server nicht geantwortet hat, bleibt der Zwischenspeicher.
    expect(cacheEntfernen).not.toHaveBeenCalled();
    await act(async () => { post.erfuellen(); await lauf; });
    expect(fertig).toBe(true);
    expect(cacheEntfernen).toHaveBeenCalledWith('chat:rooms:41');
  });

  it('eine anschliessende Zaehlung setzt hart auf den Serverwert', async () => {
    await starte({ 7: 3, 8: 2 });
    await act(async () => { await ctx.current!.markRoomAsRead(7); });
    mockApiGet.mockResolvedValue(zaehlung({ 7: 0, 8: 5 }));
    await act(async () => { await ctx.current!.refreshAllCounts(); });
    expect(ctx.current?.chatUnreadTotal).toBe(5);
    expect(ctx.current?.chatUnreadByRoom).toEqual({ 7: 0, 8: 5 });
  });

  it('schlaegt der POST fehl, bleibt der Zwischenspeicher (der naechste Abruf korrigiert)', async () => {
    await starte({ 7: 3 });
    mockApiPost.mockRejectedValueOnce(new Error('Netz weg'));
    await act(async () => { await ctx.current!.markRoomAsRead(7); });
    expect(cacheEntfernen).not.toHaveBeenCalled();
  });

  it('offline: in die Warteschlange, kein POST', async () => {
    await starte({ 7: 3 });
    online = false;
    await act(async () => { await ctx.current!.markRoomAsRead(7); });
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0][0]).toMatchObject({
      method: 'POST', url: '/chat/rooms/7/mark-read', hasFileUpload: false,
      metadata: { type: 'fire-and-forget', label: 'Mark-Read' },
    });
    // Die Zahl faellt trotzdem sofort.
    expect(ctx.current?.chatUnreadTotal).toBe(0);
  });
});
