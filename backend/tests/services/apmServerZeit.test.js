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

// Cache-Quote: Anteil der Anfragen, die mit 304 beantwortet wurden.
// Hoch ist GUT — dann hatte der Client die Daten schon und es gingen keine
// Nutzdaten ueber die Leitung. Gemessen am 31.08.2026 lagen 79 % der
// Startanfragen bei 304.
describe('APM: Cache-Quote (304)', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('zaehlt 304 je Route und insgesamt', async () => {
    const app = express();
    app.use(apm.apmMiddleware);
    app.get('/api/gecacht', (req, res) => res.status(304).end());
    app.get('/api/frisch', (req, res) => res.json({ ok: true }));

    const srv = app.listen(0);
    const port = srv.address().port;
    for (let i = 0; i < 3; i++) await fetch(`http://127.0.0.1:${port}/api/gecacht`).then((r) => r.text());
    await fetch(`http://127.0.0.1:${port}/api/frisch`).then((r) => r.text());
    srv.close();

    const s = apm.snapshot();
    const gecacht = s.routesBusiest.find((r) => r.route === 'GET /api/gecacht');
    const frisch = s.routesBusiest.find((r) => r.route === 'GET /api/frisch');

    expect(gecacht.notModified).toBe(3);
    expect(gecacht.cacheQuote).toBe(100);
    expect(frisch.notModified).toBe(0);
    expect(frisch.cacheQuote).toBe(0);

    // Gesamt: 3 von 4 Anfragen aus dem Cache.
    expect(s.totalNotModified).toBe(3);
    expect(s.cacheQuote).toBe(75);
  });

  it('zaehlt 304 NICHT als Fehler', async () => {
    const app = express();
    app.use(apm.apmMiddleware);
    app.get('/api/gecacht', (req, res) => res.status(304).end());
    const srv = app.listen(0);
    const port = srv.address().port;
    await fetch(`http://127.0.0.1:${port}/api/gecacht`).then((r) => r.text());
    srv.close();

    const s = apm.snapshot();
    // 304 ist eine erfolgreiche Antwort — sie darf die Fehlerrate nicht heben.
    expect(s.totalErrors).toBe(0);
    expect(s.errorRate).toBe(0);
  });

  it('summiert die Cache-Quote ueber beide Replicas', () => {
    const bau = (replica, count, notModified) => ({
      replica, totalRequests: count, totalErrors: 0, inFlight: 0, uptimeSeconds: 1,
      totalNotModified: notModified,
      routesSlowest: [{ route: 'GET /api/x', count, errors: 0, avgMs: 10, p95Ms: 20, maxMs: 30, serverAvgMs: 5, serverP95Ms: 6, serverMaxMs: 7, netzAvgMs: 5, notModified, cacheQuote: Math.round(notModified / count * 100) }],
      routesBusiest: [], timeline: [], recentErrors: [],
    });
    // 8 von 10 und 2 von 10 -> zusammen 10 von 20 = 50 %.
    const z = apm.mergeSnapshots([bau('a', 10, 8), bau('b', 10, 2)]);
    expect(z.totalNotModified).toBe(10);
    expect(z.cacheQuote).toBe(50);
    const route = z.routesSlowest.find((r) => r.route === 'GET /api/x');
    expect(route.notModified).toBe(10);
    expect(route.cacheQuote).toBe(50);
  });
});

// Scanner-Anfragen gehoeren nicht ins Performance-Dashboard.
//
// Befund aus Simons Screenshot (31.08.2026): In der Fehlerliste des
// Test-Backends standen ZWOELF Eintraege, alle zwoelf von Scanner-Bots
// (/js/antibot-client.js, /js/twint_ch.js, /.env, /robots.txt ...). Echte
// Fehler waeren darin untergegangen.
describe('APM: Scanner-Anfragen und 404', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  const scannerPfade = [
    '/.env', '/.git/HEAD', '/.vscode/sftp.json',
    '/js/antibot-client.js', '/js/twint_ch.js', '/assets/js/auth.js',
    '/static/style/protect/index.js', '/robots.txt', '/favicon.ico',
    '/bot-connect.js', '/wp-login.php', '/@vite/env',
  ];

  it('nimmt Scanner-Anfragen gar nicht erst auf', async () => {
    const app = express();
    app.use(apm.apmMiddleware);
    app.use((req, res) => res.status(404).json({ error: 'nicht gefunden' }));

    const srv = app.listen(0);
    const port = srv.address().port;
    for (const pfad of scannerPfade) {
      await fetch(`http://127.0.0.1:${port}${pfad}`).then((r) => r.text());
    }
    srv.close();

    const s = apm.snapshot();
    expect(s.totalRequests).toBe(0);
    expect(s.recentErrors).toEqual([]);
  });

  it('zeigt einen 404 auf einer ECHTEN Route weiterhin an', async () => {
    // Ein geloeschter Termin oder ein alter Push-Link ist ein Befund und
    // darf nicht mit weggefiltert werden.
    const app = express();
    app.use(apm.apmMiddleware);
    app.use((req, res) => res.status(404).json({ error: 'nicht gefunden' }));

    const srv = app.listen(0);
    const port = srv.address().port;
    await fetch(`http://127.0.0.1:${port}/api/events/9999`).then((r) => r.text());
    srv.close();

    const s = apm.snapshot();
    expect(s.totalRequests).toBe(1);
    expect(s.recentErrors.length).toBe(1);
    expect(s.recentErrors[0].status).toBe(404);
  });

  it('zaehlt 404 NICHT in die Fehlerrate', async () => {
    // Der Client hat etwas angefragt, das es nicht gibt — das ist keine
    // Stoerung des Dienstes.
    const app = express();
    app.use(apm.apmMiddleware);
    app.get('/api/gibtsnicht', (req, res) => res.status(404).end());
    app.get('/api/kaputt', (req, res) => res.status(500).end());

    const srv = app.listen(0);
    const port = srv.address().port;
    await fetch(`http://127.0.0.1:${port}/api/gibtsnicht`).then((r) => r.text());
    await fetch(`http://127.0.0.1:${port}/api/kaputt`).then((r) => r.text());
    srv.close();

    const s = apm.snapshot();
    expect(s.totalRequests).toBe(2);
    // Nur der 500er zaehlt als Fehler.
    expect(s.totalErrors).toBe(1);
  });
});
