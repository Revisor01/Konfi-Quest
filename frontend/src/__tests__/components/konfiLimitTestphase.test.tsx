import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Konfi-Limit im Formular "Gemeinde" (Simon, 03.10.2026): "Testphase 5
// danach unbegrenzt. Das andere als Optionen solange es noch nicht von der
// EKD gekauft ist." Die Regel steht in utils/konfiLimitVorgabe.ts; hier wird
// geprueft, dass das Formular sie nutzt -- beim Anlegen und beim Umschalten
// zwischen Testphase und Lizenz.
//
// JSDOM reicht ionChange nicht an React durch (siehe
// absturzberichteSchalter.test.tsx): IonToggle wird durch ein Kontrollkaestchen
// mit denselben Props ersetzt, IonSelect durch ein Element, das seinen Wert
// zeigt. Gezaehlt wird, was beim Speichern an den Server geht
// (PATCH /organizations/:id/limit), und beim Anlegen der Wert der
// Tarif-Auswahl.

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

vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const ReactEcht = await vi.importActual<typeof import('react')>('react');
  const IonToggle = (p: { checked?: boolean; 'aria-label'?: string; onIonChange?: (e: { detail: { checked: boolean } }) => void }) =>
    ReactEcht.createElement('input', {
      type: 'checkbox',
      'aria-label': p['aria-label'],
      checked: !!p.checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { checked: e.target.checked } })
    });
  const IonSelect = (p: { value?: unknown; 'aria-label'?: string; children?: React.ReactNode }) =>
    ReactEcht.createElement('div', { 'aria-label': p['aria-label'], 'data-wert': String(p.value ?? '') }, p.children);
  const IonSelectOption = (p: { value?: unknown; children?: React.ReactNode }) =>
    ReactEcht.createElement('span', { 'data-option': String(p.value ?? '') }, p.children);
  return { ...echt, IonToggle, IonSelect, IonSelectOption };
});

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));

import api from '../../services/api';
import OrganizationManagementModal from '../../components/admin/modals/OrganizationManagementModal';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const IN_30_TAGEN = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

/** Gemeinde laden, in den Bearbeiten-Modus wechseln. */
async function bearbeiten(gemeinde: Record<string, unknown>) {
  geladen = {
    id: GEMEINDE_ID, name: 'gemeinde', slug: 'gemeinde', display_name: 'Gemeinde',
    is_active: true, ...gemeinde,
  };
  render(<OrganizationManagementModal organizationId={GEMEINDE_ID} onClose={vi.fn()} onSuccess={vi.fn()} />);
  fireEvent.click(await screen.findByLabelText('Gemeinde bearbeiten', undefined, { timeout: 15000 }));
}

/** Den Schalter "Als Testphase kennzeichnen" umlegen. */
function testphaseSchalten(an: boolean) {
  const schalter = screen.getByLabelText('Als Testphase kennzeichnen') as HTMLInputElement;
  expect(schalter.checked).toBe(!an);
  fireEvent.click(schalter);
}

/** Speichern und das Limit zurueckgeben, das an den Server geht. */
async function gespeichertesLimit(): Promise<unknown> {
  fireEvent.click(await screen.findByLabelText('Gemeinde speichern', undefined, { timeout: 15000 }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1), { timeout: 5000 });
  const [url, daten] = (api.patch as unknown as { mock: { calls: [string, { max_konfis: unknown }][] } }).mock.calls[0];
  expect(url).toBe(`/organizations/${GEMEINDE_ID}/limit`);
  return daten.max_konfis;
}

describe('Konfi-Limit: Testphase 5, danach unbegrenzt', () => {
  it('eine neue Gemeinde startet in der Testphase mit 5 Konfis', async () => {
    render(<OrganizationManagementModal organizationId={null} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const tarif = await screen.findByLabelText('Tarif', undefined, { timeout: 15000 });
    await waitFor(() => expect(tarif.getAttribute('data-wert')).toBe('5'));
    expect(screen.getByLabelText('Als Testphase kennzeichnen')).toBeChecked();
  }, 30000);

  it('Testphase aus: das Limit 5 wird unbegrenzt', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: true, max_konfis: 5 });
    testphaseSchalten(false);
    expect(await gespeichertesLimit()).toBeNull();
  }, 30000);

  it('Testphase aus: ein gewählter Tarif bleibt stehen', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: true, max_konfis: 50 });
    testphaseSchalten(false);
    expect(await gespeichertesLimit()).toBe(50);
  }, 30000);

  it('Testphase an: unbegrenzt wird 5', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: false, max_konfis: null });
    testphaseSchalten(true);
    expect(await gespeichertesLimit()).toBe(5);
  }, 30000);

  // Wunschlizenz aus der Anfrage (Simon, 03.10.2026; GET /organizations/:id).
  it('Testphase aus mit Wunschlizenz Standard: das Limit 5 wird 50; der Hinweis nennt die Lizenz', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: true, max_konfis: 5, wunsch_lizenz: 'standard' });
    expect(screen.getByTestId('wunschlizenz').textContent)
      .toBe('Wunschlizenz aus der Anfrage: Standard — bis 50 Konfis. Nach der Testphase steht das Limit darauf.');
    testphaseSchalten(false);
    expect(await gespeichertesLimit()).toBe(50);
  }, 30000);

  it('Testphase aus mit Wunschlizenz Verbund: unbegrenzt, Limit nach Absprache', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: true, max_konfis: 5, wunsch_lizenz: 'verbund' });
    expect(screen.getByTestId('wunschlizenz').textContent).toContain('Das Limit wird abgesprochen.');
    testphaseSchalten(false);
    expect(await gespeichertesLimit()).toBeNull();
  }, 30000);

  it('ohne Wunschlizenz kein Hinweis', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: true, max_konfis: 5, wunsch_lizenz: null });
    expect(screen.queryByTestId('wunschlizenz')).toBeNull();
  }, 30000);

  it('die Tarife bleiben wählbar, mit Preis; Unbegrenzt und eigenes Limit immer dabei', async () => {
    render(<OrganizationManagementModal organizationId={null} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const tarif = await screen.findByLabelText('Tarif', undefined, { timeout: 15000 });
    const optionen = [...tarif.querySelectorAll('[data-option]')].map((o) => [o.getAttribute('data-option'), o.textContent]);
    expect(optionen).toEqual([
      ['5', 'Testphase — bis 5 Konfis · kostenlos, 30 Tage'],
      ['15', 'Klein — bis 15 Konfis · 49 € pro Jahr'],
      ['50', 'Standard — bis 50 Konfis · 99 € pro Jahr'],
      ['75', 'Plus — bis 75 Konfis · 139 € pro Jahr'],
      ['100', 'Groß — bis 100 Konfis · 179 € pro Jahr'],
      ['', 'Unbegrenzt — ohne Konfi-Grenze'],
      ['__eigen__', 'Eigenes Limit…'],
    ]);
  }, 30000);

  it('ohne Umschalten bleibt das Limit, wie es war', async () => {
    await bearbeiten({ trial_ends_at: IN_30_TAGEN, is_trial: true, max_konfis: null });
    expect(await gespeichertesLimit()).toBeNull();
  }, 30000);
});
