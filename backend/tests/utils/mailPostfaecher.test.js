// backend/tests/utils/mailPostfaecher.test.js
//
// Konfiguration der Postfaecher "moin" und "support" aus der Umgebung
// (utils/mailPostfaecher.js; docs/planung/support-mail.md, "Zugangsdaten").
//
// Eingerichtet nur mit Benutzer, Passwort und IMAP-Host. Die Referenz-Compose
// reicht nicht gesetzte Variablen als LEEREN Text durch (`${VAR:-}`) -- leer
// muss deshalb genau wie "fehlt" wirken (Nachtrag des Koordinators,
// 03.10.2026).
const {
  postfachKonfig, allePostfaecher, smtpOptionen, imapOptionen, nichtEingerichtetMeldung,
} = require('../../utils/mailPostfaecher');

const VOLL = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '465',
});

describe('postfachKonfig', () => {
  it('Vorgaben: Adressen moin@ und support@, IMAP-Port 993, SMTP wie SMTP_HOST/SMTP_PORT', () => {
    expect(postfachKonfig('moin', VOLL)).toEqual({
      postfach: 'moin',
      adresse: 'moin@konfi-quest.de',
      eingerichtet: true,
      versandBereit: true,
      imap: { host: 'imap.example.test', port: 993, user: 'moin-benutzer', pass: 'geheim' },
      smtp: { host: 'smtp.example.test', port: 465 },
    });
    expect(postfachKonfig('support', VOLL)).toMatchObject({ adresse: 'support@konfi-quest.de', eingerichtet: false });
  });

  it('eigene Werte gehen vor: Adresse (klein), IMAP-Port, SMTP-Host und -Port', () => {
    const k = postfachKonfig('support', {
      ...VOLL,
      MAIL_SUPPORT_ADRESSE: ' Hilfe@Example.test ',
      MAIL_SUPPORT_USER: 's',
      MAIL_SUPPORT_PASS: 'p',
      MAIL_IMAP_PORT: '1993',
      MAIL_SMTP_HOST: 'mail-smtp.example.test',
      MAIL_SMTP_PORT: '587',
    });
    expect(k).toMatchObject({
      adresse: 'hilfe@example.test',
      eingerichtet: true,
      imap: { port: 1993, user: 's', pass: 'p' },
      smtp: { host: 'mail-smtp.example.test', port: 587 },
    });
  });

  it.each([
    ['ohne Benutzer', { MAIL_MOIN_USER: undefined }],
    ['ohne Passwort', { MAIL_MOIN_PASS: undefined }],
    ['ohne IMAP-Host', { MAIL_IMAP_HOST: undefined }],
  ])('nicht eingerichtet: %s', (_fall, aenderung) => {
    const env = { ...VOLL, ...aenderung };
    for (const [k, v] of Object.entries(aenderung)) if (v === undefined) delete env[k];
    expect(postfachKonfig('moin', env)).toMatchObject({ eingerichtet: false, versandBereit: false });
  });

  it('LEERE Werte (Compose `${VAR:-}`) ergeben dieselbe Konfiguration wie fehlende Variablen', () => {
    const fehlend = { MAIL_IMAP_HOST: 'imap.example.test', MAIL_MOIN_USER: 'u', MAIL_MOIN_PASS: 'p', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465' };
    const leer = {
      ...fehlend,
      MAIL_IMAP_PORT: '', MAIL_SMTP_HOST: '', MAIL_SMTP_PORT: '  ', MAIL_MOIN_ADRESSE: '',
      MAIL_SUPPORT_ADRESSE: '', MAIL_SUPPORT_USER: '', MAIL_SUPPORT_PASS: '',
    };
    expect(allePostfaecher(leer)).toEqual(allePostfaecher(fehlend));
    expect(postfachKonfig('moin', leer)).toMatchObject({
      adresse: 'moin@konfi-quest.de', imap: { port: 993 }, smtp: { host: 'smtp.example.test', port: 465 },
    });
    expect(smtpOptionen(postfachKonfig('moin', leer), leer)).toEqual(smtpOptionen(postfachKonfig('moin', fehlend), fehlend));
    expect(imapOptionen(postfachKonfig('moin', leer), leer)).toEqual(imapOptionen(postfachKonfig('moin', fehlend), fehlend));
  });

  it('leerer Benutzer, leeres Passwort oder leerer IMAP-Host: nicht eingerichtet', () => {
    for (const name of ['MAIL_MOIN_USER', 'MAIL_MOIN_PASS', 'MAIL_IMAP_HOST']) {
      expect([name, postfachKonfig('moin', { ...VOLL, [name]: '' }).eingerichtet]).toEqual([name, false]);
      expect([name, postfachKonfig('moin', { ...VOLL, [name]: '   ' }).eingerichtet]).toEqual([name, false]);
    }
  });

  it('das Passwort bleibt, wie es ist (Leerzeichen am Rand gehören dazu)', () => {
    expect(postfachKonfig('moin', { ...VOLL, MAIL_MOIN_PASS: ' mit leer ' }).imap.pass).toBe(' mit leer ');
  });

  it('ohne SMTP-Host (weder eigener noch allgemeiner): eingerichtet zum Abholen, aber nicht versandbereit', () => {
    const env = { ...VOLL };
    delete env.SMTP_HOST;
    expect(postfachKonfig('moin', env)).toMatchObject({ eingerichtet: true, versandBereit: false });
  });

  it('unbekanntes Postfach wirft', () => {
    expect(() => postfachKonfig('team', VOLL)).toThrow('Unbekanntes Postfach: team');
  });

  it('Meldung „nicht eingerichtet“ nennt die Adresse', () => {
    expect(nichtEingerichtetMeldung(postfachKonfig('support', {}))).toBe('Das Postfach support@konfi-quest.de ist noch nicht eingerichtet.');
  });
});

describe('smtpOptionen', () => {
  it('Anmeldung des Postfachs, Host und Port wie der bisherige Versand, Zertifikat geprüft', () => {
    const k = postfachKonfig('moin', VOLL);
    expect(smtpOptionen(k, VOLL)).toEqual({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: { user: 'moin-benutzer', pass: 'geheim' },
      tls: { rejectUnauthorized: true },
    });
  });

  it('eigener Port 587: STARTTLS als Pflicht (requireTLS), nie Klartext', () => {
    const env = { ...VOLL, MAIL_SMTP_PORT: '587' };
    expect(smtpOptionen(postfachKonfig('moin', env), env)).toMatchObject({ port: 587, secure: false, requireTLS: true });
  });

  it('eigener Port 465: TLS von Anfang an, auch wenn SMTP_SECURE=false für den allgemeinen Versand gilt', () => {
    const env = { ...VOLL, SMTP_SECURE: 'false', SMTP_PORT: '587', MAIL_SMTP_PORT: '465' };
    expect(smtpOptionen(postfachKonfig('moin', env), env)).toMatchObject({ port: 465, secure: true });
  });

  it('der Notnagel SMTP_TLS_REJECT_UNAUTHORIZED=false wirkt auch hier (und warnt)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const env = { ...VOLL, SMTP_TLS_REJECT_UNAUTHORIZED: 'false' };
      expect(smtpOptionen(postfachKonfig('moin', env), env).tls).toEqual({ rejectUnauthorized: false });
      expect(imapOptionen(postfachKonfig('moin', env), env).tls).toEqual({ rejectUnauthorized: false });
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('imapOptionen', () => {
  it('Port 993 mit TLS, Zertifikat geprüft, ohne Protokoll der Bibliothek', () => {
    expect(imapOptionen(postfachKonfig('moin', VOLL), VOLL)).toEqual({
      host: 'imap.example.test',
      port: 993,
      secure: true,
      auth: { user: 'moin-benutzer', pass: 'geheim' },
      tls: { rejectUnauthorized: true },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 120000,
    });
  });

  it('Port 143: STARTTLS als Pflicht', () => {
    const env = { ...VOLL, MAIL_IMAP_PORT: '143' };
    expect(imapOptionen(postfachKonfig('moin', env), env)).toMatchObject({ port: 143, secure: false, doSTARTTLS: true });
  });
});
