import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Die Anmeldeseite zeigte bei JEDER Ablehnung durch den Server „Keine
// Verbindung zum Server. Bitte prüfe deine Internetverbindung." -- beim
// falschen Passwort, beim deaktivierten Zugang, bei „zu viele Versuche".
//
// URSACHE, am Code nachgesehen (auch in der Store-Version 2.2.0):
// services/auth.ts `loginWithAutoDetection` fing den axios-Fehler und warf
// ein NEUES `Error('Login fehlgeschlagen: …')`. Status, Antwort und die
// Rate-Limit-Meldung aus services/api.ts blieben am alten Fehler haengen.
// LoginView fragt der Reihe nach `status === 429`, dann `!fehler.response`
// -- und ohne `response` landete alles im Zweig „Keine Verbindung". Der
// 429-Zweig, eigens gebaut, damit „zu viele Versuche" nicht als fehlende
// Verbindung erscheint, war damit nie erreichbar.
//
// Mit der Sperre je Konto nach zehn falschen Passwoertern (Audit
// 26.09.2026, Sicherheit BF-04) wiegt das schwerer: Die Meldung des Servers
// sagt dem Kind, was es tun kann (warten oder die Leitung um ein neues
// Passwort bitten). Kommt statt dessen „Keine Verbindung", sucht es den
// Fehler am WLAN.
//
// Diese Tests laufen durch die ECHTE services/auth.ts und die ECHTE
// LoginView; ersetzt sind nur der HTTP-Aufruf (api.post, mit Fehlerobjekten
// in der Form, die axios und der Interceptor in services/api.ts liefern) und
// die Geraete-Plugins. ion-input nimmt in jsdom keine Werte an (siehe
// anmeldeseitenBarrierefrei.test.tsx) und ist hier durch ein schlichtes
// <input> ersetzt, das dieselben Props bedient.
// ---------------------------------------------------------------------------

type IonInputProps = {
  value?: string;
  type?: string;
  'aria-label'?: string;
  onIonInput?: (e: { detail: { value: string } }) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...echt,
    useIonRouter: () => ({ push: vi.fn(), goBack: vi.fn(), canGoBack: () => false, routeInfo: undefined }),
    IonInput: ({ value, type, onIonInput, onKeyDown, ...rest }: IonInputProps) => (
      <input
        aria-label={rest['aria-label']}
        type={type}
        value={value ?? ''}
        onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })}
        onKeyDown={onKeyDown}
      />
    ),
  };
});

const mockPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: (...a: unknown[]) => mockPost(...a),
    put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  },
  API_URL: 'http://localhost/api',
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));
vi.mock('@capacitor/device', () => ({
  Device: { getInfo: vi.fn(async () => ({ platform: 'web' })), getId: vi.fn(async () => ({ identifier: 'x' })) },
}));
vi.mock('../../services/tokenStore', () => ({
  setToken: vi.fn(), setUser: vi.fn(), setRefreshToken: vi.fn(), getRefreshToken: vi.fn(),
  clearAuth: vi.fn(), getDeviceId: vi.fn(), setLoggingOut: vi.fn(),
}));
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: async () => ({ verfuegbar: false, art: 'keine', bezeichnung: null, sinnbild: 'schloss' }),
  istBiometrieAktiv: async () => false,
  mitBiometrieEntsperren: vi.fn(),
  gespeichertenTokenAuffrischen: vi.fn(),
  biometrieVergessen: vi.fn(),
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { clear: vi.fn() } }));
vi.mock('../../services/mediaCache', () => ({ clearMediaCache: vi.fn() }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { flush: vi.fn(), clear: vi.fn() } }));
vi.mock('../../services/websocket', () => ({ disconnectWebSocket: vi.fn() }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setUser: vi.fn(), setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));

import LoginView from '../../components/auth/LoginView';

/** Ein axios-Fehler mit Antwort, wie ihn der Interceptor in services/api.ts weiterreicht. */
function serverFehler(status: number, data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    code: status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    response: { status, data, headers: {} },
    ...extra,
  });
}

async function anmeldenUndMeldungLesen() {
  render(<LoginView />);
  fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'konfi1' } });
  const passwort = screen.getByLabelText('Passwort');
  fireEvent.change(passwort, { target: { value: 'Johannes7,47' } });
  fireEvent.keyDown(passwort, { key: 'Enter' });
  const alarm = await screen.findByRole('alert');
  // Web-Version (isNativePlatform false): mit der Zusage fuer Konten ohne
  // Gemeinde (services/ohneGemeinde.ts).
  expect(mockPost).toHaveBeenCalledWith('/auth/login', { username: 'konfi1', password: 'Johannes7,47', kann_ohne_gemeinde: true });
  return alarm.querySelector('.app-auth-error__detail')?.textContent;
}

const KEINE_VERBINDUNG = 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.';
const SPERRE = 'Zu viele falsche Anmeldeversuche für dieses Konto. Versuche es in einer Stunde wieder oder bitte die Leitung deiner Gemeinde um ein neues Passwort.';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('Anmeldeseite: die Ablehnung des Servers kommt mit der passenden Meldung an', () => {
  it('Konto gesperrt (429): die Meldung des Servers, nicht „Keine Verbindung"', async () => {
    mockPost.mockRejectedValueOnce(serverFehler(429,
      { error: SPERRE, error_code: 'account_locked' },
      { rateLimitMessage: SPERRE }));
    expect(await anmeldenUndMeldungLesen()).toBe(SPERRE);
  });

  it('zu viele Versuche aus einem Netz (429 der IP-Grenze): die Meldung des Servers', async () => {
    const text = 'Zu viele Login-Versuche. Bitte warte 15 Minuten.';
    mockPost.mockRejectedValueOnce(serverFehler(429, { error: text }, { rateLimitMessage: text }));
    expect(await anmeldenUndMeldungLesen()).toBe(text);
  });

  it('falsches Passwort (401): „Falsches Passwort"', async () => {
    mockPost.mockRejectedValueOnce(serverFehler(401, { error: 'Ungültige Anmeldedaten' }));
    expect(await anmeldenUndMeldungLesen()).toBe('Falsches Passwort. Bitte versuche es erneut.');
  });

  it('Zugang deaktiviert (403 user_inactive): die Meldung des Servers', async () => {
    const text = 'Dein Zugang wurde deaktiviert. Bitte wende dich an deine Gemeinde.';
    mockPost.mockRejectedValueOnce(serverFehler(403, { error: text, error_code: 'user_inactive' }));
    expect(await anmeldenUndMeldungLesen()).toBe(text);
  });

  it('Konto ohne Gemeinde (403 mit grund): der Hinweis des Servers auf die Web-Version', async () => {
    const text = 'Dieses Konto gehört zu keiner Gemeinde und ist für die Support-Ansicht im Browser bestimmt. Bitte melde dich auf konfi-quest.de an.';
    mockPost.mockRejectedValueOnce(serverFehler(403, { error: text, error_code: 'user_inactive', grund: 'konto_ohne_gemeinde' }));
    expect(await anmeldenUndMeldungLesen()).toBe(text);
  });

  it('ein genannter grund zeigt den Text des Servers auch ohne Sperr-Code', async () => {
    const text = 'Dieses Konto gehört zu keiner Gemeinde und ist für die Support-Ansicht im Browser bestimmt. Bitte melde dich auf konfi-quest.de an.';
    mockPost.mockRejectedValueOnce(serverFehler(403, { error: text, grund: 'konto_ohne_gemeinde' }));
    expect(await anmeldenUndMeldungLesen()).toBe(text);
  });

  it('erlaubt: ohne Antwort des Servers bleibt es bei „Keine Verbindung"', async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    expect(await anmeldenUndMeldungLesen()).toBe(KEINE_VERBINDUNG);
  });
});
