// Passwort-Reset-Grenzen: je Absender-IP UND je Ziel-E-Mail
// (Audit 26.09.2026, Sicherheit BF-05, HOCH).
//
// Der Reset-Limiter in routes/auth.js zaehlte auf req.ip -- und req.ip ist
// hinter dem Proxy fuer alle Anfragen dieselbe Adresse (Produktionsbefund in
// server.js). Folge: fuenf Passwort-Reset-Anfragen je Viertelstunde fuer die
// GESAMTE Plattform. Bei 10.000 bis 25.000 Nutzer:innen ist die Funktion
// damit praktisch nicht verfuegbar, und ein Dritter sperrt sie mit fuenf
// Anfragen fuer alle.
//
// Jetzt zaehlt der Limiter wie alle uebrigen auf clientIp() (X-Real-IP vom
// vertrauten Proxy) und zusaetzlich je E-Mail-Adresse: Eine einzelne
// Adresse laesst sich nicht von vielen Absendern aus bombardieren.
//
// Die Limiter halten ihren Stand im Prozess. Jeder Test benutzt deshalb
// eigene Adressen und eigene E-Mails, damit sich die Tests nicht gegenseitig
// die Kontingente leeren. supertest verbindet ueber Loopback -- der Peer gilt
// als Proxy, X-Real-IP wird angenommen (utils/clientIp.js).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');

describe('POST /api/auth/request-password-reset: Grenzen je IP und je E-Mail', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  const anfrage = (ip, email) =>
    request(app)
      .post('/api/auth/request-password-reset')
      .set('X-Real-IP', ip)
      .send({ email });

  it('sechs Anfragen von sechs verschiedenen Adressen: keine wird abgewiesen', async () => {
    const status = [];
    for (let i = 1; i <= 6; i++) {
      const res = await anfrage(`198.51.100.${i}`, `nutzer${i}@beispiel.test`);
      status.push(res.status);
    }
    expect(status).toEqual([200, 200, 200, 200, 200, 200]);
  });

  it('sechs Anfragen von derselben Adresse: die sechste wird mit 429 abgewiesen', async () => {
    const status = [];
    let letzte;
    for (let i = 1; i <= 6; i++) {
      letzte = await anfrage('198.51.100.50', `absender${i}@beispiel.test`);
      status.push(letzte.status);
    }
    expect(status).toEqual([200, 200, 200, 200, 200, 429]);
    expect(letzte.body).toEqual({
      error: 'Zu viele Passwort-Reset-Anfragen. Bitte warte 15 Minuten.',
    });
  });

  it('dieselbe E-Mail von verschiedenen Adressen: ab der vierten Anfrage 429', async () => {
    const status = [];
    let letzte;
    for (let i = 60; i <= 63; i++) {
      letzte = await anfrage(`198.51.100.${i}`, 'ziel@beispiel.test');
      status.push(letzte.status);
    }
    expect(status).toEqual([200, 200, 200, 429]);
    expect(letzte.body).toEqual({
      error: 'Zu viele Passwort-Reset-Anfragen für diese E-Mail-Adresse. Bitte warte eine Stunde.',
    });
  });

  it('die E-Mail-Grenze kennt keine Gross- und Kleinschreibung und keinen Leerraum', async () => {
    for (let i = 70; i <= 72; i++) {
      expect((await anfrage(`198.51.100.${i}`, 'Anna.Schmidt@Beispiel.test')).status).toBe(200);
    }
    const vierte = await anfrage('198.51.100.73', '  anna.schmidt@beispiel.test ');
    expect(vierte.status).toBe(429);
  });

  it('eine andere E-Mail bleibt frei, auch wenn eine Adresse gesperrt ist', async () => {
    for (let i = 80; i <= 82; i++) {
      expect((await anfrage(`198.51.100.${i}`, 'gesperrt@beispiel.test')).status).toBe(200);
    }
    expect((await anfrage('198.51.100.83', 'gesperrt@beispiel.test')).status).toBe(429);

    const andere = await anfrage('198.51.100.84', 'frei@beispiel.test');
    expect(andere.status).toBe(200);
    expect(andere.body.message).toBe(
      'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Reset-E-Mail gesendet'
    );
  });

  it('die E-Mail-Grenze verraet nicht, ob es das Konto gibt: bekannte und unbekannte Adresse gleich', async () => {
    // Seed-User haben keine E-Mail; eine bekannte Adresse anlegen.
    await db.query('UPDATE users SET email = $1 WHERE id = $2', ['bekannt@beispiel.test', 1]);

    const bekannt = [];
    const unbekannt = [];
    for (let i = 90; i <= 93; i++) {
      bekannt.push((await anfrage(`198.51.100.${i}`, 'bekannt@beispiel.test')).status);
      unbekannt.push((await anfrage(`198.51.100.${i}`, 'unbekannt@beispiel.test')).status);
    }
    expect(bekannt).toEqual([200, 200, 200, 429]);
    expect(unbekannt).toEqual([200, 200, 200, 429]);
  });
});
