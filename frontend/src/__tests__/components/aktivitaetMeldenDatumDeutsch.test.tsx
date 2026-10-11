// „Aktivität melden" in der App: Das Datum steht deutsch da (Befund
// 11.10.2026). Der Knopf des Datums (IonDatetimeButton) zeigte bei Konfis und
// beim Team „Oct 11, 2026": Er übernimmt Sprache und Format vom verknüpften
// IonDatetime, und dem fehlte `locale` -- anders als bei Bonuspunkten,
// Aktivität eintragen, Zertifikat und „Teamer:in seit", die "de-DE" tragen.
//
// Gerendert wird das Modal der App; die Attrappe des Kalenders hält fest,
// mit welchen Werten er gezeichnet wird.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

const h = vi.hoisted(() => ({
  kalender: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn() } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 7, organization_id: 3 }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: [], loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn() }),
}));
vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButtons: durch,
    IonButton: durch, IonCard: durch, IonCardContent: durch, IonItem: durch, IonLabel: durch, IonList: durch,
    IonListHeader: durch, IonAccordion: durch, IonAccordionGroup: durch, IonModal: durch,
    IonIcon: () => null, IonTextarea: () => null, IonDatetimeButton: () => null,
    IonDatetime: (props: Record<string, unknown>) => { h.kalender.push(props); return null; },
    useIonAlert: () => [vi.fn()],
  };
});

import KonfiAktivitaetMelden from '../../components/konfi/modals/ActivityRequestModal';
import TeamerAktivitaetMelden from '../../components/teamer/modals/TeamerActivityRequestModal';

beforeEach(() => { h.kalender.length = 0; });

describe('Aktivität melden (App): der Kalender spricht Deutsch', () => {
  it.each([
    ['Konfi', KonfiAktivitaetMelden],
    ['Team', TeamerAktivitaetMelden],
  ])('%s: das Datum trägt locale "de-DE" und beginnt die Woche am Montag', (_rolle, Modal) => {
    render(<Modal onClose={vi.fn()} onSuccess={vi.fn()} />);
    const kalender = h.kalender.at(-1)!;
    expect(kalender.id).toBe('date-picker');
    expect(kalender.presentation).toBe('date');
    expect(kalender.locale).toBe('de-DE');
    expect(kalender.firstDayOfWeek).toBe(1);
  });
});
