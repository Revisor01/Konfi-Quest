// Tests fuer GET /api/app-version — den oeffentlichen Endpunkt des
// Update-Hinweises.
//
// Die Store-Abfrage wird ueber createApp-Options gestubbt (nie echtes Netz
// im Test). Geprueft wird die ANTWORTFORM als Vertrag (toEqual, nicht nur
// Feld-Existenz): Ausgelieferte Apps lesen ios/android.version/url — eine
// Formaenderung hier ist genau die Sorte Bruch, die am 29.08.2026 die
// Teamer-Dashboards zerlegt hat (siehe docs/api/ABRISS.md).
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
    expect(res.body).toEqual({
      ios: {
        version: '2.5.0',
        url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4',
      },
      android: {
        version: '2.5.0',
        url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest',
      },
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
      },
      android: {
        version: null,
        url: 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest',
      },
    });
  });
});
