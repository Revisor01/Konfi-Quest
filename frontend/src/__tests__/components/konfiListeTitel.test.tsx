// Der Titel der Konfi-Liste der Leitung (/admin/konfis) folgt dem Segment
// "Konfis | Team" -- wie "Events | Aktivitäten" im Mitmachen-Reiter
// (AdminEventsPage).
//
// Vorher stand dort immer "Konfirmand:innen". Auf Android (Ionic md, Titel
// links neben den Knöpfen) passte das neben Anwesenheit, Neu und Glocke nicht:
// bei 360 px Breite "Konfirmand…", 161 px Text auf 128 px Platz, bei 412 px
// genau auf Kante (180 von 180 px) -- gemessen am 29.09.2026 mit
// Android-Kennung in Chromium (Nebenbefund Paket F). "Konfis" ist auch die
// Beschriftung des Reiters, "Team" die des Segments.
//
// Gerendert wird die Seite; die Kopfzeilen schreiben ihren Titel als Text,
// die Liste ist ein Knopf, der wie der Umschalter die Ansicht meldet.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [], headers: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 4, organization_id: 1, role_name: 'admin', display_name: 'Test Admin 1' },
    setError: vi.fn(),
    setSuccess: vi.fn(),
    isOnline: true,
  }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
}));

// Unter welchen Schluesseln die Seite ihre Listen haelt (und offline liest).
const querySchluessel: string[] = [];
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    querySchluessel.push(schluessel);
    return {
      data: [], loading: false, error: null, isStale: false, isOffline: false,
      refresh: vi.fn().mockResolvedValue(undefined), refreshLive: vi.fn(),
    };
  },
}));

vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));

vi.mock('../../components/admin/KonfisView', () => ({
  default: ({ onViewModeChange }: { onViewModeChange?: (m: 'konfis' | 'teamer') => void }) =>
    React.createElement(React.Fragment, null,
      React.createElement('button', { onClick: () => onViewModeChange?.('teamer') }, 'segment-team'),
      React.createElement('button', { onClick: () => onViewModeChange?.('konfis') }, 'segment-konfis')),
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
  default: ({ titel, rechts }: { titel: React.ReactNode; rechts?: React.ReactNode }) =>
    React.createElement('header', null,
      React.createElement('h1', { 'data-testid': 'titel-kopfzeile' }, titel),
      rechts),
  AppKopfzeileGross: ({ titel }: { titel: React.ReactNode }) =>
    React.createElement('h2', { 'data-testid': 'titel-gross' }, titel),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: durch,
    IonContent: durch,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonButton: ({ children, 'aria-label': label }: { children?: React.ReactNode; 'aria-label'?: string }) =>
      React.createElement('button', { 'aria-label': label }, children),
    IonIcon: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminKonfisPage from '../../components/admin/pages/AdminKonfisPage';

const titel = () => [screen.getByTestId('titel-kopfzeile').textContent, screen.getByTestId('titel-gross').textContent];

describe('Konfi-Liste der Leitung: der Titel folgt dem Segment', () => {
  it('"Konfis" beim Start -- wie der Reiter, nicht "Konfirmand:innen"', () => {
    render(<AdminKonfisPage />);
    expect(titel()).toEqual(['Konfis', 'Konfis']);
    // Die drei Knöpfe bleiben, der Titel macht ihnen Platz.
    expect(screen.getByRole('button', { name: 'Anwesenheit und Konfisprüche anzeigen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neuen Konfi anlegen' })).toBeTruthy();
  });

  it('"Team", wenn das Segment Team zeigt, und zurück', () => {
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByText('segment-team'));
    expect(titel()).toEqual(['Team', 'Team']);
    expect(screen.getByRole('button', { name: 'Neue Teamer:in anlegen' })).toBeTruthy();

    fireEvent.click(screen.getByText('segment-konfis'));
    expect(titel()).toEqual(['Konfis', 'Konfis']);
  });
});

describe('Offline-Grundstand der Personenansicht', () => {
  // adminKonfiDetailOffline: Die Personenansicht liest offline den Listen-
  // Cache 'admin:konfis:<Gemeinde>'. Dort muss die Liste ihn auch ablegen.
  it('die Liste haelt ihre Konfis unter admin:konfis:<Gemeinde>', () => {
    querySchluessel.length = 0;
    render(<AdminKonfisPage />);
    expect(querySchluessel).toContain('admin:konfis:1');
  });
});
