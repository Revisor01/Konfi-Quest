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
// Die Zaehler liegen in der Datenbank (rate_limit_zaehler, Betrieb BF-09) und
// werden mit truncateAll je Test geleert; zur Sicherheit benutzt jeder Test
// trotzdem eigene Adressen und eigene E-Mails. supertest verbindet ueber Loopback -- der Peer gilt
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

  // Zwei App-Instanzen gegen dieselbe Datenbank = zwei Replicas (Betrieb
  // BF-09): Bis zum 26.09.2026 zaehlte jede fuer sich, die Grenze galt doppelt.
  const zweiteInstanz = () => getTestApp(db);

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

  describe('replica-uebergreifend: zwei Instanzen teilen sich die Grenze', () => {
    it('die sechste Anfrage derselben Adresse ueber die ZWEITE Instanz -> 429', async () => {
      const appB = zweiteInstanz();
      for (let i = 0; i < 5; i++) {
        const res = await anfrage('198.51.100.77', `replica-${i}@example.org`);
        expect(res.status).toBe(200);
      }
      const res = await request(appB)
        .post('/api/auth/request-password-reset')
        .set('X-Real-IP', '198.51.100.77')
        .send({ email: 'replica-6@example.org' });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Zu viele Passwort-Reset-Anfragen. Bitte warte 15 Minuten.');

      // Der Zaehler steht in der Datenbank -- nur so sehen ihn ZWEI PROZESSE.
      // (Im Testprozess teilen sich zwei App-Instanzen sonst denselben
      // Speicher-Zaehler; die Tabelle ist der Beweis, dass der Store greift.)
      const { rows } = await db.query(
        "SELECT schluessel, treffer FROM rate_limit_zaehler WHERE schluessel LIKE 'reset-ip:%' ORDER BY schluessel"
      );
      expect(rows.map((r) => [r.schluessel, r.treffer])).toEqual([['reset-ip:198.51.100.77', 6]]);
    });

    it('die vierte Anfrage fuer dieselbe E-Mail ueber die ZWEITE Instanz -> 429', async () => {
      const appB = zweiteInstanz();
      for (let i = 0; i < 3; i++) {
        const res = await anfrage(`203.0.113.${10 + i}`, 'ziel-replica@example.org');
        expect(res.status).toBe(200);
      }
      const res = await request(appB)
        .post('/api/auth/request-password-reset')
        .set('X-Real-IP', '203.0.113.99')
        .send({ email: 'ziel-replica@example.org' });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Zu viele Passwort-Reset-Anfragen für diese E-Mail-Adresse. Bitte warte eine Stunde.');

      const { rows } = await db.query(
        "SELECT schluessel, treffer FROM rate_limit_zaehler WHERE schluessel LIKE 'reset-email:%' ORDER BY schluessel"
      );
      expect(rows.map((r) => [r.schluessel, r.treffer])).toEqual([['reset-email:email:ziel-replica@example.org', 4]]);
    });
  });
});
