// Befund aus dem Rollen-Bericht (26.08.2026): Ein Admin ohne
// Jahrgangs-Zuweisung sah eine leere Konfi-Liste mit dem Text "Noch keine
// Konfis angelegt" -- obwohl es Konfis gibt und nur die Zuweisung fehlt. Wer
// frisch angelegt wurde, hielt die App fuer kaputt.
//
// Das VERHALTEN bleibt (Simons Entscheidung 26.08.: leere Liste ist richtig),
// nur der Grund wird sichtbar.
//
// Der Server meldet ihn per Header statt im Rumpf, damit die Antwort ein
// Array bleibt und kein Aufrufer bricht. Dass GET /admin/konfis leer UND mit
// Header antwortet, prueft das Backend (tests/routes/konfi-management.test.js,
// "OHNE Zuweisung"); hier wird die Seite gerendert, die den Header liest und
// den Grund zeigt (Audit Tests 26.09.2026, BF-02; bis 30.09.2026 am
// Quelltext von Seite, Liste und Route geprueft).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 4, organization_id: 1, role_name: 'admin', display_name: 'Test Admin 1' },
    setError: vi.fn(), setSuccess: vi.fn(), isOnline: true,
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));

// Die Abfrage läuft wirklich: Der Abruf der Seite (samt Header-Auswertung)
// wird einmal ausgeführt, sein Ergebnis ist die Liste.
vi.mock('../../hooks/useOfflineQuery', async () => {
  const { useEffect, useState } = await import('react');
  return {
    useOfflineQuery: (_schluessel: string, holen: () => Promise<unknown>) => {
      const [data, setData] = useState<unknown>(null);
      useEffect(() => { void holen().then(setData); }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return { data, loading: data === null, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn() };
    },
  };
});
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

// Echte Ionic-Bausteine; das Suchfeld als <input>, weil ion-input in jsdom
// keine Eingaben an React weiterreicht.
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonInput: ({ 'aria-label': name, value, onIonInput }: {
    'aria-label'?: string; value?: string; onIonInput?: (e: { detail: { value: string } }) => void;
  }) => <input aria-label={name} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
  useIonModal: () => [vi.fn(), vi.fn()],
  useIonAlert: () => [vi.fn(), vi.fn()],
  useIonRouter: () => ({ push: vi.fn() }),
}));

import AdminKonfisPage from '../../components/admin/pages/AdminKonfisPage';

let kopf: Record<string, string> = {};
beforeEach(() => {
  vi.clearAllMocks();
  kopf = {};
  apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/admin/konfis') return { data: [], headers: kopf };
    if (pfad === '/settings') return { data: {} };
    return { data: [] };
  });
});
afterEach(() => cleanup());

const oeffne = async () => {
  render(<AdminKonfisPage />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  expect(apiGet).toHaveBeenCalledWith('/admin/konfis');
};

const GRUND = 'Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.';

describe('Admin ohne Jahrgangs-Zuweisung sieht den Grund', () => {
  it('mit Header: "Kein Jahrgang zugewiesen" und wer es ändern kann', async () => {
    kopf = { 'x-kein-jahrgang-zugewiesen': 'true' };
    await oeffne();
    expect(screen.getByText('Kein Jahrgang zugewiesen')).toBeInTheDocument();
    expect(screen.getByText(GRUND)).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Konfis angelegt')).toBeNull();
  });

  it('die Suche behält ihren eigenen Text', async () => {
    // Gegenprobe: Wer sucht und nichts findet, bekommt weiterhin den
    // Such-Hinweis -- nicht den Jahrgangs-Hinweis.
    kopf = { 'x-kein-jahrgang-zugewiesen': 'true' };
    await oeffne();
    fireEvent.change(screen.getByRole('textbox', { name: 'Konfi suchen' }), { target: { value: 'Emilia' } });
    expect(screen.getByText('Keine Konfis gefunden')).toBeInTheDocument();
    expect(screen.getByText('Versuche andere Suchbegriffe')).toBeInTheDocument();
    expect(screen.queryByText('Kein Jahrgang zugewiesen')).toBeNull();
  });

  it('ohne Header bleibt der ursprüngliche Text für den echten Leerfall', async () => {
    // Gegenprobe: Hat ein Admin MIT Zuweisung wirklich keine Konfis, ist
    // "Noch keine Konfis angelegt" die richtige Aussage.
    await oeffne();
    expect(screen.getByText('Keine Konfis gefunden')).toBeInTheDocument();
    expect(screen.getByText('Noch keine Konfis angelegt')).toBeInTheDocument();
    expect(screen.queryByText(GRUND)).toBeNull();
  });

  it('ein anderer Wert als "true" zählt nicht', async () => {
    kopf = { 'x-kein-jahrgang-zugewiesen': 'false' };
    await oeffne();
    expect(screen.getByText('Noch keine Konfis angelegt')).toBeInTheDocument();
    expect(screen.queryByText('Kein Jahrgang zugewiesen')).toBeNull();
  });
});
