import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Der ANMELDE-Schalter (Biometrie statt Passwort auf der Anmeldeseite) ist am
// 27.08.2026 aus allen drei Profil-Ansichten entfernt worden und bleibt draussen.
//
// Warum er rausgeflogen ist (Nutzerbefund beim Testen von 2.0.0):
// Der Schalter hatte keine sichtbare Wirkung. Beim Wiederöffnen der App wurde
// keine Biometrie verlangt — er greift naemlich nur auf der Anmeldeseite, und
// wer angemeldet bleibt (der Normalfall, 90 Tage), kommt dort nie vorbei.
//
// GENAU DIESE LUECKE schliesst seitdem die APP-SPERRE (shared/AppSperreSchalter,
// services/appSperre): ein Schloss vor der bereits angemeldeten App. Sie ist
// etwas anderes als der Anmelde-Weg hier und steht in allen drei Ansichten —
// festgehalten in appSperreSchalter.test.tsx.
//
// Die Komponente des Anmelde-Schalters ist seit dem 02.10.2026 geloescht
// (Simon: "Biometrie ist voll drin" -- naemlich in der App-Sperre). Der Dienst
// services/biometrics.ts BLEIBT: Die App-Sperre fragt ueber ihn, ob das Geraet
// Biometrie eingerichtet hat. Dieser Test haelt beides fest -- keine
// Einbindung des Anmelde-Schalters, und die App-Sperre steht auf dem Dienst.

const mockIsAvailable = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async () => ({ value: null })),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}));
// Nur das Plugin ist ersetzt, NICHT services/biometrics: Geprueft wird der
// echte Weg App-Sperre -> Biometrie-Dienst -> Geraet.
vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: {
    isAvailable: (...a: unknown[]) => mockIsAvailable(...(a as [])),
    verifyIdentity: vi.fn(async () => undefined),
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
vi.mock('../../services/tokenStore', () => ({
  getRefreshToken: () => null,
  getUser: () => null,
  setRefreshToken: vi.fn(),
}));

import { sperreVerfuegbar } from '../../services/appSperre';
import AppSperreSchalter from '../../components/shared/AppSperreSchalter';

const profilSeiten: { rolle: string; datei: string }[] = [
  { rolle: 'Leitung', datei: 'src/components/admin/pages/AdminProfilePage.tsx' },
  { rolle: 'Teamer:innen', datei: 'src/components/teamer/pages/TeamerProfilePage.tsx' },
  { rolle: 'Konfis', datei: 'src/components/konfi/views/ProfileView.tsx' },
];

// WAECHTER (bewusst Quelltext, Abwesenheit): Die Komponente des
// Anmelde-Schalters ist geloescht; der Test faengt eine Wiedereinbindung unter
// altem Namen ab. Was stattdessen in den Profilen steht, prueft der gerenderte
// Abschnitt unten und appSperreSchalter.test.tsx.
describe('Der Anmelde-Schalter bleibt ueberall ausgebaut', () => {
  for (const { rolle, datei } of profilSeiten) {
    it(`${rolle}: keine Einbindung mehr in ${datei.split('/').pop()}`, () => {
      const inhalt = readFileSync(resolve(__dirname, '../../..', datei), 'utf-8');
      // Gezielt der Anmelde-Schalter: AppSperreSchalter steht dort sehr wohl
      // und darf hier nicht mitgefangen werden.
      expect(inhalt).not.toMatch(/(?<!App)(?<!AppSperre)\bBiometrieSchalter\b/);
    });
  }
});

describe('Die App-Sperre fragt ueber den Biometrie-Dienst', () => {
  beforeEach(() => {
    mockIsAvailable.mockReset();
  });

  it('bietet sich an, wenn das Geraet Biometrie eingerichtet hat', async () => {
    mockIsAvailable.mockResolvedValue({ isAvailable: true, biometryType: 2 });
    expect(await sperreVerfuegbar()).toBe(true);
    // Die Frage geht durch biometrieVerfuegbar(): Nur dort steht
    // useFallback: false -- die Geraete-PIN zaehlt nicht als Biometrie.
    expect(mockIsAvailable).toHaveBeenCalledTimes(1);
    expect(mockIsAvailable).toHaveBeenCalledWith({ useFallback: false });
  });

  it('bietet sich NICHT an, wenn das Geraet keine Biometrie hat', async () => {
    // Gegenprobe: Ohne diese Pruefung waere die Sperre ein Schalter ins Leere.
    mockIsAvailable.mockResolvedValue({ isAvailable: false, biometryType: 0 });
    expect(await sperreVerfuegbar()).toBe(false);
    expect(mockIsAvailable).toHaveBeenCalledTimes(1);
  });
});

// Derselbe Weg gerendert: Der Eintrag in den Konto-Einstellungen aller drei
// Rollen (shared/AppSperreSchalter) erscheint nur, wenn der ECHTE
// Biometrie-Dienst ein eingerichtetes Verfahren meldet -- ersetzt ist nur das
// Plugin am Geraet.
describe('Der Eintrag "App sperren" haengt am Biometrie-Dienst', () => {
  beforeEach(() => {
    mockIsAvailable.mockReset();
  });

  it('erscheint mit dem Namen des Verfahrens, wenn das Geraet Face ID eingerichtet hat', async () => {
    mockIsAvailable.mockResolvedValue({ isAvailable: true, biometryType: 2 });
    render(<AppSperreSchalter variante="teamer" />);
    expect((await screen.findByText('App sperren')).textContent).toBe('App sperren');
    expect(screen.getByText('Die App nach einer Pause mit Face ID schützen').textContent).toBe(
      'Die App nach einer Pause mit Face ID schützen'
    );
    expect(mockIsAvailable).toHaveBeenCalledWith({ useFallback: false });
  });

  it('erscheint NICHT, wenn das Geraet keine Biometrie hat', async () => {
    mockIsAvailable.mockResolvedValue({ isAvailable: false, biometryType: 0 });
    const { container } = render(<AppSperreSchalter variante="purple" />);
    await waitFor(() => expect(mockIsAvailable).toHaveBeenCalled());
    // Ein Tick mehr: Der Effekt setzt den Zustand erst nach allen drei Antworten.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('App sperren')).toBeNull();
    expect(container.innerHTML).toBe('');
  });
});
