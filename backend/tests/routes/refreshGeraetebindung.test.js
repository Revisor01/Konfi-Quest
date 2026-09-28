// Refresh-Tokens sind an das Geraet gebunden (Audit 26.09.2026, Sicherheit
// BF-08, zweiter Teil; Migration 171).
//
// Ein Refresh-Token gilt 90 Tage. Wer es abgriff (Geraetesicherung,
// Protokoll, Proxy), konnte es von jedem Geraet aus eintauschen. Jetzt
// schickt die App ihre Geraete-Kennung bei Anmeldung, Registrierung und
// Refresh mit; der Server speichert sie am Token, und die Rotation
// uebernimmt sie.
//
// Die Regeln:
//  - gebundenes Token + dieselbe Kennung  -> 200, das neue Token bleibt gebunden
//  - gebundenes Token + andere Kennung    -> 401, dieses Token ist widerrufen
//  - gebundenes Token + KEINE Kennung     -> 401, ebenso (sonst liesse sich die
//    Bindung durch Weglassen umgehen). Ausgelieferte Apps trifft das nicht:
//    Sie senden nie eine Kennung und bekommen deshalb nie ein gebundenes Token.
//  - ungebundenes Token (alte App, alter Token) -> wie bisher. Schickt die
//    Anfrage eine Kennung mit (die aktualisierte App), ist das NEUE Token an
//    sie gebunden -- so sind bestehende Sitzungen nach dem Update geschuetzt.
// Antwortformen unveraendert.
const crypto = require('crypto');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const GERAET = 'C0FFEE00-1111-4222-8333-444455556666';
const FREMD = 'DEADBEEF-9999-4888-8777-666655554444';
const ABLEHNUNG = { error: 'Ungültiger oder abgelaufener Refresh-Token' };

describe('POST /api/auth/refresh: Bindung an das Geraet', () => {
  let app;
  let db;

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

  const login = async (userKey, geraet) => {
    const koerper = { username: USERS[userKey].username, password: PASSWORD };
    if (geraet !== undefined) koerper.device_id = geraet;
    const res = await request(app).post('/api/auth/login').send(koerper);
    expect(res.status).toBe(200);
    return res.body;
  };
  const refresh = (refreshToken, geraet) => {
    const koerper = { refresh_token: refreshToken };
    if (geraet !== undefined) koerper.device_id = geraet;
    return request(app).post('/api/auth/refresh').send(koerper);
  };
  const zeile = async (token) => {
    const { rows: [z] } = await db.query(
      `SELECT device_id, revoked_at, expires_at > NOW() AS gueltig
         FROM refresh_tokens WHERE token_hash = $1`,
      [hash(token)]
    );
    return z;
  };

  describe('Ausgabe', () => {
    it('die Anmeldung mit Kennung speichert sie am Token', async () => {
      const { refresh_token } = await login('konfi1', GERAET);
      expect((await zeile(refresh_token)).device_id).toBe(GERAET);
    });

    it('die Anmeldung ohne Kennung (App 2.2.x/2.3.0) laesst das Token ungebunden', async () => {
      const { refresh_token } = await login('konfi1');
      expect((await zeile(refresh_token)).device_id).toBeNull();
    });

    it('eine unbrauchbare Kennung (kein Text, leer, ueberlang) bindet nicht', async () => {
      for (const kaputt of [4711, '   ', 'x'.repeat(256), { a: 1 }]) {
        const { refresh_token } = await login('konfi1', kaputt);
        expect((await zeile(refresh_token)).device_id).toBeNull();
      }
    });

    it('die Registrierung mit Einladungscode bindet an die mitgeschickte Kennung', async () => {
      const einladung = await request(app)
        .post('/api/auth/invite-code')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id });
      expect(einladung.status).toBe(200);

      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({
          invite_code: einladung.body.invite_code,
          display_name: 'Neue Konfi',
          username: 'neue.konfi',
          password: 'Micha6,8neu',
          device_id: GERAET,
        });
      expect(res.status).toBe(200);
      expect((await zeile(res.body.refresh_token)).device_id).toBe(GERAET);
      expect((await refresh(res.body.refresh_token, FREMD)).status).toBe(401);
    });

    it('der Passwortwechsel bindet NICHT -- ausgelieferte Apps schicken dort schon eine Kennung, beim Refresh aber keine', async () => {
      const { token } = await login('konfi1');
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: PASSWORD, newPassword: 'Neues,Passwort1', device_id: GERAET, platform: 'ios' });
      expect(res.status).toBe(200);
      expect((await zeile(res.body.refresh_token)).device_id).toBeNull();
      // Die alte App refresht danach ohne Kennung -- das muss gehen.
      expect((await refresh(res.body.refresh_token)).status).toBe(200);
    });
  });

  describe('erlaubt', () => {
    it('gebunden + dieselbe Kennung: 200, und die Rotation uebernimmt die Bindung', async () => {
      const a = (await login('konfi1', GERAET)).refresh_token;

      const erste = await refresh(a, GERAET);
      expect(erste.status).toBe(200);
      expect(Object.keys(erste.body).sort()).toEqual(['refresh_token', 'token']);
      const b = erste.body.refresh_token;
      expect((await zeile(b)).device_id).toBe(GERAET);

      // Auch das Token aus der Rotation laesst sich nur hier einloesen.
      expect((await refresh(b, GERAET)).status).toBe(200);
    });

    it('ungebunden + ohne Kennung (alte App): 200 wie bisher, das neue Token bleibt ungebunden', async () => {
      const a = (await login('konfi1')).refresh_token;
      const res = await refresh(a);
      expect(res.status).toBe(200);
      expect((await zeile(res.body.refresh_token)).device_id).toBeNull();
      expect((await refresh(res.body.refresh_token)).status).toBe(200);
    });

    it('ungebunden + mit Kennung (App nach dem Update): 200, das neue Token ist ab jetzt gebunden', async () => {
      const a = (await login('konfi1')).refresh_token;
      const res = await refresh(a, GERAET);
      expect(res.status).toBe(200);
      expect((await zeile(res.body.refresh_token)).device_id).toBe(GERAET);
      expect((await refresh(res.body.refresh_token, FREMD)).status).toBe(401);
    });

    it('die Gnadenfrist gilt fuer dasselbe Geraet weiter und bleibt gebunden', async () => {
      const a = (await login('konfi1', GERAET)).refresh_token;
      expect((await refresh(a, GERAET)).status).toBe(200);
      const zweite = await refresh(a, GERAET); // Gnadenfrist, z.B. nach Prozess-Kill
      expect(zweite.status).toBe(200);
      expect((await zeile(zweite.body.refresh_token)).device_id).toBe(GERAET);
    });
  });

  describe('verboten', () => {
    it('gebunden + andere Kennung: 401, dieses Token ist widerrufen -- auch fuer das eigene Geraet', async () => {
      const a = (await login('konfi1', GERAET)).refresh_token;

      const res = await refresh(a, FREMD);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ABLEHNUNG);

      const z = await zeile(a);
      expect(z.revoked_at).not.toBeNull();
      expect(z.gueltig).toBe(false);
      // Widerrufen heisst: auch nicht mehr ueber die Gnadenfrist einloesbar.
      expect((await refresh(a, GERAET)).status).toBe(401);
    });

    it('gebunden + ohne Kennung: 401 und widerrufen -- die Bindung laesst sich nicht durch Weglassen umgehen', async () => {
      const a = (await login('konfi1', GERAET)).refresh_token;
      const res = await refresh(a);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ABLEHNUNG);
      expect((await zeile(a)).gueltig).toBe(false);
    });

    it('gebunden + unbrauchbare Kennung zaehlt wie keine', async () => {
      const a = (await login('konfi1', GERAET)).refresh_token;
      expect((await refresh(a, 4711)).status).toBe(401);
      expect((await zeile(a)).gueltig).toBe(false);
    });

    it('der Widerruf trifft nur dieses Token: das zweite Geraet und andere Konten bleiben angemeldet', async () => {
      const zweitesGeraet = (await login('konfi1', FREMD)).refresh_token;
      const anderesKonto = (await login('konfi2', GERAET)).refresh_token;
      const a = (await login('konfi1', GERAET)).refresh_token;

      expect((await refresh(a, 'noch-ein-drittes')).status).toBe(401);

      expect((await refresh(zweitesGeraet, FREMD)).status).toBe(200);
      expect((await refresh(anderesKonto, GERAET)).status).toBe(200);
    });

    it('ein rotiertes Token in der Gnadenfrist mit fremder Kennung: 401, der Nachfolger des echten Geraets bleibt gueltig', async () => {
      const a = (await login('konfi1', GERAET)).refresh_token;
      const b = (await refresh(a, GERAET)).body.refresh_token;

      expect((await refresh(a, FREMD)).status).toBe(401);
      // Die Gnadenfrist ist fuer dieses Token damit verbraucht ...
      expect((await refresh(a, GERAET)).status).toBe(401);
      // ... das Geraet selbst arbeitet mit seinem Nachfolger weiter.
      expect((await refresh(b, GERAET)).status).toBe(200);
    });
  });
});
