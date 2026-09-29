import { describe, it, expect, vi, beforeEach } from 'vitest';

// Zahl am App-Symbol auf Android (29.09.2026): die Bruecke zum eigenen
// Plugin AppSymbolZahl (frontend/android/.../AppSymbolZahlPlugin.java).
//
// Zwei Zusagen, die hier festgehalten werden:
//   1. Nur Android mit dem Plugin geht diesen Weg. iOS und der Browser
//      bekommen nichts davon -- dort bleibt es beim Badge-Plugin.
//   2. Die Angaben fuer die Token-Anmeldung koennen fehlen, aber nie die
//      Anmeldung kippen: Ein Fehler im Plugin ergibt ein leeres Objekt.

let plattform = 'android';
let pluginDa = true;
const art = vi.fn();
const setzen = vi.fn();
const registerPlugin = vi.fn((..._a: unknown[]) => ({ art: (...a: unknown[]) => art(...a), setzen: (...a: unknown[]) => setzen(...a) }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => plattform,
    isPluginAvailable: (name: string) => pluginDa && name === 'AppSymbolZahl',
  },
  registerPlugin: (...a: unknown[]) => registerPlugin(...a),
}));

import { appSymbolAngaben, appSymbolZahlNativ, appSymbolZahlSetzen } from '../../services/appSymbolZahl';

describe('appSymbolZahl: nur Android mit eigenem Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plattform = 'android';
    pluginDa = true;
    art.mockResolvedValue({ weg: 'anbieter', startbildschirm: 'com.sonymobile.launcher' });
    setzen.mockResolvedValue(undefined);
  });

  it('gilt auf Android mit Plugin', () => {
    expect(appSymbolZahlNativ()).toBe(true);
  });

  it('gilt nicht auf dem iPhone und nicht ohne Plugin', () => {
    plattform = 'ios';
    expect(appSymbolZahlNativ()).toBe(false);
    plattform = 'android';
    pluginDa = false;
    expect(appSymbolZahlNativ()).toBe(false);
  });

  it('setzt die Zahl ueber das Plugin, als ganze Zahl ab 0', async () => {
    await appSymbolZahlSetzen(7);
    await appSymbolZahlSetzen(-3);
    await appSymbolZahlSetzen(2.9);
    expect(setzen.mock.calls).toEqual([[{ zahl: 7 }], [{ zahl: 0 }], [{ zahl: 2 }]]);
    expect(registerPlugin).toHaveBeenCalledWith('AppSymbolZahl');
  });

  it('setzt auf dem iPhone nichts (dort bleibt das Badge-Plugin)', async () => {
    plattform = 'ios';
    await appSymbolZahlSetzen(7);
    expect(setzen).not.toHaveBeenCalled();
  });
});

describe('appSymbolZahl: Angaben fuer die Token-Anmeldung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plattform = 'android';
    pluginDa = true;
  });

  it('liefert Weg und Startbildschirm', async () => {
    art.mockResolvedValue({ weg: 'anbieter', startbildschirm: 'com.sonymobile.launcher' });
    expect(await appSymbolAngaben()).toEqual({ app_symbol_weg: 'anbieter', startbildschirm: 'com.sonymobile.launcher' });
  });

  it('laesst einen unbekannten Weg weg, behaelt aber den Startbildschirm', async () => {
    art.mockResolvedValue({ weg: 'hologramm', startbildschirm: 'com.example.home' });
    expect(await appSymbolAngaben()).toEqual({ startbildschirm: 'com.example.home' });
  });

  it('ohne festgelegten Startbildschirm nur den Weg', async () => {
    art.mockResolvedValue({ weg: 'punkt' });
    expect(await appSymbolAngaben()).toEqual({ app_symbol_weg: 'punkt' });
  });

  it('ein Fehler im Plugin ergibt keine Angaben statt einer gescheiterten Anmeldung', async () => {
    art.mockRejectedValue(new Error('kaputt'));
    expect(await appSymbolAngaben()).toEqual({});
  });

  it('auf dem iPhone keine Angaben', async () => {
    plattform = 'ios';
    expect(await appSymbolAngaben()).toEqual({});
    expect(art).not.toHaveBeenCalled();
  });
});
