// "Gemeinde löschen" (Betrieb, nur Super-Admin) sagt, was mit den Konten
// geschieht.
//
// Seit dem 29.09.2026 löscht DELETE /organizations/:id nur die Konten, die
// allein zu dieser Gemeinde gehören; wer auch in einer anderen Mitglied ist,
// zieht dorthin um (backend/routes/organizations.js). Die Abfrage sagte
// weiter pauschal "Alle zugehörigen Daten (Benutzer, Konfis, Aktivitäten)
// werden ebenfalls gelöscht!" -- und nach dem Löschen kam gar keine Meldung,
// obwohl die Antwort seitdem konten_geloescht und konten_umgezogen trägt.
//
// Gerendert wird die Seite; die Liste ist durch einen Knopf ersetzt, der
// Alert-Nachbau hält fest, was Ionic anzeigen würde.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

interface AlertKnopf { text: string; role?: string; handler?: () => unknown | Promise<unknown> }
interface AlertOptionen { header?: string; message?: string; buttons: AlertKnopf[] }

let offenerAlert: AlertOptionen | null = null;
const presentAlert = (optionen: AlertOptionen) => { offenerAlert = optionen; };

const apiDelete = vi.fn();
const setError = vi.fn();
const setSuccess = vi.fn();
const listeNeuLaden = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError, setSuccess, isOnline: true, refreshUser: vi.fn() }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
}));

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: [], loading: false, refresh: listeNeuLaden }),
}));

const gemeinde = {
  id: 7, name: 'wesselburen', display_name: 'Kirchengemeinde Wesselburen', is_active: true,
  created_at: '', updated_at: '', user_count: 12, konfi_count: 30, activity_count: 4, event_count: 9, badge_count: 3,
};

vi.mock('../../components/admin/OrganizationView', () => ({
  default: ({ onDeleteOrganization }: { onDeleteOrganization: (o: typeof gemeinde) => void }) =>
    React.createElement('button', { onClick: () => onDeleteOrganization(gemeinde) }, 'gemeinde-loeschen'),
}));
vi.mock('../../components/admin/modals/OrganizationManagementModal', () => ({ default: () => null }));
vi.mock('../../components/shared/WartungsHinweis', () => ({ default: () => null }));
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

import AdminOrganizationsPage from '../../components/admin/pages/AdminOrganizationsPage';

const oeffneUndLoesche = async () => {
  render(<AdminOrganizationsPage />);
  fireEvent.click(screen.getByText('gemeinde-loeschen'));
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
  listeNeuLaden.mockClear();
});

describe('Gemeinde löschen: die Abfrage', () => {
  it('nennt beide Ausgänge für die Konten statt "Benutzer werden gelöscht"', async () => {
    apiDelete.mockResolvedValue({ data: { message: 'Gemeinde und alle zugehörigen Daten erfolgreich gelöscht', konten_geloescht: 0, konten_umgezogen: 0 } });
    const a = await oeffneUndLoesche();

    expect(a.header).toBe('Gemeinde löschen');
    expect(a.message).toBe(
      'Gemeinde "Kirchengemeinde Wesselburen" (wesselburen) wirklich löschen?\n\n'
      + 'Alle Daten der Gemeinde werden gelöscht, dazu jedes Konto, das nur zu ihr gehört. '
      + 'Wer auch zu einer anderen Gemeinde gehört, behält sein Konto und bleibt dort.\n\n'
      + 'Das lässt sich nicht rückgängig machen.'
    );
    expect(a.message).not.toMatch(/Benutzer/);
    expect(apiDelete).toHaveBeenCalledWith('/organizations/7');
  });
});

describe('Gemeinde löschen: die Meldung danach', () => {
  it('nennt gelöschte und umgezogene Konten', async () => {
    apiDelete.mockResolvedValue({ data: { message: 'Gemeinde und alle zugehörigen Daten erfolgreich gelöscht', konten_geloescht: 41, konten_umgezogen: 2 } });
    await oeffneUndLoesche();

    expect(setSuccess).toHaveBeenCalledTimes(1);
    expect(setSuccess).toHaveBeenCalledWith(
      'Gemeinde "Kirchengemeinde Wesselburen" gelöscht: 41 Konten gelöscht, 2 Konten in eine andere Gemeinde umgezogen'
    );
    expect(setError).not.toHaveBeenCalled();
    expect(listeNeuLaden).toHaveBeenCalledTimes(1);
  });

  it('Einzahl bei je einem Konto', async () => {
    apiDelete.mockResolvedValue({ data: { konten_geloescht: 1, konten_umgezogen: 1 } });
    await oeffneUndLoesche();

    expect(setSuccess).toHaveBeenCalledWith(
      'Gemeinde "Kirchengemeinde Wesselburen" gelöscht: 1 Konto gelöscht, 1 Konto in eine andere Gemeinde umgezogen'
    );
  });

  it('nennt auch die Null', async () => {
    apiDelete.mockResolvedValue({ data: { konten_geloescht: 0, konten_umgezogen: 0 } });
    await oeffneUndLoesche();

    expect(setSuccess).toHaveBeenCalledWith(
      'Gemeinde "Kirchengemeinde Wesselburen" gelöscht: 0 Konten gelöscht, 0 Konten in eine andere Gemeinde umgezogen'
    );
  });

  it('ohne die Zahlen (älterer Server) nur "gelöscht"', async () => {
    apiDelete.mockResolvedValue({ data: { message: 'Gemeinde und alle zugehörigen Daten erfolgreich gelöscht' } });
    await oeffneUndLoesche();

    expect(setSuccess).toHaveBeenCalledWith('Gemeinde "Kirchengemeinde Wesselburen" gelöscht');
  });

  it('Fehler beim Löschen: keine Erfolgsmeldung', async () => {
    apiDelete.mockRejectedValue(new Error('Netz weg'));
    await oeffneUndLoesche();

    expect(setSuccess).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Fehler beim Löschen der Gemeinde');
  });
});
