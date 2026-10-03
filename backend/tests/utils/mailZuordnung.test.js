// backend/tests/utils/mailZuordnung.test.js
//
// Die fuenf Regeln fuer eingehende Mails (utils/mailZuordnung.js;
// docs/planung/support-mail.md). Je Regel der Fall, in dem sie greift, und
// der, in dem sie nicht greift -- dann gilt die naechste.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { mailZuordnen } = require('../../utils/mailZuordnung');

describe('mailZuordnen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  const anfrage = async ({ email = 'anfrage@gemeinde.example', status = 'neu', tageAlt = 0 } = {}) => {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, created_at)
       VALUES ('G', 'K', $1, NOW(), $2, NOW() - ($3::int * interval '1 day')) RETURNING id`, [email, status, tageAlt]);
    return Number(id);
  };
  const gespeichert = (messageId, { anfrageId = null, organizationId = null } = {}) => db.query(
    `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id)
     VALUES ('moin', 'ein', $1, $2, $3)`, [anfrageId, organizationId, messageId]);
  const email = (userId, adresse) => db.query('UPDATE users SET email = $2 WHERE id = $1', [userId, adresse]);
  const zuordnen = (mail) => mailZuordnen(db, { postfach: 'moin', ...mail });

  describe('Regel 1: Verweis auf eine gespeicherte Mail', () => {
    it('In-Reply-To nennt eine Mail der Anfrage -> dieselbe Anfrage', async () => {
      const a = await anfrage();
      await gespeichert('<a1@konfi-quest.de>', { anfrageId: a });
      expect(await zuordnen({ inReplyTo: '<a1@konfi-quest.de>' })).toEqual({ anfrage_id: a, organization_id: null, regel: 1 });
    });

    it('References allein genügt; Gemeinde wird übernommen', async () => {
      await gespeichert('<g1@konfi-quest.de>', { organizationId: ORGS.andereGemeinde.id });
      expect(await mailZuordnen(db, { postfach: 'support', referenzen: ['<fremd@x>', '<g1@konfi-quest.de>'] }))
        .toEqual({ anfrage_id: null, organization_id: ORGS.andereGemeinde.id, regel: 1 });
    });

    it('In-Reply-To vor References, in References die jüngste (letzte)', async () => {
      const a = await anfrage();
      const b = await anfrage({ email: 'b@x.example' });
      await gespeichert('<alt@x>', { anfrageId: a });
      await gespeichert('<jung@x>', { anfrageId: b });
      await gespeichert('<eltern@x>', { organizationId: ORGS.testGemeinde.id });
      expect((await zuordnen({ referenzen: ['<alt@x>', '<jung@x>'] })).anfrage_id).toBe(b);
      expect(await zuordnen({ inReplyTo: '<eltern@x>', referenzen: ['<alt@x>', '<jung@x>'] }))
        .toEqual({ anfrage_id: null, organization_id: ORGS.testGemeinde.id, regel: 1 });
    });

    it('verweist sie auf eine Mail im Posteingang, bleibt der Faden im Posteingang -- auch wenn Regel 3 passen würde', async () => {
      await anfrage({ email: 'absender@x.example' });
      await gespeichert('<eingang@x>');
      expect(await zuordnen({ inReplyTo: '<eingang@x>', vonAdresse: 'absender@x.example' }))
        .toEqual({ anfrage_id: null, organization_id: null, regel: 1 });
    });

    it('greift nicht: Verweis auf eine unbekannte Mail -> nächste Regel', async () => {
      const a = await anfrage({ email: 'absender@x.example' });
      expect(await zuordnen({ inReplyTo: '<unbekannt@x>', referenzen: ['<auch-nicht@x>'], vonAdresse: 'absender@x.example' }))
        .toEqual({ anfrage_id: a, organization_id: null, regel: 3 });
    });
  });

  describe('Regel 2: Kennung im Betreff', () => {
    it('[Anfrage N] mit vorhandener Anfrage -> Anfrage (in beiden Postfächern, ohne Rücksicht auf Groß/klein)', async () => {
      const a = await anfrage();
      expect(await zuordnen({ betreff: `Re: Eure Anfrage für Büsum [Anfrage ${a}]` }))
        .toEqual({ anfrage_id: a, organization_id: null, regel: 2 });
      expect(await mailZuordnen(db, { postfach: 'support', betreff: `AW: [anfrage ${a}]` }))
        .toEqual({ anfrage_id: a, organization_id: null, regel: 2 });
    });

    it('[Gemeinde N] mit vorhandener Gemeinde -> Gemeinde', async () => {
      expect(await zuordnen({ betreff: `Re: Konfi Quest – Andere Gemeinde [Gemeinde ${ORGS.andereGemeinde.id}]` }))
        .toEqual({ anfrage_id: null, organization_id: ORGS.andereGemeinde.id, regel: 2 });
    });

    it('beide Kennungen: die Anfrage zählt zuerst', async () => {
      const a = await anfrage();
      expect((await zuordnen({ betreff: `[Gemeinde 1] [Anfrage ${a}]` })).anfrage_id).toBe(a);
    });

    it('greift nicht: Anfrage bzw. Gemeinde gibt es nicht -> Posteingang', async () => {
      expect(await zuordnen({ betreff: 'Re: [Anfrage 999999]' })).toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
      expect(await zuordnen({ betreff: 'Re: [Gemeinde 999999]' })).toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
      expect(await zuordnen({ betreff: 'Anfrage 1 ohne Klammern' })).toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
    });
  });

  describe('Regel 3: Postfach moin, Adresse einer Anfrage', () => {
    it('die jüngste nicht abgelehnte Anfrage mit dieser Adresse (ohne Unterschied Groß/klein und Rand)', async () => {
      await anfrage({ email: 'Erika@Gemeinde.example', tageAlt: 30 });
      const jung = await anfrage({ email: ' erika@gemeinde.example ', tageAlt: 2 });
      await anfrage({ email: 'erika@gemeinde.example', status: 'abgelehnt', tageAlt: 0 });
      expect(await zuordnen({ vonAdresse: 'ERIKA@gemeinde.example' })).toEqual({ anfrage_id: jung, organization_id: null, regel: 3 });
    });

    it('auch eine angelegte Anfrage zählt (nur abgelehnte nicht)', async () => {
      const a = await anfrage({ email: 'e@x.example', status: 'angelegt' });
      expect((await zuordnen({ vonAdresse: 'e@x.example' })).anfrage_id).toBe(a);
    });

    it('greift nicht: nur abgelehnte Anfragen -> Posteingang', async () => {
      await anfrage({ email: 'e@x.example', status: 'abgelehnt' });
      expect(await zuordnen({ vonAdresse: 'e@x.example' })).toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
    });

    it('greift nicht im Postfach support', async () => {
      await anfrage({ email: 'e@x.example' });
      expect(await mailZuordnen(db, { postfach: 'support', vonAdresse: 'e@x.example' }))
        .toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
    });
  });

  describe('Regel 4: Postfach support, Adresse genau eines aktiven Kontos mit Gemeinde', () => {
    const support = (vonAdresse) => mailZuordnen(db, { postfach: 'support', vonAdresse });

    it('Gemeindeleitung, Leitung und Teamer:in -> ihre Gemeinde', async () => {
      await email(USERS.orgAdmin2.id, 'Leitung@Andere.example');
      await email(USERS.admin1.id, 'admin@test.example');
      await email(USERS.teamer2.id, 'team@andere.example');
      expect(await support('leitung@andere.example')).toEqual({ anfrage_id: null, organization_id: ORGS.andereGemeinde.id, regel: 4 });
      expect((await support('admin@test.example')).organization_id).toBe(ORGS.testGemeinde.id);
      expect((await support('team@andere.example')).organization_id).toBe(ORGS.andereGemeinde.id);
    });

    it('greift nicht: Konfi-Konto', async () => {
      await email(USERS.konfi3.id, 'konfi@x.example');
      expect((await support('konfi@x.example')).regel).toBe(5);
    });

    it('greift nicht: gesperrtes oder gelöschtes Konto', async () => {
      await email(USERS.admin2.id, 'gesperrt@x.example');
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin2.id]);
      await email(USERS.teamer1.id, 'geloescht@x.example');
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.teamer1.id]);
      expect((await support('gesperrt@x.example')).regel).toBe(5);
      expect((await support('geloescht@x.example')).regel).toBe(5);
    });

    it('greift nicht: dieselbe Adresse an zwei Konten', async () => {
      await email(USERS.admin1.id, 'doppelt@x.example');
      await email(USERS.admin2.id, 'doppelt@x.example');
      expect((await support('doppelt@x.example')).regel).toBe(5);
    });

    it('greift nicht: ein Konto in zwei Gemeinden (nicht eindeutig); erlaubt, wenn die zweite Rolle Konfi ist', async () => {
      await email(USERS.admin1.id, 'zwei@x.example');
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.admin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      expect((await support('zwei@x.example')).regel).toBe(5);
      await db.query('UPDATE user_organizations SET role_id = $2 WHERE user_id = $1', [USERS.admin1.id, ROLES.konfi2.id]);
      expect(await support('zwei@x.example')).toEqual({ anfrage_id: null, organization_id: ORGS.testGemeinde.id, regel: 4 });
    });

    it('greift nicht im Postfach moin', async () => {
      await email(USERS.orgAdmin2.id, 'leitung@andere.example');
      expect((await zuordnen({ vonAdresse: 'leitung@andere.example' })).regel).toBe(5);
    });
  });

  describe('Regel 5: Posteingang', () => {
    it('ohne Verweis, Kennung und bekannte Adresse', async () => {
      expect(await zuordnen({ vonAdresse: 'fremd@x.example', betreff: 'Hallo' }))
        .toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
      expect(await mailZuordnen(db, { postfach: 'support' })).toEqual({ anfrage_id: null, organization_id: null, regel: 5 });
    });
  });
});
