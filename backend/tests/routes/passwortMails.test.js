// PASSWORT-MAILS: Bestaetigung nach jeder Passwortaenderung, und "Passwort
// vergessen" erreicht jedes Konto zur Adresse.
//
// Befund BF-20 (Bericht "Wer bekommt was", 27.09.2026), zwei Teile:
//  1. "Passwort vergessen" nahm den ERSTEN Treffer zu `u.email = $1` -- ohne
//     deleted_at und is_active. Die E-Mail ist nur je Gemeinde eindeutig;
//     trugen zwei Konten in zwei Gemeinden dieselbe Adresse, bekam nur eines
//     den Link. Geloeschte und gesperrte Konten bekamen ihn auch.
//  2. emailService.sendPasswordChangedEmail existierte und wurde nie gerufen.
//
// Simons Entscheidung zu F-12 (27.09.2026, "ja" wie empfohlen): Bestaetigung
// an die hinterlegte Adresse, fuer Konten mit E-Mail.
//
// Kein Mailserver: nodemailer.createTransport ist ersetzt (dasselbe Muster
// wie tests/utils/smtpKonfiguration.test.js), geprueft wird, was der Dienst
// wirklich senden wuerde -- Empfaenger, Betreff, Text.
const request = require('supertest');
const nodemailer = require('nodemailer');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const sendMail = vi.fn();

const ADRESSE = 'person@beispiel.test';
const NEU = 'GanzNeu123!';

describe('Passwort-Mails', () => {
  let app, db;

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

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
  });

  const adresseSetzen = (userId, adresse = ADRESSE) =>
    db.query('UPDATE users SET email = $1 WHERE id = $2', [adresse, userId]);

  /** Die gesendeten Mails als {to, subject, text}. */
  const mails = () => sendMail.mock.calls.map(([m]) => ({ to: m.to, subject: m.subject, text: m.text, html: m.html }));

  const anmelden = (username, password) => request(app)
    .post('/api/auth/login')
    .send({ username, password });

  // ==================================================================
  // Bestaetigung nach einer Passwortaenderung
  // ==================================================================
  describe('Bestaetigung nach einer Passwortaenderung', () => {
    it('selbst geaendert: eine Mail an die hinterlegte Adresse, ohne das Passwort', async () => {
      await adresseSetzen(USERS.konfi1.id);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({ currentPassword: PASSWORD, newPassword: NEU });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Passwort erfolgreich geändert');
      await warteAufNachwehen(app);

      const gesendet = mails();
      expect(gesendet).toHaveLength(1);
      expect(gesendet[0].to).toBe(ADRESSE);
      expect(gesendet[0].subject).toBe('Passwort geändert - Konfi Quest');
      expect(gesendet[0].text).toContain('Hallo Test Konfi 1,');
      expect(gesendet[0].text).toContain('dein Passwort für Konfi Quest wurde erfolgreich geändert.');
      expect(gesendet[0].text).not.toContain(NEU);
      expect(gesendet[0].html).not.toContain(NEU);
    });

    it('verboten: ohne hinterlegte Adresse geht keine Mail raus', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({ currentPassword: PASSWORD, newPassword: NEU });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);

      expect(mails()).toEqual([]);
    });

    it('verboten: ein abgelehnter Wechsel (falsches aktuelles Passwort) schickt nichts', async () => {
      await adresseSetzen(USERS.konfi1.id);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({ currentPassword: 'falsch-falsch', newPassword: NEU });
      expect(res.status).toBe(400);
      await warteAufNachwehen(app);

      expect(mails()).toEqual([]);
    });

    it('scheitert der Versand, gilt das neue Passwort trotzdem', async () => {
      await adresseSetzen(USERS.konfi1.id);
      sendMail.mockRejectedValue(Object.assign(new Error('Mailserver weg'), { code: 'EENVELOPE' }));
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({ currentPassword: PASSWORD, newPassword: NEU });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
      fehler.mockRestore();

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect((await anmelden(USERS.konfi1.username, NEU)).status).toBe(200);
      expect((await anmelden(USERS.konfi1.username, PASSWORD)).status).toBe(401);
    });

    it('per Link aus "Passwort vergessen": Bestaetigung an die Adresse', async () => {
      await adresseSetzen(USERS.teamer1.id);
      const token = 'link-token-bestaetigung';
      await db.query(
        `INSERT INTO password_resets (user_id, user_type, token, expires_at)
         VALUES ($1, 'teamer', $2, NOW() + INTERVAL '1 hour')`,
        [USERS.teamer1.id, require('crypto').createHash('sha256').update(token).digest('hex')]
      );

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: NEU });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Passwort erfolgreich zurückgesetzt' });
      await warteAufNachwehen(app);

      const gesendet = mails();
      expect(gesendet.map((m) => m.to)).toEqual([ADRESSE]);
      expect(gesendet[0].subject).toBe('Passwort geändert - Konfi Quest');
    });

    it('die Leitung setzt ein Passwort (Benutzerverwaltung): Mail nennt die Leitung, nicht das Passwort', async () => {
      await adresseSetzen(USERS.admin1.id);

      const res = await request(app)
        .put(`/api/users/${USERS.admin1.id}/reset-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ password: NEU });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Passwort erfolgreich zurückgesetzt' });
      await warteAufNachwehen(app);

      const gesendet = mails();
      expect(gesendet.map((m) => m.to)).toEqual([ADRESSE]);
      expect(gesendet[0].text).toContain(
        'die Leitung deiner Gemeinde (Test-Gemeinde St. Martin) hat ein neues Passwort für dein Konto bei Konfi Quest gesetzt.'
      );
      expect(gesendet[0].text).toContain('Das Passwort selbst steht nicht in dieser Mail');
      expect(gesendet[0].text).not.toContain(NEU);
      expect(gesendet[0].html).not.toContain(NEU);
    });

    it('die Leitung setzt ein Passwort beim Bearbeiten: Mail; ohne Passwort im Formular: keine', async () => {
      await adresseSetzen(USERS.admin1.id);
      const orgAdmin = generateToken('orgAdmin1');

      const nurName = await request(app)
        .put(`/api/users/${USERS.admin1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`)
        .send({ display_name: 'Admin Eins' });
      expect(nurName.status).toBe(200);
      await warteAufNachwehen(app);
      expect(mails()).toEqual([]);

      const mitPasswort = await request(app)
        .put(`/api/users/${USERS.admin1.id}`)
        .set('Authorization', `Bearer ${orgAdmin}`)
        .send({ password: NEU });
      expect(mitPasswort.status).toBe(200);
      await warteAufNachwehen(app);

      const gesendet = mails();
      expect(gesendet.map((m) => m.to)).toEqual([ADRESSE]);
      expect(gesendet[0].text).toContain('die Leitung deiner Gemeinde');
      expect(gesendet[0].text).toContain('Hallo Admin Eins,');
      expect(gesendet[0].text).not.toContain(NEU);
    });

    it('Einmalpasswort fuer eine Konfi: Mail an ihre Adresse, das Einmalpasswort steht nicht darin', async () => {
      await adresseSetzen(USERS.konfi1.id);

      const res = await request(app)
        .post(`/api/admin/konfis/${USERS.konfi1.id}/regenerate-password`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.temporaryPassword).toBe('string');
      await warteAufNachwehen(app);

      const gesendet = mails();
      expect(gesendet.map((m) => m.to)).toEqual([ADRESSE]);
      expect(gesendet[0].text).toContain('die Leitung deiner Gemeinde');
      expect(gesendet[0].text).not.toContain(res.body.temporaryPassword);
      expect(gesendet[0].html).not.toContain(res.body.temporaryPassword);
    });
  });

  // ==================================================================
  // "Passwort vergessen": welche Konten einen Link bekommen
  // ==================================================================
  describe('"Passwort vergessen" erreicht jedes Konto zur Adresse', () => {
    const NEUTRAL = { message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Reset-E-Mail gesendet' };

    const anfordern = (email) => request(app)
      .post('/api/auth/request-password-reset')
      .send({ email });

    const resetsFuer = async (userId) => Number((await db.query(
      'SELECT COUNT(*) AS n FROM password_resets WHERE user_id = $1', [userId]
    )).rows[0].n);

    /** Eine weitere Gemeinde mit einem Konto, das dieselbe Adresse traegt. */
    async function kontoInNeuerGemeinde(orgId, username, { geloescht = false, aktiv = true } = {}) {
      await db.query(
        `INSERT INTO organizations (id, name, slug, display_name, is_active)
         VALUES ($1, $2, $3, $2, true)`,
        [orgId, `Gemeinde ${orgId}`, `gemeinde-${orgId}`]
      );
      const { rows: [u] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, email, is_active, deleted_at)
         VALUES ($1, $1, 'x', $2, $3, $4, $5, $6) RETURNING id`,
        [username, ROLES.teamer.id, orgId, ADRESSE, aktiv, geloescht ? new Date() : null]
      );
      return u.id;
    }

    it('zwei Konten in zwei Gemeinden: jedes bekommt seinen eigenen Link, mit Gemeinde und Benutzername', async () => {
      await adresseSetzen(USERS.konfi1.id);
      await adresseSetzen(USERS.teamer2.id);

      const res = await anfordern(ADRESSE);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(NEUTRAL);
      await warteAufNachwehen(app);

      expect(await resetsFuer(USERS.konfi1.id)).toBe(1);
      expect(await resetsFuer(USERS.teamer2.id)).toBe(1);

      const gesendet = mails().sort((a, b) => a.subject.localeCompare(b.subject));
      expect(gesendet.map((m) => m.to)).toEqual([ADRESSE, ADRESSE]);
      expect(gesendet.map((m) => m.subject)).toEqual([
        `Passwort zurücksetzen (${ORGS.andereGemeinde.display_name}) - Konfi Quest`,
        `Passwort zurücksetzen (${ORGS.testGemeinde.display_name}) - Konfi Quest`,
      ]);
      expect(gesendet[0].text).toContain('Benutzername: teamer2');
      expect(gesendet[0].text).toContain('Hallo Test Teamer 2,');
      expect(gesendet[1].text).toContain('Benutzername: konfi1');
      expect(gesendet[1].text).toContain('Hallo Test Konfi 1,');
      // Zwei verschiedene Links.
      const link = (m) => m.text.match(/reset-password\?token=([0-9a-f]+)/)[1];
      expect(link(gesendet[0])).not.toBe(link(gesendet[1]));
    });

    it('verboten: geloeschte und gesperrte Konten bekommen keinen Link', async () => {
      await adresseSetzen(USERS.konfi1.id);
      const geloescht = await kontoInNeuerGemeinde(3, 'geloescht_drei', { geloescht: true });
      const gesperrt = await kontoInNeuerGemeinde(4, 'gesperrt_vier', { aktiv: false });

      const res = await anfordern(ADRESSE);
      expect(res.body).toEqual(NEUTRAL);
      await warteAufNachwehen(app);

      expect(await resetsFuer(geloescht)).toBe(0);
      expect(await resetsFuer(gesperrt)).toBe(0);
      expect(await resetsFuer(USERS.konfi1.id)).toBe(1);
      expect(mails()).toHaveLength(1);
    });

    it('ein einziges Konto: die Mail bleibt, wie sie war -- ohne Gemeinde-Zeile, Link 24 Stunden', async () => {
      await adresseSetzen(USERS.konfi1.id);

      await anfordern(ADRESSE);
      await warteAufNachwehen(app);

      const gesendet = mails();
      expect(gesendet).toHaveLength(1);
      expect(gesendet[0].subject).toBe('Passwort zurücksetzen - Konfi Quest');
      expect(gesendet[0].text).not.toContain('Benutzername:');
      expect(gesendet[0].text).toContain('Dieser Link ist 24 Stunden gültig.');
    });

    it('verboten: nur ein geloeschtes und ein gesperrtes Konto zur Adresse -- dieselbe Antwort wie fuer eine unbekannte, kein Link', async () => {
      const geloescht = await kontoInNeuerGemeinde(3, 'nur_geloescht', { geloescht: true });
      const gesperrt = await kontoInNeuerGemeinde(4, 'nur_gesperrt', { aktiv: false });

      const bekannt = await anfordern(ADRESSE);
      const unbekannt = await anfordern('niemand@beispiel.test');
      await warteAufNachwehen(app);

      expect(bekannt.status).toBe(200);
      expect(bekannt.body).toEqual(unbekannt.body);
      expect(bekannt.body).toEqual(NEUTRAL);
      expect(await resetsFuer(geloescht)).toBe(0);
      expect(await resetsFuer(gesperrt)).toBe(0);
      expect(mails()).toEqual([]);
    });

    it('scheitert der Versand, bleibt die Antwort neutral', async () => {
      await adresseSetzen(USERS.konfi1.id);
      sendMail.mockRejectedValue(Object.assign(new Error('Mailserver weg'), { code: 'EENVELOPE' }));
      const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await anfordern(ADRESSE);
      await warteAufNachwehen(app);
      fehler.mockRestore();

      expect(res.status).toBe(200);
      expect(res.body).toEqual(NEUTRAL);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });
});
