// Konfi ODER Team -- nie beides, auch nicht ueber Gemeindegrenzen
//
// SIMON, 28.09.2026: "Konfi und Team geht nicht parallel." Ein Konto ist
// entweder Konfi (genau eine Gemeinde, die Stamm-Gemeinde) oder Team
// (teamer, admin, org_admin -- auch in mehreren Gemeinden). Die Regel steht
// in utils/konfiOderTeam.js; hier jeder Schreibweg, der eine Rolle vergibt,
// mit dem verbotenen UND dem erlaubten Fall:
//
//  - Einladung anlegen:  Zielkonto darf nirgends Konfi sein
//  - Einladung annehmen: Konto und angebotene Rolle werden bei der Annahme
//                        erneut geprueft (Altbestand und Rollenwechsel
//                        zwischen Einladung und Annahme)
//  - Zuweisung durch den Super-Admin (POST /organizations/:id/members)
//  - Rollenwechsel in der Benutzerverwaltung, in der Stamm-Gemeinde und in
//    einer weiteren Gemeinde
//  - Befoerderung und Rollenwechsel ziehen die Zeile der Stamm-Gemeinde in
//    user_organizations mit (Altbestand aus Migration 101)
//  - Registrierung mit Einladungscode: legt immer ein NEUES Konto an
//
// Die Tabelle "Rolle je Gemeinde" im Audit Punkte/Termine (in der Historie,
// docs/README.md#befundkennungen) nennt, was die Regel erledigt; was offen
// ist, steht in docs/planung/mehrfach-konten.md.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');
const PushService = require('../../services/pushService');
const { warteAufNachwehen } = require('../../utils/nachAntwort');
const { pruefeKonfiOderTeam } = require('../../utils/konfiOderTeam');

// Eine dritte Gemeinde fuer den Altbestand: Konfi dort, Team anderswo.
const ORG3 = 3;
const KONFI_ROLLE_ORG3 = 301;
const TEAMER_ROLLE_ORG3 = 302;

describe('Konfi oder Team -- nie beides', () => {
  let app;
  let db;

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
    await db.query(
      `INSERT INTO organizations (id, name, slug, display_name, is_active)
       VALUES ($1, 'Dritte Gemeinde', 'dritte-gemeinde', 'Dritte Gemeinde', true)`,
      [ORG3]
    );
    await db.query(
      `INSERT INTO roles (id, name, display_name, organization_id)
       VALUES ($1, 'konfi', 'Konfi', $3), ($2, 'teamer', 'Teamer:in', $3)`,
      [KONFI_ROLLE_ORG3, TEAMER_ROLLE_ORG3, ORG3]
    );
    vi.spyOn(emailService, 'sendGemeindeEinladungEmail').mockReset().mockResolvedValue({ success: true });
    vi.spyOn(PushService, 'sendGemeindeEinladungToUser').mockReset().mockResolvedValue({ success: true });
    vi.spyOn(PushService, 'sendEinladungBeantwortetToLeitung').mockReset().mockResolvedValue({ success: true });
  });

  const mitgliedschaft = async (userId, orgId) => {
    const { rows: [z] } = await db.query(
      `SELECT r.name FROM user_organizations uo JOIN roles r ON r.id = uo.role_id
        WHERE uo.user_id = $1 AND uo.organization_id = $2`,
      [userId, orgId]
    );
    return z ? z.name : null;
  };

  const stammRolle = async (userId) => {
    const { rows: [z] } = await db.query(
      'SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1',
      [userId]
    );
    return z.name;
  };

  // Teamer:in 1 (Stamm Org 1) ist in Org 3 Konfi -- ein Mischkonto aus dem
  // Altbestand, wie es vor dem 26.09.2026 von Hand entstehen konnte.
  const machTeamer1ZumMischkonto = () => db.query(
    'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
    [USERS.teamer1.id, ORG3, KONFI_ROLLE_ORG3]
  );

  // Eine offene Einladung von Hand, wie sie vor dem 26.09.2026 (Sicherheit
  // BF-03) auch an einen Konfi gehen konnte.
  const offeneEinladung = async (userId, roleId, orgId = 2) => {
    const { rows: [e] } = await db.query(
      `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days') RETURNING id`,
      [orgId, userId, roleId, USERS.orgAdmin2.id]
    );
    return e.id;
  };

  // ==================================================================
  // DIE REGEL SELBST
  // ==================================================================
  describe('pruefeKonfiOderTeam', () => {
    it('Konfi in einer weiteren Gemeinde: verboten', async () => {
      const r = await pruefeKonfiOderTeam(db, { userId: USERS.teamer1.id, organizationId: 2, rolle: 'konfi' });
      expect(r.error_code).toBe('konfi_und_team');
    });

    it('Team in einer weiteren Gemeinde fuer ein Konfi-Konto: verboten', async () => {
      const r = await pruefeKonfiOderTeam(db, { userId: USERS.konfi1.id, organizationId: 2, rolle: 'teamer' });
      expect(r.error_code).toBe('konfi_und_team');
    });

    it('Team in einer weiteren Gemeinde fuer ein Team-Konto: erlaubt', async () => {
      const r = await pruefeKonfiOderTeam(db, { userId: USERS.teamer1.id, organizationId: 2, rolle: 'teamer' });
      expect(r).toBeNull();
    });

    it('Konfi zuhause ohne weitere Gemeinde: erlaubt', async () => {
      const r = await pruefeKonfiOderTeam(db, { userId: USERS.teamer1.id, organizationId: 1, rolle: 'konfi' });
      expect(r).toBeNull();
    });

    it('die Zeile der Stamm-Gemeinde in user_organizations zaehlt nicht als weitere Gemeinde', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.teamer1.id, ROLES.teamer.id]
      );
      const r = await pruefeKonfiOderTeam(db, { userId: USERS.teamer1.id, organizationId: 1, rolle: 'konfi' });
      expect(r).toBeNull();
    });
  });

  // ==================================================================
  // EINLADUNG ANLEGEN
  // ==================================================================
  describe('POST /einladungen', () => {
    const einladen = (kennung) => request(app).post('/api/einladungen')
      .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`)
      .send({ kennung, role_id: ROLES.teamer2.id });

    it('verboten: Zielkonto ist in einer anderen Gemeinde Konfi -- Antwort wie "nicht gefunden"', async () => {
      await machTeamer1ZumMischkonto();
      const res = await einladen(USERS.teamer1.username);

      expect(res.status).toBe(404);
      expect(res.body.error_code).toBe('nicht_gefunden');
      const { rows } = await db.query('SELECT 1 FROM org_einladungen WHERE user_id = $1', [USERS.teamer1.id]);
      expect(rows).toHaveLength(0);
    });

    it('erlaubt: Zielkonto ist nur Team', async () => {
      const res = await einladen(USERS.teamer1.username);
      expect(res.status).toBe(201);
    });
  });

  // ==================================================================
  // EINLADUNG ANNEHMEN
  // ==================================================================
  describe('POST /einladungen/:id/annehmen', () => {
    const annehmen = (userKey, id) => request(app).post(`/api/einladungen/${id}/annehmen`)
      .set('Authorization', `Bearer ${generateToken(userKey)}`);

    it('verboten: ein Konfi-Konto nimmt eine (alte) Einladung als Teamer:in an', async () => {
      const id = await offeneEinladung(USERS.konfi1.id, ROLES.teamer2.id);
      const res = await annehmen('konfi1', id);

      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('konfi_und_team');
      expect(await mitgliedschaft(USERS.konfi1.id, 2)).toBeNull();
      // Die Einladung bleibt offen, nichts ist halb geschrieben.
      const { rows: [e] } = await db.query('SELECT status FROM org_einladungen WHERE id = $1', [id]);
      expect(e.status).toBe('offen');
    });

    it('verboten: eine (alte) Einladung mit der Konfi-Rolle', async () => {
      const id = await offeneEinladung(USERS.teamer1.id, ROLES.konfi2.id);
      const res = await annehmen('teamer1', id);

      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('konfi_und_team');
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBeNull();
    });

    it('verboten: zwischen Einladung und Annahme wurde das Konto zuhause Konfi', async () => {
      const id = await offeneEinladung(USERS.teamer1.id, ROLES.teamer2.id);
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [ROLES.konfi.id, USERS.teamer1.id]);
      const res = await annehmen('teamer1', id);

      expect(res.status).toBe(409);
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBeNull();
    });

    it('erlaubt: ein Team-Konto nimmt als Teamer:in an', async () => {
      const id = await offeneEinladung(USERS.teamer1.id, ROLES.teamer2.id);
      const res = await annehmen('teamer1', id);
      await warteAufNachwehen(app);

      expect(res.status).toBe(200);
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBe('teamer');
    });
  });

  // ==================================================================
  // ZUWEISUNG DURCH DEN SUPER-ADMIN
  // ==================================================================
  describe('POST /organizations/:id/members', () => {
    const zuweisen = (userId, roleName = 'teamer') => request(app).post('/api/organizations/2/members')
      .set('Authorization', `Bearer ${generateToken('superAdmin')}`)
      .send({ user_id: userId, role_name: roleName });

    it('verboten: das Konto ist in einer anderen Gemeinde Konfi (Altbestand)', async () => {
      await machTeamer1ZumMischkonto();
      const res = await zuweisen(USERS.teamer1.id);

      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('konfi_und_team');
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBeNull();
    });

    it('verboten: ein Konfi-Konto (Stamm-Rolle)', async () => {
      const res = await zuweisen(USERS.konfi1.id);
      expect(res.status).toBe(400);
      expect(await mitgliedschaft(USERS.konfi1.id, 2)).toBeNull();
    });

    it('erlaubt: ein Team-Konto', async () => {
      const res = await zuweisen(USERS.teamer1.id);
      expect(res.status).toBe(201);
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBe('teamer');
    });
  });

  // ==================================================================
  // ROLLENWECHSEL IN DER BENUTZERVERWALTUNG
  // ==================================================================
  describe('PUT /users/:id -- Rolle', () => {
    const rolleSetzen = (userKey, userId, roleId) => request(app).put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${generateToken(userKey)}`)
      .send({ role_id: roleId });

    const teamer1AuchInOrg2 = () => db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)',
      [USERS.teamer1.id, ROLES.teamer2.id]
    );

    it('verboten: in einer weiteren Gemeinde zum Konfi machen', async () => {
      await teamer1AuchInOrg2();
      const res = await rolleSetzen('orgAdmin2', USERS.teamer1.id, ROLES.konfi2.id);

      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('konfi_und_team');
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBe('teamer');
    });

    it('verboten: zuhause zum Konfi machen, solange eine weitere Gemeinde besteht', async () => {
      await teamer1AuchInOrg2();
      const res = await rolleSetzen('orgAdmin1', USERS.teamer1.id, ROLES.konfi.id);

      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('konfi_und_team');
      expect(await stammRolle(USERS.teamer1.id)).toBe('teamer');
    });

    it('erlaubt: in einer weiteren Gemeinde von Teamer:in zu Admin', async () => {
      await teamer1AuchInOrg2();
      const res = await rolleSetzen('orgAdmin2', USERS.teamer1.id, ROLES.admin2.id);

      expect(res.status).toBe(200);
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBe('admin');
    });

    it('erlaubt: Altbestand aufloesen -- in der weiteren Gemeinde von Konfi zu Teamer:in', async () => {
      // Leitung zuhause (Org 1), in Org 2 Konfi -- wie das Konto aus dem
      // Produktionsbefund vom 27.09.2026.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)',
        [USERS.admin1.id, ROLES.konfi2.id]
      );
      const res = await rolleSetzen('orgAdmin2', USERS.admin1.id, ROLES.teamer2.id);

      expect(res.status).toBe(200);
      expect(await mitgliedschaft(USERS.admin1.id, 2)).toBe('teamer');
    });

    it('erlaubt: Altbestand mit unveraenderter Rolle bearbeiten (die Oberflaeche schickt role_id immer mit)', async () => {
      // Konfi 1 (zuhause Konfi) ist in Org 2 Teamer:in -- Altbestand. Die
      // Leitung zuhause aendert nur den Namen; role_id kommt unveraendert mit.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)',
        [USERS.konfi1.id, ROLES.teamer2.id]
      );
      const res = await request(app).put(`/api/users/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ role_id: ROLES.konfi.id, display_name: 'Konfi Eins neu' });

      expect(res.status).toBe(200);
      const { rows: [u] } = await db.query('SELECT display_name FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(u.display_name).toBe('Konfi Eins neu');
    });

    it('zuhause: die Zeile der Stamm-Gemeinde in user_organizations wechselt mit', async () => {
      // Migration 101 hat JEDES Konto mit seiner damaligen Rolle auch in
      // user_organizations eingetragen. Wechselte danach nur users.role_id,
      // stand dort die alte Rolle -- etwa "konfi" bei einer Teamer:in.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.teamer1.id, ROLES.teamer.id]
      );
      const res = await rolleSetzen('orgAdmin1', USERS.teamer1.id, ROLES.admin.id);

      expect(res.status).toBe(200);
      expect(await stammRolle(USERS.teamer1.id)).toBe('admin');
      expect(await mitgliedschaft(USERS.teamer1.id, 1)).toBe('admin');
    });
  });

  // ==================================================================
  // BEFOERDERUNG
  // ==================================================================
  describe('POST /admin/konfis/:id/promote-teamer', () => {
    it('die Zeile der Stamm-Gemeinde in user_organizations wird Teamer:in', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.konfi1.id, ROLES.konfi.id]
      );
      const res = await request(app).post(`/api/admin/konfis/${USERS.konfi1.id}/promote-teamer`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);

      expect(res.status).toBe(200);
      expect(await stammRolle(USERS.konfi1.id)).toBe('teamer');
      expect(await mitgliedschaft(USERS.konfi1.id, 1)).toBe('teamer');
    });
  });

  // ==================================================================
  // REGISTRIERUNG MIT EINLADUNGSCODE
  // ==================================================================
  describe('POST /auth/register-konfi', () => {
    const code = async () => {
      const res = await request(app).post('/api/auth/invite-code')
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`)
        .send({ jahrgang_id: JAHRGAENGE.jahrgang2.id });
      return res.body.invite_code;
    };

    it('verboten: der Benutzername eines Team-Kontos haengt keine Konfi-Rolle an dieses Konto', async () => {
      const res = await request(app).post('/api/auth/register-konfi').send({
        invite_code: await code(),
        display_name: 'Teamer als Konfi',
        username: USERS.teamer1.username,
        password: 'TestPasswort123!'
      });

      expect(res.status).toBe(409);
      expect(await stammRolle(USERS.teamer1.id)).toBe('teamer');
      expect(await mitgliedschaft(USERS.teamer1.id, 2)).toBeNull();
    });

    it('erlaubt: ein neuer Benutzername legt ein neues Konfi-Konto an', async () => {
      const res = await request(app).post('/api/auth/register-konfi').send({
        invite_code: await code(),
        display_name: 'Neue Konfi',
        username: 'neue-konfi-org2',
        password: 'TestPasswort123!'
      });

      expect(res.status).toBe(200);
      const { rows: [u] } = await db.query(
        `SELECT u.organization_id, r.name FROM users u JOIN roles r ON r.id = u.role_id
          WHERE u.username = 'neue-konfi-org2'`
      );
      expect(Number(u.organization_id)).toBe(2);
      expect(u.name).toBe('konfi');
    });
  });
});
