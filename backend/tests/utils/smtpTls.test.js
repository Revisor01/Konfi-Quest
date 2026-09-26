// SMTP prueft das Zertifikat des Mailservers (Audit 26.09.2026, Sicherheit BF-09).
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
const { smtpTlsOptionen } = require('../../utils/smtpTls');

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

// Der Mail-Transport des E-Mail-Dienstes bekommt genau diese Optionen.
// createTransport wird am echten nodemailer-Modul abgefangen (derselbe
// require-Cache wie im Dienst), damit kein Mailserver noetig ist: Geprueft
// wird, womit der Dienst den Transport baut.
//
// Der Dienst haelt den Transport im Modul und baut ihn erst nach einem
// Verbindungsfehler neu (sendEmail leert den Cache bei ECONNECTION). Der
// Ersatz-Transport wirft deshalb genau diesen Fehler: So entsteht in jedem
// Test ein frischer Transport mit den dann gueltigen Umgebungsvariablen.
describe('emailService baut den Transport mit Zertifikatspruefung', () => {
  const nodemailer = require('nodemailer');
  const emailService = require('../../services/emailService');
  let createTransport;

  beforeEach(() => {
    createTransport = vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({
      sendMail: async () => {
        throw Object.assign(new Error('Testverbindung abgelehnt'), { code: 'ECONNECTION' });
      },
    }));
    process.env.SMTP_USER = 'test@example.org';
    process.env.SMTP_PASS = 'geheim';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
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
});
