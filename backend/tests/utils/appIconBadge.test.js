// backend/tests/utils/appIconBadge.test.js
//
// Befund B2b (27.08.2026): Das App-Icon hatte mehrere Schreiber mit
// unterschiedlicher Bedeutung.
//
// - Der Chat-Push setzte die CHAT-Unread-Zahl allein aufs Icon
//   (chat.js:1105, 1905) und ueberschrieb damit Antraege, Termine,
//   Challenge-Freigaben und Abzeichen.
// - Alle anderen Pushes fielen auf `badge: 1` zurueck (pushService.js).
// - Nur der Client kannte die echte Summe -- konnte sie bei geschlossener
//   App aber nicht setzen. Genau dann ist das Icon aber das Einzige, was
//   jemand sieht, bevor er die App oeffnet.
//
// Diese Tests halten fest, dass die Server-Summe dieselbe Aufteilung je Rolle
// verwendet wie BadgeContext.totalBadgeCount im Frontend. Weicht eine der
// beiden Seiten ab, stimmt das Icon wieder nicht mit den Reitern ueberein.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { berechneAppIconSumme } = require('../../utils/appIconBadge');

const alsEmpfaenger = (u, extra = {}) => ({
  id: u.id,
  type: u.type,
  organization_id: ORGS.testGemeinde.id,
  assigned_jahrgaenge: [],
  ...extra,
});

describe('berechneAppIconSumme (Befund B2b)', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  it('ohne offene Punkte ist die Summe 0', async () => {
    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    expect(summe).toBe(0);
  });

  it('ungelesene Chat-Nachrichten zaehlen', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES
       (1, $1, 'admin', 'Eins'), (1, $1, 'admin', 'Zwei')`,
      [USERS.admin1.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    expect(summe).toBe(2);
  });

  it('eigene Nachrichten zaehlen NICHT mit', async () => {
    // Sonst stuende nach der eigenen letzten Nachricht dauerhaft eine Eins
    // am Icon. Dieselbe Bedingung wie in badge-counts.
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (1, $1, 'konfi', 'Von mir')`,
      [USERS.konfi1.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    expect(summe).toBe(0);
  });

  it('ungesehene Abzeichen zaehlen bei Konfis mit', async () => {
    const { rows: [badge] } = await db.query(
      `INSERT INTO custom_badges (name, icon, criteria_type, criteria_value, organization_id, is_active, target_role)
       VALUES ('Testabzeichen', 'star', 'total_points', 1, $1, true, 'konfi') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, seen) VALUES ($1, $2, $3, false)`,
      [USERS.konfi1.id, badge.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    expect(summe).toBe(1);
  });

  it('gesehene Abzeichen zaehlen nicht mehr', async () => {
    const { rows: [badge] } = await db.query(
      `INSERT INTO custom_badges (name, icon, criteria_type, criteria_value, organization_id, is_active, target_role)
       VALUES ('Gesehen', 'star', 'total_points', 1, $1, true, 'konfi') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, seen) VALUES ($1, $2, $3, true)`,
      [USERS.konfi1.id, badge.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    expect(summe).toBe(0);
  });

  // Der Kern des Befunds: Das Icon muss ALLES zusammenzaehlen, nicht nur
  // den Chat. Vorher ueberschrieb eine Chat-Nachricht die uebrigen Zaehler.
  it('Chat UND Abzeichen zaehlen gemeinsam', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (1, $1, 'admin', 'Hallo')`,
      [USERS.admin1.id]
    );
    const { rows: [badge] } = await db.query(
      `INSERT INTO custom_badges (name, icon, criteria_type, criteria_value, organization_id, is_active, target_role)
       VALUES ('Dazu', 'star', 'total_points', 1, $1, true, 'konfi') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, seen) VALUES ($1, $2, $3, false)`,
      [USERS.konfi1.id, badge.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    // 1 Chat + 1 Abzeichen. Vorher haette der Chat-Push hier 1 gesetzt.
    expect(summe).toBe(2);
  });

  it('die Leitung bekommt offene Antraege mitgezaehlt', async () => {
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.admin1, { role_name: 'admin' }));
    expect(summe).toBe(1);
  });

  it('Konfis bekommen die Antraege der Leitung NICHT mitgezaehlt', async () => {
    // Gegenprobe zur Rollen-Aufteilung: Der Client zeigt pendingRequests nur
    // fuer Admin-Typen, der Server muss dieselbe Grenze ziehen.
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.konfi1));
    expect(summe).toBe(0);
  });

  it('super_admin zaehlt nicht als Admin-Typ', async () => {
    // Wie im Client (BadgeContext:57): super_admin ist eine org-fremde Rolle
    // und bekommt die Leitungs-Zaehler nicht.
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(
      db,
      alsEmpfaenger(USERS.admin1, { role_name: 'super_admin' })
    );
    expect(summe).toBe(0);
  });

  it('zaehlt nur die eigene Organisation', async () => {
    // Gegenprobe zur Org-Grenze: Eine fremde Gemeinde darf das Icon nicht
    // beeinflussen.
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id]
    );

    const summe = await berechneAppIconSumme(
      db,
      alsEmpfaenger(USERS.admin2, { role_name: 'admin', organization_id: ORGS.andereGemeinde.id })
    );
    expect(summe).toBe(0);
  });

  it('die Summe wird nie negativ', async () => {
    const summe = await berechneAppIconSumme(db, alsEmpfaenger(USERS.teamer1));
    expect(summe).toBeGreaterThanOrEqual(0);
  });
});
