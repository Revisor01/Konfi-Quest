import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';

// Orange Zahl in den Reiter-Knoepfen der Events-Seite der Leitung
// (Simon, 28.09.2026, zur Ansicht): "Events" = Termine, die auf Verbuchung
// warten, "Aktivitaeten" = offene Antraege -- dieselben Zahlen wie am
// Events-Reiter unten (pendingEventsCount + pendingRequestsCount), nur
// Wartendes. Die Unter-Reiter "Verbuchen" und "Offen" bekommen dieselbe
// Zahl durchgereicht.

let badge = { pendingEventsCount: 0, pendingRequestsCount: 0 };
let eventsViewProps: Record<string, unknown> = {};


vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => badge }));
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [], headers: {} }),
    put: vi.fn(), post: vi.fn(), delete: vi.fn(),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, organization_id: 1, type: 'admin', role_name: 'org_admin' },
    setSuccess: vi.fn(), setError: vi.fn(), isOnline: true,
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: () => {},
}));
vi.mock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ search: '', pathname: '/admin/events' }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [], loading: false, error: null, isStale: false, isOffline: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshLive: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../components/admin/EventsView', () => ({
  default: (props: Record<string, unknown>) => {
    eventsViewProps = props;
    return React.createElement('div', null, props.headerSlot as React.ReactNode);
  },
}));
vi.mock('../../components/admin/ActivityRequestsView', () => ({
  default: () => null,
}));
vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ActivityRequestModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));
vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const knopf = ({ children, value }: { children?: React.ReactNode; value?: string }) =>
    React.createElement('div', { 'data-segment': value }, children);
  return {
    IonPage: passthrough, IonHeader: passthrough, IonToolbar: passthrough,
    IonTitle: passthrough, IonContent: passthrough, IonButtons: passthrough,
    IonButton: passthrough, IonLabel: passthrough, IonSegment: passthrough,
    IonSegmentButton: knopf,
    IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminEventsPage from '../../components/admin/pages/AdminEventsPage';

const oeffne = async () => {
  const r = render(<AdminEventsPage />);
  await act(async () => { await Promise.resolve(); });
  return r;
};
const zahlIn = (container: HTMLElement, segment: string) =>
  container.querySelector(`[data-segment="${segment}"] .app-segment-zahl`);

beforeEach(() => {
  cleanup();
  eventsViewProps = {};
});

describe('AdminEventsPage: orange Wartezahl im Reiter-Knopf', () => {
  it('3 Termine zum Verbuchen, 2 offene Antraege: Events 3, Aktivitaeten 2', async () => {
    badge = { pendingEventsCount: 3, pendingRequestsCount: 2 };
    const { container } = await oeffne();
    expect(zahlIn(container, 'events')?.textContent).toBe('3');
    expect(zahlIn(container, 'events')?.getAttribute('aria-label')).toBe('3 Events warten auf Verbuchung');
    expect(zahlIn(container, 'antraege')?.textContent).toBe('2');
    expect(zahlIn(container, 'antraege')?.getAttribute('aria-label')).toBe('2 Anträge warten auf Entscheidung');
    // Dieselbe Zahl geht an den Unter-Reiter "Verbuchen".
    expect(eventsViewProps.wartendVerbuchen).toBe(3);
  });

  it('nichts wartet: keine Zahl an beiden Knoepfen', async () => {
    badge = { pendingEventsCount: 0, pendingRequestsCount: 0 };
    const { container } = await oeffne();
    expect(zahlIn(container, 'events')).toBeNull();
    expect(zahlIn(container, 'antraege')).toBeNull();
    expect(eventsViewProps.wartendVerbuchen).toBe(0);
  });

  it('Einzahl im Vorlesetext', async () => {
    badge = { pendingEventsCount: 1, pendingRequestsCount: 1 };
    const { container } = await oeffne();
    expect(zahlIn(container, 'events')?.getAttribute('aria-label')).toBe('1 Event wartet auf Verbuchung');
    expect(zahlIn(container, 'antraege')?.getAttribute('aria-label')).toBe('1 Antrag wartet auf Entscheidung');
  });
});
