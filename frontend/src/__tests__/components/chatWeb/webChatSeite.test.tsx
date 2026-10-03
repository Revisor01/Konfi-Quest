// Die zweigeteilte Ansicht des Chats (Browser ab 992 px), gerendert
// (components/chat/web/WebChat.tsx, WebChatListe.tsx; Entscheidung 6 in
// docs/planung/web-alle-bereiche.md): links die Raeume mit Suche, Reitern und
// roten Zahlen, rechts der geoeffnete Raum -- oder der Hinweis "Chat
// auswaehlen". /…/chat zeigt die Liste, /…/chat/room/:id dieselbe Ansicht mit
// dem Raum; ein Klick auf einen Raum wechselt die Adresse ohne
// Seitenuebergang. In der App und im schmalen Fenster bleibt alles wie es war.
//
// Gerendert werden die echten Seiten (ChatOverviewPage, ChatRoomView) mit der
// echten Liste und dem echten Raum samt Hooks. Ersetzt sind Netz, Socket,
// Warteschlange, Kontexte, Ionic-Bausteine und die App-Fassungen (nur als
// Marke, ihr Verhalten haben eigene Tests).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, useState } from 'react';
import { render, screen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import type { ChatRoomOverview, Message } from '../../../types/chat';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  modal: vi.fn(),
  alert: vi.fn(),
  setError: vi.fn(),
  badgeGelesen: vi.fn(async (_raum: number) => undefined),
  zaehlerHolen: vi.fn(async () => undefined),
  ungelesen: {} as Record<number, number>,
  breit: true,
  user: { id: 5, type: 'konfi', role_name: 'konfi', display_name: 'Mika Beispiel' } as Record<string, unknown>,
  standort: { pathname: '/konfi/chat', search: '', state: null } as { pathname: string; search: string; state: null },
  raeume: [] as unknown[],
  nachrichten: {} as Record<number, unknown[]>,
  roomFehler: false,
  raeumeLaden: false,
  neuLaden: vi.fn(async () => undefined),
}));

vi.mock('@ionic/react', async () => (await import('./webChatAttrappe')).ionicAttrappe({
  presentAlert: (o) => h.alert(o),
  presentModal: (komponente, props) => (opts) => h.modal({ komponente, props, opts }),
  router: { push: (...a: unknown[]) => h.push(...a) },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./webChatAttrappe')).KopfzeileAttrappe);
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null } }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ socketEpoch: 0 }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markRoomAsRead: h.badgeGelesen, refreshAllCounts: h.zaehlerHolen, chatUnreadByRoom: h.ungelesen }),
}));
vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown, c?: unknown) => h.apiPost(u, b, c), delete: (u: string) => h.apiDelete(u) },
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (_key: string, laden: () => Promise<unknown>, optionen?: { select?: (roh: unknown) => unknown }) => {
    const [zustand, setZustand] = useState<{ data: unknown; loading: boolean }>({ data: null, loading: true });
    // Der Raum selbst liegt im Zwischenspeicher: Ein Wechsel auf einen anderen
    // Raum liefert dessen Daten sofort, ohne Ladezustand dazwischen -- genau
    // dann muss die Seite den Raum neu aufbauen, nicht weiterverwenden.
    const ausCache = !h.roomFehler && _key.startsWith('chat:room:')
      ? (h.raeume as Array<{ id: number }>).find((r) => r.id === Number(_key.slice('chat:room:'.length))) ?? null
      : null;
    // Wie das echte Hook: ein anderer Schluessel leert den Stand und laedt neu.
    useEffect(() => {
      if (ausCache) return;
      setZustand({ data: null, loading: true });
      if (_key.startsWith('chat:rooms:') && h.raeumeLaden) return;
      let aktuell = true;
      laden().then(
        (roh) => { if (aktuell) setZustand({ data: optionen?.select ? optionen.select(roh) : roh, loading: false }); },
        () => { if (aktuell) setZustand({ data: null, loading: false }); },
      );
      return () => { aktuell = false; };
    }, [_key]); // eslint-disable-line react-hooks/exhaustive-deps
    const refresh = _key.startsWith('chat:rooms:') ? h.neuLaden : vi.fn(async () => undefined);
    return ausCache
      ? { data: ausCache, loading: false, isOffline: false, refresh }
      : { ...zustand, isOffline: false, refresh };
  },
}));
vi.mock('../../../services/offlineCache', () => ({ CACHE_TTL: { CHAT_MESSAGES: 1, CHAT_ROOMS: 1 } }));
vi.mock('../../../services/writeQueue', () => ({
  writeQueue: {
    getByMetadata: vi.fn(async () => []),
    getFailedChat: vi.fn(async () => []),
    forgetFailedChatMany: vi.fn(),
    forgetFailedChat: vi.fn(),
    flush: vi.fn(),
    enqueue: vi.fn(async () => undefined),
  },
  onItemFailed: () => () => {},
}));
vi.mock('../../../services/uploadDiagnose', () => ({ uploadFehlerMelden: vi.fn(), warteschlangenFehlerMelden: vi.fn() }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../services/websocket', async () => {
  const { socketNachbau } = await import('./webChatAttrappe');
  return {
    initializeWebSocket: () => socketNachbau,
    getSocket: () => socketNachbau,
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    onReconnect: () => () => undefined,
  };
});
vi.mock('../../../services/tokenStore', () => ({ getToken: () => 'sitzung' }));
vi.mock('@capacitor/keyboard', () => ({ Keyboard: { addListener: () => Promise.resolve({ remove: vi.fn() }) } }));
vi.mock('../../../utils/haptics', () => ({ haptik: vi.fn(), triggerPullHaptic: vi.fn(), ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' } }));
vi.mock('../../../components/chat/chatTeilen', () => ({ nachrichtTeilen: vi.fn(), chatVerlaufExportieren: vi.fn() }));
vi.mock('../../../components/chat/useChatDateien', () => ({
  useChatDateien: () => ({
    selectedFile: null, selectedFilePreview: null, dateiWaehlen: vi.fn(), dateiUebernehmen: vi.fn(),
    clearSelectedFile: vi.fn(), handleFileClick: vi.fn(), ladendeDatei: null,
  }),
}));
vi.mock('../../../components/chat/LazyImage', () => ({ default: () => null }));
vi.mock('../../../components/chat/VideoPreview', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/PollModal', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/MembersModal', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/SimpleCreateChatModal', () => ({ default: () => null }));
// Die App-Fassungen: nur als Marke -- ihr Verhalten pruefen die Tests der App.
vi.mock('../../../components/chat/ChatOverview', () => ({
  default: React.forwardRef(() => <div data-testid="app-uebersicht">App-Uebersicht</div>),
}));
vi.mock('../../../components/chat/ChatRoom', () => ({ default: () => <div data-testid="app-raum">App-Raum</div> }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));

import { socketNachbau } from './webChatAttrappe';
import ChatOverviewPage from '../../../components/chat/pages/ChatOverviewPage';
import ChatRoomView from '../../../components/chat/views/ChatRoomView';
import SimpleCreateChatModal from '../../../components/chat/modals/SimpleCreateChatModal';
import { listenMerker, listenMerkerZuruecksetzen } from '../../../components/chat/web/chatListenMerker';
import { gezeigteTrennerAnkerLeeren } from '../../../components/chat/chatVerlauf';

// --- Daten -----------------------------------------------------------------------------
const um = (iso: string, text = 'Hallo', absender = 'Kim Muster', zusatz = {}) => ({ content: text, sender_name: absender, created_at: iso, ...zusatz });
const raum = (id: number, name: string, zusatz: Partial<ChatRoomOverview> = {}): ChatRoomOverview => ({
  id, name, type: 'group', unread_count: 0, participant_count: 5, ...zusatz,
});
const MIKA = { user_id: 5, user_type: 'konfi' as const, name: 'Mika Beispiel', display_name: 'Mika Beispiel' };
const TOM = { user_id: 8, user_type: 'teamer' as const, name: 'Tom Teamer', display_name: 'Tom Teamer' };

const RAEUME = [
  raum(2, 'Jahrgang 2026/27', { type: 'jahrgang', last_message: um('2026-10-03T08:06:00Z', 'Danke für die Infos!', 'Lena Probe'), unread_count: 5 }),
  raum(3, 'Freizeit Packliste', { last_message: um('2026-10-03T06:55:00Z', '', 'Kim Muster', { file_name: 'foto.png' }) }),
  raum(4, 'direkt-8-5', { type: 'direct', partner_user_type: 'teamer', participants: [MIKA, TOM], last_message: um('2026-10-03T06:10:00Z', 'Passt, um 17 Uhr.', 'Tom Teamer'), unread_count: 1 }),
  raum(6, 'Konfi-Tag am See - Chat', { event_id: 12, last_message: um('2026-10-02T09:00:00Z', 'Treffpunkt ist der Parkplatz.', 'Alex Beispiel') }),
  raum(7, 'Andachtsteam', { is_team_only: true, last_message: um('2026-09-28T09:00:00Z', 'Probe um 18 Uhr', 'Mika Beispiel') }),
  raum(10, 'Gruppe Taufe 2027'),
];
const NACHRICHT = (id: number, text: string, zusatz: Partial<Message> = {}): Message => ({
  id, content: text, sender_id: 21, sender_name: 'Lena Probe', sender_type: 'konfi',
  created_at: '2026-10-03T08:00:00.000Z', message_type: 'text', ...zusatz,
});

const verdrahten = () => {
  h.apiGet.mockImplementation(async (url: string) => {
    let t: RegExpMatchArray | null;
    if (url === '/chat/rooms') return { data: h.raeume };
    if ((t = url.match(/^\/chat\/rooms\/(\d+)\/messages/))) return { data: h.nachrichten[Number(t[1])] ?? [] };
    if ((t = url.match(/^\/chat\/rooms\/(\d+)$/))) {
      if (h.roomFehler) throw new Error('Netz');
      const r = (h.raeume as ChatRoomOverview[]).find((x) => x.id === Number(t![1]));
      if (r) return { data: r };
      throw new Error('nicht gefunden');
    }
    throw new Error(`unerwartet: ${url}`);
  });
};

const liste = () => screen.getByRole('complementary', { name: 'Chats' });
const zeilen = () => within(liste()).getAllByRole('link');
const zeilenNamen = () => zeilen().map((z) => z.querySelector('.web-chat-zeile__name')?.textContent);

const zeigenListe = async (rolle = '/konfi') => {
  h.standort = { pathname: `${rolle}/chat`, search: '', state: null };
  const ergebnis = render(<ChatOverviewPage />);
  await screen.findByRole('complementary', { name: 'Chats' });
  await waitFor(() => expect(within(liste()).queryAllByRole('link').length).toBeGreaterThan(0));
  return ergebnis;
};
const zeigenRaum = async (id: number, rolle = '/konfi') => {
  h.standort = { pathname: `${rolle}/chat/room/${id}`, search: '', state: null };
  const ergebnis = render(<ChatRoomView roomId={id} onBack={vi.fn()} />);
  await screen.findByRole('complementary', { name: 'Chats' });
  await waitFor(() => expect(within(liste()).queryAllByRole('link').length).toBeGreaterThan(0));
  return ergebnis;
};

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  h.user = { id: 5, type: 'konfi', role_name: 'konfi', display_name: 'Mika Beispiel' };
  h.standort = { pathname: '/konfi/chat', search: '', state: null };
  h.raeume = RAEUME;
  h.nachrichten = { 2: [NACHRICHT(1, 'Willkommen im Jahrgang')], 3: [NACHRICHT(2, 'Packliste steht')] };
  h.ungelesen = { 2: 5, 4: 1 };
  h.roomFehler = false;
  h.raeumeLaden = false;
  h.apiPost.mockResolvedValue({ data: {} });
  verdrahten();
  socketNachbau.handler.clear();
  listenMerkerZuruecksetzen();
  gezeigteTrennerAnkerLeeren();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T10:30:00+02:00'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Chat (Web): /…/chat -- die Liste mit leerem rechten Teil', () => {
  it('links die Raeume, rechts der Hinweis "Chat auswaehlen" -- kein Raum, kein Eingabefeld', async () => {
    await zeigenListe();
    expect(screen.getByRole('heading', { name: 'Chats' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chat auswählen' })).toBeInTheDocument();
    expect(screen.getByText('Wähle links einen Chat aus der Liste oder starte einen neuen.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nachricht schreiben' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kein Chat geöffnet' })).toBeInTheDocument();
  });

  it('zeigt die Kopfzeile "Chat" und wartet nicht auf einen Raum: kein Abruf eines Raums, kein "gelesen"', async () => {
    await zeigenListe();
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
    expect(h.apiGet.mock.calls.map(([u]) => u)).toEqual(['/chat/rooms']);
    expect(h.badgeGelesen).not.toHaveBeenCalled();
  });

  it('die Raeume: Name, Art, letzte Nachricht mit Absender, Zeit und rote Zahl -- neueste zuerst', async () => {
    await zeigenListe();
    expect(zeilenNamen()).toEqual(['Jahrgang 2026/27', 'Freizeit Packliste', 'Tom Teamer', 'Event: Konfi-Tag am See', 'Andachtsteam', 'Gruppe Taufe 2027']);
    const jahrgang = zeilen()[0];
    expect(jahrgang).toHaveTextContent('Jahrgang');
    expect(jahrgang).toHaveTextContent('Lena Probe: Danke für die Infos!');
    expect(jahrgang).toHaveTextContent('10:06');
    expect(jahrgang.querySelector('.web-chat-zahl')).toHaveTextContent('5');
    // Eine Datei ohne Text zeigt den Dateinamen.
    expect(zeilen()[1]).toHaveTextContent('Kim Muster: foto.png');
    // Direktchat: der Name der anderen Person, die Art als Team, die Nachricht ohne Absender.
    expect(zeilen()[2]).toHaveTextContent('Team · Direkt');
    expect(zeilen()[2].querySelector('.web-chat-zeile__vorschau')).toHaveTextContent('Team · DirektPasst, um 17 Uhr.');
    expect(zeilen()[3]).toHaveTextContent('Gestern');
    expect(zeilen()[3]).toHaveTextContent('Event');
    expect(zeilen()[4]).toHaveTextContent('28.09.');
    expect(zeilen()[4]).toHaveTextContent('Du: Probe um 18 Uhr');
    expect(zeilen()[5]).toHaveTextContent('Noch keine Nachrichten');
  });

  it('die rote Zahl kommt aus dem Kontext (live), sonst vom Raum; ein Raum ohne Ungelesenes hat keine', async () => {
    h.ungelesen = { 3: 120 };
    h.raeume = [raum(2, 'Mit Zahl vom Raum', { unread_count: 4, last_message: um('2026-10-03T08:00:00Z') }), ...RAEUME.slice(1)];
    await zeigenListe();
    const zahlen = zeilen().map((z) => z.querySelector('.web-chat-zahl')?.textContent ?? null);
    // Der Kontext kennt Raum 3 (120 -> 99+); Raum 2 und 4 haben dort keinen
    // Eintrag -> die Zahl vom Raum; die uebrigen haben keine.
    expect(zahlen).toEqual(['4', '99+', '1', null, null, null]);
  });

  it('jeder Raum ist ein echter Link mit der Adresse seiner Rolle -- Konfi, Teamer:in und Leitung', async () => {
    await zeigenListe();
    expect(zeilen()[0]).toHaveAttribute('href', '/konfi/chat/room/2');
    cleanup();
    h.user = { id: 8, type: 'teamer', role_name: 'teamer', display_name: 'Tom Teamer' };
    await zeigenListe('/teamer');
    expect(zeilen()[0]).toHaveAttribute('href', '/teamer/chat/room/2');
    cleanup();
    h.user = { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex Beispiel' };
    await zeigenListe('/admin');
    expect(zeilen()[0]).toHaveAttribute('href', '/admin/chat/room/2');
  });

  it('ein Klick wechselt die Adresse ohne Seitenuebergang (push, none); Strg-Klick und Mittelklick gehoeren dem Browser', async () => {
    await zeigenListe();
    expect(fireEvent.click(zeilen()[1])).toBe(false);
    expect(h.push).toHaveBeenCalledWith('/konfi/chat/room/3', 'none', 'push');
    h.push.mockClear();
    expect(fireEvent.click(zeilen()[1], { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(zeilen()[1], { button: 1 })).toBe(true);
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Pfeil hoch und runter wandern durch die Raeume', async () => {
    await zeigenListe();
    zeilen()[0].focus();
    fireEvent.keyDown(zeilen()[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(zeilen()[1]);
    fireEvent.keyDown(zeilen()[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(zeilen()[2]);
    fireEvent.keyDown(zeilen()[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(zeilen()[1]);
    // Am Anfang bleibt der Fokus stehen.
    zeilen()[0].focus();
    fireEvent.keyDown(zeilen()[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(zeilen()[0]);
  });
});

describe('Chat (Web): Suche und Reiter', () => {
  const suche = () => screen.getByRole('searchbox', { name: 'Chats durchsuchen' });
  const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Chats filtern' })).getByRole('button', { name });

  it('die Suche filtert die Liste beim Tippen; Gross- und Kleinschreibung ist gleich', async () => {
    await zeigenListe();
    fireEvent.change(suche(), { target: { value: 'FREIZEIT' } });
    expect(zeilenNamen()).toEqual(['Freizeit Packliste']);
    fireEvent.change(suche(), { target: { value: '' } });
    expect(zeilen()).toHaveLength(6);
  });

  it('nichts gefunden: ein Hinweis statt einer leeren Flaeche', async () => {
    await zeigenListe();
    fireEvent.change(suche(), { target: { value: 'gibt es nicht' } });
    expect(within(liste()).queryAllByRole('link')).toEqual([]);
    expect(screen.getByText('Keine Chats gefunden')).toBeInTheDocument();
    expect(screen.getByText('Passe die Suche oder den Reiter an.')).toBeInTheDocument();
  });

  it('Reiter Ungelesen zeigt genau die Raeume mit roter Zahl, die Zahl am Reiter ist die Summe', async () => {
    await zeigenListe();
    expect(chip(/^Ungelesen/)).toHaveTextContent('6');
    fireEvent.click(chip(/^Ungelesen/));
    expect(zeilenNamen()).toEqual(['Jahrgang 2026/27', 'Tom Teamer']);
    expect(chip(/^Ungelesen/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('Reiter Konfis und Team trennen die Raeume wie die App; Konfis sehen den Reiter Team nicht', async () => {
    // Konfi: kein Reiter "Team".
    await zeigenListe();
    expect(screen.queryByRole('button', { name: /^Team/ })).not.toBeInTheDocument();
    fireEvent.click(chip(/^Konfis/));
    // Jahrgang und Gruppen, auch der Event-Chat; nicht die reine Team-Gruppe und nicht der Direktchat.
    expect(zeilenNamen()).toEqual(['Jahrgang 2026/27', 'Freizeit Packliste', 'Event: Konfi-Tag am See', 'Gruppe Taufe 2027']);
    cleanup();

    h.user = { id: 8, type: 'teamer', role_name: 'teamer', display_name: 'Tom Teamer' };
    await zeigenListe('/teamer');
    fireEvent.click(chip(/^Team/));
    // Aus Sicht von Tom ist der Gegenueber im Direktchat Mika (nicht er selbst).
    expect(zeilenNamen()).toEqual(['Mika Beispiel', 'Andachtsteam']);
  });
});

describe('Chat (Web): /…/chat/room/:id -- dieselbe Ansicht mit dem Raum', () => {
  it('rechts der Raum mit Kopf, Nachrichten und Eingabe; links der Raum als geoeffnet markiert', async () => {
    await zeigenRaum(2);
    expect(await screen.findByText('Willkommen im Jahrgang')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Geöffneter Chat' })).toBeInTheDocument();
    const rechts = screen.getByRole('region', { name: 'Chat Jahrgang 2026/27' });
    expect(within(rechts).getByRole('heading', { name: 'Jahrgang 2026/27' })).toBeInTheDocument();
    expect(within(rechts).getByRole('textbox', { name: 'Nachricht schreiben' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Chat auswählen' })).not.toBeInTheDocument();

    const offen = within(liste()).getByRole('link', { name: /Jahrgang 2026\/27.*geöffnet/ });
    expect(offen).toHaveClass('web-chat-zeile--offen');
    expect(zeilen().filter((z) => z.classList.contains('web-chat-zeile--offen'))).toHaveLength(1);
  });

  it('der Raum aus der Adresse wird geladen und gelesen -- und nur dieser', async () => {
    await zeigenRaum(3);
    expect(await screen.findByText('Packliste steht')).toBeInTheDocument();
    await waitFor(() => expect(h.badgeGelesen).toHaveBeenCalled());
    expect(new Set(h.badgeGelesen.mock.calls.map(([id]) => id))).toEqual(new Set([3]));
    expect(h.apiGet.mock.calls.map(([u]) => u as string).filter((u) => /\/chat\/rooms\/\d/.test(u)).every((u) => u.includes('/rooms/3'))).toBe(true);
  });

  it('ein anderer Raum baut den rechten Teil neu auf: andere Nachrichten, leere Eingabe, nichts vom vorigen', async () => {
    const erster = await zeigenRaum(2);
    expect(await screen.findByText('Willkommen im Jahrgang')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nachricht schreiben' }), { target: { value: 'Halber Satz' } });
    erster.unmount();
    await zeigenRaum(3);
    expect(await screen.findByText('Packliste steht')).toBeInTheDocument();
    expect(screen.queryByText('Willkommen im Jahrgang')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nachricht schreiben' })).toHaveValue('');
    // Zurueck in den ersten Raum: der halbe Satz ist noch da.
    cleanup();
    await zeigenRaum(2);
    expect(await screen.findByText('Willkommen im Jahrgang')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nachricht schreiben' })).toHaveValue('Halber Satz');
  });

  it('wechselt die Seite im Router auf einen anderen Raum, dieselbe Instanz aber bekommt eine neue roomId, wird der Raum neu aufgebaut', async () => {
    const { rerender } = await zeigenRaum(2);
    expect(await screen.findByText('Willkommen im Jahrgang')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nachricht schreiben' }), { target: { value: 'Nur fuer den Jahrgang' } });
    h.standort = { pathname: '/konfi/chat/room/3', search: '', state: null };
    rerender(<ChatRoomView roomId={3} onBack={vi.fn()} />);
    expect(await screen.findByText('Packliste steht')).toBeInTheDocument();
    expect(screen.queryByText('Willkommen im Jahrgang')).not.toBeInTheDocument();
    // Der Entwurf gehoert dem Jahrgang: Er steht nicht im neuen Raum und wird nicht dessen Entwurf.
    expect(screen.getByRole('textbox', { name: 'Nachricht schreiben' })).toHaveValue('');
    h.standort = { pathname: '/konfi/chat/room/2', search: '', state: null };
    rerender(<ChatRoomView roomId={2} onBack={vi.fn()} />);
    expect(await screen.findByText('Willkommen im Jahrgang')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nachricht schreiben' })).toHaveValue('Nur fuer den Jahrgang');
  });

  it('eine Seite, die der Router hinter einer neueren abgelegt hat (Adresse passt nicht mehr), baut nichts auf -- kein Raum, der im Hintergrund liest', async () => {
    h.standort = { pathname: '/konfi/chat/room/3', search: '', state: null };
    render(<ChatRoomView roomId={2} onBack={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('complementary', { name: 'Chats' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nachricht schreiben' })).not.toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
    expect(h.badgeGelesen).not.toHaveBeenCalled();
    // Dasselbe fuer die Liste, sobald ein Raum offen ist.
    cleanup();
    render(<ChatOverviewPage />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('complementary', { name: 'Chats' })).not.toBeInTheDocument();
  });

  it('die Adresse darf einen abschliessenden Schraegstrich tragen', async () => {
    h.standort = { pathname: '/konfi/chat/room/2/', search: '', state: null };
    render(<ChatRoomView roomId={2} onBack={vi.fn()} />);
    expect(await screen.findByRole('complementary', { name: 'Chats' })).toBeInTheDocument();
  });

  it('die Raumliste holt sich Vorschau und Zeit neu, wenn im offenen Raum eine Nachricht eintrifft -- nicht beim Oeffnen', async () => {
    await zeigenRaum(2);
    expect(await screen.findByText('Willkommen im Jahrgang')).toBeInTheDocument();
    const vorher = h.neuLaden.mock.calls.length;
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 2, message: NACHRICHT(50, 'Frisch') }); });
    expect(screen.getByText('Frisch')).toBeInTheDocument();
    expect(h.neuLaden.mock.calls.length).toBe(vorher + 1);
  });

  it('ein Raum, der sich nicht laden laesst, zeigt den Fehler mit erneutem Versuch und dem Weg zurueck zur Liste', async () => {
    h.roomFehler = true;
    await zeigenRaum(2);
    expect(await screen.findByText('Fehler beim Laden des Chat-Raums.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Übersicht' }));
    expect(h.push).toHaveBeenCalledWith('/konfi/chat', 'none', 'replace');
  });

  it('die Leitung loescht einen Chat aus dem Menue des Raums: Rueckfrage, Server, danach zur Liste', async () => {
    h.user = { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex Beispiel' };
    h.nachrichten = { 3: [NACHRICHT(2, 'Packliste steht')] };
    await zeigenRaum(3, '/admin');
    await screen.findByText('Packliste steht');
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Chat-Optionen' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chat löschen' }));
    expect(h.alert).toHaveBeenCalledTimes(1);
    expect(h.alert.mock.calls[0][0]).toMatchObject({ header: 'Chat löschen?', message: expect.stringContaining('Freizeit Packliste') });
    expect(h.apiDelete).not.toHaveBeenCalled();
    h.apiDelete.mockResolvedValue({ data: {} });
    const loeschen = (h.alert.mock.calls[0][0].buttons as Array<{ text: string; handler?: () => void }>).find((k) => k.text === 'Löschen')!;
    await act(async () => { loeschen.handler?.(); await Promise.resolve(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/chat/rooms/3');
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/chat', 'none', 'replace'));
  });
});

describe('Chat (Web): wohin der Fokus nach der Wahl eines Raums geht', () => {
  const echtesMatchMedia = window.matchMedia;
  const zeiger = (fein: boolean) => {
    window.matchMedia = ((abfrage: string) => ({
      matches: fein && abfrage.includes('pointer: fine'),
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  };
  afterEach(() => { window.matchMedia = echtesMatchMedia; });

  it('per Tastatur gewaehlt (Enter, detail 0): auf der neuen Seite steht der Fokus wieder auf der Zeile -- die alte Seite samt Fokus ist abgebaut', async () => {
    zeiger(true);
    const erste = await zeigenListe();
    fireEvent.click(zeilen()[1], { detail: 0 });
    erste.unmount();
    await zeigenRaum(3);
    const zeile = within(liste()).getByRole('link', { name: /Freizeit Packliste.*geöffnet/ });
    expect(document.activeElement).toBe(zeile);
    // Der Merker gilt einmal: eine weitere Seite zieht den Fokus nicht noch einmal.
    cleanup();
    await zeigenRaum(3);
    expect(document.activeElement).toBe(document.body);
  });

  it('mit der Maus gewaehlt: der Fokus geht in die Eingabe des Raums', async () => {
    zeiger(true);
    const erste = await zeigenListe();
    fireEvent.click(zeilen()[1], { detail: 1 });
    erste.unmount();
    await zeigenRaum(3);
    await screen.findByText('Packliste steht');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Nachricht schreiben' }));
  });

  it('ohne Maus (iPad, Touch) bleibt der Fokus weg von der Eingabe -- die Bildschirmtastatur soll nicht ueber den Verlauf springen', async () => {
    zeiger(false);
    const erste = await zeigenListe();
    fireEvent.click(zeilen()[1], { detail: 1 });
    erste.unmount();
    await zeigenRaum(3);
    await screen.findByText('Packliste steht');
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Nachricht schreiben' }));
  });

  it('Strg-Klick oeffnet einen neuen Tab: hier aendert sich nichts, auch spaeter nicht -- ein Merker, der nie greift, bleibt nicht stehen', async () => {
    zeiger(true);
    const erste = await zeigenListe();
    fireEvent.click(zeilen()[1], { detail: 1, ctrlKey: true });
    expect(listenMerker().fokus).toBeNull();
    // Mit der Maus Raum 3 gewaehlt, dann aber Raum 2 geoeffnet (etwa per Zurueck-Taste):
    fireEvent.click(zeilen()[1], { detail: 1 });
    erste.unmount();
    await zeigenRaum(2);
    await screen.findByText('Willkommen im Jahrgang');
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Nachricht schreiben' }));
    expect(listenMerker().fokus).toBeNull();
  });
});

describe('Chat (Web): Neuer Chat', () => {
  it('beide Knoepfe (Liste und Hinweis) oeffnen das Fenster als breiten Dialog; ein neuer Chat wird sofort geoeffnet', async () => {
    await zeigenListe();
    const knoepfe = screen.getAllByRole('button', { name: 'Neuer Chat' });
    expect(knoepfe).toHaveLength(2);
    fireEvent.click(knoepfe[0]);
    expect(h.modal).toHaveBeenCalledTimes(1);
    const { komponente, props, opts } = h.modal.mock.calls[0][0];
    expect(komponente).toBe(SimpleCreateChatModal);
    expect(opts).toEqual({ presentingElement: undefined, cssClass: 'web-chat-modal' });
    fireEvent.click(knoepfe[1]);
    expect(h.modal).toHaveBeenCalledTimes(2);

    // Der Chat wurde angelegt: Liste neu laden, dann in ihn springen.
    await act(async () => { await props.onSuccess(3); });
    expect(h.push).toHaveBeenCalledWith('/konfi/chat/room/3', 'none', 'push');
  });
});

describe('Chat (Web): die Liste bleibt ueber den Seitenwechsel stehen', () => {
  it('Suchbegriff, Reiter und Scrollposition: ein Klick auf einen Raum wechselt die Seite, die neue Liste beginnt dort, wo die alte stand', async () => {
    const erste = await zeigenListe();
    fireEvent.click(within(screen.getByRole('group', { name: 'Chats filtern' })).getByRole('button', { name: /^Konfis/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chats durchsuchen' }), { target: { value: 'a' } });
    const flaeche = liste().querySelector('.web-chat-liste__raeume') as HTMLElement;
    flaeche.scrollTop = 240;
    fireEvent.scroll(flaeche);
    expect(listenMerker().scroll).toBe(240);
    erste.unmount();

    await zeigenRaum(3);
    expect(screen.getByRole('searchbox', { name: 'Chats durchsuchen' })).toHaveValue('a');
    expect(within(screen.getByRole('group', { name: 'Chats filtern' })).getByRole('button', { name: /^Konfis/ })).toHaveAttribute('aria-pressed', 'true');
    expect((liste().querySelector('.web-chat-liste__raeume') as HTMLElement).scrollTop).toBe(240);
  });

  it('die zuletzt geladenen Raeume stehen sofort da -- auch wenn der Zwischenspeicher gerade geleert wurde (nach dem Lesen), ohne Ladezustand', async () => {
    const erste = await zeigenListe();
    erste.unmount();
    // Der Abruf der Raeume dauert (hier: kommt gar nicht).
    h.raeumeLaden = true;
    h.standort = { pathname: '/konfi/chat/room/3', search: '', state: null };
    render(<ChatRoomView roomId={3} onBack={vi.fn()} />);
    expect(await screen.findByRole('complementary', { name: 'Chats' })).toBeInTheDocument();
    expect(zeilen()).toHaveLength(6);
    expect(screen.queryByText('Chats werden geladen')).not.toBeInTheDocument();
  });

  it('ohne gemerkte Raeume zeigt die Liste waehrend des Ladens Platzhalter und sagt es Vorleseprogrammen', async () => {
    h.raeumeLaden = true;
    h.standort = { pathname: '/konfi/chat', search: '', state: null };
    render(<ChatOverviewPage />);
    expect(await screen.findByText('Chats werden geladen')).toBeInTheDocument();
    expect(within(liste()).queryAllByRole('link')).toEqual([]);
  });

  it('meldet sich jemand anderes im selben Fenster an, beginnt alles von vorn -- die Raeume der Vorgaengerin sind nicht seine', async () => {
    const erste = await zeigenListe();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chats durchsuchen' }), { target: { value: 'team' } });
    erste.unmount();

    h.user = { id: 99, type: 'konfi', role_name: 'konfi', display_name: 'Jemand Anderes' };
    h.raeumeLaden = true;
    render(<ChatOverviewPage />);
    expect(await screen.findByText('Chats werden geladen')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Chats durchsuchen' })).toHaveValue('');
    expect(within(liste()).queryAllByRole('link')).toEqual([]);
  });
});

describe('Chat: App und schmales Fenster bleiben, wie sie sind', () => {
  it('ohne breites Layout zeichnen beide Seiten die App-Fassung -- keine Liste daneben, nichts von der Web-Fassung', async () => {
    h.breit = false;
    const uebersicht = render(<ChatOverviewPage />);
    expect(screen.getByTestId('app-uebersicht')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Chats' })).not.toBeInTheDocument();
    uebersicht.unmount();

    render(<ChatRoomView roomId={2} onBack={vi.fn()} />);
    expect(await screen.findByTestId('app-raum')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Chats' })).not.toBeInTheDocument();
    expect(document.querySelector('.web-chat')).toBeNull();
  });

  it('wird das Fenster breit, wechselt dieselbe Seite zur Web-Fassung -- und zurueck', async () => {
    h.breit = false;
    const { rerender } = render(<ChatOverviewPage />);
    expect(screen.getByTestId('app-uebersicht')).toBeInTheDocument();
    h.breit = true;
    rerender(<ChatOverviewPage />);
    expect(await screen.findByRole('complementary', { name: 'Chats' })).toBeInTheDocument();
    expect(screen.queryByTestId('app-uebersicht')).not.toBeInTheDocument();
    h.breit = false;
    rerender(<ChatOverviewPage />);
    expect(screen.getByTestId('app-uebersicht')).toBeInTheDocument();
  });
});
