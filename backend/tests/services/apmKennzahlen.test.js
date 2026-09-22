// backend/tests/services/apmKennzahlen.test.js
//
// Die Kennzahlen, aus denen sich Handlungen ableiten lassen: Apdex,
// Anfragen ueber 1 s, Antwort-Klassen, Nutzer:innen im Fenster,
// Verbesserungs-Potenzial je Route und gruppierte Fehler.
//
// Gemessen wird ueber echte HTTP-Anfragen gegen einen Express-Server auf
// Loopback — wie in apmCacheUndScanner.test.js. Wo Loopback nicht reicht
// (Warten auf die Leitung), wird bewusst NICHT geprueft; die Lehre dazu
// steht im Kopf der Nachbardatei.

const express = require('express');

function frischesApm() {
  // Der Zustand liegt im Modul; fuer unabhaengige Messungen neu laden.
  delete require.cache[require.resolve('../../utils/apm')];
  return require('../../utils/apm');
}

// Startet einen Server, ruft die angegebenen Pfade der Reihe nach ab und
// gibt den Snapshot zurueck.
async function messe(apm, routen, aufrufe) {
  const app = express();
  app.use(apm.apmMiddleware);
  for (const [pfad, handler] of Object.entries(routen)) app.get(pfad, handler);
  const srv = app.listen(0);
  const port = srv.address().port;
  for (const pfad of aufrufe) {
    await fetch(`http://127.0.0.1:${port}${pfad}`).then((r) => r.text());
  }
  await new Promise((r) => srv.close(r));
  return apm.snapshot();
}

describe('APM: Apdex', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('zaehlt schnelle Antworten als zufrieden und liefert Apdex 1', async () => {
    const s = await messe(apm, { '/api/flink': (req, res) => res.json({ ok: true }) },
      ['/api/flink', '/api/flink', '/api/flink', '/api/flink']);

    expect(s.apdex.zufrieden).toBe(4);
    expect(s.apdex.toleriert).toBe(0);
    expect(s.apdex.frustriert).toBe(0);
    expect(s.apdex.wert).toBe(1);
    expect(s.apdex.schwelleMs).toBe(500);
    expect(s.apdex.toleriertBisMs).toBe(2000);
  });

  it('zaehlt eine Antwort zwischen Schwelle und 4x Schwelle als toleriert und halbiert sie', async () => {
    // 600 ms liegen ueber 500 (zufrieden) und unter 2000 (frustriert).
    const s = await messe(apm, {
      '/api/flink': (req, res) => res.json({ ok: true }),
      '/api/zaeh': (req, res) => setTimeout(() => res.json({ ok: true }), 600),
    }, ['/api/flink', '/api/zaeh']);

    expect(s.apdex.zufrieden).toBe(1);
    expect(s.apdex.toleriert).toBe(1);
    expect(s.apdex.frustriert).toBe(0);
    // (1 + 1/2) / 2 = 0,75
    expect(s.apdex.wert).toBe(0.75);
  });

  it('zaehlt einen Serverfehler als frustriert, auch wenn er schnell kam', async () => {
    const s = await messe(apm, {
      '/api/flink': (req, res) => res.json({ ok: true }),
      '/api/kaputt': (req, res) => res.status(500).json({ error: 'x' }),
    }, ['/api/flink', '/api/kaputt']);

    // Der 500 kam in wenigen Millisekunden — trotzdem frustriert: Eine
    // schnelle Fehlermeldung ist kein zufriedener Nutzer.
    expect(s.apdex.zufrieden).toBe(1);
    expect(s.apdex.frustriert).toBe(1);
    expect(s.apdex.wert).toBe(0.5);
  });

  it('liefert ohne Anfragen keinen Apdex-Wert statt einer 0', () => {
    const s = apm.snapshot();
    // 0 hiesse "alles frustriert". Ohne Daten gibt es keine Aussage.
    expect(s.apdex.wert).toBeNull();
    expect(s.totalRequests).toBe(0);
  });

  it('weist den Apdex auch je Route aus', async () => {
    const s = await messe(apm, {
      '/api/gut': (req, res) => res.json({ ok: true }),
      '/api/kaputt': (req, res) => res.status(500).json({ error: 'x' }),
    }, ['/api/gut', '/api/gut', '/api/kaputt']);

    const gut = s.routesBusiest.find((r) => r.route === 'GET /api/gut');
    const kaputt = s.routesBusiest.find((r) => r.route === 'GET /api/kaputt');
    expect(gut.apdex).toBe(1);
    expect(kaputt.apdex).toBe(0);
  });
});

describe('APM: Anfragen ueber einer Sekunde', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('zaehlt nur Antworten ueber der Schwelle und rechnet die Quote', async () => {
    const s = await messe(apm, {
      '/api/flink': (req, res) => res.json({ ok: true }),
      '/api/lahm': (req, res) => setTimeout(() => res.json({ ok: true }), 1100),
    }, ['/api/flink', '/api/flink', '/api/flink', '/api/lahm']);

    expect(s.ueber1s.anzahl).toBe(1);
    expect(s.ueber1s.quote).toBe(25);
    expect(s.ueber1s.schwelleMs).toBe(1000);

    const lahm = s.routesBusiest.find((r) => r.route === 'GET /api/lahm');
    const flink = s.routesBusiest.find((r) => r.route === 'GET /api/flink');
    expect(lahm.langsam).toBe(1);
    expect(lahm.langsamQuote).toBe(100);
    expect(flink.langsam).toBe(0);
    expect(flink.langsamQuote).toBe(0);
  });
});

describe('APM: Antwort-Klassen', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('sortiert jede Anfrage in genau einen Topf', async () => {
    const s = await messe(apm, {
      '/api/ok': (req, res) => res.json({ ok: true }),
      '/api/gecacht': (req, res) => res.status(304).end(),
      '/api/weg': (req, res) => res.status(404).json({ error: 'weg' }),
      '/api/verboten': (req, res) => res.status(403).json({ error: 'nein' }),
      '/api/kaputt': (req, res) => res.status(500).json({ error: 'x' }),
    }, ['/api/ok', '/api/ok', '/api/gecacht', '/api/weg', '/api/verboten', '/api/kaputt']);

    expect(s.statusKlassen.erfolg).toBe(2);
    expect(s.statusKlassen.ausDemCache).toBe(1);
    expect(s.statusKlassen.nichtGefunden).toBe(1);
    expect(s.statusKlassen.abgelehnt).toBe(1);
    expect(s.statusKlassen.serverfehler).toBe(1);
    expect(s.statusKlassen.umleitung).toBe(0);

    // Die Toepfe zusammen ergeben genau die Gesamtzahl — keine Anfrage
    // faellt durch, keine wird doppelt gezaehlt.
    const summe = Object.values(s.statusKlassen).reduce((a, b) => a + b, 0);
    expect(summe).toBe(6);
    expect(summe).toBe(s.totalRequests);
  });
});

describe('APM: Verbesserungs-Potenzial je Route', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('stellt die haeufige Route ueber die einzelne langsame', async () => {
    // 40 x rund 15 ms (= ca. 600 ms Serverzeit) gegen 1 x 300 ms.
    // Nach p95 stuende die langsame oben, nach Gesamtzeit die haeufige.
    const s = await messe(apm, {
      '/api/haeufig': (req, res) => setTimeout(() => res.json({ ok: true }), 15),
      '/api/selten': (req, res) => setTimeout(() => res.json({ ok: true }), 300),
    }, [...Array(40).fill('/api/haeufig'), '/api/selten']);

    const haeufig = s.routesPotenzial.find((r) => r.route === 'GET /api/haeufig');
    const selten = s.routesPotenzial.find((r) => r.route === 'GET /api/selten');

    // Gesamte Serverzeit = Anzahl x Durchschnitt.
    expect(haeufig.serverZeitGesamtMs).toBeGreaterThan(selten.serverZeitGesamtMs);
    // ... und genau deshalb steht sie in routesPotenzial vor der langsamen.
    expect(s.routesPotenzial[0].route).toBe('GET /api/haeufig');
    // Waehrend die alte Sortierung nach p95 sie hinten haette:
    expect(s.routesSlowest[0].route).toBe('GET /api/selten');
  });

  it('weist den Median neben dem p95 aus', async () => {
    const s = await messe(apm, { '/api/x': (req, res) => res.json({ ok: true }) },
      Array(10).fill('/api/x'));
    const x = s.routesBusiest.find((r) => r.route === 'GET /api/x');
    expect(typeof x.p50Ms).toBe('number');
    expect(typeof x.serverP50Ms).toBe('number');
    // Der Median kann nie ueber dem p95 liegen.
    expect(x.p50Ms).toBeLessThanOrEqual(x.p95Ms);
    expect(x.serverP50Ms).toBeLessThanOrEqual(x.serverP95Ms);
  });
});

describe('APM: Fehler-Gruppen', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('fasst denselben Fehler zusammen und haelt erstes und letztes Auftreten', async () => {
    const s = await messe(apm, {
      '/api/kaputt': (req, res) => res.status(500).json({ error: 'x' }),
      '/api/weg': (req, res) => res.status(404).json({ error: 'weg' }),
    }, ['/api/kaputt', '/api/kaputt', '/api/kaputt', '/api/weg']);

    expect(s.fehlerGruppen).toHaveLength(2);
    const kaputt = s.fehlerGruppen.find((g) => g.status === 500);
    expect(kaputt.route).toBe('GET /api/kaputt');
    expect(kaputt.anzahl).toBe(3);
    expect(new Date(kaputt.zuletzt).getTime()).toBeGreaterThanOrEqual(new Date(kaputt.seit).getTime());

    const weg = s.fehlerGruppen.find((g) => g.status === 404);
    expect(weg.anzahl).toBe(1);
    // Die haeufigste Gruppe steht oben.
    expect(s.fehlerGruppen[0].status).toBe(500);
  });

  it('haelt die Zahl auch dann, wenn das Roh-Log (50 Eintraege) laengst ueberlaeuft', async () => {
    const s = await messe(apm, { '/api/kaputt': (req, res) => res.status(500).json({ error: 'x' }) },
      Array(60).fill('/api/kaputt'));

    // Das rollierende Log kappt bei 50 ...
    expect(s.recentErrors).toHaveLength(50);
    // ... die Gruppe zaehlt trotzdem alle 60. Genau dafuer gibt es sie.
    expect(s.fehlerGruppen[0].anzahl).toBe(60);
  });
});

describe('APM: Nutzer:innen im Zeitfenster', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  // Der Hash haengt am Modul, deshalb ueber die Middleware statt direkt.
  async function messeMitNutzern(zuordnung) {
    const app = express();
    // Steht VOR dem APM in der Kette? Nein — apmMiddleware registriert den
    // finish-Handler und liest req.user erst dort. Genau wie im Betrieb,
    // wo verifyTokenRBAC nach dem APM haengt.
    app.use(apm.apmMiddleware);
    app.get('/api/x', (req, res) => {
      const id = req.query.u;
      if (id) req.user = { id: Number(id) };
      res.json({ ok: true });
    });
    app.get('/api/kaputt', (req, res) => {
      const id = req.query.u;
      if (id) req.user = { id: Number(id) };
      res.status(500).json({ error: 'x' });
    });
    const srv = app.listen(0);
    const port = srv.address().port;
    for (const pfad of zuordnung) await fetch(`http://127.0.0.1:${port}${pfad}`).then((r) => r.text());
    await new Promise((r) => srv.close(r));
    return apm.snapshot();
  }

  it('zaehlt verschiedene Konten einmal, egal wie oft sie anfragen', async () => {
    const s = await messeMitNutzern([
      '/api/x?u=1', '/api/x?u=1', '/api/x?u=1',
      '/api/x?u=2',
      '/api/x?u=3',
    ]);
    expect(s.nutzer.aktiv).toBe(3);
    expect(s.nutzer.betroffen).toBe(0);
    expect(s.nutzer.fensterMinuten).toBe(60);
  });

  it('zaehlt anonyme Anfragen nicht mit', async () => {
    const s = await messeMitNutzern(['/api/x', '/api/x', '/api/x?u=7']);
    // Drei Anfragen, aber nur ein angemeldetes Konto.
    expect(s.totalRequests).toBe(3);
    expect(s.nutzer.aktiv).toBe(1);
  });

  it('merkt sich, wer einen Serverfehler abbekommen hat', async () => {
    const s = await messeMitNutzern(['/api/x?u=1', '/api/kaputt?u=2', '/api/x?u=3']);
    expect(s.nutzer.aktiv).toBe(3);
    expect(s.nutzer.betroffen).toBe(1);
  });

  it('gibt keine Konto-IDs preis', async () => {
    const s = await messeMitNutzern(['/api/x?u=42']);
    expect(s.nutzer.schluessel).toHaveLength(1);
    // Was im Snapshot steht, ist ein Hash — nicht die 42.
    expect(s.nutzer.schluessel[0]).not.toBe('42');
    expect(s.nutzer.schluessel[0]).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe('APM: Zusammenfuehren mehrerer Replicas', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  const route = (name, count, serverZeit, apdexWert) => ({
    route: name, count, errors: 0, avgMs: 20, p95Ms: 40, maxMs: 60,
    serverAvgMs: Math.round(serverZeit / count), serverP95Ms: 30, serverMaxMs: 50,
    netzAvgMs: 0, notModified: 0, cacheQuote: 0,
    p50Ms: 15, serverP50Ms: 12, langsam: 0, langsamQuote: 0,
    serverZeitGesamtMs: serverZeit, apdex: apdexWert,
  });

  const baue = (replica, opts = {}) => ({
    replica,
    uptimeSeconds: 100, totalRequests: opts.requests ?? 100, totalErrors: 0,
    totalNotModified: 0, inFlight: 0, maxInFlight: 0, rps: 1,
    routesSlowest: opts.routen || [route('GET /api/x', 100, 1000, 1)],
    routesBusiest: opts.routen || [route('GET /api/x', 100, 1000, 1)],
    routesPotenzial: opts.routen || [route('GET /api/x', 100, 1000, 1)],
    recentErrors: [], timeline: [],
    apdex: opts.apdex || { zufrieden: 100, toleriert: 0, frustriert: 0, wert: 1, schwelleMs: 500, toleriertBisMs: 2000 },
    ueber1s: opts.ueber1s || { anzahl: 0, quote: 0, schwelleMs: 1000 },
    statusKlassen: opts.klassen || { erfolg: 100, ausDemCache: 0, umleitung: 0, nichtGefunden: 0, abgelehnt: 0, serverfehler: 0 },
    nutzer: opts.nutzer || { fensterMinuten: 60, aktiv: 0, betroffen: 0, schluessel: [], betroffeneSchluessel: [] },
    fehlerGruppen: opts.gruppen || [],
  });

  it('zaehlt eine Route, die in mehreren Listen steht, nur EINMAL je Replica', () => {
    // Bis zum 22.09.2026 lief routesSlowest und routesBusiest nacheinander
    // durch dieselbe Summe. Eine Route, die langsam UND haeufig ist, stand
    // in beiden Listen und wurde doppelt addiert: aus 200 Anfragen wurden
    // 400. Gegenprobe gegen den alten Stand gemessen.
    const z = apm.mergeSnapshots([baue('a'), baue('b')]);
    const x = z.routesSlowest.find((r) => r.route === 'GET /api/x');
    expect(x.count).toBe(200);
    expect(x.serverZeitGesamtMs).toBe(2000);
  });

  it('addiert die Apdex-Toepfe und rechnet den Gesamtwert neu', () => {
    const a = baue('a', { apdex: { zufrieden: 100, toleriert: 0, frustriert: 0 } });
    const b = baue('b', { apdex: { zufrieden: 0, toleriert: 0, frustriert: 100 } });
    const z = apm.mergeSnapshots([a, b]);
    expect(z.apdex.zufrieden).toBe(100);
    expect(z.apdex.frustriert).toBe(100);
    // 100 von 200 zufrieden -> 0,5. NICHT der Mittelwert der Einzelwerte,
    // der waere bei ungleicher Last falsch.
    expect(z.apdex.wert).toBe(0.5);
  });

  it('gewichtet den Apdex bei ungleicher Last nach Anzahl', () => {
    const a = baue('a', { apdex: { zufrieden: 900, toleriert: 0, frustriert: 0 } });
    const b = baue('b', { apdex: { zufrieden: 0, toleriert: 0, frustriert: 100 } });
    const z = apm.mergeSnapshots([a, b]);
    // 900 von 1000 -> 0,9. Der naive Mittelwert (1 und 0) waere 0,5.
    expect(z.apdex.wert).toBe(0.9);
  });

  it('bildet bei Nutzer:innen die Vereinigung statt der Summe', () => {
    const a = baue('a', { nutzer: { fensterMinuten: 60, aktiv: 2, betroffen: 1, schluessel: ['aaa', 'bbb'], betroffeneSchluessel: ['aaa'] } });
    const b = baue('b', { nutzer: { fensterMinuten: 60, aktiv: 2, betroffen: 1, schluessel: ['bbb', 'ccc'], betroffeneSchluessel: ['aaa'] } });
    const z = apm.mergeSnapshots([a, b]);
    // bbb war auf beiden Replicas — drei Menschen, nicht vier.
    expect(z.nutzer.aktiv).toBe(3);
    expect(z.nutzer.betroffen).toBe(1);
  });

  it('addiert die Antwort-Klassen und die Anfragen ueber einer Sekunde', () => {
    const a = baue('a', { requests: 100, ueber1s: { anzahl: 5, quote: 5, schwelleMs: 1000 },
      klassen: { erfolg: 90, ausDemCache: 5, umleitung: 0, nichtGefunden: 3, abgelehnt: 1, serverfehler: 1 } });
    const b = baue('b', { requests: 100, ueber1s: { anzahl: 15, quote: 15, schwelleMs: 1000 },
      klassen: { erfolg: 80, ausDemCache: 10, umleitung: 0, nichtGefunden: 5, abgelehnt: 5, serverfehler: 0 } });
    const z = apm.mergeSnapshots([a, b]);
    expect(z.ueber1s.anzahl).toBe(20);
    expect(z.ueber1s.quote).toBe(10);
    expect(z.statusKlassen.erfolg).toBe(170);
    expect(z.statusKlassen.serverfehler).toBe(1);
    expect(z.statusKlassen.nichtGefunden).toBe(8);
  });

  it('fasst dieselbe Fehler-Gruppe ueber Replicas zusammen', () => {
    const g = (anzahl, seit, zuletzt) => ([{ route: 'GET /api/kaputt', status: 500, anzahl, seit, zuletzt, beispielUrl: '/api/kaputt' }]);
    const a = baue('a', { gruppen: g(3, '2026-09-22T10:00:00.000Z', '2026-09-22T10:05:00.000Z') });
    const b = baue('b', { gruppen: g(4, '2026-09-22T09:00:00.000Z', '2026-09-22T11:00:00.000Z') });
    const z = apm.mergeSnapshots([a, b]);
    expect(z.fehlerGruppen).toHaveLength(1);
    expect(z.fehlerGruppen[0].anzahl).toBe(7);
    // Frühestes "seit", spaetestes "zuletzt".
    expect(z.fehlerGruppen[0].seit).toBe('2026-09-22T09:00:00.000Z');
    expect(z.fehlerGruppen[0].zuletzt).toBe('2026-09-22T11:00:00.000Z');
  });

  it('sortiert das Potenzial nach gesamter Serverzeit, nicht nach p95', () => {
    const routen = [route('GET /api/haeufig', 1000, 60000, 1), route('GET /api/selten', 2, 1000, 0.5)];
    const z = apm.mergeSnapshots([baue('a', { routen }), baue('b', { routen })]);
    expect(z.routesPotenzial[0].route).toBe('GET /api/haeufig');
    expect(z.routesPotenzial[0].serverZeitGesamtMs).toBe(120000);
  });

  it('laesst die bestehenden Felder unveraendert (alte Ansichten lesen weiter mit)', () => {
    const z = apm.mergeSnapshots([baue('a'), baue('b')]);
    // Antwortform ist ein Vertrag: Diese Felder gab es vorher und sie
    // muessen mit denselben Typen weiter da sein.
    expect(typeof z.totalRequests).toBe('number');
    expect(typeof z.errorRate).toBe('number');
    expect(typeof z.cacheQuote).toBe('number');
    expect(Array.isArray(z.routesSlowest)).toBe(true);
    expect(Array.isArray(z.routesBusiest)).toBe(true);
    expect(Array.isArray(z.recentErrors)).toBe(true);
    expect(Array.isArray(z.timeline)).toBe(true);
    expect(Array.isArray(z.replicas)).toBe(true);
    const x = z.routesSlowest[0];
    for (const feld of ['route', 'count', 'errors', 'errorRate', 'avgMs', 'p95Ms', 'maxMs',
      'serverAvgMs', 'serverP95Ms', 'serverMaxMs', 'netzAvgMs', 'notModified', 'cacheQuote']) {
      expect(x[feld]).toBeDefined();
    }
  });
});

describe('APM: persistSummary bleibt auf der Serverzeit', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('nimmt die langsamste Route nach Serverzeit, nicht nach Gesamtzeit', async () => {
    await messe(apm, { '/api/x': (req, res) => setTimeout(() => res.json({ ok: true }), 120) },
      ['/api/x', '/api/x']);
    const p = apm.persistSummary();
    expect(p.worstRoute).toBe('GET /api/x');
    expect(p.totalRequests).toBe(2);
    expect(p.worstP95Ms).toBeGreaterThan(0);
    // Die Serverzeit liegt bei einer GET-Anfrage ohne Body praktisch bei der
    // Gesamtzeit; sie darf sie aber nie uebersteigen.
    const s = apm.snapshot();
    const x = s.routesBusiest.find((r) => r.route === 'GET /api/x');
    expect(p.worstP95Ms).toBeLessThanOrEqual(x.p95Ms);
  });
});
