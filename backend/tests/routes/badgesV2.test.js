// backend/tests/routes/badgesV2.test.js
//
// Die Abzeichen-Generation v2 — EINE Huelle fuer Konfi und Teamer.
//
// WORUM ES HIER GEHT (31.08.2026)
// Am 28.08. wurde GET /teamer/badges still von einem Array auf die Konfi-Form
// umgestellt, um beide Rollen anzugleichen. Am 29.08. stuerzten daraufhin die
// ausgelieferten Apps ab: sie rufen `.filter()` auf der Antwort auf, und auf
// einem Objekt ist das ein TypeError. Die Tests waren dabei gruen — sie
// kannten nur die mitdeployte Oberflaeche, nicht die App auf den Geraeten.
//
// Konsequenz: Die Angleichung steht jetzt in NEUEN Routen (/badges/v2),
// waehrend die alten unveraendert weiterlaufen. Diese Datei sichert beide
// Seiten davon ab:
//   1. dass die ALTEN Routen ihre Form behalten (der Vertrag der Store-Apps),
//   2. dass v2 fuer beide Rollen dieselbe Huelle liefert,
//   3. dass alt und neu DENSELBEN INHALT zeigen — der Test gegen das
//      Auseinanderlaufen, an dem der 28.08. gescheitert ist.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// Die Verwaltungsfelder, die v2 nicht mehr mitschickt. Sie landen auf keinem
// Bildschirm (Begruendung in backend/utils/badgeAntwortV2.js).
const GESTRICHENE_FELDER = ['created_at', 'created_by', 'organization_id', 'target_role'];

// Die Felder, die BLEIBEN MUESSEN. Nachgemessen am Frontend:
// criteria_type/criteria_value gruppieren und sortieren die Abzeichen-Seite
// (BadgesView.tsx), sort_order sortiert die Kreise der Startseite
// (DashboardView.tsx), criteria_extra zeigt die Bedingung, is_active/is_hidden
// steuern die Anzeige.
const PFLICHTFELDER = [
  'id', 'name', 'icon', 'color', 'criteria_type', 'criteria_value',
  'criteria_extra', 'is_hidden', 'is_active', 'sort_order', 'earned'
];

describe('Abzeichen-Generation v2', () => {
  let app;
  let db;
  let konfiToken;
  let teamerToken;
  let adminToken;
  let teamer2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    teamerToken = generateToken('teamer1');
    adminToken = generateToken('admin1');
    teamer2Token = generateToken('teamer2');
  });

  afterAll(async () => {
    await closePool();
  });

  // Ein Abzeichen anlegen und die id zurueckgeben.
  const abzeichen = async (name, rolle, extras = {}) => {
    const { rows: [b] } = await db.query(
      `INSERT INTO custom_badges (name, description, criteria_type, criteria_value,
                                  icon, color, organization_id, target_role,
                                  is_active, is_hidden, sort_order)
       VALUES ($1, 'Beschreibung', $2, $3, 'ribbon', '#be185d', $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        name,
        extras.criteria_type || (rolle === 'teamer' ? 'teamer_year' : 'total_points'),
        extras.criteria_value === undefined ? 3 : extras.criteria_value,
        ORGS.testGemeinde.id,
        rolle,
        extras.is_active === undefined ? true : extras.is_active,
        extras.is_hidden === undefined ? false : extras.is_hidden,
        extras.sort_order === undefined ? 7 : extras.sort_order
      ]
    );
    return b.id;
  };

  const verleihen = (userId, badgeId) => db.query(
    `INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id)
     VALUES ($1, $2, CURRENT_DATE, $3)`,
    [userId, badgeId, ORGS.testGemeinde.id]
  );

  // ==================================================================
  // 1. DIE ALTEN ROUTEN BEHALTEN IHRE FORM (Vertrag der Store-Apps)
  // ==================================================================
  describe('Alte Routen bleiben unveraendert', () => {
    // Genau der Aufruf, der am 29.08.2026 in der Store-App den TypeError warf.
    it('GET /teamer/badges liefert weiterhin ein ARRAY und .filter() geht', async () => {
      await abzeichen('Teamer-Abzeichen alt', 'teamer');

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(() => res.body.filter(b => b.earned)).not.toThrow();
      expect(res.body.filter(b => b.earned).length).toBe(0);
      expect(res.body.length).toBe(1);
    });

    it('GET /teamer/badges schickt die Zaehler weiterhin als Kopfzeilen', async () => {
      await abzeichen('Sichtbar alt', 'teamer');
      await abzeichen('Geheim alt', 'teamer', { is_hidden: true });

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-badges-visible-total']).toBe('1');
      expect(res.headers['x-badges-secret-total']).toBe('1');
    });

    it('GET /konfi/badges behaelt die Form { available, earned, stats }', async () => {
      await abzeichen('Konfi-Abzeichen alt', 'konfi');

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(false);
      expect(Array.isArray(res.body.available)).toBe(true);
      expect(Array.isArray(res.body.earned)).toBe(true);
      expect(typeof res.body.stats.totalVisible).toBe('number');
      expect(typeof res.body.stats.totalSecret).toBe('number');
    });

    // Die Verwaltungsfelder sind in der ALTEN Antwort noch da — sonst waere
    // die Route eben doch veraendert worden.
    it('Die alten Routen tragen die Verwaltungsfelder NOCH', async () => {
      const konfiId = await abzeichen('Feldtest Konfi', 'konfi');
      await abzeichen('Feldtest Teamer', 'teamer');

      const konfiRes = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const konfiBadge = konfiRes.body.available.find(b => b.id === konfiId);
      expect(konfiBadge).not.toBeUndefined();
      for (const feld of GESTRICHENE_FELDER) {
        expect(Object.prototype.hasOwnProperty.call(konfiBadge, feld)).toBe(true);
      }

      const teamerRes = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);
      const teamerBadge = teamerRes.body[0];
      for (const feld of GESTRICHENE_FELDER) {
        expect(Object.prototype.hasOwnProperty.call(teamerBadge, feld)).toBe(true);
      }
    });
  });

  // ==================================================================
  // 2. v2 LIEFERT FUER BEIDE ROLLEN DIESELBE HUELLE
  // ==================================================================
  describe('v2 hat eine gemeinsame Huelle', () => {
    it('Konfi und Teamer bekommen exakt dieselben Schluessel', async () => {
      const konfiId = await abzeichen('Konfi v2', 'konfi');
      const teamerId = await abzeichen('Teamer v2', 'teamer');

      const konfiRes = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(konfiRes.status).toBe(200);
      expect(teamerRes.status).toBe(200);

      expect(Object.keys(konfiRes.body).sort()).toEqual(['available', 'earned', 'stats']);
      expect(Object.keys(teamerRes.body).sort()).toEqual(['available', 'earned', 'stats']);
      expect(Object.keys(konfiRes.body.stats).sort()).toEqual(['totalSecret', 'totalVisible']);
      expect(Object.keys(teamerRes.body.stats).sort()).toEqual(['totalSecret', 'totalVisible']);

      // Und je Abzeichen dieselben Feldnamen. Gezielt ueber die id, weil der
      // Seed bereits Konfi-Abzeichen mitbringt.
      //
      // EINE begruendete Ausnahme: `seen` fuehrt nur der Konfi-Pfad. Die
      // Konfi-Seite markiert Abzeichen nur dann als gesehen, wenn wirklich
      // ungesehene dabei sind, und braucht das Feld dafuer; die Teamer-Seite
      // markiert pauschal beim Oeffnen und hat es noch nie gehabt. Ein
      // erfundenes seen fuer Teamer waere eine Luege in den Daten. Ausser
      // diesem Feld muessen die Huellen deckungsgleich sein.
      const konfiBadge = konfiRes.body.available.find(b => b.id === konfiId);
      const teamerBadge = teamerRes.body.available.find(b => b.id === teamerId);
      expect(konfiBadge).not.toBeUndefined();
      expect(teamerBadge).not.toBeUndefined();

      const ohneSeen = (o) => Object.keys(o).filter(k => k !== 'seen').sort();
      expect(ohneSeen(konfiBadge)).toEqual(ohneSeen(teamerBadge));
      expect(Object.prototype.hasOwnProperty.call(konfiBadge, 'seen')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(teamerBadge, 'seen')).toBe(false);
    });

    it('v2 zaehlt die Kopfzeilen NICHT mehr mit, die Zahlen stehen im Rumpf', async () => {
      await abzeichen('Sichtbar v2', 'teamer');
      await abzeichen('Geheim v2', 'teamer', { is_hidden: true });

      const res = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-badges-visible-total']).toBeUndefined();
      expect(res.headers['x-badges-secret-total']).toBeUndefined();
      expect(res.body.stats.totalVisible).toBe(1);
      expect(res.body.stats.totalSecret).toBe(1);
    });

    it('Unverdiente geheime Abzeichen bleiben auch in v2 zurueckgehalten', async () => {
      await abzeichen('Streng geheim v2', 'teamer', { is_hidden: true });

      const res = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.available.length).toBe(0);
      expect(res.body.earned.length).toBe(0);
      expect(JSON.stringify(res.body)).not.toContain('Streng geheim v2');
      // Gezaehlt wird es aber, damit "x Geheimnisse" stimmt.
      expect(res.body.stats.totalSecret).toBe(1);
    });

    it('Ein verdientes geheimes Abzeichen kommt in v2 mit', async () => {
      const id = await abzeichen('Schon entdeckt v2', 'teamer', { is_hidden: true });
      await verleihen(USERS.teamer1.id, id);

      const res = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.earned.map(b => b.id)).toContain(id);
      expect(res.body.earned.find(b => b.id === id).earned).toBe(true);
    });
  });

  // ==================================================================
  // 3. DER FELD-BALLAST IST IN v2 WEG — UND NUR DA
  // ==================================================================
  describe('Gestrichene Felder', () => {
    it('v2 schickt die Verwaltungsfelder NICHT mehr (Konfi und Teamer)', async () => {
      const konfiId = await abzeichen('Ballast Konfi', 'konfi');
      const teamerId = await abzeichen('Ballast Teamer', 'teamer');

      const konfiRes = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      const konfiBadge = konfiRes.body.available.find(b => b.id === konfiId);
      const teamerBadge = teamerRes.body.available.find(b => b.id === teamerId);
      expect(konfiBadge).not.toBeUndefined();
      expect(teamerBadge).not.toBeUndefined();
      for (const feld of GESTRICHENE_FELDER) {
        expect(Object.prototype.hasOwnProperty.call(konfiBadge, feld)).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(teamerBadge, feld)).toBe(false);
      }
    });

    // Die Gegenprobe zum Streichen: Was die Ansichten LESEN, muss da sein.
    // sort_order stand faelschlich auf der Streichliste — DashboardView.tsx
    // sortiert die Abzeichen-Kreise der Startseite danach.
    it('v2 traegt alle Felder, die die Ansichten lesen', async () => {
      // Der Seed bringt bereits Konfi-Abzeichen mit — deshalb gezielt ueber
      // die id suchen statt available[0] zu nehmen.
      const konfiId = await abzeichen('Pflichtfelder Konfi', 'konfi', { sort_order: 42 });
      const teamerId = await abzeichen('Pflichtfelder Teamer', 'teamer', { sort_order: 43 });

      const konfiRes = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);
      const teamerRes = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      const konfiBadge = konfiRes.body.available.find(b => b.id === konfiId);
      const teamerBadge = teamerRes.body.available.find(b => b.id === teamerId);
      expect(konfiBadge).not.toBeUndefined();
      expect(teamerBadge).not.toBeUndefined();

      for (const feld of PFLICHTFELDER) {
        expect(Object.prototype.hasOwnProperty.call(konfiBadge, feld)).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(teamerBadge, feld)).toBe(true);
      }
      // sort_order muss den echten Wert tragen — DashboardView.tsx sortiert
      // die Abzeichen-Kreise der Startseite danach.
      expect(konfiBadge.sort_order).toBe(42);
      expect(teamerBadge.sort_order).toBe(43);
    });

    // `seen` bleibt in v2 — nachgeprueft am Frontend: Die Konfi-Seite
    // markiert nur dann als gesehen, wenn wirklich ungesehene Abzeichen dabei
    // sind (`earned.filter(b => !b.seen)`). Faellt das Feld weg, gilt jedes
    // Abzeichen als ungesehen und bei JEDEM Laden ginge ein mark-seen raus —
    // genau die Dopplung, die am 24.08.2026 abgestellt wurde.
    it('v2 behaelt seen beim Konfi (sonst markiert die Seite bei jedem Laden)', async () => {
      const id = await abzeichen('Seen-Feld', 'konfi', { criteria_value: 1 });
      await verleihen(USERS.konfi1.id, id);
      await db.query('UPDATE user_badges SET seen = false WHERE user_id = $1', [USERS.konfi1.id]);

      const res = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = res.body.earned.find(b => b.id === id);
      expect(badge).not.toBeUndefined();
      expect(badge.seen).toBe(false);

      await request(app)
        .post('/api/konfi/badges/mark-seen')
        .set('Authorization', `Bearer ${konfiToken}`);

      const danach = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(danach.body.earned.find(b => b.id === id).seen).toBe(true);
    });
  });

  // ==================================================================
  // 4. ALT UND NEU LIEFERN DENSELBEN INHALT
  //    Der Test gegen das Auseinanderlaufen.
  // ==================================================================
  describe('Alt und neu bleiben deckungsgleich', () => {
    it('Teamer: dieselben Abzeichen und dieselben Zaehler in beiden Routen', async () => {
      const verdient = await abzeichen('Teamer verdient', 'teamer', { criteria_value: 1 });
      await verleihen(USERS.teamer1.id, verdient);
      await abzeichen('Teamer offen', 'teamer');
      await abzeichen('Teamer geheim', 'teamer', { is_hidden: true });

      const alt = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);
      const neu = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(alt.status).toBe(200);
      expect(neu.status).toBe(200);

      // Dieselbe Menge Abzeichen: die alte Route liefert eine flache Liste,
      // die neue zwei Listen — zusammengelegt muessen es dieselben ids sein.
      const altIds = alt.body.map(b => b.id).sort((a, b) => a - b);
      const neuIds = [...neu.body.earned, ...neu.body.available].map(b => b.id).sort((a, b) => a - b);
      expect(neuIds).toEqual(altIds);

      // Dieselben Zaehler, nur an anderer Stelle.
      expect(String(neu.body.stats.totalVisible)).toBe(alt.headers['x-badges-visible-total']);
      expect(String(neu.body.stats.totalSecret)).toBe(alt.headers['x-badges-secret-total']);
      expect(neu.body.stats.totalVisible).toBe(2);
      expect(neu.body.stats.totalSecret).toBe(1);

      // Und derselbe earned-Status je Abzeichen.
      expect(neu.body.earned.map(b => b.id)).toEqual([verdient]);
      expect(alt.body.filter(b => b.earned).map(b => b.id)).toEqual([verdient]);
    });

    it('Teamer: derselbe Fortschritt je Abzeichen in beiden Routen', async () => {
      await abzeichen('Fortschritt', 'teamer', { criteria_type: 'teamer_year', criteria_value: 5 });

      const alt = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);
      const neu = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamerToken}`);

      const altBadge = alt.body[0];
      const neuBadge = neu.body.available[0];
      expect(neuBadge.id).toBe(altBadge.id);
      expect(neuBadge.progress).toEqual(altBadge.progress);
      expect(neuBadge.progress.target).toBe(5);
    });

    it('Konfi: dieselben Abzeichen und Zaehler in beiden Routen', async () => {
      const verdient = await abzeichen('Konfi verdient', 'konfi', { criteria_value: 1 });
      await verleihen(USERS.konfi1.id, verdient);
      await abzeichen('Konfi offen', 'konfi');
      await abzeichen('Konfi geheim', 'konfi', { is_hidden: true });

      const alt = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const neu = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(alt.status).toBe(200);
      expect(neu.status).toBe(200);

      expect(neu.body.available.map(b => b.id)).toEqual(alt.body.available.map(b => b.id));
      expect(neu.body.earned.map(b => b.id)).toEqual(alt.body.earned.map(b => b.id));
      expect(neu.body.stats).toEqual(alt.body.stats);
      expect(neu.body.earned.map(b => b.id)).toEqual([verdient]);
    });
  });

  // ==================================================================
  // 5. BERECHTIGUNGEN UNVERAENDERT
  // ==================================================================
  describe('Berechtigungen', () => {
    it('Konfi bekommt auf der Teamer-v2-Route 403', async () => {
      const res = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(403);
    });

    it('Admin bekommt auf der Teamer-v2-Route 403 (wie bei der alten Route)', async () => {
      const alt = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${adminToken}`);
      const neu = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(alt.status).toBe(403);
      expect(neu.status).toBe(403);
    });

    it('Admin bekommt auf der Konfi-v2-Route 403', async () => {
      const res = await request(app)
        .get('/api/konfi/badges/v2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('Ohne Token 401', async () => {
      const konfiRes = await request(app).get('/api/konfi/badges/v2');
      const teamerRes = await request(app).get('/api/teamer/badges/v2');
      expect(konfiRes.status).toBe(401);
      expect(teamerRes.status).toBe(401);
    });

    // Fremde Organisation: teamer2 gehoert zu Org 2 und darf die Abzeichen
    // von Org 1 nicht sehen — auch nicht ueber die neue Route.
    it('Teamer einer anderen Organisation sieht die fremden Abzeichen nicht', async () => {
      await abzeichen('Nur Org 1', 'teamer');

      const res = await request(app)
        .get('/api/teamer/badges/v2')
        .set('Authorization', `Bearer ${teamer2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.available.length).toBe(0);
      expect(res.body.earned.length).toBe(0);
      expect(res.body.stats.totalVisible).toBe(0);
      expect(JSON.stringify(res.body)).not.toContain('Nur Org 1');
    });
  });

  // ==================================================================
  // 6. mark-seen: die Asymmetrie POST/PUT ist in v2 aufgeloest
  // ==================================================================
  describe('mark-seen', () => {
    it('Teamer kann per POST markieren (v2) — wie der Konfi seit jeher', async () => {
      const id = await abzeichen('Gesehen-Test', 'teamer', { criteria_value: 1 });
      await verleihen(USERS.teamer1.id, id);
      await db.query('UPDATE user_badges SET seen = false WHERE user_id = $1', [USERS.teamer1.id]);

      const res = await request(app)
        .post('/api/teamer/badges/mark-seen')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query(
        'SELECT seen FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.teamer1.id, id]
      );
      expect(rows[0].seen).toBe(true);
    });

    it('Das alte PUT wirkt unveraendert weiter', async () => {
      const id = await abzeichen('Gesehen-Test PUT', 'teamer', { criteria_value: 1 });
      await verleihen(USERS.teamer1.id, id);
      await db.query('UPDATE user_badges SET seen = false WHERE user_id = $1', [USERS.teamer1.id]);

      const res = await request(app)
        .put('/api/teamer/badges/mark-seen')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query(
        'SELECT seen FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.teamer1.id, id]
      );
      expect(rows[0].seen).toBe(true);
    });

    it('Konfi bekommt auf dem Teamer-POST 403', async () => {
      const res = await request(app)
        .post('/api/teamer/badges/mark-seen')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(403);
    });
  });
});
