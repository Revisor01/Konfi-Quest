// POST /api/organizations -- eine Gemeinde ganz oder gar nicht anlegen
// (Nebenbefund Screens/Leitung BF-15, 29.09.2026; Paket I2)
//
// Drei Befunde an derselben Route:
//
// 1. KEINE TRANSAKTION: Rollen, Konto der ersten Gemeindeleitung, Badges,
//    Zertifikate, Level, Kategorien, Aktivitaeten und Challenges gingen als
//    Einzelabfragen ueber den Pool. Scheiterte eine mittendrin, blieb eine
//    halbe Gemeinde stehen -- mit belegtem Systemnamen, sodass der zweite
//    Versuch an "Gemeinde-Slug existiert bereits" scheiterte.
//
// 2. BENUTZERNAME NICHT SYSTEMWEIT GEPRUEFT: POST /users und
//    POST /organizations/:id/admins verlangen einen systemweit eindeutigen
//    Benutzernamen (409 "Benutzername existiert bereits (muss systemweit
//    eindeutig sein)"), weil die Anmeldung per LOWER(username) sucht. Diese
//    Route pruefte nicht; der Index ist nur (organization_id, username) --
//    in einer neuen Gemeinde griff er nie. Zwei Konten gleichen Namens machen
//    die Anmeldung mehrdeutig.
//
// 3. DER SYSTEMNAME VERLOR UMLAUTE: Die App bildet ihn aus dem Anzeigenamen
//    und wirft dabei alles ausser a-z und 0-9 weg ("Büsum" -> "bsum"). Der
//    Server transliteriert jetzt (ä->ae, ö->oe, ü->ue, ß->ss). Bestehende
//    Gemeinden werden nicht umbenannt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('POST /api/organizations: ganz oder gar nicht, eindeutige Namen', () => {
  let app, db, superAdminToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    superAdminToken = generateToken('superAdmin');
  });

  // Die App schickt name und slug als ihren "Systemnamen" (siehe
  // OrganizationManagementModal.tsx, generateSystemName).
  const anlegen = (felder) =>
    request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'neue-gemeinde',
        slug: 'neue-gemeinde',
        display_name: 'Neue Gemeinde',
        admin_username: 'neue_leitung',
        admin_password: 'Sicher!Passwort1',
        admin_display_name: 'Neue Leitung',
        ...felder,
      });

  const gemeindenMitSlug = async (slug) => {
    const { rows: [r] } = await db.query('SELECT COUNT(*)::int AS n FROM organizations WHERE slug = $1', [slug]);
    return r.n;
  };

  const kontenMitNamen = async (username) => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM users WHERE LOWER(username) = LOWER($1)', [username]
    );
    return r.n;
  };

  describe('Benutzername der ersten Gemeindeleitung', () => {
    it('lehnt einen Namen ab, den es in einer anderen Gemeinde schon gibt (409, nichts angelegt)', async () => {
      const res = await anlegen({ admin_username: USERS.admin1.username });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Benutzername existiert bereits (muss systemweit eindeutig sein)');
      expect(await gemeindenMitSlug('neue-gemeinde')).toBe(0);
      expect(await kontenMitNamen(USERS.admin1.username)).toBe(1);
    });

    it('lehnt denselben Namen in anderer Schreibweise ab (die Anmeldung sucht ohne Groß/klein)', async () => {
      const res = await anlegen({ admin_username: USERS.admin1.username.toUpperCase() });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Benutzername existiert bereits (muss systemweit eindeutig sein)');
      expect(await gemeindenMitSlug('neue-gemeinde')).toBe(0);
      expect(await kontenMitNamen(USERS.admin1.username)).toBe(1);
    });

    it('nimmt einen freien Namen an (201, Konto in der neuen Gemeinde)', async () => {
      const res = await anlegen({ admin_username: 'ganz_neue_leitung' });

      expect(res.status).toBe(201);
      const { rows: [konto] } = await db.query(
        'SELECT organization_id FROM users WHERE username = $1', ['ganz_neue_leitung']
      );
      expect(konto.organization_id).toBe(res.body.id);
    });
  });

  describe('Transaktion', () => {
    // Ein Fehler MITTENDRIN: Die Level kommen nach Rollen, Konto, Badges und
    // Zertifikaten. Ein Trigger laesst genau diesen Schritt scheitern.
    beforeEach(async () => {
      await db.query(`
        CREATE OR REPLACE FUNCTION test_level_sperre() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Level-Anlage scheitert (Test)';
        END;
        $$ LANGUAGE plpgsql`);
    });

    afterEach(async () => {
      await db.query('DROP TRIGGER IF EXISTS test_level_sperre ON levels');
      await db.query('DROP FUNCTION IF EXISTS test_level_sperre()');
    });

    it('hinterlässt nach einem Fehler mittendrin keine halbe Gemeinde', async () => {
      await db.query(
        'CREATE TRIGGER test_level_sperre BEFORE INSERT ON levels FOR EACH ROW EXECUTE FUNCTION test_level_sperre()'
      );
      const vorher = await db.query('SELECT COUNT(*)::int AS n FROM organizations');

      const res = await anlegen({ admin_username: 'halbe_leitung' });

      expect(res.status).toBe(500);
      expect(await gemeindenMitSlug('neue-gemeinde')).toBe(0);
      expect((await db.query('SELECT COUNT(*)::int AS n FROM organizations')).rows[0].n).toBe(vorher.rows[0].n);
      expect(await kontenMitNamen('halbe_leitung')).toBe(0);
    });

    it('legt ohne Fehler alles an, und ein zweiter Versuch nach einem Fehler gelingt', async () => {
      await db.query(
        'CREATE TRIGGER test_level_sperre BEFORE INSERT ON levels FOR EACH ROW EXECUTE FUNCTION test_level_sperre()'
      );
      expect((await anlegen({ admin_username: 'zweiter_versuch' })).status).toBe(500);
      await db.query('DROP TRIGGER test_level_sperre ON levels');

      const res = await anlegen({ admin_username: 'zweiter_versuch' });

      expect(res.status).toBe(201);
      expect(await gemeindenMitSlug('neue-gemeinde')).toBe(1);
      const { rows: [{ n: level }] } = await db.query(
        'SELECT COUNT(*)::int AS n FROM levels WHERE organization_id = $1', [res.body.id]
      );
      expect(level).toBe(6);
    });
  });

  describe('Systemname mit Umlauten', () => {
    const gespeichert = async (id) => {
      const { rows: [o] } = await db.query('SELECT name, slug, display_name FROM organizations WHERE id = $1', [id]);
      return o;
    };

    it('macht aus dem verlustbehafteten Namen der App („bsum" für „Büsum") „buesum"', async () => {
      const res = await anlegen({ name: 'bsum', slug: 'bsum', display_name: 'Büsum', admin_username: 'leitung_buesum' });

      expect(res.status).toBe(201);
      expect(await gespeichert(res.body.id)).toEqual({ name: 'buesum', slug: 'buesum', display_name: 'Büsum' });
    });

    it('transliteriert ä, ö, ü und ß (groß wie klein)', async () => {
      const anzeige = 'Groß Bäk Königsförde Ülzen';
      // Gegenprobe zur Eingabe: So bildet die ausgelieferte App den Namen.
      const vonDerApp = anzeige.toLowerCase().replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      expect(vonDerApp).toBe('gro-bk-knigsfrde-lzen');

      const res = await anlegen({ name: vonDerApp, slug: vonDerApp, display_name: anzeige, admin_username: 'leitung_bk' });

      expect(res.status).toBe(201);
      const o = await gespeichert(res.body.id);
      expect(o.slug).toBe('gross-baek-koenigsfoerde-uelzen');
      expect(o.name).toBe('gross-baek-koenigsfoerde-uelzen');
    });

    it('ändert an einem Namen ohne Umlaute nichts (auch nicht an Bindestrichen)', async () => {
      // Die App wirft Bindestriche aus dem Anzeigenamen weg; daran ändert
      // sich nichts -- nur Umlaute werden umgeschrieben.
      const res = await anlegen({ name: 'kirchspielwest', slug: 'kirchspielwest', display_name: 'Kirchspiel-West', admin_username: 'leitung_west' });

      expect(res.status).toBe(201);
      expect((await gespeichert(res.body.id)).slug).toBe('kirchspielwest');
    });

    it('transliteriert Umlaute, die jemand direkt im Systemnamen schickt', async () => {
      const res = await anlegen({ name: 'büsum', slug: 'büsum', display_name: 'Kirchengemeinde Büsum', admin_username: 'leitung_b2' });

      expect(res.status).toBe(201);
      expect((await gespeichert(res.body.id)).slug).toBe('buesum');
    });

    it('lässt einen eigenen Systemnamen ohne Umlaute stehen', async () => {
      const res = await anlegen({ name: 'kirchspiel-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd', admin_username: 'leitung_sued' });

      expect(res.status).toBe(201);
      expect(await gespeichert(res.body.id)).toEqual({ name: 'kirchspiel-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd' });
    });

    it('meldet einen transliterierten Namen, den es schon gibt, als vergeben (409)', async () => {
      expect((await anlegen({ name: 'bsum', slug: 'bsum', display_name: 'Büsum', admin_username: 'leitung_eins' })).status).toBe(201);

      const res = await anlegen({ name: 'bsum', slug: 'bsum', display_name: 'Büsum', admin_username: 'leitung_zwei' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Gemeinde-Slug existiert bereits');
      expect(await kontenMitNamen('leitung_zwei')).toBe(0);
    });

    it('benennt eine bestehende Gemeinde beim Bearbeiten nicht um', async () => {
      // Eine Gemeinde von vor der Umstellung: Systemname ohne Umlaut.
      const { rows: [alt] } = await db.query(
        `INSERT INTO organizations (name, slug, display_name, is_active) VALUES ('bsum', 'bsum', 'Büsum', true) RETURNING id`
      );

      const res = await request(app)
        .put(`/api/organizations/${alt.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'bsum', slug: 'bsum', display_name: 'Büsum', description: 'Neu beschrieben' });

      expect(res.status).toBe(200);
      expect(await gespeichert(alt.id)).toEqual({ name: 'bsum', slug: 'bsum', display_name: 'Büsum' });
    });
  });
});
