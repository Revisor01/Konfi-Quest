// EINE BEANTWORTETE ODER ABGELAUFENE EINLADUNG VERSCHWINDET AUS DEM POSTFACH
// DER EINGELADENEN PERSON (28.09.2026).
//
// "Einladung in eine Gemeinde ... Tippe, um zu antworten." meldet einen
// ZUSTAND: Die Einladung wartet auf eine Antwort. Mit dem Zurueckziehen ging
// der Eintrag schon (27.09.2026, einladungZurueckgezogen.test.js). Nach dem
// Annehmen, dem Ablehnen oder dem Ablauf blieb er stehen, zaehlte als
// ungelesen in der roten Zahl und fuehrte beim Antippen ins Profil ohne Karte
// (GET /einladungen/meine zeigt nur offene, nicht abgelaufene Einladungen).
//
// Die Antwort an die einladende Leitung ("Einladung angenommen/abgelehnt",
// gemeinde_einladung_beantwortet) haelt eine Entscheidung fest -- sie bleibt.
//
// Einen eigenen Ablauf-Job fuer Einladungen gibt es nicht. Der Ablauf wird
// deshalb im taeglichen Postfach-Aufraeumen (02:00-Cron,
// BackgroundService.startAutoDeletionCron) nachgezogen:
// loescheMitteilungenZuErledigtenEinladungen.
//
// Gegen die echte DB; Push laeuft durch den echten PushService (Postfach wird
// in sendToUser geschrieben), nur Firebase und SMTP sind gemockt.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');
const { loescheMitteilungenZuErledigtenEinladungen } = require('../../utils/postfachAufraeumen');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ART = 'gemeinde_einladung';
const ANTWORT = 'gemeinde_einladung_beantwortet';

describe('Einladung beantwortet oder abgelaufen: der Eintrag der eingeladenen Person geht', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    vi.spyOn(emailService, 'sendGemeindeEinladungEmail').mockReset().mockResolvedValue({ success: true });
  });

  /** Einladen ueber die Route -- mit Push und Postfach-Eintrag danach. */
  async function einladen(von, kennung, roleId) {
    const res = await request(app).post('/api/einladungen')
      .set('Authorization', `Bearer ${generateToken(von)}`)
      .send({ kennung, role_id: roleId });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
    return res.body.id;
  }

  const antworten = async (wer, id, wie) => {
    const res = await request(app).post(`/api/einladungen/${id}/${wie}`)
      .set('Authorization', `Bearer ${generateToken(wer)}`);
    await warteAufNachwehen(app);
    return res;
  };

  /** Die Eintraege einer Art im Postfach einer Person, als einladung_id. */
  const imPostfach = async (userId, art = ART) => (await db.query(
    `SELECT data->>'einladung_id' AS einladung_id FROM notifications
      WHERE user_id = $1 AND type = $2 ORDER BY id`,
    [userId, art]
  )).rows.map((r) => Number(r.einladung_id));

  const ungelesen = async (name) => (await request(app)
    .get('/api/notifications/postfach')
    .set('Authorization', `Bearer ${generateToken(name)}`)).body.ungelesen;

  // ---- annehmen und ablehnen -----------------------------------------------

  it('angenommen: der Eintrag der eingeladenen Person geht, die Zusage an die Leitung bleibt', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    expect(await imPostfach(USERS.teamer1.id)).toEqual([id]);
    expect(await ungelesen('teamer1')).toBe(1);

    const res = await antworten('teamer1', id, 'annehmen');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Einladung angenommen');

    expect(await imPostfach(USERS.teamer1.id)).toEqual([]);
    expect(await ungelesen('teamer1')).toBe(0);
    expect(await imPostfach(USERS.orgAdmin2.id, ANTWORT)).toEqual([id]);
  });

  it('abgelehnt: der Eintrag der eingeladenen Person geht, die Absage an die Leitung bleibt', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    const res = await antworten('teamer1', id, 'ablehnen');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Einladung abgelehnt' });

    expect(await imPostfach(USERS.teamer1.id)).toEqual([]);
    expect(await ungelesen('teamer1')).toBe(0);
    expect(await imPostfach(USERS.orgAdmin2.id, ANTWORT)).toEqual([id]);
    const { rows: [zeile] } = await db.query('SELECT status FROM org_einladungen WHERE id = $1', [id]);
    expect(zeile.status).toBe('abgelehnt');
  });

  it('nur die beantwortete Einladung geht -- eine zweite offene derselben Person bleibt', async () => {
    const beantwortet = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    // Eine zweite offene Einladung an dieselbe Person: direkt angelegt, weil
    // die Route nur eine offene je Gemeinde zulaesst.
    const { rows: [zweite] } = await db.query(
      `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at)
       VALUES (2, $1, $2, $3, NOW() + interval '14 days') RETURNING id`,
      [USERS.admin1.id, ROLES.teamer2.id, USERS.orgAdmin2.id]
    );
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'Einladung in eine Gemeinde', 'M', $2, $3::jsonb, 2)`,
      [USERS.admin1.id, ART, JSON.stringify({ einladung_id: String(zweite.id) })]
    );

    expect((await antworten('teamer1', beantwortet, 'ablehnen')).status).toBe(200);

    expect(await imPostfach(USERS.teamer1.id)).toEqual([]);
    expect(await imPostfach(USERS.admin1.id)).toEqual([zweite.id]);
  });

  it('verboten: wer nicht eingeladen ist, beantwortet nicht -- 404, der Eintrag bleibt', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    expect((await antworten('admin1', id, 'annehmen')).status).toBe(404);
    expect((await antworten('admin1', id, 'ablehnen')).status).toBe(404);

    expect(await imPostfach(USERS.teamer1.id)).toEqual([id]);
    expect(await ungelesen('teamer1')).toBe(1);
  });

  it('eine abgelaufene Einladung laesst sich nicht annehmen (410) -- der Eintrag bleibt bis zum Aufraeumen', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    await db.query(`UPDATE org_einladungen SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [id]);

    expect((await antworten('teamer1', id, 'annehmen')).status).toBe(410);
    expect(await imPostfach(USERS.teamer1.id)).toEqual([id]);

    expect(await loescheMitteilungenZuErledigtenEinladungen(db)).toBe(1);
    expect(await imPostfach(USERS.teamer1.id)).toEqual([]);
  });

  // ---- das taegliche Aufraeumen --------------------------------------------

  it('der 02:00-Lauf zieht den Ablauf nach (Verdrahtung im Cron)', async () => {
    const cron = require('node-cron');
    const BackgroundService = require('../../services/backgroundService');
    let nachtlauf = null;
    const planSpy = vi.spyOn(cron, 'schedule').mockImplementation((ausdruck, fn) => {
      if (ausdruck === '0 2 * * *') nachtlauf = fn;
      return { stop: vi.fn() };
    });
    try {
      BackgroundService.stopAutoDeletionCron();
      BackgroundService.startAutoDeletionCron(db);
      expect(typeof nachtlauf).toBe('function');

      const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
      await db.query(`UPDATE org_einladungen SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [id]);
      expect(await imPostfach(USERS.teamer1.id)).toEqual([id]);

      await nachtlauf();

      expect(await imPostfach(USERS.teamer1.id)).toEqual([]);
    } finally {
      BackgroundService.stopAutoDeletionCron();
      planSpy.mockRestore();
    }
  });

  it('loescheMitteilungenZuErledigtenEinladungen: abgelaufen, beantwortet, zurueckgezogen und verschwunden gehen; offen bleibt', async () => {
    const einladung = async (userId, status, tage) => (await db.query(
      `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at, status)
       VALUES (2, $1, $2, $3, NOW() + make_interval(days => $4), $5) RETURNING id`,
      [userId, ROLES.teamer2.id, USERS.orgAdmin2.id, tage, status]
    )).rows[0].id;
    // Der Teilindex erlaubt nur EINE offene Einladung je Person und Gemeinde
    // -- die gueltige offene geht deshalb an eine zweite Person.
    const zurueckgezogen = await einladung(USERS.teamer1.id, 'zurueckgezogen', 10);
    const angenommen = await einladung(USERS.teamer1.id, 'angenommen', 10);
    const abgelehnt = await einladung(USERS.teamer1.id, 'abgelehnt', 10);
    const abgelaufen = await einladung(USERS.teamer1.id, 'offen', -1);
    const offen = await einladung(USERS.admin1.id, 'offen', 10);

    const eintrag = (userId, type, data) => db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'T', 'M', $2, $3::jsonb, 2)`,
      [userId, type, JSON.stringify(data)]
    );
    for (const id of [zurueckgezogen, angenommen, abgelehnt, abgelaufen]) {
      await eintrag(USERS.teamer1.id, ART, { einladung_id: String(id) });
    }
    // Eine Einladung, die es nicht (mehr) gibt.
    await eintrag(USERS.teamer1.id, ART, { einladung_id: '999999' });
    // Bleiben: die gueltige offene Einladung, die Antwort an die Leitung,
    // ein Eintrag ohne Kennung (nicht geraten), eine andere Art.
    await eintrag(USERS.admin1.id, ART, { einladung_id: String(offen) });
    await eintrag(USERS.orgAdmin2.id, ANTWORT, { einladung_id: String(angenommen) });
    await eintrag(USERS.teamer1.id, ART, {});
    await eintrag(USERS.teamer1.id, 'bonus_points', { points: '2' });

    expect(await loescheMitteilungenZuErledigtenEinladungen(db)).toBe(5);
    // Ein zweiter Lauf findet nichts mehr.
    expect(await loescheMitteilungenZuErledigtenEinladungen(db)).toBe(0);

    const { rows } = await db.query(
      `SELECT user_id, type, data->>'einladung_id' AS e FROM notifications ORDER BY id`
    );
    expect(rows).toEqual([
      { user_id: USERS.admin1.id, type: ART, e: String(offen) },
      { user_id: USERS.orgAdmin2.id, type: ANTWORT, e: String(angenommen) },
      { user_id: USERS.teamer1.id, type: ART, e: null },
      { user_id: USERS.teamer1.id, type: 'bonus_points', e: null },
    ]);
  });
});
