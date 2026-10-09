import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Der Einstieg "Konfi-Historie" im Teamer-Profil (Befund 7.2, 12.09.2026).
//
// Er hing an `profile.konfi_data?.jahrgang_name`. Wird der Jahrgang einer
// frueheren Konfizeit geloescht, liefert das Backend konfi_data WEITER — nur
// jahrgang_name ist dann leer. Der Einstieg verschwand damit, obwohl Punkte
// und Abzeichen aus dieser Zeit unveraendert dahinter liegen.
//
// Gerendert wird die Profilseite mit den drei Antwortformen von
// GET /teamer/profile. Die Antwort selbst prueft das Backend am Server:
// backend/tests/routes/teamer.test.js, "GET /api/teamer/profile" --
// reine Teamer:in ohne konfi_profiles-Eintrag bekommt konfi_data null,
// befoerderte Konfi OHNE Jahrgang bekommt konfi_data mit Punkten und
// jahrgang_name ''.

type KonfiDaten = {
  gottesdienst_points: number;
  gemeinde_points: number;
  jahrgang_name?: string;
  badges: unknown[];
} | null;

const { stand, push } = vi.hoisted(() => ({
  push: vi.fn(),
  stand: {
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
      konfi_data: null as KonfiDaten,
    },
  },
}));

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: stand.teamerProfil,
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
    user: { id: 9, organization_id: 1, role_name: 'teamer', display_name: 'Tjark Test' },
    setUser: vi.fn(), setError: vi.fn(), signOut: vi.fn(),
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ pathname: '/profile', search: '' }),
}));
vi.mock('../../hooks/useMediaCacheControl', () => ({
  useMediaCacheControl: () => ({ cacheLabel: '', clearMediaCache: vi.fn() }),
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/tokenStore', () => ({ setUser: vi.fn() }));

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

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: durch, IonContent: durch, IonList: durch, IonListHeader: durch,
    IonItem: durch, IonLabel: durch, IonCard: durch, IonCardContent: durch,
    IonButton: durch,
    IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn()],
    useIonRouter: () => ({ push }),
  };
});

import TeamerProfilePage from '../../components/teamer/pages/TeamerProfilePage';

const konfiZeit = (jahrgang_name?: string): KonfiDaten => ({
  gottesdienst_points: 7,
  gemeinde_points: 4,
  ...(jahrgang_name === undefined ? {} : { jahrgang_name }),
  badges: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  stand.teamerProfil.konfi_data = null;
});

describe('Konfi-Historie haengt an den Daten, nicht am Jahrgangsnamen', () => {
  it('zeigt den Einstieg, sobald es eine Konfi-Vergangenheit gibt', () => {
    stand.teamerProfil.konfi_data = konfiZeit('Jahrgang 2024');
    render(<TeamerProfilePage />);
    fireEvent.click(screen.getByText('Konfi-Historie'));
    expect(push).toHaveBeenCalledWith('/teamer/profile/konfi-stats');
  });

  it('macht den Einstieg NICHT vom Jahrgangsnamen abhaengig -- leerer Name (Jahrgang geloescht)', () => {
    // Genau dieser Fall war der Fehler: Das Backend liefert jahrgang_name ''.
    stand.teamerProfil.konfi_data = konfiZeit('');
    render(<TeamerProfilePage />);
    expect(screen.getAllByText('Konfi-Historie')).toHaveLength(1);
  });

  it('behandelt den Jahrgangsnamen als optional -- auch ohne das Feld steht der Einstieg', () => {
    stand.teamerProfil.konfi_data = konfiZeit();
    render(<TeamerProfilePage />);
    expect(screen.getAllByText('Konfi-Historie')).toHaveLength(1);
  });

  it('reine Teamer:innen ohne Konfi-Vergangenheit (konfi_data null) sehen ihn nicht', () => {
    // Fuer sie fuehrte der Einstieg ins Leere.
    render(<TeamerProfilePage />);
    expect(screen.getByText('Tjark Test')).toBeInTheDocument();
    expect(screen.queryByText('Konfi-Historie')).toBeNull();
  });
});
