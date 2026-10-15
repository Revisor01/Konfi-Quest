// Jahrgang anlegen, "Zugriff für Leitung & Team" (02.10.2026, Paket 2.4.0,
// Punkt 6): jede Person mit dem Wort ihrer Rolle, Antippen waehlt sie aus.
// Angeboten werden nur Leitung und Teamer:innen (die Gemeindeleitung sieht
// ohnehin alle Jahrgaenge). Die Farben legt kein Test fest (Simon,
// 15.10.2026).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { karteVon } from './rollenfarbePruefen';

const apiGet = vi.fn();
let formular: { Komponente: React.ComponentType<Record<string, unknown>>; props: Record<string, unknown> } | null = null;

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: 'org_admin' }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: [], loading: false, refresh: vi.fn(), refreshLive: vi.fn() }),
}));
vi.mock('../../services/api', () => ({
  default: { get: (url: string) => apiGet(url), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
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
    IonButton: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: P & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonItemOption: () => null,
    IonInput: () => null,
    useIonModal: (Komponente: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>) => {
      formular = { Komponente, props };
      return [vi.fn(), vi.fn()];
    },
    useIonAlert: () => [vi.fn()],
  };
});

import AdminJahrgaengeePage from '../../components/admin/pages/AdminJahrgaengeePage';

beforeEach(() => {
  vi.clearAllMocks();
  formular = null;
  apiGet.mockImplementation(async (url: string) => (url === '/users' ? { data: [
    { id: 24, display_name: 'Olga Gemeindeleitung', role_name: 'org_admin' },
    { id: 21, display_name: 'Anna Leitung', role_name: 'admin' },
    { id: 22, display_name: 'Tim Teamer', role_name: 'teamer' },
  ] } : { data: [] }));
});

const oeffneFormular = async () => {
  render(<AdminJahrgaengeePage />);
  const { Komponente, props } = formular!;
  render(<Komponente {...props} jahrgang={null} />);
  await screen.findByText('Anna Leitung', {}, { timeout: 3000 });
};

describe('Zugriff für Leitung & Team', () => {
  it('jede Person mit dem Wort ihrer Rolle; die Gemeindeleitung steht nicht zur Wahl', async () => {
    await oeffneFormular();
    expect(within(karteVon('Anna Leitung')).getByText('Leitung')).toBeInTheDocument();
    expect(within(karteVon('Tim Teamer')).getByText('Teamer:in')).toBeInTheDocument();
    expect(screen.queryByText('Olga Gemeindeleitung')).toBe(null);
  });

  it('Antippen waehlt die Person aus', async () => {
    await oeffneFormular();
    expect(karteVon('Tim Teamer').classList.contains('app-list-item--selected')).toBe(false);
    fireEvent.click(karteVon('Tim Teamer'));
    expect(karteVon('Tim Teamer').classList.contains('app-list-item--selected')).toBe(true);
  });
});
