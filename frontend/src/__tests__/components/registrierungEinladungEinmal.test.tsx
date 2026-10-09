// Ein Einladungslink prüft seinen Code GENAU EINMAL (09.10.2026).
//
// Im Zugriffslog standen 11.868 Aufrufe von validate-invite für einen
// einzigen Code, fast alle am 10. und 11.09.2026 und mit bis zu 62 je
// Sekunde -- aus Browsern auf /register?code=..., nicht aus der App. Das ist
// die Schleife, die am 11.09.2026 in useAppLocation behoben wurde
// (useAppLocationStabil prüft den Hook). Seit dem 12.09.2026 höchstens sechs
// Aufrufe je Minute.
//
// Dieser Test prüft das Symptom an der Seite selbst: Gerendert wird die
// echte Registrierung mit dem ECHTEN useAppLocation; gestellt ist nur der
// Router, der -- wie react-router -- zwischen zwei Rendern dasselbe
// Standort-Objekt liefert. Baute der Hook wieder bei jedem Render ein neues
// Objekt, liefe der Effekt `[location]` endlos und der Zähler stiege.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';

const routerStandort = { pathname: '/register', search: '?code=ABC12345', state: null, hash: '', key: 'k1' };
vi.mock('react-router-dom', () => ({ useLocation: () => routerStandort }));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn(), goBack: vi.fn(), canGoBack: () => false, routeInfo: undefined }),
}));

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    put: vi.fn(), delete: vi.fn(),
  },
}));
vi.mock('../../services/geraeteKennung', () => ({ geraeteKennung: async () => 'geraet-7' }));
vi.mock('../../services/auth', () => ({ sitzungUebernehmen: vi.fn() }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setUser: vi.fn(), setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));

import KonfiRegisterPage from '../../components/auth/KonfiRegisterPage';

const pruefungen = () => api.get.mock.calls.filter((c) => String(c[0]).startsWith('/auth/validate-invite/'));

// Bremse für den Fehlerfall: Nach zehn Antworten antwortet der Server
// nicht mehr. Sonst liefe die Schleife im Test endlos (act wird nie leer)
// und der Test fiele nur am Zeitlimit statt mit einer Zahl.
const BREMSE = 10;
const mitBremse = (antwort: (pfad: string) => Promise<unknown>) => (pfad: string) =>
  (pruefungen().length > BREMSE ? new Promise(() => undefined) : antwort(pfad));

// Viele Runden Mikro- und Makroaufgaben: Eine Schleife hätte hier längst
// Dutzende Aufrufe erzeugt (gemessen im Browser: rund 53 je Sekunde).
const ausklingen = async () => {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('Einladungslink: der Code wird genau einmal geprüft', () => {
  it('gültiger Code: ein Aufruf, das Formular steht', async () => {
    api.get.mockImplementation(mitBremse(async (pfad: string) => {
      if (pfad === '/auth/validate-invite/ABC12345') return { data: { jahrgang_name: 'Jahrgang 2027', organization_name: 'Gemeinde Test' } };
      throw new Error(`unerwartet: ${pfad}`);
    }));
    render(<KonfiRegisterPage />);
    await ausklingen();
    expect(pruefungen()).toEqual([['/auth/validate-invite/ABC12345']]);
    expect(await screen.findByText(/Jahrgang 2027/)).toBeTruthy();
  });

  it('abgelaufener Code (410): ebenfalls ein Aufruf, keine Wiederholung', async () => {
    api.get.mockImplementation(mitBremse(async () => {
      throw { response: { status: 410, data: { error_code: 'expired' } } };
    }));
    render(<KonfiRegisterPage />);
    await ausklingen();
    expect(pruefungen()).toHaveLength(1);
    expect(await screen.findByText(/abgelaufen/)).toBeTruthy();
  });
});
