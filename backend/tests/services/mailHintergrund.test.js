// backend/tests/services/mailHintergrund.test.js
//
// Support-Mail im Hintergrund (services/backgroundService.js):
//
//   1. cleanupNichtZugeordneteMails: nicht zugeordnete Mails gehen nach 180
//      Tagen in Konfi Quest (created_at); zugeordnete bleiben (sie gehen mit
//      ihrer Anfrage bzw. Gemeinde). Simon, 03.10.2026.
//   2. Das Abholen haengt an startAllServices/stopAllServices -- und damit
//      nur am Cron-Leader (server.js ruft startAllServices ausschliesslich
//      in beiUebernahme der Leader-Wahl, utils/cronLeader.js). Kein anderer
//      Code startet es. Ein Takt, der auf ein laufendes Abholen trifft,
//      faellt aus.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');
const mailAbholung = require('../../services/mailAbholung');

const { NICHT_ZUGEORDNETE_MAILS_TAGE, MAIL_ABHOL_TAKT_MS } = BackgroundService;

describe('cleanupNichtZugeordneteMails', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  let n = 0;
  const mail = async (tage, { anfrageId = null, organizationId = null, richtung = 'ein' } = {}) => {
    n += 1;
    await db.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id, betreff, created_at, gesendet_am)
       VALUES ('moin', $1, $2, $3, $4, $5, NOW() - ($6::int * interval '1 day'), NOW() - interval '1000 days')`,
      [richtung, anfrageId, organizationId, `<a${n}@x>`, `${richtung}-${tage}${anfrageId ? '-anfrage' : ''}${organizationId ? '-gemeinde' : ''}`, tage]);
  };
  const uebrig = async () => (await db.query('SELECT betreff FROM mail_nachrichten ORDER BY id')).rows.map((r) => r.betreff);

  it('die Frist ist 180 Tage', () => {
    expect(NICHT_ZUGEORDNETE_MAILS_TAGE).toBe(180);
  });

  it('löscht nicht zugeordnete nach 181 Tagen (ein- und ausgehende), behält sie nach 179; Rückgabe = Anzahl', async () => {
    await mail(181);
    await mail(181, { richtung: 'aus' });
    await mail(179);
    expect(await BackgroundService.cleanupNichtZugeordneteMails(db)).toBe(2);
    expect(await uebrig()).toEqual(['ein-179']);
  });

  it('gezählt wird ab dem Eingang in Konfi Quest (created_at), nicht ab dem Datum der Mail', async () => {
    await mail(10); // gesendet_am vor 1000 Tagen
    expect(await BackgroundService.cleanupNichtZugeordneteMails(db)).toBe(0);
    expect(await uebrig()).toEqual(['ein-10']);
  });

  it('zugeordnete Mails bleiben, auch nach 400 Tagen', async () => {
    const { rows: [{ id }] } = await db.query(
      "INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am) VALUES ('G', 'K', 'k@x', NOW()) RETURNING id");
    await mail(400, { anfrageId: id });
    await mail(400, { organizationId: 1 });
    expect(await BackgroundService.cleanupNichtZugeordneteMails(db)).toBe(0);
    expect(await uebrig()).toEqual(['ein-400-anfrage', 'ein-400-gemeinde']);
  });

  it('das Protokoll nennt nur die Anzahl', async () => {
    await mail(200);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await BackgroundService.cleanupNichtZugeordneteMails(db);
      expect(log.mock.calls).toEqual([['Mails aufraeumen: 1 nicht zugeordnete Mails aelter als 180 Tage geloescht']]);
    } finally {
      log.mockRestore();
    }
  });

  it('läuft im nächtlichen Aufräumlauf (02:00), nach den Anfragen', () => {
    const quelle = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'backgroundService.js'), 'utf8');
    const lauf = quelle.slice(quelle.indexOf('static startAutoDeletionCron'), quelle.indexOf('static async cleanupAbgelehnteAnfragen'));
    // Seit 09.10.2026 mit Laufzeit (utils/hintergrundLaeufe.js).
    expect(lauf).toContain("await messeLauf('mails_aufraeumen', () => this.cleanupNichtZugeordneteMails(db));");
    expect(lauf.indexOf('cleanupUnbewegteAnfragen(db)')).toBeLessThan(lauf.indexOf('cleanupNichtZugeordneteMails(db)'));
  });
});

describe('Abholen: nur über startAllServices (Cron-Leader)', () => {
  const START = Object.getOwnPropertyNames(BackgroundService).filter((n) => /^start[A-Z]/.test(n) && n !== 'startAllServices');
  const STOPP = Object.getOwnPropertyNames(BackgroundService).filter((n) => /^stop[A-Z]/.test(n) && n !== 'stopAllServices');

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    BackgroundService.stopMailAbholService();
    BackgroundService.mailAbholungLaeuft = false;
  });

  it('startAllServices startet den Abhol-Takt, stopAllServices hält ihn an', () => {
    const gestartet = START.map((n) => vi.spyOn(BackgroundService, n).mockImplementation(() => {}));
    BackgroundService.startAllServices({ query: vi.fn() });
    expect(START).toContain('startMailAbholService');
    expect(BackgroundService.startMailAbholService).toHaveBeenCalledTimes(1);
    expect(gestartet.every((s) => s.mock.calls.length === 1)).toBe(true);

    const gestoppt = STOPP.map((n) => vi.spyOn(BackgroundService, n).mockImplementation(() => {}));
    BackgroundService.stopAllServices();
    expect(BackgroundService.stopMailAbholService).toHaveBeenCalledTimes(1);
    expect(gestoppt.every((s) => s.mock.calls.length === 1)).toBe(true);
  });

  it('der Takt: erster Lauf nach 30 s, dann alle 2 Minuten; nach stopMailAbholService keiner mehr', async () => {
    vi.useFakeTimers();
    const abholen = vi.spyOn(mailAbholung, 'alleAbholen').mockResolvedValue([]);
    const db = { query: vi.fn() };
    BackgroundService.startMailAbholService(db);
    BackgroundService.startMailAbholService(db); // doppelt gestartet: ein Takt
    await vi.advanceTimersByTimeAsync(29 * 1000);
    expect(abholen).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(abholen).toHaveBeenCalledTimes(1);
    expect(abholen).toHaveBeenLastCalledWith(db);
    await vi.advanceTimersByTimeAsync(MAIL_ABHOL_TAKT_MS);
    expect(abholen).toHaveBeenCalledTimes(2);
    expect(MAIL_ABHOL_TAKT_MS).toBe(2 * 60 * 1000);
    BackgroundService.stopMailAbholService();
    await vi.advanceTimersByTimeAsync(10 * MAIL_ABHOL_TAKT_MS);
    expect(abholen).toHaveBeenCalledTimes(2);
  });

  it('nie zwei Abholläufe gleichzeitig; ein Fehler bricht den Takt nicht ab', async () => {
    let fertig;
    const abholen = vi.spyOn(mailAbholung, 'alleAbholen')
      .mockImplementationOnce(() => new Promise((r) => { fertig = r; }))
      .mockRejectedValueOnce(Object.assign(new Error('kaputt'), { code: 'X1' }))
      .mockResolvedValue([]);
    const erster = BackgroundService.mailAbholen({});
    expect(await BackgroundService.mailAbholen({})).toBeNull(); // faellt aus
    expect(abholen).toHaveBeenCalledTimes(1);
    fertig([]);
    await erster;
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await BackgroundService.mailAbholen({})).toBeNull();
    expect(fehler.mock.calls).toEqual([['Mail-Abholung failed:', 'X1', 'kaputt']]);
    expect(await BackgroundService.mailAbholen({})).toEqual([]);
    expect(abholen).toHaveBeenCalledTimes(3);
  });

  it('kein anderer Code startet das Abholen: alleAbholen und startMailAbholService werden nur in backgroundService.js gerufen, startAllServices nur in der Leader-Übernahme von server.js', () => {
    const wurzel = path.join(__dirname, '..', '..');
    const dateien = [];
    const sammeln = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'tests', 'uploads', 'coverage'].includes(e.name) || e.name.startsWith('.')) continue;
        const voll = path.join(dir, e.name);
        if (e.isDirectory()) sammeln(voll);
        else if (e.name.endsWith('.js')) dateien.push(voll);
      }
    };
    sammeln(wurzel);
    const rufer = (muster) => dateien
      .filter((d) => fs.readFileSync(d, 'utf8').split('\n').some((z) => !/^\s*(\/\/|\*)/.test(z) && muster.test(z)))
      .map((d) => path.relative(wurzel, d))
      .sort();
    expect(rufer(/\balleAbholen\(/)).toEqual(['services/backgroundService.js', 'services/mailAbholung.js']);
    expect(rufer(/\bstartMailAbholService\(/)).toEqual(['services/backgroundService.js']);
    expect(rufer(/\.startAllServices\(/)).toEqual(['server.js']);

    const server = fs.readFileSync(path.join(wurzel, 'server.js'), 'utf8');
    const uebernahme = server.slice(server.indexOf('beiUebernahme:'), server.indexOf('beiVerlust:'));
    expect(uebernahme).toContain('BackgroundService.startAllServices(');
    expect(server.indexOf("process.env.RUN_BACKGROUND_JOBS !== 'false'")).toBeLessThan(server.indexOf('beiUebernahme:'));
  });
});
