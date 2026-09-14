import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Die Zeitrechnung der App-Sperre. Geprueft wird mit KONKRETEN Zeiten, nicht
// mit "irgendwann": eine Sperre, die eine Sekunde zu frueh oder zu spaet
// zuschnappt, ist genau der Fehler, den niemand bemerkt, bis er nervt.

const mockIsNative = vi.fn(() => true);
const mockGet = vi.fn();
const mockSet = vi.fn(async () => undefined);
const mockRemove = vi.fn(async () => undefined);
const mockVerify = vi.fn(async () => undefined);
const mockVerfuegbar = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsNative(), getPlatform: () => 'ios' }
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: (...a: unknown[]) => mockGet(...(a as [])),
    set: (...a: unknown[]) => mockSet(...(a as [])),
    remove: (...a: unknown[]) => mockRemove(...(a as []))
  }
}));
vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: { verifyIdentity: (...a: unknown[]) => mockVerify(...(a as [])) }
}));
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
  // Abbruch heisst hier: Code 10 (USER_CANCEL) oder 16 (AUTHENTICATION_FAILED).
  istAbbruch: (f: unknown) => [10, 16].includes((f as { code?: number })?.code ?? -1)
}));

import {
  KARENZ_MS,
  mussSperren,
  mussBeimStartSperren,
  sperreLesen,
  sperreSpeichern,
  sperreVerfuegbar,
  sperreOeffnen,
  ausflugStarten,
  ausflugBeenden,
  laeuftAusflug,
  ohneSperre,
  VERZOEGERUNG_BEZEICHNUNG,
  VERZOEGERUNGEN
} from '../../services/appSperre';

const MINUTE = 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsNative.mockReturnValue(true);
  mockGet.mockResolvedValue({ value: null });
  mockVerfuegbar.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID' });
  // Ausflug-Zaehler aus einem vorherigen Test sicher auf null.
  while (laeuftAusflug()) ausflugBeenden();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Wann gesperrt wird', () => {
  it('sperrt bei "aus" NIE — auch nicht nach Stunden', () => {
    expect(mussSperren('aus', 0, 5 * 60 * MINUTE)).toBe(false);
    expect(mussSperren('aus', 0, 0)).toBe(false);
    expect(mussSperren('aus', 1000, 1000 + 24 * 60 * MINUTE)).toBe(false);
  });

  it('"1 Minute": 59,999 s sperren nicht, 60 s sperren', () => {
    expect(mussSperren('1min', 0, MINUTE - 1)).toBe(false);
    expect(mussSperren('1min', 0, MINUTE)).toBe(true);
    expect(mussSperren('1min', 0, MINUTE + 1)).toBe(true);
  });

  it('"5 Minuten": 4:59 sperren nicht, 5:00 sperren', () => {
    expect(mussSperren('5min', 0, 5 * MINUTE - 1000)).toBe(false);
    expect(mussSperren('5min', 0, 5 * MINUTE)).toBe(true);
  });

  it('"15 Minuten": 14:59 sperren nicht, 15:00 sperren', () => {
    expect(mussSperren('15min', 0, 15 * MINUTE - 1000)).toBe(false);
    expect(mussSperren('15min', 0, 15 * MINUTE)).toBe(true);
  });

  it('eine kuerzere Wartezeit sperrt dort, wo eine laengere noch nicht sperrt', () => {
    // Nach 90 Sekunden: 1 Minute ist um, 5 und 15 nicht.
    const abwesend = 90 * 1000;
    expect(mussSperren('1min', 0, abwesend)).toBe(true);
    expect(mussSperren('5min', 0, abwesend)).toBe(false);
    expect(mussSperren('15min', 0, abwesend)).toBe(false);
  });

  it('ohne Zeitstempel (Ausflug lief) wird nie gesperrt', () => {
    expect(mussSperren('sofort', null, 99 * MINUTE)).toBe(false);
    expect(mussSperren('15min', null, 99 * MINUTE)).toBe(false);
  });

  it('eine zurueckgestellte Uhr sperrt niemanden aus', () => {
    // Rueckkehr liegt VOR dem Hintergrundwechsel — darf nicht sperren.
    expect(mussSperren('sofort', 10_000, 5_000)).toBe(false);
    expect(mussSperren('15min', 10_000, 5_000)).toBe(false);
  });
});

describe('Kurzer Hintergrundwechsel (Karenzzeit)', () => {
  it('die Karenz betraegt 2 Sekunden', () => {
    expect(KARENZ_MS).toBe(2000);
  });

  it('"sofort" sperrt NICHT bei einem Wechsel unterhalb der Karenz', () => {
    // Teilen-Blatt, Fotoauswahl, Face-ID-Fenster: auf und wieder zu.
    expect(mussSperren('sofort', 0, 0)).toBe(false);
    expect(mussSperren('sofort', 0, 500)).toBe(false);
    expect(mussSperren('sofort', 0, 1999)).toBe(false);
  });

  it('"sofort" sperrt ab der Karenzgrenze', () => {
    expect(mussSperren('sofort', 0, 2000)).toBe(true);
    expect(mussSperren('sofort', 0, 2001)).toBe(true);
    expect(mussSperren('sofort', 0, 30_000)).toBe(true);
  });
});

describe('Kaltstart', () => {
  it('sperrt bei jeder eingeschalteten Wartezeit', () => {
    expect(mussBeimStartSperren('sofort')).toBe(true);
    expect(mussBeimStartSperren('1min')).toBe(true);
    expect(mussBeimStartSperren('5min')).toBe(true);
    expect(mussBeimStartSperren('15min')).toBe(true);
  });

  it('sperrt bei "aus" nicht', () => {
    expect(mussBeimStartSperren('aus')).toBe(false);
  });
});

describe('Einstellung speichern und lesen', () => {
  it('ist ohne gespeicherten Wert AUS — ein Update setzt niemandem eine Sperre vor', async () => {
    mockGet.mockResolvedValue({ value: null });
    expect(await sperreLesen()).toBe('aus');
  });

  it('gibt einen unbekannten gespeicherten Wert nicht durch, sondern faellt auf "aus"', async () => {
    mockGet.mockResolvedValue({ value: '30min' });
    expect(await sperreLesen()).toBe('aus');
  });

  it('liest jede gueltige Wartezeit zurueck', async () => {
    for (const wert of VERZOEGERUNGEN) {
      mockGet.mockResolvedValue({ value: wert });
      expect(await sperreLesen()).toBe(wert);
    }
  });

  it('faellt auf "aus" zurueck, wenn der Speicher gar nicht antwortet', async () => {
    mockGet.mockRejectedValue(new Error('Speicher weg'));
    expect(await sperreLesen()).toBe('aus');
  });

  it('speichert eine Wartezeit und entfernt den Eintrag bei "aus"', async () => {
    await sperreSpeichern('5min');
    expect(mockSet).toHaveBeenCalledWith({
      key: 'konfi_app_sperre_verzoegerung',
      value: '5min'
    });

    await sperreSpeichern('aus');
    expect(mockRemove).toHaveBeenCalledWith({ key: 'konfi_app_sperre_verzoegerung' });
  });
});

describe('Die Einstellung ueberlebt das Abmelden', () => {
  // Bewusste Entscheidung: Die Wartezeit ist eine Aussage ueber das GERAET
  // ("dieses Handy soll sich sperren"), nicht ueber das Konto. Sie verraet
  // nichts — es steht nur eine Zahl darin. Verschwaende sie beim Abmelden,
  // waere die Sperre danach still aus, und wer sie eingeschaltet hat, waere
  // schlechter geschuetzt als er glaubt.
  const quelle = (pfad: string) =>
    readFileSync(resolve(__dirname, '../../..', pfad), 'utf-8');

  it('wird vom Abmelden nicht geloescht', () => {
    for (const pfad of ['src/services/tokenStore.ts', 'src/services/auth.ts']) {
      expect(quelle(pfad)).not.toContain('konfi_app_sperre_verzoegerung');
    }
  });

  it('der Schluessel taucht nur in der App-Sperre selbst auf', () => {
    // Wer die Einstellung anderswo anfasst, umgeht die Entscheidung oben.
    // (Ein zweiter Test "biometrieVergessen laeuft beim Logout" waere hier
    // wertlos: die Funktion wird an zwei Stellen gerufen, ein Wegfall einer
    // davon bliebe unbemerkt. Das gehoert in den Test der Anmeldung, nicht
    // hierher.)
    expect(quelle('src/services/appSperre.ts')).toContain('konfi_app_sperre_verzoegerung');
  });
});

describe('Verfuegbarkeit', () => {
  it('ist verfuegbar, wenn das Geraet nativ ist und Biometrie eingerichtet hat', async () => {
    expect(await sperreVerfuegbar()).toBe(true);
  });

  it('ist NICHT verfuegbar ohne eingerichtete Biometrie', async () => {
    mockVerfuegbar.mockResolvedValue({ verfuegbar: false, art: 'biometrie', bezeichnung: 'Biometrie' });
    expect(await sperreVerfuegbar()).toBe(false);
  });

  it('ist im Browser NICHT verfuegbar, auch wenn die Biometrie ja sagt', async () => {
    mockIsNative.mockReturnValue(false);
    mockVerfuegbar.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID' });
    expect(await sperreVerfuegbar()).toBe(false);
    // Im Browser wird gar nicht erst gefragt.
    expect(mockVerfuegbar).not.toHaveBeenCalled();
  });
});

describe('Ausfluege (Systemdialoge)', () => {
  it('zaehlt verschachtelte Ausfluege und endet erst beim letzten', () => {
    expect(laeuftAusflug()).toBe(false);
    ausflugStarten();
    ausflugStarten();
    expect(laeuftAusflug()).toBe(true);
    ausflugBeenden();
    // Der aeussere laeuft noch — ein Ja/Nein-Merker haette hier schon aufgegeben.
    expect(laeuftAusflug()).toBe(true);
    ausflugBeenden();
    expect(laeuftAusflug()).toBe(false);
  });

  it('faellt nie unter null', () => {
    ausflugBeenden();
    ausflugBeenden();
    expect(laeuftAusflug()).toBe(false);
    ausflugStarten();
    expect(laeuftAusflug()).toBe(true);
    ausflugBeenden();
    expect(laeuftAusflug()).toBe(false);
  });

  it('ohneSperre raeumt auch auf, wenn der Ablauf wirft', async () => {
    await expect(ohneSperre(async () => { throw new Error('abgebrochen'); }))
      .rejects.toThrow('abgebrochen');
    // Ohne finally bliebe der Merker stehen und die Sperre waere ab hier tot.
    expect(laeuftAusflug()).toBe(false);
  });

  it('ohneSperre haelt den Merker waehrend des Ablaufs und gibt das Ergebnis durch', async () => {
    let drinnen = false;
    const ergebnis = await ohneSperre(async () => {
      drinnen = laeuftAusflug();
      return 42;
    });
    expect(drinnen).toBe(true);
    expect(ergebnis).toBe(42);
    expect(laeuftAusflug()).toBe(false);
  });
});

describe('Entsperren', () => {
  it('meldet "ok", wenn die Biometrie erkennt', async () => {
    mockVerify.mockResolvedValue(undefined);
    expect(await sperreOeffnen()).toBe('ok');
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('bietet iOS den Geraetecode als Rueckweg an', async () => {
    mockVerify.mockResolvedValue(undefined);
    await sperreOeffnen();
    const optionen = mockVerify.mock.calls[0][0] as Record<string, unknown>;
    expect(optionen.useFallback).toBe(true);
    expect(optionen.fallbackTitle).toBe('Code eingeben');
  });

  it('meldet "abgebrochen" bei Abbruch und versucht NICHTS von selbst noch einmal', async () => {
    mockVerify.mockRejectedValue({ code: 10 });
    expect(await sperreOeffnen()).toBe('abgebrochen');
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('meldet "abgebrochen", wenn das Gesicht nicht erkannt wurde', async () => {
    mockVerify.mockRejectedValue({ code: 16 });
    expect(await sperreOeffnen()).toBe('abgebrochen');
  });

  it('meldet "fehler" bei allem anderen', async () => {
    const stumm = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockVerify.mockRejectedValue({ code: 999 });
    expect(await sperreOeffnen()).toBe('fehler');
    stumm.mockRestore();
  });

  it('schreibt weder Token noch Kennung ins Log', async () => {
    const warnungen: unknown[][] = [];
    const stumm = vi.spyOn(console, 'warn').mockImplementation((...a) => { warnungen.push(a); });
    mockVerify.mockRejectedValue({ code: 999, token: 'geheim123', userId: 42 });
    await sperreOeffnen();
    stumm.mockRestore();
    const text = JSON.stringify(warnungen);
    expect(text).not.toContain('geheim123');
    expect(text).not.toContain('42');
  });

  it('klammert die Abfrage in einen Ausflug — sonst sperrt die App sich beim Entsperren erneut', async () => {
    let waehrendDerAbfrage = false;
    mockVerify.mockImplementation(async () => {
      waehrendDerAbfrage = laeuftAusflug();
    });
    await sperreOeffnen();
    expect(waehrendDerAbfrage).toBe(true);
  });

  it('haelt den Ausflug ueber die Rueckkehr hinaus und raeumt ihn danach ab', async () => {
    vi.useFakeTimers();
    mockVerify.mockResolvedValue(undefined);
    await sperreOeffnen();
    // Direkt nach der Abfrage kommt die App aus dem Hintergrund zurueck — der
    // Merker muss da noch stehen.
    expect(laeuftAusflug()).toBe(true);
    vi.runAllTimers();
    expect(laeuftAusflug()).toBe(false);
  });

  it('meldet im Browser "fehler" und fragt gar nicht erst', async () => {
    mockIsNative.mockReturnValue(false);
    expect(await sperreOeffnen()).toBe('fehler');
    expect(mockVerify).not.toHaveBeenCalled();
  });
});

describe('Texte', () => {
  it('benennt jede Wartezeit auf Deutsch mit echten Umlauten', () => {
    expect(VERZOEGERUNG_BEZEICHNUNG.aus).toBe('Aus');
    expect(VERZOEGERUNG_BEZEICHNUNG.sofort).toBe('Sofort');
    expect(VERZOEGERUNG_BEZEICHNUNG['1min']).toBe('Nach 1 Minute');
    expect(VERZOEGERUNG_BEZEICHNUNG['5min']).toBe('Nach 5 Minuten');
    expect(VERZOEGERUNG_BEZEICHNUNG['15min']).toBe('Nach 15 Minuten');
  });

  it('bietet genau die vier Wartezeiten zur Auswahl an', () => {
    expect(VERZOEGERUNGEN).toEqual(['sofort', '1min', '5min', '15min']);
  });
});
