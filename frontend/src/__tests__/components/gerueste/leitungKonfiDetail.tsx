// Gerüst für gerenderte Tests der Personenansicht der Leitung
// (admin/views/KonfiDetailView.tsx samt KonfiDetailSections).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (Audit Tests
// 26.09.2026, BF-02, 30.09.2026). Aufbau wie gerueste/teamerTerminSeite.tsx:
// dieses Modul als ERSTES importieren, es registriert die Attrappen.
//
// Gerendert wird die ECHTE Ansicht. Nachgestellt sind Server, Listen-Cache,
// Anmeldung und Ionic; die Modale (Bearbeiten, Rückblick, ...) werden
// mitgeschrieben -- ihr Öffnen samt Requisiten ist das Verhalten der Ansicht.
// Abzeichen haben eigene Tests (KonfiBadgesSection) und bleiben leer.
import React from 'react';
import { vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

export const zustand = {
  rolle: 'org_admin',
  online: true,
  zugewieseneJahrgaenge: [] as Array<{ id: number; name?: string; can_view?: boolean }>,
  /** Antworten je Pfad; Funktion oder Wert. Fehlt ein Pfad, antwortet der Server mit []. */
  antworten: new Map<string, unknown>(),
  cache: new Map<string, unknown>(),
};

export const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
export const setSuccess = vi.fn();
export const setError = vi.fn();
export const presentAlert = vi.fn();
export const routerPush = vi.fn();
export const cacheGet = vi.fn();
export const modale = {
  angemeldet: new Set<string>(),
  geoeffnet: [] as Array<{ name: string; props: Record<string, unknown> }>,
};
export const zuletztGeoeffnet = (name: string) => [...modale.geoeffnet].reverse().find((m) => m.name === name);
export const leer = (name: string) => ({ default: { [name]: () => null }[name] });

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    put: (...a: unknown[]) => api.put(...a),
    delete: (...a: unknown[]) => api.delete(...a),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: {
      id: 5, organization_id: 1, role_name: zustand.rolle, display_name: 'Pastor Luthe',
      assigned_jahrgaenge: zustand.zugewieseneJahrgaenge,
    },
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
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return zustand.online; }, subscribe: () => () => {} },
}));
vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  track: vi.fn(), trackHandlung: vi.fn(),
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
// Nur ein Platzhalter, damit die STELLE der Abzeichen in der Seite prüfbar ist.
vi.mock('../../../components/admin/views/KonfiBadgesSection', () => ({
  default: ({ role }: { role?: string }) => <div data-testid="abzeichen" data-rolle={role ?? 'konfi'} />,
}));
vi.mock('../../../components/admin/modals/KonfiModal', () => leer('KonfiModal'));
vi.mock('../../../components/admin/modals/ActivityModal', () => leer('ActivityModal'));
vi.mock('../../../components/admin/modals/BonusModal', () => leer('BonusModal'));
vi.mock('../../../components/admin/modals/CertificateAssignModal', () => leer('CertificateAssignModal'));
vi.mock('../../../components/admin/modals/AttendanceMatrixModal', () => leer('AttendanceMatrixModal'));
vi.mock('../../../components/wrapped/WrappedModal', () => leer('WrappedModal'));

type K = { children?: React.ReactNode };
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, K>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButtons: durch,
    IonItemOptions: durch, IonModal: () => null, IonDatetime: () => null, IonDatetimeButton: () => null,
    IonList: ({ children }: K) => <section>{children}</section>,
    IonListHeader: ({ children }: K) => <div>{children}</div>,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonCard: ({ children }: K) => <div>{children}</div>,
    IonCardContent: ({ children }: K) => <div>{children}</div>,
    IonNote: ({ children }: K) => <span>{children}</span>,
    IonIcon: () => null, IonSpinner: () => null, IonRefresher: () => null, IonRefresherContent: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: K & {
      onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
    }) => <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
    IonItem: ({ children, onClick }: K & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: K) => <div>{children}</div>,
    IonItemOption: ({ children, onClick, 'aria-label': label }: K & { onClick?: () => void; 'aria-label'?: string }) => (
      <button type="button" onClick={onClick} aria-label={label}>{children}</button>
    ),
    IonInput: ({ value, onIonInput, 'aria-label': label }: {
      value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string;
    }) => <input aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    useIonModal: (komponente: { name?: string } | undefined, props: Record<string, unknown>) => {
      const name = komponente?.name || 'unbekannt';
      modale.angemeldet.add(name);
      return [() => { modale.geoeffnet.push({ name, props }); }, vi.fn()];
    },
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: routerPush }),
  };
});

const ladeAnsicht = async () => (await import('../../../components/admin/views/KonfiDetailView')).default;

export const KONFI_ID = 9;

export const konfi = (zusatz: Record<string, unknown> = {}) => ({
  id: KONFI_ID, name: 'Emilia Test', display_name: 'Emilia Test', username: 'emilia', role_name: 'konfi',
  jahrgang_id: 3, jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 4, gemeinde_points: 2,
  points: { gottesdienst: 4, gemeinde: 2 }, activities: [], bonusPoints: [], challengeMarks: [], offeneStempel: [],
  ...zusatz,
});

export const zuruecksetzen = () => {
  zustand.rolle = 'org_admin';
  zustand.online = true;
  zustand.zugewieseneJahrgaenge = [];
  zustand.antworten = new Map<string, unknown>([
    [`/admin/konfis/${KONFI_ID}`, konfi()],
    ['/admin/jahrgaenge', [{ id: 3, name: 'Jahrgang 2026' }, { id: 4, name: 'Jahrgang 2027' }]],
  ]);
  zustand.cache = new Map();
  for (const f of [api.get, api.post, api.put, api.delete, setSuccess, setError, presentAlert, cacheGet, routerPush]) f.mockReset();
  modale.angemeldet.clear();
  modale.geoeffnet.length = 0;
  api.get.mockImplementation(async (pfad: string) => {
    if (!zustand.antworten.has(pfad)) return { data: [] };
    const antwort = zustand.antworten.get(pfad);
    if (antwort instanceof Error) throw antwort;
    return { data: antwort };
  });
  api.put.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
  cacheGet.mockImplementation(async (schluessel: string) => {
    const daten = zustand.cache.get(schluessel);
    return daten === undefined ? null : { data: daten, timestamp: Date.now() };
  });
};

export const oeffne = async () => {
  const KonfiDetailView = await ladeAnsicht();
  const onBack = vi.fn();
  const r = render(<KonfiDetailView konfiId={KONFI_ID} onBack={onBack} />);
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
  return { ...r, onBack, KonfiDetailView };
};

export const knopf = (name: string | RegExp) => screen.queryByRole('button', { name });

/** Die Überschriften der Abschnitte in der Reihenfolge der Seite. */
export const abschnittTitel = () => [...document.querySelectorAll('section > div > span')].map((s) => s.textContent ?? '');
