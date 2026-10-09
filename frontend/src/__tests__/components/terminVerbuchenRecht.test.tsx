// Recht "Events verbuchen" (09.10.2026, docs/planung/darf-freigeben.md) im
// Termin-Detail der App: GET /events/:id liefert der Leitung `darf_verbuchen`.
// Bei false bleibt die Liste lesbar, aber Anwesenheit (Tipp auf die Zeile,
// auch über die Zeitfenster-Liste) und "Alle bestätigen" fehlen -- und der
// Grund steht da. Was nicht verbucht, bleibt: Warteliste, Entfernen,
// Bearbeiten. Fehlt das Feld (älterer Server), bleibt alles wie bisher.
// Mocks wie terminRechteGerendert.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const apiGet = vi.fn();
const presentActionSheet = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (url: string) => apiGet(url),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 99, organization_id: 1, role_name: 'admin' },
    setSuccess: vi.fn(),
    setError: vi.fn(),
    isOnline: true,
  }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ triggerRefresh: vi.fn() }), useLiveRefresh: () => {} }));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { get: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../services/analytics', () => ({ trackHandlung: vi.fn() }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => <div>laedt</div> }));
vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ParticipantManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AnwesenheitNotizModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AbmeldungNachtragenModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: () => null }));
vi.mock('../../components/shared/QRDisplayModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/pages/TeamerMaterialDetailPage', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerAbsageModal', () => ({ default: () => null }));
vi.mock('../../components/shared/PostfachGlocke', () => ({ default: () => null }));
vi.mock('../../components/shared/OrgSwitcherButton', () => ({ default: () => null }));

vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch,
    IonButtons: durch, IonCard: durch, IonCardContent: durch, IonLabel: durch, IonList: durch,
    IonListHeader: durch, IonItemOptions: durch, IonNote: durch, IonBadge: durch, IonChip: durch,
    IonIcon: () => null, IonRefresher: () => null, IonRefresherContent: () => null, IonSpinner: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: P & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
    IonItem: ({ children, onClick, button }: P & { onClick?: () => void; button?: boolean }) =>
      <div data-testid="zeile" data-tippbar={button ? 'ja' : 'nein'} onClick={onClick}>{children}</div>,
    IonItemSliding: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" onClick={onClick} aria-label={label}>{children}</button>,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [presentActionSheet, vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import EventDetailView from '../../components/admin/views/EventDetailView';

const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const teilnahme = (id: number, name: string, zusatz: Record<string, unknown> = {}) => ({
  id, user_id: id + 100, participant_name: name, role_name: 'konfi', created_at: '2026-09-01T10:00:00Z',
  status: 'confirmed', attendance_status: null, ...zusatz,
});
const termin = (zusatz: Record<string, unknown> = {}) => ({
  id: 7, name: 'Konfi-Freizeit', event_date: inEinerWoche, points: 2, type: 'event',
  max_participants: 20, registered_count: 2, registration_status: 'open', available_spots: 18,
  teamer_needed: true, chat_room_id: null, created_at: '2026-08-01T00:00:00Z',
  unregistrations: [],
  participants: [
    teilnahme(1, 'Kim Konfi'),
    teilnahme(2, 'Tom Teamer', { role_name: 'teamer' }),
    teilnahme(3, 'Wanda Warteliste', { status: 'waitlist' }),
  ],
  ...zusatz,
});

let antwort: ReturnType<typeof termin>;
beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((pfad: string) => (
    /^\/events\/7$/.test(pfad) ? Promise.resolve({ data: antwort }) : Promise.resolve({ data: [] })
  ));
});

const oeffne = async () => {
  render(<EventDetailView eventId={7} onBack={vi.fn()} />);
  await waitFor(() => expect(screen.getAllByText('Kim Konfi').length).toBeGreaterThan(0));
};
const zeileVon = (name: string) => screen.getByText(name).closest('[data-testid="zeile"]') as HTMLElement;
// Die Ionic-Attrappe rendert Karten als Fragmente -- der Satz steht deshalb ohne eigenes Element im Text der Seite.
const HINWEIS = 'An diesem Event verbucht jemand anderes. Das Recht vergibt die Gemeindeleitung.';

describe('VERBOTEN: darf_verbuchen false', () => {
  beforeEach(() => { antwort = termin({ darf_verbuchen: false }); });

  it('kein "Alle bestätigen", der Grund steht da; Bearbeiten und Entfernen bleiben', async () => {
    await oeffne();
    expect(screen.queryAllByRole('button', { name: /^Alle bestätigen/ })).toEqual([]);
    expect(document.body).toHaveTextContent(HINWEIS);
    expect(screen.getByRole('button', { name: 'Event bearbeiten' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Teilnahme entfernen' }).length).toBeGreaterThan(0);
  });

  it('der Tipp auf eine angemeldete Person öffnet nichts; die Warteliste bleibt bedienbar', async () => {
    await oeffne();
    expect(zeileVon('Kim Konfi').dataset.tippbar).toBe('nein');
    fireEvent.click(zeileVon('Kim Konfi'));
    expect(presentActionSheet).not.toHaveBeenCalled();
    expect(zeileVon('Wanda Warteliste').dataset.tippbar).toBe('ja');
    fireEvent.click(zeileVon('Wanda Warteliste'));
    expect(presentActionSheet).toHaveBeenCalledTimes(1);
    expect(presentActionSheet.mock.calls[0][0].subHeader).toBe('Warteliste verwalten');
  });

  it('auch über die Zeitfenster-Liste (zweiter Renderpfad) verbucht der Tipp nichts', async () => {
    antwort = termin({
      darf_verbuchen: false,
      has_timeslots: true,
      timeslots: [{ id: 11, start_time: '2026-10-01T08:00:00Z', end_time: '2026-10-01T09:00:00Z', max_participants: 5, registered_count: 1 }],
      participants: [teilnahme(1, 'Kim Konfi', { timeslot_id: 11 })],
    });
    await oeffne();
    const zeilen = screen.getAllByText('Kim Konfi').map((t) => t.closest('[data-testid="zeile"]') as HTMLElement);
    for (const z of zeilen) {
      expect(z.dataset.tippbar).toBe('nein');
      fireEvent.click(z);
    }
    expect(presentActionSheet).not.toHaveBeenCalled();
  });
});

describe.each([
  ['ERLAUBT: darf_verbuchen true', { darf_verbuchen: true }],
  ['älterer Server ohne das Feld', {}],
])('%s', (_name, zusatz) => {
  beforeEach(() => { antwort = termin(zusatz); });

  it('beide "Alle bestätigen", der Tipp öffnet die Anwesenheit, kein Hinweis', async () => {
    await oeffne();
    expect(screen.getAllByRole('button', { name: /^Alle bestätigen \(1\)$/ })).toHaveLength(2);
    expect(document.body).not.toHaveTextContent(HINWEIS);
    expect(zeileVon('Kim Konfi').dataset.tippbar).toBe('ja');
    fireEvent.click(zeileVon('Kim Konfi'));
    expect(presentActionSheet).toHaveBeenCalledTimes(1);
    expect(presentActionSheet.mock.calls[0][0].subHeader).toBe('Anwesenheit verwalten');
  });
});
