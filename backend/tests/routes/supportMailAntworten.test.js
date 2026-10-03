// Antworten der Support-Mail (routes/supportMail.js, services/mailVersand.js;
// docs/planung/support-mail.md, Abschnitt "Antworten").
//
// Kein Mailserver: nodemailer.createTransport ist ersetzt (Muster wie
// tests/routes/anfragen.test.js), der IMAP-Client fuer den Gesendet-Ordner
// ist die Attrappe (tests/helpers/imapAttrappe.js). Geprueft wird der
// gesendete Quelltext selbst (mit mailparser zerlegt): Kopfzeilen,
// Fusszeile, Kennung im Betreff; dazu was gespeichert wird, der Status der
// Anfrage, 503 (Versand aus / Postfach nicht eingerichtet), 502 (Versand
// gescheitert; dann nichts gespeichert) und das Ablegen im Gesendet-Ordner.
const request = require('supertest');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { imapAttrappe } = require('../helpers/imapAttrappe');
const mailAbholung = require('../../services/mailAbholung');
const { STANDARD_EINSTELLUNGEN } = require('../../utils/mailEinstellungen');

const MAIL_ENV = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim-moin',
  MAIL_SUPPORT_USER: 'support-benutzer',
  MAIL_SUPPORT_PASS: 'geheim-support',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '465',
});

const MESSAGE_ID = /^<kq-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@konfi-quest\.de>$/;
const FUSS = `\n\n-- \n${STANDARD_EINSTELLUNGEN.fusszeile}\n`;

describe('Support-Mail: Antworten', () => {
  let app;
  let db;
  let attrappe;
  const sendMail = vi.fn();
  const transporte = [];

  beforeAll(() => {
    Object.assign(process.env, MAIL_ENV);
    vi.spyOn(nodemailer, 'createTransport').mockImplementation((opt) => {
      transporte.push(opt);
      return { sendMail };
    });
    vi.spyOn(mailAbholung, 'standardImapFabrik').mockImplementation((opt) => attrappe.fabrik(opt));
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
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    sendMail.mockReset().mockResolvedValue({ messageId: 'x' });
    transporte.length = 0;
    attrappe = imapAttrappe({ ordner: [{ path: 'Sent', name: 'Sent', delimiter: '.', flags: new Set(), specialUse: '\\Sent' }] });
  });

  const SUPER = () => generateToken('orgAdminSuper');
  const post = (pfad, b) => request(app).post(pfad).set('Authorization', `Bearer ${SUPER()}`).send(b);

  const anfrageAnlegen = async (f = {}) => {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, status_seit, updated_at)
       VALUES ($1, 'Erika', $2, NOW(), $3, NOW() - interval '5 days', NOW() - interval '5 days') RETURNING id`,
      [f.gemeinde || 'Kirchengemeinde Büsum', f.email || 'Erika@Buesum.example', f.status || 'neu']);
    return Number(id);
  };
  const anfrageLesen = async (id) => (await db.query(
    'SELECT status, status_seit, updated_at, bearbeitet_von FROM gemeinde_anfragen WHERE id = $1', [id])).rows[0];
  const mailEin = async (f) => {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id, in_reply_to, referenzen,
                                     von_adresse, betreff, text, gesendet_am)
       VALUES ($1, 'ein', $2, $3, $4, $5, $6, $7, $8, 'Hallo', $9) RETURNING id`,
      [f.postfach || 'moin', f.anfrage_id ?? null, f.organization_id ?? null, f.message_id, f.in_reply_to || null,
        f.referenzen || [], f.von_adresse || 'erika@buesum.example', f.betreff || 'Frage', f.gesendet_am || new Date('2026-10-01T10:00:00Z')]);
    return Number(id);
  };
  /** Der Vorgang einer Anfrage bzw. der juengste einer Gemeinde (die Kennung im Betreff). */
  const vorgangDerAnfrage = async (a) => Number((await db.query('SELECT id FROM support_vorgaenge WHERE anfrage_id = $1', [a])).rows[0].id);
  const vorgangDerGemeinde = async (o) => Number((await db.query(
    'SELECT id FROM support_vorgaenge WHERE organization_id = $1 ORDER BY id DESC LIMIT 1', [o])).rows[0].id);
  const anzahlMails = async () => (await db.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten')).rows[0].n;

  /** Die gesendete Mail (n-te), zerlegt, samt Umschlag. */
  const gesendet = async (n = 0) => {
    const [arg] = sendMail.mock.calls[n];
    const p = await simpleParser(arg.raw);
    return {
      umschlag: arg.envelope,
      quelltext: Buffer.from(arg.raw).toString('utf8'),
      von: p.from.value[0],
      an: p.to.value.map((a) => a.address),
      antwortAn: p.replyTo.value.map((a) => a.address),
      betreff: p.subject,
      messageId: p.messageId,
      inReplyTo: p.inReplyTo || null,
      references: p.references || null,
      text: p.text,
    };
  };

  // ==========================================================================
  // Anfrage
  // ==========================================================================
  describe('POST /anfragen/:id/antworten', () => {
    it('erste Antwort: vom Postfach moin, Standardbetreff mit Kennung, Fußzeile, eigene Message-ID; gespeichert; Anfrage „in Arbeit“', async () => {
      const a = await anfrageAnlegen();
      const res = await post(`/api/support/anfragen/${a}/antworten`, { text: '  Hallo Erika,\n\nwir richten euch ein.  ' });
      expect(res.status).toBe(201);

      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'moin@konfi-quest.de', to: ['erika@buesum.example'] });
      expect(m.von).toEqual({ address: 'moin@konfi-quest.de', name: 'Konfi Quest' });
      expect(m.an).toEqual(['erika@buesum.example']);
      expect(m.antwortAn).toEqual(['moin@konfi-quest.de']);
      // Seit den Vorgaengen: [Vorgang N] statt [Anfrage N] -- der Vorgang der Anfrage entsteht mit der ersten Antwort,
      // wenn die Anfrage (wie hier) ohne ihn eingetragen wurde.
      const v = await vorgangDerAnfrage(a);
      expect(m.betreff).toBe(`Eure Anfrage für Kirchengemeinde Büsum [Vorgang ${v}]`);
      expect(m.messageId).toMatch(MESSAGE_ID);
      expect([m.inReplyTo, m.references]).toEqual([null, null]);
      expect(m.text).toBe(`Hallo Erika,\n\nwir richten euch ein.${FUSS}`);
      expect(transporte).toEqual([expect.objectContaining({
        host: 'smtp.example.test', port: 465, secure: true,
        auth: { user: 'moin-benutzer', pass: 'geheim-moin' }, tls: { rejectUnauthorized: true },
      })]);

      expect(res.body.nachricht).toMatchObject({
        postfach: 'moin', richtung: 'aus', anfrage_id: a, organization_id: null, vorgang_id: v, message_id: m.messageId,
        in_reply_to: null, referenzen: [], von_adresse: 'moin@konfi-quest.de', von_name: 'Konfi Quest',
        an_adressen: ['erika@buesum.example'], betreff: m.betreff, text: `Hallo Erika,\n\nwir richten euch ein.${FUSS}`,
        anhaenge: [], verfasst_von: USERS.orgAdminSuper.id, verfasst_von_name: 'Test Org-Admin Super',
      });
      expect(res.body.nachricht.gelesen_am).toBe(res.body.nachricht.gesendet_am);
      expect(await anzahlMails()).toBe(1);

      const anfrage = await anfrageLesen(a);
      expect(anfrage.status).toBe('in_arbeit');
      expect(anfrage.bearbeitet_von).toBe(USERS.orgAdminSuper.id);
      expect(Date.now() - anfrage.status_seit.getTime()).toBeLessThan(60 * 1000);
      expect(Date.now() - anfrage.updated_at.getTime()).toBeLessThan(60 * 1000);
    });

    it('mit Verlauf: „Re: <letzter Betreff>“ ohne doppeltes Re:, In-Reply-To und References auf die letzte Mail', async () => {
      const a = await anfrageAnlegen({ status: 'in_arbeit' });
      await mailEin({ anfrage_id: a, message_id: '<alt@buesum.example>', betreff: 'Frage', gesendet_am: new Date('2026-09-01T10:00:00Z') });
      await mailEin({
        anfrage_id: a, message_id: '<letzte@buesum.example>', betreff: `AW: Re: Testphase [Anfrage ${a}]`,
        in_reply_to: '<kq-1@konfi-quest.de>', referenzen: ['<wurzel@x>', '<kq-1@konfi-quest.de>'],
      });
      const res = await post(`/api/support/anfragen/${a}/antworten`, { text: 'Gern!' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      // Die alte Kennung der Mail, auf die geantwortet wird, weicht [Vorgang N].
      expect(m.betreff).toBe(`Re: Testphase [Vorgang ${await vorgangDerAnfrage(a)}]`);
      expect(m.inReplyTo).toBe('<letzte@buesum.example>');
      expect(m.references).toEqual(['<wurzel@x>', '<kq-1@konfi-quest.de>', '<letzte@buesum.example>']);
      expect(res.body.nachricht).toMatchObject({
        in_reply_to: '<letzte@buesum.example>', referenzen: ['<wurzel@x>', '<kq-1@konfi-quest.de>', '<letzte@buesum.example>'],
      });
      // Status bleibt "in Arbeit"
      expect((await anfrageLesen(a)).status).toBe('in_arbeit');
    });

    it('eigener Betreff: die Kennung kommt dazu, wenn sie fehlt; eine alte Kennung weicht ihr; Status „abgelehnt“ bleibt', async () => {
      const a = await anfrageAnlegen({ status: 'abgelehnt' });
      await post(`/api/support/anfragen/${a}/antworten`, { text: 'x', betreff: 'Eure Zugangsdaten' });
      const v = await vorgangDerAnfrage(a);
      await post(`/api/support/anfragen/${a}/antworten`, { text: 'x', betreff: `Schon drin [vorgang ${v}]` });
      await post(`/api/support/anfragen/${a}/antworten`, { text: 'x', betreff: `Altes Thema [Anfrage ${a}]` });
      expect((await gesendet(0)).betreff).toBe(`Eure Zugangsdaten [Vorgang ${v}]`);
      expect((await gesendet(1)).betreff).toBe(`Schon drin [vorgang ${v}]`);
      expect((await gesendet(2)).betreff).toBe(`Altes Thema [Vorgang ${v}]`);
      expect((await anfrageLesen(a)).status).toBe('abgelehnt');
    });

    it('Fußzeile und Absendername aus den Einstellungen; leere Fußzeile = kein Trenner', async () => {
      const a = await anfrageAnlegen();
      await db.query(`INSERT INTO mail_einstellungen (schluessel, wert) VALUES
        ('fusszeile', E'Konfi Quest\\nkonfi-quest.de'), ('absendername', 'Konfi Quest Support')`);
      await post(`/api/support/anfragen/${a}/antworten`, { text: 'Hallo' });
      let m = await gesendet(0);
      expect(m.von).toEqual({ address: 'moin@konfi-quest.de', name: 'Konfi Quest Support' });
      expect(m.text).toBe('Hallo\n\n-- \nKonfi Quest\nkonfi-quest.de\n');
      expect(m.quelltext).toMatch(/^Konfi Quest$/m);

      await db.query("UPDATE mail_einstellungen SET wert = '' WHERE schluessel = 'fusszeile'");
      await post(`/api/support/anfragen/${a}/antworten`, { text: 'Ohne' });
      m = await gesendet(1);
      expect(m.text).toBe('Ohne\n');
    });

    it('legt die gesendete Mail danach im Gesendet-Ordner ab -- genau den gesendeten Quelltext', async () => {
      const a = await anfrageAnlegen();
      await post(`/api/support/anfragen/${a}/antworten`, { text: 'Hallo' });
      await warteAufNachwehen(app);
      const appends = attrappe.aufrufe.filter((x) => x[0] === 'append');
      expect(appends.length).toBe(1);
      const [, pfad, inhalt, flags] = appends[0];
      expect([pfad, flags]).toEqual(['Sent', ['\\Seen']]);
      expect(inhalt).toBe((await gesendet()).quelltext);
      expect(attrappe.optionen[0].auth).toEqual({ user: 'moin-benutzer', pass: 'geheim-moin' });
      expect(attrappe.namen()).toEqual(['connect', 'list', 'append', 'logout']);
    });

    it('scheitert das Ablegen, bleibt die Mail gesendet und gespeichert (nur Protokoll)', async () => {
      attrappe = imapAttrappe({ anhaengenFehler: Object.assign(new Error('Quota'), { code: 'OverQuota' }) });
      const a = await anfrageAnlegen();
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await post(`/api/support/anfragen/${a}/antworten`, { text: 'Hallo' });
        await warteAufNachwehen(app);
        expect(res.status).toBe(201);
        expect(fehler.mock.calls).toEqual([['Mail-Versand (moin): nicht im Gesendet-Ordner abgelegt (OverQuota: Quota)']]);
      } finally {
        fehler.mockRestore();
      }
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(await anzahlMails()).toBe(1);
      // Kein Ordner da: er wurde angelegt, dann scheiterte das Anhaengen.
      expect(attrappe.namen()).toEqual(['connect', 'list', 'mailboxCreate', 'append', 'logout']);
    });

    it('502, wenn der Versand scheitert -- nichts gespeichert, Status bleibt, nichts abgelegt; das Protokoll ohne Adresse', async () => {
      const a = await anfrageAnlegen();
      sendMail.mockRejectedValue(Object.assign(new Error('Recipient erika@buesum.example rejected'), { code: 'EENVELOPE' }));
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      let res;
      try {
        res = await post(`/api/support/anfragen/${a}/antworten`, { text: 'Hallo' });
        await warteAufNachwehen(app);
        expect(fehler.mock.calls).toEqual([['Mail-Versand (moin) gescheitert: EENVELOPE']]);
      } finally {
        fehler.mockRestore();
      }
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: 'Die Mail konnte nicht gesendet werden. Bitte versucht es später noch einmal.' });
      expect(await anzahlMails()).toBe(0);
      expect((await anfrageLesen(a)).status).toBe('neu');
      expect(attrappe.aufrufe).toEqual([]);
    });

    it('503, wenn das Postfach nicht eingerichtet ist -- nichts gesendet, nichts gespeichert', async () => {
      const a = await anfrageAnlegen();
      process.env.MAIL_MOIN_PASS = '';
      try {
        const res = await post(`/api/support/anfragen/${a}/antworten`, { text: 'Hallo' });
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'Das Postfach moin@konfi-quest.de ist noch nicht eingerichtet.' });
      } finally {
        process.env.MAIL_MOIN_PASS = MAIL_ENV.MAIL_MOIN_PASS;
      }
      expect(transporte).toEqual([]);
      expect(sendMail).not.toHaveBeenCalled();
      expect(await anzahlMails()).toBe(0);
      expect((await anfrageLesen(a)).status).toBe('neu');
    });

    it('404 ohne Anfrage; 400 ohne Text, mit zu langem Text oder Betreff -- nichts gesendet', async () => {
      const a = await anfrageAnlegen();
      expect((await post('/api/support/anfragen/999999/antworten', { text: 'x' })).status).toBe(404);
      for (const b of [{}, { text: '   ' }, { text: 'x'.repeat(20001) }, { text: 'x', betreff: 'b'.repeat(301) }, { text: 5 }]) {
        expect([b, (await post(`/api/support/anfragen/${a}/antworten`, b)).status]).toEqual([b, 400]);
      }
      // Gegenprobe: genau an der Grenze geht es.
      expect((await post(`/api/support/anfragen/${a}/antworten`, { text: 'x'.repeat(20000), betreff: 'b'.repeat(300) })).status).toBe(201);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Gemeinde
  // ==========================================================================
  describe('POST /gemeinden/:id/antworten', () => {
    beforeEach(async () => {
      await db.query("UPDATE users SET email = 'Leitung@Andere.example' WHERE id = $1", [USERS.orgAdmin2.id]);
    });

    it('vom Postfach support an eine Gemeindeleitung, Standardbetreff „Konfi Quest – <Gemeinde> [Vorgang N]“; gespeichert bei der Gemeinde und ihrem Vorgang', async () => {
      const res = await post('/api/support/gemeinden/2/antworten', { an: 'LEITUNG@andere.example', text: 'Hallo' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'support@konfi-quest.de', to: ['leitung@andere.example'] });
      expect(m.von).toEqual({ address: 'support@konfi-quest.de', name: 'Konfi Quest' });
      expect(m.antwortAn).toEqual(['support@konfi-quest.de']);
      // Ohne offenen Vorgang der Gemeinde entsteht ein "Schriftwechsel".
      const v = await vorgangDerGemeinde(2);
      expect(m.betreff).toBe(`Konfi Quest – Andere Gemeinde [Vorgang ${v}]`);
      expect(transporte[0].auth).toEqual({ user: 'support-benutzer', pass: 'geheim-support' });
      expect(res.body.nachricht).toMatchObject({
        postfach: 'support', richtung: 'aus', anfrage_id: null, organization_id: 2, vorgang_id: v, an_adressen: ['leitung@andere.example'],
      });
      expect((await db.query('SELECT art, betreff, quelle, status, erstellt_von FROM support_vorgaenge WHERE id = $1', [v])).rows[0])
        .toEqual({ art: 'sonstiges', betreff: 'Schriftwechsel', quelle: 'support', status: 'in_arbeit', erstellt_von: USERS.orgAdminSuper.id });
    });

    it('400, wenn die Adresse nicht unter den Empfängern steht -- nichts gesendet', async () => {
      const res = await post('/api/support/gemeinden/2/antworten', { an: 'fremd@x.example', text: 'Hallo' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Diese Adresse gehört nicht zu den Empfängern dieser Gemeinde.' });
      // Die Leitung einer ANDEREN Gemeinde ist hier auch kein Empfaenger.
      await db.query("UPDATE users SET email = 'leitung1@test.example' WHERE id = $1", [USERS.orgAdmin1.id]);
      expect((await post('/api/support/gemeinden/2/antworten', { an: 'leitung1@test.example', text: 'Hallo' })).status).toBe(400);
      expect(sendMail).not.toHaveBeenCalled();
      expect(await anzahlMails()).toBe(0);
    });

    it('ein Absender aus dem Verlauf ist Empfänger; die Antwort bezieht sich auf die letzte Mail', async () => {
      await mailEin({ postfach: 'support', organization_id: 2, message_id: '<k1@andere.example>', von_adresse: 'kuesterin@andere.example', betreff: 'Frage zum Kalender' });
      const res = await post('/api/support/gemeinden/2/antworten', { an: 'kuesterin@andere.example', text: 'Antwort' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect([m.betreff, m.inReplyTo]).toEqual([`Re: Frage zum Kalender [Vorgang ${await vorgangDerGemeinde(2)}]`, '<k1@andere.example>']);
    });

    it('404 ohne Gemeinde', async () => {
      expect((await post('/api/support/gemeinden/999999/antworten', { an: 'a@b.example', text: 'x' })).status).toBe(404);
    });
  });

  // ==========================================================================
  // Posteingang
  // ==========================================================================
  describe('POST /mail/nachrichten/:id/antworten', () => {
    it('an den Absender, vom selben Postfach, „Re: <Betreff>“ ohne Kennung; die Antwort bleibt im Posteingang', async () => {
      const id = await mailEin({ postfach: 'support', message_id: '<p1@x.example>', von_adresse: 'jemand@x.example', betreff: 'Re: Frage', referenzen: ['<w@x>'] });
      const res = await post(`/api/support/mail/nachrichten/${id}/antworten`, { text: 'Danke' });
      expect(res.status).toBe(201);
      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'support@konfi-quest.de', to: ['jemand@x.example'] });
      expect([m.betreff, m.inReplyTo, m.references]).toEqual(['Re: Frage', '<p1@x.example>', ['<w@x>', '<p1@x.example>']]);
      expect(res.body.nachricht).toMatchObject({ postfach: 'support', anfrage_id: null, organization_id: null });
      // Der Faden bleibt beisammen.
      const faden = await request(app).get(`/api/support/mail/nachrichten/${id}`).set('Authorization', `Bearer ${SUPER()}`);
      expect(faden.body.verlauf.map((x) => x.id)).toEqual([id, res.body.nachricht.id]);
    });

    it('ist die Mail einer Anfrage zugeordnet: Kennung dazu, Antwort bei der Anfrage, Status „in Arbeit“', async () => {
      const a = await anfrageAnlegen();
      const id = await mailEin({ anfrage_id: a, message_id: '<p2@x.example>', betreff: 'Frage' });
      const res = await post(`/api/support/mail/nachrichten/${id}/antworten`, { text: 'Danke' });
      expect((await gesendet()).betreff).toBe(`Re: Frage [Vorgang ${await vorgangDerAnfrage(a)}]`);
      expect(res.body.nachricht.anfrage_id).toBe(a);
      expect((await anfrageLesen(a)).status).toBe('in_arbeit');
    });

    it('400 auf eine ausgehende Mail, 404 ohne Mail', async () => {
      const { rows: [{ id }] } = await db.query(
        "INSERT INTO mail_nachrichten (postfach, richtung, message_id) VALUES ('moin', 'aus', '<kq-a@konfi-quest.de>') RETURNING id");
      expect((await post(`/api/support/mail/nachrichten/${id}/antworten`, { text: 'x' })).body)
        .toEqual({ error: 'Antworten geht nur auf eingehende Mails.' });
      expect((await post('/api/support/mail/nachrichten/999999/antworten', { text: 'x' })).status).toBe(404);
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // backend-test: kein Versand
  // ==========================================================================
  describe('RUN_BACKGROUND_JOBS=false (backend-test an der Produktions-Datenbank)', () => {
    it('alle drei Antwort-Routen: 503 „Auf diesem Server ist der Versand aus.“ -- nichts gesendet, nichts gespeichert, nichts abgelegt', async () => {
      const a = await anfrageAnlegen();
      await db.query("UPDATE users SET email = 'leitung@andere.example' WHERE id = $1", [USERS.orgAdmin2.id]);
      const id = await mailEin({ message_id: '<b1@x.example>' });
      process.env.RUN_BACKGROUND_JOBS = 'false';
      const antworten = [];
      try {
        antworten.push(await post(`/api/support/anfragen/${a}/antworten`, { text: 'x' }));
        antworten.push(await post('/api/support/gemeinden/2/antworten', { an: 'leitung@andere.example', text: 'x' }));
        antworten.push(await post(`/api/support/mail/nachrichten/${id}/antworten`, { text: 'x' }));
        await warteAufNachwehen(app);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
      }
      expect(antworten.map((r) => [r.status, r.body])).toEqual(
        [0, 1, 2].map(() => [503, { error: 'Auf diesem Server ist der Versand aus.' }]));
      expect(transporte).toEqual([]);
      expect(sendMail).not.toHaveBeenCalled();
      expect(await anzahlMails()).toBe(1);
      expect(attrappe.aufrufe).toEqual([]);
      expect((await anfrageLesen(a)).status).toBe('neu');
    });

    it('Gegenprobe: ohne die Variable (und mit "true") geht der Versand', async () => {
      const a = await anfrageAnlegen();
      expect((await post(`/api/support/anfragen/${a}/antworten`, { text: 'x' })).status).toBe(201);
      process.env.RUN_BACKGROUND_JOBS = 'true';
      try {
        expect((await post(`/api/support/anfragen/${a}/antworten`, { text: 'y' })).status).toBe(201);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
      }
      expect(sendMail).toHaveBeenCalledTimes(2);
    });
  });
});
