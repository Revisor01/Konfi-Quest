// DER KONFI-RUECKBLICK EINER BEFOERDERTEN TEAMER:IN UEBERLEBT DAS LOESCHEN
// IHRES JAHRGANGS (Audit 26.09.2026, Chat/Challenges/Rueckblick BF-02, Test G1)
//
// Seit Migration 143 haengt jeder Snapshot an einer Ausgabe, und die Ausgabe
// hing mit ON DELETE CASCADE am Jahrgang. Loeschte die Leitung einen alten
// Jahrgang, nahm das Ausgabe und Snapshots mit -- auch die der inzwischen
// befoerderten Ex-Konfis, deren uebrige Werte die Loeschroute ausdruecklich
// erhaelt und deren Erhalt das Handbuch verspricht (45-jahrgaenge.md). Ohne
// Jahrgang laesst sich der Rueckblick nicht neu erzeugen.
//
// Migration 162: wrapped_ausgaben.jahrgang_id ON DELETE SET NULL, CHECK
// gelockert (Konfi-Ausgabe darf jahrgangslos werden). Die Loeschroute raeumt
// nur noch Konfi-Ausgaben ohne einen einzigen Snapshot weg.
//
// Gemessen wird an der Datenbank (Snapshots, Ausgaben) UND an der Route, die
// das Profil liest (GET /wrapped/history/:userId) -- eine Zeile in der
// Tabelle nuetzt nichts, wenn die App sie nicht mehr bekommt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Rueckblick ueberlebt das Loeschen des Jahrgangs (G1)', () => {
  let app;
  let db;
  let orgAdminToken;
  let konfi1Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    konfi1Token = generateToken('konfi1');
  });

  async function rueckblickErzeugen() {
    const res = await request(app)
      .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(2); // konfi1 und konfi2
  }

  /** Beide Konfis des Jahrgangs werden Teamer:innen -- sonst blockieren sie das Loeschen. */
  async function befoerdern() {
    await db.query(
      'UPDATE users SET role_id = $1 WHERE id = ANY($2::int[])',
      [ROLES.teamer.id, [USERS.konfi1.id, USERS.konfi2.id]]
    );
    // Die Rolle haengt sonst im rbac-Cache des vorigen Tests.
    const rbac = require('../../middleware/rbac');
    rbac.invalidateUserCache(USERS.konfi1.id);
    rbac.invalidateUserCache(USERS.konfi2.id);
  }

  async function jahrgangLoeschen() {
    const res = await request(app)
      .delete(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Jahrgang erfolgreich gelöscht');
  }

  async function snapshots(userId) {
    const { rows } = await db.query(
      `SELECT s.id, s.jahrgang_id, s.ausgabe_id, a.jahrgang_id AS ausgabe_jahrgang_id, a.titel
         FROM wrapped_snapshots s
         LEFT JOIN wrapped_ausgaben a ON a.id = s.ausgabe_id
        WHERE s.user_id = $1 AND s.wrapped_type = 'konfi'
        ORDER BY s.id`,
      [userId]
    );
    return rows;
  }

  async function ausgaben() {
    const { rows } = await db.query(
      `SELECT id, wrapped_type, jahrgang_id, titel FROM wrapped_ausgaben
        WHERE organization_id = $1 ORDER BY id`,
      [ORGS.testGemeinde.id]
    );
    return rows;
  }

  it('G1: Snapshot und Ausgabe bleiben, die Ausgabe wird jahrgangslos', async () => {
    await rueckblickErzeugen();
    const vorher = await snapshots(USERS.konfi1.id);
    expect(vorher).toHaveLength(1);
    expect(vorher[0].ausgabe_jahrgang_id).toBe(JAHRGAENGE.jahrgang1.id);

    await befoerdern();
    await jahrgangLoeschen();

    const nachher = await snapshots(USERS.konfi1.id);
    expect(nachher).toHaveLength(1);
    expect(nachher[0].id).toBe(vorher[0].id);
    expect(nachher[0].ausgabe_id).toBe(vorher[0].ausgabe_id);
    expect(nachher[0].ausgabe_jahrgang_id).toBeNull();
    // wrapped_snapshots.jahrgang_id haengt seit jeher mit SET NULL am Jahrgang.
    expect(nachher[0].jahrgang_id).toBeNull();

    const liste = await ausgaben();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ wrapped_type: 'konfi', jahrgang_id: null });
  });

  it('G1: GET /wrapped/history liefert der befoerderten Person ihren Rueckblick weiter', async () => {
    await rueckblickErzeugen();
    await befoerdern();
    await jahrgangLoeschen();

    const res = await request(app)
      .get(`/api/wrapped/history/${USERS.konfi1.id}`)
      .set('Authorization', `Bearer ${konfi1Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].wrapped_type).toBe('konfi');
    expect(res.body[0].data).toBeTruthy();
    expect(typeof res.body[0].titel).toBe('string');
    expect(res.body[0].titel.length).toBeGreaterThan(0);
  });

  it('auch die Leitung sieht den Rueckblick der befoerderten Person danach noch', async () => {
    await rueckblickErzeugen();
    await befoerdern();
    await jahrgangLoeschen();

    const res = await request(app)
      .get(`/api/wrapped/history/${USERS.konfi2.id}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('eine Konfi-Ausgabe OHNE Snapshot wird beim Loeschen des Jahrgangs mit entfernt', async () => {
    await rueckblickErzeugen();
    // Zweite Ausgabe fuer denselben Jahrgang, ohne dass je ein Rueckblick
    // darin gerechnet wurde -- die soll nicht als leere Huelle bleiben.
    await db.query(
      `INSERT INTO wrapped_ausgaben (organization_id, wrapped_type, jahrgang_id, titel, zeitraum_start, zeitraum_ende)
       VALUES ($1, 'konfi', $2, 'Leere Ausgabe', '2026-01-01', '2026-06-30')`,
      [ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id]
    );
    expect(await ausgaben()).toHaveLength(2);

    await befoerdern();
    await jahrgangLoeschen();

    const liste = await ausgaben();
    expect(liste).toHaveLength(1);
    expect(liste[0].titel).not.toBe('Leere Ausgabe');
    expect(liste[0].jahrgang_id).toBeNull();
  });

  describe('Schema (Migration 162)', () => {
    it('der Fremdschluessel wrapped_ausgaben.jahrgang_id loescht nicht mehr mit, sondern setzt NULL', async () => {
      const { rows } = await db.query(
        `SELECT c.confdeltype
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
          WHERE t.relname = 'wrapped_ausgaben' AND c.contype = 'f' AND a.attname = 'jahrgang_id'`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].confdeltype).toBe('n'); // n = SET NULL, c = CASCADE
    });

    it('der CHECK erlaubt eine jahrgangslose Konfi-Ausgabe, aber keine Teamer-Ausgabe mit Jahrgang', async () => {
      await expect(db.query(
        `INSERT INTO wrapped_ausgaben (organization_id, wrapped_type, jahrgang_id, titel, zeitraum_start, zeitraum_ende)
         VALUES ($1, 'konfi', NULL, 'Verwaist', '2026-01-01', '2026-06-30')`,
        [ORGS.testGemeinde.id]
      )).resolves.toBeTruthy();

      await expect(db.query(
        `INSERT INTO wrapped_ausgaben (organization_id, wrapped_type, jahrgang_id, titel, zeitraum_start, zeitraum_ende)
         VALUES ($1, 'teamer', $2, 'Falsch', '2026-01-01', '2026-06-30')`,
        [ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id]
      )).rejects.toThrow(/wrapped_ausgaben_jahrgang_passt/);
    });
  });
});
