import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dateien, cacheInhalt, objectUrlAttrappe } from '../medienAttrappen';

// Der Medien-Cache gehört zum Konto, nicht zum Gerät (27.09.2026).
//
// Befund: Der Cache wurde nur von Hand geleert ("Medien-Cache leeren"). Weder
// das Abmelden noch ein Wechsel der Gemeinde noch die Anmeldung eines anderen
// Kontos auf demselben Gerät räumte ihn. Die Chat-Medien der vorigen Person
// lagen danach weiter auf dem Gerät — und mit den Challenge-Dateien kämen
// Fotos dazu, die eine Konfi-Gruppe sehen durfte, die nächste Person aber
// nicht.
//
// Geprüft wird der ECHTE Cache: Nach dem Wechsel auf ein anderes Konto liegt
// nichts mehr auf dem Gerät, und dieselbe Datei geht wieder zum Server — der
// dann für das neue Konto entscheidet.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const praeferenzen = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: praeferenzen.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { praeferenzen.set(key, value); }),
    remove: vi.fn(async ({ key }: { key: string }) => { praeferenzen.delete(key); }),
  },
}));

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  DATEI_TIMEOUT_MS: 180000,
}));

import {
  getMediaBlob,
  getMediaObjectUrl,
  getCachedObjectUrl,
  clearMediaCache,
  medienCacheKontoPruefen,
} from '../../services/mediaCache';

const FOTO = 'ab12cd34';

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  praeferenzen.clear();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => ({ data: new Blob([route], { type: 'image/jpeg' }) }));
  objectUrlAttrappe();
});

describe('Kontowechsel auf demselben Gerät', () => {
  it('ein anderes Konto findet keine Medien des vorigen vor', async () => {
    await medienCacheKontoPruefen(1);
    await getMediaObjectUrl(FOTO, { quelle: 'challenges' });
    await getMediaBlob('chatdatei');
    expect(cacheInhalt()).toEqual(['challenges-ab12cd34', 'chat-chatdatei']);

    await medienCacheKontoPruefen(2);

    expect(cacheInhalt()).toEqual([]);
    expect(getCachedObjectUrl(FOTO, 'challenges')).toBeNull();
    // Dieselbe Datei geht wieder zum Server — der entscheidet für Konto 2.
    await getMediaBlob(FOTO, { quelle: 'challenges' });
    expect(apiGet).toHaveBeenCalledTimes(3);
  });

  it('dasselbe Konto behält seinen Cache (erlaubter Fall)', async () => {
    await medienCacheKontoPruefen(1);
    const url = await getMediaObjectUrl(FOTO, { quelle: 'challenges' });

    await medienCacheKontoPruefen(1);

    expect(cacheInhalt()).toEqual(['challenges-ab12cd34']);
    expect(getCachedObjectUrl(FOTO, 'challenges')).toBe(url);
    await getMediaBlob(FOTO, { quelle: 'challenges' });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('erster Start nach dem Update: ohne Markierung wird einmal geleert', async () => {
    // Einträge aus der Zeit, als das Abmelden den Cache nicht räumte — sie
    // können von jedem Konto stammen, das dieses Gerät benutzt hat.
    dateien.set('media-cache/1x2y3z', { data: 'QUxU', size: 3, mtime: 1 });

    await medienCacheKontoPruefen(1);

    expect(cacheInhalt()).toEqual([]);
    expect(praeferenzen.get('medien_cache_konto')).toBe('1');
  });
});
