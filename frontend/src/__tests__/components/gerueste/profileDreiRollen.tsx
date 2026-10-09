// Gerüst für gerenderte Tests der drei eigenen Profile -- Konfi
// (konfi/views/ProfileView), Team (teamer/pages/TeamerProfilePage), Leitung
// (admin/pages/AdminProfilePage) -- und des Reiters "Mehr" der Leitung
// (admin/pages/AdminSettingsPage).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (BF-02,
// 09.10.2026): emailAenderungUserContext und einladungenKarteImProfil lasen
// dafür die Quelldateien.
//
// EINBINDEN: Dieses Modul als ERSTES importieren.
//
// Gerendert werden die ECHTEN Seiten. Nachgestellt sind: Server (`api.get`
// liefert `zustand.ich` für /auth/me), Anmeldung (setUser beobachtet),
// TokenStore (setUser beobachtet), Zwischenspeicher, Netz, Ionic (schlichte
// Elemente) und die Kinder, um die es nicht geht. Zwei Kinder stehen als
// Marke da: die Einladungskarte (`data-testid="einladungskarte"` mit ihrer
// Variante) und die per useIonModal geöffneten Modale -- deren Props merkt
// sich `modale` je Komponentenname, damit ein Test etwa den Erfolgs-Rückruf
// des E-Mail-Modals auslösen kann wie das echte Modal nach dem Speichern.
import React from 'react';
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';

export const zustand = {
  user: { id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1, display_name: 'Emilia Test', email: 'alt@example.org' } as Record<string, unknown>,
  /** Antwort von GET /auth/me. */
  ich: { email: 'neu@example.org', role_title: '', created_at: null } as Record<string, unknown>,
  teamerProfil: {
    user: {
      display_name: 'Tjark Test', username: 'tjark.test', email: 'alt@example.org', role_title: '',
      teamer_since: null, organization_name: 'Testgemeinde', bible_translation: 'LUT',
    },
    konfi_data: null,
  } as Record<string, unknown>,
};

export const api = {
  get: vi.fn(),
  put: vi.fn(async () => ({ data: {} })),
  post: vi.fn(async () => ({ data: {} })),
};
export const setUser = vi.fn();
export const tokenStoreSetUser = vi.fn(async () => undefined);
export const refresh = vi.fn(async () => undefined);

/** Props der zuletzt per useIonModal angemeldeten Modale, je Komponentenname. */
export const modale = new Map<string, Record<string, unknown>>();

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    put: (...a: []) => api.put(...a),
    post: (...a: []) => api.post(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: zustand.user, setUser, setError: vi.fn(), setSuccess: vi.fn(), signOut: vi.fn() }),
}));
vi.mock('../../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('teamer:profile') ? zustand.teamerProfil : zustand.ich,
    loading: false, error: null, isStale: false, isOffline: false,
    refresh, refreshLive: vi.fn(),
  }),
}));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/profile', search: '' }) }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../hooks/useMediaCacheControl', () => ({
  useMediaCacheControl: () => ({ cacheLabel: '', clearMediaCache: vi.fn() }),
}));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => {} } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/tokenStore', () => ({ setUser: (...a: unknown[]) => tokenStoreSetUser(...(a as [])) }));
vi.mock('../../../services/analytics', () => ({ trackHandlung: vi.fn(), losungBibelMesswert: () => 'x', track: vi.fn() }));

const { leer, benannt } = vi.hoisted(() => ({
  leer: () => ({ default: () => null }),
  // Eine leere Komponente mit Namen -- damit useIonModal sie zuordnen kann.
  benannt: (name: string) => ({ default: { [name]: () => null }[name] }),
}));
vi.mock('../../../components/shared/EinladungenKarte', () => ({
  default: ({ variante }: { variante?: string }) => <div data-testid="einladungskarte" data-variante={variante} />,
}));
vi.mock('../../../components/shared/ChangeEmailModal', () => benannt('ChangeEmailModal'));
vi.mock('../../../components/shared/ChangePasswordModal', () => benannt('ChangePasswordModal'));
vi.mock('../../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../../components/shared/AppSperreSchalter', leer);
vi.mock('../../../components/shared/PushAuswahl', leer);
vi.mock('../../../components/shared/AbsturzberichteSchalter', leer);
vi.mock('../../../components/admin/modals/ChangeRoleTitleModal', leer);
vi.mock('../../../components/shared/DeleteAccountModal', leer);
vi.mock('../../../components/shared/SpiritFooter', leer);
vi.mock('../../../components/teamer/modals/TeamerOnboardingModal', leer);
vi.mock('../../../components/teamer/modals/TeamerUpdate230WalkthroughModal', leer);
vi.mock('../../../components/konfi/modals/KonfiOnboardingModal', leer);
vi.mock('../../../components/konfi/modals/KonfiUpdate230WalkthroughModal', leer);
vi.mock('../../../components/konfi/modals/PointsHistoryModal', leer);
vi.mock('../../../components/admin/modals/AdminOnboardingModal', leer);
vi.mock('../../../components/admin/modals/AdminUpdate230WalkthroughModal', leer);
vi.mock('../../../components/admin/pages/AdminInvitePage', leer);
vi.mock('../../../components/wrapped/WrappedModal', leer);
vi.mock('../../../components/common/LoadingSpinner', leer);
vi.mock('../../../components/shared/NeuerungenBanner', leer);
vi.mock('../../../components/shared/MitmachenErklaerungModal', leer);
vi.mock('../../../components/shared/InfoModal', leer);
vi.mock('../../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: durch, IonContent: durch, IonList: durch, IonListHeader: durch, IonHeader: durch, IonToolbar: durch,
    IonTitle: durch, IonButtons: durch,
    IonItem: durch, IonLabel: durch, IonCard: durch, IonCardContent: durch, IonNote: durch, IonText: durch,
    IonButton: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
    IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null, IonSpinner: () => null,
    useIonModal: (komponente: { name?: string }, props: Record<string, unknown>) => {
      if (komponente?.name) modale.set(komponente.name, props);
      return [vi.fn(), vi.fn()];
    },
    useIonAlert: () => [vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import ProfileView from '../../../components/konfi/views/ProfileView';
import TeamerProfilePage from '../../../components/teamer/pages/TeamerProfilePage';
import AdminProfilePage from '../../../components/admin/pages/AdminProfilePage';
import AdminSettingsPage from '../../../components/admin/pages/AdminSettingsPage';

export type Rolle = 'konfi' | 'teamer' | 'admin';

const NUTZER: Record<Rolle, Record<string, unknown>> = {
  konfi: { id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1, display_name: 'Emilia Test', email: 'alt@example.org' },
  teamer: { id: 9, type: 'teamer', role_name: 'teamer', organization_id: 1, display_name: 'Tjark Test', email: 'alt@example.org' },
  admin: { id: 4, type: 'admin', role_name: 'admin', organization_id: 1, display_name: 'Pia Pastorin', email: 'alt@example.org' },
};

/** Profildaten der Konfi-Ansicht (GET /konfi/profile). */
export const KONFI_PROFIL = {
  id: 7, display_name: 'Emilia Test', username: 'emilia.test', email: 'alt@example.org', jahrgang_name: '2026/27',
  bible_translation: 'LUT', total_points: 0, gottesdienst_points: 0, gemeinde_points: 0, bonus_points: 0, event_count: 0,
};

export const onReload = vi.fn(async () => undefined);

export function zuruecksetzen() {
  zustand.ich = { email: 'neu@example.org', role_title: '', created_at: null };
  modale.clear();
  for (const f of [api.get, api.put, api.post, setUser, tokenStoreSetUser, refresh, onReload]) f.mockClear();
  api.get.mockReset();
  api.get.mockImplementation(async (pfad: string) => (pfad === '/auth/me' ? { data: zustand.ich } : { data: [] }));
}

/** Das eigene Profil einer Rolle rendern. */
export async function profilOeffnen(rolle: Rolle) {
  zustand.user = { ...NUTZER[rolle] };
  const seite = rolle === 'konfi'
    ? <ProfileView profile={KONFI_PROFIL as never} onReload={onReload} presentingElement={null} />
    : rolle === 'teamer' ? <TeamerProfilePage /> : <AdminProfilePage />;
  const r = render(seite);
  await act(async () => { await Promise.resolve(); });
  return r;
}

/** Den Reiter "Mehr" der Leitung rendern. */
export async function mehrOeffnen() {
  zustand.user = { ...NUTZER.admin };
  const r = render(<AdminSettingsPage />);
  await act(async () => { await Promise.resolve(); });
  return r;
}

/** Das E-Mail-Modal melden lassen, dass gespeichert wurde. */
export async function emailGespeichert() {
  const props = modale.get('ChangeEmailModal');
  if (!props) throw new Error('ChangeEmailModal wurde nicht angemeldet');
  await act(async () => { await (props.onSuccess as () => Promise<void>)(); });
}
