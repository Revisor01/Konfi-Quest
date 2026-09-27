// EINLADUNG BEANTWORTET -- DIE EINLADENDE LEITUNG ERFAEHRT ES.
//
// Befund BF-21 (Bericht "Wer bekommt was", 27.09.2026): Nahm jemand eine
// Einladung in eine weitere Gemeinde an oder lehnte sie ab, bekam niemand
// eine Mitteilung; die offene Einladung verschwand nur aus GET /einladungen
// (die die App nicht einmal anzeigt).
//
// Simons Entscheidung zu F-13 (27.09.2026, "ja" wie empfohlen): "Ja, als
// Postfach-Eintrag." Empfaenger nach "Mitteilung = Sichtbarkeit" (CLAUDE.md):
// wer eingeladen hat, solange er dort Org-Admin ist -- sonst die Org-Admins
// der Gemeinde. Einladen und die Einladungen sehen darf nur der Org-Admin.
//
// Gegen die echte DB, Firebase gemockt wie in
// tests/services/pushEmpfaengerMultiOrg.test.js. Die Einladungen stehen
// direkt in org_einladungen -- geprueft wird die Antwort, nicht das Einladen.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const liveUpdate = require('../../utils/liveUpdate');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG2 = ORGS.andereGemeinde.id;
const ART = 'gemeinde_einladung_beantwortet';

/** Die Pushes der Art, als {token, title, body, data}. */
const pushes = () => sendFirebasePushNotification.mock.calls
  .filter(([, p]) => p.data && p.data.type === ART)
  .map(([token, p]) => ({ token, title: p.title, body: p.body, data: p.data }));
const tokens = () => pushes().map((p) => p.token).sort();

describe('Einladung beantwortet: Mitteilung an die einladende Leitung', () => {
  let app, db, liveSpy;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const [userId, token] of [
      [USERS.teamer1.id, 'token-teamer1'],
      [USERS.orgAdmin1.id, 'token-orgadmin1'],
      [USERS.teamer2.id, 'token-teamer2'],
      [USERS.admin2.id, 'token-admin2'],
      [USERS.orgAdmin2.id, 'token-orgadmin2'],
    ]) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [userId, token, `geraet-${token}`]
      );
    }
    sendFirebasePushNotification.mockClear();
    liveSpy = vi.spyOn(liveUpdate, 'sendToOrgAdmins');
    liveSpy.mockClear();
  });

  afterEach(() => { liveSpy.mockRestore(); });

  /** Offene Einladung von `von` an teamer1 in Gemeinde 2. */
  async function einladung({ von = USERS.orgAdmin2.id, rolle = ROLES.teamer2.id } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + interval '14 days') RETURNING id`,
      [ORG2, USERS.teamer1.id, rolle, von]
    );
    return e.id;
  }

  const antworten = (id, weg) => request(app)
    .post(`/api/einladungen/${id}/${weg}`)
    .set('Authorization', `Bearer ${generateToken('teamer1')}`);

  const postfach = async (userId) => (await db.query(
    `SELECT title, message, data, organization_id FROM notifications WHERE user_id = $1 AND type = $2`,
    [userId, ART]
  )).rows;

  /** Org-Admin in Gemeinde 2 ueber user_organizations (zweite Quelle). */
  const zusatzOrgAdmin = (userId) => db.query(
    'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
    [userId, ORG2, ROLES.orgAdmin2.id]
  );

  it('angenommen: die einladende Org-Admin bekommt Push und Postfach-Eintrag -- sonst niemand', async () => {
    const id = await einladung();

    const res = await antworten(id, 'annehmen');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Einladung angenommen');
    await warteAufNachwehen(app);

    expect(tokens()).toEqual(['token-orgadmin2']);
    const [push] = pushes();
    expect(push.title).toBe('Einladung angenommen');
    expect(push.body).toBe('Test Teamer 1 hat die Einladung angenommen und arbeitet jetzt als Teamer:in in Andere Gemeinde mit.');
    expect(push.data).toMatchObject({
      einladung_id: String(id), user_id: String(USERS.teamer1.id), status: 'angenommen', organization_id: String(ORG2)
    });

    const eintraege = await postfach(USERS.orgAdmin2.id);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].title).toBe('Einladung angenommen');
    expect(eintraege[0].organization_id).toBe(ORG2);
    // Weder die Admin ohne Einladungsrecht noch die Teamerin der Gemeinde
    // noch die eingeladene Person selbst.
    expect(await postfach(USERS.admin2.id)).toHaveLength(0);
    expect(await postfach(USERS.teamer2.id)).toHaveLength(0);
    expect(await postfach(USERS.teamer1.id)).toHaveLength(0);

    // Die Benutzerliste der Gemeinde laedt nach.
    expect(liveSpy).toHaveBeenCalledWith(ORG2, 'users', 'update', { userId: USERS.teamer1.id });
  });

  it('abgelehnt: dieselbe Person bekommt "Einladung abgelehnt"', async () => {
    const id = await einladung();

    const res = await antworten(id, 'ablehnen');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Einladung abgelehnt' });
    await warteAufNachwehen(app);

    expect(tokens()).toEqual(['token-orgadmin2']);
    expect(pushes()[0].title).toBe('Einladung abgelehnt');
    expect(pushes()[0].body).toBe('Test Teamer 1 hat die Einladung als Teamer:in in Andere Gemeinde abgelehnt.');
    expect(pushes()[0].data.status).toBe('abgelehnt');
    expect(await postfach(USERS.orgAdmin2.id)).toHaveLength(1);
    // Die Benutzerliste aendert sich nicht -- kein Signal an die Gemeinde.
    expect(liveSpy).not.toHaveBeenCalledWith(ORG2, 'users', 'update', expect.anything());
  });

  it('einladende Person ist dort nicht mehr Org-Admin: die Org-Admins der Gemeinde bekommen es, sie nicht', async () => {
    await zusatzOrgAdmin(USERS.orgAdmin1.id);
    const id = await einladung();
    // orgAdmin2 ist inzwischen nur noch Admin in Gemeinde 2.
    await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [ROLES.admin2.id, USERS.orgAdmin2.id]);

    expect((await antworten(id, 'annehmen')).status).toBe(200);
    await warteAufNachwehen(app);

    // orgAdmin1 ist ueber user_organizations Org-Admin in Gemeinde 2.
    expect(tokens()).toEqual(['token-orgadmin1']);
    expect(await postfach(USERS.orgAdmin2.id)).toHaveLength(0);
  });

  it('einladende Person geloescht: die Org-Admins der Gemeinde bekommen es', async () => {
    await zusatzOrgAdmin(USERS.orgAdmin1.id);
    const id = await einladung();
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.orgAdmin2.id]);

    expect((await antworten(id, 'ablehnen')).status).toBe(200);
    await warteAufNachwehen(app);

    expect(tokens()).toEqual(['token-orgadmin1']);
    expect(await postfach(USERS.orgAdmin2.id)).toHaveLength(0);
  });

  it('solange die einladende Person Org-Admin ist, bekommen die uebrigen Org-Admins nichts', async () => {
    await zusatzOrgAdmin(USERS.orgAdmin1.id);
    const id = await einladung();

    expect((await antworten(id, 'annehmen')).status).toBe(200);
    await warteAufNachwehen(app);

    expect(tokens()).toEqual(['token-orgadmin2']);
    expect(await postfach(USERS.orgAdmin1.id)).toHaveLength(0);
  });

  it('verboten: wer als Org-Admin annimmt, bekommt die Meldung ueber sich selbst nicht', async () => {
    // Die einladende Person gibt es nicht mehr (ON DELETE SET NULL);
    // die Meldung faellt an die Org-Admins -- und dazu gehoert nach der
    // Annahme auch die eingeladene Person selbst.
    const id = await einladung({ von: null, rolle: ROLES.orgAdmin2.id });

    expect((await antworten(id, 'annehmen')).status).toBe(200);
    await warteAufNachwehen(app);

    expect(tokens()).toEqual(['token-orgadmin2']);
    expect(await postfach(USERS.teamer1.id)).toHaveLength(0);
  });

  it('eine fremde Einladung anzunehmen scheitert -- und meldet nichts', async () => {
    const id = await einladung();

    const res = await request(app)
      .post(`/api/einladungen/${id}/annehmen`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`);
    expect(res.status).toBe(404);
    await warteAufNachwehen(app);

    expect(pushes()).toEqual([]);
    expect(await postfach(USERS.orgAdmin2.id)).toHaveLength(0);
  });
});
