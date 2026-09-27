// EINE ZURUECKGEZOGENE EINLADUNG VERSCHWINDET AUCH BEI DER EINGELADENEN PERSON.
//
// Simons Entscheidung (27.09.2026): Die Leitung sieht ihre offenen
// Einladungen unter "Mehr > Benutzer:innen" und kann sie dort zurueckziehen.
// Nachgeprueft, was die eingeladene Person danach noch sieht:
//
//   - GET /einladungen/meine   -- nichts mehr (status 'offen' im Filter).
//   - Push-Ziel                -- das eigene Profil; die Karte dort liest
//                                 GET /meine und bleibt leer.
//   - Postfach                 -- DER BEFUND: "Einladung in eine Gemeinde
//                                 ... Tippe, um zu antworten." blieb stehen,
//                                 zaehlte als ungelesen in der roten Zahl und
//                                 fuehrte beim Antippen ins leere Profil.
//
// Nach dem Muster von utils/postfachAufraeumen.js: Eine Mitteilung, die einen
// ZUSTAND meldet ("wartet auf deine Antwort"), geht mit ihrem Gegenstand.
// Die Antwortform von DELETE /einladungen/:id bleibt unveraendert.
//
// Gegen die echte DB; Push laeuft durch den echten PushService (Postfach wird
// in sendToUser geschrieben), nur Firebase und SMTP sind gemockt.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');
const { loescheMitteilungenZuEinladung } = require('../../utils/postfachAufraeumen');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ART = 'gemeinde_einladung';

describe('Einladung zurueckgezogen: die eingeladene Person sieht sie nicht mehr', () => {
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

  const zurueckziehen = (von, id) => request(app)
    .delete(`/api/einladungen/${id}`)
    .set('Authorization', `Bearer ${generateToken(von)}`);

  /** Die Einladungs-Eintraege im Postfach einer Person, als einladung_id. */
  const einladungenImPostfach = async (userId) => (await db.query(
    `SELECT data->>'einladung_id' AS einladung_id FROM notifications
      WHERE user_id = $1 AND type = $2 ORDER BY id`,
    [userId, ART]
  )).rows.map((r) => Number(r.einladung_id));

  const postfachAbruf = (name) => request(app)
    .get('/api/notifications/postfach')
    .set('Authorization', `Bearer ${generateToken(name)}`);

  // ---- der erlaubte Fall ----------------------------------------------------

  it('zurueckgezogen: Postfach-Eintrag, ungelesene Zahl und GET /meine sind leer', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    // Vorher: Die Einladung steht im Postfach und zaehlt als ungelesen.
    expect(await einladungenImPostfach(USERS.teamer1.id)).toEqual([id]);
    const vorher = await postfachAbruf('teamer1');
    expect(vorher.body.ungelesen).toBe(1);

    const res = await zurueckziehen('orgAdmin2', id);
    expect(res.status).toBe(200);
    // Antwortform unveraendert (Vertrag mit den ausgelieferten Apps).
    expect(res.body).toEqual({ message: 'Einladung zurückgezogen' });

    expect(await einladungenImPostfach(USERS.teamer1.id)).toEqual([]);
    const nachher = await postfachAbruf('teamer1');
    expect(nachher.status).toBe(200);
    expect(nachher.body.eintraege.map((e) => e.type)).not.toContain(ART);
    expect(nachher.body.ungelesen).toBe(0);

    const meine = await request(app).get('/api/einladungen/meine')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(meine.body).toEqual([]);

    const { rows: [zeile] } = await db.query('SELECT status FROM org_einladungen WHERE id = $1', [id]);
    expect(zeile.status).toBe('zurueckgezogen');
  });

  it('nur die zurueckgezogene Einladung geht -- andere Einladungen und Mitteilungen bleiben', async () => {
    const weg = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    const bleibtGleicheGemeinde = await einladen('orgAdmin2', USERS.admin1.username, ROLES.teamer2.id);
    const bleibtAndereGemeinde = await einladen('orgAdmin1', USERS.teamer2.username, ROLES.teamer.id);
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'Bonuspunkte', 'M', 'bonus_points', '{"points":"2"}'::jsonb, 1)`,
      [USERS.teamer1.id]
    );

    expect((await zurueckziehen('orgAdmin2', weg)).status).toBe(200);

    expect(await einladungenImPostfach(USERS.teamer1.id)).toEqual([]);
    expect(await einladungenImPostfach(USERS.admin1.id)).toEqual([bleibtGleicheGemeinde]);
    expect(await einladungenImPostfach(USERS.teamer2.id)).toEqual([bleibtAndereGemeinde]);
    const { rows } = await db.query(
      `SELECT type FROM notifications WHERE user_id = $1`, [USERS.teamer1.id]
    );
    expect(rows.map((r) => r.type)).toEqual(['bonus_points']);
  });

  // ---- die verbotenen Faelle -----------------------------------------------

  it('verboten: die Leitung einer FREMDEN Gemeinde zieht nicht zurueck -- Einladung und Eintrag bleiben', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    const res = await zurueckziehen('orgAdmin1', id);
    expect(res.status).toBe(404);

    expect(await einladungenImPostfach(USERS.teamer1.id)).toEqual([id]);
    const meine = await request(app).get('/api/einladungen/meine')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(meine.body.map((e) => e.id)).toEqual([id]);
  });

  it('verboten: eine Admin ohne Org-Admin-Rolle zieht nicht zurueck -- 403, Eintrag bleibt', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);

    const res = await zurueckziehen('admin2', id);
    expect(res.status).toBe(403);

    expect(await einladungenImPostfach(USERS.teamer1.id)).toEqual([id]);
  });

  it('eine schon beantwortete Einladung laesst sich nicht zurueckziehen -- das Postfach bleibt, wie es ist', async () => {
    const id = await einladen('orgAdmin2', USERS.teamer1.username, ROLES.teamer2.id);
    await request(app).post(`/api/einladungen/${id}/ablehnen`)
      .set('Authorization', `Bearer ${generateToken('teamer1')}`).expect(200);
    await warteAufNachwehen(app);

    const res = await zurueckziehen('orgAdmin2', id);
    expect(res.status).toBe(404);

    expect(await einladungenImPostfach(USERS.teamer1.id)).toEqual([id]);
    const { rows: [zeile] } = await db.query('SELECT status FROM org_einladungen WHERE id = $1', [id]);
    expect(zeile.status).toBe('abgelehnt');
  });

  // ---- die Aufraeum-Funktion selbst ----------------------------------------

  it('loescheMitteilungenZuEinladung: nur die Art "gemeinde_einladung" mit dieser Kennung; ohne Kennung nichts', async () => {
    const eintrag = (userId, type, data) => db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'T', 'M', $2, $3::jsonb, 2)`,
      [userId, type, JSON.stringify(data)]
    );
    await eintrag(USERS.teamer1.id, ART, { einladung_id: '41' });
    await eintrag(USERS.teamer1.id, ART, { einladung_id: '42' });
    // Die Antwort an die Leitung traegt dieselbe Kennung, meldet aber eine
    // Entscheidung -- sie ist Verlauf und bleibt.
    await eintrag(USERS.orgAdmin2.id, 'gemeinde_einladung_beantwortet', { einladung_id: '41' });

    expect(await loescheMitteilungenZuEinladung(db, null)).toBe(0);
    expect(await loescheMitteilungenZuEinladung(db, '')).toBe(0);
    expect(await loescheMitteilungenZuEinladung(db, 41)).toBe(1);

    const { rows } = await db.query(`SELECT type, data->>'einladung_id' AS e FROM notifications ORDER BY id`);
    expect(rows).toEqual([
      { type: ART, e: '42' },
      { type: 'gemeinde_einladung_beantwortet', e: '41' }
    ]);
  });
});
