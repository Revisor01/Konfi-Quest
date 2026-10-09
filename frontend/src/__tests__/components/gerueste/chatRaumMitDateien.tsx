// Gerüst für gerenderte Tests des Chatraums mit Dateien (ChatRoom).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (Audit Tests
// 26.09.2026, BF-02, 09.10.2026): chatDateiFortschritt und chatAufraeumen
// prüfen denselben Raum -- Senden mit Fortschritt, Laden einer angetippten
// Datei, Größengrenze bei der Auswahl, Teilen einer Nachricht.
//
// EINBINDEN: Dieses Modul als ERSTES importieren. Es registriert die
// Attrappen per vi.mock und bringt den echten Raum gleich mit:
//
//   import { raumOeffnen, zustand, ... } from './gerueste/chatRaumMitDateien';
//
// Gerendert wird der ECHTE ChatRoom mit echtem useChatRaum, echtem
// useChatDateien, echtem useDateiOeffnen, echtem Medien-Cache, echter
// Nachrichtenliste und echter MessageBubble. Nachgestellt sind nur: Server
// (api), Socket, Scrollen, Kopfzeile, Eingabefeld (zwei Knöpfe: "senden" und
// "Datei wählen", dazu der Name der gewählten Datei), die Dateiauswahl des
// Systems, das Teilen-Blatt, das native Öffnen, das Dateisystem
// (medienAttrappen) und Ionic (schlichte HTML-Elemente; IonIcon zeigt sein
// Symbol als data-icon, IonSpinner ist ein span mit data-testid="spinner").
import React, { useState } from 'react';
import { vi, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { Message, ChatRoomBase } from '../../../types/chat';

// --- Zustand, den die Tests setzen ------------------------------------------

export const zustand = {
  /** Nachrichten, die der Raum beim Öffnen vorfindet (Offline-Cache). */
  nachrichten: [] as Message[],
  /** Was die Dateiauswahl des Systems liefert (null = abgebrochen). */
  auswahl: null as File[] | null,
  /** Die zuletzt an die Nachrichtenliste gereichten Props. */
  listenProps: null as Record<string, unknown> | null,
  /** Jeder an die Liste gereichte Ladezustand, in Reihenfolge (auch kurze). */
  ladeVerlauf: [] as unknown[],
};

export const RAUM: ChatRoomBase = { id: 7, name: 'Jahrgang', type: 'jahrgang' };

export const api = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(async (..._a: unknown[]) => ({ data: {} })),
};
export const setError = vi.fn();
export const nachrichtTeilen = vi.fn(async () => undefined);
export const nativOeffnen = vi.fn(async () => false);
export const betrachterZeigen = vi.fn();

// --- Attrappen ----------------------------------------------------------------

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    delete: (...a: unknown[]) => api.delete(...a),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    IonContent: React.forwardRef<unknown, { children?: React.ReactNode }>(({ children }, _ref) => <div>{children}</div>),
    IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
    IonSpinner: () => <span data-testid="spinner" />,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonAvatar: durch,
    useIonModal: () => [betrachterZeigen, vi.fn()],
    useIonAlert: () => [vi.fn()],
    useIonActionSheet: () => [vi.fn()],
  };
});

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, type: 'konfi', display_name: 'Ich' }, setError, isOnline: true }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markRoomAsRead: vi.fn(async () => {}), refreshAllCounts: vi.fn(async () => {}), chatUnreadByRoom: {} }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => {
    const [data] = useState<Message[]>(() => zustand.nachrichten);
    return { data, refresh: vi.fn() };
  },
}));
vi.mock('../../../services/offlineCache', () => ({ CACHE_TTL: { CHAT_MESSAGES: 1 } }));
vi.mock('../../../services/writeQueue', () => ({
  writeQueue: {
    enqueue: vi.fn(async (item: unknown) => item),
    flush: vi.fn(async () => ({ succeeded: [], failed: [] })),
    getByMetadata: vi.fn(async () => []),
    getFailedChat: vi.fn(async () => []),
    forgetFailedChatMany: vi.fn(async () => {}),
    forgetFailedChat: vi.fn(async () => {}),
    chatAblehnungMerken: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  },
  onItemFailed: () => () => {},
}));
vi.mock('@capacitor/filesystem', async () => (await import('../../medienAttrappen')).dateisystemModul);
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));
vi.mock('../../../components/chat/useChatSocket', () => ({ useChatSocket: () => {} }));
vi.mock('../../../components/chat/useChatScroll', () => ({
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
// Das Eingabefeld: "senden" schickt den Text "Hallo" nur ohne gewählte Datei
// (mit Datei geht der Anhang allein raus), "Datei wählen" öffnet die
// Dateiauswahl; der Name der gewählten Datei steht daneben.
vi.mock('../../../components/chat/ChatRoomSections', () => ({
  ChatHeader: () => null,
  MessageInput: ({ onSend, onDateiWaehlen, selectedFile }: {
    onSend: (text?: string) => void; onDateiWaehlen: () => void; selectedFile: File | null;
  }) => (
    <div>
      <button type="button" onClick={() => onSend(selectedFile ? '' : 'Hallo')}>senden</button>
      <button type="button" onClick={() => onDateiWaehlen()}>Datei wählen</button>
      <span data-testid="gewaehlt">{selectedFile?.name ?? ''}</span>
    </div>
  ),
  autoCapitalize: (s: string) => s,
}));
// Die echte Liste, deren Props der Test zusätzlich mitliest.
vi.mock('../../../components/chat/ChatMessagesList', async (original) => {
  const echt = (await original<typeof import('../../../components/chat/ChatMessagesList')>()).default;
  return {
    default: (props: React.ComponentProps<typeof echt>) => {
      zustand.listenProps = props as unknown as Record<string, unknown>;
      zustand.ladeVerlauf.push(props.ladendeDatei ?? null);
      return React.createElement(echt, props);
    },
  };
});
vi.mock('../../../components/chat/ChatVerlaufAnfang', () => ({ default: () => null }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/PollModal', () => ({ default: () => null }));
vi.mock('../../../components/chat/modals/MembersModal', () => ({ default: () => null }));
vi.mock('../../../components/chat/LazyImage', () => ({ default: () => <span data-testid="bild" /> }));
vi.mock('../../../components/chat/VideoPreview', () => ({ default: () => <span data-testid="video" /> }));
vi.mock('../../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined), triggerPullHaptic: vi.fn(),
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
}));
vi.mock('../../../components/chat/chatTeilen', () => ({
  nachrichtTeilen: (...a: unknown[]) => nachrichtTeilen(...(a as [])),
}));
vi.mock('../../../utils/nativeFileViewer', () => ({
  openFileNatively: (...a: unknown[]) => nativOeffnen(...(a as [])),
}));
vi.mock('../../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../../services/systemDialoge')>()),
  dateiAuswaehlen: vi.fn(async () => zustand.auswahl),
  teilen: vi.fn(async () => undefined),
}));
vi.mock('../../../services/uploadDiagnose', () => ({
  uploadFehlerMelden: vi.fn(),
  warteschlangenFehlerMelden: vi.fn(),
}));

import ChatRoom from '../../../components/chat/ChatRoom';
import { clearMediaCache } from '../../../services/mediaCache';
import { dateien, objectUrlAttrappe } from '../../medienAttrappen';

// --- Helfer ------------------------------------------------------------------

/** Eine fremde Nachricht mit Datei (eine PDF ist keine Vorschau, sondern eine Zeile). */
export const dateiNachricht = (id: number, pfad: string, name: string, groesse = 2048): Message => ({
  id,
  content: '',
  sender_id: 2,
  sender_name: 'Kim',
  sender_type: 'konfi',
  created_at: '2026-09-27T08:00:00Z',
  message_type: 'file',
  file_path: pfad,
  file_name: name,
  file_size: groesse,
});

export const textNachricht = (id: number, text: string): Message => ({
  id,
  content: text,
  sender_id: 2,
  sender_name: 'Kim',
  sender_type: 'konfi',
  created_at: '2026-09-27T08:00:00Z',
  message_type: 'text',
});

/** Eine Datei bestimmter Größe (Inhalt egal). */
export const datei = (name: string, bytes: number, typ = 'application/pdf') =>
  new File([new Uint8Array(bytes)], name, { type: typ });

/** Setzt alle Attrappen zurück -- in beforeEach aufrufen. */
export async function zuruecksetzen() {
  await clearMediaCache();
  dateien.clear();
  objectUrlAttrappe();
  zustand.nachrichten = [];
  zustand.auswahl = null;
  zustand.listenProps = null;
  zustand.ladeVerlauf = [];
  api.get.mockReset();
  api.post.mockReset();
  api.post.mockResolvedValue({ data: {} });
  setError.mockReset();
  nachrichtTeilen.mockClear();
  nativOeffnen.mockReset();
  nativOeffnen.mockResolvedValue(false);
  betrachterZeigen.mockReset();
}

/** Der echte Raum als Element -- zum Rendern im Test selbst. */
export const raumElement = () => <ChatRoom room={RAUM} onBack={vi.fn()} presentingElement={null} />;

/** Warten, bis die vorgefundenen Nachrichten stehen. */
export async function nachrichtenAbwarten() {
  for (const n of zustand.nachrichten) {
    const text = n.file_name || n.content;
    await waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
  }
}

/** Den Raum öffnen und warten, bis die vorgefundenen Nachrichten stehen. */
export async function raumOeffnen() {
  const ergebnis = render(raumElement());
  await nachrichtenAbwarten();
  return ergebnis;
}

/** Eine Datei über die (nachgestellte) Systemauswahl wählen. */
export async function dateiWaehlen(gewaehlt: File) {
  zustand.auswahl = [gewaehlt];
  await act(async () => { fireEvent.click(screen.getByText('Datei wählen')); });
}

/** "senden" tippen. */
export async function senden() {
  await act(async () => { fireEvent.click(screen.getByText('senden')); });
}

/** Ein von Hand gesteuertes Versprechen. */
export function aufgeschoben<T>() {
  let loesen!: (v: T) => void;
  let ablehnen!: (e: unknown) => void;
  const versprechen = new Promise<T>((res, rej) => { loesen = res; ablehnen = rej; });
  return { versprechen, loesen, ablehnen };
}
