// backend/tests/services/apmCacheUndScanner.test.js
// Cache-Quote und Scanner-Filter des APM.
//
// Hier stand bis zum 31.08.2026 auch ein Block, der eine Trennung von
// Server- und Leitungszeit prueft. Diese Trennung wurde entfernt: Sie mass
// von Middleware-Eintritt bis res.end und enthielt damit das Warten auf den
// Client — gemessen an Produktion war sie bei 20 von 20 Routen identisch mit
// der Gesamtzeit. Die Tests waren gruen, weil sie im Loopback prueften, wo
// es kein Warten gibt. Lehre: Ein Messwert braucht eine Gegenprobe unter
// ECHTEN Bedingungen, nicht nur im Testaufbau.

const express = require('express');

function frischesApm() {
  // Der Zustand liegt im Modul; fuer unabhaengige Messungen neu laden.
  delete require.cache[require.resolve('../../utils/apm')];
  return require('../../utils/apm');
}

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

// Serverzeit getrennt von der Leitungszeit.
//
// Hintergrund: Bis zum 21.09.2026 stand im Verlauf einen Tag lang
// "56 315 ms POST /api/konfi/upload-photo", waehrend dieselbe Route mit
// kleinem Bild in 133-208 ms antwortete. Ein einzelnes grosses Foto ueber
// Mobilfunk hatte den Wert gesetzt; gemessen wurde ab Middleware-Eintritt,
// also inklusive Warten auf das Geraet.
//
// WICHTIG fuer diesen Test: Ein frueherer Anlauf (31.08.2026) wurde wieder
// entfernt, weil seine Tests im Loopback liefen, wo nichts zu warten ist —
// sie waren gruen, obwohl die Trennung in Produktion nichts brachte. Deshalb
// wird hier mit einem rohen Socket in Haeppchen gesendet, mit echten Pausen.
describe('APM: Serverzeit ohne Leitungszeit', () => {
  let apm;
  beforeEach(() => { apm = frischesApm(); });

  it('rechnet das Warten auf einen langsamen Upload NICHT dem Server zu', async () => {
    const net = require('net');
    const app = express();
    app.use(apm.apmMiddleware);
    // Body vollstaendig lesen, dann antworten — wie multer es tut.
    app.post('/api/upload', (req, res) => {
      req.resume();
      req.on('end', () => res.json({ ok: true }));
    });

    const srv = app.listen(0);
    const port = srv.address().port;
    const daten = Buffer.alloc(40000, 7);

    await new Promise((fertig) => {
      const s = net.connect(port, '127.0.0.1', async () => {
        s.write(`POST /api/upload HTTP/1.1\r\nHost: x\r\nContent-Type: application/octet-stream\r\nContent-Length: ${daten.length}\r\nConnection: close\r\n\r\n`);
        for (let i = 0; i < 4; i++) {
          s.write(daten.subarray(i * 10000, (i + 1) * 10000));
          await new Promise((r) => setTimeout(r, 120));   // echtes Warten
        }
      });
      s.on('data', () => {});
      s.on('close', fertig);
    });
    srv.close();

    const route = apm.snapshot().routesSlowest.find((r) => r.route === 'POST /api/upload');

    // Die Gesamtzeit enthaelt die vier Pausen (rund 480 ms).
    expect(route.p95Ms).toBeGreaterThan(300);
    // Die Serverzeit NICHT — der Handler antwortet sofort, wenn der Body da ist.
    expect(route.serverP95Ms).toBeLessThan(100);
    // Und die Differenz wird als Leitungszeit ausgewiesen.
    expect(route.netzAvgMs).toBeGreaterThan(200);
  });

  it('bewertet die schlechteste Route nach Serverzeit, nicht nach Gesamtzeit', async () => {
    const net = require('net');
    const app = express();
    app.use(apm.apmMiddleware);
    app.post('/api/langsame-leitung', (req, res) => {
      req.resume();
      req.on('end', () => res.json({ ok: true }));       // Server: schnell
    });
    app.get('/api/langsamer-server', (req, res) => {
      setTimeout(() => res.json({ ok: true }), 150);     // Server: langsam
    });

    const srv = app.listen(0);
    const port = srv.address().port;
    const daten = Buffer.alloc(30000, 7);

    await new Promise((fertig) => {
      const s = net.connect(port, '127.0.0.1', async () => {
        s.write(`POST /api/langsame-leitung HTTP/1.1\r\nHost: x\r\nContent-Type: application/octet-stream\r\nContent-Length: ${daten.length}\r\nConnection: close\r\n\r\n`);
        for (let i = 0; i < 3; i++) {
          s.write(daten.subarray(i * 10000, (i + 1) * 10000));
          await new Promise((r) => setTimeout(r, 150));
        }
      });
      s.on('data', () => {});
      s.on('close', fertig);
    });
    await fetch(`http://127.0.0.1:${port}/api/langsamer-server`).then((r) => r.text());
    srv.close();

    // Der persistierte Wert (geht in apm_snapshots und in die Uebersicht)
    // muss auf die Route mit der langsamen SERVERARBEIT zeigen.
    //
    // Die Schwellen sind bewusst eng: Ein erster Anlauf pruefte nur
    // "worstP95Ms < 450" und blieb auch mit der ALTEN Berechnung gruen — der
    // Upload kam dort auf 317 ms Gesamtzeit und lag damit unter der Grenze.
    // Gegenprobe (Fehler wieder einbauen, Test muss fallen) deckte das auf.
    // Deshalb wird jetzt die Route selbst geprueft UND der Wert gegen die
    // Serverzeit dieser Route, nicht gegen eine grosszuegige Obergrenze.
    const p = apm.persistSummary();
    const langsam = apm.snapshot().routesSlowest.find((r) => r.route === 'GET /api/langsamer-server');
    const upload = apm.snapshot().routesSlowest.find((r) => r.route === 'POST /api/langsame-leitung');

    // Der Upload hat die hoehere GESAMTzeit ...
    expect(upload.p95Ms).toBeGreaterThan(langsam.p95Ms);
    // ... aber die deutlich niedrigere SERVERzeit.
    expect(upload.serverP95Ms).toBeLessThan(langsam.serverP95Ms);

    // Bewertet werden muss deshalb die Route mit der langsamen Serverarbeit.
    expect(p.worstRoute).toBe('GET /api/langsamer-server');
    expect(p.worstP95Ms).toBe(langsam.serverP95Ms);
  });
});
