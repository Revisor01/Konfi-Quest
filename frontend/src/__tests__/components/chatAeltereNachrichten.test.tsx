import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Aeltere Chat-Nachrichten durch Hochscrollen nachladen (Audit 26.09.2026,
// app-screens-konfi-teamer BF-04; Simon, 28.09.2026: „Chat lädt nur 100 und
// kein Nachladen. Das muss anders.").
//
// Vorher lud der Raum einmal die juengsten 100 Nachrichten und danach nur
// noch Neues (?after=). Wer hochscrollte, landete am Anfang der 100 und wusste
// nicht, dass es weitergeht. Jetzt: am Listenanfang die naechsten 50 aelteren
// (?before=<aelteste id>) oben einfuegen, Leseposition halten, Ladeanzeige
// oben, „Anfang des Chats", wenn der Server weniger liefert.
//
// Gerendert wird der echte ChatRoom mit echtem useChatScroll, echter
// Nachrichtenliste und echtem useChatSocket; ersetzt sind Netz, Socket,
// Kopfzeile, Eingabe und die einzelne Blase. ion-content ist ein div mit
// nachgebautem Layout: jede Nachricht 50 px hoch, darueber die 44 px der
// Kopfzeile der Liste. So laesst sich in jsdom pruefen, dass die bisher
// oberste Nachricht nach dem Einfuegen wieder an derselben Stelle steht.
// ---------------------------------------------------------------------------

const RAUM: ChatRoomBase = { id: 7, name: 'Jahrgang', type: 'jahrgang' };
const ZEILE = 50;
const KOPF = 44;
const SICHTHOEHE = 600;

const n = (id: number): Message => ({
  id,
  content: `Nachricht ${id}`,
  sender_id: 2,
  sender_name: 'Kim',
  sender_type: 'konfi',
  // Alle am selben Tag: nur ein Tages-Trenner, der das Layout nicht stoert.
  created_at: new Date(Date.UTC(2026, 8, 1, 8, 0, 0) + id * 1000).toISOString(),
  message_type: 'text',
});
const reihe = (von: number, bis: number) => Array.from({ length: bis - von + 1 }, (_, i) => n(von + i));

// --- Netz ------------------------------------------------------------------
type Antwort = { data: Message[] } | Promise<{ data: Message[] }>;
const apiGet = vi.fn<(url: string) => Antwort>();
vi.mock('../../services/api', () => ({
  default: {
    get: (url: string) => Promise.resolve(apiGet(url)),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));
const aufrufe = (teil: string) => apiGet.mock.calls.map(([url]) => url).filter(u => u.includes(teil));

// --- ion-content mit nachgebautem Layout -------------------------------------
let scrollEl: HTMLDivElement | null = null;
let scrollTop = 0;
const scrollToBottom = vi.fn();
const bubbles = () => Array.from(scrollEl?.querySelectorAll<HTMLElement>('[data-bubble]') ?? []);
const scrollHoehe = () => KOPF + bubbles().length * ZEILE;

const IonContentAttrappe = React.forwardRef<unknown, {
  children?: React.ReactNode;
  onIonScroll?: (e: unknown) => void;
  onClick?: () => void;
}>(({ children, onIonScroll, onClick }, ref) => {
  const div = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => {
    const el = div.current!;
    scrollEl = el;
    Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => scrollTop, set: (v: number) => { scrollTop = v; } });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: scrollHoehe });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => SICHTHOEHE });
    return Object.assign(el, {
      getScrollElement: async () => el,
      scrollToBottom: (ms?: number) => {
        scrollToBottom(ms);
        scrollTop = Math.max(0, scrollHoehe() - SICHTHOEHE);
      },
    });
  });
  return (
    <div ref={div} data-testid="scroller" onScroll={() => onIonScroll?.({ detail: {} })} onClick={onClick}>
      {children}
    </div>
  );
});
IonContentAttrappe.displayName = 'IonContentAttrappe';

// Bildschirm-Position einer Blase: aus ihrer Stelle in der Liste und scrollTop.
const echtesRect = Element.prototype.getBoundingClientRect;
function layoutNachbauen() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const index = bubbles().indexOf(this as HTMLElement);
    const top = index >= 0 ? KOPF + index * ZEILE - scrollTop : 0;
    return { top, bottom: top + ZEILE, left: 0, right: 0, width: 0, height: index >= 0 ? ZEILE : 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
}
const obenAufDemSchirm = (id: number) => document.getElementById(`msg-${id}`)!.getBoundingClientRect().top;

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    // Erst beim Rendern aufloesen: vi.mock laeuft vor dem Rest der Datei.
    IonContent: React.forwardRef<unknown, React.ComponentProps<typeof IonContentAttrappe>>((p, ref) => (
      <IonContentAttrappe {...p} ref={ref} />
    )),
    IonIcon: () => null,
    IonSpinner: () => <span data-testid="spinner" />,
    IonRefresher: ({ onIonRefresh }: { onIonRefresh?: (e: unknown) => void }) => (
      <button type="button" onClick={() => onIonRefresh?.({ detail: { complete: vi.fn() } })}>aktualisieren</button>
    ),
    IonRefresherContent: () => null,
    IonAvatar: durch,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn()],
    useIonActionSheet: () => [vi.fn()],
  };
});

// --- Umgebung ----------------------------------------------------------------
const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, type: 'konfi', display_name: 'Ich' }, setError, isOnline: true }),
}));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markRoomAsRead: vi.fn(async () => undefined), refreshAllCounts: vi.fn(async () => undefined), chatUnreadByRoom: {} }),
}));
// Der Offline-Cache: einmal abrufen wie beim Oeffnen, sonst nichts.
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (_key: string, fetcher: () => Promise<Message[]>) => {
    const [data, setData] = useState<Message[] | null>(null);
    useEffect(() => { fetcher().then(setData); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return { data, refresh: vi.fn() };
  },
}));
vi.mock('../../services/offlineCache', () => ({ CACHE_TTL: { CHAT_MESSAGES: 1 } }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    getByMetadata: vi.fn(async () => []),
    getFailedChat: vi.fn(async () => []),
    forgetFailedChatMany: vi.fn(),
    forgetFailedChat: vi.fn(),
    flush: vi.fn(),
  },
  onItemFailed: () => () => {},
}));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: { Data: 'DATA' } }));
vi.mock('@capacitor/keyboard', () => ({ Keyboard: { addListener: () => Promise.resolve({ remove: vi.fn() }) } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
let beimReconnect: (() => void) | null = null;
vi.mock('../../services/websocket', () => ({
  initializeWebSocket: vi.fn(),
  getSocket: () => null,
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  onReconnect: (cb: () => void) => { beimReconnect = cb; return () => { beimReconnect = null; }; },
}));
vi.mock('../../services/tokenStore', () => ({ getToken: () => null }));
vi.mock('../../components/chat/ChatRoomSections', () => ({
  ChatHeader: () => null,
  MessageInput: () => null,
  autoCapitalize: (s: string) => s,
}));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null }));
vi.mock('../../components/chat/modals/PollModal', () => ({ default: () => null }));
vi.mock('../../components/chat/modals/MembersModal', () => ({ default: () => null }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(), triggerPullHaptic: vi.fn(), ImpactStyle: { Medium: 'MEDIUM' } }));
vi.mock('../../components/chat/chatTeilen', () => ({ nachrichtTeilen: vi.fn() }));
vi.mock('../../components/chat/useChatDateien', () => ({
  useChatDateien: () => ({
    selectedFile: null, selectedFilePreview: null, handleFileSelect: vi.fn(),
    clearSelectedFile: vi.fn(), handleFileClick: vi.fn(), ladendeDatei: null,
  }),
}));
vi.mock('../../components/chat/useUmfragenUndReaktionen', () => ({
  useUmfragenUndReaktionen: () => ({
    showReactionPicker: false, setShowReactionPicker: vi.fn(), reactionTargetMessage: null,
    setReactionTargetMessage: vi.fn(), voteInPoll: vi.fn(), toggleReaction: vi.fn(), openReactionPicker: vi.fn(),
  }),
}));
vi.mock('../../components/chat/useChatVerwaltung', () => ({
  useChatVerwaltung: () => ({
    canLeaveChat: () => false, istLeitung: false, darfTeamChatLeeren: false,
    handleChatOptions: vi.fn(), handleClearChat: vi.fn(),
  }),
}));
// Die Blase selbst: nur id und Text. Ihr Verhalten hat eigene Tests.
vi.mock('../../components/chat/MessageBubble', () => ({
  default: ({ message }: { message: Message }) => (
    <div id={`msg-${message.id}`} data-bubble>{message.content}</div>
  ),
}));

import ChatRoom from '../../components/chat/ChatRoom';

// --- Helfer ------------------------------------------------------------------
const angezeigteIds = () => bubbles().map(b => Number(b.id.replace('msg-', '')));
const kopf = () => screen.getByRole('status');

/** Den Raum oeffnen und warten, bis der Initial-Scroll ans Ende gelaufen ist. */
async function oeffnen() {
  render(<ChatRoom room={RAUM} onBack={vi.fn()} presentingElement={null} />);
  await waitFor(() => expect(scrollToBottom).toHaveBeenCalled());
  // Der Initial-Scroll setzt am Ende den Merker "erstes Scrollen erledigt".
  await act(async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
}

/** An eine Stelle scrollen (Scroll-Ereignis wie von ion-content). */
async function scrollenNach(top: number) {
  scrollTop = top;
  await act(async () => {
    fireEvent.scroll(screen.getByTestId('scroller'));
    await Promise.resolve();
  });
}

function aufgeschoben() {
  let loesen!: (v: { data: Message[] }) => void;
  let ablehnen!: (e: unknown) => void;
  const versprechen = new Promise<{ data: Message[] }>((res, rej) => { loesen = res; ablehnen = rej; });
  return { versprechen, loesen, ablehnen };
}

beforeEach(() => {
  apiGet.mockReset();
  scrollToBottom.mockReset();
  setError.mockReset();
  scrollTop = 0;
  scrollEl = null;
  beimReconnect = null;
  layoutNachbauen();
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = echtesRect;
});

describe('Chat: aeltere Nachrichten beim Hochscrollen nachladen', () => {
  it('laedt am Listenanfang die naechsten 50 vor der aeltesten, fuegt sie oben ein und haelt die Leseposition', async () => {
    const seite = aufgeschoben();
    apiGet.mockImplementation((url) => {
      if (url === '/chat/rooms/7/messages?limit=100') return { data: reihe(101, 200) };
      if (url === '/chat/rooms/7/messages?before=101&limit=50') return seite.versprechen;
      throw new Error(`unerwartet: ${url}`);
    });

    await oeffnen();
    expect(angezeigteIds()).toEqual(reihe(101, 200).map(m => m.id));
    // Weiter unten lesen loest nichts aus.
    await scrollenNach(2000);
    expect(aufrufe('before=')).toEqual([]);

    // Nahe am Anfang (unter 300 px): Anfrage mit der aeltesten geladenen id.
    await scrollenNach(100);
    await waitFor(() => expect(aufrufe('before=')).toEqual(['/chat/rooms/7/messages?before=101&limit=50']));

    // Ladeanzeige oben, als Statusmeldung fuer Vorlesefunktionen.
    expect(kopf()).toHaveAttribute('aria-live', 'polite');
    expect(kopf()).toHaveTextContent('Ältere Nachrichten werden geladen...');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();

    // Weitere Scroll-Ereignisse waehrend des Ladens: keine zweite Anfrage.
    await scrollenNach(50);
    expect(aufrufe('before=')).toHaveLength(1);

    const vorher = obenAufDemSchirm(101);
    const scrollZuvor = scrollToBottom.mock.calls.length;
    await act(async () => { seite.loesen({ data: reihe(51, 100) }); });

    await waitFor(() => expect(angezeigteIds()).toEqual(reihe(51, 200).map(m => m.id)));
    // Die bisher oberste Nachricht steht exakt dort, wo sie stand: scrollTop
    // ist um die Hoehe der 50 eingefuegten gewachsen (50 x 50 px).
    expect(obenAufDemSchirm(101)).toBe(vorher);
    expect(scrollTop).toBe(50 + 50 * ZEILE);
    // Und kein Sprung ans Listenende wie bei einer neuen Nachricht.
    expect(scrollToBottom.mock.calls.length).toBe(scrollZuvor);
    // Genau 50 kamen, also geht es weiter: kein Hinweis auf den Anfang.
    expect(kopf()).not.toHaveTextContent('Anfang des Chats');
  });

  it('zeigt „Anfang des Chats", wenn der Server weniger liefert — und fragt dann nicht mehr', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/chat/rooms/7/messages?limit=100') return { data: reihe(101, 200) };
      if (url === '/chat/rooms/7/messages?before=101&limit=50') return { data: reihe(51, 100) };
      // Letzte Seite: nur noch 30 — und eine Nachricht, die schon da ist
      // (sich ueberholende Antworten). Sie darf nicht doppelt erscheinen.
      if (url === '/chat/rooms/7/messages?before=51&limit=50') return { data: [...reihe(21, 50), n(51)] };
      throw new Error(`unerwartet: ${url}`);
    });

    await oeffnen();
    await scrollenNach(10);
    await waitFor(() => expect(angezeigteIds()[0]).toBe(51));
    expect(kopf()).not.toHaveTextContent('Anfang des Chats');

    await scrollenNach(0);
    await waitFor(() => expect(kopf()).toHaveTextContent('Anfang des Chats'));

    const angezeigt = angezeigteIds();
    expect(angezeigt).toEqual(reihe(21, 200).map(m => m.id));
    expect(new Set(angezeigt).size).toBe(angezeigt.length);

    // Am Anfang: weitere Scroll-Ereignisse fragen nicht mehr nach.
    await scrollenNach(0);
    await scrollenNach(0);
    expect(aufrufe('before=')).toEqual([
      '/chat/rooms/7/messages?before=101&limit=50',
      '/chat/rooms/7/messages?before=51&limit=50',
    ]);
  });

  it('ein Chat unter 100 Nachrichten ist beim Oeffnen schon ganz da: Hinweis sofort, keine Anfrage', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/chat/rooms/7/messages?limit=100') return { data: reihe(1, 5) };
      throw new Error(`unerwartet: ${url}`);
    });

    await oeffnen();
    await scrollenNach(0);

    expect(kopf()).toHaveTextContent('Anfang des Chats');
    expect(aufrufe('before=')).toEqual([]);
  });

  it('Aktualisieren behaelt die nachgeladenen aelteren Nachrichten', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/chat/rooms/7/messages?limit=100') {
        // Beim zweiten Abruf ist eine Nachricht dazugekommen.
        return { data: aufrufe('limit=100').length > 1 ? reihe(102, 201) : reihe(101, 200) };
      }
      if (url === '/chat/rooms/7/messages?before=101&limit=50') return { data: reihe(51, 100) };
      throw new Error(`unerwartet: ${url}`);
    });

    await oeffnen();
    await scrollenNach(0);
    await waitFor(() => expect(angezeigteIds()[0]).toBe(51));

    // Pull-to-Refresh (derselbe Weg wie nach Loeschen oder neuer Umfrage).
    await act(async () => { fireEvent.click(screen.getByText('aktualisieren')); });
    await waitFor(() => expect(angezeigteIds().at(-1)).toBe(201));

    expect(angezeigteIds()).toEqual(reihe(51, 201).map(m => m.id));
  });

  it('neue Nachrichten beim Wiederverbinden kommen weiter per after= nach der JUENGSTEN', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/chat/rooms/7/messages?limit=100') return { data: reihe(101, 200) };
      if (url === '/chat/rooms/7/messages?before=101&limit=50') return { data: reihe(51, 100) };
      if (url === '/chat/rooms/7/messages?after=200') return { data: reihe(201, 202) };
      throw new Error(`unerwartet: ${url}`);
    });

    await oeffnen();
    await scrollenNach(0);
    await waitFor(() => expect(angezeigteIds()[0]).toBe(51));

    await act(async () => { beimReconnect?.(); });
    await waitFor(() => expect(angezeigteIds().at(-1)).toBe(202));

    expect(aufrufe('after=')).toEqual(['/chat/rooms/7/messages?after=200']);
    expect(angezeigteIds()).toEqual(reihe(51, 202).map(m => m.id));
  });

  it('schlaegt das Nachladen fehl: Knopf zum erneuten Versuch statt Anfragen bei jedem Scrollen', async () => {
    let versuch = 0;
    apiGet.mockImplementation((url) => {
      if (url === '/chat/rooms/7/messages?limit=100') return { data: reihe(101, 200) };
      if (url === '/chat/rooms/7/messages?before=101&limit=50') {
        versuch += 1;
        return versuch === 1 ? Promise.reject(new Error('Funkloch')) : { data: reihe(51, 100) };
      }
      throw new Error(`unerwartet: ${url}`);
    });

    await oeffnen();
    await scrollenNach(0);
    const knopf = await screen.findByRole('button', { name: 'Ältere Nachrichten laden' });

    await scrollenNach(0);
    await scrollenNach(0);
    expect(versuch).toBe(1);

    await act(async () => { fireEvent.click(knopf); });
    await waitFor(() => expect(angezeigteIds()[0]).toBe(51));
    expect(versuch).toBe(2);
  });
});
