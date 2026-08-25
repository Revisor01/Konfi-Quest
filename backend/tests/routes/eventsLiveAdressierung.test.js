// backend/tests/routes/eventsLiveAdressierung.test.js
//
// Live-Updates der Termin-Routen muessen den RICHTIGEN Socket-Raum treffen.
// Der Raum heisst `user_<type>_<id>` (server.js:161), wobei <type> aus dem
// angemeldeten Socket stammt: Teamer:innen sitzen in user_teamer_<id>,
// Konfis in user_konfi_<id>.
//
// Befund vom 25.08.2026: Neun Stellen in routes/events.js sendeten hart an
// 'konfi'. Teamer:innen duerfen sich aber ausdruecklich anmelden
// (events.js:1542-1545, eigene Kapazitaet teamer_max_participants) — ihr
// eigenes Ereignis kam bei ihnen nie an.
//
// Verbotener Fall: an user_konfi_<teamerId> senden (dort hoert niemand).
// Erlaubter Fall: Konfis bekommen weiterhin user_konfi_<id>.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const liveUpdate = require('../../utils/liveUpdate');

// Fake-io sammelt jedes to(room).emit(...)
function createFakeIo() {
  const emits = [];
  return {
    io: {
      to(room) {
        return { emit(event, payload) { emits.push({ room, event, payload }); } };
      },
      in() { return { disconnectSockets() {} }; },
    },
    emits,
  };
}

const raeume = (emits) =>
  emits.filter((e) => e.event === 'liveUpdate').map((e) => e.room);

describe('Events: Live-Updates treffen den richtigen Raum', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Termin fuer Teamer:innen oeffnen: ohne teamer_needed lehnt die Route
    // mit 403 ab (events.js:1569f), teamer_max_participants gibt die Plaetze.
    await db.query(
      'UPDATE events SET teamer_needed = true, teamer_max_participants = 10 WHERE id = $1',
      [EVENTS.gottesdienstEvent.id]
    );
  });

  afterAll(async () => {
    liveUpdate._reset();
    await closePool();
  });

  describe('POST /:id/book (Selbst-Anmeldung)', () => {
    it('sendet an eine Teamerin in den TEAMER-Raum, nicht in den Konfi-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io, db);

      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${generateToken('teamer1')}`)
        .send({});

      expect(res.status).toBe(201);

      // Kurz warten: die Sendungen laufen nach der Antwort (fire-and-forget).
      await new Promise((r) => setTimeout(r, 150));

      const rooms = raeume(emits);
      expect(rooms).toContain(`user_teamer_${USERS.teamer1.id}`);
      expect(rooms).not.toContain(`user_konfi_${USERS.teamer1.id}`);
    });

    it('sendet an einen Konfi weiterhin in den KONFI-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io, db);

      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({});

      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 150));

      const rooms = raeume(emits);
      expect(rooms).toContain(`user_konfi_${USERS.konfi1.id}`);
      expect(rooms).not.toContain(`user_teamer_${USERS.konfi1.id}`);
    });
  });

  describe('POST /:id/participants (Leitung traegt jemanden ein)', () => {
    it('sendet an eine eingetragene Teamerin in den TEAMER-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io, db);

      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/participants`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({ user_id: USERS.teamer1.id });

      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 150));

      const rooms = raeume(emits);
      expect(rooms).toContain(`user_teamer_${USERS.teamer1.id}`);
      expect(rooms).not.toContain(`user_konfi_${USERS.teamer1.id}`);
    });

    it('sendet an einen eingetragenen Konfi in den KONFI-Raum', async () => {
      const { io, emits } = createFakeIo();
      liveUpdate.init(io, db);

      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/participants`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({ user_id: USERS.konfi1.id });

      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 150));

      const rooms = raeume(emits);
      expect(rooms).toContain(`user_konfi_${USERS.konfi1.id}`);
      expect(rooms).not.toContain(`user_teamer_${USERS.konfi1.id}`);
    });
  });
});
