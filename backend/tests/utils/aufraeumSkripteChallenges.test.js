// Aufraeum- und Verschluesselungsskript kennen uploads/challenges/
// (Audit Sicherheit BF-19, 29.09.2026).
//
// Challenge-Beitraege (Fotos, Sprachaufnahmen, Videos von Konfis, bis 50 MB)
// hatten als einzige Medienart keinen Sicherheitsnetz-Lauf: Die Skripte
// kannten nur requests, chat und material. Eine Datei ohne Zeile in
// challenge_submissions ist nicht mehr auslieferbar (GET /challenges/files
// sucht die Zeile), bleibt aber auf der Platte liegen.
//
// Aufgeraeumt wird seit 02.10.2026 mit scripts/verwaisteDateien.js (vorher
// scripts/cleanupOrphanPhotos.js); dessen allgemeines Verhalten -- nur mit
// --loeschen, nur alte Waisen -- prueft verwaisteDateien.test.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { BEREICHE, bereichPruefen } = require('../../scripts/verwaisteDateien');
const { verzeichnisseFuer, migrateDir } = require('../../scripts/encryptExistingPhotos');
const { isEncrypted } = require('../../utils/photoCrypto');

const REFERENZIERT = 'a'.repeat(64);
const VERWAIST = 'b'.repeat(64);
const challenges = BEREICHE.find((b) => b.name === 'challenges');

// Alt genug fuer das Mindestalter des Aufraeumskripts (7 Tage).
function alteDatei(pfad, inhalt) {
  fs.writeFileSync(pfad, inhalt);
  const vorEinemMonat = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  fs.utimesSync(pfad, vorEinemMonat, vorEinemMonat);
}

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

  describe('Aufraeumen (verwaisteDateien)', () => {
    it('kennt uploads/challenges/ mit challenge_submissions.file_path', () => {
      expect(challenges.abfrage.replace(/\s+/g, ' ').trim()).toBe(
        "SELECT file_path AS datei FROM challenge_submissions WHERE file_path IS NOT NULL AND file_path <> ''"
      );
    });

    it('VERBOTEN (bleibt nicht liegen): eine verwaiste Challenge-Datei wird mit --loeschen geloescht', async () => {
      await beitragMitDatei(REFERENZIERT);
      alteDatei(path.join(challengesDir, REFERENZIERT), 'KQPHOTO1-inhalt');
      alteDatei(path.join(challengesDir, VERWAIST), 'KQPHOTO1-waise');

      const ergebnis = await bereichPruefen(db, challenges, { uploads: uploadsDir, loeschen: true });

      expect(ergebnis.geloescht).toEqual([VERWAIST]);
      expect(ergebnis.benutzt).toBe(1);
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
      alteDatei(path.join(challengesDir, REFERENZIERT), 'x');
      alteDatei(path.join(challengesDir, VERWAIST), 'y');

      const ergebnis = await bereichPruefen(db, challenges, { uploads: uploadsDir, loeschen: true });

      expect(ergebnis.geloescht).toEqual([]);
      expect(ergebnis.benutzt).toBe(2);
      expect(fs.readdirSync(challengesDir).sort()).toEqual([REFERENZIERT, VERWAIST]);
    });

    it('die bisherigen drei Bereiche bleiben, challenges kommt dazu', () => {
      expect(BEREICHE.map((b) => b.name)).toEqual(['requests', 'chat', 'material', 'challenges']);
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
