// backend/tests/routes/konfiHistorieOhneTeamerAbzeichen.test.js
//
// Die Konfi-Historie zeigt die Konfi-Zeit — keine Teamer-Abzeichen.
//
// DER BEFUND (16.09.2026, Simon am Geraet, woertlich):
//   "ist da aber er zeigt bei meinem teamer die badges teamer year.
//    teamer badges niemals in der konfi history"
//
// WARUM ES PASSIEREN KONNTE: user_badges kennt die ART eines Abzeichens
// nicht — die Tabelle hat nur user_id und badge_id. Ob ein Abzeichen zur
// Konfi-Zeit oder zur Teamer-Zeit gehoert, steht allein in
// custom_badges.target_role. GET /teamer/profile hatte den JOIN auf
// custom_badges zwar schon, las die Spalte aber weder aus noch filterte es
// danach: Wer als Konfi angefangen hat und heute Teamer:in ist, sah seine
// "teamer_year"-Abzeichen mitten in der Konfi-Historie.
//
// Die Gegenprobe zum verbotenen Fall ist Pflicht und steht unten: Ohne den
// Filter (WHERE ... AND b.target_role = 'konfi') faellt der erste Test.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfi-Historie einer Teamer:in', () => {
  let app;
  let db;
  let teamerToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    teamerToken = generateToken('teamer1');

    // teamer1 bekommt eine Konfi-Vergangenheit: GET /teamer/profile liefert
    // konfi_data nur, wenn ein konfi_profiles-Eintrag da ist ("isPromotedKonfi"
    // in routes/teamer.js). Ohne ihn waere konfi_data null und JEDER Test hier
    // waere aus dem falschen Grund gruen -- keine Teamer-Abzeichen in einer
    // Historie, die es gar nicht gibt, beweist nichts. Der Seed legt
    // konfi_profiles nur fuer die Konfi-Konten an.
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id, created_at)
       VALUES ($1, $2, 0, 0, $3, NOW() - INTERVAL '3 years')`,
      [USERS.teamer1.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
    );
  });

  afterAll(async () => {
    await closePool();
  });

  const abzeichen = async (name, rolle, criteriaType) => {
    const { rows: [b] } = await db.query(
      `INSERT INTO custom_badges (name, description, criteria_type, criteria_value,
                                  icon, color, organization_id, target_role, is_active)
       VALUES ($1, 'Beschreibung', $2, 1, 'ribbon', '#be185d', $3, $4, true)
       RETURNING id`,
      [name, criteriaType, ORGS.testGemeinde.id, rolle]
    );
    return b.id;
  };

  const verleihen = (userId, badgeId) => db.query(
    `INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id)
     VALUES ($1, $2, CURRENT_DATE, $3)`,
    [userId, badgeId, ORGS.testGemeinde.id]
  );

  const historie = async () => {
    const res = await request(app)
      .get('/api/teamer/profile')
      .set('Authorization', `Bearer ${teamerToken}`);
    expect(res.status).toBe(200);
    return res.body.konfi_data;
  };

  // ---- VERBOTENER FALL -------------------------------------------------
  it('enthaelt KEIN Teamer-Abzeichen, auch nicht teamer_year', async () => {
    const teamerAbzeichen = await abzeichen('Ein Jahr im Team', 'teamer', 'teamer_year');
    await verleihen(USERS.teamer1.id, teamerAbzeichen);

    const konfiData = await historie();

    // Kein "irgendwie weniger" — GAR KEINS.
    expect(konfiData.badges).toEqual([]);
  });

  // ---- ERLAUBTER FALL --------------------------------------------------
  it('enthaelt die Konfi-Abzeichen weiterhin vollstaendig', async () => {
    const konfiAbzeichen = await abzeichen('Fleissige Konfi', 'konfi', 'total_points');
    await verleihen(USERS.teamer1.id, konfiAbzeichen);

    const konfiData = await historie();

    expect(konfiData.badges.length).toBe(1);
    expect(konfiData.badges[0].badge_id).toBe(konfiAbzeichen);
    expect(konfiData.badges[0].name).toBe('Fleissige Konfi');
    expect(konfiData.badges[0].criteria_type).toBe('total_points');
  });

  // ---- BEIDE ARTEN GLEICHZEITIG ---------------------------------------
  // Der eigentliche Fall vom Geraet: eine Person, die beides hat. Hier faellt
  // der Test, wenn der Filter fehlt — und nur hier zeigt sich, dass wirklich
  // GETRENNT und nicht etwa alles weggefiltert wird.
  it('trennt beide Arten: Konfi-Abzeichen bleibt, Teamer-Abzeichen faellt weg', async () => {
    const konfiAbzeichen = await abzeichen('Fleissige Konfi', 'konfi', 'total_points');
    const teamerAbzeichen = await abzeichen('Ein Jahr im Team', 'teamer', 'teamer_year');
    await verleihen(USERS.teamer1.id, konfiAbzeichen);
    await verleihen(USERS.teamer1.id, teamerAbzeichen);

    const konfiData = await historie();

    expect(konfiData.badges.length).toBe(1);
    expect(konfiData.badges.map(b => b.badge_id)).toEqual([konfiAbzeichen]);
    expect(konfiData.badges.map(b => b.criteria_type)).not.toContain('teamer_year');
  });

  // ---- FREMDE ORGANISATION --------------------------------------------
  // Im selben Zug ist der Organisationsfilter dazugekommen. Ohne ihn zaehlte
  // die Abfrage Konfi-Abzeichen aus JEDER Gemeinde, in der die Person je ein
  // Konto hatte.
  it('zaehlt keine Konfi-Abzeichen aus einer anderen Gemeinde', async () => {
    const { rows: [fremd] } = await db.query(
      `INSERT INTO custom_badges (name, description, criteria_type, criteria_value,
                                  icon, color, organization_id, target_role, is_active)
       VALUES ('Fremdes Konfi-Abzeichen', 'x', 'total_points', 1, 'ribbon', '#000000',
               $1, 'konfi', true)
       RETURNING id`,
      [ORGS.andereGemeinde.id]
    );
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id)
       VALUES ($1, $2, CURRENT_DATE, $3)`,
      [USERS.teamer1.id, fremd.id, ORGS.andereGemeinde.id]
    );

    const konfiData = await historie();

    expect(konfiData.badges).toEqual([]);
  });
});
