const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Users Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let orgAdmin2Token;
  let superAdminToken;
  let adminToken;
  let admin2Token;
  let teamerToken;
  let konfiToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    orgAdmin2Token = generateToken('orgAdmin2');
    superAdminToken = generateToken('superAdmin');
    adminToken = generateToken('admin1');
    admin2Token = generateToken('admin2');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/users
  // ================================================================
  describe('GET /api/admin/users', () => {
    it('OrgAdmin bekommt 200 + User-Liste der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Route filtert konfi und super_admin heraus
      const roleNames = res.body.map(u => u.role_name);
      expect(roleNames).not.toContain('konfi');
      expect(roleNames).not.toContain('super_admin');
    });

    // Bis 26.08.2026 stand hier 403. Seit der Entscheidung, dass Admins
    // Teamer:innen verwalten duerfen, brauchen sie auch die Liste.
    it('Admin sieht die Liste -> 200', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/admin/users/:id
  // ================================================================
  describe('GET /api/admin/users/:id', () => {
    it('OrgAdmin bekommt 200 + User-Details', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.admin1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(USERS.admin1.id);
      expect(res.body.username).toBe(USERS.admin1.username);
      expect(res.body.assigned_jahrgaenge).toBeDefined();
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .get('/api/admin/users/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/users
  // ================================================================
  describe('POST /api/admin/users', () => {
    it('OrgAdmin erstellt User -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          username: 'neuer.teamer',
          display_name: 'Neuer Teamer',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.username).toBe('neuer.teamer');
    });

    it('Neu erstellte Teamerin steht SOFORT im Team-Chat (Inline-Sync statt TTL)', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          username: 'sofort.im.chat',
          display_name: 'Sofort Im Chat',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });
      expect(res.status).toBe(201);
      const newUserId = res.body.id;

      // Der Sync läuft im Handler NACH res.json (fire-and-forget) -> kurz pollen.
      const findParticipant = async () => {
        const { rows } = await db.query(
          `SELECT cp.user_type FROM chat_participants cp
           JOIN chat_rooms cr ON cp.room_id = cr.id
           WHERE cr.is_team_chat = true AND cr.organization_id = $1 AND cp.user_id = $2`,
          [ORGS.testGemeinde.id, newUserId]
        );
        return rows[0];
      };
      let participant;
      const start = Date.now();
      while (!participant && Date.now() - start < 1500) {
        participant = await findParticipant();
        if (!participant) await new Promise(r => setTimeout(r, 25));
      }
      expect(participant).toBeDefined();
      expect(participant.user_type).toBe('teamer');
    });

    // Frueher 400: Ein fehlender Benutzername war ein Validierungsfehler.
    // Seit 23.08.2026 wird er aus dem Anzeigenamen gebildet — wie bei Konfis.
    // Die Erwartung war damit ueberholt, nicht der Code.
    it('Fehlender username wird aus dem Anzeigenamen gebildet -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          display_name: 'Ohne Username',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);
      const { rows } = await db.query('SELECT username FROM users WHERE id = $1', [res.body.id]);
      expect(rows[0].username).toBe('ohne.username');
    });

    it('Fehlender Anzeigename -> 400 (daraus liesse sich kein Name bilden)', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(400);
    });

    it('Duplikat-Username -> 409', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          username: USERS.admin1.username, // existiert bereits
          display_name: 'Duplikat',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(409);
    });

    // Bis 26.08.2026 stand hier 403 -- die Rolle 'admin' durfte gar niemanden
    // anlegen. Seit der Entscheidung darf sie Teamer:innen anlegen; die
    // Rollen-Hierarchie bleibt die Grenze (siehe eigener describe-Block unten).
    it('Admin legt eine Teamerin an -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'admin.erstellt',
          display_name: 'Von Admin',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);
    });
  });

  // ================================================================
  // PUT /api/admin/users/:id
  // ================================================================
  // Benutzername aus dem Anzeigenamen erzeugen, wenn keiner mitkommt — wie
  // bei Konfis. Das Teamer-Anlegen-Modal fragt ihn deshalb nicht mehr ab
  // (Nutzerwunsch 23.08.2026).
  // Entscheidung 26.08.2026: Die Rolle 'admin' soll Teamer:innen anlegen
  // duerfen. Die Oberflaeche bot den Plus-Button laengst an
  // (AdminKonfisPage), das Backend stand auf requireOrgAdmin und antwortete
  // mit 403 -- nach ausgefuelltem Formular.
  // Die Rollen-Hierarchie bleibt die Grenze: 'admin' darf laut
  // roleHierarchy.js nur teamer und konfi verwalten, nie org_admin oder
  // weitere Admins. Das gilt fuer Anlegen, Bearbeiten UND Loeschen
  // (Entscheidung 26.08.2026: auch Admins duerfen Teamer:innen loeschen).
  describe('POST /api/admin/users — Rolle admin darf Teamer:innen anlegen', () => {
    it('Admin legt eine Teamerin an -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'vom.admin.angelegt',
          display_name: 'Vom Admin Angelegt',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);
      expect(res.body.username).toBe('vom.admin.angelegt');

      const { rows: [angelegt] } = await db.query(
        'SELECT role_id FROM users WHERE id = $1', [res.body.id]
      );
      expect(angelegt.role_id).toBe(ROLES.teamer.id);
    });

    it('Admin darf KEINEN weiteren Admin anlegen -> 403', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'zweiter.admin',
          display_name: 'Zweiter Admin',
          password: 'Sicher!123',
          role_id: ROLES.admin.id
        });

      expect(res.status).toBe(403);

      const { rows: [gezaehlt] } = await db.query(
        "SELECT count(*)::int c FROM users WHERE username = 'zweiter.admin'"
      );
      expect(gezaehlt.c).toBe(0);
    });

    it('Admin darf KEINEN Org-Admin anlegen -> 403', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'neuer.orgadmin',
          display_name: 'Neuer Org-Admin',
          password: 'Sicher!123',
          role_id: ROLES.orgAdmin.id
        });

      expect(res.status).toBe(403);
    });

    it('Teamer:in darf weiterhin niemanden anlegen -> 403', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          username: 'vom.teamer',
          display_name: 'Vom Teamer',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(403);
    });

    it('Admin loescht eine Teamerin -> 200', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const { rows: [weg] } = await db.query(
        'SELECT count(*)::int c FROM users WHERE id = $1', [USERS.teamer1.id]
      );
      expect(weg.c).toBe(0);
    });

    it('Admin darf einen Org-Admin NICHT loeschen -> 403', async () => {
      // Die Rollen-Hierarchie bleibt die Grenze, auch beim Loeschen.
      const res = await request(app)
        .delete(`/api/admin/users/${USERS.orgAdmin1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);

      const { rows: [nochDa] } = await db.query(
        'SELECT count(*)::int c FROM users WHERE id = $1', [USERS.orgAdmin1.id]
      );
      expect(nochDa.c).toBe(1);
    });

    it('Admin sieht die Benutzerliste -> 200', async () => {
      // Wer anlegen darf, muss die Liste sehen koennen.
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/admin/users — Benutzername automatisch', () => {
    it('erzeugt den Benutzernamen aus dem Anzeigenamen', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          display_name: 'Anna Musterfrau',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);

      const { rows } = await db.query('SELECT username FROM users WHERE id = $1', [res.body.id]);
      expect(rows[0].username).toBe('anna.musterfrau');
    });

    it('zaehlt bei belegtem Namen hoch statt zu scheitern', async () => {
      const daten = {
        display_name: 'Doppel Name',
        password: 'Sicher!123',
        role_id: ROLES.teamer.id
      };

      const erste = await request(app).post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`).send(daten);
      const zweite = await request(app).post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`).send(daten);

      expect(erste.status).toBe(201);
      expect(zweite.status).toBe(201);

      const { rows } = await db.query(
        'SELECT username FROM users WHERE id = ANY($1::int[]) ORDER BY id',
        [[erste.body.id, zweite.body.id]]
      );
      expect(rows[0].username).toBe('doppel.name');
      expect(rows[1].username).toBe('doppel.name2');
    });

    it('ein mitgeschickter Benutzername wird weiterhin verwendet', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          username: 'eigener.name',
          display_name: 'Egal Wie',
          password: 'Sicher!123',
          role_id: ROLES.teamer.id
        });

      expect(res.status).toBe(201);
      const { rows } = await db.query('SELECT username FROM users WHERE id = $1', [res.body.id]);
      expect(rows[0].username).toBe('eigener.name');
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('OrgAdmin aktualisiert User -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ display_name: 'Aktualisierter Teamer' });

      expect(res.status).toBe(200);
    });

    // Das optionale password-Feld wurde ungeprueft gehasht — weder über den
    // Validator noch inline. Beim Anlegen gilt die Policy laengst, über den
    // Bearbeiten-Weg liess sie sich umgehen (Audit 22.08.2026, LÜCKE N7).
    it('schwaches Passwort beim Bearbeiten wird abgelehnt -> 400', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'kurz' });

      expect(res.status).toBe(400);
    });

    it('Passwort ohne Sonderzeichen beim Bearbeiten wird abgelehnt -> 400', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'Langgenug123' });

      expect(res.status).toBe(400);
    });

    it('starkes Passwort beim Bearbeiten wird uebernommen -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'Wirklich!Stark123' });

      expect(res.status).toBe(200);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .put('/api/admin/users/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ display_name: 'Nichtexistent' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/users/:id
  // ================================================================
  describe('DELETE /api/admin/users/:id', () => {
    it('OrgAdmin loescht User -> 200', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
    });

    // Befund 26.08.2026: Die users.js-Kaskade sammelte Nachweisfotos und
    // Challenge-Dateien ein, Chat-Anhaenge aber nicht — die blieben nach der
    // Löschung dauerhaft auf der Platte (DSGVO Art. 17).
    it('Chat-Anhang des gelöschten Users wird von der Platte entfernt', async () => {
      const CHAT_DIR = path.join(__dirname, '..', '..', 'uploads', 'chat');
      fs.mkdirSync(CHAT_DIR, { recursive: true });
      const fileName = 'deadbeefuserdelete01';
      fs.writeFileSync(path.join(CHAT_DIR, fileName), 'testinhalt');
      // teamer1 ist Teilnehmer in Raum 3 (Teamer-Gruppe)
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, file_path, file_name)
         VALUES (3, $1, 'teamer', 'Datei', $2, 'bild.png')`,
        [USERS.teamer1.id, fileName]
      );

      expect(fs.existsSync(path.join(CHAT_DIR, fileName))).toBe(true);

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM chat_messages WHERE user_id = $1', [USERS.teamer1.id]);
      expect(rows).toHaveLength(0);
      expect(fs.existsSync(path.join(CHAT_DIR, fileName))).toBe(false);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .delete('/api/admin/users/9999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Selbstloeschung verboten -> 400', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${USERS.orgAdmin1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('eigenes Konto');
    });

    it('User MIT Konfi-History (Badge/Aktivitaet/Bonus/Antrag) loeschen -> 200, History mit weg', async () => {
      // Regression: Diese 4 Tabellen tragen aus der SQLite-Altlast einen zweiten
      // NO-ACTION-FK auf users(id). Ohne explizites Aufräumen im Delete-Handler
      // blockierte der FK das Löschen mit 500 "Datenbankfehler" (z.B. Ex-Konfi,
      // der zum Teamer befoerdert wurde und noch Anträge/Badges hatte).
      const konfiId = USERS.konfi1.id;
      await db.query(
        "INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id) VALUES ($1, 1, CURRENT_DATE, 1)",
        [konfiId]
      );
      await db.query(
        "INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id) VALUES ($1, 1, $2, 1)",
        [konfiId, USERS.admin1.id]
      );
      await db.query(
        "INSERT INTO activity_requests (user_id, activity_id, organization_id) VALUES ($1, 1, 1)",
        [konfiId]
      );
      // bonus_points für Konfis legt bereits der Seed an.

      const res = await request(app)
        .delete(`/api/admin/users/${konfiId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);

      // History des geloeschten Users muss ebenfalls entfernt sein.
      for (const tbl of ['user_badges', 'user_activities', 'activity_requests', 'bonus_points']) {
        const col = tbl === 'bonus_points' ? 'konfi_id' : 'user_id';
        const { rows } = await db.query(`SELECT COUNT(*)::int AS c FROM ${tbl} WHERE ${col} = $1`, [konfiId]);
        expect(rows[0].c).toBe(0);
      }
    });

    // Befund 24.08.2026, gegen Produktion nachgewiesen: Der Fremdschlüssel
    // user_certificates.user_id hat kein ON DELETE, und aufgeraeumt wurde nur
    // admin_id — also die verleihende, nicht die empfangende Seite. Wer je eine
    // Urkunde bekommen hatte, liess sich damit gar nicht mehr löschen.
    it('Wer eine Urkunde bekommen hat, laesst sich trotzdem loeschen', async () => {
      const { rows: [typ] } = await db.query(
        `INSERT INTO certificate_types (name, organization_id) VALUES ('Konfi-Teamer:in', $1) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, admin_id, organization_id, issued_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
        [USERS.teamer1.id, typ.id, USERS.admin1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_certificates WHERE user_id = $1',
        [USERS.teamer1.id]
      );
      expect(rows[0].c).toBe(0);
    });

    it('Die Urkunden anderer bleiben erhalten, nur die verleihende Person wird anonymisiert', async () => {
      const { rows: [typ] } = await db.query(
        `INSERT INTO certificate_types (name, organization_id) VALUES ('Ehrenamt', $1) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      // teamer1 hat diese Urkunde VERLIEHEN, konfi1 sie bekommen.
      await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, admin_id, organization_id, issued_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
        [USERS.konfi1.id, typ.id, USERS.teamer1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT admin_id FROM user_certificates WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].admin_id).toBeNull();
    });

    // Der Fix vom 22.08.2026 lag nur in konfiDeletion.js (Selbstloeschung) und
    // war nie in diese Route übertragen: Wer als Teamer:in einen Termin
    // angelegt oder jemandem einen Jahrgang zugewiesen hatte, war für die
    // Leitung unlöschbar.
    it('Wer Termine angelegt und Jahrgaenge zugewiesen hat, laesst sich loeschen', async () => {
      const zukunft = new Date();
      zukunft.setDate(zukunft.getDate() + 7);
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, created_by)
         VALUES ('Von Teamer1 angelegt', $1, $2, $3) RETURNING id`,
        [zukunft.toISOString(), ORGS.testGemeinde.id, USERS.teamer1.id]
      );
      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, created_by)
         VALUES ('Von Teamer1', 'total_points', 5, $1, $2)`,
        [ORGS.testGemeinde.id, USERS.teamer1.id]
      );
      await db.query(
        'UPDATE user_jahrgang_assignments SET assigned_by = $1 WHERE user_id = $2',
        [USERS.teamer1.id, USERS.konfi1.id]
      );

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);

      // Der Termin bleibt bestehen, nur die Urheberschaft ist anonymisiert.
      const { rows: evRows } = await db.query('SELECT created_by FROM events WHERE id = $1', [event.id]);
      expect(evRows.length).toBe(1);
      expect(evRows[0].created_by).toBeNull();

      const { rows: zuwRows } = await db.query(
        'SELECT assigned_by FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(zuwRows.length).toBe(1);
      expect(zuwRows[0].assigned_by).toBeNull();
    });
  });

  // ================================================================
  // POST /api/admin/users/:id/jahrgaenge
  // ================================================================
  describe('POST /api/admin/users/:id/jahrgaenge', () => {
    it('OrgAdmin weist Jahrgaenge zu -> 200', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.admin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: true }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.assignments_count).toBe(1);
    });

    it('Leere Zuweisung entfernt alle Jahrgaenge -> 200', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(200);
      expect(res.body.assignments_count).toBe(0);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .post('/api/admin/users/9999/jahrgaenge')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(404);
    });

    // Entscheidung 31.08.2026: Wer Teamer:innen anlegen darf, muss ihnen auch
    // Jahrgaenge geben koennen. Die Rollen-Hierarchie bleibt die Grenze —
    // deshalb hier immer der erlaubte UND der verbotene Fall.
    it('Admin setzt Jahrgaenge einer TEAMERIN -> 200', async () => {
      // Seit 31.08.2026 ist ein Admin an seine eigenen Jahrgaenge gebunden:
      // ohne diese Zuweisung waere jahrgang1 fuer ihn ein fremder Jahrgang.
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
      );
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: true }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.assignments_count).toBe(1);

      const { rows } = await db.query(
        'SELECT jahrgang_id, can_edit, assigned_by FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.teamer1.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].jahrgang_id).toBe(JAHRGAENGE.jahrgang1.id);
      expect(rows[0].can_edit).toBe(true);
      expect(rows[0].assigned_by).toBe(USERS.admin1.id);
    });

    it('Admin darf Jahrgaenge eines ZWEITEN Admins NICHT setzen -> 403', async () => {
      // Ein zweiter Admin derselben Organisation — der Fall, den ein blosses
      // requireAdmin (ohne Hierarchie-Pruefung) durchgelassen haette.
      const { rows: [zweiter] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
         VALUES ('zweiter.admin.seed', 'Zweiter Admin', 'x', $1, $2, true) RETURNING id`,
        [ROLES.admin.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .post(`/api/admin/users/${zweiter.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: true }
          ]
        });

      expect(res.status).toBe(403);

      const { rows: [gezaehlt] } = await db.query(
        'SELECT count(*)::int c FROM user_jahrgang_assignments WHERE user_id = $1',
        [zweiter.id]
      );
      expect(gezaehlt.c).toBe(0);
    });

    it('Admin darf Jahrgaenge eines ORG-ADMINS NICHT setzen -> 403', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.orgAdmin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: true }
          ]
        });

      expect(res.status).toBe(403);

      const { rows: [gezaehlt] } = await db.query(
        'SELECT count(*)::int c FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.orgAdmin1.id]
      );
      expect(gezaehlt.c).toBe(0);
    });

    it('Admin aus Org 1 darf Jahrgaenge einer Teamerin aus Org 2 NICHT setzen -> 404', async () => {
      // Teamer2 hat per Seed genau eine Zuweisung (jahrgang2 in Org 2). Sie
      // muss unveraendert bleiben — auch der Jahrgang darf nicht kippen.
      const { rows: vorher } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.teamer2.id]
      );
      expect(vorher.length).toBe(1);
      expect(vorher[0].jahrgang_id).toBe(JAHRGAENGE.jahrgang2.id);

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer2.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: true }
          ]
        });

      expect(res.status).toBe(404);

      const { rows: nachher } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.teamer2.id]
      );
      expect(nachher.length).toBe(1);
      expect(nachher[0].jahrgang_id).toBe(JAHRGAENGE.jahrgang2.id);
    });

    it('Admin aus Org 2 darf Jahrgaenge der Teamerin aus Org 1 NICHT setzen -> 404', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(404);
    });

    it('Teamer:in darf keine Jahrgaenge zuweisen -> 403', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(403);
    });

    it('Konfi darf keine Jahrgaenge zuweisen -> 403', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/users/me/jahrgaenge
  // ================================================================
  describe('GET /api/users/me/jahrgaenge', () => {
    it('Authentifizierter User sieht eigene Jahrgaenge -> 200', async () => {
      const res = await request(app)
        .get('/api/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Teamer1 hat jahrgang1 zugewiesen (per Seed)
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/users/me/jahrgaenge');
      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // GET /api/admin/users/:id/jahrgaenge
  // ================================================================
  describe('GET /api/admin/users/:id/jahrgaenge', () => {
    it('OrgAdmin sieht User-Jahrgaenge -> 200', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Admin sieht die Jahrgaenge einer TEAMERIN -> 200', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Teamer1 hat jahrgang1 per Seed
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(JAHRGAENGE.jahrgang1.id);
    });

    it('Admin sieht die Jahrgaenge eines ORG-ADMINS NICHT -> 403', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.orgAdmin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin sieht die Jahrgaenge eines ZWEITEN Admins NICHT -> 403', async () => {
      const { rows: [zweiter] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
         VALUES ('zweiter.admin.lesen', 'Zweiter Admin', 'x', $1, $2, true) RETURNING id`,
        [ROLES.admin.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get(`/api/admin/users/${zweiter.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin aus Org 2 sieht die Jahrgaenge der Teamerin aus Org 1 NICHT -> 404', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });

    it('Teamer:in kommt nicht an fremde Jahrgangs-Zuweisungen -> 403', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // PUT /api/admin/users/:id/reset-password
  // ================================================================
  describe('PUT /api/admin/users/:id/reset-password', () => {
    it('OrgAdmin setzt Passwort zurueck -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'Neues!Pw123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Passwort');
    });

    it('SuperAdmin setzt Passwort zurueck -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.admin1.id}/reset-password`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ password: 'Neues!Pw456' });

      expect(res.status).toBe(200);
    });

    it('org_admin MIT is_super_admin-Flag setzt Passwort eines Users aus ANDERER Org zurueck -> 200', async () => {
      // Regression: zuvor pruefte die Route role_name === 'super_admin' und
      // ignorierte das is_super_admin-Flag -> org_admin+Flag bekam faelschlich 403
      // bei org-uebergreifendem Reset. admin2 ist in Org 2, orgAdminSuper in Org 1.
      const res = await request(app)
        .put(`/api/admin/users/${USERS.admin2.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdminSuper')}`)
        .send({ password: 'Neues!Pw999' });

      expect(res.status).toBe(200);
    });

    it('Admin bekommt 403 (nur org_admin/super_admin)', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'Neues!Pw789' });

      expect(res.status).toBe(403);
    });

    it('Zu kurzes Passwort -> 400', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'kurz' });

      expect(res.status).toBe(400);
    });

    it('Nicht-existierender User -> 404', async () => {
      const res = await request(app)
        .put('/api/admin/users/9999/reset-password')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ password: 'Neues!Pw123' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Org-Isolation
  // ================================================================
  describe('Org-Isolation: OrgAdmin2 kann keine User aus Org 1 sehen/bearbeiten', () => {
    it('OrgAdmin2 sieht nur Org-2-Users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(200);
      // Keine Org-1-User enthalten
      const userIds = res.body.map(u => u.id);
      expect(userIds).not.toContain(USERS.admin1.id);
      expect(userIds).not.toContain(USERS.teamer1.id);
    });

    it('OrgAdmin2 kann User aus Org 1 nicht sehen -> 404', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.admin1.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
    });

    it('OrgAdmin2 kann User aus Org 1 nicht aktualisieren -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .send({ display_name: 'Manipuliert' });

      expect(res.status).toBe(404);
    });

    it('OrgAdmin2 Passwort-Reset fuer Org-1-User -> 403', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${USERS.teamer1.id}/reset-password`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .send({ password: 'Manipul!123' });

      expect(res.status).toBe(403);
    });
  });
  // ================================================================
  // Jahrgangs-Zuweisungen: ein Admin fasst nur seine eigenen an
  // (Simons Regel 31.08.2026)
  // ================================================================
  describe('POST /api/admin/users/:id/jahrgaenge — Bindung an die eigenen Jahrgaenge', () => {
    let jahrgangA; // der Jahrgang der Teamerin, dem Admin fremd
    let jahrgangB; // der Jahrgang des Admins

    beforeEach(async () => {
      const { rows: [a] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('2026/2027', $1, '2027-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [b] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('2029/2030', $1, '2030-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      jahrgangA = a.id;
      jahrgangB = b.id;

      // admin1 ist NUR in Jahrgang B.
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin1.id, jahrgangB]
      );
      // Die Zuweisungen haengen im rbac-Cache (30 s TTL) — ohne das Leeren
      // sieht der naechste Request den Stand des vorigen Tests.
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
    });

    const jahrgaengeVon = async (userId) => {
      const { rows } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1 ORDER BY jahrgang_id',
        [userId]
      );
      return rows.map(r => r.jahrgang_id);
    };

    it('Simons Beispiel: Admin fuegt B hinzu, die fremde Zuweisung A bleibt', async () => {
      // Ausgangslage: Teamerin in Jahrgang A (und per Seed in jahrgang1).
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
        [USERS.teamer1.id, jahrgangA]
      );
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([jahrgangA]);

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: [{ jahrgang_id: jahrgangB, can_view: true, can_edit: false }] });

      expect(res.status).toBe(200);
      // A UND B — nicht nur B.
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([jahrgangA, jahrgangB].sort((x, y) => x - y));
    });

    it('Admin entfernt seinen EIGENEN Jahrgang wieder, der fremde bleibt', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false), ($1, $3, true, false)',
        [USERS.teamer1.id, jahrgangA, jahrgangB]
      );

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(200);
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([jahrgangA]);
    });

    it('Admin darf einen FREMDEN Jahrgang nicht zuweisen -> 403, nichts geaendert', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
        [USERS.teamer1.id, jahrgangB]
      );

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: [{ jahrgang_id: jahrgangA, can_view: true, can_edit: false }] });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Jahrgang');
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([jahrgangB]);
    });

    it('OrgAdmin ersetzt weiterhin ALLE Zuweisungen -> 200', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false), ($1, $3, true, false)',
        [USERS.teamer1.id, jahrgangA, jahrgangB]
      );

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: [{ jahrgang_id: jahrgangA, can_view: true, can_edit: true }] });

      expect(res.status).toBe(200);
      expect(res.body.assignments_count).toBe(1);
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([jahrgangA]);
    });

    it('OrgAdmin raeumt alle Zuweisungen ab -> 200 und die Liste ist leer', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: [] });

      expect(res.status).toBe(200);
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([]);
    });

    it('Derselbe Jahrgang doppelt geschickt -> 400, nicht 500', async () => {
      // Die Tabelle hat UNIQUE (user_id, jahrgang_id). Ein doppelter Eintrag
      // muss sauber mit 400 abgewiesen werden und darf nicht am Index in
      // einen 500er laufen.
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          jahrgang_assignments: [
            { jahrgang_id: jahrgangA, can_view: true, can_edit: false },
            { jahrgang_id: jahrgangA, can_view: true, can_edit: false }
          ]
        });

      expect(res.status).toBe(400);
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([JAHRGAENGE.jahrgang1.id]);
    });

    it('Admin aus Org 2 kommt an einen Jahrgang aus Org 1 nicht heran -> 404', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ jahrgang_assignments: [{ jahrgang_id: jahrgangB, can_view: true, can_edit: false }] });

      expect(res.status).toBe(404);
      expect(await jahrgaengeVon(USERS.teamer1.id)).toEqual([JAHRGAENGE.jahrgang1.id]);
    });
  });

  // ==================================================================
  // Jahrgangs-Zuweisung: Hierarchie (31.08.2026)
  //
  // Anlass PR #148 (Ron31): Die Routen wurden von requireOrgAdmin auf
  // requireAdmin gesenkt, damit ein Admin einer neu angelegten Teamer:in
  // Jahrgaenge mitgeben kann. Der PR wies selbst darauf hin, dass
  // requireAdmin ALLEIN nicht prueft, WEN man da bearbeitet -- ein Admin
  // haette damit die Jahrgangs-Rechte anderer Admins und sogar von
  // Org-Admins aendern koennen.
  //
  // userHierarchyMiddleware zieht dieselbe Grenze wie bei create/update/
  // delete: canManageRole laesst 'admin' genau 'teamer' und 'konfi' zu.
  // ==================================================================
  describe('POST/GET /:id/jahrgaenge — Hierarchie', () => {
    const zuweisung = [{ jahrgang_id: JAHRGAENGE.jahrgang1.id, can_view: true, can_edit: false }];

    // --- erlaubt ---
    //
    // ANGEPASST beim Merge von main am 01.09.2026: Der Test stammt aus PR #148
    // und erwartete 200 auch fuer einen Admin OHNE eigenen Jahrgang. Inzwischen
    // gilt Simons Regel vom 31.08.2026 (utils/jahrgangsZugriff.js): "ein admin
    // ist bis auf bei den teamern immer an seine jahrgaenge gebunden" — er darf
    // also nur Jahrgaenge vergeben, in denen er selbst mit can_edit steht.
    // admin1 hat im Seed KEINE Zuweisung, bekam deshalb 403.
    //
    // Der Test prueft jetzt beide Seiten der Regel: mit Jahrgang erlaubt,
    // ohne Jahrgang abgewiesen. Die Rollenhierarchie aus PR #148 (ein Admin
    // fasst nur teamer/konfi an) bleibt davon unberuehrt und wird unten
    // weiterhin geprueft.
    it('Admin MIT diesem Jahrgang darf ihn einer Teamer:in zuweisen', async () => {
      await db.query(
        `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
         VALUES ($1, $2, true, true)
         ON CONFLICT DO NOTHING`,
        [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
      );
      // rbac cacht das User-Objekt samt assigned_jahrgaenge. Ohne das
      // Verwerfen wirkte die frische Zuweisung erst im naechsten Test --
      // und liess dort den 403-Fall faelschlich mit 200 durchgehen.
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: zuweisung });

      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.teamer1.id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].jahrgang_id).toBe(JAHRGAENGE.jahrgang1.id);
    });

    it('Admin OHNE diesen Jahrgang darf ihn nicht vergeben -> 403', async () => {
      // admin1 hat im Seed keine Zuweisung. Ohne diese Grenze koennte er
      // Jahrgaenge verteilen, die er selbst nie zu Gesicht bekommt.
      // Cache verwerfen, damit kein Stand aus einem frueheren Test nachwirkt.
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: zuweisung });

      expect(res.status).toBe(403);

      const { rows } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.teamer1.id]
      );
      expect(rows.map(r => r.jahrgang_id)).toEqual([JAHRGAENGE.jahrgang1.id]);
    });

    it('Admin darf die Jahrgaenge einer Teamer:in lesen', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Org-Admin darf weiterhin die Jahrgaenge eines Admins setzen', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.admin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_assignments: zuweisung });

      expect(res.status).toBe(200);
    });

    // --- verboten ---
    it('Admin darf die Jahrgaenge eines ANDEREN Admins NICHT setzen', async () => {
      const vorher = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.admin1.id]
      );

      const res = await request(app)
        .post(`/api/admin/users/${USERS.admin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: zuweisung });

      expect(res.status).toBe(403);

      // Nichts geschrieben -- die Route loescht vor dem Schreiben ALLE
      // Zuweisungen, ein durchgerutschter Aufruf waere also doppelt teuer.
      const nachher = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.admin1.id]
      );
      expect(nachher.rows).toEqual(vorher.rows);
    });

    it('Admin darf die Jahrgaenge eines ORG-ADMINS NICHT setzen', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.orgAdmin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jahrgang_assignments: zuweisung });

      expect(res.status).toBe(403);

      const { rows } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.orgAdmin1.id]
      );
      expect(rows).toHaveLength(0);
    });

    it('Admin darf die Jahrgaenge eines ANDEREN Admins NICHT lesen', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${USERS.admin1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer:in darf gar keine Jahrgaenge zuweisen', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ jahrgang_assignments: zuweisung });

      expect(res.status).toBe(403);
    });
  });
});
