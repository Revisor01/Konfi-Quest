// Benutzerseite: Anlegen, Einladen und Loeschen nur fuer den Org-Admin --
// gerendert statt Quelltext gelesen (Audit Tests 26.09.2026, BF-02; ersetzt
// benutzerseiteRollenGate.test.ts, Rollen-Bericht Nr. 16).
//
// Admins sehen die Benutzerseite ihrer Gemeinde, verwalten darf sie nur der
// Org-Admin (users.js, requireOrgAdmin). Bis zum Befund 16 bot die Liste
// Admins trotzdem die Loesch-Wische an; der Server antwortete 403.
// Zusaetzlich zaehlt can_edit am Eintrag: Auch der Org-Admin loescht keine
// Zeile mit can_edit = false.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import type { AdminUser } from '../../types/user';

let rolle = 'org_admin';
let personen: AdminUser[] = [];

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: rolle }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: personen, loading: false, refresh: vi.fn(), refreshLive: vi.fn() }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }), delete: vi.fn() } }));
vi.mock('../../components/admin/OffeneEinladungen', () => ({ default: () => <section>Offene Einladungen</section> }));
vi.mock('../../components/admin/modals/EinladungModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
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
    IonContent: durch, IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null,
    IonList: durch, IonListHeader: durch, IonItemGroup: durch, IonItemOptions: durch, IonLabel: durch,
    IonSegment: durch, IonSegmentButton: durch, IonInput: () => null, IonCard: durch, IonCardContent: durch,
    IonButton: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: P & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: P) => <div data-testid="person">{children}</div>,
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
  };
});

import AdminUsersPage from '../../components/admin/pages/AdminUsersPage';

const person = (id: number, name: string, zusatz: Partial<AdminUser> = {}): AdminUser => ({
  id, username: name.toLowerCase(), display_name: name, is_active: true,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  role_name: 'teamer', role_display_name: 'Teamer:in', assigned_jahrgaenge_count: 1, can_edit: true,
  mitgliedschaft: 'stamm', ...zusatz,
});

beforeEach(() => {
  rolle = 'org_admin';
  personen = [person(2, 'Tom'), person(3, 'Geschuetzt', { can_edit: false })];
});

const zeileVon = (name: string) => screen.getByText(name).closest('[data-testid="person"]') as HTMLElement;
const loeschen = (name: string) => within(zeileVon(name)).queryByRole('button', { name: 'Benutzer:in löschen' });

describe('Benutzerseite je Rolle', () => {
  it('ERLAUBT: Org-Admin legt an, laedt ein, sieht offene Einladungen und loescht', () => {
    render(<AdminUsersPage />);
    expect(screen.getByRole('button', { name: 'Neue Benutzer:in anlegen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Person in diese Gemeinde einladen' })).toBeInTheDocument();
    expect(screen.getByText('Offene Einladungen')).toBeInTheDocument();
    expect(loeschen('Tom')).not.toBe(null);
  });

  it('can_edit = false schuetzt die Zeile auch vor dem Org-Admin', () => {
    render(<AdminUsersPage />);
    expect(loeschen('Geschuetzt')).toBe(null);
  });

  it('VERBOTEN: Admin sieht die Liste, aber weder Anlegen, Einladen, Einladungen noch Loeschen', () => {
    rolle = 'admin';
    render(<AdminUsersPage />);
    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neue Benutzer:in anlegen' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Person in diese Gemeinde einladen' })).toBe(null);
    expect(screen.queryByText('Offene Einladungen')).toBe(null);
    expect(loeschen('Tom')).toBe(null);
  });
});
