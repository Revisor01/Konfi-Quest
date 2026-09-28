// EINE ABGELAUFENE EINLADUNG SPERRT KEINE NEUE (28.09.2026).
//
// Eine Einladung laeuft nach 14 Tagen still ab: expires_at liegt in der
// Vergangenheit, der Status bleibt 'offen'. Der Teilindex
// idx_org_einladungen_offen (Migration 159) kennt nur den Status. Bis zum
// 28.09.2026 lief deshalb jede neue Einladung derselben Person in dieselbe
// Gemeinde auf 23505 und bekam 409 "Für X steht bereits eine Einladung offen"
// -- obwohl die Leitung in ihrer Liste keine offene Einladung sah (GET
// /einladungen filtert abgelaufene heraus) und die Person keine Karte mehr
// hatte (GET /einladungen/meine ebenso). Ausweg gab es keinen: DELETE
// /einladungen/:id zieht nur zurueck, was man in der Liste sieht.
//
// Jetzt raeumt POST /einladungen die abgelaufene offene Einladung genau dieser
// Person in genau dieser Gemeinde weg, samt ihrem Postfach-Eintrag, und legt
// die neue an -- in einer Transaktion. Beantwortete Einladungen (Verlauf) und
// die anderer Personen bleiben.
//
// Gegen die echte DB; Push laeuft durch den echten PushService, nur Firebase
// und SMTP sind gemockt.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ART = 'gemeinde_einladung';

describe('Abgelaufene Einladung: dieselbe Person laesst sich neu einladen', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    vi.spyOn(emailService, 'sendGemeindeEinladungEmail').mockReset().mockResolvedValue({ success: true });
  });

  const einladenRoh = async (von, kennung, roleId) => {
    const res = await request(app).post('/api/einladungen')
      .set('Authorization', `Bearer ${generateToken(von)}`)
      .send({ kennung, role_id: roleId });
    await warteAufNachwehen(app);
    return res;
  };

  async function einladen(von, kennung, roleId) {
    const res = await einladenRoh(von, kennung, roleId);
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const ablaufenLassen = (id) => db.query(
    `UPDATE org_einladungen SET expires_at = NOW() - INTERVAL '1 day',
            created_at = NOW() - INTERVAL '15 days'
      WHERE id = $1`,
    [id]
  );

  const imPostfach = async (userId) => (await db.query(
    `SELECT data->>'einladung_id' AS einladung_id FROM notifications
      WHERE user_id = $1 AND type = $2 ORDER BY id`,
    [userId, ART]
  )).rows.map((r) => Number(r.einladung_id));

  const einladungen = async (userId) => (await db.query(
    `SELECT id, organization_id, status FROM org_einladungen
      WHERE user_id = $1 ORDER BY id`,
    [userId]
  )).rows;

  it('abgelaufen: die neue Einladung wird angelegt (201), die alte ist weg', async () => {
    const alt = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    await ablaufenLassen(alt);

    const res = await einladenRoh('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('offen');
    expect(res.body.id).not.toBe(alt);
    expect(await einladungen(USERS.teamer1.id)).toEqual([
      { id: res.body.id, organization_id: 2, status: 'offen' }
    ]);
  });

  it('abgelaufen: die Leitung sieht die neue Einladung in ihrer Liste, die Person ihre Karte', async () => {
    const alt = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    await ablaufenLassen(alt);
    const neu = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    const liste = await request(app).get('/api/einladungen')
      .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
    expect(liste.status).toBe(200);
    expect(liste.body.map((e) => e.id)).toEqual([neu]);

    const meine = await request(app).get('/api/einladungen/meine')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(meine.status).toBe(200);
    expect(meine.body.map((e) => e.id)).toEqual([neu]);
  });

  it('abgelaufen: der Postfach-Eintrag der alten Einladung geht, der neue steht', async () => {
    const alt = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    expect(await imPostfach(USERS.teamer1.id)).toEqual([alt]);
    await ablaufenLassen(alt);

    const neu = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    expect(await imPostfach(USERS.teamer1.id)).toEqual([neu]);
  });

  it('noch gueltig: weiter 409 schon_eingeladen, die offene Einladung bleibt unberuehrt', async () => {
    const offen = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    const res = await einladenRoh('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe('schon_eingeladen');
    expect(await einladungen(USERS.teamer1.id)).toEqual([
      { id: offen, organization_id: 2, status: 'offen' }
    ]);
    expect(await imPostfach(USERS.teamer1.id)).toEqual([offen]);
  });

  it('beantwortete Einladungen derselben Person bleiben als Verlauf stehen', async () => {
    const abgelehnt = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    const ablehnen = await request(app).post(`/api/einladungen/${abgelehnt}/ablehnen`)
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(ablehnen.status).toBe(200);
    const abgelaufen = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    await ablaufenLassen(abgelaufen);

    const neu = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    expect(await einladungen(USERS.teamer1.id)).toEqual([
      { id: abgelehnt, organization_id: 2, status: 'abgelehnt' },
      { id: neu, organization_id: 2, status: 'offen' }
    ]);
  });

  it('die abgelaufene Einladung einer anderen Person bleibt unberuehrt', async () => {
    const fremd = await einladen('orgAdmin2', USERS.admin1.username, ROLES.teamer2.id);
    await ablaufenLassen(fremd);
    const alt = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    await ablaufenLassen(alt);

    await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    expect(await einladungen(USERS.admin1.id)).toEqual([
      { id: fremd, organization_id: 2, status: 'offen' }
    ]);
    expect(await imPostfach(USERS.admin1.id)).toEqual([fremd]);
  });
});
