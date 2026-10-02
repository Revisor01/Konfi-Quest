// backend/tests/utils/verwaisteDateien.test.js
//
// scripts/verwaisteDateien.js -- EIN Skript fuer verwaiste Upload-Dateien
// (02.10.2026), zusammengefuehrt aus scripts/cleanupOrphanPhotos.js (loeschte
// ohne Schalter sofort, ohne Altersschutz) und scripts/verwaiste-dateien.mjs
// (sicher, aber nicht im Image).
//
// Die Regel, die hier haengt: Ohne --loeschen wird NICHTS geloescht, und auch
// mit --loeschen nur eine Waise, die aelter ist als das Mindestalter. Fuer
// beide verbotenen Faelle ein Test, fuer den erlaubten einer; dazu die
// Gegenrichtung (Zeile ohne Datei) und der Weg ueber die Kommandozeile.
// Der Challenge-Bereich (Audit Sicherheit BF-19) steht in
// aufraeumSkripteChallenges.test.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const {
  BEREICHE, STANDARD_MINDESTALTER_TAGE, argumenteLesen, bereichPruefen, main,
} = require('../../scripts/verwaisteDateien');

const BENUTZT = 'a'.repeat(64);
const WAISE = 'b'.repeat(64);
const FEHLT = 'c'.repeat(64);
const TAG_MS = 24 * 60 * 60 * 1000;

const chat = BEREICHE.find((b) => b.name === 'chat');

describe('Verwaiste Upload-Dateien (scripts/verwaisteDateien.js)', () => {
  let db;
  let uploads;
  let chatDir;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'konfi-verwaist-'));
    chatDir = path.join(uploads, 'chat');
    fs.mkdirSync(chatDir);
  });

  afterEach(() => {
    fs.rmSync(uploads, { recursive: true, force: true });
  });

  async function nachrichtMitDatei(dateiname, { geloescht = false } = {}) {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name, deleted_at)
       VALUES (1, $1, 'admin', 'file', NULL, $2, 'anhang.pdf', $3)`,
      [USERS.orgAdmin1.id, dateiname, geloescht ? new Date() : null]
    );
  }

  // Datei mit Aenderungszeit vor `tage` Tagen.
  function datei(name, tage) {
    const pfad = path.join(chatDir, name);
    fs.writeFileSync(pfad, 'KQPHOTO1-inhalt');
    const zeit = new Date(Date.now() - tage * TAG_MS);
    fs.utimesSync(pfad, zeit, zeit);
    return pfad;
  }

  describe('Bereiche', () => {
    it('kennt genau die vier Upload-Bereiche, je mit der Spalte, die auf ihre Dateien verweist', () => {
      expect(BEREICHE.map((b) => b.name)).toEqual(['requests', 'chat', 'material', 'challenges']);
      const spalte = Object.fromEntries(BEREICHE.map((b) => [b.name, b.abfrage.replace(/\s+/g, ' ').trim()]));
      expect(spalte).toEqual({
        requests: "SELECT photo_filename AS datei FROM activity_requests WHERE photo_filename IS NOT NULL AND photo_filename <> ''",
        chat: "SELECT file_path AS datei FROM chat_messages WHERE file_path IS NOT NULL AND file_path <> ''",
        material: "SELECT stored_name AS datei FROM material_files WHERE stored_name IS NOT NULL AND stored_name <> ''",
        challenges: "SELECT file_path AS datei FROM challenge_submissions WHERE file_path IS NOT NULL AND file_path <> ''",
      });
    });
  });

  describe('Loeschen nur mit Schalter und Mindestalter', () => {
    it('VERBOTEN: ohne --loeschen bleibt eine alte Waise liegen -- sie wird nur gemeldet', async () => {
      await nachrichtMitDatei(BENUTZT);
      datei(BENUTZT, 30);
      datei(WAISE, 30);

      const e = await bereichPruefen(db, chat, { uploads });

      expect(e.waisen.map((w) => w.name)).toEqual([WAISE]);
      expect(e.geloescht).toEqual([]);
      expect(fs.readdirSync(chatDir).sort()).toEqual([BENUTZT, WAISE]);
    });

    it('VERBOTEN: mit --loeschen bleibt eine Waise juenger als das Mindestalter liegen', async () => {
      datei(WAISE, STANDARD_MINDESTALTER_TAGE - 1);

      const e = await bereichPruefen(db, chat, { uploads, loeschen: true });

      expect(e.zuJung).toEqual([WAISE]);
      expect(e.waisen).toEqual([]);
      expect(e.geloescht).toEqual([]);
      expect(fs.readdirSync(chatDir)).toEqual([WAISE]);
    });

    it('ERLAUBT: mit --loeschen verschwindet die alte Waise, die benutzte Datei bleibt', async () => {
      await nachrichtMitDatei(BENUTZT);
      datei(BENUTZT, 30);
      datei(WAISE, STANDARD_MINDESTALTER_TAGE + 1);

      const e = await bereichPruefen(db, chat, { uploads, loeschen: true });

      expect(e.geloescht).toEqual([WAISE]);
      expect(e.benutzt).toBe(1);
      expect(fs.readdirSync(chatDir)).toEqual([BENUTZT]);
    });

    it('ERLAUBT: --mindestalter 0 nimmt auch eine frische Waise', async () => {
      datei(WAISE, 0);

      const e = await bereichPruefen(db, chat, { uploads, loeschen: true, mindestalterTage: 0, jetzt: Date.now() + 1000 });

      expect(e.geloescht).toEqual([WAISE]);
      expect(fs.readdirSync(chatDir)).toEqual([]);
    });

    it('die Datei einer soft-geloeschten Nachricht gilt als benutzt (Wiederherstellung)', async () => {
      await nachrichtMitDatei(BENUTZT, { geloescht: true });
      datei(BENUTZT, 30);

      const e = await bereichPruefen(db, chat, { uploads, loeschen: true });

      expect(e.geloescht).toEqual([]);
      expect(fs.readdirSync(chatDir)).toEqual([BENUTZT]);
    });

    it('eine benutzte Datei bleibt auch, wenn ihre Zeile zu einer anderen Gemeinde gehoert', async () => {
      // Raum 4 ist der Jahrgangschat der zweiten Gemeinde (seed.js).
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, file_path, file_name)
         VALUES (4, $1, 'admin', 'file', $2, 'x.pdf')`,
        [USERS.orgAdmin2.id, WAISE]
      );
      datei(WAISE, 30);

      const e = await bereichPruefen(db, chat, { uploads, loeschen: true });

      expect(e.geloescht).toEqual([]);
      expect(fs.readdirSync(chatDir)).toEqual([WAISE]);
    });
  });

  describe('Gegenrichtung und fehlende Verzeichnisse', () => {
    it('FEHLEND: eine Zeile ohne Datei wird gemeldet, nichts wird geloescht oder angelegt', async () => {
      await nachrichtMitDatei(BENUTZT);
      await nachrichtMitDatei(FEHLT);
      datei(BENUTZT, 30);

      const e = await bereichPruefen(db, chat, { uploads, loeschen: true });

      expect(e.fehlend).toEqual([FEHLT]);
      expect(e.geloescht).toEqual([]);
      expect(fs.readdirSync(chatDir)).toEqual([BENUTZT]);
      const { rows: [{ n }] } = await db.query(
        'SELECT count(*)::int AS n FROM chat_messages WHERE file_path = $1', [FEHLT]
      );
      expect(n).toBe(1);
    });

    it('ein fehlendes Verzeichnis wird uebersprungen, nicht angelegt', async () => {
      const e = await bereichPruefen(db, BEREICHE.find((b) => b.name === 'material'), { uploads, loeschen: true });
      expect(e).toEqual({ bereich: 'material', verzeichnis: path.join(uploads, 'material'), vorhanden: false });
      expect(fs.existsSync(path.join(uploads, 'material'))).toBe(false);
    });
  });

  describe('Kommandozeile', () => {
    it('Standard: nur Bericht, Mindestalter 7 Tage, alle Bereiche', () => {
      expect(argumenteLesen([])).toEqual({
        loeschen: false,
        mindestalterTage: 7,
        bereich: null,
        uploads: path.join(__dirname, '..', '..', 'uploads'),
      });
    });

    it('liest --loeschen, --mindestalter, --bereich und --uploads', () => {
      expect(argumenteLesen(['--loeschen', '--mindestalter', '30', '--bereich', 'chat', '--uploads', '/tmp/x'])).toEqual({
        loeschen: true, mindestalterTage: 30, bereich: 'chat', uploads: '/tmp/x',
      });
    });

    it.each([
      [['--dry-run'], /Unbekannte Angabe "--dry-run"/],
      [['--loschen'], /Unbekannte Angabe "--loschen"/],
      [['--mindestalter', '-1'], /--mindestalter braucht eine Zahl >= 0/],
      [['--mindestalter', 'sieben'], /--mindestalter braucht eine Zahl >= 0/],
      [['--mindestalter'], /--mindestalter braucht einen Wert/],
      [['--bereich', 'fotos'], /Unbekannter Bereich "fotos"/],
    ])('bricht ab bei %j', (argv, meldung) => {
      expect(() => argumenteLesen(argv)).toThrow(meldung);
    });

    it('VERBOTEN: ohne DATABASE_URL bricht der Lauf ab und loescht nichts, auch mit --loeschen', async () => {
      datei(WAISE, 30);
      const fehler = [];
      const code = await main(['--loeschen', '--uploads', uploads], { env: {}, log: () => {}, fehler: (z) => fehler.push(z) });
      expect(code).toBe(1);
      expect(fehler[0]).toMatch(/DATABASE_URL ist nicht gesetzt/);
      expect(fs.readdirSync(chatDir)).toEqual([WAISE]);
    });

    it('der ganze Lauf: ohne Schalter bleibt alles, mit --loeschen geht nur die alte Waise', async () => {
      await nachrichtMitDatei(BENUTZT);
      datei(BENUTZT, 30);
      datei(WAISE, 30);
      const jung = 'd'.repeat(64);
      datei(jung, 1);
      const env = { DATABASE_URL: process.env.TEST_DATABASE_URL.replace(/\/[^/]+$/, '/konfi_test') };
      const zeilen = [];
      const log = (z) => zeilen.push(z);

      expect(await main(['--uploads', uploads], { env, log, fehler: log })).toBe(0);
      expect(fs.readdirSync(chatDir).sort()).toEqual([BENUTZT, WAISE, jung].sort());
      expect(zeilen).toContain('Nichts gelöscht. Zum Aufräumen mit --loeschen erneut aufrufen.');

      zeilen.length = 0;
      expect(await main(['--loeschen', '--uploads', uploads], { env, log, fehler: log })).toBe(0);
      expect(fs.readdirSync(chatDir).sort()).toEqual([BENUTZT, jung].sort());
      expect(zeilen).toContain('Gelöscht:        1 Datei');
    });
  });
});
