// PUT /users/:id: Benutzername beim Bearbeiten (30.09.2026, Nebenbefund J1)
//
// Beim Anlegen ist der Benutzername systemweit und ohne Gross/klein eindeutig
// (die Anmeldung sucht per LOWER(username) ueber alle Gemeinden). Beim
// Bearbeiten pruefte PUT /users/:id nichts: Gemessen am 30.09.2026 liess sich
// eine Teamer:in auf den Namen eines Admins einer anderen Gemeinde umbenennen
// (200), ebenso auf "ADMIN1" neben "admin1" (200). Danach war die Anmeldung
// mehrdeutig. Der einzige eindeutige Index (organization_id, username)
// unterscheidet Gross/klein und greift nur in einer Gemeinde.
//
// AUSGELIEFERTE APPS: Die Store-Apps 2.2.x und 2.3.0 schicken beim Speichern
// den geladenen Benutzernamen unveraendert (getrimmt) mit -- auch wenn nur
// E-Mail oder Rolle geaendert wurden (UserManagementModal, handleSave). Das
// muss weiter 200 geben, auch wenn im Altbestand schon ein zweites Konto mit
// demselben Namen in anderer Schreibweise liegt. Ebenso eine reine Aenderung
// der Schreibweise des eigenen Namens (anna -> Anna).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const VERGEBEN = { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' };

describe('PUT /users/:id: Benutzername beim Bearbeiten', () => {
  let app, db, orgAdmin1Token, orgAdmin2Token;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdmin1Token = generateToken('orgAdmin1');
    orgAdmin2Token = generateToken('orgAdmin2');
  });

  const benutzername = async (id) =>
    (await db.query('SELECT username FROM users WHERE id = $1', [id])).rows[0].username;

  const kontenMitNamen = async (name) => (await db.query(
    'SELECT COUNT(*)::int AS n FROM users WHERE LOWER(username) = LOWER($1)', [name]
  )).rows[0].n;

  // So speichert die App (2.2.x und 2.3.0): das ganze Formular.
  const speichern = (token, konto, aenderung = {}) =>
    request(app)
      .put(`/api/users/${konto.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: konto.username,
        email: null,
        display_name: konto.display_name,
        role_title: null,
        role_id: konto.role_id,
        is_active: true,
        ...aenderung,
      });

  describe('verboten', () => {
    it('auf den Namen eines Kontos einer anderen Gemeinde: 409, nichts geaendert', async () => {
      const res = await speichern(orgAdmin1Token, USERS.teamer1, { username: USERS.admin2.username });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(VERGEBEN);
      expect(await benutzername(USERS.teamer1.id)).toBe(USERS.teamer1.username);
      expect(await kontenMitNamen(USERS.admin2.username)).toBe(1);
    });

    it('auf einen fremden Namen in anderer Schreibweise: 409, nichts geaendert', async () => {
      const res = await speichern(orgAdmin1Token, USERS.teamer1, { username: 'ADMIN1' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(VERGEBEN);
      expect(await benutzername(USERS.teamer1.id)).toBe(USERS.teamer1.username);
      expect(await kontenMitNamen('admin1')).toBe(1);
    });

    it('aendert das Formular dabei noch anderes, bleibt auch das unveraendert', async () => {
      const res = await speichern(orgAdmin1Token, USERS.teamer1, {
        username: USERS.admin2.username,
        display_name: 'Neuer Anzeigename',
      });

      expect(res.status).toBe(409);
      const { rows: [konto] } = await db.query('SELECT display_name FROM users WHERE id = $1', [USERS.teamer1.id]);
      expect(konto.display_name).toBe(USERS.teamer1.display_name);
    });
  });

  describe('erlaubt', () => {
    it('unveraendert mitgeschickt (wie die Store-Apps): 200', async () => {
      const res = await speichern(orgAdmin1Token, USERS.teamer1, { email: 'teamer1@example.org' });

      expect(res.status).toBe(200);
      expect(await benutzername(USERS.teamer1.id)).toBe(USERS.teamer1.username);
    });

    it('unveraendert, obwohl der Altbestand denselben Namen in anderer Schreibweise schon kennt: 200', async () => {
      // Eine Dublette aus der Zeit vor der systemweiten Pruefung -- an der
      // Pruefung vorbei direkt in die andere Gemeinde geschrieben.
      await db.query(
        `INSERT INTO users (organization_id, role_id, username, display_name, password_hash, is_active)
         VALUES (2, $1, $2, 'Altbestand', 'x', true)`,
        [ROLES.teamer2.id, USERS.teamer1.username.toUpperCase()]
      );

      const res = await speichern(orgAdmin1Token, USERS.teamer1, { email: 'teamer1@example.org' });

      expect(res.status).toBe(200);
    });

    it('eigener Name in anderer Schreibweise: 200, gespeichert', async () => {
      const res = await speichern(orgAdmin1Token, USERS.teamer1, { username: 'Teamer1' });

      expect(res.status).toBe(200);
      expect(await benutzername(USERS.teamer1.id)).toBe('Teamer1');
    });

    it('freier Name: 200, gespeichert', async () => {
      const res = await speichern(orgAdmin1Token, USERS.teamer1, { username: 'ganz.frei' });

      expect(res.status).toBe(200);
      expect(await benutzername(USERS.teamer1.id)).toBe('ganz.frei');
    });

    it('ohne username im Formular (nur andere Felder): 200', async () => {
      const res = await request(app)
        .put(`/api/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`)
        .send({ display_name: 'Nur der Name' });

      expect(res.status).toBe(200);
      expect(await benutzername(USERS.teamer1.id)).toBe(USERS.teamer1.username);
    });
  });

  describe('gleichzeitig', () => {
    // Das Fenster zwischen Pruefung und UPDATE fest offen halten (200 ms),
    // wie in benutzernameGleichzeitig.test.js -- sonst hinge das Ergebnis
    // ohne Sperre vom Zufall ab.
    beforeEach(async () => {
      await db.query(`
        CREATE OR REPLACE FUNCTION test_umbenennen_langsam() RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`);
      await db.query(
        'CREATE TRIGGER test_umbenennen_langsam BEFORE UPDATE OF username ON users FOR EACH ROW EXECUTE FUNCTION test_umbenennen_langsam()'
      );
    });

    afterEach(async () => {
      await db.query('DROP TRIGGER IF EXISTS test_umbenennen_langsam ON users');
      await db.query('DROP FUNCTION IF EXISTS test_umbenennen_langsam()');
    });

    it('zwei Konten in zwei Gemeinden gleichzeitig auf denselben Namen: einer 200, einer 409', async () => {
      const antworten = await Promise.all([
        speichern(orgAdmin1Token, USERS.teamer1, { username: 'neuer.name' }),
        speichern(orgAdmin2Token, USERS.teamer2, { username: 'Neuer.Name' }),
      ]);

      expect(antworten.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(antworten.find((r) => r.status === 409).body).toEqual(VERGEBEN);
      expect(await kontenMitNamen('neuer.name')).toBe(1);
    });

    it('zwei Konten gleichzeitig auf verschiedene freie Namen: beide 200', async () => {
      const antworten = await Promise.all([
        speichern(orgAdmin1Token, USERS.teamer1, { username: 'erster.name' }),
        speichern(orgAdmin2Token, USERS.teamer2, { username: 'zweiter.name' }),
      ]);

      expect(antworten.map((r) => r.status)).toEqual([200, 200]);
      expect(await benutzername(USERS.teamer1.id)).toBe('erster.name');
      expect(await benutzername(USERS.teamer2.id)).toBe('zweiter.name');
    });
  });
});
