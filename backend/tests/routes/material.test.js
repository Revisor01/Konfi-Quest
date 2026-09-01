const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Material Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let orgAdmin2Token;
  let teamer2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    orgAdmin2Token = generateToken('orgAdmin2');
    teamer2Token = generateToken('teamer2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // TAG ENDPOINTS
  // ================================================================
  // Die Tag-Tests standen hier bis zum 27.08.2026. Die Routen wurden
  // entfernt (Simons Entscheidung): vollstaendiges CRUD ohne eine Zeile
  // Oberflaeche und ohne Erwaehnung im Handbuch, Befund 13 aus dem
  // Rollen-Bericht. In Produktion nachgemessen: 1 Tag, 0 Zuordnungen.

  // ================================================================
  describe('GET /api/material', () => {
    it('Teamer bekommt 200 + Material-Liste', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/material', () => {
    it('OrgAdmin erstellt Material -> 201', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Neues Material', description: 'Eine Beschreibung' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Neues Material');
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ title: 'Test-Material' });

      expect(res.status).toBe(403);
    });

    it('Fehlender Titel gibt 400', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ description: 'Ohne Titel' });

      expect(res.status).toBe(400);
    });

  });

  // ================================================================
  // LINK STATT DATEI (Entscheidung Simon, 31.08.2026)
  // Material traegt entweder Dateien oder einen Link. Geprueft wird das
  // SCHEMA ueber new URL(); alles ausser http/https wird abgewiesen, damit
  // kein javascript:-Link in ein href der App geraet.
  // ================================================================
  describe('Link am Material', () => {
    it('https-Link wird angenommen und zurueckgegeben', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Gottesbilder', link_url: 'https://konfi-quest.de/gottesbilder' });

      expect(res.status).toBe(201);
      expect(res.body.link_url).toBe('https://konfi-quest.de/gottesbilder');
    });

    it('http-Link wird ebenfalls angenommen', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Alte Seite', link_url: 'http://gemeinde.example/seite' });

      expect(res.status).toBe(201);
      expect(res.body.link_url).toBe('http://gemeinde.example/seite');
    });

    it('Umgebende Leerzeichen werden abgeschnitten', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Mit Leerzeichen', link_url: '  https://konfi-quest.de/gottesbilder  ' });

      expect(res.status).toBe(201);
      expect(res.body.link_url).toBe('https://konfi-quest.de/gottesbilder');
    });

    it('Ohne Link bleibt das Feld null', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Nur Dateien' });

      expect(res.status).toBe(201);
      expect(res.body.link_url).toBeNull();
    });

    it('Leerer Link wird als "kein Link" gespeichert', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Leerer Link', link_url: '   ' });

      expect(res.status).toBe(201);
      expect(res.body.link_url).toBeNull();
    });

    it.each([
      ['javascript:alert(1)'],
      ['data:text/html,<script>alert(1)</script>'],
      ['file:///etc/passwd'],
      ['ftp://server.example/datei.pdf'],
      ['konfi-quest.de/gottesbilder'],
      ['//konfi-quest.de/gottesbilder'],
    ])('Verbotener Link %s gibt 400 und legt nichts an', async (linkUrl) => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Boeser Link', link_url: linkUrl });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Der Link muss mit http:// oder https:// beginnen');

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM materials WHERE title = $1',
        ['Boeser Link']
      );
      expect(rows[0].anzahl).toBe(0);
    });

    it('Der Link taucht in Liste und Detail auf', async () => {
      const erstellt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Gottesbilder', link_url: 'https://konfi-quest.de/gottesbilder' });
      expect(erstellt.status).toBe(201);

      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(liste.status).toBe(200);
      const ausListe = liste.body.find(m => m.id === erstellt.body.id);
      expect(ausListe.link_url).toBe('https://konfi-quest.de/gottesbilder');

      const detail = await request(app)
        .get(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.link_url).toBe('https://konfi-quest.de/gottesbilder');
    });

    it('Material ohne Link liefert link_url = null (Altbestand bleibt lesbar)', async () => {
      const { rows: [alt] } = await db.query(
        `INSERT INTO materials (title, organization_id, created_by)
         VALUES ('Altbestand', $1, $2) RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );

      const detail = await request(app)
        .get(`/api/material/${alt.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.link_url).toBeNull();
      // Die bisherige Antwortform bleibt vollstaendig erhalten.
      expect(detail.body.title).toBe('Altbestand');
      expect(detail.body.files).toEqual([]);
      expect(detail.body.events).toEqual([]);
      expect(detail.body.jahrgaenge).toEqual([]);
    });

    it('by-event liefert den Link mit', async () => {
      const erstellt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          title: 'Termin-Link',
          link_url: 'https://konfi-quest.de/gottesbilder',
          event_ids: [EVENTS.gottesdienstEvent.id],
        });
      expect(erstellt.status).toBe(201);

      const res = await request(app)
        .get(`/api/material/by-event/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].link_url).toBe('https://konfi-quest.de/gottesbilder');
    });

    it('PUT setzt einen Link nachtraeglich', async () => {
      const erstellt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Erst ohne Link' });

      const put = await request(app)
        .put(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_url: 'https://konfi-quest.de/gottesbilder' });
      expect(put.status).toBe(200);

      const detail = await request(app)
        .get(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(detail.body.link_url).toBe('https://konfi-quest.de/gottesbilder');
    });

    it('PUT mit leerem Link entfernt ihn wieder', async () => {
      const erstellt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Mit Link', link_url: 'https://konfi-quest.de/gottesbilder' });

      const put = await request(app)
        .put(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_url: '' });
      expect(put.status).toBe(200);

      const detail = await request(app)
        .get(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(detail.body.link_url).toBeNull();
    });

    it('PUT mit verbotenem Link gibt 400 und laesst den alten stehen', async () => {
      const erstellt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Mit Link', link_url: 'https://konfi-quest.de/gottesbilder' });

      const put = await request(app)
        .put(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Neuer Titel', link_url: 'javascript:alert(1)' });
      expect(put.status).toBe(400);
      expect(put.body.error).toBe('Der Link muss mit http:// oder https:// beginnen');

      const detail = await request(app)
        .get(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(detail.body.link_url).toBe('https://konfi-quest.de/gottesbilder');
      // Auch der Titel bleibt unveraendert: die Pruefung greift vor dem Schreiben.
      expect(detail.body.title).toBe('Mit Link');
    });

    it('PUT ohne link_url laesst den bestehenden Link unangetastet', async () => {
      const erstellt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Mit Link', link_url: 'https://konfi-quest.de/gottesbilder' });

      const put = await request(app)
        .put(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Nur der Titel aendert sich' });
      expect(put.status).toBe(200);

      const detail = await request(app)
        .get(`/api/material/${erstellt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(detail.body.link_url).toBe('https://konfi-quest.de/gottesbilder');
      expect(detail.body.title).toBe('Nur der Titel aendert sich');
    });

    it('Teamer:in darf keinen Link setzen (403)', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ title: 'Teamer-Link', link_url: 'https://konfi-quest.de/gottesbilder' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/material/:id', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Detail-Material', description: 'Details' });
      materialId = res.body.id;
    });

    it('Teamer bekommt 200 + Material-Details', async () => {
      const res = await request(app)
        .get(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Detail-Material');
      expect(res.body.files).toBeDefined();
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .get('/api/material/99999')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/material/:id', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Altes Material' });
      materialId = res.body.id;
    });

    it('OrgAdmin aktualisiert Material -> 200', async () => {
      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Aktualisiertes Material' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/material/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Gibts nicht' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/material/:id', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Loesch-Material' });
      materialId = res.body.id;
    });

    it('OrgAdmin loescht Material -> 200', async () => {
      const res = await request(app)
        .delete(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/material/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/material/by-event/:eventId', () => {
    it('Teamer bekommt Material fuer Event (200, leer)', async () => {
      const res = await request(app)
        .get(`/api/material/by-event/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Material mit Event-Zuordnung wird gefunden', async () => {
      // Material mit Event erstellen
      const matRes = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          title: 'Event-Material',
          event_ids: [EVENTS.gottesdienstEvent.id],
        });

      expect(matRes.status).toBe(201);

      const res = await request(app)
        .get(`/api/material/by-event/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Event-Material');
    });
  });

  // ================================================================
  // FILE ENDPOINTS (Erreichbarkeit + Auth)
  // ================================================================
  describe('POST /api/material/:id/files', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'File-Material' });
      materialId = res.body.id;
    });

    it('Ohne Datei ergibt 400', async () => {
      const res = await request(app)
        .post(`/api/material/${materialId}/files`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Erwartet 400 (keine Dateien) oder ggf. einen anderen Fehler — kein 500 crash
      expect(res.status).toBeLessThan(500);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/material/${materialId}/files`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/material/files/:fileId', () => {
    it('OrgAdmin loescht nicht-existierende Datei -> 404', async () => {
      const res = await request(app)
        .delete('/api/material/files/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .delete('/api/material/files/1')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/material/files/:filename', () => {
    it('Ungueltige Dateiname-Format gibt 400', async () => {
      const res = await request(app)
        .get('/api/material/files/invalid-filename')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(400);
    });

    it('Gueltige Hex-Datei die nicht existiert gibt 404', async () => {
      // Dateinamen sind 64 Hex-Zeichen (randomBytes(32).toString('hex'))
      const res = await request(app)
        .get('/api/material/files/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // ORG-ISOLATION
  // ================================================================
  describe('Org-Isolation', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Org1-Material' });
      materialId = res.body.id;
    });

    it('Teamer2 (Org2) sieht kein Material aus Org1', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamer2Token}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(m => m.id);
      expect(ids).not.toContain(materialId);
    });

    it('OrgAdmin2 kann Material aus Org1 nicht loeschen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
    });
  });
  // Entscheidung Simon, 24.08.2026: Material mit Jahrgang sehen nur die
  // Teamer:innen dieses Jahrgangs; Material ohne Jahrgang alle. Die Leitung
  // sieht immer alles. Vorher galt nur die Organisationsgrenze, die
  // Jahrgangs-Bindung war reine Suchhilfe.
  describe('Sichtbarkeit nach Jahrgang', () => {
    let ohneJahrgang;
    let mitJahrgang1;
    let mitFremdemJahrgang;

    // Teamer1 ist Jahrgang 1 zugewiesen (Seed), nicht dem zweiten.
    const material = async (titel, jahrgangId) => {
      const { rows: [m] } = await db.query(
        `INSERT INTO materials (title, organization_id, created_by)
         VALUES ($1, $2, $3) RETURNING id`,
        [titel, ORGS.testGemeinde.id, USERS.admin1.id]
      );
      if (jahrgangId) {
        await db.query(
          'INSERT INTO material_jahrgaenge (material_id, jahrgang_id) VALUES ($1, $2)',
          [m.id, jahrgangId]
        );
      }
      return m.id;
    };

    let zweiterJahrgang;

    beforeEach(async () => {
      const { rows: [jg] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('2026/2027', $1, '2027-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      zweiterJahrgang = jg.id;

      ohneJahrgang = await material('Fuer alle', null);
      mitJahrgang1 = await material('Nur Jahrgang 1', JAHRGAENGE.jahrgang1.id);
      mitFremdemJahrgang = await material('Nur zweiter Jahrgang', zweiterJahrgang);
    });

    const listeFuer = async (token) => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      return res.body.map(m => m.id);
    };

    it('Teamer:in sieht Material ohne Jahrgang', async () => {
      expect(await listeFuer(teamerToken)).toContain(ohneJahrgang);
    });

    it('Teamer:in sieht Material des eigenen Jahrgangs', async () => {
      expect(await listeFuer(teamerToken)).toContain(mitJahrgang1);
    });

    it('Teamer:in sieht Material eines fremden Jahrgangs NICHT', async () => {
      expect(await listeFuer(teamerToken)).not.toContain(mitFremdemJahrgang);
    });

    it('Die Leitung sieht alles, auch fremde Jahrgaenge', async () => {
      const ids = await listeFuer(orgAdminToken);
      expect(ids).toContain(ohneJahrgang);
      expect(ids).toContain(mitJahrgang1);
      expect(ids).toContain(mitFremdemJahrgang);
    });

    it('Das Detail eines fremden Jahrgangs bleibt der Teamer:in verschlossen', async () => {
      const res = await request(app)
        .get(`/api/material/${mitFremdemJahrgang}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(404);
    });

    it('Das Detail des eigenen Jahrgangs ist abrufbar', async () => {
      const res = await request(app)
        .get(`/api/material/${mitJahrgang1}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mitJahrgang1);
    });

    it('Ohne can_view zaehlt die Zuweisung nicht', async () => {
      await db.query(
        'UPDATE user_jahrgang_assignments SET can_view = false WHERE user_id = $1 AND jahrgang_id = $2',
        [USERS.teamer1.id, JAHRGAENGE.jahrgang1.id]
      );
      const ids = await listeFuer(teamerToken);
      expect(ids).not.toContain(mitJahrgang1);
      // Material ohne Jahrgang bleibt davon unberuehrt.
      expect(ids).toContain(ohneJahrgang);
    });

    it('Die Datei eines fremden Jahrgangs laesst sich nicht herunterladen', async () => {
      const stored = 'a'.repeat(64);
      await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, 'geheim.pdf', $2, 'application/pdf', 100)`,
        [mitFremdemJahrgang, stored]
      );

      const res = await request(app)
        .get(`/api/material/files/${stored}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(404);

      // Die Leitung kommt dagegen bis zur Datei-Prüfung durch (404 erst,
      // weil die Datei auf der Platte fehlt — nicht wegen fehlender Rechte).
      const resAdmin = await request(app)
        .get(`/api/material/files/${stored}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(resAdmin.body.error).toBe('Datei nicht auf dem Server gefunden');
    });
  });

  // ================================================================
  // MATERIAL FUER ALLE (ist_global, Entscheidung Simon 31.08.2026)
  // ================================================================
  // "Fuer alle" heisst: alle TEAMER:INNEN der Gemeinde. Konfis kommen an
  // keine Material-Route (requireTeamer) -- das prueft der Konfi-Test unten
  // mit.
  describe('Material fuer alle Teamer:innen (ist_global)', () => {
    let global1;
    let bestandOhneJahrgang;
    let mitFremdemJahrgang;
    let zweiterJahrgang;

    const anlegen = async ({ titel, orgId = ORGS.testGemeinde.id, global = false, jahrgangId = null }) => {
      const { rows: [m] } = await db.query(
        `INSERT INTO materials (title, organization_id, created_by, ist_global)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [titel, orgId, orgId === ORGS.testGemeinde.id ? USERS.admin1.id : USERS.admin2.id, global]
      );
      if (jahrgangId) {
        await db.query(
          'INSERT INTO material_jahrgaenge (material_id, jahrgang_id) VALUES ($1, $2)',
          [m.id, jahrgangId]
        );
      }
      return m.id;
    };

    const listeFuer = async (token) => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      return res.body.map(m => m.id);
    };

    beforeEach(async () => {
      const { rows: [jg] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('2026/2027', $1, '2027-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      zweiterJahrgang = jg.id;

      // Global UND einem fremden Jahrgang zugeordnet: der globale Zweig muss
      // gewinnen, sonst waere "fuer alle" nur ein anderes Wort fuer
      // "ohne Jahrgang".
      global1 = await anlegen({ titel: 'Fuer alle Teamer:innen', global: true, jahrgangId: zweiterJahrgang });
      // Bestand: ohne Jahrgang, ist_global = false (so kommt alles Alte aus
      // Migration 137 heraus).
      bestandOhneJahrgang = await anlegen({ titel: 'Altbestand ohne Jahrgang' });
      mitFremdemJahrgang = await anlegen({ titel: 'Nur zweiter Jahrgang', jahrgangId: zweiterJahrgang });
    });

    it('Teamer:in OHNE jede Jahrgangszuweisung sieht globales Material', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      const ids = await listeFuer(teamerToken);
      expect(ids).toContain(global1);
    });

    it('Teamer:in eines fremden Jahrgangs sieht globales Material', async () => {
      // teamer1 haengt an jahrgang1, das Material an zweiterJahrgang.
      expect(await listeFuer(teamerToken)).toContain(global1);
    });

    it('REGRESSION: Bestandsmaterial ohne Jahrgang bleibt fuer alle sichtbar', async () => {
      // Die globale Regel kam ADDITIV dazu. Wuerde sie den Zweig
      // "kein Jahrgang zugeordnet" ERSETZEN, verschwaende alles Alte.
      const ids = await listeFuer(teamerToken);
      expect(ids).toContain(bestandOhneJahrgang);

      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      expect(await listeFuer(teamerToken)).toContain(bestandOhneJahrgang);
    });

    it('Jahrgangsgebundenes Material eines fremden Jahrgangs bleibt unsichtbar', async () => {
      expect(await listeFuer(teamerToken)).not.toContain(mitFremdemJahrgang);
    });

    it('Das Detail globalen Materials liefert 200 und ist_global true', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      const res = await request(app)
        .get(`/api/material/${global1}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(global1);
      expect(res.body.ist_global).toBe(true);
    });

    it('Die Datei globalen Materials laesst sich herunterladen', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      const stored = 'b'.repeat(64);
      await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, 'fuer-alle.pdf', $2, 'application/pdf', 100)`,
        [global1, stored]
      );

      // Die Schranke laesst durch; erst danach faellt auf, dass die Datei
      // nicht auf der Platte liegt -- genau wie beim Leitungs-Fall oben.
      const res = await request(app)
        .get(`/api/material/files/${stored}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.body.error).toBe('Datei nicht auf dem Server gefunden');
    });

    it('Teamer:in einer fremden Organisation sieht globales Material NICHT', async () => {
      const ids = await listeFuer(teamer2Token);
      expect(ids).not.toContain(global1);
      expect(ids).not.toContain(bestandOhneJahrgang);
    });

    it('Das Detail globalen Materials bleibt einer fremden Organisation verschlossen', async () => {
      const res = await request(app)
        .get(`/api/material/${global1}`)
        .set('Authorization', `Bearer ${teamer2Token}`);
      expect(res.status).toBe(404);
    });

    it('Konfi bekommt 403, auch bei globalem Material', async () => {
      const res = await request(app)
        .get(`/api/material/${global1}`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(403);
    });

    it('Die Leitung legt globales Material an -> 201, Flag gesetzt', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Neu und global', ist_global: true });

      expect(res.status).toBe(201);
      expect(res.body.ist_global).toBe(true);

      const { rows: [gespeichert] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1',
        [res.body.id]
      );
      expect(gespeichert.ist_global).toBe(true);
    });

    it('Ohne Angabe folgt das Flag der Jahrgangs-Zuordnung (Ableitung seit 01.09.2026)', async () => {
      // Bis zum 01.09.2026 galt: ohne Angabe NICHT global. Simons Regel
      // ("wenn kein Jahrgang dann global. Fertig.") leitet das Flag jetzt
      // ab, wenn der Client es nicht mitschickt. An der SICHTBARKEIT
      // aendert das nichts: Material ohne Jahrgang war schon ueber den
      // mittleren Zweig der Schranke fuer alle sichtbar.
      const ohne = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Ganz normal' });
      expect(ohne.status).toBe(201);
      expect(ohne.body.ist_global).toBe(true);

      const mit = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Mit Jahrgang', jahrgang_ids: [JAHRGAENGE.jahrgang1.id] });
      expect(mit.status).toBe(201);
      expect(mit.body.ist_global).toBe(false);
    });

    it('admin mit ist_global:true im POST -> 403 und kein Material in der DB', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Heimlich global', ist_global: true });

      expect(res.status).toBe(403);

      const { rows } = await db.query(
        'SELECT id FROM materials WHERE title = $1',
        ['Heimlich global']
      );
      expect(rows).toHaveLength(0);
    });

    it('admin darf ganz normales Material weiterhin anlegen', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Normales Material vom Admin', jahrgang_ids: [JAHRGAENGE.jahrgang1.id] });

      expect(res.status).toBe(201);
      expect(res.body.ist_global).toBe(false);
    });

    it('admin ohne Jahrgaenge bekommt das ABGELEITETE Flag ohne 403 (erlaubter Fall)', async () => {
      // Die org_admin-Pruefung gilt nur fuer das EXPLIZITE Feld: Die
      // Ableitung benennt bloss die Sichtbarkeit, die die fehlende
      // Jahrgangs-Zuordnung ohnehin ergibt -- sie darf deshalb nicht an
      // der Rolle scheitern.
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Fuer alle vom Admin' });

      expect(res.status).toBe(201);
      expect(res.body.ist_global).toBe(true);

      const { rows: [gespeichert] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1',
        [res.body.id]
      );
      expect(gespeichert.ist_global).toBe(true);
    });

    it('admin mit ist_global:true im PUT -> 403, Flag unveraendert', async () => {
      const res = await request(app)
        .put(`/api/material/${bestandOhneJahrgang}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Umgewidmet', ist_global: true });

      expect(res.status).toBe(403);

      const { rows: [gespeichert] } = await db.query(
        'SELECT title, ist_global FROM materials WHERE id = $1',
        [bestandOhneJahrgang]
      );
      expect(gespeichert.ist_global).toBe(false);
      expect(gespeichert.title).toBe('Altbestand ohne Jahrgang');
    });

    it('admin entzieht globalem Material das Flag -> 403, Flag bleibt true', async () => {
      const res = await request(app)
        .put(`/api/material/${global1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ist_global: false });

      expect(res.status).toBe(403);

      const { rows: [gespeichert] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1',
        [global1]
      );
      expect(gespeichert.ist_global).toBe(true);
    });

    it('admin bearbeitet globales Material inhaltlich weiterhin', async () => {
      // Das Formular schickt den unveraenderten Wert mit -- das darf nicht
      // an der Feldpruefung scheitern.
      const res = await request(app)
        .put(`/api/material/${global1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Neuer Titel vom Admin', ist_global: true });

      expect(res.status).toBe(200);

      const { rows: [gespeichert] } = await db.query(
        'SELECT title, ist_global FROM materials WHERE id = $1',
        [global1]
      );
      expect(gespeichert.title).toBe('Neuer Titel vom Admin');
      expect(gespeichert.ist_global).toBe(true);
    });

    it('Die Leitung entzieht das Flag -> 200, danach greift wieder der Jahrgang', async () => {
      const res = await request(app)
        .put(`/api/material/${global1}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ ist_global: false });

      expect(res.status).toBe(200);

      const { rows: [gespeichert] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1',
        [global1]
      );
      expect(gespeichert.ist_global).toBe(false);

      // Das Material haengt an zweiterJahrgang, teamer1 an jahrgang1.
      expect(await listeFuer(teamerToken)).not.toContain(global1);
    });

    it('Die Liste liefert ist_global an jedem Eintrag mit', async () => {
      const res = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);
      const global = res.body.find(m => m.id === global1);
      const bestand = res.body.find(m => m.id === bestandOhneJahrgang);
      expect(global.ist_global).toBe(true);
      expect(bestand.ist_global).toBe(false);
    });
  });

  // ================================================================
  // BEARBEITEN NUR DURCH DIE ERSTELLENDE PERSON
  // (Entscheidung Simon, 01.09.2026: "Material bearbeiten kann nur der
  // Ersteller!")
  // ================================================================
  // org_admin und is_super_admin bleiben ausgenommen -- sonst waere das
  // Material einer ausgeschiedenen Person fuer immer unveraenderlich.
  // Die Datei-Routen zaehlen als Bearbeitung. created_by IS NULL (Konto
  // geloescht) heisst: nur noch die Leitung darf ran.
  describe('Bearbeiten nur durch die erstellende Person', () => {
    const FEHLER = 'Nur wer das Material angelegt hat oder die Gemeindeleitung kann es ändern';
    let vomAdmin;      // created_by = admin1
    let vomOrgAdmin;   // created_by = orgAdmin1
    let ohneErsteller; // created_by = NULL (Konto geloescht)

    beforeEach(async () => {
      // Der User-Cache in rbacVerifier (30 s TTL) ueberlebt das Reseed --
      // der Flag-Test unten wuerde sonst in die Folgetests hineinwirken.
      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache();

      const resAdmin = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Material vom Admin' });
      expect(resAdmin.status).toBe(201);
      vomAdmin = resAdmin.body.id;

      const resOrgAdmin = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Material der Leitung' });
      expect(resOrgAdmin.status).toBe(201);
      vomOrgAdmin = resOrgAdmin.body.id;

      const { rows: [verwaist] } = await db.query(
        `INSERT INTO materials (title, organization_id, created_by)
         VALUES ('Verwaistes Material', $1, NULL) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      ohneErsteller = verwaist.id;
    });

    const titelAus = async (id) => {
      const { rows: [zeile] } = await db.query(
        'SELECT title FROM materials WHERE id = $1', [id]
      );
      return zeile ? zeile.title : null;
    };

    // ---------------- PUT ----------------

    it('PUT: die erstellende Person aendert ihr Material -> 200', async () => {
      const res = await request(app)
        .put(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Vom Admin geaendert' });

      expect(res.status).toBe(200);
      expect(await titelAus(vomAdmin)).toBe('Vom Admin geaendert');
    });

    it('PUT: ein anderer admin derselben Gemeinde -> 403, Zeile unveraendert', async () => {
      const res = await request(app)
        .put(`/api/material/${vomOrgAdmin}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Fremdaenderung', description: 'sollte nie ankommen' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(FEHLER);

      const { rows: [zeile] } = await db.query(
        'SELECT title, description FROM materials WHERE id = $1', [vomOrgAdmin]
      );
      expect(zeile.title).toBe('Material der Leitung');
      expect(zeile.description).toBeNull();
    });

    it('PUT: org_admin aendert fremdes Material -> 200', async () => {
      const res = await request(app)
        .put(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Von der Leitung geaendert' });

      expect(res.status).toBe(200);
      expect(await titelAus(vomAdmin)).toBe('Von der Leitung geaendert');
    });

    it('PUT: das is_super_admin-Flag zaehlt wie org_admin -> 200', async () => {
      // Die REINE super_admin-Rolle kommt gar nicht durch requireAdmin
      // (rbac.js: "NUR Organisations-Verwaltung"). Relevant ist das FLAG auf
      // einer zugelassenen Rolle -- dieselbe Ausnahme wie in
      // jahrgangsSchranke. Hier: ein 'admin' mit gesetztem Flag darf
      // fremdes Material aendern.
      await db.query(
        'UPDATE users SET is_super_admin = true WHERE id = $1',
        [USERS.admin1.id]
      );
      // rbacVerifier haelt User-Objekte 30 s im Cache -- ohne Invalidierung
      // kaeme hier noch das Objekt OHNE Flag an.
      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .put(`/api/material/${vomOrgAdmin}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Vom Admin mit Super-Flag geaendert' });

      expect(res.status).toBe(200);
      expect(await titelAus(vomOrgAdmin)).toBe('Vom Admin mit Super-Flag geaendert');
    });

    it('PUT: fremde Organisation bekommt 404, nicht 403', async () => {
      // 404 statt 403, damit die Antwort nicht verraet, dass es das
      // Material ueberhaupt gibt.
      const res = await request(app)
        .put(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .send({ title: 'Fremde Org' });

      expect(res.status).toBe(404);
      expect(await titelAus(vomAdmin)).toBe('Material vom Admin');
    });

    it('PUT: created_by NULL -> admin 403, org_admin 200', async () => {
      const resAdmin = await request(app)
        .put(`/api/material/${ohneErsteller}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Vom Admin gekapert' });
      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.error).toBe(FEHLER);
      expect(await titelAus(ohneErsteller)).toBe('Verwaistes Material');

      const resLeitung = await request(app)
        .put(`/api/material/${ohneErsteller}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Von der Leitung uebernommen' });
      expect(resLeitung.status).toBe(200);
      expect(await titelAus(ohneErsteller)).toBe('Von der Leitung uebernommen');
    });

    // ---------------- DELETE ----------------

    it('DELETE: die erstellende Person loescht ihr Material -> 200', async () => {
      const res = await request(app)
        .delete(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(await titelAus(vomAdmin)).toBeNull();
    });

    it('DELETE: ein anderer admin derselben Gemeinde -> 403, Zeile bleibt', async () => {
      const res = await request(app)
        .delete(`/api/material/${vomOrgAdmin}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(FEHLER);
      expect(await titelAus(vomOrgAdmin)).toBe('Material der Leitung');
    });

    it('DELETE: org_admin loescht fremdes Material -> 200', async () => {
      const res = await request(app)
        .delete(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(await titelAus(vomAdmin)).toBeNull();
    });

    it('DELETE: fremde Organisation bekommt 404, Zeile bleibt', async () => {
      const res = await request(app)
        .delete(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
      expect(await titelAus(vomAdmin)).toBe('Material vom Admin');
    });

    it('DELETE: created_by NULL -> admin 403, org_admin 200', async () => {
      const resAdmin = await request(app)
        .delete(`/api/material/${ohneErsteller}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
      expect(await titelAus(ohneErsteller)).toBe('Verwaistes Material');

      const resLeitung = await request(app)
        .delete(`/api/material/${ohneErsteller}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(resLeitung.status).toBe(200);
      expect(await titelAus(ohneErsteller)).toBeNull();
    });

    // ---------------- DATEI-ROUTEN ----------------
    // Eine Datei anzuhaengen oder zu loeschen IST eine Aenderung am
    // Material -- sonst liesse sich die Regel ueber den Umweg aushebeln.

    const dateiAnzahl = async (materialId) => {
      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM material_files WHERE material_id = $1',
        [materialId]
      );
      return rows[0].anzahl;
    };

    it('POST files: die erstellende Person laedt hoch -> 201', async () => {
      const res = await request(app)
        .post(`/api/material/${vomAdmin}/files`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from('Notizen zum Gottesdienst'), {
          filename: 'notizen.txt', contentType: 'text/plain'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].original_name).toBe('notizen.txt');
      expect(await dateiAnzahl(vomAdmin)).toBe(1);
    });

    it('POST files: ein anderer admin -> 403, keine Datei entsteht', async () => {
      const res = await request(app)
        .post(`/api/material/${vomOrgAdmin}/files`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from('eingeschmuggelt'), {
          filename: 'fremd.txt', contentType: 'text/plain'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(FEHLER);
      expect(await dateiAnzahl(vomOrgAdmin)).toBe(0);
    });

    it('POST files: org_admin laedt zu fremdem Material hoch -> 201', async () => {
      const res = await request(app)
        .post(`/api/material/${vomAdmin}/files`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .attach('files', Buffer.from('Ablaufplan der Leitung'), {
          filename: 'ablauf.txt', contentType: 'text/plain'
        });

      expect(res.status).toBe(201);
      expect(await dateiAnzahl(vomAdmin)).toBe(1);
    });

    it('POST files: fremde Organisation bekommt 404', async () => {
      const res = await request(app)
        .post(`/api/material/${vomAdmin}/files`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`)
        .attach('files', Buffer.from('fremde org'), {
          filename: 'fremd.txt', contentType: 'text/plain'
        });

      expect(res.status).toBe(404);
      expect(await dateiAnzahl(vomAdmin)).toBe(0);
    });

    it('DELETE files: ein anderer admin -> 403, Datei bleibt', async () => {
      const { rows: [datei] } = await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, 'leitung.pdf', $2, 'application/pdf', 100) RETURNING id`,
        [vomOrgAdmin, 'c'.repeat(64)]
      );

      const res = await request(app)
        .delete(`/api/material/files/${datei.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(FEHLER);
      expect(await dateiAnzahl(vomOrgAdmin)).toBe(1);
    });

    it('DELETE files: die erstellende Person loescht ihre Datei -> 200', async () => {
      const { rows: [datei] } = await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, 'eigene.pdf', $2, 'application/pdf', 100) RETURNING id`,
        [vomAdmin, 'd'.repeat(64)]
      );

      const res = await request(app)
        .delete(`/api/material/files/${datei.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(await dateiAnzahl(vomAdmin)).toBe(0);
    });

    it('DELETE files: org_admin loescht die Datei fremden Materials -> 200', async () => {
      const { rows: [datei] } = await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, 'admin.pdf', $2, 'application/pdf', 100) RETURNING id`,
        [vomAdmin, 'e'.repeat(64)]
      );

      const res = await request(app)
        .delete(`/api/material/files/${datei.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(await dateiAnzahl(vomAdmin)).toBe(0);
    });

    it('DELETE files: fremde Organisation bekommt 404, Datei bleibt', async () => {
      const { rows: [datei] } = await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, 'admin.pdf', $2, 'application/pdf', 100) RETURNING id`,
        [vomAdmin, 'f'.repeat(64)]
      );

      const res = await request(app)
        .delete(`/api/material/files/${datei.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
      expect(await dateiAnzahl(vomAdmin)).toBe(1);
    });

    // ---------------- created_by in den Lese-Antworten ----------------

    it('Liste und Detail liefern created_by ADDITIV mit', async () => {
      // Die Oberflaeche blendet Bearbeiten/Loeschen anhand der ID aus --
      // created_by_name allein reicht nicht (Anzeigenamen sind nicht
      // eindeutig). Das Feld kommt DAZU, es verschwindet keines.
      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(liste.status).toBe(200);
      const ausListe = liste.body.find(m => m.id === vomAdmin);
      expect(ausListe.created_by).toBe(USERS.admin1.id);
      expect(ausListe.created_by_name).toBe(USERS.admin1.display_name);

      const detail = await request(app)
        .get(`/api/material/${vomAdmin}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.created_by).toBe(USERS.admin1.id);

      const verwaist = await request(app)
        .get(`/api/material/${ohneErsteller}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(verwaist.status).toBe(200);
      expect(verwaist.body.created_by).toBeNull();
    });
  });

  // ================================================================
  // MEHRERE LINKS UND DATEIEN PARALLEL
  // (Entscheidung Simon, 01.09.2026: "Vielleicht will ich ein pdf und
  // ein oder mehrere YouTube Videos. Also mehr links und beides
  // moeglich.")
  // ================================================================
  // Tabelle material_links (Migration 142). materials.link_url bleibt der
  // Spiegel des ERSTEN Links -- das ist der Vertrag mit den ausgelieferten
  // Apps, die nur dieses Feld kennen.
  describe('Mehrere Links und Dateien am selben Material', () => {
    const LINKS = [
      'https://konfi-quest.de/gottesbilder',
      'https://www.youtube.com/watch?v=abc123',
      'https://www.youtube.com/watch?v=def456',
    ];

    const linksAus = async (materialId) => {
      const { rows } = await db.query(
        'SELECT url FROM material_links WHERE material_id = $1 ORDER BY id',
        [materialId]
      );
      return rows.map(r => r.url);
    };

    const spiegelAus = async (materialId) => {
      const { rows: [zeile] } = await db.query(
        'SELECT link_url FROM materials WHERE id = $1', [materialId]
      );
      return zeile ? zeile.link_url : null;
    };

    it('POST mit drei Links legt drei Zeilen an, link_url spiegelt den ersten', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'PDF und Videos', link_urls: LINKS });

      expect(res.status).toBe(201);
      expect(res.body.links).toHaveLength(3);
      expect(res.body.links.map(l => l.url)).toEqual(LINKS);
      expect(res.body.link_url).toBe(LINKS[0]);

      expect(await linksAus(res.body.id)).toEqual(LINKS);
      expect(await spiegelAus(res.body.id)).toBe(LINKS[0]);
    });

    it('Dateien UND Links leben am selben Material: Detail liefert 2 Dateien und 3 Links', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Beides parallel', link_urls: LINKS });
      expect(angelegt.status).toBe(201);
      const materialId = angelegt.body.id;

      const upload = await request(app)
        .post(`/api/material/${materialId}/files`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .attach('files', Buffer.from('nur text eins', 'utf8'), { filename: 'handout.txt', contentType: 'text/plain' })
        .attach('files', Buffer.from('nur text zwei', 'utf8'), { filename: 'notizen.txt', contentType: 'text/plain' });
      expect(upload.status).toBe(201);
      expect(upload.body).toHaveLength(2);

      const detail = await request(app)
        .get(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.files).toHaveLength(2);
      expect(detail.body.links).toHaveLength(3);
      expect(detail.body.links.map(l => l.url)).toEqual(LINKS);
      expect(detail.body.link_url).toBe(LINKS[0]);
    });

    it('Die Liste zaehlt die Links mit (link_count = 3)', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Gezaehlt', link_urls: LINKS });
      expect(angelegt.status).toBe(201);

      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(liste.status).toBe(200);
      const eintrag = liste.body.find(m => m.id === angelegt.body.id);
      expect(eintrag.link_count).toBe(3);
      expect(eintrag.link_url).toBe(LINKS[0]);
    });

    it('PUT mit link_urls ersetzt alle Links, der Spiegel folgt', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Wird umgebaut', link_urls: LINKS });
      const materialId = angelegt.body.id;

      const neueListe = ['https://konfi-quest.de/neu', 'https://example.org/zwei'];
      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_urls: neueListe });
      expect(res.status).toBe(200);

      expect(await linksAus(materialId)).toEqual(neueListe);
      expect(await spiegelAus(materialId)).toBe('https://konfi-quest.de/neu');
    });

    it('PUT mit leerem Array entfernt alle Links, link_url wird null', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Wird geleert', link_urls: LINKS });
      const materialId = angelegt.body.id;

      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_urls: [] });
      expect(res.status).toBe(200);

      expect(await linksAus(materialId)).toEqual([]);
      expect(await spiegelAus(materialId)).toBeNull();
    });

    it('Ein verbotener Link im Array gibt 400 und aendert nichts', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Bleibt wie er ist', link_urls: [LINKS[0]] });
      const materialId = angelegt.body.id;

      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_urls: ['https://ok.example', 'javascript:alert(1)'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Der Link muss mit http:// oder https:// beginnen');

      expect(await linksAus(materialId)).toEqual([LINKS[0]]);
      expect(await spiegelAus(materialId)).toBe(LINKS[0]);
    });

    it('Mehr als 20 Links werden abgewiesen (400)', async () => {
      const zuViele = Array.from({ length: 21 }, (_, i) => `https://example.org/${i}`);
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Zu viele', link_urls: zuViele });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Hoechstens 20 Links pro Material');
    });

    it('Leere Eintraege im Array fallen still heraus', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Mit Luecken', link_urls: ['', LINKS[0], '   '] });
      expect(res.status).toBe(201);
      expect(res.body.links).toHaveLength(1);
      expect(res.body.link_url).toBe(LINKS[0]);
    });

    // ---------------- ALT-APP-VERTRAG ----------------
    // Ausgelieferte Apps kennen nur link_url. Sie muessen weiter einen
    // Link SEHEN, solange es welche gibt, und duerfen beim SCHREIBEN nur
    // den ersten Link anfassen -- weitere Links hat ihr Formular nie
    // angezeigt.

    it('Alt-Client: POST mit link_url legt genau einen Link an', async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Alte App', link_url: LINKS[0] });
      expect(res.status).toBe(201);
      expect(res.body.link_url).toBe(LINKS[0]);
      expect(await linksAus(res.body.id)).toEqual([LINKS[0]]);
    });

    it('Alt-Client: PUT link_url ersetzt NUR den ersten Link, die anderen bleiben', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Drei Links', link_urls: LINKS });
      const materialId = angelegt.body.id;

      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_url: 'https://konfi-quest.de/ersetzt' });
      expect(res.status).toBe(200);

      expect(await linksAus(materialId)).toEqual([
        'https://konfi-quest.de/ersetzt',
        LINKS[1],
        LINKS[2],
      ]);
      expect(await spiegelAus(materialId)).toBe('https://konfi-quest.de/ersetzt');
    });

    it('Alt-Client: PUT link_url = "" loescht den ersten Link, der Spiegel rueckt nach', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Spiegel rueckt nach', link_urls: LINKS });
      const materialId = angelegt.body.id;

      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ link_url: '' });
      expect(res.status).toBe(200);

      // Alte Apps sehen weiterhin einen Link: den bisherigen zweiten.
      expect(await linksAus(materialId)).toEqual([LINKS[1], LINKS[2]]);
      expect(await spiegelAus(materialId)).toBe(LINKS[1]);

      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const eintrag = liste.body.find(m => m.id === materialId);
      expect(eintrag.link_url).toBe(LINKS[1]);
    });

    it('DELETE des Materials raeumt die Links per CASCADE mit ab', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Wird geloescht', link_urls: LINKS });
      const materialId = angelegt.body.id;
      expect(await linksAus(materialId)).toHaveLength(3);

      const res = await request(app)
        .delete(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(200);
      expect(await linksAus(materialId)).toEqual([]);
    });

    // ---------------- ERSTELLER-REGEL AUF DEM LINK-WEG ----------------
    // Links laufen ueber PUT /:id -- die Ersteller-Regel vom 01.09.2026
    // muss also auch hier greifen, sonst waere sie ueber den Link-Umweg
    // ausgehebelt.

    it('Ersteller-Regel: fremder admin kann ueber link_urls nichts aendern (403)', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache();

      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Von der Leitung', link_urls: [LINKS[0]] });
      const materialId = angelegt.body.id;

      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ link_urls: ['https://boese.example/umweg'] });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Nur wer das Material angelegt hat oder die Gemeindeleitung kann es ändern');

      expect(await linksAus(materialId)).toEqual([LINKS[0]]);
      expect(await spiegelAus(materialId)).toBe(LINKS[0]);
    });

    it('Ersteller-Regel: die erstellende Person aendert ihre Links (200)', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      invalidateUserCache();

      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Vom Admin', link_urls: [LINKS[0]] });
      expect(angelegt.status).toBe(201);
      const materialId = angelegt.body.id;

      const res = await request(app)
        .put(`/api/material/${materialId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ link_urls: [LINKS[0], LINKS[1]] });
      expect(res.status).toBe(200);
      expect(await linksAus(materialId)).toEqual([LINKS[0], LINKS[1]]);
    });
  });

  // ================================================================
  // ABGELEITETE SICHTBARKEIT IM PUT + MIGRATION 142
  // (Entscheidung Simon, 01.09.2026: "wenn kein Jahrgang dann global.
  // Fertig. Sonst nur Jahrgang.")
  // ================================================================
  describe('Abgeleitete Sichtbarkeit beim Bearbeiten', () => {
    it('PUT ohne ist_global: Jahrgaenge weg -> Flag wird true', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Erst gebunden', jahrgang_ids: [JAHRGAENGE.jahrgang1.id] });
      expect(angelegt.body.ist_global).toBe(false);

      const res = await request(app)
        .put(`/api/material/${angelegt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_ids: [] });
      expect(res.status).toBe(200);

      const { rows: [zeile] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1', [angelegt.body.id]
      );
      expect(zeile.ist_global).toBe(true);
    });

    it('PUT ohne ist_global: Jahrgang dazu -> Flag wird false, Sichtbarkeit folgt dem Jahrgang', async () => {
      const angelegt = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Erst fuer alle' });
      expect(angelegt.body.ist_global).toBe(true);

      // teamer1 haengt an jahrgang1 (Seed) -- ein Material NUR fuer einen
      // neuen, fremden Jahrgang darf er danach nicht mehr sehen.
      const { rows: [jg2] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('2027/2028', $1, '2028-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .put(`/api/material/${angelegt.body.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ jahrgang_ids: [jg2.id] });
      expect(res.status).toBe(200);

      const { rows: [zeile] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1', [angelegt.body.id]
      );
      expect(zeile.ist_global).toBe(false);

      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(liste.status).toBe(200);
      expect(liste.body.map(m => m.id)).not.toContain(angelegt.body.id);
    });

    it('PUT ohne ist_global und ohne jahrgang_ids laesst das Flag in Ruhe', async () => {
      // Direkter Bestand wie aus der Zeit vor der Ableitung: ohne
      // Jahrgang, ist_global = false.
      const { rows: [m] } = await db.query(
        `INSERT INTO materials (title, organization_id, created_by, ist_global)
         VALUES ('Bestand', $1, $2, false) RETURNING id`,
        [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
      );

      const res = await request(app)
        .put(`/api/material/${m.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ title: 'Nur der Titel' });
      expect(res.status).toBe(200);

      const { rows: [zeile] } = await db.query(
        'SELECT ist_global FROM materials WHERE id = $1', [m.id]
      );
      // Formwaechter: Bestand ohne Jahrgang bleibt ist_global = false und
      // ist trotzdem fuer alle sichtbar (mittlerer Zweig der Schranke).
      expect(zeile.ist_global).toBe(false);

      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(liste.body.map(x => x.id)).toContain(m.id);
    });
  });

  describe('Migration 142: Bestand behaelt Link und Sichtbarkeit', () => {
    it('Der Backfill traegt link_url als ersten Link ein und aendert die Zeile nicht', async () => {
      // Nachgestellter Bestand wie in Produktion am 01.09.2026 (1 Zeile:
      // ist_global = true, link_url gesetzt, 1 Jahrgangs-Zuordnung).
      const { rows: [m] } = await db.query(
        `INSERT INTO materials (title, organization_id, created_by, ist_global, link_url)
         VALUES ('Gebet', $1, $2, true, 'https://konfi-quest.de/gebet') RETURNING id`,
        [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
      );
      await db.query(
        'INSERT INTO material_jahrgaenge (material_id, jahrgang_id) VALUES ($1, $2)',
        [m.id, JAHRGAENGE.jahrgang1.id]
      );

      // Migration erneut ausfuehren -- sie ist idempotent (IF NOT EXISTS,
      // NOT-EXISTS-Backfill) und muss den Bestand genau einmal uebertragen.
      const fs = require('fs');
      const path = require('path');
      const sql = fs.readFileSync(
        path.join(__dirname, '..', '..', 'migrations', '142_material_mehrere_links.sql'),
        'utf8'
      );
      await db.query(sql);
      await db.query(sql);

      const { rows: links } = await db.query(
        'SELECT url FROM material_links WHERE material_id = $1 ORDER BY id', [m.id]
      );
      expect(links).toHaveLength(1);
      expect(links[0].url).toBe('https://konfi-quest.de/gebet');

      const { rows: [zeile] } = await db.query(
        'SELECT link_url, ist_global FROM materials WHERE id = $1', [m.id]
      );
      expect(zeile.link_url).toBe('https://konfi-quest.de/gebet');
      expect(zeile.ist_global).toBe(true);

      // Sichtbarkeit unveraendert: ist_global = true -> auch eine
      // Teamer:in ohne diesen Jahrgang saehe die Zeile; hier gemessen an
      // teamer1, der die Zeile ueber die Liste bekommt.
      const liste = await request(app)
        .get('/api/material')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(liste.status).toBe(200);
      const eintrag = liste.body.find(x => x.id === m.id);
      expect(eintrag.link_url).toBe('https://konfi-quest.de/gebet');
      expect(eintrag.link_count).toBe(1);
    });
  });

});
