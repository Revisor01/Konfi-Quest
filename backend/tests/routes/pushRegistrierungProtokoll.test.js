// Die Zeile "[PUSH] Registrierung" nur noch bei einem Zustandswechsel
// (Entscheidung Simon, 01.10.2026: "Logs auf das noetige, sinnvolle Minimum").
//
// GEMESSEN (Produktion, Abend 30.09.2026): 71 von 179 Zeilen eines Backends
// (40 %) waren diese Zeile. Die App meldet ihr Push-Token bei jedem Start und
// jeder Rueckkehr in den Vordergrund, fast immer unveraendert. Die Sequenz der
// Tabelle stand am 01.10.2026 bei 26.371 Aufrufen fuer 132 Zeilen.
//
// JETZT: eine Zeile, wenn sich etwas aendert -- neues Geraet, neues Token,
// andere App-Fassung oder ein Token, das von einem anderen Konto oder
// Geraeteeintrag herueberkommt. Die Frage vom 23.09.2026 ("meldet sich die App
// ueberhaupt?") beantwortet weiter die Tabelle: push_tokens.updated_at steigt
// bei jeder Meldung.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const TOKEN_A = 'fcm-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-111111';
const TOKEN_B = 'fcm-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-222222';

describe('POST /api/notifications/device-token: Protokoll nur bei Zustandswechsel', () => {
  let app;
  let db;
  let log;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => { log.mockRestore(); });
  afterAll(async () => { await closePool(); });

  const melde = (userKey, koerper) => request(app)
    .post('/api/notifications/device-token')
    .set('Authorization', `Bearer ${generateToken(userKey)}`)
    .send({ platform: 'android', device_id: 'geraet-1', app_version: '2.3.0', app_build: '130', ...koerper });

  const zeilen = () => log.mock.calls
    .map((args) => String(args[0]))
    .filter((z) => z.startsWith('[PUSH] Registrierung'));
  const grund = (i) => log.mock.calls
    .filter((args) => String(args[0]).startsWith('[PUSH] Registrierung'))[i]
    .slice(1).map(String).join(' ');

  describe('erlaubt -- eine Zeile bei jedem Wechsel', () => {
    it('erste Meldung eines Geraets: eine Zeile "neu"', async () => {
      expect((await melde('konfi1', { token: TOKEN_A })).status).toBe(200);
      expect(zeilen()).toHaveLength(1);
      expect(grund(0)).toMatch(/\bneu\b/);
    });

    it('neues Token auf demselben Geraet: eine Zeile "Tokenwechsel"', async () => {
      await melde('konfi1', { token: TOKEN_A });
      await melde('konfi1', { token: TOKEN_B });
      expect(zeilen()).toHaveLength(2);
      expect(grund(1)).toMatch(/Tokenwechsel/);
    });

    it('andere App-Fassung (Update): eine Zeile "App-Wechsel"', async () => {
      await melde('konfi1', { token: TOKEN_A });
      await melde('konfi1', { token: TOKEN_A, app_version: '2.4.0', app_build: '131' });
      expect(zeilen()).toHaveLength(2);
      expect(grund(1)).toMatch(/App-Wechsel/);
    });

    it('Token kommt von einem anderen Konto (Kontowechsel auf dem Geraet): eine Zeile "übernommen"', async () => {
      await melde('konfi1', { token: TOKEN_A });
      await melde('konfi2', { token: TOKEN_A });
      expect(zeilen()).toHaveLength(2);
      expect(grund(1)).toMatch(/übernommen/);
    });

    it('die Zeile traegt nie das ganze Token', async () => {
      await melde('konfi1', { token: TOKEN_A });
      const alles = log.mock.calls.flat().map(String).join(' ');
      expect(alles).not.toContain(TOKEN_A);
      expect(alles).toContain('111111');
    });
  });

  describe('verboten -- Routine ohne Zeile', () => {
    it('dieselbe Meldung dreimal: eine Zeile, nicht drei', async () => {
      for (let i = 0; i < 3; i += 1) {
        expect((await melde('konfi1', { token: TOKEN_A })).status).toBe(200);
      }
      expect(zeilen()).toHaveLength(1);
    });

    it('unveraenderte Meldung einer alten App ohne Fassung: keine Zeile, die bekannte Fassung bleibt', async () => {
      await melde('konfi1', { token: TOKEN_A });
      await melde('konfi1', { token: TOKEN_A, app_version: undefined, app_build: undefined });
      expect(zeilen()).toHaveLength(1);
      const { rows: [z] } = await db.query(
        "SELECT app_version, app_build FROM push_tokens WHERE device_id = 'geraet-1'"
      );
      expect(z).toEqual({ app_version: '2.3.0', app_build: '130' });
    });

    it('die Meldung aktualisiert updated_at trotzdem (die Spur fuer "meldet sich die App?")', async () => {
      await melde('konfi1', { token: TOKEN_A });
      await db.query("UPDATE push_tokens SET updated_at = NOW() - INTERVAL '2 days'");
      await melde('konfi1', { token: TOKEN_A });
      const { rows: [z] } = await db.query(
        "SELECT updated_at > NOW() - INTERVAL '1 minute' AS frisch FROM push_tokens WHERE device_id = 'geraet-1'"
      );
      expect(z.frisch).toBe(true);
      expect(zeilen()).toHaveLength(1);
    });
  });
});
