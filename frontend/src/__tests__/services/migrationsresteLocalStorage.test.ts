// Migrationsreste im localStorage ueberleben das Abmelden nicht mehr
// (Audit 26.09.2026, Grundgeruest BF-10)
//
// migrateStorage.ts kopierte vier Schluessel aus dem localStorage in die
// Preferences und liess die Originale "als Rueckfall" stehen. clearAuth
// raeumte nur die Preferences. Auf Installationen aus der Zeit vor
// storage_migrated_v1 lag das damalige Profilobjekt (Name, E-Mail, Jahrgang)
// samt altem Token deshalb dauerhaft im WebView-Speicher -- auch nach dem
// Abmelden oder einem Kontowechsel. Der Rueckfall wird nicht mehr gebraucht.
//
// Die Preferences sind durch eine Map ersetzt. Ihr Web-Speicher liegt in der
// echten App unter dem Praefix "CapacitorStorage." -- die alten Schluessel
// ohne Praefix sind davon getrennt.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value); }),
    remove: vi.fn(async ({ key }: { key: string }) => { prefs.delete(key); }),
    keys: vi.fn(async () => ({ keys: Array.from(prefs.keys()) })),
  },
}));

const ALTES_PROFIL = JSON.stringify({ id: 7, display_name: 'Anna Beispiel', email: 'anna@example.org', jahrgang: '2026' });

function alteInstallation() {
  localStorage.setItem('konfi_token', 'alter-token');
  localStorage.setItem('konfi_user', ALTES_PROFIL);
  localStorage.setItem('device_id', 'geraet-1');
  localStorage.setItem('push_token_last_refresh', '1700000000000');
}

beforeEach(() => {
  prefs.clear();
  localStorage.clear();
  vi.resetModules();
});

describe('Migration nach Preferences', () => {
  it('uebernimmt die vier Schluessel und entfernt danach die Originale', async () => {
    alteInstallation();
    const { migrateToPreferences } = await import('../../services/migrateStorage');

    await migrateToPreferences();

    expect(prefs.get('konfi_token')).toBe('alter-token');
    expect(prefs.get('konfi_user')).toBe(ALTES_PROFIL);
    expect(prefs.get('device_id')).toBe('geraet-1');
    expect(prefs.get('push_token_last_refresh')).toBe('1700000000000');
    expect(prefs.get('storage_migrated_v1')).toBe('true');
    expect(localStorage.getItem('konfi_token')).toBeNull();
    expect(localStorage.getItem('konfi_user')).toBeNull();
    expect(localStorage.getItem('device_id')).toBeNull();
    expect(localStorage.getItem('push_token_last_refresh')).toBeNull();
  });

  it('raeumt auch Geraete auf, die frueher schon migriert wurden', async () => {
    // Stand bis 28.09.2026: Migration erledigt, Originale stehen noch.
    prefs.set('storage_migrated_v1', 'true');
    prefs.set('device_id', 'geraet-1');
    alteInstallation();
    const { migrateToPreferences } = await import('../../services/migrateStorage');

    await migrateToPreferences();

    expect(localStorage.getItem('konfi_user')).toBeNull();
    expect(localStorage.getItem('konfi_token')).toBeNull();
    expect(localStorage.getItem('device_id')).toBeNull();
    // Der bereits migrierte Wert bleibt unangetastet.
    expect(prefs.get('device_id')).toBe('geraet-1');
  });

  it('Gegenprobe: scheitert die Migration, bleiben die Originale stehen', async () => {
    alteInstallation();
    const { Preferences } = await import('@capacitor/preferences');
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('Speicher voll'));
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { migrateToPreferences } = await import('../../services/migrateStorage');

    await migrateToPreferences();

    expect(prefs.get('storage_migrated_v1')).toBeUndefined();
    expect(localStorage.getItem('konfi_user')).toBe(ALTES_PROFIL);
    expect(localStorage.getItem('device_id')).toBe('geraet-1');
    fehler.mockRestore();
  });

  it('laesst fremde Schluessel und den Web-Speicher der Preferences in Ruhe', async () => {
    alteInstallation();
    localStorage.setItem('CapacitorStorage.konfi_token', 'heutiger-token');
    localStorage.setItem('theme', 'dunkel');
    const { migrateToPreferences } = await import('../../services/migrateStorage');

    await migrateToPreferences();

    expect(localStorage.getItem('CapacitorStorage.konfi_token')).toBe('heutiger-token');
    expect(localStorage.getItem('theme')).toBe('dunkel');
  });
});

describe('Abmelden (clearAuth)', () => {
  it('entfernt auch die alten Anmelde-Schluessel aus dem localStorage', async () => {
    prefs.set('storage_migrated_v1', 'true');
    alteInstallation();
    const { clearAuth, initTokenStore } = await import('../../services/tokenStore');
    await initTokenStore();

    await clearAuth();

    expect(localStorage.getItem('konfi_user')).toBeNull();
    expect(localStorage.getItem('konfi_token')).toBeNull();
    expect(localStorage.getItem('push_token_last_refresh')).toBeNull();
  });
});
