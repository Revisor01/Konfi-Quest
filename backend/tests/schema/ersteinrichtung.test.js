// backend/tests/schema/ersteinrichtung.test.js
//
// Erst-Einrichtung einer NEUEN Instanz (Audit 26.09.2026, Datenbank
// "Unklar: Erst-Einrichtung"; durchgespielt am 29.09.2026).
//
// Eine neue Instanz entsteht aus init-scripts/ und dem Migrationslauf --
// mit vollstaendigem Schema, aber ohne jede Zeile. Gemeinden legt nur ein
// Super-Admin an, Konten nur eine Leitung: Ohne einen ersten Zugang kommt
// niemand hinein. scripts/ersteinrichtung.js legt ihn an.
//
// SEIT 03.10.2026 (Simon: "ja", "wird aber nie vorkommen") ein Support-Konto
// OHNE Gemeinde -- Systemrolle super_admin aus Migration 190, Merkmal
// is_super_admin -- statt einer Gemeinde "Betrieb" mit einer Gemeindeleitung.
// Es meldet sich wie jedes Support-Konto nur im Browser an
// (docs/betrieb/support-konto.md). Geprueft wird der ganze Weg: anmelden,
// Gemeinden sehen, eine Gemeinde anlegen.
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

  const zaehle = async () => (await pool.query(
    'SELECT (SELECT count(*) FROM organizations)::int AS g, (SELECT count(*) FROM users)::int AS k'
  )).rows[0];

  it('Ausgangslage: frisches Schema, keine Gemeinde, kein Konto -- niemand kommt hinein', async () => {
    expect(await zaehle()).toEqual({ g: 0, k: 0 });
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'betrieb', password: PASSWORT, kann_ohne_gemeinde: true });
    expect(res.status).toBe(401);
  });

  it('ein zu schwaches Passwort wird abgelehnt, nichts angelegt', async () => {
    const r = skript({ ERST_PASSWORT: 'kurz' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ERST_PASSWORT: Passwort muss mindestens 8 Zeichen lang sein');
    expect(await zaehle()).toEqual({ g: 0, k: 0 });
  });

  it('ein Benutzername mit Leerzeichen wird abgelehnt (Regeln wie bei Support-Konten), nichts angelegt', async () => {
    const r = skript({ ERST_BENUTZERNAME: 'betrieb support' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ERST_BENUTZERNAME: 3 bis 50 Zeichen, nur Buchstaben, Ziffern, Punkt und Bindestrich');
    expect(await zaehle()).toEqual({ g: 0, k: 0 });
  });

  it('legt ein Support-Konto ohne Gemeinde an -- keine Gemeinde, keine Rollen einer Gemeinde', async () => {
    const r = skript({ ERST_EMAIL: 'betrieb@example.test' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^OK: Support-Konto \d+ ohne Gemeinde angelegt \(Super-Admin\)\./);

    expect(await zaehle()).toEqual({ g: 0, k: 1 });
    // Nur die gemeindefreie Systemrolle aus Migration 190.
    const { rows: rollen } = await pool.query('SELECT name, organization_id FROM roles ORDER BY name');
    expect(rollen).toEqual([{ name: 'super_admin', organization_id: null }]);
    const { rows: [konto] } = await pool.query(
      `SELECT u.username, u.email, u.display_name, u.organization_id, u.is_super_admin, u.is_active, r.name AS rolle
       FROM users u JOIN roles r ON r.id = u.role_id`
    );
    expect(konto).toEqual({
      username: 'betrieb', email: 'betrieb@example.test', display_name: 'Betrieb',
      organization_id: null, is_super_admin: true, is_active: true, rolle: 'super_admin',
    });
  });

  it('verboten: Anmeldung aus einer App (ohne kann_ohne_gemeinde) -- 403 mit Hinweis auf die Web-Version', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'betrieb', password: PASSWORT });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error_code: 'user_inactive', grund: 'konto_ohne_gemeinde' });
  });

  it('erlaubt: im Browser anmelden, Gemeinden sehen (noch keine), eine Gemeinde anlegen', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'betrieb', password: PASSWORT, kann_ohne_gemeinde: true });
    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(typeof token).toBe('string');

    const liste = await request(app).get('/api/organizations').set('Authorization', `Bearer ${token}`);
    expect(liste.status).toBe(200);
    expect(liste.body).toEqual([]);

    const neu = await request(app).post('/api/organizations').set('Authorization', `Bearer ${token}`).send({
      name: 'Gemeinde Probe', slug: 'gemeinde-probe', display_name: 'Gemeinde Probe',
      contact_email: 'leitung@example.test',
      admin_username: 'leitung-probe', admin_password: 'Leitung-Probe1', admin_display_name: 'Leitung Probe',
    });
    expect(neu.status).toBe(201);
    const { rows: [{ n }] } = await pool.query(
      "SELECT count(*)::int AS n FROM custom_badges b JOIN organizations o ON o.id = b.organization_id WHERE o.slug = 'gemeinde-probe'"
    );
    expect(n).toBe(36);
  });

  it('ein zweiter Aufruf bricht ab und aendert nichts', async () => {
    const r = skript({ ERST_BENUTZERNAME: 'zweiter' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Die Datenbank ist nicht leer (1 Gemeinden, 2 Konten)');
    const { rows: [{ n }] } = await pool.query("SELECT count(*)::int AS n FROM users WHERE username = 'zweiter'");
    expect(n).toBe(0);
  });
});
