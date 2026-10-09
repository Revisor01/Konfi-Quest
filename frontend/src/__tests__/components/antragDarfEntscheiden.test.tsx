// Recht "Anträge entscheiden" (09.10.2026, docs/planung/darf-freigeben.md):
// Der Server liefert je Antrag `darf_entscheiden`. Bei false sieht die Leitung
// den Antrag weiter, nur lesend: kein Genehmigen, kein Ablehnen, kein
// Speichern -- stattdessen der Grund. Fehlt das Feld (älterer Server), bleibt
// alles wie bisher. Der Server antwortet ohne Recht ohnehin mit 403.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setSuccess: vi.fn(), setError: vi.fn(), isOnline: true,
    user: { id: 5, organization_id: 1, type: 'admin', role_name: 'admin' },
  }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => unknown) => fn() }),
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) } }));
vi.mock('../../services/analytics', () => ({ track: vi.fn(), trackHandlung: vi.fn() }));

import ActivityRequestModal from '../../components/admin/modals/ActivityRequestModal';

const antrag = (zusatz: Record<string, unknown> = {}) => ({
  id: 41, user_id: 9, konfi_name: 'Emilia Test', activity_id: 3, activity_name: 'Gemeindefest geholfen',
  activity_points: 2, activity_type: 'gemeinde', activity_target_role: 'konfi', requested_date: '2026-09-20',
  comment: 'Kuchen verkauft', photo_filename: null, status: 'pending',
  created_at: '2026-09-20T10:00:00Z', updated_at: '2026-09-20T10:00:00Z', ...zusatz,
});

const HINWEIS = 'Über diesen Antrag entscheidet jemand anderes. Das Recht vergibt die Gemeindeleitung.';

const oeffne = async (daten: Record<string, unknown>) => {
  apiGet.mockImplementation(async (route: string) => {
    if (route === '/admin/activities/requests/41') return { data: daten };
    throw new Error(`unerwartet: ${route}`);
  });
  render(<ActivityRequestModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);
  await screen.findByText('Kuchen verkauft');
};

beforeEach(() => { apiGet.mockReset(); });
afterEach(() => cleanup());

describe('Antragsdialog: Recht "Anträge entscheiden"', () => {
  it('VERBOTEN (darf_entscheiden: false): Antrag lesbar, kein Genehmigen/Ablehnen, dafür der Grund', async () => {
    await oeffne(antrag({ darf_entscheiden: false }));
    expect(screen.getByText('Gemeindefest geholfen')).toBeInTheDocument();
    expect(screen.queryByText('Genehmigen')).toBeNull();
    expect(screen.queryByText('Ablehnen')).toBeNull();
    expect(screen.queryByLabelText('Entscheidung speichern')).toBeNull();
    expect(screen.getByText(HINWEIS)).toBeInTheDocument();
  });

  it('ERLAUBT (darf_entscheiden: true): Genehmigen und Ablehnen, kein Hinweis', async () => {
    await oeffne(antrag({ darf_entscheiden: true }));
    expect(screen.getByText('Genehmigen')).toBeInTheDocument();
    expect(screen.getByText('Ablehnen')).toBeInTheDocument();
    expect(screen.queryByText(HINWEIS)).toBeNull();
  });

  it('älterer Server ohne das Feld: wie bisher, beide Knöpfe', async () => {
    await oeffne(antrag());
    expect(screen.getByText('Genehmigen')).toBeInTheDocument();
    expect(screen.getByText('Ablehnen')).toBeInTheDocument();
    expect(screen.queryByText(HINWEIS)).toBeNull();
  });

  it('ein entschiedener Antrag ohne Recht zeigt seinen Stand wie bisher, ohne Entscheidungs-Abschnitt', async () => {
    await oeffne(antrag({ status: 'approved', darf_entscheiden: false, approved_by_name: 'Olaf Orgleitung' }));
    expect(screen.getByText(/Verbucht von Olaf Orgleitung/)).toBeInTheDocument();
    expect(screen.queryByText('Genehmigen')).toBeNull();
    expect(screen.queryByText(HINWEIS)).toBeNull();
  });
});
