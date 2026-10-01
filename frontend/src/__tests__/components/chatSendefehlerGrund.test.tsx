import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Chat: Lehnt der Server eine Nachricht endgültig ab, steht der Grund dran,
// und die App versucht es nicht sinnlos noch einmal (Nebenbefund Paket G2,
// 29.09.2026).
//
// Vorher: Scheiterte das Senden einer Datei mit 413 (zu groß) oder 415
// (Dateityp nicht erlaubt oder nicht verifizierbar), reihte die App die
// Nachricht in die Warteschlange ein und schickte sie sofort noch einmal --
// dieselbe Datei, derselbe Fehler. Danach stand sie nur mit dem roten
// Warnsymbol da, ohne Grund, und das Menü bot "Erneut senden" an.
//
// Jetzt: 4xx außer 408/429 (dieselbe Regel wie in der Warteschlange) geht
// nicht in die Warteschlange. Die Nachricht steht als fehlgeschlagen da, mit
// einem festen Text je Status; der Hinweis oben sagt dasselbe. Feste Texte,
// nicht der Text des Servers: Die Fehlermessung darf keinen Server-Text
// hinaustragen (utils/bekannteFehlertexte.ts).
//
// Gerendert wird der echte ChatRoom; ersetzt sind Netz, Socket, Kopfzeile,
// Scrollen und die Nachrichtenliste (sie zeigt Status und Grund als Text).
// ---------------------------------------------------------------------------

const RAUM: ChatRoomBase = { id: 7, name: 'Jahrgang', type: 'jahrgang' };

const apiPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
    post: (...a: unknown[]) => apiPost(...a),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    IonContent: React.forwardRef<unknown, { children?: React.ReactNode }>(({ children }, _ref) => <div>{children}</div>),
    IonIcon: () => null,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonAvatar: durch,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn()],
    useIonActionSheet: () => [presentActionSheet],
  };
});

// Das Menü an der fehlgeschlagenen Nachricht: seine Optionen merkt sich der Test.
interface MenueKnopf { text: string; role?: string; handler?: () => unknown }
interface MenueOptionen { header?: string; subHeader?: string; buttons: MenueKnopf[] }
let letztesMenue: MenueOptionen | null = null;
const presentActionSheet = (o: MenueOptionen) => { letztesMenue = o; };

const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, type: 'konfi', display_name: 'Ich' }, setError, isOnline: true }),
}));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markRoomAsRead: vi.fn(async () => {}), refreshAllCounts: vi.fn(async () => {}), chatUnreadByRoom: {} }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: null, refresh: vi.fn() }),
}));
vi.mock('../../services/offlineCache', () => ({ CACHE_TTL: { CHAT_MESSAGES: 1 } }));

const { warteschlange, meldeFehlschlag } = vi.hoisted(() => {
  const melder: { an: ((item: unknown) => void) | null } = { an: null };
  return {
    meldeFehlschlag: melder,
    warteschlange: {
      enqueue: vi.fn(async (item: unknown) => item),
      flush: vi.fn(async () => ({ succeeded: [], failed: [] })),
      getByMetadata: vi.fn(async () => []),
      getFailedChat: vi.fn(async () => []),
      forgetFailedChatMany: vi.fn(async () => {}),
      forgetFailedChat: vi.fn(async () => {}),
      chatAblehnungMerken: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
  };
});
vi.mock('../../services/writeQueue', () => ({
  writeQueue: warteschlange,
  onItemFailed: (cb: (item: unknown) => void) => { meldeFehlschlag.an = cb; return () => { meldeFehlschlag.an = null; }; },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn(async () => ({})), deleteFile: vi.fn(async () => {}) },
  Directory: { Data: 'DATA' },
}));
let online = true;
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { get isOnline() { return online; } } }));
vi.mock('../../components/chat/useChatSocket', () => ({ useChatSocket: () => {} }));
vi.mock('../../components/chat/useChatScroll', () => ({
  useChatScroll: () => ({
    contentRef: { current: { scrollToBottom: vi.fn() } },
    setShouldAutoScroll: vi.fn(),
    floatingDay: null,
    showScrollDown: false,
    parkedAtDividerRef: { current: false },
    handleScroll: vi.fn(),
    handleScrollDownClick: vi.fn(),
    handleTextareaFocus: vi.fn(),
    positionVorVoranstellenMerken: vi.fn(),
  }),
}));
vi.mock('../../components/chat/ChatRoomSections', () => ({
  ChatHeader: () => null,
  MessageInput: ({ onSend }: { onSend: () => void }) => <button type="button" onClick={onSend}>senden</button>,
  autoCapitalize: (s: string) => s,
}));
vi.mock('../../components/chat/ChatVerlaufAnfang', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null }));
vi.mock('../../components/chat/modals/PollModal', () => ({ default: () => null }));
vi.mock('../../components/chat/modals/MembersModal', () => ({ default: () => null }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(), triggerPullHaptic: vi.fn(), ImpactStyle: { Medium: 'MEDIUM' } }));
vi.mock('../../components/chat/chatTeilen', () => ({ nachrichtTeilen: vi.fn() }));

const DATEI = new File(['x'.repeat(64)], 'Plakat.pdf', { type: 'application/pdf' });
vi.mock('../../components/chat/useChatDateien', () => ({
  useChatDateien: () => ({
    selectedFile: DATEI, selectedFilePreview: null, dateiWaehlen: vi.fn(),
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
// Die Liste: je Nachricht Status und Status-Code des Fehlers als Text; der
// Knopf daneben ist der Tipp auf die fehlgeschlagene Nachricht (onRetry).
vi.mock('../../components/chat/ChatMessagesList', () => ({
  default: ({ messages, onRetry }: { messages: Message[]; onRetry: (m: Message) => void }) => (
    <ul>
      {messages.map((m) => (
        <li key={m.localId ?? m.id} data-testid="nachricht">
          {`${m.content}|${m.queueStatus ?? ''}|${m.sendeFehlerStatus ?? ''}`}
          <button type="button" onClick={() => onRetry(m)}>antippen</button>
        </li>
      ))}
    </ul>
  ),
}));

// Die Fehlermessung der Upload-Schritte (services/uploadDiagnose.ts): nur beobachtet.
const diagnose = vi.hoisted(() => ({ upload: vi.fn(), warteschlange: vi.fn() }));
vi.mock('../../services/uploadDiagnose', () => ({
  uploadFehlerMelden: diagnose.upload,
  warteschlangenFehlerMelden: diagnose.warteschlange,
}));

import ChatRoom from '../../components/chat/ChatRoom';
import { Filesystem } from '@capacitor/filesystem';

const serverfehler = (status: number, error?: string) => ({ response: { status, data: error ? { error } : '<html>413</html>' } });

async function sendenMit(fehler: unknown) {
  apiPost.mockRejectedValueOnce(fehler);
  render(<ChatRoom room={RAUM} onBack={vi.fn()} presentingElement={null} />);
  await act(async () => { fireEvent.click(screen.getByText('senden')); });
  await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
}

const nachrichten = () => screen.getAllByTestId('nachricht').map((li) => li.firstChild?.textContent);

beforeEach(() => {
  apiPost.mockReset();
  setError.mockReset();
  for (const f of Object.values(warteschlange)) f.mockClear();
  letztesMenue = null;
  online = true;
  diagnose.upload.mockClear();
  diagnose.warteschlange.mockClear();
});
afterEach(() => cleanup());

describe('Chat: vom Server abgelehnte Datei', () => {
  it('413: kein Einreihen, kein zweiter Versuch, der Grund steht dran', async () => {
    await sendenMit(serverfehler(413, 'Datei ist zu groß (max. 5 MB).'));

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|413']));
    expect(warteschlange.enqueue).not.toHaveBeenCalled();
    expect(warteschlange.flush).not.toHaveBeenCalled();
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('Die Datei ist zu groß.');
  });

  it('413 ohne Text vom Server (etwa vom Proxy davor): derselbe feste Text', async () => {
    await sendenMit(serverfehler(413));

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|413']));
    expect(setError).toHaveBeenCalledWith('Die Datei ist zu groß.');
    expect(warteschlange.enqueue).not.toHaveBeenCalled();
  });

  it('415: fester Text, nicht der des Servers', async () => {
    await sendenMit(serverfehler(415, 'Dateityp konnte nicht verifiziert werden'));

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|415']));
    expect(setError).toHaveBeenCalledWith('Dieser Dateityp kann nicht gesendet werden.');
    expect(warteschlange.enqueue).not.toHaveBeenCalled();
    expect(warteschlange.flush).not.toHaveBeenCalled();
  });

  it('andere endgültige Ablehnung (403): ebenfalls kein zweiter Versuch, allgemeiner Text', async () => {
    await sendenMit(serverfehler(403, 'Zugriff verweigert'));

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|403']));
    expect(setError).toHaveBeenCalledWith('Die Nachricht wurde nicht angenommen.');
    expect(warteschlange.enqueue).not.toHaveBeenCalled();
  });

  it('die abgelehnte Nachricht bleibt gemerkt -- auch nach dem Verlassen des Raums', async () => {
    await sendenMit(serverfehler(413, 'Datei ist zu groß (max. 5 MB).'));

    await waitFor(() => expect(warteschlange.chatAblehnungMerken).toHaveBeenCalledTimes(1));
    const [eintrag, fehler] = warteschlange.chatAblehnungMerken.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    expect(eintrag).toMatchObject({ roomId: 7, content: '', fileName: 'Plakat.pdf', fileType: 'application/pdf' });
    expect(typeof eintrag.clientId).toBe('string');
    // Gemerkt wird der feste Text, nicht der des Servers.
    expect(fehler).toEqual({ status: 413, message: 'Die Datei ist zu groß.' });
  });

  it('das Menü an der Nachricht nennt den Grund und bietet kein "Erneut senden"', async () => {
    await sendenMit(serverfehler(415, 'Dieser Dateityp kann nicht gesendet werden.'));
    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|415']));

    fireEvent.click(screen.getByText('antippen'));

    expect(letztesMenue).not.toBeNull();
    expect(letztesMenue!.header).toBe('Nachricht nicht gesendet');
    expect(letztesMenue!.subHeader).toBe('Dieser Dateityp kann nicht gesendet werden.');
    expect(letztesMenue!.buttons.map((b) => b.text)).toEqual(['Nachricht löschen', 'Abbrechen']);
  });

  it('"Nachricht löschen" nimmt sie weg und räumt genau ihren Merker-Eintrag', async () => {
    await sendenMit(serverfehler(413, 'Datei ist zu groß (max. 5 MB).'));
    await waitFor(() => expect(warteschlange.chatAblehnungMerken).toHaveBeenCalledTimes(1));
    const { clientId } = (warteschlange.chatAblehnungMerken.mock.calls[0] as unknown as [{ clientId: string }])[0];

    fireEvent.click(screen.getByText('antippen'));
    const loeschen = letztesMenue!.buttons.find((b) => b.text === 'Nachricht löschen')!;
    await act(async () => { await loeschen.handler?.(); });

    expect(screen.queryAllByTestId('nachricht')).toHaveLength(0);
    // Dieselbe Kennung wie im Merker -- sonst stünde sie beim nächsten Öffnen wieder da.
    expect(warteschlange.forgetFailedChat).toHaveBeenCalledWith(clientId);
  });
});

describe('Chat: vorübergehender Fehler -- wie bisher in die Warteschlange', () => {
  it('503: eingereiht und gleich wieder versucht, ohne Hinweis und ohne Grund', async () => {
    await sendenMit(serverfehler(503, 'Service Unavailable'));

    await waitFor(() => expect(warteschlange.enqueue).toHaveBeenCalledTimes(1));
    expect(warteschlange.flush).toHaveBeenCalledTimes(1);
    expect(warteschlange.chatAblehnungMerken).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(nachrichten()).toEqual(['Plakat.pdf|pending|']);
  });

  it('das Menü an einer so gescheiterten Nachricht bietet weiter "Erneut senden"', async () => {
    await sendenMit({ message: 'Network Error' });
    await waitFor(() => expect(warteschlange.enqueue).toHaveBeenCalledTimes(1));
    const clientId = (warteschlange.enqueue.mock.calls[0] as unknown as [{ metadata: { clientId: string } }])[0].metadata.clientId;
    // Die Warteschlange gibt nach fünf Versuchen auf (503).
    act(() => meldeFehlschlag.an?.({ metadata: { type: 'chat', clientId, roomId: 7 }, error: { status: 503, message: 'x' } }));
    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|503']));

    fireEvent.click(screen.getByText('antippen'));

    expect(letztesMenue!.header).toBe('Nachricht fehlgeschlagen');
    expect(letztesMenue!.subHeader).toBeUndefined();
    expect(letztesMenue!.buttons.map((b) => b.text)).toEqual(['Erneut senden', 'Nachricht löschen', 'Abbrechen']);
  });
});

describe('Chat: Ablehnung erst beim Nachsenden aus der Warteschlange (offline geschrieben)', () => {
  it('die Nachricht bekommt den Grund, das Menü kein "Erneut senden"', async () => {
    online = false;
    render(<ChatRoom room={RAUM} onBack={vi.fn()} presentingElement={null} />);
    await act(async () => { fireEvent.click(screen.getByText('senden')); });
    await waitFor(() => expect(warteschlange.enqueue).toHaveBeenCalledTimes(1));
    const clientId = (warteschlange.enqueue.mock.calls[0] as unknown as [{ metadata: { clientId: string } }])[0].metadata.clientId;

    act(() => meldeFehlschlag.an?.({ metadata: { type: 'chat', clientId, roomId: 7 }, error: { status: 413, message: 'Datei ist zu groß (max. 5 MB).' } }));

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|413']));
    fireEvent.click(screen.getByText('antippen'));
    expect(letztesMenue!.subHeader).toBe('Die Datei ist zu groß.');
    expect(letztesMenue!.buttons.map((b) => b.text)).toEqual(['Nachricht löschen', 'Abbrechen']);
  });
});

describe('Chat: welcher Schritt beim Senden einer Datei scheitert, geht an die Messung (01.10.2026)', () => {
  // Android: Word und PDF gingen nicht, die Nachricht stand nur mit "!" da,
  // ohne Meldung -- und ohne Spur in der Messung. Jetzt meldet jeder Schritt
  // seinen festen Ort; die Ursache (netz, timeout, Status) liest die Messung
  // aus dem Fehler.
  const netzabbruch = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

  it('direkter Versand ohne Antwort: chat-datei-direkt mit dem Fehler', async () => {
    const fehler = netzabbruch();
    await sendenMit(fehler);

    await waitFor(() => expect(warteschlange.enqueue).toHaveBeenCalledTimes(1));
    expect(diagnose.upload).toHaveBeenCalledTimes(1);
    expect(diagnose.upload).toHaveBeenCalledWith('chat-datei-direkt', fehler);
  });

  it('vom Server abgelehnt (413): keine Upload-Meldung -- das meldet schon der Hinweis', async () => {
    await sendenMit(serverfehler(413, 'Datei ist zu groß (max. 5 MB).'));

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|413']));
    expect(diagnose.upload).not.toHaveBeenCalled();
  });

  it('Sichern für die Warteschlange scheitert: chat-datei-sichern, Nachricht sofort mit "!"', async () => {
    const schreibfehler = new Error('Speicher voll');
    vi.mocked(Filesystem.writeFile).mockRejectedValueOnce(schreibfehler);
    await sendenMit(netzabbruch());

    await waitFor(() => expect(nachrichten()).toEqual(['Plakat.pdf|error|']));
    expect(diagnose.upload.mock.calls.map((c) => c[0])).toEqual(['chat-datei-direkt', 'chat-datei-sichern']);
    expect(diagnose.upload.mock.calls[1][1]).toBe(schreibfehler);
  });

  it('Warteschlange gibt bei einer Nachricht mit Datei auf: chat-datei-warteschlange mit Status', async () => {
    await sendenMit(netzabbruch());
    await waitFor(() => expect(warteschlange.enqueue).toHaveBeenCalledTimes(1));
    const clientId = (warteschlange.enqueue.mock.calls[0] as unknown as [{ metadata: { clientId: string } }])[0].metadata.clientId;

    act(() => meldeFehlschlag.an?.({
      metadata: { type: 'chat', clientId, roomId: 7 },
      body: { _localFilePath: 'queue-uploads/queue_x_Plakat.pdf' },
      error: { status: 0, message: 'Network Error' },
    }));

    await waitFor(() => expect(diagnose.warteschlange).toHaveBeenCalledWith(0));
  });

  it('Warteschlange gibt bei reinem Text auf: keine Upload-Meldung', async () => {
    render(<ChatRoom room={RAUM} onBack={vi.fn()} presentingElement={null} />);
    act(() => meldeFehlschlag.an?.({ metadata: { type: 'chat', clientId: 'c1', roomId: 7 }, body: { content: 'Hallo' }, error: { status: 0, message: 'x' } }));
    expect(diagnose.warteschlange).not.toHaveBeenCalled();
  });
});
