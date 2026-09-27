/**
 * Mitmachen: Events und Aktivitäten getrennt messen (Simon, 27.09.2026).
 *
 * Befund aus der Auswertung: „Activities hat heute nur 2, Events 235 — da
 * beides zusammenhängt, muss das noch korrigiert werden. Aktivitäten waren
 * heute viel." Ursache: Die Bereichsmessung (MainTabs) zählt am Pfad. Unter
 * „Mitmachen" liegen Events und Aktivitäten auf EINER Seite (/konfi/events,
 * /teamer/events), umgeschaltet über die Leiste „Events | Aktivitäten" —
 * das Umschalten ändert den Pfad nicht, jeder Besuch zählte als „events".
 *
 * Dazu: „Aktivität eingereicht wäre auch noch cool zu haben" — bisher gar
 * nicht gemessen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type Analytics = typeof import('../../services/analytics');

const ladeMitProd = async (): Promise<Analytics> => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  return await import('../../services/analytics');
};

const nutzlast = (aufruf: unknown[]): Record<string, unknown> => {
  const init = aufruf[1] as { body: string };
  return (JSON.parse(init.body) as { payload: Record<string, unknown> }).payload;
};

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Mitmachen: die Ansicht zählt als eigener Bereich', () => {
  it('Aktivitäten -> Bereich „activities" (derselbe Name wie die Aktivitäten-Seite der Leitung)', async () => {
    const a = await ladeMitProd();
    a.trackMitmachenAnsicht('antraege');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('bereich-geoeffnet');
    expect(p.data).toEqual({ bereich: 'activities' });
  });

  it('Events -> Bereich „events"', async () => {
    const a = await ladeMitProd();
    a.trackMitmachenAnsicht('events');
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.data).toEqual({ bereich: 'events' });
  });

  it.each([
    'src/components/konfi/pages/KonfiEventsPage.tsx',
    'src/components/teamer/pages/TeamerEventsPage.tsx',
  ])('%s meldet das Umschalten und den Einstieg über ?segment=antraege', (datei) => {
    const quelle = lies(datei);
    // Umschalten an der Leiste „Events | Aktivitäten"
    expect(quelle).toMatch(/onIonChange=\{\(e\) => mitmachenAnsichtWechseln\(e\.detail\.value as 'events' \| 'antraege'\)\}/);
    expect(quelle).toContain('trackMitmachenAnsicht(ansicht)');
    // Einstieg per Link direkt in die Aktivitäten
    expect(quelle).toContain("trackMitmachenAnsicht('antraege')");
  });
});

describe('Aktivität eingereicht', () => {
  it('kommt als eigenes Ereignis an, nur mit „mit_foto" — kein Name, keine Kennung', async () => {
    const a = await ladeMitProd();
    a.track('aktivitaet-eingereicht', { mit_foto: true });
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('aktivitaet-eingereicht');
    expect(p.data).toEqual({ mit_foto: true });
  });

  it.each([
    ['src/components/konfi/modals/ActivityRequestModal.tsx', "api.post('/konfi/requests', requestData)"],
    ['src/components/teamer/modals/TeamerActivityRequestModal.tsx', "api.post('/teamer/requests', requestData)"],
  ])('%s meldet erst NACH der erfolgreichen Antwort', (datei, anfrage) => {
    const quelle = lies(datei);
    const posAnfrage = quelle.indexOf(`await ${anfrage}`);
    const posMessung = quelle.indexOf("track('aktivitaet-eingereicht', { mit_foto: !!photoFilename })");
    const posCatch = quelle.indexOf('} catch', posAnfrage);
    expect(posAnfrage).toBeGreaterThan(-1);
    expect(posMessung).toBeGreaterThan(posAnfrage);
    expect(posMessung).toBeLessThan(posCatch);
  });
});
