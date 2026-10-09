// backend/tests/routes/hintergrundLaufzeiten.test.js
//
// Laufzeiten im Hintergrund in /api/metrics/local und /api/metrics
// (Betrieb BF-10 Rest, 09.10.2026): Die Hintergrund-Dienste verbuchen ihre
// Laeufe wirklich (Verdrahtung in services/backgroundService.js), der
// Push-Versand seine Dauer (services/pushService.js), und nur ein
// Super-Admin sieht es.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const lauf = require('../../utils/hintergrundLaeufe');
const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');

describe('Laufzeiten im Hintergrund', () => {
  let app;
  let db;
  let log;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    lauf._leeren();
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    BackgroundService.stopTokenCleanupService();
    log.mockRestore();
  });

  afterAll(async () => {
    await closePool();
  });

  const lokal = (wer) => request(app).get('/api/metrics/local').set('Authorization', `Bearer ${generateToken(wer)}`);
  const warteAuf = async (bedingung) => {
    for (let i = 0; i < 100 && !bedingung(); i++) await new Promise((r) => setTimeout(r, 20));
  };

  it('der Erstlauf des Token-Aufraeumens steht mit Start, Dauer und ok in /api/metrics/local', async () => {
    BackgroundService.startTokenCleanupService(db);
    await warteAuf(() => lauf.stand().jobs.filter((j) => j.ergebnis === 'ok').length === 2);

    const res = await lokal('superAdmin');
    expect(res.status).toBe(200);
    const jobs = res.body.hintergrund.jobs;
    expect(jobs.map((j) => [j.name, j.ergebnis, j.anzahl])).toEqual([
      ['push_tokens', 'ok', 1],
      ['refresh_tokens', 'ok', 1],
    ]);
    for (const j of jobs) {
      // Die Dauer ist genau der Abstand von Start und Ende, und ein Lauf
      // ist ein Lauf: Mittel, Maximum und Summe sind dieselbe Zahl.
      expect(j.dauerMs).toBe(Date.parse(j.letztesEnde) - Date.parse(j.letzterStart));
      expect([j.maxDauerMs, j.gesamtDauerMs, j.mittelDauerMs]).toEqual([j.dauerMs, j.dauerMs, j.dauerMs]);
    }
    // Eine Protokollzeile je Lauf, mit Dauer.
    const zeilen = log.mock.calls.map((c) => c[0]).filter((z) => typeof z === 'string' && z.startsWith('Hintergrund: '));
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toMatch(/^Hintergrund: Push-Geräte aufräumen in \d+ ms, ok$/);
    expect(zeilen[1]).toMatch(/^Hintergrund: Anmeldungen aufräumen in \d+ ms, ok$/);
  });

  it('ein Job, der seinen Fehler selbst abfaengt, steht trotzdem als Fehler da (runTrialExpiry)', async () => {
    const fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const kaputt = { query: async () => { throw new Error('DB weg (simuliert)'); } };
      const r = await lauf.messeLauf('testphase', () => BackgroundService.runTrialExpiry(kaputt));
      expect(r).toEqual({ locked: 0 });
      const j = lauf.stand().jobs.find((x) => x.name === 'testphase');
      expect(j).toMatchObject({ ergebnis: 'fehler', fehler: 'DB weg (simuliert)', fehlerAnzahl: 1 });
    } finally {
      fehlerLog.mockRestore();
    }
  });

  it('der Versand an viele verbucht Dauer und Empfaenger:innen', async () => {
    await PushService.sendToMultipleUsers(db, [USERS.konfi1.id, USERS.konfi2.id], {
      title: 'Test', body: 'Test', data: { type: 'test_push', organization_id: String(ORGS.testGemeinde.id) },
    });
    const res = await lokal('superAdmin');
    const viele = res.body.hintergrund.pushVersand.jeWeg.viele;
    expect(viele.anzahl).toBe(1);
    expect(viele.empfaenger).toBe(2);
    expect(viele.fehler).toBe(0);
    expect([viele.maxDauerMs, viele.gesamtDauerMs, viele.mittelDauerMs]).toEqual([viele.letzteDauerMs, viele.letzteDauerMs, viele.letzteDauerMs]);
    expect(res.body.hintergrund.pushVersand.langsamster).toMatchObject({ weg: 'viele', art: 'test_push', empfaenger: 2 });
    // Innerhalb des Versands an viele zaehlt sendToUser nicht noch einmal.
    expect(res.body.hintergrund.pushVersand.jeWeg.einzeln.anzahl).toBe(0);
  });

  it('ein Einzel-Push wird als "einzeln" verbucht', async () => {
    await PushService.sendToUser(db, USERS.konfi1.id, {
      title: 'Test', body: 'Test', data: { type: 'test_push', organization_id: String(ORGS.testGemeinde.id) },
    });
    const res = await lokal('superAdmin');
    expect(res.body.hintergrund.pushVersand.jeWeg.einzeln).toMatchObject({ anzahl: 1, empfaenger: 1 });
  });

  it('GET /api/metrics (eine Replica) traegt dasselbe Feld', async () => {
    await lauf.messeLauf('zaehler', async () => ({ updated: 1, total: 2, geprueft: 0 }));
    const res = await request(app).get('/api/metrics').set('Authorization', `Bearer ${generateToken('superAdmin')}`);
    expect(res.status).toBe(200);
    expect(res.body.hintergrund.jobs.map((j) => j.name)).toEqual(['zaehler']);
  });

  it('verboten: ohne Super-Admin 403 und kein Feld', async () => {
    const res = await lokal('orgAdmin1');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Zugriff verweigert' });
  });
});
