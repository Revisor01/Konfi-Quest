// ROLLENNAMEN: „Leitung" UND „Org-Leitung" (Simon, 28.09.2026).
//
// Die Rolle `admin` hiess in der Datenbank „Hauptamt" (display_name der
// Standardrollen jeder Gemeinde), `org_admin` „Organisations-Admin". Beides
// ist falsch: Auch Ehrenamtliche haben diese Rollen. Simon: `admin` heisst
// „Leitung", `org_admin` „Org-Leitung".
//
// „Alte Orga fassen wir nicht an": Bestehende Gemeinden behalten ihre
// roles.display_name, es gibt KEINE Migration. Deshalb duerfen alle Texte,
// die der Server selbst formuliert (Einladung per Push und E-Mail, Meldung
// „Einladung angenommen", Rollenangabe in den Chat-Kontaktlisten), nicht den
// display_name aus der Datenbank lesen, sondern das feste Wort nach dem
// technischen Rollennamen (utils/rollenNamen.js).
//
// Jede Pruefung stellt den alten Datenbank-Stand eigens her
// ('Hauptamt' / 'Organisations-Admin') -- sonst liefe der Test mit den
// Seed-Namen 'Admin' / 'Org-Admin' und erreichte den Fehlerfall nicht.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');
const PushService = require('../../services/pushService');
const { rollenAnzeigename, ROLLEN_NAMEN } = require('../../utils/rollenNamen');

/** Stellt den Stand der bestehenden Gemeinden in Produktion her. */
const alteNamen = (db) => db.query(
  `UPDATE roles SET display_name = CASE name
      WHEN 'admin' THEN 'Hauptamt'
      WHEN 'org_admin' THEN 'Organisations-Admin'
      ELSE display_name END`
);

describe('utils/rollenNamen', () => {
  it('admin heisst Leitung, org_admin Gemeindeleitung, teamer Teamer:in', () => {
    expect(rollenAnzeigename('admin', 'Hauptamt')).toBe('Leitung');
    expect(rollenAnzeigename('org_admin', 'Organisations-Admin')).toBe('Gemeindeleitung');
    expect(rollenAnzeigename('teamer', 'Teamer:in')).toBe('Teamer:in');
  });

  it('unbekannte Rolle: display_name, sonst der technische Name', () => {
    expect(rollenAnzeigename('konfi', 'Konfirmand:in')).toBe('Konfirmand:in');
    expect(rollenAnzeigename('sonder', null)).toBe('sonder');
  });

  it('kein „Hauptamt" unter den festen Namen', () => {
    expect(Object.values(ROLLEN_NAMEN)).not.toContain('Hauptamt');
  });
});

describe('Rollennamen in Server-Texten und Standardrollen', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await alteNamen(db);
    vi.spyOn(emailService, 'sendGemeindeEinladungEmail').mockReset().mockResolvedValue({ success: true });
    vi.spyOn(PushService, 'sendGemeindeEinladungToUser').mockReset().mockResolvedValue({ success: true });
    vi.spyOn(PushService, 'sendEinladungBeantwortetToLeitung').mockReset().mockResolvedValue([]);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ---- Standardrollen einer neuen Gemeinde ---------------------------------

  it('neue Gemeinde: admin heisst Leitung, org_admin Gemeindeleitung', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${generateToken('superAdmin')}`)
      .send({
        name: 'Rollen-Gemeinde',
        slug: 'rollen-gemeinde',
        display_name: 'Rollen-Gemeinde',
        admin_username: 'rollen_admin',
        admin_password: 'Sicher!Passwort1',
        admin_display_name: 'Rollen Admin'
      });
    expect(res.status).toBe(201);

    const { rows } = await db.query(
      'SELECT name, display_name FROM roles WHERE organization_id = $1 ORDER BY name',
      [res.body.id]
    );
    expect(rows).toEqual([
      { name: 'admin', display_name: 'Leitung' },
      { name: 'konfi', display_name: 'Konfirmand:in' },
      { name: 'org_admin', display_name: 'Gemeindeleitung' },
      { name: 'teamer', display_name: 'Teamer:in' }
    ]);
  });

  it('bestehende Gemeinden behalten ihren display_name (keine Migration)', async () => {
    const { rows } = await db.query(
      `SELECT display_name FROM roles WHERE id IN ($1, $2) ORDER BY id`,
      [ROLES.admin2.id, ROLES.orgAdmin2.id]
    );
    expect(rows.map((r) => r.display_name)).toEqual(['Hauptamt', 'Organisations-Admin']);
  });

  // ---- Einladen -------------------------------------------------------------

  const einladen = (rolleId) => request(app)
    .post('/api/einladungen')
    .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`)
    .send({ kennung: USERS.teamer1.username, role_id: rolleId });

  it('Einladung als Leitung: Push und E-Mail sagen „Leitung", nicht „Hauptamt"', async () => {
    await db.query(`UPDATE users SET email = 'ziel@example.org' WHERE id = $1`, [USERS.teamer1.id]);
    const res = await einladen(ROLES.admin2.id);
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);

    expect(PushService.sendGemeindeEinladungToUser).toHaveBeenCalledTimes(1);
    expect(PushService.sendGemeindeEinladungToUser.mock.calls[0][3]).toBe('Leitung');
    expect(emailService.sendGemeindeEinladungEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendGemeindeEinladungEmail.mock.calls[0][3]).toBe('Leitung');
  });

  it('Einladung als Gemeindeleitung: „Gemeindeleitung", nicht „Organisations-Admin"', async () => {
    const res = await einladen(ROLES.orgAdmin2.id);
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
    expect(PushService.sendGemeindeEinladungToUser.mock.calls[0][3]).toBe('Gemeindeleitung');
  });

  it('Einladung als Teamer:in bleibt „Teamer:in"', async () => {
    const res = await einladen(ROLES.teamer2.id);
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
    expect(PushService.sendGemeindeEinladungToUser.mock.calls[0][3]).toBe('Teamer:in');
  });

  it('Einladung angenommen: die Meldung an die einladende Person sagt „Leitung"', async () => {
    const { rows: [e] } = await db.query(
      `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at)
       VALUES (2, $1, $2, $3, NOW() + interval '14 days') RETURNING id`,
      [USERS.teamer1.id, ROLES.admin2.id, USERS.orgAdmin2.id]
    );
    const res = await request(app)
      .post(`/api/einladungen/${e.id}/annehmen`)
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    expect(PushService.sendEinladungBeantwortetToLeitung).toHaveBeenCalledTimes(1);
    expect(PushService.sendEinladungBeantwortetToLeitung.mock.calls[0][1].rolleName).toBe('Leitung');
  });

  // ---- Chat-Kontaktlisten ---------------------------------------------------

  it('Team-Kontakte: Rollenangabe „Leitung" und „Gemeindeleitung" statt „Admin"', async () => {
    const res = await request(app)
      .get('/api/chat/team-contacts')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(res.status).toBe(200);
    const rolle = (id) => res.body.find((e) => Number(e.id) === id).role_description;
    expect(rolle(USERS.admin1.id)).toBe('Leitung');
    expect(rolle(USERS.orgAdmin1.id)).toBe('Gemeindeleitung');
  });

  it('Team-Kontakte: eine eigene Funktionsbezeichnung geht weiter vor', async () => {
    await db.query(`UPDATE users SET role_title = 'Diakonin' WHERE id = $1`, [USERS.admin1.id]);
    const res = await request(app)
      .get('/api/chat/team-contacts')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(res.status).toBe(200);
    const eintrag = res.body.find((e) => Number(e.id) === USERS.admin1.id);
    expect(eintrag.role_description).toBe('Diakonin');
  });

  // ---- Chat-Verlauf ---------------------------------------------------------

  const nachrichtDerLeitung = () => db.query(
    `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
     VALUES ($1, $2, 'admin', 'text', 'Denkt an die Zettel')`,
    [CHAT_ROOMS.jahrgang.id, USERS.admin1.id]
  );

  it('Chat-Export: hinter dem Namen steht „(Leitung)", nicht „(Hauptamt)"', async () => {
    await nachrichtDerLeitung();
    const res = await request(app)
      .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/export`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`${USERS.admin1.display_name} (Leitung)`);
    expect(res.text).not.toContain('Hauptamt');
  });

  it('Nachrichten tragen zusaetzlich den technischen Rollennamen (additiv)', async () => {
    await nachrichtDerLeitung();
    const res = await request(app)
      .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`);
    expect(res.status).toBe(200);
    const liste = Array.isArray(res.body) ? res.body : res.body.messages;
    const n = liste.find((m) => m.content === 'Denkt an die Zettel');
    expect(n.sender_role_name).toBe('admin');
    // Das bisherige Feld bleibt, mit dem Wert aus der Datenbank.
    expect(n.sender_role_display_name).toBe('Hauptamt');
  });

  it('Konfi-Kontaktliste: die Gemeindeleitung heisst „Gemeindeleitung"', async () => {
    const res = await request(app)
      .get('/api/chat/available-users')
      .set('Authorization', `Bearer ${generateToken('konfi1')}`);
    expect(res.status).toBe(200);
    const eintrag = res.body.users.find((u) => u.id === USERS.orgAdmin1.id);
    expect(eintrag.role_description).toBe('Gemeindeleitung');
  });
});
