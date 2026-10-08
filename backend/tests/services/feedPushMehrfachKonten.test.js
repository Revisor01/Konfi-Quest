// backend/tests/services/feedPushMehrfachKonten.test.js
//
// Feed-Push (sendChallengeFeedToJahrgaenge) ueber BEIDE Quellen der
// Zugehoerigkeit (08.10.2026, Rest der Mehrfach-Konten).
//
// Die Empfaengerabfrage fragte `u.organization_id = $1` und `u.role_id` --
// also nur die Stamm-Gemeinde und die Rolle dort. Eine Konfi, die in der
// Gemeinde der Challenge nur ueber user_organizations Konfi ist (Altbestand:
// Mischkonto, zuhause Team, in einer weiteren Gemeinde Konfi), sah den
// Beitrag im Feed ihres Jahrgangs, bekam aber keine Mitteilung -- gegen
// "Mitteilung = Sichtbarkeit" (CLAUDE.md). Jetzt laufen die Empfaenger ueber
// ladeMitgliederDerOrganisation (utils/orgMitglieder.js): Rolle in DIESER
// Gemeinde, gesperrt in dieser Gemeinde zaehlt nicht.
//
// Gegenprobe: Mit der alten Abfrage faellt "erlaubt: Konfi nur ueber
// user_organizations" (teamer2 fehlt in der Empfaengerliste).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const ORG1 = ORGS.testGemeinde.id;
// teamer2 ist zuhause Teamer:in in Gemeinde 2. Hier bekommt das Konto in
// Gemeinde 1 eine Konfi-Zeile samt Profil im Jahrgang 1 -- das Mischkonto
// aus dem Altbestand (docs/planung/mehrfach-konten.md, Frage 1).
const MISCH = USERS.teamer2;

describe('Feed-Push an Konfis ueber beide Quellen der Zugehoerigkeit', () => {
  let db;
  let empfaenger;
  let spy;
  let challengeId;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, created_by)
       VALUES ($1, 'Fotochallenge', 'x', 'Stempel', NOW() - interval '1 day', NOW() + interval '7 days', $2)
       RETURNING id`, [ORG1, USERS.orgAdmin1.id]);
    challengeId = c.id;
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [challengeId, JAHRGAENGE.jahrgang1.id]);
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, $3)`, [MISCH.id, JAHRGAENGE.jahrgang1.id, ORG1]);
    empfaenger = null;
    spy = vi.spyOn(PushService, 'sendToMultipleUsers').mockImplementation(async (_db, ids) => {
      empfaenger = ids.map(Number).sort((a, b) => a - b);
    });
  });

  afterEach(() => { spy.mockRestore(); });

  const senden = () => PushService.sendChallengeFeedToJahrgaenge(
    db, ORG1, challengeId, 'Fotochallenge', USERS.konfi2.id, 'Test Konfi 2', 'photo');

  it('erlaubt: Konfi nur ueber user_organizations bekommt den Push', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [MISCH.id, ORG1, ROLES.konfi.id]);

    await senden();

    // konfi1 (zuhause hier) und das Mischkonto; konfi2 hat eingereicht.
    expect(empfaenger).toEqual([USERS.konfi1.id, MISCH.id]);
  });

  it('verboten: dieselbe Person ist in der Gemeinde Teamer:in, nicht Konfi -> kein Push', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [MISCH.id, ORG1, ROLES.teamer.id]);

    await senden();

    expect(empfaenger).toEqual([USERS.konfi1.id]);
  });

  it('verboten: ohne Mitgliedschaft in der Gemeinde zaehlt ein liegengebliebenes Profil nicht', async () => {
    await senden();

    expect(empfaenger).toEqual([USERS.konfi1.id]);
  });

  it('verboten: in dieser Gemeinde gesperrt -> kein Push', async () => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id, is_active) VALUES ($1, $2, $3, false)',
      [MISCH.id, ORG1, ROLES.konfi.id]);

    await senden();

    expect(empfaenger).toEqual([USERS.konfi1.id]);
  });
});
