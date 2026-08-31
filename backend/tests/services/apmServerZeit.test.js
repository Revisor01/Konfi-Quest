// backend/tests/services/apmServerZeit.test.js
const express = require('express');
const net = require('net');

// Das APM trennt seit 31.08.2026 zwei Zeiten:
//   serverAvgMs — bis der Handler die Antwort geschrieben hat
//   avgMs       — bis sie beim Client ausgeliefert ist
// Die Differenz ist die Zeit auf der Leitung.
//
// Warum das wichtig ist: Vorher floss die Wartezeit langsamer Geraete in die
// Routen-Statistik ein und liess Routen langsam aussehen, an denen im Backend
// nichts zu holen war (Befund 31.08.2026: 16 von 26 Anfragen ueber 1 s waren
// 304 mit LEEREM Body). Wer danach optimiert, optimiert die falsche Stelle.

function frischesApm() {
  // Der Zustand liegt im Modul; fuer unabhaengige Messungen neu laden.
  delete require.cache[require.resolve('../../utils/apm')];
  return require('../../utils/apm');
}

describe('APM: Serverzeit und Leitungszeit getrennt', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('rechnet einen langsamen Handler der SERVERZEIT zu', async () => {
    const app = express();
    app.use(apm.apmMiddleware);
    app.get('/api/langsam', async (req, res) => {
      await new Promise((r) => setTimeout(r, 250));
      res.json({ ok: true });
    });

    const srv = app.listen(0);
    const port = srv.address().port;
    await fetch(`http://127.0.0.1:${port}/api/langsam`).then((r) => r.text());
    srv.close();

    const zeile = apm.snapshot().routesSlowest.find((r) => r.route === 'GET /api/langsam');
    expect(zeile).toBeTruthy();
    // Der Handler hat wirklich gewartet -> Serverzeit muss das zeigen.
    expect(zeile.serverAvgMs).toBeGreaterThanOrEqual(240);
    // Ueber die Loopback-Schnittstelle ist die Auslieferung praktisch sofort.
    expect(zeile.netzAvgMs).toBeLessThan(100);
  });

  it('rechnet einen langsam lesenden Client der LEITUNG zu, nicht dem Server', async () => {
    const app = express();
    app.use(apm.apmMiddleware);
    // Gross genug, dass die Antwort nicht in einen Puffer passt: Erst dann
    // muss der Server auf den Client warten.
    app.get('/api/gross', (req, res) => res.json({ fuellung: 'x'.repeat(3_000_000) }));

    const srv = app.listen(0);
    const port = srv.address().port;

    await new Promise((fertig) => {
      const sock = net.connect(port, '127.0.0.1', () => {
        sock.write('GET /api/gross HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
        // Absichtlich 500 ms nicht lesen — das ist die lahme Leitung.
        sock.pause();
        setTimeout(() => { sock.resume(); sock.on('data', () => {}); }, 500);
      });
      sock.on('close', fertig);
      sock.on('error', fertig);
    });
    srv.close();

    const zeile = apm.snapshot().routesSlowest.find((r) => r.route === 'GET /api/gross');
    expect(zeile).toBeTruthy();
    // Der Handler selbst war schnell — die Zeit ging auf der Leitung verloren.
    expect(zeile.serverAvgMs).toBeLessThan(200);
    expect(zeile.netzAvgMs).toBeGreaterThanOrEqual(400);
  });

  it('haelt die Server-Felder beim Zusammenfassen mehrerer Replicas', () => {
    const a = {
      replica: 'a', totalRequests: 10, totalErrors: 0, inFlight: 0, uptimeSeconds: 1,
      routesSlowest: [{ route: 'GET /api/x', count: 10, errors: 0, avgMs: 300, p95Ms: 900, maxMs: 1000, serverAvgMs: 20, serverP95Ms: 40, serverMaxMs: 50, netzAvgMs: 280 }],
      routesBusiest: [], timeline: [], recentErrors: [],
    };
    const b = {
      replica: 'b', totalRequests: 10, totalErrors: 0, inFlight: 0, uptimeSeconds: 1,
      routesSlowest: [{ route: 'GET /api/x', count: 10, errors: 0, avgMs: 100, p95Ms: 200, maxMs: 300, serverAvgMs: 10, serverP95Ms: 20, serverMaxMs: 25, netzAvgMs: 90 }],
      routesBusiest: [], timeline: [], recentErrors: [],
    };

    const z = apm.mergeSnapshots([a, b]).routesSlowest.find((r) => r.route === 'GET /api/x');
    expect(z.count).toBe(20);
    // Gewichteter Mittelwert ueber beide Replicas: (20*10 + 10*10) / 20 = 15
    expect(z.serverAvgMs).toBe(15);
    // p95 und max: der schlechtere Wert gewinnt.
    expect(z.serverP95Ms).toBe(40);
    expect(z.serverMaxMs).toBe(50);
    // Gesamt (20*300 + 10*100)/20 = 200, davon 15 Server -> 185 Leitung.
    expect(z.avgMs).toBe(200);
    expect(z.netzAvgMs).toBe(185);
  });
});
