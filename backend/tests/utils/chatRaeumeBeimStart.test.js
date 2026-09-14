// backend/tests/utils/chatRaeumeBeimStart.test.js
//
// Nebenbefund: server.js rief beim Start `initializeChatRooms(db)` auf.
// `initializeChatRooms` war aber eine Fabrik — `(db) => { return async () => {...} }`.
// Der Aufruf erzeugte die innere Funktion und verwarf sie ungenutzt: Die
// Chat-Raum-Initialisierung lief seit dem 21.07.2025 nie. Nachgemessen an der
// Git-Historie: Der Fabrik-Wrapper existiert seit der ersten Fassung der Datei,
// es gab also nie einen Zeitraum, in dem der Aufruf richtig war.
//
// Entschieden wurde GEGEN das Scharfschalten und FUER das Entfernen: Die Anlage
// der Jahrgangs-Chats erledigt syncJahrgangChat (utils/jahrgangChat.js) ohnehin
// an jeder Stelle, an der sie noetig ist — beim Anlegen eines Jahrgangs, beim
// Zuweisen von Konfis/Teamer:innen und beim Laden der Raeume. Die alte Fassung
// war eine veraltete Dublette mit echten Fehlern (created_by-Rueckfall auf die
// feste Nutzer-ID 1, kein ON CONFLICT, weder deleted_at noch is_active
// beruecksichtigt, ausser Konfis niemand eingetragen).
//
// Dieser Test haelt beides fest: dass die tote Dublette weg ist, und dass der
// lebende Weg genau das leistet, was sie leisten sollte.
const fs = require('node:fs');
const path = require('node:path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { syncJahrgangChat } = require('../../utils/jahrgangChat');

const ORG_1 = 1;
const BACKEND = path.join(__dirname, '..', '..');

describe('Chat-Raum-Anlage beim Start', () => {
  describe('die tote Dublette ist entfernt', () => {
    it('utils/chatUtils.js existiert nicht mehr', () => {
      expect(fs.existsSync(path.join(BACKEND, 'utils', 'chatUtils.js'))).toBe(false);
    });

    it('server.js ruft initializeChatRooms nicht mehr auf', () => {
      const quelle = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8');
      // Nur ausserhalb von Kommentarzeilen suchen — der erklaerende Block
      // darf den Namen nennen, Code nicht mehr.
      const codeZeilen = quelle
        .split('\n')
        .filter((z) => !z.trim().startsWith('//'));
      expect(codeZeilen.join('\n')).not.toContain('initializeChatRooms');
      expect(codeZeilen.join('\n')).not.toContain('chatUtils');
    });

    it('keine Datei im Backend verweist noch auf chatUtils', () => {
      const treffer = [];
      const durchsuche = (dir) => {
        for (const eintrag of fs.readdirSync(dir, { withFileTypes: true })) {
          if (eintrag.name === 'node_modules' || eintrag.name === 'uploads') continue;
          const voll = path.join(dir, eintrag.name);
          if (eintrag.isDirectory()) durchsuche(voll);
          else if (eintrag.name.endsWith('.js')) {
            // Diese Testdatei selbst nennt den Namen erklaerend.
            if (voll === __filename) continue;
            const inhalt = fs.readFileSync(voll, 'utf8');
            if (inhalt.includes('chatUtils')) treffer.push(path.relative(BACKEND, voll));
          }
        }
      };
      durchsuche(BACKEND);
      expect(treffer).toEqual([]);
    });
  });

  describe('der lebende Weg legt den Jahrgangs-Chat an', () => {
    let db;

    beforeAll(() => {
      db = getTestPool();
    });

    beforeEach(async () => {
      await truncateAll(db);
      await seed(db);
    });

    afterAll(async () => {
      await closePool();
    });

    it('syncJahrgangChat legt den fehlenden Raum an und nimmt alle Konfis des Jahrgangs auf', async () => {
      // Ausgangslage herstellen: kein Jahrgangs-Raum vorhanden (genau der Fall,
      // den die tote Initialisierung haette abdecken sollen).
      await db.query(
        "DELETE FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2",
        [JAHRGAENGE.jahrgang1.id, ORG_1]
      );
      const { rows: vorher } = await db.query(
        "SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2",
        [JAHRGAENGE.jahrgang1.id, ORG_1]
      );
      expect(vorher).toHaveLength(0);

      const roomId = await syncJahrgangChat(
        db,
        JAHRGAENGE.jahrgang1.id,
        ORG_1,
        USERS.orgAdmin1.id
      );
      expect(Number.isInteger(roomId)).toBe(true);

      // Genau ein Raum, korrekt benannt und dem anlegenden Konto zugeschrieben
      // (die alte Fassung waere hier auf die feste Nutzer-ID 1 zurueckgefallen).
      const { rows: raeume } = await db.query(
        `SELECT id, name, created_by FROM chat_rooms
          WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2`,
        [JAHRGAENGE.jahrgang1.id, ORG_1]
      );
      expect(raeume).toHaveLength(1);
      expect(raeume[0].name).toBe(`Jahrgang ${JAHRGAENGE.jahrgang1.name}`);
      expect(raeume[0].created_by).toBe(USERS.orgAdmin1.id);

      // Alle Konfis des Jahrgangs sind Teilnehmer.
      const { rows: sollKonfis } = await db.query(
        `SELECT kp.user_id FROM konfi_profiles kp
          JOIN users u ON kp.user_id = u.id
         WHERE kp.jahrgang_id = $1 AND u.organization_id = $2
           AND u.is_active = true AND u.deleted_at IS NULL`,
        [JAHRGAENGE.jahrgang1.id, ORG_1]
      );
      expect(sollKonfis.length).toBeGreaterThan(0);

      const { rows: teilnehmer } = await db.query(
        "SELECT user_id FROM chat_participants WHERE room_id = $1 AND user_type = 'konfi'",
        [roomId]
      );
      const teilnehmerIds = teilnehmer.map((t) => t.user_id).sort((a, b) => a - b);
      expect(teilnehmerIds).toEqual(sollKonfis.map((k) => k.user_id).sort((a, b) => a - b));
    });

    it('ein zweiter Lauf legt keinen zweiten Raum an und verdoppelt keine Teilnehmer', async () => {
      await db.query(
        "DELETE FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2",
        [JAHRGAENGE.jahrgang1.id, ORG_1]
      );

      const ersterRaum = await syncJahrgangChat(db, JAHRGAENGE.jahrgang1.id, ORG_1, USERS.orgAdmin1.id);
      const { rows: nachErstem } = await db.query(
        'SELECT user_id, user_type FROM chat_participants WHERE room_id = $1',
        [ersterRaum]
      );

      const zweiterRaum = await syncJahrgangChat(db, JAHRGAENGE.jahrgang1.id, ORG_1, USERS.orgAdmin1.id);
      expect(zweiterRaum).toBe(ersterRaum);

      const { rows: raeume } = await db.query(
        "SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2",
        [JAHRGAENGE.jahrgang1.id, ORG_1]
      );
      expect(raeume).toHaveLength(1);

      const { rows: nachZweitem } = await db.query(
        'SELECT user_id, user_type FROM chat_participants WHERE room_id = $1',
        [ersterRaum]
      );
      expect(nachZweitem).toHaveLength(nachErstem.length);
    });
  });
});
