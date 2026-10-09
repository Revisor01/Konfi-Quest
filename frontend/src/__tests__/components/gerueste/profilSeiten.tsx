// Gerüst für gerenderte Tests der eigenen Profile von Konfis
// (konfi/views/ProfileView.tsx) und Team (teamer/pages/TeamerProfilePage.tsx).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (BF-02,
// 09.10.2026): profilAbzeichenZahlOhneZusatzabruf und
// profilWrappedReihenfolge lasen dafür die Quelldateien und verglichen die
// Stellen von Kommentaren.
//
// EINBINDEN wie die anderen Gerüste: dieses Modul als ERSTES importieren.
//
// Gerendert werden die ECHTEN Profile mit echtem Ionic. Nachgestellt sind:
// der Server (`zustand.antworten` je GET-Pfad, jeder Aufruf mitgeschrieben),
// die Anmeldung, der Zwischenspeicher (holt einmal über die echte
// Abruf-Funktion), Netz und Warteschlange, und die Bausteine, um die es hier
// nicht geht (Modale, Schalter, Kopfzeile). Die Neuerungs-Banner stehen als
// Marke `[data-marke="neuerungen"]` -- ihre STELLE ist prüfbar, ihr Inhalt
// hat eigene Tests.
import React from 'react';
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';

export const zustand = {
  user: { id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1, display_name: 'Emilia Test' } as Record<string, unknown>,
  antworten: new Map<string, unknown>(),
};

/** Namen der Komponenten, die per useIonModal geoeffnet wurden. */
export const geoeffnet: string[] = [];

export const api = {
  get: vi.fn(async (pfad: string) => ({ data: zustand.antworten.has(pfad) ? zustand.antworten.get(pfad) : [] })),
  put: vi.fn(async () => ({ data: {} })),
  post: vi.fn(async () => ({ data: {} })),
};

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: [string]) => api.get(...a),
    put: (...a: []) => api.put(...a),
    post: (...a: []) => api.post(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: zustand.user, setUser: vi.fn(), setError: vi.fn(), setSuccess: vi.fn(), signOut: vi.fn() }),
}));
vi.mock('../../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', async () => {
  const R = await import('react');
  return {
    useOfflineQuery: (schluessel: string, holen: () => Promise<unknown>) => {
      const [data, setData] = R.useState<unknown>(null);
      R.useEffect(() => { void holen().then(setData); }, [schluessel]);
      return { data, loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(async () => undefined), refreshLive: vi.fn() };
    },
  };
});
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/profile', search: '' }) }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../../hooks/useMediaCacheControl', () => ({
  useMediaCacheControl: () => ({ cacheLabel: '', clearMediaCache: vi.fn() }),
}));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => {} } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/tokenStore', () => ({ setUser: vi.fn() }));
vi.mock('../../../services/analytics', () => ({ trackHandlung: vi.fn(), losungBibelMesswert: () => 'x', track: vi.fn() }));

const { leer } = vi.hoisted(() => ({ leer: () => ({ default: () => null }) }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../../components/shared/ChangeEmailModal', leer);
vi.mock('../../../components/shared/ChangePasswordModal', leer);
vi.mock('../../../components/shared/AppSperreSchalter', leer);
vi.mock('../../../components/shared/EinladungenKarte', leer);
vi.mock('../../../components/shared/PushAuswahl', leer);
vi.mock('../../../components/shared/AbsturzberichteSchalter', leer);
vi.mock('../../../components/admin/modals/ChangeRoleTitleModal', leer);
vi.mock('../../../components/shared/DeleteAccountModal', leer);
vi.mock('../../../components/shared/SpiritFooter', leer);
vi.mock('../../../components/konfi/modals/PointsHistoryModal', leer);
vi.mock('../../../components/konfi/modals/KonfiOnboardingModal', leer);
vi.mock('../../../components/konfi/modals/KonfiUpdate230WalkthroughModal', leer);
vi.mock('../../../components/teamer/modals/TeamerOnboardingModal', leer);
vi.mock('../../../components/teamer/modals/TeamerUpdate230WalkthroughModal', leer);
vi.mock('../../../components/wrapped/WrappedModal', () => ({ default: function WrappedModal() { return null; } }));
vi.mock('../../../components/common/LoadingSpinner', leer);
vi.mock('../../../components/shared/MitmachenErklaerungModal', leer);
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => <div data-marke="neuerungen" /> }));
vi.mock('../../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
  // Geoeffnete Modale werden mitgeschrieben (Name der Komponente), statt
  // ein echtes Overlay aufzubauen.
  useIonModal: (komponente: { name?: string } | undefined) => [
    () => { geoeffnet.push(komponente?.name || 'unbekannt'); },
    () => {},
  ],
}));

import ProfileView from '../../../components/konfi/views/ProfileView';
import TeamerProfilePage from '../../../components/teamer/pages/TeamerProfilePage';

export const KONFI = { id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1, display_name: 'Emilia Test' };
export const TEAMER = { id: 9, type: 'teamer', role_name: 'teamer', organization_id: 1, display_name: 'Tjark Test' };

/** Ein Konfi-Profil, wie GET /konfi/profile es liefert. */
export const konfiProfil = (zusatz: Record<string, unknown> = {}) => ({
  id: 7, username: 'emilia', display_name: 'Emilia Test', jahrgang_name: '2026', jahrgang_year: 2026,
  created_at: '2025-09-01T10:00:00Z', total_points: 12, badge_count: 24, activity_count: 3, event_count: 2,
  pending_requests: 0, bible_translation: 'LUT',
  progress_overview: { monthly_points: [], achievements: { total_activities: 0, total_events: 0, total_badges: 0 } },
  ...zusatz,
});

/** Antwort von GET /teamer/profile. */
export const teamerProfil = () => ({
  user: {
    display_name: 'Tjark Test', username: 'tjark.test', email: '', role_title: '', teamer_since: null,
    organization_name: 'Testgemeinde', bible_translation: 'LUT',
  },
  konfi_data: null,
});

export const rueckblick = (id: number, titel: string | null, year = 2026) => ({
  id, year, titel, wrapped_type: 'konfi', computed_at: '2026-06-01T10:00:00Z', data: {},
});

export const zuruecksetzen = (user: Record<string, unknown> = KONFI) => {
  zustand.user = user;
  zustand.antworten = new Map<string, unknown>([['/challenges/konfi', { active: [], archive: [], marks: [] }]]);
  api.get.mockClear();
  api.put.mockClear();
  api.post.mockClear();
  geoeffnet.length = 0;
};

export const warte = async (runden = 6) => {
  for (let i = 0; i < runden; i += 1) await act(async () => { await Promise.resolve(); });
};

export const zeigeKonfiProfil = async (profil = konfiProfil()) => {
  const r = render(<ProfileView profile={profil as never} onReload={vi.fn()} presentingElement={null} />);
  await warte();
  return r;
};

export const zeigeTeamerProfil = async () => {
  const r = render(<TeamerProfilePage />);
  await warte();
  return r;
};

/** Die Kacheln im Kopf des Profils, als [Beschriftung, Wert]. */
export const kacheln = (container: HTMLElement) =>
  [...container.querySelectorAll('.app-stats-row__item')].map((k) => [
    k.querySelector('.app-stats-row__label')?.textContent ?? '',
    k.querySelector('.app-stats-row__value')?.textContent ?? '',
  ]);

/** Sortiert benannte Elemente in Dokument-Reihenfolge; fehlt eins, faellt der Test. */
export const reihenfolge = (marken: Record<string, Element | null | undefined>) =>
  Object.entries(marken)
    .map(([name, el]) => {
      if (!el) throw new Error(`nicht gefunden: ${name}`);
      return { name, el };
    })
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((m) => m.name);
