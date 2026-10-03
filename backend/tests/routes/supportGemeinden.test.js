// GET /api/support/gemeinden -- die Gemeindeliste der Support-Ansicht (Web;
// docs/planung/support-web.md, Entscheidung 4; routes/supportUebersicht.js).
//
// Geprueft: die Felder des Vertrags mit konkreten Werten, die Sortierung
// (Landeskirche, Kirchenkreis, Anzeigename; ohne Zuordnung zuletzt), die
// Gemeindeleitung aus BEIDEN Quellen der Zugehoerigkeit mit der Rolle je
// Gemeinde, die Zaehler gegen /support/statistik, die Wunschlizenz, dass die
// Abfragen nicht mit der Zahl der Gemeinden wachsen und dass die Liste nicht
// mit /gemeinden/:id/... aus der Support-Mail kollidiert. Rechte: Rechte der
// Uebersicht (supportUebersicht.test.js). Interne Gemeinden:
// supportInterneGemeinden.test.js.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen } = require('../helpers/kontoOhneGemeinde');
const { supportDaten } = require('../helpers/supportDaten');

const FELDER = [
  'id', 'name', 'display_name', 'is_active', 'is_trial', 'trial_ends_at', 'max_konfis', 'konfi_count', 'team_count',
  'created_at', 'kirchenkreis_id', 'kirchenkreis', 'landeskirche_id', 'landeskirche', 'wunsch_lizenz', 'leitung',
];

describe('GET /api/support/gemeinden', () => {
  let app;
  let db;
  let d;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); d = supportDaten(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    await db.query("UPDATE users SET created_at = '2025-06-15T10:00:00Z'");
    await db.query("UPDATE organizations SET created_at = '2025-06-15T10:00:00Z'");
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
  });

  const SUPER = () => generateToken('orgAdminSuper');
  const get = (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${SUPER()}`);
  const liste = async () => {
    const res = await get('/api/support/gemeinden');
    expect(res.status).toBe(200);
    return res.body;
  };

  /** Landeskirche (oder keine) und Kirchenkreis; liefert die Kennung des Kirchenkreises. */
  const kreis = async (name, landeskirche) => {
    let lk = null;
    if (landeskirche) {
      ({ rows: [{ id: lk }] } = await db.query(
        `INSERT INTO landeskirchen (name) VALUES ($1)
         ON CONFLICT ((lower(name))) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [landeskirche]));
    }
    const { rows: [{ id }] } = await db.query(
      'INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ($1, $2) RETURNING id', [name, lk]);
    return { id: Number(id), lk: lk === null ? null : Number(lk) };
  };

  describe('Form und Werte', () => {
    it('jede Gemeinde mit genau den Feldern des Vertrags und konkreten Werten', async () => {
      const k = await kreis('Kirchenkreis Alpha', 'Landeskirche Nord');
      await d.gemeinde({
        id: 3, anzeige: 'Kirchengemeinde Drei', is_trial: true, trial_ends_at: '2026-11-30T00:00:00Z',
        max_konfis: 50, kirchenkreis_id: k.id, created_at: '2026-02-03T09:30:00Z',
      });
      const [drei] = (await liste()).filter((g) => g.id === 3);
      expect(Object.keys(drei)).toEqual(FELDER);
      expect(drei).toEqual({
        id: 3,
        name: 'gemeinde-3',
        display_name: 'Kirchengemeinde Drei',
        is_active: true,
        is_trial: true,
        trial_ends_at: '2026-11-30T00:00:00.000Z',
        max_konfis: 50,
        konfi_count: 0,
        team_count: 0,
        created_at: '2026-02-03T09:30:00.000Z',
        kirchenkreis_id: k.id,
        kirchenkreis: 'Kirchenkreis Alpha',
        landeskirche_id: k.lk,
        landeskirche: 'Landeskirche Nord',
        wunsch_lizenz: null,
        leitung: [],
      });
    });

    it('ohne Zuordnung: Kirchenkreis und Landeskirche null; ohne Anzeigenamen gilt der Name; gesperrt bleibt in der Liste', async () => {
      await d.gemeinde({ id: 3, name: 'nur-systemname', anzeige: '  ', is_active: false });
      const [drei] = (await liste()).filter((g) => g.id === 3);
      expect(drei).toMatchObject({
        display_name: 'nur-systemname', is_active: false, is_trial: false, trial_ends_at: null, max_konfis: null,
        kirchenkreis_id: null, kirchenkreis: null, landeskirche_id: null, landeskirche: null,
      });
    });

    it('wunsch_lizenz: aus der neuesten Anfrage, aus der die Gemeinde entstanden ist', async () => {
      await d.gemeinde({ id: 3 });
      await d.gemeinde({ id: 4 });
      const alt = await d.anfrage({ organization_id: 3, status: 'angelegt', wunsch_lizenz: 'klein' });
      const neu = await d.anfrage({ organization_id: 3, status: 'angelegt', wunsch_lizenz: 'plus' });
      await d.anfrage({ organization_id: 4, status: 'angelegt' }); // ohne Angabe
      await db.query("UPDATE gemeinde_anfragen SET status_seit = '2026-08-01T00:00:00Z' WHERE id = $1", [alt]);
      await db.query("UPDATE gemeinde_anfragen SET status_seit = '2026-09-01T00:00:00Z' WHERE id = $1", [neu]);
      const gemeinden = await liste();
      expect(gemeinden.find((g) => g.id === 3).wunsch_lizenz).toBe('plus');
      expect(gemeinden.find((g) => g.id === 4).wunsch_lizenz).toBeNull();
      expect(gemeinden.find((g) => g.id === 1).wunsch_lizenz).toBeNull();
    });
  });

  describe('Sortierung', () => {
    it('Landeskirche, Kirchenkreis, Anzeigename ohne Unterschied zwischen Gross und Klein; ohne Zuordnung zuletzt', async () => {
      const alpha = await kreis('Kirchenkreis Alpha', 'Landeskirche Nord');
      const beta = await kreis('Kirchenkreis Beta', 'Landeskirche Nord');
      const gamma = await kreis('Kirchenkreis Gamma', 'Landeskirche Süd');
      const delta = await kreis('Kirchenkreis Delta', null); // Kirchenkreis ohne Landeskirche
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = 1', [alpha.id]); // "Test-Gemeinde St. Martin"
      await d.gemeinde({ id: 3, anzeige: 'Zeta', kirchenkreis_id: alpha.id });
      await d.gemeinde({ id: 4, anzeige: 'anker', kirchenkreis_id: alpha.id }); // klein geschrieben, kommt trotzdem vor "Test"
      await d.gemeinde({ id: 5, anzeige: 'Beta-Gemeinde', kirchenkreis_id: beta.id });
      await d.gemeinde({ id: 6, anzeige: 'Gamma-Gemeinde', kirchenkreis_id: gamma.id });
      await d.gemeinde({ id: 7, anzeige: 'Delta-Gemeinde', kirchenkreis_id: delta.id });
      await d.gemeinde({ id: 8, anzeige: 'Ohne Kreis' });
      // Gemeinde 2 ("Andere Gemeinde") hat ebenfalls keine Zuordnung

      const gemeinden = await liste();
      expect(gemeinden.map((g) => [g.id, g.display_name])).toEqual([
        [4, 'anker'], [1, 'Test-Gemeinde St. Martin'], [3, 'Zeta'], // Landeskirche Nord, Kirchenkreis Alpha
        [5, 'Beta-Gemeinde'], //                                         Landeskirche Nord, Kirchenkreis Beta
        [6, 'Gamma-Gemeinde'], //                                        Landeskirche Süd
        [7, 'Delta-Gemeinde'], //                                        Kirchenkreis ohne Landeskirche
        [2, 'Andere Gemeinde'], [8, 'Ohne Kreis'], //                    ohne Zuordnung, zuletzt
      ]);
    });
  });

  describe('Gemeindeleitung und Zähler', () => {
    it('Leitung aus beiden Quellen der Zugehörigkeit: Rolle org_admin in DIESER Gemeinde, gesperrte sichtbar, gelöschte und Support-Konten nicht', async () => {
      // Quelle 1 (users.organization_id): orgAdmin1 (5) und der Super-Admin mit Gemeinde (11) in Gemeinde 1.
      // Quelle 2 (user_organizations): 70 ist Teamer:in in Gemeinde 2 und Leitung in Gemeinde 1.
      await d.konto({ id: 70, organization_id: 2, role_id: 7, display_name: 'Zweitleitung', username: 'zweit', email: 'zweit@beispiel.example', last_login_at: '2026-09-29T07:15:00Z' });
      await d.zusatz(70, 1, 4);
      // gesperrt: bleibt in der Liste, is_active zeigt es
      await d.konto({ id: 71, organization_id: 1, role_id: 4, display_name: 'Gesperrte Leitung', username: 'gesperrt', is_active: false });
      // geloescht: fehlt
      await d.konto({ id: 72, organization_id: 1, role_id: 4, display_name: 'Geloeschte Leitung', username: 'geloescht', deleted_at: '2026-09-01T00:00:00' });
      // Leitung in Gemeinde 2 (Stamm), aber nur Teamer:in in Gemeinde 1: steht NUR in Gemeinde 2
      await db.query("INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES (9, 1, 2)");
      // ein Support-Konto ohne Gemeinde als Gast mit Leitungsrolle: zaehlt nicht
      await db.query("INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES (50, 1, 4)");
      // admin und teamer sind keine Gemeindeleitung (admin1 = 4 in Gemeinde 1, teamer1 = 3)

      const gemeinden = await liste();
      const leitung1 = gemeinden.find((g) => g.id === 1).leitung;
      expect(leitung1).toEqual([
        { id: 71, display_name: 'Gesperrte Leitung', username: 'gesperrt', email: null, is_active: false, last_login_at: null },
        { id: 5, display_name: 'Test Org-Admin 1', username: 'orgadmin1', email: null, is_active: true, last_login_at: null },
        { id: 11, display_name: 'Test Org-Admin Super', username: 'orgadminsuper', email: null, is_active: true, last_login_at: null },
        { id: 70, display_name: 'Zweitleitung', username: 'zweit', email: 'zweit@beispiel.example', is_active: true, last_login_at: '2026-09-29T07:15:00.000Z' },
      ]);
      expect(gemeinden.find((g) => g.id === 2).leitung.map((l) => l.id)).toEqual([9]);
    });

    it('team_count wie /support/statistik, konfi_count wie das Konfi-Limit (auch gesperrte, keine gelöschten)', async () => {
      await d.konto({ id: 70, organization_id: 2, role_id: 7, display_name: 'Zweitleitung', username: 'zweit' });
      await d.zusatz(70, 1, 4); // Leitung in Gemeinde 1 (Rolle dort)
      await d.zusatz(9, 1, 2); // Gemeindeleitung aus 2 ist in Gemeinde 1 Teamer:in
      await d.konto({ id: 71, organization_id: 1, role_id: 4, is_active: false }); // gesperrt: kein Team
      await d.konto({ id: 63, organization_id: 1, role_id: 1, is_active: false }); // gesperrter Konfi: zaehlt fuers Limit
      await d.konto({ id: 64, organization_id: 1, role_id: 1, deleted_at: '2026-09-01T00:00:00' }); // geloescht: nie

      const gemeinden = await liste();
      const eins = gemeinden.find((g) => g.id === 1);
      // Konfi 1, 2 und der gesperrte 63
      expect(eins.konfi_count).toBe(3);
      // Teamer:in 3 und 9 (dort Teamer:in), Admin 4, Leitung 5, 11 und 70 -- 71 gesperrt, 10 hat die Rolle super_admin
      expect(eins.team_count).toBe(6);
      expect(gemeinden.find((g) => g.id === 2).konfi_count).toBe(1);
      expect(gemeinden.find((g) => g.id === 2).team_count).toBe(4); // Teamer:in 7 und 70 (Stamm), Admin 8, Leitung 9

      const statistik = (await get('/api/support/statistik')).body.gemeinden;
      for (const g of gemeinden) {
        const k = statistik.find((s) => s.id === g.id).konten;
        expect([g.id, g.team_count]).toEqual([g.id, k.teamer + k.admin + k.org_admin]);
      }
    });
  });

  describe('Abfragen', () => {
    it('die Zahl der Abfragen hängt nicht von der Zahl der Gemeinden ab (keine Schleife je Gemeinde)', async () => {
      const abfragen = vi.spyOn(db, 'query');
      const gemessen = async () => {
        abfragen.mockClear();
        expect((await get('/api/support/gemeinden')).status).toBe(200);
        return abfragen.mock.calls.length;
      };
      await get('/api/support/gemeinden'); // Zwischenspeicher der Anmeldung waermen
      const wenige = await gemessen();

      for (let id = 3; id < 28; id += 1) {
        const r = await d.gemeinde({ id });
        await d.konto({ id: 100 + id, organization_id: id, role_id: r.org_admin });
        await d.konto({ id: 200 + id, organization_id: id, role_id: r.konfi });
      }
      const viele = await gemessen();
      expect((await liste()).length).toBe(27);
      expect(viele).toBe(wenige);
      abfragen.mockRestore();
    });

    it('kollidiert nicht mit /gemeinden/:id/verlauf der Support-Mail', async () => {
      await d.gemeinde({ id: 3 });
      await d.mail({ organization_id: 3, betreff: 'Frage' });
      const verlauf = await get('/api/support/gemeinden/3/verlauf');
      expect(verlauf.status).toBe(200);
      expect(verlauf.body.map((m) => m.betreff)).toEqual(['Frage']);
      expect(Array.isArray((await get('/api/support/gemeinden')).body)).toBe(true);
    });
  });
});
