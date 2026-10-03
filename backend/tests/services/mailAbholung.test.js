// backend/tests/services/mailAbholung.test.js
//
// Abholen der Postfaecher "moin" und "support" (services/mailAbholung.js;
// docs/planung/support-mail.md, Abschnitt "Abholen"). Ohne Netz: der
// IMAP-Client ist eine Attrappe (tests/helpers/imapAttrappe.js).
//
// Geprueft: Der erste Lauf uebernimmt nichts und setzt nur den Stand; danach
// kommen neue Mails dazu (Felder, Zuordnung, Bewegung der Anfrage);
// Dubletten (gleiche Message-ID, auch ueber beide Postfaecher), eigene
// Mails und Mails ohne Message-ID (stabile Ersatz-ID); Wechsel der
// UIDVALIDITY; Fehler landen in mail_abholstand und im Protokoll -- ohne
// Adressen und Inhalte; INBOX wird nur lesend geoeffnet und nichts am
// Postfach geaendert; ein Server mit RUN_BACKGROUND_JOBS=false holt nie ab.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { imapAttrappe, rohmail } = require('../helpers/imapAttrappe');
const { postfachAbholen, alleAbholen, fehlerText } = require('../../services/mailAbholung');
const { postfachKonfig } = require('../../utils/mailPostfaecher');

const ENV = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim-moin',
  MAIL_SUPPORT_USER: 'support-benutzer',
  MAIL_SUPPORT_PASS: 'geheim-support',
});

describe('Mail-Abholung', () => {
  let db;
  const MOIN = postfachKonfig('moin', ENV);
  const SUPPORT = postfachKonfig('support', ENV);

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  const abholen = (attrappe, konfig = MOIN, opt = {}) =>
    postfachAbholen(db, konfig, { imapFabrik: attrappe.fabrik, env: ENV, ...opt });
  const stand = async (postfach = 'moin') =>
    (await db.query('SELECT uidvalidity, letzte_uid, abgeholt_am, fehler, fehler_am FROM mail_abholstand WHERE postfach = $1', [postfach])).rows[0];
  const mails = async () => (await db.query(
    `SELECT postfach, richtung, anfrage_id, organization_id, message_id, in_reply_to, referenzen, von_adresse, von_name,
            an_adressen, betreff, text, anhaenge, gesendet_am, gelesen_am, imap_uid
       FROM mail_nachrichten ORDER BY id`)).rows;

  /** Postfach mit drei alten Mails (UID 1 bis 3), schon abgeholt bis 3. */
  async function eingerichtet(uidValidity = 7n) {
    const attrappe = imapAttrappe({ uidValidity });
    for (const uid of [1, 2, 3]) attrappe.einwerfen(uid, await rohmail({ betreff: `Alt ${uid}`, messageId: `<alt-${uid}@gemeinde.example>` }));
    const erst = await abholen(attrappe);
    expect(erst).toMatchObject({ erstlauf: true, neu: 0 });
    return attrappe;
  }

  describe('erster Lauf', () => {
    it('übernimmt keinen Altbestand und setzt nur den Stand (UIDVALIDITY, letzte UID)', async () => {
      const attrappe = imapAttrappe({ uidValidity: 4242n });
      for (const uid of [3, 8, 15]) attrappe.einwerfen(uid, await rohmail({ messageId: `<alt-${uid}@x.example>` }));
      const ergebnis = await abholen(attrappe);
      expect(ergebnis).toEqual({ postfach: 'moin', erstlauf: true, neu: 0, doppelt: 0, eigene: 0, unlesbar: 0, fehler: null });
      expect(await mails()).toEqual([]);
      expect(await stand()).toMatchObject({ uidvalidity: 4242, letzte_uid: 15, fehler: null, fehler_am: null });
      // Kein Quelltext geholt.
      expect(attrappe.namen()).toEqual(['connect', 'mailboxOpen', 'logout']);
    });

    it('ohne UIDNEXT vom Server gilt die höchste vorhandene UID', async () => {
      const attrappe = imapAttrappe({ uidValidity: 5n, ohneUidNext: true });
      for (const uid of [2, 9]) attrappe.einwerfen(uid, await rohmail({ messageId: `<a-${uid}@x.example>` }));
      await abholen(attrappe);
      expect((await stand()).letzte_uid).toBe(9);
      expect(await mails()).toEqual([]);
    });
  });

  describe('danach', () => {
    it('neue Mails kommen mit allen Feldern dazu; der Stand rückt vor', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(4, await rohmail({
        von: 'Erika Probe <Erika.Probe@Gemeinde.example>',
        an: ['moin@konfi-quest.de', 'Team <team@konfi-quest.de>'],
        betreff: 'Frage zur Testphase',
        text: 'Hallo,\nwie lange läuft die Testphase?\n\n> altes Zitat',
        messageId: '<neu-4@gemeinde.example>',
        references: ['<x1@a.example>', '<x2@a.example>'],
        inReplyTo: '<x2@a.example>',
        datum: new Date('2026-10-02T09:30:00Z'),
        anhaenge: [{ filename: 'Plan.pdf', content: Buffer.alloc(1234, 1), contentType: 'application/pdf' }],
      }), new Date('2026-10-02T09:31:00Z'));

      const ergebnis = await abholen(attrappe);
      expect(ergebnis).toEqual({ postfach: 'moin', erstlauf: false, neu: 1, doppelt: 0, eigene: 0, unlesbar: 0, fehler: null });
      const [m] = await mails();
      expect(m).toEqual({
        postfach: 'moin',
        richtung: 'ein',
        anfrage_id: null,
        organization_id: null,
        message_id: '<neu-4@gemeinde.example>',
        in_reply_to: '<x2@a.example>',
        referenzen: ['<x1@a.example>', '<x2@a.example>'],
        von_adresse: 'erika.probe@gemeinde.example',
        von_name: 'Erika Probe',
        an_adressen: ['moin@konfi-quest.de', 'team@konfi-quest.de'],
        betreff: 'Frage zur Testphase',
        text: 'Hallo,\nwie lange läuft die Testphase?\n\n> altes Zitat',
        anhaenge: [{ name: 'Plan.pdf', groesse: 1234, typ: 'application/pdf' }],
        gesendet_am: new Date('2026-10-02T09:30:00Z'),
        gelesen_am: null,
        imap_uid: 4,
      });
      expect(await stand()).toMatchObject({ uidvalidity: 7, letzte_uid: 4, fehler: null });
    });

    it('holt nur UIDs über dem Stand (Bereich ab letzte_uid + 1)', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(5, await rohmail({ messageId: '<n5@x.example>' }));
      await abholen(attrappe);
      const fetch = attrappe.aufrufe.filter((a) => a[0] === 'fetch').pop();
      expect(fetch[1]).toBe('4:5');
      expect(fetch[2]).toEqual({ uid: true, source: true, internalDate: true });
      expect(fetch[3]).toEqual({ uid: true });
      expect((await mails()).map((m) => m.message_id)).toEqual(['<n5@x.example>']);
    });

    it('nichts Neues: kein fetch, Stand bleibt, abgeholt_am wird gesetzt', async () => {
      const attrappe = await eingerichtet();
      await db.query("UPDATE mail_abholstand SET abgeholt_am = NOW() - interval '1 hour'");
      const ergebnis = await abholen(attrappe);
      expect(ergebnis.neu).toBe(0);
      expect(attrappe.namen().filter((n) => n === 'fetch')).toEqual([]);
      const s = await stand();
      expect(s.letzte_uid).toBe(3);
      expect(Date.now() - s.abgeholt_am.getTime()).toBeLessThan(60 * 1000);
    });

    it('höchstens maxJeLauf UIDs je Lauf, der Rest im nächsten', async () => {
      const attrappe = await eingerichtet();
      for (const uid of [4, 5, 6, 7, 8]) attrappe.einwerfen(uid, await rohmail({ messageId: `<m${uid}@x.example>` }));
      expect((await abholen(attrappe, MOIN, { maxJeLauf: 2 })).neu).toBe(2);
      expect((await stand()).letzte_uid).toBe(5);
      expect((await abholen(attrappe, MOIN, { maxJeLauf: 2 })).neu).toBe(2);
      expect((await abholen(attrappe, MOIN, { maxJeLauf: 2 })).neu).toBe(1);
      expect((await mails()).map((m) => m.imap_uid)).toEqual([4, 5, 6, 7, 8]);
      expect((await stand()).letzte_uid).toBe(8);
    });

    it('eine Lücke im Fenster zählt mit -- der Stand bleibt nicht hängen', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(40, await rohmail({ messageId: '<m40@x.example>' }));
      await abholen(attrappe, MOIN, { maxJeLauf: 10 });
      expect((await stand()).letzte_uid).toBe(13);
      await abholen(attrappe, MOIN, { maxJeLauf: 10 });
      await abholen(attrappe, MOIN, { maxJeLauf: 10 });
      await abholen(attrappe, MOIN, { maxJeLauf: 10 });
      expect((await stand()).letzte_uid).toBe(40);
      expect((await mails()).map((m) => m.imap_uid)).toEqual([40]);
    });

    it('nur HTML: der Text entsteht aus dem HTML; Text über 50.000 Zeichen wird gekürzt', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(4, await rohmail({ messageId: '<html@x.example>', html: '<p>Hallo <b>ihr</b>!</p><p>Zweiter Absatz</p>' }));
      attrappe.einwerfen(5, await rohmail({ messageId: '<lang@x.example>', text: 'a'.repeat(60000) }));
      await abholen(attrappe);
      const [html, lang] = await mails();
      expect(html.text).toBe('Hallo ihr!\n\nZweiter Absatz');
      expect(lang.text.length).toBe(50000);
    });
  });

  describe('Zuordnung beim Abholen', () => {
    it('Antwort auf die Bestätigungsmail einer Anfrage landet in moin@ und geht über Regel 3 zur Anfrage; die Anfrage gilt als bewegt', async () => {
      const { rows: [{ id: anfrageId }] } = await db.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, updated_at)
         VALUES ('Büsum', 'Erika', 'Erika.Probe@gemeinde.example', NOW(), NOW() - interval '300 days') RETURNING id`);
      const attrappe = await eingerichtet();
      attrappe.einwerfen(4, await rohmail({
        von: 'erika.probe@gemeinde.example',
        betreff: 'Re: Eure Anfrage bei Konfi Quest',
        // Die Bestaetigung ist nicht gespeichert: Regel 1 greift nicht.
        inReplyTo: '<bestaetigung-1@konfi-quest.de>',
        messageId: '<antwort-auf-bestaetigung@gemeinde.example>',
      }));
      await abholen(attrappe);
      const [m] = await mails();
      expect([m.anfrage_id, m.organization_id]).toEqual([anfrageId, null]);
      const { rows: [a] } = await db.query('SELECT updated_at FROM gemeinde_anfragen WHERE id = $1', [anfrageId]);
      expect(Date.now() - a.updated_at.getTime()).toBeLessThan(60 * 1000);
    });

    it('Gegenprobe: dieselbe Mail im Postfach "support" bleibt im Posteingang (Regel 3 gilt nur für moin)', async () => {
      await db.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am)
         VALUES ('Büsum', 'Erika', 'erika.probe@gemeinde.example', NOW())`);
      const attrappe = await eingerichtet();
      await abholen(attrappe, SUPPORT); // erster Lauf fuer support
      attrappe.einwerfen(4, await rohmail({ von: 'erika.probe@gemeinde.example', messageId: '<s4@gemeinde.example>' }));
      await abholen(attrappe, SUPPORT);
      const [m] = await mails();
      expect([m.postfach, m.anfrage_id, m.organization_id]).toEqual(['support', null, null]);
    });
  });

  describe('Dubletten, eigene Mails, ohne Message-ID', () => {
    it('dieselbe Message-ID zweimal (auch über beide Postfächer) wird einmal gespeichert', async () => {
      const attrappe = await eingerichtet();
      const quelle = await rohmail({ messageId: '<doppelt@gemeinde.example>', an: 'moin@konfi-quest.de, support@konfi-quest.de' });
      attrappe.einwerfen(4, quelle);
      attrappe.einwerfen(5, quelle);
      expect(await abholen(attrappe)).toMatchObject({ neu: 1, doppelt: 1 });
      await abholen(attrappe, SUPPORT); // erster Lauf: nur Stand
      attrappe.einwerfen(6, quelle);
      expect(await abholen(attrappe, SUPPORT)).toMatchObject({ neu: 0, doppelt: 1 });
      expect((await mails()).map((m) => [m.postfach, m.message_id])).toEqual([['moin', '<doppelt@gemeinde.example>']]);
      expect((await stand('moin')).letzte_uid).toBe(5);
      expect((await stand('support')).letzte_uid).toBe(6);
    });

    it('eigene Mails (Absender = Adresse des Postfachs) werden übersprungen, der Stand rückt trotzdem vor', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(4, await rohmail({ von: 'Konfi Quest <MOIN@konfi-quest.de>', messageId: '<eigen@konfi-quest.de>' }));
      attrappe.einwerfen(5, await rohmail({ von: 'support@konfi-quest.de', messageId: '<von-support@konfi-quest.de>' }));
      expect(await abholen(attrappe)).toMatchObject({ neu: 1, eigene: 1 });
      // Gegenprobe: die Mail von support@ ist fuer moin@ keine eigene.
      expect((await mails()).map((m) => m.message_id)).toEqual(['<von-support@konfi-quest.de>']);
      expect((await stand()).letzte_uid).toBe(5);
    });

    it('ohne Message-ID: stabile Ersatz-ID aus Postfach, UIDVALIDITY und UID -- ein zweiter Abruf speichert sie nicht doppelt', async () => {
      const attrappe = await eingerichtet(99n);
      attrappe.einwerfen(4, await rohmail({ ohneMessageId: true, betreff: 'Ohne Kennung' }));
      await abholen(attrappe);
      expect((await mails()).map((m) => m.message_id)).toEqual(['<kq-ersatz-moin-99-4@konfi-quest.de>']);
      await db.query('UPDATE mail_abholstand SET letzte_uid = 3');
      expect(await abholen(attrappe)).toMatchObject({ neu: 0, doppelt: 1 });
      expect((await mails()).length).toBe(1);
    });
  });

  describe('UIDVALIDITY wechselt', () => {
    it('setzt den Stand neu und übernimmt nichts', async () => {
      const attrappe = await eingerichtet(7n);
      attrappe.zustand.uidValidity = 8n;
      attrappe.zustand.nachrichten = [];
      for (const uid of [1, 2]) attrappe.einwerfen(uid, await rohmail({ messageId: `<neu-validity-${uid}@x.example>` }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(await abholen(attrappe)).toMatchObject({ erstlauf: true, neu: 0 });
        expect(warn.mock.calls).toEqual([['Mail-Abholung (moin): UIDVALIDITY hat gewechselt -- Stand neu gesetzt, nichts uebernommen']]);
      } finally {
        warn.mockRestore();
      }
      expect(await mails()).toEqual([]);
      expect(await stand()).toMatchObject({ uidvalidity: 8, letzte_uid: 2 });
      // Danach geht es normal weiter.
      attrappe.einwerfen(3, await rohmail({ messageId: '<danach@x.example>' }));
      expect(await abholen(attrappe)).toMatchObject({ neu: 1 });
    });
  });

  describe('Fehler', () => {
    const anmeldeFehler = () => Object.assign(new Error('Command failed'), {
      authenticationFailed: true, responseText: 'Authentication failed for moin-benutzer@konfi-quest.de',
    });

    it('landet in mail_abholstand und einmal im Protokoll -- ohne Adressen; ein Erfolg danach räumt ihn weg', async () => {
      const attrappe = await eingerichtet();
      attrappe.zustand.verbindungsFehler = anmeldeFehler();
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect((await abholen(attrappe)).fehler).toBe('Anmeldung gescheitert (Benutzer oder Passwort falsch)');
        await abholen(attrappe); // derselbe Fehler: nicht noch einmal protokolliert
        expect(fehler.mock.calls).toEqual([['Mail-Abholung (moin) gescheitert: Anmeldung gescheitert (Benutzer oder Passwort falsch)']]);
      } finally {
        fehler.mockRestore();
      }
      const s = await stand();
      expect(s.fehler).toBe('Anmeldung gescheitert (Benutzer oder Passwort falsch)');
      expect(Date.now() - s.fehler_am.getTime()).toBeLessThan(60 * 1000);
      expect(s.letzte_uid).toBe(3);

      attrappe.zustand.verbindungsFehler = null;
      await abholen(attrappe);
      expect(await stand()).toMatchObject({ fehler: null, fehler_am: null, letzte_uid: 3 });
    });

    it('auch ohne vorherigen Stand (erster Lauf scheitert) steht der Fehler da', async () => {
      const attrappe = imapAttrappe({ verbindungsFehler: Object.assign(new Error('getaddrinfo ENOTFOUND imap.example.test'), { code: 'ENOTFOUND' }) });
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await abholen(attrappe);
      } finally {
        fehler.mockRestore();
      }
      expect(await stand()).toMatchObject({ uidvalidity: null, letzte_uid: null, fehler: 'Verbindung gescheitert (ENOTFOUND)' });
    });

    it('fehlerText kürzt Adressen in Meldungen des Servers auf die Domain', () => {
      const text = fehlerText(Object.assign(new Error('x'), { code: 'NoConnection', responseText: 'Mailbox voll: anna.m@gemeinde.example' }));
      expect(text).toBe('NoConnection: Mailbox voll: ***@gemeinde.example');
    });

    it('das Protokoll eines erfolgreichen Laufs nennt nur Anzahlen -- keine Adressen, keine Betreffzeilen', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(4, await rohmail({ von: 'geheim@person.example', betreff: 'Vertraulicher Betreff', messageId: '<p4@x.example>' }));
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await abholen(attrappe);
        expect(log.mock.calls).toEqual([['Mail-Abholung (moin): 1 neu, 0 schon vorhanden, 0 eigene, 0 nicht lesbar']]);
      } finally {
        log.mockRestore();
      }
    });
  });

  describe('nur lesen', () => {
    it('INBOX schreibgeschützt geöffnet, nichts am Postfach geändert, die Verbindung beendet', async () => {
      const attrappe = await eingerichtet();
      attrappe.einwerfen(4, await rohmail({ messageId: '<r4@x.example>' }));
      await abholen(attrappe);
      const geoeffnet = attrappe.aufrufe.filter((a) => a[0] === 'mailboxOpen');
      expect(geoeffnet).toEqual([['mailboxOpen', 'INBOX', { readOnly: true }], ['mailboxOpen', 'INBOX', { readOnly: true }]]);
      expect(attrappe.aenderungen).toEqual([]);
      expect(attrappe.namen().filter((n) => n === 'append' || n === 'mailboxCreate')).toEqual([]);
      expect(attrappe.namen().filter((n) => n === 'logout').length).toBe(2);
    });

    it('die Optionen des Clients: TLS mit Zertifikatsprüfung, Anmeldung des Postfachs, kein Protokoll der Bibliothek', async () => {
      const attrappe = imapAttrappe();
      await abholen(attrappe);
      expect(attrappe.optionen[0]).toMatchObject({
        host: 'imap.example.test', port: 993, secure: true,
        auth: { user: 'moin-benutzer', pass: 'geheim-moin' },
        tls: { rejectUnauthorized: true }, logger: false,
      });
    });
  });

  describe('alleAbholen', () => {
    it('nur eingerichtete Postfächer, nacheinander', async () => {
      const attrappe = imapAttrappe();
      const env = { MAIL_IMAP_HOST: 'imap.example.test', MAIL_SUPPORT_USER: 's', MAIL_SUPPORT_PASS: 'p' };
      const ergebnisse = await alleAbholen(db, { env, imapFabrik: attrappe.fabrik });
      expect(ergebnisse.map((e) => e.postfach)).toEqual(['support']);
      expect(attrappe.optionen.map((o) => o.auth.user)).toEqual(['s']);
    });

    it('RUN_BACKGROUND_JOBS=false (backend-test): holt nie ab, kein Client entsteht', async () => {
      const attrappe = imapAttrappe();
      expect(await alleAbholen(db, { env: { ...ENV, RUN_BACKGROUND_JOBS: 'false' }, imapFabrik: attrappe.fabrik })).toEqual([]);
      expect(attrappe.optionen).toEqual([]);
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_abholstand')).rows[0].n).toBe(0);
    });

    it('Gegenprobe: mit RUN_BACKGROUND_JOBS=true holt er beide ab', async () => {
      const attrappe = imapAttrappe();
      const ergebnisse = await alleAbholen(db, { env: { ...ENV, RUN_BACKGROUND_JOBS: 'true' }, imapFabrik: attrappe.fabrik });
      expect(ergebnisse.map((e) => e.postfach)).toEqual(['moin', 'support']);
    });
  });
});
