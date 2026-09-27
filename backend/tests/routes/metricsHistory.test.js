// Tests fuer GET /api/metrics/history — die Verlaufszahlen des APM-Dashboards.
//
// Warum es diese Datei gibt: Die Route hatte bis zum 14.09.2026 keinen Test,
// und zwei Zahlen an ihr sind leicht versehentlich zu verlieren:
//
//  1. Die OBERGRENZE des Abfragezeitraums (730 Tage). Sie muss zur
//     Aufbewahrung in backgroundService.js passen — dort werden Snapshots
//     aelter als zwei Jahre geloescht. Faellt die Grenze hier zurueck auf 30,
//     liegt die Historie zwar in der Datenbank, ist aber nicht mehr abrufbar,
//     ohne dass irgendetwas rot wird.
//  2. Die BESCHRAENKUNG auf super_admin. Die Zahlen umfassen alle
//     Organisationen; eine Leitung darf sie nicht sehen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('GET /api/metrics/history', () => {
  let db;
  let app;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  const alsSuperAdmin = (query = '') =>
    request(app)
      .get(`/api/metrics/history${query}`)
      .set('Authorization', `Bearer ${generateToken('superAdmin')}`);

  describe('Zugriff', () => {
    it('verweigert ohne Anmeldung', async () => {
      const res = await request(app).get('/api/metrics/history');
      expect(res.status).toBe(401);
    });

    it('verweigert einer Leitung ohne super_admin (die Zahlen sind org-uebergreifend)', async () => {
      const res = await request(app)
        .get('/api/metrics/history')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Zugriff verweigert');
    });

    it('verweigert einer Konfi', async () => {
      const res = await request(app)
        .get('/api/metrics/history')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`);
      expect(res.status).toBe(403);
    });

    it('erlaubt dem super_admin', async () => {
      const res = await alsSuperAdmin();
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.snapshots)).toBe(true);
    });
  });

  describe('Zeitraum', () => {
    it('nimmt ohne Angabe eine Woche', async () => {
      const res = await alsSuperAdmin();
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(7);
    });

    it('nimmt zwei Jahre an — so weit die Aufbewahrung reicht', async () => {
      const res = await alsSuperAdmin('?days=730');
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(730);
    });

    it('deckelt darueber hinaus bei 730 Tagen', async () => {
      const res = await alsSuperAdmin('?days=5000');
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(730);
    });

    it('faellt bei 0 und unsinniger Angabe auf eine Woche zurueck', async () => {
      expect((await alsSuperAdmin('?days=0')).body.days).toBe(7);
      expect((await alsSuperAdmin('?days=abc')).body.days).toBe(7);
    });

    it('hebt negative Werte auf einen Tag an', async () => {
      const res = await alsSuperAdmin('?days=-5');
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(1);
    });
  });

  describe('Antwortform', () => {
    it('liefert days, aufloesung und snapshots, sonst nichts', async () => {
      const res = await alsSuperAdmin('?days=30');
      expect(res.status).toBe(200);
      // aufloesung kam am 26.09.2026 additiv dazu (Verdichtung, siehe unten);
      // days und snapshots (Array) sind der Vertrag des Dashboards.
      expect(Object.keys(res.body).sort()).toEqual(['aufloesung', 'days', 'snapshots']);
      expect(res.body.days).toBe(30);
      expect(res.body.aufloesung).toBe('5min');
      expect(Array.isArray(res.body.snapshots)).toBe(true);
    });
  });

  // Verdichtung ab 31 Tagen (Audit 26.09.2026, Betrieb BF-14 / S-19):
  // days=730 lieferte 210.000 Rohzeilen und 35.005.521 Byte. Jetzt bleibt
  // die Antwort fuer den Zwei-Jahres-Verlauf bei rund 730 Zeilen.
  //
  // GEGENPROBE: Mit der alten Roh-Abfrage fuer alle Zeitraeume faellt
  // "hoechstens ein Punkt je Tag" mit 210240 Zeilen und rund 35 MB.
  describe('Verdichtung langer Zeitraeume', () => {
    const FELDER = ['captured_at', 'max_in_flight', 'total_errors', 'total_requests', 'worst_p95_ms', 'worst_route'];

    // Zwei Jahre Schnappschuesse alle fuenf Minuten, wie die Aufbewahrung sie
    // hoechstens haelt.
    const zweiJahreFuellen = () => db.query(
      `INSERT INTO apm_snapshots (captured_at, total_requests, total_errors, max_in_flight, worst_p95_ms, worst_route)
       SELECT NOW() - (g * interval '5 minutes'), g * 3, g / 100, 1 + g % 7, 10 + g % 90, '/api/konfi/dashboard'
         FROM generate_series(1, 210240) g`
    );

    it('liefert fuer zwei Jahre hoechstens einen Punkt je Tag und bleibt weit unter einem Megabyte', async () => {
      await zweiJahreFuellen();

      const res = await alsSuperAdmin('?days=730');

      expect(res.status).toBe(200);
      expect(res.body.aufloesung).toBe('tag');
      expect(res.body.snapshots.length).toBeGreaterThanOrEqual(729);
      expect(res.body.snapshots.length).toBeLessThanOrEqual(731);
      expect(res.text.length).toBeLessThan(200 * 1024);
      expect(Object.keys(res.body.snapshots[0]).sort()).toEqual(FELDER);
    }, 30000);

    it('liefert fuer 31 bis 180 Tage einen Punkt je Stunde', async () => {
      await zweiJahreFuellen();

      const res = await alsSuperAdmin('?days=180');

      expect(res.status).toBe(200);
      expect(res.body.aufloesung).toBe('stunde');
      expect(res.body.snapshots.length).toBeGreaterThanOrEqual(180 * 24 - 1);
      expect(res.body.snapshots.length).toBeLessThanOrEqual(180 * 24 + 1);
    }, 30000);

    it('laesst bis 30 Tage die Rohdaten unveraendert (das Dashboard fragt 14)', async () => {
      await zweiJahreFuellen();

      const res = await alsSuperAdmin('?days=14');

      expect(res.status).toBe(200);
      expect(res.body.aufloesung).toBe('5min');
      // 14 Tage zu 12 Punkten je Stunde = 4032; der Punkt GENAU auf der
      // Grenze faellt durch das strikte `>` heraus, weil die Abfrage einen
      // Augenblick nach dem Einfuegen laeuft.
      expect(res.body.snapshots.length).toBe(14 * 24 * 12 - 1);
    }, 30000);

    it('nimmt je Fenster den letzten Zaehlerstand und die Spitze der Last', async () => {
      // Drei Schnappschuesse um die Mittagsstunde eines Tages vor 200 Tagen
      // (Tages-Fenster; fest auf Mittag, damit kein Tageswechsel dazwischen liegt).
      await db.query(
        `WITH t AS (SELECT date_trunc('day', NOW() - interval '200 days') + interval '12 hours' AS mittag)
         INSERT INTO apm_snapshots (captured_at, total_requests, total_errors, max_in_flight, worst_p95_ms, worst_route)
         SELECT mittag,                          10, 1, 1, 5,  '/api/a' FROM t UNION ALL
         SELECT mittag + interval '5 minutes',   20, 2, 9, 50, '/api/b' FROM t UNION ALL
         SELECT mittag + interval '10 minutes',  30, 3, 2, 7,  '/api/c' FROM t`
      );

      const res = await alsSuperAdmin('?days=730');

      expect(res.status).toBe(200);
      expect(res.body.snapshots).toHaveLength(1);
      const [punkt] = res.body.snapshots;
      // Kumulierte Zaehler: der letzte Stand des Fensters (Deltas bleiben richtig).
      expect(punkt.total_requests).toBe(30);
      expect(punkt.total_errors).toBe(3);
      // Last: die Spitze des Fensters, mit der Route der Spitze.
      expect(punkt.max_in_flight).toBe(9);
      expect(punkt.worst_p95_ms).toBe(50);
      expect(punkt.worst_route).toBe('/api/b');
    });
  });
});
