import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Der Gemeinde-Wechsel steht an EINER Stelle (hooks/useGemeindeWechsel.ts) und
// wird von beiden Umschaltern gerufen: dem Knopf der Kopfzeile (App, schmales
// Fenster) und der Flaeche unten in der Leiste (Web-Version, breit). Dieser
// Test haelt die Regel fest (Simon, 03.10.2026: „ohne die App-View zu
// zerstoeren"); dass beide Umschalter den Hook rufen und nichts nachbauen,
// zeigt gemeindeWechselGeteilt.test.tsx durch Rendern.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  switchOrg: vi.fn(),
  apiGet: vi.fn(),
  app: {
    organizations: [] as Array<{ id: number; name: string; role_name: string; display_name?: string }>,
    activeOrgId: null as number | null,
    user: { organization_id: 1 } as { organization_id?: number } | null,
  },
}));

vi.mock('@ionic/react', () => ({
  useIonRouter: () => ({ push: h.push }),
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ ...h.app, switchOrg: h.switchOrg }),
}));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet } }));

import { startseiteDerRolle, useGemeindeWechsel, useOffenJeGemeinde } from '../../hooks/useGemeindeWechsel';

beforeEach(() => {
  h.push.mockReset();
  h.switchOrg.mockReset();
  h.switchOrg.mockResolvedValue({ ok: true });
  h.apiGet.mockReset();
  h.app.organizations = [
    { id: 1, name: 'Kirchspiel West', role_name: 'org_admin' },
    { id: 2, name: 'Kirchengemeinde Heide', role_name: 'teamer' },
    { id: 3, name: 'Kirchengemeinde Musterdorf', role_name: 'konfi' },
    { id: 4, name: 'Kirchengemeinde Beispielstadt', role_name: 'admin' },
  ];
  h.app.activeOrgId = null;
  h.app.user = { organization_id: 1 };
});

describe('startseiteDerRolle', () => {
  it.each([
    ['konfi', '/konfi/dashboard'],
    ['teamer', '/teamer/dashboard'],
    ['admin', '/admin/konfis'],
    ['org_admin', '/admin/konfis'],
    [undefined, '/admin/konfis'],
  ])('%s -> %s', (rolle, start) => {
    expect(startseiteDerRolle(rolle)).toBe(start);
  });
});

describe('useGemeindeWechsel', () => {
  it('die aktive Gemeinde: gesetzte aktive, sonst die Stamm-Gemeinde', () => {
    const stamm = renderHook(() => useGemeindeWechsel());
    expect(stamm.result.current.aktiveId).toBe(1);
    expect(stamm.result.current.aktive?.name).toBe('Kirchspiel West');

    h.app.activeOrgId = 3;
    const gesetzt = renderHook(() => useGemeindeWechsel());
    expect(gesetzt.result.current.aktiveId).toBe(3);
    expect(gesetzt.result.current.aktive?.name).toBe('Kirchengemeinde Musterdorf');
  });

  it('mehrere: nur ab zwei Gemeinden', () => {
    expect(renderHook(() => useGemeindeWechsel()).result.current.mehrere).toBe(true);
    h.app.organizations = [h.app.organizations[0]];
    expect(renderHook(() => useGemeindeWechsel()).result.current.mehrere).toBe(false);
    h.app.organizations = [];
    expect(renderHook(() => useGemeindeWechsel()).result.current.mehrere).toBe(false);
  });

  it.each([
    [2, '/teamer/dashboard'],
    [3, '/konfi/dashboard'],
    [4, '/admin/konfis'],
  ])('Gemeinde %i: wechselt und geht auf die Startseite der Rolle dort (%s), Stapel leeren', async (orgId, start) => {
    const { result } = renderHook(() => useGemeindeWechsel());
    await act(async () => { await result.current.wechseln(orgId); });
    expect(h.switchOrg).toHaveBeenCalledTimes(1);
    expect(h.switchOrg).toHaveBeenCalledWith(orgId);
    // 'root' leert den Seitenstapel der alten Gemeinde, 'replace' laesst sie
    // nicht im Verlauf stehen.
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith(start, 'root', 'replace');
  });

  it('navigiert erst, wenn der Wechsel abgeschlossen ist -- nie auf die Startseite einer Gemeinde, in der man noch nicht ist', async () => {
    let abschliessen: () => void = () => undefined;
    h.switchOrg.mockImplementation(() => new Promise((fertig) => { abschliessen = () => fertig({ ok: true }); }));
    const { result } = renderHook(() => useGemeindeWechsel());

    let wechsel: Promise<void> = Promise.resolve();
    act(() => { wechsel = result.current.wechseln(2); });
    await act(async () => {});
    expect(h.switchOrg).toHaveBeenCalledWith(2);
    // Der Wechsel laeuft noch: keine Navigation.
    expect(h.push).not.toHaveBeenCalled();

    await act(async () => { abschliessen(); await wechsel; });
    expect(h.push).toHaveBeenCalledWith('/teamer/dashboard', 'root', 'replace');
  });

  it('die Gemeinde, in der man schon ist: nichts passiert', async () => {
    h.app.activeOrgId = 2;
    const { result } = renderHook(() => useGemeindeWechsel());
    await act(async () => { await result.current.wechseln(2); });
    expect(h.switchOrg).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('useOffenJeGemeinde', () => {
  it('fragt erst auf Zuruf, genau einmal je laden(), und liest nur Zahlen groesser 0', async () => {
    h.apiGet.mockResolvedValue({ data: { jeOrganisation: { 1: { offen: 4 }, 2: { offen: 0 }, 3: { offen: 29 } } } });
    const { result } = renderHook(() => useOffenJeGemeinde());
    expect(h.apiGet).not.toHaveBeenCalled();
    expect(result.current.offenJeOrg).toEqual({});

    await act(async () => { await result.current.laden(); });
    expect(h.apiGet).toHaveBeenCalledTimes(1);
    expect(h.apiGet).toHaveBeenCalledWith('/notifications/badge-counts/je-organisation');
    expect(result.current.offenJeOrg).toEqual({ 1: 4, 3: 29 });
  });

  it('ein Fehler bleibt still: kein Wurf, der letzte Stand bleibt', async () => {
    h.apiGet.mockResolvedValueOnce({ data: { jeOrganisation: { 1: { offen: 4 } } } });
    const { result } = renderHook(() => useOffenJeGemeinde());
    await act(async () => { await result.current.laden(); });
    h.apiGet.mockRejectedValueOnce(new Error('Netz weg'));
    await act(async () => { await result.current.laden(); });
    expect(result.current.offenJeOrg).toEqual({ 1: 4 });
  });
});
