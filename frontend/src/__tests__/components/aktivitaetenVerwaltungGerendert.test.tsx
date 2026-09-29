// Aktivitaeten-Verwaltung der Leitung (AdminActivitiesPage + ActivitiesView)
// -- Verhaltenstest (Audit Tests 26.09.2026, BF-10: ActivitiesView hatte
// keinen Bezug in irgendeinem Test).
//
// Die Aktivitaeten bestimmen, wofuer es Punkte gibt. Anlegen, Aendern und
// Loeschen sind Leitungssache (org_admin, admin; requireAdmin im Backend),
// Loeschen nur nach Rueckfrage. Der Reiter Konfis/Team laedt die jeweilige
// Liste.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { createContext, useContext } from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

let rolle = 'org_admin';
let online = true;
const abfragen: string[] = [];
const apiDelete = vi.fn(async (_url: string) => ({ data: {} }));
const setError = vi.fn();
const modalOeffnen = vi.fn();
let alert: { header?: string; message?: string; buttons: Array<{ text: string; role?: string; handler?: () => Promise<void> | void }> } | null = null;

const LISTEN: Record<string, unknown[]> = {
  konfi: [
    { id: 1, name: 'Sonntagsgottesdienst', points: 1, type: 'gottesdienst', target_role: 'konfi', created_at: '2026-08-01T00:00:00Z' },
    { id: 3, name: 'Gemeindefest', points: 2, type: 'gemeinde', target_role: 'konfi', created_at: '2026-08-01T00:00:00Z' },
  ],
  teamer: [
    { id: 9, name: 'Freizeit begleitet', points: 0, type: null, target_role: 'teamer', created_at: '2026-08-01T00:00:00Z' },
  ],
};

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: rolle }, setError, setSuccess: vi.fn(), isOnline: online }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    abfragen.push(schluessel);
    const rolleDerListe = schluessel.split(':').pop() as string;
    return { data: LISTEN[rolleDerListe], loading: false, refresh: vi.fn(async () => undefined), refreshLive: vi.fn() };
  },
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), delete: (url: string) => apiDelete(url) } }));
vi.mock('../../components/admin/modals/ActivityManagementModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ rechts }: { rechts?: React.ReactNode }) => <header>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));
const SegmentWahl = createContext<(wert: string) => void>(() => undefined);
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonContent: durch, IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null,
    IonList: durch, IonListHeader: durch, IonItemGroup: durch, IonItemOptions: durch, IonLabel: durch,
    IonCard: durch, IonCardContent: durch, IonInput: () => null, IonSelect: durch, IonSelectOption: durch,
    IonButton: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick, button }: P & { onClick?: () => void; button?: boolean }) =>
      <div data-tippbar={button ? 'ja' : 'nein'} onClick={onClick}>{children}</div>,
    IonItemSliding: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref} data-testid="aktivitaet">{children}</div>),
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonSegment: ({ children, onIonChange }: P & { onIonChange?: (e: { detail: { value: string } }) => void }) => (
      <SegmentWahl.Provider value={(w) => onIonChange?.({ detail: { value: w } })}><div role="tablist">{children}</div></SegmentWahl.Provider>
    ),
    IonSegmentButton: ({ children, value }: P & { value: string }) => {
      const waehle = useContext(SegmentWahl);
      return <button type="button" role="tab" onClick={() => waehle(value)}>{children}</button>;
    },
    useIonModal: () => [modalOeffnen, vi.fn()],
    useIonAlert: () => [(o: typeof alert) => { alert = o; }],
  };
});

import AdminActivitiesPage from '../../components/admin/pages/AdminActivitiesPage';

const zeileVon = (name: string) => screen.getByText(name).closest('[data-testid="aktivitaet"]') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  rolle = 'org_admin';
  online = true;
  alert = null;
  abfragen.length = 0;
});

describe.each(['org_admin', 'admin'])('ERLAUBT: %s verwaltet Aktivitaeten', (leitung) => {
  beforeEach(() => { rolle = leitung; });

  it('legt an, oeffnet eine Aktivitaet per Tipp und kann loeschen', () => {
    render(<AdminActivitiesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Aktivität anlegen' }));
    expect(modalOeffnen).toHaveBeenCalledTimes(1);
    const zeile = zeileVon('Gemeindefest');
    expect(within(zeile).getByRole('button', { name: 'Aktivität löschen' })).toBeInTheDocument();
    fireEvent.click(within(zeile).getByText('Gemeindefest'));
    expect(modalOeffnen).toHaveBeenCalledTimes(2);
  });
});

describe('VERBOTEN: Teamer:innen', () => {
  it('sehen die Liste, aber weder Anlegen noch Loeschen, und ein Tipp oeffnet nichts', () => {
    rolle = 'teamer';
    render(<AdminActivitiesPage />);
    expect(screen.queryByRole('button', { name: 'Neue Aktivität anlegen' })).toBe(null);
    const zeile = zeileVon('Gemeindefest');
    expect(within(zeile).queryByRole('button', { name: 'Aktivität löschen' })).toBe(null);
    fireEvent.click(within(zeile).getByText('Gemeindefest'));
    expect(modalOeffnen).not.toHaveBeenCalled();
  });
});

describe('Loeschen', () => {
  it('fragt nach und loescht erst nach "Löschen"', async () => {
    render(<AdminActivitiesPage />);
    fireEvent.click(within(zeileVon('Gemeindefest')).getByRole('button', { name: 'Aktivität löschen' }));
    expect(alert?.message).toBe('Aktivität "Gemeindefest" wirklich löschen?');
    expect(apiDelete).not.toHaveBeenCalled();
    await act(async () => { await alert?.buttons.find((b) => b.text === 'Löschen')?.handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/admin/activities/3');
  });

  it('offline: keine Rueckfrage, kein Loeschen, eine Meldung', () => {
    online = false;
    render(<AdminActivitiesPage />);
    fireEvent.click(within(zeileVon('Gemeindefest')).getByRole('button', { name: 'Aktivität löschen' }));
    expect(alert).toBe(null);
    expect(apiDelete).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledTimes(1);
  });
});

describe('Reiter Konfis / Team', () => {
  it('laedt je Reiter die eigene Liste der Gemeinde', () => {
    render(<AdminActivitiesPage />);
    expect(abfragen.at(-1)).toBe('admin:activities:1:konfi');
    expect(screen.getByText('Sonntagsgottesdienst')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Team' }));
    expect(abfragen.at(-1)).toBe('admin:activities:1:teamer');
    expect(screen.getByText('Freizeit begleitet')).toBeInTheDocument();
    expect(screen.queryByText('Sonntagsgottesdienst')).toBe(null);
  });
});
