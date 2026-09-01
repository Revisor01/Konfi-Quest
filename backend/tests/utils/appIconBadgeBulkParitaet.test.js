// backend/tests/utils/appIconBadgeBulkParitaet.test.js
//
// Befund B2b, letzte Stelle: Der Hintergrund-Sync laeuft alle fuenf Minuten
// ueber ALLE Nutzer:innen. Einzeln gerechnet kostet das sieben Abfragen je
// Person — bei 1000 Konfis rund 7000 je Takt. Deshalb gibt es neben
// `berechneAppIconSumme` (eine Person) `appIconSummenFuerAlle` (viele
// Personen, sechs Abfragen insgesamt).
//
// Zwei Wege zur selben Zahl sind genau das, was den urspruenglichen Fehler
// ausgemacht hat. Beide teilen sich deshalb dieselben SQL-Bausteine — der
// Einzelweg IST ein Bulk-Aufruf mit einem Element. Dieser Test haelt fest,
// dass es dabei bleibt: Fuer dieselben Daten muessen beide Wege je Rolle
// exakt dasselbe liefern.
//
// Der Nachbar `appIconBadgeParitaet.test.js` prueft die andere Kante:
// Server-Summe gegen das, was der Client anzeigt.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ACTIVITIES, JAHRGAENGE } = require('../helpers/seed');
const { berechneAppIconSumme, appIconSummenFuerAlle } = require('../../utils/appIconBadge');

describe('Einzel- und Bulk-Weg liefern dieselbe App-Icon-Summe', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  const empfaengerFuer = (user, roleName, jahrgaenge = []) => ({
    id: user.id,
    type: user.type,
    role_name: roleName,
    organization_id: ORGS.testGemeinde.id,
    assigned_jahrgaenge: jahrgaenge
  });

  // Rechnet beide Wege fuer dieselbe Liste und gibt je Person
  // { einzeln, bulk } zurueck.
  const beideWege = async (liste) => {
    const bulk = await appIconSummenFuerAlle(db, liste);
    const ergebnis = [];
    for (const e of liste) {
      ergebnis.push({
        einzeln: await berechneAppIconSumme(db, e),
        bulk: bulk.get(`${e.id}_${e.type}`)
      });
    }
    return ergebnis;
  };

  it('alle Rollen gleichzeitig, wenn nichts offen ist: beide 0', async () => {
    const liste = [
      empfaengerFuer(USERS.konfi1, 'konfi'),
      empfaengerFuer(USERS.teamer1, 'teamer'),
      empfaengerFuer(USERS.admin1, 'admin')
    ];
    const [konfi, teamer, admin] = await beideWege(liste);

    expect(konfi.bulk).toBe(konfi.einzeln);
    expect(teamer.bulk).toBe(teamer.einzeln);
    expect(admin.bulk).toBe(admin.einzeln);
    // Und zwar auf 0, nicht auf irgendeinem gemeinsamen Zufallswert.
    expect(konfi.einzeln).toBe(0);
    expect(teamer.einzeln).toBe(0);
    expect(admin.einzeln).toBe(0);
  });

  it('Konfi: Chat plus ungesehenes Abzeichen', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES
       (1, $1, 'admin', 'A'), (1, $1, 'admin', 'B'), (2, $1, 'admin', 'C')`,
      [USERS.admin1.id]
    );
    const { rows: [abzeichen] } = await db.query(
      `INSERT INTO custom_badges (name, icon, criteria_type, criteria_value, organization_id, is_active, target_role)
       VALUES ('Bulk-Paritaet', 'star', 'total_points', 1, $1, true, 'konfi') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, seen) VALUES ($1, $2, $3, false)`,
      [USERS.konfi1.id, abzeichen.id, ORGS.testGemeinde.id]
    );

    const [konfi] = await beideWege([empfaengerFuer(USERS.konfi1, 'konfi')]);
    expect(konfi.bulk).toBe(konfi.einzeln);
    // 3 Chat-Nachrichten + 1 Abzeichen.
    expect(konfi.einzeln).toBe(4);
  });

  it('Leitung: org_admin zaehlt Antraege org-weit, gebundener admin nur seine Jahrgaenge', async () => {
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-08-27', 'pending', $3), ($4, $2, '2026-08-27', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORGS.testGemeinde.id, USERS.konfi2.id]
    );

    // Jahrgangs-Bindung (01.09.2026): Der org_admin bekommt die org-weite
    // Zahl verteilt; die Rolle 'admin' zaehlt personenbezogen nach ihren
    // Zuweisungen (beide Konfis liegen in jahrgang1). Ein admin OHNE
    // Zuweisung zaehlt 0 — Einzel- und Bulk-Weg muessen in allen drei
    // Faellen dasselbe liefern.
    const [adminMitJg, adminOhneJg, orgAdmin] = await beideWege([
      empfaengerFuer(USERS.admin1, 'admin', [{ id: JAHRGAENGE.jahrgang1.id, can_view: true }]),
      empfaengerFuer(USERS.admin2, 'admin'),
      empfaengerFuer(USERS.orgAdmin1, 'org_admin')
    ]);

    expect(adminMitJg.bulk).toBe(adminMitJg.einzeln);
    expect(adminOhneJg.bulk).toBe(adminOhneJg.einzeln);
    expect(orgAdmin.bulk).toBe(orgAdmin.einzeln);
    expect(adminMitJg.einzeln).toBe(2);
    expect(adminOhneJg.einzeln).toBe(0);
    expect(orgAdmin.einzeln).toBe(2);
  });

  it('Teamer: Freigaben haengen an den zugewiesenen Jahrgaengen', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (3, $1, 'admin', 'Team')`,
      [USERS.admin1.id]
    );
    const { rows: [challenge] } = await db.query(
      `INSERT INTO challenges (title, description, badge_name, organization_id, audience, created_by, starts_at, ends_at, is_draft)
       VALUES ('Bulk-Runde', 'Test', 'Stempel', $1, 'nur_team', $2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false) RETURNING id`,
      [ORGS.testGemeinde.id, USERS.admin1.id]
    );
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, media_type, text_content, moderation_status, organization_id)
       VALUES ($1, $2, 'text', 'Beitrag', 'pending', $3)`,
      [challenge.id, USERS.konfi1.id, ORGS.testGemeinde.id]
    );

    const [teamer] = await beideWege([
      empfaengerFuer(USERS.teamer1, 'teamer', [{ id: 1, can_view: true }])
    ]);
    expect(teamer.bulk).toBe(teamer.einzeln);
    // 1 Chat-Nachricht + 1 offene Freigabe (nur_team gilt org-weit).
    expect(teamer.einzeln).toBe(2);
  });

  it('mehrere Personen gemischt: jede bekommt ihre eigene Zahl', async () => {
    // Nachricht in Raum 2 — dort sitzt nur konfi1, nicht konfi2.
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (2, $1, 'admin', 'Nur fuer konfi1')`,
      [USERS.admin1.id]
    );

    const liste = [
      empfaengerFuer(USERS.konfi1, 'konfi'),
      empfaengerFuer(USERS.konfi2, 'konfi'),
      empfaengerFuer(USERS.teamer1, 'teamer', [{ id: 1, can_view: true }]),
      empfaengerFuer(USERS.admin1, 'admin')
    ];
    const ergebnis = await beideWege(liste);

    for (const { einzeln, bulk } of ergebnis) expect(bulk).toBe(einzeln);
    // konfi1 sieht die Nachricht, sonst niemand.
    expect(ergebnis.map(e => e.einzeln)).toEqual([1, 0, 0, 0]);
  });

  it('leere Liste liefert eine leere Zuordnung', async () => {
    const summen = await appIconSummenFuerAlle(db, []);
    expect(summen.size).toBe(0);
  });
});
