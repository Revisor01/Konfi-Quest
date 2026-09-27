// Anmeldesperre je Konto (Audit 26.09.2026, Sicherheit BF-04, HOCH).
//
// BEFUND, am Code nachgemessen: Die Einmalpasswoerter der Leitung stammen aus
// 30 772 Bibelstellen ("Johannes7,47", gleichverteilt gezogen, 14,9 Bit). Die
// Anmeldung zaehlte Fehlversuche nur je Client-IP (authLimiter in server.js:
// 300 je Viertelstunde, seit Migration 167 replica-uebergreifend). Wer den
// Benutzernamen eines Kindes kennt (Muster vorname.nachname), probierte damit
// 1 200 Stellen je Stunde und IP durch: der ganze Raum in 25,6 Stunden, mit
// zehn Adressen in 2,6 Stunden.
//
// ENTSCHEIDUNG (Simon, 27.09.2026): Das Passwortformat bleibt ("der Witz ist
// einfach zu gut"). Gehaertet wird der Anmeldeweg: Nach 10 falschen
// Passwoertern innerhalb einer Stunde nimmt dieses Konto keine Anmeldung mehr
// an -- auch nicht mit dem richtigen Passwort, sonst verriete der Erfolg das
// Passwort weiter. Gezaehlt wird je Konto, egal von welcher Adresse und ueber
// welche Replica; die IP-Grenze bleibt daneben bestehen.
//
// Der Zaehler liegt in rate_limit_zaehler (Migration 167) unter
// "konto:<sha256 von LOWER(benutzername)>" -- LOWER rechnet die Datenbank,
// dieselbe Funktion, mit der die Anmeldung das Konto sucht. truncateAll leert
// die Tabelle vor jedem Test. supertest verbindet ueber Loopback; der Peer
// gilt als Proxy, X-Real-IP wird angenommen (utils/clientIp.js).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD, JAHRGAENGE } = require('../helpers/seed');
const { generateToken, generateTokenMitAlter } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const crypto = require('crypto');

const GRENZE = 10;
const FALSCH = 'Johannes7,47';
const SPERRE = {
  error: 'Zu viele falsche Anmeldeversuche für dieses Konto. Versuche es in einer Stunde wieder oder bitte die Leitung deiner Gemeinde um ein neues Passwort.',
  error_code: 'account_locked',
};
const UNGUELTIG = { error: 'Ungültige Anmeldedaten' };

describe('POST /api/auth/login: Sperre je Konto nach Fehlversuchen', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach((u) => invalidateUserCache(u.id));
  });

  afterAll(async () => {
    await closePool();
  });

  const login = (username, password, { ip = '198.51.100.1', instanz = app } = {}) =>
    request(instanz).post('/api/auth/login').set('X-Real-IP', ip).send({ username, password });

  // Schluessel wie im Code: die Datenbank rechnet LOWER und den Hash.
  const SCHLUESSEL_SQL = `'konto:' || encode(sha256(convert_to(LOWER($1), 'UTF8')), 'hex')`;

  async function zaehlerstand(username) {
    const { rows } = await db.query(
      `SELECT treffer FROM rate_limit_zaehler WHERE schluessel = ${SCHLUESSEL_SQL} AND ablauf > NOW()`,
      [username]
    );
    return rows.length ? rows[0].treffer : 0;
  }

  // n falsche Passwoerter; jede Antwort muss ein schlichtes 401 sein.
  async function fehlversuche(username, n, { ipBasis = null, instanz = app } = {}) {
    const status = [];
    for (let i = 0; i < n; i++) {
      const ip = ipBasis ? `${ipBasis}.${i + 1}` : '198.51.100.1';
      const res = await login(username, FALSCH, { ip, instanz });
      status.push(res.status);
      expect(res.body).toEqual(UNGUELTIG);
    }
    expect(status).toEqual(Array(n).fill(401));
  }

  describe('verboten: nach 10 Fehlversuchen ist das Konto gesperrt', () => {
    it('das richtige Passwort wird danach mit 429 und fester Meldung abgewiesen', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE);
      expect(await zaehlerstand('konfi1')).toBe(10);

      const res = await login(USERS.konfi1.username, PASSWORD);
      expect(res.status).toBe(429);
      expect(res.body).toEqual(SPERRE);
      // Kein Token, kein Nutzer -- nichts verraet, dass das Passwort stimmte.
      expect(Object.keys(res.body).sort()).toEqual(['error', 'error_code']);
      // Wartezeit bis zum Ende des Fensters (eine Stunde ab dem ersten Fehlversuch).
      const warten = Number(res.headers['retry-after']);
      expect(warten).toBeGreaterThanOrEqual(3590);
      expect(warten).toBeLessThanOrEqual(3600);
    });

    it('auch ein weiteres falsches Passwort bekommt 429, nicht 401', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE);
      const res = await login(USERS.konfi1.username, 'Psalm23,1');
      expect(res.status).toBe(429);
      expect(res.body).toEqual(SPERRE);
    });

    it('Fehlversuche von zehn verschiedenen Adressen zaehlen zusammen', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE, { ipBasis: '203.0.113' });
      const res = await login(USERS.konfi1.username, PASSWORD, { ip: '192.0.2.200' });
      expect(res.status).toBe(429);
      expect(res.body).toEqual(SPERRE);
    });

    it('Gross-/Kleinschreibung und Leerraum ergeben keinen neuen Zaehler', async () => {
      const schreibweisen = ['konfi1', 'Konfi1', 'KONFI1', '  konfi1 ', 'kOnFi1'];
      for (let i = 0; i < GRENZE; i++) {
        const res = await login(schreibweisen[i % schreibweisen.length], FALSCH);
        expect(res.status).toBe(401);
      }
      expect(await zaehlerstand('konfi1')).toBe(10);
      const res = await login('Konfi1', PASSWORD);
      expect(res.status).toBe(429);
      expect(res.body).toEqual(SPERRE);
    });

    it('replica-uebergreifend: 10 Fehlversuche an der einen, das richtige Passwort an der zweiten Instanz -> 429', async () => {
      // Zwei createApp gegen dieselbe Datenbank = zwei Replicas, je mit eigenem
      // Limiter und eigenem Store (wie zwei Prozesse).
      const appB = getTestApp(db);
      await fehlversuche(USERS.konfi1.username, GRENZE);

      const res = await login(USERS.konfi1.username, PASSWORD, { instanz: appB });
      expect(res.status).toBe(429);
      expect(res.body).toEqual(SPERRE);

      // Der Zaehler steht in der Datenbank -- nur so sehen ihn zwei Prozesse.
      // Der Name steht nicht darin, nur sein Hash.
      const hash = crypto.createHash('sha256').update('konfi1', 'utf8').digest('hex');
      const { rows } = await db.query(
        "SELECT schluessel, treffer FROM rate_limit_zaehler WHERE schluessel LIKE 'konto:%'"
      );
      expect(rows).toEqual([{ schluessel: `konto:${hash}`, treffer: 11 }]);
    });

    it('ein unbekannter Benutzername wird genauso gezaehlt -- die Sperre verraet nicht, ob es das Konto gibt', async () => {
      const bekannt = [];
      const unbekannt = [];
      for (let i = 0; i <= GRENZE; i++) {
        const a = await login(USERS.konfi1.username, FALSCH);
        const b = await login('gibt.es.nicht', FALSCH);
        bekannt.push([a.status, a.body]);
        unbekannt.push([b.status, b.body]);
      }
      expect(unbekannt).toEqual(bekannt);
      expect(bekannt[GRENZE]).toEqual([429, SPERRE]);
      expect(bekannt[GRENZE - 1]).toEqual([401, UNGUELTIG]);
    });

    it('die Sperre schreibt keinen Benutzernamen ins Log', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE);

      const zeilen = [];
      const spione = ['log', 'info', 'warn', 'error'].map((art) =>
        vi.spyOn(console, art).mockImplementation((...args) => { zeilen.push(args.map(String).join(' ')); })
      );
      try {
        const res = await login(USERS.konfi1.username, PASSWORD);
        expect(res.status).toBe(429);
      } finally {
        spione.forEach((s) => s.mockRestore());
      }
      expect(zeilen).toEqual(['Anmeldung gesperrt: 10 falsche Passwörter innerhalb einer Stunde für ein Konto']);
    });
  });

  describe('erlaubt', () => {
    it('ein anderes Konto bleibt frei, auch wenn eines gesperrt ist', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE);
      expect((await login(USERS.konfi1.username, PASSWORD)).status).toBe(429);

      const res = await login(USERS.konfi2.username, PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('konfi2');
      expect(await zaehlerstand('konfi2')).toBe(0);
    });

    it('9 Fehlversuche, dann das richtige Passwort: Anmeldung klappt, der Zaehler steht wieder bei 0', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE - 1);
      expect(await zaehlerstand('konfi1')).toBe(9);

      const res = await login(USERS.konfi1.username, PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('konfi1');
      expect(await zaehlerstand('konfi1')).toBe(0);

      // Zurueckgesetzt, nicht bloss um eins verringert: Es gibt wieder volle
      // zehn Versuche, der elfte ist gesperrt.
      await fehlversuche(USERS.konfi1.username, GRENZE);
      expect((await login(USERS.konfi1.username, PASSWORD)).status).toBe(429);
    });

    it('nach Ablauf des Fensters geht die Anmeldung wieder', async () => {
      await fehlversuche(USERS.konfi1.username, GRENZE);

      // Das Fenster ist eine Stunde lang, gerechnet ab dem ersten Fehlversuch.
      const { rows: [f] } = await db.query(
        `SELECT EXTRACT(EPOCH FROM ablauf - NOW())::int AS rest FROM rate_limit_zaehler WHERE schluessel = ${SCHLUESSEL_SQL}`,
        ['konfi1']
      );
      expect(f.rest).toBeGreaterThanOrEqual(3590);
      expect(f.rest).toBeLessThanOrEqual(3600);
      expect((await login(USERS.konfi1.username, PASSWORD)).status).toBe(429);

      // Zeit vorspulen: das Fenster endet jetzt.
      await db.query(
        `UPDATE rate_limit_zaehler SET ablauf = NOW() - interval '1 second' WHERE schluessel = ${SCHLUESSEL_SQL}`,
        ['konfi1']
      );

      const res = await login(USERS.konfi1.username, PASSWORD);
      expect(res.status).toBe(200);
      expect(await zaehlerstand('konfi1')).toBe(0);
    });

    it('abgewiesene Eingaben (leeres Passwort) zaehlen nicht als Fehlversuch', async () => {
      for (let i = 0; i < GRENZE + 2; i++) {
        const res = await login(USERS.konfi1.username, '');
        expect(res.status).toBe(400);
      }
      expect(await zaehlerstand('konfi1')).toBe(0);
      expect((await login(USERS.konfi1.username, PASSWORD)).status).toBe(200);
    });
  });

  describe('erlaubt: ein neu gesetztes Passwort hebt die Sperre auf', () => {
    // Beide Konten sperren; nur das Zielkonto wird freigegeben.
    async function beideSperren() {
      await fehlversuche(USERS.konfi1.username, GRENZE);
      await fehlversuche(USERS.konfi2.username, GRENZE);
      expect((await login(USERS.konfi1.username, PASSWORD)).status).toBe(429);
    }

    async function nurZielFrei(neuesPasswort) {
      expect(await zaehlerstand('konfi1')).toBe(0);
      const res = await login(USERS.konfi1.username, neuesPasswort);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('konfi1');
      // Das andere gesperrte Konto bleibt gesperrt.
      expect(await zaehlerstand('konfi2')).toBe(10);
      expect((await login(USERS.konfi2.username, PASSWORD)).status).toBe(429);
    }

    it('Einmalpasswort durch die Leitung (POST /admin/konfis/:id/regenerate-password)', async () => {
      await beideSperren();
      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/regenerate-password`)
        // orgAdmin1: admin1 hat im Seed keine Jahrgangszuweisung (403).
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      await nurZielFrei(res.body.temporaryPassword);
    });

    it('Passwort durch die Leitung (PUT /users/:id/reset-password)', async () => {
      await beideSperren();
      const res = await request(app)
        .put(`/api/users/${USERS.konfi1.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'Matthäus5,9neu' });
      expect(res.status).toBe(200);
      await nurZielFrei('Matthäus5,9neu');
    });

    it('Passwort in der Benutzerverwaltung (PUT /users/:id mit password)', async () => {
      await beideSperren();
      const res = await request(app)
        .put(`/api/users/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: 'Jesaja41,10neu' });
      expect(res.status).toBe(200);
      await nurZielFrei('Jesaja41,10neu');
    });

    it('"Passwort vergessen": neues Passwort ueber den Link aus der Mail (POST /auth/reset-password)', async () => {
      await beideSperren();
      const token = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await db.query(
        `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, NOW() + interval '1 hour')`,
        [USERS.konfi1.id, hash]
      );
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Rut4,17neu!' });
      expect(res.status).toBe(200);
      await nurZielFrei('Rut4,17neu!');
    });

    it('selbst im Profil geaendert, auf einem Geraet, das noch angemeldet ist (POST /auth/change-password)', async () => {
      await beideSperren();
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${generateTokenMitAlter('konfi1', 60)}`)
        .send({ currentPassword: PASSWORD, newPassword: 'Psalm23,1neu' });
      expect(res.status).toBe(200);
      await nurZielFrei('Psalm23,1neu');
    });

    it('ein neues Konto startet frei, auch wenn sein Benutzername vorher durchprobiert wurde (Konfi anlegen)', async () => {
      await fehlversuche('neue.konfi', GRENZE);
      expect(await zaehlerstand('neue.konfi')).toBe(10);

      const res = await request(app)
        .post('/api/admin/konfis')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ name: 'Neue Konfi', jahrgang_id: JAHRGAENGE.jahrgang1.id });
      expect(res.status).toBe(201);
      expect(res.body.username).toBe('neue.konfi');
      expect(await zaehlerstand('neue.konfi')).toBe(0);

      const anmeldung = await login('neue.konfi', res.body.temporaryPassword);
      expect(anmeldung.status).toBe(200);
    });

    it('ein neues Konto startet frei (Benutzerverwaltung: POST /users)', async () => {
      await fehlversuche('neue.teamerin', GRENZE);
      expect(await zaehlerstand('neue.teamerin')).toBe(10);
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ username: 'neue.teamerin', display_name: 'Neue Teamerin', password: 'Lukas2,10neu', role_id: 2 });
      expect(res.status).toBe(201);
      expect(await zaehlerstand('neue.teamerin')).toBe(0);
      expect((await login('neue.teamerin', 'Lukas2,10neu')).status).toBe(200);
    });

    it('ein neues Konto startet frei (weiterer Org-Admin: POST /organizations/:id/admins)', async () => {
      await fehlversuche('neue.leitung', GRENZE);
      expect(await zaehlerstand('neue.leitung')).toBe(10);
      const res = await request(app)
        .post('/api/organizations/1/admins')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ username: 'neue.leitung', display_name: 'Neue Leitung', password: 'Jona2,1neu' });
      expect(res.status).toBe(201);
      expect(await zaehlerstand('neue.leitung')).toBe(0);
      expect((await login('neue.leitung', 'Jona2,1neu')).status).toBe(200);
    });

    it('ein neues Konto startet frei (neue Gemeinde samt Org-Admin: POST /organizations)', async () => {
      await fehlversuche('gruender.admin', GRENZE);
      expect(await zaehlerstand('gruender.admin')).toBe(10);
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`)
        .send({
          name: 'Sperr-Test-Gemeinde',
          slug: 'sperr-test-gemeinde',
          display_name: 'Sperr-Test-Gemeinde',
          admin_username: 'gruender.admin',
          admin_password: 'Genesis1,1neu',
          admin_display_name: 'Gründer Admin',
        });
      expect(res.status).toBe(201);
      expect(await zaehlerstand('gruender.admin')).toBe(0);
      expect((await login('gruender.admin', 'Genesis1,1neu')).status).toBe(200);
    });

    it('ein neues Konto startet frei (Selbst-Registrierung mit Einladungscode)', async () => {
      await fehlversuche('selbst.angemeldet', GRENZE);
      expect(await zaehlerstand('selbst.angemeldet')).toBe(10);
      const einladung = await request(app)
        .post('/api/auth/invite-code')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id });
      expect(einladung.status).toBe(200);

      const res = await request(app)
        .post('/api/auth/register-konfi')
        .send({
          invite_code: einladung.body.invite_code,
          display_name: 'Selbst Angemeldet',
          username: 'selbst.angemeldet',
          password: 'Micha6,8neu',
        });
      expect(res.status).toBe(200);
      expect(await zaehlerstand('selbst.angemeldet')).toBe(0);
      expect((await login('selbst.angemeldet', 'Micha6,8neu')).status).toBe(200);
    });
  });
});
