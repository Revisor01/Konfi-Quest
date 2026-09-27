/**
 * Offline-Daten gehören zum Konto (Audit Grundgerüst BF-04, HOCH, 27.09.2026).
 *
 * Der bewusste Logout leert Cache und Warteschlange. Eine ABGELAUFENE Sitzung
 * (Passwortwechsel auf einem anderen Gerät, 90 Tage ohne Nutzung, Konto
 * deaktiviert) ruft nur clearAuth(). Meldete sich danach eine andere Person am
 * selben Gerät an, zeigte die App deren gespeicherte Listen und Chat-Verläufe
 * der vorigen Person, und deren eingereihte Nachrichten und Abmeldungen gingen
 * mit dem Token der neuen Person raus — unter falschem Namen.
 *
 * Nicht pauschal leeren: Meldet sich DIESELBE Person neu an, sollen ihre
 * wartenden Aktionen erhalten bleiben und mit ihrem eigenen Token rausgehen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let store: Record<string, string> = {};
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store[key] ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store[key] = value; }),
    remove: vi.fn(async ({ key }: { key: string }) => { delete store[key]; }),
    keys: vi.fn(async () => ({ keys: Object.keys(store) })),
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { readFile: vi.fn(), deleteFile: vi.fn(async () => undefined) },
  Directory: { Data: 'DATA' },
}));
const mockPost = vi.fn(async () => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: { post: (...a: unknown[]) => mockPost(...a), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@ionic/core', () => ({ toastController: { create: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

const KONTO_A = { id: 11, type: 'konfi', display_name: 'A' };
const KONTO_B = { id: 22, type: 'konfi', display_name: 'B' };

const module = async () => ({
  tokenStore: await import('../../services/tokenStore'),
  cache: (await import('../../services/offlineCache')).offlineCache,
  queue: (await import('../../services/writeQueue')).writeQueue,
});

const anmelden = async (tokenStore: typeof import('../../services/tokenStore'), konto: typeof KONTO_A) => {
  await tokenStore.setToken(`token-${konto.id}`);
  await tokenStore.setUser(konto as never);
};

const chatNachricht = (clientId: string) => ({
  method: 'POST' as const,
  url: '/chat/rooms/96/messages',
  body: { content: 'bin krank, komme nicht', client_id: clientId },
  maxRetries: 3,
  hasFileUpload: false,
  metadata: { type: 'chat' as const, clientId, roomId: 96 },
});

beforeEach(() => {
  store = {};
  vi.clearAllMocks();
  vi.resetModules();
});

describe('Offline-Cache', () => {
  it('verboten: nach abgelaufener Sitzung sieht ein anderes Konto nichts von der vorigen Person', async () => {
    const { tokenStore, cache } = await module();
    await anmelden(tokenStore, KONTO_A);
    await cache.set('chat:messages:96', [{ id: 1, content: 'geheim' }], 60_000);

    await tokenStore.clearAuth(); // Sitzung abgelaufen, kein Logout
    await anmelden(tokenStore, KONTO_B);

    expect(await cache.get('chat:messages:96')).toBeNull();
  });

  it('erlaubt: dieselbe Person findet ihren Stand nach neuer Anmeldung wieder', async () => {
    const { tokenStore, cache } = await module();
    await anmelden(tokenStore, KONTO_A);
    await cache.set('chat:messages:96', [{ id: 1, content: 'eigene' }], 60_000);

    await tokenStore.clearAuth();
    await anmelden(tokenStore, KONTO_A);

    expect((await cache.get<Array<{ content: string }>>('chat:messages:96'))?.data).toEqual([{ id: 1, content: 'eigene' }]);
  });

  it('beim Konto-Wechsel verschwindet der Stand der vorigen Person auch vom Gerät', async () => {
    const { tokenStore, cache } = await module();
    await anmelden(tokenStore, KONTO_A);
    await cache.set('admin:konfis:1', [{ id: 5 }], 60_000);
    await tokenStore.clearAuth();
    await anmelden(tokenStore, KONTO_B);
    await cache.set('admin:konfis:1', [{ id: 6 }], 60_000);

    await cache.fremdeKontenEntfernen();

    const reste = Object.entries(store).filter(([k]) => k.startsWith('cache:')).map(([, v]) => JSON.parse(v).data);
    expect(reste).toEqual([[{ id: 6 }]]);
  });
});

describe('Warteschlange', () => {
  it('verboten: eine eingereihte Nachricht der vorigen Person geht nicht unter dem neuen Konto raus', async () => {
    const { tokenStore, queue } = await module();
    await anmelden(tokenStore, KONTO_A);
    await queue.enqueue(chatNachricht('a-1'));

    await tokenStore.clearAuth();
    await anmelden(tokenStore, KONTO_B);
    const ergebnis = await queue.flush();

    expect(mockPost).not.toHaveBeenCalled();
    expect(ergebnis.succeeded).toEqual([]);
    expect(await queue.getAll()).toEqual([]);
  });

  it('verboten: die neue Person sieht weder wartende noch fehlgeschlagene Einträge der vorigen', async () => {
    const { tokenStore, queue } = await module();
    await anmelden(tokenStore, KONTO_A);
    await queue.enqueue(chatNachricht('a-2'));
    store['queue:failedChat'] = JSON.stringify([
      { clientId: 'a-3', roomId: 96, content: 'nicht gesendet', createdAt: 1, status: 400, message: 'x' },
    ]);
    store['queue:failedActions'] = JSON.stringify([{ id: 'f1', label: 'Abmeldung', status: 400, message: 'x', createdAt: 1 }]);

    await tokenStore.clearAuth();
    await anmelden(tokenStore, KONTO_B);

    expect(await queue.getAll()).toEqual([]);
    expect(await queue.getByMetadata({ roomId: 96 })).toEqual([]);
    expect(await queue.getFailedChat()).toEqual([]);
    expect(await queue.getFailedActions()).toEqual([]);
  });

  it('erlaubt: meldet sich dieselbe Person neu an, geht ihre Nachricht mit ihrem Token raus', async () => {
    const { tokenStore, queue } = await module();
    await anmelden(tokenStore, KONTO_A);
    await queue.enqueue(chatNachricht('a-4'));

    await tokenStore.clearAuth();
    await anmelden(tokenStore, KONTO_A);
    const ergebnis = await queue.flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/chat/rooms/96/messages');
    expect(ergebnis.succeeded.map((i) => i.metadata.clientId)).toEqual(['a-4']);
  });

  it('erlaubt: eine Warteschlange aus der Zeit vor der Kontobindung übernimmt die erste angemeldete Person', async () => {
    const { tokenStore, queue } = await module();
    store['queue:items'] = JSON.stringify([{ ...chatNachricht('alt-1'), id: 'q1', retryCount: 0, createdAt: 1 }]);
    await anmelden(tokenStore, KONTO_A);

    expect((await queue.getAll()).map((i) => i.metadata.clientId)).toEqual(['alt-1']);
  });
});
