// backend/tests/routes/challengeNeueBeitraegeLeitung.test.js
//
// Rote Kugel an der Challenge fuer Leitung und Team zaehlt JEDEN neuen
// Beitrag -- auch den wartenden (Simon, 29.09.2026: "bei jeden Beitrag. Wie
// im Chat bei jeder Nachricht. Und zusaetzlich Orangen bei Freigaben.").
//
// badge-counts.challengeNeueBeitraege (additiv) liefert die Zahl je Challenge:
// fremde Beitraege seit dem letzten Oeffnen, freigegeben UND wartend, nichts
// Ausgeblendetes, nichts aus der Zukunft, dazu 1 fuer die nie geoeffnete
// Challenge, bei der das Team mitmacht. Oeffnen setzt sie zurueck.
//
// Die alten Felder (pendingChallenges, challengeApprovals, challengeUpdates)
// und die Zahl am App-Symbol behalten ihre Bedeutung: Reiter und Symbol
// rechnen weiter "wartend + neu freigegeben", nichts doppelt. Die App 2.3.0
// addiert pendingChallenges + challengeUpdates.total fuer den Reiter.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { berechneAppIconSumme } = require('../../utils/appIconBadge');

const LEER = { total: 0, byChallenge: {}, wartendByChallenge: {} };

describe('badge-counts.challengeNeueBeitraege (Leitung und Team)', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterAll(async () => { await closePool(); });

  async function challenge({
    audience = 'konfis_und_team', moderated = true,
    org = ORGS.testGemeinde.id, jahrgang = JAHRGAENGE.jahrgang1.id, von = USERS.orgAdmin1.id
  } = {}) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Runde', 'd', $2, 'public', $3, '["text"]'::jsonb, 'A', $4,
               NOW() - interval '2 days', NOW() + interval '7 days', false)
       RETURNING *`,
      [org, audience, moderated, von]
    );
    if (audience !== 'nur_team') {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [c.id, jahrgang]);
    }
    return c;
  }

  async function beitrag(wer, challengeId) {
    const res = await request(app)
      .post(`/api/challenges/konfi/${challengeId}/submissions`)
      .set('Authorization', `Bearer ${generateToken(wer)}`)
      .send({ media_type: 'text', text_content: 'Hallo' });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
    return res.body;
  }

  // Direkt in die Tabelle: fuer Zustaende, die der Weg ueber die Route nicht
  // erzeugt (fremder Jahrgang ohne Konfi, Zeitstempel in der Zukunft).
  async function beitragDirekt(challengeId, userId, orgId, { status = 'pending', zeit = 'NOW()' } = {}) {
    const { rows: [b] } = await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content,
                                          moderation_status, created_at)
       VALUES ($1, $2, $3, 'text', 'Direkt', $4, ${zeit})
       RETURNING *`,
      [challengeId, userId, orgId, status]
    );
    return b;
  }

  const zaehler = async (wer) => {
    const res = await request(app).get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${generateToken(wer)}`);
    expect(res.status).toBe(200);
    return res.body;
  };
  const umschalter = async (wer) => (await request(app).get('/api/notifications/badge-counts/je-organisation')
    .set('Authorization', `Bearer ${generateToken(wer)}`)).body.jeOrganisation;
  const geoeffnet = async (wer, challengeId) => {
    const res = await request(app).post(`/api/challenges/konfi/${challengeId}/mark-read`)
      .set('Authorization', `Bearer ${generateToken(wer)}`);
    expect(res.status).toBe(200);
  };
  const moderiere = async (wer, beitragId, action) => {
    const res = await request(app).put(`/api/challenges/admin/submissions/${beitragId}/moderate`)
      .set('Authorization', `Bearer ${generateToken(wer)}`).send({ action });
    expect(res.status).toBe(200);
  };
  const symbolOrgAdmin1 = () => berechneAppIconSumme(db, {
    id: USERS.orgAdmin1.id, type: 'admin', role_name: 'org_admin',
    organization_id: ORGS.testGemeinde.id, assigned_jahrgaenge: []
  });

  it('zaehlt einen fremden wartenden Beitrag seit dem letzten Oeffnen', async () => {
    const c = await challenge();
    await geoeffnet('orgAdmin1', c.id);
    await beitrag('konfi1', c.id);

    const z = await zaehler('orgAdmin1');
    expect(z.challengeNeueBeitraege).toEqual({
      total: 1, byChallenge: { [c.id]: 1 }, wartendByChallenge: { [c.id]: 1 }
    });
    // Orange bleibt daneben: derselbe Beitrag wartet auf Freigabe.
    expect(z.pendingChallenges).toBe(1);
    expect(z.challengeApprovals).toEqual({ total: 1, byChallenge: { [c.id]: 1 } });
  });

  it('zaehlt ihn nach dem Oeffnen nicht mehr -- orange wartet er weiter', async () => {
    const c = await challenge();
    await geoeffnet('orgAdmin1', c.id);
    await beitrag('konfi1', c.id);
    await geoeffnet('orgAdmin1', c.id);

    const z = await zaehler('orgAdmin1');
    expect(z.challengeNeueBeitraege).toEqual(LEER);
    expect(z.pendingChallenges).toBe(1);
    expect(z.challengeApprovals).toEqual({ total: 1, byChallenge: { [c.id]: 1 } });

    // Was danach kommt, zaehlt wieder -- wie im Chat.
    await beitrag('konfi2', c.id);
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege).toEqual({
      total: 1, byChallenge: { [c.id]: 1 }, wartendByChallenge: { [c.id]: 1 }
    });
  });

  it('zaehlt freigegebene und wartende zusammen, wartendByChallenge nennt die wartenden', async () => {
    const c = await challenge();
    await geoeffnet('orgAdmin1', c.id);
    const b1 = await beitrag('konfi1', c.id);
    await beitrag('konfi2', c.id);
    // teamer1 gibt den ersten frei (nicht orgAdmin1 -- wer freigibt, oeffnet
    // dabei die Challenge).
    await moderiere('teamer1', b1.id, 'approve');

    const z = await zaehler('orgAdmin1');
    expect(z.challengeNeueBeitraege).toEqual({
      total: 2, byChallenge: { [c.id]: 2 }, wartendByChallenge: { [c.id]: 1 }
    });
    // Alte Felder wie bisher: 1 wartend, 1 neu freigegeben.
    expect(z.pendingChallenges).toBe(1);
    expect(z.challengeUpdates).toEqual({ total: 1, byChallenge: { [c.id]: 1 } });
  });

  it('zaehlt eigene Beitraege nicht', async () => {
    const c = await challenge();
    await geoeffnet('teamer1', c.id);
    await geoeffnet('orgAdmin1', c.id);
    await beitrag('teamer1', c.id);

    expect((await zaehler('teamer1')).challengeNeueBeitraege).toEqual(LEER);
    // Gegenprobe im selben Aufbau: fuer die Gemeindeleitung ist er fremd.
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege).toEqual({
      total: 1, byChallenge: { [c.id]: 1 }, wartendByChallenge: { [c.id]: 1 }
    });
  });

  it('zaehlt abgelehnte (ausgeblendete) Beitraege nicht', async () => {
    const c = await challenge();
    await geoeffnet('orgAdmin1', c.id);
    const b = await beitrag('konfi1', c.id);
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege.total).toBe(1);

    // teamer1 lehnt ab, bevor die Gemeindeleitung hineinsieht.
    await moderiere('teamer1', b.id, 'hide');
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege).toEqual(LEER);

    // Auch direkt als ausgeblendet angelegt: keine Zahl.
    await beitragDirekt(c.id, USERS.konfi2.id, ORGS.testGemeinde.id, { status: 'hidden' });
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege).toEqual(LEER);
  });

  it('zaehlt nichts mit Zeitstempel in der Zukunft', async () => {
    const c = await challenge();
    await beitragDirekt(c.id, USERS.konfi1.id, ORGS.testGemeinde.id, { zeit: "NOW() + interval '1 month'" });
    await beitragDirekt(c.id, USERS.konfi2.id, ORGS.testGemeinde.id, { status: 'approved', zeit: "NOW() + interval '1 month'" });
    await geoeffnet('orgAdmin1', c.id);

    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege).toEqual(LEER);
    // Gegenprobe: ein Beitrag von jetzt zaehlt.
    await beitragDirekt(c.id, USERS.konfi1.id, ORGS.testGemeinde.id);
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege.byChallenge).toEqual({ [c.id]: 1 });
  });

  it('zaehlt keine Challenge eines fremden Jahrgangs', async () => {
    const { rows: [jg] } = await db.query(
      `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
       VALUES ('Anderer Jahrgang', $1, '2027-05-01') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    const fremd = await challenge({ jahrgang: jg.id });
    await geoeffnet('orgAdmin1', fremd.id);
    await beitragDirekt(fremd.id, USERS.konfi1.id, ORGS.testGemeinde.id);

    // teamer1 (Jahrgang 1) sieht die Challenge nicht -- keine Zahl.
    expect((await zaehler('teamer1')).challengeNeueBeitraege).toEqual(LEER);
    // admin1 ohne Jahrgang ebenso.
    expect((await zaehler('admin1')).challengeNeueBeitraege).toEqual(LEER);
    // Die Gemeindeleitung sieht alles ihrer Gemeinde.
    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege.byChallenge).toEqual({ [fremd.id]: 1 });

    // Erlaubter Fall: eine Challenge des eigenen Jahrgangs zaehlt bei teamer1.
    const eigen = await challenge();
    await geoeffnet('teamer1', eigen.id);
    await beitragDirekt(eigen.id, USERS.konfi1.id, ORGS.testGemeinde.id);
    expect((await zaehler('teamer1')).challengeNeueBeitraege).toEqual({
      total: 1, byChallenge: { [eigen.id]: 1 }, wartendByChallenge: { [eigen.id]: 1 }
    });
  });

  it('zaehlt keine Challenge einer anderen Gemeinde', async () => {
    const anders = await challenge({ org: ORGS.andereGemeinde.id, jahrgang: JAHRGAENGE.jahrgang2.id, von: USERS.orgAdmin2.id });
    await geoeffnet('orgAdmin2', anders.id);
    await beitragDirekt(anders.id, USERS.konfi3.id, ORGS.andereGemeinde.id);

    expect((await zaehler('orgAdmin1')).challengeNeueBeitraege).toEqual(LEER);
    expect((await zaehler('teamer1')).challengeNeueBeitraege).toEqual(LEER);
    // Erlaubter Fall: die Gemeindeleitung dort zaehlt ihn.
    expect((await zaehler('orgAdmin2')).challengeNeueBeitraege).toEqual({
      total: 1, byChallenge: { [anders.id]: 1 }, wartendByChallenge: { [anders.id]: 1 }
    });
  });

  it('eine nie geoeffnete Challenge, bei der das Team mitmacht, zaehlt wie bisher als 1 dazu', async () => {
    const c = await challenge();
    await beitrag('konfi1', c.id);
    const z = await zaehler('teamer1');
    // 1 (nie geoeffnet) + 1 wartender Beitrag
    expect(z.challengeNeueBeitraege).toEqual({
      total: 2, byChallenge: { [c.id]: 2 }, wartendByChallenge: { [c.id]: 1 }
    });
    // Alt: nur die nie geoeffnete Challenge; der wartende steht in pendingChallenges.
    expect(z.challengeUpdates).toEqual({ total: 1, byChallenge: { [c.id]: 1 } });
    expect(z.pendingChallenges).toBe(1);
  });

  it('Konfis bekommen das Feld leer -- ihre Kugel liest weiter challengeUpdates', async () => {
    const c = await challenge({ moderated: false });
    await beitrag('konfi2', c.id);
    const z = await zaehler('konfi1');
    expect(z.challengeNeueBeitraege).toEqual(LEER);
    // 1 (nie geoeffnet) + 1 fremder Galerie-Beitrag
    expect(z.challengeUpdates).toEqual({ total: 2, byChallenge: { [c.id]: 2 } });
  });

  describe('alte Felder und App-Symbol behalten ihre Werte', () => {
    it('nur wartende neu: challengeUpdates bleibt leer (kein Eintrag mit 0), Symbol zaehlt den Beitrag einmal', async () => {
      const c = await challenge();
      await geoeffnet('orgAdmin1', c.id);
      await beitrag('konfi1', c.id);
      await beitrag('konfi2', c.id);

      const z = await zaehler('orgAdmin1');
      expect(z.challengeNeueBeitraege.byChallenge).toEqual({ [c.id]: 2 });
      expect(z.challengeUpdates).toEqual({ total: 0, byChallenge: {} });
      expect(z.pendingChallenges).toBe(2);
      expect(z.challengeApprovals).toEqual({ total: 2, byChallenge: { [c.id]: 2 } });
      // Reiter der App 2.3.0: pendingChallenges + challengeUpdates.total = 2.
      // App-Symbol und Gemeinde-Umschalter: dieselbe 2, nicht 4.
      expect(await symbolOrgAdmin1()).toBe(2);
      expect(await umschalter('orgAdmin1')).toEqual({ [ORGS.testGemeinde.id]: { offen: 2 } });
    });

    it('gemischt ueber zwei Challenges: jedes alte Feld mit genau dem bisherigen Wert', async () => {
      const ohneFreigabe = await challenge({ moderated: false });
      const mitFreigabe = await challenge();
      await geoeffnet('orgAdmin1', ohneFreigabe.id);
      await geoeffnet('orgAdmin1', mitFreigabe.id);
      await beitrag('konfi1', ohneFreigabe.id); // sofort freigegeben -> neu
      await beitrag('konfi1', mitFreigabe.id); // wartet
      const b = await beitrag('konfi2', mitFreigabe.id); // wartet, dann frei
      await moderiere('teamer1', b.id, 'approve');

      const z = await zaehler('orgAdmin1');
      expect(z.pendingChallenges).toBe(1);
      expect(z.challengeApprovals).toEqual({ total: 1, byChallenge: { [mitFreigabe.id]: 1 } });
      expect(z.challengeUpdates).toEqual({
        total: 2, byChallenge: { [ohneFreigabe.id]: 1, [mitFreigabe.id]: 1 }
      });
      expect(z.challengeNeueBeitraege).toEqual({
        total: 3,
        byChallenge: { [ohneFreigabe.id]: 1, [mitFreigabe.id]: 2 },
        wartendByChallenge: { [mitFreigabe.id]: 1 }
      });
      // Symbol = 1 wartend + 2 neu freigegeben, wie der Reiter.
      expect(await symbolOrgAdmin1()).toBe(3);
      expect(await umschalter('orgAdmin1')).toEqual({ [ORGS.testGemeinde.id]: { offen: 3 } });
    });
  });
});
