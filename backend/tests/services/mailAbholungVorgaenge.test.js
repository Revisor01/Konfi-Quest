// backend/tests/services/mailAbholungVorgaenge.test.js
//
// Abholen und Zuordnen mit Vorgaengen (services/mailAbholung.js,
// utils/mailZuordnung.js, utils/supportVorgaenge.js; docs/planung/
// support-vorgaenge.md, Entscheidungen 2 und 6). Ohne Netz: der IMAP-Client
// ist eine Attrappe (tests/helpers/imapAttrappe.js).
//
// Geprueft: jede Regel der Zuordnung am Ende des Weges -- die Mail liegt im
// Vorgang (vorgang_id; anfrage_id/organization_id folgen ihm), ein Konto
// genau einer Gemeinde legt einen NEUEN Vorgang an (nur wenn die Mail neu ist),
// eine neue Mail holt einen archivierten Vorgang zurueck (In Arbeit, ungelesen)
// und zaehlt als Bewegung der Anfrage, der Posteingang bleibt Posteingang,
// und Mails ohne Vorgang aus einem Stand vor Migration 195 werden vor dem
// Abholen nachgezogen.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { imapAttrappe, rohmail } = require('../helpers/imapAttrappe');
const { postfachAbholen, alleAbholen } = require('../../services/mailAbholung');
const { postfachKonfig } = require('../../utils/mailPostfaecher');
const { verwaisteMailsNachziehen } = require('../../utils/supportVorgaenge');
const { vorgaengeDaten } = require('../helpers/vorgaengeDaten');

const ENV = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim-moin',
  MAIL_SUPPORT_USER: 'support-benutzer',
  MAIL_SUPPORT_PASS: 'geheim-support',
});

describe('Mail-Abholung mit Vorgängen', () => {
  let db;
  let d;
  const MOIN = postfachKonfig('moin', ENV);
  const SUPPORT = postfachKonfig('support', ENV);

  beforeAll(() => { db = getTestPool(); d = vorgaengeDaten(db); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  /** Postfach, das schon bis UID 1 abgeholt ist; weitere Mails ab UID 2. */
  async function eingerichtet(konfig = SUPPORT) {
    const attrappe = imapAttrappe({ uidValidity: 7n });
    attrappe.einwerfen(1, await rohmail({ messageId: '<alt@x.example>' }));
    await postfachAbholen(db, konfig, { imapFabrik: attrappe.fabrik, env: ENV });
    return attrappe;
  }
  let uid = 1;
  const einwerfen = async (attrappe, felder) => {
    uid += 1;
    attrappe.einwerfen(uid, await rohmail({ messageId: `<m${uid}@gemeinde.example>`, ...felder }));
    return uid;
  };
  const abholen = (attrappe, konfig = SUPPORT) => postfachAbholen(db, konfig, { imapFabrik: attrappe.fabrik, env: ENV });
  const mails = async () => (await db.query(
    `SELECT message_id, vorgang_id, anfrage_id, organization_id, gelesen_am FROM mail_nachrichten ORDER BY id`)).rows;
  const vorgaenge = async () => (await db.query('SELECT * FROM support_vorgaenge ORDER BY id')).rows;
  const konto = (userId, adresse) => db.query('UPDATE users SET email = $2 WHERE id = $1', [userId, adresse]);

  beforeEach(() => { uid = 1; });

  describe('Regel 4: Konto genau einer Gemeinde -> neuer Vorgang', () => {
    it('support@: die Mail eines Kontos legt einen Vorgang seiner Gemeinde an (Art sonstiges, Quelle mail, Status neu, Betreff ohne Re:)', async () => {
      await konto(USERS.orgAdmin2.id, 'Leitung@Andere.example');
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'Leitung <leitung@andere.example>', an: 'support@konfi-quest.de', betreff: 'AW: Re: Kalender zeigt falsche Woche' });
      const ergebnis = await abholen(attrappe);
      expect(ergebnis).toMatchObject({ neu: 1, doppelt: 0 });
      const [v] = await vorgaenge();
      expect(v).toMatchObject({
        art: 'sonstiges', bereich: null, dringlichkeit: 'normal', status: 'neu', betreff: 'Kalender zeigt falsche Woche', quelle: 'mail',
        organization_id: ORGS.andereGemeinde.id, anfrage_id: null, erstellt_von: null, archiviert_am: null,
      });
      expect(await mails()).toEqual([{
        message_id: '<m2@gemeinde.example>', vorgang_id: v.id, anfrage_id: null, organization_id: ORGS.andereGemeinde.id, gelesen_am: null,
      }]);
    });

    it('jede weitere Mail ohne Verweis ist ein weiterer Vorgang; mit Verweis (In-Reply-To oder [Vorgang N]) bleibt sie im ersten', async () => {
      await konto(USERS.orgAdmin2.id, 'leitung@andere.example');
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'leitung@andere.example', betreff: 'Erste Frage' });
      await einwerfen(attrappe, { von: 'leitung@andere.example', betreff: 'Zweite Frage' });
      await abholen(attrappe);
      const [erster, zweiter] = await vorgaenge();
      expect([erster.betreff, zweiter.betreff]).toEqual(['Erste Frage', 'Zweite Frage']);

      await einwerfen(attrappe, { von: 'leitung@andere.example', betreff: 'Re: Erste Frage', inReplyTo: '<m2@gemeinde.example>', references: ['<m2@gemeinde.example>'] });
      await einwerfen(attrappe, { von: 'leitung@andere.example', betreff: `Nachtrag [Vorgang ${zweiter.id}]` });
      await abholen(attrappe);
      expect(await vorgaenge()).toHaveLength(2);
      expect((await mails()).map((m) => m.vorgang_id)).toEqual([erster.id, zweiter.id, erster.id, zweiter.id]);
    });

    it('dieselbe Mail zweimal (gleiche Message-ID, auch im anderen Postfach) legt keinen zweiten Vorgang an', async () => {
      await konto(USERS.orgAdmin2.id, 'leitung@andere.example');
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'leitung@andere.example', messageId: '<doppelt@gemeinde.example>' });
      await abholen(attrappe);
      const zweites = await eingerichtet(MOIN);
      uid = 1;
      zweites.einwerfen(2, await rohmail({ von: 'leitung@andere.example', messageId: '<doppelt@gemeinde.example>' }));
      const ergebnis = await abholen(zweites, MOIN);
      expect(ergebnis).toMatchObject({ neu: 0, doppelt: 1 });
      expect(await vorgaenge()).toHaveLength(1);
      expect(await mails()).toHaveLength(1);
    });

    it('greift nicht: Konfi, zwei Konten mit der Adresse, im Postfach moin -- die Mail liegt im Posteingang, kein Vorgang entsteht', async () => {
      await konto(USERS.konfi3.id, 'konfi@x.example');
      await konto(USERS.admin1.id, 'doppelt@x.example');
      await konto(USERS.admin2.id, 'doppelt@x.example');
      await konto(USERS.teamer2.id, 'team@andere.example');
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'konfi@x.example' });
      await einwerfen(attrappe, { von: 'doppelt@x.example' });
      await einwerfen(attrappe, { von: 'unbekannt@x.example' });
      await abholen(attrappe);
      const moin = await eingerichtet(MOIN);
      uid = 1;
      moin.einwerfen(2, await rohmail({ von: 'team@andere.example', messageId: '<moin2@x.example>' }));
      await abholen(moin, MOIN);
      expect(await vorgaenge()).toEqual([]);
      expect((await mails()).map((m) => [m.vorgang_id, m.anfrage_id, m.organization_id])).toEqual([[null, null, null], [null, null, null], [null, null, null], [null, null, null]]);
    });
  });

  describe('Regeln 1 bis 3: bestehender Vorgang', () => {
    it('Faden: die Antwort auf eine Mail des Vorgangs bleibt in ihm -- auch auf die Bestätigung, die wir gesendet haben', async () => {
      const v = await d.vorgang({ quelle: 'formular', organization_id: 2, kontakt_email: 'erika@andere.example' });
      await d.mail({ vorgang_id: v, richtung: 'aus', message_id: '<kq-bestaetigung@konfi-quest.de>', postfach: 'support' });
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'erika@andere.example', betreff: 'Danke', inReplyTo: '<kq-bestaetigung@konfi-quest.de>', references: ['<kq-bestaetigung@konfi-quest.de>'] });
      await abholen(attrappe);
      const [, neu] = await mails();
      expect(neu).toMatchObject({ vorgang_id: v, organization_id: 2, anfrage_id: null });
      expect(await vorgaenge()).toHaveLength(1);
    });

    it('Kennung [Vorgang N] im Betreff (ohne Verweis im Kopf)', async () => {
      const v = await d.vorgang({ organization_id: 2 });
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'irgendwer@x.example', betreff: `Re: Euer Anliegen ist angekommen [Vorgang ${v}]` });
      await abholen(attrappe);
      expect((await mails())[0]).toMatchObject({ vorgang_id: v, organization_id: 2 });
    });

    it('alte Kennung [Anfrage N]: der Vorgang der Anfrage (auch wenn er bisher fehlte -- er wird angelegt); anfrage_id an der Mail', async () => {
      const { rows: [{ id: a }] } = await db.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am) VALUES ('G', 'K', 'k@x.example', NOW()) RETURNING id`);
      const attrappe = await eingerichtet(MOIN);
      await einwerfen(attrappe, { von: 'irgendwer@x.example', betreff: `Re: Eure Anfrage [Anfrage ${a}]` });
      await abholen(attrappe, MOIN);
      const [v] = await vorgaenge();
      expect(v).toMatchObject({ art: 'neue_gemeinde', quelle: 'anfrage', anfrage_id: Number(a), status: 'neu' });
      expect((await mails())[0]).toMatchObject({ vorgang_id: v.id, anfrage_id: Number(a), organization_id: null });
    });

    it('alte Kennung [Gemeinde N]: der jüngste offene Vorgang der Gemeinde; gibt es keinen, liegt die Mail im Posteingang (auch von einem Konto der Gemeinde)', async () => {
      await konto(USERS.orgAdmin2.id, 'leitung@andere.example');
      const offen = await d.vorgang({ organization_id: 2 });
      await d.vorgang({ organization_id: 2, status: 'erledigt' });
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'leitung@andere.example', betreff: 'Re: Konfi Quest – Andere Gemeinde [Gemeinde 2]' });
      await abholen(attrappe);
      expect((await mails())[0]).toMatchObject({ vorgang_id: offen, organization_id: 2 });

      await einwerfen(attrappe, { von: 'leitung@andere.example', betreff: 'Nochmal [Gemeinde 2]' });
      await db.query("UPDATE support_vorgaenge SET archiviert_am = NOW(), status = 'erledigt' WHERE id = $1", [offen]);
      const vorher = (await vorgaenge()).length;
      await abholen(attrappe);
      expect((await mails())[1]).toMatchObject({ vorgang_id: null, organization_id: null });
      expect((await vorgaenge()).length).toBe(vorher);
    });

    it('Adresse einer Anfrage im Postfach moin: der Vorgang der jüngsten nicht abgelehnten Anfrage', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ email: 'Probe@Buesum.example' });
      await d.anfrageMitVorgang({ email: 'probe@buesum.example', status: 'abgelehnt', gemeinde: 'Abgelehnt' });
      const attrappe = await eingerichtet(MOIN);
      await einwerfen(attrappe, { von: 'probe@buesum.example', betreff: 'Frage zur Testphase' });
      await abholen(attrappe, MOIN);
      expect((await mails())[0]).toMatchObject({ vorgang_id: vorgang, anfrage_id: anfrage, organization_id: null });
      expect(await vorgaenge()).toHaveLength(2);
    });

    it('Posteingang bleibt Posteingang: ohne Verweis, Kennung und bekannte Adresse entsteht kein Vorgang', async () => {
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'fremd@x.example', betreff: 'Hallo' });
      await abholen(attrappe);
      expect(await vorgaenge()).toEqual([]);
      expect((await mails())[0]).toMatchObject({ vorgang_id: null, anfrage_id: null, organization_id: null });
    });
  });

  describe('eine neue Mail in einem Vorgang', () => {
    it('holt einen archivierten Vorgang zurück: nicht mehr archiviert, Status „In Arbeit“, die Mail ungelesen; ein offener behält seinen Status', async () => {
      const erledigt = await d.vorgang({ status: 'erledigt', status_seit: '2026-09-01T08:00:00Z', organization_id: 2 });
      const archiviert = await d.vorgang({ status: 'wartet', archiviert_am: new Date('2026-09-02T08:00:00Z'), organization_id: 2 });
      const offen = await d.vorgang({ status: 'wartet', organization_id: 2 });
      const attrappe = await eingerichtet();
      await einwerfen(attrappe, { von: 'a@x.example', betreff: `A [Vorgang ${erledigt}]` });
      await einwerfen(attrappe, { von: 'a@x.example', betreff: `B [Vorgang ${archiviert}]` });
      await einwerfen(attrappe, { von: 'a@x.example', betreff: `C [Vorgang ${offen}]` });
      await abholen(attrappe);

      const zeile = async (id) => (await db.query('SELECT status, status_seit, archiviert_am, updated_at FROM support_vorgaenge WHERE id = $1', [id])).rows[0];
      const e = await zeile(erledigt);
      expect([e.status, e.archiviert_am]).toEqual(['in_arbeit', null]);
      expect(Date.now() - e.status_seit.getTime()).toBeLessThan(60 * 1000);
      const a = await zeile(archiviert);
      expect([a.status, a.archiviert_am]).toEqual(['in_arbeit', null]);
      const o = await zeile(offen);
      expect([o.status, o.archiviert_am]).toEqual(['wartet', null]);
      expect(Date.now() - o.updated_at.getTime()).toBeLessThan(60 * 1000);
      expect((await mails()).every((m) => m.gelesen_am === null)).toBe(true);
      // der Support sieht sie wieder: in der Liste „Offen“ und in der roten Zahl
      expect((await db.query("SELECT COUNT(*)::int AS n FROM support_vorgaenge WHERE archiviert_am IS NULL AND status IN ('neu','in_arbeit','wartet')")).rows[0].n).toBe(3);
    });

    it('Vorgang einer Anfrage: die Anfrage zählt es als Bewegung; „abgelehnt“ wird wieder „in Arbeit“, „angelegt“ bleibt angelegt', async () => {
      const abgelehnt = await d.anfrageMitVorgang({ status: 'abgelehnt', email: 'a@x.example' });
      const angelegt = await d.anfrageMitVorgang({ status: 'angelegt', email: 'b@x.example', organization_id: 2, gemeinde: 'Angelegt' });
      const neu = await d.anfrageMitVorgang({ status: 'neu', email: 'c@x.example', gemeinde: 'Neu' });
      await db.query("UPDATE gemeinde_anfragen SET updated_at = NOW() - interval '300 days'");
      const attrappe = await eingerichtet(MOIN);
      for (const p of [abgelehnt, angelegt, neu]) await einwerfen(attrappe, { von: 'x@x.example', betreff: `Hallo [Vorgang ${p.vorgang}]` });
      await abholen(attrappe, MOIN);
      const zeile = async (id) => (await db.query('SELECT status, updated_at FROM gemeinde_anfragen WHERE id = $1', [id])).rows[0];
      expect((await zeile(abgelehnt.anfrage)).status).toBe('in_arbeit');
      expect((await zeile(angelegt.anfrage)).status).toBe('angelegt');
      expect((await zeile(neu.anfrage)).status).toBe('neu');
      for (const p of [abgelehnt, angelegt, neu]) {
        expect(Date.now() - (await zeile(p.anfrage)).updated_at.getTime()).toBeLessThan(60 * 1000);
      }
      const vz = async (id) => (await db.query('SELECT status, archiviert_am FROM support_vorgaenge WHERE id = $1', [id])).rows[0];
      expect(await vz(abgelehnt.vorgang)).toEqual({ status: 'in_arbeit', archiviert_am: null });
      expect(await vz(angelegt.vorgang)).toEqual({ status: 'in_arbeit', archiviert_am: null });
    });
  });

  describe('Nachziehen: Mails ohne Vorgang (Stand vor Migration 195)', () => {
    it('Mails mit Anfrage bekommen deren Vorgang, Mails mit Gemeinde den offenen Vorgang oder einen neuen „Schriftwechsel“; der Posteingang bleibt', async () => {
      const { rows: [{ id: a }] } = await db.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am) VALUES ('G', 'K', 'k@x.example', NOW()) RETURNING id`);
      const offen = await d.vorgang({ organization_id: 1 });
      const m1 = await d.mail({ anfrage_id: Number(a), postfach: 'moin' });
      const m2 = await d.mail({ organization_id: 1 });
      const m3 = await d.mail({ organization_id: 2 }); // ungelesen -> neuer Schriftwechsel mit Status neu
      const m4 = await d.mail({ organization_id: 2, gelesen_am: new Date() });
      const m5 = await d.mail({}); // Posteingang
      expect(await verwaisteMailsNachziehen(db)).toBe(4);
      const [z1, z2, z3, z4, z5] = await Promise.all([m1, m2, m3, m4, m5].map((id) => d.mailZeile(id)));
      const vA = (await db.query('SELECT id FROM support_vorgaenge WHERE anfrage_id = $1', [a])).rows[0].id;
      expect(Number(z1.vorgang_id)).toBe(Number(vA));
      expect(Number(z2.vorgang_id)).toBe(offen);
      expect(z3.vorgang_id).not.toBeNull();
      expect(z4.vorgang_id).toBe(z3.vorgang_id);
      expect(z5.vorgang_id).toBeNull();
      const schriftwechsel = await d.vorgangZeile(z3.vorgang_id);
      expect(schriftwechsel).toMatchObject({ art: 'sonstiges', betreff: 'Schriftwechsel', quelle: 'mail', organization_id: 2, status: 'neu' });
      // ein zweiter Aufruf findet nichts mehr
      expect(await verwaisteMailsNachziehen(db)).toBe(0);
    });

    it('läuft vor jedem Abholen (alleAbholen), nicht auf einer Instanz ohne Jobs', async () => {
      const m = await d.mail({ organization_id: 2 });
      const attrappe = imapAttrappe();
      await alleAbholen(db, { env: { ...ENV, RUN_BACKGROUND_JOBS: 'false' }, imapFabrik: attrappe.fabrik });
      expect((await d.mailZeile(m)).vorgang_id).toBeNull();
      await alleAbholen(db, { env: ENV, imapFabrik: attrappe.fabrik });
      expect((await d.mailZeile(m)).vorgang_id).not.toBeNull();
    });
  });
});
