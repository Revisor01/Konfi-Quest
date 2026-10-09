import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Material-Seite des Teams: kein Zurueck im eigenen Tab (bis 09.10.2026 als
// Quelltext-Pruefung in teamerDashboardZertifikate.test.ts, jetzt gerendert).
//
// Die Seite haengt an '/teamer/profile/material' (Tab seit 04.09.2026) UND
// '/teamer/material' (Altroute fuer Deep-Links und ausgelieferte Apps). Im
// Tab springt window.history.back() aus dem Reiter heraus -- dort steht
// deshalb kein Zurueck-Knopf. Aus dem Material-Detail fuehrt ein eigener
// Knopf zurueck in die Liste; der bleibt, auch im Tab.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const LISTE = [
  { id: 2, title: 'Gottesbilder', file_count: 0, link_url: 'https://example.org/gottesbilder', created_at: '2026-09-02T10:00:00Z', created_by: 4 },
];
const DETAIL = { id: 2, title: 'Gottesbilder', description: 'Bilder', files: [], links: [{ id: 1, url: 'https://example.org/gottesbilder' }], created_at: '2026-09-02T10:00:00Z' };

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async (pfad: string) => ({ data: pfad === '/material' ? LISTE : pfad === '/material/2' ? DETAIL : [] })),
    post: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(async () => undefined), ImpactStyle: { Light: 'LIGHT' }, triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/nativeFileViewer', () => ({ openFileNatively: vi.fn(async () => false) }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 9, organization_id: 1, role_name: 'teamer' }, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  track: vi.fn(), trackHandlung: vi.fn(),
}));
vi.mock('../../services/offlineCache', async (original) => ({
  ...(await original<typeof import('../../services/offlineCache')>()),
  offlineCache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), isStale: () => false },
}));
// Die Kopfzeile als schlichter Nachbau: Titel und -- nur wenn die Seite
// onZurueck mitgibt -- ein Zurueck-Knopf. Genau so baut AppKopfzeile ihn.
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, onZurueck }: { titel: string; onZurueck?: () => void }) => (
    <header data-titel={titel}>
      {onZurueck && <button type="button" onClick={onZurueck}>Zurück</button>}
    </header>
  ),
  AppKopfzeileGross: () => null,
}));

import TeamerMaterialPage from '../../components/teamer/pages/TeamerMaterialPage';

const zeige = async (pfad: string) => {
  render(<MemoryRouter initialEntries={[pfad]}><TeamerMaterialPage /></MemoryRouter>);
  await screen.findByText('Gottesbilder');
};
const kopf = () => document.querySelector('header[data-titel]');
const zurueck = () => kopf()?.querySelector('button') ?? null;

let zurueckImVerlauf: ReturnType<typeof vi.spyOn>;
beforeEach(() => { zurueckImVerlauf = vi.spyOn(window.history, 'back').mockImplementation(() => {}); });
afterEach(() => { cleanup(); zurueckImVerlauf.mockRestore(); });

describe('Material-Seite: kein Zurueck im eigenen Tab', () => {
  it('kennt den Unterschied zwischen Tab und Altroute', async () => {
    await zeige('/teamer/profile/material');
    expect(kopf()?.getAttribute('data-titel')).toBe('Material');
    expect(zurueck()).toBeNull();
    cleanup();
    await zeige('/teamer/material');
    expect(zurueck()).not.toBeNull();
  });

  it('zeigt den Zurueck-Knopf der Liste nur ausserhalb des Tabs, und er geht im Verlauf zurueck', async () => {
    await zeige('/teamer/material');
    fireEvent.click(zurueck()!);
    expect(zurueckImVerlauf).toHaveBeenCalledTimes(1);
  });

  it('behaelt den Zurueck-Weg aus der Detailansicht -- auch im Tab', async () => {
    await zeige('/teamer/profile/material');
    await act(async () => { fireEvent.click(screen.getByText('Gottesbilder')); });
    await screen.findByText('Bilder');
    expect(kopf()?.getAttribute('data-titel')).toBe('Gottesbilder');
    await act(async () => { fireEvent.click(zurueck()!); });
    // Zurueck in die Liste, nicht aus dem Reiter heraus.
    expect(zurueckImVerlauf).not.toHaveBeenCalled();
    expect(kopf()?.getAttribute('data-titel')).toBe('Material');
  });
});
