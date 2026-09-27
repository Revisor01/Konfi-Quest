// "Teamer:in löschen" in der Konfi-Liste läuft über denselben Weg wie
// "Benutzer:innen" (DELETE /users/:id) -- und sagt seit dem 27.09.2026 auch,
// dass eine Person, die in einer anderen Gemeinde mitarbeitet, nur aus der
// eigenen Gemeinde entfernt wird und ihr Konto dort bleibt.
//
// Die Teamer-Liste (GET /admin/konfis/teamer) kennt die Zahl der weiteren
// Gemeinden nicht; die Abfrage nennt deshalb beide Ausgänge, und die
// Erfolgsmeldung richtet sich nach der Antwort des Servers (konto_bleibt).
// Vorher meldete sie in jedem Fall "gelöscht".
//
// Gerendert wird die Seite; die Liste ist durch Knöpfe ersetzt, der
// Alert-Nachbau hält fest, was Ionic anzeigen würde.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { TeamerListenEintrag } from '../../types/user';

interface AlertKnopf { text: string; role?: string; handler?: () => unknown | Promise<unknown> }
interface AlertOptionen { header?: string; message?: string; buttons: AlertKnopf[] }

let offenerAlert: AlertOptionen | null = null;
const presentAlert = (optionen: AlertOptionen) => { offenerAlert = optionen; };

const apiDelete = vi.fn();
const setError = vi.fn();
const setSuccess = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [], headers: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 5, organization_id: 1, role_name: 'org_admin', display_name: 'Test Org-Admin 1' },
    setError,
    setSuccess,
    isOnline: true,
  }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
}));

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [],
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshLive: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));

const teamer: TeamerListenEintrag = { id: 3, name: 'Test Teamer 1', username: 'teamer1' };

vi.mock('../../components/admin/KonfisView', () => ({
  default: ({ onDeleteTeamer }: { onDeleteTeamer: (t: TeamerListenEintrag) => void }) =>
    React.createElement('button', { onClick: () => onDeleteTeamer(teamer) }, 'teamer-entfernen'),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: durch,
    IonContent: durch,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonButton: durch,
    IonIcon: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminKonfisPage from '../../components/admin/pages/AdminKonfisPage';

const oeffneUndLoesche = async () => {
  render(<AdminKonfisPage />);
  fireEvent.click(screen.getByText('teamer-entfernen'));
  const a = offenerAlert;
  if (!a) throw new Error('Keine Sicherheitsabfrage aufgegangen');
  const knopf = a.buttons.find(b => b.text === 'Löschen');
  if (!knopf) throw new Error('Knopf "Löschen" fehlt');
  await act(async () => { await knopf.handler?.(); });
  return a;
};

beforeEach(() => {
  offenerAlert = null;
  apiDelete.mockReset();
  setError.mockReset();
  setSuccess.mockReset();
});

describe('Teamer:in aus der Konfi-Liste entfernen', () => {
  it('die Abfrage nennt beide Ausgänge', async () => {
    apiDelete.mockResolvedValue({ data: { message: 'Benutzer erfolgreich gelöscht', konto_bleibt: false } });
    const a = await oeffneUndLoesche();

    expect(a.header).toBe('Teamer:in löschen');
    expect(a.message).toBe(
      'Teamer:in "Test Teamer 1" wirklich löschen?\n\n'
      + 'Das Konto wird mit allen zugehörigen Daten entfernt. Punkte und Abzeichen aus einer früheren Konfi-Zeit gehen dabei verloren.\n\n'
      + 'Arbeitet die Person auch in einer anderen Gemeinde mit, wird sie nur aus deiner Gemeinde entfernt; ihr Konto bleibt dort bestehen.'
    );
  });

  it('Konto gelöscht: "gelöscht"', async () => {
    apiDelete.mockResolvedValue({ data: { message: 'Benutzer erfolgreich gelöscht', konto_bleibt: false } });
    await oeffneUndLoesche();

    expect(apiDelete).toHaveBeenCalledWith('/users/3');
    expect(setSuccess).toHaveBeenCalledWith('Teamer:in "Test Teamer 1" gelöscht');
  });

  it('Konto bleibt in einer anderen Gemeinde: die Meldung sagt das', async () => {
    apiDelete.mockResolvedValue({
      data: { message: 'Aus dieser Gemeinde entfernt; das Konto bleibt in einer anderen Gemeinde bestehen', konto_bleibt: true },
    });
    await oeffneUndLoesche();

    expect(setSuccess).toHaveBeenCalledWith('Teamer:in "Test Teamer 1" aus deiner Gemeinde entfernt; das Konto bleibt in einer anderen Gemeinde bestehen');
    expect(setError).not.toHaveBeenCalled();
  });
});
