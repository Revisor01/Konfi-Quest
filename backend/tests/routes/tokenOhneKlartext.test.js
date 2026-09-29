// Zugangs-Tokens ohne Anzeigename und E-Mail (Audit Sicherheit BF-15,
// 29.09.2026).
//
// Reproduziert im Audit: Claims `id, type, display_name, email,
// organization_id, role_name, is_super_admin, iat, exp`. Ein JWT ist nur
// base64-kodiert; Name und Adresse einer Konfi lagen damit lesbar im
// Geraetespeicher und in jedem Protokoll, das ein Token mitschreibt.
//
// Vertrag geprueft: Die Apps 1.5.3 bis 2.3.0 lesen aus dem Token nur `exp`
// (services/api.ts, getTokenExp); Name und E-Mail kommen aus der Antwort.
// Der Test prueft alle fuenf Stellen, die ein Token ausstellen, und dass
// die Apps weiter bekommen, was sie brauchen.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const ADRESSE = 'konfi.eins@familie.example';

// Wie die App (services/api.ts): Nutzlast base64url-dekodieren, ohne Pruefung.
const nutzlast = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

function ohneKlartext(token, { name, adresse }) {
  const p = nutzlast(token);
  expect(p).not.toHaveProperty('display_name');
  expect(p).not.toHaveProperty('email');
  const roh = Buffer.from(token.split('.')[1], 'base64url').toString('utf8');
  expect(roh).not.toContain(name);
  if (adresse) expect(roh).not.toContain(adresse);
  // Was die App liest, ist da.
  expect(typeof p.exp).toBe('number');
  expect(typeof p.id).toBe('number');
  return p;
}

describe('Zugangs-Token ohne Name und E-Mail', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query('UPDATE users SET email = $1 WHERE id = $2', [ADRESSE, USERS.konfi1.id]);
  });

  const anmelden = () => request(app).post('/api/auth/login')
    .send({ username: USERS.konfi1.username, password: PASSWORD });

  it('VERBOTEN: Anmeldung -- kein Name, keine Adresse im Token', async () => {
    const res = await anmelden();
    expect(res.status).toBe(200);
    const p = ohneKlartext(res.body.token, { name: USERS.konfi1.display_name, adresse: ADRESSE });
    expect(p).toMatchObject({ id: USERS.konfi1.id, type: 'konfi', organization_id: 1, role_name: 'konfi', is_super_admin: false });
  });

  it('VERBOTEN: Refresh -- kein Name, keine Adresse im neuen Token', async () => {
    const login = await anmelden();
    const res = await request(app).post('/api/auth/refresh').send({ refresh_token: login.body.refresh_token });
    expect(res.status).toBe(200);
    ohneKlartext(res.body.token, { name: USERS.konfi1.display_name, adresse: ADRESSE });
  });

  it('VERBOTEN: Gemeindewechsel -- kein Name, keine Adresse, active_organization_id bleibt', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
    await db.query('UPDATE users SET email = $1 WHERE id = $2', ['teamer.eins@familie.example', USERS.teamer1.id]);
    const res = await request(app).post('/api/auth/switch-org')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`)
      .send({ organization_id: ORGS.andereGemeinde.id });
    expect(res.status).toBe(200);
    const p = ohneKlartext(res.body.token, { name: USERS.teamer1.display_name, adresse: 'teamer.eins@familie.example' });
    expect(p.active_organization_id).toBe(ORGS.andereGemeinde.id);
  });

  it('VERBOTEN: Registrierung -- kein Name, keine Adresse im Token', async () => {
    await db.query(
      `INSERT INTO invite_codes (code, organization_id, jahrgang_id, created_by, expires_at)
       VALUES ('TOK15AAA', 1, $1, $2, NOW() + interval '7 days')`,
      [JAHRGAENGE.jahrgang1.id, USERS.orgAdmin1.id]
    );
    const res = await request(app).post('/api/auth/register-konfi').send({
      invite_code: 'TOK15AAA', display_name: 'Emilia Neumann', username: 'emilia.neumann',
      password: 'TestPasswort123!', email: 'emilia@familie.example',
    });
    expect(res.status).toBe(200);
    ohneKlartext(res.body.token, { name: 'Emilia Neumann', adresse: 'emilia@familie.example' });
    // Die App liest den Namen aus der Antwort.
    expect(res.body.user.display_name).toBe('Emilia Neumann');
  });

  it('VERBOTEN: neues Token nach dem Passwortwechsel -- kein Name, keine Adresse', async () => {
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send({ currentPassword: PASSWORD, newPassword: 'GanzNeu123!' });
    expect(res.status).toBe(200);
    ohneKlartext(res.body.token, { name: USERS.konfi1.display_name, adresse: ADRESSE });
  });

  it('ERLAUBT: Name und Adresse stehen weiter in der Antwort der Anmeldung und in /auth/me', async () => {
    const login = await anmelden();
    expect(login.body.user.display_name).toBe(USERS.konfi1.display_name);
    expect(login.body.user.email).toBe(ADRESSE);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.display_name).toBe(USERS.konfi1.display_name);
    expect(me.body.email).toBe(ADRESSE);
  });

  it('ERLAUBT: das neue Token wird ueberall angenommen und ist gueltig signiert', async () => {
    const login = await anmelden();
    const geprueft = jwt.verify(login.body.token, process.env.JWT_SECRET || 'test-secret-key-for-vitest');
    expect(geprueft.id).toBe(USERS.konfi1.id);
    const res = await request(app).get('/api/konfi/dashboard').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });
});
