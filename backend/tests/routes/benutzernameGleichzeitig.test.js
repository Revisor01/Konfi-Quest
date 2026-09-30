// Benutzernamen bei gleichzeitiger Anlage (Nebenbefund Großpaket, 29.09.2026)
//
// POST /users, POST /organizations/:id/admins und POST /organizations pruefen
// den Namen systemweit und ohne Gross/klein (LOWER(username)), weil die
// Anmeldung so sucht. Die Pruefung lief aber ohne Sperre: Zwischen dem SELECT
// und dem INSERT liegt das Hashen des Passworts (bcrypt, einige zig
// Millisekunden). Zwei gleichzeitige Anlagen mit demselben Namen sahen beide
// "frei" und legten beide an.
//
// Die Datenbank faengt das nicht: Der einzige eindeutige Index ist
// (organization_id, username) -- er unterscheidet Gross/klein und greift nur
// innerhalb EINER Gemeinde. In zwei Gemeinden oder mit "Anna"/"anna" entstanden
// zwei Konten; die Anmeldung wurde mehrdeutig.
//
// Erwartet: genau eine Anlage 201, die andere 409 mit derselben Meldung wie die
// normale Namenspruefung, kein 500, keine Doppelung -- auch ueber die Routen
// hinweg.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const VERGEBEN = { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' };

describe('Benutzernamen bei gleichzeitiger Anlage', () => {
  let app, db, superAdminToken, orgAdmin1Token, orgAdmin2Token;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  // DAS FENSTER ZWISCHEN PRUEFUNG UND ANLAGE fest offen halten: Jedes neue
  // Konto braucht hier 200 ms bis zum INSERT-Ende. Ohne Sperre prueft die
  // zweite Anlage dann sicher, waehrend die erste noch nicht festgeschrieben
  // ist -- sonst hinge das Ergebnis davon ab, wie die beiden Anfragen zufaellig
  // ineinandergreifen (gemessen: ohne Trigger fielen ohne Sperre nur 3 bis 4
  // der 7 Faelle). Erst nach dem Seed, damit der nicht bremst.
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(`
      CREATE OR REPLACE FUNCTION test_konto_langsam() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_sleep(0.2);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await db.query(
      'CREATE TRIGGER test_konto_langsam BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION test_konto_langsam()'
    );
    superAdminToken = generateToken('superAdmin');
    orgAdmin1Token = generateToken('orgAdmin1');
    orgAdmin2Token = generateToken('orgAdmin2');
  });

  afterEach(async () => {
    await db.query('DROP TRIGGER IF EXISTS test_konto_langsam ON users');
    await db.query('DROP FUNCTION IF EXISTS test_konto_langsam()');
  });

  const kontenMitNamen = async (username) => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM users WHERE LOWER(username) = LOWER($1)', [username]
    );
    return r.n;
  };

  // Genau eine Anlage kommt durch, die andere bekommt die Meldung der
  // normalen Namenspruefung -- in beliebiger Reihenfolge.
  const genauEinerDurch = async (antworten, username) => {
    expect(antworten.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(antworten.find((r) => r.status === 409).body).toEqual(VERGEBEN);
    expect(await kontenMitNamen(username)).toBe(1);
  };

  // --- die drei Routen --------------------------------------------------

  const teamerAnlegen = (token, username, role_id) =>
    request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username, display_name: `Teamer ${username}`, password: 'Sicher!Passwort1', role_id });

  const leitungAnlegen = (orgId, username) =>
    request(app)
      .post(`/api/organizations/${orgId}/admins`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ username, display_name: `Leitung ${username}`, password: 'Sicher!Passwort1' });

  const gemeindeAnlegen = (slug, admin_username) =>
    request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: slug,
        slug,
        display_name: `Gemeinde ${slug}`,
        admin_username,
        admin_password: 'Sicher!Passwort1',
        admin_display_name: `Leitung ${slug}`,
      });

  describe('POST /users', () => {
    it('derselbe Name in zwei Gemeinden gleichzeitig: einer 201, einer 409', async () => {
      const antworten = await Promise.all([
        teamerAnlegen(orgAdmin1Token, 'gleich.name', ROLES.teamer.id),
        teamerAnlegen(orgAdmin2Token, 'gleich.name', ROLES.teamer2.id),
      ]);
      await genauEinerDurch(antworten, 'gleich.name');
    });

    it('derselbe Name in anderer Schreibweise gleichzeitig: einer 201, einer 409', async () => {
      const antworten = await Promise.all([
        teamerAnlegen(orgAdmin1Token, 'Gleich.Name', ROLES.teamer.id),
        teamerAnlegen(orgAdmin1Token, 'gleich.name', ROLES.teamer.id),
      ]);
      await genauEinerDurch(antworten, 'gleich.name');
    });

    it('verschiedene Namen gleichzeitig: beide 201', async () => {
      const antworten = await Promise.all([
        teamerAnlegen(orgAdmin1Token, 'erster.name', ROLES.teamer.id),
        teamerAnlegen(orgAdmin2Token, 'zweiter.name', ROLES.teamer2.id),
      ]);
      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(await kontenMitNamen('erster.name')).toBe(1);
      expect(await kontenMitNamen('zweiter.name')).toBe(1);
    });

    // Ohne mitgeschickten Namen erzeugt der Server ihn aus dem Anzeigenamen.
    // Zwei gleichzeitige "Anna Muster" bekommen beide ein Konto, die zweite
    // den naechsten freien Namen -- kein 409 fuer einen Namen, den niemand
    // eingegeben hat.
    it('erzeugter Name, zwei gleichzeitig: beide 201 mit verschiedenen Namen', async () => {
      const ohneNamen = (token, role_id) =>
        request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${token}`)
          .send({ display_name: 'Anna Muster', password: 'Sicher!Passwort1', role_id });

      const antworten = await Promise.all([
        ohneNamen(orgAdmin1Token, ROLES.teamer.id),
        ohneNamen(orgAdmin2Token, ROLES.teamer2.id),
      ]);

      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(antworten.map((r) => r.body.username).sort()).toEqual(['anna.muster', 'anna.muster2']);
      expect(await kontenMitNamen('anna.muster')).toBe(1);
      expect(await kontenMitNamen('anna.muster2')).toBe(1);
    });
  });

  describe('POST /organizations/:id/admins', () => {
    it('derselbe Name in zwei Gemeinden gleichzeitig: einer 201, einer 409', async () => {
      const antworten = await Promise.all([
        leitungAnlegen(ORGS.testGemeinde.id, 'gleiche_leitung'),
        leitungAnlegen(ORGS.andereGemeinde.id, 'gleiche_leitung'),
      ]);
      await genauEinerDurch(antworten, 'gleiche_leitung');
    });

    it('derselbe Name in anderer Schreibweise gleichzeitig: einer 201, einer 409', async () => {
      const antworten = await Promise.all([
        leitungAnlegen(ORGS.testGemeinde.id, 'Gleiche_Leitung'),
        leitungAnlegen(ORGS.testGemeinde.id, 'gleiche_leitung'),
      ]);
      await genauEinerDurch(antworten, 'gleiche_leitung');
    });

    it('verschiedene Namen gleichzeitig: beide 201', async () => {
      const antworten = await Promise.all([
        leitungAnlegen(ORGS.testGemeinde.id, 'erste_leitung'),
        leitungAnlegen(ORGS.andereGemeinde.id, 'zweite_leitung'),
      ]);
      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(await kontenMitNamen('erste_leitung')).toBe(1);
      expect(await kontenMitNamen('zweite_leitung')).toBe(1);
    });
  });

  describe('POST /organizations', () => {
    const gemeindenMitSlug = async (slugs) => {
      const { rows: [r] } = await db.query(
        'SELECT COUNT(*)::int AS n FROM organizations WHERE slug = ANY($1)', [slugs]
      );
      return r.n;
    };

    it('zwei Gemeinden mit derselben Gemeindeleitung gleichzeitig: eine 201, eine 409 ohne Reste', async () => {
      const antworten = await Promise.all([
        gemeindeAnlegen('gemeinde-eins', 'gleiche_leitung'),
        gemeindeAnlegen('gemeinde-zwei', 'gleiche_leitung'),
      ]);
      await genauEinerDurch(antworten, 'gleiche_leitung');
      expect(await gemeindenMitSlug(['gemeinde-eins', 'gemeinde-zwei'])).toBe(1);
    });

    it('derselbe Name in anderer Schreibweise gleichzeitig: eine 201, eine 409', async () => {
      const antworten = await Promise.all([
        gemeindeAnlegen('gemeinde-eins', 'Gleiche_Leitung'),
        gemeindeAnlegen('gemeinde-zwei', 'gleiche_leitung'),
      ]);
      await genauEinerDurch(antworten, 'gleiche_leitung');
      expect(await gemeindenMitSlug(['gemeinde-eins', 'gemeinde-zwei'])).toBe(1);
    });

    it('verschiedene Namen gleichzeitig: beide 201', async () => {
      const antworten = await Promise.all([
        gemeindeAnlegen('gemeinde-eins', 'erste_leitung'),
        gemeindeAnlegen('gemeinde-zwei', 'zweite_leitung'),
      ]);
      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(await gemeindenMitSlug(['gemeinde-eins', 'gemeinde-zwei'])).toBe(2);
    });
  });

  // --- ueber die Routen hinweg -------------------------------------------
  // Alle drei Routen nehmen dieselbe Sperre; sonst kaeme derselbe Name ueber
  // zwei verschiedene Wege gleichzeitig durch.
  describe('ueber die Routen hinweg', () => {
    it('neue Gemeinde und neues Teammitglied mit demselben Namen gleichzeitig: einer 201, einer 409', async () => {
      const antworten = await Promise.all([
        gemeindeAnlegen('gemeinde-eins', 'quer.name'),
        teamerAnlegen(orgAdmin1Token, 'quer.name', ROLES.teamer.id),
        leitungAnlegen(ORGS.andereGemeinde.id, 'Quer.Name'),
      ]);
      expect(antworten.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      for (const r of antworten.filter((a) => a.status === 409)) {
        expect(r.body).toEqual(VERGEBEN);
      }
      expect(await kontenMitNamen('quer.name')).toBe(1);
    });
  });
});
