// Termin-Detail der Leitungsansicht: Wer sieht welche Verwaltungsknoepfe?
// Gerendert statt Quelltext gelesen (Audit Tests 26.09.2026, BF-02).
//
// Die Regel (terminRechteOberflaeche.test.ts, 16./17.09.2026): Anlegen,
// Aendern, Kopieren, Absagen, Teilnehmende eintragen/entfernen, Anwesenheit
// und Warteliste verbuchen sind Leitungssache (requireAdmin im Backend).
// Teamer:innen sehen die Detailansicht, aber keinen Knopf, der nur mit 403
// enden kann. Der QR-Code bleibt fuers Team (requireTeamer), der Chat-Knopf,
// solange es einen Chat gibt.
//
// Bis hierher pruefte das ein Test auf Zeichenketten im Quelltext
// ("darfVerwalten && (" in 120 Zeichen vor einem aria-label). Hier wird die
// echte Ansicht mit den echten Abschnitten je Rolle gerendert und geprueft,
// welche Knoepfe es gibt und was ein Tipp auf eine Teilnehmerzeile ausloest.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const apiGet = vi.fn();
const presentActionSheet = vi.fn();
let rolle = 'admin';

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
    user: { id: 99, organization_id: 1, role_name: rolle },
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
  rolle = 'admin';
  antwort = termin();
  apiGet.mockImplementation((pfad: string) => (
    /^\/events\/7$/.test(pfad) ? Promise.resolve({ data: antwort }) : Promise.resolve({ data: [] })
  ));
});

const oeffne = async () => {
  render(<EventDetailView eventId={7} onBack={vi.fn()} />);
  await waitFor(() => expect(screen.getByText('Kim Konfi')).toBeInTheDocument());
};
const knopf = (name: string | RegExp) => screen.queryByRole('button', { name });
const zeileVon = (name: string) => screen.getByText(name).closest('[data-testid="zeile"]') as HTMLElement;

const VERWALTUNG = ['Event bearbeiten', 'Event kopieren', 'Event absagen', 'Konfi hinzufügen', 'Team hinzufügen', 'Leitung hinzufügen'];

describe.each(['admin', 'org_admin'])('ERLAUBT: %s verwaltet den Termin', (leitung) => {
  beforeEach(() => { rolle = leitung; });

  it('sieht alle Verwaltungsknoepfe und beide "Alle bestätigen"', async () => {
    await oeffne();
    for (const name of VERWALTUNG) expect(knopf(name), name).not.toBe(null);
    expect(screen.getAllByRole('button', { name: /^Alle bestätigen \(1\)$/ })).toHaveLength(2);
    expect(knopf('QR-Code anzeigen')).not.toBe(null);
    // Ohne Chat darf die Leitung ihn anlegen.
    expect(knopf('Event-Chat öffnen')).not.toBe(null);
  });

  it('ein Tipp auf eine Teilnahme oeffnet Anwesenheit bzw. Warteliste; Wischaktionen sind da', async () => {
    await oeffne();
    expect(zeileVon('Kim Konfi').dataset.tippbar).toBe('ja');
    fireEvent.click(zeileVon('Kim Konfi'));
    expect(presentActionSheet).toHaveBeenCalledTimes(1);
    fireEvent.click(zeileVon('Wanda Warteliste'));
    expect(presentActionSheet).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('button', { name: 'Teilnahme entfernen' }).length).toBeGreaterThan(0);
  });
});

describe('VERBOTEN: Teamer:innen sehen die Detailansicht ohne Verwaltung', () => {
  beforeEach(() => { rolle = 'teamer'; });

  it('kein Knopf, der nur mit 403 enden kann -- aber der QR-Code', async () => {
    await oeffne();
    for (const name of VERWALTUNG) expect(knopf(name), name).toBe(null);
    expect(screen.queryAllByRole('button', { name: /^Alle bestätigen/ })).toEqual([]);
    expect(screen.queryAllByRole('button', { name: 'Teilnahme entfernen' })).toEqual([]);
    expect(screen.queryAllByRole('button', { name: 'Auf Warteliste setzen' })).toEqual([]);
    expect(knopf('QR-Code anzeigen')).not.toBe(null);
    // Ohne Chat gibt es fuer Teamer:innen nichts zu oeffnen (anlegen ist Leitungssache).
    expect(knopf('Event-Chat öffnen')).toBe(null);
  });

  it('eine Teilnehmerzeile ist reine Anzeige: der Tipp oeffnet nichts', async () => {
    await oeffne();
    expect(zeileVon('Kim Konfi').dataset.tippbar).toBe('nein');
    fireEvent.click(zeileVon('Kim Konfi'));
    fireEvent.click(zeileVon('Wanda Warteliste'));
    expect(presentActionSheet).not.toHaveBeenCalled();
  });

  it('gibt es einen Chat, bleibt er fuer das Team erreichbar', async () => {
    antwort = termin({ chat_room_id: 55 });
    await oeffne();
    expect(knopf('Event-Chat öffnen')).not.toBe(null);
  });

  it('auch ueber die Zeitfenster-Liste (zweiter Renderpfad) oeffnet der Tipp nichts', async () => {
    antwort = termin({
      has_timeslots: true,
      timeslots: [{ id: 11, start_time: '2026-10-01T08:00:00Z', end_time: '2026-10-01T09:00:00Z', max_participants: 5, registered_count: 1 }],
      participants: [teilnahme(1, 'Kim Konfi', { timeslot_id: 11 })],
    });
    await oeffne();
    const zeilen = screen.getAllByText('Kim Konfi').map((t) => t.closest('[data-testid="zeile"]') as HTMLElement);
    for (const z of zeilen) fireEvent.click(z);
    expect(presentActionSheet).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('button', { name: 'Teilnahme entfernen' })).toEqual([]);
  });
});

describe('Konfis erreichen die Leitungsansicht nicht -- falls doch, ohne Verwaltung', () => {
  it('konfi: keine Verwaltungsknoepfe', async () => {
    rolle = 'konfi';
    await oeffne();
    for (const name of VERWALTUNG) expect(knopf(name), name).toBe(null);
  });
});

describe('Abgesagter Termin (Leitung)', () => {
  it('statt "Event absagen" steht "Absage zurücknehmen"; eintragen geht nicht mehr', async () => {
    antwort = termin({ registration_status: 'cancelled', cancelled: true, cancelled_at: '2026-09-20T10:00:00Z' });
    await oeffne();
    expect(knopf('Event absagen')).toBe(null);
    expect(knopf('Absage zurücknehmen')).not.toBe(null);
    expect(knopf('Konfi hinzufügen')).toBe(null);
    expect(knopf('Team hinzufügen')).toBe(null);
  });
});
