// backend/tests/schema/ersteinrichtung.test.js
//
// Erst-Einrichtung einer NEUEN Instanz (Audit 26.09.2026, Datenbank
// "Unklar: Erst-Einrichtung"; durchgespielt am 29.09.2026).
//
// Eine neue Instanz entsteht aus init-scripts/ und dem Migrationslauf --
// mit vollstaendigem Schema, aber ohne jede Zeile. Gemeinden legt nur ein
// Super-Admin an, Konten nur eine Leitung: Ohne einen ersten Zugang kommt
// niemand hinein. scripts/ersteinrichtung.js legt ihn an. Geprueft wird der
// ganze Weg bis in die App: anmelden, Gemeinden sehen, eine Gemeinde anlegen.
const path = require('path');
const { spawnSync } = require('child_process');
const request = require('supertest');
const {
  urlFuer, dbAnlegen, dbWegraeumen, neueInstanzAufbauen,
} = require('../helpers/schemaAufbau');
const { createApp } = require('../../createApp');

const SKRIPT = path.join(__dirname, '..', '..', 'scripts', 'ersteinrichtung.js');
const DB = 'konfi_test_ersteinrichtung';
const PASSWORT = 'Erster-Zugang1';

const skript = (extra) => spawnSync('node', [SKRIPT], {
  encoding: 'utf8',
  env: {
    ...process.env,
    DATABASE_URL: urlFuer(DB),
    ERST_BENUTZERNAME: 'betrieb',
    ERST_ANZEIGENAME: 'Betrieb',
    ERST_PASSWORT: PASSWORT,
    ...extra,
  },
});

describe('Ersteinrichtung einer neuen Instanz', () => {
  let pool;
  let app;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await neueInstanzAufbauen(pool);
    app = createApp({ query: (t, p) => pool.query(t, p), getClient: () => pool.connect() }, {
      uploadsDir: path.join(require('os').tmpdir(), 'konfi-test-uploads'),
    });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: frisches Schema, keine Gemeinde, kein Konto -- niemand kommt hinein', async () => {
    const { rows: [r] } = await pool.query(
      'SELECT (SELECT count(*) FROM organizations)::int AS g, (SELECT count(*) FROM users)::int AS k'
    );
    expect(r).toEqual({ g: 0, k: 0 });
    const res = await request(app).post('/api/auth/login').send({ username: 'betrieb', password: PASSWORT });
    expect(res.status).toBe(401);
  });

  it('ein zu schwaches Passwort wird abgelehnt, nichts angelegt', async () => {
    const r = skript({ ERST_PASSWORT: 'kurz' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ERST_PASSWORT: Passwort muss mindestens 8 Zeichen lang sein');
    const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM organizations');
    expect(n).toBe(0);
  });

  it('legt Gemeinde, vier Rollen und ein Super-Admin-Konto an', async () => {
    const r = skript({ ERST_EMAIL: 'betrieb@example.test' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^OK: Gemeinde \d+ \(betrieb\) und Konto \d+ mit Super-Admin-Recht angelegt\./);

    const { rows: rollen } = await pool.query('SELECT name FROM roles ORDER BY name');
    expect(rollen.map((x) => x.name)).toEqual(['admin', 'konfi', 'org_admin', 'teamer']);
    const { rows: [konto] } = await pool.query(
      `SELECT u.username, u.email, u.is_super_admin, r.name AS rolle, o.is_trial, o.trial_ends_at
       FROM users u JOIN roles r ON r.id = u.role_id JOIN organizations o ON o.id = u.organization_id`
    );
    expect(konto).toEqual({
      username: 'betrieb', email: 'betrieb@example.test', is_super_admin: true,
      rolle: 'org_admin', is_trial: false, trial_ends_at: null,
    });
  });

  it('mit dem Konto: anmelden, Gemeinden sehen, eine Gemeinde anlegen', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'betrieb', password: PASSWORT });
    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(typeof token).toBe('string');

    const liste = await request(app).get('/api/organizations').set('Authorization', `Bearer ${token}`);
    expect(liste.status).toBe(200);
    expect(liste.body.map((o) => o.slug)).toEqual(['betrieb']);

    const neu = await request(app).post('/api/organizations').set('Authorization', `Bearer ${token}`).send({
      name: 'Gemeinde Probe', slug: 'gemeinde-probe', display_name: 'Gemeinde Probe',
      contact_email: 'leitung@example.test',
      admin_username: 'leitung-probe', admin_password: 'Leitung-Probe1', admin_display_name: 'Leitung Probe',
    });
    expect(neu.status).toBe(201);
    const { rows: [{ n }] } = await pool.query(
      "SELECT count(*)::int AS n FROM custom_badges b JOIN organizations o ON o.id = b.organization_id WHERE o.slug = 'gemeinde-probe'"
    );
    expect(n).toBeGreaterThan(0);
  });

  it('ein zweiter Aufruf bricht ab und aendert nichts', async () => {
    const r = skript({ ERST_BENUTZERNAME: 'zweiter' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Die Datenbank ist nicht leer (2 Gemeinden, 2 Konten)');
    const { rows: [{ n }] } = await pool.query("SELECT count(*)::int AS n FROM users WHERE username = 'zweiter'");
    expect(n).toBe(0);
  });
});
