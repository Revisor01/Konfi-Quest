import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// Simon, 01.10.2026, zum Teamer-Profil: Unter dem Namen „soll die
// Selbstbezeichnung stehen, die man sich geben kann". Das ist users.role_title
// (GET /teamer/profile liefert es als user.role_title, gesetzt über
// „Funktionsbeschreibung" im selben Profil). Ohne eigene Bezeichnung steht
// „Teamer:in" -- wie auf der Startseite. Eine Bezeichnung aus lauter
// Leerzeichen ist keine: dann ebenfalls „Teamer:in" statt einer leeren Zeile.
//
// Das Profil der Leitung zeigt „Leitung · <Bezeichnung>" (GET /auth/me
// liefert role_title flach). Dort dieselbe Lücke: Leerzeichen ergaben
// „Leitung · " mit leerem Rest.

const { stand } = vi.hoisted(() => ({
  stand: {
    nutzer: { id: 9, organization_id: 1, role_name: 'teamer', display_name: 'Tjark Test' },
    teamerProfil: {
      user: {
        display_name: 'Tjark Test',
        username: 'tjark.test',
        email: '',
        role_title: '',
        teamer_since: null,
        organization_name: 'Testgemeinde',
        bible_translation: 'LUT',
      },
      konfi_data: null,
    },
    /** Antwort von GET /auth/me fürs Leitungsprofil. */
    ich: { role_title: '' as string | undefined, email: '', created_at: null },
  },
}));

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('teamer:profile') ? stand.teamerProfil : stand.ich,
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: vi.fn(async () => undefined),
    refreshLive: vi.fn(),
  }),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: stand.nutzer,
    setUser: vi.fn(), setError: vi.fn(), signOut: vi.fn(),
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
}));
vi.mock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ pathname: '/profile', search: '' }),
}));
vi.mock('../../hooks/useMediaCacheControl', () => ({
  useMediaCacheControl: () => ({ cacheLabel: '', clearMediaCache: vi.fn() }),
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/tokenStore', () => ({ setUser: vi.fn() }));

// Kinder, um die es hier nicht geht.
const { leer } = vi.hoisted(() => ({ leer: () => ({ default: () => null }) }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/shared/ChangeEmailModal', leer);
vi.mock('../../components/shared/ChangePasswordModal', leer);
vi.mock('../../components/shared/AppSperreSchalter', leer);
vi.mock('../../components/shared/EinladungenKarte', leer);
vi.mock('../../components/shared/PushAuswahl', leer);
vi.mock('../../components/shared/AbsturzberichteSchalter', leer);
vi.mock('../../components/admin/modals/ChangeRoleTitleModal', leer);
vi.mock('../../components/shared/DeleteAccountModal', leer);
vi.mock('../../components/shared/SpiritFooter', leer);
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', leer);
vi.mock('../../components/teamer/modals/TeamerUpdate230WalkthroughModal', leer);
vi.mock('../../components/wrapped/WrappedModal', leer);
vi.mock('../../components/common/LoadingSpinner', leer);
vi.mock('../../components/shared/NeuerungenBanner', leer);
vi.mock('../../components/shared/MitmachenErklaerungModal', leer);
vi.mock('../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));

// Ionic als schlichte Elemente: Inhalt durchreichen, Hooks als Attrappen.
vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: durch, IonContent: durch, IonList: durch, IonListHeader: durch,
    IonItem: durch, IonLabel: durch, IonCard: durch, IonCardContent: durch,
    IonButton: durch,
    IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import TeamerProfilePage from '../../components/teamer/pages/TeamerProfilePage';
import AdminProfilePage from '../../components/admin/pages/AdminProfilePage';

/** Die Zeile direkt unter dem Namen im Kopf des Profils. */
const zeileUnterDemNamen = (container: HTMLElement) =>
  container.querySelector('.app-detail-header__subtitle')?.textContent;

describe('Teamer-Profil: Selbstbezeichnung unter dem Namen', () => {
  beforeEach(() => {
    stand.nutzer = { id: 9, organization_id: 1, role_name: 'teamer', display_name: 'Tjark Test' };
    stand.teamerProfil.user.role_title = '';
  });

  it('zeigt die eigene Bezeichnung, wenn eine gesetzt ist', () => {
    stand.teamerProfil.user.role_title = 'Teamerin';
    const { container } = render(<TeamerProfilePage />);
    expect(screen.getByText('Tjark Test')).toBeInTheDocument();
    expect(zeileUnterDemNamen(container)).toBe('Teamerin');
  });

  it('zeigt die Bezeichnung ohne Leerzeichen am Rand', () => {
    stand.teamerProfil.user.role_title = '  Jugendleiterin ';
    const { container } = render(<TeamerProfilePage />);
    expect(zeileUnterDemNamen(container)).toBe('Jugendleiterin');
  });

  it('zeigt ohne Bezeichnung „Teamer:in"', () => {
    const { container } = render(<TeamerProfilePage />);
    expect(zeileUnterDemNamen(container)).toBe('Teamer:in');
  });

  it('zeigt bei einer Bezeichnung aus lauter Leerzeichen „Teamer:in"', () => {
    stand.teamerProfil.user.role_title = '   ';
    const { container } = render(<TeamerProfilePage />);
    expect(zeileUnterDemNamen(container)).toBe('Teamer:in');
  });
});

describe('Profil der Leitung: Rolle und Selbstbezeichnung unter dem Namen', () => {
  beforeEach(() => {
    stand.nutzer = { id: 4, organization_id: 1, role_name: 'admin', display_name: 'Pia Pastorin' };
    stand.ich.role_title = '';
  });

  it('zeigt „Leitung · <Bezeichnung>", wenn eine gesetzt ist', () => {
    stand.ich.role_title = 'Pastorin';
    const { container } = render(<AdminProfilePage />);
    expect(zeileUnterDemNamen(container)).toBe('Leitung · Pastorin');
  });

  it('zeigt ohne Bezeichnung nur die Rolle', () => {
    const { container } = render(<AdminProfilePage />);
    expect(zeileUnterDemNamen(container)).toBe('Leitung');
  });

  it('zeigt bei lauter Leerzeichen nur die Rolle -- kein „Leitung · " mit leerem Rest', () => {
    stand.ich.role_title = '   ';
    const { container } = render(<AdminProfilePage />);
    expect(zeileUnterDemNamen(container)).toBe('Leitung');
  });
});
