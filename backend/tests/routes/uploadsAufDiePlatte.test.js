// Uploads landen auf der PLATTE, nicht im Arbeitsspeicher.
//
// Anlass (EKD-Ausrollung, 138 -> ueber 15.000 Nutzende): Alle vier
// Upload-Routen nutzten multer.memoryStorage(). Bei 50 MB Challenge-Limit und
// 512 MB Container-Grenze reichten rechnerisch neun gleichzeitige Uploads fuer
// einen OOM-Kill durch Docker. Der Rate-Limiter bremst die RATE (100 je
// 15 min), nicht die GLEICHZEITIGKEIT.
//
// Was hier geprueft wird:
//   1. Der Request-Handler bekommt file.path (Platte), NICHT file.buffer.
//   2. Die Datei landet wirklich verschluesselt am Zielort und kommt beim
//      Abruf Byte fuer Byte zurueck (stromweise Ver-/Entschluesselung).
//   3. Das Zwischenlager ist nach dem Request LEER — bei Erfolg, bei
//      abgelehntem Dateityp (415) und bei ueberschrittenem Limit (413).
//   4. Das Dateiformat auf der Platte bleibt zum alten Weg kompatibel:
//      eine mit encryptBuffer geschriebene Datei wird weiter ausgeliefert.
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { encryptBuffer, isEncrypted } = require('../../utils/photoCrypto');

// Echte gueltige 1x1-PNG (file-type verlangt valide Struktur)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// getTestApp legt das Zwischenlager im OS-Temp an (helpers/testApp.js liefert
// uploadsDir). ACHTUNG, gemischte Lage im Bestand: chat.js und challenges.js
// schreiben nach uploadsDir, konfi.js und material.js dagegen fest nach
// backend/uploads/... (relativ zum Modul). Diese Aufteilung ist vorgefunden
// und wird hier nur nachgebildet, nicht geaendert — eine Vereinheitlichung
// waere eine Verlegung von Produktionsdaten.
const UPLOADS_DIR = path.join(os.tmpdir(), 'konfi-test-uploads');
const TMP_DIR = path.join(UPLOADS_DIR, 'tmp');
const CHALLENGES_DIR = path.join(UPLOADS_DIR, 'challenges');
const CHAT_DIR = path.join(UPLOADS_DIR, 'chat');
const REQUESTS_DIR = path.join(__dirname, '../../uploads/requests');

function dateienIn(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * Wartet, bis das Zwischenlager leer ist — hoechstens 2 s.
 *
 * Das Loeschen haengt an res 'close' und laeuft asynchron (fs.unlink). Direkt
 * nach der Antwort kann die Datei deshalb noch da sein; das ist kein Fehler,
 * sondern der eine Tick, den die Callback-Kette braucht. Ein festes setTimeout
 * waere entweder zu kurz (Flattern) oder unnoetig lang.
 */
async function warteBisZwischenlagerLeer(dir, maxMs = 2000) {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) {
    if (dateienIn(dir).length === 0) return [];
    await new Promise((r) => setTimeout(r, 25));
  }
  return dateienIn(dir);
}

describe('Uploads landen auf der Platte, nicht im Arbeitsspeicher', () => {
  let app;
  let db;
  let konfi1Token;
  let admin1Token;
  const aufraeumen = [];

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfi1Token = generateToken('konfi1');
    admin1Token = generateToken('admin1');
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    aufraeumen.length = 0;
    // Zwischenlager vor jedem Test leeren, damit die Aussage "danach leer"
    // nicht von einem Vorlauf abhaengt.
    for (const name of dateienIn(TMP_DIR)) {
      try { fs.unlinkSync(path.join(TMP_DIR, name)); } catch { /* schon weg */ }
    }
  });

  afterEach(() => {
    for (const p of aufraeumen) {
      try { fs.unlinkSync(p); } catch { /* schon weg */ }
    }
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // 1. Antrags-Foto (5 MB, requestUpload)
  // ================================================================
  describe('Antrags-Foto', () => {
    it('Handler bekommt einen Dateipfad, keinen Puffer — die Datei liegt verschluesselt am Zielort', async () => {
      const res = await request(app)
        .post('/api/konfi/upload-photo')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('photo', PNG, 'beweis.png');

      expect(res.status).toBe(200);
      expect(typeof res.body.filename).toBe('string');
      aufraeumen.push(path.join(REQUESTS_DIR, res.body.filename));

      const aufDerPlatte = fs.readFileSync(path.join(REQUESTS_DIR, res.body.filename));
      expect(isEncrypted(aufDerPlatte)).toBe(true);
      // MAGIC(8) + IV(12) + TAG(16) + Klartextlaenge — GCM aendert die Laenge nicht.
      expect(aufDerPlatte.length).toBe(36 + PNG.length);
      // Der Klartext steht NICHT in der Datei.
      expect(aufDerPlatte.includes(PNG)).toBe(false);
    });

    it('Zwischenlager ist nach erfolgreichem Upload leer', async () => {
      const res = await request(app)
        .post('/api/konfi/upload-photo')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('photo', PNG, 'beweis.png');

      expect(res.status).toBe(200);
      aufraeumen.push(path.join(REQUESTS_DIR, res.body.filename));
      expect(await warteBisZwischenlagerLeer(TMP_DIR)).toEqual([]);
    });

    it('Zwischenlager ist auch nach abgewiesenem Dateityp leer (415)', async () => {
      // Als image/png angekuendigt, Inhalt ist keins -> Magic-Bytes-Pruefung
      // schlaegt zu, NACHDEM die Datei im Zwischenlager lag.
      const res = await request(app)
        .post('/api/konfi/upload-photo')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('photo', Buffer.from('das ist kein bild'), {
          filename: 'falsch.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(415);
      expect(await warteBisZwischenlagerLeer(TMP_DIR)).toEqual([]);
    });

    it('Abruf liefert den Originalinhalt Byte fuer Byte zurueck', async () => {
      const up = await request(app)
        .post('/api/konfi/upload-photo')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('photo', PNG, 'beweis.png');
      expect(up.status).toBe(200);
      aufraeumen.push(path.join(REQUESTS_DIR, up.body.filename));

      const { rows: [aktivitaet] } = await db.query(
        'SELECT id FROM activities WHERE organization_id = $1 LIMIT 1',
        [ORGS.testGemeinde.id]
      );
      const { rows: [antrag] } = await db.query(
        `INSERT INTO activity_requests
           (user_id, activity_id, organization_id, requested_date, status, photo_filename)
         VALUES ($1, $2, $3, CURRENT_DATE, 'pending', $4)
         RETURNING id`,
        [USERS.konfi1.id, aktivitaet.id, ORGS.testGemeinde.id, up.body.filename]
      );

      const ab = await request(app)
        .get(`/api/konfi/activity-requests/${antrag.id}/photo`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .buffer(true)
        .parse((res, cb) => {
          const teile = [];
          res.on('data', (c) => teile.push(c));
          res.on('end', () => cb(null, Buffer.concat(teile)));
        });

      expect(ab.status).toBe(200);
      expect(Buffer.compare(ab.body, PNG)).toBe(0);
    });

    it('Alte Datei aus dem Puffer-Weg wird weiter ausgeliefert (Formatvertrag)', async () => {
      // Genau so schrieb der alte Code: encryptBuffer + writeFile.
      const crypto = require('crypto');
      const name = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(REQUESTS_DIR, { recursive: true });
      fs.writeFileSync(path.join(REQUESTS_DIR, name), encryptBuffer(PNG));
      aufraeumen.push(path.join(REQUESTS_DIR, name));

      const { rows: [aktivitaet] } = await db.query(
        'SELECT id FROM activities WHERE organization_id = $1 LIMIT 1',
        [ORGS.testGemeinde.id]
      );
      const { rows: [antrag] } = await db.query(
        `INSERT INTO activity_requests
           (user_id, activity_id, organization_id, requested_date, status, photo_filename)
         VALUES ($1, $2, $3, CURRENT_DATE, 'pending', $4)
         RETURNING id`,
        [USERS.konfi1.id, aktivitaet.id, ORGS.testGemeinde.id, name]
      );

      const ab = await request(app)
        .get(`/api/konfi/activity-requests/${antrag.id}/photo`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .buffer(true)
        .parse((res, cb) => {
          const teile = [];
          res.on('data', (c) => teile.push(c));
          res.on('end', () => cb(null, Buffer.concat(teile)));
        });

      expect(ab.status).toBe(200);
      expect(Buffer.compare(ab.body, PNG)).toBe(0);
    });
  });

  // ================================================================
  // 2. Challenge-Einreichung (50 MB, challengeUpload) — der harte Deckel
  // ================================================================
  describe('Challenge-Einreichung', () => {
    async function challengeAnlegen() {
      const { rows: [row] } = await db.query(
        `INSERT INTO challenges
           (organization_id, title, description, challenge_type, audience, visibility, moderated,
            allowed_media, allow_multiple, badge_icon, badge_name, created_by,
            starts_at, ends_at, is_draft)
         VALUES ($1,'Foto-Challenge','Mach ein Foto','frei','konfis','public',false,
                 $2::jsonb,true,'flag','Testabzeichen',$3,
                 NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false)
         RETURNING *`,
        [ORGS.testGemeinde.id, JSON.stringify(['photo']), USERS.admin1.id]
      );
      await db.query(
        'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [row.id, JAHRGAENGE.jahrgang1.id]
      );
      return row;
    }

    it('Grosse Datei landet verschluesselt auf der Platte und kommt unveraendert zurueck', async () => {
      const challenge = await challengeAnlegen();

      // 2 MiB: gross genug, dass die stromweise Verarbeitung ueber mehrere
      // 64-KiB-Bloecke laeuft (32 Bloecke), klein genug fuer einen schnellen Test.
      const gross = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024, 0x42)]);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .field('media_type', 'photo')
        .attach('file', gross, { filename: 'gross.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(typeof res.body.file_path).toBe('string');
      const ziel = path.join(CHALLENGES_DIR, res.body.file_path);
      aufraeumen.push(ziel);

      const aufDerPlatte = fs.readFileSync(ziel);
      expect(isEncrypted(aufDerPlatte)).toBe(true);
      expect(aufDerPlatte.length).toBe(36 + gross.length);
      expect(await warteBisZwischenlagerLeer(TMP_DIR)).toEqual([]);

      const ab = await request(app)
        .get(`/api/challenges/files/${res.body.file_path}`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .buffer(true)
        .parse((r, cb) => {
          const teile = [];
          r.on('data', (c) => teile.push(c));
          r.on('end', () => cb(null, Buffer.concat(teile)));
        });

      expect(ab.status).toBe(200);
      expect(ab.body.length).toBe(gross.length);
      expect(Buffer.compare(ab.body, gross)).toBe(0);
    });

    it('Zwischenlager ist nach ueberschrittenem Limit leer (413)', async () => {
      const challenge = await challengeAnlegen();
      // 51 MiB > 50 MB Limit. multer bricht MITTEN im Schreiben ab; die
      // Teil-Datei muss trotzdem weg sein.
      const zuGross = Buffer.alloc(51 * 1024 * 1024, 0x41);
      PNG.copy(zuGross, 0);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .field('media_type', 'photo')
        .attach('file', zuGross, { filename: 'zugross.png', contentType: 'image/png' });

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Datei ist zu groß (max. 50 MB).');
      // Der Rest im Zwischenlager wird asynchron geloescht (res 'close').
      expect(await warteBisZwischenlagerLeer(TMP_DIR)).toEqual([]);
      // Keine Einreichung, also auch keine abgelegte Datei.
      const { rows } = await db.query('SELECT file_path FROM challenge_submissions');
      expect(rows).toEqual([]);
    }, 30000);

    it('Zwischenlager ist nach abgewiesenem Dateityp leer (415) und nichts wurde abgelegt', async () => {
      const challenge = await challengeAnlegen();

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .field('media_type', 'photo')
        .attach('file', Buffer.from('kein bild, nur text'), {
          filename: 'schwindel.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(415);
      expect(await warteBisZwischenlagerLeer(TMP_DIR)).toEqual([]);
      const { rows } = await db.query('SELECT file_path FROM challenge_submissions');
      expect(rows).toEqual([]);
    });
  });

  // ================================================================
  // 3. Chat-Anhang (5 MB, chatUpload)
  // ================================================================
  describe('Chat-Anhang', () => {
    it('Anhang liegt verschluesselt auf der Platte, Zwischenlager ist leer', async () => {
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, organization_id, created_by)
         VALUES ('Testraum', 'group', $1, $2) RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $2, 'konfi')`,
        [raum.id, USERS.konfi1.id]
      );

      const res = await request(app)
        .post(`/api/chat/rooms/${raum.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', PNG, { filename: 'bild.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(typeof res.body.file_path).toBe('string');
      const ziel = path.join(CHAT_DIR, res.body.file_path);
      aufraeumen.push(ziel);

      expect(isEncrypted(fs.readFileSync(ziel))).toBe(true);
      expect(await warteBisZwischenlagerLeer(TMP_DIR)).toEqual([]);
    });
  });
});
