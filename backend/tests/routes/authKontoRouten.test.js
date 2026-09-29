// Die drei Auth-Routen, die bis zum 29.09.2026 keinen einzigen Test hatten
// (Audit Tests 26.09.2026, BF-04, Rest nach BF-05):
//
//   POST /api/auth/update-email          eigene E-Mail-Adresse setzen/leeren
//   POST /api/auth/update-role-title     eigene Funktionsbeschreibung (Team)
//   GET  /api/auth/validate-invite/:code Einladungscode vor der Registrierung
//
// Die ersten beiden aendern NUR das eigene Konto -- es gibt keine Kennung im
// Pfad. Der verbotene Fall ist deshalb: Ein Feld im Body, das auf ein fremdes
// Konto zeigt, wirkt nicht, und fremde Konten (auch aus der anderen Gemeinde)
// bleiben unveraendert. Die dritte ist oeffentlich; geprueft wird, dass sie
// genau drei Felder herausgibt und nichts aus der Zeile des Codes.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Auth: eigene Kontodaten und Einladungscode prüfen', () => {
  let app;
  let db;

  beforeAll(() => {
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

  const zeile = async (userId) => {
    const { rows: [u] } = await db.query('SELECT email, role_title FROM users WHERE id = $1', [userId]);
    return u;
  };

  // ==================================================================
  // POST /api/auth/update-email
  // ==================================================================
  describe('POST /api/auth/update-email', () => {
    const setze = (userKey, body) => request(app)
      .post('/api/auth/update-email')
      .set('Authorization', `Bearer ${generateToken(userKey)}`)
      .send(body);

    it('ERLAUBT: Konfi setzt die eigene Adresse -- Antwort, Datenbank und /auth/me stimmen überein', async () => {
      const res = await setze('konfi1', { email: '  kim@example.org  ' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'E-Mail-Adresse erfolgreich aktualisiert', email: 'kim@example.org' });
      expect((await zeile(USERS.konfi1.id)).email).toBe('kim@example.org');

      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${generateToken('konfi1')}`);
      expect(me.status).toBe(200);
      expect(me.body.email).toBe('kim@example.org');
    });

    it('ERLAUBT: null leert die Adresse (so schickt es die App bei leerem Feld)', async () => {
      await db.query("UPDATE users SET email = 'alt@example.org' WHERE id = $1", [USERS.teamer1.id]);
      const res = await setze('teamer1', { email: null });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'E-Mail-Adresse erfolgreich aktualisiert', email: null });
      expect((await zeile(USERS.teamer1.id)).email).toBe(null);
    });

    it('VERBOTEN: eine ungültige Adresse -> 400, nichts gespeichert', async () => {
      await db.query("UPDATE users SET email = 'alt@example.org' WHERE id = $1", [USERS.konfi1.id]);
      const res = await setze('konfi1', { email: 'keine-adresse' });
      expect(res.status).toBe(400);
      // Die Eingangspruefung (express-validator) greift vor der Route.
      expect(res.body).toEqual({
        error: 'Validierungsfehler',
        details: [{ field: 'email', message: 'Ungültige E-Mail-Adresse' }],
      });
      expect((await zeile(USERS.konfi1.id)).email).toBe('alt@example.org');
    });

    it('VERBOTEN: eine Adresse, die in derselben Gemeinde schon vergeben ist -> 409', async () => {
      await db.query("UPDATE users SET email = 'belegt@example.org' WHERE id = $1", [USERS.admin1.id]);
      const res = await setze('konfi1', { email: 'belegt@example.org' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
      expect((await zeile(USERS.konfi1.id)).email).toBe(null);
    });

    it('ERLAUBT: dieselbe Adresse in einer ANDEREN Gemeinde ist kein Konflikt (Eindeutigkeit je Gemeinde)', async () => {
      await db.query("UPDATE users SET email = 'geteilt@example.org' WHERE id = $1", [USERS.admin1.id]);
      const res = await setze('konfi3', { email: 'geteilt@example.org' });
      expect(res.status).toBe(200);
      expect((await zeile(USERS.konfi3.id)).email).toBe('geteilt@example.org');
    });

    it('VERBOTEN: eine Kennung im Body lenkt nicht auf ein fremdes Konto um -- das Konto aus Gemeinde 1 bleibt unverändert', async () => {
      await db.query("UPDATE users SET email = 'org1@example.org' WHERE id = $1", [USERS.konfi1.id]);
      const res = await setze('konfi3', { email: 'fremd@example.org', user_id: USERS.konfi1.id, id: USERS.konfi1.id });
      expect(res.status).toBe(200);
      expect((await zeile(USERS.konfi1.id)).email).toBe('org1@example.org');
      expect((await zeile(USERS.konfi3.id)).email).toBe('fremd@example.org');
    });

    it('VERBOTEN: ohne Anmeldung -> 401, nichts gespeichert', async () => {
      const res = await request(app).post('/api/auth/update-email').send({ email: 'x@example.org' });
      expect(res.status).toBe(401);
      const { rows } = await db.query("SELECT id FROM users WHERE email = 'x@example.org'");
      expect(rows).toEqual([]);
    });
  });

  // ==================================================================
  // POST /api/auth/update-role-title
  // ==================================================================
  describe('POST /api/auth/update-role-title', () => {
    const setze = (userKey, body) => request(app)
      .post('/api/auth/update-role-title')
      .set('Authorization', `Bearer ${generateToken(userKey)}`)
      .send(body);

    it('ERLAUBT: Teamer:in setzt die eigene Funktionsbeschreibung (getrimmt)', async () => {
      const res = await setze('teamer1', { role_title: '  Jugendmitarbeiterin  ' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Funktionsbeschreibung erfolgreich aktualisiert', role_title: 'Jugendmitarbeiterin' });
      expect((await zeile(USERS.teamer1.id)).role_title).toBe('Jugendmitarbeiterin');
    });

    it('ERLAUBT: Admin und Org-Admin ebenso; ein leerer Text leert das Feld', async () => {
      expect((await setze('admin1', { role_title: 'Diakon' })).status).toBe(200);
      expect((await zeile(USERS.admin1.id)).role_title).toBe('Diakon');

      const leer = await setze('admin1', { role_title: '   ' });
      expect(leer.status).toBe(200);
      expect(leer.body.role_title).toBe(null);
      expect((await zeile(USERS.admin1.id)).role_title).toBe(null);

      expect((await setze('orgAdmin1', { role_title: 'Pastor' })).status).toBe(200);
      expect((await zeile(USERS.orgAdmin1.id)).role_title).toBe('Pastor');
    });

    it('VERBOTEN: Konfi -> 403, die Spalte bleibt leer', async () => {
      const res = await setze('konfi1', { role_title: 'Chefin' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Konfis können keine Funktionsbeschreibung setzen' });
      expect((await zeile(USERS.konfi1.id)).role_title).toBe(null);
    });

    it('VERBOTEN: Teamer:in aus Gemeinde 2 ändert mit fremder Kennung im Body nur das eigene Konto', async () => {
      await db.query("UPDATE users SET role_title = 'Diakon' WHERE id = $1", [USERS.admin1.id]);
      const res = await setze('teamer2', { role_title: 'Übernommen', user_id: USERS.admin1.id, id: USERS.admin1.id });
      expect(res.status).toBe(200);
      expect((await zeile(USERS.admin1.id)).role_title).toBe('Diakon');
      expect((await zeile(USERS.teamer2.id)).role_title).toBe('Übernommen');
    });

    it('VERBOTEN: ohne Anmeldung -> 401', async () => {
      const res = await request(app).post('/api/auth/update-role-title').send({ role_title: 'x' });
      expect(res.status).toBe(401);
    });
  });

  // ==================================================================
  // GET /api/auth/validate-invite/:code (oeffentlich)
  // ==================================================================
  describe('GET /api/auth/validate-invite/:code', () => {
    const legeCodeAn = async (code, orgId, jahrgangId, erstellerId, ablauf) => {
      await db.query(
        `INSERT INTO invite_codes (code, organization_id, jahrgang_id, created_by, expires_at)
         VALUES ($1, $2, $3, $4, ${ablauf})`,
        [code, orgId, jahrgangId, erstellerId]
      );
    };

    it('ERLAUBT: gültiger Code -> genau drei Felder, Gemeinde und Jahrgang des Codes', async () => {
      await legeCodeAn('ABCD1234', ORGS.andereGemeinde.id, JAHRGAENGE.jahrgang2.id, USERS.orgAdmin2.id, "NOW() + INTERVAL '7 days'");
      const res = await request(app).get('/api/auth/validate-invite/ABCD1234');
      expect(res.status).toBe(200);
      // Nichts aus der Zeile des Codes (id, created_by, organization_id,
      // jahrgang_id, expires_at) -- nur, was die Registrierung anzeigt.
      expect(res.body).toEqual({
        valid: true,
        jahrgang_name: JAHRGAENGE.jahrgang2.name,
        organization_name: ORGS.andereGemeinde.display_name,
      });
    });

    it('ERLAUBT: Kleinschreibung wird wie in der Registrierung angenommen', async () => {
      await legeCodeAn('EF567890', ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id, USERS.orgAdmin1.id, "NOW() + INTERVAL '1 day'");
      const res = await request(app).get('/api/auth/validate-invite/ef567890');
      expect(res.status).toBe(200);
      expect(res.body.organization_name).toBe(ORGS.testGemeinde.display_name);
    });

    it('VERBOTEN: unbekannter Code -> 404 not_found', async () => {
      const res = await request(app).get('/api/auth/validate-invite/NICHTDA1');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Dieser Einladungscode existiert nicht', error_code: 'not_found' });
    });

    it('VERBOTEN: abgelaufener Code -> 410 expired, ohne Gemeinde oder Jahrgang', async () => {
      await legeCodeAn('ALT00001', ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id, USERS.orgAdmin1.id, "NOW() - INTERVAL '1 minute'");
      const res = await request(app).get('/api/auth/validate-invite/ALT00001');
      expect(res.status).toBe(410);
      expect(res.body).toEqual({
        error: 'Dieser Einladungscode ist abgelaufen. Bitte frage deinen Konfi-Leiter nach einem neuen Code.',
        error_code: 'expired',
      });
    });
  });
});
