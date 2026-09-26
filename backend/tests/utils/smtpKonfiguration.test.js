// SMTP-Konfiguration: Zertifikatspruefung (Audit 26.09.2026, Sicherheit BF-09)
// und kein eingebauter Host oder Nutzer (Sicherheit BF-12 / S-15).
//
// An beiden Stellen, die einen Mail-Transport bauen (server.js und
// services/emailService.js), stand `tls: { rejectUnauthorized: false }`: Der
// Versand nahm jedes Zertifikat an. Ueber diesen Kanal gehen Reset-Links,
// Gemeinde-Einladungen und die Anwesenheits- und Konfispruch-Listen ganzer
// Jahrgaenge. Wer sich zwischen Backend und Mailserver setzt, las mit.
//
// Standard ist jetzt streng. Passt das Zertifikat des Anbieters nicht zum
// Hostnamen, laesst sich die Pruefung per SMTP_TLS_REJECT_UNAUTHORIZED=false
// abschalten -- mit Warnzeile im Log, damit der Zustand nicht still bleibt.
//
// Ausserdem standen an denselben Stellen ein Fallback-Hostname und eine
// Fallback-Absenderadresse im Code. Host und Nutzer kommen jetzt nur noch
// aus der Umgebung; fehlen sie, gibt es eine klare Meldung statt eines
// stillen Versands an eine eingebaute Adresse.
const fs = require('fs');
const path = require('path');
const { smtpTlsOptionen, smtpKonfiguration } = require('../../utils/smtpKonfiguration');

describe('smtpTlsOptionen', () => {
  let warn;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('Standard: streng', () => {
    it('ohne Variable: rejectUnauthorized true, keine Warnung', () => {
      expect(smtpTlsOptionen({})).toEqual({ rejectUnauthorized: true });
      expect(warn).not.toHaveBeenCalled();
    });

    it('mit anderem Wert als "false" (true, leer, 0, Tippfehler): bleibt streng', () => {
      for (const wert of ['true', '', '0', 'no', 'FALSCH', ' ']) {
        expect(smtpTlsOptionen({ SMTP_TLS_REJECT_UNAUTHORIZED: wert })).toEqual({ rejectUnauthorized: true });
      }
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('bewusst abgeschaltet', () => {
    it('SMTP_TLS_REJECT_UNAUTHORIZED=false: rejectUnauthorized false UND Warnung im Log', () => {
      expect(smtpTlsOptionen({ SMTP_TLS_REJECT_UNAUTHORIZED: 'false' })).toEqual({ rejectUnauthorized: false });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/SMTP_TLS_REJECT_UNAUTHORIZED/);
      expect(warn.mock.calls[0][0]).toMatch(/Zertifikat/);
    });

    it('Schreibweise und Leerraum sind egal ("FALSE ", " False")', () => {
      expect(smtpTlsOptionen({ SMTP_TLS_REJECT_UNAUTHORIZED: 'FALSE ' })).toEqual({ rejectUnauthorized: false });
      expect(smtpTlsOptionen({ SMTP_TLS_REJECT_UNAUTHORIZED: ' False' })).toEqual({ rejectUnauthorized: false });
      expect(warn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('smtpKonfiguration: Host und Nutzer nur aus der Umgebung', () => {
  let warn;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('erlaubt: vollstaendige Umgebung wird 1:1 uebernommen, keine Warnung', () => {
    const konfig = smtpKonfiguration({
      SMTP_HOST: 'mail.example.test',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'post@example.test',
      SMTP_PASS: 'geheim',
    });
    expect(konfig).toEqual({
      host: 'mail.example.test',
      port: 587,
      secure: false,
      auth: { user: 'post@example.test', pass: 'geheim' },
      tls: { rejectUnauthorized: true },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('Port und secure haben Voreinstellungen (465, true) -- Host und Nutzer nicht', () => {
    const konfig = smtpKonfiguration({ SMTP_HOST: 'mail.example.test', SMTP_USER: 'post@example.test', SMTP_PASS: 'x' });
    expect(konfig.port).toBe(465);
    expect(konfig.secure).toBe(true);
  });

  it('verboten: ohne SMTP_HOST kein eingebauter Host, sondern undefined und eine Warnung', () => {
    const konfig = smtpKonfiguration({ SMTP_USER: 'post@example.test', SMTP_PASS: 'x' });
    expect(konfig.host).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/SMTP_HOST/);
  });

  it('verboten: ohne SMTP_USER kein eingebauter Nutzer, sondern undefined und eine Warnung', () => {
    const konfig = smtpKonfiguration({ SMTP_HOST: 'mail.example.test', SMTP_PASS: 'x' });
    expect(konfig.auth.user).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/SMTP_USER/);
  });

  // Quelltest, ausdruecklich zugelassen (Koordination 26.09.2026): Die
  // Betriebsdaten duerfen an keiner der beiden Stellen wieder auftauchen.
  it('server.js und emailService.js enthalten weder den alten Fallback-Host noch die Fallback-Adresse', () => {
    for (const datei of ['server.js', path.join('services', 'emailService.js'), path.join('utils', 'smtpKonfiguration.js')]) {
      const quelle = fs.readFileSync(path.join(__dirname, '..', '..', datei), 'utf8');
      expect(quelle, datei).not.toMatch(/godsapp/);
      expect(quelle, datei).not.toMatch(/noreply@konfi-quest/);
    }
  });
});

// Der Mail-Transport des E-Mail-Dienstes bekommt genau diese Optionen.
// createTransport wird am echten nodemailer-Modul abgefangen (derselbe
// require-Cache wie im Dienst), damit kein Mailserver noetig ist: Geprueft
// wird, womit der Dienst den Transport baut und was er sendet.
//
// Der Dienst haelt den Transport im Modul und baut ihn erst nach einem
// Verbindungsfehler neu (sendEmail leert den Cache bei ECONNECTION). Der
// Ersatz-Transport wirft deshalb genau diesen Fehler: So entsteht in jedem
// Test ein frischer Transport mit den dann gueltigen Umgebungsvariablen.
describe('emailService baut den Transport aus der Umgebung, mit Zertifikatspruefung', () => {
  const nodemailer = require('nodemailer');
  const emailService = require('../../services/emailService');
  let createTransport;
  let sendMail;

  beforeEach(() => {
    sendMail = vi.fn(async () => {
      throw Object.assign(new Error('Testverbindung abgelehnt'), { code: 'ECONNECTION' });
    });
    createTransport = vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
    process.env.SMTP_HOST = 'mail.example.test';
    process.env.SMTP_USER = 'test@example.org';
    process.env.SMTP_PASS = 'geheim';
    delete process.env.SMTP_FROM;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.restoreAllMocks();
  });

  const versenden = () =>
    expect(emailService.sendEmail({ to: 'a@example.org', subject: 'Test', text: 'Hallo' }))
      .rejects.toThrow('Testverbindung abgelehnt');

  it('ohne Variable: rejectUnauthorized true', async () => {
    delete process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
    await versenden();

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0].tls).toEqual({ rejectUnauthorized: true });
  });

  it('mit SMTP_TLS_REJECT_UNAUTHORIZED=false: rejectUnauthorized false', async () => {
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED = 'false';
    await versenden();

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0].tls).toEqual({ rejectUnauthorized: false });
  });

  it('erlaubt: Host und Nutzer kommen aus der Umgebung, der Absender ist der SMTP-Nutzer', async () => {
    await versenden();

    const optionen = createTransport.mock.calls[0][0];
    expect(optionen.host).toBe('mail.example.test');
    expect(optionen.auth).toEqual({ user: 'test@example.org', pass: 'geheim' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].from).toBe('Konfi Quest <test@example.org>');
  });

  it('verboten: ohne SMTP_HOST wird kein Transport gebaut -- klare Meldung statt eingebautem Host', async () => {
    delete process.env.SMTP_HOST;

    await expect(emailService.sendEmail({ to: 'a@example.org', subject: 'Test', text: 'Hallo' }))
      .rejects.toThrow(/SMTP_HOST/);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('verboten: ohne SMTP_USER wird kein Transport gebaut', async () => {
    delete process.env.SMTP_USER;

    await expect(emailService.sendEmail({ to: 'a@example.org', subject: 'Test', text: 'Hallo' }))
      .rejects.toThrow(/SMTP_USER/);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
