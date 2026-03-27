// backend/tests/helpers/seed.js — Realistische Seed-Fixtures fuer Integration-Tests
// Per D-05/D-06: JS-Modul (nicht SQL) fuer referenzierbare IDs
const bcrypt = require('bcrypt');

const PASSWORD = 'testpasswort123';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

// ====================================================================
// ORGANISATIONEN
// ====================================================================
const ORGS = {
  testGemeinde: { id: 1, name: 'Test-Gemeinde', slug: 'test-gemeinde', display_name: 'Test-Gemeinde St. Martin' },
  andereGemeinde: { id: 2, name: 'Andere Gemeinde', slug: 'andere-gemeinde', display_name: 'Andere Gemeinde' },
};

// ====================================================================
// ROLLEN (per D-10: echte RBAC-Rollen, identisch zu Produktion)
// ====================================================================
const ROLES = {
  konfi: { id: 1, name: 'konfi', display_name: 'Konfi', org_id: 1 },
  teamer: { id: 2, name: 'teamer', display_name: 'Teamer:in', org_id: 1 },
  admin: { id: 3, name: 'admin', display_name: 'Admin', org_id: 1 },
  orgAdmin: { id: 4, name: 'org_admin', display_name: 'Org-Admin', org_id: 1 },
  superAdmin: { id: 5, name: 'super_admin', display_name: 'Super-Admin', org_id: 1 },
  // Rollen fuer Org 2
  konfi2: { id: 6, name: 'konfi', display_name: 'Konfi', org_id: 2 },
  teamer2: { id: 7, name: 'teamer', display_name: 'Teamer:in', org_id: 2 },
  admin2: { id: 8, name: 'admin', display_name: 'Admin', org_id: 2 },
  orgAdmin2: { id: 9, name: 'org_admin', display_name: 'Org-Admin', org_id: 2 },
};

// ====================================================================
// USERS (5 Rollen x 2 Orgs + SuperAdmin = 10 Users)
// ====================================================================
const USERS = {
  // Org 1 (Test-Gemeinde)
  konfi1:    { id: 1,  username: 'konfi1',    display_name: 'Test Konfi 1',     role_id: 1, org_id: 1, type: 'konfi' },
  konfi2:    { id: 2,  username: 'konfi2',    display_name: 'Test Konfi 2',     role_id: 1, org_id: 1, type: 'konfi' },
  teamer1:   { id: 3,  username: 'teamer1',   display_name: 'Test Teamer 1',    role_id: 2, org_id: 1, type: 'teamer' },
  admin1:    { id: 4,  username: 'admin1',    display_name: 'Test Admin 1',     role_id: 3, org_id: 1, type: 'admin' },
  orgAdmin1: { id: 5,  username: 'orgadmin1', display_name: 'Test Org-Admin 1', role_id: 4, org_id: 1, type: 'admin' },
  // Org 2 (Andere Gemeinde)
  konfi3:    { id: 6,  username: 'konfi3',    display_name: 'Test Konfi 3',     role_id: 6, org_id: 2, type: 'konfi' },
  teamer2:   { id: 7,  username: 'teamer2',   display_name: 'Test Teamer 2',    role_id: 7, org_id: 2, type: 'teamer' },
  admin2:    { id: 8,  username: 'admin2',    display_name: 'Test Admin 2',     role_id: 8, org_id: 2, type: 'admin' },
  orgAdmin2: { id: 9,  username: 'orgadmin2', display_name: 'Test Org-Admin 2', role_id: 9, org_id: 2, type: 'admin' },
  // Super-Admin (org-uebergreifend, is_super_admin=true)
  superAdmin: { id: 10, username: 'superadmin', display_name: 'Test Super-Admin', role_id: 5, org_id: 1, type: 'admin', is_super_admin: true },
};

// ====================================================================
// JAHRGAENGE
// ====================================================================
const JAHRGAENGE = {
  jahrgang1: { id: 1, name: '2025/2026', org_id: 1 },
  jahrgang2: { id: 2, name: '2025/2026', org_id: 2 },
};

// ====================================================================
// CATEGORIES
// ====================================================================
const CATEGORIES = {
  gottesdienst1: { id: 1, name: 'Gottesdienst', type: 'activity', org_id: 1 },
  gemeinde1:     { id: 2, name: 'Gemeinde',     type: 'activity', org_id: 1 },
  gottesdienst2: { id: 3, name: 'Gottesdienst', type: 'activity', org_id: 2 },
  gemeinde2:     { id: 4, name: 'Gemeinde',     type: 'activity', org_id: 2 },
};

// ====================================================================
// ACTIVITIES
// ====================================================================
const ACTIVITIES = {
  sonntagsgottesdienst: { id: 1, name: 'Sonntagsgottesdienst', gp: 1, gep: 0, org_id: 1 },
  jugendgottesdienst:   { id: 2, name: 'Jugendgottesdienst',   gp: 1, gep: 0, org_id: 1 },
  gemeindefest:         { id: 3, name: 'Gemeindefest',         gp: 0, gep: 2, org_id: 1 },
  kirchenchor:          { id: 4, name: 'Kirchenchor',          gp: 0, gep: 1, org_id: 1 },
  gottesdienst2:        { id: 5, name: 'Sonntagsgottesdienst', gp: 1, gep: 0, org_id: 2 },
  gemeinde2:            { id: 6, name: 'Gemeindearbeit',       gp: 0, gep: 1, org_id: 2 },
};

// ====================================================================
// BADGES (custom_badges Tabelle, alle 4 Vergabe-Typen)
// ====================================================================
const BADGES = {
  streak:        { id: 1, name: 'Fleissig',       criteria_type: 'streak',         criteria_value: 3, org_id: 1, icon: 'flame', color: '#ef4444' },
  categoryBased: { id: 2, name: 'Gottesdienst-Profi', criteria_type: 'category_based', criteria_value: 5, org_id: 1, icon: 'church', color: '#3b82f6', criteria_extra: { category_id: 1 } },
  timeBased:     { id: 3, name: 'Fruehaufsteher',  criteria_type: 'time_based',     criteria_value: 1, org_id: 1, icon: 'sunny', color: '#f59e0b', criteria_extra: { month: 12 } },
  yearly:        { id: 4, name: 'Jahresbeste:r',   criteria_type: 'yearly',         criteria_value: 20, org_id: 1, icon: 'trophy', color: '#7c3aed' },
  streak2:       { id: 5, name: 'Fleissig',        criteria_type: 'streak',         criteria_value: 3, org_id: 2, icon: 'flame', color: '#ef4444' },
};

// ====================================================================
// LEVELS
// ====================================================================
const LEVELS = {
  novize:   { id: 1, name: 'novize',   title: 'Novize',   points_required: 0,  org_id: 1, color: '#10b981' },
  lehrling: { id: 2, name: 'lehrling', title: 'Lehrling', points_required: 5,  org_id: 1, color: '#3b82f6' },
  gehilfe:  { id: 3, name: 'gehilfe',  title: 'Gehilfe',  points_required: 10, org_id: 1, color: '#8b5cf6' },
  experte:  { id: 4, name: 'experte',  title: 'Experte',  points_required: 20, org_id: 1, color: '#f59e0b' },
  novize2:  { id: 5, name: 'novize',   title: 'Novize',   points_required: 0,  org_id: 2, color: '#10b981' },
};

// ====================================================================
// EVENTS
// ====================================================================
const EVENTS = {
  gottesdienstEvent: { id: 1, name: 'Weihnachtsgottesdienst', org_id: 1, mandatory: false, max_participants: 50, point_type: 'gottesdienst', points: 2 },
  pflichtEvent:      { id: 2, name: 'Konfi-Unterricht',       org_id: 1, mandatory: true,  max_participants: 0,  point_type: 'gemeinde',     points: 1 },
  timeslotEvent:     { id: 3, name: 'Workshop-Tag',           org_id: 1, mandatory: false, max_participants: 20, point_type: 'gemeinde',     points: 1, has_timeslots: true },
  event2:            { id: 4, name: 'Gemeindeabend',          org_id: 2, mandatory: false, max_participants: 30, point_type: 'gemeinde',     points: 1 },
};

// ====================================================================
// CHAT-RAEUME
// ====================================================================
const CHAT_ROOMS = {
  jahrgang:  { id: 1, name: 'Jahrgang 2025/2026', type: 'jahrgang', jahrgang_id: 1, created_by: 4, org_id: 1 },
  direct:    { id: 2, name: 'Direkt',              type: 'direct',   jahrgang_id: null, created_by: 1, org_id: 1 },
  group:     { id: 3, name: 'Teamer-Gruppe',       type: 'group',    jahrgang_id: null, created_by: 3, org_id: 1 },
  jahrgang2: { id: 4, name: 'Jahrgang 2025/2026',  type: 'jahrgang', jahrgang_id: 2, created_by: 8, org_id: 2 },
};

// ====================================================================
// SEED-FUNKTION
// ====================================================================
async function seed(db) {
  // 1. Organisationen
  for (const org of Object.values(ORGS)) {
    await db.query(
      `INSERT INTO organizations (id, name, slug, display_name, is_active) VALUES ($1, $2, $3, $4, true)`,
      [org.id, org.name, org.slug, org.display_name]
    );
  }

  // 2. Rollen (FK: organizations)
  for (const role of Object.values(ROLES)) {
    await db.query(
      `INSERT INTO roles (id, name, display_name, organization_id) VALUES ($1, $2, $3, $4)`,
      [role.id, role.name, role.display_name, role.org_id]
    );
  }

  // 3. Users (FK: roles, organizations)
  for (const user of Object.values(USERS)) {
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active, is_super_admin)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
      [user.id, user.username, PASSWORD_HASH, user.display_name, user.role_id, user.org_id, user.is_super_admin || false]
    );
  }

  // 4. Jahrgaenge (FK: organizations)
  for (const jg of Object.values(JAHRGAENGE)) {
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, is_active) VALUES ($1, $2, $3, true)`,
      [jg.id, jg.name, jg.org_id]
    );
  }

  // 5. Konfi-Profiles (FK: users, jahrgaenge, organizations)
  const konfis = [USERS.konfi1, USERS.konfi2, USERS.konfi3];
  for (const konfi of konfis) {
    const jgId = konfi.org_id === 1 ? JAHRGAENGE.jahrgang1.id : JAHRGAENGE.jahrgang2.id;
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, $3)`,
      [konfi.id, jgId, konfi.org_id]
    );
  }

  // 6. User-Jahrgang-Assignments (Konfis + Teamer)
  const assignments = [
    { user_id: USERS.konfi1.id,  jg_id: JAHRGAENGE.jahrgang1.id },
    { user_id: USERS.konfi2.id,  jg_id: JAHRGAENGE.jahrgang1.id },
    { user_id: USERS.teamer1.id, jg_id: JAHRGAENGE.jahrgang1.id },
    { user_id: USERS.konfi3.id,  jg_id: JAHRGAENGE.jahrgang2.id },
    { user_id: USERS.teamer2.id, jg_id: JAHRGAENGE.jahrgang2.id },
  ];
  for (const a of assignments) {
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)`,
      [a.user_id, a.jg_id]
    );
  }

  // 7. Categories (FK: organizations)
  for (const cat of Object.values(CATEGORIES)) {
    await db.query(
      `INSERT INTO categories (id, name, type, organization_id) VALUES ($1, $2, $3, $4)`,
      [cat.id, cat.name, cat.type, cat.org_id]
    );
  }

  // 8. Activities (FK: organizations)
  for (const act of Object.values(ACTIVITIES)) {
    await db.query(
      `INSERT INTO activities (id, name, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [act.id, act.name, act.gp, act.gep, act.org_id]
    );
  }

  // 9. Activity-Category Relations
  await db.query(`INSERT INTO activity_categories (activity_id, category_id) VALUES (1, 1), (2, 1), (3, 2), (4, 2), (5, 3), (6, 4)`);

  // 10. Badges / custom_badges (alle 4 Vergabe-Typen: streak, category_based, time_based, yearly)
  for (const badge of Object.values(BADGES)) {
    await db.query(
      `INSERT INTO custom_badges (id, name, criteria_type, criteria_value, criteria_extra, organization_id, icon, color, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [badge.id, badge.name, badge.criteria_type, badge.criteria_value, badge.criteria_extra ? JSON.stringify(badge.criteria_extra) : null, badge.org_id, badge.icon, badge.color]
    );
  }

  // 11. Levels (FK: organizations)
  for (const level of Object.values(LEVELS)) {
    await db.query(
      `INSERT INTO levels (id, organization_id, name, title, points_required, color, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [level.id, level.org_id, level.name, level.title, level.points_required, level.color]
    );
  }

  // 12. Events (FK: organizations)
  for (const event of Object.values(EVENTS)) {
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, mandatory, max_participants, point_type, points, has_timeslots)
       VALUES ($1, $2, NOW() + interval '7 days', $3, $4, $5, $6, $7, $8)`,
      [event.id, event.name, event.org_id, event.mandatory, event.max_participants, event.point_type, event.points, event.has_timeslots || false]
    );
  }

  // 13. Event-Timeslots (fuer timeslotEvent)
  await db.query(
    `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
     VALUES ($1, NOW() + interval '7 days', NOW() + interval '7 days' + interval '2 hours', 10, $2)`,
    [EVENTS.timeslotEvent.id, ORGS.testGemeinde.id]
  );

  // 14. Bonus-Punkte
  await db.query(
    `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
     VALUES ($1, 3, 'gottesdienst', 'Sonderpunkte Weihnachten', $2, $3)`,
    [USERS.konfi1.id, USERS.admin1.id, ORGS.testGemeinde.id]
  );

  // 15. Chat-Raeume
  for (const room of Object.values(CHAT_ROOMS)) {
    await db.query(
      `INSERT INTO chat_rooms (id, name, type, jahrgang_id, created_by, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [room.id, room.name, room.type, room.jahrgang_id, room.created_by, room.org_id]
    );
  }

  // 16. Chat-Teilnehmer (Jahrgangs-Chat: alle Konfis + Teamer aus Org 1)
  const chatParticipants = [
    { room_id: 1, user_id: USERS.konfi1.id,  user_type: 'konfi' },
    { room_id: 1, user_id: USERS.konfi2.id,  user_type: 'konfi' },
    { room_id: 1, user_id: USERS.teamer1.id, user_type: 'admin' },
    { room_id: 1, user_id: USERS.admin1.id,  user_type: 'admin' },
    { room_id: 2, user_id: USERS.konfi1.id,  user_type: 'konfi' },
    { room_id: 2, user_id: USERS.admin1.id,  user_type: 'admin' },
    { room_id: 3, user_id: USERS.teamer1.id, user_type: 'admin' },
    { room_id: 3, user_id: USERS.admin1.id,  user_type: 'admin' },
  ];
  for (const p of chatParticipants) {
    await db.query(
      `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)`,
      [p.room_id, p.user_id, p.user_type]
    );
  }

  // Sequence-Werte korrigieren (nach expliziten IDs)
  await db.query(`SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations))`);
  await db.query(`SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles))`);
  await db.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
  await db.query(`SELECT setval('jahrgaenge_id_seq', (SELECT MAX(id) FROM jahrgaenge))`);
  await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
  await db.query(`SELECT setval('activities_id_seq', (SELECT MAX(id) FROM activities))`);
  await db.query(`SELECT setval('custom_badges_id_seq', (SELECT MAX(id) FROM custom_badges))`);
  await db.query(`SELECT setval('levels_id_seq', (SELECT MAX(id) FROM levels))`);
  await db.query(`SELECT setval('events_id_seq', (SELECT MAX(id) FROM events))`);
  await db.query(`SELECT setval('chat_rooms_id_seq', (SELECT MAX(id) FROM chat_rooms))`);

  return { ORGS, ROLES, USERS, JAHRGAENGE, CATEGORIES, ACTIVITIES, BADGES, LEVELS, EVENTS, CHAT_ROOMS };
}

module.exports = { seed, ORGS, ROLES, USERS, JAHRGAENGE, CATEGORIES, ACTIVITIES, BADGES, LEVELS, EVENTS, CHAT_ROOMS, PASSWORD };
