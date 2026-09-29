// Chat-Uebersicht (ChatOverviewPage + ChatOverview) -- Verhaltenstest.
//
// Anlass: Audit Tests 26.09.2026, BF-10 -- die Chat-Uebersicht hatte keinen
// gerenderten Test. Hier entscheidet sich, welcher Raum wohin fuehrt, welche
// rote Zahl an welchem Raum steht, wer den Reiter "Team" sieht und wer einen
// Chat loeschen darf.
//
// Gerendert werden die echte Seite und die echte Uebersicht mit echter
// ZaehlerKugel. Ersetzt sind Netz/Cache (useOfflineQuery liefert die Raeume
// durch denselben select wie im Betrieb), Socket, Kontexte und die
// Ionic-Bausteine (schlichte HTML-Nachbauten).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { createContext, useContext } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ChatRoomOverview } from '../../types/chat';

// --- Ionic-Nachbau -----------------------------------------------------------
type Kinder = { children?: React.ReactNode };
const SegmentWahl = createContext<(wert: string) => void>(() => undefined);
let offenerAlert: { header?: string; buttons: Array<{ text: string; handler?: () => void }> } | null = null;
const push = vi.fn();

vi.mock('@ionic/react', () => {
  const pass = ({ children }: Kinder) => <div>{children}</div>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, Kinder>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonContent: pass, IonList: pass, IonListHeader: pass, IonItemGroup: pass, IonCard: pass, IonCardContent: pass,
    IonLabel: ({ children }: Kinder) => <span>{children}</span>,
    IonIcon: () => null,
    IonRefresher: () => null, IonRefresherContent: () => null,
    IonButton: ({ children, onClick, 'aria-label': label }: Kinder & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: Kinder & { onClick?: () => void }) =>
      <div role="button" data-testid="raum" onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: Kinder) => <div data-testid="zeile">{children}</div>,
    IonItemOptions: pass,
    IonItemOption: ({ children, onClick, 'aria-label': label }: Kinder & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonInput: ({ onIonInput, 'aria-label': label }: { onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string }) =>
      <input aria-label={label} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    IonSegment: ({ children, onIonChange }: Kinder & { onIonChange?: (e: { detail: { value: string } }) => void }) => (
      <SegmentWahl.Provider value={(wert) => onIonChange?.({ detail: { value: wert } })}>
        <div role="tablist">{children}</div>
      </SegmentWahl.Provider>
    ),
    IonSegmentButton: ({ children, value }: Kinder & { value: string }) => {
      const waehle = useContext(SegmentWahl);
      return <button type="button" role="tab" onClick={() => waehle(value)}>{children}</button>;
    },
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [(optionen: typeof offenerAlert) => { offenerAlert = optionen; }],
    useIonViewWillEnter: () => undefined,
    useIonRouter: () => ({ push }),
  };
});

// --- Kontexte, Netz, Socket ---------------------------------------------------
let nutzer: { id: number; type: 'konfi' | 'teamer' | 'admin' } = { id: 1, type: 'konfi' };
let ungelesen: Record<number, number> = {};
let raeume: unknown[] = [];
const refresh = vi.fn(async () => undefined);
const setError = vi.fn();
const apiDelete = vi.fn(async (_url: string) => ({ data: {} }));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: nutzer, setError, isOnline: true }),
}));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ chatUnreadByRoom: ungelesen }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null } }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ socketEpoch: 0 }) }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/konfi/chat', search: '' }) }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  // select wie im Betrieb anwenden -- die Seite bereinigt die Raeume dort.
  useOfflineQuery: (_key: string, _laden: unknown, optionen?: { select?: (roh: unknown) => unknown }) => ({
    data: optionen?.select ? optionen.select(raeume) : raeume,
    loading: false,
    refresh,
  }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), delete: (url: string) => apiDelete(url) } }));
vi.mock('../../services/websocket', () => ({
  onReconnect: () => () => undefined,
  initializeWebSocket: () => ({ on: vi.fn(), off: vi.fn() }),
}));
vi.mock('../../services/tokenStore', () => ({ getToken: () => 'sitzung' }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/chat/modals/SimpleCreateChatModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared', () => ({
  SectionHeader: ({ stats }: { stats: Array<{ label: string; value: number }> }) => (
    <dl>{stats.map((s) => <div key={s.label} data-testid={`kopf-${s.label}`}>{s.value}</div>)}</dl>
  ),
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));

import ChatOverviewPage from '../../components/chat/pages/ChatOverviewPage';

// --- Daten ---------------------------------------------------------------------
const raum = (id: number, name: string, zusatz: Partial<ChatRoomOverview> = {}): ChatRoomOverview => ({
  id, name, type: 'group', unread_count: 0, participant_count: 5, ...zusatz,
});
const um = (stunde: number) => ({ content: 'hi', sender_name: 'Kim', created_at: `2026-09-28T${String(stunde).padStart(2, '0')}:00:00.000Z` });

const JAHRGANG = raum(1, 'Jahrgang 2026', { type: 'jahrgang', last_message: um(8) });
const TEAMGRUPPE = raum(2, 'Leitungsrunde', { type: 'admin', last_message: um(10) });
const DIREKT_TEAMER = raum(3, 'direkt-3', {
  type: 'direct', partner_user_type: 'teamer', last_message: um(9),
  participants: [{ user_id: 1, user_type: 'konfi', name: 'Ich' }, { user_id: 40, user_type: 'teamer', name: 'Tom Teamer' }],
});
const KONFIGRUPPE = raum(4, 'Freizeit-Gruppe', { type: 'group', last_message: um(11) });

// Die Titel der Raumzeilen in Anzeigereihenfolge (das Suchfeld ist auch ein IonItem).
const titel = () => Array.from(document.querySelectorAll('.app-list-item__title')).map((t) => t.textContent);
const reiter = (name: string) => screen.getByRole('tab', { name });

beforeEach(() => {
  vi.clearAllMocks();
  nutzer = { id: 1, type: 'konfi' };
  ungelesen = {};
  raeume = [JAHRGANG, TEAMGRUPPE, DIREKT_TEAMER, KONFIGRUPPE];
  offenerAlert = null;
});

describe('Chat-Uebersicht: Raum oeffnen', () => {
  it.each([
    ['konfi', '/konfi/chat/room/4'],
    ['teamer', '/teamer/chat/room/4'],
    ['admin', '/admin/chat/room/4'],
  ] as const)('%s: ein Tipp fuehrt in den Raum der eigenen Rolle (%s)', (typ, ziel) => {
    nutzer = { id: 1, type: typ };
    render(<ChatOverviewPage />);
    fireEvent.click(screen.getByText('Freizeit-Gruppe'));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(ziel);
  });

  it('in der geteilten Ansicht (iPad) meldet die Seite nur die Kennung und navigiert nicht', () => {
    const waehle = vi.fn();
    render(<ChatOverviewPage onSelectRoom={waehle} selectedRoomId={1} />);
    fireEvent.click(screen.getByText('Leitungsrunde'));
    expect(waehle).toHaveBeenCalledWith(2);
    expect(push).not.toHaveBeenCalled();
    // Der rechts offene Raum ist markiert, die anderen nicht.
    const markiert = document.querySelectorAll('.app-list-item--selected');
    expect(markiert).toHaveLength(1);
    expect(markiert[0].textContent).toContain('Jahrgang 2026');
  });
});

describe('Chat-Uebersicht: Liste', () => {
  it('der Raum mit der juengsten Nachricht steht oben; ein Direktchat traegt den Namen des Gegenuebers', () => {
    render(<ChatOverviewPage />);
    expect(titel()).toEqual(['Freizeit-Gruppe', 'Leitungsrunde', 'Tom Teamer', 'Jahrgang 2026']);
  });

  it('kaputte Eintraege aus dem Cache legen die Liste nicht lahm', () => {
    raeume = [null, { name: 'ohne Kennung' }, raum(9, 'Heil', { participant_count: -5 }), JAHRGANG];
    render(<ChatOverviewPage />);
    expect(titel()).toEqual(['Jahrgang 2026', 'Heil']);
    expect(screen.getByTestId('kopf-CHATS').textContent).toBe('2');
  });

  it('die Suche filtert nach dem Namen', () => {
    render(<ChatOverviewPage />);
    fireEvent.change(screen.getByLabelText('Chaträume durchsuchen'), { target: { value: 'freiz' } });
    expect(titel()).toEqual(['Freizeit-Gruppe']);
  });
});

describe('Chat-Uebersicht: rote Zahlen', () => {
  it('jeder Raum zeigt seine eigene Zahl, der Kopf die Summe; ab 10 steht 9+', () => {
    ungelesen = { 1: 3, 4: 12 };
    render(<ChatOverviewPage />);
    const zeileVon = (name: string) => screen.getByText(name).closest('[data-testid="zeile"]') as HTMLElement;
    expect(within(zeileVon('Jahrgang 2026')).getByLabelText('3 ungelesene Nachrichten').textContent).toBe('3');
    expect(within(zeileVon('Freizeit-Gruppe')).getByLabelText('12 ungelesene Nachrichten').textContent).toBe('9+');
    expect(zeileVon('Leitungsrunde').querySelector('.app-zaehler-kugel')).toBe(null);
    expect(screen.getByTestId('kopf-UNGELESEN').textContent).toBe('15');
  });

  it('ohne Stand im Zaehler-Kontext gilt die Zahl am Raum', () => {
    raeume = [raum(5, 'Nur Server', { unread_count: 2, last_message: um(7) })];
    render(<ChatOverviewPage />);
    expect(screen.getByLabelText('2 ungelesene Nachrichten')).toBeInTheDocument();
  });

  it('Reiter "Ungelesen" zeigt nur Raeume mit ungelesenen Nachrichten', () => {
    ungelesen = { 3: 1 };
    render(<ChatOverviewPage />);
    fireEvent.click(reiter('Ungelesen'));
    expect(titel()).toEqual(['Tom Teamer']);
  });
});

describe('Chat-Uebersicht: wer sieht was', () => {
  it('Konfis sehen keinen Reiter "Team"', () => {
    render(<ChatOverviewPage />);
    expect(screen.queryByRole('tab', { name: 'Team' })).toBe(null);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Alle', 'Ungelesen', 'Konfis']);
  });

  it('Teamer:innen sehen ihn; dort stehen Team-Gruppe und Direktchat mit Team, unter "Konfis" nur Jahrgang und gemischte Gruppe', () => {
    nutzer = { id: 1, type: 'teamer' };
    raeume = [...raeume, raum(6, 'Nur Team', { type: 'group', is_team_only: true, last_message: um(6) }),
      raum(7, 'Termin-Chat', { type: 'group', event_id: 99, last_message: um(5) })];
    render(<ChatOverviewPage />);
    fireEvent.click(reiter('Team'));
    expect(titel()).toEqual(['Leitungsrunde', 'Tom Teamer', 'Nur Team']);
    fireEvent.click(reiter('Konfis'));
    expect(titel()).toEqual(['Freizeit-Gruppe', 'Jahrgang 2026', 'Event: Termin-Chat']);
  });

  it('nur die Leitung kann Direkt- und Gruppenchats loeschen -- Team und Konfis nicht', () => {
    for (const typ of ['konfi', 'teamer'] as const) {
      nutzer = { id: 1, type: typ };
      const { unmount } = render(<ChatOverviewPage />);
      expect(screen.queryAllByLabelText('Chat löschen')).toHaveLength(0);
      unmount();
    }
    nutzer = { id: 1, type: 'admin' };
    render(<ChatOverviewPage />);
    // Freizeit-Gruppe (group) und Direktchat, nicht Jahrgang und nicht Team-Gruppe (admin).
    expect(screen.getAllByLabelText('Chat löschen')).toHaveLength(2);
  });

  it('Loeschen fragt nach und loescht erst nach "Löschen"', async () => {
    nutzer = { id: 1, type: 'admin' };
    render(<ChatOverviewPage />);
    const zeile = screen.getByText('Freizeit-Gruppe').closest('[data-testid="zeile"]') as HTMLElement;
    fireEvent.click(within(zeile).getByLabelText('Chat löschen'));
    expect(offenerAlert?.header).toBe('Chat löschen?');
    expect(apiDelete).not.toHaveBeenCalled();
    offenerAlert?.buttons.find((b) => b.text === 'Löschen')?.handler?.();
    expect(apiDelete).toHaveBeenCalledWith('/chat/rooms/4');
  });
});
