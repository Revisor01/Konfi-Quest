// Gerüst für die gerenderten Tests der Web-Fassung von Termine/Mitmachen
// (03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Drei Seiten, ein Gerüst: AdminEventsPage (Leitung), KonfiEventsPage,
// TeamerEventsPage (samt Detail über ?eventId=). Aufbau wie
// gerueste/teamerTerminSeite.tsx: dieses Modul als ERSTES importieren, es
// registriert die Attrappen; die Seiten werden erst beim Rendern geladen.
//
// Gerendert wird die ECHTE Seite mit ihren echten Web-Bausteinen und den
// echten Ansichten der App (für das schmale Fenster). Nachgestellt sind:
//   * Server und Cache -- useOfflineQuery liefert, was `h.daten` je
//     Schlüssel-Anfang vorgibt (längster Treffer gewinnt);
//   * Breite (`h.breit`), Adresse (`h.standort`), Netz (`h.online`), Nutzer;
//   * Rückfragen, Aktionsmenüs, Modale und der Router: ihr Aufruf wird
//     mitgeschrieben, ein Test "tippt" einen Knopf der Rückfrage, indem er
//     dessen handler ruft.
// Ionic ist durch schlichte HTML-Elemente ersetzt (Ionic-Felder lassen sich in
// jsdom nicht bedienen).
import React from 'react';
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Event } from '../../../types/event';

// Die erste Ansicht lädt die ganze Seite (große Module); in der vollen Suite unter Last reichen 5 Sekunden nicht.
vi.setConfig({ testTimeout: 30_000 });

type Knopf = { text: string; role?: string; handler?: () => unknown };
export interface Rueckfrage { header?: string; subHeader?: string; message?: string; buttons: Knopf[] }

const hoch = vi.hoisted(() => ({
  breit: true,
  online: true,
  user: { id: 1, organization_id: 1, role_name: 'org_admin', type: 'admin' } as Record<string, unknown>,
  standort: { pathname: '/admin/events', search: '' },
  /** useOfflineQuery: Daten je Schlüssel-Anfang ('admin:events:' ...). */
  daten: new Map<string, unknown>(),
  /** Schlüssel-Anfänge, die noch laden (loading: true, keine Daten). */
  laedt: new Set<string>(),
  /** Alle Schlüssel, unter denen die Seite Daten abgefragt hat. */
  abfragen: [] as string[],
  /** Schlüssel, deren refresh() aufgerufen wurde. */
  neuGeladen: [] as string[],
  badge: { pendingEventsCount: 0, pendingRequestsCount: 0 },
  /** Offline-Warteschlange (useWartendeVorgaenge). */
  wartend: [] as Array<Record<string, unknown>>,
  gescheitert: [] as Array<Record<string, unknown>>,
  vergessen: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  setSuccess: vi.fn(),
  setError: vi.fn(),
  triggerRefresh: vi.fn(),
  push: vi.fn(),
  enqueue: vi.fn(),
  presentAlert: vi.fn(),
  presentActionSheet: vi.fn(),
  modale: { geoeffnet: [] as Array<{ name: string; props: Record<string, unknown> }> },
}));

/** Der gemeinsame Zustand: Tests setzen ihn, die Attrappen lesen ihn. */
export const h = hoch;
export const { api, setSuccess, setError, presentAlert, presentActionSheet } = h;
export const routerPush = h.push;

/** Eine leere Komponente mit Namen -- damit das Öffnen eines Modals zuzuordnen ist. */
export const leer = (name: string) => ({ default: { [name]: () => null }[name] });

/** Die zuletzt geöffnete Komponente mit diesem Namen samt ihren Eigenschaften. */
export const zuletztGeoeffnet = (name: string) => [...h.modale.geoeffnet].reverse().find((m) => m.name === name);
export const geoeffnet = (name: string) => h.modale.geoeffnet.filter((m) => m.name === name);

/** Die zuletzt gezeigte Rückfrage und ihr Knopf. */
export const letzteRueckfrage = (): Rueckfrage => presentAlert.mock.calls.at(-1)?.[0];
export const knopfIn = (r: Rueckfrage, text: string) => r.buttons.find((b) => b.text === text);

// --- Attrappen -------------------------------------------------------------------

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => h.api.get(...a),
    post: (...a: unknown[]) => h.api.post(...a),
    put: (...a: unknown[]) => h.api.put(...a),
    delete: (...a: unknown[]) => h.api.delete(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setSuccess: h.setSuccess, setError: h.setError, isOnline: h.online, signOut: vi.fn() }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => h.badge }));
vi.mock('../../../contexts/ModalContext', () => {
  const seite = { pageRef: { current: null }, presentingElement: null };
  return { useModalPage: () => seite };
});
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: h.triggerRefresh }),
  useLiveRefresh: () => {},
}));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return h.online; }, subscribe: () => () => {} },
}));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => h.enqueue(...a) } }));
vi.mock('../../../services/notifications', () => ({ removeDeliveredForEvents: vi.fn() }));
vi.mock('../../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({ wartend: h.wartend, gescheitert: h.gescheitert, vergessen: h.vergessen }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    h.abfragen.push(schluessel);
    const passend = (k: string) => schluessel.startsWith(k);
    const anfang = [...h.daten.keys(), ...h.laedt].filter(passend).sort((a, b) => b.length - a.length)[0];
    const laedt = anfang !== undefined && h.laedt.has(anfang);
    return {
      data: laedt || anfang === undefined ? undefined : h.daten.get(anfang),
      loading: laedt, error: null, isStale: false, isOffline: !h.online,
      refresh: async () => { h.neuGeladen.push(schluessel); },
      refreshLive: async () => undefined,
    };
  },
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../components/common/LoadingSpinner', () => ({
  default: ({ message }: { message?: string }) => <div data-testid="ladeanzeige">{message}</div>,
}));
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, rechts }: { titel?: string; rechts?: React.ReactNode }) => (
    <header data-testid="kopfzeile" data-titel={titel}>{rechts}</header>
  ),
  AppKopfzeileGross: () => null,
}));
vi.mock('../../../components/shared/WartendeVorgaengeKarte', () => leer('WartendeVorgaengeKarte'));
vi.mock('../../../components/admin/modals/EventModal', () => leer('EventModal'));
vi.mock('../../../components/admin/modals/ActivityRequestModal', () => leer('AdminActivityRequestModal'));
vi.mock('../../../components/admin/modals/ActivityManagementModal', () => leer('ActivityManagementModal'));
vi.mock('../../../components/admin/modals/TerminAbsagenModal', () => leer('TerminAbsagenModal'));
vi.mock('../../../components/konfi/modals/ActivityRequestModal', () => leer('KonfiActivityRequestModal'));
vi.mock('../../../components/konfi/modals/QRScannerModal', () => leer('QRScannerModal'));
vi.mock('../../../components/konfi/modals/RequestDetailModal', () => leer('RequestDetailModal'));
vi.mock('../../../components/shared/QRDisplayModal', () => leer('QRDisplayModal'));
vi.mock('../../../components/teamer/modals/TeamerActivityRequestModal', () => leer('TeamerActivityRequestModal'));
vi.mock('../../../components/teamer/modals/TeamerAbsageModal', () => leer('TeamerAbsageModal'));
vi.mock('../../../components/teamer/pages/TeamerMaterialDetailPage', () => leer('TeamerMaterialDetailPage'));

type K = { children?: React.ReactNode };
const SegmentKontext = React.createContext<((wert: string) => void) | null>(null);

vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, K>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButtons: durch,
    IonItemOptions: durch, IonBadge: durch, IonChip: durch,
    IonList: ({ children }: K) => <section>{children}</section>,
    IonListHeader: ({ children }: K) => <div>{children}</div>,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonCard: ({ children }: K) => <div>{children}</div>,
    IonCardContent: ({ children }: K) => <div>{children}</div>,
    IonItemGroup: ({ children }: K) => <div>{children}</div>,
    IonNote: ({ children }: K) => <span>{children}</span>,
    IonText: ({ children }: K) => <span>{children}</span>,
    IonIcon: ({ icon }: { icon?: string }) => <i data-icon={typeof icon === 'string' ? icon.slice(0, 40) : undefined} />,
    IonSpinner: () => null, IonRefresherContent: () => null,
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
    IonItemSliding: ({ children }: K) => <div data-testid="termin">{children}</div>,
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
    IonSelect: durch, IonSelectOption: durch,
    useIonModal: (komponente: { name?: string; displayName?: string } | undefined, props: Record<string, unknown>) => {
      const name = komponente?.displayName || komponente?.name || 'unbekannt';
      return [() => { h.modale.geoeffnet.push({ name, props }); }, vi.fn()];
    },
    useIonAlert: () => [h.presentAlert, vi.fn()],
    useIonActionSheet: () => [h.presentActionSheet, vi.fn()],
    useIonToast: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: h.push, goBack: vi.fn(), canGoBack: () => false }),
    useIonViewWillEnter: () => {},
  };
});

// Die echten Seiten werden erst beim Rendern geladen: Ein statischer Import
// liefe vor den Attrappen dieses Moduls.
export const ladeSeite = {
  leitung: async () => (await import('../../../components/admin/pages/AdminEventsPage')).default,
  aktivitaeten: async () => (await import('../../../components/admin/pages/AdminActivitiesPage')).default,
  konfi: async () => (await import('../../../components/konfi/pages/KonfiEventsPage')).default,
  team: async () => (await import('../../../components/teamer/pages/TeamerEventsPage')).default,
};

// --- Testdaten --------------------------------------------------------------------

/** "Jetzt" in allen Tests: Samstag, 03.10.2026, 10:30 Uhr in Deutschland. */
export const JETZT = new Date('2026-10-03T08:30:00Z');
export const TAG = 24 * 60 * 60 * 1000;
/** Ein Datum n Tage nach JETZT (ISO). */
export const inTagen = (n: number, stunde = 10) => {
  const d = new Date(JETZT.getTime() + n * TAG);
  d.setUTCHours(stunde - 2, 0, 0, 0);
  return d.toISOString();
};

/** Ein Event, wie GET /events es liefert -- mit den Feldern, die die Listen lesen. */
export const termin = (id: number, name: string, zusatz: Record<string, unknown> = {}): Event => ({
  id, name, description: '', event_date: inTagen(7), location: '', points: 0, type: 'event',
  max_participants: 20, registered_count: 0, registration_status: 'open', cancelled: false,
  categories: [], jahrgaenge: [], is_registered: false, booking_status: null, can_register: true,
  has_timeslots: false, mandatory: false, is_konfirmation: false, teamer_needed: false, teamer_only: false,
  ...zusatz,
} as unknown as Event);

export const NUTZER = {
  leitung: { id: 1, organization_id: 1, role_name: 'org_admin', type: 'admin', display_name: 'Lea Leitung' },
  admin: { id: 2, organization_id: 1, role_name: 'admin', type: 'admin', display_name: 'Ada Admin' },
  teamer: { id: 9, organization_id: 1, role_name: 'teamer', type: 'teamer', display_name: 'Tim Teamer' },
  konfi: { id: 7, organization_id: 1, role_name: 'konfi', type: 'konfi', display_name: 'Kim Konfi' },
};

// --- Ablauf ---------------------------------------------------------------------

export const zuruecksetzen = () => {
  // Gemerkte Detailseiten (services/detailSpeicher.ts) liegen im echten
  // offlineCache, also in localStorage: Kein Test erbt den Stand des vorigen.
  localStorage.clear();
  h.breit = true;
  h.online = true;
  h.user = NUTZER.leitung;
  h.standort = { pathname: '/admin/events', search: '' };
  h.daten.clear();
  h.laedt.clear();
  h.abfragen.length = 0;
  h.neuGeladen.length = 0;
  h.badge = { pendingEventsCount: 0, pendingRequestsCount: 0 };
  h.wartend = [];
  h.gescheitert = [];
  h.vergessen.mockReset();
  for (const f of [h.api.get, h.api.post, h.api.put, h.api.delete, h.setSuccess, h.setError, h.triggerRefresh, h.push, h.enqueue, h.presentAlert, h.presentActionSheet]) {
    f.mockReset();
  }
  h.modale.geoeffnet.length = 0;
  h.api.get.mockResolvedValue({ data: [] });
  h.api.put.mockResolvedValue({ data: {} });
  h.api.post.mockResolvedValue({ data: {} });
  h.api.delete.mockResolvedValue({ data: {} });
  h.enqueue.mockResolvedValue(undefined);
};

/** Nutzer, Adresse und Daten setzen -- ein Aufruf je Test. */
export const richteEin = (opt: {
  nutzer: keyof typeof NUTZER;
  pfad: string;
  suche?: string;
  daten?: Record<string, unknown>;
}) => {
  h.user = NUTZER[opt.nutzer];
  h.standort = { pathname: opt.pfad, search: opt.suche ?? '' };
  for (const [k, v] of Object.entries(opt.daten ?? {})) h.daten.set(k, v);
};

/** Eine Seite rendern und die ersten Abrufe abwarten. */
export const oeffne = async (seite: keyof typeof ladeSeite) => {
  const Seite = await ladeSeite[seite]();
  const r = render(<Seite />);
  for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });
  /** Die Adresse wechseln und neu zeichnen (wie ein Klick auf einen Link der Leiste). */
  const wechsleAdresse = async (pfad: string, suche = '') => {
    h.standort = { pathname: pfad, search: suche };
    await act(async () => { r.rerender(<Seite />); });
  };
  return { ...r, wechsleAdresse };
};
