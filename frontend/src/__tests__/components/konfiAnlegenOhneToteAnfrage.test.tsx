// Nach dem Anlegen einer Konfi kommt das Einmalpasswort ohne toten Umweg
// (Audit 26.09.2026, Screens Leitung BF-06).
//
// Nach dem POST /admin/konfis rief die Seite createOrJoinJahrgangChat: erst
// GET /admin/jahrgaenge/:id -- eine Route, die es nicht gibt (404) --, dann
// haette sie POST /chat/rooms geschickt, kam aber nie dahin; der Fehler wurde
// geschluckt. Den Jahrgangs-Chat pflegt der Server beim Anlegen ohnehin
// (konfi-management.js, syncJahrgangChat in der Transaktion). Der Aufruf
// stand VOR dem Passwort-Dialog: ein fehlgeschlagener Roundtrip je Anlage und
// ein 404 im Fehlerprotokoll des Betriebs.
//
// Gerendert wird die Seite; das Formular ist ersetzt, sein onSave wird direkt
// aufgerufen, der Alert-Nachbau haelt fest, was Ionic anzeigen wuerde.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

interface AlertOptionen { header?: string; subHeader?: string; message?: string }
let alerts: AlertOptionen[] = [];

const apiGet = vi.fn();
const apiPost = vi.fn();
let formularProps: { onSave?: (daten: Record<string, unknown>) => void } | null = null;

vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: vi.fn(),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 5, organization_id: 1, role_name: 'org_admin', display_name: 'Test Org-Admin 1' },
    setError: vi.fn(), setSuccess: vi.fn(), isOnline: true,
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [], loading: false, error: null, isStale: false, isOffline: false,
    refresh: vi.fn().mockResolvedValue(undefined), refreshLive: vi.fn(),
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
vi.mock('../../components/admin/KonfisView', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return {
    IonPage: durch, IonContent: durch, IonRefresher: () => null, IonRefresherContent: () => null,
    IonButton: durch, IonIcon: () => null,
    // Das Konfi-Formular ist das einzige Modal mit onSave und jahrgaenge.
    useIonModal: (_k: unknown, props?: Record<string, unknown>) => {
      if (props && 'onSave' in props && 'jahrgaenge' in props) formularProps = props as typeof formularProps;
      return [vi.fn(), vi.fn()];
    },
    useIonAlert: () => [(o: AlertOptionen) => { alerts.push(o); }, vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminKonfisPage from '../../components/admin/pages/AdminKonfisPage';

beforeEach(() => {
  alerts = [];
  formularProps = null;
  apiGet.mockReset();
  apiPost.mockReset();
  apiGet.mockResolvedValue({ data: [], headers: {} });
  apiPost.mockResolvedValue({ data: { id: 42, username: 'kim.test', temporaryPassword: 'Apfel-Birne-7' } });
});

describe('Konfi anlegen', () => {
  it('ruft keine Jahrgangs-Route und keinen Chat-Raum auf, nur POST /admin/konfis', async () => {
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.({ name: 'Kim Test', jahrgang_id: 2 }); });

    await waitFor(() => expect(alerts.some((a) => a.header === 'Einmalpasswort')).toBe(true));
    expect(apiGet.mock.calls.map((c) => c[0])).not.toContain('/admin/jahrgaenge/2');
    expect(apiPost.mock.calls.map((c) => c[0])).toEqual(['/admin/konfis']);
  });

  it('das Einmalpasswort erscheint mit dem Passwort aus der Antwort', async () => {
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.({ name: 'Kim Test', jahrgang_id: 2 }); });

    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0].header).toBe('Einmalpasswort');
    expect(alerts[0].subHeader).toBe('Apfel-Birne-7');
  });
});
