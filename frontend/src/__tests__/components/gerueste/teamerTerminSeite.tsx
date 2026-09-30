// Gerüst für gerenderte Tests der Team-Terminseite (TeamerEventsPage).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (Audit Tests
// 26.09.2026, BF-02, 30.09.2026): acht Testdateien prüfen dieselbe Seite --
// Rechte, Zusage-Knöpfe, Teilnehmerliste, Kontingent, offline. Die Attrappen
// stehen deshalb EINMAL hier.
//
// EINBINDEN: Dieses Modul als ERSTES importieren. Es registriert die
// Attrappen per vi.mock und bringt die echte Seite gleich mit:
//
//   import { seite, zuruecksetzen, ... } from './gerueste/teamerTerminSeite';
//
// Gerendert wird die ECHTE Seite samt echter geteilter Bausteine (AbsageBlock,
// Eck-Badges, Statuslogik, utils). Nachgestellt sind nur: Server, Netz,
// Warteschlange, Anmeldung, Router, die Modale (ihr Öffnen wird mitgeschrieben)
// und Ionic (schlichte HTML-Elemente, die Knopf-Farbe und -Füllung als
// data-Attribute zeigen).
import React from 'react';
import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { Event, Participant } from '../../../types/event';

// --- Zustand, den die Tests setzen ------------------------------------------

export const zustand = {
  online: true,
  events: [] as Event[],
  /** Antworten von GET /events/:id, je Termin. */
  details: new Map<number, Record<string, unknown>>(),
  /** Antwort von POST /teamer/events/:id/zusage. */
  zusageAntwort: { status: 'confirmed' } as Record<string, unknown>,
};

export const api = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};
export const setSuccess = vi.fn();
export const setError = vi.fn();
export const routerPush = vi.fn();
export const enqueue = vi.fn();
export const presentAlert = vi.fn();
export const presentActionSheet = vi.fn();

/** Modale: welche Komponenten die Seite anmeldet und welche sie öffnet. */
export const modale = {
  angemeldet: new Set<string>(),
  geoeffnet: [] as Array<{ name: string; props: Record<string, unknown> }>,
};
export const zuletztGeoeffnet = (name: string) =>
  [...modale.geoeffnet].reverse().find((m) => m.name === name);

/** Eine leere Komponente mit Namen -- damit das Öffnen zuzuordnen ist. */
export const leer = (name: string) => ({ default: { [name]: () => null }[name] });

// --- Attrappen ----------------------------------------------------------------

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    put: (...a: unknown[]) => api.put(...a),
    delete: (...a: unknown[]) => api.delete(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 9, organization_id: 1, role_name: 'teamer' },
    setSuccess, setError, isOnline: zustand.online,
  }),
}));
vi.mock('../../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: () => {},
}));
vi.mock('../../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ search: '', pathname: '/teamer/events' }),
}));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return zustand.online; },
    subscribe: () => () => {},
  },
}));
vi.mock('../../../services/writeQueue', () => ({
  writeQueue: { enqueue: (...a: unknown[]) => enqueue(...a) },
}));
vi.mock('../../../services/notifications', () => ({ removeDeliveredForEvents: vi.fn() }));
vi.mock('../../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({ wartend: [], gescheitert: [], vergessen: vi.fn() }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  // Die Terminliste des Teams -- und die der Konfis (KonfiEventsPage), für
  // den Vergleich der Reiter "Meine" (wartelisteBleibtMeiner).
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('teamer:events:') || schluessel.startsWith('konfi:events:') ? zustand.events : [],
    loading: false, error: null, isStale: false, isOffline: !zustand.online,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshLive: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../../components/common/LoadingSpinner', () => leer('LoadingSpinner'));
vi.mock('../../../components/konfi/views/RequestsView', () => leer('RequestsView'));
vi.mock('../../../components/konfi/modals/QRScannerModal', () => leer('QRScannerModal'));
vi.mock('../../../components/shared/QRDisplayModal', () => leer('QRDisplayModal'));
vi.mock('../../../components/konfi/modals/RequestDetailModal', () => leer('RequestDetailModal'));
vi.mock('../../../components/teamer/modals/TeamerActivityRequestModal', () => leer('TeamerActivityRequestModal'));
vi.mock('../../../components/teamer/pages/TeamerMaterialDetailPage', () => leer('TeamerMaterialDetailPage'));
vi.mock('../../../components/shared/WartendeVorgaengeKarte', () => leer('WartendeVorgaengeKarte'));
vi.mock('../../../components/teamer/modals/TeamerAbsageModal', () => leer('TeamerAbsageModal'));
// Das Absage-Modal der LEITUNG: Die Seite darf es nicht anmelden. Steht es
// hier als Attrappe, würde ein erneutes Einbinden in modale.angemeldet sichtbar.
vi.mock('../../../components/admin/modals/TerminAbsagenModal', () => leer('TerminAbsagenModal'));
// Die Kopfzeile schlicht: Zurück-Knopf und der rechte Bereich (Chat, QR-Code).
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, rechts, onZurueck }: { titel?: string; rechts?: React.ReactNode; onZurueck?: () => void }) => (
    <header data-testid="kopfzeile" data-titel={titel}>
      {onZurueck && <button type="button" aria-label="Zurück" onClick={onZurueck} />}
      {rechts}
    </header>
  ),
  AppKopfzeileGross: () => null,
}));

type K = { children?: React.ReactNode };
const SegmentKontext = React.createContext<((wert: string) => void) | null>(null);

vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, K>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButtons: durch,
    IonItemOptions: durch, IonBadge: durch, IonChip: durch,
    // Abschnitte als <section>, damit sich ein Abschnitt über seinen Titel
    // finden lässt (abschnitt('Bist du dabei?')).
    IonList: ({ children }: K) => <section>{children}</section>,
    IonListHeader: ({ children }: K) => <div>{children}</div>,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonCard: ({ children }: K) => <div>{children}</div>,
    IonCardContent: ({ children }: K) => <div>{children}</div>,
    IonItemGroup: ({ children }: K) => <div>{children}</div>,
    IonNote: ({ children }: K) => <span>{children}</span>,
    IonText: ({ children }: K) => <span>{children}</span>,
    IonIcon: () => null, IonSpinner: () => null, IonRefresherContent: () => null,
    IonRefresher: ({ onIonRefresh }: { onIonRefresh?: (e: unknown) => void }) => (
      <button type="button" data-testid="aktualisieren" onClick={() => onIonRefresh?.({ detail: { complete: vi.fn() } })} />
    ),
    IonButton: ({ children, onClick, disabled, fill, color, 'aria-label': label }: K & {
      onClick?: () => void; disabled?: boolean; fill?: string; color?: string; 'aria-label'?: string;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-fill={fill} data-color={color}>
        {children}
      </button>
    ),
    // Eine Zeile, die sich antippen lässt, trägt data-tippbar="ja".
    IonItem: ({ children, onClick, button }: K & { onClick?: () => void; button?: boolean }) => (
      <div data-testid="zeile" data-tippbar={button || onClick ? 'ja' : 'nein'} onClick={onClick}>{children}</div>
    ),
    // Wisch-Aktionen: Die Team-Seite hat keine. Kämen sie wieder, fielen sie
    // hier als data-testid="wisch" und als benannte Knöpfe auf.
    IonItemSliding: ({ children }: K) => <div data-testid="wisch">{children}</div>,
    IonItemOption: ({ children, onClick, 'aria-label': label }: K & { onClick?: () => void; 'aria-label'?: string }) => (
      <button type="button" data-wisch="ja" aria-label={label} onClick={onClick}>{children}</button>
    ),
    IonSegment: ({ children, onIonChange }: K & { onIonChange?: (e: { detail: { value: string } }) => void }) => (
      <SegmentKontext.Provider value={(wert) => onIonChange?.({ detail: { value: wert } })}>
        <div role="tablist">{children}</div>
      </SegmentKontext.Provider>
    ),
    IonSegmentButton: ({ children, value }: K & { value: string }) => {
      const waehle = React.useContext(SegmentKontext);
      return <button type="button" role="tab" data-wert={value} onClick={() => waehle?.(value)}>{children}</button>;
    },
    IonInput: ({ value, onIonInput, 'aria-label': label }: {
      value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string;
    }) => <input aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    IonTextarea: ({ value, onIonInput, 'aria-label': label }: {
      value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string;
    }) => <textarea aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    useIonModal: (komponente: { name?: string; displayName?: string } | undefined, props: Record<string, unknown>) => {
      const name = komponente?.displayName || komponente?.name || 'unbekannt';
      modale.angemeldet.add(name);
      return [() => { modale.geoeffnet.push({ name, props }); }, vi.fn()];
    },
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonActionSheet: () => [presentActionSheet, vi.fn()],
    useIonToast: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: routerPush }),
    useIonViewWillEnter: () => {},
  };
});

// Die echte Seite wird erst beim Rendern geladen (oeffneListe): Ein
// statischer Import liefe vor den Konstanten dieses Moduls, auf die sich die
// Attrappen beziehen.
const ladeSeite = async () => (await import('../../../components/teamer/pages/TeamerEventsPage')).default;

// --- Testdaten ------------------------------------------------------------------

const TAG = 24 * 60 * 60 * 1000;
export const inTagen = (n: number) => new Date(Date.now() + n * TAG).toISOString();

export const termin = (zusatz: Partial<Event> = {}): Event => ({
  id: 77,
  name: 'Konfi-Freizeit',
  description: '',
  event_date: inTagen(14),
  location: '',
  points: 0,
  type: 'event',
  max_participants: 20,
  registered_count: 3,
  registration_status: 'open',
  teamer_needed: true,
  teamer_count: 1,
  teamer_max_participants: 0,
  is_registered: false,
  booking_status: null,
  ...zusatz,
} as Event);

export const teilnehmer = (id: number, name: string, zusatz: Partial<Participant> = {}): Participant => ({
  id,
  participant_name: name,
  role_name: 'konfi',
  created_at: '2026-09-01T00:00:00Z',
  status: 'confirmed',
  ...zusatz,
} as Participant);

// --- Ablauf ---------------------------------------------------------------------

export const zuruecksetzen = () => {
  zustand.online = true;
  zustand.events = [];
  zustand.details = new Map();
  zustand.zusageAntwort = { status: 'confirmed' };
  for (const f of [api.get, api.post, api.put, api.delete, setSuccess, setError, routerPush, enqueue, presentAlert, presentActionSheet]) {
    f.mockReset();
  }
  modale.angemeldet.clear();
  modale.geoeffnet.length = 0;
  api.get.mockImplementation((pfad: string) => {
    if (pfad === '/events') return Promise.resolve({ data: zustand.events });
    const treffer = /^\/events\/(\d+)$/.exec(pfad);
    if (treffer) {
      const detail = zustand.details.get(Number(treffer[1])) ?? { participants: [] };
      return Promise.resolve({ data: detail });
    }
    return Promise.resolve({ data: [] });
  });
  api.post.mockImplementation(() => Promise.resolve({ data: zustand.zusageAntwort }));
  api.put.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
  enqueue.mockResolvedValue(undefined);
};

/** Die Seite rendern und auf den Reiter "Alle" stellen (sonst nur "Meine"). */
export const oeffneListe = async (reiter: 'alle' | 'meine' | 'team' = 'alle') => {
  const TeamerEventsPage = await ladeSeite();
  const r = render(<TeamerEventsPage />);
  await act(async () => { await Promise.resolve(); });
  const knopfReiter = document.querySelector(`[role="tab"][data-wert="${reiter}"]`) as HTMLElement;
  await act(async () => { fireEvent.click(knopfReiter); });
  return r;
};

/** Die Listenzeile eines Termins (über den Namen). */
export const zeileVon = (name: string) => {
  const zeilen = screen.getAllByTestId('zeile').filter((z) => z.getAttribute('data-tippbar') === 'ja' && z.textContent?.includes(name));
  if (zeilen.length !== 1) throw new Error(`${zeilen.length} Zeilen mit "${name}"`);
  return zeilen[0];
};

/** Liste öffnen, Termin antippen, warten, bis die Detailantwort da ist. */
export const oeffneTermin = async (name = 'Konfi-Freizeit') => {
  const r = await oeffneListe('alle');
  await act(async () => { fireEvent.click(zeileVon(name)); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return r;
};

export const knopf = (name: string | RegExp) => screen.queryByRole('button', { name });

/** Ein Abschnitt der Detailansicht über seinen Titel -- null, wenn es ihn nicht gibt. */
export const abschnitt = (titel: string | RegExp) => {
  const label = screen.queryAllByText(titel).find((el) => el.tagName === 'SPAN');
  return label ? (label.closest('section') as HTMLElement) : null;
};

/** Die Karte "Bist du dabei?" -- null, wenn es sie nicht gibt. */
export const zusageKarte = () => abschnitt('Bist du dabei?');

const beschriftung = (k: HTMLElement) => k.getAttribute('aria-label') || k.textContent || '';

/**
 * Alle Knöpfe der Seite antippen (ohne Zurück) -- für "egal was man tippt".
 * Jeder Knopf wird vor dem Tippen NEU gesucht: Die Zusage-Knöpfe sind eine
 * innerhalb der Seite definierte Komponente und werden bei jedem Zeichnen
 * neu eingehängt -- ein vorher gesammeltes Element wäre dann abgehängt.
 */
export const tippeAlleKnoepfe = async (ausser: RegExp = /^Zurück$/) => {
  const namen = screen.queryAllByRole('button').map(beschriftung);
  const gesehen = new Map<string, number>();
  for (const name of namen) {
    const nr = gesehen.get(name) ?? 0;
    gesehen.set(name, nr + 1);
    if (ausser.test(name)) continue;
    const k = screen.queryAllByRole('button').filter((b) => beschriftung(b) === name)[nr] as HTMLButtonElement | undefined;
    if (!k || k.disabled) continue;
    await act(async () => { fireEvent.click(k); });
  }
};

