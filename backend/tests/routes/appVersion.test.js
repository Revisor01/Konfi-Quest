// Tests fuer GET /api/app-version — den oeffentlichen Endpunkt des
// Update-Hinweises.
//
// Die Store-Abfrage wird ueber createApp-Options gestubbt (nie echtes Netz
// im Test). Geprueft wird die ANTWORTFORM als Vertrag (toEqual, nicht nur
// Feld-Existenz): Ausgelieferte Apps lesen ios/android.version/url — eine
// Formaenderung hier ist genau die Sorte Bruch, die am 29.08.2026 die
// Teamer-Dashboards zerlegt hat (siehe docs/api/ABRISS.md).
//
// MINDESTVERSION UND WARTUNGSHINWEIS (E-05, 27.09.2026): Die Antwort traegt
// zusaetzlich `min_version` je Plattform und oben `wartung {aktiv, text}`,
// beide aus Umgebungsvariablen (utils/betriebshinweise.js). Die Store-Apps
// 2.1.1 und 2.2.0 lesen nur ios/android.version/url und pruefen deren Typ
// (frontend/src/services/updateCheck.ts, an beiden Tags gleich) -- zusaetzliche
// Felder stoeren sie nicht. Die ALTEN Felder werden hier deshalb einzeln
// festgehalten, in jedem Zustand der Variablen.
const request = require('supertest');
const os = require('os');
const path = require('path');
const { createApp } = require('../../createApp');
const { getTestPool, closePool } = require('../helpers/db');
const { generateToken } = require('../helpers/auth');

function appMitStoreStub(holeStoreVersion) {
  return createApp(getTestPool(), {
    uploadsDir: path.join(os.tmpdir(), 'konfi-test-uploads'),
    holeStoreVersion,
  });
}

describe('GET /api/app-version', () => {
  afterAll(async () => {
    await closePool();
  });

  it('antwortet OHNE Anmeldung mit der exakten Vertragsform', async () => {
    const app = appMitStoreStub(async () => ({
      version: '2.5.0',
      iosUrl: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4',
    }));
    const res = await request(app).get('/api/app-version');
    expect(res.status).toBe(200);
    // Die alte Form plus die neuen Felder im Ruhezustand (keine Variable
    // gesetzt): min_version null, wartung inaktiv.
    expect(res.body).toEqual({
      ios: {
        version: '2.5.0',
        url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4',
        min_version: null,
      },
      android: {
        version: '2.5.0',
        url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest',
        min_version: null,
      },
      wartung: { aktiv: false, text: null },
    });
  });

  it('antwortet MIT Anmeldung identisch (Auth spielt keine Rolle)', async () => {
    const app = appMitStoreStub(async () => ({
      version: '2.5.0',
      iosUrl: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4',
    }));
    const token = generateToken('konfi1');
    const res = await request(app)
      .get('/api/app-version')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ios.version).toBe('2.5.0');
    expect(res.body.android.version).toBe('2.5.0');
  });

  it('meldet version null mit festen Store-URLs, wenn die Store-Version unbekannt ist', async () => {
    const app = appMitStoreStub(async () => null);
    const res = await request(app).get('/api/app-version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ios: {
        version: null,
        url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619',
        min_version: null,
      },
      android: {
        version: null,
        url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest',
        min_version: null,
      },
      wartung: { aktiv: false, text: null },
    });
  });
});

describe('GET /api/app-version: Mindestversion und Wartungshinweis (E-05)', () => {
  const VARIABLEN = ['APP_MIN_VERSION_IOS', 'APP_MIN_VERSION_ANDROID', 'WARTUNG_HINWEIS'];
  const gesichert = {};
  let warn;

  const storeStub = async () => ({
    version: '2.5.0',
    iosUrl: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4',
  });

  // Die alten Felder, wie 2.1.1/2.2.0 sie lesen -- in jedem Zustand gleich.
  const ALTE_FELDER = {
    ios: { version: '2.5.0', url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4' },
    android: { version: '2.5.0', url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest' },
  };
  const alteFelder = (body) => ({
    ios: { version: body.ios.version, url: body.ios.url },
    android: { version: body.android.version, url: body.android.url },
  });

  beforeEach(() => {
    for (const v of VARIABLEN) {
      gesichert[v] = process.env[v];
      delete process.env[v];
    }
    require('../../utils/betriebshinweise')._nurFuerTests_reset();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const v of VARIABLEN) {
      if (gesichert[v] === undefined) delete process.env[v];
      else process.env[v] = gesichert[v];
    }
    warn.mockRestore();
  });

  afterAll(async () => {
    await closePool();
  });

  it('meldet die gesetzten Werte je Plattform und den Wartungshinweis', async () => {
    process.env.APP_MIN_VERSION_IOS = '2.3.0';
    process.env.APP_MIN_VERSION_ANDROID = '2.2.1';
    process.env.WARTUNG_HINWEIS = 'Heute ab 20 Uhr ist Konfi Quest für eine Stunde nicht erreichbar.';
    const res = await request(appMitStoreStub(storeStub)).get('/api/app-version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ios: { ...ALTE_FELDER.ios, min_version: '2.3.0' },
      android: { ...ALTE_FELDER.android, min_version: '2.2.1' },
      wartung: {
        aktiv: true,
        text: 'Heute ab 20 Uhr ist Konfi Quest für eine Stunde nicht erreichbar.',
      },
    });
  });

  it('liest die Variablen bei JEDER Anfrage, nicht einmal beim Start', async () => {
    const app = appMitStoreStub(storeStub);
    const vorher = await request(app).get('/api/app-version');
    expect(vorher.body.ios.min_version).toBeNull();
    expect(vorher.body.wartung).toEqual({ aktiv: false, text: null });

    process.env.APP_MIN_VERSION_IOS = '2.4.0';
    process.env.WARTUNG_HINWEIS = 'Wartung';
    const nachher = await request(app).get('/api/app-version');
    expect(nachher.body.ios.min_version).toBe('2.4.0');
    expect(nachher.body.wartung).toEqual({ aktiv: true, text: 'Wartung' });

    delete process.env.APP_MIN_VERSION_IOS;
    delete process.env.WARTUNG_HINWEIS;
    const zurueck = await request(app).get('/api/app-version');
    expect(zurueck.body.ios.min_version).toBeNull();
    expect(zurueck.body.wartung).toEqual({ aktiv: false, text: null });
  });

  it('eine ungueltige Mindestversion wird null und geloggt, die andere Plattform bleibt', async () => {
    process.env.APP_MIN_VERSION_IOS = '2.3';
    process.env.APP_MIN_VERSION_ANDROID = '2.3.0';
    const res = await request(appMitStoreStub(storeStub)).get('/api/app-version');
    expect(res.status).toBe(200);
    expect(res.body.ios.min_version).toBeNull();
    expect(res.body.android.min_version).toBe('2.3.0');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('APP_MIN_VERSION_IOS');
  });

  it('die alten Felder bleiben in Form und Typ unveraendert, egal was gesetzt ist', async () => {
    const zustaende = [
      {},
      { APP_MIN_VERSION_IOS: '2.3.0', APP_MIN_VERSION_ANDROID: '2.3.0', WARTUNG_HINWEIS: 'Wartung' },
      { APP_MIN_VERSION_IOS: 'kaputt', WARTUNG_HINWEIS: '   ' },
    ];
    for (const zustand of zustaende) {
      for (const v of VARIABLEN) delete process.env[v];
      Object.assign(process.env, zustand);
      const res = await request(appMitStoreStub(storeStub)).get('/api/app-version');
      expect(res.status).toBe(200);
      expect(alteFelder(res.body), JSON.stringify(zustand)).toEqual(ALTE_FELDER);
      // Objekte bleiben Objekte, Strings bleiben Strings (Pruefung der
      // Store-Apps: typeof version/url === 'string').
      expect(typeof res.body.ios.version).toBe('string');
      expect(typeof res.body.ios.url).toBe('string');
      expect(typeof res.body.android.version).toBe('string');
      expect(typeof res.body.android.url).toBe('string');
    }
  });
});
