// Die roten Zahlen der Support-Mail (navigation/supportMailZaehler.ts,
// 03.10.2026): ein Stand fuer alle Stellen, Abruf nur fuer Super-Admin und
// nur, solange eine Stelle die Zahl zeigt; Takt alle zwei Minuten, nicht im
// verborgenen Tab; „gelesen" melden und auffrischen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown> | null,
}));

vi.mock('../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost } }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: h.user }) }));

import {
  ZAEHLER_TAKT_MS,
  mailsAlsGelesen,
  supportMailZahl,
  supportMailZaehlerZuruecksetzen,
  useSupportMailZaehler,
} from '../../navigation/supportMailZaehler';

const ZAEHLER = { anfragen: 2, gemeinden: 1, eingang: 3, je_anfrage: { 4: 2 }, je_gemeinde: { 7: 1 }, vorgaenge: 5, posteingang: 4 };
const abrufe = () => h.apiGet.mock.calls.filter(([p]) => p === '/support/mail/zaehler').length;
let sichtbarkeit: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.apiGet.mockResolvedValue({ data: ZAEHLER });
  h.apiPost.mockResolvedValue({ data: {} });
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  sichtbarkeit = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => sichtbarkeit);
  supportMailZaehlerZuruecksetzen();
});

afterEach(() => {
  supportMailZaehlerZuruecksetzen();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSupportMailZaehler', () => {
  it('mit laden: Abruf beim Einhaengen, dann alle zwei Minuten; nach dem Aushaengen keiner mehr', async () => {
    const { result, unmount } = renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    expect(abrufe()).toBe(1);
    expect(result.current).toEqual(ZAEHLER);

    await act(async () => { vi.advanceTimersByTime(ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(2);

    unmount();
    await act(async () => { vi.advanceTimersByTime(3 * ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(2);
  });

  it('im verborgenen Tab faellt der Takt aus', async () => {
    renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    sichtbarkeit = 'hidden';
    await act(async () => { vi.advanceTimersByTime(2 * ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(1);
    sichtbarkeit = 'visible';
    await act(async () => { vi.advanceTimersByTime(ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(2);
  });

  it('zwei Stellen gleichzeitig: ein Abruf, ein Takt, derselbe Stand', async () => {
    const a = renderHook(() => useSupportMailZaehler(true));
    const b = renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    expect(abrufe()).toBe(1);
    expect(b.result.current).toBe(a.result.current);
    await act(async () => { vi.advanceTimersByTime(ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(2);
    // Eine Stelle geht, die andere zeigt weiter: der Takt laeuft weiter.
    a.unmount();
    await act(async () => { vi.advanceTimersByTime(ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(3);
  });

  it('ohne laden: kein Abruf, aber der Stand anderer Stellen', async () => {
    const leser = renderHook(() => useSupportMailZaehler());
    await act(async () => {});
    expect(abrufe()).toBe(0);
    expect(leser.result.current).toBeNull();
    renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    expect(leser.result.current).toEqual(ZAEHLER);
  });

  it('ohne Super-Admin-Recht: kein Abruf und keine Zahl', async () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    const { result } = renderHook(() => useSupportMailZaehler(true));
    await act(async () => { vi.advanceTimersByTime(ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(0);
    expect(result.current).toBeNull();
  });

  it('ein Fehler beim Abruf laesst den letzten Stand stehen', async () => {
    const { result } = renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    h.apiGet.mockRejectedValue(new Error('Netz weg'));
    await act(async () => { vi.advanceTimersByTime(ZAEHLER_TAKT_MS); });
    expect(abrufe()).toBe(2);
    expect(result.current).toEqual(ZAEHLER);
  });
});

describe('mailsAlsGelesen', () => {
  it('meldet die Kennungen und frischt die Zahl auf, wenn sie irgendwo steht', async () => {
    renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    await act(async () => { await mailsAlsGelesen([11, 12]); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/mail/gelesen', { ids: [11, 12] });
    expect(abrufe()).toBe(2);
  });

  it('ohne Kennungen kein Aufruf; ohne zeigende Stelle kein Auffrischen', async () => {
    expect(await mailsAlsGelesen([])).toBe(false);
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(await mailsAlsGelesen([3])).toBe(true);
    expect(abrufe()).toBe(0);
  });

  it('scheitert die Meldung, bleibt die Zahl (kein Auffrischen)', async () => {
    renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    h.apiPost.mockRejectedValueOnce(new Error('Netz weg'));
    let ergebnis = true;
    await act(async () => { ergebnis = await mailsAlsGelesen([3]); });
    expect(ergebnis).toBe(false);
    expect(abrufe()).toBe(1);
  });
});

describe('supportMailZahl: eine Rechnung fuer Leiste und Uebersicht', () => {
  it('Vorgaenge und Posteingang tragen die Zahlen, die der Server fertig liefert -- nicht mehr aus Anfragen und Gemeinden zusammengesetzt', () => {
    expect(supportMailZahl(ZAEHLER, 'supportVorgaenge')).toBe(5);
    expect(supportMailZahl(ZAEHLER, 'supportPosteingang')).toBe(4);
    expect(supportMailZahl(null, 'supportPosteingang')).toBe(0);
    expect(supportMailZahl(null, 'supportVorgaenge')).toBe(0);
  });

  it('ein aelterer Server ohne die neuen Felder: beide Zahlen sind 0, nichts stuerzt ab', async () => {
    h.apiGet.mockResolvedValue({ data: { anfragen: 2, gemeinden: 1, eingang: 3, je_anfrage: {}, je_gemeinde: {} } });
    const { result } = renderHook(() => useSupportMailZaehler(true));
    await act(async () => {});
    expect(supportMailZahl(result.current, 'supportVorgaenge')).toBe(0);
    expect(supportMailZahl(result.current, 'supportPosteingang')).toBe(0);
  });
});
