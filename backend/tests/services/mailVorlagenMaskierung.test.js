// Jeder eingesetzte Wert im Mail-HTML ist maskiert
// (Audit Chat/Challenges/Rückblick BF-11, 29.09.2026).
//
// Anzeigename, Gemeinde- und Jahrgangsname sind frei wählbar. Lizenz- und
// Löschwarnung setzten sie roh ins HTML -- ein Name wie
// '<a href="https://boese.example">Hier klicken</a>' wurde in der Mail zum
// Link. Geprüft wird, was der Dienst wirklich an nodemailer übergibt; kein
// Mailserver (dasselbe Muster wie tests/routes/passwortMails.test.js).
const nodemailer = require('nodemailer');

const sendMail = vi.fn();

const BOESE = '<a href="https://boese.example">Hier klicken</a> & \'x\'';
const MASKIERT = '&lt;a href=&quot;https://boese.example&quot;&gt;Hier klicken&lt;/a&gt; &amp; &#39;x&#39;';

describe('Mail-Vorlagen maskieren alle eingesetzten Werte', () => {
  let mail;

  beforeAll(() => {
    process.env.SMTP_HOST = 'mail.example.test';
    process.env.SMTP_USER = 'absender@example.test';
    process.env.SMTP_PASS = 'geheim';
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => ({ sendMail }));
    mail = require('../../services/emailService');
  });

  afterAll(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
  });

  const gesendet = () => {
    expect(sendMail).toHaveBeenCalledTimes(1);
    return sendMail.mock.calls[0][0];
  };

  // Kein roher Tag aus der Eingabe im HTML, dafür die maskierte Fassung.
  function pruefeMaskiert(html, anzahl) {
    expect(html).not.toContain('<a href="https://boese.example">');
    expect(html.split(MASKIERT).length - 1).toBe(anzahl);
  }

  describe('VERBOTEN: roher Name im HTML', () => {
    it('Lizenz-Erinnerung: Name und Gemeinde', async () => {
      await mail.sendLicenseExpiryReminderEmail('a@example.test', BOESE, BOESE, new Date('2026-10-15T10:00:00Z'), 7);
      pruefeMaskiert(gesendet().html, 2);
    });

    it('Löschwarnung Jahrgang: Name, Gemeinde und Jahrgang', async () => {
      await mail.sendJahrgangDeletionWarningEmail('a@example.test', BOESE, BOESE, BOESE, 3);
      pruefeMaskiert(gesendet().html, 3);
    });

    it('Löschwarnung Jahrgang: kein Zeilenumbruch aus dem Jahrgangsnamen im Betreff', async () => {
      await mail.sendJahrgangDeletionWarningEmail('a@example.test', 'Pastorin', 'Gemeinde', 'JG\r\nBcc: x@example.test', 3);
      expect(gesendet().subject).toBe('Jahrgang "JG Bcc: x@example.test" wird in 3 Tagen gelöscht - Konfi Quest');
    });

    it('Passwort vergessen: Name, Gemeinde, Benutzername und Link', async () => {
      await mail.sendPasswordResetEmail('a@example.test', BOESE, 'tok', 'https://konfi-quest.de/reset?token="><b>x</b>', {
        gemeinde: BOESE,
        benutzername: BOESE,
      });
      const { html } = gesendet();
      pruefeMaskiert(html, 3);
      expect(html).toContain('href="https://konfi-quest.de/reset?token=&quot;&gt;&lt;b&gt;x&lt;/b&gt;"');
      expect(html).not.toContain('<b>x</b>');
    });

    it('Passwort geändert durch die Leitung: Name und Gemeinde', async () => {
      await mail.sendPasswordChangedEmail('a@example.test', BOESE, { durchLeitung: true, gemeinde: BOESE });
      pruefeMaskiert(gesendet().html, 2);
    });

    it('Einladung in eine Gemeinde: Name, Gemeinde und Rolle', async () => {
      await mail.sendGemeindeEinladungEmail('a@example.test', BOESE, BOESE, BOESE, '2026-10-13T10:00:00Z');
      pruefeMaskiert(gesendet().html, 3);
    });

    it('Anwesenheit und Konfisprüche: Leitung, Jahrgang und jede Zeile', async () => {
      await mail.sendKonfiMatrixEmail('a@example.test', BOESE, BOESE, 'anwesenheit', [
        { display_name: BOESE, present_count: 1, total_count: 2 },
      ]);
      pruefeMaskiert(gesendet().html, 3);
    });
  });

  describe('ERLAUBT: gewöhnliche Namen bleiben lesbar', () => {
    it('Umlaute und Bindestrich stehen unverändert im HTML, der Textteil bleibt Klartext', async () => {
      await mail.sendJahrgangDeletionWarningEmail('a@example.test', 'Jörg Müller-Lüdenscheidt', 'Kirchspiel Süd', '2025/2026 Nord', 5);
      const { html, text } = gesendet();
      expect(html).toContain('Hallo Jörg Müller-Lüdenscheidt!');
      expect(html).toContain('<strong>2025/2026 Nord</strong>');
      expect(html).toContain('<strong>Kirchspiel Süd</strong>');
      expect(html).toContain('Löschung in 5 Tagen');
      expect(text).toContain('der Jahrgang "2025/2026 Nord" in eurer Gemeinde "Kirchspiel Süd"');
    });

    it('der Textteil setzt auch Sonderzeichen unmaskiert ein (kein HTML)', async () => {
      await mail.sendLicenseExpiryReminderEmail('a@example.test', 'A & B', 'Gemeinde "Ost"', new Date('2026-10-15T10:00:00Z'), 1);
      const { html, text } = gesendet();
      expect(text).toContain('Hallo A & B,');
      expect(text).toContain('Gemeinde "Gemeinde "Ost""');
      expect(html).toContain('Hallo A &amp; B!');
      expect(html).toContain('<strong>Gemeinde &quot;Ost&quot;</strong>');
      expect(html).toContain('noch 1 Tag</div>');
    });

    it('der Link im Knopf bleibt benutzbar: & wird zu &amp; im Attribut', async () => {
      await mail.sendPasswordResetEmail('a@example.test', 'Anna', 'tok', 'https://konfi-quest.de/reset?token=abc&x=1');
      expect(gesendet().html).toContain('href="https://konfi-quest.de/reset?token=abc&amp;x=1"');
    });
  });
});
