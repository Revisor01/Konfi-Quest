import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Gemeinde bearbeiten: Der Systemname (name, slug) bleibt, solange der
// Anzeigename gleich bleibt (30.09.2026, Nebenbefund Großpaket).
//
// Das Formular bildete ihn bei JEDEM Speichern neu aus dem Anzeigenamen und
// verlor dabei Umlaute. Eine Gemeinde „Büsum", die der Server seit dem
// 29.09.2026 als `buesum` anlegt, wurde beim ersten Speichern -- etwa einer
// neuen Telefonnummer -- per PUT auf `bsum` umbenannt.
//
// Die Felder fuellt hier das Laden der Gemeinde (IonInput-Werte lassen sich
// in jsdom nicht tippen); geprueft wird, was PUT an den Server schickt.

const GEMEINDE_ID = 7;
let geladen: Record<string, unknown> = {};

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setError: vi.fn(),
    setSuccess: vi.fn(),
    isOnline: true,
    user: { id: 1, role_name: 'super_admin', is_super_admin: true },
  }),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn((url: string) =>
      Promise.resolve({ data: url === `/organizations/${GEMEINDE_ID}` ? geladen : [] })
    ),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));

import api from '../../services/api';
import OrganizationManagementModal from '../../components/admin/modals/OrganizationManagementModal';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Laden, auf "Bearbeiten", dann "Speichern" -- was geht per PUT hinaus?
async function speichernOhneAenderung(gemeinde: Record<string, unknown>) {
  geladen = { id: GEMEINDE_ID, is_active: true, max_konfis: null, ...gemeinde };
  render(<OrganizationManagementModal organizationId={GEMEINDE_ID} onClose={vi.fn()} onSuccess={vi.fn()} />);

  fireEvent.click(await screen.findByLabelText('Gemeinde bearbeiten', undefined, { timeout: 15000 }));
  fireEvent.click(await screen.findByLabelText('Gemeinde speichern', undefined, { timeout: 15000 }));

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1), { timeout: 5000 });
  const [url, daten] = (api.put as unknown as { mock: { calls: [string, Record<string, unknown>][] } }).mock.calls[0];
  expect(url).toBe(`/organizations/${GEMEINDE_ID}`);
  return daten;
}

describe('Gemeinde bearbeiten: der Systemname bleibt', () => {
  it('eine als buesum angelegte Gemeinde wird nicht auf bsum zurückbenannt', async () => {
    const daten = await speichernOhneAenderung({ name: 'buesum', slug: 'buesum', display_name: 'Büsum' });
    expect(daten.name).toBe('buesum');
    expect(daten.slug).toBe('buesum');
    expect(daten.display_name).toBe('Büsum');
  }, 30000);

  it('eine ältere Gemeinde behält ihren Systemnamen ohne Umlaut', async () => {
    const daten = await speichernOhneAenderung({ name: 'bsum', slug: 'bsum', display_name: 'Büsum' });
    expect(daten.name).toBe('bsum');
    expect(daten.slug).toBe('bsum');
  }, 30000);

  it('ein eigener Systemname bleibt', async () => {
    const daten = await speichernOhneAenderung({ name: 'ks-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd' });
    expect(daten.name).toBe('ks-sued');
    expect(daten.slug).toBe('ks-sued');
  }, 30000);
});
