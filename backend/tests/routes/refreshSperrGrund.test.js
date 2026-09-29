// Refresh nennt bei einer Sperre denselben Grund wie die Anmeldung
// (Audit 26.09.2026, Grundgeruest BF-11)
//
// Die App zeigt nach einer Sperre im Refresh jetzt den Grund an, den der
// Server mitschickt, statt "Deine Sitzung ist abgelaufen". Dafuer muss der
// Refresh denselben Text liefern wie die Anmeldung. Das tat er nicht:
//  - ein deaktiviertes Konto bekam error_code 'user_inactive', aber den Text
//    "Diese Organisation ist derzeit gesperrt ...";
//  - bei abgelaufener Testphase fehlte der zweite Satz ("Bitte wende dich an
//    deine Gemeinde, um einen Tarif zu buchen.");
//  - war das Konto deaktiviert UND die Testphase vorbei, meldete der Refresh
//    'org_trial_expired', die Anmeldung 'user_inactive'.
// Die Form der Antwort ({ error, error_code }, 403) bleibt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('POST /api/auth/refresh: Sperrgrund wie bei der Anmeldung', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  afterAll(async () => {
    await closePool();
  });

  const login = (userKey) =>
    request(app).post('/api/auth/login').send({ username: USERS[userKey].username, password: PASSWORD });
  const refresh = (refreshToken) =>
    request(app).post('/api/auth/refresh').send({ refresh_token: refreshToken });

  // Erst anmelden (Refresh-Token holen), dann sperren, dann Refresh und
  // erneute Anmeldung vergleichen.
  async function vergleiche(userKey, sperren) {
    const paar = (await login(userKey)).body;
    expect(typeof paar.refresh_token).toBe('string');
    await sperren();
    invalidateUserCache(USERS[userKey].id);
    const nachRefresh = await refresh(paar.refresh_token);
    const nachLogin = await login(userKey);
    return { nachRefresh, nachLogin };
  }

  it('deaktiviertes Konto: user_inactive mit dem Text der Anmeldung', async () => {
    const { nachRefresh, nachLogin } = await vergleiche('konfi1', () =>
      db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.konfi1.id]));

    expect(nachLogin.status).toBe(403);
    expect(nachRefresh.status).toBe(403);
    expect(nachRefresh.body).toEqual({
      error: 'Dein Zugang wurde deaktiviert. Bitte wende dich an deine Gemeinde.',
      error_code: 'user_inactive',
    });
    expect(nachRefresh.body).toEqual(nachLogin.body);
  });

  it('Testphase abgelaufen: org_trial_expired mit vollem Text', async () => {
    const { nachRefresh, nachLogin } = await vergleiche('konfi1', () =>
      db.query("UPDATE organizations SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = 1"));

    expect(nachRefresh.status).toBe(403);
    expect(nachRefresh.body).toEqual({
      error: 'Die Testphase dieser Organisation ist abgelaufen. Bitte wende dich an deine Gemeinde, um einen Tarif zu buchen.',
      error_code: 'org_trial_expired',
    });
    expect(nachRefresh.body).toEqual(nachLogin.body);
  });

  it('Gemeinde gesperrt: org_inactive wie bei der Anmeldung', async () => {
    const { nachRefresh, nachLogin } = await vergleiche('teamer1', () =>
      db.query('UPDATE organizations SET is_active = false WHERE id = 1'));

    expect(nachRefresh.status).toBe(403);
    expect(nachRefresh.body).toEqual({
      error: 'Diese Organisation ist derzeit gesperrt. Bitte wende dich an deine Gemeinde.',
      error_code: 'org_inactive',
    });
    expect(nachRefresh.body).toEqual(nachLogin.body);
  });

  it('Konto deaktiviert und Testphase vorbei: beide Wege melden das Konto', async () => {
    const { nachRefresh, nachLogin } = await vergleiche('konfi1', async () => {
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.konfi1.id]);
      await db.query("UPDATE organizations SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = 1");
    });

    expect(nachLogin.body.error_code).toBe('user_inactive');
    expect(nachRefresh.body.error_code).toBe('user_inactive');
    expect(nachRefresh.body).toEqual(nachLogin.body);
  });

  it('Gegenprobe: ohne Sperre stellt der Refresh ein neues Paar aus', async () => {
    const paar = (await login('konfi1')).body;
    const res = await refresh(paar.refresh_token);

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
    expect(res.body.error_code).toBeUndefined();
  });

  it('Super-Admin bleibt von der Gemeinde-Sperre ausgenommen', async () => {
    const paar = (await login('superAdmin')).body;
    await db.query('UPDATE organizations SET is_active = false WHERE id = 1');
    invalidateUserCache(USERS.superAdmin.id);

    const res = await refresh(paar.refresh_token);
    expect(res.status).toBe(200);
  });
});
