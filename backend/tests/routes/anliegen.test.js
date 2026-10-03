// POST /api/anliegen -- das Support-Formular auf konfi-quest.de (03.10.2026;
// docs/planung/support-vorgaenge.md, Entscheidung 4).
//
// Oeffentlich, ohne Anmeldung, gebaut wie das Anfrageformular
// (tests/routes/anfragen.test.js). Geprueft wird je der erlaubte und der
// verbotene Fall: Pflichtfelder, Auswahlfelder, Laengen, Einwilligung,
// Honigtopf, die Grenzen je Client-Adresse und je E-Mail-Adresse (dieselben
// wie beim Anfrageformular, aber eigene Zaehler), was gespeichert wird, die
// Zuordnung ueber die E-Mail-Adresse eines Kontos (beide Quellen der
// Zugehoerigkeit), die Bestaetigung vom Postfach support@ mit [Vorgang N] und
// festem Text, kein Versand auf backend-test (RUN_BACKGROUND_JOBS=false) und
// ein Protokoll ohne Daten aus dem Formular.
//
// Kein Mailserver: nodemailer.createTransport ist ersetzt. supertest
// verbindet ueber Loopback, der Peer gilt als Proxy -- X-Real-IP waehlt die
// Client-Adresse (utils/clientIp.js).
const { format } = require('util');
const request = require('supertest');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { imapAttrappe } = require('../helpers/imapAttrappe');
const mailAbholung = require('../../services/mailAbholung');
const { ANLIEGEN_JE_STUNDE, ANLIEGEN_JE_ADRESSE_UND_TAG } = require('../../routes/anliegen');
const { ANFRAGEN_JE_STUNDE, ANFRAGEN_JE_ADRESSE_UND_TAG } = require('../../routes/anfragen');
const { STANDARD_EINSTELLUNGEN } = require('../../utils/mailEinstellungen');
const { mailZuordnen } = require('../../utils/mailZuordnung');
const BackgroundService = require('../../services/backgroundService');
const { MAIL_ENV } = require('../helpers/vorgaengeDaten');

const sendMail = vi.fn();

const VOLL = Object.freeze({
  gemeinde: '  Kirchengemeinde Büsum ',
  name: ' Erika Probe ',
  email: 'Erika.Probe@Buesum.example',
  funktion: 'Küsterin',
  art: 'fehler',
  bereich: 'termine',
  dringlichkeit: 'dringend',
  betreff: 'Der Kalender zeigt\nfalsche Termine',
  beschreibung: 'Seit gestern fehlen alle Termine im Dezember.',
  einwilligung: true,
  website: '',
});

describe('POST /api/anliegen', () => {
  let app;
  let db;
  let attrappe;

  beforeAll(() => {
    Object.assign(process.env, MAIL_ENV);
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
    vi.spyOn(mailAbholung, 'standardImapFabrik').mockImplementation((opt) => attrappe.fabrik(opt));
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    for (const k of Object.keys(MAIL_ENV)) delete process.env[k];
    vi.restoreAllMocks();
    await closePool();
  });

  let ipZaehler = 0;
  // Jeder Test eine eigene Client-Adresse, damit die Grenze je Adresse nur
  // dort greift, wo sie geprueft wird.
  const neueIp = () => `198.51.100.${(ipZaehler++ % 250) + 1}`;

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
    attrappe = imapAttrappe({ ordner: [{ path: 'Sent', name: 'Sent', delimiter: '.', flags: new Set(), specialUse: '\\Sent' }] });
  });

  const senden = (felder = {}, ip = neueIp()) => request(app)
    .post('/api/anliegen')
    .set('X-Real-IP', ip)
    .send({ ...VOLL, ...felder });

  const vorgaenge = async () => (await db.query('SELECT * FROM support_vorgaenge ORDER BY id')).rows;
  const gesendet = async (n = 0) => {
    const [arg] = sendMail.mock.calls[n];
    const p = await simpleParser(arg.raw);
    return { umschlag: arg.envelope, betreff: p.subject, text: p.text, von: p.from.value[0], antwortAn: p.replyTo.value[0].address };
  };
  const konto = (userId, adresse) => db.query('UPDATE users SET email = $2 WHERE id = $1', [userId, adresse]);

  describe('erlaubt', () => {
    it('vollständiges Anliegen: 201 { ok: true } ohne Nummer und ohne Zuordnung; gespeichert als Vorgang der Quelle formular, Status neu', async () => {
      const res = await senden();
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });

      const [v] = await vorgaenge();
      expect(v).toMatchObject({
        art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', status: 'neu', quelle: 'formular',
        betreff: 'Der Kalender zeigt falsche Termine', // einzeilig
        beschreibung: 'Seit gestern fehlen alle Termine im Dezember.',
        kontakt_name: 'Erika Probe', kontakt_email: 'Erika.Probe@Buesum.example', kontakt_funktion: 'Küsterin',
        gemeinde_angabe: 'Kirchengemeinde Büsum',
        organization_id: null, anfrage_id: null, erstellt_von: null, notiz: null, archiviert_am: null,
      });
      expect(v.einwilligung_am).toBeInstanceOf(Date);
      expect(Date.now() - v.einwilligung_am.getTime()).toBeLessThan(60 * 1000);
    });

    it('nur Pflichtfelder: Art ohne Bereich (zugang), Dringlichkeit fehlt -> normal, Funktion leer', async () => {
      const res = await request(app).post('/api/anliegen').set('X-Real-IP', neueIp()).send({
        gemeinde: 'Kirchengemeinde Wesselburen', name: 'Simon', email: 'simon@wesselburen.example', art: 'zugang',
        betreff: 'Neuer Zugang', beschreibung: 'Bitte einen Zugang einrichten.', einwilligung: true,
      });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      const [v] = await vorgaenge();
      expect(v).toMatchObject({ art: 'zugang', bereich: null, dringlichkeit: 'normal', kontakt_funktion: null });
    });

    it.each(['zugang', 'lizenz', 'datenschutz', 'sonstiges'])('Art %s braucht keinen Bereich (leerer Text und null gehen)', async (art) => {
      expect((await senden({ art, bereich: '' })).status).toBe(201);
      expect((await senden({ art, bereich: null })).status).toBe(201);
      await warteAufNachwehen(app);
      expect((await vorgaenge()).map((v) => [v.art, v.bereich])).toEqual([[art, null], [art, null]]);
    });

    it.each(['frage', 'fehler', 'wunsch', 'zugang', 'lizenz', 'datenschutz', 'sonstiges'])('Art %s wird gespeichert', async (art) => {
      expect((await senden({ art })).status).toBe(201);
      await warteAufNachwehen(app);
      expect((await vorgaenge())[0].art).toBe(art);
    });

    it.each(['konfis', 'termine', 'punkte', 'challenges', 'chat', 'badges', 'material', 'konten', 'einstellungen', 'sonstiges'])('Bereich %s wird gespeichert', async (bereich) => {
      expect((await senden({ bereich })).status).toBe(201);
      await warteAufNachwehen(app);
      expect((await vorgaenge())[0].bereich).toBe(bereich);
    });

    it('der Vorgang erscheint in der Support-Ansicht: Liste (Gemeindename aus der Angabe), Detail mit Kontakt', async () => {
      await db.query("UPDATE users SET email = 'simon@betrieb.example' WHERE id = $1", [USERS.orgAdminSuper.id]);
      await senden();
      await warteAufNachwehen(app);
      const super_ = generateToken('orgAdminSuper');
      const liste = await request(app).get('/api/support/vorgaenge').set('Authorization', `Bearer ${super_}`);
      expect(liste.body).toHaveLength(1);
      expect(liste.body[0]).toMatchObject({
        art: 'fehler', status: 'neu', quelle: 'formular', organization_id: null, gemeinde_name: 'Kirchengemeinde Büsum',
        betreff: 'Der Kalender zeigt falsche Termine', ungelesen: 0,
      });
      const detail = await request(app).get(`/api/support/vorgaenge/${liste.body[0].id}`).set('Authorization', `Bearer ${super_}`);
      expect(detail.body).toMatchObject({
        kontakt_name: 'Erika Probe', kontakt_email: 'Erika.Probe@Buesum.example', kontakt_funktion: 'Küsterin',
        gemeinde_angabe: 'Kirchengemeinde Büsum', gemeinde: null,
      });
      // Die Bestätigung ist ausgehend: Empfänger ist die Kontaktadresse aus dem Formular.
      expect(detail.body.empfaenger).toEqual([{ adresse: 'erika.probe@buesum.example', name: 'Erika Probe', herkunft: 'kontakt' }]);
    });
  });

  describe('Zuordnung über die E-Mail-Adresse eines Kontos', () => {
    it('Konto genau einer Gemeinde (nicht Konfi): der Vorgang bekommt diese Gemeinde -- auch ohne Groß/klein; die Angabe der Person bleibt', async () => {
      await konto(USERS.orgAdmin2.id, 'Leitung@Andere.example');
      await senden({ email: 'leitung@ANDERE.example', gemeinde: 'Kirche am Meer' });
      await konto(USERS.teamer1.id, 'team@test.example');
      await senden({ email: 'team@test.example' });
      await konto(USERS.admin1.id, 'admin@test.example');
      await senden({ email: ' admin@test.example ' });
      await warteAufNachwehen(app);
      const v = await vorgaenge();
      expect(v.map((x) => [x.organization_id, x.gemeinde_angabe])).toEqual([
        [ORGS.andereGemeinde.id, 'Kirche am Meer'], [ORGS.testGemeinde.id, 'Kirchengemeinde Büsum'], [ORGS.testGemeinde.id, 'Kirchengemeinde Büsum'],
      ]);
    });

    it('beide Quellen: ein Gast-Konto (user_organizations) mit Rolle dort -- die Gemeinde, in der es mitarbeitet', async () => {
      await konto(USERS.konfi1.id, 'gast@x.example');
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.konfi1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      await senden({ email: 'gast@x.example' });
      await warteAufNachwehen(app);
      expect((await vorgaenge())[0].organization_id).toBe(ORGS.andereGemeinde.id);
    });

    it('bleibt leer: unbekannte Adresse, Konfi-Konto, gesperrtes oder gelöschtes Konto, dieselbe Adresse an zwei Konten, ein Konto in zwei Gemeinden', async () => {
      await konto(USERS.konfi3.id, 'konfi@x.example');
      await konto(USERS.admin2.id, 'gesperrt@x.example');
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.admin2.id]);
      await konto(USERS.teamer1.id, 'geloescht@x.example');
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.teamer1.id]);
      await konto(USERS.admin1.id, 'doppelt@x.example');
      await konto(USERS.orgAdmin2.id, 'doppelt@x.example');
      await konto(USERS.orgAdmin1.id, 'zwei@x.example');
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      for (const email of ['niemand@x.example', 'konfi@x.example', 'gesperrt@x.example', 'geloescht@x.example', 'doppelt@x.example', 'zwei@x.example']) {
        expect((await senden({ email })).status).toBe(201);
      }
      await warteAufNachwehen(app);
      expect((await vorgaenge()).map((v) => [v.kontakt_email, v.organization_id])).toEqual([
        ['niemand@x.example', null], ['konfi@x.example', null], ['gesperrt@x.example', null], ['geloescht@x.example', null],
        ['doppelt@x.example', null], ['zwei@x.example', null],
      ]);
    });
  });

  describe('Bestätigung', () => {
    it('vom Postfach support@ an die eingetragene Adresse, [Vorgang N] im Betreff, fester Text mit der Nummer, Fußzeile -- ohne jede Eingabe aus dem Formular', async () => {
      await senden();
      await warteAufNachwehen(app);
      expect(sendMail).toHaveBeenCalledTimes(1);
      const [v] = await vorgaenge();
      const m = await gesendet();
      expect(m.umschlag).toEqual({ from: 'support@konfi-quest.de', to: ['erika.probe@buesum.example'] });
      expect(m.von).toMatchObject({ address: 'support@konfi-quest.de', name: STANDARD_EINSTELLUNGEN.absendername });
      expect(m.antwortAn).toBe('support@konfi-quest.de');
      expect(m.betreff).toBe(`Euer Anliegen ist angekommen [Vorgang ${v.id}]`);
      expect(m.text).toBe([
        'Hallo,',
        '',
        `euer Anliegen ist bei uns angekommen. Es hat die Nummer ${v.id}.`,
        '',
        'Wir melden uns, sobald wir uns darum gekümmert haben. Möchtet ihr etwas ergänzen, antwortet einfach auf diese Mail – sie landet dann direkt in eurem Anliegen.',
        '',
        'Antworten zur Bedienung findet ihr auch im Handbuch: konfi-quest.de/docs',
        '',
        'Viele Grüße',
        STANDARD_EINSTELLUNGEN.absendername,
        '',
        '-- ',
        STANDARD_EINSTELLUNGEN.fusszeile,
        '',
      ].join('\n'));
      for (const eingabe of ['Büsum', 'Erika', 'Küsterin', 'Kalender', 'Dezember', 'termine', 'fehler', 'dringend']) {
        expect(m.betreff).not.toContain(eingabe);
        expect(m.text).not.toContain(eingabe);
      }
    });

    it('die Bestätigung steht im Verlauf des Vorgangs (ausgehend, gelesen); der Vorgang bleibt „neu“', async () => {
      await senden();
      await warteAufNachwehen(app);
      const [v] = await vorgaenge();
      const { rows: [mail] } = await db.query('SELECT * FROM mail_nachrichten');
      expect(mail).toMatchObject({
        postfach: 'support', richtung: 'aus', vorgang_id: v.id, anfrage_id: null, organization_id: null,
        an_adressen: ['erika.probe@buesum.example'], verfasst_von: null,
      });
      expect(mail.gelesen_am).toEqual(mail.gesendet_am);
      expect(v.status).toBe('neu');
      expect(v.archiviert_am).toBeNull();
    });

    it('bei Zuordnung zu einer Gemeinde trägt die Bestätigung deren Kennung an der Mail', async () => {
      await konto(USERS.orgAdmin2.id, 'leitung@andere.example');
      await senden({ email: 'leitung@andere.example' });
      await warteAufNachwehen(app);
      expect((await db.query('SELECT organization_id, vorgang_id FROM mail_nachrichten')).rows).toEqual([{ organization_id: 2, vorgang_id: (await vorgaenge())[0].id }]);
    });

    it('RUN_BACKGROUND_JOBS=false (backend-test): 201 und der Vorgang entsteht -- aber nichts geht hinaus, nichts wird gespeichert', async () => {
      process.env.RUN_BACKGROUND_JOBS = 'false';
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await senden();
        await warteAufNachwehen(app);
        expect(res.status).toBe(201);
        expect(fehler.mock.calls.map((c) => format(...c))).toEqual([`Anliegen ${(await vorgaenge())[0].id}: Bestätigung nicht versandt (503)`]);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
        fehler.mockRestore();
      }
      expect(await vorgaenge()).toHaveLength(1);
      expect(sendMail).not.toHaveBeenCalled();
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten')).rows[0].n).toBe(0);
      expect(attrappe.aufrufe).toEqual([]);
    });

    it('Gegenprobe: ohne die Variable und mit "true" geht die Bestätigung hinaus', async () => {
      expect((await senden()).status).toBe(201);
      process.env.RUN_BACKGROUND_JOBS = 'true';
      try {
        expect((await senden({ email: 'zweite@buesum.example' })).status).toBe(201);
        await warteAufNachwehen(app);
      } finally {
        delete process.env.RUN_BACKGROUND_JOBS;
      }
      expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('scheitert der Versand, bleibt das Anliegen (201) und das Protokoll nennt nur die Nummer', async () => {
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      sendMail.mockRejectedValue(Object.assign(new Error('550 <erika.probe@buesum.example>: Recipient address rejected'), { code: 'EENVELOPE' }));
      try {
        const res = await senden();
        await warteAufNachwehen(app);
        expect(res.status).toBe(201);
        expect(await vorgaenge()).toHaveLength(1);
        const protokoll = fehler.mock.calls.map((c) => format(...c)).join('\n');
        expect(protokoll).toContain('Mail-Versand (support) gescheitert: EENVELOPE');
        for (const daten of ['erika', 'buesum', 'Büsum', 'Erika', 'Kalender']) expect(protokoll).not.toContain(daten);
      } finally {
        fehler.mockRestore();
      }
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten')).rows[0].n).toBe(0);
    });

    it('das Protokoll eines angenommenen Anliegens nennt nur die Nummer', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await senden();
        await warteAufNachwehen(app);
        const [v] = await vorgaenge();
        const zeilen = log.mock.calls.map((c) => format(...c));
        expect(zeilen).toContain(`Anliegen ${v.id} eingegangen`);
        expect(zeilen.join('\n')).not.toMatch(/Büsum|Erika|buesum|Kalender|Dezember/);
      } finally {
        log.mockRestore();
      }
    });

    it('eine Antwort auf die Bestätigung (Betreff mit [Vorgang N]) landet beim Abholen im Vorgang', async () => {
      await senden();
      await warteAufNachwehen(app);
      const [v] = await vorgaenge();
      const ergebnis = await mailZuordnen(db, { postfach: 'support', betreff: `AW: Euer Anliegen ist angekommen [Vorgang ${v.id}]`, vonAdresse: 'erika.probe@buesum.example' });
      expect(ergebnis).toEqual({ vorgang_id: v.id, anfrage_id: null, organization_id: null, regel: 2, neuer_vorgang: false });
    });
  });

  describe('verboten', () => {
    const abgelehnt = async (felder, feld) => {
      const res = await senden(felder);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validierungsfehler');
      expect(res.body.details.map((d) => d.field)).toContain(feld);
      // Die Antwort wiederholt keine Eingabe.
      expect(JSON.stringify(res.body)).not.toContain('Erika');
      await warteAufNachwehen(app);
      expect(await vorgaenge()).toEqual([]);
      expect(sendMail).not.toHaveBeenCalled();
      return res;
    };

    it.each([
      ['ohne Gemeinde', { gemeinde: undefined }, 'gemeinde'],
      ['Gemeinde nur Leerzeichen', { gemeinde: '   ' }, 'gemeinde'],
      ['Gemeinde 201 Zeichen', { gemeinde: 'x'.repeat(201) }, 'gemeinde'],
      ['ohne Namen', { name: undefined }, 'name'],
      ['Name 201 Zeichen', { name: 'x'.repeat(201) }, 'name'],
      ['ohne E-Mail', { email: undefined }, 'email'],
      ['ungültige E-Mail', { email: 'keine-adresse' }, 'email'],
      ['E-Mail kein Text', { email: ['a@b.example'] }, 'email'],
      ['Funktion 201 Zeichen', { funktion: 'x'.repeat(201) }, 'funktion'],
      ['ohne Art', { art: undefined }, 'art'],
      ['Art „Neue Gemeinde“ gibt es hier nicht', { art: 'neue_gemeinde' }, 'art'],
      ['Art nicht aus der Liste', { art: 'beschwerde' }, 'art'],
      ['Art kein Text', { art: ['frage'] }, 'art'],
      ['Frage ohne Bereich', { art: 'frage', bereich: undefined }, 'bereich'],
      ['Fehler ohne Bereich (leerer Text)', { art: 'fehler', bereich: '' }, 'bereich'],
      ['Wunsch ohne Bereich (null)', { art: 'wunsch', bereich: null }, 'bereich'],
      ['Bereich nicht aus der Liste', { bereich: 'kaffee' }, 'bereich'],
      ['Bereich kein Text', { bereich: ['chat'] }, 'bereich'],
      ['Dringlichkeit nicht aus der Liste', { dringlichkeit: 'egal' }, 'dringlichkeit'],
      ['Dringlichkeit kein Text', { dringlichkeit: ['dringend'] }, 'dringlichkeit'],
      ['ohne Betreff', { betreff: undefined }, 'betreff'],
      ['Betreff nur Leerzeichen', { betreff: '  \n ' }, 'betreff'],
      ['Betreff 121 Zeichen', { betreff: 'b'.repeat(121) }, 'betreff'],
      ['Betreff kein Text', { betreff: 5 }, 'betreff'],
      ['ohne Beschreibung', { beschreibung: undefined }, 'beschreibung'],
      ['Beschreibung nur Leerzeichen', { beschreibung: '   ' }, 'beschreibung'],
      ['Beschreibung 5001 Zeichen', { beschreibung: 'x'.repeat(5001) }, 'beschreibung'],
    ])('%s -> 400, nichts gespeichert, keine Mail', async (_fall, felder, feld) => {
      await abgelehnt(felder, feld);
    });

    it.each([
      ['fehlt', undefined],
      ['false', false],
      ['als Text "true"', 'true'],
      ['als Zahl 1', 1],
    ])('Einwilligung %s -> 400', async (_fall, wert) => {
      const res = await abgelehnt({ einwilligung: wert }, 'einwilligung');
      expect(res.body.details).toContainEqual({ field: 'einwilligung', message: 'Die Einwilligung ist erforderlich' });
    });

    it('Grenzen: genau 200 Zeichen Gemeinde, 120 Zeichen Betreff und 5000 Zeichen Beschreibung gehen noch (erlaubt)', async () => {
      const res = await senden({ gemeinde: 'g'.repeat(200), betreff: 'b'.repeat(120), beschreibung: 'n'.repeat(5000) });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      const [v] = await vorgaenge();
      expect([v.gemeinde_angabe.length, v.betreff.length, v.beschreibung.length]).toEqual([200, 120, 5000]);
    });

    it('ein Körper, der kein Objekt ist, ist 400 -- nichts gespeichert', async () => {
      const res = await request(app).post('/api/anliegen').set('X-Real-IP', neueIp()).set('Content-Type', 'application/json').send('[1, 2]');
      expect(res.status).toBe(400);
      expect(await vorgaenge()).toEqual([]);
    });
  });

  describe('Honigtopf', () => {
    it('gefüllt: 201 { ok: true }, aber nichts gespeichert und keine Mail', async () => {
      const res = await senden({ website: 'https://werbung.example' });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect(await vorgaenge()).toEqual([]);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('gefüllt und sonst ungültig: dieselbe Antwort (ein Programm lernt nichts)', async () => {
      const res = await senden({ website: 'x', email: 'kaputt', einwilligung: false });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect(await vorgaenge()).toEqual([]);
    });
  });

  describe(`Grenze je Client-Adresse (${ANLIEGEN_JE_STUNDE} je Stunde)`, () => {
    it('dieselbe Grenze wie beim Anfrageformular', () => {
      expect([ANLIEGEN_JE_STUNDE, ANLIEGEN_JE_ADRESSE_UND_TAG]).toEqual([ANFRAGEN_JE_STUNDE, ANFRAGEN_JE_ADRESSE_UND_TAG]);
      expect([ANLIEGEN_JE_STUNDE, ANLIEGEN_JE_ADRESSE_UND_TAG]).toEqual([5, 3]);
    });

    it(`nach ${ANLIEGEN_JE_STUNDE} angenommenen Anliegen von einer Adresse: 429 (verboten); eine andere Adresse geht (erlaubt)`, async () => {
      const ip = '203.0.113.7';
      const status = [];
      for (let i = 0; i < ANLIEGEN_JE_STUNDE + 1; i++) {
        status.push((await senden({ email: `person${i}@gemeinde.example` }, ip)).status);
      }
      expect(status).toEqual([...Array(ANLIEGEN_JE_STUNDE).fill(201), 429]);
      const letzte = await senden({ email: 'noch.eine@gemeinde.example' }, ip);
      expect(letzte.status).toBe(429);
      expect(letzte.body).toEqual({ error: 'Zu viele Anliegen von dieser Verbindung. Bitte versucht es in einer Stunde erneut oder schreibt uns an support@konfi-quest.de.' });
      expect((await senden({ email: 'andere@gemeinde.example' }, '203.0.113.8')).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await vorgaenge()).toHaveLength(ANLIEGEN_JE_STUNDE + 1);
    });

    it('abgewiesene Eingaben (400) zählen nicht', async () => {
      const ip = '203.0.113.9';
      for (let i = 0; i < 3; i++) expect((await senden({ einwilligung: false }, ip)).status).toBe(400);
      for (let i = 0; i < ANLIEGEN_JE_STUNDE; i++) expect((await senden({ email: `p${i}@gemeinde.example` }, ip)).status).toBe(201);
      await warteAufNachwehen(app);
    });

    it('der Honigtopf zählt mit (ein Programm füllt die Grenze nicht folgenlos)', async () => {
      const ip = '203.0.113.10';
      for (let i = 0; i < ANLIEGEN_JE_STUNDE; i++) expect((await senden({ website: 'x' }, ip)).status).toBe(201);
      expect((await senden({}, ip)).status).toBe(429);
    });

    it('der Zähler ist eigener: Anfragen vom selben Absender verbrauchen die Grenze der Anliegen nicht -- und umgekehrt', async () => {
      const ip = '203.0.113.11';
      for (let i = 0; i < ANFRAGEN_JE_STUNDE; i++) {
        const res = await request(app).post('/api/anfragen').set('X-Real-IP', ip).send({
          gemeinde: 'G', kontakt_name: 'K', email: `anfrage${i}@gemeinde.example`, einwilligung: true,
        });
        expect(res.status).toBe(201);
      }
      expect((await senden({ email: 'anliegen@gemeinde.example' }, ip)).status).toBe(201);
      await warteAufNachwehen(app);
      const { rows } = await db.query("SELECT schluessel FROM rate_limit_zaehler WHERE schluessel LIKE 'anliegen-ip:%' OR schluessel LIKE 'anfragen-ip:%' ORDER BY 1");
      expect(rows.map((r) => r.schluessel.split(':')[0])).toEqual(['anfragen-ip', 'anliegen-ip']);
    });
  });

  describe(`Grenze je E-Mail-Adresse (${ANLIEGEN_JE_ADRESSE_UND_TAG} je Tag)`, () => {
    it(`nach ${ANLIEGEN_JE_ADRESSE_UND_TAG} Anliegen mit derselben Adresse (ohne Groß/klein) von verschiedenen Verbindungen: 429; eine andere Adresse geht`, async () => {
      for (const email of ['ziel@postfach.example', 'ZIEL@Postfach.example', ' ziel@postfach.example ']) {
        expect((await senden({ email })).status).toBe(201);
      }
      const vierte = await senden({ email: 'Ziel@postfach.example' });
      expect(vierte.status).toBe(429);
      expect(vierte.body.error).toBe('Für diese E-Mail-Adresse sind heute schon mehrere Anliegen eingegangen. Bitte versucht es morgen erneut oder schreibt uns an support@konfi-quest.de.');
      expect((await senden({ email: 'anderes@postfach.example' })).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await vorgaenge()).toHaveLength(4);
      // Drei Bestätigungen an die Adresse, keine vierte.
      expect(sendMail.mock.calls.filter(([m]) => m.envelope.to[0] === 'ziel@postfach.example')).toHaveLength(3);
    });

    it('der Zähler hält einen Prüfwert, nicht die Adresse', async () => {
      await senden({ email: 'geheim@postfach.example' });
      await warteAufNachwehen(app);
      const { rows } = await db.query("SELECT schluessel FROM rate_limit_zaehler WHERE schluessel LIKE 'anliegen-adresse:%'");
      expect(rows).toHaveLength(1);
      expect(rows[0].schluessel).toMatch(/^anliegen-adresse:adresse:[0-9a-f]{64}$/);
      expect(rows[0].schluessel).not.toContain('geheim');
    });
  });

  describe('Aufbewahrung', () => {
    it('ein Anliegen im Archiv geht 730 Tage nach dem Archivieren (nächtlicher Lauf); ein jüngeres bleibt', async () => {
      await senden({ email: 'alt@postfach.example' });
      await senden({ email: 'jung@postfach.example' });
      await warteAufNachwehen(app);
      await db.query(
        `UPDATE support_vorgaenge SET status = 'erledigt', archiviert_am = NOW() - interval '731 days', updated_at = NOW() - interval '731 days'
          WHERE kontakt_email = 'alt@postfach.example'`);
      await db.query(
        `UPDATE support_vorgaenge SET status = 'erledigt', archiviert_am = NOW() - interval '729 days', updated_at = NOW() - interval '729 days'
          WHERE kontakt_email = 'jung@postfach.example'`);
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(1);
      expect((await vorgaenge()).map((v) => v.kontakt_email)).toEqual(['jung@postfach.example']);
      // Mit dem Vorgang ging seine Bestätigungsmail.
      expect((await db.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten')).rows[0].n).toBe(1);
    });
  });
});
