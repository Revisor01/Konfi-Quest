// backend/tests/utils/eventChatRolleJeGemeinde.test.js
//
// Event-Chat: Der Teilnehmer-Typ richtet sich nach der Rolle in der Gemeinde
// des TERMINS (Simon, 08.10.2026, docs/planung/mehrfach-konten.md Punkt 1).
//
// Bis dahin lasen addToEventChat und syncEventChat die Rolle am Konto -- die
// der Stamm-Gemeinde. Wer zuhause Gemeindeleitung und in B Teamer:in ist,
// sass in B's Event-Chats als 'admin'; Chatliste und Zaehler in B suchen
// user_type = 'teamer' und fanden den Raum nicht.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, EVENTS } = require('../helpers/seed');
const { addToEventChat, syncEventChat } = require('../../utils/eventChat');

describe('Event-Chat: Teilnehmer-Typ nach der Rolle in der Gemeinde des Termins', () => {
  let db;
  let raumB;
  let raumA;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Gemeindeleitung in Org 1 (Stamm), in Org 2 Teamer:in.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
    );
    ({ rows: [raumB] } = await db.query(
      `INSERT INTO chat_rooms (name, type, created_by, organization_id, event_id)
       VALUES ('Gemeindeabend', 'group', $1, $2, $3) RETURNING id`,
      [USERS.admin2.id, ORGS.andereGemeinde.id, EVENTS.event2.id]
    ));
    ({ rows: [raumA] } = await db.query(
      `INSERT INTO chat_rooms (name, type, created_by, organization_id, event_id)
       VALUES ('Weihnachten', 'group', $1, $2, $3) RETURNING id`,
      [USERS.admin1.id, ORGS.testGemeinde.id, EVENTS.gottesdienstEvent.id]
    ));
  });

  const buchen = (eventId, userId, orgId) => db.query(
    `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
     VALUES ($1, $2, 'confirmed', $3)`,
    [eventId, userId, orgId]
  );
  const typIn = async (roomId, userId) => {
    const { rows } = await db.query(
      'SELECT user_type FROM chat_participants WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    return rows.map((r) => r.user_type);
  };

  it('addToEventChat: Termin in der weiteren Gemeinde -> teamer', async () => {
    await buchen(EVENTS.event2.id, USERS.orgAdmin1.id, ORGS.andereGemeinde.id);
    const n = await addToEventChat(db, EVENTS.event2.id, USERS.orgAdmin1.id, ORGS.andereGemeinde.id);
    expect(n).toBe(1);
    expect(await typIn(raumB.id, USERS.orgAdmin1.id)).toEqual(['teamer']);
  });

  it('addToEventChat: Termin in der Stamm-Gemeinde -> admin', async () => {
    await buchen(EVENTS.gottesdienstEvent.id, USERS.orgAdmin1.id, ORGS.testGemeinde.id);
    const n = await addToEventChat(db, EVENTS.gottesdienstEvent.id, USERS.orgAdmin1.id, ORGS.testGemeinde.id);
    expect(n).toBe(1);
    expect(await typIn(raumA.id, USERS.orgAdmin1.id)).toEqual(['admin']);
  });

  it('syncEventChat: weitere Gemeinde -> teamer, Konfis und Leitung dort unveraendert', async () => {
    await buchen(EVENTS.event2.id, USERS.orgAdmin1.id, ORGS.andereGemeinde.id);
    await buchen(EVENTS.event2.id, USERS.konfi3.id, ORGS.andereGemeinde.id);
    await buchen(EVENTS.event2.id, USERS.admin2.id, ORGS.andereGemeinde.id);
    const n = await syncEventChat(db, EVENTS.event2.id, ORGS.andereGemeinde.id);
    expect(n).toBe(3);
    expect(await typIn(raumB.id, USERS.orgAdmin1.id)).toEqual(['teamer']);
    expect(await typIn(raumB.id, USERS.konfi3.id)).toEqual(['konfi']);
    expect(await typIn(raumB.id, USERS.admin2.id)).toEqual(['admin']);
  });

  it('syncEventChat: Stamm-Gemeinde -> admin, auch wenn user_organizations sie mit anderer Rolle fuehrt', async () => {
    // Altbestand aus Migration 101: Stamm-Zeile mit abweichender Rolle.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS.orgAdmin1.id, ORGS.testGemeinde.id, ROLES.teamer.id]
    );
    await buchen(EVENTS.gottesdienstEvent.id, USERS.orgAdmin1.id, ORGS.testGemeinde.id);
    await syncEventChat(db, EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id);
    expect(await typIn(raumA.id, USERS.orgAdmin1.id)).toEqual(['admin']);
  });
});
