// Hinweis-Header X-Kein-Jahrgang-Zugewiesen fuer Listen, die durch die
// Jahrgangs-Bindung leer werden (Nachzug 01.09.2026).
//
// Hintergrund: Ein Admin OHNE Jahrgangs-Zuweisung ist ein GUELTIGER Fall
// (Simons Entscheidung 31.08.2026: "angenommen ich will nur einen admin
// haben der mit dem teamer spricht, dann brauch ich nicht zwingend einen
// jahrgang fuer admins"). Die Listen bleiben dann leer -- aber die
// Oberflaeche muss den GRUND nennen koennen, sonst sieht die App kaputt aus.
//
// Der Server meldet den Grund als Header, NIE im Rumpf: Die Antwortform
// bleibt ein Array, ausgelieferte Apps rufen .filter() darauf und ignorieren
// unbekannte Header einfach. Dasselbe Muster wie GET /admin/konfis
// (konfi-management.js, getestet in konfi-management.test.js).
//
// Hier abgedeckt:
//   - GET /api/challenges/admin        (challenges.js)
//   - GET /api/admin/activities/requests (activities.js)
//   - GET /api/material                (material.js, Nachzug 01.09.2026)
//
// Je Route drei Faelle: ohne Zuweisung -> Header; mit Zuweisung -> KEIN
// Header; org_admin -> KEIN Header. Dazu die Gegenprobe, die den ganzen
// Sinn traegt: Eine Liste, die aus einem ANDEREN Grund leer ist (es gibt
// wirklich nichts), darf den Header nicht bekommen -- sonst erklaert die
// Oberflaeche etwas Falsches.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// IDs oberhalb des Seed-Bereichs, damit nichts kollidiert. Frische IDs sind
// hier PFLICHT: rbac.js haelt einen 30-Sekunden-User-Cache -- ein Admin, den
// eine andere Testdatei schon geladen hat, kaeme mit ALTEN Zuweisungen an
// (genau darauf ist der Test zu GET /admin/konfis beim Schreiben
// hereingefallen, siehe konfi-management.test.js).
const ADMIN_MIT_JG = 221;   // admin, jahrgang1 zugewiesen
const ADMIN_OHNE_JG = 222;  // admin, keine Zuweisung
const TEAMER_OHNE_JG = 223; // teamer, keine Zuweisung

function tokenFuer(id, roleId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Hinweis-Header X-Kein-Jahrgang-Zugewiesen (01.09.2026)', () => {
  let app;
  let db;
  let adminMitJgToken;
  let adminOhneJgToken;
  let teamerOhneJgToken;
  let orgAdminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    // Zwei frische Admins und eine frische Teamer:in in Org 1
    // (role_id 3 = admin, role_id 2 = teamer)
    for (const [id, roleId, name] of [
      [ADMIN_MIT_JG, 3, 'Admin mit Jahrgang'],
      [ADMIN_OHNE_JG, 3, 'Admin ohne Jahrgang'],
      [TEAMER_OHNE_JG, 2, 'Teamer ohne Jahrgang']
    ]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, $4, 1, true)`,
        [id, `hinweis_user_${id}`, name, roleId]
      );
    }
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [ADMIN_MIT_JG, JAHRGAENGE.jahrgang1.id]
    );

    // Der rbac-Cache (30 s TTL) ueberlebt truncateAll -- nach dem Neu-Seeden
    // muessen die frischen Zuweisungen sichtbar sein, nicht die des vorigen
    // Tests.
    const { invalidateUserCache } = require('../../middleware/rbac');
    for (const id of [ADMIN_MIT_JG, ADMIN_OHNE_JG, TEAMER_OHNE_JG, USERS.orgAdmin1.id, USERS.superAdmin.id]) {
      invalidateUserCache(id);
    }

    adminMitJgToken = tokenFuer(ADMIN_MIT_JG, 3);
    adminOhneJgToken = tokenFuer(ADMIN_OHNE_JG, 3);
    teamerOhneJgToken = tokenFuer(TEAMER_OHNE_JG, 2, 'teamer');
    orgAdminToken = generateToken('orgAdmin1');
  });

  // Laufende Challenge in jahrgang1 anlegen.
  async function challengeAnlegen() {
    const { rows: [row] } = await db.query(
      `INSERT INTO challenges
         (organization_id, title, description, challenge_type, audience, visibility, moderated,
          allowed_media, allow_multiple, badge_icon, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES (1, 'Test-Challenge', 'Beschreibung', 'frei', 'konfis_und_team', 'konfi_choice', true,
               '["photo"]'::jsonb, true, 'star', 'Stern', $1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false)
       RETURNING id`,
      [USERS.orgAdmin1.id]
    );
    await db.query(
      `INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id)
       VALUES ($1, $2)`,
      [row.id, JAHRGAENGE.jahrgang1.id]
    );
    return row.id;
  }

  // Konfi-Antrag anlegen (konfi1 liegt im Seed in jahrgang1).
  async function antragAnlegen() {
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, CURRENT_DATE, 'pending', 1)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id]
    );
  }

  // ================================================================
  // GET /api/challenges/admin
  // ================================================================
  describe('GET /api/challenges/admin', () => {
    it('Admin OHNE Zuweisung: leeres Array UND Header', async () => {
      await challengeAnlegen();

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Teamer OHNE Zuweisung bekommt den Header ebenfalls', async () => {
      // Die Route bindet admin UND teamer gleich (viewableJahrgangIds) --
      // der Grund der leeren Liste ist derselbe.
      await challengeAnlegen();

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${teamerOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Admin MIT Zuweisung: Challenge sichtbar, KEIN Header', async () => {
      await challengeAnlegen();

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Test-Challenge');
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('Admin MIT Zuweisung und ohne Challenges: leer, aber KEIN Header', async () => {
      // DIE Gegenprobe des ganzen Vorhabens: Eine Liste, die aus einem
      // anderen Grund leer ist (es gibt schlicht keine Challenges), darf
      // NICHT mit "kein Jahrgang" erklaert werden.
      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('org_admin bekommt den Header nie', async () => {
      // org_admin sieht org-weit, fuer ihn gibt es den Fall nicht -- auch
      // ganz ohne Zuweisungen (er hat im Seed keine).
      await challengeAnlegen();

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('super_admin bekommt den Header nie', async () => {
      // super_admin hat auf die Challenge-Verwaltung gar keinen Zugriff
      // (requireTeamer laesst nur org_admin/admin/teamer durch) -- er darf
      // erst recht keinen Jahrgangs-Hinweis bekommen, der Grund waere falsch.
      await challengeAnlegen();

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`);

      expect(res.status).toBe(403);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });
  });

  // ================================================================
  // GET /api/admin/activities/requests
  // ================================================================
  describe('GET /api/admin/activities/requests', () => {
    it('Admin OHNE Zuweisung: leeres Array UND Header', async () => {
      await antragAnlegen();

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Admin OHNE Zuweisung: Teamer-Antraege bleiben sichtbar, Header trotzdem gesetzt', async () => {
      // Teamer:innen sieht ein Admin alle (Simons Fall) -- deren Antraege
      // werden NICHT gefiltert. Der Header sagt trotzdem, dass Konfi-Antraege
      // wegen fehlender Zuweisung fehlen; der Hinweistext im Frontend spricht
      // deshalb nur von Konfis.
      await db.query(
        `INSERT INTO activities (id, name, points, type, organization_id, target_role)
         VALUES (321, 'Teamer-Schulung', 0, NULL, 1, 'teamer')`
      );
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
         VALUES ($1, 321, CURRENT_DATE, 'pending', 1)`,
        [USERS.teamer1.id]
      );

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].user_id).toBe(USERS.teamer1.id);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Admin MIT Zuweisung: Antrag sichtbar, KEIN Header', async () => {
      await antragAnlegen();

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].user_id).toBe(USERS.konfi1.id);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('Admin MIT Zuweisung und ohne Antraege: leer, aber KEIN Header', async () => {
      // Gegenprobe: leer aus echtem Grund -> kein Jahrgangs-Hinweis.
      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('org_admin bekommt den Header nie', async () => {
      await antragAnlegen();

      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });
  });

  // ================================================================
  // GET /api/material (Nachzug 01.09.2026)
  // ================================================================
  // Besonderheit gegenueber den Listen oben: Ohne Zuweisung ist die Liste
  // nicht zwingend LEER -- globales Material und Material ohne Jahrgang
  // bleiben sichtbar. Der Header sagt trotzdem "dir fehlt die Zuweisung"
  // (wie bei den Teamer-Antraegen oben); die Oberflaeche zeigt den Hinweis
  // nur im Leerzustand an.
  describe('GET /api/material', () => {
    // Material mit Jahrgangs-Bindung an jahrgang1 anlegen.
    async function materialMitJahrgangAnlegen() {
      const { rows: [row] } = await db.query(
        `INSERT INTO materials (organization_id, title, created_by)
         VALUES (1, 'Jahrgangs-Material', $1) RETURNING id`,
        [USERS.orgAdmin1.id]
      );
      await db.query(
        `INSERT INTO material_jahrgaenge (material_id, jahrgang_id) VALUES ($1, $2)`,
        [row.id, JAHRGAENGE.jahrgang1.id]
      );
      return row.id;
    }

    it('Admin OHNE Zuweisung: leeres Array UND Header', async () => {
      await materialMitJahrgangAnlegen();

      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Admin OHNE Zuweisung: globales Material bleibt sichtbar, Header trotzdem gesetzt', async () => {
      // Globales Material sehen alle Teamer:innen der Gemeinde -- der
      // Header sagt trotzdem, dass jahrgangsgebundenes Material wegen
      // fehlender Zuweisung fehlt. Der Hinweistext erscheint im Frontend
      // ohnehin nur, wenn die Liste leer ist.
      await materialMitJahrgangAnlegen();
      await db.query(
        `INSERT INTO materials (organization_id, title, created_by, ist_global)
         VALUES (1, 'Globales Material', $1, true)`,
        [USERS.orgAdmin1.id]
      );

      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Globales Material');
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Teamer OHNE Zuweisung bekommt den Header ebenfalls', async () => {
      // jahrgangsSchranke bindet teamer und admin gleich -- der Grund der
      // leeren Liste ist derselbe.
      await materialMitJahrgangAnlegen();

      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBe('true');
    });

    it('Admin MIT Zuweisung: Material sichtbar, KEIN Header', async () => {
      await materialMitJahrgangAnlegen();

      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Jahrgangs-Material');
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('Admin MIT Zuweisung und ohne Material: leer, aber KEIN Header', async () => {
      // Gegenprobe: Es gibt wirklich kein Material -- der Jahrgangs-Hinweis
      // waere hier falsch.
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('org_admin bekommt den Header nie', async () => {
      // org_admin sieht org-weit -- auch ganz ohne Zuweisungen (er hat im
      // Seed keine).
      await materialMitJahrgangAnlegen();

      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('super_admin bekommt den Header nie', async () => {
      // requireTeamer laesst super_admin nicht durch -- er darf erst recht
      // keinen Jahrgangs-Hinweis bekommen, der Grund waere falsch.
      await materialMitJahrgangAnlegen();

      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${generateToken('superAdmin')}`);

      expect(res.status).toBe(403);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });

    it('GET /by-event bleibt bewusst ohne Header', async () => {
      // Entscheidung 01.09.2026 (Kommentar an der Route): "kein Material an
      // diesem Termin" ist der Normalzustand einer Termin-Unterliste, der
      // Jahrgangs-Hinweis erklaerte dort meist etwas Falsches.
      const res = await request(app)
        .get('/api/material/by-event/999')
        .set('Authorization', `Bearer ${adminOhneJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(res.headers['x-kein-jahrgang-zugewiesen']).toBeUndefined();
    });
  });
});
