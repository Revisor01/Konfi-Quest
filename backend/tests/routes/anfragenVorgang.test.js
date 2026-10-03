// Die Anfrage und ihr Vorgang (Migration 195; docs/planung/support-vorgaenge.md):
//
//   - POST /api/anfragen legt den Vorgang der Anfrage in DERSELBEN Transaktion
//     an (Art neue_gemeinde, Quelle anfrage); die Antwortform der Route bleibt
//     { ok: true }. Scheitert der Vorgang, gibt es auch keine Anfrage.
//   - Die alten Routen unter /api/support/anfragen halten Anfrage und Vorgang
//     zusammen: PATCH (Status, Notiz) und POST .../anlegen. Angelegt und
//     abgelehnt heissen erledigt -- und damit Archiv --, neu und in Arbeit
//     bleiben offen; ein Vorgang "wartet" bleibt fuer die Anfrage "in Arbeit".
//   - Die alten Antworten der Routen aendern sich nicht (Felder nur hinzu).
const request = require('supertest');
const nodemailer = require('nodemailer');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { vorgaengeDaten } = require('../helpers/vorgaengeDaten');

const sendMail = vi.fn();

describe('Anfrage und Vorgang', () => {
  let app;
  let db;
  let d;

  beforeAll(() => {
    process.env.SMTP_HOST = 'mail.example.test';
    process.env.SMTP_USER = 'absender@example.test';
    process.env.SMTP_PASS = 'geheim';
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
    db = getTestPool();
    app = getTestApp(db);
    d = vorgaengeDaten(db);
  });
  afterAll(async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.restoreAllMocks();
    await closePool();
  });

  let ipZaehler = 0;
  const neueIp = () => `198.51.100.${(ipZaehler++ % 250) + 1}`;

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
  });

  const SUPER = () => generateToken('orgAdminSuper');
  const super_ = () => ({
    get: (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${SUPER()}`),
    patch: (pfad, b) => request(app).patch(pfad).set('Authorization', `Bearer ${SUPER()}`).send(b),
    post: (pfad, b) => request(app).post(pfad).set('Authorization', `Bearer ${SUPER()}`).send(b),
  });
  const FORMULAR = Object.freeze({
    gemeinde: 'Kirchengemeinde Büsum', kontakt_name: 'Pastorin Probe', email: 'probe@buesum.example', einwilligung: true,
    nachricht: 'Wir möchten im Januar starten.',
  });
  const senden = (felder = {}) => request(app).post('/api/anfragen').set('X-Real-IP', neueIp()).send({ ...FORMULAR, ...felder });
  const vorgaenge = async () => (await db.query('SELECT * FROM support_vorgaenge ORDER BY id')).rows;
  const anfragen = async () => (await db.query('SELECT * FROM gemeinde_anfragen ORDER BY id')).rows;

  describe('POST /api/anfragen', () => {
    it('legt mit der Anfrage ihren Vorgang an: Art neue_gemeinde, Quelle anfrage, Status neu, Text und Betreff; die Antwort bleibt { ok: true }', async () => {
      const res = await senden();
      await warteAufNachwehen(app);
      expect([res.status, res.body]).toEqual([201, { ok: true }]);
      const [a] = await anfragen();
      const [v] = await vorgaenge();
      expect(v).toMatchObject({
        art: 'neue_gemeinde', bereich: null, dringlichkeit: 'normal', status: 'neu', quelle: 'anfrage',
        betreff: 'Anfrage: Kirchengemeinde Büsum', beschreibung: 'Wir möchten im Januar starten.',
        anfrage_id: a.id, organization_id: null, erstellt_von: null, notiz: null, archiviert_am: null,
        kontakt_name: null, kontakt_email: null,
      });
      expect(v.created_at).toEqual(a.created_at);
      expect(Date.now() - v.status_seit.getTime()).toBeLessThan(60 * 1000);
    });

    it('ohne Nachricht: Beschreibung leer', async () => {
      await senden({ nachricht: undefined });
      await warteAufNachwehen(app);
      expect((await vorgaenge())[0].beschreibung).toBeNull();
    });

    it('der Vorgang erscheint in der Liste der Support-Ansicht (Filter offen, Art neue_gemeinde) und im Detail mit der Anfrage', async () => {
      await senden({ gemeinde: 'Kirchengemeinde Wesselburen' });
      await warteAufNachwehen(app);
      const liste = await super_().get('/api/support/vorgaenge?art=neue_gemeinde');
      expect(liste.body).toHaveLength(1);
      expect(liste.body[0]).toMatchObject({ art: 'neue_gemeinde', status: 'neu', gemeinde_name: 'Kirchengemeinde Wesselburen', quelle: 'anfrage' });
      const detail = await super_().get(`/api/support/vorgaenge/${liste.body[0].id}`);
      expect(detail.body.anfrage).toMatchObject({ gemeinde: 'Kirchengemeinde Wesselburen', kontakt_name: 'Pastorin Probe', status: 'neu' });
    });

    it('nichts davon bei einer abgewiesenen Eingabe (400) oder dem Honigtopf', async () => {
      expect((await senden({ einwilligung: false })).status).toBe(400);
      expect((await senden({ website: 'x' })).status).toBe(201);
      expect(await vorgaenge()).toEqual([]);
      expect(await anfragen()).toEqual([]);
    });

    it('in derselben Transaktion: scheitert der Vorgang, gibt es auch keine Anfrage (500, nichts bleibt zurück)', async () => {
      await db.query(`
        CREATE FUNCTION vorgang_verboten() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Vorgang verboten (Test)'; END; $$ LANGUAGE plpgsql`);
      await db.query('CREATE TRIGGER vorgang_verboten BEFORE INSERT ON support_vorgaenge FOR EACH ROW EXECUTE FUNCTION vorgang_verboten()');
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await senden();
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Die Anfrage konnte nicht gespeichert werden. Bitte versucht es später erneut.' });
        expect(await anfragen()).toEqual([]);
        expect(sendMail).not.toHaveBeenCalled();
      } finally {
        fehler.mockRestore();
        await db.query('DROP TRIGGER vorgang_verboten ON support_vorgaenge');
        await db.query('DROP FUNCTION vorgang_verboten()');
      }
      // Gegenprobe: ohne den Fehler geht es
      expect((await senden()).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await anfragen()).toHaveLength(1);
      expect(await vorgaenge()).toHaveLength(1);
    });
  });

  describe('PATCH /api/support/anfragen/:id -- der Vorgang folgt', () => {
    const anfrageMitVorgang = async (f = {}) => d.anfrageMitVorgang(f);
    const vorgangZeile = async (id) => (await db.query('SELECT status, archiviert_am, notiz, organization_id, status_seit FROM support_vorgaenge WHERE id = $1', [id])).rows[0];

    it('in Arbeit: der Vorgang ist in Arbeit, offen; die Antwort der Route ist die alte (Anfrage mit denselben Feldern)', async () => {
      const { anfrage, vorgang } = await anfrageMitVorgang();
      const res = await super_().patch(`/api/support/anfragen/${anfrage}`, { status: 'in_arbeit' });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([
        'id', 'gemeinde', 'kirchenkreis', 'landeskirche', 'kontakt_name', 'funktion', 'email', 'mobil', 'anzahl_konfis', 'anzahl_teamer',
        'nachricht', 'status', 'notiz', 'organization_id', 'created_at', 'updated_at', 'wunsch_lizenz', 'ungelesen',
      ].sort());
      expect(res.body.status).toBe('in_arbeit');
      expect(await vorgangZeile(vorgang)).toMatchObject({ status: 'in_arbeit', archiviert_am: null });
    });

    it('abgelehnt: der Vorgang ist erledigt und im Archiv; zurück auf neu: wieder offen und nicht mehr im Archiv', async () => {
      const { anfrage, vorgang } = await anfrageMitVorgang();
      await super_().patch(`/api/support/anfragen/${anfrage}`, { status: 'abgelehnt' });
      const z = await vorgangZeile(vorgang);
      expect(z.status).toBe('erledigt');
      expect(z.archiviert_am).not.toBeNull();
      expect((await super_().get('/api/support/vorgaenge?filter=archiv')).body.map((x) => x.id)).toEqual([vorgang]);
      expect((await super_().get('/api/support/vorgaenge?filter=offen')).body).toEqual([]);

      await super_().patch(`/api/support/anfragen/${anfrage}`, { status: 'neu' });
      expect(await vorgangZeile(vorgang)).toMatchObject({ status: 'neu', archiviert_am: null });
    });

    it('ein Vorgang „wartet“ bleibt „wartet“, solange die Anfrage „in Arbeit“ ist', async () => {
      const { anfrage, vorgang } = await anfrageMitVorgang({ status: 'in_arbeit' });
      await db.query("UPDATE support_vorgaenge SET status = 'wartet' WHERE id = $1", [vorgang]);
      await super_().patch(`/api/support/anfragen/${anfrage}`, { notiz: 'Nur eine Notiz' });
      expect((await vorgangZeile(vorgang)).status).toBe('wartet');
    });

    it('Notiz: die Notiz der Anfrage ist die des Vorgangs', async () => {
      const { anfrage, vorgang } = await anfrageMitVorgang();
      await super_().patch(`/api/support/anfragen/${anfrage}`, { notiz: 'Rückruf Montag' });
      expect((await vorgangZeile(vorgang)).notiz).toBe('Rückruf Montag');
      await super_().patch(`/api/support/anfragen/${anfrage}`, { notiz: '  ' });
      expect((await vorgangZeile(vorgang)).notiz).toBeNull();
    });

    it('eine Anfrage ohne Vorgang (älterer Stand): der Vorgang entsteht beim Bearbeiten, gleich im richtigen Stand', async () => {
      const { rows: [{ id }] } = await db.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, notiz) VALUES ('G', 'K', 'k@x.example', NOW(), 'alt') RETURNING id`);
      const res = await super_().patch(`/api/support/anfragen/${id}`, { status: 'abgelehnt' });
      expect(res.status).toBe(200);
      const [v] = await vorgaenge();
      expect(v).toMatchObject({ anfrage_id: Number(id), status: 'erledigt', quelle: 'anfrage', notiz: 'alt' });
      expect(v.archiviert_am).not.toBeNull();
    });

    it('verboten bleibt verboten: eine angelegte Anfrage behält ihren Status (409) -- und ihren Vorgang', async () => {
      const { anfrage, vorgang } = await anfrageMitVorgang({ status: 'angelegt', organization_id: 2 });
      const res = await super_().patch(`/api/support/anfragen/${anfrage}`, { status: 'neu' });
      expect(res.status).toBe(409);
      expect(await vorgangZeile(vorgang)).toMatchObject({ status: 'erledigt' });
    });
  });

  describe('POST /api/support/anfragen/:id/anlegen -- der Vorgang folgt', () => {
    const GEMEINDE = {
      name: 'Kirchengemeinde Büsum', contact_name: 'Pastorin Probe', contact_email: 'buero@buesum.example', max_konfis: 50,
      admin_username: 'leitung.buesum', admin_display_name: 'Pastorin Probe', admin_email: 'probe@buesum.example',
      admin_password: ['Sicher', '2026', 'Passwort!'].join('-'),
    };

    it('die Gemeinde entsteht, die Anfrage ist angelegt, der Vorgang erledigt (Archiv) und kennt die Gemeinde; die Mails bleiben bei der Anfrage', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      const m = await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      const res = await super_().post(`/api/support/anfragen/${anfrage}/anlegen`, GEMEINDE);
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['admin_id', 'organization_id']);
      const [v] = await vorgaenge();
      expect(v).toMatchObject({ id: vorgang, status: 'erledigt', organization_id: res.body.organization_id, anfrage_id: anfrage });
      expect(v.archiviert_am).not.toBeNull();
      expect((await db.query('SELECT status, organization_id FROM gemeinde_anfragen WHERE id = $1', [anfrage])).rows[0])
        .toMatchObject({ status: 'angelegt', organization_id: res.body.organization_id });
      expect((await db.query('SELECT anfrage_id, organization_id, vorgang_id FROM mail_nachrichten WHERE id = $1', [m])).rows[0])
        .toEqual({ anfrage_id: anfrage, organization_id: null, vorgang_id: vorgang });
      // Im Detail stehen jetzt Gemeinde und Gemeindeleitung
      const detail = await super_().get(`/api/support/vorgaenge/${vorgang}`);
      expect(detail.body.gemeinde).toMatchObject({ id: res.body.organization_id, display_name: 'Kirchengemeinde Büsum' });
      expect(detail.body.leitung.map((l) => l.username)).toEqual(['leitung.buesum']);
    });

    it('scheitert das Anlegen (Benutzername vergeben), bleibt alles, wie es war', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      const res = await super_().post(`/api/support/anfragen/${anfrage}/anlegen`, { ...GEMEINDE, admin_username: USERS.admin1.username });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await db.query('SELECT status FROM gemeinde_anfragen WHERE id = $1', [anfrage])).rows[0].status).toBe('neu');
      expect((await db.query('SELECT status, archiviert_am, organization_id FROM support_vorgaenge WHERE id = $1', [vorgang])).rows[0])
        .toEqual({ status: 'neu', archiviert_am: null, organization_id: null });
    });
  });

  describe('Gemeinde löschen', () => {
    it('die Anfrage, aus der die Gemeinde entstand, geht mit ihr -- und mit ihr der Vorgang samt Mails; die Vorgänge anderer bleiben', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ status: 'angelegt', organization_id: 2 });
      await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      const anderer = await d.vorgang({ organization_id: 1 });
      const res = await request(app).delete('/api/organizations/2').set('Authorization', `Bearer ${SUPER()}`);
      expect(res.status).toBe(200);
      expect((await anfragen()).map((a) => a.id)).not.toContain(anfrage);
      expect((await vorgaenge()).map((v) => Number(v.id))).toEqual([anderer]);
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
    });
  });
});
