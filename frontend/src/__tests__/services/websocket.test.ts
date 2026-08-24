import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sicherheitslücke Session-Ablauf (Fund 24.08.2026): api.ts ruft bei einem
// endgültig gescheiterten Token-Refresh clearAuth() und feuert
// 'auth:relogin-required' — aber niemand trennte den Socket. Die bestehende
// Verbindung blieb serverseitig als die ABGEMELDETE Person authentifiziert.
// Meldet sich danach jemand anderes am selben Geraet an, gab
// initializeWebSocket(neuesToken) den ALTEN Socket zurueck: die neue Person
// saß in den Live-Update-Räumen der vorherigen und bekam deren Nachrichten.

type FakeSocket = {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  connected: boolean;
};

const createdSockets: FakeSocket[] = [];
const mockIo = vi.fn(() => {
  const s: FakeSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(function (this: FakeSocket) { s.connected = false; }),
    connect: vi.fn(),
    connected: true,
  };
  createdSockets.push(s);
  return s;
});

vi.mock('socket.io-client', () => ({ io: (...a: unknown[]) => mockIo(...a as []) }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { flush: vi.fn(async () => ({ succeeded: [], failed: [] })) },
}));
vi.mock('../../services/offlineCache', () => ({
  offlineCache: { invalidateAll: vi.fn(async () => undefined) },
}));
vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => 'token-alt'),
}));
vi.mock('../../services/api', () => ({
  ensureFreshToken: vi.fn(async () => 'token-alt'),
}));

describe('websocket — Session-Ablauf trennt den Socket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdSockets.length = 0;
    vi.resetModules();
  });

  it('VERBOTEN: nach auth:relogin-required darf der alte Socket nicht weiterleben — der nächste Login bekommt einen NEUEN', async () => {
    const ws = await import('../../services/websocket');

    const ersterSocket = ws.initializeWebSocket('token-alt');
    expect(mockIo).toHaveBeenCalledTimes(1);

    // Session läuft ab: api.ts hat clearAuth() gemacht und feuert das Event.
    window.dispatchEvent(new CustomEvent('auth:relogin-required'));

    // Der alte Socket MUSS getrennt sein — sonst empfängt das Geraet auf dem
    // Login-Bildschirm weiter Live-Updates der abgemeldeten Person.
    expect((ersterSocket as unknown as FakeSocket).disconnect).toHaveBeenCalledTimes(1);
    expect(ws.getSocket()).toBeNull();

    // Nächste Anmeldung (ggf. eine ANDERE Person): muss einen frischen,
    // mit dem neuen Token authentifizierten Socket bekommen.
    const zweiterSocket = ws.initializeWebSocket('token-neu');
    expect(mockIo).toHaveBeenCalledTimes(2);
    expect(zweiterSocket).not.toBe(ersterSocket);
  });

  it('ERLAUBT: ohne Session-Ablauf bleibt derselbe Socket bestehen (kein unnötiger Neuaufbau)', async () => {
    const ws = await import('../../services/websocket');

    const ersterSocket = ws.initializeWebSocket('token-alt');
    const zweiterAufruf = ws.initializeWebSocket('token-alt');

    expect(zweiterAufruf).toBe(ersterSocket);
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect((ersterSocket as unknown as FakeSocket).disconnect).not.toHaveBeenCalled();
  });
});
