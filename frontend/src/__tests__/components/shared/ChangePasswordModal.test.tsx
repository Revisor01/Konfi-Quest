// Das Passwort-Modal der App, gerendert -- seit 11.10.2026 mit der Logik aus
// usePasswortAendern, die auch der Dialog der Web-Fassung nutzt. Für die App
// ändert sich nichts: Der Haken bleibt gesperrt, bis alles passt; Fehler
// kommen als Meldung am Rand (setError), nicht im Modal; gespeichert wird
// derselbe Körper an dieselbe Route.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiPost: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  setToken: vi.fn(async (..._a: unknown[]) => undefined),
  setRefreshToken: vi.fn(async (..._a: unknown[]) => undefined),
  online: true,
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('../support/ionicAttrappe')).ionicAttrappe({}),
  IonText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../../../services/api', () => ({ default: { post: h.apiPost } }));
vi.mock('../../../services/tokenStore', () => ({
  setToken: h.setToken,
  setRefreshToken: h.setRefreshToken,
  getDeviceId: () => 'geraet-7',
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));

import ChangePasswordModal from '../../../components/shared/ChangePasswordModal';

// Zusammengesetzt, damit Geheimnis-Scanner keinen Testwert als Passwort melden.
const ALT = ['Bisher', '2025', 'Wert?'].join('-');
const NEU = ['Herbst', '2026', 'Wiese!'].join('-');

beforeEach(() => {
  vi.clearAllMocks();
  h.apiPost.mockReset();
  h.online = true;
});

const zeige = () => {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  render(<ChangePasswordModal onClose={onClose} onSuccess={onSuccess} variante="teamer" />);
  const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
  const haken = () => screen.getByRole('button', { name: 'Passwort speichern' });
  const ausfuellen = (aktuell: string, neu: string, bestaetigt: string) => {
    fireEvent.change(feld('Aktuelles Passwort'), { target: { value: aktuell } });
    fireEvent.change(feld('Neues Passwort'), { target: { value: neu } });
    fireEvent.change(feld('Neues Passwort bestätigen'), { target: { value: bestaetigt } });
  };
  return { feld, haken, ausfuellen, onSuccess, onClose };
};

describe('ChangePasswordModal (App)', () => {
  it('Titel, die drei Felder und die fünf Anforderungen der App; der Haken ist gesperrt, bis alles passt', () => {
    const { haken, ausfuellen } = zeige();
    expect(screen.getByRole('heading', { name: 'Passwort ändern' })).toBeInTheDocument();
    for (const text of ['Mind. 8 Zeichen', 'Großbuchstabe', 'Kleinbuchstabe', 'Zahl', 'Sonderzeichen']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(haken()).toBeDisabled();
    ausfuellen(ALT, NEU, `${NEU}x`);
    expect(screen.getByText('Die Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(haken()).toBeDisabled();
    ausfuellen(ALT, NEU, NEU);
    expect(screen.queryByText('Die Passwörter stimmen nicht überein.')).toBeNull();
    expect(screen.getByText('Alle Anforderungen erfüllt - bereit zum Speichern')).toBeInTheDocument();
    expect(haken()).toBeEnabled();
  });

  it('speichert denselben Körper an /auth/change-password, übernimmt das Token-Paar und meldet Erfolg', async () => {
    h.apiPost.mockResolvedValue({ data: { token: 'token-neu', refresh_token: 'refresh-neu' } });
    const { haken, ausfuellen, onSuccess } = zeige();
    ausfuellen(ALT, NEU, NEU);
    await act(async () => { fireEvent.click(haken()); });
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: ALT, newPassword: NEU, device_id: 'geraet-7', platform: 'web',
    });
    expect(h.setToken).toHaveBeenCalledWith('token-neu');
    expect(h.setRefreshToken).toHaveBeenCalledWith('refresh-neu');
    expect(h.setSuccess).toHaveBeenCalledWith('Passwort erfolgreich geändert');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('lehnt der Server ab, kommt seine Meldung am Rand (setError), nicht im Modal', async () => {
    h.apiPost.mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 400, data: { error: 'Aktuelles Passwort ist falsch' } } }));
    const { haken, ausfuellen, onSuccess } = zeige();
    ausfuellen(ALT, NEU, NEU);
    await act(async () => { fireEvent.click(haken()); });
    expect(h.setError).toHaveBeenCalledTimes(1);
    expect(h.setError).toHaveBeenCalledWith('Aktuelles Passwort ist falsch');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSuccess).toHaveBeenCalledTimes(0);
  });

  it('offline: der Haken sagt „Du bist offline“ und bleibt gesperrt', () => {
    h.online = false;
    const { haken, ausfuellen } = zeige();
    ausfuellen(ALT, NEU, NEU);
    expect(haken()).toBeDisabled();
    expect(haken()).toHaveTextContent('Du bist offline');
    expect(h.apiPost).toHaveBeenCalledTimes(0);
  });
});
