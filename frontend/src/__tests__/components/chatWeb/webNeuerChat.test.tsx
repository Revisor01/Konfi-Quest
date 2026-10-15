// „Neuer Chat": welches Fenster wo aufgeht (Simon, 15.10.2026: „neuer chat
// modal ist noch app").
//
// Im Browser ab 992 px (breites Layout, WebChat) oeffnen beide Knoepfe -- über
// der Raumliste und im leeren rechten Teil -- den Dialog der Web-Fassung
// (web/WebNeuerChatDialog), nicht das Modal der App. In der App und im
// schmalen Fenster bleibt es beim Modal (modals/SimpleCreateChatModal). Nach
// dem Anlegen geht es in beiden Faellen denselben Weg: Liste neu laden, in den
// Raum springen (useChatUebersicht.neuerChatAngelegt).
//
// Gerendert wird die echte Seite (ChatOverviewPage) mit der echten Uebersicht
// der App bzw. der echten Raumliste des Browsers. Ersetzt sind Netz, Cache,
// Socket, Kontexte und die Ionic-Bausteine; den Raum rechts braucht hier
// niemand (kein Raum offen).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';
import type { ChatRoomOverview } from '../../../types/chat';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  push: vi.fn(),
  modal: vi.fn(),
  setError: vi.fn(),
  zaehler: vi.fn(async () => undefined),
  neuLaden: vi.fn(async () => undefined),
  breit: true,
  raeume: [] as unknown[],
  // Stabil wie im Betrieb: Ein neues Objekt je Zeichnen loeste jedes Mal ein Neuladen aus.
  ungelesen: {} as Record<number, number>,
}));

type Kinder = { children?: React.ReactNode };

vi.mock('@ionic/react', () => {
  const durch = ({ children }: Kinder) => <div>{children}</div>;
  const knopf = ({ children, onClick, 'aria-label': name }: Kinder & { onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" aria-label={name} onClick={onClick}>{children}</button>
  );
  return {
    IonPage: React.forwardRef<HTMLDivElement, Kinder>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonContent: durch, IonList: durch, IonListHeader: durch, IonItemGroup: durch, IonCard: durch, IonCardContent: durch,
    IonItemSliding: durch, IonItemOptions: durch, IonSegment: durch,
    IonItem: ({ children, onClick }: Kinder & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonLabel: ({ children }: Kinder) => <span>{children}</span>,
    IonIcon: () => null,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonInput: ({ 'aria-label': name }: { 'aria-label'?: string }) => <input aria-label={name} />,
    IonButton: knopf,
    IonItemOption: knopf,
    IonSegmentButton: knopf,
    useIonModal: (komponente: unknown, props: unknown) => [(opts?: unknown) => h.modal({ komponente, props, opts }), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: (...a: unknown[]) => h.push(...a) }),
    useIonViewWillEnter: () => undefined,
    useIonViewDidLeave: () => undefined,
    // Der Raumwechsel ohne Seitenuebergang (useOhneSeitenanimation) liest und setzt "animated".
    getConfig: () => ({ getBoolean: (_name: string, vorgabe: boolean) => vorgabe, set: () => undefined }),
  };
});
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/konfi/chat', search: '', state: null }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 21, type: 'konfi', role_name: 'konfi', display_name: 'Karl Konfi' }, setError: h.setError, isOnline: true }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ chatUnreadByRoom: h.ungelesen, refreshFromAPI: h.zaehler }) }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null } }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ socketEpoch: 0 }) }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (_key: string, _laden: unknown, optionen?: { select?: (roh: unknown) => unknown }) => ({
    data: optionen?.select ? optionen.select(h.raeume) : h.raeume,
    loading: false,
    isOffline: false,
    refresh: h.neuLaden,
  }),
}));
vi.mock('../../../services/offlineCache', () => ({ CACHE_TTL: { CHAT_MESSAGES: 1, CHAT_ROOMS: 1 } }));
vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown) => h.apiPost(u, b) },
}));
vi.mock('../../../services/websocket', () => ({
  onReconnect: () => () => undefined,
  initializeWebSocket: () => ({ on: vi.fn(), off: vi.fn() }),
}));
vi.mock('../../../services/tokenStore', () => ({ getToken: () => 'sitzung' }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn() }));
// Die Kopfzeile traegt in der App den Knopf „Neuen Chat starten" (rechts).
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ rechts }: { rechts?: React.ReactNode }) => <header>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../../components/shared', () => ({ SectionHeader: () => null, EmptyState: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
// Der Raum rechts: Ohne geoeffneten Raum steht er nicht da.
vi.mock('../../../components/chat/web/WebChatRaum', () => ({ default: () => null }));

import ChatOverviewPage from '../../../components/chat/pages/ChatOverviewPage';
import SimpleCreateChatModal from '../../../components/chat/modals/SimpleCreateChatModal';

const raum = (id: number, name: string, zusatz: Partial<ChatRoomOverview> = {}): ChatRoomOverview => ({
  id, name, type: 'group', unread_count: 0, participant_count: 5, ...zusatz,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  h.raeume = [raum(2, 'Jahrgang 2026', { type: 'jahrgang' }), raum(41, 'direkt-14-21', { type: 'direct' })];
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/chat/rooms') return { data: h.raeume };
    if (pfad === '/chat/available-users') {
      return { data: { users: [{ id: 14, name: 'Lena Leitung', type: 'admin', role_name: 'admin', role_description: 'Leitung', jahrgang_name: null }] } };
    }
    throw new Error(`unerwartet: ${pfad}`);
  });
  h.apiPost.mockResolvedValue({ data: { room_id: 41, created: true } });
});
afterEach(() => cleanup());

describe('Neuer Chat im Browser ab 992 px: der Dialog der Web-Fassung', () => {
  it('beide Knoepfe (ueber der Liste und im leeren rechten Teil) oeffnen den Dialog, nicht das Modal der App', async () => {
    render(<ChatOverviewPage />);
    const knoepfe = await screen.findAllByRole('button', { name: 'Neuer Chat' });
    expect(knoepfe).toHaveLength(2);

    for (const knopf of knoepfe) {
      fireEvent.click(knopf);
      const dialog = await screen.findByRole('dialog', { name: 'Neue Direktnachricht' });
      expect(await within(dialog).findByRole('button', { name: 'Lena Leitung, Leitung' })).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    expect(h.modal).not.toHaveBeenCalled();
  });

  it('eine Direktnachricht anlegen: POST /chat/direct, der Dialog schliesst, die Liste laedt neu und der Raum oeffnet sich', async () => {
    render(<ChatOverviewPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Neuer Chat' }))[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Neue Direktnachricht' });
    const lena = await within(dialog).findByRole('button', { name: 'Lena Leitung, Leitung' });
    h.neuLaden.mockClear();
    await act(async () => { fireEvent.click(lena); });

    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/konfi/chat/room/41', 'none', 'push'));
    expect(h.apiPost.mock.calls).toEqual([['/chat/direct', { target_user_id: 14, target_user_type: 'admin' }]]);
    expect(h.zaehler).toHaveBeenCalledTimes(1);
    expect(h.neuLaden).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(h.modal).not.toHaveBeenCalled();
  });
});

describe('Neuer Chat in der App und im schmalen Fenster: das Modal der App', () => {
  it('„Neuen Chat starten" oeffnet SimpleCreateChatModal, keinen Dialog; nach dem Anlegen derselbe Weg in den Raum', async () => {
    h.breit = false;
    render(<ChatOverviewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Chat starten' }));
    expect(h.modal).toHaveBeenCalledTimes(1);
    const { komponente, props } = h.modal.mock.calls[0][0] as { komponente: unknown; props: { onSuccess: (id?: number) => Promise<void> } };
    expect(komponente).toBe(SimpleCreateChatModal);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neuer Chat' })).not.toBeInTheDocument();

    h.neuLaden.mockClear();
    await act(async () => { await props.onSuccess(41); });
    expect(h.neuLaden).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith('/konfi/chat/room/41');
  });
});
