// Keine Namen, Adressen und kein Freitext im Server-Protokoll
// (Audit Sicherheit BF-14, 29.09.2026).
//
// Reproduziert im Audit: `console.warn` beim Anmelden schrieb
// ["Login-Versuch: konfi1", "Login fehlgeschlagen: Falsches Passwort für 'konfi1'"].
// Der Benutzername ist bei Konfis meist vorname.nachname eines Kindes. Dazu
// kamen die Adresse der Leitung beim Versand der Anwesenheitsliste, der
// Dateiname abgewiesener Uploads und bis zu 200 Zeichen Freitext aus der
// Push-Diagnose der App.
//
// Regel: Personen nur mit Konto-Kennung, Adressen nur mit Domain, Freitext
// vom Client gar nicht (utils/protokoll.js).
const util = require('util');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, CHAT_ROOMS, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');
const {
  adresseFuersProtokoll,
  dateiFuersProtokoll,
  diagnoseHinweisFuersProtokoll,
} = require('../../utils/protokoll');

describe('Server-Protokoll ohne Namen, Adressen und Freitext', () => {
  let app;
  let db;
  let spies = [];

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    spies = ['log', 'warn', 'error', 'info'].map((m) => vi.spyOn(console, m));
  });

  afterEach(() => {
    for (const s of spies) s.mockRestore();
    vi.restoreAllMocks();
  });

  /** Alles, was waehrend des Tests ins Protokoll ging, als ein Text. */
  const protokoll = () => spies
    .flatMap((s) => s.mock.calls)
    .map((args) => util.format(...args))
    .join('\n');

  describe('Anmeldung', () => {
    it('VERBOTEN: erfolgreiche Anmeldung schreibt den Benutzernamen nicht ins Protokoll', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(protokoll()).not.toContain(USERS.konfi1.username);
    });

    it('VERBOTEN: falsches Passwort nennt den Benutzernamen nicht', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: 'falsch' });
      expect(res.status).toBe(401);
      expect(protokoll()).not.toContain(USERS.konfi1.username);
    });

    it('VERBOTEN: ein unbekannter Name landet nicht im Protokoll', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'anna.mustermann', password: 'falsch' });
      expect(res.status).toBe(401);
      expect(protokoll()).not.toContain('anna.mustermann');
    });

    it('ERLAUBT: ein gesperrtes Konto steht mit seiner Kennung im Protokoll, ohne Namen', async () => {
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.konfi2.id]);
      const res = await request(app).post('/api/auth/login')
        .send({ username: USERS.konfi2.username, password: PASSWORD });
      expect(res.status).toBe(403);
      const text = protokoll();
      expect(text).toContain(`Login blockiert: Konto ${USERS.konfi2.id} ist deaktiviert`);
      expect(text).not.toContain(USERS.konfi2.username);
    });
  });

  describe('Push-Diagnose der App', () => {
    const melden = (koerper) => request(app)
      .post('/api/notifications/push-diagnose')
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send(koerper);

    it('VERBOTEN: Freitext im Hinweis erscheint nicht, die Fehlercodes schon', async () => {
      const hinweis = 'versuche=3 java.io.IOException: SERVICE_NOT_AVAILABLE anna.mustermann@example.test Anna Müller';
      const res = await melden({
        grund: 'getToken-fehler', berechtigung: 'granted', plattform: 'android',
        app_version: '2.3.0', app_build: '127', hinweis,
      });
      expect(res.status).toBe(200);
      const text = protokoll();
      expect(text).not.toContain('anna.mustermann');
      expect(text).not.toContain('Müller');
      expect(text).not.toContain('java.io');
      expect(text).toContain(`hinweis=[versuche=3 SERVICE_NOT_AVAILABLE] (${hinweis.length} Zeichen)`);
    });

    it('VERBOTEN: Werte, die nicht wie ein Kennwort aussehen, werden ersetzt', async () => {
      await melden({
        grund: 'Anna Müller\n[PUSH-DIAGNOSE] gefaelscht', berechtigung: 'ich bin ein Satz',
        plattform: 'Anna', app_version: 'Anna 1.0', app_build: 'Anna',
      });
      const text = protokoll();
      expect(text).not.toContain('Anna');
      expect(text).not.toContain('gefaelscht');
      expect(text).toContain(`user=${USERS.konfi1.id} (konfi) grund=unlesbar berechtigung=? plattform=? app=unbekannt/? `);
    });

    it('ERLAUBT: die gewohnten Angaben stehen unveraendert im Protokoll', async () => {
      await melden({
        grund: 'kein-token-nach-anmeldung', berechtigung: 'granted', plattform: 'ios',
        app_version: '2.3.0', app_build: '233',
      });
      expect(protokoll()).toContain(
        `[PUSH-DIAGNOSE] user=${USERS.konfi1.id} (konfi) grund=kein-token-nach-anmeldung berechtigung=granted plattform=ios app=2.3.0/233 `
      );
    });
  });

  describe('Anwesenheitsliste per Mail', () => {
    it('VERBOTEN: weder Adresse noch Jahrgangsname -- ERLAUBT: Kennungen und Domain', async () => {
      vi.spyOn(emailService, 'sendKonfiMatrixEmail').mockResolvedValue({ success: true, messageId: 'test' });
      await db.query(`UPDATE users SET email = 'pastorin.beispiel@gemeinde.example' WHERE id = $1`, [USERS.orgAdmin1.id]);
      await db.query(`UPDATE jahrgaenge SET name = 'Jahrgang Nordstrand' WHERE id = $1`, [JAHRGAENGE.jahrgang1.id]);

      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ type: 'anwesenheit' });
      expect(res.status).toBe(200);

      const text = protokoll();
      expect(text).not.toContain('pastorin.beispiel');
      expect(text).not.toContain('Nordstrand');
      expect(text).toContain(
        `[matrix-email] Versand angefordert: Jahrgang ${JAHRGAENGE.jahrgang1.id}, type=anwesenheit, an=Konto ${USERS.orgAdmin1.id} (***@gemeinde.example)`
      );
    });
  });

  describe('Mailversand scheitert', () => {
    it('VERBOTEN: die Adresse steht nicht im Protokoll -- ERLAUBT: die Domain', async () => {
      const nodemailer = require('nodemailer');
      process.env.SMTP_HOST = 'mail.example.test';
      process.env.SMTP_USER = 'absender@example.test';
      process.env.SMTP_PASS = 'geheim';
      const fehler = Object.assign(new Error('Verbindung abgelehnt'), { code: 'ECONNECTION' });
      vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail: vi.fn().mockRejectedValue(fehler) }));
      try {
        await expect(emailService.sendEmail({ to: 'konfi.kind@familie.example', subject: 'x', text: 'y' }))
          .rejects.toThrow('Verbindung abgelehnt');
      } finally {
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
      }
      const text = protokoll();
      expect(text).not.toContain('konfi.kind');
      expect(text).toContain('Fehler beim Senden der E-Mail an ***@familie.example:');
    });

    it('VERBOTEN: Lizenz-Erinnerung nennt bei einem Fehler die Kennung, nicht die Adresse', async () => {
      const BackgroundService = require('../../services/backgroundService');
      vi.spyOn(emailService, 'sendLicenseExpiryReminderEmail').mockRejectedValue(new Error('SMTP weg'));
      await db.query(`UPDATE users SET email = 'leitung.person@gemeinde.example' WHERE id = $1`, [USERS.orgAdmin1.id]);
      await db.query(
        `UPDATE organizations SET is_trial = false, trial_ends_at = NOW() + interval '3 days',
                license_reminder_sent_at = NULL WHERE id = 1`
      );
      await BackgroundService.runLicenseReminders(db);
      const text = protokoll();
      expect(text).not.toContain('leitung.person');
      expect(text).toContain(`Lizenz-Erinnerung: Mail an Konto ${USERS.orgAdmin1.id} fehlgeschlagen: SMTP weg`);
    });
  });

  describe('Abgewiesener Upload', () => {
    it('VERBOTEN: der Dateiname steht nicht im Protokoll -- ERLAUBT: Endung und Typ', async () => {
      await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .field('content', 'Hallo')
        .attach('file', Buffer.from('MZ'), { filename: 'Anna_Mustermann_Taufspruch.exe', contentType: 'application/x-msdownload' });

      const text = protokoll();
      expect(text).not.toContain('Anna_Mustermann');
      expect(text).toContain('Datei abgelehnt: Endung .exe, Typ application/x-msdownload');
    });
  });

  describe('Hilfsfunktionen', () => {
    it('Adresse: nur die Domain', () => {
      expect(adresseFuersProtokoll('Anna.M@Gemeinde.Example')).toBe('***@gemeinde.example');
      expect(adresseFuersProtokoll('ohne-at')).toBe('***');
      expect(adresseFuersProtokoll('x@<script>')).toBe('***');
      expect(adresseFuersProtokoll(null)).toBe('(keine)');
    });

    it('Datei: Endung und Typ nur nach Muster', () => {
      expect(dateiFuersProtokoll({ originalname: 'Anna Müller.PDF', mimetype: 'application/pdf' }))
        .toBe('Endung .pdf, Typ application/pdf');
      expect(dateiFuersProtokoll({ originalname: 'ohne', mimetype: 'text/Anna Müller' }))
        .toBe('Endung (keine), Typ ?');
      expect(dateiFuersProtokoll({ originalname: 'a.Anna Müller', mimetype: 'x' }))
        .toBe('Endung (keine), Typ ?');
    });

    it('Hinweis: leer bleibt leer, "leere Antwort" wird zum Kennwort', () => {
      expect(diagnoseHinweisFuersProtokoll(undefined)).toBe('');
      expect(diagnoseHinweisFuersProtokoll('versuche=3 leere Antwort'))
        .toBe('hinweis=[versuche=3 leere-antwort] (24 Zeichen)');
    });
  });
});
