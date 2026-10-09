// backend/tests/routes/teamerBegruessungBerlin.test.js
//
// GET /teamer/dashboard liefert greeting.hour -- die Stunde fuer die
// Begruessung. Bis 09.10.2026 kam sie aus getHours(), also aus der Zone des
// Prozesses; in Produktion ist das UTC. Zwischen 0 und 2 Uhr (Sommerzeit)
// stand dort die Stunde des Vortags. Der Test laesst den Prozess in UTC
// laufen wie in Produktion und haelt die Uhr auf 23:30 UTC im Sommer an.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('GET /teamer/dashboard: greeting.hour in Berliner Zeit', () => {
  let app;
  let db;
  let tzVorher;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    tzVorher = process.env.TZ;
    process.env.TZ = 'UTC';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = tzVorher;
  });

  afterAll(async () => {
    await closePool();
  });

  it('23:30 UTC im Sommer meldet 1 (Berlin 1:30), nicht 23', async () => {
    const token = generateToken('teamer1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z'));
    const res = await request(app).get('/api/teamer/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.greeting.hour).toBe(1);
  });

  it('tagsueber: 10:00 UTC im Sommer meldet 12', async () => {
    const token = generateToken('teamer1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-15T10:00:00Z'));
    const res = await request(app).get('/api/teamer/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.greeting.hour).toBe(12);
  });
});
