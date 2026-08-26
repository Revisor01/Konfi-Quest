import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Befund 26.08.2026: Pro Jahrgang laesst sich eine Punkteart abschalten
// (jahrgaenge.gottesdienst_enabled / gemeinde_enabled). Die Konfi-Ansicht
// beruecksichtigte das, der gesamte Leitungs-Baum nicht -- BonusModal und
// ActivityModal boten die abgeschaltete Art weiter an, und die Leitung lief
// erst beim Speichern in eine Fehlermeldung des Servers (400).
//
// Diese Tests pruefen beide Faelle: die abgeschaltete Art darf NICHT
// erscheinen, die aktive MUSS erscheinen. Ohne den zweiten Teil wuerde ein
// Modal, das gar keine Auswahl mehr anzeigt, faelschlich als repariert gelten.

// --- Mocks ---

const mockApiGet = vi.fn().mockResolvedValue({ data: [] });
const mockApiPost = vi.fn().mockResolvedValue({ data: {} });
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: vi.fn() },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

vi.mock('../../utils/uuid', () => ({ safeUUID: () => 'test-uuid' }));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, organization_id: 1, type: 'admin' },
    setSuccess: vi.fn(),
    setError: vi.fn(),
    isOnline: true,
  }),
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({
    isSubmitting: false,
    guard: async (fn: () => Promise<void>) => fn(),
  }),
}));

import BonusModal from '../../components/admin/modals/BonusModal';
import ActivityModal from '../../components/admin/modals/ActivityModal';

const noop = () => {};
const noopAsync = async () => {};

describe('Punkteart ausblenden: Leitungs-Modale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: [] });
  });

  describe('BonusModal', () => {
    const renderModal = (punkteartFlags?: {
      gottesdienst_enabled?: boolean;
      gemeinde_enabled?: boolean;
    }) =>
      render(
        <BonusModal
          konfiId={1}
          onClose={noop}
          onSave={noopAsync}
          punkteartFlags={punkteartFlags}
        />
      );

    it('bietet beide Arten an, wenn beide aktiv sind', () => {
      renderModal({ gottesdienst_enabled: true, gemeinde_enabled: true });
      expect(screen.getByText('Gottesdienst')).toBeTruthy();
      expect(screen.getByText('Gemeinde')).toBeTruthy();
    });

    it('bietet Gemeinde NICHT an, wenn Gemeinde abgeschaltet ist', () => {
      renderModal({ gottesdienst_enabled: true, gemeinde_enabled: false });
      expect(screen.queryByText('Gemeinde')).toBeNull();
      // Gegenprobe: die aktive Art ist weiterhin da.
      expect(screen.getByText('Gottesdienst')).toBeTruthy();
    });

    it('bietet Gottesdienst NICHT an, wenn Gottesdienst abgeschaltet ist', () => {
      renderModal({ gottesdienst_enabled: false, gemeinde_enabled: true });
      expect(screen.queryByText('Gottesdienst')).toBeNull();
      expect(screen.getByText('Gemeinde')).toBeTruthy();
    });

    it('bietet ohne Angabe beide Arten an', () => {
      // Fehlende Daten duerfen keine Auswahl verschwinden lassen -- sonst
      // fehlten bei einem Ladefehler stillschweigend Moeglichkeiten.
      renderModal(undefined);
      expect(screen.getByText('Gottesdienst')).toBeTruthy();
      expect(screen.getByText('Gemeinde')).toBeTruthy();
    });
  });

  describe('ActivityModal', () => {
    const AKTIVITAETEN = [
      { id: 1, name: 'Gottesdienstbesuch', points: 2, type: 'gottesdienst' },
      { id: 2, name: 'Gemeindefest', points: 3, type: 'gemeinde' },
      { id: 3, name: 'Teamer-Schulung', points: 1, type: null },
    ];

    const renderModal = (punkteartFlags?: {
      gottesdienst_enabled?: boolean;
      gemeinde_enabled?: boolean;
    }) => {
      mockApiGet.mockResolvedValue({ data: AKTIVITAETEN });
      return render(
        <ActivityModal
          konfiId={1}
          onClose={noop}
          onSave={noopAsync}
          punkteartFlags={punkteartFlags}
        />
      );
    };

    it('zeigt Aktivitaeten beider Arten, wenn beide aktiv sind', async () => {
      renderModal({ gottesdienst_enabled: true, gemeinde_enabled: true });
      await waitFor(() => expect(screen.getByText('Gottesdienstbesuch')).toBeTruthy());
      expect(screen.getByText('Gemeindefest')).toBeTruthy();
    });

    it('laesst Aktivitaeten einer abgeschalteten Art weg', async () => {
      renderModal({ gottesdienst_enabled: true, gemeinde_enabled: false });
      await waitFor(() => expect(screen.getByText('Gottesdienstbesuch')).toBeTruthy());
      expect(screen.queryByText('Gemeindefest')).toBeNull();
    });

    it('behaelt Teamer-Aktivitaeten ohne Punkteart in jedem Fall', async () => {
      // Teamer-Aktivitaeten haben type = NULL und haengen an keiner Punkteart.
      // Sie duerfen durch den Filter nicht verschwinden.
      renderModal({ gottesdienst_enabled: false, gemeinde_enabled: false });
      await waitFor(() => expect(screen.getByText('Teamer-Schulung')).toBeTruthy());
      expect(screen.queryByText('Gottesdienstbesuch')).toBeNull();
      expect(screen.queryByText('Gemeindefest')).toBeNull();
    });
  });
});
