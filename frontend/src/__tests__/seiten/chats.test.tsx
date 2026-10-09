// Chat-Übersicht: App und Browser zeigen die Reiter aus seiten/chats.ts
// (09.10.2026), in beiden erst die Reiter, darunter die Suche (Simon,
// 06.09.2026). Dazu die zwei behobenen Abweichungen: „Ungelesen" zählt wie die
// rote Zahl am Raum, und der Leertext der App unterscheidet „keine Chats" von
// „nichts in Suche und Reiter".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createContext, useContext } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import type { ChatRoomOverview } from '../../types/chat';

type Kinder = { children?: React.ReactNode };
const SegmentWahl = createContext<(wert: string) => void>(() => undefined);

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
    IonItem: ({ children, onClick }: Kinder & { onClick?: () => void }) => <div data-testid="raum" onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: Kinder) => <div>{children}</div>,
    IonItemOptions: pass,
    IonItemOption: ({ children }: Kinder) => <button type="button">{children}</button>,
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
    useIonAlert: () => [vi.fn()],
    useIonViewWillEnter: () => undefined,
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

let nutzer: { id: number; type: 'konfi' | 'teamer' | 'admin' } = { id: 1, type: 'konfi' };
let ungelesen: Record<number, number> = {};
let raeume: unknown[] = [];

vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: nutzer, setError: vi.fn(), isOnline: true }) }));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ chatUnreadByRoom: ungelesen }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null } }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ socketEpoch: 0 }) }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/konfi/chat', search: '' }) }));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (_key: string, _laden: unknown, optionen?: { select?: (roh: unknown) => unknown }) => ({
    data: optionen?.select ? optionen.select(raeume) : raeume, loading: false, refresh: vi.fn(async () => undefined),
  }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
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
  SectionHeader: () => null,
  EmptyState: ({ title, message }: { title: string; message: string }) => <p data-testid="leer">{title} | {message}</p>,
}));

import ChatOverviewPage from '../../components/chat/pages/ChatOverviewPage';
import WebChatListe from '../../components/chat/web/WebChatListe';
import { useChatUebersicht } from '../../components/chat/useChatUebersicht';
import { raeumeFiltern } from '../../components/chat/chatRaeume';
import { CHAT_LEER, CHAT_REITER, chatReiterFuer } from '../../seiten/chats';

const raum = (id: number, name: string, zusatz: Partial<ChatRoomOverview> = {}): ChatRoomOverview => ({
  id, name, type: 'group', unread_count: 0, participant_count: 5, ...zusatz,
});
const JAHRGANG = raum(1, 'Jahrgang 2026', { type: 'jahrgang' });
const TEAM = raum(2, 'Leitungsrunde', { type: 'admin' });
/** Der Server meldet 2 ungelesene, der Kontext kennt den Raum (noch) nicht. */
const NUR_SERVER = raum(3, 'Freizeit-Gruppe', { type: 'group', unread_count: 2 });

/** Die Web-Liste mit dem echten Hook der Übersicht -- wie WebChat sie bekommt. */
const WebListe: React.FC = () => {
  const uebersicht = useChatUebersicht({ onSelectRoom: () => undefined });
  return <WebChatListe uebersicht={uebersicht} offenerRaumId={null} adresseVon={(id) => `/konfi/chat/room/${id}`} onNeuerChat={() => undefined} />;
};
const ohneZahl = (el: Element) => {
  let text = el.textContent ?? '';
  el.querySelectorAll('.web-chip__zahl').forEach((z) => { text = text.replace(z.textContent ?? '', ''); });
  return text.trim();
};
const appReiter = () => screen.getAllByRole('tab').map((t) => t.textContent);
const webReiter = () => within(screen.getByRole('group', { name: 'Chats filtern' })).getAllByRole('button').map(ohneZahl);

beforeEach(() => { nutzer = { id: 1, type: 'konfi' }; ungelesen = {}; raeume = [JAHRGANG, TEAM, NUR_SERVER]; });
afterEach(() => cleanup());

describe('App und Browser zeigen die Reiter der Beschreibung', () => {
  it.each([['konfi', false], ['teamer', true], ['admin', true]] as const)('%s', (typ, mitTeam) => {
    nutzer = { id: 1, type: typ };
    const erwartet = chatReiterFuer(mitTeam).map((r) => r.label);
    render(<ChatOverviewPage />);
    expect(appReiter()).toEqual(erwartet);
    cleanup();
    render(<WebListe />);
    expect(webReiter()).toEqual(erwartet);
    expect(erwartet).toEqual(mitTeam ? ['Alle', 'Ungelesen', 'Konfis', 'Team'] : ['Alle', 'Ungelesen', 'Konfis']);
  });

  it('im Browser stehen die Reiter vor der Suche -- wie in der App', () => {
    render(<WebListe />);
    const reiter = screen.getByRole('group', { name: 'Chats filtern' });
    const suche = screen.getByRole('searchbox', { name: 'Chats durchsuchen' });
    expect(reiter.compareDocumentPosition(suche) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('„Ungelesen" zählt wie die rote Zahl am Raum', () => {
  it('ein Raum mit ungelesenen laut Server steht unter Ungelesen, auch wenn der Kontext ihn noch nicht kennt', () => {
    const ids = raeumeFiltern([JAHRGANG, TEAM, NUR_SERVER], { suche: '', filter: 'ungelesen', ungelesen: {} }).map((r) => r.id);
    expect(ids).toEqual([3]);
    // Kennt der Kontext den Raum, gilt seine Zahl -- auch 0.
    expect(raeumeFiltern([NUR_SERVER], { suche: '', filter: 'ungelesen', ungelesen: { 3: 0 } })).toEqual([]);
  });

  it('App: der Reiter Ungelesen zeigt den Raum', () => {
    render(<ChatOverviewPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ungelesen' }));
    expect([...document.querySelectorAll('.app-list-item__title')].map((t) => t.textContent)).toEqual(['Freizeit-Gruppe']);
  });

  it('jeder Reiter der Beschreibung hat ein Prädikat', () => {
    for (const r of CHAT_REITER) expect(typeof r.passt).toBe('function');
  });
});

describe('Leertexte: keine Chats -- oder nichts in Suche und Reiter', () => {
  it('App ohne Räume', () => {
    raeume = [];
    render(<ChatOverviewPage />);
    expect(screen.getByTestId('leer').textContent).toBe(`${CHAT_LEER.keine.titel} | ${CHAT_LEER.keine.text}`);
  });

  it('App mit Reiter ohne Treffer (bis 09.10.2026: „Erstelle deinen ersten Chat!")', () => {
    raeume = [JAHRGANG];
    render(<ChatOverviewPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ungelesen' }));
    expect(screen.getByTestId('leer').textContent).toBe(`${CHAT_LEER.gefiltert.titel} | ${CHAT_LEER.gefiltert.text}`);
  });

  it('Browser mit Reiter ohne Treffer: derselbe Text', () => {
    raeume = [JAHRGANG];
    render(<WebListe />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Chats filtern' })).getByRole('button', { name: /^Ungelesen/ }));
    expect(screen.getByText(CHAT_LEER.gefiltert.text)).toBeInTheDocument();
  });
});
