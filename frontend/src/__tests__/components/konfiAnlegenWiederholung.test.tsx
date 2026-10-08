// Konfi anlegen: ein zweiter Versuch legt kein zweites Konto an
// (Wiederholungsschutz, Migration 203, 08.10.2026; Rest von Grundgeruest
// BF-02).
//
// Das Anlage-Fenster schickt eine Kennung (client_id) mit. Kommt keine
// Antwort (Netz, Zeitlimit, 5xx), bietet die Seite "Erneut versuchen" an --
// mit DERSELBEN Kennung, dann liefert der Server dasselbe Konto mit neuem
// Einmalpasswort statt eines zweiten. Hat sich das Konto schon angemeldet,
// antwortet er 409 bereits_angelegt; das ist keine Namens-Kollision.
//
// Gerendert wird die Seite; das Formular ist ersetzt, sein onSave wird direkt
// aufgerufen, der Alert-Nachbau haelt fest, was Ionic anzeigen wuerde.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

interface AlertKnopf { text: string; role?: string; handler?: () => unknown }
interface AlertOptionen { header?: string; subHeader?: string; message?: string; buttons?: AlertKnopf[] }
let alerts: AlertOptionen[] = [];

const apiGet = vi.fn();
const apiPost = vi.fn();
const setError = vi.fn();
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
    setError: (...a: unknown[]) => setError(...a), setSuccess: vi.fn(), isOnline: true,
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KENNUNG = '0b6f4a9d-1e77-4c55-8e21-7f1c2b4e9a3d';
const DATEN = { name: 'Kim Test', jahrgang_id: 2, client_id: KENNUNG };
const netzfehler = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
const antwortFehler = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });

beforeEach(() => {
  alerts = [];
  formularProps = null;
  apiGet.mockReset();
  apiPost.mockReset();
  setError.mockReset();
  apiGet.mockResolvedValue({ data: [], headers: {} });
});

const knopf = (alert: AlertOptionen | undefined, text: string) => alert?.buttons?.find((b) => b.text === text);

describe('Konfi anlegen: Wiederholung mit derselben Kennung', () => {
  it('ohne Antwort: "Erneut versuchen" schickt dieselbe Kennung, dann kommt das Einmalpasswort', async () => {
    apiPost
      .mockRejectedValueOnce(netzfehler())
      .mockResolvedValueOnce({ data: { id: 42, username: 'kim.test', temporaryPassword: 'platzhalter' } });
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.(DATEN); });

    await waitFor(() => expect(alerts.map((a) => a.header)).toEqual(['Keine Antwort vom Server']));
    await act(async () => { await knopf(alerts[0], 'Erneut versuchen')?.handler?.(); });

    await waitFor(() => expect(alerts.map((a) => a.header)).toEqual(['Keine Antwort vom Server', 'Einmalpasswort']));
    expect(apiPost.mock.calls).toEqual([['/admin/konfis', DATEN], ['/admin/konfis', DATEN]]);
    expect(setError).not.toHaveBeenCalled();
  });

  it('Serverfehler 500: ebenfalls "Erneut versuchen"', async () => {
    apiPost.mockRejectedValueOnce(antwortFehler(500, { error: 'Datenbankfehler' }));
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.(DATEN); });

    await waitFor(() => expect(alerts.map((a) => a.header)).toEqual(['Keine Antwort vom Server']));
    expect(knopf(alerts[0], 'Erneut versuchen')).toBeTruthy();
  });

  it('"Trotzdem anlegen" nach der Limit-Rueckfrage behaelt die Kennung', async () => {
    apiPost
      .mockRejectedValueOnce(antwortFehler(409, { error: 'Tarif ausgeschöpft', error_code: 'limit_grace', count: 10, limit: 10 }))
      .mockResolvedValueOnce({ data: { id: 42, username: 'kim.test', temporaryPassword: 'platzhalter' } });
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.(DATEN); });

    await waitFor(() => expect(alerts.map((a) => a.header)).toEqual(['Konfi-Limit erreicht']));
    await act(async () => { await knopf(alerts[0], 'Trotzdem anlegen')?.handler?.(); });

    await waitFor(() => expect(alerts.map((a) => a.header)).toEqual(['Konfi-Limit erreicht', 'Einmalpasswort']));
    expect(apiPost.mock.calls[1]).toEqual(['/admin/konfis', { ...DATEN, confirm: true }]);
  });

  it('verboten: Konto schon in Benutzung (409 bereits_angelegt) -- Meldung des Servers, kein neuer Versuch', async () => {
    const meldung = 'Dieses Konto ist schon angelegt und wird benutzt. Ein neues Passwort gibt es in der Detailansicht der Konfi.';
    apiPost.mockRejectedValueOnce(antwortFehler(409, { error: meldung, error_code: 'bereits_angelegt', id: 42, username: 'kim.test' }));
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.(DATEN); });

    await waitFor(() => expect(setError).toHaveBeenCalledWith(meldung));
    expect(alerts).toEqual([]);
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('verboten: endgueltig abgelehnt (400) -- kein "Erneut versuchen"', async () => {
    apiPost.mockRejectedValueOnce(antwortFehler(400, { error: 'Name und Jahrgang sind erforderlich' }));
    render(<AdminKonfisPage />);
    await act(async () => { formularProps?.onSave?.(DATEN); });

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Name und Jahrgang sind erforderlich'));
    expect(alerts).toEqual([]);
  });
});

describe('Das Anlage-Fenster traegt eine Kennung je offenem Fenster', () => {
  const modal = readFileSync(join(__dirname, '../../components/admin/modals/KonfiModal.tsx'), 'utf8');

  it('einmal je Fenster erzeugt, nur beim Anlegen mitgeschickt', () => {
    expect(modal).toContain('const anlegeKennung = useRef(safeUUID());');
    expect(modal).toContain('...(bearbeiten ? {} : { client_id: anlegeKennung.current })');
    // Je Speichern eine neue Kennung waere wirkungslos.
    expect(modal).not.toContain('client_id: safeUUID()');
  });
});
