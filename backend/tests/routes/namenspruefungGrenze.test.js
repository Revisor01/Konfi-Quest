// Grenze fuer die oeffentliche Namenspruefung (Audit Sicherheit BF-18,
// 29.09.2026; seit dem 22.08.2026 als N3 in der API-Doku offen).
//
// GET /api/auth/check-username/:name verraet ohne Anmeldung, ob es einen
// Benutzernamen gibt -- bei Konfis meist vorname.nachname. Bremse war allein
// der allgemeine Flutschutz (2000 je Viertelstunde und IP).
//
// Jetzt zaehlen je IP nur die TREFFER ("vergeben"): 30 je Viertelstunde,
// danach 429. Pruefungen auf freie Namen zaehlen nicht -- eine Konfi-Gruppe,
// die sich gemeinsam aus einem WLAN registriert, prueft bei jedem Tastendruck.
// Der Zaehler liegt in rate_limit_zaehler und gilt ueber alle Replicas.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');

describe('GET /api/auth/check-username: Grenze je IP fuer Treffer', () => {
  let app;
  let db;

  beforeAll(() => {
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

  const pruefe = (name, ip, instanz = app) => request(instanz)
    .get(`/api/auth/check-username/${encodeURIComponent(name)}`)
    .set('X-Real-IP', ip);

  // Der Limiter nimmt eine nicht gezaehlte Anfrage erst NACH der Antwort
  // zurueck (express-rate-limit: decrement auf 'finish'). Vor dem Pruefen
  // des Zaehlers deshalb warten, bis er steht.
  async function zaehlerStand() {
    const { rows: [r] } = await db.query(
      "SELECT COALESCE(SUM(treffer), 0)::int AS n FROM rate_limit_zaehler WHERE schluessel LIKE 'namenspruefung%'"
    );
    return r.n;
  }
  async function warteAufZaehler(erwartet) {
    for (let i = 0; i < 40 && (await zaehlerStand()) !== erwartet; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return zaehlerStand();
  }

  async function trefferSammeln(anzahl, ip, instanz = app) {
    const status = [];
    for (let i = 0; i < anzahl; i++) {
      status.push((await pruefe(USERS.konfi1.username, ip, instanz)).status);
    }
    return status;
  }

  it('VERBOTEN: nach 30 Treffern von einer IP antwortet die Route 429 -- auch fuer freie Namen', async () => {
    const status = await trefferSammeln(30, '198.51.100.10');
    expect(status.filter((s) => s === 200)).toHaveLength(30);

    const danach = await pruefe(USERS.konfi2.username, '198.51.100.10');
    expect(danach.status).toBe(429);
    expect(danach.body).toEqual({ error: 'Zu viele Namensprüfungen. Bitte versuche es in 15 Minuten erneut.' });

    const frei = await pruefe('niemand.hier', '198.51.100.10');
    expect(frei.status).toBe(429);
  });

  it('VERBOTEN: eine zweite App-Instanz auf derselben Datenbank zaehlt mit (zwei Replicas)', async () => {
    await trefferSammeln(20, '198.51.100.11');
    await trefferSammeln(10, '198.51.100.11', getTestApp(db));
    const res = await pruefe(USERS.konfi1.username, '198.51.100.11');
    expect(res.status).toBe(429);
    // 30 Treffer stehen in der gemeinsamen Tabelle; die abgewiesene Anfrage
    // selbst zaehlt nicht (sie war kein Treffer).
    expect(await warteAufZaehler(30)).toBe(30);
  });

  it('ERLAUBT: 200 Pruefungen freier Namen von einer IP (Registrierung im Gemeinde-WLAN) zaehlen nicht', async () => {
    for (let i = 0; i < 200; i++) {
      const res = await pruefe(`neue.konfi${i}`, '198.51.100.12');
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
    }
    // ... und die Treffergrenze steht danach unverbraucht bei 30.
    expect(await warteAufZaehler(0)).toBe(0);
    const status = await trefferSammeln(30, '198.51.100.12');
    expect(status.every((s) => s === 200)).toBe(true);
    expect((await pruefe(USERS.konfi1.username, '198.51.100.12')).status).toBe(429);
  });

  it('ERLAUBT: eine andere IP ist nicht betroffen', async () => {
    await trefferSammeln(31, '198.51.100.13');
    const res = await pruefe(USERS.konfi1.username, '198.51.100.14');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false, message: 'Benutzername bereits vergeben' });
  });

  it('ERLAUBT: Antwortform unveraendert (frei)', async () => {
    const res = await pruefe('ganz.neu', '198.51.100.15');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true, message: 'Benutzername verfügbar' });
  });
});
