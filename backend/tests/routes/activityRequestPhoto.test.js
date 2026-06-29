// Integrationstests fuer Antrags-Nachweisfotos:
// - Upload wird AES-verschluesselt auf die Platte geschrieben
// - Abruf entschluesselt zum Originalinhalt (Roundtrip), Admin + Konfi
// - Status-Gate: Konfi sieht das Foto NUR bei pending, Admin immer
// - Admin kann das Foto manuell loeschen (Datei weg + photo_filename = NULL)
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { isEncrypted } = require('../../utils/photoCrypto');

// Echte gueltige 1x1-PNG (file-type@22 verlangt valide Struktur)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
// Die Antrags-Foto-Routen (konfi.js / activities.js) speichern relativ zu
// backend/uploads/requests (Prod: gemountetes Volume). os ungenutzt entfernt.
const REQUESTS_DIR = path.join(__dirname, '../../uploads/requests');

describe('Activity Request Photo', () => {
  let app;
  let db;
  let konfi1Token;
  let admin1Token;
  // Im Test erzeugte Dateinamen, damit afterEach sie aufraeumen kann.
  const createdFiles = [];

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfi1Token = generateToken('konfi1');
    admin1Token = generateToken('admin1');
    createdFiles.length = 0;
  });

  afterEach(() => {
    // Test-Uploads vom Dateisystem entfernen (kein Muell im Repo-Verzeichnis)
    for (const f of createdFiles) {
      try { fs.unlinkSync(path.join(REQUESTS_DIR, f)); } catch { /* schon weg */ }
    }
  });

  afterAll(async () => {
    await closePool();
  });

  // Foto hochladen + Antrag damit anlegen. Gibt { requestId, filename } zurueck.
  async function createRequestWithPhoto() {
    const up = await request(app)
      .post('/api/konfi/upload-photo')
      .set('Authorization', `Bearer ${konfi1Token}`)
      .attach('photo', PNG, { filename: 'nachweis.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    const filename = up.body.filename;
    expect(filename).toMatch(/^[a-f0-9]{64}$/);
    createdFiles.push(filename);

    const create = await request(app)
      .post('/api/konfi/requests')
      .set('Authorization', `Bearer ${konfi1Token}`)
      .send({
        activity_id: ACTIVITIES.sonntagsgottesdienst.id,
        photo_filename: filename,
        requested_date: '2026-06-01',
      });
    expect(create.status).toBe(201);
    return { requestId: create.body.id, filename };
  }

  it('Upload schreibt die Datei VERSCHLUESSELT auf die Platte', async () => {
    const { filename } = await createRequestWithPhoto();
    const onDisk = fs.readFileSync(path.join(REQUESTS_DIR, filename));
    expect(isEncrypted(onDisk)).toBe(true);
    expect(onDisk.subarray(0, 8).equals(PNG.subarray(0, 8))).toBe(false);
  });

  it('Konfi-Abruf bei pending: 200 + Roundtrip korrekt', async () => {
    const { requestId } = await createRequestWithPhoto();
    const down = await request(app)
      .get(`/api/konfi/activity-requests/${requestId}/photo`)
      .set('Authorization', `Bearer ${konfi1Token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(down.status).toBe(200);
    expect(down.body.equals(PNG)).toBe(true);
  });

  it('Status-Gate: nach Verbuchung sieht der Konfi das Foto NICHT mehr (403), Admin aber schon', async () => {
    const { requestId } = await createRequestWithPhoto();

    // Admin verbucht den Antrag
    const approve = await request(app)
      .put(`/api/admin/activities/requests/${requestId}`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ status: 'approved' });
    expect(approve.status).toBe(200);

    // Konfi: jetzt 403 (Status-Gate)
    const konfiDown = await request(app)
      .get(`/api/konfi/activity-requests/${requestId}/photo`)
      .set('Authorization', `Bearer ${konfi1Token}`);
    expect(konfiDown.status).toBe(403);

    // Admin: weiterhin 200 + Roundtrip
    const adminDown = await request(app)
      .get(`/api/admin/activities/requests/${requestId}/photo`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(adminDown.status).toBe(200);
    expect(adminDown.body.equals(PNG)).toBe(true);
  });

  it('Admin loescht Foto manuell: Datei weg + photo_filename NULL', async () => {
    const { requestId, filename } = await createRequestWithPhoto();

    const del = await request(app)
      .delete(`/api/admin/activities/requests/${requestId}/photo`)
      .set('Authorization', `Bearer ${admin1Token}`);
    expect(del.status).toBe(200);

    // Datei vom Dateisystem entfernt
    expect(fs.existsSync(path.join(REQUESTS_DIR, filename))).toBe(false);

    // DB-Referenz genullt -> Abruf 404
    const { rows: [row] } = await db.query('SELECT photo_filename FROM activity_requests WHERE id = $1', [requestId]);
    expect(row.photo_filename).toBeNull();
  });

  it('Konfi loescht pending-Antrag: Foto-Datei wird entfernt', async () => {
    const { requestId, filename } = await createRequestWithPhoto();

    const del = await request(app)
      .delete(`/api/konfi/requests/${requestId}`)
      .set('Authorization', `Bearer ${konfi1Token}`);
    expect(del.status).toBe(200);

    expect(fs.existsSync(path.join(REQUESTS_DIR, filename))).toBe(false);
  });
});
