// /api/support -- Support-Mail ohne Versand (routes/supportMail.js;
// docs/planung/support-mail.md). Den Versand pruefen
// supportMailAntworten.test.js und tests/services/mailVersand.test.js.
//
// Geprueft: Rechte (nur Super-Admin; 403 fuer Gemeindeleitung, Leitung,
// Team und Konfis, 401 ohne Anmeldung) auf jeder neuen Route; Zustand der
// Postfaecher; Zaehler; Posteingang; eine Mail mit ihrem Faden; gelesen
// setzen; Zuordnen mit dem ganzen Faden; Verlauf; Empfaenger einer
// Gemeinde; Platzhalter; Textbausteine und Einstellungen. Konkrete Werte.
const request = require('supertest');
const nodemailer = require('nodemailer');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen, supportToken } = require('../helpers/kontoOhneGemeinde');
const { STANDARD_EINSTELLUNGEN } = require('../../utils/mailEinstellungen');

const MAIL_ENV = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim-moin',
  SMTP_HOST: 'smtp.example.test',
});

const NACHRICHT_FELDER = [
  'id', 'postfach', 'richtung', 'anfrage_id', 'organization_id', 'message_id', 'in_reply_to', 'referenzen',
  'von_adresse', 'von_name', 'an_adressen', 'betreff', 'text', 'anhaenge', 'gesendet_am', 'gelesen_am',
  'verfasst_von', 'verfasst_von_name', 'created_at',
].sort();

describe('/api/support -- Support-Mail', () => {
  let app;
  let db;
  const sendMail = vi.fn();

  beforeAll(() => {
    Object.assign(process.env, MAIL_ENV);
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
    db = getTestPool();
    app = getTestApp(db);
  });
  afterAll(async () => {
    for (const k of Object.keys(MAIL_ENV)) delete process.env[k];
    vi.restoreAllMocks();
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
    sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
  });

  const SUPER = () => generateToken('orgAdminSuper');
  const als = (token) => ({
    get: (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${token}`),
    post: (pfad, b) => request(app).post(pfad).set('Authorization', `Bearer ${token}`).send(b),
    put: (pfad, b) => request(app).put(pfad).set('Authorization', `Bearer ${token}`).send(b),
    delete: (pfad) => request(app).delete(pfad).set('Authorization', `Bearer ${token}`),
  });

  const anfrageAnlegen = async (f = {}) => {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, wunsch_lizenz, organization_id, updated_at)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, COALESCE($7, NOW())) RETURNING id`,
      [f.gemeinde || 'Kirchengemeinde Büsum', f.kontakt_name || 'Pastorin Probe', f.email || 'probe@buesum.example',
        f.status || 'neu', f.wunsch_lizenz || null, f.organization_id || null, f.updated_at || null]);
    return Number(id);
  };

  let lfd = 0;
  /** Eine gespeicherte Mail; gesendet_am steigt mit jedem Aufruf um eine Minute. */
  const mail = async (f = {}) => {
    lfd += 1;
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id, in_reply_to, referenzen,
                                     von_adresse, von_name, an_adressen, betreff, text, anhaenge, gesendet_am, gelesen_am)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15) RETURNING id`,
      [f.postfach || 'moin', f.richtung || 'ein', f.anfrage_id ?? null, f.organization_id ?? null,
        f.message_id || `<m${lfd}-${Math.random().toString(36).slice(2)}@x.example>`, f.in_reply_to || null, f.referenzen || [],
        f.von_adresse === undefined ? 'absender@gemeinde.example' : f.von_adresse, f.von_name || null,
        f.an_adressen || ['moin@konfi-quest.de'], f.betreff || `Betreff ${lfd}`, f.text || 'Hallo',
        JSON.stringify(f.anhaenge || []), f.gesendet_am || new Date(Date.UTC(2026, 9, 1, 8, lfd)), f.gelesen_am || null]);
    return Number(id);
  };
  const zeile = async (id) => (await db.query('SELECT * FROM mail_nachrichten WHERE id = $1', [id])).rows[0];

  // ==========================================================================
  // Rechte
  // ==========================================================================
  describe('Rechte: nur Super-Admin', () => {
    const ROUTEN = [
      ['get', '/api/support/mail/status'],
      ['get', '/api/support/mail/zaehler'],
      ['get', '/api/support/mail/eingang'],
      ['get', '/api/support/mail/nachrichten/1'],
      ['post', '/api/support/mail/gelesen', { ids: [1] }],
      ['post', '/api/support/mail/nachrichten/1/zuordnen', {}],
      ['post', '/api/support/mail/nachrichten/1/antworten', { text: 'x' }],
      ['get', '/api/support/anfragen/1/verlauf'],
      ['post', '/api/support/anfragen/1/antworten', { text: 'x' }],
      ['get', '/api/support/gemeinden/1/verlauf'],
      ['get', '/api/support/gemeinden/1/empfaenger'],
      ['post', '/api/support/gemeinden/1/antworten', { an: 'a@b.example', text: 'x' }],
      ['get', '/api/support/mail/platzhalter?organization_id=1'],
      ['get', '/api/support/mail/bausteine'],
      ['post', '/api/support/mail/bausteine', { titel: 'x', text: 'y' }],
      ['put', '/api/support/mail/bausteine/1', { titel: 'x', text: 'y' }],
      ['delete', '/api/support/mail/bausteine/1'],
      ['get', '/api/support/mail/einstellungen'],
      ['put', '/api/support/mail/einstellungen', { fusszeile: 'x' }],
    ];

    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verboten: %s bekommt auf jeder Route 403, nichts geht hinaus, nichts ändert sich', async (wer) => {
      const anfrageId = await anfrageAnlegen();
      const mailId = await mail({ anfrage_id: null });
      await db.query("INSERT INTO mail_bausteine (id, titel, text) VALUES (1, 'B', 'T')");
      const status = [];
      for (const [methode, pfad, b] of ROUTEN) {
        const echt = pfad.replace('/anfragen/1/', `/anfragen/${anfrageId}/`).replace('/nachrichten/1', `/nachrichten/${mailId}`);
        status.push([pfad, (await als(generateToken(wer))[methode](echt, b)).status]);
      }
      expect(status).toEqual(ROUTEN.map(([, pfad]) => [pfad, 403]));
      expect(sendMail).not.toHaveBeenCalled();
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten')).rows[0].n).toBe(1);
      expect((await db.query('SELECT titel FROM mail_bausteine')).rows).toEqual([{ titel: 'B' }]);
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_einstellungen')).rows[0].n).toBe(0);
      expect((await zeile(mailId)).gelesen_am).toBeNull();
    });

    it('verboten: ohne Anmeldung 401 auf jeder Route', async () => {
      const status = [];
      for (const [methode, pfad, b] of ROUTEN) {
        const r = methode === 'get' || methode === 'delete' ? request(app)[methode](pfad) : request(app)[methode](pfad).send(b);
        status.push([pfad, (await r).status]);
      }
      expect(status).toEqual(ROUTEN.map(([, pfad]) => [pfad, 401]));
    });

    it.each([
      ['Super-Admin mit Gemeinde', () => generateToken('orgAdminSuper')],
      ['Super-Admin-Rolle', () => generateToken('superAdmin')],
      ['Support-Konto ohne Gemeinde', () => supportToken()],
    ])('erlaubt: %s liest Zustand, Zähler, Posteingang, Bausteine und Einstellungen (200)', async (_wer, token) => {
      for (const pfad of ['/api/support/mail/status', '/api/support/mail/zaehler', '/api/support/mail/eingang',
        '/api/support/mail/bausteine', '/api/support/mail/einstellungen']) {
        expect([pfad, (await als(token()).get(pfad)).status]).toEqual([pfad, 200]);
      }
    });
  });

  // ==========================================================================
  // Zustand und Zaehler
  // ==========================================================================
  describe('GET /mail/status', () => {
    it('beide Postfächer in fester Reihenfolge mit Adresse, eingerichtet, Abruf und Fehler; auf_diesem_server', async () => {
      await db.query(
        `INSERT INTO mail_abholstand (postfach, uidvalidity, letzte_uid, abgeholt_am, fehler, fehler_am)
         VALUES ('moin', 1, 10, '2026-10-03T10:00:00Z', NULL, NULL),
                ('support', NULL, NULL, NULL, 'Anmeldung gescheitert (Benutzer oder Passwort falsch)', '2026-10-03T10:02:00Z')`);
      const res = await als(SUPER()).get('/api/support/mail/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        postfaecher: [
          {
            postfach: 'moin', adresse: 'moin@konfi-quest.de', eingerichtet: true,
            abgeholt_am: '2026-10-03T10:00:00.000Z', fehler: null, fehler_am: null, auf_diesem_server: true,
          },
          {
            postfach: 'support', adresse: 'support@konfi-quest.de', eingerichtet: false,
            abgeholt_am: null, fehler: 'Anmeldung gescheitert (Benutzer oder Passwort falsch)',
            fehler_am: '2026-10-03T10:02:00.000Z', auf_diesem_server: true,
          },
        ],
      });
    });

    it('RUN_BACKGROUND_JOBS=false: auf_diesem_server false, die übrigen Felder unverändert', async () => {
      process.env.RUN_BACKGROUND_JOBS = 'false';
      try {
        const res = await als(SUPER()).get('/api/support/mail/status');
        expect(res.body.postfaecher.map((p) => [p.postfach, p.eingerichtet, p.auf_diesem_server]))
          .toEqual([['moin', true, false], ['support', false, false]]);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
      }
    });
  });

  describe('GET /mail/zaehler', () => {
    it('ungelesene eingehende Mails: Anfragen, Gemeinden, Posteingang und je Kennung', async () => {
      const a = await anfrageAnlegen();
      const b = await anfrageAnlegen({ gemeinde: 'B' });
      await mail({ anfrage_id: a });
      await mail({ anfrage_id: a });
      await mail({ anfrage_id: b });
      await mail({ anfrage_id: a, gelesen_am: new Date() }); // gelesen
      await mail({ anfrage_id: a, richtung: 'aus' }); // eigene Antwort
      await mail({ organization_id: ORGS.andereGemeinde.id, postfach: 'support' });
      await mail({ organization_id: ORGS.andereGemeinde.id, postfach: 'support', gelesen_am: new Date() });
      await mail({});
      await mail({});
      await mail({ postfach: 'support' });
      const res = await als(SUPER()).get('/api/support/mail/zaehler');
      expect(res.body).toEqual({
        anfragen: 3, gemeinden: 1, eingang: 3,
        je_anfrage: { [a]: 2, [b]: 1 },
        je_gemeinde: { [ORGS.andereGemeinde.id]: 1 },
      });
    });

    it('ohne Mails: alles null', async () => {
      expect((await als(SUPER()).get('/api/support/mail/zaehler')).body)
        .toEqual({ anfragen: 0, gemeinden: 0, eingang: 0, je_anfrage: {}, je_gemeinde: {} });
    });
  });

  // ==========================================================================
  // Posteingang
  // ==========================================================================
  describe('GET /mail/eingang', () => {
    it('nur nicht zugeordnete EINGEHENDE Mails, neueste zuerst, genau die Felder des Vertrags', async () => {
      const a = await anfrageAnlegen();
      const alt = await mail({ betreff: 'Alt', von_name: 'Erika', text: 'Erste Zeile\n> Zitat, das nicht in den Auszug gehört\nZweite   Zeile' });
      await mail({ anfrage_id: a }); // zugeordnet
      await mail({ richtung: 'aus' }); // eigene Antwort aus dem Posteingang
      const neu = await mail({ postfach: 'support', betreff: 'Neu', anhaenge: [{ name: 'a.pdf', groesse: 10, typ: 'application/pdf' }] });
      const res = await als(SUPER()).get('/api/support/mail/eingang');
      expect(res.status).toBe(200);
      expect(res.body.map((m) => m.id)).toEqual([neu, alt]);
      expect(Object.keys(res.body[0]).sort()).toEqual(
        ['id', 'postfach', 'von_adresse', 'von_name', 'betreff', 'auszug', 'gesendet_am', 'gelesen_am', 'anhaenge'].sort());
      expect(res.body[1]).toMatchObject({
        postfach: 'moin', von_adresse: 'absender@gemeinde.example', von_name: 'Erika', betreff: 'Alt',
        auszug: 'Erste Zeile Zweite Zeile', gelesen_am: null, anhaenge: [],
      });
      expect(res.body[0].anhaenge).toEqual([{ name: 'a.pdf', groesse: 10, typ: 'application/pdf' }]);
    });

    it('?postfach filtert; ein anderer Wert 400', async () => {
      await mail({ postfach: 'moin', betreff: 'M' });
      await mail({ postfach: 'support', betreff: 'S' });
      expect((await als(SUPER()).get('/api/support/mail/eingang?postfach=support')).body.map((m) => m.betreff)).toEqual(['S']);
      expect((await als(SUPER()).get('/api/support/mail/eingang?postfach=team')).status).toBe(400);
    });

    it('der Auszug ist höchstens 200 Zeichen lang', async () => {
      await mail({ text: 'x'.repeat(500) });
      const [m] = (await als(SUPER()).get('/api/support/mail/eingang')).body;
      expect(m.auszug).toBe(`${'x'.repeat(199)}…`);
    });
  });

  // ==========================================================================
  // Eine Mail mit Faden
  // ==========================================================================
  /**
   * Ein Faden aus vier Mails: zwei Antworten auf eine nicht gespeicherte
   * erste Mail <wurzel>, eine Antwort auf die erste Antwort und unsere
   * Antwort darauf -- dazu eine Mail ausserhalb.
   */
  async function faden() {
    const m1 = await mail({ message_id: '<m1@x>', referenzen: ['<wurzel@x>'], in_reply_to: '<wurzel@x>' });
    const m2 = await mail({ message_id: '<m2@x>', referenzen: ['<wurzel@x>'], in_reply_to: '<wurzel@x>', postfach: 'support' });
    const m3 = await mail({ message_id: '<m3@x>', referenzen: ['<wurzel@x>', '<m1@x>'], in_reply_to: '<m1@x>' });
    const m4 = await mail({ message_id: '<kq-4@konfi-quest.de>', richtung: 'aus', in_reply_to: '<m3@x>', referenzen: ['<m3@x>'] });
    const fremd = await mail({ message_id: '<fremd@x>', referenzen: ['<anderer@x>'] });
    return { m1, m2, m3, m4, fremd };
  }

  describe('GET /mail/nachrichten/:id', () => {
    it('die Mail mit allen Feldern und dem ganzen Faden als verlauf, älteste zuerst', async () => {
      const { m1, m2, m3, m4 } = await faden();
      const res = await als(SUPER()).get(`/api/support/mail/nachrichten/${m4}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([...NACHRICHT_FELDER, 'verlauf'].sort());
      expect(res.body).toMatchObject({ id: m4, richtung: 'aus', message_id: '<kq-4@konfi-quest.de>', in_reply_to: '<m3@x>' });
      expect(res.body.verlauf.map((m) => m.id)).toEqual([m1, m2, m3, m4]);
      expect(Object.keys(res.body.verlauf[0]).sort()).toEqual(NACHRICHT_FELDER);
    });

    it('eine Mail ohne Bezug: der Verlauf ist nur sie selbst', async () => {
      const { fremd } = await faden();
      expect((await als(SUPER()).get(`/api/support/mail/nachrichten/${fremd}`)).body.verlauf.map((m) => m.id)).toEqual([fremd]);
    });

    it('404 ohne Mail, 400 bei ungültiger Kennung', async () => {
      expect((await als(SUPER()).get('/api/support/mail/nachrichten/999999')).status).toBe(404);
      expect((await als(SUPER()).get('/api/support/mail/nachrichten/abc')).status).toBe(400);
    });
  });

  describe('POST /mail/gelesen', () => {
    it('setzt gelesen_am nur bei eingehenden ohne Datum', async () => {
      const ungelesen = await mail({});
      const frueher = new Date('2026-09-01T10:00:00Z');
      const gelesen = await mail({ gelesen_am: frueher });
      const aus = await mail({ richtung: 'aus' });
      const res = await als(SUPER()).post('/api/support/mail/gelesen', { ids: [ungelesen, gelesen, aus, 999999] });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ gelesen: 1 });
      expect(Date.now() - (await zeile(ungelesen)).gelesen_am.getTime()).toBeLessThan(60 * 1000);
      expect((await zeile(gelesen)).gelesen_am).toEqual(frueher);
      expect((await zeile(aus)).gelesen_am).toBeNull();
    });

    it.each([[{}], [{ ids: [] }], [{ ids: ['x'] }], [{ ids: 5 }]])('400 bei %j', async (b) => {
      expect((await als(SUPER()).post('/api/support/mail/gelesen', b)).status).toBe(400);
    });
  });

  // ==========================================================================
  // Zuordnen
  // ==========================================================================
  describe('POST /mail/nachrichten/:id/zuordnen', () => {
    const zuordnung = async (ids) => (await db.query(
      'SELECT id, anfrage_id, organization_id FROM mail_nachrichten WHERE id = ANY($1::bigint[]) ORDER BY id', [ids])).rows
      .map((r) => [r.id, r.anfrage_id, r.organization_id]);

    it('nimmt den ganzen Faden mit -- zur Anfrage, zur Gemeinde, zurück in den Posteingang; die Mail daneben bleibt', async () => {
      const { m1, m2, m3, m4, fremd } = await faden();
      const a = await anfrageAnlegen({ updated_at: '2026-01-01T00:00:00Z' });

      let res = await als(SUPER()).post(`/api/support/mail/nachrichten/${m2}/zuordnen`, { anfrage_id: a });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ anzahl: 4, anfrage_id: a, organization_id: null, ids: [m1, m2, m3, m4] });
      expect(await zuordnung([m1, m2, m3, m4, fremd])).toEqual([
        [m1, a, null], [m2, a, null], [m3, a, null], [m4, a, null], [fremd, null, null]]);
      const { rows: [anf] } = await db.query('SELECT updated_at FROM gemeinde_anfragen WHERE id = $1', [a]);
      expect(Date.now() - anf.updated_at.getTime()).toBeLessThan(60 * 1000);

      res = await als(SUPER()).post(`/api/support/mail/nachrichten/${m1}/zuordnen`, { organization_id: ORGS.andereGemeinde.id });
      expect(res.body).toMatchObject({ anzahl: 4, anfrage_id: null, organization_id: ORGS.andereGemeinde.id });
      expect(await zuordnung([m1, m4])).toEqual([[m1, null, ORGS.andereGemeinde.id], [m4, null, ORGS.andereGemeinde.id]]);

      res = await als(SUPER()).post(`/api/support/mail/nachrichten/${m3}/zuordnen`, {});
      expect(res.body).toMatchObject({ anzahl: 4, anfrage_id: null, organization_id: null });
      expect(await zuordnung([m1, m2, m3, m4])).toEqual([[m1, null, null], [m2, null, null], [m3, null, null], [m4, null, null]]);
    });

    it('400 mit beidem; 404 ohne Anfrage, Gemeinde oder Mail -- dann ändert sich nichts', async () => {
      const { m1 } = await faden();
      const a = await anfrageAnlegen();
      const pfad = `/api/support/mail/nachrichten/${m1}/zuordnen`;
      expect((await als(SUPER()).post(pfad, { anfrage_id: a, organization_id: 1 })).status).toBe(400);
      expect((await als(SUPER()).post(pfad, { anfrage_id: 999999 })).body).toEqual({ error: 'Anfrage nicht gefunden' });
      expect((await als(SUPER()).post(pfad, { organization_id: 999999 })).body).toEqual({ error: 'Gemeinde nicht gefunden' });
      expect((await als(SUPER()).post('/api/support/mail/nachrichten/999999/zuordnen', { anfrage_id: a })).status).toBe(404);
      expect((await als(SUPER()).post(pfad, { anfrage_id: 'x' })).status).toBe(400);
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE anfrage_id IS NOT NULL OR organization_id IS NOT NULL')).rows[0].n).toBe(0);
    });
  });

  // ==========================================================================
  // Verlauf und Empfaenger
  // ==========================================================================
  describe('Verlauf', () => {
    it('GET /anfragen/:id/verlauf: nur die Mails der Anfrage, älteste zuerst; 404 ohne Anfrage', async () => {
      const a = await anfrageAnlegen();
      const b = await anfrageAnlegen({ gemeinde: 'B' });
      const spaet = await mail({ anfrage_id: a, gesendet_am: new Date('2026-10-02T10:00:00Z') });
      const frueh = await mail({ anfrage_id: a, richtung: 'aus', gesendet_am: new Date('2026-10-01T10:00:00Z') });
      await mail({ anfrage_id: b });
      await mail({});
      const res = await als(SUPER()).get(`/api/support/anfragen/${a}/verlauf`);
      expect(res.body.map((m) => m.id)).toEqual([frueh, spaet]);
      expect(Object.keys(res.body[0]).sort()).toEqual(NACHRICHT_FELDER);
      expect((await als(SUPER()).get('/api/support/anfragen/999999/verlauf')).status).toBe(404);
    });

    it('GET /gemeinden/:id/verlauf: nur die Mails der Gemeinde, älteste zuerst; 404 ohne Gemeinde', async () => {
      const zwei = await mail({ organization_id: 2, postfach: 'support', gesendet_am: new Date('2026-10-02T10:00:00Z') });
      const eins = await mail({ organization_id: 2, postfach: 'support', gesendet_am: new Date('2026-10-01T10:00:00Z') });
      await mail({ organization_id: 1, postfach: 'support' });
      expect((await als(SUPER()).get('/api/support/gemeinden/2/verlauf')).body.map((m) => m.id)).toEqual([eins, zwei]);
      expect((await als(SUPER()).get('/api/support/gemeinden/999999/verlauf')).status).toBe(404);
    });
  });

  describe('GET /gemeinden/:id/empfaenger', () => {
    it('Gemeindeleitungen und Leitung mit Adresse (beide Quellen, aktiv, ohne Super-Admins), dann Absender aus dem Verlauf; jede Adresse einmal', async () => {
      const setze = (id, email) => db.query('UPDATE users SET email = $2 WHERE id = $1', [id, email]);
      await setze(USERS.orgAdmin2.id, 'Leitung@Andere.example');
      await setze(USERS.admin2.id, 'hauptamt@andere.example');
      await setze(USERS.teamer2.id, 'team@andere.example'); // Teamer:in: nicht dabei
      // Leitung aus Gemeinde 1, in Gemeinde 2 weitere Gemeindeleitung
      await setze(USERS.admin1.id, 'zweitgemeinde@test.example');
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)', [USERS.admin1.id, ROLES.orgAdmin2.id]);
      // Super-Admin als Gast: nicht dabei
      await db.query("UPDATE users SET email = 'support@betrieb.example' WHERE id = $1", [SUPPORT.id]);
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)', [SUPPORT.id, ROLES.orgAdmin2.id]);
      // gesperrte Leitung: nicht dabei
      const { rows: [{ id: gesperrt }] } = await db.query(
        `INSERT INTO users (username, display_name, role_id, organization_id, is_active, email)
         VALUES ('gesperrt2', 'Gesperrt', $1, 2, false, 'gesperrt@andere.example') RETURNING id`, [ROLES.admin2.id]);
      expect(gesperrt).toBeGreaterThan(0);
      // Verlauf: ein Absender neu, einer schon als Leitung bekannt, eine ausgehende Mail
      await mail({ organization_id: 2, postfach: 'support', von_adresse: 'kuesterin@andere.example', von_name: 'Küsterin' });
      await mail({ organization_id: 2, postfach: 'support', von_adresse: 'leitung@andere.example' });
      await mail({ organization_id: 2, postfach: 'support', richtung: 'aus', von_adresse: 'support@konfi-quest.de' });

      const res = await als(SUPER()).get('/api/support/gemeinden/2/empfaenger');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { adresse: 'zweitgemeinde@test.example', name: 'Test Admin 1', herkunft: 'gemeindeleitung' },
        { adresse: 'leitung@andere.example', name: 'Test Org-Admin 2', herkunft: 'gemeindeleitung' },
        { adresse: 'hauptamt@andere.example', name: 'Test Admin 2', herkunft: 'leitung' },
        { adresse: 'kuesterin@andere.example', name: 'Küsterin', herkunft: 'verlauf' },
      ]);
      expect((await als(SUPER()).get('/api/support/gemeinden/999999/empfaenger')).status).toBe(404);
    });
  });

  // ==========================================================================
  // Platzhalter
  // ==========================================================================
  describe('GET /mail/platzhalter', () => {
    it('zu einer Anfrage ohne Gemeinde: Name, Gemeinde und Wunschlizenz aus der Anfrage, Rest leer', async () => {
      const a = await anfrageAnlegen({ kontakt_name: 'Erika Probe', gemeinde: 'Kirchengemeinde Büsum', wunsch_lizenz: 'standard' });
      const res = await als(SUPER()).get(`/api/support/mail/platzhalter?anfrage_id=${a}`);
      expect(res.body).toEqual({
        name: 'Erika Probe', gemeinde: 'Kirchengemeinde Büsum', lizenz: 'Standard (bis 50 Konfis, 99 € pro Jahr)',
        testphase_bis: '', benutzername: '', absender: 'Konfi Quest',
      });
    });

    it('zu einer Anfrage, aus der eine Gemeinde entstanden ist: Testphase und Benutzername der ersten Gemeindeleitung dazu', async () => {
      await db.query("UPDATE organizations SET trial_ends_at = '2026-11-05T10:00:00Z' WHERE id = 2");
      const a = await anfrageAnlegen({ kontakt_name: 'Erika', gemeinde: 'Andere', wunsch_lizenz: 'verbund', organization_id: 2, status: 'angelegt' });
      await db.query("INSERT INTO mail_einstellungen (schluessel, wert) VALUES ('absendername', 'Team Konfi Quest')");
      expect((await als(SUPER()).get(`/api/support/mail/platzhalter?anfrage_id=${a}`)).body).toEqual({
        name: 'Erika', gemeinde: 'Andere', lizenz: 'Verbund (bis 4 Gemeinden, 390 € pro Jahr)',
        testphase_bis: '05.11.2026', benutzername: 'orgadmin2', absender: 'Team Konfi Quest',
      });
    });

    it('zu einer Gemeinde: Name und Benutzername der ersten Gemeindeleitung (kein Super-Admin), Anzeigename, Lizenz aus ihrer Anfrage', async () => {
      await anfrageAnlegen({ wunsch_lizenz: 'klein', organization_id: 1, status: 'angelegt' });
      const res = await als(SUPER()).get('/api/support/mail/platzhalter?organization_id=1');
      expect(res.body).toEqual({
        name: 'Test Org-Admin 1', gemeinde: 'Test-Gemeinde St. Martin', lizenz: 'Klein (bis 15 Konfis, 49 € pro Jahr)',
        testphase_bis: '', benutzername: 'orgadmin1', absender: 'Konfi Quest',
      });
      // Gegenprobe: Ist die einzige Gemeindeleitung ohne Merkmal gesperrt,
      // bleibt nur der Super-Admin mit Gemeinde -- er zaehlt nicht.
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.orgAdmin1.id]);
      expect((await als(SUPER()).get('/api/support/mail/platzhalter?organization_id=1')).body)
        .toMatchObject({ name: '', benutzername: '' });
    });

    it('400 ohne oder mit beiden Angaben, 404 ohne Anfrage bzw. Gemeinde', async () => {
      expect((await als(SUPER()).get('/api/support/mail/platzhalter')).status).toBe(400);
      expect((await als(SUPER()).get('/api/support/mail/platzhalter?anfrage_id=1&organization_id=1')).status).toBe(400);
      expect((await als(SUPER()).get('/api/support/mail/platzhalter?anfrage_id=999999')).status).toBe(404);
      expect((await als(SUPER()).get('/api/support/mail/platzhalter?organization_id=999999')).status).toBe(404);
    });
  });

  // ==========================================================================
  // Textbausteine
  // ==========================================================================
  describe('Textbausteine', () => {
    const FELDER = ['id', 'titel', 'betreff', 'text', 'postfach', 'sortierung', 'updated_at', 'bearbeitet_von'].sort();

    it('anlegen, auflisten (nach Sortierung), ändern, löschen', async () => {
      let res = await als(SUPER()).post('/api/support/mail/bausteine', { titel: ' Absage ', text: 'Hallo {{name}}', postfach: 'moin' });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(FELDER);
      expect(res.body).toMatchObject({ titel: 'Absage', text: 'Hallo {{name}}', betreff: null, postfach: 'moin', sortierung: 10, bearbeitet_von: USERS.orgAdminSuper.id });
      const absage = res.body.id;
      res = await als(SUPER()).post('/api/support/mail/bausteine', { titel: 'Zuerst', text: 'T', betreff: 'Betreff', sortierung: 5, postfach: null });
      const zuerst = res.body.id;
      res = await als(SUPER()).post('/api/support/mail/bausteine', { titel: 'Danach', text: 'T' });
      expect(res.body.sortierung).toBe(20);
      expect((await als(SUPER()).get('/api/support/mail/bausteine')).body.map((b) => b.titel)).toEqual(['Zuerst', 'Absage', 'Danach']);

      // PUT: betreff/postfach/sortierung bleiben, wenn sie fehlen; null leert.
      res = await als(supportToken()).put(`/api/support/mail/bausteine/${zuerst}`, { titel: 'Zuerst neu', text: 'Neu' });
      expect(res.body).toMatchObject({ titel: 'Zuerst neu', text: 'Neu', betreff: 'Betreff', postfach: null, sortierung: 5, bearbeitet_von: SUPPORT.id });
      res = await als(SUPER()).put(`/api/support/mail/bausteine/${zuerst}`, { titel: 'Z', text: 'N', betreff: null, postfach: 'support', sortierung: 99 });
      expect(res.body).toMatchObject({ betreff: null, postfach: 'support', sortierung: 99 });

      expect((await als(SUPER()).delete(`/api/support/mail/bausteine/${absage}`)).body).toEqual({ message: 'Textbaustein gelöscht' });
      expect((await als(SUPER()).get('/api/support/mail/bausteine')).body.map((b) => b.titel)).toEqual(['Danach', 'Z']);
    });

    it('404 für unbekannte Bausteine; 400 ohne Titel oder Text, mit fremdem Postfach oder zu langem Text', async () => {
      expect((await als(SUPER()).put('/api/support/mail/bausteine/999999', { titel: 'x', text: 'y' })).status).toBe(404);
      expect((await als(SUPER()).delete('/api/support/mail/bausteine/999999')).status).toBe(404);
      for (const b of [{ text: 'y' }, { titel: 'x' }, { titel: ' ', text: 'y' }, { titel: 'x', text: 'y', postfach: 'team' },
        { titel: 'x', text: 'y'.repeat(20001) }, { titel: 'x', text: 'y', betreff: 'b'.repeat(301) }]) {
        expect([b, (await als(SUPER()).post('/api/support/mail/bausteine', b)).status]).toEqual([b, 400]);
      }
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_bausteine')).rows[0].n).toBe(0);
    });
  });

  // ==========================================================================
  // Einstellungen
  // ==========================================================================
  describe('Einstellungen', () => {
    it('ohne gespeicherte Werte gilt der neutrale Vorschlag (ohne Personennamen)', async () => {
      const res = await als(SUPER()).get('/api/support/mail/einstellungen');
      expect(res.body).toEqual({ ...STANDARD_EINSTELLUNGEN });
      expect(res.body.absendername).toBe('Konfi Quest');
    });

    it('PUT speichert einzeln und gibt beide zurück', async () => {
      let res = await als(SUPER()).put('/api/support/mail/einstellungen', { fusszeile: '  Konfi Quest\r\nkonfi-quest.de  ' });
      expect(res.body).toEqual({ fusszeile: 'Konfi Quest\nkonfi-quest.de', absendername: 'Konfi Quest' });
      res = await als(SUPER()).put('/api/support/mail/einstellungen', { absendername: ' Konfi Quest Support ' });
      expect(res.body).toEqual({ fusszeile: 'Konfi Quest\nkonfi-quest.de', absendername: 'Konfi Quest Support' });
      const { rows } = await db.query('SELECT schluessel, bearbeitet_von FROM mail_einstellungen ORDER BY schluessel');
      expect(rows).toEqual([
        { schluessel: 'absendername', bearbeitet_von: USERS.orgAdminSuper.id },
        { schluessel: 'fusszeile', bearbeitet_von: USERS.orgAdminSuper.id },
      ]);
    });

    it('eine leere Fußzeile ist erlaubt', async () => {
      expect((await als(SUPER()).put('/api/support/mail/einstellungen', { fusszeile: '' })).body.fusszeile).toBe('');
    });

    it.each([
      [{}],
      [{ absendername: '' }],
      [{ absendername: 'Zwei\nZeilen' }],
      [{ absendername: 'x'.repeat(101) }],
      [{ fusszeile: 'x'.repeat(2001) }],
      [{ fusszeile: 5 }],
    ])('400 bei %j, nichts gespeichert', async (b) => {
      expect((await als(SUPER()).put('/api/support/mail/einstellungen', b)).status).toBe(400);
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_einstellungen')).rows[0].n).toBe(0);
    });
  });
});
