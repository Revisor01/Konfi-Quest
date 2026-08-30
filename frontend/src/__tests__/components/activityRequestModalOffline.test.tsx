import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

// Offline-Lücke (Audit 25.08.2026): Der VERSAND einer Aktivitätsmeldung ist
// queue-fähig, aber die Auswahlliste im Modal lud per api.get — offline war
// die Liste leer und das Formular nutzlos. Diese Tests sichern ab, dass die
// Liste über useOfflineQuery (Cache) kommt statt über einen Direkt-Abruf.

// --- Mocks ---

const mockApiGet = vi.fn().mockResolvedValue({ data: [] });
const mockApiPost = vi.fn().mockResolvedValue({ data: {} });
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: vi.fn() },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: false, subscribe: vi.fn(() => () => {}) },
}));

vi.mock('../../services/mediaCompression', () => ({
  compressForUpload: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Data: 'DATA' },
}));

vi.mock('../../utils/uuid', () => ({ safeUUID: () => 'test-uuid' }));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, organization_id: 3, type: 'konfi' },
    setSuccess: vi.fn(),
    setError: vi.fn(),
    isOnline: false,
  }),
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: any) => fn }),
}));

// useOfflineQuery steuerbar mocken: Aufrufe aufzeichnen, gecachte Aktivitäten
// liefern — so wie es offline mit gefülltem Cache aussieht.
const offlineQueryCalls: Array<{ key: string; options?: any }> = [];
const gecachteAktivitaeten = [
  { id: 1, name: 'Gottesdienst besucht', points: 2, type: 'gottesdienst' },
  { id: 2, name: 'Gemeindefest geholfen', points: 3, type: 'gemeinde' },
];
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (key: string, _fetcher: any, options?: any) => {
    offlineQueryCalls.push({ key, options });
    return {
      data: gecachteAktivitaeten,
      loading: false,
      error: null,
      isStale: false,
      isOffline: true,
      refresh: vi.fn(),
      refreshLive: vi.fn(),
    };
  },
}));

vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonButtons: passthrough,
    IonButton: passthrough,
    IonIcon: () => null,
    IonCard: passthrough,
    IonCardContent: passthrough,
    IonItem: passthrough,
    IonLabel: passthrough,
    IonTextarea: () => null,
    IonDatetime: () => null,
    IonDatetimeButton: () => null,
    IonModal: passthrough,
    IonProgressBar: () => null,
    IonList: passthrough,
    IonListHeader: passthrough,
    IonAccordion: passthrough,
    IonAccordionGroup: passthrough,
    useIonAlert: () => [vi.fn()],
  };
});

import ActivityRequestModal from '../../components/konfi/modals/ActivityRequestModal';
import TeamerActivityRequestModal from '../../components/teamer/modals/TeamerActivityRequestModal';
import { CACHE_TTL } from '../../services/offlineCache';

describe('Aktivität melden: Auswahlliste offline (aus dem Cache)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineQueryCalls.length = 0;
  });

  it('Konfi-Modal lädt die Aktivitäten über useOfflineQuery mit STAMMDATEN-TTL', () => {
    const { getByText } = render(
      <ActivityRequestModal onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    const call = offlineQueryCalls.find(c => c.key.startsWith('konfi:activities:'));
    expect(call).not.toBe(undefined);
    expect(call!.options?.ttl).toBe(CACHE_TTL.STAMMDATEN);

    // Gecachte Aktivitäten sind offline auswählbar (sichtbar in der Liste)
    expect(getByText('Gottesdienst besucht')).toBeTruthy();
    expect(getByText('Gemeindefest geholfen')).toBeTruthy();

    // Kein Direkt-Abruf mehr am Cache vorbei
    expect(mockApiGet).not.toHaveBeenCalledWith('/konfi/activities');
  });

  it('Teamer-Modal lädt die Aktivitäten über useOfflineQuery mit STAMMDATEN-TTL', () => {
    const { getByText } = render(
      <TeamerActivityRequestModal onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    const call = offlineQueryCalls.find(c => c.key.startsWith('teamer:activities:'));
    expect(call).not.toBe(undefined);
    expect(call!.options?.ttl).toBe(CACHE_TTL.STAMMDATEN);

    expect(getByText('Gottesdienst besucht')).toBeTruthy();
    expect(getByText('Gemeindefest geholfen')).toBeTruthy();

    expect(mockApiGet).not.toHaveBeenCalledWith('/teamer/activities');
  });
});
