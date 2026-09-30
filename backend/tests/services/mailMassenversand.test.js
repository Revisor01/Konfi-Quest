// backend/tests/services/mailMassenversand.test.js
//
// Massenversand per Mail: gepoolt und gedrosselt (Audit 26.09.2026, Betrieb
// "Unklar: SMTP-Grenzen", 29.09.2026).
//
// Die naechtlichen Laeufe (Lizenz-Erinnerung an die Gemeindeleitungen,
// Loeschwarnung an die Jahrgangsleitungen) schreiben an viele auf einmal.
// Bis hierher baute jede Mail eine eigene SMTP-Verbindung auf, und nichts
// begrenzte die Rate -- die Grenze des Anbieters ist nicht bekannt. Jetzt:
// eine gepoolte Verbindung fuer den Lauf und hoechstens
// SMTP_MASSEN_JE_MINUTE Mails je Minute. Einzelmails bleiben beim
// bisherigen Transport, damit sie nicht hinter einem Lauf warten.
//
// Geprueft gegen einen kleinen SMTP-Server in diesem Test (nur 127.0.0.1),
// der Verbindungen und Mails zaehlt.
const net = require('net');
const nodemailer = require('nodemailer');
const {
  smtpKonfiguration, smtpMassenKonfiguration, MASSEN_STANDARD_JE_MINUTE,
} = require('../../utils/smtpKonfiguration');

function smtpAttrappe() {
  const stand = { verbindungen: 0, mails: 0, zeiten: [] };
  const server = net.createServer((socket) => {
    stand.verbindungen++;
    let imData = false;
    let puffer = '';
    socket.write('220 attrappe ESMTP\r\n');
    socket.on('data', (teil) => {
      puffer += teil.toString('utf8');
      let ende;
      while ((ende = puffer.indexOf('\r\n')) >= 0) {
        const zeile = puffer.slice(0, ende);
        puffer = puffer.slice(ende + 2);
        if (imData) {
          if (zeile === '.') {
            imData = false;
            stand.mails++;
            stand.zeiten.push(Date.now());
            socket.write('250 angenommen\r\n');
          }
          continue;
        }
        const befehl = zeile.slice(0, 4).toUpperCase();
        if (befehl === 'EHLO') socket.write('250-attrappe\r\n250 AUTH PLAIN\r\n');
        else if (befehl === 'HELO') socket.write('250 attrappe\r\n');
        else if (befehl === 'AUTH') socket.write('235 ok\r\n');
        else if (befehl === 'DATA') { imData = true; socket.write('354 los\r\n'); }
        else if (befehl === 'QUIT') { socket.write('221 tschuess\r\n'); socket.end(); }
        else socket.write('250 ok\r\n');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, stand, port: server.address().port }));
  });
}

const umgebung = (port, extra = {}) => ({
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false',
  SMTP_USER: 'post@example.test', SMTP_PASS: 'x', ...extra,
});

const mail = (i) => ({ from: 'post@example.test', to: `leitung${i}@example.test`, subject: `Erinnerung ${i}`, text: 'x' });

describe('smtpMassenKonfiguration', () => {
  it('gepoolt, eine Verbindung, Standard 20 Mails je Minute', () => {
    const k = smtpMassenKonfiguration(umgebung(25));
    expect(k).toMatchObject({ pool: true, maxConnections: 1, maxMessages: 100, rateDelta: 60000, rateLimit: 20 });
    expect(MASSEN_STANDARD_JE_MINUTE).toBe(20);
    // Alles Uebrige wie beim Einzeltransport (Host, TLS-Pruefung, ...).
    const { pool, maxConnections, maxMessages, rateDelta, rateLimit, ...rest } = k;
    expect(rest).toEqual(smtpKonfiguration(umgebung(25)));
  });

  it('SMTP_MASSEN_JE_MINUTE setzt die Grenze; Unsinn faellt auf den Standard zurueck', () => {
    expect(smtpMassenKonfiguration(umgebung(25, { SMTP_MASSEN_JE_MINUTE: '5' })).rateLimit).toBe(5);
    for (const wert of ['0', '-3', 'viel', '']) {
      expect(smtpMassenKonfiguration(umgebung(25, { SMTP_MASSEN_JE_MINUTE: wert })).rateLimit).toBe(20);
    }
  });
});

describe('Versand von zehn Mails an den Attrappen-Server', () => {
  let attrappe;
  beforeEach(async () => { attrappe = await smtpAttrappe(); });
  afterEach(async () => { await new Promise((r) => attrappe.server.close(r)); });

  it('Einzeltransport (Ausgangslage): eine Verbindung je Mail', async () => {
    const t = nodemailer.createTransport(smtpKonfiguration(umgebung(attrappe.port)));
    for (let i = 0; i < 10; i++) await t.sendMail(mail(i));
    t.close();
    expect(attrappe.stand.mails).toBe(10);
    expect(attrappe.stand.verbindungen).toBe(10);
  });

  it('Massentransport: eine Verbindung fuer alle, und die Drosselung haelt die Grenze', async () => {
    // Zeitfenster fuer den Test verkuerzt: 4 Mails je 1000 ms statt 20 je Minute.
    //
    // Fenster und Schwelle gemessen (30.09.2026): Die Pruefung stand bei
    // 4 je 400 ms und verlangte >= 390 ms zwischen Mail i und i+4. Gemessen
    // sind das 364-404 ms -- nodemailer zaehlt die Fenster nach seiner eigenen
    // Uhr ab Sendebeginn, die Attrappe stempelt beim Empfang des Mailendes, und
    // das schwankt je Mail um einige zehn Millisekunden. Der Test fiel dadurch
    // lokal in 4 von 15 Laeufen. OHNE Drosselung liegen dieselben Abstaende
    // bei 176-184 ms (eine Verbindung, Mails nacheinander). Mit 1000 ms
    // Fenster und 800 ms Schwelle bleiben 200 ms Spiel nach unten und ein
    // Vierfaches Abstand zum ungedrosselten Fall.
    const t = nodemailer.createTransport(smtpMassenKonfiguration(
      umgebung(attrappe.port, { SMTP_MASSEN_JE_MINUTE: '4' }), { zeitfensterMs: 1000 }
    ));
    const beginn = Date.now();
    await Promise.all(Array.from({ length: 10 }, (_, i) => t.sendMail(mail(i))));
    const dauer = Date.now() - beginn;
    t.close();

    expect(attrappe.stand.mails).toBe(10);
    expect(attrappe.stand.verbindungen).toBe(1);
    // 10 Mails bei 4 je Fenster brauchen mindestens zwei volle Fenster.
    expect(dauer).toBeGreaterThanOrEqual(2000);
    // Zwischen Mail i und Mail i+4 liegt jeweils (fast) ein ganzes Fenster.
    const zeiten = attrappe.stand.zeiten;
    for (let i = 0; i + 4 < zeiten.length; i++) {
      expect(zeiten[i + 4] - zeiten[i]).toBeGreaterThanOrEqual(800);
    }
  }, 10000);
});

describe('emailService: die naechtlichen Laeufe nutzen den Massentransport', () => {
  let attrappe;
  let emailService;
  const alteUmgebung = { ...process.env };

  beforeEach(async () => {
    attrappe = await smtpAttrappe();
    Object.assign(process.env, umgebung(attrappe.port));
    delete require.cache[require.resolve('../../services/emailService')];
    emailService = require('../../services/emailService');
  });

  afterEach(async () => {
    emailService.transporteSchliessen();
    for (const k of Object.keys(process.env)) if (!(k in alteUmgebung)) delete process.env[k];
    Object.assign(process.env, alteUmgebung);
    await new Promise((r) => attrappe.server.close(r));
  });

  it('fuenf Lizenz-Erinnerungen und fuenf Loeschwarnungen: eine Verbindung', async () => {
    for (let i = 0; i < 5; i++) {
      await emailService.sendLicenseExpiryReminderEmail(`org${i}@example.test`, 'Leitung', 'Gemeinde', new Date(), 7);
      await emailService.sendJahrgangDeletionWarningEmail(`jg${i}@example.test`, 'Leitung', 'Gemeinde', 'Jahrgang', 7);
    }
    expect(attrappe.stand.mails).toBe(10);
    expect(attrappe.stand.verbindungen).toBe(1);
  });

  it('eine Einzelmail (Passwort-Reset) laeuft weiter ueber den Einzeltransport', async () => {
    await emailService.sendPasswordResetEmail('konfi@example.test', 'Konfi', 'token', 'https://example.test/reset');
    await emailService.sendPasswordResetEmail('konfi2@example.test', 'Konfi', 'token', 'https://example.test/reset');
    expect(attrappe.stand.mails).toBe(2);
    expect(attrappe.stand.verbindungen).toBe(2);
  });
});
