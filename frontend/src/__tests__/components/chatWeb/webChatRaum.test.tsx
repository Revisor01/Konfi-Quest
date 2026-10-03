// Der geoeffnete Raum in der Web-Fassung des Chats, gerendert
// (components/chat/web/WebChatRaum.tsx, Entscheidung 6 in
// docs/planung/web-alle-bereiche.md): Kopf mit Name und Mitgliedern, Verlauf
// mit Tages-Trennern, eigenen und fremden Blasen, Umfragen, Reaktionen und
// Antworten, unten die Eingabe -- Enter sendet, Umschalt+Enter bringt eine neue
// Zeile.
//
// Gerendert wird der echte Raum mit den echten Hooks (useChatRaum,
// useChatSocket, useChatScroll, useUmfragenUndReaktionen, useChatVerwaltung).
// Ersetzt sind Netz, Socket, Warteschlange, Kontexte, die Ionic-Bausteine, die
// Dateiauswahl und die Bild-/Video-Vorschau.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, useState } from 'react';
import { render, screen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import type { ChatRoomBase, ChatRoomOverview, Message } from '../../../types/chat';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  badgeGelesen: vi.fn(async (_raum: number) => undefined),
  zaehlerHolen: vi.fn(async () => undefined),
  alert: vi.fn(),
  modal: vi.fn(),
  user: { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex Beispiel' } as Record<string, unknown>,
  online: true,
  verwerfen: vi.fn(async () => undefined),
  dateiUebernehmen: vi.fn(async (_datei: File) => undefined),
  entfernen: vi.fn(),
  exportieren: vi.fn(),
  datei: null as File | null,
  fehlgeschlagene: [] as unknown[],
}));

vi.mock('@ionic/react', async () => (await import('./webChatAttrappe')).ionicAttrappe({
  presentAlert: (o) => h.alert(o),
  presentModal: (komponente, props) => (opts) => h.modal({ komponente, props, opts }),
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markRoomAsRead: h.badgeGelesen, refreshAllCounts: h.zaehlerHolen, chatUnreadByRoom: {} }),
}));
vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown, c?: unknown) => h.apiPost(u, b, c), delete: (u: string) => h.apiDelete(u) },
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (_key: string, laden: () => Promise<Message[]>) => {
    const [data, setData] = useState<Message[] | null>(null);
    useEffect(() => { void laden().then(setData); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return { data, loading: data === null, refresh: vi.fn() };
  },
}));
vi.mock('../../../services/offlineCache', () => ({ CACHE_TTL: { CHAT_MESSAGES: 1, CHAT_ROOMS: 1 } }));
vi.mock('../../../services/writeQueue', () => ({
  writeQueue: {
    getByMetadata: vi.fn(async () => []),
    getFailedChat: vi.fn(async () => h.fehlgeschlagene),
    forgetFailedChatMany: vi.fn(),
    forgetFailedChat: vi.fn(),
    flush: vi.fn(),
    enqueue: vi.fn(async () => undefined),
    chatAblehnungMerken: vi.fn(async () => undefined),
  },
  onItemFailed: () => () => {},
}));
vi.mock('../../../components/chat/chatOutbox', async (original) => ({
  ...(await original<typeof import('../../../components/chat/chatOutbox')>()),
  wartendeNachrichtAufraeumen: (...args: unknown[]) => h.verwerfen(...(args as [])),
  nachrichtNeuEinreihen: vi.fn(async () => true),
  chatNachrichtEinreihen: vi.fn(async () => undefined),
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
vi.mock('../../../components/chat/chatTeilen', () => ({
  nachrichtTeilen: vi.fn(),
  chatVerlaufExportieren: (...args: unknown[]) => h.exportieren(...args),
}));
vi.mock('../../../components/chat/useChatDateien', () => ({
  useChatDateien: () => ({
    selectedFile: h.datei,
    selectedFilePreview: null,
    dateiWaehlen: vi.fn(),
    dateiUebernehmen: (d: File) => h.dateiUebernehmen(d),
    clearSelectedFile: () => h.entfernen(),
    handleFileClick: vi.fn(),
    ladendeDatei: null,
  }),
}));
vi.mock('../../../components/chat/LazyImage', () => ({ default: ({ fileName }: { fileName: string }) => <img alt={fileName} /> }));
vi.mock('../../../components/chat/VideoPreview', () => ({ default: ({ fileName }: { fileName: string }) => <div>Video {fileName}</div> }));
vi.mock('../../../components/chat/modals/PollModal', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/MembersModal', () => ({ default: () => null }));

import { socketNachbau } from './webChatAttrappe';
import WebChatRaum from '../../../components/chat/web/WebChatRaum';
import MembersModal from '../../../components/chat/modals/MembersModal';
import { entwuerfeZuruecksetzen } from '../../../components/chat/web/chatEntwuerfe';
import { gezeigteTrennerAnkerLeeren } from '../../../components/chat/chatVerlauf';

// --- Daten -------------------------------------------------------------------------
const RAUM: ChatRoomBase = { id: 7, name: 'Jahrgang 2026/27', type: 'jahrgang' };
const GRUPPE: ChatRoomBase = { id: 8, name: 'Freizeit', type: 'group' };
const DIREKT: ChatRoomBase = {
  id: 9, name: 'direkt-4-8', type: 'direct',
  participants: [{ user_id: 4, user_type: 'admin', name: 'Alex Beispiel' }, { user_id: 8, user_type: 'teamer', name: 'Tom Teamer' }],
};
const LISTENZEILE = (zusatz: Partial<ChatRoomOverview> = {}): ChatRoomOverview => ({ ...RAUM, unread_count: 0, participant_count: 38, ...zusatz });

let nextId = 100;
const m = (zusatz: Partial<Message> = {}): Message => ({
  id: nextId++, content: 'Hallo', sender_id: 21, sender_name: 'Lena Probe', sender_type: 'konfi',
  created_at: '2026-10-03T08:00:00.000Z', message_type: 'text', ...zusatz,
});
const IM_RAUM = (nachrichten: Message[]) => {
  h.apiGet.mockImplementation(async (url: string) => {
    if (url.includes('/messages')) return { data: nachrichten };
    throw new Error(`unerwartet: ${url}`);
  });
};

const zeigen = async (raum: ChatRoomBase = RAUM, extra: { listenRaum?: ChatRoomOverview; onSchliessen?: () => void; onRaumLoeschen?: () => void; onVerlaufGeaendert?: () => void } = {}) => {
  const onSchliessen = extra.onSchliessen ?? vi.fn();
  const ergebnis = render(
    <WebChatRaum room={raum} listenRaum={extra.listenRaum} onSchliessen={onSchliessen} onRaumLoeschen={extra.onRaumLoeschen} onVerlaufGeaendert={extra.onVerlaufGeaendert} />,
  );
  // Der Verlauf ist da, sobald der Cache-Abruf zurueck ist.
  await waitFor(() => expect(h.apiGet).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  return { ...ergebnis, onSchliessen };
};

const feld = () => screen.getByRole('textbox', { name: 'Nachricht schreiben' }) as HTMLTextAreaElement;
const tippen = (text: string) => fireEvent.change(feld(), { target: { value: text } });
const blase = (text: string) => screen.getByText(text).closest('.web-chat-nachricht') as HTMLElement;
const gesendet = () => h.apiPost.mock.calls.filter(([url]) => /\/messages$/.test(url as string));

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex Beispiel' };
  h.online = true;
  h.datei = null;
  h.fehlgeschlagene = [];
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
  socketNachbau.handler.clear();
  socketNachbau.connected = true;
  entwuerfeZuruecksetzen();
  gezeigteTrennerAnkerLeeren();
  nextId = 100;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Raum (Web): Kopf', () => {
  it('Name, Art und Mitglieder aus der Raumliste -- "Jahrgang · Kim, Sam, Robin und 34 weitere"', async () => {
    IM_RAUM([m()]);
    const mitglieder = ['Alex Beispiel', 'Kim', 'Sam', 'Robin', 'Jules'].map((name, i) => ({ user_id: 4 + i, user_type: 'konfi' as const, name }));
    await zeigen({ ...RAUM, participants: mitglieder }, { listenRaum: LISTENZEILE({ participant_count: 38 }) });
    expect(screen.getByRole('heading', { name: 'Jahrgang 2026/27' })).toBeInTheDocument();
    expect(screen.getByText('Jahrgang · Kim, Sam, Robin und 34 weitere')).toBeInTheDocument();
  });

  it('Direktchat: der Name der anderen Person, die Art "Team · Direkt" und kein Mitglieder-Knopf', async () => {
    IM_RAUM([m({ sender_id: 8, sender_name: 'Tom Teamer', sender_type: 'teamer' })]);
    await zeigen(DIREKT, { listenRaum: { ...DIREKT, unread_count: 0, partner_user_type: 'teamer' } as ChatRoomOverview });
    expect(screen.getByRole('heading', { name: 'Tom Teamer' })).toBeInTheDocument();
    expect(screen.getByText('Team · Direkt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mitglieder anzeigen' })).not.toBeInTheDocument();
  });

  it('Mitglieder anzeigen oeffnet das Fenster dieses Raums, als breiten Dialog (web-chat-modal) und ohne Kartenform', async () => {
    IM_RAUM([m()]);
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder anzeigen' }));
    expect(h.modal).toHaveBeenCalledTimes(1);
    const { komponente, props, opts } = h.modal.mock.calls[0][0];
    expect(komponente).toBe(MembersModal);
    expect(props).toMatchObject({ roomId: 7, roomType: 'jahrgang' });
    expect(opts).toEqual({ presentingElement: undefined, cssClass: 'web-chat-modal' });
  });

  it('Umfragen anlegen kann nur die Leitung', async () => {
    IM_RAUM([m()]);
    await zeigen();
    expect(screen.getByRole('button', { name: 'Umfrage erstellen' })).toBeInTheDocument();
    cleanup();
    h.user = { id: 5, type: 'konfi', role_name: 'konfi', display_name: 'Mika Beispiel' };
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Umfrage erstellen' })).not.toBeInTheDocument();
  });
});

describe('Raum (Web): Verlauf', () => {
  it('Tages-Trenner (Heute, Gestern, Datum) und der Anfang des Chats, wenn der Server alles geliefert hat', async () => {
    IM_RAUM([
      m({ content: 'Alt', created_at: '2026-09-30T09:00:00Z' }),
      m({ content: 'Gestern geschrieben', created_at: '2026-10-02T09:00:00Z' }),
      m({ content: 'Heute geschrieben', created_at: '2026-10-03T09:00:00Z' }),
    ]);
    await zeigen();
    const gruppen = screen.getAllByRole('group').filter((g) => g.classList.contains('web-chat-tagesgruppe'));
    expect(gruppen.map((g) => g.getAttribute('aria-label'))).toEqual(['30.09.2026', 'Gestern', 'Heute']);
    expect(within(gruppen[2]).getByText('Heute geschrieben')).toBeInTheDocument();
    expect(screen.getByText('Anfang des Chats')).toBeInTheDocument();
  });

  it('eigene Nachrichten rechts ohne Namen, fremde mit Kreis und Namen -- im Direktchat ohne beides', async () => {
    IM_RAUM([m({ content: 'Von Lena' }), m({ content: 'Von mir', sender_id: 4, sender_type: 'admin', sender_name: 'Alex Beispiel' })]);
    await zeigen();
    expect(blase('Von mir')).toHaveClass('web-chat-nachricht--eigene');
    expect(blase('Von Lena')).toHaveClass('web-chat-nachricht--fremde');
    expect(within(blase('Von Lena')).getByText('Lena Probe')).toBeInTheDocument();
    expect(blase('Von Lena').querySelector('.web-chat-avatar')).toHaveTextContent('L');
    expect(within(blase('Von mir')).queryByText('Alex Beispiel')).not.toBeInTheDocument();
    cleanup();
    IM_RAUM([m({ content: 'Im Direktchat', sender_id: 8, sender_name: 'Tom Teamer', sender_type: 'teamer' })]);
    await zeigen(DIREKT);
    expect(within(blase('Im Direktchat')).queryByText('Tom Teamer')).not.toBeInTheDocument();
    expect(blase('Im Direktchat').querySelector('.web-chat-avatar')).toBeNull();
  });

  it('wer innerhalb von fuenf Minuten weiterschreibt, steht nur einmal mit Namen da', async () => {
    IM_RAUM([
      m({ content: 'Erste', created_at: '2026-10-03T08:00:00Z' }),
      m({ content: 'Zweite', created_at: '2026-10-03T08:02:00Z' }),
      m({ content: 'Dritte', created_at: '2026-10-03T08:30:00Z' }),
    ]);
    await zeigen();
    expect(within(blase('Erste')).getByText('Lena Probe')).toBeInTheDocument();
    expect(within(blase('Zweite')).queryByText('Lena Probe')).not.toBeInTheDocument();
    expect(blase('Zweite')).toHaveClass('web-chat-nachricht--fortsetzung');
    expect(within(blase('Dritte')).getByText('Lena Probe')).toBeInTheDocument();
  });

  it('Links im Text sind Links, eine geloeschte Nachricht zeigt den Platzhalter', async () => {
    IM_RAUM([m({ content: 'Infos unter https://example.org/konfi-tag' }), m({ content: 'weg', deleted: true })]);
    await zeigen();
    expect(screen.getByRole('link', { name: 'https://example.org/konfi-tag' })).toHaveAttribute('href', 'https://example.org/konfi-tag');
    expect(screen.getByText('Diese Nachricht wurde gelöscht')).toBeInTheDocument();
    expect(screen.queryByText('weg')).not.toBeInTheDocument();
  });

  it('Bild, Video und Datei: Bild mit Dateiname und Groesse, Datei als Knopf', async () => {
    IM_RAUM([
      m({ message_type: 'image', content: 'Der See', file_path: 'a', file_name: 'see.png', file_size: 184320 }),
      m({ message_type: 'file', content: '', file_path: 'b', file_name: 'Ablauf.pdf', file_size: 482211 }),
      m({ message_type: 'video', content: '', file_path: 'c', file_name: 'clip.mp4' }),
    ]);
    await zeigen();
    expect(screen.getByRole('img', { name: 'see.png' })).toBeInTheDocument();
    expect(screen.getByText(/see\.png\s•\s180 KB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Datei öffnen: Ablauf.pdf' })).toHaveTextContent('470.91 KB');
    expect(screen.getByText('Video clip.mp4')).toBeInTheDocument();
  });

  it('eine Antwort zeigt den Bezug mit Name und Text -- bei einem Bild den Dateinamen', async () => {
    IM_RAUM([m({ content: 'Ja, klar', reply_to_id: 1, reply_to_sender_name: 'Jules Demo', reply_to_content: 'Gibt es einen Steg?', reply_to_message_type: 'text' }),
      m({ content: 'Schoen', reply_to_id: 2, reply_to_sender_name: 'Kim', reply_to_message_type: 'image', reply_to_file_name: 'see.png' })]);
    await zeigen();
    const bezuege = screen.getAllByRole('button', { name: 'Zur beantworteten Nachricht springen' });
    expect(bezuege[0]).toHaveTextContent('Jules DemoGibt es einen Steg?');
    expect(bezuege[1]).toHaveTextContent('Kimsee.png');
  });

  it('ein leerer Raum sagt es, solange er geladen ist -- davor nicht', async () => {
    IM_RAUM([]);
    await zeigen();
    expect(screen.getByText('Noch keine Nachrichten. Schreib die erste!')).toBeInTheDocument();
  });

  it('live: eine neue Nachricht dieses Raums erscheint, die eines anderen nicht', async () => {
    IM_RAUM([m({ content: 'Vorhanden' })]);
    await zeigen();
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 900, content: 'Frisch eingetroffen' }) }); });
    expect(screen.getByText('Frisch eingetroffen')).toBeInTheDocument();
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 99, message: m({ id: 901, content: 'Aus einem anderen Raum' }) }); });
    expect(screen.queryByText('Aus einem anderen Raum')).not.toBeInTheDocument();
  });
});

describe('Raum (Web): die Raumliste folgt dem Verlauf', () => {
  it('eine neue Nachricht (eigene bestaetigt oder fremde) meldet es der Liste -- das erste Laden und ein doppeltes Ereignis nicht', async () => {
    IM_RAUM([m({ id: 700, content: 'Schon da' })]);
    const geaendert = vi.fn();
    await zeigen(RAUM, { onVerlaufGeaendert: geaendert });
    expect(geaendert).not.toHaveBeenCalled();
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 701, content: 'Neu' }) }); });
    expect(geaendert).toHaveBeenCalledTimes(1);
    // Dieselbe Nachricht noch einmal (Socket und Nachladen): nichts Neues.
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 701, content: 'Neu' }) }); });
    expect(geaendert).toHaveBeenCalledTimes(1);
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 702, content: 'Noch eine' }) }); });
    expect(geaendert).toHaveBeenCalledTimes(2);
  });

  it('eine Nachricht, die noch nicht beim Server ist (wird gesendet), aendert die Vorschau nicht; ein leerer Raum, der die erste bekommt, schon', async () => {
    IM_RAUM([]);
    const geaendert = vi.fn();
    await zeigen(RAUM, { onVerlaufGeaendert: geaendert });
    tippen('Erste Nachricht');
    fireEvent.keyDown(feld(), { key: 'Enter' });
    await waitFor(() => expect(gesendet()).toHaveLength(1));
    expect(geaendert).not.toHaveBeenCalled();
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 710, content: 'Erste Nachricht', client_id: (gesendet()[0][1] as FormData).get('client_id') as string }) }); });
    expect(geaendert).toHaveBeenCalledTimes(1);
  });
});

describe('Raum (Web): Eingabe -- Enter sendet, Umschalt+Enter bringt eine neue Zeile', () => {
  beforeEach(() => IM_RAUM([m()]));

  it('Enter sendet den Text als Nachricht dieses Raums und leert das Feld', async () => {
    await zeigen();
    tippen('Bis Samstag!');
    fireEvent.keyDown(feld(), { key: 'Enter' });
    await waitFor(() => expect(gesendet()).toHaveLength(1));
    const [url, body] = gesendet()[0] as [string, FormData];
    expect(url).toBe('/chat/rooms/7/messages');
    expect(body.get('content')).toBe('Bis Samstag!');
    expect(body.get('client_id')).toBeTruthy();
    expect(feld()).toHaveValue('');
    // Die Nachricht steht sofort im Verlauf (optimistisch), bis die Bestaetigung kommt.
    expect(blase('Bis Samstag!')).toHaveClass('web-chat-nachricht--wartet');
  });

  it('Umschalt+Enter sendet nicht -- der Browser setzt die neue Zeile, der Text bleibt', async () => {
    await zeigen();
    tippen('Erste Zeile\nZweite Zeile');
    const ereignis = fireEvent.keyDown(feld(), { key: 'Enter', shiftKey: true });
    // true: das Ereignis wurde nicht verhindert, der Browser fuegt die Zeile ein.
    expect(ereignis).toBe(true);
    expect(gesendet()).toEqual([]);
    expect(feld()).toHaveValue('Erste Zeile\nZweite Zeile');
  });

  it('Enter verhindert die neue Zeile, bei Umschalt+Enter ist sie erlaubt', async () => {
    await zeigen();
    tippen('Text');
    expect(fireEvent.keyDown(feld(), { key: 'Enter' })).toBe(false);
  });

  it('waehrend einer IME-Komposition bestaetigt Enter nur die Zeichenwahl', async () => {
    await zeigen();
    tippen('にほん');
    fireEvent.keyDown(feld(), { key: 'Enter', isComposing: true });
    expect(gesendet()).toEqual([]);
    expect(feld()).toHaveValue('にほん');
  });

  it('ein leeres oder nur aus Leerzeichen bestehendes Feld sendet nichts; der Knopf ist gesperrt', async () => {
    await zeigen();
    const senden = screen.getByRole('button', { name: 'Nachricht senden' });
    expect(senden).toBeDisabled();
    fireEvent.keyDown(feld(), { key: 'Enter' });
    tippen('   ');
    fireEvent.keyDown(feld(), { key: 'Enter' });
    expect(gesendet()).toEqual([]);
    expect(senden).toBeDisabled();
    tippen('Hallo');
    expect(senden).toBeEnabled();
  });

  it('der Senden-Knopf sendet wie Enter', async () => {
    await zeigen();
    tippen('Per Knopf');
    fireEvent.click(screen.getByRole('button', { name: 'Nachricht senden' }));
    await waitFor(() => expect(gesendet()).toHaveLength(1));
    expect((gesendet()[0][1] as FormData).get('content')).toBe('Per Knopf');
  });

  it('der Hinweis unter dem Feld nennt beide Tasten und gehoert zum Feld', async () => {
    await zeigen();
    const hinweis = screen.getByText('Enter sendet · Umschalt+Enter für eine neue Zeile');
    expect(feld().getAttribute('aria-describedby')).toBe(hinweis.id);
  });

  it('Antworten setzt den Bezug ueber dem Feld, fokussiert es und schickt reply_to mit', async () => {
    await zeigen();
    fireEvent.click(within(blase('Hallo')).getByRole('button', { name: 'Antworten' }));
    expect(screen.getByText('Antwort an Lena Probe')).toBeInTheDocument();
    expect(document.activeElement).toBe(feld());
    tippen('Danke!');
    fireEvent.keyDown(feld(), { key: 'Enter' });
    await waitFor(() => expect(gesendet()).toHaveLength(1));
    expect((gesendet()[0][1] as FormData).get('reply_to')).toBe('100');
    expect(screen.queryByText('Antwort an Lena Probe')).not.toBeInTheDocument();
  });

  it('die Antwort laesst sich verwerfen', async () => {
    await zeigen();
    fireEvent.click(within(blase('Hallo')).getByRole('button', { name: 'Antworten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Antwort verwerfen' }));
    expect(screen.queryByText('Antwort an Lena Probe')).not.toBeInTheDocument();
  });

  it('eine gewaehlte Datei steht als Streifen da, laesst sich entfernen und reicht zum Senden allein', async () => {
    h.datei = new File(['x'.repeat(2048)], 'Plan.pdf', { type: 'application/pdf' });
    await zeigen();
    expect(screen.getByText('Plan.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nachricht senden' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Datei entfernen' }));
    expect(h.entfernen).toHaveBeenCalledTimes(1);
  });

  it('eine Datei per Ziehen auf den Raum: Hinweis beim Ueberfahren, beim Ablegen wird sie uebernommen', async () => {
    await zeigen();
    const raum = screen.getByRole('region', { name: 'Chat Jahrgang 2026/27' });
    const datei = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.dragEnter(raum, { dataTransfer: { types: ['Files'], files: [datei] } });
    expect(screen.getByText('Datei hier ablegen, um sie anzuhängen')).toBeInTheDocument();
    fireEvent.drop(raum, { dataTransfer: { types: ['Files'], files: [datei] } });
    expect(h.dateiUebernehmen).toHaveBeenCalledWith(datei);
    expect(screen.queryByText('Datei hier ablegen, um sie anzuhängen')).not.toBeInTheDocument();
  });

  it('Text, der gezogen wird (keine Datei), loest nichts aus', async () => {
    await zeigen();
    const raum = screen.getByRole('region', { name: 'Chat Jahrgang 2026/27' });
    fireEvent.dragEnter(raum, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByText('Datei hier ablegen, um sie anzuhängen')).not.toBeInTheDocument();
    fireEvent.drop(raum, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(h.dateiUebernehmen).not.toHaveBeenCalled();
  });

  it('ein eingefuegtes Bild (Strg+V) wird als Anhang uebernommen, eingefuegter Text bleibt Text', async () => {
    await zeigen();
    const bild = new File(['x'], 'screenshot.png', { type: 'image/png' });
    const mitDatei = fireEvent.paste(feld(), { clipboardData: { files: [bild], getData: () => '' } });
    expect(mitDatei).toBe(false);
    expect(h.dateiUebernehmen).toHaveBeenCalledWith(bild);
    h.dateiUebernehmen.mockClear();
    expect(fireEvent.paste(feld(), { clipboardData: { files: [], getData: () => 'Text' } })).toBe(true);
    expect(h.dateiUebernehmen).not.toHaveBeenCalled();
  });
});

describe('Raum (Web): Entwurf', () => {
  beforeEach(() => IM_RAUM([m()]));

  it('ein halber Satz bleibt stehen, wenn man in einen anderen Raum wechselt und zurueckkommt', async () => {
    const erster = await zeigen();
    tippen('Das schreibe ich spaeter zu Ende');
    erster.unmount();
    IM_RAUM([m()]);
    await zeigen(GRUPPE);
    expect(feld()).toHaveValue('');
    cleanup();
    IM_RAUM([m()]);
    await zeigen(RAUM);
    expect(feld()).toHaveValue('Das schreibe ich spaeter zu Ende');
  });

  it('nach dem Senden ist der Entwurf weg', async () => {
    const erster = await zeigen();
    tippen('Gesendet');
    fireEvent.keyDown(feld(), { key: 'Enter' });
    await waitFor(() => expect(gesendet()).toHaveLength(1));
    erster.unmount();
    IM_RAUM([m()]);
    await zeigen();
    expect(feld()).toHaveValue('');
  });
});

describe('Raum (Web): Gelesen nur, wo der Raum offen ist und die Seite sichtbar', () => {
  beforeEach(() => IM_RAUM([m()]));
  const sichtbarkeit = (wert: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => wert });
  };
  afterEach(() => { Reflect.deleteProperty(document, 'visibilityState'); });

  it('beim Oeffnen wird genau dieser Raum als gelesen gemeldet, danach werden die Zahlen geholt', async () => {
    await zeigen();
    await waitFor(() => expect(h.badgeGelesen).toHaveBeenCalled());
    expect(new Set(h.badgeGelesen.mock.calls.map(([id]) => id))).toEqual(new Set([7]));
    expect(h.zaehlerHolen).toHaveBeenCalled();
  });

  it('steht der Tab im Hintergrund, bleibt der Raum ungelesen -- bis man ihn wieder ansieht', async () => {
    sichtbarkeit('hidden');
    await zeigen();
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 910, content: 'Im Hintergrund' }) }); });
    expect(h.badgeGelesen).not.toHaveBeenCalled();

    sichtbarkeit('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(h.badgeGelesen).toHaveBeenCalledTimes(1));
    expect(h.badgeGelesen).toHaveBeenCalledWith(7);
    // Ein zweiter Wechsel meldet nichts nach, es gibt nichts Ausstehendes mehr.
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(h.badgeGelesen).toHaveBeenCalledTimes(1);
  });

  it('beim Verlassen des Raums meldet nichts mehr gelesen (der Raum hoert nicht mehr zu)', async () => {
    const raum = await zeigen();
    await waitFor(() => expect(h.badgeGelesen).toHaveBeenCalled());
    raum.unmount();
    h.badgeGelesen.mockClear();
    act(() => { socketNachbau.ausloesen('newMessage', { roomId: 7, message: m({ id: 920, content: 'Nach dem Schliessen' }) }); });
    expect(h.badgeGelesen).not.toHaveBeenCalled();
  });
});

describe('Raum (Web): Umfragen und Reaktionen', () => {
  const umfrage = (zusatz: Partial<Message> = {}) => m({
    id: 300, message_type: 'poll', content: '', question: 'Welcher Termin?', options: ['Dienstag', 'Donnerstag'],
    votes: [{ user_id: 21, user_type: 'konfi', option_index: 0, user_name: 'Lena' }], anonymous: false,
    multiple_choice: false, exclusive_options: false, expires_at: '2026-10-04T12:00:00Z', ...zusatz,
  });

  it('die Umfrage zeigt Frage, Ende, Stimmen mit Anteil, Namen und die Art', async () => {
    IM_RAUM([umfrage()]);
    await zeigen();
    const gruppe = screen.getByRole('group', { name: 'Umfrage: Welcher Termin?' });
    expect(within(gruppe).getByText('Endet: 04.10., 14:00')).toBeInTheDocument();
    const dienstag = within(gruppe).getByRole('button', { name: /Dienstag/ });
    expect(dienstag).toHaveTextContent('1 (100%)');
    expect(dienstag).toHaveTextContent('Lena');
    expect(within(gruppe).getByRole('button', { name: /Donnerstag/ })).toHaveTextContent('0 (0%)');
    expect(within(gruppe).getByText('Einzelauswahl · mit Namen')).toBeInTheDocument();
    expect(within(gruppe).getByText('1 Stimme')).toBeInTheDocument();
  });

  it('eine Antwort anklicken stimmt ab (POST an die Umfrage dieser Nachricht)', async () => {
    IM_RAUM([umfrage()]);
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: /Donnerstag/ }));
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/chat/polls/300/vote', { option_index: 1 }, undefined));
  });

  it('die eigene Wahl ist markiert; bei einer Exklusiv-Wahl sind vergebene Antworten gesperrt und sendet der Klick nichts', async () => {
    IM_RAUM([umfrage({ exclusive_options: true, votes: [{ user_id: 21, user_type: 'konfi', option_index: 0, user_name: 'Lena' }] })]);
    await zeigen();
    const vergeben = screen.getByRole('button', { name: /Dienstag/ });
    expect(vergeben).toHaveAttribute('aria-disabled', 'true');
    expect(vergeben).toHaveTextContent('Vergeben');
    expect(screen.getByRole('button', { name: /Donnerstag/ })).toHaveTextContent('Frei');
    fireEvent.click(vergeben);
    expect(h.apiPost).not.toHaveBeenCalled();
    cleanup();

    IM_RAUM([umfrage({ votes: [{ user_id: 4, user_type: 'admin', option_index: 1, user_name: 'Alex' }] })]);
    await zeigen();
    expect(screen.getByRole('button', { name: /Donnerstag/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Dienstag/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('eine abgelaufene Umfrage nennt es', async () => {
    IM_RAUM([umfrage({ expires_at: '2026-10-02T12:00:00Z' })]);
    await zeigen();
    expect(screen.getByText('Beendet')).toBeInTheDocument();
  });

  it('Reagieren oeffnet den Picker mit sechs Reaktionen; eine zu waehlen sendet sie an diese Nachricht', async () => {
    IM_RAUM([m({ id: 400, content: 'Gute Nachricht' })]);
    h.apiPost.mockResolvedValue({ data: { action: 'added', id: 77 } });
    await zeigen();
    fireEvent.click(within(blase('Gute Nachricht')).getByRole('button', { name: 'Reagieren' }));
    const picker = screen.getByRole('group', { name: 'Reaktion wählen' });
    expect(within(picker).getAllByRole('button')).toHaveLength(6);
    fireEvent.click(within(picker).getByRole('button', { name: 'Mit „Liebe“ reagieren' }));
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/chat/messages/400/reactions', { emoji: 'heart' }, undefined));
    // Der Picker schliesst, die Reaktion steht unter der Blase.
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Reaktion wählen' })).not.toBeInTheDocument());
    expect(within(blase('Gute Nachricht')).getByRole('button', { name: 'Liebe: 1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Escape schliesst den Picker, ein Klick neben ihn auch', async () => {
    IM_RAUM([m({ id: 401, content: 'Noch eine' })]);
    await zeigen();
    fireEvent.click(within(blase('Noch eine')).getByRole('button', { name: 'Reagieren' }));
    fireEvent.keyDown(screen.getByRole('group', { name: 'Reaktion wählen' }), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Reaktion wählen' })).not.toBeInTheDocument();
    fireEvent.click(within(blase('Noch eine')).getByRole('button', { name: 'Reagieren' }));
    fireEvent.click(screen.getByTestId('verlauf'));
    expect(screen.queryByRole('group', { name: 'Reaktion wählen' })).not.toBeInTheDocument();
  });

  it('eine vorhandene Reaktion anklicken nimmt die eigene zurueck; ihr Name nennt, wer sie gesetzt hat', async () => {
    IM_RAUM([m({ id: 402, content: 'Mit Reaktion', reactions: [
      { id: 1, emoji: 'like', user_id: 4, user_type: 'admin', user_name: 'Alex Beispiel' },
      { id: 2, emoji: 'like', user_id: 21, user_type: 'konfi', user_name: 'Lena Probe' },
    ] })]);
    h.apiPost.mockResolvedValue({ data: { action: 'removed' } });
    await zeigen();
    const chip = within(blase('Mit Reaktion')).getByRole('button', { name: 'Gefällt mir: 2' });
    expect(chip).toHaveAttribute('title', 'Alex Beispiel, Lena Probe');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip);
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/chat/messages/402/reactions', { emoji: 'like' }, undefined));
    await waitFor(() => expect(within(blase('Mit Reaktion')).getByRole('button', { name: 'Gefällt mir: 1' })).toHaveAttribute('aria-pressed', 'false'));
  });

  it('eine noch nicht gesendete Nachricht hat keine Aktionsleiste (sie kennt der Server noch nicht)', async () => {
    h.fehlgeschlagene = [];
    IM_RAUM([m({ id: -5, content: 'Unterwegs', queueStatus: 'pending', localId: 'c-1', clientId: 'c-1', sender_id: 4, sender_type: 'admin' })]);
    await zeigen();
    expect(within(blase('Unterwegs')).queryByRole('toolbar')).not.toBeInTheDocument();
    expect(within(blase('Unterwegs')).getByLabelText('Wird gesendet')).toBeInTheDocument();
  });
});

describe('Raum (Web): Loeschen, Kopieren, Teilen', () => {
  const fremde = () => m({ id: 500, content: 'Fremde Nachricht' });
  const eigene = (typ: 'teamer' | 'admin' | 'konfi', id: number) => m({ id: 501, content: 'Meine Nachricht', sender_id: id, sender_type: typ, sender_name: 'Ich' });

  it('die Leitung loescht jede Nachricht, Teamer:innen nur ihre eigenen, Konfis keine', async () => {
    h.user = { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex' };
    IM_RAUM([fremde(), eigene('admin', 4)]);
    await zeigen();
    expect(within(blase('Fremde Nachricht')).getByRole('button', { name: 'Nachricht löschen' })).toBeInTheDocument();
    expect(within(blase('Meine Nachricht')).getByRole('button', { name: 'Nachricht löschen' })).toBeInTheDocument();
    cleanup();

    h.user = { id: 8, type: 'teamer', role_name: 'teamer', display_name: 'Tom' };
    IM_RAUM([fremde(), eigene('teamer', 8)]);
    await zeigen();
    expect(within(blase('Fremde Nachricht')).queryByRole('button', { name: 'Nachricht löschen' })).not.toBeInTheDocument();
    expect(within(blase('Meine Nachricht')).getByRole('button', { name: 'Nachricht löschen' })).toBeInTheDocument();
    cleanup();

    h.user = { id: 5, type: 'konfi', role_name: 'konfi', display_name: 'Mika' };
    IM_RAUM([fremde(), eigene('konfi', 5)]);
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Nachricht löschen' })).not.toBeInTheDocument();
  });

  it('Loeschen fragt zurueck; erst "Loeschen" ruft den Server und zeigt den Platzhalter', async () => {
    IM_RAUM([fremde()]);
    await zeigen();
    fireEvent.click(within(blase('Fremde Nachricht')).getByRole('button', { name: 'Nachricht löschen' }));
    expect(h.alert).toHaveBeenCalledTimes(1);
    expect(h.alert.mock.calls[0][0]).toMatchObject({ header: 'Nachricht löschen?' });
    expect(h.apiDelete).not.toHaveBeenCalled();
    const knoepfe = h.alert.mock.calls[0][0].buttons as Array<{ text: string; handler?: () => void }>;
    expect(knoepfe.map((k) => k.text)).toEqual(['Abbrechen', 'Löschen']);
    // Nach dem Loeschen liefert der Server die Nachricht als geloescht.
    h.apiDelete.mockImplementation(async () => {
      IM_RAUM([{ ...fremde(), is_deleted: 1, content: 'Diese Nachricht wurde gelöscht' }]);
      return { data: {} };
    });
    await act(async () => { knoepfe[1].handler?.(); await Promise.resolve(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/chat/messages/500');
    await waitFor(() => expect(screen.getByText('Diese Nachricht wurde gelöscht')).toBeInTheDocument());
    expect(screen.queryByText('Fremde Nachricht')).not.toBeInTheDocument();
    expect(within(blase('Diese Nachricht wurde gelöscht')).queryByRole('toolbar')).toBeInTheDocument();
  });

  it('Text kopieren legt den Text in die Zwischenablage und meldet es', async () => {
    const schreiben = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: schreiben } });
    IM_RAUM([fremde()]);
    await zeigen();
    fireEvent.click(within(blase('Fremde Nachricht')).getByRole('button', { name: 'Text kopieren' }));
    expect(schreiben).toHaveBeenCalledWith('Fremde Nachricht');
    await waitFor(() => expect(h.setSuccess).toHaveBeenCalledWith('Text kopiert'));
    // Eine Umfrage hat keinen Text zum Kopieren.
    cleanup();
    IM_RAUM([m({ id: 502, message_type: 'poll', content: '', question: 'F?', options: ['a', 'b'], votes: [] })]);
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Text kopieren' })).not.toBeInTheDocument();
  });

  it('Teilen gibt es nur, wo der Browser es kann', async () => {
    IM_RAUM([fremde()]);
    Reflect.deleteProperty(navigator, 'share');
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Teilen' })).not.toBeInTheDocument();
    cleanup();
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
    try {
      IM_RAUM([fremde()]);
      await zeigen();
      expect(within(blase('Fremde Nachricht')).getByRole('button', { name: 'Teilen' })).toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(navigator, 'share');
    }
  });
});

describe('Raum (Web): Nachrichten, die nicht ankamen', () => {
  const fehl = (zusatz: Record<string, unknown> = {}) => ({ clientId: 'c-fehl', roomId: 7, content: 'Nicht angekommen', createdAt: Date.parse('2026-10-03T09:00:00Z'), error: {}, ...zusatz });

  it('ohne endgueltige Ablehnung: Erneut senden und Verwerfen direkt an der Nachricht', async () => {
    h.fehlgeschlagene = [fehl()];
    IM_RAUM([]);
    await zeigen();
    const zeile = screen.getByRole('alert');
    expect(zeile).toHaveTextContent('Nicht gesendet');
    expect(within(zeile).getByRole('button', { name: 'Erneut senden' })).toBeInTheDocument();
    fireEvent.click(within(zeile).getByRole('button', { name: 'Erneut senden' }));
    // Der erneute Versuch laeuft: die Nachricht steht wieder als "wird gesendet" da.
    await waitFor(() => expect(blase('Nicht angekommen')).toHaveClass('web-chat-nachricht--wartet'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Verwerfen nimmt die Nachricht aus dem Verlauf und raeumt Warteschlange und Merker auf', async () => {
    h.fehlgeschlagene = [fehl()];
    IM_RAUM([]);
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await waitFor(() => expect(screen.queryByText('Nicht angekommen')).not.toBeInTheDocument());
    expect(h.verwerfen).toHaveBeenCalledWith(7, 'c-fehl');
  });

  it('endgueltig abgelehnt (zu gross): der Grund steht da, es gibt nur Verwerfen -- ein neuer Versuch liefe in denselben Fehler', async () => {
    h.fehlgeschlagene = [fehl({ error: { status: 413 } })];
    IM_RAUM([]);
    await zeigen();
    const zeile = screen.getByRole('alert');
    expect(zeile.textContent).toMatch(/^Nicht gesendet: .{5,}/);
    expect(within(zeile).queryByRole('button', { name: 'Erneut senden' })).not.toBeInTheDocument();
    expect(within(zeile).getByRole('button', { name: 'Verwerfen' })).toBeInTheDocument();
  });
});

describe('Raum (Web): Menue', () => {
  const menuePunkte = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Chat-Optionen' }));
    return screen.getAllByRole('menuitem').map((e) => e.textContent);
  };

  it('Leitung in einer Gruppe: exportieren, Chat verlassen (gesperrt, mit Grund), loeschen', async () => {
    IM_RAUM([m()]);
    await zeigen(GRUPPE, { onRaumLoeschen: vi.fn() });
    expect(menuePunkte()).toEqual(['Chat-Verlauf exportieren', 'Chat verlassen', 'Chat löschen']);
    const verlassen = screen.getByRole('menuitem', { name: 'Chat verlassen' });
    expect(verlassen).toBeDisabled();
    expect(verlassen).toHaveAttribute('title', 'Die Leitung kann Chats nicht verlassen. Chats können nur gelöscht werden.');
  });

  it('der automatische Team-Chat kann von der Leitung geleert werden; die Leitung (nicht org_admin) darf es nicht', async () => {
    IM_RAUM([m()]);
    await zeigen({ id: 1, name: 'Team', type: 'admin', is_team_chat: true });
    expect(menuePunkte()).toContain('Team-Chat leeren');
    cleanup();
    h.user = { id: 4, type: 'admin', role_name: 'super_admin', display_name: 'Alex' };
    IM_RAUM([m()]);
    await zeigen({ id: 1, name: 'Team', type: 'admin', is_team_chat: true });
    expect(menuePunkte()).not.toContain('Team-Chat leeren');
  });

  it('Konfi in einer Gruppe: Chat verlassen; im Jahrgang gar kein Menue', async () => {
    h.user = { id: 5, type: 'konfi', role_name: 'konfi', display_name: 'Mika' };
    IM_RAUM([m()]);
    await zeigen(GRUPPE);
    expect(menuePunkte()).toEqual(['Chat verlassen']);
    cleanup();
    await zeigen(RAUM);
    expect(screen.queryByRole('button', { name: 'Weitere Chat-Optionen' })).not.toBeInTheDocument();
  });

  it('Chat verlassen fragt zurueck, ruft den Server und geht zurueck zur Liste', async () => {
    h.user = { id: 8, type: 'teamer', role_name: 'teamer', display_name: 'Tom' };
    IM_RAUM([m()]);
    const { onSchliessen } = await zeigen(GRUPPE);
    menuePunkte();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chat verlassen' }));
    expect(h.alert.mock.calls[0][0]).toMatchObject({ header: 'Chat verlassen' });
    const verlassen = (h.alert.mock.calls[0][0].buttons as Array<{ text: string; handler?: () => Promise<void> }>).find((k) => k.text === 'Verlassen')!;
    await act(async () => { await verlassen.handler?.(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/chat/rooms/8/leave');
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });

  it('Chat loeschen ruft die Funktion der Liste; ohne sie gibt es den Eintrag nicht; Direktchats lassen sich ebenso loeschen', async () => {
    const loeschen = vi.fn();
    IM_RAUM([m()]);
    await zeigen(DIREKT, { onRaumLoeschen: loeschen });
    menuePunkte();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chat löschen' }));
    expect(loeschen).toHaveBeenCalledTimes(1);
    cleanup();
    await zeigen(DIREKT);
    expect(screen.queryByRole('button', { name: 'Weitere Chat-Optionen' })).toBeInTheDocument();
    expect(menuePunkte()).not.toContain('Chat löschen');
    cleanup();
    // Der Jahrgangs-Chat laesst sich nicht loeschen.
    await zeigen(RAUM, { onRaumLoeschen: loeschen });
    expect(menuePunkte()).toEqual(['Chat-Verlauf exportieren']);
  });

  it('ohne Internet sind die Eintraege gesperrt und nennen den Grund; Escape schliesst das Menue und gibt den Fokus zurueck', async () => {
    h.online = false;
    IM_RAUM([m()]);
    await zeigen(GRUPPE, { onRaumLoeschen: vi.fn() });
    menuePunkte();
    const export_ = screen.getByRole('menuitem', { name: 'Chat-Verlauf exportieren' });
    expect(export_).toBeDisabled();
    expect(export_).toHaveAttribute('title', 'Ohne Internetverbindung nicht möglich');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Weitere Chat-Optionen' }));
  });

  it('Pfeiltasten wandern durch die Eintraege, der Fokus beginnt auf dem ersten', async () => {
    IM_RAUM([m()]);
    await zeigen(GRUPPE, { onRaumLoeschen: vi.fn() });
    menuePunkte();
    const [exportieren, , loeschen] = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(exportieren);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(loeschen);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(exportieren);
  });
});
