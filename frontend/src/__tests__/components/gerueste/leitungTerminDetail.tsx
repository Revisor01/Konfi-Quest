// Gerüst für gerenderte Tests der Termin-Detailansicht der Leitung
// (admin/views/EventDetailView.tsx samt EventDetailSections).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (Audit Tests
// 26.09.2026, BF-02, 30.09.2026). Aufbau wie gerueste/teamerTerminSeite.tsx:
// dieses Modul als ERSTES importieren, es registriert die Attrappen.
//
// Gerendert wird die ECHTE Ansicht mit ihren echten Abschnitten. Nachgestellt
// sind Server, Listen-Cache, Anmeldung und Ionic; Rückfragen (Alert) und
// Aktionsmenüs (Action Sheet) werden mitgeschrieben, samt ihrer Knöpfe --
// ein Test kann einen Knopf darin "antippen", indem er dessen handler ruft.
import React from 'react';
import { vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Event } from '../../../types/event';

type Knopf = { text: string; role?: string; handler?: () => unknown };
export interface Rueckfrage { header?: string; subHeader?: string; message?: string; buttons: Knopf[] }

export const zustand = {
  rolle: 'admin',
  online: true,
  /** Antwort von GET /events/:id. */
  detail: null as Record<string, unknown> | null,
  /** Listen-Cache 'admin:events:<org>' -- der Grundstand offline. */
  cache: new Map<string, unknown>(),
};

export const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
export const setSuccess = vi.fn();
export const setError = vi.fn();
export const routerPush = vi.fn();
export const presentAlert = vi.fn();
export const presentActionSheet = vi.fn();
export const cacheGet = vi.fn();
export const modale = {
  angemeldet: new Set<string>(),
  geoeffnet: [] as Array<{ name: string; props: Record<string, unknown> }>,
};
export const zuletztGeoeffnet = (name: string) => [...modale.geoeffnet].reverse().find((m) => m.name === name);
export const leer = (name: string) => ({ default: { [name]: () => null }[name] });

/** Die zuletzt gezeigte Rückfrage bzw. das zuletzt gezeigte Aktionsmenü. */
export const letzteRueckfrage = (): Rueckfrage => presentAlert.mock.calls.at(-1)?.[0];
export const letztesMenue = (): Rueckfrage => presentActionSheet.mock.calls.at(-1)?.[0];
export const knopfIn = (r: Rueckfrage, text: string) => r.buttons.find((b) => b.text === text);

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
    user: { id: 99, organization_id: 1, role_name: zustand.rolle },
    setSuccess, setError, isOnline: zustand.online,
  }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: () => {},
}));
vi.mock('../../../services/offlineCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/offlineCache')>()),
  offlineCache: {
    get: (...a: unknown[]) => cacheGet(...a),
    // Merken landet im selben Speicher, aus dem get liest (detailSpeicher.ts).
    set: async (k: string, d: unknown) => { zustand.cache.set(k, d); },
    remove: async (k: string) => { zustand.cache.delete(k); },
  },
}));
vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  trackHandlung: vi.fn(),
}));
vi.mock('../../../components/common/LoadingSpinner', () => ({
  default: ({ message }: { message?: string }) => <div data-testid="ladeanzeige">{message}</div>,
}));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, rechts }: { titel?: string; rechts?: React.ReactNode }) => (
    <header data-testid="kopfzeile" data-titel={titel}>{rechts}</header>
  ),
  AppKopfzeileGross: () => null,
}));
vi.mock('../../../components/admin/modals/EventModal', () => leer('EventModal'));
vi.mock('../../../components/admin/modals/ParticipantManagementModal', () => leer('ParticipantManagementModal'));
vi.mock('../../../components/admin/modals/AnwesenheitNotizModal', () => leer('AnwesenheitNotizModal'));
vi.mock('../../../components/admin/modals/AbmeldungNachtragenModal', () => leer('AbmeldungNachtragenModal'));
vi.mock('../../../components/admin/modals/TerminAbsagenModal', () => leer('TerminAbsagenModal'));
vi.mock('../../../components/shared/QRDisplayModal', () => leer('QRDisplayModal'));
vi.mock('../../../components/teamer/pages/TeamerMaterialDetailPage', () => leer('TeamerMaterialDetailPage'));
vi.mock('../../../components/teamer/modals/TeamerAbsageModal', () => leer('TeamerAbsageModal'));

type K = { children?: React.ReactNode };
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
    IonNote: ({ children }: K) => <span>{children}</span>,
    IonIcon: () => null, IonSpinner: () => null, IonRefresher: () => null, IonRefresherContent: () => null,
    IonButton: ({ children, onClick, disabled, fill, color, 'aria-label': label }: K & {
      onClick?: () => void; disabled?: boolean; fill?: string; color?: string; 'aria-label'?: string;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-fill={fill} data-color={color}>{children}</button>
    ),
    IonItem: ({ children, onClick, button }: K & { onClick?: () => void; button?: boolean }) => (
      <div data-testid="zeile" data-tippbar={button || onClick ? 'ja' : 'nein'} onClick={onClick}>{children}</div>
    ),
    IonItemSliding: React.forwardRef<{ close: () => Promise<void> }, K>(({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({ close: async () => undefined }));
      return <div data-testid="wisch">{children}</div>;
    }),
    IonItemOption: ({ children, onClick, 'aria-label': label }: K & { onClick?: () => void; 'aria-label'?: string }) => (
      <button type="button" data-wisch="ja" onClick={onClick} aria-label={label}>{children}</button>
    ),
    useIonModal: (komponente: { name?: string } | undefined, props: Record<string, unknown>) => {
      const name = komponente?.name || 'unbekannt';
      modale.angemeldet.add(name);
      return [() => { modale.geoeffnet.push({ name, props }); }, vi.fn()];
    },
    useIonActionSheet: () => [presentActionSheet, vi.fn()],
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonRouter: () => ({ push: routerPush }),
  };
});

const ladeAnsicht = async () => (await import('../../../components/admin/views/EventDetailView')).default;

const TAG = 24 * 60 * 60 * 1000;
export const inTagen = (n: number) => new Date(Date.now() + n * TAG).toISOString();

export const teilnahme = (id: number, name: string, zusatz: Record<string, unknown> = {}) => ({
  id, user_id: id + 100, participant_name: name, role_name: 'konfi', created_at: '2026-09-01T10:00:00Z',
  status: 'confirmed', attendance_status: null, ...zusatz,
});

export const termin = (zusatz: Record<string, unknown> = {}) => ({
  id: 7, name: 'Konfi-Freizeit', event_date: inTagen(7), points: 2, type: 'event',
  max_participants: 20, registered_count: 1, registration_status: 'open', available_spots: 19,
  teamer_needed: false, chat_room_id: null, created_at: '2026-08-01T00:00:00Z',
  unregistrations: [], participants: [teilnahme(1, 'Kim Konfi')],
  ...zusatz,
});

export const zuruecksetzen = () => {
  zustand.rolle = 'admin';
  zustand.online = true;
  zustand.detail = termin();
  zustand.cache = new Map();
  for (const f of [api.get, api.post, api.put, api.delete, setSuccess, setError, routerPush, presentAlert, presentActionSheet, cacheGet]) f.mockReset();
  modale.angemeldet.clear();
  modale.geoeffnet.length = 0;
  api.get.mockImplementation((pfad: string) => (
    /^\/events\/\d+$/.test(pfad) ? Promise.resolve({ data: zustand.detail }) : Promise.resolve({ data: [] })
  ));
  api.put.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
  cacheGet.mockImplementation(async (schluessel: string) => {
    const daten = zustand.cache.get(schluessel);
    return daten === undefined ? null : { data: daten, timestamp: Date.now() };
  });
};

/** Die Ansicht rendern und warten, bis Laden und Nachladen durch sind. */
export const oeffne = async (eventId = 7) => {
  const EventDetailView = await ladeAnsicht();
  const onBack = vi.fn();
  const r = render(<EventDetailView eventId={eventId} onBack={onBack} />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  return { ...r, onBack };
};

export const knopf = (name: string | RegExp) => screen.queryByRole('button', { name });
export const zeileVon = (name: string) => screen.getByText(name).closest('[data-testid="zeile"]') as HTMLElement;

/** Der Untertitel im Kopf der Ansicht (Status). */
export const statusText = () => document.querySelector('.app-header-banner__subtitle')?.textContent ?? null;

/** Ein Abschnitt über seinen Titel -- null, wenn es ihn nicht gibt. */
export const abschnitt = (titel: string | RegExp) => {
  const label = screen.queryAllByText(titel).find((el) => el.tagName === 'SPAN');
  return label ? (label.closest('section') as HTMLElement) : null;
};

export type { Event };
