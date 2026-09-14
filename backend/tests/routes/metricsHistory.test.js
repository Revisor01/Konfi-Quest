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
    it('liefert days und snapshots, sonst nichts', async () => {
      const res = await alsSuperAdmin('?days=30');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['days', 'snapshots']);
      expect(res.body.days).toBe(30);
    });
  });
});
