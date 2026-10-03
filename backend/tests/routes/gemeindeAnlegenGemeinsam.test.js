// Eine Gemeinde anlegen: EINE Funktion fuer alle Wege (03.10.2026).
//
// Die Support-Ansicht der Web-Version legt Gemeinden auch aus einer Anfrage
// an (POST /support/anfragen/:id/anlegen, docs/planung/web-version.md,
// Entscheidung 4). Dafuer ist die Anlage aus POST /organizations in
// utils/gemeindeAnlegen.js herausgeloest -- keine Kopie. Diese Datei haelt
// fest:
//
//   1. POST /organizations legt nach dem Umbau Stueck fuer Stueck dasselbe
//      an wie vorher. Die Pruefsumme unten stammt aus dem Stand VOR dem
//      Umbau (Commit bd221b7c, gemessen am 03.10.2026); dazu Antwort und
//      Zaehler im Klartext.
//   2. Eine Gemeinde aus einer Anfrage entsteht genauso (Abschnitt unten,
//      kommt mit den Support-Routen).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { gemeindeAbdruck, pruefsumme } = require('../helpers/gemeindeAbdruck');

// Pruefsumme des Abdrucks einer Gemeinde aus GEMEINDE unten, gemessen mit
// dem Code vor dem Herausloesen der gemeinsamen Funktion.
const PRUEFSUMME_VOR_DEM_UMBAU = '8588e332272bc8edccfe1aa61352a9d82badf5f8f664b09e54ab0a110ea0f84d';

const GEMEINDE = Object.freeze({
  name: 'kirchengemeinde-bsum',
  slug: 'kirchengemeinde-bsum',
  display_name: 'Kirchengemeinde Büsum',
  description: 'An der Küste',
  contact_name: 'Pastorin Probe',
  contact_email: 'buero@buesum.example',
  contact_phone: '04834 1234',
  address: 'Kirchplatz 1, 25761 Büsum',
  website_url: 'https://buesum.example',
  kirchenkreis: 'Dithmarschen',
  max_konfis: 50,
  admin_username: 'leitung.buesum',
  admin_password: 'Sicher!Passwort1',
  admin_display_name: 'Leitung Büsum',
});

describe('Gemeinde anlegen: eine gemeinsame Funktion', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  const anlegen = (felder = {}) => request(app)
    .post('/api/organizations')
    .set('Authorization', `Bearer ${generateToken('superAdmin')}`)
    .send({ ...GEMEINDE, ...felder });

  describe('POST /organizations verhält sich wie vor dem Umbau', () => {
    it('Antwort: Status, Felder und Meldung wie bisher', async () => {
      const res = await anlegen();
      expect(res.status).toBe(201);
      const { id, admin_user_id: adminId, ...rest } = res.body;
      expect(Number.isInteger(id)).toBe(true);
      expect(Number.isInteger(adminId)).toBe(true);
      expect(rest).toEqual({
        default_badges_created: 36,
        default_certificates_created: 4,
        default_levels_created: 6,
        default_categories_created: 14,
        default_activities_created: 9,
        default_challenges_created: 3,
        message: 'Gemeinde erfolgreich erstellt (Standard-Rollen, Admin, 36 Badges, 4 Zertifikate, '
          + '6 Levels, 14 Kategorien, 9 Aktivitäten, 3 Beispiel-Challenges)',
      });
    });

    it('Stammdaten, Laufzeit und erstes Konto der Gemeindeleitung wie bisher', async () => {
      const res = await anlegen();
      const abdruck = await gemeindeAbdruck(db, res.body.id);
      expect(abdruck.gemeinde).toEqual({
        name: 'kirchengemeinde-buesum',
        slug: 'kirchengemeinde-buesum',
        display_name: 'Kirchengemeinde Büsum',
        description: 'An der Küste',
        logo_url: null,
        contact_name: 'Pastorin Probe',
        contact_email: 'buero@buesum.example',
        contact_phone: '04834 1234',
        address: 'Kirchplatz 1, 25761 Büsum',
        website_url: 'https://buesum.example',
        is_active: true,
        max_konfis: 50,
        kirchenkreis: 'Dithmarschen',
        trial_tage: 30,
        is_trial: true,
        license_reminder_sent_at: null,
      });
      expect(abdruck.leitung).toEqual({
        username: 'leitung.buesum',
        email: 'buero@buesum.example',
        display_name: 'Leitung Büsum',
        is_active: true,
        is_super_admin: false,
        role_title: null,
        teamer_since: null,
        push_enabled: true,
        bible_translation: 'LUT',
        rolle: 'org_admin',
      });
      expect(abdruck.konten).toBe(1);
      expect(abdruck.sonst).toEqual({ jahrgaenge: 0, termine: 0, chats: 0, weitere_mitglieder: 0, einstellungen: 0 });
    });

    it('alles Angelegte zusammen: dieselbe Prüfsumme wie vor dem Umbau', async () => {
      const res = await anlegen();
      expect(pruefsumme(await gemeindeAbdruck(db, res.body.id))).toBe(PRUEFSUMME_VOR_DEM_UMBAU);
    });

    it('ohne Laufzeit-Angabe 30 Tage Testphase, mit trial_ends_at null unbegrenzt ohne Testphase', async () => {
      const mit = await anlegen();
      const ohne = await anlegen({
        name: 'zweite', slug: 'zweite', display_name: 'Zweite', admin_username: 'leitung.zwei',
        trial_ends_at: null,
      });
      expect((await gemeindeAbdruck(db, mit.body.id)).gemeinde).toMatchObject({ trial_tage: 30, is_trial: true });
      expect((await gemeindeAbdruck(db, ohne.body.id)).gemeinde).toMatchObject({ trial_tage: null, is_trial: false });
    });

    it('Fehler wie bisher: Name vergeben 409, Systemname vergeben 409, Limit ungültig 400', async () => {
      expect((await anlegen()).status).toBe(201);
      const nameVergeben = await anlegen({ name: 'andere', slug: 'andere' });
      expect(nameVergeben.status).toBe(409);
      expect(nameVergeben.body).toEqual({ error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' });

      const slugVergeben = await anlegen({ admin_username: 'leitung.anders' });
      expect(slugVergeben.status).toBe(409);
      expect(slugVergeben.body).toEqual({ error: 'Gemeinde-Slug existiert bereits' });

      const limit = await anlegen({ name: 'dritte', slug: 'dritte', admin_username: 'leitung.drei', max_konfis: -1 });
      expect(limit.status).toBe(400);
      expect(limit.body).toEqual({ error: 'Konfi-Limit muss eine Zahl ab 0 oder leer sein' });
      const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM organizations');
      expect(n).toBe(3);
    });
  });
});
