// GET /api/events liefert die Kategorien eines Termins mit (03.09.2026).
//
// Die Terminlisten aller drei Rollen zeigen die Kategorien eines Termins
// (kategorienText in frontend/src/components/shared/eventFormatting.ts):
// aus categories[], ersatzweise aus category_names. Bis 09.10.2026 prüfte das
// ein Frontend-Test am Quelltext von routes/events/lesen.js ("as
// category_names", "categories: categories"); hier steht es an der Antwort.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('GET /api/events: Kategorien in der Terminliste', () => {
  let db;
  let app;
  let adminToken;
  let kategorien;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

    // Zwei Kategorien, die erste mit der kleineren Kennung UND dem späteren
    // Namen -- so fiele auf, wenn Kennung und Name getrennt sortiert würden.
    const { rows } = await db.query(
      `INSERT INTO categories (name, organization_id) VALUES ('Musik', $1), ('Freizeit', $1)
       RETURNING id, name`,
      [ORGS.testGemeinde.id]
    );
    kategorien = rows;
    for (const k of rows) {
      await db.query('INSERT INTO event_categories (event_id, category_id) VALUES ($1, $2)', [EVENTS.gottesdienstEvent.id, k.id]);
    }
  });

  afterAll(async () => {
    await closePool();
  });

  const listenEintrag = async () => {
    const res = await request(app).get('/api/events').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    return res.body.find((e) => e.id === EVENTS.gottesdienstEvent.id);
  };

  it('gibt die Kategorienamen als category_names aus', async () => {
    const evt = await listenEintrag();
    expect(evt.category_names).toBe('Freizeit, Musik');
  });

  it('baut das categories-Array: dieselben Kennungen und Namen wie in der Datenbank', async () => {
    const evt = await listenEintrag();
    expect(evt.categories.map((k) => k.id).sort((a, b) => a - b)).toEqual(kategorien.map((k) => k.id).sort((a, b) => a - b));
    expect(evt.categories.map((k) => k.name.trim()).sort()).toEqual(['Freizeit', 'Musik']);
  });

  // Gefunden 09.10.2026 beim Umstellen der Frontend-Tests: Die Route baute
  // die Paare aus zwei getrennt sortierten STRING_AGG (Kennungen als Text,
  // Namen alphabetisch) und trennte an ',' statt an ', ' -- Kennung 5 trug
  // den Namen von Kennung 6, jeder zweite Name begann mit einem Leerzeichen.
  it('jede Kennung trägt ihren eigenen Namen, ohne Leerzeichen davor', async () => {
    const evt = await listenEintrag();
    const erwartet = kategorien.map((k) => ({ id: k.id, name: k.name }))
      .sort((a, b) => a.id - b.id);
    expect([...evt.categories].sort((a, b) => a.id - b.id)).toEqual(erwartet);
  });

  it('die Kategorien stehen in derselben Reihenfolge wie category_names', async () => {
    const evt = await listenEintrag();
    expect(evt.categories.map((k) => k.name)).toEqual(['Freizeit', 'Musik']);
  });

  it('ein Name mit Komma bleibt ganz', async () => {
    await db.query("UPDATE categories SET name = 'Spiel, Spaß' WHERE id = $1", [kategorien[0].id]);
    const evt = await listenEintrag();
    expect(evt.categories.find((k) => k.id === kategorien[0].id)).toEqual({ id: kategorien[0].id, name: 'Spiel, Spaß' });
    expect(evt.categories).toHaveLength(2);
  });

  it('jahrgaenge[]: jede Kennung trägt ihren eigenen Namen', async () => {
    // Höhere Kennung, früherer Name -- dieselbe Falle wie bei den Kategorien.
    const { rows: [jg] } = await db.query(
      "INSERT INTO jahrgaenge (name, organization_id) VALUES ('1999', $1) RETURNING id",
      [ORGS.testGemeinde.id]
    );
    await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [EVENTS.gottesdienstEvent.id, jg.id]);
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, jg.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
    const evt = await listenEintrag();
    expect(evt.jahrgaenge).toEqual([
      { id: jg.id, name: '1999' },
      { id: JAHRGAENGE.jahrgang1.id, name: JAHRGAENGE.jahrgang1.name },
    ]);
  });

  it('GET /api/events/cancelled: dieselben Paare', async () => {
    await db.query('UPDATE events SET cancelled = TRUE, cancelled_at = NOW() WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
    const res = await request(app).get('/api/events/cancelled').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const evt = res.body.find((e) => e.id === EVENTS.gottesdienstEvent.id);
    expect([...evt.categories].sort((a, b) => a.id - b.id))
      .toEqual(kategorien.map((k) => ({ id: k.id, name: k.name })).sort((a, b) => a.id - b.id));
    expect(evt.jahrgaenge).toEqual([{ id: JAHRGAENGE.jahrgang1.id, name: JAHRGAENGE.jahrgang1.name }]);
  });

  it('GET /api/konfi/events: dieselben Paare für die Konfi', async () => {
    const res = await request(app).get('/api/konfi/events?all=true').set('Authorization', `Bearer ${generateToken('konfi1')}`);
    expect(res.status).toBe(200);
    const evt = res.body.find((e) => e.id === EVENTS.gottesdienstEvent.id);
    expect([...evt.categories].sort((a, b) => a.id - b.id))
      .toEqual(kategorien.map((k) => ({ id: k.id, name: k.name })).sort((a, b) => a.id - b.id));
  });

  it('ein Termin ohne Kategorie bekommt ein leeres Array', async () => {
    const res = await request(app).get('/api/events').set('Authorization', `Bearer ${adminToken}`);
    const ohne = res.body.find((e) => e.id === EVENTS.pflichtEvent.id);
    expect(ohne.categories).toEqual([]);
  });
});
