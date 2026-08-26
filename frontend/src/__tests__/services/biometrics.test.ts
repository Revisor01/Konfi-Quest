import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Plattform umschaltbar: die Biometrie ist im Web komplett abgeschaltet, das
// muss ein Test gezielt pruefen koennen.
let istNativ = true;
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => istNativ,
    getPlatform: () => (istNativ ? 'ios' : 'web'),
  },
}));

const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      prefs.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      prefs.delete(key);
    }),
  },
}));

// Sicherer Speicher als einfache Map. setData/getSecureData/deleteData bilden
// das Verhalten des Plugins nach; die Fehlerfaelle werden je Test gesetzt.
const sicher = new Map<string, string>();
const mockSetData = vi.fn(async ({ key, value }: { key: string; value: string }) => {
  sicher.set(key, value);
});
const mockGetSecureData = vi.fn(async ({ key }: { key: string }) => {
  if (!sicher.has(key)) {
    const fehler: any = new Error('No protected data found');
    fehler.code = 21; // NO_PROTECTED_CREDENTIALS_FOUND
    throw fehler;
  }
  return { value: sicher.get(key)! };
});
const mockDeleteData = vi.fn(async ({ key }: { key: string }) => {
  sicher.delete(key);
});
const mockGetData = vi.fn(async () => {
  const fehler: any = new Error('nichts');
  fehler.code = 21;
  throw fehler;
});
let verfuegbarkeitsAntwort: any = {
  isAvailable: true,
  biometryType: 2, // FACE_ID
  authenticationStrength: 1,
  deviceIsSecure: true,
  strongBiometryIsAvailable: true,
};
const mockIsAvailable = vi.fn(async () => {
  if (verfuegbarkeitsAntwort instanceof Error) throw verfuegbarkeitsAntwort;
  return verfuegbarkeitsAntwort;
});

vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: {
    isAvailable: (...a: any[]) => mockIsAvailable(...(a as [])),
    setData: (...a: any[]) => mockSetData(...(a as [any])),
    getSecureData: (...a: any[]) => mockGetSecureData(...(a as [any])),
    getData: (...a: any[]) => mockGetData(...(a as [])),
    deleteData: (...a: any[]) => mockDeleteData(...(a as [any])),
  },
  AccessControl: { NONE: 0, BIOMETRY_CURRENT_SET: 1, BIOMETRY_ANY: 2 },
  BiometryType: {
    NONE: 0, TOUCH_ID: 1, FACE_ID: 2, FINGERPRINT: 3,
    FACE_AUTHENTICATION: 4, IRIS_AUTHENTICATION: 5, MULTIPLE: 6, DEVICE_CREDENTIAL: 7,
  },
  BiometricAuthError: {
    UNKNOWN_ERROR: 0, BIOMETRICS_UNAVAILABLE: 1, USER_LOCKOUT: 2,
    BIOMETRICS_NOT_ENROLLED: 3, USER_TEMPORARY_LOCKOUT: 4,
    AUTHENTICATION_FAILED: 10, APP_CANCEL: 11, INVALID_CONTEXT: 12,
    NOT_INTERACTIVE: 13, PASSCODE_NOT_SET: 14, SYSTEM_CANCEL: 15,
    USER_CANCEL: 16, USER_FALLBACK: 17, NO_PROTECTED_CREDENTIALS_FOUND: 21,
  },
}));

const testUser = { id: 42, type: 'konfi' as const, display_name: 'Emilia' };
let aktuellerRefreshToken: string | null = 'refresh-abc';
let aktuellerUser: typeof testUser | null = testUser;
vi.mock('../../services/tokenStore', () => ({
  getRefreshToken: () => aktuellerRefreshToken,
  getUser: () => aktuellerUser,
}));

const SICHERER_SCHLUESSEL = 'konfi_quest_biometrie_sitzung';
const SCHALTER_SCHLUESSEL = 'konfi_biometrie_aktiv';

const laden = async () => import('../../services/biometrics');

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  prefs.clear();
  sicher.clear();
  istNativ = true;
  aktuellerRefreshToken = 'refresh-abc';
  aktuellerUser = testUser;
  verfuegbarkeitsAntwort = {
    isAvailable: true,
    biometryType: 2,
    authenticationStrength: 1,
    deviceIsSecure: true,
    strongBiometryIsAvailable: true,
  };
});

describe('biometrieVerfuegbar', () => {
  it('meldet Face ID, wenn das Geraet sie eingerichtet hat', async () => {
    const { biometrieVerfuegbar } = await laden();
    const ergebnis = await biometrieVerfuegbar();
    expect(ergebnis.verfuegbar).toBe(true);
    expect(ergebnis.art).toBe('faceId');
    expect(ergebnis.bezeichnung).toBe('Face ID');
  });

  it('meldet Fingerabdruck auf entsprechenden Geraeten', async () => {
    verfuegbarkeitsAntwort = { ...verfuegbarkeitsAntwort, biometryType: 3 };
    const { biometrieVerfuegbar } = await laden();
    const ergebnis = await biometrieVerfuegbar();
    expect(ergebnis.art).toBe('fingerabdruck');
    expect(ergebnis.bezeichnung).toBe('Fingerabdruck');
  });

  it('meldet NICHT verfuegbar, wenn keine Biometrie eingerichtet ist', async () => {
    verfuegbarkeitsAntwort = { ...verfuegbarkeitsAntwort, isAvailable: false };
    const { biometrieVerfuegbar } = await laden();
    const ergebnis = await biometrieVerfuegbar();
    expect(ergebnis.verfuegbar).toBe(false);
  });

  it('meldet NICHT verfuegbar, wenn die Abfrage selbst fehlschlaegt', async () => {
    verfuegbarkeitsAntwort = new Error('Plugin kaputt');
    const { biometrieVerfuegbar } = await laden();
    const ergebnis = await biometrieVerfuegbar();
    expect(ergebnis.verfuegbar).toBe(false);
  });

  it('ist im Web abgeschaltet, obwohl das Plugin dort Verfuegbarkeit vortaeuscht', async () => {
    istNativ = false;
    const { biometrieVerfuegbar } = await laden();
    const ergebnis = await biometrieVerfuegbar();
    expect(ergebnis.verfuegbar).toBe(false);
    // Das Plugin darf im Web gar nicht erst gefragt werden.
    expect(mockIsAvailable).not.toHaveBeenCalled();
  });
});

describe('biometrieAktivieren', () => {
  it('legt die Sitzung biometrie-geschuetzt ab und setzt den Schalter', async () => {
    const { biometrieAktivieren, istBiometrieAktiv } = await laden();
    expect(await biometrieAktivieren()).toBe(true);
    expect(await istBiometrieAktiv()).toBe(true);

    const abgelegt = JSON.parse(sicher.get(SICHERER_SCHLUESSEL)!);
    expect(abgelegt.refreshToken).toBe('refresh-abc');
    expect(abgelegt.userId).toBe(42);
  });

  it('schuetzt die Ablage mit BIOMETRY_ANY und ohne offenes Zeitfenster-Missverhaeltnis', async () => {
    const { biometrieAktivieren } = await laden();
    await biometrieAktivieren();
    const optionen = mockSetData.mock.calls[0][0] as any;
    expect(optionen.accessControl).toBe(2); // BIOMETRY_ANY
    expect(optionen.key).toBe(SICHERER_SCHLUESSEL);
  });

  it('loescht die Klartext-Kopie des Refresh-Tokens aus den Preferences', async () => {
    prefs.set('konfi_refresh_token', 'refresh-abc');
    const { biometrieAktivieren } = await laden();
    await biometrieAktivieren();
    expect(prefs.has('konfi_refresh_token')).toBe(false);
  });

  it('tut nichts, wenn gar keine Sitzung vorliegt', async () => {
    aktuellerRefreshToken = null;
    const { biometrieAktivieren, istBiometrieAktiv } = await laden();
    expect(await biometrieAktivieren()).toBe(false);
    expect(await istBiometrieAktiv()).toBe(false);
    expect(mockSetData).not.toHaveBeenCalled();
  });

  it('bleibt im Web wirkungslos', async () => {
    istNativ = false;
    const { biometrieAktivieren, istBiometrieAktiv } = await laden();
    expect(await biometrieAktivieren()).toBe(false);
    expect(await istBiometrieAktiv()).toBe(false);
    expect(mockSetData).not.toHaveBeenCalled();
  });

  it('hinterlaesst keinen halb aktivierten Zustand, wenn das Ablegen scheitert', async () => {
    mockSetData.mockRejectedValueOnce(Object.assign(new Error('abgelehnt'), { code: 16 }));
    const { biometrieAktivieren, istBiometrieAktiv } = await laden();
    expect(await biometrieAktivieren()).toBe(false);
    expect(await istBiometrieAktiv()).toBe(false);
    expect(prefs.has(SCHALTER_SCHLUESSEL)).toBe(false);
  });
});

describe('biometrieVergessen', () => {
  it('loescht die gespeicherte Sitzung und den Schalter', async () => {
    const { biometrieAktivieren, biometrieVergessen, istBiometrieAktiv } = await laden();
    await biometrieAktivieren();
    expect(sicher.has(SICHERER_SCHLUESSEL)).toBe(true);

    await biometrieVergessen();

    expect(sicher.has(SICHERER_SCHLUESSEL)).toBe(false);
    expect(await istBiometrieAktiv()).toBe(false);
    expect(mockDeleteData).toHaveBeenCalledWith({ key: SICHERER_SCHLUESSEL });
  });
});

describe('mitBiometrieEntsperren', () => {
  it('gibt den gespeicherten Token nach erfolgreicher Pruefung zurueck', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren } = await laden();
    await biometrieAktivieren();

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('ok');
    if (ergebnis.status !== 'ok') throw new Error('unerwarteter Status');
    expect(ergebnis.refreshToken).toBe('refresh-abc');
    expect(ergebnis.user.id).toBe(42);
  });

  it('meldet Abbruch, wenn die Person die Abfrage wegdrueckt', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren } = await laden();
    await biometrieAktivieren();
    mockGetSecureData.mockRejectedValueOnce(
      Object.assign(new Error('User canceled'), { code: 16 })
    );

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('abgebrochen');
  });

  it('meldet Abbruch, wenn der Fingerabdruck nicht erkannt wird', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren } = await laden();
    await biometrieAktivieren();
    mockGetSecureData.mockRejectedValueOnce(
      Object.assign(new Error('Authentication failed'), { code: 10 })
    );

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('abgebrochen');
  });

  it('behaelt die gespeicherte Sitzung nach einem Abbruch', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren, istBiometrieAktiv } = await laden();
    await biometrieAktivieren();
    mockGetSecureData.mockRejectedValueOnce(
      Object.assign(new Error('User canceled'), { code: 16 })
    );

    await mitBiometrieEntsperren();

    // Ein Abbruch ist kein Grund, die Einrichtung wegzuwerfen.
    expect(await istBiometrieAktiv()).toBe(true);
    expect(sicher.has(SICHERER_SCHLUESSEL)).toBe(true);
  });

  it('raeumt auf, wenn im sicheren Speicher nichts mehr liegt', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren, istBiometrieAktiv } = await laden();
    await biometrieAktivieren();
    sicher.delete(SICHERER_SCHLUESSEL); // z.B. nach Neuinstallation

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('nichts-gespeichert');
    // Ohne Aufraeumen fragte die App bei jedem Start ins Leere.
    expect(await istBiometrieAktiv()).toBe(false);
  });

  it('fragt gar nicht erst, wenn der Schalter aus ist', async () => {
    const { mitBiometrieEntsperren } = await laden();
    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('nichts-gespeichert');
    expect(mockGetSecureData).not.toHaveBeenCalled();
  });

  it('verwirft eine Sitzung, die aelter als die Frist ist', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren, istBiometrieAktiv, GESPEICHERTE_SITZUNG_MAX_TAGE } =
      await laden();
    await biometrieAktivieren();

    // Zeitstempel kuenstlich altern lassen: einen Tag ueber der Frist.
    const abgelegt = JSON.parse(sicher.get(SICHERER_SCHLUESSEL)!);
    abgelegt.gespeichertAm =
      Date.now() - (GESPEICHERTE_SITZUNG_MAX_TAGE + 1) * 24 * 60 * 60 * 1000;
    sicher.set(SICHERER_SCHLUESSEL, JSON.stringify(abgelegt));

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('nichts-gespeichert');
    expect(await istBiometrieAktiv()).toBe(false);
    expect(sicher.has(SICHERER_SCHLUESSEL)).toBe(false);
  });

  it('akzeptiert eine Sitzung knapp innerhalb der Frist', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren, GESPEICHERTE_SITZUNG_MAX_TAGE } = await laden();
    await biometrieAktivieren();

    const abgelegt = JSON.parse(sicher.get(SICHERER_SCHLUESSEL)!);
    abgelegt.gespeichertAm =
      Date.now() - (GESPEICHERTE_SITZUNG_MAX_TAGE - 1) * 24 * 60 * 60 * 1000;
    sicher.set(SICHERER_SCHLUESSEL, JSON.stringify(abgelegt));

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('ok');
  });

  it('verwirft unbrauchbaren Inhalt im sicheren Speicher', async () => {
    const { biometrieAktivieren, mitBiometrieEntsperren, istBiometrieAktiv } = await laden();
    await biometrieAktivieren();
    sicher.set(SICHERER_SCHLUESSEL, 'kein-json');

    const ergebnis = await mitBiometrieEntsperren();
    expect(ergebnis.status).toBe('nichts-gespeichert');
    expect(await istBiometrieAktiv()).toBe(false);
  });
});

describe('rotationUebernehmen', () => {
  it('schreibt den rotierten Token in den sicheren Speicher', async () => {
    const { biometrieAktivieren, rotationUebernehmen } = await laden();
    await biometrieAktivieren();

    await rotationUebernehmen('refresh-neu');

    const abgelegt = JSON.parse(sicher.get(SICHERER_SCHLUESSEL)!);
    expect(abgelegt.refreshToken).toBe('refresh-neu');
  });

  it('verlaengert die 14-Tage-Frist NICHT', async () => {
    const { biometrieAktivieren, rotationUebernehmen } = await laden();
    await biometrieAktivieren();
    const vorher = JSON.parse(sicher.get(SICHERER_SCHLUESSEL)!).gespeichertAm;

    await rotationUebernehmen('refresh-neu');

    const nachher = JSON.parse(sicher.get(SICHERER_SCHLUESSEL)!).gespeichertAm;
    expect(nachher).toBe(vorher);
  });

  it('tut nichts, wenn die Biometrie gar nicht aktiv ist', async () => {
    const { rotationUebernehmen } = await laden();
    await rotationUebernehmen('refresh-neu');
    expect(mockSetData).not.toHaveBeenCalled();
  });

  it('bleibt im Web wirkungslos', async () => {
    istNativ = false;
    const { rotationUebernehmen } = await laden();
    await rotationUebernehmen('refresh-neu');
    expect(mockSetData).not.toHaveBeenCalled();
  });
});
