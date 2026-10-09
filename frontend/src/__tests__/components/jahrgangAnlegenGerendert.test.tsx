// Jahrgaenge: Anlegen und Direkt-Zuweisung nur fuer den Org-Admin --
// gerendert statt Quelltext gelesen (Audit Tests 26.09.2026, BF-02; ersetzt
// jahrgangAnlegenNurOrgAdmin.test.ts).
//
// Simons Entscheidung (01.09.2026): Nur der Org-Admin legt Jahrgaenge an und
// kann dabei Admins und Teamer:innen direkt Zugriff geben (sehen und
// bearbeiten, wie in der Benutzerverwaltung). Admins bearbeiten und loeschen
// weiter -- der Server bindet das an ihre Jahrgaenge.
//
// Gerendert werden die echte Seite und das echte Formular. Das Formular ist
// nicht exportiert; der useIonModal-Nachbau reicht es samt Props heraus, wie
// Ionic es beim Oeffnen tut.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

let rolle = 'org_admin';
const apiGet = vi.fn();
const apiPost = vi.fn(async (_url: string, _daten?: unknown) => ({ data: { id: 9 } }));
const apiPut = vi.fn(async (_url: string, _daten?: unknown) => ({ data: {} }));
let formular: { Komponente: React.ComponentType<Record<string, unknown>>; props: Record<string, unknown> } | null = null;

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: rolle }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [{ id: 4, name: 'Jahrgang 2026/27', created_at: '2026-08-01T00:00:00Z', konfi_count: 12 }],
    loading: false, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));
vi.mock('../../services/api', () => ({
  default: {
    get: (url: string) => apiGet(url),
    post: (url: string, d: unknown) => apiPost(url, d),
    put: (url: string, d: unknown) => apiPut(url, d),
    delete: vi.fn(),
  },
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ rechts }: { rechts?: React.ReactNode }) => <header>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonButtons: durch, IonContent: durch,
    IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null, IonSpinner: () => null,
    IonList: durch, IonListHeader: durch, IonLabel: durch, IonCard: durch, IonCardContent: durch,
    IonItemOptions: durch, IonToggle: () => null, IonRange: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: P & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: P & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref} data-testid="jahrgang">{children}</div>),
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonInput: ({ value, onIonInput, 'aria-label': label }: { value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string }) =>
      <input aria-label={label} value={value} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    useIonModal: (Komponente: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>) => {
      formular = { Komponente, props };
      return [vi.fn(), vi.fn()];
    },
    useIonAlert: () => [vi.fn()],
  };
});

import AdminJahrgaengeePage from '../../components/admin/pages/AdminJahrgaengeePage';

const PERSONEN = [
  { id: 21, display_name: 'Anna Admin', role_name: 'admin' },
  { id: 22, display_name: 'Tom Teamer', role_name: 'teamer' },
  { id: 23, display_name: 'Kim Konfi', role_name: 'konfi' },
  { id: 24, display_name: 'Olga Org', role_name: 'org_admin' },
];

beforeEach(() => {
  vi.clearAllMocks();
  rolle = 'org_admin';
  formular = null;
  apiGet.mockImplementation(async (url: string) => (url === '/users' ? { data: PERSONEN } : { data: [] }));
});

/** Das Formular so oeffnen, wie die Seite es an useIonModal gibt. */
const oeffneFormular = (jahrgang: Record<string, unknown> | null = null) => {
  render(<AdminJahrgaengeePage />);
  const { Komponente, props } = formular!;
  return render(<Komponente {...props} jahrgang={jahrgang} />);
};
const speichern = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Jahrgang speichern' })); });
};

describe('Jahrgaenge-Seite je Rolle', () => {
  it('ERLAUBT: Org-Admin sieht "Neuen Jahrgang anlegen" und den Loesch-Wisch', () => {
    render(<AdminJahrgaengeePage />);
    expect(screen.getByRole('button', { name: 'Neuen Jahrgang anlegen' })).toBeInTheDocument();
    expect(within(screen.getByTestId('jahrgang')).getByRole('button', { name: 'Jahrgang löschen' })).toBeInTheDocument();
  });

  it('Admin: kein Anlegen, aber Loeschen bleibt (der Server bindet es an seine Jahrgaenge)', () => {
    rolle = 'admin';
    render(<AdminJahrgaengeePage />);
    expect(screen.queryByRole('button', { name: 'Neuen Jahrgang anlegen' })).toBe(null);
    expect(within(screen.getByTestId('jahrgang')).getByRole('button', { name: 'Jahrgang löschen' })).toBeInTheDocument();
  });

  it('VERBOTEN: Teamer:innen weder anlegen noch loeschen', () => {
    rolle = 'teamer';
    render(<AdminJahrgaengeePage />);
    expect(screen.queryByRole('button', { name: 'Neuen Jahrgang anlegen' })).toBe(null);
    expect(within(screen.getByTestId('jahrgang')).queryByRole('button', { name: 'Jahrgang löschen' })).toBe(null);
  });
});

describe('Direkt-Zuweisung beim Anlegen', () => {
  it('bietet nur Admins und Teamer:innen an und schickt die Auswahl nur mit Sehen (das Zuordnungsrecht setzt der Server)', async () => {
    oeffneFormular();
    expect(await screen.findByText('Anna Admin', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Zugriff für Leitung & Team/)).toBeInTheDocument();
    expect(screen.getByText('Tom Teamer')).toBeInTheDocument();
    expect(screen.queryByText('Kim Konfi')).toBe(null);
    expect(screen.queryByText('Olga Org')).toBe(null);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jahrgang 2027/28' } });
    fireEvent.click(screen.getByText('Tom Teamer'));
    await speichern();

    expect(apiPost).toHaveBeenCalledTimes(1);
    const [url, daten] = apiPost.mock.calls[0];
    expect(url).toBe('/admin/jahrgaenge');
    expect((daten as Record<string, unknown>).name).toBe('Jahrgang 2027/28');
    expect((daten as Record<string, unknown>).user_assignments).toEqual([{ user_id: 22, can_view: true }]);
  });

  it('ohne Auswahl bleibt das Feld weg', async () => {
    oeffneFormular();
    expect(await screen.findByText('Anna Admin', {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jahrgang 2027/28' } });
    await speichern();
    expect(apiPost.mock.calls[0][1]).not.toHaveProperty('user_assignments');
  });

  it('beim Bearbeiten gibt es keine Zuweisung und keine Personenabfrage', async () => {
    oeffneFormular({ id: 4, name: 'Jahrgang 2026/27', created_at: '2026-08-01T00:00:00Z' });
    await speichern();
    expect(apiPut).toHaveBeenCalledWith('/admin/jahrgaenge/4', expect.not.objectContaining({ user_assignments: expect.anything() }));
    expect(apiGet).not.toHaveBeenCalledWith('/users');
    expect(screen.queryByText(/Zugriff für Leitung & Team/)).toBe(null);
  });

  it('ein Admin bekommt keine Personenliste und keine Zuweisung angeboten', async () => {
    rolle = 'admin';
    oeffneFormular();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu' } });
    await speichern();
    expect(apiGet).not.toHaveBeenCalledWith('/users');
    expect(screen.queryByText(/Zugriff für Leitung & Team/)).toBe(null);
  });
});
