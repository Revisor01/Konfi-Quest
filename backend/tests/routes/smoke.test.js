const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');
const { generateToken, getAllTokens } = require('../helpers/auth');

describe('Smoke Tests', () => {
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

  it('GET /api/health antwortet mit OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('POST /api/auth/login mit gueltigem Konfi', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: USERS.konfi1.username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refresh_token');
  });

  it('POST /api/auth/login mit falschem Passwort gibt 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: USERS.konfi1.username, password: 'falsch' });
    expect(res.status).toBe(401);
  });

  it('GET /api/konfi/dashboard mit gueltigem Token gibt 200', async () => {
    const token = generateToken('konfi1');
    const res = await request(app)
      .get('/api/konfi/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/konfi/dashboard ohne Token gibt 401', async () => {
    const res = await request(app).get('/api/konfi/dashboard');
    expect(res.status).toBe(401);
  });

  it('Auth-Helpers erzeugen gueltige Tokens fuer alle 5 Rollen', () => {
    const jwt = require('jsonwebtoken');
    const tokens = getAllTokens();
    const roleKeys = ['konfi1', 'teamer1', 'admin1', 'orgAdmin1', 'superAdmin'];
    for (const key of roleKeys) {
      expect(tokens[key]).toBeDefined();
      const decoded = jwt.verify(tokens[key], process.env.JWT_SECRET);
      expect(decoded.id).toBe(USERS[key].id);
    }
  });
});
