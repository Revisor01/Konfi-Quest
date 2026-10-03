// /api/support -- die Support-Ansicht der Web-Version (03.10.2026;
// docs/planung/web-version.md, Entscheidungen 3 bis 7 und 10; Vertrag der
// Pakete vom 03.10.2026).
//
// Geprueft: Rechte (nur Super-Admin, mit und ohne Gemeinde), Antwortformen
// aus dem Vertrag, Anfragen bearbeiten und anlegen (Fehler wie
// POST /organizations, alles in einer Transaktion), Landeskirchen und
// Kirchenkreise samt Spiegelung in die alte Textspalte, die Zuordnung ueber
// PUT/GET/POST /organizations und die Statistik mit konkreten Zahlen.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen, supportToken, refreshTokenAnlegen } = require('../helpers/kontoOhneGemeinde');

const ANFRAGE_FELDER = [
  'id', 'gemeinde', 'kirchenkreis', 'landeskirche', 'kontakt_name', 'funktion', 'email', 'mobil',
  'anzahl_konfis', 'anzahl_teamer', 'nachricht', 'status', 'notiz', 'organization_id', 'created_at', 'updated_at',
];

describe('/api/support', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
  });

  const SUPER = () => generateToken('orgAdminSuper'); // Super-Admin MIT Gemeinde (Simons Konstellation)
  const als = (token) => ({
    get: (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${token}`),
    post: (pfad, b) => request(app).post(pfad).set('Authorization', `Bearer ${token}`).send(b),
    put: (pfad, b) => request(app).put(pfad).set('Authorization', `Bearer ${token}`).send(b),
    patch: (pfad, b) => request(app).patch(pfad).set('Authorization', `Bearer ${token}`).send(b),
    delete: (pfad) => request(app).delete(pfad).set('Authorization', `Bearer ${token}`),
  });

  const anfrageAnlegen = async (felder = {}) => {
    const f = {
      gemeinde: 'Kirchengemeinde Büsum', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
      kontakt_name: 'Pastorin Probe', funktion: 'Pastorin', email: 'probe@buesum.example', mobil: '0151 1',
      anzahl_konfis: 24, anzahl_teamer: 6, nachricht: 'Bitte bald.', status: 'neu', ...felder,
    };
    const { rows: [a] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kirchenkreis, landeskirche, kontakt_name, funktion, email, mobil,
                                      anzahl_konfis, anzahl_teamer, nachricht, status, einwilligung_am, created_at, status_seit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), COALESCE($12, NOW()), NOW() - interval '5 days')
       RETURNING id`,
      [f.gemeinde, f.kirchenkreis, f.landeskirche, f.kontakt_name, f.funktion, f.email, f.mobil,
        f.anzahl_konfis, f.anzahl_teamer, f.nachricht, f.status, f.created_at || null]);
    return Number(a.id);
  };

  const kirchenkreisAnlegen = async (name, landeskirche = null) => {
    let lk = null;
    if (landeskirche) {
      ({ rows: [{ id: lk }] } = await db.query(
        `INSERT INTO landeskirchen (name) VALUES ($1)
         ON CONFLICT ((lower(name))) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [landeskirche]));
    }
    const { rows: [{ id }] } = await db.query(
      'INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ($1, $2) RETURNING id', [name, lk]);
    return { id: Number(id), landeskirche_id: lk === null ? null : Number(lk) };
  };

  // ==========================================================================
  // Rechte
  // ==========================================================================
  describe('Rechte: nur Super-Admin', () => {
    const ROUTEN = [
      ['get', '/api/support/anfragen'],
      ['patch', '/api/support/anfragen/1', { notiz: 'x' }],
      ['post', '/api/support/anfragen/1/anlegen', {}],
      ['get', '/api/support/landeskirchen'],
      ['post', '/api/support/landeskirchen', { name: 'X' }],
      ['put', '/api/support/landeskirchen/1', { name: 'X' }],
      ['delete', '/api/support/landeskirchen/1'],
      ['get', '/api/support/kirchenkreise'],
      ['post', '/api/support/kirchenkreise', { name: 'X' }],
      ['put', '/api/support/kirchenkreise/1', { name: 'X' }],
      ['delete', '/api/support/kirchenkreise/1'],
      ['get', '/api/support/statistik'],
    ];

    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verboten: %s bekommt auf jeder Route 403', async (wer) => {
      const status = [];
      for (const [methode, pfad, b] of ROUTEN) {
        status.push((await als(generateToken(wer))[methode](pfad, b)).status);
      }
      expect(status).toEqual(ROUTEN.map(() => 403));
      expect((await db.query('SELECT COUNT(*)::int AS n FROM landeskirchen')).rows[0].n).toBe(0);
    });

    it('verboten: ohne Anmeldung 401', async () => {
      expect((await request(app).get('/api/support/statistik')).status).toBe(401);
    });

    it.each([
      ['Super-Admin mit Gemeinde (Rolle Gemeindeleitung, Merkmal)', () => generateToken('orgAdminSuper')],
      ['Super-Admin-Rolle', () => generateToken('superAdmin')],
      ['Support-Konto ohne Gemeinde', () => supportToken()],
    ])('erlaubt: %s liest alle Listen (200)', async (_wer, token) => {
      for (const pfad of ['/api/support/anfragen', '/api/support/landeskirchen', '/api/support/kirchenkreise', '/api/support/statistik']) {
        const res = await als(token()).get(pfad);
        expect([pfad, res.status]).toEqual([pfad, 200]);
      }
    });

    it('erlaubt: das Support-Konto ohne Gemeinde legt eine Landeskirche an (201)', async () => {
      const res = await als(supportToken()).post('/api/support/landeskirchen', { name: 'Nordkirche' });
      expect(res.status).toBe(201);
    });
  });

  // ==========================================================================
  // Anfragen
  // ==========================================================================
  describe('GET /anfragen', () => {
    it('Array mit genau den Feldern des Vertrags, neueste zuerst', async () => {
      const alt = await anfrageAnlegen({ gemeinde: 'Alt', created_at: '2026-09-01T10:00:00Z' });
      const neu = await anfrageAnlegen({ gemeinde: 'Neu' });
      const res = await als(SUPER()).get('/api/support/anfragen');
      expect(res.status).toBe(200);
      expect(res.body.map((a) => a.id)).toEqual([neu, alt]);
      expect(Object.keys(res.body[0]).sort()).toEqual([...ANFRAGE_FELDER].sort());
      expect(res.body[0]).toMatchObject({
        gemeinde: 'Neu', kontakt_name: 'Pastorin Probe', email: 'probe@buesum.example',
        anzahl_konfis: 24, anzahl_teamer: 6, status: 'neu', notiz: null, organization_id: null,
      });
    });

    it('?status filtert; ein unbekannter Status 400', async () => {
      await anfrageAnlegen({ gemeinde: 'A', status: 'neu' });
      await anfrageAnlegen({ gemeinde: 'B', status: 'abgelehnt' });
      const res = await als(SUPER()).get('/api/support/anfragen?status=abgelehnt');
      expect(res.body.map((a) => a.gemeinde)).toEqual(['B']);
      expect((await als(SUPER()).get('/api/support/anfragen?status=erledigt')).status).toBe(400);
    });
  });

  describe('PATCH /anfragen/:id', () => {
    const lesen = async (anfrageId) => (await db.query(
      'SELECT status, notiz, status_seit, bearbeitet_von FROM gemeinde_anfragen WHERE id = $1', [anfrageId])).rows[0];

    it('Status und Notiz: das Objekt zurück, status_seit läuft neu, bearbeitet_von gesetzt', async () => {
      const anfrageId = await anfrageAnlegen();
      const vorher = await lesen(anfrageId);
      const res = await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { status: 'in_arbeit', notiz: '  Rückruf am Montag ' });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([...ANFRAGE_FELDER].sort());
      expect(res.body).toMatchObject({ id: anfrageId, status: 'in_arbeit', notiz: 'Rückruf am Montag' });
      const nachher = await lesen(anfrageId);
      expect(nachher.bearbeitet_von).toBe(USERS.orgAdminSuper.id);
      expect(nachher.status_seit.getTime()).toBeGreaterThan(vorher.status_seit.getTime());
    });

    it('nur die Notiz: Status und status_seit bleiben; leere Notiz wird null', async () => {
      const anfrageId = await anfrageAnlegen();
      const vorher = await lesen(anfrageId);
      await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { notiz: 'erst' });
      const res = await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { notiz: '   ' });
      expect(res.body).toMatchObject({ status: 'neu', notiz: null });
      expect((await lesen(anfrageId)).status_seit).toEqual(vorher.status_seit);
    });

    it('derselbe Status noch einmal: status_seit bleibt (die 180-Tage-Frist beginnt nicht neu)', async () => {
      const anfrageId = await anfrageAnlegen({ status: 'abgelehnt' });
      const vorher = await lesen(anfrageId);
      await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { status: 'abgelehnt' });
      expect((await lesen(anfrageId)).status_seit).toEqual(vorher.status_seit);
    });

    it('verboten: leerer Körper 400, unbekannter Status 400, unbekannte Anfrage 404', async () => {
      const anfrageId = await anfrageAnlegen();
      expect((await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, {})).status).toBe(400);
      expect((await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { status: 'erledigt' })).status).toBe(400);
      expect((await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { notiz: 'x'.repeat(5001) })).status).toBe(400);
      expect((await als(SUPER()).patch('/api/support/anfragen/99999', { notiz: 'x' })).status).toBe(404);
      expect((await lesen(anfrageId)).status).toBe('neu');
    });

    it('verboten: aus einer angelegten Anfrage wird kein anderer Status (409); die Notiz geht', async () => {
      const anfrageId = await anfrageAnlegen();
      await db.query("UPDATE gemeinde_anfragen SET status = 'angelegt', organization_id = $2 WHERE id = $1", [anfrageId, ORGS.andereGemeinde.id]);
      const res = await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { status: 'abgelehnt' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Aus dieser Anfrage ist schon eine Gemeinde entstanden. Der Status bleibt „angelegt".');
      const notiz = await als(SUPER()).patch(`/api/support/anfragen/${anfrageId}`, { notiz: 'Vertrag unterschrieben' });
      expect(notiz.status).toBe(200);
      expect(notiz.body).toMatchObject({ status: 'angelegt', notiz: 'Vertrag unterschrieben', organization_id: ORGS.andereGemeinde.id });
    });
  });

  describe('POST /anfragen/:id/anlegen', () => {
    const GEMEINDE = {
      name: 'Kirchengemeinde Büsum',
      contact_name: 'Pastorin Probe',
      contact_email: 'buero@buesum.example',
      contact_phone: '04834 1',
      max_konfis: 50,
      admin_username: 'leitung.buesum',
      admin_display_name: 'Pastorin Probe',
      admin_email: 'probe@buesum.example',
      admin_password: 'Sicher!Passwort1',
    };
    const anlegen = (anfrageId, felder = {}, token = SUPER()) =>
      als(token).post(`/api/support/anfragen/${anfrageId}/anlegen`, { ...GEMEINDE, ...felder });
    const anfrageLesen = async (anfrageId) => (await db.query(
      'SELECT status, organization_id, bearbeitet_von FROM gemeinde_anfragen WHERE id = $1', [anfrageId])).rows[0];
    const gemeinden = async () => (await db.query('SELECT COUNT(*)::int AS n FROM organizations')).rows[0].n;

    it('erlaubt: 201 { organization_id, admin_id }; Gemeinde mit Systemname, Zuordnung und erster Gemeindeleitung; Anfrage angelegt', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen', 'Nordkirche');
      const anfrageId = await anfrageAnlegen();
      const res = await anlegen(anfrageId, { kirchenkreis_id: kk.id }, supportToken());
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['admin_id', 'organization_id']);

      const { rows: [org] } = await db.query(
        'SELECT name, slug, display_name, kirchenkreis, kirchenkreis_id, max_konfis, is_trial, contact_email FROM organizations WHERE id = $1',
        [res.body.organization_id]);
      expect(org).toEqual({
        name: 'kirchengemeinde-buesum', slug: 'kirchengemeinde-buesum', display_name: 'Kirchengemeinde Büsum',
        kirchenkreis: 'Dithmarschen', kirchenkreis_id: kk.id, max_konfis: 50, is_trial: true,
        contact_email: 'buero@buesum.example',
      });
      const { rows: [leitung] } = await db.query(
        'SELECT u.id, u.organization_id, u.email, r.name AS rolle FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = $1',
        ['leitung.buesum']);
      expect(leitung).toEqual({ id: res.body.admin_id, organization_id: res.body.organization_id, email: 'probe@buesum.example', rolle: 'org_admin' });
      expect(await anfrageLesen(anfrageId)).toEqual({ status: 'angelegt', organization_id: res.body.organization_id, bearbeitet_von: SUPPORT.id });

      // Die erste Gemeindeleitung meldet sich an.
      const login = await request(app).post('/api/auth/login').send({ username: 'leitung.buesum', password: 'Sicher!Passwort1' });
      expect(login.status).toBe(200);
    });

    it('mit display_name ist name der Systemname wie bei POST /organizations', async () => {
      const anfrageId = await anfrageAnlegen();
      const res = await anlegen(anfrageId, { name: 'kirchengemeinde-bsum', display_name: 'Kirchengemeinde Büsum' });
      expect(res.status).toBe(201);
      const { rows: [org] } = await db.query('SELECT name, slug, display_name FROM organizations WHERE id = $1', [res.body.organization_id]);
      expect(org).toEqual({ name: 'kirchengemeinde-buesum', slug: 'kirchengemeinde-buesum', display_name: 'Kirchengemeinde Büsum' });
    });

    it('ohne admin_email bekommt die Gemeindeleitung die Adresse der Gemeinde', async () => {
      const anfrageId = await anfrageAnlegen();
      await anlegen(anfrageId, { admin_email: '' });
      const { rows: [u] } = await db.query("SELECT email FROM users WHERE username = 'leitung.buesum'");
      expect(u.email).toBe('buero@buesum.example');
    });

    it.each([
      ['Benutzername vergeben', { admin_username: USERS.admin1.username }, 409, { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' }],
      ['Systemname vergeben', { name: ORGS.testGemeinde.slug, display_name: 'Test' }, 409, { error: 'Gemeinde-Slug existiert bereits' }],
      ['Konfi-Limit ungültig', { max_konfis: -3 }, 400, { error: 'Konfi-Limit muss eine Zahl ab 0 oder leer sein' }],
      ['Kirchenkreis unbekannt', { kirchenkreis_id: 99999 }, 400, { error: 'Kirchenkreis nicht gefunden' }],
    ])('verboten: %s, nichts angelegt, Anfrage unverändert', async (_fall, felder, status, body) => {
      const anfrageId = await anfrageAnlegen();
      const vorher = await gemeinden();
      const res = await anlegen(anfrageId, felder);
      expect(res.status).toBe(status);
      expect(res.body).toEqual(body);
      expect(await gemeinden()).toBe(vorher);
      expect(await anfrageLesen(anfrageId)).toEqual({ status: 'neu', organization_id: null, bearbeitet_von: null });
    });

    it.each([
      ['ohne Name', { name: '' }, 'name'],
      ['ohne Benutzername', { admin_username: ' ' }, 'admin_username'],
      ['schwaches Passwort', { admin_password: 'kurz' }, 'admin_password'],
      ['ohne Anzeigename der Leitung', { admin_display_name: '' }, 'admin_display_name'],
      ['Kirchenkreis kein Verweis', { kirchenkreis_id: 'abc' }, 'kirchenkreis_id'],
    ])('verboten: %s -> 400 mit Feld', async (_fall, felder, feld) => {
      const anfrageId = await anfrageAnlegen();
      const res = await anlegen(anfrageId, felder);
      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toContain(feld);
    });

    it('verboten: unbekannte Anfrage 404; schon angelegt 409 (keine zweite Gemeinde)', async () => {
      expect((await anlegen(99999)).status).toBe(404);
      const anfrageId = await anfrageAnlegen();
      expect((await anlegen(anfrageId)).status).toBe(201);
      const vorher = await gemeinden();
      const zweite = await anlegen(anfrageId, { name: 'Andere', admin_username: 'leitung.andere' });
      expect(zweite.status).toBe(409);
      expect(zweite.body).toEqual({ error: 'Aus dieser Anfrage ist schon eine Gemeinde entstanden.' });
      expect(await gemeinden()).toBe(vorher);
    });

    describe('ganz oder gar nicht', () => {
      beforeEach(async () => {
        await db.query(`CREATE OR REPLACE FUNCTION test_level_sperre() RETURNS trigger AS $$
          BEGIN RAISE EXCEPTION 'Level-Anlage scheitert (Test)'; END; $$ LANGUAGE plpgsql`);
        await db.query('CREATE TRIGGER test_level_sperre BEFORE INSERT ON levels FOR EACH ROW EXECUTE FUNCTION test_level_sperre()');
      });
      afterEach(async () => {
        await db.query('DROP TRIGGER IF EXISTS test_level_sperre ON levels');
        await db.query('DROP FUNCTION IF EXISTS test_level_sperre()');
      });

      it('scheitert die Anlage mittendrin: 500, keine halbe Gemeinde, Anfrage unverändert', async () => {
        const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          const anfrageId = await anfrageAnlegen();
          const vorher = await gemeinden();
          const res = await anlegen(anfrageId);
          expect(res.status).toBe(500);
          expect(await gemeinden()).toBe(vorher);
          expect(await anfrageLesen(anfrageId)).toEqual({ status: 'neu', organization_id: null, bearbeitet_von: null });
          // Protokoll ohne Daten der Anfrage
          expect(fehler.mock.calls.map((c) => c.join(' ')).join('\n')).not.toMatch(/Büsum|Probe|buesum/);
        } finally {
          fehler.mockRestore();
        }
      });
    });
  });

  // ==========================================================================
  // Struktur
  // ==========================================================================
  describe('Landeskirchen', () => {
    it('anlegen, umbenennen, auflisten mit Kirchenkreisen', async () => {
      const neu = await als(SUPER()).post('/api/support/landeskirchen', { name: '  Nordkirche ' });
      expect(neu.status).toBe(201);
      expect(neu.body).toEqual({ id: expect.any(Number), name: 'Nordkirche', kirchenkreise: [] });
      await db.query("INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Nordfriesland', $1), ('Dithmarschen', $1)", [neu.body.id]);
      await als(SUPER()).post('/api/support/landeskirchen', { name: 'Bayern' });

      const um = await als(SUPER()).put(`/api/support/landeskirchen/${neu.body.id}`, { name: 'Nordkirche (ELKiNo)' });
      expect(um.status).toBe(200);
      expect(um.body.name).toBe('Nordkirche (ELKiNo)');

      const liste = await als(SUPER()).get('/api/support/landeskirchen');
      expect(liste.body).toEqual([
        { id: expect.any(Number), name: 'Bayern', kirchenkreise: [] },
        { id: neu.body.id, name: 'Nordkirche (ELKiNo)', kirchenkreise: [
          { id: expect.any(Number), name: 'Dithmarschen' }, { id: expect.any(Number), name: 'Nordfriesland' },
        ] },
      ]);
    });

    it('verboten: doppelter Name (ohne Groß/klein) 409, leerer Name 400, unbekannt 404', async () => {
      await als(SUPER()).post('/api/support/landeskirchen', { name: 'Nordkirche' });
      const doppelt = await als(SUPER()).post('/api/support/landeskirchen', { name: 'NORDKIRCHE' });
      expect(doppelt.status).toBe(409);
      expect(doppelt.body).toEqual({ error: 'Diese Landeskirche gibt es schon' });
      expect((await als(SUPER()).post('/api/support/landeskirchen', { name: ' ' })).status).toBe(400);
      expect((await als(SUPER()).put('/api/support/landeskirchen/99999', { name: 'X' })).status).toBe(404);
      expect((await als(SUPER()).delete('/api/support/landeskirchen/99999')).status).toBe(404);
    });

    it('löschen: mit Kirchenkreisen 409 (nichts gelöscht), ohne 200', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen', 'Nordkirche');
      const voll = await als(SUPER()).delete(`/api/support/landeskirchen/${kk.landeskirche_id}`);
      expect(voll.status).toBe(409);
      expect(voll.body.error).toBe('An dieser Landeskirche hängen noch 1 Kirchenkreise. Ordne sie zuerst einer anderen zu oder lösche sie.');
      await db.query('UPDATE kirchenkreise SET landeskirche_id = NULL');
      const leer = await als(SUPER()).delete(`/api/support/landeskirchen/${kk.landeskirche_id}`);
      expect(leer.status).toBe(200);
      expect(leer.body).toEqual({ message: 'Landeskirche gelöscht' });
    });
  });

  describe('Kirchenkreise', () => {
    it('anlegen mit und ohne Landeskirche; derselbe Name in einer anderen Landeskirche geht', async () => {
      const lk = await als(SUPER()).post('/api/support/landeskirchen', { name: 'Nordkirche' });
      const mit = await als(SUPER()).post('/api/support/kirchenkreise', { name: 'Dithmarschen', landeskirche_id: lk.body.id });
      expect(mit.status).toBe(201);
      expect(mit.body).toEqual({ id: expect.any(Number), name: 'Dithmarschen', landeskirche_id: lk.body.id, landeskirche: 'Nordkirche', anzahl_gemeinden: 0 });
      const ohne = await als(SUPER()).post('/api/support/kirchenkreise', { name: 'Dithmarschen' });
      expect(ohne.status).toBe(201);
      expect(ohne.body).toMatchObject({ landeskirche_id: null, landeskirche: null });

      const liste = await als(SUPER()).get('/api/support/kirchenkreise');
      expect(liste.body.map((k) => [k.name, k.landeskirche])).toEqual([['Dithmarschen', null], ['Dithmarschen', 'Nordkirche']]);
    });

    it('verboten: doppelt in derselben Landeskirche 409, unbekannte Landeskirche 400', async () => {
      await als(SUPER()).post('/api/support/kirchenkreise', { name: 'Dithmarschen' });
      const doppelt = await als(SUPER()).post('/api/support/kirchenkreise', { name: 'dithmarschen' });
      expect(doppelt.status).toBe(409);
      expect(doppelt.body).toEqual({ error: 'Diesen Kirchenkreis gibt es in dieser Landeskirche schon' });
      const fremd = await als(SUPER()).post('/api/support/kirchenkreise', { name: 'X', landeskirche_id: 99999 });
      expect(fremd.status).toBe(400);
      expect(fremd.body).toEqual({ error: 'Landeskirche nicht gefunden' });
    });

    it('umbenennen spiegelt den Namen in die Textspalte seiner Gemeinden; landeskirche_id nur, wenn mitgeschickt', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarchen', 'Nordkirche');
      await db.query('UPDATE organizations SET kirchenkreis_id = $1, kirchenkreis = $2 WHERE id = $3', [kk.id, 'Dithmarchen', ORGS.testGemeinde.id]);
      const res = await als(SUPER()).put(`/api/support/kirchenkreise/${kk.id}`, { name: 'Dithmarschen' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: kk.id, name: 'Dithmarschen', landeskirche_id: kk.landeskirche_id, landeskirche: 'Nordkirche', anzahl_gemeinden: 1 });
      const { rows: [org] } = await db.query('SELECT kirchenkreis, kirchenkreis_id FROM organizations WHERE id = $1', [ORGS.testGemeinde.id]);
      expect(org).toEqual({ kirchenkreis: 'Dithmarschen', kirchenkreis_id: kk.id });

      const ohne = await als(SUPER()).put(`/api/support/kirchenkreise/${kk.id}`, { name: 'Dithmarschen', landeskirche_id: null });
      expect(ohne.body).toMatchObject({ landeskirche_id: null, landeskirche: null });
    });

    it('löschen: Gemeinden verlieren Zuordnung und Text, bleiben selbst', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen');
      await db.query('UPDATE organizations SET kirchenkreis_id = $1, kirchenkreis = $2', [kk.id, 'Dithmarschen']);
      const res = await als(SUPER()).delete(`/api/support/kirchenkreise/${kk.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Kirchenkreis gelöscht', gemeinden_ohne_zuordnung: 2 });
      const { rows } = await db.query('SELECT kirchenkreis, kirchenkreis_id FROM organizations ORDER BY id');
      expect(rows).toEqual([{ kirchenkreis: null, kirchenkreis_id: null }, { kirchenkreis: null, kirchenkreis_id: null }]);
      expect((await als(SUPER()).delete(`/api/support/kirchenkreise/${kk.id}`)).status).toBe(404);
    });
  });

  // ==========================================================================
  // Zuordnung an der Gemeinde (routes/organizations.js)
  // ==========================================================================
  describe('Zuordnung über /organizations', () => {
    const ORG = ORGS.testGemeinde;
    const stammdaten = (felder = {}) => ({
      name: ORG.name, slug: ORG.slug, display_name: ORG.display_name, kirchenkreis: 'Dithmarschen', ...felder,
    });
    const zuordnung = async () => (await db.query(
      'SELECT kirchenkreis, kirchenkreis_id FROM organizations WHERE id = $1', [ORG.id])).rows[0];

    it('Super-Admin setzt kirchenkreis_id: Name wandert in die Textspalte; null hebt beides auf', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen', 'Nordkirche');
      const res = await als(SUPER()).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis: 'egal', kirchenkreis_id: kk.id }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Gemeinde erfolgreich aktualisiert' });
      expect(await zuordnung()).toEqual({ kirchenkreis: 'Dithmarschen', kirchenkreis_id: kk.id });

      await als(SUPER()).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis_id: null }));
      expect(await zuordnung()).toEqual({ kirchenkreis: null, kirchenkreis_id: null });
    });

    it('verboten: unbekannter Kirchenkreis 400, kein Verweis 400 -- nichts geändert', async () => {
      const unbekannt = await als(SUPER()).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis_id: 99999 }));
      expect(unbekannt.status).toBe(400);
      expect(unbekannt.body).toEqual({ error: 'Kirchenkreis nicht gefunden' });
      const kaputt = await als(SUPER()).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis_id: 'abc' }));
      expect(kaputt.status).toBe(400);
      expect(kaputt.body).toEqual({ error: 'Ungültiger Kirchenkreis' });
      expect(await zuordnung()).toEqual({ kirchenkreis: null, kirchenkreis_id: null });
    });

    it('verboten: die Gemeindeleitung setzt keine Zuordnung (Feld übergangen, wie Laufzeit und Sperre)', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen');
      const res = await als(generateToken('orgAdmin1')).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis: null, kirchenkreis_id: kk.id }));
      expect(res.status).toBe(200);
      expect(await zuordnung()).toEqual({ kirchenkreis: null, kirchenkreis_id: null });
    });

    it('alte App (nur Text): derselbe Text lässt die Zuordnung stehen, ein anderer beendet sie', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen');
      await db.query('UPDATE organizations SET kirchenkreis_id = $1, kirchenkreis = $2 WHERE id = $3', [kk.id, 'Dithmarschen', ORG.id]);
      await als(SUPER()).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis: ' dithmarschen ' }));
      expect(await zuordnung()).toEqual({ kirchenkreis: ' dithmarschen ', kirchenkreis_id: kk.id });
      await als(generateToken('orgAdmin1')).put(`/api/organizations/${ORG.id}`, stammdaten({ kirchenkreis: 'Nordfriesland' }));
      expect(await zuordnung()).toEqual({ kirchenkreis: 'Nordfriesland', kirchenkreis_id: null });
    });

    it('GET /organizations: dieselben Felder wie bisher, dazu kirchenkreis_id, landeskirche_id und landeskirche', async () => {
      // Die Felder bis 2.3.0 (organizations.* und die drei Zaehler).
      const BISHER = [
        'id', 'name', 'slug', 'display_name', 'description', 'logo_url', 'contact_email', 'contact_phone',
        'address', 'website_url', 'is_active', 'created_at', 'updated_at', 'max_konfis', 'kirchenkreis',
        'trial_ends_at', 'is_trial', 'contact_name', 'license_reminder_sent_at',
        'user_count', 'konfi_count', 'event_count',
      ];
      const kk = await kirchenkreisAnlegen('Dithmarschen', 'Nordkirche');
      await db.query('UPDATE organizations SET kirchenkreis_id = $1, kirchenkreis = $2 WHERE id = $3', [kk.id, 'Dithmarschen', ORG.id]);
      const res = await als(SUPER()).get('/api/organizations');
      expect(res.status).toBe(200);
      const eins = res.body.find((o) => o.id === ORG.id);
      const zwei = res.body.find((o) => o.id === ORGS.andereGemeinde.id);
      expect(Object.keys(eins).sort()).toEqual([...BISHER, 'kirchenkreis_id', 'landeskirche_id', 'landeskirche'].sort());
      expect(eins).toMatchObject({ kirchenkreis: 'Dithmarschen', kirchenkreis_id: kk.id, landeskirche_id: kk.landeskirche_id, landeskirche: 'Nordkirche' });
      expect(zwei).toMatchObject({ kirchenkreis_id: null, landeskirche_id: null, landeskirche: null });
    });

    it('POST /organizations nimmt kirchenkreis_id (additiv); unbekannt 400 ohne Anlage', async () => {
      const kk = await kirchenkreisAnlegen('Dithmarschen');
      const body = {
        name: 'probe', slug: 'probe', display_name: 'Probe', kirchenkreis: 'Freitext',
        admin_username: 'leitung.probe', admin_password: 'Sicher!Passwort1', admin_display_name: 'Leitung',
      };
      const falsch = await als(SUPER()).post('/api/organizations', { ...body, kirchenkreis_id: 99999 });
      expect(falsch.status).toBe(400);
      expect(falsch.body).toEqual({ error: 'Kirchenkreis nicht gefunden' });
      const res = await als(SUPER()).post('/api/organizations', { ...body, kirchenkreis_id: kk.id });
      expect(res.status).toBe(201);
      const { rows: [org] } = await db.query('SELECT kirchenkreis, kirchenkreis_id FROM organizations WHERE id = $1', [res.body.id]);
      expect(org).toEqual({ kirchenkreis: 'Dithmarschen', kirchenkreis_id: kk.id });
    });
  });

  // ==========================================================================
  // Statistik
  // ==========================================================================
  describe('GET /statistik', () => {
    beforeEach(async () => {
      // Teamer 2 (zuhause in Gemeinde 2) arbeitet auch in Gemeinde 1 mit.
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.teamer2.id, ORGS.testGemeinde.id, ROLES.teamer.id]);
      // Die Gemeindeleitung 1 steht zusaetzlich als Teamer:in in ihrer eigenen
      // Gemeinde (Altbestand aus Migration 101): zaehlt einmal, als Leitung.
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.orgAdmin1.id, ORGS.testGemeinde.id, ROLES.teamer.id]);
      // Das Support-Konto ohne Gemeinde ist Gast in Gemeinde 1: zaehlt nicht.
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [SUPPORT.id, ORGS.testGemeinde.id, ROLES.orgAdmin.id]);
      // Geloescht und gesperrt zaehlen nicht.
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin2.id]);
      // Aktiv in 30 Tagen: Konfi 1 (Anmeldung), Teamer 2 (Refresh, in beiden
      // Gemeinden); Admin 1 vor 40 Tagen -- nicht.
      await db.query("UPDATE users SET last_login_at = NOW() - interval '2 days' WHERE id = $1", [USERS.konfi1.id]);
      await db.query("UPDATE users SET last_login_at = NOW() - interval '40 days' WHERE id = $1", [USERS.admin1.id]);
      await refreshTokenAnlegen(db, USERS.teamer2.id);
      // Ein zweiter Jahrgang in Gemeinde 1, eine dritte Gemeinde ohne Konten.
      await db.query("INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('2026/2027', $1, '2027-05-01')", [ORGS.testGemeinde.id]);
      await db.query("INSERT INTO organizations (id, name, slug, display_name, is_active) VALUES (3, 'leer', 'leer', 'Leere Gemeinde', false)");
      const kk = await kirchenkreisAnlegen('Dithmarschen', 'Nordkirche');
      await db.query('UPDATE organizations SET kirchenkreis_id = $1, kirchenkreis = $2 WHERE id = $3', [kk.id, 'Dithmarschen', ORGS.testGemeinde.id]);
    });

    it('je Gemeinde: Zuordnung, Konten je Rolle aus beiden Quellen, aktive Konten, Jahrgänge -- konkrete Zahlen', async () => {
      const res = await als(supportToken()).get('/api/support/statistik');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['gemeinden', 'stand']);
      expect(new Date(res.body.stand).toISOString()).toBe(res.body.stand);
      const { rows: [{ id: lk }] } = await db.query("SELECT id FROM landeskirchen WHERE name = 'Nordkirche'");
      const { rows: [{ id: kk }] } = await db.query("SELECT id FROM kirchenkreise WHERE name = 'Dithmarschen'");

      expect(res.body.gemeinden).toEqual([
        {
          id: ORGS.andereGemeinde.id, name: 'Andere Gemeinde', systemname: 'Andere Gemeinde', is_active: true,
          kirchenkreis_id: null, kirchenkreis: null, landeskirche_id: null, landeskirche: null,
          // konfi3; teamer2; admin2 gesperrt; orgAdmin2
          konten: { konfi: 1, teamer: 1, admin: 0, org_admin: 1 },
          aktiv_30_tage: 1, // teamer2
          jahrgaenge: 1,
        },
        {
          id: 3, name: 'Leere Gemeinde', systemname: 'leer', is_active: false,
          kirchenkreis_id: null, kirchenkreis: null, landeskirche_id: null, landeskirche: null,
          konten: { konfi: 0, teamer: 0, admin: 0, org_admin: 0 },
          aktiv_30_tage: 0,
          jahrgaenge: 0,
        },
        {
          id: ORGS.testGemeinde.id, name: 'Test-Gemeinde St. Martin', systemname: 'Test-Gemeinde', is_active: true,
          kirchenkreis_id: Number(kk), kirchenkreis: 'Dithmarschen', landeskirche_id: Number(lk), landeskirche: 'Nordkirche',
          // konfi1 (konfi2 geloescht); teamer1 + teamer2 als Gast; admin1;
          // orgAdmin1 (einmal) + orgAdminSuper -- nicht der Support-Gast,
          // nicht das Konto mit der Rolle super_admin
          konten: { konfi: 1, teamer: 2, admin: 1, org_admin: 2 },
          aktiv_30_tage: 2, // konfi1, teamer2
          jahrgaenge: 2,
        },
      ]);
    });

    it('keine Namen von Personen in der Antwort', async () => {
      const res = await als(SUPER()).get('/api/support/statistik');
      const text = JSON.stringify(res.body);
      for (const u of [...Object.values(USERS), SUPPORT]) {
        expect(text).not.toContain(u.display_name);
        expect(text).not.toContain(`"${u.username}"`);
      }
    });
  });
});
