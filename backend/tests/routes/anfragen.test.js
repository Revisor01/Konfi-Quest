// POST /api/anfragen -- das Anfrageformular auf konfi-quest.de (03.10.2026;
// docs/planung/web-version.md, Entscheidung 4; Vertrag der Pakete vom
// 03.10.2026).
//
// Oeffentlich, ohne Anmeldung. Geprueft wird je der erlaubte und der
// verbotene Fall: Pflichtfelder, Laengen, Einwilligung, Honigtopf, die
// Grenzen je Client-Adresse und je E-Mail-Adresse, was gespeichert wird,
// welche Mails hinausgehen (Bestaetigung ohne Eingaben, Hinweis an aktive
// Super-Admins ohne Kontaktdaten) und dass das Protokoll keine Daten der
// Anfrage enthaelt.
//
// Kein Mailserver: nodemailer.createTransport ist ersetzt (Muster wie
// tests/routes/passwortMails.test.js). supertest verbindet ueber Loopback,
// der Peer gilt als Proxy -- X-Real-IP waehlt die Client-Adresse
// (utils/clientIp.js).
const { format } = require('util');
const request = require('supertest');
const nodemailer = require('nodemailer');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { supportKontoAnlegen, SUPPORT } = require('../helpers/kontoOhneGemeinde');
const { ANFRAGEN_JE_STUNDE, ANFRAGEN_JE_ADRESSE_UND_TAG } = require('../../routes/anfragen');

const sendMail = vi.fn();

const VOLL = Object.freeze({
  gemeinde: '  Kirchengemeinde Büsum ',
  kirchenkreis: 'Dithmarschen',
  landeskirche: 'Nordkirche',
  kontakt_name: 'Pastorin Erika Probe',
  funktion: 'Pastorin',
  email: 'erika.probe@buesum.example',
  mobil: '+49 151 2345678',
  anzahl_konfis: '24',
  anzahl_teamer: 6,
  wunsch_lizenz: 'standard',
  nachricht: 'Wir möchten im Januar starten.',
  einwilligung: true,
  website: '',
});

describe('POST /api/anfragen', () => {
  let app;
  let db;

  beforeAll(() => {
    process.env.SMTP_HOST = 'mail.example.test';
    process.env.SMTP_USER = 'absender@example.test';
    process.env.SMTP_PASS = 'geheim';
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
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
    sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
    // Zwei Super-Admin-Konten mit Adresse (eines mit Gemeinde, eines ohne),
    // dazu eines gesperrt und eine Gemeindeleitung ohne Merkmal.
    await supportKontoAnlegen(db);
    await db.query('UPDATE users SET email = $1 WHERE id = $2', ['simon@betrieb.example', USERS.orgAdminSuper.id]);
    await db.query('UPDATE users SET email = $1 WHERE id = $2', ['support@betrieb.example', SUPPORT.id]);
    await db.query('UPDATE users SET email = $1, is_active = false WHERE id = $2', ['gesperrt@betrieb.example', USERS.superAdmin.id]);
    await db.query('UPDATE users SET email = $1 WHERE id = $2', ['leitung@gemeinde.example', USERS.orgAdmin1.id]);
  });

  const senden = (felder = {}, ip = neueIp()) => request(app)
    .post('/api/anfragen')
    .set('X-Real-IP', ip)
    .send({ ...VOLL, ...felder });

  const anfragen = async () => (await db.query('SELECT * FROM gemeinde_anfragen ORDER BY id')).rows;
  const mails = () => sendMail.mock.calls.map(([m]) => ({ to: m.to, subject: m.subject, text: m.text, html: m.html }));

  describe('erlaubt', () => {
    it('vollständige Anfrage: 201 { ok: true } ohne Kennung, gespeichert mit Status neu und Zeitpunkt der Einwilligung', async () => {
      const res = await senden();
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });

      const [a] = await anfragen();
      expect(a).toMatchObject({
        gemeinde: 'Kirchengemeinde Büsum',
        kirchenkreis: 'Dithmarschen',
        landeskirche: 'Nordkirche',
        kontakt_name: 'Pastorin Erika Probe',
        funktion: 'Pastorin',
        email: 'erika.probe@buesum.example',
        mobil: '+49 151 2345678',
        anzahl_konfis: 24,
        anzahl_teamer: 6,
        wunsch_lizenz: 'standard',
        nachricht: 'Wir möchten im Januar starten.',
        status: 'neu',
        notiz: null,
        organization_id: null,
        bearbeitet_von: null,
      });
      expect(a.einwilligung_am).toBeInstanceOf(Date);
      expect(Date.now() - a.einwilligung_am.getTime()).toBeLessThan(60 * 1000);
    });

    it('nur Pflichtfelder: 201, alles andere leer', async () => {
      const res = await request(app).post('/api/anfragen').set('X-Real-IP', neueIp()).send({
        gemeinde: 'Kirchengemeinde Wesselburen', kontakt_name: 'Simon', email: 'simon@wesselburen.example', einwilligung: true,
      });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      const [a] = await anfragen();
      expect(a).toMatchObject({
        gemeinde: 'Kirchengemeinde Wesselburen', kirchenkreis: null, landeskirche: null, funktion: null,
        mobil: null, anzahl_konfis: null, anzahl_teamer: null, wunsch_lizenz: null, nachricht: null,
      });
    });

    // Simon, 03.10.2026: Die Gemeinde waehlt ihre Wunschlizenz.
    it.each(['klein', 'standard', 'plus', 'gross', 'verbund'])('Wunschlizenz %s wird gespeichert', async (lizenz) => {
      const res = await senden({ wunsch_lizenz: lizenz });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      const [a] = await anfragen();
      expect(a.wunsch_lizenz).toBe(lizenz);
    });

    it('leere Texte und Zahlen werden zu leer, nicht zu ""', async () => {
      await senden({ kirchenkreis: '', funktion: '   ', anzahl_konfis: '', wunsch_lizenz: '', nachricht: '' });
      await warteAufNachwehen(app);
      const [a] = await anfragen();
      expect(a).toMatchObject({ kirchenkreis: null, funktion: null, anzahl_konfis: null, wunsch_lizenz: null, nachricht: null });
    });
  });

  describe('Mails', () => {
    it('Bestätigung an die anfragende Adresse -- fester Text, keine Eingabe aus dem Formular', async () => {
      await senden();
      await warteAufNachwehen(app);
      const an = mails().filter((m) => m.to === 'erika.probe@buesum.example');
      expect(an).toHaveLength(1);
      expect(an[0].subject).toBe('Eure Anfrage bei Konfi Quest');
      expect(an[0].text).toContain('vielen Dank für eure Anfrage! Sie ist bei uns angekommen.');
      for (const eingabe of ['Büsum', 'Erika', 'Dithmarschen', 'Nordkirche', 'Januar', '2345678']) {
        expect(an[0].text).not.toContain(eingabe);
        expect(an[0].html).not.toContain(eingabe);
      }
    });

    it('Hinweis an jedes aktive Super-Admin-Konto mit Adresse -- mit und ohne Gemeinde; nicht gesperrt, nicht an die Leitung', async () => {
      await senden();
      await warteAufNachwehen(app);
      const hinweise = mails().filter((m) => m.subject.startsWith('Neue Anfrage'));
      expect(hinweise.map((m) => m.to).sort()).toEqual(['simon@betrieb.example', 'support@betrieb.example']);
      expect(mails()).toHaveLength(3);
    });

    it('der Hinweis nennt Kennung, Gemeinde, Kirchenkreis und Landeskirche -- keine Kontaktdaten und keine Nachricht', async () => {
      await senden();
      await warteAufNachwehen(app);
      const [a] = await anfragen();
      const hinweis = mails().find((m) => m.to === 'support@betrieb.example');
      expect(hinweis.subject).toBe('Neue Anfrage: Kirchengemeinde Büsum - Konfi Quest');
      expect(hinweis.text).toContain(`Anfrage ${a.id}: Kirchengemeinde Büsum (Dithmarschen, Nordkirche)`);
      for (const kontakt of ['Erika', 'erika.probe', 'Pastorin', '2345678', 'Januar']) {
        expect(hinweis.text).not.toContain(kontakt);
        expect(hinweis.html).not.toContain(kontakt);
      }
    });

    it('scheitert der Versand, bleibt die Anfrage (201) und das Protokoll nennt nur die Kennung', async () => {
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
      sendMail.mockRejectedValue(Object.assign(
        new Error('550 <erika.probe@buesum.example>: Recipient address rejected'), { code: 'EENVELOPE' }));
      try {
        const res = await senden();
        await warteAufNachwehen(app);
        expect(res.status).toBe(201);
        expect(await anfragen()).toHaveLength(1);
        const protokoll = fehler.mock.calls.map((c) => format(...c)).join('\n');
        expect(protokoll).toContain('EENVELOPE');
        for (const daten of ['erika', 'buesum', 'Büsum', 'Erika', 'betrieb.example']) {
          expect(protokoll).not.toContain(daten);
        }
      } finally {
        fehler.mockRestore();
      }
    });

    it('das Protokoll einer angenommenen Anfrage nennt nur die Kennung', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await senden();
        await warteAufNachwehen(app);
        const [a] = await anfragen();
        const zeilen = log.mock.calls.map((c) => format(...c));
        expect(zeilen).toContain(`Gemeinde-Anfrage ${a.id} eingegangen`);
        expect(zeilen.join('\n')).not.toMatch(/Büsum|Erika|buesum/);
      } finally {
        log.mockRestore();
      }
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
      expect(await anfragen()).toEqual([]);
      expect(sendMail).not.toHaveBeenCalled();
      return res;
    };

    it.each([
      ['ohne Gemeinde', { gemeinde: undefined }, 'gemeinde'],
      ['Gemeinde nur Leerzeichen', { gemeinde: '   ' }, 'gemeinde'],
      ['ohne Namen', { kontakt_name: undefined }, 'kontakt_name'],
      ['ohne E-Mail', { email: undefined }, 'email'],
      ['ungültige E-Mail', { email: 'keine-adresse' }, 'email'],
      ['E-Mail kein Text', { email: ['a@b.example'] }, 'email'],
      ['Gemeinde 201 Zeichen', { gemeinde: 'x'.repeat(201) }, 'gemeinde'],
      ['Nachricht 5001 Zeichen', { nachricht: 'x'.repeat(5001) }, 'nachricht'],
      ['Mobilnummer mit Buchstaben', { mobil: 'ruf mich an' }, 'mobil'],
      ['Zahl der Konfis negativ', { anzahl_konfis: -1 }, 'anzahl_konfis'],
      ['Zahl der Teamer:innen kein Zahlwert', { anzahl_teamer: 'viele' }, 'anzahl_teamer'],
      ['Zahl über 100.000', { anzahl_konfis: 100001 }, 'anzahl_konfis'],
      ['Wunschlizenz nicht aus der Liste', { wunsch_lizenz: 'unbegrenzt' }, 'wunsch_lizenz'],
      ['Wunschlizenz in anderer Schreibweise', { wunsch_lizenz: 'Standard' }, 'wunsch_lizenz'],
      ['Wunschlizenz kein Text', { wunsch_lizenz: ['klein'] }, 'wunsch_lizenz'],
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

    it('Grenzen: genau 200 Zeichen Gemeinde und 5000 Zeichen Nachricht gehen noch (erlaubt)', async () => {
      const res = await senden({ gemeinde: 'g'.repeat(200), nachricht: 'n'.repeat(5000) });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
    });
  });

  describe('Honigtopf', () => {
    it('gefüllt: 201 { ok: true }, aber nichts gespeichert und keine Mail', async () => {
      const res = await senden({ website: 'https://werbung.example' });
      await warteAufNachwehen(app);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect(await anfragen()).toEqual([]);
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('gefüllt und sonst ungültig: dieselbe Antwort (ein Programm lernt nichts)', async () => {
      const res = await senden({ website: 'x', email: 'kaputt', einwilligung: false });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect(await anfragen()).toEqual([]);
    });
  });

  describe(`Grenze je Client-Adresse (${ANFRAGEN_JE_STUNDE} je Stunde)`, () => {
    it(`nach ${ANFRAGEN_JE_STUNDE} angenommenen Anfragen von einer Adresse: 429 (verboten); eine andere Adresse geht (erlaubt)`, async () => {
      const ip = '203.0.113.7';
      const status = [];
      for (let i = 0; i < ANFRAGEN_JE_STUNDE + 1; i++) {
        status.push((await senden({ email: `person${i}@gemeinde.example` }, ip)).status);
      }
      const letzte = await senden({ email: 'noch.eine@gemeinde.example' }, ip);
      expect(status).toEqual([...Array(ANFRAGEN_JE_STUNDE).fill(201), 429]);
      expect(letzte.status).toBe(429);
      expect(letzte.body).toEqual({ error: 'Zu viele Anfragen von dieser Verbindung. Bitte versucht es in einer Stunde erneut oder schreibt uns an moin@konfi-quest.de.' });
      expect((await senden({ email: 'andere@gemeinde.example' }, '203.0.113.8')).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await anfragen()).toHaveLength(ANFRAGEN_JE_STUNDE + 1);
    });

    it('abgewiesene Eingaben (400) zählen nicht', async () => {
      const ip = '203.0.113.9';
      for (let i = 0; i < 3; i++) {
        expect((await senden({ einwilligung: false }, ip)).status).toBe(400);
      }
      for (let i = 0; i < ANFRAGEN_JE_STUNDE; i++) {
        expect((await senden({ email: `p${i}@gemeinde.example` }, ip)).status).toBe(201);
      }
      await warteAufNachwehen(app);
    });

    it('der Honigtopf zählt mit (ein Programm füllt die Grenze nicht folgenlos)', async () => {
      const ip = '203.0.113.10';
      for (let i = 0; i < ANFRAGEN_JE_STUNDE; i++) {
        expect((await senden({ website: 'x' }, ip)).status).toBe(201);
      }
      expect((await senden({}, ip)).status).toBe(429);
    });
  });

  describe(`Grenze je E-Mail-Adresse (${ANFRAGEN_JE_ADRESSE_UND_TAG} je Tag)`, () => {
    it(`nach ${ANFRAGEN_JE_ADRESSE_UND_TAG} Anfragen mit derselben Adresse (ohne Groß/klein) von verschiedenen Verbindungen: 429; eine andere Adresse geht`, async () => {
      const varianten = ['ziel@postfach.example', 'ZIEL@Postfach.example', ' ziel@postfach.example '];
      for (const email of varianten) {
        expect((await senden({ email })).status).toBe(201);
      }
      const vierte = await senden({ email: 'Ziel@postfach.example' });
      expect(vierte.status).toBe(429);
      expect(vierte.body.error).toBe('Für diese E-Mail-Adresse sind heute schon mehrere Anfragen eingegangen. Bitte versucht es morgen erneut oder schreibt uns an moin@konfi-quest.de.');
      expect((await senden({ email: 'anderes@postfach.example' })).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await anfragen()).toHaveLength(4);
      // Drei Bestaetigungen an die Adresse, keine vierte.
      expect(mails().filter((m) => m.to.trim().toLowerCase() === 'ziel@postfach.example')).toHaveLength(3);
    });

    it('der Zähler hält einen Prüfwert, nicht die Adresse', async () => {
      await senden({ email: 'geheim@postfach.example' });
      await warteAufNachwehen(app);
      const { rows } = await db.query("SELECT schluessel FROM rate_limit_zaehler WHERE schluessel LIKE 'anfragen-adresse:%'");
      expect(rows).toHaveLength(1);
      expect(rows[0].schluessel).toMatch(/^anfragen-adresse:adresse:[0-9a-f]{64}$/);
      expect(rows[0].schluessel).not.toContain('geheim');
    });
  });

  describe('Aufbewahrung: eine angelegte Anfrage geht mit ihrer Gemeinde', () => {
    it('DELETE /organizations/:id löscht die Anfrage dieser Gemeinde, andere bleiben', async () => {
      // orgAdminSuper: aktives Super-Admin-Konto (superAdmin ist hier gesperrt).
      const angelegt = await request(app).post('/api/organizations')
        .set('Authorization', `Bearer ${generateToken('orgAdminSuper')}`)
        .send({
          name: 'probe', slug: 'probe', display_name: 'Probe',
          admin_username: 'leitung.probe', admin_password: 'Sicher!Passwort1', admin_display_name: 'Leitung Probe',
        });
      expect(angelegt.status).toBe(201);
      await db.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, organization_id)
         VALUES ('Probe', 'A', 'a@example.test', NOW(), 'angelegt', $1), ('Andere', 'B', 'b@example.test', NOW(), 'neu', NULL)`,
        [angelegt.body.id]);

      const weg = await request(app).delete(`/api/organizations/${angelegt.body.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdminSuper')}`);
      await warteAufNachwehen(app);
      expect(weg.status).toBe(200);
      expect((await anfragen()).map((a) => a.gemeinde)).toEqual(['Andere']);
    });
  });
});
