// Registrierung mit Einladungscode -- gerendert (Audit Tests 26.09.2026,
// BF-02; bis 30.09.2026 prüften auth.test.ts und geraeteKennungMitsenden.test.ts
// diese Seite am Quelltext).
//
// Zwei Versprechen der Seite:
//
// 1. Die frisch ausgestellte Sitzung wird VOLLSTÄNDIG übernommen, samt
//    Refresh-Token (Audit 26.09.2026, Grundgerüst BF-03). Bis dahin speicherte
//    die Seite nur { token, user }; nach 15 Minuten flog jede neue Konfi mit
//    "Deine Sitzung ist abgelaufen" hinaus.
// 2. Die Anfrage trägt die Geräte-Kennung, damit der Server das Refresh-Token
//    an das Gerät bindet (Sicherheit BF-08).
//
// Gerendert wird die echte Seite mit der echten Sitzungs-Übernahme
// (services/auth); gestellt sind Server, Geräte-Kennung und der Speicher der
// Anmeldedaten. Die Eingabefelder sind schlichte <input>: echte ion-input
// reichen in jsdom keine Eingaben an React weiter (anmeldeseitenBarrierefrei).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

type Eingabe = (e: { detail: { value: string } }) => void;
const routerPush = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: routerPush, goBack: vi.fn(), canGoBack: () => false, routeInfo: undefined }),
  IonInput: ({ 'aria-label': name, value, onIonInput, onIonBlur }: {
    'aria-label'?: string; value?: string; onIonInput?: Eingabe; onIonBlur?: () => void;
  }) => (
    <input aria-label={name} value={value ?? ''} onBlur={() => onIonBlur?.()}
      onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
  ),
  IonButton: ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) =>
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>,
}));

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    put: vi.fn(), delete: vi.fn(),
  },
}));

let kennung: string | null = 'geraet-7';
vi.mock('../../services/geraeteKennung', () => ({ geraeteKennung: async () => kennung }));

// Der Speicher der Anmeldedaten -- hier schreibt die echte Sitzungs-Übernahme hin.
const gespeichert = { setToken: vi.fn(), setRefreshToken: vi.fn(), setUser: vi.fn() };
vi.mock('../../services/tokenStore', () => ({
  setToken: (...a: unknown[]) => gespeichert.setToken(...a),
  setRefreshToken: (...a: unknown[]) => gespeichert.setRefreshToken(...a),
  setUser: (...a: unknown[]) => gespeichert.setUser(...a),
  getToken: () => null, getRefreshToken: () => null, getUser: () => null, getDeviceId: () => null,
  getActiveOrgId: () => null, clearAuth: vi.fn(), setLoggingOut: vi.fn(), isLoggingOut: () => false,
}));
vi.mock('../../services/biometrics', () => ({
  mitBiometrieEntsperren: vi.fn(), gespeichertenTokenAuffrischen: vi.fn(),
  biometrieVergessen: vi.fn(), istBiometrieAktiv: vi.fn(async () => false), rotationUebernehmen: vi.fn(),
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clearAll: vi.fn() } }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn() }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { flush: vi.fn(), clear: vi.fn() } }));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));

// Derselbe Standort zwischen zwei Rendern (siehe anmeldeseitenBarrierefrei).
const standort = { pathname: '/register', search: '?code=ABC12345', state: null };
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => standort }));

const appSetUser = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setUser: appSetUser, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));

import KonfiRegisterPage from '../../components/auth/KonfiRegisterPage';

const NEUE_KONFI = { id: 31, display_name: 'Mia Neu', username: 'mia.neu', role_name: 'konfi', type: 'konfi' };

beforeEach(() => {
  vi.clearAllMocks();
  kennung = 'geraet-7';
  api.get.mockImplementation(async (pfad: string) => {
    if (pfad === '/auth/validate-invite/ABC12345') return { data: { jahrgang_name: 'Jahrgang 2027', organization_name: 'Gemeinde Test' } };
    if (pfad.startsWith('/auth/check-username/')) return { data: { available: true } };
    throw new Error(`unerwartet: ${pfad}`);
  });
  api.post.mockResolvedValue({ data: { token: 'zugang-1', refresh_token: 'auffrischen-1', user: NEUE_KONFI } });
});
afterEach(() => cleanup());

const tippe = (name: string, wert: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value: wert } });
const tippePasswort = (name: string, wert: string) => fireEvent.change(screen.getByLabelText(name), { target: { value: wert } });

const registrieren = async () => {
  render(<KonfiRegisterPage />);
  await screen.findByRole('textbox', { name: 'Dein Name' });
  tippe('Dein Name', 'Mia Neu');
  tippe('Benutzername', 'mia.neu');
  tippePasswort('Passwort', 'Johannes7,47');
  tippePasswort('Passwort bestätigen', 'Johannes7,47');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Registrieren' })); });
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
};

const registrierAufrufe = () => api.post.mock.calls.filter((c) => c[0] === '/auth/register-konfi');

describe('Registrierung: die Sitzung wird vollständig übernommen', () => {
  it('schickt die Registrierung genau einmal, mit Code und Anmeldedaten', async () => {
    await registrieren();
    expect(registrierAufrufe()).toHaveLength(1);
    expect(registrierAufrufe()[0][1]).toMatchObject({
      invite_code: 'ABC12345', display_name: 'Mia Neu', username: 'mia.neu', password: 'Johannes7,47',
    });
  });

  it('speichert das Refresh-Token -- sonst endet die Sitzung nach 15 Minuten', async () => {
    await registrieren();
    expect(gespeichert.setRefreshToken).toHaveBeenCalledTimes(1);
    expect(gespeichert.setRefreshToken).toHaveBeenCalledWith('auffrischen-1');
  });

  it('speichert Zugangs-Token und Person und meldet die Person an', async () => {
    await registrieren();
    expect(gespeichert.setToken).toHaveBeenCalledWith('zugang-1');
    expect(gespeichert.setUser).toHaveBeenCalledWith(NEUE_KONFI);
    expect(appSetUser).toHaveBeenCalledWith(NEUE_KONFI);
  });

  it('ohne Token in der Antwort wird nichts gespeichert und niemand angemeldet', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    await registrieren();
    expect(gespeichert.setToken).not.toHaveBeenCalled();
    expect(gespeichert.setRefreshToken).not.toHaveBeenCalled();
    expect(appSetUser).not.toHaveBeenCalled();
  });
});

describe('Registrierung: die Geräte-Kennung geht mit', () => {
  it('die Anfrage trägt die Kennung dieses Geräts', async () => {
    await registrieren();
    expect(registrierAufrufe()[0][1]).toHaveProperty('device_id', 'geraet-7');
  });

  it('ohne ermittelbare Kennung geht die Anfrage ohne das Feld (Token bleibt ungebunden)', async () => {
    kennung = null;
    await registrieren();
    expect(registrierAufrufe()).toHaveLength(1);
    expect(registrierAufrufe()[0][1]).not.toHaveProperty('device_id');
  });
});
