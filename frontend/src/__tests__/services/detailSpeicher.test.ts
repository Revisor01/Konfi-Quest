/**
 * Besuchte Detailseiten bewahren ihre Antwort auf (09.10.2026, Simon:
 * „Details aus Cache ist gut.").
 *
 * Geprüft am echten offlineCache (Preferences als Attrappe, Kennung des Kontos
 * aus dem echten tokenStore): Ohne Netz kommt der gemerkte Stand ohne
 * Anfrage, ohne gemerkten Stand nichts; ein anderes Konto findet nichts; der
 * Speicher wächst nicht über die Obergrenze; was der Server verweigert, wird
 * vergessen.
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

const KONTO_A = { id: 11, type: 'user', role_name: 'admin', organization_id: 1, display_name: 'A' };
const KONTO_B = { id: 22, type: 'user', role_name: 'admin', organization_id: 1, display_name: 'B' };

const module = async () => ({
  tokenStore: await import('../../services/tokenStore'),
  cache: (await import('../../services/offlineCache')).offlineCache,
  speicher: await import('../../services/detailSpeicher'),
});

const anmelden = async (konto: typeof KONTO_A) => {
  const { tokenStore } = await module();
  await tokenStore.setToken(`token-${konto.id}`);
  await tokenStore.setUser(konto as never);
};

/** Das Merken läuft im Hintergrund (nicht abgewartet) -- bis es durch ist. */
const merkenAbwarten = async () => {
  const { speicher } = await module();
  // Ein letzter Schritt in der Kette: Er läuft erst, wenn alle vorigen durch sind.
  await speicher.detailVergessen('__ende__');
};

const ohneNetzFehler = () => new Error('Network Error');
const serverFehler = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(async () => {
  store = {};
  await anmelden(KONTO_A);
});

describe('detailLaden', () => {
  it('mit Netz: genau eine Anfrage, die Antwort wird gemerkt', async () => {
    const { speicher } = await module();
    const abruf = vi.fn(async () => ({ name: 'Gemeindefest', teilnehmer: ['Kim'] }));
    const ergebnis = await speicher.detailLaden('admin:termin-detail:1:7', abruf, true);
    await merkenAbwarten();
    expect(abruf).toHaveBeenCalledTimes(1);
    expect(ergebnis).toEqual({ daten: { name: 'Gemeindefest', teilnehmer: ['Kim'] }, ausSpeicher: false });
    expect(await speicher.gemerktesDetail('admin:termin-detail:1:7')).toEqual({ name: 'Gemeindefest', teilnehmer: ['Kim'] });
  });

  it('ohne Netz mit gemerktem Stand: der Stand, keine Anfrage', async () => {
    const { speicher } = await module();
    await speicher.detailLaden('admin:termin-detail:1:7', async () => ({ name: 'Gemeindefest' }), true);
    await merkenAbwarten();
    const abruf = vi.fn(async () => ({ name: 'neu' }));
    const ergebnis = await speicher.detailLaden('admin:termin-detail:1:7', abruf, false);
    expect(abruf).not.toHaveBeenCalled();
    expect(ergebnis).toEqual({ daten: { name: 'Gemeindefest' }, ausSpeicher: true });
  });

  it('ohne Netz ohne gemerkten Stand: null, keine Anfrage', async () => {
    const { speicher } = await module();
    const abruf = vi.fn(async () => ({ name: 'neu' }));
    expect(await speicher.detailLaden('admin:termin-detail:1:8', abruf, false)).toBeNull();
    expect(abruf).not.toHaveBeenCalled();
  });

  it('mit Netz, aber keine Antwort: der gemerkte Stand hilft', async () => {
    const { speicher } = await module();
    await speicher.detailLaden('k', async () => ({ wert: 1 }), true);
    await merkenAbwarten();
    const ergebnis = await speicher.detailLaden('k', async () => { throw ohneNetzFehler(); }, true);
    expect(ergebnis).toEqual({ daten: { wert: 1 }, ausSpeicher: true });
  });

  it('mit Netz, keine Antwort und nichts gemerkt: der Fehler geht weiter', async () => {
    const { speicher } = await module();
    await expect(speicher.detailLaden('k', async () => { throw ohneNetzFehler(); }, true)).rejects.toThrow('Network Error');
  });

  it('Serverfehler 500: kein Rückgriff auf den Speicher, der Stand bleibt aber', async () => {
    const { speicher } = await module();
    await speicher.detailLaden('k', async () => ({ wert: 1 }), true);
    await merkenAbwarten();
    await expect(speicher.detailLaden('k', async () => { throw serverFehler(500); }, true)).rejects.toThrow('HTTP 500');
    expect(await speicher.gemerktesDetail('k')).toEqual({ wert: 1 });
  });

  it.each([403, 404])('Server sagt %i: der gemerkte Stand wird vergessen -- auch ohne Netz danach nichts', async (status) => {
    const { speicher } = await module();
    await speicher.detailLaden('k', async () => ({ wert: 1 }), true);
    await merkenAbwarten();
    await expect(speicher.detailLaden('k', async () => { throw serverFehler(status); }, true)).rejects.toThrow();
    expect(await speicher.detailLaden('k', async () => ({ wert: 2 }), false)).toBeNull();
  });
});

describe('Konto und Abmelden', () => {
  it('ein anderes Konto findet den Stand nicht, dasselbe nach neuer Anmeldung schon', async () => {
    const { speicher } = await module();
    await speicher.detailMerken('admin:person-detail:1:9', { name: 'Kim Konfi' });

    await anmelden(KONTO_B);
    expect(await speicher.gemerktesDetail('admin:person-detail:1:9')).toBeNull();
    expect(await speicher.detailLaden('admin:person-detail:1:9', async () => ({}), false)).toBeNull();

    await anmelden(KONTO_A);
    expect(await speicher.gemerktesDetail('admin:person-detail:1:9')).toEqual({ name: 'Kim Konfi' });
  });

  it('Schlüssel liegen unter der Kennung des Kontos -- auch das Verzeichnis', async () => {
    const { speicher } = await module();
    await speicher.detailMerken('admin:person-detail:1:9', { name: 'Kim Konfi' });
    expect(Object.keys(store).filter((k) => k.startsWith('cache:')).sort()).toEqual([
      'cache:11:admin:person-detail:1:9',
      `cache:11:${speicher.DETAIL_VERZEICHNIS}`,
    ].sort());
  });

  it('Abmelden (clearAll) nimmt alle gemerkten Detailseiten mit', async () => {
    const { speicher, cache } = await module();
    await speicher.detailMerken('a', { x: 1 });
    await speicher.detailMerken('b', { x: 2 });
    await cache.clearAll();
    expect(Object.keys(store).filter((k) => k.startsWith('cache:'))).toEqual([]);
    expect(await speicher.gemerktesDetail('a')).toBeNull();
  });
});

describe('Obergrenze', () => {
  it(`hält höchstens DETAIL_HOECHSTZAHL Seiten; die am längsten nicht besuchten fliegen raus`, async () => {
    const { speicher } = await module();
    const n = speicher.DETAIL_HOECHSTZAHL;
    for (let i = 1; i <= n + 3; i += 1) await speicher.detailMerken(`seite:${i}`, { i });
    const seiten = Object.keys(store).filter((k) => k.startsWith('cache:11:seite:'));
    expect(seiten).toHaveLength(n);
    for (const alt of [1, 2, 3]) expect(await speicher.gemerktesDetail(`seite:${alt}`)).toBeNull();
    expect(await speicher.gemerktesDetail('seite:4')).toEqual({ i: 4 });
    expect(await speicher.gemerktesDetail(`seite:${n + 3}`)).toEqual({ i: n + 3 });
  });

  it('ein erneuter Besuch rückt nach vorn und schützt vor dem Rauswurf', async () => {
    const { speicher } = await module();
    const n = speicher.DETAIL_HOECHSTZAHL;
    for (let i = 1; i <= n; i += 1) await speicher.detailMerken(`seite:${i}`, { i });
    await speicher.detailMerken('seite:1', { i: 1, wieder: true });
    await speicher.detailMerken('seite:neu', { i: 0 });
    expect(await speicher.gemerktesDetail('seite:1')).toEqual({ i: 1, wieder: true });
    expect(await speicher.gemerktesDetail('seite:2')).toBeNull();
  });

  it('gleichzeitiges Merken verliert keinen Eintrag im Verzeichnis', async () => {
    const { speicher, cache } = await module();
    await Promise.all([speicher.detailMerken('a', 1), speicher.detailMerken('b', 2), speicher.detailMerken('c', 3)]);
    const verzeichnis = await cache.get<string[]>(speicher.DETAIL_VERZEICHNIS);
    expect([...(verzeichnis?.data ?? [])].sort()).toEqual(['a', 'b', 'c']);
  });
});
