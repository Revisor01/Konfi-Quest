// useOfflineQuery: beim Wechsel des Schluessels keine Daten des alten
// (Audit 26.09.2026, Screens Leitung BF-11).
//
// Wechselte der Schluessel innerhalb einer Seite (Badges und Aktivitaeten der
// Leitung: Konfis <-> Teamer:innen), blieb die alte Liste stehen, bis die neue
// geantwortet hatte -- `loading` false, `data` von vorher. Scheiterte die
// Antwort, blieb sie als "stale" stehen, als waere sie die neue. Offline ohne
// Zwischenspeicher fuer den neuen Schluessel stand neben der Fehlermeldung
// ebenfalls die alte Liste.
//
// Beim Gemeindewechsel greift das nicht (der Seitenbaum wird neu gebaut); es
// geht um Wechsel innerhalb einer gemounteten Seite.
//
// Der Hook wird ueberall benutzt; die Aenderung ist deshalb eng: Nur ein
// ECHTER Wechsel des Schluessels leert den Stand. Erstes Laden, gleicher
// Schluessel mit anderer ttl und das Nachladen bleiben, wie sie waren.
// Die Suche im Material (Eingabefeld im Inhalt der Seite) waehlt mit
// `vorigeDatenZeigen` das alte Verhalten -- die alte Liste bleibt waehrend des
// Ladens stehen, aber nie nach einem Fehlschlag.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const mockCacheSet = vi.fn(async (key: string, data: unknown, ttl: number) => {
  cache.set(key, { data, timestamp: Date.now(), ttl });
});
vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn(async (key: string) => cache.get(key) ?? null),
    set: (key: string, data: unknown, ttl: number) => mockCacheSet(key, data, ttl),
    isStale: () => false,
  },
}));

let online = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return online; },
    subscribe: vi.fn(() => () => undefined),
    init: vi.fn(),
  },
}));

import { useOfflineQuery } from '../../hooks/useOfflineQuery';

type Antwort = { liste: string[] };

/** Ein Abruf je Schluessel, der erst antwortet, wenn der Test es sagt. */
function steuerbarerAbruf() {
  const offen = new Map<string, { loese: (w: Antwort) => void; lehneAb: (e: Error) => void }>();
  const abruf = (schluessel: string) => () => new Promise<Antwort>((loese, lehneAb) => {
    offen.set(schluessel, { loese, lehneAb });
  });
  return { abruf, offen };
}

beforeEach(() => {
  cache.clear();
  mockCacheSet.mockClear();
  online = true;
});

describe('Schluesselwechsel online', () => {
  it('waehrend die neue Antwort aussteht: keine alten Daten, loading true', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf(k)), {
      initialProps: { k: 'admin:badges:1:konfi' },
    });
    await waitFor(() => expect(offen.has('admin:badges:1:konfi')).toBe(true));
    await act(async () => { offen.get('admin:badges:1:konfi')!.loese({ liste: ['Konfi-Badge'] }); });
    expect(result.current.data).toEqual({ liste: ['Konfi-Badge'] });

    rerender({ k: 'admin:badges:1:teamer' });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(offen.has('admin:badges:1:teamer')).toBe(true));
    expect(result.current.data).toBeNull();

    await act(async () => { offen.get('admin:badges:1:teamer')!.loese({ liste: ['Team-Badge'] }); });
    expect(result.current.data).toEqual({ liste: ['Team-Badge'] });
    expect(result.current.loading).toBe(false);
  });

  it('scheitert die neue Antwort, steht der Fehler da -- nicht die alte Liste als "stale"', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf(k)), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(offen.has('a:konfi')).toBe(true));
    await act(async () => { offen.get('a:konfi')!.loese({ liste: ['alt'] }); });

    rerender({ k: 'a:teamer' });
    await waitFor(() => expect(offen.has('a:teamer')).toBe(true));
    await act(async () => { offen.get('a:teamer')!.lehneAb(new Error('Zeitueberschreitung')); });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Zeitueberschreitung');
    expect(result.current.isStale).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('liegt fuer den neuen Schluessel etwas im Zwischenspeicher, steht das sofort da', async () => {
    cache.set('a:teamer', { data: { liste: ['Team aus dem Speicher'] }, timestamp: Date.now(), ttl: 60000 });
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf(k)), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(offen.has('a:konfi')).toBe(true));
    await act(async () => { offen.get('a:konfi')!.loese({ liste: ['alt'] }); });

    rerender({ k: 'a:teamer' });

    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Team aus dem Speicher'] }));
    expect(result.current.loading).toBe(false);
    // Im Hintergrund wird trotzdem frisch geladen (SWR wie bisher).
    await waitFor(() => expect(offen.has('a:teamer')).toBe(true));
  });

  it('eine spaete Antwort des alten Schluessels ueberschreibt den neuen nicht', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf(k)), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(offen.has('a:konfi')).toBe(true));

    rerender({ k: 'a:teamer' });
    await waitFor(() => expect(offen.has('a:teamer')).toBe(true));
    await act(async () => { offen.get('a:teamer')!.loese({ liste: ['neu'] }); });
    await act(async () => { offen.get('a:konfi')!.loese({ liste: ['alt, zu spaet'] }); });

    expect(result.current.data).toEqual({ liste: ['neu'] });
  });

  it('zurueck zum ersten Schluessel: dessen Stand aus dem Zwischenspeicher', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf(k)), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(offen.has('a:konfi')).toBe(true));
    await act(async () => { offen.get('a:konfi')!.loese({ liste: ['Konfi'] }); });
    rerender({ k: 'a:teamer' });
    await waitFor(() => expect(offen.has('a:teamer')).toBe(true));
    await act(async () => { offen.get('a:teamer')!.loese({ liste: ['Team'] }); });

    rerender({ k: 'a:konfi' });

    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Konfi'] }));
  });
});

describe('Schluesselwechsel offline', () => {
  it('mit Zwischenspeicher fuer den neuen Schluessel: dessen Stand, kein Abruf', async () => {
    cache.set('a:konfi', { data: { liste: ['Konfi'] }, timestamp: Date.now(), ttl: 60000 });
    cache.set('a:teamer', { data: { liste: ['Team'] }, timestamp: Date.now(), ttl: 60000 });
    online = false;
    const abruf = vi.fn(async () => ({ liste: ['vom Netz'] }));
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Konfi'] }));

    rerender({ k: 'a:teamer' });

    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Team'] }));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(abruf).not.toHaveBeenCalled();
  });

  it('ohne Zwischenspeicher fuer den neuen Schluessel: Fehler, keine alte Liste', async () => {
    cache.set('a:konfi', { data: { liste: ['Konfi'] }, timestamp: Date.now(), ttl: 60000 });
    online = false;
    const abruf = vi.fn(async () => ({ liste: ['vom Netz'] }));
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, abruf), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Konfi'] }));

    rerender({ k: 'a:teamer' });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Keine Daten verfügbar (offline)');
    expect(abruf).not.toHaveBeenCalled();
  });

  it('Gegenprobe: offline ohne Wechsel bleibt der Stand aus dem Zwischenspeicher', async () => {
    cache.set('a:konfi', { data: { liste: ['Konfi'] }, timestamp: Date.now(), ttl: 60000 });
    online = false;
    const { result, rerender } = renderHook(({ k }) => useOfflineQuery<Antwort>(k, async () => ({ liste: [] })), {
      initialProps: { k: 'a:konfi' },
    });
    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Konfi'] }));

    rerender({ k: 'a:konfi' });

    expect(result.current.data).toEqual({ liste: ['Konfi'] });
    expect(result.current.loading).toBe(false);
  });
});

describe('Kein Wechsel: alles wie bisher', () => {
  it('gleicher Schluessel, andere ttl: Daten bleiben stehen, kein Laden', async () => {
    const abruf = vi.fn(async () => ({ liste: ['eins'] }));
    const { result, rerender } = renderHook(({ ttl }) => useOfflineQuery<Antwort>('a:konfi', abruf, { ttl }), {
      initialProps: { ttl: 1000 },
    });
    await waitFor(() => expect(result.current.data).toEqual({ liste: ['eins'] }));

    rerender({ ttl: 2000 });

    expect(result.current.data).toEqual({ liste: ['eins'] });
    expect(result.current.loading).toBe(false);
  });

  it('erstes Laden ohne Zwischenspeicher: loading true, dann Daten', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result } = renderHook(() => useOfflineQuery<Antwort>('a:konfi', abruf('a:konfi')));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(offen.has('a:konfi')).toBe(true));
    await act(async () => { offen.get('a:konfi')!.loese({ liste: ['x'] }); });
    expect(result.current.data).toEqual({ liste: ['x'] });
  });
});

describe('vorigeDatenZeigen (Suche im Material)', () => {
  it('waehrend die neue Antwort aussteht, bleibt die alte Liste stehen, ohne Ladeanzeige', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(
      ({ k }) => useOfflineQuery<Antwort>(k, abruf(k), { vorigeDatenZeigen: true }),
      { initialProps: { k: 'm:' } }
    );
    await waitFor(() => expect(offen.has('m:')).toBe(true));
    await act(async () => { offen.get('m:')!.loese({ liste: ['Alles'] }); });

    rerender({ k: 'm:Lied' });

    expect(result.current.data).toEqual({ liste: ['Alles'] });
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(offen.has('m:Lied')).toBe(true));
    await act(async () => { offen.get('m:Lied')!.loese({ liste: ['Liedblatt'] }); });
    expect(result.current.data).toEqual({ liste: ['Liedblatt'] });
  });

  it('scheitert die neue Antwort, verschwindet die alte Liste und der Fehler steht da', async () => {
    const { abruf, offen } = steuerbarerAbruf();
    const { result, rerender } = renderHook(
      ({ k }) => useOfflineQuery<Antwort>(k, abruf(k), { vorigeDatenZeigen: true }),
      { initialProps: { k: 'm:' } }
    );
    await waitFor(() => expect(offen.has('m:')).toBe(true));
    await act(async () => { offen.get('m:')!.loese({ liste: ['Alles'] }); });

    rerender({ k: 'm:Lied' });
    await waitFor(() => expect(offen.has('m:Lied')).toBe(true));
    await act(async () => { offen.get('m:Lied')!.lehneAb(new Error('Netzfehler')); });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Netzfehler');
    expect(result.current.isStale).toBe(false);
  });

  it('offline ohne Zwischenspeicher fuer die neue Suche: keine alte Liste', async () => {
    cache.set('m:', { data: { liste: ['Alles'] }, timestamp: Date.now(), ttl: 60000 });
    online = false;
    const { result, rerender } = renderHook(
      ({ k }) => useOfflineQuery<Antwort>(k, async () => ({ liste: [] }), { vorigeDatenZeigen: true }),
      { initialProps: { k: 'm:' } }
    );
    await waitFor(() => expect(result.current.data).toEqual({ liste: ['Alles'] }));

    rerender({ k: 'm:Lied' });

    await waitFor(() => expect(result.current.error).toBe('Keine Daten verfügbar (offline)'));
    expect(result.current.data).toBeNull();
  });
});

describe('Material der Leitung behaelt die alte Liste beim Suchen', () => {
  it('AdminMaterialPage waehlt vorigeDatenZeigen -- das Suchfeld steht im Inhalt, der beim Laden verschwindet', () => {
    const quelle = readFileSync(resolve(process.cwd(), 'src/components/admin/pages/AdminMaterialPage.tsx'), 'utf8');
    // Der Schluessel enthaelt die Suche ...
    expect(quelle).toMatch(/`admin:material:\$\{user\?\.organization_id\}:\$\{search\}/);
    // ... das Suchfeld steht im Zweig, den `loading` durch die Ladeanzeige ersetzt ...
    const ladezweig = quelle.indexOf('{loading ? (');
    const suchfeld = quelle.indexOf('aria-label="Material durchsuchen"');
    expect(ladezweig).toBeGreaterThan(-1);
    expect(suchfeld).toBeGreaterThan(ladezweig);
    // ... deshalb bleibt die alte Liste beim Tippen stehen.
    expect(quelle).toContain('vorigeDatenZeigen: true');
  });
});
