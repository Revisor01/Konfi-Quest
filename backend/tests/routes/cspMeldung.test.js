// backend/tests/routes/cspMeldung.test.js
//
// POST /api/csp-meldung (Simon, 09.10.2026): Der Browser meldet Verstoesse
// gegen die CSP der Web-App -- ohne Anmeldung, in zwei Formaten. Geprueft:
//   - beide Formate werden angenommen (204) und erscheinen bereinigt in
//     GET /api/metrics (cspMeldungen) -- ohne Abfrage, ohne Kennungen;
//   - zu gross: 413, nichts gezaehlt; falsches Format: 415; kein JSON: 400;
//   - die Grenze je Client-Adresse greift (verboten: 429 ab Grenze + 1) und
//     trifft andere Adressen nicht (erlaubt);
//   - die Kennzahlen sieht nur ein Super-Admin.
//
// supertest verbindet ueber Loopback, der Peer gilt als Proxy -- X-Real-IP
// waehlt die Adresse (utils/clientIp.js).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const csp = require('../../utils/cspMeldungen');
const { JE_STUNDE, MAX_BYTES } = require('../../routes/cspMeldung');
const { mergeSnapshots } = require('../../utils/apm');

const ALTE_MELDUNG = {
  'csp-report': {
    'document-uri': 'https://konfi-quest.de/konfi/events/123?code=GEHEIM1',
    referrer: '',
    'violated-directive': 'img-src',
    'effective-directive': 'img-src',
    'original-policy': "default-src 'self'; report-uri /api/csp-meldung",
    disposition: 'enforce',
    'blocked-uri': 'https://bilder.example.org/pfad/42/bild.png?token=GEHEIM2#anker',
    'status-code': 200,
    'script-sample': '',
  },
};

const REPORTING_API = [
  {
    type: 'csp-violation',
    age: 12,
    url: 'https://konfi-quest.de/admin/konfis/7',
    user_agent: 'Mozilla/5.0 Testbrowser',
    body: {
      documentURL: 'https://konfi-quest.de/admin/konfis/7?tab=punkte',
      blockedURL: 'https://cdn.example.net/skript.js?v=1',
      effectiveDirective: 'script-src-elem',
      disposition: 'enforce',
      sample: 'alert(1)',
      lineNumber: 3,
    },
  },
  {
    type: 'csp-violation',
    body: { documentURL: 'https://konfi-quest.de/start', blockedURL: 'inline', effectiveDirective: 'style-src-attr' },
  },
  // Andere Berichtsarten zaehlen nicht.
  { type: 'deprecation', body: { id: 'X', message: 'alt' } },
];

describe('POST /api/csp-meldung', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    csp._leeren();
  });
  afterAll(async () => { await closePool(); });

  const melde = (ip, typ, inhalt) => request(app)
    .post('/api/csp-meldung')
    .set('X-Real-IP', ip)
    .set('Content-Type', typ)
    .send(typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));

  const kennzahlen = async () => {
    const res = await request(app).get('/api/metrics').set('Authorization', `Bearer ${generateToken('superAdmin')}`);
    expect(res.status).toBe(200);
    return res.body.cspMeldungen;
  };

  it('application/csp-report (report-uri): 204, gezaehlt ohne Abfrage und Kennungen', async () => {
    const res = await melde('198.51.100.20', 'application/csp-report', ALTE_MELDUNG);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const stand = await kennzahlen();
    expect(stand.gesamt).toBe(1);
    expect(stand.verworfen).toBe(0);
    expect(stand.gruppen).toHaveLength(1);
    const { seit, zuletzt, ...gruppe } = stand.gruppen[0];
    expect(gruppe).toEqual({
      direktive: 'img-src',
      blockiert: 'https://bilder.example.org/pfad/:id/bild.png',
      seite: '/konfi/events/:id',
      anzahl: 1,
    });
    expect(seit).toBe(zuletzt);
    // Nichts von Abfrage, Anker, Codeauszug oder Browserkennung.
    expect(JSON.stringify(stand)).not.toMatch(/GEHEIM|anker|token|code=/);
  });

  it('application/reports+json (report-to): 204, jede CSP-Meldung gezaehlt, andere Berichtsarten nicht', async () => {
    const res = await melde('198.51.100.21', 'application/reports+json', REPORTING_API);
    expect(res.status).toBe(204);

    const stand = await kennzahlen();
    expect(stand.gesamt).toBe(2);
    expect(stand.gruppen.map(({ seit: _seit, zuletzt: _zuletzt, ...g }) => g)).toEqual(expect.arrayContaining([
      { direktive: 'script-src-elem', blockiert: 'https://cdn.example.net/skript.js', seite: '/admin/konfis/:id', anzahl: 1 },
      { direktive: 'style-src-attr', blockiert: 'inline', seite: '/start', anzahl: 1 },
    ]));
    expect(stand.gruppen).toHaveLength(2);
    expect(JSON.stringify(stand)).not.toMatch(/alert|Testbrowser|tab=/);
  });

  it('dieselbe Meldung zweimal: eine Gruppe mit Anzahl 2', async () => {
    expect((await melde('198.51.100.22', 'application/csp-report', ALTE_MELDUNG)).status).toBe(204);
    expect((await melde('198.51.100.22', 'application/csp-report', ALTE_MELDUNG)).status).toBe(204);
    const stand = await kennzahlen();
    expect(stand.gesamt).toBe(2);
    expect(stand.gruppen).toHaveLength(1);
    expect(stand.gruppen[0].anzahl).toBe(2);
  });

  it(`zu gross (ueber ${MAX_BYTES} Bytes): 413, nichts gezaehlt`, async () => {
    const gross = { 'csp-report': { ...ALTE_MELDUNG['csp-report'], 'script-sample': 'x'.repeat(MAX_BYTES) } };
    const res = await melde('198.51.100.23', 'application/csp-report', gross);
    expect(res.status).toBe(413);
    expect((await kennzahlen()).gesamt).toBe(0);
  });

  it('auch als application/json gilt die Grenze (der allgemeine Leser liest bis 100 KB)', async () => {
    const gross = { 'csp-report': { ...ALTE_MELDUNG['csp-report'], 'script-sample': 'x'.repeat(MAX_BYTES) } };
    const res = await melde('198.51.100.24', 'application/json', gross);
    expect(res.status).toBe(413);
  });

  it('knapp unter der Grenze: angenommen', async () => {
    const knapp = { 'csp-report': { ...ALTE_MELDUNG['csp-report'], 'script-sample': 'x'.repeat(MAX_BYTES - 1024) } };
    expect((await melde('198.51.100.25', 'application/csp-report', knapp)).status).toBe(204);
  });

  it('falsches Format: 415; kein JSON: 400; JSON ohne Meldung: 400 -- nichts gezaehlt', async () => {
    expect((await melde('198.51.100.26', 'text/plain', 'hallo')).status).toBe(415);
    expect((await melde('198.51.100.26', 'application/csp-report', '{kaputt')).status).toBe(400);
    expect((await melde('198.51.100.26', 'application/csp-report', { foo: 1 })).status).toBe(400);
    expect((await kennzahlen()).gesamt).toBe(0);
  });

  it(`nach ${JE_STUNDE} Sendungen von einer Adresse: 429 (verboten); eine andere Adresse bleibt frei (erlaubt)`, async () => {
    const status = [];
    for (let i = 0; i < JE_STUNDE + 1; i++) {
      status.push((await melde('198.51.100.30', 'application/csp-report', ALTE_MELDUNG)).status);
    }
    expect(status.slice(0, JE_STUNDE).every((s) => s === 204)).toBe(true);
    expect(status[JE_STUNDE]).toBe(429);
    expect((await melde('198.51.100.31', 'application/csp-report', ALTE_MELDUNG)).status).toBe(204);
    // Gezaehlt sind genau die angenommenen.
    expect((await kennzahlen()).gesamt).toBe(JE_STUNDE + 1);
  }, 60000);

  it('die Kennzahlen mit den Meldungen sieht nur ein Super-Admin', async () => {
    await melde('198.51.100.32', 'application/csp-report', ALTE_MELDUNG);
    const res = await request(app).get('/api/metrics').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(403);
    expect(res.body.cspMeldungen).toBeUndefined();
  });
});

describe('cspMeldungen: Bereinigung und Zusammenfassen', () => {
  beforeEach(() => csp._leeren());

  it.each([
    ['https://a.example/x/12/y?q=1#z', 'https://a.example/x/:id/y'],
    ['data:image/png;base64,AAAA', 'data'],
    ['blob:https://konfi-quest.de/0b1c', 'blob'],
    ['chrome-extension://abcdef/skript.js', 'chrome-extension'],
    ['eval', 'eval'],
    ['', '(leer)'],
    ['kein url mit leerzeichen', 'unbekannt'],
  ])('blockierte Adresse %s -> %s', (roh, erwartet) => {
    expect(csp.blockierteAdresse(roh)).toBe(erwartet);
  });

  it('hoechstens MAX_GRUPPEN Gruppen; der Rest zaehlt in verworfen', () => {
    const viele = Array.from({ length: csp.MAX_GRUPPEN + 5 }, (_, i) => ({ direktive: 'img-src', blockiert: `https://h${i}.example`, seite: '/' }));
    csp.aufnehmen(viele);
    const s = csp.stand();
    expect(s.gruppenAnzahl).toBe(csp.MAX_GRUPPEN);
    expect(s.verworfen).toBe(5);
    expect(s.gesamt).toBe(csp.MAX_GRUPPEN + 5);
    expect(s.gruppen).toHaveLength(30);
  });

  it('mergeSnapshots fasst die Meldungen mehrerer Replicas zusammen', () => {
    const g = (anzahl, seit, zuletzt) => ({ direktive: 'img-src', blockiert: 'https://x.example', seite: '/', anzahl, seit, zuletzt });
    const snap = (replica, gruppen, gesamt) => ({
      replica, totalRequests: 1, totalErrors: 0, inFlight: 0, maxInFlight: 0, rps: 0, uptimeSeconds: 1,
      routesSlowest: [], routesBusiest: [], recentErrors: [], timeline: [],
      cspMeldungen: { gesamt, verworfen: 0, gruppenAnzahl: gruppen.length, grenze: csp.MAX_GRUPPEN, gruppen },
    });
    const merged = mergeSnapshots([
      snap('a', [g(3, '2026-10-09T08:00:00.000Z', '2026-10-09T09:00:00.000Z')], 3),
      snap('b', [g(2, '2026-10-09T07:00:00.000Z', '2026-10-09T08:30:00.000Z')], 2),
    ]);
    expect(merged.cspMeldungen).toEqual({
      gesamt: 5, verworfen: 0, gruppenAnzahl: 1, grenze: csp.MAX_GRUPPEN,
      gruppen: [g(5, '2026-10-09T07:00:00.000Z', '2026-10-09T09:00:00.000Z')],
    });
  });
});
