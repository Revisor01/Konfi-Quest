// Betrieb in der Web-Fassung (/admin/metrics), gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): das Urteil zuerst, dann die
// Kennzahlen und vier Reiter mit Karten und Tabellen. Die Seite holt die
// Kennzahlen und rechnet die Urteile; geprueft werden die Zahlen, die dabei in
// der Web-Fassung stehen, das Aktualisieren, die Fehlerfaelle und dass die
// Darstellung der App bleibt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import { fmtDauer, fmtSeit, fmtUptime, fmtZahl, msColor, statusBezeichnung, statusColor, vergleichAnzeige } from '../../../utils/betriebsFormat';
import { METRIK_AMPEL } from '../../../theme/colors';

const h = vi.hoisted(() => ({
  breit: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  apiGet: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: (...a: unknown[]) => h.apiGet(...a) } }));

import AdminMetricsPage from '../../../components/admin/pages/AdminMetricsPage';

const vorMin = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const tag = (verschoben: number, stunde: number, minute = 0) => {
  const jetzt = new Date();
  return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + verschoben, stunde, minute).toISOString();
};
const dm = (verschoben: number) => {
  const d = new Date();
  d.setDate(d.getDate() + verschoben);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
};

const ROUTEN = [
  {
    route: 'GET /api/konfis', count: 500, errors: 0, errorRate: 0, avgMs: 120, p95Ms: 300, maxMs: 700,
    serverAvgMs: 80, serverP95Ms: 200, serverMaxMs: 600, serverP50Ms: 60, serverZeitGesamtMs: 40000,
    netzAvgMs: 40, cacheQuote: 62, langsam: 7, langsamQuote: 1.4, stichproben: 500,
  },
  {
    route: 'POST /api/upload', count: 12, errors: 1, errorRate: 8, avgMs: 1100, p95Ms: 1800, maxMs: 1800,
    serverAvgMs: 900, serverP95Ms: 1500, serverMaxMs: 1500, serverP50Ms: 800, serverZeitGesamtMs: 10800,
    netzAvgMs: 0, stichproben: 12,
  },
];

const SNAP = {
  uptimeSeconds: 93780, totalRequests: 12345, totalErrors: 3, errorRate: 0, inFlight: 2, maxInFlight: 9, rps: 4.2,
  routesSlowest: ROUTEN, routesBusiest: ROUTEN, routesPotenzial: [],
  recentErrors: [
    { route: '/api/chat', url: '/api/chat/rooms/9', status: 500, durationMs: 123, at: vorMin(30) },
    { route: '/api/legacy', url: '/api/legacy/x', status: 404, durationMs: 8, at: vorMin(60) },
  ],
  timeline: [{ t: vorMin(5), requests: 20, errors: 0, avgMs: 80 }],
  replicas: [
    { replica: 'abcdef1234567890', requests: 9000, inFlight: 1, share: 0.73 },
    { replica: 'zyxwvu9876543210', requests: 3345, inFlight: 1, share: 0.27 },
  ],
  apdex: { wert: 0.91, zufrieden: 900, toleriert: 80, frustriert: 20, schwelleMs: 200, toleriertBisMs: 800 },
  ueber1s: { anzahl: 31, quote: 2.5, schwelleMs: 1000 },
  statusKlassen: { erfolg: 10000, ausDemCache: 1500, umleitung: 20, nichtGefunden: 700, abgelehnt: 100, serverfehler: 3 },
  nutzer: { fensterMinuten: 15, aktiv: 12, betroffen: 2 },
  fehlerGruppen: [
    { route: '/api/chat/rooms/:id', status: 500, anzahl: 3, seit: vorMin(180), zuletzt: vorMin(20), beispielUrl: '/api/chat/rooms/9' },
    { route: '/api/legacy', status: 404, anzahl: 40, seit: vorMin(2880), zuletzt: vorMin(60), beispielUrl: '/api/legacy/x' },
  ],
};

// Zwei Tage davor und heute: Anfragen, Fehler und die langsamste Route je Fuenf-Minuten-Schritt.
const HISTORIE = [
  { captured_at: tag(-2, 10, 0), total_requests: 1000, total_errors: 0, max_in_flight: 3, worst_p95_ms: 100, worst_route: null },
  { captured_at: tag(-2, 10, 5), total_requests: 1600, total_errors: 1, max_in_flight: 4, worst_p95_ms: 400, worst_route: '/api/a' },
  { captured_at: tag(-1, 10, 0), total_requests: 2200, total_errors: 1, max_in_flight: 4, worst_p95_ms: 300, worst_route: '/api/b' },
  { captured_at: tag(-1, 10, 5), total_requests: 3000, total_errors: 1, max_in_flight: 5, worst_p95_ms: 250, worst_route: '/api/c' },
  { captured_at: tag(0, 0, 0), total_requests: 3600, total_errors: 1, max_in_flight: 5, worst_p95_ms: 200, worst_route: '/api/d' },
  { captured_at: tag(0, 0, 1), total_requests: 4100, total_errors: 3, max_in_flight: 6, worst_p95_ms: 900, worst_route: '/api/slow' },
];

const tabelle = (name: string) => screen.getByRole('table', { name });
const zeilen = (name: string) => within(tabelle(name)).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const spaltenkoepfe = (name: string) => within(tabelle(name)).getAllByRole('columnheader').map((c) => c.textContent);
const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const aufrufe = (url: string) => h.apiGet.mock.calls.filter(([u]) => u === url).length;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/metrics') return { data: SNAP };
    if (url === '/metrics/history?days=14') return { data: { snapshots: HISTORIE } };
    throw new Error(`unerwartet: ${url}`);
  });
});

const oeffnen = async () => {
  const r = render(<AdminMetricsPage />);
  await warten();
  return r;
};

// ---------------------------------------------------------------------------
describe('Schreibweise der Kennzahlen (utils/betriebsFormat)', () => {
  it('Laufzeit, Zahlen und Dauern', () => {
    expect(fmtUptime(93780)).toBe('1 T 2 Std');
    expect(fmtUptime(7500)).toBe('2 Std 5 Min');
    expect(fmtUptime(2520)).toBe('42 Min');
    expect(fmtZahl(12345)).toBe('12.345');
    expect(fmtDauer(450)).toBe('450 ms');
    expect(fmtDauer(1500)).toBe('1,5 s');
    expect(fmtDauer(180000)).toBe('3 Min');
  });

  it('"vor ..." in Minuten, Stunden und Tagen', () => {
    expect(fmtSeit(vorMin(0))).toBe('gerade eben');
    expect(fmtSeit(vorMin(20))).toBe('vor 20 Min');
    expect(fmtSeit(vorMin(180))).toBe('vor 3 Std');
    expect(fmtSeit(vorMin(2880))).toBe('vor 2 T');
  });

  it('Ampel einer Dauer und eines Status, Name des Status', () => {
    expect(msColor(100)).toBe(METRIK_AMPEL.gut);
    expect(msColor(200)).toBe(METRIK_AMPEL.maessig);
    expect(msColor(500)).toBe(METRIK_AMPEL.erhoeht);
    expect(msColor(1000)).toBe(METRIK_AMPEL.kritisch);
    expect(statusColor(200)).toBe(METRIK_AMPEL.gut);
    expect(statusColor(404)).toBe(METRIK_AMPEL.erhoeht);
    expect(statusColor(500)).toBe(METRIK_AMPEL.kritisch);
    expect([500, 404, 403, 401, 400].map(statusBezeichnung)).toEqual(['Serverfehler', 'nicht gefunden', 'abgelehnt', 'nicht angemeldet', 'abgewiesen']);
  });

  it('Vergleich: unter 10 % keine Farbe, ab 10 % bei "weniger ist besser" Rot bzw. Gruen, bei "neutral" nie', () => {
    expect(vergleichAnzeige(9, 'wenigerIstBesser')).toEqual({ merklich: false, farbe: 'var(--app-text-system)', pfeil: '▲' });
    expect(vergleichAnzeige(10, 'wenigerIstBesser')).toEqual({ merklich: true, farbe: METRIK_AMPEL.erhoeht, pfeil: '▲' });
    expect(vergleichAnzeige(-40, 'wenigerIstBesser')).toEqual({ merklich: true, farbe: METRIK_AMPEL.gut, pfeil: '▼' });
    expect(vergleichAnzeige(80, 'neutral')).toEqual({ merklich: true, farbe: 'var(--app-text-system)', pfeil: '▲' });
    expect(vergleichAnzeige(null, 'wenigerIstBesser')).toEqual({ merklich: false, farbe: 'var(--app-text-system)', pfeil: '' });
    expect(vergleichAnzeige(0, 'neutral').pfeil).toBe('=');
  });
});

// ---------------------------------------------------------------------------
describe('Betrieb (Web): Urteil und Kennzahlen', () => {
  it('Titel, Weg zurueck, das Urteil mit Laufzeit und die vier Kennzahlen', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Betrieb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    const urteil = within(screen.getByRole('region', { name: 'Zustand des Servers' }));
    expect(urteil.getByRole('heading', { name: 'Läuft, mit Fehlern in der Vergangenheit' })).toBeInTheDocument();
    expect(urteil.getByText('Seit dem Start 3 Serverfehler, aber gerade keine neuen.')).toBeInTheDocument();
    expect(urteil.getByText('Ohne Neustart seit 1 T 2 Std · 4.2 Anfragen/Sek')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Zustand des Servers' }).className).toContain('web-zustand--auffaellig');
    expect(screen.getByRole('group', { name: 'Warten über 1 s: 2,5 %' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Aktiv (15 Min): 12' })).toHaveTextContent('2 davon mit Warten oder Fehler');
    expect(screen.getByRole('group', { name: 'Gleichzeitig: 2' })).toHaveTextContent('bisher höchstens 9');
    expect(screen.getByRole('group', { name: 'Anfragen: 12.345' })).toHaveTextContent('seit dem letzten Neustart');
  });

  it('die Seite holt Kennzahlen und 14 Tage Historie; "Neu laden" holt beides noch einmal', async () => {
    await oeffnen();
    expect(aufrufe('/metrics')).toBe(1);
    expect(aufrufe('/metrics/history?days=14')).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Daten neu laden' }));
    await warten();
    expect(aufrufe('/metrics')).toBe(2);
    expect(aufrufe('/metrics/history?days=14')).toBe(2);
  });

  describe('Aktualisieren alle 5 Sekunden', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); });
    afterEach(() => { vi.useRealTimers(); });

    it('laeuft an, der Schalter haelt es an und setzt es fort -- ohne die Historie neu zu laden', async () => {
      await oeffnen();
      expect(aufrufe('/metrics')).toBe(1);
      await act(async () => { vi.advanceTimersByTime(5000); });
      await warten();
      expect(aufrufe('/metrics')).toBe(2);
      expect(aufrufe('/metrics/history?days=14')).toBe(1);
      const schalter = screen.getByRole('switch', { name: 'Alle 5 Sekunden aktualisieren' });
      expect(schalter).toBeChecked();
      fireEvent.click(schalter);
      await act(async () => { vi.advanceTimersByTime(15000); });
      await warten();
      expect(aufrufe('/metrics')).toBe(2);
      fireEvent.click(schalter);
      await act(async () => { vi.advanceTimersByTime(5000); });
      await warten();
      expect(aufrufe('/metrics')).toBe(3);
    });
  });

  it('ohne Super-Admin-Recht sagt die Seite es; sonst steht die allgemeine Meldung da -- mit erneutem Versuch', async () => {
    h.apiGet.mockRejectedValue({ response: { status: 403 } });
    const { unmount } = await oeffnen();
    expect(screen.getByRole('alert')).toHaveTextContent('Nur für Super-Admins.');
    unmount();
    h.apiGet.mockRejectedValue(new Error('Netz weg'));
    await oeffnen();
    expect(screen.getByRole('alert')).toHaveTextContent('Die Kennzahlen konnten nicht geladen werden.');
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? SNAP : { snapshots: HISTORIE } }));
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await warten();
    expect(screen.getByRole('heading', { name: 'Läuft, mit Fehlern in der Vergangenheit' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Betrieb (Web): Ueberblick', () => {
  it('Apdex mit Zahl, Stufe und Anteilen; Antworten des Servers; Lastverteilung mit Schieflast', async () => {
    await oeffnen();
    const apdex = within(screen.getByRole('region', { name: 'Merken Nutzer:innen etwas?' }));
    expect(apdex.getByText('0,91')).toBeInTheDocument();
    expect(apdex.getByText('von 1,00 — gut')).toBeInTheDocument();
    expect(apdex.getByText('zügig 900 (90 %)')).toBeInTheDocument();
    expect(apdex.getByText('erträglich 80 (8 %)')).toBeInTheDocument();
    expect(apdex.getByText('zu langsam 20 (2 %)')).toBeInTheDocument();
    expect(apdex.getByText(/Zügig heißt hier bis 200 ms, erträglich bis 800 ms\. Nichts zu tun\./)).toBeInTheDocument();
    const antworten = within(screen.getByRole('region', { name: 'Was der Server zurückgibt' }));
    expect(antworten.getByText('in Ordnung 10.000 (81 %)')).toBeInTheDocument();
    expect(antworten.getByText('schon bekannt 1.500 (12 %)')).toBeInTheDocument();
    expect(antworten.getByText('Serverfehler 3 (0 %)')).toBeInTheDocument();
    const last = within(screen.getByRole('region', { name: 'Lastverteilung (2 Instanzen)' }));
    expect(last.getByText('abcdef123456')).toBeInTheDocument();
    expect(last.getByText('9.000 Anfragen · 73 % · 1 aktiv')).toBeInTheDocument();
    expect(last.getByText('3.345 Anfragen · 27 % · 1 aktiv')).toBeInTheDocument();
    expect(last.getByText('Hinweis: Last ungleich verteilt — eine Instanz trägt den Großteil.')).toBeInTheDocument();
  });

  it('heute gegen die Vortage: Fehler, langsamste Route und der Hinweis mit der Zahl der Vergleichstage', async () => {
    await oeffnen();
    const v = within(screen.getByRole('region', { name: 'Heute gegen die Vortage' }));
    const zeile = (name: string) => v.getByText(name).closest('li')!;
    expect(zeile('Anfragen je Stunde')).toHaveTextContent('sonst');
    expect(zeile('Fehler heute')).toHaveTextContent('2');
    expect(zeile('Fehler heute')).toHaveTextContent('sonst 0,5 am Tag');
    expect(zeile('Langsamste Route')).toHaveTextContent('900 ms');
    expect(zeile('Langsamste Route')).toHaveTextContent('/api/slow');
    expect(zeile('Langsamste Route')).toHaveTextContent('▲ 157 %');
    expect(v.getByText(/Schnitt der 2 Vortage/)).toBeInTheDocument();
  });

  it('ohne zwei Tage Aufzeichnung steht der Hinweis statt des Vergleichs', async () => {
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? SNAP : { snapshots: HISTORIE.slice(4) } }));
    await oeffnen();
    expect(within(screen.getByRole('region', { name: 'Heute gegen die Vortage' })).getByText('Für einen Vergleich braucht es mindestens zwei Tage Aufzeichnung.')).toBeInTheDocument();
  });

  it('eine Instanz, keine Apdex-Daten: die Karten fehlen', async () => {
    h.apiGet.mockImplementation(async (url: string) => ({
      data: url === '/metrics' ? { ...SNAP, replicas: [SNAP.replicas[0]], apdex: undefined, statusKlassen: undefined } : { snapshots: [] },
    }));
    await oeffnen();
    expect(screen.queryByRole('region', { name: /Lastverteilung/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Merken Nutzer:innen etwas?' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Was der Server zurückgibt' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Heute gegen die Vortage' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Betrieb (Web): Fehler, Routen und Verlauf', () => {
  it('Fehler: der Reiter traegt die Zahl der Gruppen; die Tabelle nach Route und Art, dann die Einzelfaelle', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: /^Fehler\s*2\s*Fehlerarten seit dem letzten Neustart$/ }));
    expect(spaltenkoepfe('Fehler nach Route und Art')).toEqual(['Route', 'Art', 'Anzahl', 'Erstmals', 'Zuletzt', 'Zuletzt aufgerufen', ]);
    const z = zeilen('Fehler nach Route und Art');
    expect(z).toHaveLength(2);
    expect(zelle(z[0], 0)).toHaveTextContent('/api/chat/rooms/:id');
    expect(zelle(z[0], 1)).toHaveTextContent('500 · Serverfehler');
    expect(zelle(z[0], 2)).toHaveTextContent('3×');
    expect(zelle(z[0], 3)).toHaveTextContent('vor 3 Std');
    expect(zelle(z[0], 4)).toHaveTextContent('vor 20 Min');
    expect(zelle(z[0], 5)).toHaveTextContent('/api/chat/rooms/9');
    expect(zelle(z[1], 1)).toHaveTextContent('404 · nicht gefunden');
    expect(zelle(z[1], 2)).toHaveTextContent('40×');
    expect(zelle(z[1], 3)).toHaveTextContent('vor 2 T');
    const einzel = zeilen('Die letzten Einzelfälle');
    expect(einzel).toHaveLength(2);
    expect(zelle(einzel[0], 0)).toHaveTextContent('/api/chat/rooms/9');
    expect(zelle(einzel[0], 1)).toHaveTextContent('500');
    expect(zelle(einzel[0], 3)).toHaveTextContent('123 ms');
  });

  it('ohne Fehler steht "Kein Fehler seit dem letzten Neustart"', async () => {
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? { ...SNAP, fehlerGruppen: [], recentErrors: [] } : { snapshots: [] } }));
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Fehler' }));
    expect(screen.getByText('Kein Fehler seit dem letzten Neustart.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Fehler: "Vom Browser blockiert" zeigt die CSP-Meldungen nach Regel, Adresse und Seite', async () => {
    const csp = {
      gesamt: 9, verworfen: 2, gruppenAnzahl: 2, grenze: 200,
      gruppen: [
        { direktive: 'img-src', blockiert: 'https://bilder.example.org/x.png', seite: '/konfi/events/:id', anzahl: 6, seit: vorMin(180), zuletzt: vorMin(20) },
        { direktive: 'script-src-elem', blockiert: 'chrome-extension', seite: '/start', anzahl: 1, seit: vorMin(60), zuletzt: vorMin(60) },
      ],
    };
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? { ...SNAP, cspMeldungen: csp } : { snapshots: HISTORIE } }));
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: /^Fehler\s*2\s*Fehlerarten seit dem letzten Neustart$/ }));
    expect(spaltenkoepfe('Vom Browser blockiert')).toEqual(['Regel', 'Blockiert', 'Seite', 'Anzahl', 'Erstmals', 'Zuletzt']);
    const z = zeilen('Vom Browser blockiert');
    expect(z).toHaveLength(2);
    expect(zelle(z[0], 0)).toHaveTextContent('img-src');
    expect(zelle(z[0], 1)).toHaveTextContent('https://bilder.example.org/x.png');
    expect(zelle(z[0], 2)).toHaveTextContent('/konfi/events/:id');
    expect(zelle(z[0], 3)).toHaveTextContent('6×');
    expect(zelle(z[0], 4)).toHaveTextContent('vor 3 Std');
    expect(zelle(z[1], 1)).toHaveTextContent('chrome-extension');
    expect(screen.getByText('2 weitere Meldungen nicht aufgeschlüsselt (mehr als 200 verschiedene).')).toBeInTheDocument();
  });

  it('Fehler: ohne CSP-Meldung steht "Keine Meldung", auch wenn es sonst keinen Fehler gibt; ohne Feld (alter Server) fehlt die Karte', async () => {
    h.apiGet.mockImplementation(async (url: string) => ({
      data: url === '/metrics'
        ? { ...SNAP, fehlerGruppen: [], recentErrors: [], cspMeldungen: { gesamt: 0, verworfen: 0, gruppenAnzahl: 0, grenze: 200, gruppen: [] } }
        : { snapshots: [] },
    }));
    const { unmount } = await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Fehler' }));
    expect(screen.getByText('Kein Fehler seit dem letzten Neustart.')).toBeInTheDocument();
    expect(screen.getByText('Der Browser hat seit dem letzten Neustart nichts blockiert.')).toBeInTheDocument();
    unmount();

    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? SNAP : { snapshots: [] } }));
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: /^Fehler\s*2\s*Fehlerarten seit dem letzten Neustart$/ }));
    expect(screen.queryByText('Vom Browser blockiert')).toBeNull();
  });

  it('Routen: die langsamsten zuerst -- Median, Aufrufe, Durchschnitt, p95, Anteil und Hinweise', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Routen' }));
    expect(spaltenkoepfe('Routen')).toEqual(['Route', 'Median', 'Aufrufe', 'Durchschnitt', 'p95', 'Anteil Serverzeit', 'Hinweise']);
    const z = zeilen('Routen');
    expect(z.map((r) => zelle(r, 0).textContent)).toEqual(['POST /api/upload', 'GET /api/konfis']);
    expect(zelle(z[0], 1)).toHaveTextContent('800 ms');
    expect(zelle(z[0], 2)).toHaveTextContent('12');
    expect(zelle(z[0], 3)).toHaveTextContent('900 ms');
    // Nur 12 Messwerte: der p95 ist hier der langsamste Einzelwert und steht auch so da.
    expect(zelle(z[0], 4)).toHaveTextContent('langsamster 1500 ms');
    expect(zelle(z[0], 4)).toHaveTextContent('nur 12 Messwerte');
    expect(zelle(z[0], 4)).not.toHaveTextContent('höchstens');
    expect(zelle(z[0], 5)).toHaveTextContent('21 %');
    expect(zelle(z[0], 6)).toHaveTextContent('1 Fehler');
    expect(zelle(z[1], 1)).toHaveTextContent('60 ms');
    expect(zelle(z[1], 2)).toHaveTextContent('500');
    expect(zelle(z[1], 4)).toHaveTextContent('200 ms');
    expect(zelle(z[1], 4)).toHaveTextContent('höchstens 600 ms');
    expect(zelle(z[1], 4)).not.toHaveTextContent('langsamster');
    expect(zelle(z[1], 5)).toHaveTextContent('79 %');
    expect(zelle(z[1], 6)).toHaveTextContent('7× über 1 s (1.4 %)');
    expect(zelle(z[1], 6)).toHaveTextContent('62 % aus dem Zwischenspeicher');
    expect(zelle(z[1], 6)).toHaveTextContent('+ 40 ms Leitung');
  });

  it('Routen: "Haeufigste" sortiert nach der Zahl der Aufrufe', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Routen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Häufigste' }));
    expect(zeilen('Routen').map((r) => zelle(r, 0).textContent)).toEqual(['GET /api/konfis', 'POST /api/upload']);
    expect(screen.getByRole('button', { name: 'Häufigste' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Verlauf: je Tag (neuester zuerst) mit Summe der Schritte, dann die Fuenf-Minuten-Schritte', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Verlauf' }));
    expect(spaltenkoepfe('Je Tag')).toEqual(['Tag', 'Anfragen', 'Fehler', 'Langsamste', 'Langsamste Route']);
    const tage = zeilen('Je Tag');
    expect(tage).toHaveLength(3);
    // Heute: 600 + 500 Anfragen aus zwei Schritten, 2 Fehler, langsamste 900 ms.
    expect(zelle(tage[0], 0)).toHaveTextContent(dm(0));
    expect(zelle(tage[0], 1)).toHaveTextContent('1.100');
    expect(zelle(tage[0], 2)).toHaveTextContent('2');
    expect(zelle(tage[0], 3)).toHaveTextContent('900 ms');
    expect(zelle(tage[0], 4)).toHaveTextContent('/api/slow');
    expect(zelle(tage[1], 0)).toHaveTextContent(dm(-1));
    expect(zelle(tage[1], 1)).toHaveTextContent('1.400');
    expect(zelle(tage[1], 2)).toHaveTextContent('0');
    expect(zelle(tage[2], 0)).toHaveTextContent(dm(-2));
    expect(zelle(tage[2], 1)).toHaveTextContent('600');
    expect(zelle(tage[2], 2)).toHaveTextContent('1');
    expect(zelle(tage[2], 3)).toHaveTextContent('400 ms');
    const schritte = zeilen('In Fünf-Minuten-Schritten');
    expect(schritte).toHaveLength(5);
    expect(zelle(schritte[0], 1)).toHaveTextContent('500');
    expect(zelle(schritte[0], 2)).toHaveTextContent('2');
    expect(zelle(schritte[0], 3)).toHaveTextContent('900 ms');
  });

  it('Verlauf ohne Aufzeichnung: Hinweise statt Tabellen', async () => {
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? SNAP : { snapshots: [] } }));
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Verlauf' }));
    expect(screen.getAllByText('Noch keine Aufzeichnung')).toHaveLength(2);
    expect(screen.queryByRole('table')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Betrieb: schmal bleibt die Darstellung der App', () => {
  it('ohne breites Layout keine Karten und Tabellen der Web-Fassung', async () => {
    h.breit = false;
    const { container } = await oeffnen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Zustand des Servers' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    // Die App zeigt das Urteil als Titel in ihrer Karte.
    expect(screen.getByText('Läuft, mit Fehlern in der Vergangenheit')).toBeInTheDocument();
  });

  it('die App zeigt die CSP-Meldungen im Reiter Fehler unter den Fehlern', async () => {
    h.breit = false;
    const csp = { gesamt: 6, verworfen: 0, gruppenAnzahl: 1, grenze: 200, gruppen: [
      { direktive: 'img-src', blockiert: 'https://bilder.example.org/x.png', seite: '/konfi/events/:id', anzahl: 6, seit: vorMin(180), zuletzt: vorMin(20) },
    ] };
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/metrics' ? { ...SNAP, cspMeldungen: csp } : { snapshots: HISTORIE } }));
    await oeffnen();
    fireEvent.click(screen.getByRole('tab', { name: /^Fehler/ }));
    expect(screen.getByText('https://bilder.example.org/x.png')).toBeInTheDocument();
    expect(screen.getByText('6×')).toBeInTheDocument();
    expect(screen.getByText('auf /konfi/events/:id')).toBeInTheDocument();
  });
});
