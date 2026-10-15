// Die Fenster eines Chatraums: „Umfrage erstellen" und „Mitglieder anzeigen"
// (Simon, 15.10.2026, Seiten-Interview Seite 3: „poll modal ist noch app,
// mitglieder modal ist noch app design").
//
//   - Im Browser (WebChatRaum, nur im breiten Layout ab 992 px) öffnen beide
//     Knöpfe ein Fenster der Web-Fassung (role=dialog), nicht das Modal der
//     App (useIonModal).
//   - In der App (ChatRoom) öffnen dieselben Knöpfe weiter die Modale der App.
//   - Danach wie in der App: Fenster zu, der Verlauf lädt neu.
//
// Gerendert werden die echten Räume (WebChatRaum, ChatRoom) mit dem echten
// useChatRaum und den echten Fenstern des Browsers. Ersetzt sind Netz, Socket,
// Warteschlange, Kontexte, Ionic-Bausteine, die Nachrichtenliste und die
// Kopfzeile der App (dort nur die zwei Knöpfe; die echte prüft
// chatMitgliederliste.test.tsx) und die Modale der App (nur als Marke).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useEffect, useState } from 'react';
import { render, screen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import type { ChatRoomBase, Message } from '../../../types/chat';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  setError: vi.fn(),
  modal: vi.fn(),
  dateiUebernehmen: vi.fn(async (_datei: File) => undefined),
  user: { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex Beispiel' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('./webChatAttrappe')).ionicAttrappe({
    presentModal: (komponente, props) => (opts) => h.modal({ komponente, props, opts }),
  }),
  IonRefresher: () => null,
  IonRefresherContent: () => null,
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markRoomAsRead: vi.fn(async () => undefined), refreshAllCounts: vi.fn(async () => undefined), chatUnreadByRoom: {} }),
}));
vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    post: (u: string, b?: unknown) => h.apiPost(u, b),
    delete: (u: string) => h.apiDelete(u),
  },
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
    getFailedChat: vi.fn(async () => []),
    forgetFailedChatMany: vi.fn(),
    forgetFailedChat: vi.fn(),
    flush: vi.fn(),
    enqueue: vi.fn(async () => undefined),
    chatAblehnungMerken: vi.fn(async () => undefined),
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
    selectedFile: null, selectedFilePreview: null, dateiWaehlen: vi.fn(), dateiUebernehmen: (d: File) => h.dateiUebernehmen(d),
    clearSelectedFile: vi.fn(), handleFileClick: vi.fn(), ladendeDatei: null,
  }),
}));
vi.mock('../../../components/chat/LazyImage', () => ({ default: () => null }));
vi.mock('../../../components/chat/VideoPreview', () => ({ default: () => null }));
// Die App-Fassung: Kopfzeile nur mit ihren zwei Knöpfen, Liste und Eingabe leer.
vi.mock('../../../components/chat/ChatRoomSections', () => ({
  ChatHeader: ({ onOpenMembers, onOpenPoll }: { onOpenMembers: () => void; onOpenPoll: () => void }) => (
    <header>
      <button type="button" onClick={onOpenMembers}>Mitglieder anzeigen</button>
      <button type="button" onClick={onOpenPoll}>Umfrage erstellen</button>
    </header>
  ),
  MessageInput: () => null,
}));
vi.mock('../../../components/chat/ChatMessagesList', () => ({ default: () => null }));
vi.mock('../../../components/chat/ChatVerlaufAnfang', () => ({ default: () => null }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./webChatAttrappe')).KopfzeileAttrappe);
// Die Modale der App: nur als Marke -- ihr Verhalten prüfen ihre eigenen Tests.
vi.mock('../../../components/chat/modals/PollModal', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/MembersModal', () => ({ default: () => null }));

import WebChatRaum from '../../../components/chat/web/WebChatRaum';
import ChatRoom from '../../../components/chat/ChatRoom';
import PollModal from '../../../components/chat/modals/PollModal';
import MembersModal from '../../../components/chat/modals/MembersModal';
import { entwuerfeZuruecksetzen } from '../../../components/chat/web/chatEntwuerfe';
import { gezeigteTrennerAnkerLeeren } from '../../../components/chat/chatVerlauf';

const GRUPPE: ChatRoomBase = { id: 8, name: 'Freizeit', type: 'group' };
const NACHRICHT: Message = {
  id: 100, content: 'Hallo', sender_id: 21, sender_name: 'Lena Probe', sender_type: 'konfi',
  created_at: '2026-10-15T08:00:00.000Z', message_type: 'text',
};
const MITGLIEDER = [
  { user_id: 4, user_type: 'admin', name: 'Alex Beispiel', role_name: 'org_admin', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 21, user_type: 'konfi', name: 'Lena Probe', jahrgang_name: '2026/27', joined_at: '2026-09-01T10:00:00Z' },
];

const verlaufAbrufe = () => h.apiGet.mock.calls.filter(([url]) => /\/chat\/rooms\/8\/messages/.test(url as string)).length;

const warten = async () => {
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
};

const imBrowser = async () => {
  render(<WebChatRaum room={GRUPPE} onSchliessen={vi.fn()} />);
  await waitFor(() => expect(verlaufAbrufe()).toBe(1));
  await warten();
};

const inDerApp = async () => {
  render(<ChatRoom room={GRUPPE} onBack={vi.fn()} presentingElement={null} />);
  await waitFor(() => expect(verlaufAbrufe()).toBe(1));
  await warten();
};

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 4, type: 'admin', role_name: 'org_admin', display_name: 'Alex Beispiel' };
  h.apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/chat/rooms/8/messages')) return { data: [NACHRICHT] };
    if (url === '/chat/rooms/8/participants') return { data: MITGLIEDER };
    // Die Listen zum Hinzufügen (Leitung in einer Gruppe).
    return { data: [] };
  });
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
  entwuerfeZuruecksetzen();
  gezeigteTrennerAnkerLeeren();
});
afterEach(() => cleanup());

describe('Browser (WebChatRaum): eigene Fenster statt der Modale der App', () => {
  it('„Umfrage erstellen" öffnet den Dialog „Neue Umfrage", kein Modal der App', async () => {
    await imBrowser();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    const dialog = screen.getByRole('dialog', { name: 'Neue Umfrage' });
    expect(within(dialog).getByRole('textbox', { name: 'Frage' })).toBeInTheDocument();
    expect(h.modal).not.toHaveBeenCalled();
  });

  it('„Mitglieder anzeigen" öffnet den Dialog „Mitglieder" mit den Mitgliedern dieses Raums, kein Modal der App', async () => {
    await imBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder anzeigen' }));
    const dialog = screen.getByRole('dialog', { name: 'Mitglieder' });
    await warten();
    expect(within(dialog).getByRole('list', { name: 'Mitglieder (2)' })).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenCalledWith('/chat/rooms/8/participants');
    expect(h.modal).not.toHaveBeenCalled();
  });

  it('nach dem Anlegen der Umfrage: Fenster zu, der Verlauf lädt neu -- wie in der App', async () => {
    await imBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    const dialog = screen.getByRole('dialog', { name: 'Neue Umfrage' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Frage' }), { target: { value: 'Pizza oder Nudeln?' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Option 1' }), { target: { value: 'Pizza' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Option 2' }), { target: { value: 'Nudeln' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Umfrage erstellen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.apiPost).toHaveBeenCalledWith('/chat/rooms/8/polls', expect.objectContaining({ question: 'Pizza oder Nudeln?', options: ['Pizza', 'Nudeln'] }));
    await waitFor(() => expect(verlaufAbrufe()).toBe(2));
  });

  it('nach dem Entfernen eines Mitglieds: Fenster zu, der Verlauf lädt neu -- wie in der App', async () => {
    await imBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder anzeigen' }));
    await warten();
    fireEvent.click(screen.getByRole('button', { name: 'Lena Probe entfernen' }));
    const rueckfrage = screen.getByRole('dialog', { name: 'Mitglied entfernen' });
    fireEvent.click(within(rueckfrage).getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.apiDelete).toHaveBeenCalledWith('/chat/rooms/8/participants/21/konfi');
    await waitFor(() => expect(verlaufAbrufe()).toBe(2));
  });

  // Die Fenster hängen per Portal außerhalb des Raums; ihre Ereignisse laufen
  // in React aber durch ihn. Eine Datei über dem Fenster ist kein Anhang.
  it('eine Datei über dem Fenster wird nicht an die Nachricht gehängt; über dem Verlauf schon', async () => {
    await imBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    const datei = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
    const fenster = screen.getByRole('dialog', { name: 'Neue Umfrage' });
    fireEvent.dragEnter(fenster, { dataTransfer: { types: ['Files'], files: [datei] } });
    expect(screen.queryByText('Datei hier ablegen, um sie anzuhängen')).toBeNull();
    fireEvent.drop(fenster, { dataTransfer: { types: ['Files'], files: [datei] } });
    expect(h.dateiUebernehmen).not.toHaveBeenCalled();
    fireEvent.drop(screen.getByRole('region', { name: 'Chat Freizeit' }), { dataTransfer: { types: ['Files'], files: [datei] } });
    expect(h.dateiUebernehmen).toHaveBeenCalledWith(datei);
  });
});

describe('App (ChatRoom): dieselben Knöpfe öffnen die Modale der App', () => {
  it('„Umfrage erstellen" zeigt PollModal über Ionic, kein Fenster des Browsers', async () => {
    await inDerApp();
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    expect(h.modal).toHaveBeenCalledTimes(1);
    const { komponente, props } = h.modal.mock.calls[0][0];
    expect(komponente).toBe(PollModal);
    expect(props).toMatchObject({ roomId: 8 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Mitglieder anzeigen" zeigt MembersModal über Ionic, kein Fenster des Browsers', async () => {
    await inDerApp();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder anzeigen' }));
    expect(h.modal).toHaveBeenCalledTimes(1);
    const { komponente, props } = h.modal.mock.calls[0][0];
    expect(komponente).toBe(MembersModal);
    expect(props).toMatchObject({ roomId: 8, roomType: 'group' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('danach wie bisher: onSuccess des Modals lädt den Verlauf neu', async () => {
    await inDerApp();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder anzeigen' }));
    const { props } = h.modal.mock.calls[0][0];
    await act(async () => { props.onSuccess(); });
    await waitFor(() => expect(verlaufAbrufe()).toBe(2));
  });
});
