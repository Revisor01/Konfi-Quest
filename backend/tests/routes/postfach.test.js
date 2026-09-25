// backend/tests/routes/postfach.test.js
// Postfach (25.09.2026): GET /postfach, PUT /postfach/gelesen,
// PUT /postfach/:id/gelesen und das neue Feld postfach in badge-counts.
//
// Die Tabelle notifications wurde bis dahin an sechs Stellen geschrieben und
// nirgends gelesen. Das Postfach ist PERSOENLICH (ueber alle Organisationen
// des Kontos), die einzige Sicherheitsgrenze ist notifications.user_id.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Postfach Routes', () => {
  let app;
  let db;
  let konfi1Token;
  let konfi2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfi1Token = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
  });

  afterAll(async () => {
    await closePool();
  });

  // Fuegt eine Mitteilung so ein, wie es die Schreibstellen tun
  // (activities.js, badges.js, konfi.js, teamer.js). data als JSON-String,
  // pg wandelt ihn in jsonb; null bleibt NULL.
  async function mitteilung({ userId, orgId = ORGS.testGemeinde.id, title = 'Titel',
                              message = 'Text', type = 'info', data = { k: 1 },
                              readAt = null, createdAt = null }) {
    const { rows } = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id, read_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamp, NOW()))
       RETURNING id`,
      [userId, title, message, type, data === null ? null : JSON.stringify(data), orgId, readAt, createdAt]
    );
    return rows[0].id;
  }

  async function ungeleseneInDb(userId) {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );
    return rows[0].c;
  }

  // ================================================================
  // GET /api/notifications/postfach
  // ================================================================
  describe('GET /api/notifications/postfach', () => {
    it('liefert nur die eigenen Mitteilungen', async () => {
      const a = await mitteilung({ userId: USERS.konfi1.id, title: 'Eins' });
      const b = await mitteilung({ userId: USERS.konfi1.id, title: 'Zwei' });
      const fremd = await mitteilung({ userId: USERS.konfi2.id, title: 'Fremd' });

      const res = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.eintraege).toHaveLength(2);
      expect(res.body.eintraege.map((e) => e.id)).toEqual([b, a]);
      expect(res.body.eintraege.map((e) => e.id)).not.toContain(fremd);
      expect(res.body.ungelesen).toBe(2);
      expect(res.body.weitere).toBe(false);
    });

    it('liest ueber ALLE Organisationen des Kontos, mit Gemeindenamen, neueste zuerst', async () => {
      // Entscheidung Org-Bezug: persoenliches Postfach wie das
      // Mitteilungszentrum des Handys -- ein "Neuer Antrag" aus Gemeinde 2
      // muss sichtbar sein, waehrend man in Gemeinde 1 arbeitet.
      const inOrg1 = await mitteilung({ userId: USERS.konfi1.id, orgId: ORGS.testGemeinde.id, title: 'Org 1' });
      const inOrg2 = await mitteilung({ userId: USERS.konfi1.id, orgId: ORGS.andereGemeinde.id, title: 'Org 2' });

      const res = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`); // Token traegt Org 1

      expect(res.status).toBe(200);
      expect(res.body.eintraege).toHaveLength(2);
      expect(res.body.eintraege[0]).toMatchObject({
        id: inOrg2,
        organization_id: ORGS.andereGemeinde.id,
        organization_name: 'Andere Gemeinde'
      });
      expect(res.body.eintraege[1]).toMatchObject({
        id: inOrg1,
        organization_id: ORGS.testGemeinde.id,
        organization_name: 'Test-Gemeinde St. Martin'
      });
    });

    it('liefert alle Felder eines Eintrags in der vereinbarten Form', async () => {
      const id = await mitteilung({
        userId: USERS.konfi1.id, title: 'Abzeichen', message: 'Du hast Fleissig verdient',
        type: 'badge_earned', data: { badge_id: 3 }
      });

      const res = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      const e = res.body.eintraege[0];
      expect(e).toEqual({
        id,
        title: 'Abzeichen',
        message: 'Du hast Fleissig verdient',
        type: 'badge_earned',
        data: { badge_id: 3 },
        read_at: null,
        created_at: expect.any(String),
        organization_id: ORGS.testGemeinde.id,
        organization_name: 'Test-Gemeinde St. Martin'
      });
    });

    it('data ist immer ein Objekt -- auch bei NULL in der Datenbank', async () => {
      await mitteilung({ userId: USERS.konfi1.id, data: null });

      const res = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.eintraege).toHaveLength(1);
      expect(res.body.eintraege[0].data).toEqual({});
    });

    it('ungelesen zaehlt nur ungelesene, weitere ist false bei einer Seite', async () => {
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id, readAt: new Date() });

      const res = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.eintraege).toHaveLength(2);
      expect(res.body.ungelesen).toBe(1);
      expect(res.body.weitere).toBe(false);
    });

    describe('Paginierung (Cursor vor=<id>)', () => {
      let ids;

      beforeEach(async () => {
        ids = [];
        for (let i = 1; i <= 35; i++) {
          ids.push(await mitteilung({ userId: USERS.konfi1.id, title: `Nr ${i}` }));
        }
      });

      it('Default: 30 Eintraege, weitere true, ungelesen unabhaengig von der Seite 35', async () => {
        const res = await request(app)
          .get('/api/notifications/postfach')
          .set('Authorization', `Bearer ${konfi1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.eintraege).toHaveLength(30);
        expect(res.body.weitere).toBe(true);
        expect(res.body.ungelesen).toBe(35);
        // Neueste zuerst: die hoechste id vorn.
        expect(res.body.eintraege[0].id).toBe(ids[34]);
        expect(res.body.eintraege[29].id).toBe(ids[5]);
      });

      it('zweite Seite ueber vor=<kleinste id der ersten Seite>: genau 5, weitere false', async () => {
        const erste = await request(app)
          .get('/api/notifications/postfach')
          .set('Authorization', `Bearer ${konfi1Token}`);
        const kleinste = erste.body.eintraege[erste.body.eintraege.length - 1].id;

        const zweite = await request(app)
          .get(`/api/notifications/postfach?vor=${kleinste}`)
          .set('Authorization', `Bearer ${konfi1Token}`);

        expect(zweite.status).toBe(200);
        expect(zweite.body.eintraege).toHaveLength(5);
        expect(zweite.body.eintraege.map((e) => e.id)).toEqual([ids[4], ids[3], ids[2], ids[1], ids[0]]);
        expect(zweite.body.weitere).toBe(false);
        expect(zweite.body.ungelesen).toBe(35);
      });

      it('limit=5 liefert genau 5 und weitere true', async () => {
        const res = await request(app)
          .get('/api/notifications/postfach?limit=5')
          .set('Authorization', `Bearer ${konfi1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.eintraege).toHaveLength(5);
        expect(res.body.weitere).toBe(true);
      });

      it('limit=200 wird still auf 100 gekappt', async () => {
        // 35 vorhanden + 70 weitere = 105 > 100
        for (let i = 36; i <= 105; i++) {
          await mitteilung({ userId: USERS.konfi1.id, title: `Nr ${i}` });
        }
        const res = await request(app)
          .get('/api/notifications/postfach?limit=200')
          .set('Authorization', `Bearer ${konfi1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.eintraege).toHaveLength(100);
        expect(res.body.weitere).toBe(true);
        expect(res.body.ungelesen).toBe(105);
      });

      it('limit=abc faellt auf den Default 30 zurueck', async () => {
        const res = await request(app)
          .get('/api/notifications/postfach?limit=abc')
          .set('Authorization', `Bearer ${konfi1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.eintraege).toHaveLength(30);
      });

      it('vor=abc wird ignoriert (erste Seite)', async () => {
        const res = await request(app)
          .get('/api/notifications/postfach?vor=abc')
          .set('Authorization', `Bearer ${konfi1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.eintraege).toHaveLength(30);
        expect(res.body.eintraege[0].id).toBe(ids[34]);
      });
    });

    it('ohne Token -> 401', async () => {
      const res = await request(app).get('/api/notifications/postfach');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // PUT /api/notifications/postfach/:id/gelesen
  // ================================================================
  describe('PUT /api/notifications/postfach/:id/gelesen', () => {
    it('markiert eine eigene Mitteilung als gelesen; ungelesen sinkt um genau 1', async () => {
      const id = await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id });
      expect(await ungeleseneInDb(USERS.konfi1.id)).toBe(2);

      const res = await request(app)
        .put(`/api/notifications/postfach/${id}/gelesen`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe(id);
      expect(typeof res.body.read_at).toBe('string');
      expect(Number.isNaN(Date.parse(res.body.read_at))).toBe(false);

      expect(await ungeleseneInDb(USERS.konfi1.id)).toBe(1);
      const postfach = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(postfach.body.ungelesen).toBe(1);
      const eintrag = postfach.body.eintraege.find((e) => e.id === id);
      expect(eintrag.read_at).toBe(res.body.read_at);
    });

    it('ist idempotent: zweiter Aufruf 200 mit demselben read_at', async () => {
      const id = await mitteilung({ userId: USERS.konfi1.id });

      const erster = await request(app)
        .put(`/api/notifications/postfach/${id}/gelesen`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      const zweiter = await request(app)
        .put(`/api/notifications/postfach/${id}/gelesen`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(erster.status).toBe(200);
      expect(zweiter.status).toBe(200);
      expect(zweiter.body).toEqual({ success: true, id, read_at: erster.body.read_at });
    });

    it('fremde Mitteilung -> 404 und bleibt in der DB ungelesen (verbotener Fall)', async () => {
      const fremd = await mitteilung({ userId: USERS.konfi2.id });

      const res = await request(app)
        .put(`/api/notifications/postfach/${fremd}/gelesen`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Mitteilung nicht gefunden' });

      const { rows } = await db.query('SELECT read_at FROM notifications WHERE id = $1', [fremd]);
      expect(rows).toHaveLength(1);
      expect(rows[0].read_at).toBeNull();
      expect(await ungeleseneInDb(USERS.konfi2.id)).toBe(1);
    });

    it('nicht vorhandene id -> 404 (gleiche Antwort wie fremd, verraet nichts)', async () => {
      const res = await request(app)
        .put('/api/notifications/postfach/999999/gelesen')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Mitteilung nicht gefunden' });
    });

    it('nicht-numerische id -> 400', async () => {
      const res = await request(app)
        .put('/api/notifications/postfach/abc/gelesen')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(400);
    });

    it('ohne Token -> 401', async () => {
      const id = await mitteilung({ userId: USERS.konfi1.id });
      const res = await request(app).put(`/api/notifications/postfach/${id}/gelesen`);
      expect(res.status).toBe(401);
      expect(await ungeleseneInDb(USERS.konfi1.id)).toBe(1);
    });
  });

  // ================================================================
  // PUT /api/notifications/postfach/gelesen
  // ================================================================
  describe('PUT /api/notifications/postfach/gelesen', () => {
    it('markiert alle eigenen ungelesenen; anzahl zaehlt bereits gelesene nicht mit', async () => {
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id, orgId: ORGS.andereGemeinde.id });
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id, readAt: new Date() });
      const fremd = await mitteilung({ userId: USERS.konfi2.id });

      const res = await request(app)
        .put('/api/notifications/postfach/gelesen')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, anzahl: 3 });

      expect(await ungeleseneInDb(USERS.konfi1.id)).toBe(0);
      const postfach = await request(app)
        .get('/api/notifications/postfach')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(postfach.body.ungelesen).toBe(0);
      expect(postfach.body.eintraege.every((e) => e.read_at !== null)).toBe(true);

      // Nur eigene betroffen: konfi2s bleibt ungelesen.
      const { rows } = await db.query('SELECT read_at FROM notifications WHERE id = $1', [fremd]);
      expect(rows[0].read_at).toBeNull();
      expect(await ungeleseneInDb(USERS.konfi2.id)).toBe(1);
    });

    it('ohne ungelesene -> anzahl 0', async () => {
      await mitteilung({ userId: USERS.konfi1.id, readAt: new Date() });

      const res = await request(app)
        .put('/api/notifications/postfach/gelesen')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, anzahl: 0 });
    });

    it('ohne Token -> 401', async () => {
      await mitteilung({ userId: USERS.konfi1.id });
      const res = await request(app).put('/api/notifications/postfach/gelesen');
      expect(res.status).toBe(401);
      expect(await ungeleseneInDb(USERS.konfi1.id)).toBe(1);
    });
  });

  // ================================================================
  // GET /api/notifications/badge-counts -- neues Feld postfach (additiv)
  // ================================================================
  describe('GET /api/notifications/badge-counts: Feld postfach', () => {
    it('postfach.ungelesen zaehlt ueber alle Organisationen des Kontos', async () => {
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id, orgId: ORGS.andereGemeinde.id });
      await mitteilung({ userId: USERS.konfi1.id, readAt: new Date() });
      await mitteilung({ userId: USERS.konfi2.id });

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.postfach).toEqual({ ungelesen: 4 });
    });

    it('alle bisherigen Felder bleiben vorhanden (Alt-App-Vertrag)', async () => {
      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      // konfi1 sitzt im Seed in Raum 1 und 2 (chat_participants), beide
      // ohne Nachrichten -> je 0.
      expect(res.body.chat).toEqual({ total: 0, byRoom: { 1: 0, 2: 0 } });
      expect(res.body.pendingRequests).toBe(0);
      expect(res.body.pendingEvents).toBe(0);
      expect(res.body.pendingChallenges).toBe(0);
      expect(res.body.newBadges).toBe(0);
      expect(res.body.challengeUpdates).toEqual({ total: 0, byChallenge: {} });
      expect(res.body.challengeApprovals).toEqual({ total: 0, byChallenge: {} });
      expect(res.body.postfach).toEqual({ ungelesen: 0 });
    });

    it('postfach.ungelesen sinkt nach Als-gelesen-Markieren auf 0', async () => {
      await mitteilung({ userId: USERS.konfi1.id });
      await mitteilung({ userId: USERS.konfi1.id });

      await request(app)
        .put('/api/notifications/postfach/gelesen')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .expect(200);

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.body.postfach).toEqual({ ungelesen: 0 });
    });
  });
});
