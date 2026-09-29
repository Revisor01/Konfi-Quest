// Die Sicherheitsabfrage vor dem Entfernen einer Person aus "Benutzer:innen"
// sagt, was wirklich passiert (27.09.2026).
//
// Simons Entscheidung: "Ich muss jemanden, der in mehreren Organisationen ist,
// in meiner loeschen koennen und dafuer sorgen, dass er dann nicht mehr in
// meiner ist. [...] Die andere Institution oder Organisation muss dann den
// Account behalten, aber es muss, wie bisher auch, eine letzte Meldung geben."
//
// DELETE /users/:id kennt seither drei Faelle, und die Abfrage muss jeden
// beim Namen nennen:
//   1. 'weitere'  -- anderswo zuhause: nur die Mitgliedschaft hier endet.
//   2. 'stamm' mit weitere_gemeinden > 0 -- hier zuhause, aber auch anderswo
//      Mitglied: sie wird nur aus dieser Gemeinde entfernt, das Konto bleibt.
//   3. 'stamm' ohne weitere Gemeinde -- das Konto wird geloescht.
// Bis dahin fragte Fall 2 "wirklich loeschen?" -- und das Backend loeschte
// tatsaechlich das ganze Konto, samt der Mitgliedschaft in der anderen
// Gemeinde.
//
// Geprueft wird Verhalten, nicht Quelltext: Die Seite wird gerendert, die
// Person in der Liste zum Entfernen angetippt, und der Alert-Nachbau haelt
// fest, was Ionic anzeigen wuerde. Danach wird der Knopf gedrueckt -- die
// Erfolgsmeldung kommt aus der Serverantwort.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { AdminUser } from '../../types/user';

// --- Alert-Nachbau ----------------------------------------------------------

interface AlertKnopf { text: string; role?: string; handler?: () => unknown | Promise<unknown> }
interface AlertOptionen { header?: string; message?: string; buttons: AlertKnopf[] }

let offenerAlert: AlertOptionen | null = null;
const presentAlert = (optionen: AlertOptionen) => { offenerAlert = optionen; };

const tippeAlertKnopf = async (text: string) => {
  const knopf = offenerAlert?.buttons.find(b => b.text === text);
  if (!knopf) throw new Error(`Knopf "${text}" fehlt im Alert "${offenerAlert?.header}"`);
  await act(async () => { await knopf.handler?.(); });
};

// --- Mocks ------------------------------------------------------------------

const apiDelete = vi.fn();
const setError = vi.fn();
const setSuccess = vi.fn();
const refreshUsers = vi.fn().mockResolvedValue(undefined);
let testUsers: AdminUser[] = [];

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 5, organization_id: 1, role_name: 'org_admin' },
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
    data: testUsers,
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: refreshUsers,
    refreshLive: vi.fn(),
  }),
}));

// Die Liste ersetzt durch je einen Knopf pro Person: Der Wisch-Gestus ist
// nicht Gegenstand dieses Tests (die Liste hat eigene Tests), der Weg ab
// onDeleteUser ist es.
vi.mock('../../components/admin/UsersView', () => ({
  default: ({ users, onDeleteUser }: { users: AdminUser[]; onDeleteUser: (u: AdminUser) => void }) =>
    React.createElement('div', null, users.map(u =>
      React.createElement('button', { key: u.id, onClick: () => onDeleteUser(u) }, `entfernen-${u.id}`)
    )),
}));

vi.mock('../../components/admin/modals/EinladungModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
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
  };
});

import AdminUsersPage from '../../components/admin/pages/AdminUsersPage';

// --- Testdaten --------------------------------------------------------------

const person = (extra: Partial<AdminUser>): AdminUser => ({
  id: 3,
  username: 'teamer1',
  display_name: 'Test Teamer 1',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  role_name: 'teamer',
  role_display_name: 'Teamer:in',
  assigned_jahrgaenge_count: 1,
  can_edit: true,
  ...extra,
});

const oeffneAbfrage = (u: AdminUser) => {
  testUsers = [u];
  render(<AdminUsersPage />);
  fireEvent.click(screen.getByText(`entfernen-${u.id}`));
  if (!offenerAlert) throw new Error('Keine Sicherheitsabfrage aufgegangen');
  return offenerAlert;
};

const knoepfe = (a: AlertOptionen) => a.buttons.map(b => b.text);

beforeEach(() => {
  offenerAlert = null;
  apiDelete.mockReset();
  setError.mockReset();
  setSuccess.mockReset();
  refreshUsers.mockClear();
});

describe('Sicherheitsabfrage beim Entfernen aus "Benutzer:innen"', () => {
  it('anderswo zuhause: "Mitgliedschaft beenden", Knopf "Entfernen"', () => {
    const a = oeffneAbfrage(person({ id: 7, username: 'teamer2', display_name: 'Test Teamer 2', mitgliedschaft: 'weitere', weitere_gemeinden: 1 }));

    expect(a.header).toBe('Mitgliedschaft beenden');
    expect(a.message).toBe('"Test Teamer 2" (@teamer2) aus dieser Gemeinde entfernen? Das Konto und die Stamm-Gemeinde bleiben bestehen.');
    expect(knoepfe(a)).toEqual(['Abbrechen', 'Entfernen']);
  });

  it('hier zuhause und auch anderswo Mitglied: "Aus der Gemeinde entfernen", das Konto bleibt', () => {
    const a = oeffneAbfrage(person({ mitgliedschaft: 'stamm', weitere_gemeinden: 1 }));

    expect(a.header).toBe('Aus der Gemeinde entfernen');
    expect(a.message).toBe('"Test Teamer 1" (@teamer1) ist auch in einer anderen Gemeinde Mitglied. Du entfernst die Person nur aus deiner Gemeinde; ihr Konto bleibt dort bestehen.');
    expect(knoepfe(a)).toEqual(['Abbrechen', 'Entfernen']);
  });

  it('nur hier Mitglied: "Benutzer löschen", mit dem, was verschwindet und was bleibt', () => {
    const a = oeffneAbfrage(person({ mitgliedschaft: 'stamm', weitere_gemeinden: 0 }));

    expect(a.header).toBe('Benutzer löschen');
    // Seit 28.09.2026 nennt die Abfrage, was mit dem Konto verschwindet und
    // was der Gemeinde bleibt (utils/kontoLoeschen.ts).
    expect(a.message).toBe(
      'Benutzer "Test Teamer 1" (@teamer1) wirklich löschen?\n\n'
      + 'Mit dem Konto verschwindet alles, was zur Person gehört: Punkte, Badges, Stempel, Anträge samt Fotos, '
      + 'Event-Anmeldungen, Challenge-Beiträge, Chat-Nachrichten und Zweiergespräche, auch aus einer früheren '
      + 'Konfi-Zeit. Was die Person für die Gemeinde angelegt hat — Events, Material, Badges, Challenges —, '
      + 'bleibt ohne ihren Namen. Das lässt sich nicht rückgängig machen.'
    );
    expect(knoepfe(a)).toEqual(['Abbrechen', 'Löschen']);
  });

  it('ohne das neue Feld (älterer Server) bleibt es beim Löschen-Text', () => {
    const a = oeffneAbfrage(person({ mitgliedschaft: 'stamm' }));

    expect(a.header).toBe('Benutzer löschen');
    expect(knoepfe(a)).toEqual(['Abbrechen', 'Löschen']);
  });

  it('"Entfernen" ruft DELETE und zeigt die Meldung des Servers', async () => {
    apiDelete.mockResolvedValue({
      data: { message: 'Aus dieser Gemeinde entfernt; das Konto bleibt in einer anderen Gemeinde bestehen', konto_bleibt: true },
    });
    oeffneAbfrage(person({ mitgliedschaft: 'stamm', weitere_gemeinden: 2 }));

    await tippeAlertKnopf('Entfernen');

    expect(apiDelete).toHaveBeenCalledWith('/users/3');
    expect(setSuccess).toHaveBeenCalledWith('Aus dieser Gemeinde entfernt; das Konto bleibt in einer anderen Gemeinde bestehen');
    expect(refreshUsers).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it('scheitert das Entfernen, steht der Grund des Servers in der Fehlermeldung', async () => {
    apiDelete.mockRejectedValue({ response: { status: 409, data: { error: 'Die letzte Org-Leitung kann nicht gelöscht werden' } } });
    oeffneAbfrage(person({ mitgliedschaft: 'stamm', weitere_gemeinden: 1 }));

    await tippeAlertKnopf('Entfernen');

    expect(setError).toHaveBeenCalledWith('Die letzte Org-Leitung kann nicht gelöscht werden');
    expect(setSuccess).not.toHaveBeenCalled();
  });
});
