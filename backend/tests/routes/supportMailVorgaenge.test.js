// /api/support/mail -- die Mail-Routen der Vorgaenge (routes/supportMail.js;
// docs/planung/support-vorgaenge.md): Zaehler (vorgaenge, posteingang),
// Posteingang mit Archiv (archiv=1), Einsortieren in einen bestehenden oder
// neuen Vorgang, Archivieren, Wiederherstellen, Loeschen, Sammelaktionen --
// dazu die alte Route zuordnen, die ueber den Vorgang geht.
//
// Geprueft je Route: Rechte (nur Super-Admin; 403 fuer Gemeindeleitung ohne
// Merkmal, Leitung, Team, Konfis; 401 ohne Anmeldung -- und nichts aendert
// sich), konkrete Werte, Erlaubtes und Verbotenes. Im Postfach selbst wird
// nie etwas geloescht: Konfi Quest liest es nur (die Routen kennen keinen
// IMAP-Zugriff; der Test haelt das mit der Attrappe fest).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen } = require('../helpers/kontoOhneGemeinde');
const { imapAttrappe } = require('../helpers/imapAttrappe');
const mailAbholung = require('../../services/mailAbholung');
const { MAIL_ENV, vorgaengeDaten } = require('../helpers/vorgaengeDaten');

describe('/api/support/mail -- Vorgänge, Archiv, Löschen', () => {
  let app;
  let db;
  let d;
  let attrappe;

  beforeAll(() => {
    Object.assign(process.env, MAIL_ENV);
    vi.spyOn(mailAbholung, 'standardImapFabrik').mockImplementation((opt) => attrappe.fabrik(opt));
    db = getTestPool();
    app = getTestApp(db);
    d = vorgaengeDaten(db);
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
    attrappe = imapAttrappe();
  });

  const als = (token) => ({
    get: (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${token}`),
    post: (pfad, b) => request(app).post(pfad).set('Authorization', `Bearer ${token}`).send(b),
    delete: (pfad) => request(app).delete(pfad).set('Authorization', `Bearer ${token}`),
  });
  const super_ = () => als(generateToken('orgAdminSuper'));

  // ==========================================================================
  // Rechte
  // ==========================================================================
  describe('Rechte: nur Super-Admin', () => {
    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verboten: %s bekommt 403, nichts ändert sich', async (wer) => {
      const v = await d.vorgang();
      const m = await d.mail({});
      const routen = [
        ['post', `/api/support/mail/nachrichten/${m}/einsortieren`, { vorgang_id: v }],
        ['post', `/api/support/mail/nachrichten/${m}/archivieren`, {}],
        ['post', `/api/support/mail/nachrichten/${m}/wiederherstellen`, {}],
        ['delete', `/api/support/mail/nachrichten/${m}`],
        ['post', '/api/support/mail/sammel', { ids: [m], aktion: 'loeschen' }],
        ['get', '/api/support/mail/eingang?archiv=1'],
        ['get', '/api/support/mail/zaehler'],
      ];
      const als_ = als(generateToken(wer));
      for (const [methode, pfad, body] of routen) {
        expect([methode, pfad, (await als_[methode](pfad, body)).status]).toEqual([methode, pfad, 403]);
      }
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: null, archiviert_am: null });
      expect(await d.anzahl('support_vorgaenge')).toBe(1);
    });

    it('verboten: ohne Anmeldung 401', async () => {
      const m = await d.mail({});
      for (const [methode, pfad] of [
        ['post', `/api/support/mail/nachrichten/${m}/einsortieren`], ['post', `/api/support/mail/nachrichten/${m}/archivieren`],
        ['post', `/api/support/mail/nachrichten/${m}/wiederherstellen`], ['delete', `/api/support/mail/nachrichten/${m}`],
        ['post', '/api/support/mail/sammel'],
      ]) {
        expect([methode, pfad, (await request(app)[methode](pfad).send({})).status]).toEqual([methode, pfad, 401]);
      }
      expect(await d.anzahl('mail_nachrichten')).toBe(1);
    });
  });

  // ==========================================================================
  // Zaehler
  // ==========================================================================
  describe('GET /mail/zaehler', () => {
    it('vorgaenge: nicht archivierte mit Status „neu“ oder mit ungelesener Mail; posteingang: ungelesen, nicht einsortiert, nicht archiviert', async () => {
      const neu = await d.vorgang({ status: 'neu' }); // zählt (neu)
      const arbeitMitMail = await d.vorgang({ status: 'in_arbeit' }); // zählt (ungelesene Mail)
      await d.vorgang({ status: 'in_arbeit' }); // zählt nicht
      const gelesen = await d.vorgang({ status: 'wartet' }); // zählt nicht (Mail gelesen)
      await d.vorgang({ status: 'neu', archiviert_am: new Date() }); // archiviert: zählt nicht
      const archiviertMitMail = await d.vorgang({ status: 'in_arbeit', archiviert_am: new Date() }); // archiviert: zählt nicht
      await d.mail({ vorgang_id: neu });
      await d.mail({ vorgang_id: neu });
      await d.mail({ vorgang_id: arbeitMitMail });
      await d.mail({ vorgang_id: gelesen, gelesen_am: new Date() });
      await d.mail({ vorgang_id: gelesen, richtung: 'aus' }); // eigene Antwort zählt nie
      await d.mail({ vorgang_id: archiviertMitMail });
      // Posteingang: zwei ungelesen, eine gelesen, eine archivierte, eine ausgehende
      await d.mail({});
      await d.mail({ postfach: 'moin' });
      await d.mail({ gelesen_am: new Date() });
      await d.mail({ archiviert_am: new Date() });
      await d.mail({ richtung: 'aus' });
      const res = await super_().get('/api/support/mail/zaehler');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ vorgaenge: 2, posteingang: 2, eingang: 2 });
    });

    it('die alten Felder bleiben: nach Anfrage und Gemeinde der Mail; Mails in einem Vorgang ohne Gemeinde zählen weder als Eingang noch hier', async () => {
      const { anfrage, vorgang: ausAnfrage } = await d.anfrageMitVorgang();
      const gemeinde = await d.vorgang({ organization_id: 2 });
      const ohne = await d.vorgang();
      await d.mail({ vorgang_id: ausAnfrage, postfach: 'moin' });
      await d.mail({ vorgang_id: ausAnfrage, postfach: 'moin' });
      await d.mail({ vorgang_id: gemeinde });
      await d.mail({ vorgang_id: ohne });
      await d.mail({});
      const res = await super_().get('/api/support/mail/zaehler');
      expect(res.body).toEqual({
        anfragen: 2, gemeinden: 1, eingang: 1, je_anfrage: { [anfrage]: 2 }, je_gemeinde: { 2: 1 },
        vorgaenge: 3, posteingang: 1,
      });
    });

    it('Vorgänge interner Gemeinden zählen mit (die Liste zeigt sie)', async () => {
      await db.query('UPDATE organizations SET intern = true WHERE id = 2');
      await d.vorgang({ organization_id: 2, status: 'neu' });
      expect((await super_().get('/api/support/mail/zaehler')).body.vorgaenge).toBe(1);
    });
  });

  // ==========================================================================
  // Posteingang und Archiv
  // ==========================================================================
  describe('GET /mail/eingang', () => {
    it('ohne Parameter: nur nicht einsortierte, nicht archivierte; Mails eines Vorgangs ohne Gemeinde liegen nicht im Posteingang', async () => {
      const v = await d.vorgang();
      const offen = await d.mail({ betreff: 'Offen' });
      await d.mail({ vorgang_id: v, betreff: 'Im Vorgang' });
      await d.mail({ betreff: 'Archiviert', archiviert_am: new Date() });
      const res = await super_().get('/api/support/mail/eingang');
      expect(res.body.map((m) => [m.id, m.betreff, m.vorgang_id, m.archiviert_am])).toEqual([[offen, 'Offen', null, null]]);
    });

    it('archiv=1: nur die archivierten, mit archiviert_am; archiv=0 wie ohne', async () => {
      const offen = await d.mail({ betreff: 'Offen' });
      const alt = await d.mail({ betreff: 'Alt', archiviert_am: new Date('2026-09-01T10:00:00Z') });
      const res = await super_().get('/api/support/mail/eingang?archiv=1');
      expect(res.body.map((m) => [m.id, m.archiviert_am])).toEqual([[alt, '2026-09-01T10:00:00.000Z']]);
      expect((await super_().get('/api/support/mail/eingang?archiv=0')).body.map((m) => m.id)).toEqual([offen]);
      expect((await super_().get('/api/support/mail/eingang?archiv=ja')).status).toBe(400);
    });

    it('zuordnung=alle zeigt auch Mails in Vorgängen, mit vorgang_id; ohne Archivierte', async () => {
      const v = await d.vorgang({ organization_id: 2 });
      const drin = await d.mail({ vorgang_id: v });
      const offen = await d.mail({});
      await d.mail({ archiviert_am: new Date() });
      const res = await super_().get('/api/support/mail/eingang?zuordnung=alle');
      expect(res.body.map((m) => [m.id, m.vorgang_id, m.organization_id])).toEqual([[offen, null, null], [drin, v, 2]]);
    });
  });

  // ==========================================================================
  // Einsortieren
  // ==========================================================================
  describe('POST /mail/nachrichten/:id/einsortieren', () => {
    it('in einen bestehenden Vorgang: die Mail gehört dazu; Gemeinde und Anfrage der Mail folgen dem Vorgang; der Vorgang gilt als bewegt', async () => {
      const v = await d.vorgang({ organization_id: 2, updated_at: '2026-01-01T08:00:00Z' });
      const m = await d.mail({ betreff: 'Frage' });
      const res = await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, { vorgang_id: v });
      expect([res.status, res.body]).toEqual([200, { anzahl: 1, vorgang_id: v, ids: [m] }]);
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: v, organization_id: 2, anfrage_id: null, archiviert_am: null });
      expect(Date.now() - (await d.vorgangZeile(v)).updated_at.getTime()).toBeLessThan(60 * 1000);
      expect((await super_().get('/api/support/mail/eingang')).body).toEqual([]);
      expect((await super_().get(`/api/support/vorgaenge/${v}`)).body.verlauf.map((x) => x.id)).toEqual([m]);
    });

    it('in den Vorgang einer Anfrage: anfrage_id an der Mail, keine Gemeinde; die Anfrage zählt es als Bewegung', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      await db.query("UPDATE gemeinde_anfragen SET updated_at = NOW() - interval '300 days'");
      const m = await d.mail({ postfach: 'moin' });
      await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, { vorgang_id: vorgang });
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: vorgang, anfrage_id: anfrage, organization_id: null });
      expect(Date.now() - (await d.anfrageZeile(anfrage)).updated_at.getTime()).toBeLessThan(60 * 1000);
    });

    it('der ganze Faden im Posteingang geht mit; Mails, die schon in einem Vorgang liegen, bleiben dort; Archiviertes ist danach nicht mehr archiviert', async () => {
      const v = await d.vorgang();
      const anderer = await d.vorgang();
      const erste = await d.mail({ message_id: '<f1@x>', betreff: 'Frage' });
      const zweite = await d.mail({ message_id: '<f2@x>', in_reply_to: '<f1@x>', archiviert_am: new Date() });
      const dritte = await d.mail({ message_id: '<f3@x>', referenzen: ['<f1@x>', '<f2@x>'], richtung: 'aus' });
      const schonDrin = await d.mail({ message_id: '<f4@x>', in_reply_to: '<f3@x>', vorgang_id: anderer });
      const fremd = await d.mail({ message_id: '<g1@x>' });
      const res = await super_().post(`/api/support/mail/nachrichten/${zweite}/einsortieren`, { vorgang_id: v });
      expect(res.body).toEqual({ anzahl: 3, vorgang_id: v, ids: [erste, zweite, dritte] });
      for (const id of [erste, zweite, dritte]) expect(await d.mailZeile(id)).toMatchObject({ vorgang_id: v, archiviert_am: null });
      expect((await d.mailZeile(schonDrin)).vorgang_id).toBe(anderer);
      expect((await d.mailZeile(fremd)).vorgang_id).toBeNull();
    });

    it('eine Mail aus einem Vorgang wird allein in einen anderen verschoben', async () => {
      const a = await d.vorgang({ organization_id: 1 });
      const b = await d.vorgang({ organization_id: 2 });
      const m1 = await d.mail({ vorgang_id: a, message_id: '<v1@x>' });
      const m2 = await d.mail({ vorgang_id: a, message_id: '<v2@x>', in_reply_to: '<v1@x>' });
      const res = await super_().post(`/api/support/mail/nachrichten/${m1}/einsortieren`, { vorgang_id: b });
      expect(res.body).toEqual({ anzahl: 1, vorgang_id: b, ids: [m1] });
      expect(await d.mailZeile(m1)).toMatchObject({ vorgang_id: b, organization_id: 2 });
      expect(await d.mailZeile(m2)).toMatchObject({ vorgang_id: a, organization_id: 1 });
    });

    it('in einen neuen Vorgang: Art, Bereich, Dringlichkeit, Gemeinde; Betreff der Mail ohne Re:, wenn keiner angegeben; Quelle mail, erstellt_von das Konto, Status neu', async () => {
      const m = await d.mail({ betreff: 'AW: Re: Kalender zeigt falsche Woche' });
      const res = await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, {
        neu: { art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', organization_id: 2 },
      });
      expect(res.status).toBe(200);
      const v = res.body.vorgang_id;
      expect(res.body).toEqual({ anzahl: 1, vorgang_id: v, ids: [m] });
      expect(await d.vorgangZeile(v)).toMatchObject({
        art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', status: 'neu', betreff: 'Kalender zeigt falsche Woche',
        quelle: 'mail', organization_id: 2, anfrage_id: null, erstellt_von: USERS.orgAdminSuper.id, archiviert_am: null,
      });
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: v, organization_id: 2 });
    });

    it('neuer Vorgang mit eigenem Betreff; ohne Gemeinde bleibt die Mail ohne Gemeinde', async () => {
      const m = await d.mail({ betreff: 'Irgendwas' });
      const res = await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, { neu: { art: 'sonstiges', betreff: ' Mein\nBetreff ' } });
      expect(await d.vorgangZeile(res.body.vorgang_id)).toMatchObject({ betreff: 'Mein Betreff', organization_id: null, bereich: null, dringlichkeit: 'normal' });
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: res.body.vorgang_id, organization_id: null });
    });

    it('400: weder noch, beides; ungültige Werte -- nichts ändert sich', async () => {
      const v = await d.vorgang();
      const m = await d.mail({});
      const faelle = [
        {}, { vorgang_id: v, neu: { art: 'frage' } }, { vorgang_id: 'abc' }, { neu: {} }, { neu: { art: 'beschwerde' } },
        { neu: { art: 'frage', bereich: 'kaffee' } }, { neu: { art: 'frage', dringlichkeit: 'egal' } },
        { neu: { art: 'frage', organization_id: 'abc' } }, { neu: 'frage' },
      ];
      for (const body of faelle) {
        expect([body, (await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, body)).status]).toEqual([body, 400]);
      }
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: null });
      expect(await d.anzahl('support_vorgaenge')).toBe(1);
    });

    it('404: Mail, Vorgang oder Gemeinde gibt es nicht -- bei einer fehlenden Gemeinde entsteht kein Vorgang', async () => {
      const m = await d.mail({});
      expect((await super_().post('/api/support/mail/nachrichten/999999/einsortieren', { vorgang_id: 1 })).status).toBe(404);
      const keinVorgang = await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, { vorgang_id: 999999 });
      expect([keinVorgang.status, keinVorgang.body]).toEqual([404, { error: 'Vorgang nicht gefunden' }]);
      const keineGemeinde = await super_().post(`/api/support/mail/nachrichten/${m}/einsortieren`, { neu: { art: 'frage', organization_id: 999999 } });
      expect([keineGemeinde.status, keineGemeinde.body]).toEqual([404, { error: 'Gemeinde nicht gefunden' }]);
      expect(await d.anzahl('support_vorgaenge')).toBe(0);
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: null });
    });
  });

  // ==========================================================================
  // Archivieren, Wiederherstellen, Loeschen
  // ==========================================================================
  describe('Archivieren, Wiederherstellen, Löschen einer Mail im Posteingang', () => {
    it('archivieren: raus aus dem Eingang, im Archiv; wiederherstellen: zurück; zweimal ändert den Zeitpunkt nicht', async () => {
      const m = await d.mail({ betreff: 'Spam' });
      const res = await super_().post(`/api/support/mail/nachrichten/${m}/archivieren`, {});
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(m);
      expect(res.body.archiviert_am).not.toBeNull();
      expect((await super_().get('/api/support/mail/eingang')).body).toEqual([]);
      expect((await super_().get('/api/support/mail/eingang?archiv=1')).body.map((x) => x.id)).toEqual([m]);
      const erst = (await d.mailZeile(m)).archiviert_am;
      await super_().post(`/api/support/mail/nachrichten/${m}/archivieren`, {});
      expect((await d.mailZeile(m)).archiviert_am).toEqual(erst);

      const zurueck = await super_().post(`/api/support/mail/nachrichten/${m}/wiederherstellen`, {});
      expect(zurueck.body).toEqual({ id: m, archiviert_am: null });
      expect((await super_().get('/api/support/mail/eingang')).body.map((x) => x.id)).toEqual([m]);
    });

    it('verboten: Mails eines Vorgangs lassen sich weder archivieren noch löschen (409); 404 ohne Mail', async () => {
      const v = await d.vorgang();
      const m = await d.mail({ vorgang_id: v });
      for (const [methode, pfad] of [
        ['post', `/api/support/mail/nachrichten/${m}/archivieren`],
        ['post', `/api/support/mail/nachrichten/${m}/wiederherstellen`],
        ['delete', `/api/support/mail/nachrichten/${m}`],
      ]) {
        const res = await super_()[methode](pfad, {});
        expect([pfad, res.status]).toEqual([pfad, 409]);
        expect(res.body).toEqual({ error: 'Das geht nur für Mails im Posteingang. Mails eines Vorgangs gehen mit dem Vorgang.' });
      }
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: v, archiviert_am: null });
      expect((await super_().post('/api/support/mail/nachrichten/999999/archivieren', {})).status).toBe(404);
      expect((await super_().delete('/api/support/mail/nachrichten/999999')).status).toBe(404);
    });

    it('löschen: die Mail ist weg, andere bleiben; im Postfach wird nichts angefasst', async () => {
      const weg = await d.mail({ betreff: 'Weg' });
      const bleibt = await d.mail({ betreff: 'Bleibt' });
      const res = await super_().delete(`/api/support/mail/nachrichten/${weg}`);
      expect([res.status, res.body]).toEqual([200, { message: 'Mail gelöscht' }]);
      expect((await db.query('SELECT id FROM mail_nachrichten')).rows.map((r) => Number(r.id))).toEqual([bleibt]);
      expect(attrappe.aufrufe).toEqual([]);
      expect(attrappe.aenderungen).toEqual([]);
    });
  });

  describe('POST /mail/sammel', () => {
    it('archivieren, wiederherstellen und löschen für mehrere; Mails in Vorgängen und unbekannte Kennungen werden übergangen', async () => {
      const v = await d.vorgang();
      const a = await d.mail({});
      const b = await d.mail({});
      const imVorgang = await d.mail({ vorgang_id: v });
      const c = await d.mail({});

      const archiv = await super_().post('/api/support/mail/sammel', { ids: [b, a, a, imVorgang, 999999], aktion: 'archivieren' });
      expect([archiv.status, archiv.body]).toEqual([200, { aktion: 'archivieren', anzahl: 2, ids: [a, b] }]);
      expect((await super_().get('/api/support/mail/eingang')).body.map((x) => x.id)).toEqual([c]);
      expect((await super_().get('/api/support/mail/eingang?archiv=1')).body.map((x) => x.id).sort((x, y) => x - y)).toEqual([a, b]);
      expect((await d.mailZeile(imVorgang)).archiviert_am).toBeNull();

      const zurueck = await super_().post('/api/support/mail/sammel', { ids: [a], aktion: 'wiederherstellen' });
      expect(zurueck.body).toEqual({ aktion: 'wiederherstellen', anzahl: 1, ids: [a] });

      const weg = await super_().post('/api/support/mail/sammel', { ids: [a, b, imVorgang], aktion: 'loeschen' });
      expect(weg.body).toEqual({ aktion: 'loeschen', anzahl: 2, ids: [a, b] });
      expect((await db.query('SELECT id FROM mail_nachrichten ORDER BY id')).rows.map((r) => Number(r.id))).toEqual([imVorgang, c]);
    });

    it.each([
      [{ aktion: 'archivieren' }, 'ids'], [{ ids: [], aktion: 'archivieren' }, 'ids'], [{ ids: ['a'], aktion: 'archivieren' }, 'ids[0]'],
      [{ ids: [1] }, 'aktion'], [{ ids: [1], aktion: 'status' }, 'aktion'],
      [{ ids: Array.from({ length: 501 }, (_, i) => i + 1), aktion: 'loeschen' }, 'ids'],
    ])('400 bei %j', async (body, feld) => {
      const m = await d.mail({});
      const res = await super_().post('/api/support/mail/sammel', body);
      expect(res.status).toBe(400);
      expect(res.body.details.map((x) => x.field)).toContain(feld);
      expect(await d.anzahl('mail_nachrichten')).toBe(1);
      expect(m).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Alte Route zuordnen: ueber den Vorgang
  // ==========================================================================
  describe('POST /mail/nachrichten/:id/zuordnen (alte Route der Apps)', () => {
    it('zu einer Anfrage: in deren Vorgang; anfrage_id an der Mail bleibt gefüllt; der ganze Faden geht mit', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      const m1 = await d.mail({ message_id: '<z1@x>', postfach: 'moin' });
      const m2 = await d.mail({ message_id: '<z2@x>', in_reply_to: '<z1@x>', postfach: 'moin' });
      const res = await super_().post(`/api/support/mail/nachrichten/${m1}/zuordnen`, { anfrage_id: anfrage });
      expect(res.body).toEqual({ anzahl: 2, anfrage_id: anfrage, organization_id: null, ids: [m1, m2] });
      for (const id of [m1, m2]) expect(await d.mailZeile(id)).toMatchObject({ vorgang_id: vorgang, anfrage_id: anfrage, organization_id: null });
    });

    it('zu einer Gemeinde: in den jüngsten offenen Vorgang der Gemeinde, sonst ein neuer „Schriftwechsel“; organization_id bleibt gefüllt', async () => {
      const m1 = await d.mail({});
      const erst = await super_().post(`/api/support/mail/nachrichten/${m1}/zuordnen`, { organization_id: 2 });
      expect(erst.body).toMatchObject({ anzahl: 1, anfrage_id: null, organization_id: 2 });
      const neuer = (await d.mailZeile(m1)).vorgang_id;
      expect(await d.vorgangZeile(neuer)).toMatchObject({ art: 'sonstiges', betreff: 'Schriftwechsel', quelle: 'mail', organization_id: 2, status: 'neu' });
      expect(await d.mailZeile(m1)).toMatchObject({ organization_id: 2 });
      // die zweite Mail kommt in denselben (offenen) Vorgang
      const m2 = await d.mail({});
      await super_().post(`/api/support/mail/nachrichten/${m2}/zuordnen`, { organization_id: 2 });
      expect((await d.mailZeile(m2)).vorgang_id).toBe(neuer);
      expect(await d.anzahl('support_vorgaenge')).toBe(1);
      // ein erledigter Vorgang gilt nicht als offen: dann entsteht ein neuer
      await db.query("UPDATE support_vorgaenge SET status = 'erledigt', archiviert_am = NOW() WHERE id = $1", [neuer]);
      const m3 = await d.mail({});
      await super_().post(`/api/support/mail/nachrichten/${m3}/zuordnen`, { organization_id: 2 });
      expect((await d.mailZeile(m3)).vorgang_id).not.toBe(neuer);
      expect(await d.anzahl('support_vorgaenge')).toBe(2);
    });

    it('{} schickt den Faden zurück in den Posteingang: kein Vorgang, keine Anfrage, keine Gemeinde', async () => {
      const v = await d.vorgang({ organization_id: 2 });
      const m = await d.mail({ vorgang_id: v, archiviert_am: null });
      const res = await super_().post(`/api/support/mail/nachrichten/${m}/zuordnen`, {});
      expect(res.body).toEqual({ anzahl: 1, anfrage_id: null, organization_id: null, ids: [m] });
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: null, anfrage_id: null, organization_id: null });
      expect((await super_().get('/api/support/mail/eingang')).body.map((x) => x.id)).toEqual([m]);
    });

    it('404 und 400 wie bisher', async () => {
      const m = await d.mail({});
      expect((await super_().post('/api/support/mail/nachrichten/999999/zuordnen', {})).status).toBe(404);
      expect((await super_().post(`/api/support/mail/nachrichten/${m}/zuordnen`, { anfrage_id: 999999 })).status).toBe(404);
      expect((await super_().post(`/api/support/mail/nachrichten/${m}/zuordnen`, { organization_id: 999999 })).status).toBe(404);
      expect((await super_().post(`/api/support/mail/nachrichten/${m}/zuordnen`, { anfrage_id: 1, organization_id: 1 })).status).toBe(400);
      expect(await d.anzahl('support_vorgaenge')).toBe(0);
    });
  });
});
