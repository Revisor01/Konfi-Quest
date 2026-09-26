import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-16 -- gerenderte Gegenprobe zum
// Quelltext-Scan (modaleBenannt.test.ts): Das Bonus-Modal der Leitung enthaelt
// einen Datumswaehler in einem eigenen <IonModal keepContentsMounted>. Der
// Ionic-Host (ion-modal) muss den Namen tragen, den die Vorlesehilfe beim
// Oeffnen ansagt -- „Datum waehlen" statt nur „Dialog".
//
// Echtes @ionic/react: Es geht um das Attribut am Host-Element, nicht um
// einen Stub. Das Postfach (aria-labelledby auf die IonTitle) prueft
// postfachModalBenannt.test.tsx mit durchreichendem Stub, weil der echte
// ion-modal in jsdom seine Kinder erst beim Praesentieren rendert.
// ---------------------------------------------------------------------------

vi.mock('../../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn().mockResolvedValue({ data: {} }) },
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));
vi.mock('../../utils/uuid', () => ({ safeUUID: () => 'test-uuid' }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, type: 'admin' }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: async (fn: () => Promise<void>) => fn() }),
}));

import BonusModal from '../../components/admin/modals/BonusModal';

afterEach(cleanup);

describe('Gerenderte Modale tragen ihren Namen am Host (UI BF-16)', () => {
  it('Bonus-Modal: der Datumswaehler-Dialog heisst „Datum waehlen"', () => {
    render(<BonusModal konfiId={1} onClose={() => {}} onSave={async () => {}} />);
    const modale = [...document.body.querySelectorAll<HTMLElement>('ion-modal')];
    expect(modale.length).toBe(1);
    expect(modale[0].getAttribute('aria-label')).toBe('Datum wählen');
    // Der Waehler im Modal ist selbst benannt -- Dialog und Feld getrennt ansagbar.
    const feld = modale[0].querySelector('ion-datetime');
    expect(feld?.getAttribute('aria-label') ?? feld?.shadowRoot?.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe('Datum');
  });

  it('kein ion-modal ohne Namen im gerenderten Baum', () => {
    render(<BonusModal konfiId={1} onClose={() => {}} onSave={async () => {}} />);
    const ohne = [...document.body.querySelectorAll<HTMLElement>('ion-modal')]
      .filter((m) => !m.getAttribute('aria-label') && !m.getAttribute('aria-labelledby'));
    expect(ohne).toEqual([]);
  });
});
