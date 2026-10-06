// /api/support/vorgaenge -- Liste, Anlegen, Detail, Einordnen, Antworten,
// Archivieren, Wiederherstellen, Loeschen und Sammelaktionen (routes/
// supportVorgaenge.js; docs/planung/support-vorgaenge.md).
//
// Geprueft je Route: Rechte (nur Super-Admin: 200/201; Gemeindeleitung ohne
// Merkmal, Leitung, Team und Konfis 403; ohne Anmeldung 401 -- und nichts
// aendert sich), konkrete Werte, Erlaubtes und Verbotenes. Die Regeln aus
// utils/supportVorgaenge.js (Erledigt heisst Archiv, Anfrage und Vorgang halten
// den Status gemeinsam) stehen hier an den Routen. Kein Mailserver:
// nodemailer.createTransport ist ersetzt (Muster wie supportMailAntworten).
const request = require('supertest');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen, supportToken } = require('../helpers/kontoOhneGemeinde');
const { imapAttrappe } = require('../helpers/imapAttrappe');
const mailAbholung = require('../../services/mailAbholung');
const { MAIL_ENV, vorgaengeDaten } = require('../helpers/vorgaengeDaten');

const LISTE_FELDER = [
  'id', 'art', 'bereich', 'dringlichkeit', 'status', 'betreff', 'quelle', 'organization_id', 'gemeinde_name', 'anfrage_id',
  'ungelesen', 'letzte_aktivitaet', 'created_at', 'archiviert_am',
].sort();
const DETAIL_ZUSATZ = [
  'status_seit', 'updated_at', 'notiz', 'beschreibung', 'kontakt_name', 'kontakt_email', 'kontakt_funktion', 'gemeinde_angabe',
  'einwilligung_am', 'erstellt_von', 'erstellt_von_name', 'verlauf', 'anfrage', 'gemeinde', 'leitung', 'empfaenger',
];

describe('/api/support/vorgaenge', () => {
  let app;
  let db;
  let d;
  let attrappe;
  const sendMail = vi.fn();

  beforeAll(() => {
    Object.assign(process.env, MAIL_ENV);
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
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
    sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
    attrappe = imapAttrappe({ ordner: [{ path: 'Sent', name: 'Sent', delimiter: '.', flags: new Set(), specialUse: '\\Sent' }] });
  });

  const SUPER = () => generateToken('orgAdminSuper');
  const als = (token) => ({
    get: (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${token}`),
    post: (pfad, b) => request(app).post(pfad).set('Authorization', `Bearer ${token}`).send(b),
    patch: (pfad, b) => request(app).patch(pfad).set('Authorization', `Bearer ${token}`).send(b),
    delete: (pfad) => request(app).delete(pfad).set('Authorization', `Bearer ${token}`),
  });
  const super_ = () => als(SUPER());
  const leitungMitAdresse = (adresse = 'leitung@andere.example') =>
    db.query('UPDATE users SET email = $2 WHERE id = $1', [USERS.orgAdmin2.id, adresse]);
  const gesendet = async (n = 0) => {
    const [arg] = sendMail.mock.calls[n];
    const p = await simpleParser(arg.raw);
    return { umschlag: arg.envelope, betreff: p.subject, text: p.text, inReplyTo: p.inReplyTo || null, von: p.from.value[0].address };
  };

  // ==========================================================================
  // Rechte
  // ==========================================================================
  describe('Rechte: nur Super-Admin', () => {
    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verboten: %s bekommt auf jeder Route 403 und nichts ändert sich', async (wer) => {
      const v = await d.vorgang({ organization_id: 2 });
      const m = await d.mail({ vorgang_id: v });
      const routen = [
        ['get', '/api/support/vorgaenge'],
        ['post', '/api/support/vorgaenge', { art: 'frage', betreff: 'x' }],
        ['get', `/api/support/vorgaenge/${v}`],
        ['patch', `/api/support/vorgaenge/${v}`, { status: 'erledigt' }],
        ['post', `/api/support/vorgaenge/${v}/antworten`, { text: 'x', an: 'a@b.example' }],
        ['post', `/api/support/vorgaenge/${v}/archivieren`, {}],
        ['post', `/api/support/vorgaenge/${v}/wiederherstellen`, {}],
        ['delete', `/api/support/vorgaenge/${v}`],
        ['post', '/api/support/vorgaenge/sammel', { ids: [v], aktion: 'loeschen' }],
      ];
      const als_ = als(generateToken(wer));
      for (const [methode, pfad, body] of routen) {
        const res = await als_[methode](pfad, body);
        expect([methode, pfad, res.status]).toEqual([methode, pfad, 403]);
      }
      expect(await d.anzahl('support_vorgaenge')).toBe(1);
      expect(await d.anzahl('mail_nachrichten')).toBe(1);
      expect(await d.vorgangZeile(v)).toMatchObject({ status: 'neu', archiviert_am: null, art: 'frage' });
      expect(await d.mailZeile(m)).toMatchObject({ vorgang_id: v });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('verboten: ohne Anmeldung 401 auf jeder Route', async () => {
      const v = await d.vorgang();
      const routen = [
        ['get', '/api/support/vorgaenge'], ['post', '/api/support/vorgaenge'], ['get', `/api/support/vorgaenge/${v}`],
        ['patch', `/api/support/vorgaenge/${v}`], ['post', `/api/support/vorgaenge/${v}/antworten`],
        ['post', `/api/support/vorgaenge/${v}/archivieren`], ['post', `/api/support/vorgaenge/${v}/wiederherstellen`],
        ['delete', `/api/support/vorgaenge/${v}`], ['post', '/api/support/vorgaenge/sammel'],
      ];
      for (const [methode, pfad] of routen) {
        expect([methode, pfad, (await request(app)[methode](pfad).send({})).status]).toEqual([methode, pfad, 401]);
      }
      expect(await d.anzahl('support_vorgaenge')).toBe(1);
    });

    it('erlaubt: Super-Admin mit Gemeinde (Merkmal) und Support-Konto ohne Gemeinde bekommen 200', async () => {
      const v = await d.vorgang();
      for (const token of [SUPER(), supportToken()]) {
        expect((await als(token).get('/api/support/vorgaenge')).status).toBe(200);
        expect((await als(token).get(`/api/support/vorgaenge/${v}`)).status).toBe(200);
      }
    });
  });

  // ==========================================================================
  // Liste
  // ==========================================================================
  describe('GET /vorgaenge', () => {
    it('genau die Felder des Vertrags; Gemeindename aus Gemeinde, Anfrage oder Formularangabe; ungelesen; letzte Aktivität', async () => {
      const gemeinde = await d.vorgang({ organization_id: 2, betreff: 'Mit Gemeinde', created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z' });
      await d.mail({ vorgang_id: gemeinde, gesendet_am: new Date('2026-10-02T09:00:00Z') });
      await d.mail({ vorgang_id: gemeinde, gesendet_am: new Date('2026-10-02T10:00:00Z'), gelesen_am: new Date('2026-10-02T11:00:00Z') });
      await d.mail({ vorgang_id: gemeinde, richtung: 'aus', gesendet_am: new Date('2026-10-02T12:00:00Z') });
      const { vorgang: ausAnfrage, anfrage } = await d.anfrageMitVorgang({ gemeinde: 'Kirchengemeinde Büsum' });
      const formular = await d.vorgang({ quelle: 'formular', gemeinde_angabe: 'Kirche am Meer', betreff: 'Aus dem Formular' });

      const res = await super_().get('/api/support/vorgaenge?filter=alle');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body[0]).sort()).toEqual(LISTE_FELDER);
      const jeId = Object.fromEntries(res.body.map((x) => [x.id, x]));
      expect(jeId[gemeinde]).toMatchObject({
        art: 'frage', bereich: null, dringlichkeit: 'normal', status: 'neu', betreff: 'Mit Gemeinde', quelle: 'support',
        organization_id: 2, gemeinde_name: 'Andere Gemeinde', anfrage_id: null, ungelesen: 1, archiviert_am: null,
        created_at: '2026-10-01T08:00:00.000Z', letzte_aktivitaet: '2026-10-02T12:00:00.000Z',
      });
      expect(jeId[ausAnfrage]).toMatchObject({
        art: 'neue_gemeinde', quelle: 'anfrage', organization_id: null, gemeinde_name: 'Kirchengemeinde Büsum', anfrage_id: anfrage, ungelesen: 0,
      });
      expect(jeId[formular]).toMatchObject({ quelle: 'formular', gemeinde_name: 'Kirche am Meer', organization_id: null });
    });

    it('Vorgabe offen: neu, in Arbeit, wartet -- ohne erledigte und ohne archivierte; neueste Aktivität zuerst', async () => {
      const alt = await d.vorgang({ betreff: 'Alt', status: 'neu', updated_at: '2026-09-01T08:00:00Z', created_at: '2026-09-01T08:00:00Z' });
      const mitte = await d.vorgang({ betreff: 'Mitte', status: 'in_arbeit', updated_at: '2026-09-10T08:00:00Z', created_at: '2026-09-02T08:00:00Z' });
      const jung = await d.vorgang({ betreff: 'Jung', status: 'wartet', updated_at: '2026-09-05T08:00:00Z', created_at: '2026-09-05T08:00:00Z' });
      await d.vorgang({ betreff: 'Erledigt', status: 'erledigt' });
      await d.vorgang({ betreff: 'Archiviert', status: 'neu', archiviert_am: new Date() });
      // Eine späte Mail macht den alten Vorgang zum aktivsten.
      await d.mail({ vorgang_id: alt, gesendet_am: new Date('2026-09-20T08:00:00Z') });
      const res = await super_().get('/api/support/vorgaenge');
      expect(res.body.map((x) => [x.id, x.betreff])).toEqual([[alt, 'Alt'], [mitte, 'Mitte'], [jung, 'Jung']]);
      expect((await super_().get('/api/support/vorgaenge?filter=offen')).body.map((x) => x.id)).toEqual([alt, mitte, jung]);
    });

    it('filter neu / in_arbeit / wartet: je nicht archiviert; erledigt: Status erledigt; archiv: alle archivierten, auch die erledigten; alle: nicht archiviert', async () => {
      const neu = await d.vorgang({ status: 'neu' });
      const arbeit = await d.vorgang({ status: 'in_arbeit' });
      const wartet = await d.vorgang({ status: 'wartet' });
      const erledigt = await d.vorgang({ status: 'erledigt' });
      const archiviertNeu = await d.vorgang({ status: 'neu', archiviert_am: new Date() });
      const ids = async (filter) => (await super_().get(`/api/support/vorgaenge?filter=${filter}`)).body.map((x) => x.id).sort((a, b) => a - b);
      expect(await ids('neu')).toEqual([neu]);
      expect(await ids('in_arbeit')).toEqual([arbeit]);
      expect(await ids('wartet')).toEqual([wartet]);
      expect(await ids('erledigt')).toEqual([erledigt]);
      expect(await ids('archiv')).toEqual([erledigt, archiviertNeu]);
      expect(await ids('alle')).toEqual([neu, arbeit, wartet]);
    });

    it('art und gemeinde filtern; beides lässt sich mit dem Status verbinden', async () => {
      const a = await d.vorgang({ art: 'fehler', bereich: 'chat', organization_id: 2 });
      await d.vorgang({ art: 'fehler', organization_id: 1 });
      await d.vorgang({ art: 'wunsch', organization_id: 2 });
      await d.vorgang({ art: 'fehler', organization_id: 2, status: 'in_arbeit' });
      const res = await super_().get('/api/support/vorgaenge?art=fehler&gemeinde=2&filter=neu');
      expect(res.body.map((x) => [x.id, x.art, x.bereich, x.organization_id])).toEqual([[a, 'fehler', 'chat', 2]]);
    });

    it('suche: Nummer, Betreff, Beschreibung, Gemeinde, Kontakt, Absender und Betreff der Mails; Platzhalter des Nutzers sind Text', async () => {
      const betreff = await d.vorgang({ betreff: 'Kalender zeigt falsche Woche' });
      const nummer = await d.vorgang({ betreff: 'Etwas ganz anderes' });
      const beschreibung = await d.vorgang({ betreff: 'B', beschreibung: 'Der Export stürzt ab' });
      const gemeinde = await d.vorgang({ betreff: 'G', organization_id: 2 });
      const kontakt = await d.vorgang({ betreff: 'K', kontakt_name: 'Pastorin Erika', kontakt_email: 'erika@kirche.example' });
      const mailVorgang = await d.vorgang({ betreff: 'M' });
      await d.mail({ vorgang_id: mailVorgang, betreff: 'Passwort vergessen', von_adresse: 'kuesterin@dorf.example' });
      const prozent = await d.vorgang({ betreff: '100% sicher' });
      await d.vorgang({ betreff: '100 Prozent' });
      const suche = async (text) => (await super_().get('/api/support/vorgaenge').query({ suche: text, filter: 'alle' })).body.map((x) => x.id).sort((a, b) => a - b);

      expect(await suche('kalender')).toEqual([betreff]);
      expect(await suche('KALENDER ZEIGT')).toEqual([betreff]);
      expect(await suche(`#${nummer}`)).toEqual([nummer]);
      expect(await suche(String(nummer))).toEqual([nummer]);
      expect(await suche('stürzt')).toEqual([beschreibung]);
      expect(await suche('Andere Gemeinde')).toEqual([gemeinde]);
      expect(await suche('erika')).toEqual([kontakt]);
      expect(await suche('kirche.example')).toEqual([kontakt]);
      expect(await suche('Passwort vergessen')).toEqual([mailVorgang]);
      expect(await suche('kuesterin@')).toEqual([mailVorgang]);
      expect(await suche('100%')).toEqual([prozent]); // % ist kein Platzhalter
      expect(await suche('_')).toEqual([]); // _ ist kein Platzhalter
      expect(await suche('gibt es nicht')).toEqual([]);
    });

    it('Vorgänge interner Gemeinden stehen in der Liste wie jeder andere (der Support bearbeitet sie)', async () => {
      await db.query("UPDATE organizations SET intern = true WHERE id = 2");
      const v = await d.vorgang({ organization_id: 2 });
      const res = await super_().get('/api/support/vorgaenge');
      expect(res.body.map((x) => [x.id, x.gemeinde_name])).toEqual([[v, 'Andere Gemeinde']]);
    });

    it.each([
      ['filter=alles', 'filter'], ['art=beschwerde', 'art'], ['gemeinde=abc', 'gemeinde'], ['gemeinde=0', 'gemeinde'],
    ])('400 bei %s', async (abfrage, feld) => {
      const res = await super_().get(`/api/support/vorgaenge?${abfrage}`);
      expect(res.status).toBe(400);
      expect(res.body.details.map((x) => x.field)).toEqual([feld]);
    });
  });

  // ==========================================================================
  // Detail
  // ==========================================================================
  describe('GET /vorgaenge/:id', () => {
    it('Vorgang aus dem Formular: alle Felder, Verlauf (älteste zuerst), Gemeinde, Gemeindeleitung und Empfänger', async () => {
      await leitungMitAdresse('Leitung@Andere.example');
      const v = await d.vorgang({
        art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', status: 'in_arbeit', betreff: 'Termine fehlen', beschreibung: 'Seit gestern leer.',
        quelle: 'formular', organization_id: 2, kontakt_name: 'Erika Probe', kontakt_email: 'erika@andere.example', kontakt_funktion: 'Küsterin',
        gemeinde_angabe: 'Andere Gemeinde (Küste)', einwilligung_am: '2026-10-01T07:00:00Z', notiz: 'Intern: zurückrufen',
        created_at: '2026-10-01T08:00:00Z',
      });
      const spaet = await d.mail({ vorgang_id: v, betreff: 'Zweite', gesendet_am: new Date('2026-10-02T09:00:00Z'), von_adresse: 'erika@andere.example', von_name: 'Erika' });
      const frueh = await d.mail({ vorgang_id: v, betreff: 'Erste', gesendet_am: new Date('2026-10-01T09:00:00Z'), richtung: 'aus', von_adresse: 'support@konfi-quest.de' });

      const res = await super_().get(`/api/support/vorgaenge/${v}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual([...LISTE_FELDER, ...DETAIL_ZUSATZ].sort());
      expect(res.body).toMatchObject({
        id: v, art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', status: 'in_arbeit', betreff: 'Termine fehlen',
        beschreibung: 'Seit gestern leer.', quelle: 'formular', organization_id: 2, gemeinde_name: 'Andere Gemeinde',
        kontakt_name: 'Erika Probe', kontakt_email: 'erika@andere.example', kontakt_funktion: 'Küsterin',
        gemeinde_angabe: 'Andere Gemeinde (Küste)', einwilligung_am: '2026-10-01T07:00:00.000Z', notiz: 'Intern: zurückrufen',
        erstellt_von: null, erstellt_von_name: null, anfrage: null, ungelesen: 1,
      });
      expect(res.body.verlauf.map((m) => m.id)).toEqual([frueh, spaet]);
      expect(res.body.verlauf[0]).toMatchObject({ richtung: 'aus', vorgang_id: v, archiviert_am: null });
      expect(res.body.gemeinde).toMatchObject({
        id: 2, name: 'Andere Gemeinde', display_name: 'Andere Gemeinde', is_active: true, intern: false, kirchenkreis: null, landeskirche: null,
        // Wie GET /support/gemeinden: Konfis, die auf das Limit zählen (seed: konfi3)
        konfi_count: 1,
      });
      expect(res.body.leitung).toMatchObject([{ id: USERS.orgAdmin2.id, display_name: 'Test Org-Admin 2', email: 'Leitung@Andere.example' }]);
      // Empfänger: Absender der eingehenden Mails zuerst, dann die Kontaktadresse (schon dabei), dann die Leitung
      expect(res.body.empfaenger).toEqual([
        { adresse: 'erika@andere.example', name: 'Erika', herkunft: 'absender' },
        { adresse: 'leitung@andere.example', name: 'Test Org-Admin 2', herkunft: 'leitung' },
      ]);
    });

    it('Vorgang einer Anfrage: anfrage mit allen Feldern (auch ungelesen), Empfänger ist die Adresse der Anfrage', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ gemeinde: 'Kirchengemeinde Büsum', email: 'Probe@Buesum.example', nachricht: 'Wir möchten starten.' });
      await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      const res = await super_().get(`/api/support/vorgaenge/${vorgang}`);
      expect(res.body).toMatchObject({
        art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: anfrage, gemeinde_name: 'Kirchengemeinde Büsum',
        beschreibung: 'Wir möchten starten.', gemeinde: null, leitung: [], ungelesen: 1,
      });
      expect(res.body.anfrage).toMatchObject({
        id: anfrage, gemeinde: 'Kirchengemeinde Büsum', kontakt_name: 'Pastorin Probe', email: 'Probe@Buesum.example', status: 'neu',
        nachricht: 'Wir möchten starten.', ungelesen: 1,
      });
      expect(res.body.empfaenger).toEqual([
        { adresse: 'absender@gemeinde.example', name: null, herkunft: 'absender' },
        { adresse: 'probe@buesum.example', name: 'Pastorin Probe', herkunft: 'anfrage' },
      ]);
    });

    it('vom Support angelegt: erstellt_von_name', async () => {
      const v = await d.vorgang({ erstellt_von: USERS.orgAdminSuper.id });
      expect((await super_().get(`/api/support/vorgaenge/${v}`)).body).toMatchObject({ erstellt_von: USERS.orgAdminSuper.id, erstellt_von_name: 'Test Org-Admin Super' });
    });

    it('404 ohne Vorgang; 400 bei ungültiger Kennung', async () => {
      expect((await super_().get('/api/support/vorgaenge/999999')).status).toBe(404);
      expect((await super_().get('/api/support/vorgaenge/abc')).status).toBe(400);
    });
  });

  // ==========================================================================
  // Anlegen
  // ==========================================================================
  describe('POST /vorgaenge', () => {
    it('ohne Text: 201 mit dem Detail; Quelle support, Status neu, erstellt_von das Konto; nichts gesendet', async () => {
      const res = await super_().post('/api/support/vorgaenge', { art: 'lizenz', bereich: 'einstellungen', dringlichkeit: 'dringend', betreff: '  Lizenz\nverlängern ', organization_id: 2 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        art: 'lizenz', bereich: 'einstellungen', dringlichkeit: 'dringend', status: 'neu', betreff: 'Lizenz verlängern', quelle: 'support',
        organization_id: 2, gemeinde_name: 'Andere Gemeinde', anfrage_id: null, ungelesen: 0, archiviert_am: null,
        erstellt_von: USERS.orgAdminSuper.id, erstellt_von_name: 'Test Org-Admin Super', verlauf: [],
      });
      expect(await d.anzahl('support_vorgaenge')).toBe(1);
      expect(sendMail).not.toHaveBeenCalled();
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
    });

    it('nur das Nötigste: art und betreff; Vorgabe normal, ohne Gemeinde', async () => {
      const res = await super_().post('/api/support/vorgaenge', { art: 'sonstiges', betreff: 'Notiz' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ art: 'sonstiges', bereich: null, dringlichkeit: 'normal', organization_id: null, gemeinde_name: null });
    });

    it('mit Text: Mail vom Postfach support an die Gemeindeleitung, [Vorgang N] im Betreff, Vorgang in Arbeit, Mail im Verlauf', async () => {
      await leitungMitAdresse();
      const res = await super_().post('/api/support/vorgaenge', { art: 'zugang', betreff: 'Zugang für die neue Küsterin', organization_id: 2, text: 'Hallo, wir richten den Zugang ein.' });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'support@konfi-quest.de', to: ['leitung@andere.example'] });
      expect(m.betreff).toBe(`Zugang für die neue Küsterin [Vorgang ${res.body.id}]`);
      expect(m.text).toMatch(/^Hallo, wir richten den Zugang ein\./);
      expect(res.body.status).toBe('in_arbeit');
      expect(res.body.verlauf).toHaveLength(1);
      expect(res.body.verlauf[0]).toMatchObject({
        richtung: 'aus', postfach: 'support', vorgang_id: res.body.id, organization_id: 2, anfrage_id: null,
        an_adressen: ['leitung@andere.example'], verfasst_von: USERS.orgAdminSuper.id,
      });
    });

    it('mit Text und `an` aus den Empfängern der Gemeinde', async () => {
      await leitungMitAdresse();
      await d.mail({ postfach: 'support', organization_id: 2, von_adresse: 'kuesterin@andere.example' });
      const res = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'Rückfrage', organization_id: 2, text: 'Hallo', an: 'Kuesterin@Andere.example' });
      expect(res.status).toBe(201);
      expect((await gesendet()).umschlag.to).toEqual(['kuesterin@andere.example']);
    });

    it('400: Text ohne Gemeinde; Adresse nicht unter den Empfängern; Gemeinde ohne bekannte Adresse -- nichts angelegt, nichts gesendet', async () => {
      await leitungMitAdresse();
      const ohneGemeinde = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x', text: 'Hallo' });
      expect([ohneGemeinde.status, ohneGemeinde.body]).toEqual([400, { error: 'Für eine Mail braucht der Vorgang eine Gemeinde.' }]);
      const fremd = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x', organization_id: 2, text: 'Hallo', an: 'fremd@x.example' });
      expect([fremd.status, fremd.body]).toEqual([400, { error: 'Diese Adresse gehört nicht zu den Empfängern dieser Gemeinde.' }]);
      const ohneAdresse = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x', organization_id: 1, text: 'Hallo' });
      expect([ohneAdresse.status, ohneAdresse.body]).toEqual([400, { error: 'Für diese Gemeinde ist keine Adresse bekannt.' }]);
      expect(await d.anzahl('support_vorgaenge')).toBe(0);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('502 und 503: scheitert der Versand, entsteht kein Vorgang', async () => {
      await leitungMitAdresse();
      sendMail.mockRejectedValue(Object.assign(new Error('boom'), { code: 'EENVELOPE' }));
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x', organization_id: 2, text: 'Hallo' });
        expect(res.status).toBe(502);
      } finally {
        fehler.mockRestore();
      }
      process.env.RUN_BACKGROUND_JOBS = 'false';
      try {
        const res = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x', organization_id: 2, text: 'Hallo' });
        expect([res.status, res.body]).toEqual([503, { error: 'Auf diesem Server ist der Versand aus.' }]);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
      }
      expect(await d.anzahl('support_vorgaenge')).toBe(0);
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
    });

    it('404: Gemeinde gibt es nicht', async () => {
      const res = await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x', organization_id: 999999 });
      expect([res.status, res.body]).toEqual([404, { error: 'Gemeinde nicht gefunden' }]);
    });

    it.each([
      [{ betreff: 'x' }, 'art'],
      [{ art: 'beschwerde', betreff: 'x' }, 'art'],
      [{ art: 'frage' }, 'betreff'],
      [{ art: 'frage', betreff: '   ' }, 'betreff'],
      [{ art: 'frage', betreff: 'x'.repeat(301) }, 'betreff'],
      [{ art: 'frage', betreff: 'x', bereich: 'kaffee' }, 'bereich'],
      [{ art: 'frage', betreff: 'x', dringlichkeit: 'egal' }, 'dringlichkeit'],
      [{ art: 'frage', betreff: 'x', organization_id: 'abc' }, 'organization_id'],
      [{ art: 'frage', betreff: 'x', text: 'y'.repeat(20001) }, 'text'],
    ])('400 bei %j', async (body, feld) => {
      const res = await super_().post('/api/support/vorgaenge', body);
      expect(res.status).toBe(400);
      expect(res.body.details.map((x) => x.field)).toContain(feld);
      expect(await d.anzahl('support_vorgaenge')).toBe(0);
    });

    it('Gegenprobe: genau an den Grenzen geht es (Betreff 300 Zeichen)', async () => {
      expect((await super_().post('/api/support/vorgaenge', { art: 'frage', betreff: 'x'.repeat(300) })).status).toBe(201);
    });
  });

  // ==========================================================================
  // Einordnen
  // ==========================================================================
  describe('PATCH /vorgaenge/:id', () => {
    it('Art, Bereich, Dringlichkeit, Betreff, Notiz: das Objekt kommt zurück; nur genannte Felder ändern sich', async () => {
      const v = await d.vorgang({ art: 'frage', bereich: 'chat', betreff: 'Alt', notiz: 'alt' });
      const res = await super_().patch(`/api/support/vorgaenge/${v}`, {
        art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', betreff: ' Neu\n ', notiz: '  Intern  ',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: v, art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', betreff: 'Neu', notiz: 'Intern', status: 'neu' });
      expect(Object.keys(res.body).sort()).toEqual([...LISTE_FELDER, ...DETAIL_ZUSATZ].sort());
      // Nur eines: der Rest bleibt
      await super_().patch(`/api/support/vorgaenge/${v}`, { art: 'wunsch' });
      expect(await d.vorgangZeile(v)).toMatchObject({ art: 'wunsch', bereich: 'termine', dringlichkeit: 'dringend', betreff: 'Neu', notiz: 'Intern' });
    });

    it('bereich null leert, eine leere Notiz wird null', async () => {
      const v = await d.vorgang({ bereich: 'chat', notiz: 'x' });
      await super_().patch(`/api/support/vorgaenge/${v}`, { bereich: null, notiz: '   ' });
      expect(await d.vorgangZeile(v)).toMatchObject({ bereich: null, notiz: null });
    });

    it('Status: status_seit läuft neu, wenn er sich ändert -- und nur dann', async () => {
      const v = await d.vorgang({ status: 'neu', status_seit: '2026-09-01T08:00:00Z' });
      await super_().patch(`/api/support/vorgaenge/${v}`, { status: 'neu', betreff: 'Nur der Betreff' });
      expect((await d.vorgangZeile(v)).status_seit).toEqual(new Date('2026-09-01T08:00:00Z'));
      await super_().patch(`/api/support/vorgaenge/${v}`, { status: 'wartet' });
      const z = await d.vorgangZeile(v);
      expect(z.status).toBe('wartet');
      expect(Date.now() - z.status_seit.getTime()).toBeLessThan(60 * 1000);
      expect(z.archiviert_am).toBeNull();
    });

    it('„erledigt“ legt den Vorgang ins Archiv; ein anderer Status holt ihn zurück', async () => {
      const v = await d.vorgang({ status: 'in_arbeit' });
      const erledigt = await super_().patch(`/api/support/vorgaenge/${v}`, { status: 'erledigt' });
      expect(erledigt.body).toMatchObject({ status: 'erledigt' });
      expect(erledigt.body.archiviert_am).not.toBeNull();
      expect((await super_().get('/api/support/vorgaenge')).body).toEqual([]);
      expect((await super_().get('/api/support/vorgaenge?filter=archiv')).body.map((x) => x.id)).toEqual([v]);

      const zurueck = await super_().patch(`/api/support/vorgaenge/${v}`, { status: 'in_arbeit' });
      expect(zurueck.body).toMatchObject({ status: 'in_arbeit', archiviert_am: null });
      expect((await super_().get('/api/support/vorgaenge')).body.map((x) => x.id)).toEqual([v]);
    });

    it('Gemeinde setzen und lösen: Gemeinde und Mails des Vorgangs folgen (organization_id an der Mail, die alten Routen lesen sie)', async () => {
      const v = await d.vorgang();
      const m1 = await d.mail({ vorgang_id: v });
      const m2 = await d.mail({ vorgang_id: v, richtung: 'aus' });
      expect(await d.mailZeile(m1)).toMatchObject({ organization_id: null, anfrage_id: null });
      const mit = await super_().patch(`/api/support/vorgaenge/${v}`, { organization_id: 2 });
      expect(mit.body).toMatchObject({ organization_id: 2, gemeinde_name: 'Andere Gemeinde' });
      expect(mit.body.gemeinde).toMatchObject({ id: 2 });
      expect(await d.mailZeile(m1)).toMatchObject({ vorgang_id: v, organization_id: 2, anfrage_id: null });
      expect(await d.mailZeile(m2)).toMatchObject({ vorgang_id: v, organization_id: 2 });
      // die alte Route sieht sie jetzt beim Schriftwechsel der Gemeinde
      const verlauf = await super_().get('/api/support/gemeinden/2/verlauf');
      expect(verlauf.body.map((x) => x.id)).toEqual([m1, m2]);

      const ohne = await super_().patch(`/api/support/vorgaenge/${v}`, { organization_id: null });
      expect(ohne.body).toMatchObject({ organization_id: null, gemeinde_name: null, gemeinde: null });
      expect(await d.mailZeile(m1)).toMatchObject({ vorgang_id: v, organization_id: null });
    });

    it('Vorgang einer Anfrage: eine Gemeinde setzen lässt die Mails bei der Anfrage (nie beides)', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      const m = await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      const res = await super_().patch(`/api/support/vorgaenge/${vorgang}`, { organization_id: 2 });
      expect(res.status).toBe(200);
      expect(await d.mailZeile(m)).toMatchObject({ anfrage_id: anfrage, organization_id: null, vorgang_id: vorgang });
    });

    it('Vorgang einer Anfrage: Status und Notiz gehen mit der Anfrage; die Anfrage zählt es als Bewegung', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      await db.query("UPDATE gemeinde_anfragen SET updated_at = NOW() - interval '300 days'");
      const arbeit = await super_().patch(`/api/support/vorgaenge/${vorgang}`, { status: 'in_arbeit', notiz: 'Rückruf Montag' });
      expect(arbeit.status).toBe(200);
      let a = await d.anfrageZeile(anfrage);
      expect(a).toMatchObject({ status: 'in_arbeit', notiz: 'Rückruf Montag', bearbeitet_von: USERS.orgAdminSuper.id });
      expect(Date.now() - a.updated_at.getTime()).toBeLessThan(60 * 1000);
      expect(Date.now() - a.status_seit.getTime()).toBeLessThan(60 * 1000);

      // wartet: für die Anfrage weiter „in Arbeit“
      await super_().patch(`/api/support/vorgaenge/${vorgang}`, { status: 'wartet' });
      expect((await d.anfrageZeile(anfrage)).status).toBe('in_arbeit');

      // erledigt ohne Gemeinde: die Anfrage ist abgelehnt (Frist 180 Tage ab jetzt), der Vorgang archiviert
      await super_().patch(`/api/support/vorgaenge/${vorgang}`, { status: 'erledigt' });
      a = await d.anfrageZeile(anfrage);
      expect(a.status).toBe('abgelehnt');
      expect(Date.now() - a.status_seit.getTime()).toBeLessThan(60 * 1000);
      expect((await d.vorgangZeile(vorgang)).archiviert_am).not.toBeNull();

      // wieder auf: Anfrage und Vorgang sind offen, der Vorgang nicht mehr im Archiv
      await super_().patch(`/api/support/vorgaenge/${vorgang}`, { status: 'neu' });
      expect((await d.anfrageZeile(anfrage)).status).toBe('neu');
      expect(await d.vorgangZeile(vorgang)).toMatchObject({ status: 'neu', archiviert_am: null });
    });

    it('eine angelegte Anfrage bleibt „angelegt“, wie der Vorgang auch gesetzt wird', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ status: 'angelegt', organization_id: 2 });
      await db.query("UPDATE support_vorgaenge SET status = 'erledigt', archiviert_am = NOW() WHERE id = $1", [vorgang]);
      await super_().patch(`/api/support/vorgaenge/${vorgang}`, { status: 'in_arbeit' });
      expect((await d.anfrageZeile(anfrage)).status).toBe('angelegt');
      expect(await d.vorgangZeile(vorgang)).toMatchObject({ status: 'in_arbeit', archiviert_am: null });
    });

    it('404 ohne Vorgang oder Gemeinde (nichts ändert sich); 400 ohne Feld und bei ungültigen Werten', async () => {
      const v = await d.vorgang({ art: 'frage' });
      expect((await super_().patch('/api/support/vorgaenge/999999', { status: 'neu' })).status).toBe(404);
      const keineGemeinde = await super_().patch(`/api/support/vorgaenge/${v}`, { art: 'fehler', organization_id: 999999 });
      expect([keineGemeinde.status, keineGemeinde.body]).toEqual([404, { error: 'Gemeinde nicht gefunden' }]);
      expect((await d.vorgangZeile(v)).art).toBe('frage');
      const leer = await super_().patch(`/api/support/vorgaenge/${v}`, {});
      expect(leer.status).toBe(400);
      for (const b of [{ art: 'x' }, { status: 'offen' }, { bereich: 'kaffee' }, { dringlichkeit: 'egal' }, { betreff: '  ' }, { notiz: 'x'.repeat(5001) }, { organization_id: 'abc' }]) {
        expect([b, (await super_().patch(`/api/support/vorgaenge/${v}`, b)).status]).toEqual([b, 400]);
      }
      // Gegenprobe: Notiz mit 5000 Zeichen geht
      expect((await super_().patch(`/api/support/vorgaenge/${v}`, { notiz: 'x'.repeat(5000) })).status).toBe(200);
    });
  });

  // ==========================================================================
  // Antworten
  // ==========================================================================
  describe('POST /vorgaenge/:id/antworten', () => {
    it('Vorgang aus dem Formular: vom Postfach support an die Kontaktadresse, [Vorgang N], Fußzeile; Vorgang „neu“ geht auf „in Arbeit“', async () => {
      const v = await d.vorgang({ quelle: 'formular', betreff: 'Termine fehlen', kontakt_email: 'Erika@Andere.example', kontakt_name: 'Erika', organization_id: 2 });
      const res = await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: '  Wir schauen nach.  ' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'support@konfi-quest.de', to: ['erika@andere.example'] });
      expect(m.betreff).toBe(`Termine fehlen [Vorgang ${v}]`);
      expect(m.text).toMatch(/^Wir schauen nach\.\n\n-- \n/);
      expect(res.body.nachricht).toMatchObject({
        postfach: 'support', richtung: 'aus', vorgang_id: v, organization_id: 2, anfrage_id: null, an_adressen: ['erika@andere.example'],
        verfasst_von: USERS.orgAdminSuper.id,
      });
      const z = await d.vorgangZeile(v);
      expect(z.status).toBe('in_arbeit');
      expect(Date.now() - z.status_seit.getTime()).toBeLessThan(60 * 1000);
    });

    it('eigener Betreff und Antwort auf eine Mail: Re: ohne doppeltes Re:, In-Reply-To auf die letzte Mail; „wartet“ und „in Arbeit“ bleiben', async () => {
      const v = await d.vorgang({ status: 'wartet', organization_id: 2 });
      await d.mail({ vorgang_id: v, message_id: '<letzte@andere.example>', betreff: 'AW: Re: Kalender', von_adresse: 'erika@andere.example' });
      const res = await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: 'Danke' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect([m.betreff, m.inReplyTo, m.umschlag.to]).toEqual([`Re: Kalender [Vorgang ${v}]`, '<letzte@andere.example>', ['erika@andere.example']]);
      expect((await d.vorgangZeile(v)).status).toBe('wartet');
      await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: 'x', betreff: 'Anderer Betreff' });
      expect((await gesendet(1)).betreff).toBe(`Anderer Betreff [Vorgang ${v}]`);
    });

    it('Vorgang einer Anfrage: vom Postfach moin an die Adresse der Anfrage; die Anfrage geht mit auf „in Arbeit“', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ email: 'Probe@Buesum.example' });
      const res = await super_().post(`/api/support/vorgaenge/${vorgang}/antworten`, { text: 'Willkommen' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'moin@konfi-quest.de', to: ['probe@buesum.example'] });
      expect(m.betreff).toBe(`Eure Anfrage für Kirchengemeinde Büsum [Vorgang ${vorgang}]`);
      expect(res.body.nachricht).toMatchObject({ postfach: 'moin', anfrage_id: anfrage, organization_id: null, vorgang_id: vorgang });
      expect(await d.vorgangZeile(vorgang)).toMatchObject({ status: 'in_arbeit' });
      expect((await d.anfrageZeile(anfrage)).status).toBe('in_arbeit');
    });

    it('`an` muss zu den Empfängern gehören -- sonst 400 und nichts geht hinaus; ohne Empfänger 400', async () => {
      const v = await d.vorgang({ kontakt_email: 'erika@andere.example', organization_id: 2 });
      const fremd = await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: 'x', an: 'fremd@x.example' });
      expect([fremd.status, fremd.body]).toEqual([400, { error: 'Diese Adresse gehört nicht zu den Empfängern dieses Vorgangs.' }]);
      const leer = await d.vorgang();
      const keiner = await super_().post(`/api/support/vorgaenge/${leer}/antworten`, { text: 'x' });
      expect([keiner.status, keiner.body]).toEqual([400, { error: 'Für diesen Vorgang ist keine Empfängeradresse bekannt.' }]);
      expect(sendMail).not.toHaveBeenCalled();
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
      // Gegenprobe: die Kontaktadresse (ohne Groß/klein) geht
      expect((await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: 'x', an: 'ERIKA@andere.example' })).status).toBe(201);
    });

    it('502: scheitert der Versand, wird nichts gespeichert und der Status bleibt', async () => {
      const v = await d.vorgang({ kontakt_email: 'erika@andere.example' });
      sendMail.mockRejectedValue(Object.assign(new Error('boom'), { code: 'EENVELOPE' }));
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: 'x' });
        expect(res.status).toBe(502);
      } finally {
        fehler.mockRestore();
      }
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
      expect((await d.vorgangZeile(v)).status).toBe('neu');
    });

    it('404 ohne Vorgang; 400 ohne Text oder mit zu langem Text', async () => {
      const v = await d.vorgang({ kontakt_email: 'erika@andere.example' });
      expect((await super_().post('/api/support/vorgaenge/999999/antworten', { text: 'x' })).status).toBe(404);
      for (const b of [{}, { text: '  ' }, { text: 'x'.repeat(20001) }, { text: 'x', betreff: 'b'.repeat(301) }]) {
        expect([b, (await super_().post(`/api/support/vorgaenge/${v}/antworten`, b)).status]).toEqual([b, 400]);
      }
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('RUN_BACKGROUND_JOBS=false (backend-test): 503, nichts gesendet, nichts gespeichert', async () => {
      const v = await d.vorgang({ kontakt_email: 'erika@andere.example' });
      process.env.RUN_BACKGROUND_JOBS = 'false';
      try {
        const res = await super_().post(`/api/support/vorgaenge/${v}/antworten`, { text: 'x' });
        expect([res.status, res.body]).toEqual([503, { error: 'Auf diesem Server ist der Versand aus.' }]);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
      }
      expect(sendMail).not.toHaveBeenCalled();
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
    });
  });

  // ==========================================================================
  // Archivieren, Wiederherstellen, Loeschen
  // ==========================================================================
  describe('Archivieren, Wiederherstellen, Löschen', () => {
    it('archivieren: raus aus den offenen Listen, im Archiv mit Suche; der Status bleibt; Antwort ist das Detail', async () => {
      const v = await d.vorgang({ status: 'in_arbeit', betreff: 'Suchbegriff Zebra' });
      const res = await super_().post(`/api/support/vorgaenge/${v}/archivieren`, {});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: v, status: 'in_arbeit' });
      expect(res.body.archiviert_am).not.toBeNull();
      expect((await super_().get('/api/support/vorgaenge?filter=offen')).body).toEqual([]);
      expect((await super_().get('/api/support/vorgaenge?filter=archiv&suche=zebra')).body.map((x) => x.id)).toEqual([v]);
      // zweimal archivieren ändert den Zeitpunkt nicht
      const erst = (await d.vorgangZeile(v)).archiviert_am;
      await super_().post(`/api/support/vorgaenge/${v}/archivieren`, {});
      expect((await d.vorgangZeile(v)).archiviert_am).toEqual(erst);
    });

    it('wiederherstellen: wieder in den Listen; ein erledigter Vorgang geht auf „in Arbeit“, ein anderer behält seinen Status', async () => {
      const wartet = await d.vorgang({ status: 'wartet', archiviert_am: new Date() });
      const erledigt = await d.vorgang({ status: 'erledigt' });
      const nicht = await d.vorgang({ status: 'neu' });
      expect((await super_().post(`/api/support/vorgaenge/${wartet}/wiederherstellen`, {})).body).toMatchObject({ status: 'wartet', archiviert_am: null });
      const res = await super_().post(`/api/support/vorgaenge/${erledigt}/wiederherstellen`, {});
      expect(res.body).toMatchObject({ status: 'in_arbeit', archiviert_am: null });
      expect((await d.vorgangZeile(erledigt)).status_seit.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
      // ein nicht archivierter bleibt, wie er ist
      expect((await super_().post(`/api/support/vorgaenge/${nicht}/wiederherstellen`, {})).body).toMatchObject({ status: 'neu', archiviert_am: null });
    });

    it('archivieren und wiederherstellen eines Anfrage-Vorgangs: die Anfrage folgt, wo es sie betrifft', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ status: 'abgelehnt' });
      await db.query("UPDATE support_vorgaenge SET status = 'erledigt', archiviert_am = NOW() WHERE id = $1", [vorgang]);
      await super_().post(`/api/support/vorgaenge/${vorgang}/wiederherstellen`, {});
      expect(await d.vorgangZeile(vorgang)).toMatchObject({ status: 'in_arbeit', archiviert_am: null });
      expect((await d.anfrageZeile(anfrage)).status).toBe('in_arbeit');
    });

    it('404 bei unbekanntem Vorgang', async () => {
      expect((await super_().post('/api/support/vorgaenge/999999/archivieren', {})).status).toBe(404);
      expect((await super_().post('/api/support/vorgaenge/999999/wiederherstellen', {})).status).toBe(404);
      expect((await super_().delete('/api/support/vorgaenge/999999')).status).toBe(404);
    });

    it('DELETE: Vorgang und seine Mails sind weg, andere Vorgänge, der Posteingang und Mails anderer bleiben', async () => {
      const v = await d.vorgang({ organization_id: 2 });
      const anderer = await d.vorgang();
      await d.mail({ vorgang_id: v });
      await d.mail({ vorgang_id: v, richtung: 'aus' });
      const bleibt = await d.mail({ vorgang_id: anderer });
      const posteingang = await d.mail({});
      const res = await super_().delete(`/api/support/vorgaenge/${v}`);
      expect([res.status, res.body]).toEqual([200, { message: 'Vorgang gelöscht' }]);
      expect((await db.query('SELECT id FROM support_vorgaenge')).rows.map((r) => Number(r.id))).toEqual([anderer]);
      expect((await db.query('SELECT id FROM mail_nachrichten ORDER BY id')).rows.map((r) => Number(r.id))).toEqual([bleibt, posteingang]);
      expect((await super_().get(`/api/support/vorgaenge/${v}`)).status).toBe(404);
    });

    it('DELETE eines Anfrage-Vorgangs löscht die Anfrage mit; die Gemeinde, die daraus entstand, bleibt', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ status: 'angelegt', organization_id: 2 });
      const andere = await d.anfrageMitVorgang({ email: 'andere@x.example' });
      await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      expect((await super_().delete(`/api/support/vorgaenge/${vorgang}`)).status).toBe(200);
      expect(await d.anfrageZeile(anfrage)).toBeUndefined();
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
      expect((await d.anfrageZeile(andere.anfrage))).toBeDefined();
      expect((await db.query('SELECT id FROM organizations WHERE id = 2')).rows).toHaveLength(1);
    });

    it('die alte Route der Anfrage kennt sie nach dem Löschen nicht mehr', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      await super_().delete(`/api/support/vorgaenge/${vorgang}`);
      expect((await super_().get(`/api/support/anfragen/${anfrage}/verlauf`)).status).toBe(404);
      expect((await super_().get('/api/support/anfragen')).body).toEqual([]);
    });
  });

  // ==========================================================================
  // Sammelaktionen
  // ==========================================================================
  describe('POST /vorgaenge/sammel', () => {
    it('archivieren und wiederherstellen für mehrere; unbekannte und doppelte Kennungen werden übergangen', async () => {
      const a = await d.vorgang();
      const b = await d.vorgang();
      const c = await d.vorgang();
      const res = await super_().post('/api/support/vorgaenge/sammel', { ids: [b, a, a, 999999], aktion: 'archivieren' });
      expect([res.status, res.body]).toEqual([200, { aktion: 'archivieren', anzahl: 2, ids: [a, b] }]);
      expect((await super_().get('/api/support/vorgaenge')).body.map((x) => x.id)).toEqual([c]);
      expect((await super_().get('/api/support/vorgaenge?filter=archiv')).body.map((x) => x.id).sort((x, y) => x - y)).toEqual([a, b]);

      const zurueck = await super_().post('/api/support/vorgaenge/sammel', { ids: [a, b], aktion: 'wiederherstellen' });
      expect(zurueck.body).toEqual({ aktion: 'wiederherstellen', anzahl: 2, ids: [a, b] });
      expect((await super_().get('/api/support/vorgaenge')).body).toHaveLength(3);
    });

    it('status: für alle gesetzt; „erledigt“ archiviert, ein anderer Status holt aus dem Archiv; Anfrage-Vorgänge ziehen ihre Anfrage mit', async () => {
      const a = await d.vorgang({ status: 'neu' });
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      const res = await super_().post('/api/support/vorgaenge/sammel', { ids: [a, vorgang], aktion: 'status', status: 'erledigt' });
      expect(res.body).toEqual({ aktion: 'status', anzahl: 2, ids: [a, vorgang].sort((x, y) => x - y) });
      expect(await d.vorgangZeile(a)).toMatchObject({ status: 'erledigt' });
      expect((await d.vorgangZeile(a)).archiviert_am).not.toBeNull();
      expect((await d.anfrageZeile(anfrage)).status).toBe('abgelehnt');

      await super_().post('/api/support/vorgaenge/sammel', { ids: [a, vorgang], aktion: 'status', status: 'in_arbeit' });
      expect(await d.vorgangZeile(a)).toMatchObject({ status: 'in_arbeit', archiviert_am: null });
      expect((await d.anfrageZeile(anfrage)).status).toBe('in_arbeit');
    });

    it('loeschen: Vorgänge, ihre Mails und daran hängende Anfragen; alles andere bleibt', async () => {
      const a = await d.vorgang();
      const { anfrage, vorgang } = await d.anfrageMitVorgang();
      const bleibt = await d.vorgang();
      await d.mail({ vorgang_id: a });
      await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      const mailBleibt = await d.mail({ vorgang_id: bleibt });
      const res = await super_().post('/api/support/vorgaenge/sammel', { ids: [a, vorgang], aktion: 'loeschen' });
      expect(res.body).toEqual({ aktion: 'loeschen', anzahl: 2, ids: [a, vorgang].sort((x, y) => x - y) });
      expect((await db.query('SELECT id FROM support_vorgaenge')).rows.map((r) => Number(r.id))).toEqual([bleibt]);
      expect((await db.query('SELECT id FROM mail_nachrichten')).rows.map((r) => Number(r.id))).toEqual([mailBleibt]);
      expect(await d.anfrageZeile(anfrage)).toBeUndefined();
    });

    it.each([
      [{ aktion: 'archivieren' }, 'ids'],
      [{ ids: [], aktion: 'archivieren' }, 'ids'],
      [{ ids: ['a'], aktion: 'archivieren' }, 'ids[0]'],
      [{ ids: [1] }, 'aktion'],
      [{ ids: [1], aktion: 'verschieben' }, 'aktion'],
      [{ ids: [1], aktion: 'status' }, 'status'],
      [{ ids: [1], aktion: 'status', status: 'offen' }, 'status'],
      [{ ids: Array.from({ length: 501 }, (_, i) => i + 1), aktion: 'archivieren' }, 'ids'],
    ])('400 bei %j', async (body, feld) => {
      const v = await d.vorgang();
      const res = await super_().post('/api/support/vorgaenge/sammel', body);
      expect(res.status).toBe(400);
      expect(res.body.details.map((x) => x.field)).toContain(feld);
      expect(await d.vorgangZeile(v)).toMatchObject({ archiviert_am: null, status: 'neu' });
    });

    it('Gegenprobe: genau 500 Kennungen gehen', async () => {
      const res = await super_().post('/api/support/vorgaenge/sammel', { ids: Array.from({ length: 500 }, (_, i) => i + 1), aktion: 'archivieren' });
      expect(res.status).toBe(200);
      expect(res.body.anzahl).toBe(0);
    });
  });

  // ==========================================================================
  // Konto und Gemeinde loeschen
  // ==========================================================================
  describe('Löschen von Konto und Gemeinde', () => {
    it('ein Support-Konto weg: sein Vorgang bleibt, erstellt_von wird leer, nichts anderes hängt am Konto', async () => {
      const v = await d.vorgang({ erstellt_von: SUPPORT.id, organization_id: 2, betreff: 'Bleibt' });
      await d.mail({ vorgang_id: v, richtung: 'aus' });
      const res = await super_().delete(`/api/organizations/support-konten/${SUPPORT.id}`);
      expect(res.status).toBe(200);
      expect(await d.vorgangZeile(v)).toMatchObject({ betreff: 'Bleibt', erstellt_von: null, organization_id: 2 });
      expect(await d.anzahl('mail_nachrichten')).toBe(1);
      const detail = await super_().get(`/api/support/vorgaenge/${v}`);
      expect(detail.body).toMatchObject({ erstellt_von: null, erstellt_von_name: null });
    });

    it('eine Gemeinde löschen nimmt ihre Vorgänge und deren Mails mit; Vorgänge anderer Gemeinden und ohne Gemeinde bleiben', async () => {
      const g2 = await d.vorgang({ organization_id: 2 });
      const g1 = await d.vorgang({ organization_id: 1 });
      const ohne = await d.vorgang();
      await d.mail({ vorgang_id: g2 });
      const mail1 = await d.mail({ vorgang_id: g1 });
      const res = await super_().delete(`/api/organizations/${ORGS.andereGemeinde.id}`);
      expect(res.status).toBe(200);
      expect((await db.query('SELECT id FROM support_vorgaenge ORDER BY id')).rows.map((r) => Number(r.id))).toEqual([g1, ohne]);
      expect((await db.query('SELECT id FROM mail_nachrichten')).rows.map((r) => Number(r.id))).toEqual([mail1]);
    });
  });
});
