// Kennungen kommen als Zahl, auch aus bigint-Spalten (10.10.2026, zu
// Migration 211).
//
// node-pg liefert bigint (int8, OID 20) von Haus aus als Zeichenkette,
// integer als Zahl. Seit Migration 211 sind alle Fremdschluessel und die
// sieben Schluessel, auf die sie zeigen, bigint. Ohne Typ-Parser kaemen
// level.id, material.id, challenge.created_by usw. danach als "17" statt 17
// -- und die ausgelieferten Apps vergleichen mit === (etwa
// `challenge.created_by === user.id`). database.js setzt den Parser fuer die
// Produktion, tests/helpers/db.js denselben fuer den Test-Pool.
//
// Geprueft: (1) database.js setzt ihn wirklich, (2) die Spalten sind im
// Test-Schema bigint -- sonst bewiese (3) nichts --, (3) die Antworten
// dreier Routen, deren Felder aus umgestellten Spalten kommen, liefern
// Zahlen.
const request = require('supertest');
const { types } = require('pg');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const SPALTEN = [
  ['levels', 'id'], ['levels', 'organization_id'], ['levels', 'created_by'],
  ['materials', 'id'], ['materials', 'created_by'], ['materials', 'organization_id'],
  ['challenges', 'id'], ['challenges', 'organization_id'], ['challenges', 'created_by'],
];

describe('database.js liest bigint als Zahl', () => {
  it('nach dem Laden von database.js ist der Parser fuer OID 20 gesetzt', async () => {
    const testParser = types.getTypeParser(20);
    types.setTypeParser(20, (v) => v); // Vorgabe von node-pg: Zeichenkette
    try {
      const datenbank = require('../../database');
      expect(types.getTypeParser(20)('2147483648')).toBe(2147483648);
      await datenbank.end();
    } finally {
      types.setTypeParser(20, testParser);
    }
  });
});

describe('Antworten liefern Kennungen aus bigint-Spalten als Zahl', () => {
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

  it('die geprueften Spalten sind im Test-Schema bigint', async () => {
    const { rows } = await db.query(
      `SELECT table_name || '.' || column_name AS spalte, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND (table_name, column_name) IN (${SPALTEN.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(', ')})
        ORDER BY 1`,
      SPALTEN.flat()
    );
    expect(rows).toHaveLength(SPALTEN.length);
    expect(rows.filter((r) => r.data_type !== 'bigint')).toEqual([]);
  });

  it('GET /api/levels: id, organization_id, created_by sind Zahlen', async () => {
    await db.query('UPDATE levels SET created_by = $1 WHERE organization_id = $2', [USERS.admin1.id, ORGS.testGemeinde.id]);
    const res = await request(app).get('/api/levels').set('Authorization', `Bearer ${generateToken('admin1')}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const level of res.body) {
      expect(typeof level.id).toBe('number');
      expect(level.organization_id).toBe(ORGS.testGemeinde.id);
      expect(level.created_by).toBe(USERS.admin1.id);
    }
  });

  it('GET /api/material/:id: id, created_by und die Kennungen der Zuordnungen sind Zahlen', async () => {
    const { rows: [m] } = await db.query(
      `INSERT INTO materials (organization_id, title, created_by) VALUES ($1, 'Probe', $2) RETURNING id`,
      [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
    );
    await db.query('INSERT INTO material_events (material_id, event_id) VALUES ($1, $2)', [m.id, EVENTS.gottesdienstEvent.id]);
    await db.query('INSERT INTO material_jahrgaenge (material_id, jahrgang_id) VALUES ($1, $2)', [m.id, JAHRGAENGE.jahrgang1.id]);
    const res = await request(app).get(`/api/material/${m.id}`).set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(m.id);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.created_by).toBe(USERS.orgAdmin1.id);
    expect(res.body.events.map((e) => e.id)).toEqual([EVENTS.gottesdienstEvent.id]);
    expect(res.body.jahrgaenge.map((j) => j.id)).toEqual([JAHRGAENGE.jahrgang1.id]);
  });

  it('GET /api/challenges/admin/:id: id, organization_id, created_by sind Zahlen', async () => {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name, created_by,
                               starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Probe', 'x', 'x', $2, now() - interval '1 day', now() + interval '7 days', false, 'konfis_und_team')
       RETURNING id`,
      [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
    );
    const res = await request(app).get(`/api/challenges/admin/${c.id}`).set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(c.id);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.organization_id).toBe(ORGS.testGemeinde.id);
    expect(res.body.created_by).toBe(USERS.orgAdmin1.id);
  });
});
