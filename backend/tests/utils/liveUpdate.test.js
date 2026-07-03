// backend/tests/utils/liveUpdate.test.js
// Tests fuer den LiveUpdate-Helper, insbesondere die korrekte Socket-Raum-
// Adressierung. Kernregression (Audit ACHSE 2): sendToOrgAdmins muss Teamer:innen
// in den Raum user_teamer_<id> statt user_admin_<id> emittieren, sonst sind
// Teamer:innen vom gesamten LiveUpdate-System abgeschnitten.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');

// WICHTIG: liveUpdate.js macht intern `require('../database')` (lazy in den
// Funktionen). Der Pool dort liest process.env.DATABASE_URL beim ersten Laden.
// Fuer den Test muss DATABASE_URL auf die Test-DB zeigen, damit die Rollen-
// Lookups gegen die geseedete Test-DB laufen. TEST_DATABASE_URL wird von der
// vitest-Config gesetzt; wir leiten daraus die konfi_test-URL ab (identisch zur
// Ableitung in tests/helpers/db.js).
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
process.env.DATABASE_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

const liveUpdate = require('../../utils/liveUpdate');

const ORG_ID = 1;

// Fake-io: sammelt alle to(room).emit(event, payload)-Aufrufe fuer Assertions.
function createFakeIo() {
  const emits = []; // { room, event, payload }
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emits.push({ room, event, payload });
        }
      };
    }
  };
  return { io, emits };
}

// Hilfsfunktion: liefert alle Raeume, an die 'liveUpdate' emittiert wurde.
function roomsFor(emits) {
  return emits.filter(e => e.event === 'liveUpdate').map(e => e.room);
}

describe('liveUpdate: Socket-Raum-Adressierung', () => {
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
    // liveUpdate.js nutzt intern database.js (eigener Pool) — ohne end() haelt
    // der offene Pool den vitest-Fork am Leben.
    await require('../../database').end();
  });

  describe('sendToOrgAdmins', () => {
    it('emittiert an admin1 und orgAdmin1 im Admin-Raum UND an teamer1 im Teamer-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(ORG_ID, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toContain(`user_admin_${USERS.admin1.id}`);
      expect(rooms).toContain(`user_admin_${USERS.orgAdmin1.id}`);
      expect(rooms).toContain(`user_teamer_${USERS.teamer1.id}`);
    });

    it('sendet Teamer:innen NICHT faelschlich in den Admin-Raum (Kernregression)', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(ORG_ID, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).not.toContain(`user_admin_${USERS.teamer1.id}`);
      // Umgekehrt darf kein Admin in den Teamer-Raum gelegt werden.
      expect(rooms).not.toContain(`user_teamer_${USERS.admin1.id}`);
    });

    it('adressiert keine User anderer Organisationen', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(ORG_ID, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).not.toContain(`user_admin_${USERS.admin2.id}`);
      expect(rooms).not.toContain(`user_teamer_${USERS.teamer2.id}`);
    });

    it('setzt type und action korrekt im Event', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(ORG_ID, 'requests', 'update');

      const events = emits.filter(e => e.event === 'liveUpdate');
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) {
        expect(e.payload.type).toBe('requests');
        expect(e.payload.action).toBe('update');
      }
    });
  });

  describe('sendToUserByRole', () => {
    it('sendet an einen Teamer in den Teamer-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToUserByRole(USERS.teamer1.id, 'requests', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toEqual([`user_teamer_${USERS.teamer1.id}`]);
    });

    it('sendet an einen Konfi in den Konfi-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToUserByRole(USERS.konfi1.id, 'points', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toEqual([`user_konfi_${USERS.konfi1.id}`]);
    });

    it('sendet an einen Admin/Org-Admin in den Admin-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToUserByRole(USERS.orgAdmin1.id, 'requests', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toEqual([`user_admin_${USERS.orgAdmin1.id}`]);
    });

    it('macht bei unbekanntem User nichts (kein Throw, kein Emit)', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await expect(
        liveUpdate.sendToUserByRole(999999, 'badges', 'earned')
      ).resolves.toBeUndefined();

      expect(emits.length).toBe(0);
    });
  });
});
