// Aufraeum- und Verschluesselungsskript kennen uploads/challenges/
// (Audit Sicherheit BF-19, 29.09.2026).
//
// Challenge-Beitraege (Fotos, Sprachaufnahmen, Videos von Konfis, bis 50 MB)
// hatten als einzige Medienart keinen Sicherheitsnetz-Lauf: Die Skripte
// kannten nur requests, chat und material. Eine Datei ohne Zeile in
// challenge_submissions ist nicht mehr auslieferbar (GET /challenges/files
// sucht die Zeile), bleibt aber auf der Platte liegen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { zieleFuer, cleanupTarget } = require('../../scripts/cleanupOrphanPhotos');
const { verzeichnisseFuer, migrateDir } = require('../../scripts/encryptExistingPhotos');
const { isEncrypted } = require('../../utils/photoCrypto');

const REFERENZIERT = 'a'.repeat(64);
const VERWAIST = 'b'.repeat(64);

describe('Aufraeum- und Verschluesselungsskript: uploads/challenges/', () => {
  let db;
  let uploadsDir;
  let challengesDir;

  beforeAll(() => {
    db = getTestPool();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'konfi-aufraeumen-'));
    challengesDir = path.join(uploadsDir, 'challenges');
    fs.mkdirSync(challengesDir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  async function beitragMitDatei(dateiname) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES (1, 'Foto-Challenge', 'Beschreibung', 'Fotograf', $1, NOW() - interval '1 day', NOW() + interval '7 days', false)
       RETURNING id`,
      [USERS.orgAdmin1.id]
    );
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path, file_name, moderation_status)
       VALUES ($1, $2, 1, 'photo', $3, 'foto.jpg', 'approved')`,
      [c.id, USERS.konfi1.id, dateiname]
    );
  }

  describe('Aufraeumen (cleanupOrphanPhotos)', () => {
    it('kennt uploads/challenges/ mit challenge_submissions.file_path', () => {
      const ziel = zieleFuer(uploadsDir).find((z) => z.dir === challengesDir);
      expect(ziel.query).toBe('SELECT file_path AS f FROM challenge_submissions WHERE file_path IS NOT NULL');
    });

    it('VERBOTEN (bleibt nicht liegen): eine verwaiste Challenge-Datei wird geloescht', async () => {
      await beitragMitDatei(REFERENZIERT);
      fs.writeFileSync(path.join(challengesDir, REFERENZIERT), 'KQPHOTO1-inhalt');
      fs.writeFileSync(path.join(challengesDir, VERWAIST), 'KQPHOTO1-waise');

      const ziel = zieleFuer(uploadsDir).find((z) => z.dir === challengesDir);
      const ergebnis = await cleanupTarget(db, ziel);

      expect(ergebnis).toEqual({ deleted: 1, kept: 1 });
      expect(fs.readdirSync(challengesDir)).toEqual([REFERENZIERT]);
    });

    it('ERLAUBT: referenzierte Dateien bleiben, auch aus einer anderen Gemeinde', async () => {
      await beitragMitDatei(REFERENZIERT);
      const { rows: [c2] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, badge_name, created_by, starts_at, ends_at, is_draft)
         VALUES (2, 'Andere', 'Beschreibung', 'X', $1, NOW(), NOW() + interval '7 days', false) RETURNING id`,
        [USERS.orgAdmin2.id]
      );
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path, moderation_status)
         VALUES ($1, $2, 2, 'photo', $3, 'approved')`,
        [c2.id, USERS.konfi3.id, VERWAIST]
      );
      fs.writeFileSync(path.join(challengesDir, REFERENZIERT), 'x');
      fs.writeFileSync(path.join(challengesDir, VERWAIST), 'y');

      const ziel = zieleFuer(uploadsDir).find((z) => z.dir === challengesDir);
      const ergebnis = await cleanupTarget(db, ziel);

      expect(ergebnis).toEqual({ deleted: 0, kept: 2 });
      expect(fs.readdirSync(challengesDir).sort()).toEqual([REFERENZIERT, VERWAIST]);
    });

    it('die bisherigen drei Ziele bleiben unveraendert', () => {
      expect(zieleFuer(uploadsDir).map((z) => path.basename(z.dir)))
        .toEqual(['requests', 'chat', 'material', 'challenges']);
    });
  });

  describe('Verschluesseln (encryptExistingPhotos)', () => {
    it('kennt uploads/challenges/', () => {
      expect(verzeichnisseFuer(uploadsDir).map((d) => path.basename(d)))
        .toEqual(['requests', 'chat', 'material', 'challenges']);
    });

    it('VERBOTEN (bleibt nicht im Klartext): eine alte Klartext-Datei wird verschluesselt, eine verschluesselte uebersprungen', async () => {
      const klartext = path.join(challengesDir, REFERENZIERT);
      fs.writeFileSync(klartext, Buffer.from('Sprachaufnahme im Klartext'));
      const { encryptBuffer } = require('../../utils/photoCrypto');
      fs.writeFileSync(path.join(challengesDir, VERWAIST), encryptBuffer(Buffer.from('schon verschluesselt')));

      const dir = verzeichnisseFuer(uploadsDir).find((d) => d === challengesDir);
      const ergebnis = await migrateDir(dir);

      expect(ergebnis).toEqual({ encrypted: 1, skipped: 1, failed: 0 });
      expect(isEncrypted(fs.readFileSync(klartext))).toBe(true);
    });
  });
});
