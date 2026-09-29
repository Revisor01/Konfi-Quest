// Die Rückfragen vor dem Löschen eines Kontos nennen, was verschwindet
// (28.09.2026; Audit 26.09.2026, Leitung BF-10).
//
// Simon, 28.09.2026: "konto löschen muss wirklich alles löschen." Das Backend
// löscht seitdem auf allen Wegen dasselbe; die Rückfragen sagen es in einem
// Wortlaut (utils/kontoLoeschen.ts). Vorher nannte die Konfi-Abfrage nur
// "Punkte, Badges, Aktivitäten und Chat-Nachrichten" -- nicht Event-
// Anmeldungen, Challenge-Beiträge und Fotos --, die Abfrage unter
// "Benutzer:innen" gar nichts, die Selbstlöschung "Punkte, Badges, Einträge".
//
// Geprüft wird, was die Seite anzeigt: AdminKonfisPage mit Alert-Nachbau,
// DeleteAccountModal gerendert je Rolle.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TeamerListenEintrag } from '../../types/user';
// Die Seite reicht die Konfi nur durch; die Abfrage liest id und name.
interface Konfi { id: number; name: string }

interface AlertKnopf { text: string; role?: string; handler?: () => unknown | Promise<unknown> }
interface AlertOptionen { header?: string; message?: string; buttons: AlertKnopf[] }

let offenerAlert: AlertOptionen | null = null;
const presentAlert = (optionen: AlertOptionen) => { offenerAlert = optionen; };
let rolle = 'org_admin';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [], headers: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 5, organization_id: 1, role_name: rolle, display_name: 'Jemand' },
    setError: vi.fn(),
    setSuccess: vi.fn(),
    signOut: vi.fn(),
    isOnline: true,
  }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
}));

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [],
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshLive: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));

const konfi: Konfi = { id: 1, name: 'Test Konfi 1' };
const teamer: TeamerListenEintrag = { id: 3, name: 'Test Teamer 1', username: 'teamer1' };

vi.mock('../../components/admin/KonfisView', () => ({
  default: ({ onDeleteKonfi, onDeleteTeamer }: {
    onDeleteKonfi: (k: Konfi) => void;
    onDeleteTeamer: (t: TeamerListenEintrag) => void;
  }) => React.createElement(React.Fragment, null,
    React.createElement('button', { onClick: () => onDeleteKonfi(konfi) }, 'konfi-loeschen'),
    React.createElement('button', { onClick: () => onDeleteTeamer(teamer) }, 'teamer-loeschen'),
  ),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: durch,
    IonHeader: durch,
    IonToolbar: durch,
    IonTitle: durch,
    IonContent: durch,
    IonCard: durch,
    IonCardContent: durch,
    IonItem: durch,
    IonLabel: durch,
    IonList: durch,
    IonListHeader: durch,
    IonText: durch,
    IonButtons: durch,
    IonButton: durch,
    IonInput: () => null,
    IonSpinner: () => null,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonIcon: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminKonfisPage from '../../components/admin/pages/AdminKonfisPage';
import DeleteAccountModal from '../../components/shared/DeleteAccountModal';

// Was jede Rückfrage nennen muss -- BF-10 vermisste die ersten drei.
const MUSS_NENNEN = ['Event-Anmeldungen', 'Challenge-Beiträge', 'Anträge samt Fotos', 'Punkte', 'Badges',
  'Stempel', 'Chat-Nachrichten', 'Zweiergespräche'];

beforeEach(() => {
  offenerAlert = null;
  rolle = 'org_admin';
});

describe('Rückfragen vor dem Löschen eines Kontos', () => {
  it('Konfi löschen nennt alles, was verschwindet, und das Nachrücken', () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByText('konfi-loeschen'));

    expect(offenerAlert?.header).toBe('Konfi wirklich löschen?');
    expect(offenerAlert?.message).toBe(
      '"Test Konfi 1" wird unwiderruflich gelöscht.\n\n'
      + 'Mit dem Konto verschwinden Punkte, Badges, Stempel, Anträge samt Fotos, Event-Anmeldungen, '
      + 'Challenge-Beiträge, Chat-Nachrichten und Zweiergespräche. Auf frei werdende Plätze bei Events '
      + 'rückt die Warteliste nach. Das lässt sich nicht rückgängig machen.'
    );
    expect(offenerAlert?.buttons.map(b => b.text)).toEqual(['Abbrechen', 'Endgültig löschen']);
  });

  it('Teamer:in löschen nennt, was verschwindet und was der Gemeinde bleibt', () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByText('teamer-loeschen'));

    const text = offenerAlert?.message ?? '';
    for (const wort of MUSS_NENNEN) expect(text).toContain(wort);
    expect(text).toContain('Was die Person für die Gemeinde angelegt hat — Events, Material, Badges, Challenges —, bleibt ohne ihren Namen.');
  });

  it('eigenes Konto als Konfi: nennt alles, ohne Gemeinde-Satz', () => {
    rolle = 'konfi';
    render(<DeleteAccountModal onClose={vi.fn()} />);

    const text = screen.getByText(/Dein Account wird endgültig gelöscht/).textContent ?? '';
    expect(text).toBe(
      'Dein Account wird endgültig gelöscht. Dieser Vorgang kann NICHT rückgängig gemacht werden. '
      + 'Mit ihm verschwinden deine Punkte, Badges, Stempel, Anträge samt Fotos, Event-Anmeldungen, '
      + 'Challenge-Beiträge, Chat-Nachrichten und Zweiergespräche.'
    );
  });

  it('eigenes Konto im Team: alle Gemeinden, und was der Gemeinde bleibt', () => {
    rolle = 'teamer';
    render(<DeleteAccountModal onClose={vi.fn()} />);

    const text = screen.getByText(/Dein Account wird endgültig gelöscht/).textContent ?? '';
    for (const wort of MUSS_NENNEN) expect(text).toContain(wort);
    expect(text).toContain('in allen Gemeinden, in denen du mitarbeitest');
    expect(text).toContain('Was du für die Gemeinde angelegt hast, bleibt ohne deinen Namen.');
  });
});
