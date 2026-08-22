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
// Zusaetzlich in(room).disconnectSockets(close) fuer disconnectUserSockets-Tests:
// sammelt jeden getrennten Raum inkl. close-Flag.
function createFakeIo() {
  const emits = []; // { room, event, payload }
  const disconnects = []; // { room, close }
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emits.push({ room, event, payload });
        }
      };
    },
    in(room) {
      return {
        disconnectSockets(close) {
          disconnects.push({ room, close });
        }
      };
    }
  };
  return { io, emits, disconnects };
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

  // Mehrfach-Zugehoerigkeit: users.organization_id haelt nur die Primaer-Org.
  // Wer per Umschalter in einer Zweit-Organisation arbeitet, steht dort nur in
  // user_organizations. Vor dem Fix (22.08.) loesten sendToOrgAdmins/-Konfis
  // ausschliesslich ueber users.organization_id auf — in der Zweit-Org kam
  // deshalb kein einziges Live-Update an.
  describe('Mehrfach-Organisationen (user_organizations)', () => {
    it('erreicht einen Org-Admin auch in seiner ZWEIT-Organisation', async () => {
      // orgAdmin1 hat Primaer-Org 1 und bekommt zusaetzlich Zugang zu Org 2.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.orgAdmin1.id, 2, 9]
      );

      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(2, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toContain(`user_admin_${USERS.orgAdmin1.id}`);
    });

    it('erreicht die Empfaenger der Primaer-Organisation unveraendert weiter', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.orgAdmin1.id, 2, 9]
      );

      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(1, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toContain(`user_admin_${USERS.admin1.id}`);
      expect(rooms).toContain(`user_admin_${USERS.orgAdmin1.id}`);
      expect(rooms).toContain(`user_teamer_${USERS.teamer1.id}`);
    });

    it('adressiert jeden Empfaenger nur EINMAL, auch bei doppelter Quelle', async () => {
      // admin1 steht in Org 1 sowohl per users.organization_id als auch
      // zusaetzlich in user_organizations -> UNION muss entdoppeln.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.admin1.id, 1, 3]
      );

      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(1, 'events', 'update');

      const rooms = roomsFor(emits);
      const treffer = rooms.filter(r => r === `user_admin_${USERS.admin1.id}`);
      expect(treffer).toHaveLength(1);
    });

    it('nutzt die Rolle AUS der Zweit-Organisation fuer die Raumwahl', async () => {
      // admin1 ist in Org 1 Admin, in Org 2 aber nur Teamer:in -> das Update
      // fuer Org 2 muss in den Teamer-Raum gehen, nicht in den Admin-Raum.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.admin1.id, 2, 7]
      );

      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(2, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toContain(`user_teamer_${USERS.admin1.id}`);
      expect(rooms).not.toContain(`user_admin_${USERS.admin1.id}`);
    });

    it('erreicht einen Konfi auch in seiner ZWEIT-Organisation', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.konfi1.id, 2, 6]
      );

      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgKonfis(2, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).toContain(`user_konfi_${USERS.konfi1.id}`);
    });

    it('zieht ohne Zweit-Zugehoerigkeit keine fremden User in die Organisation', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io);

      await liveUpdate.sendToOrgAdmins(2, 'events', 'update');

      const rooms = roomsFor(emits);
      expect(rooms).not.toContain(`user_admin_${USERS.admin1.id}`);
      expect(rooms).not.toContain(`user_teamer_${USERS.teamer1.id}`);
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

  describe('disconnectUserSockets', () => {
    it('trennt alle drei Raum-Typen (konfi/teamer/admin) mit close=true', () => {
      const { io, disconnects } = createFakeIo();
      liveUpdate.init(io);

      liveUpdate.disconnectUserSockets(42);

      const rooms = disconnects.map(d => d.room);
      expect(rooms).toContain('user_konfi_42');
      expect(rooms).toContain('user_teamer_42');
      expect(rooms).toContain('user_admin_42');
      expect(disconnects.length).toBe(3);
      // close=true schliesst auch den zugrundeliegenden Transport
      for (const d of disconnects) {
        expect(d.close).toBe(true);
      }
    });

    it('macht nichts (kein Throw) wenn io nicht initialisiert ist', () => {
      // io auf null zuruecksetzen, um !_io-Zweig zu testen
      liveUpdate.init(null);
      expect(() => liveUpdate.disconnectUserSockets(1)).not.toThrow();
    });
  });
});
