// backend/tests/utils/mailZuordnung.test.js
//
// Die fuenf Regeln fuer eingehende Mails (utils/mailZuordnung.js;
// docs/planung/support-vorgaenge.md, Entscheidung 2): Faden -> [Vorgang N] ->
// alte Kennungen [Anfrage N] und [Gemeinde N] -> Adresse einer Anfrage ->
// Konto genau einer Gemeinde (NEUER Vorgang) -> Posteingang. Je Regel der Fall,
// in dem sie greift, und der, in dem sie nicht greift -- dann gilt die
// naechste. Das Ergebnis nennt den Vorgang; anfrage_id und organization_id
// folgen ihm (die alten Routen lesen sie an der Mail).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { mailZuordnen, gemeindeDesKontos } = require('../../utils/mailZuordnung');

const POSTEINGANG = { vorgang_id: null, anfrage_id: null, organization_id: null, regel: 5, neuer_vorgang: false };

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
  /** Ein Vorgang; mit anfrageId der der Anfrage (Art neue_gemeinde). */
  const vorgang = async ({ organizationId = null, anfrageId = null, status = 'neu', archiviert = false, tageAlt = 0 } = {}) => {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO support_vorgaenge (art, status, betreff, quelle, organization_id, anfrage_id, archiviert_am, created_at)
       VALUES ($1, $2, 'B', $3, $4, $5, $6, NOW() - ($7::int * interval '1 day')) RETURNING id`,
      [anfrageId ? 'neue_gemeinde' : 'frage', status, anfrageId ? 'anfrage' : 'support', organizationId, anfrageId,
        archiviert || status === 'erledigt' ? new Date() : null, tageAlt]);
    return Number(id);
  };
  const vorgangDerAnfrage = async (a) => Number((await db.query('SELECT id FROM support_vorgaenge WHERE anfrage_id = $1', [a])).rows[0].id);
  /** Eine gespeicherte Mail; die Spalten anfrage_id/organization_id wie sie zum Vorgang gehoeren. */
  const gespeichert = (messageId, { vorgangId = null, anfrageId = null, organizationId = null } = {}) => db.query(
    `INSERT INTO mail_nachrichten (postfach, richtung, vorgang_id, anfrage_id, organization_id, message_id)
     VALUES ('moin', 'ein', $1, $2, $3, $4)`, [vorgangId, anfrageId, organizationId, messageId]);
  const email = (userId, adresse) => db.query('UPDATE users SET email = $2 WHERE id = $1', [userId, adresse]);
  const zuordnen = (mail) => mailZuordnen(db, { postfach: 'moin', ...mail });

  describe('Regel 1: Verweis auf eine gespeicherte Mail', () => {
    it('In-Reply-To nennt eine Mail eines Vorgangs -> derselbe Vorgang (einer Anfrage: mit anfrage_id)', async () => {
      const a = await anfrage();
      const v = await vorgang({ anfrageId: a });
      await gespeichert('<a1@konfi-quest.de>', { vorgangId: v, anfrageId: a });
      expect(await zuordnen({ inReplyTo: '<a1@konfi-quest.de>' }))
        .toEqual({ vorgang_id: v, anfrage_id: a, organization_id: null, regel: 1, neuer_vorgang: false });
    });

    it('References allein genügt; die Gemeinde des Vorgangs wird übernommen', async () => {
      const v = await vorgang({ organizationId: ORGS.andereGemeinde.id });
      await gespeichert('<g1@konfi-quest.de>', { vorgangId: v, organizationId: ORGS.andereGemeinde.id });
      expect(await mailZuordnen(db, { postfach: 'support', referenzen: ['<fremd@x>', '<g1@konfi-quest.de>'] }))
        .toEqual({ vorgang_id: v, anfrage_id: null, organization_id: ORGS.andereGemeinde.id, regel: 1, neuer_vorgang: false });
    });

    it('ein Vorgang ohne Gemeinde: Mail bleibt ohne Gemeinde, aber im Vorgang', async () => {
      const v = await vorgang();
      await gespeichert('<o1@x>', { vorgangId: v });
      expect(await zuordnen({ inReplyTo: '<o1@x>' }))
        .toEqual({ vorgang_id: v, anfrage_id: null, organization_id: null, regel: 1, neuer_vorgang: false });
    });

    it('In-Reply-To vor References, in References die jüngste (letzte)', async () => {
      const v1 = await vorgang();
      const v2 = await vorgang();
      const v3 = await vorgang({ organizationId: ORGS.testGemeinde.id });
      await gespeichert('<alt@x>', { vorgangId: v1 });
      await gespeichert('<jung@x>', { vorgangId: v2 });
      await gespeichert('<eltern@x>', { vorgangId: v3, organizationId: ORGS.testGemeinde.id });
      expect((await zuordnen({ referenzen: ['<alt@x>', '<jung@x>'] })).vorgang_id).toBe(v2);
      expect(await zuordnen({ inReplyTo: '<eltern@x>', referenzen: ['<alt@x>', '<jung@x>'] }))
        .toEqual({ vorgang_id: v3, anfrage_id: null, organization_id: ORGS.testGemeinde.id, regel: 1, neuer_vorgang: false });
    });

    it('verweist sie auf eine Mail im Posteingang, bleibt der Faden im Posteingang -- auch wenn Regel 3 passen würde', async () => {
      await anfrage({ email: 'absender@x.example' });
      await gespeichert('<eingang@x>');
      expect(await zuordnen({ inReplyTo: '<eingang@x>', vonAdresse: 'absender@x.example' }))
        .toEqual({ ...POSTEINGANG, regel: 1 });
    });

    it('eine Mail mit Anfrage, aber ohne Vorgang (älterer Stand): der Vorgang der Anfrage wird nachgeholt', async () => {
      const a = await anfrage();
      await gespeichert('<alt@x>', { anfrageId: a });
      const ergebnis = await zuordnen({ inReplyTo: '<alt@x>' });
      const v = await vorgangDerAnfrage(a);
      expect(ergebnis).toEqual({ vorgang_id: v, anfrage_id: a, organization_id: null, regel: 1, neuer_vorgang: false });
      // genau einer: ein zweiter Aufruf legt keinen zweiten an
      expect((await zuordnen({ inReplyTo: '<alt@x>' })).vorgang_id).toBe(v);
      expect((await db.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge WHERE anfrage_id = $1', [a])).rows[0].n).toBe(1);
    });

    it('eine Mail mit Gemeinde, aber ohne Vorgang (älterer Stand): ein offener Vorgang der Gemeinde, sonst ein neuer „Schriftwechsel“', async () => {
      await gespeichert('<g@x>', { organizationId: ORGS.andereGemeinde.id });
      const ergebnis = await zuordnen({ inReplyTo: '<g@x>' });
      expect(ergebnis).toMatchObject({ anfrage_id: null, organization_id: ORGS.andereGemeinde.id, regel: 1 });
      const { rows: [v] } = await db.query('SELECT art, betreff, quelle, status FROM support_vorgaenge WHERE id = $1', [ergebnis.vorgang_id]);
      expect(v).toEqual({ art: 'sonstiges', betreff: 'Schriftwechsel', quelle: 'mail', status: 'neu' });
    });

    it('greift nicht: Verweis auf eine unbekannte Mail -> nächste Regel', async () => {
      const a = await anfrage({ email: 'absender@x.example' });
      const ergebnis = await zuordnen({ inReplyTo: '<unbekannt@x>', referenzen: ['<auch-nicht@x>'], vonAdresse: 'absender@x.example' });
      expect(ergebnis).toEqual({
        vorgang_id: await vorgangDerAnfrage(a), anfrage_id: a, organization_id: null, regel: 3, neuer_vorgang: false,
      });
    });
  });

  describe('Regel 2: Kennung im Betreff', () => {
    it('[Vorgang N] mit vorhandenem Vorgang -> dieser Vorgang (in beiden Postfächern, ohne Rücksicht auf Groß/klein)', async () => {
      const v = await vorgang({ organizationId: ORGS.testGemeinde.id });
      const erwartet = { vorgang_id: v, anfrage_id: null, organization_id: ORGS.testGemeinde.id, regel: 2, neuer_vorgang: false };
      expect(await zuordnen({ betreff: `Re: Frage zum Kalender [Vorgang ${v}]` })).toEqual(erwartet);
      expect(await mailZuordnen(db, { postfach: 'support', betreff: `AW: [vorgang ${v}]` })).toEqual(erwartet);
    });

    it('[Vorgang N] eines erledigten oder archivierten Vorgangs gilt auch -- die Mail holt ihn später zurück', async () => {
      const v = await vorgang({ status: 'erledigt' });
      expect((await zuordnen({ betreff: `Danke [Vorgang ${v}]` })).vorgang_id).toBe(v);
    });

    it('[Anfrage N] mit vorhandener Anfrage -> der Vorgang der Anfrage (er wird angelegt, wenn er fehlt)', async () => {
      const a = await anfrage();
      const ergebnis = await zuordnen({ betreff: `Re: Eure Anfrage für Büsum [Anfrage ${a}]` });
      expect(ergebnis).toEqual({
        vorgang_id: await vorgangDerAnfrage(a), anfrage_id: a, organization_id: null, regel: 2, neuer_vorgang: false,
      });
    });

    it('[Gemeinde N] -> der JÜNGSTE OFFENE Vorgang der Gemeinde (nicht erledigt, nicht archiviert)', async () => {
      const g = ORGS.andereGemeinde.id;
      const alt = await vorgang({ organizationId: g, tageAlt: 10 });
      const jung = await vorgang({ organizationId: g, tageAlt: 1 });
      await vorgang({ organizationId: g, status: 'erledigt', tageAlt: 0 }); // jüngster, aber erledigt
      await vorgang({ organizationId: g, archiviert: true, tageAlt: 0 }); // archiviert
      await vorgang({ organizationId: ORGS.testGemeinde.id, tageAlt: 0 }); // andere Gemeinde
      const ergebnis = await zuordnen({ betreff: `Re: Konfi Quest – Andere Gemeinde [Gemeinde ${g}]` });
      expect(ergebnis).toEqual({ vorgang_id: jung, anfrage_id: null, organization_id: g, regel: 2, neuer_vorgang: false });
      expect(ergebnis.vorgang_id).not.toBe(alt);
    });

    it('[Gemeinde N] ohne offenen Vorgang -> Posteingang, und die Regeln danach gelten nicht mehr', async () => {
      const g = ORGS.andereGemeinde.id;
      await vorgang({ organizationId: g, status: 'erledigt' });
      await email(USERS.orgAdmin2.id, 'leitung@andere.example');
      // Regel 4 (Konto genau einer Gemeinde) würde einen neuen Vorgang anlegen -- die Kennung geht vor.
      expect(await mailZuordnen(db, { postfach: 'support', betreff: `Re: [Gemeinde ${g}]`, vonAdresse: 'leitung@andere.example' }))
        .toEqual(POSTEINGANG);
    });

    it('beide alten Kennungen: die Anfrage zählt zuerst; [Vorgang N] vor beiden', async () => {
      const a = await anfrage();
      const v = await vorgang({ organizationId: ORGS.testGemeinde.id });
      await vorgang({ organizationId: 1 });
      expect((await zuordnen({ betreff: `[Gemeinde 1] [Anfrage ${a}]` })).anfrage_id).toBe(a);
      expect((await zuordnen({ betreff: `[Gemeinde 1] [Anfrage ${a}] [Vorgang ${v}]` })).vorgang_id).toBe(v);
    });

    it('greift nicht: Vorgang, Anfrage bzw. Gemeinde gibt es nicht -> nächste Regel (Posteingang)', async () => {
      expect(await zuordnen({ betreff: 'Re: [Vorgang 999999]' })).toEqual(POSTEINGANG);
      expect(await zuordnen({ betreff: 'Re: [Anfrage 999999]' })).toEqual(POSTEINGANG);
      expect(await zuordnen({ betreff: 'Re: [Gemeinde 999999]' })).toEqual(POSTEINGANG);
      expect(await zuordnen({ betreff: 'Vorgang 1 ohne Klammern' })).toEqual(POSTEINGANG);
    });
  });

  describe('Regel 3: Postfach moin, Adresse einer Anfrage', () => {
    it('der Vorgang der jüngsten nicht abgelehnten Anfrage mit dieser Adresse (ohne Unterschied Groß/klein und Rand)', async () => {
      await anfrage({ email: 'Erika@Gemeinde.example', tageAlt: 30 });
      const jung = await anfrage({ email: ' erika@gemeinde.example ', tageAlt: 2 });
      await anfrage({ email: 'erika@gemeinde.example', status: 'abgelehnt', tageAlt: 0 });
      expect(await zuordnen({ vonAdresse: 'ERIKA@gemeinde.example' })).toEqual({
        vorgang_id: await vorgangDerAnfrage(jung), anfrage_id: jung, organization_id: null, regel: 3, neuer_vorgang: false,
      });
    });

    it('auch eine angelegte Anfrage zählt (nur abgelehnte nicht)', async () => {
      const a = await anfrage({ email: 'e@x.example', status: 'angelegt' });
      expect((await zuordnen({ vonAdresse: 'e@x.example' })).anfrage_id).toBe(a);
    });

    it('greift nicht: nur abgelehnte Anfragen -> Posteingang', async () => {
      await anfrage({ email: 'e@x.example', status: 'abgelehnt' });
      expect(await zuordnen({ vonAdresse: 'e@x.example' })).toEqual(POSTEINGANG);
    });

    it('greift nicht im Postfach support', async () => {
      await anfrage({ email: 'e@x.example' });
      expect(await mailZuordnen(db, { postfach: 'support', vonAdresse: 'e@x.example' })).toEqual(POSTEINGANG);
    });
  });

  describe('Regel 4: Postfach support, Adresse genau eines aktiven Kontos mit Gemeinde -> neuer Vorgang', () => {
    const support = (vonAdresse) => mailZuordnen(db, { postfach: 'support', vonAdresse });
    const NEU = (g) => ({ vorgang_id: null, anfrage_id: null, organization_id: g, regel: 4, neuer_vorgang: true });

    it('Gemeindeleitung, Leitung und Teamer:in -> ein neuer Vorgang ihrer Gemeinde (angelegt wird er beim Speichern der Mail)', async () => {
      await email(USERS.orgAdmin2.id, 'Leitung@Andere.example');
      await email(USERS.admin1.id, 'admin@test.example');
      await email(USERS.teamer2.id, 'team@andere.example');
      expect(await support('leitung@andere.example')).toEqual(NEU(ORGS.andereGemeinde.id));
      expect((await support('admin@test.example')).organization_id).toBe(ORGS.testGemeinde.id);
      expect((await support('team@andere.example')).organization_id).toBe(ORGS.andereGemeinde.id);
      // Die Zuordnung selbst legt noch nichts an.
      expect((await db.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge')).rows[0].n).toBe(0);
    });

    it('auch wenn die Gemeinde schon offene Vorgänge hat: jede neue Mail ohne Verweis ist ein neuer Vorgang', async () => {
      await email(USERS.orgAdmin2.id, 'leitung@andere.example');
      await vorgang({ organizationId: ORGS.andereGemeinde.id });
      expect(await support('leitung@andere.example')).toEqual(NEU(ORGS.andereGemeinde.id));
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
      expect(await support('zwei@x.example')).toEqual(NEU(ORGS.testGemeinde.id));
    });

    it('greift nicht im Postfach moin', async () => {
      await email(USERS.orgAdmin2.id, 'leitung@andere.example');
      expect((await zuordnen({ vonAdresse: 'leitung@andere.example' })).regel).toBe(5);
    });
  });

  describe('gemeindeDesKontos (Regel 4 und das Formular auf der Homepage)', () => {
    it('die Gemeinde des einen aktiven Kontos (nicht Konfi); beide Quellen der Zugehörigkeit; ohne Groß/klein', async () => {
      await email(USERS.admin2.id, ' Admin@Andere.example ');
      expect(await gemeindeDesKontos(db, 'ADMIN@andere.example')).toBe(ORGS.andereGemeinde.id);
      // Gast-Mitgliedschaft (user_organizations) eines Kontos, dessen Stamm-Gemeinde ein Konfi-Konto hat
      await email(USERS.konfi1.id, 'gast@x.example');
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.konfi1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      expect(await gemeindeDesKontos(db, 'gast@x.example')).toBe(ORGS.andereGemeinde.id);
    });

    it('sonst null: unbekannt, leer, Konfi, zwei Konten, zwei Gemeinden', async () => {
      await email(USERS.konfi3.id, 'konfi@x.example');
      await email(USERS.admin1.id, 'doppelt@x.example');
      await email(USERS.admin2.id, 'doppelt@x.example');
      await email(USERS.teamer1.id, 'zwei@x.example');
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      for (const adresse of ['niemand@x.example', '', '   ', null, undefined, 'konfi@x.example', 'doppelt@x.example', 'zwei@x.example']) {
        expect([adresse, await gemeindeDesKontos(db, adresse)]).toEqual([adresse, null]);
      }
    });
  });

  describe('Regel 5: Posteingang', () => {
    it('ohne Verweis, Kennung und bekannte Adresse', async () => {
      expect(await zuordnen({ vonAdresse: 'fremd@x.example', betreff: 'Hallo' })).toEqual(POSTEINGANG);
      expect(await mailZuordnen(db, { postfach: 'support' })).toEqual(POSTEINGANG);
    });
  });
});
