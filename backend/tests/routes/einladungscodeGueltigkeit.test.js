// backend/tests/routes/einladungscodeGueltigkeit.test.js
//
// Einladungscodes: Gueltigkeit waehlbar, Verlaengern waehlbar, immer mit
// Ablauf (Audit 26.09.2026, feature-empfehlungen E-08).
//
// Simon, 28.09.2026 (woertlich): "codes laenger als 7 Tage ist gut. Mach es
// flexibel. Aber mit Zwang die ablaufen zu lassen."
//
// Vorher: Ein Code galt fest 7 Tage, "Verlaengern" gab 7 Tage dazu, ohne
// Wahl. Ein Elternbrief mit mehr als einer Woche Vorlauf lief ins Leere.
//
// Die Apps im Store (2.2.0, 2.3.0) schicken beim Anlegen nur jahrgang_id und
// beim Verlaengern keinen Body -- fuer sie bleibt alles, wie es war.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const TAG = 24 * 60 * 60 * 1000;

describe('Einladungscodes: Gueltigkeit waehlbar, immer mit Ablauf (E-08)', () => {
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

  const orgAdmin = () => generateToken('orgAdmin1');

  const anlegen = (body) => request(app).post('/api/auth/invite-code')
    .set('Authorization', `Bearer ${orgAdmin()}`)
    .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id, ...body });

  const verlaengern = (id, body) => {
    const anfrage = request(app).post(`/api/auth/invite-codes/${id}/extend`)
      .set('Authorization', `Bearer ${orgAdmin()}`);
    return body === undefined ? anfrage : anfrage.send(body);
  };

  const ablauf = async (id) =>
    (await db.query('SELECT expires_at FROM invite_codes WHERE id = $1', [id])).rows[0].expires_at.getTime();

  const zahlCodes = async () => (await db.query('SELECT COUNT(*)::int AS n FROM invite_codes')).rows[0].n;

  /** Legt einen Code an und setzt sein Ablaufdatum auf jetzt + tage. */
  async function codeMitAblauf(tage) {
    const res = await anlegen({});
    expect(res.status).toBe(200);
    const { rows: [ic] } = await db.query(
      `UPDATE invite_codes SET expires_at = $2 WHERE code = $1 RETURNING id`,
      [res.body.invite_code, new Date(Date.now() + tage * TAG)]
    );
    return ic.id;
  }

  // ------------------------------------------------------------------
  // Anlegen
  // ------------------------------------------------------------------
  describe('POST /auth/invite-code', () => {
    it('ohne gueltig_tage (Apps im Store) gilt der Code 7 Tage -- Antwort wie bisher, gueltig_tage dazu', async () => {
      const vor = Date.now();
      const res = await anlegen({});
      const nach = Date.now();
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['expires_at', 'gueltig_tage', 'invite_code', 'jahrgang_name']);
      expect(res.body.jahrgang_name).toBe(JAHRGAENGE.jahrgang1.name);
      expect(res.body.gueltig_tage).toBe(7);
      const ablaufAntwort = new Date(res.body.expires_at).getTime();
      expect(ablaufAntwort).toBeGreaterThanOrEqual(vor + 7 * TAG);
      expect(ablaufAntwort).toBeLessThanOrEqual(nach + 7 * TAG);
    });

    it.each([7, 14, 30, 60, 90])('gueltig_tage %i: der Code gilt genau so lange', async (tage) => {
      const vor = Date.now();
      const res = await anlegen({ gueltig_tage: tage });
      const nach = Date.now();
      expect(res.status).toBe(200);
      expect(res.body.gueltig_tage).toBe(tage);
      const { rows: [ic] } = await db.query('SELECT id FROM invite_codes WHERE code = $1', [res.body.invite_code]);
      const gespeichert = await ablauf(ic.id);
      expect(gespeichert).toBeGreaterThanOrEqual(vor + tage * TAG);
      expect(gespeichert).toBeLessThanOrEqual(nach + tage * TAG);
    });

    it.each([0, 1, 8, 91, 120, 365, -7, 7.5, 'abc', true, [30], { tage: 30 }])(
      'gueltig_tage %j: 400 mit deutscher Meldung, kein Code angelegt', async (wert) => {
        const res = await anlegen({ gueltig_tage: wert });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Ein Einladungscode gilt 7, 14, 30, 60 oder 90 Tage.');
        expect(await zahlCodes()).toBe(0);
      }
    );

    it('null zaehlt wie "nicht angegeben": 7 Tage', async () => {
      const res = await anlegen({ gueltig_tage: null });
      expect(res.status).toBe(200);
      expect(res.body.gueltig_tage).toBe(7);
    });
  });

  // ------------------------------------------------------------------
  // Verlaengern
  // ------------------------------------------------------------------
  describe('POST /auth/invite-codes/:id/extend', () => {
    it('ohne Body (Apps im Store): genau 7 Tage mehr, begrenzt false', async () => {
      const id = await codeMitAblauf(3);
      const vorher = await ablauf(id);
      const res = await verlaengern(id);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Einladungscode verlängert');
      expect(res.body.begrenzt).toBe(false);
      expect(await ablauf(id) - vorher).toBe(7 * TAG);
      expect(new Date(res.body.expires_at).getTime()).toBe(await ablauf(id));
    });

    it.each([14, 30, 60])('tage %i: genau so viele Tage mehr', async (tage) => {
      const id = await codeMitAblauf(3);
      const vorher = await ablauf(id);
      const res = await verlaengern(id, { tage });
      expect(res.status).toBe(200);
      expect(res.body.begrenzt).toBe(false);
      expect(await ablauf(id) - vorher).toBe(tage * TAG);
    });

    it('nie mehr als 90 Tage im Voraus: 85 Tage Rest + 30 wird auf 90 ab jetzt gekuerzt', async () => {
      const id = await codeMitAblauf(85);
      const vor = Date.now();
      const res = await verlaengern(id, { tage: 30 });
      const nach = Date.now();
      expect(res.status).toBe(200);
      expect(res.body.begrenzt).toBe(true);
      const neu = await ablauf(id);
      expect(neu).toBeGreaterThanOrEqual(vor + 90 * TAG);
      expect(neu).toBeLessThanOrEqual(nach + 90 * TAG);
    });

    it('auch ohne Body begrenzt: 88 Tage Rest + 7 wird auf 90 ab jetzt gekuerzt', async () => {
      const id = await codeMitAblauf(88);
      const vor = Date.now();
      const res = await verlaengern(id);
      const nach = Date.now();
      expect(res.status).toBe(200);
      expect(res.body.begrenzt).toBe(true);
      const neu = await ablauf(id);
      expect(neu).toBeGreaterThanOrEqual(vor + 90 * TAG);
      expect(neu).toBeLessThanOrEqual(nach + 90 * TAG);
    });

    it('ein eben mit 90 Tagen angelegter Code laesst sich nicht weiter verlaengern: 400, Ablauf unveraendert', async () => {
      const angelegt = await anlegen({ gueltig_tage: 90 });
      const { rows: [ic] } = await db.query('SELECT id FROM invite_codes WHERE code = $1', [angelegt.body.invite_code]);
      const vorher = await ablauf(ic.id);

      const res = await verlaengern(ic.id, { tage: 7 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Der Code gilt schon 90 Tage im Voraus — länger lässt er sich nicht verlängern.');
      expect(await ablauf(ic.id)).toBe(vorher);
    });

    it.each([0, 5, 100, 'lang', -7])('tage %j: 400 mit deutscher Meldung, Ablauf unveraendert', async (wert) => {
      const id = await codeMitAblauf(3);
      const vorher = await ablauf(id);
      const res = await verlaengern(id, { tage: wert });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ein Einladungscode lässt sich um 7, 14, 30, 60 oder 90 Tage verlängern.');
      expect(await ablauf(id)).toBe(vorher);
    });
  });

  // ------------------------------------------------------------------
  // Mit Zwang ablaufen lassen
  // ------------------------------------------------------------------
  describe('abgelaufen bleibt abgelaufen', () => {
    it('ein abgelaufener Code laesst sich nicht verlaengern -- auch nicht um 90 Tage', async () => {
      const id = await codeMitAblauf(-1);
      const vorher = await ablauf(id);
      for (const body of [undefined, { tage: 90 }]) {
        const res = await verlaengern(id, body);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Abgelaufene Codes können nicht verlängert werden');
      }
      expect(await ablauf(id)).toBe(vorher);
    });

    it('mit einem abgelaufenen Code registriert sich niemand (410 expired)', async () => {
      const id = await codeMitAblauf(-1);
      const { rows: [ic] } = await db.query('SELECT code FROM invite_codes WHERE id = $1', [id]);
      const res = await request(app).post('/api/auth/register-konfi').send({
        invite_code: ic.code, display_name: 'Zu Spaet', username: 'zuspaet', password: 'TestPasswort123!'
      });
      expect(res.status).toBe(410);
      expect(res.body.error_code).toBe('expired');
    });

    it('jeder angelegte Code traegt ein Ablaufdatum (die Spalte ist NOT NULL)', async () => {
      const { rows: [spalte] } = await db.query(
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_name = 'invite_codes' AND column_name = 'expires_at'`
      );
      expect(spalte.is_nullable).toBe('NO');
    });
  });

  // ------------------------------------------------------------------
  // Rechte unveraendert
  // ------------------------------------------------------------------
  it('nur die Org-Leitung: Admin 403 beim Anlegen und Verlaengern, auch mit neuem Feld', async () => {
    const admin = generateToken('admin1');
    const angelegt = await request(app).post('/api/auth/invite-code')
      .set('Authorization', `Bearer ${admin}`)
      .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id, gueltig_tage: 30 });
    expect(angelegt.status).toBe(403);

    const id = await codeMitAblauf(3);
    const vorher = await ablauf(id);
    const verl = await request(app).post(`/api/auth/invite-codes/${id}/extend`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ tage: 30 });
    expect(verl.status).toBe(403);
    expect(await ablauf(id)).toBe(vorher);
  });
});
