// backend/tests/utils/chatMembershipSync.test.js
// Tests fuer die Multi-Org-Faehigkeit des Chat-Mitgliedschafts-Syncs:
// Mitglieder via user_organizations (Org-Switcher, Migration 101) muessen von
// syncJahrgangChat/syncTeamChat als Soll-Mitglieder erkannt werden — sonst
// wirft der Sync eingewechselte Org-Admins/Teamer:innen aus den Raeumen
// (Bug: Jahrgangschat der Zweit-Org verschwand nach dem ersten Sync).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { syncJahrgangChat } = require('../../utils/jahrgangChat');
const { syncTeamChat } = require('../../utils/teamChat');

const ORG2 = 2;

describe('Chat-Mitgliedschafts-Sync mit user_organizations (Multi-Org)', () => {
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

  async function addMembership(userId, orgId, roleId) {
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, organization_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
      [userId, orgId, roleId]
    );
  }

  async function participants(roomId) {
    const { rows } = await db.query(
      'SELECT user_id, user_type FROM chat_participants WHERE room_id = $1',
      [roomId]
    );
    return rows;
  }

  it('Jahrgangs-Chat: eingewechselter Org-Admin (nur user_organizations) wird aufgenommen und NICHT wieder entfernt', async () => {
    // orgAdmin1 hat Primaer-Org 1, bekommt Zusatz-Mitgliedschaft als org_admin in Org 2
    await addMembership(USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);

    const roomId = await syncJahrgangChat(db, JAHRGAENGE.jahrgang2.id, ORG2, USERS.orgAdmin2.id);
    expect(roomId).toBeTruthy();

    let rows = await participants(roomId);
    expect(rows).toContainEqual({ user_id: USERS.orgAdmin1.id, user_type: 'admin' });

    // Zweiter Sync-Lauf (Regression: frueher wurde er hier als Nicht-Soll entfernt)
    await syncJahrgangChat(db, JAHRGAENGE.jahrgang2.id, ORG2, USERS.orgAdmin2.id);
    rows = await participants(roomId);
    expect(rows).toContainEqual({ user_id: USERS.orgAdmin1.id, user_type: 'admin' });
  });

  it('Jahrgangs-Chat: eingewechselte Teamerin mit Jahrgangs-Zuweisung wird als teamer aufgenommen', async () => {
    await addMembership(USERS.teamer1.id, ORG2, ROLES.teamer2.id);
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view)
       VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
      [USERS.teamer1.id, JAHRGAENGE.jahrgang2.id]
    );

    const roomId = await syncJahrgangChat(db, JAHRGAENGE.jahrgang2.id, ORG2, USERS.orgAdmin2.id);
    const rows = await participants(roomId);
    expect(rows).toContainEqual({ user_id: USERS.teamer1.id, user_type: 'teamer' });
  });

  it('Jahrgangs-Chat: Nicht-Mitglieder werden weiterhin entfernt (Aufraeumen intakt)', async () => {
    const roomId = await syncJahrgangChat(db, JAHRGAENGE.jahrgang2.id, ORG2, USERS.orgAdmin2.id);

    // teamer1 (Org 1, KEINE Mitgliedschaft/Zuweisung in Org 2) manuell reinschmuggeln
    await db.query(
      `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'teamer')
       ON CONFLICT DO NOTHING`,
      [roomId, USERS.teamer1.id]
    );

    await syncJahrgangChat(db, JAHRGAENGE.jahrgang2.id, ORG2, USERS.orgAdmin2.id);
    const rows = await participants(roomId);
    expect(rows).not.toContainEqual({ user_id: USERS.teamer1.id, user_type: 'teamer' });
  });

  it('Team-Chat: eingewechseltes Mitglied (nur user_organizations) wird aufgenommen und bleibt drin', async () => {
    await addMembership(USERS.orgAdmin1.id, ORG2, ROLES.orgAdmin2.id);

    const roomId = await syncTeamChat(db, ORG2, USERS.orgAdmin2.id);
    expect(roomId).toBeTruthy();

    let rows = await participants(roomId);
    expect(rows).toContainEqual({ user_id: USERS.orgAdmin1.id, user_type: 'admin' });

    await syncTeamChat(db, ORG2, USERS.orgAdmin2.id);
    rows = await participants(roomId);
    expect(rows).toContainEqual({ user_id: USERS.orgAdmin1.id, user_type: 'admin' });
  });

  it('Team-Chat: Primaer-Org-Mitglieder sind unveraendert drin (Regression)', async () => {
    const roomId = await syncTeamChat(db, ORG2, USERS.orgAdmin2.id);
    const rows = await participants(roomId);
    expect(rows).toContainEqual({ user_id: USERS.teamer2.id, user_type: 'teamer' });
    expect(rows).toContainEqual({ user_id: USERS.admin2.id, user_type: 'admin' });
    expect(rows).toContainEqual({ user_id: USERS.orgAdmin2.id, user_type: 'admin' });
    // Konfis nie im Team-Chat
    expect(rows.map(r => r.user_id)).not.toContain(USERS.konfi3.id);
  });
});
