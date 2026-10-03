// Interne Gemeinden (organizations.intern, Migration 194; Simon, 03.10.2026;
// docs/planung/support-web.md, Entscheidung 5): Die Review- und Test-Gemeinden
// fuer die Stores erscheinen in keiner Liste und keiner Zahl der
// Support-Ansicht und nicht in GET /organizations -- und DIESELBE Gemeinde
// mit intern = false erscheint. Zugriffe ueber die Kennung bleiben moeglich,
// Mails werden nicht nach intern gefiltert.
//
// Jeder Test legt Gemeinde 3 mit allem an, was die Zahlen anfasst (Konten in
// allen Rollen, Testphase, Antrag, Buchung, Nachricht, Zuordnung zu einem
// Kirchenkreis), prueft sie als intern (verboten: nirgends) und als nicht
// intern (erlaubt: ueberall).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen } = require('../helpers/kontoOhneGemeinde');
const { supportDaten } = require('../helpers/supportDaten');

// Samstag, 03.10.2026, 10:00 Uhr Berlin (wie supportUebersicht.test.js).
const JETZT = new Date('2026-10-03T08:00:00Z');

describe('Interne Gemeinden', () => {
  let app;
  let db;
  let d;
  let kreisId;
  let landeskircheId;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); d = supportDaten(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    await db.query("UPDATE users SET created_at = '2025-06-15T10:00:00Z'");
    await db.query("UPDATE organizations SET created_at = '2025-06-15T10:00:00Z'");
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(JETZT);

    // Kirchenkreis mit einer Landeskirche; Gemeinde 1 steht darin
    ({ rows: [{ id: landeskircheId }] } = await db.query("INSERT INTO landeskirchen (name) VALUES ('Landeskirche Nord') RETURNING id"));
    ({ rows: [{ id: kreisId }] } = await db.query(
      "INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Kirchenkreis Alpha', $1) RETURNING id", [landeskircheId]));
    await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = 1', [kreisId]);
  });
  afterEach(() => { vi.useRealTimers(); });

  const SUPER = () => generateToken('orgAdminSuper');
  const get = (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${SUPER()}`);
  const body = async (pfad) => {
    const res = await get(pfad);
    expect(res.status).toBe(200);
    return res.body;
  };

  /**
   * Gemeinde 3 mit allem, was Zahlen und Listen anfasst; im Kirchenkreis
   * Alpha, in der laufenden Woche und im laufenden Monat angelegt.
   */
  const gemeindeDrei = async (intern) => {
    const r = await d.gemeinde({
      id: 3, anzeige: 'Test Teamer Sicht', intern, is_trial: true, trial_ends_at: '2026-10-08T08:00:00Z',
      created_at: '2026-10-01T09:00:00Z', kirchenkreis_id: kreisId,
    });
    await d.konto({ id: 60, organization_id: 3, role_id: r.konfi, created_at: '2026-10-01T09:00:00Z', last_login_at: '2026-10-02T08:00:00Z' });
    await d.konto({ id: 61, organization_id: 3, role_id: r.teamer, created_at: '2026-10-01T09:00:00Z' });
    await d.konto({ id: 62, organization_id: 3, role_id: r.admin, created_at: '2026-10-01T09:00:00Z' });
    await d.konto({ id: 63, organization_id: 3, role_id: r.org_admin, created_at: '2026-10-01T09:00:00Z' });
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id, created_at)
       VALUES (60, 1, '2026-10-01', 'pending', 3, '2026-10-01T09:00:00Z')`);
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
       VALUES (1, 60, 'confirmed', '2026-10-01T09:00:00Z', 3)`);
    await db.query("INSERT INTO chat_rooms (id, name, type, created_by, organization_id) VALUES (10, 'Raum', 'group', 63, 3)");
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
       VALUES (10, 63, 'admin', 'text', 'Hallo', '2026-10-01T09:00:00Z')`);
    return r;
  };
  const setzeIntern = (intern) => db.query('UPDATE organizations SET intern = $1 WHERE id = 3', [intern]);

  // ==========================================================================
  // Die Spalte
  // ==========================================================================
  it('Vorgabe: eine neue Gemeinde ist nicht intern', async () => {
    await d.gemeinde({ id: 3 });
    const { rows } = await db.query('SELECT id, intern FROM organizations ORDER BY id');
    expect(rows).toEqual([{ id: 1, intern: false }, { id: 2, intern: false }, { id: 3, intern: false }]);
  });

  // ==========================================================================
  // GET /organizations (Gemeinde-Auswahl beim Zuordnen von Mails und Super-Admin-Liste)
  // ==========================================================================
  describe('GET /api/organizations -- die Gemeinde-Auswahl der Support-Ansicht', () => {
    // Der Dialog "Zuordnen" (SupportPostDetailPage) und der Posteingang holen die
    // Gemeinden hier; es gibt keine eigene Route dafuer.
    it('verboten: eine interne Gemeinde steht nicht in der Liste', async () => {
      await gemeindeDrei(true);
      const gemeinden = await body('/api/organizations');
      expect(gemeinden.map((g) => g.id).sort()).toEqual([1, 2]);
    });

    it('erlaubt: dieselbe Gemeinde mit intern = false steht in der Liste, mit unveränderter Form', async () => {
      await gemeindeDrei(false);
      const gemeinden = await body('/api/organizations');
      expect(gemeinden.map((g) => g.id).sort()).toEqual([1, 2, 3]);
      const drei = gemeinden.find((g) => g.id === 3);
      expect(drei).toMatchObject({
        name: 'gemeinde-3', display_name: 'Test Teamer Sicht', is_active: true, kirchenkreis_id: kreisId,
        landeskirche: 'Landeskirche Nord', user_count: 3, konfi_count: 0, event_count: 0,
      });
      // Form unverändert: das Feld intern steht nicht in der Liste (es wäre immer false)
      expect(Object.keys(drei)).not.toContain('intern');
    });

    it('Zugriff über die Kennung bleibt möglich: lesen und bearbeiten', async () => {
      await gemeindeDrei(true);
      const eine = await get('/api/organizations/3');
      expect(eine.status).toBe(200);
      expect(eine.body).toMatchObject({ id: 3, display_name: 'Test Teamer Sicht', intern: true });
      const geaendert = await request(app).put('/api/organizations/3').set('Authorization', `Bearer ${SUPER()}`)
        .send({ name: 'gemeinde-3', slug: 'gemeinde-3', display_name: 'Test Teamer Sicht 2' });
      expect(geaendert.status).toBe(200);
      const { rows: [g] } = await db.query('SELECT display_name, intern FROM organizations WHERE id = 3');
      expect(g).toEqual({ display_name: 'Test Teamer Sicht 2', intern: true });
    });
  });

  // ==========================================================================
  // GET /support/statistik
  // ==========================================================================
  describe('GET /api/support/statistik', () => {
    it('verboten: eine interne Gemeinde steht nicht darin', async () => {
      await gemeindeDrei(true);
      const { gemeinden } = await body('/api/support/statistik');
      expect(gemeinden.map((g) => g.id)).toEqual([2, 1]); // nach Name: "Andere Gemeinde", "Test-Gemeinde St. Martin"
    });

    it('erlaubt: dieselbe Gemeinde mit intern = false steht darin, mit ihren Zahlen', async () => {
      await gemeindeDrei(false);
      // die Statistik rechnet "aktiv in 30 Tagen" mit der Datenbank-Uhr, nicht mit dem festen jetzt
      await db.query("UPDATE users SET last_login_at = NOW() - interval '1 day' WHERE id = 60");
      const { gemeinden } = await body('/api/support/statistik');
      const drei = gemeinden.find((g) => g.id === 3);
      expect(drei).toMatchObject({
        name: 'Test Teamer Sicht', konten: { konfi: 1, teamer: 1, admin: 1, org_admin: 1 }, aktiv_30_tage: 1, jahrgaenge: 0,
      });
      expect(gemeinden.map((g) => g.id).sort()).toEqual([1, 2, 3]);
    });
  });

  // ==========================================================================
  // Struktur: Gemeinden je Kirchenkreis
  // ==========================================================================
  describe('Zählung der Gemeinden an den Kirchenkreisen', () => {
    it('verboten: eine interne Gemeinde zählt nicht (GET /kirchenkreise)', async () => {
      await gemeindeDrei(true);
      const kreise = await body('/api/support/kirchenkreise');
      expect(kreise).toEqual([{
        id: kreisId, name: 'Kirchenkreis Alpha', landeskirche_id: landeskircheId, landeskirche: 'Landeskirche Nord', anzahl_gemeinden: 1,
      }]);
    });

    it('erlaubt: dieselbe Gemeinde mit intern = false zählt', async () => {
      await gemeindeDrei(false);
      const kreise = await body('/api/support/kirchenkreise');
      expect(kreise.map((k) => [k.name, k.anzahl_gemeinden])).toEqual([['Kirchenkreis Alpha', 2]]);
    });

    it('Kirchenkreis löschen meldet die sichtbaren Gemeinden; die interne verliert die Zuordnung trotzdem', async () => {
      await gemeindeDrei(true);
      const res = await request(app).delete(`/api/support/kirchenkreise/${kreisId}`).set('Authorization', `Bearer ${SUPER()}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Kirchenkreis gelöscht', gemeinden_ohne_zuordnung: 1 });
      const { rows } = await db.query('SELECT id, kirchenkreis_id FROM organizations WHERE id IN (1, 3) ORDER BY id');
      expect(rows).toEqual([{ id: 1, kirchenkreis_id: null }, { id: 3, kirchenkreis_id: null }]);
    });

    it('Kirchenkreis löschen: ist die Gemeinde nicht intern, zählt sie mit', async () => {
      await gemeindeDrei(false);
      const res = await request(app).delete(`/api/support/kirchenkreise/${kreisId}`).set('Authorization', `Bearer ${SUPER()}`);
      expect(res.body).toEqual({ message: 'Kirchenkreis gelöscht', gemeinden_ohne_zuordnung: 2 });
    });
  });

  // ==========================================================================
  // GET /support/uebersicht -- jede Zahl
  // ==========================================================================
  describe('GET /api/support/uebersicht', () => {
    /** Die Uebersicht mit nur dem Seed: die Zahlen, die eine interne Gemeinde nicht veraendern darf. */
    const OHNE = {
      kennzahlen: {
        gemeinden: { gesamt: 2, testphase: 0, lizenz: 0, unbegrenzt: 2, gesperrt: 0 },
        konten: { konfi: 3, teamer: 2, admin: 2, org_admin: 3 },
        aktiv_30_tage: 0,
      },
      gemeinden_neu: Array(12).fill(0),
      konten_neu: { konfi: Array(12).fill(0), team: Array(12).fill(0) },
      konten_gesamt: Array(12).fill(10),
      aktivitaet: { antraege: Array(12).fill(0), buchungen: Array(12).fill(0), nachrichten: Array(12).fill(0) },
      testphase_endet: [],
    };

    /** Genau die Zahlen, die Gemeinde 3 anfasst. */
    const zahlen = (u) => ({
      kennzahlen: {
        gemeinden: u.kennzahlen.gemeinden,
        konten: u.kennzahlen.konten,
        aktiv_30_tage: u.kennzahlen.aktiv_30_tage,
      },
      gemeinden_neu: u.entwicklung.gemeinden_neu,
      konten_neu: u.entwicklung.konten_neu,
      konten_gesamt: u.entwicklung.konten_gesamt,
      aktivitaet: { antraege: u.aktivitaet.antraege, buchungen: u.aktivitaet.buchungen, nachrichten: u.aktivitaet.nachrichten },
      testphase_endet: u.testphase_endet,
    });
    const reihe = (letzter) => [...Array(11).fill(0), letzter];

    it('verboten: eine interne Gemeinde verändert keine Zahl und steht in keiner Liste', async () => {
      await gemeindeDrei(true);
      expect(zahlen(await body('/api/support/uebersicht'))).toEqual(OHNE);
    });

    it('erlaubt: dieselbe Gemeinde mit intern = false geht in jede Zahl und Liste ein', async () => {
      await gemeindeDrei(false);
      expect(zahlen(await body('/api/support/uebersicht'))).toEqual({
        kennzahlen: {
          gemeinden: { gesamt: 3, testphase: 1, lizenz: 0, unbegrenzt: 2, gesperrt: 0 },
          konten: { konfi: 4, teamer: 3, admin: 3, org_admin: 4 },
          aktiv_30_tage: 1,
        },
        gemeinden_neu: reihe(1),
        konten_neu: { konfi: reihe(1), team: reihe(3) },
        konten_gesamt: [...Array(11).fill(10), 14],
        aktivitaet: { antraege: reihe(1), buchungen: reihe(1), nachrichten: reihe(1) },
        testphase_endet: [{ id: 3, display_name: 'Test Teamer Sicht', trial_ends_at: '2026-10-08T08:00:00.000Z' }],
      });
    });

    it('wird eine Gemeinde nachträglich intern, verschwindet sie aus allen Zahlen; zurück, ist sie wieder da', async () => {
      await gemeindeDrei(false);
      expect((await body('/api/support/uebersicht')).kennzahlen.gemeinden.gesamt).toBe(3);
      await setzeIntern(true);
      expect(zahlen(await body('/api/support/uebersicht'))).toEqual(OHNE);
      await setzeIntern(false);
      expect((await body('/api/support/uebersicht')).kennzahlen.gemeinden.gesamt).toBe(3);
    });
  });

  // ==========================================================================
  // GET /support/gemeinden
  // ==========================================================================
  describe('GET /api/support/gemeinden', () => {
    it('verboten: eine interne Gemeinde steht nicht in der Liste -- auch ihre Leitung nicht', async () => {
      await gemeindeDrei(true);
      const gemeinden = await body('/api/support/gemeinden');
      expect(gemeinden.map((g) => g.id).sort()).toEqual([1, 2]);
      expect(gemeinden.flatMap((g) => g.leitung.map((l) => l.id))).not.toContain(63);
    });

    it('erlaubt: dieselbe Gemeinde mit intern = false steht in der Liste, mit ihrer Leitung', async () => {
      await gemeindeDrei(false);
      const gemeinden = await body('/api/support/gemeinden');
      const drei = gemeinden.find((g) => g.id === 3);
      expect(drei).toMatchObject({ display_name: 'Test Teamer Sicht', konfi_count: 1, team_count: 3 });
      expect(drei.leitung.map((l) => l.id)).toEqual([63]);
    });
  });

  // ==========================================================================
  // Mails werden nicht nach intern gefiltert
  // ==========================================================================
  describe('Mails', () => {
    it('Mails einer internen Gemeinde bleiben im Posteingang (alle), im Zähler und lassen sich zuordnen', async () => {
      await gemeindeDrei(true);
      const zugeordnet = await d.mail({ organization_id: 3, betreff: 'Review-Frage' });
      const offen = await d.mail({ betreff: 'Offen' });

      const alle = await body('/api/support/mail/eingang?zuordnung=alle');
      expect(alle.map((m) => [m.id, m.organization_id, m.gemeinde_name])).toEqual([
        [offen, null, null], [zugeordnet, 3, 'Test Teamer Sicht']]);
      const zaehler = await body('/api/support/mail/zaehler');
      expect(zaehler).toMatchObject({ gemeinden: 1, eingang: 1, je_gemeinde: { 3: 1 } });
      expect((await body('/api/support/uebersicht')).kennzahlen.mails_ungelesen).toBe(2);

      // Zuordnen zu einer internen Gemeinde ueber die Kennung geht
      const res = await request(app).post(`/api/support/mail/nachrichten/${offen}/zuordnen`)
        .set('Authorization', `Bearer ${SUPER()}`).send({ organization_id: 3 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ anzahl: 1, organization_id: 3 });
    });
  });
});
