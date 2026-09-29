// backend/tests/routes/jahrgangLoeschenRolleJeGemeinde.test.js
//
// JAHRGANG LOESCHEN: WER IST NOCH KONFI? -- DIE ROLLE IN DER GEMEINDE DES
// JAHRGANGS (Nebenbefund vom 29.09.2026).
//
// DELETE /admin/jahrgaenge/:id unterscheidet aktive Konfis (sie blockieren
// die Loeschung) von Befoerderten (ihr Profil wird vom Jahrgang geloest, ihre
// Konfi-Zeit gesichert: sichereKonfiZeitBefoerderter). Alle vier Stellen --
// Vorschau, Sperre, Sicherung, Loesen -- lasen die Rolle am KONTO
// (users.role_id), also die der Stamm-Gemeinde.
//
// Folge fuer ein Konto aus dem Altbestand, das zuhause Leitung und in einer
// zweiten Gemeinde ueber user_organizations Konfi ist (Simons eigenes Konto
// in der Testgemeinde, mehrfach-konten.md): Dort galt es beim Loeschen seines
// Jahrgangs als befoerdert. Die Loeschung lief durch, obwohl eine aktive
// Konfi im Jahrgang war; es bekam eine Kopie "Konfi-Zeit" wie nach einer
// Befoerderung, und sein Profil verlor den Jahrgang -- es blieb Konfi ohne
// Jahrgang.
//
// Jetzt gilt an allen vier Stellen die Rolle IN DER GEMEINDE DES PROFILS
// (users.role_id fuer die Stamm-Gemeinde, user_organizations.role_id fuer
// eine weitere; utils/konfiHistorie.js, ROLLE_IN_PROFIL_GEMEINDE).
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { sichereKonfiZeitBefoerderter } = require('../../utils/konfiHistorie');

// Zuhause (Org 1) Gemeindeleitung, in Org 2 Konfi im Jahrgang 2.
const DOPPEL = 271;

describe('Jahrgang löschen: Rolle in der Gemeinde des Jahrgangs', () => {
  let app;
  let db;
  const J2 = JAHRGAENGE.jahrgang2.id;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    // Der Seed-Konfi von Org 2 wechselt in einen anderen Jahrgang -- im
    // Jahrgang 2 sollen nur die Personen dieses Tests stehen.
    const { rows: [andererJahrgang] } = await db.query(
      `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('2026/2027', 2, '2027-05-01') RETURNING id`);
    await db.query('UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = $2', [andererJahrgang.id, USERS.konfi3.id]);
    // Befoerdert in Org 2: teamer2 war dort Konfi.
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 3, 2, 2)`, [USERS.teamer2.id, J2]);
  });
  afterAll(async () => { await closePool(); });

  const legeDoppelAn = async () => {
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'doppel-jg', 'x', 'Doppel Konto', $2, 1, true)`, [DOPPEL, ROLES.orgAdmin.id]);
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)', [DOPPEL, ROLES.konfi2.id]);
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 1, 1, 2)`, [DOPPEL, J2]);
  };

  const loescheJahrgang2 = async () => {
    const res = await request(app)
      .delete(`/api/admin/jahrgaenge/${J2}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
    await warteAufNachwehen(app);
    return res;
  };
  const historie = async (userId) => (await db.query(
    'SELECT anlass FROM konfi_historie WHERE user_id = $1 ORDER BY id', [userId])).rows.map((r) => r.anlass);

  describe('Konfi in dieser Gemeinde, zuhause Leitung (verboten)', () => {
    beforeEach(legeDoppelAn);

    it('sperrt die Löschung wie jede aktive Konfi (409)', async () => {
      const res = await loescheJahrgang2();
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Jahrgang kann nicht gelöscht werden: 1 Konfi(s) zugeordnet.');
      const { rows: [kp] } = await db.query('SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1', [DOPPEL]);
      expect(Number(kp.jahrgang_id)).toBe(J2);
    });

    it('die Vorschau zählt sie als aktive Konfi, nicht als befördert', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${J2}/loeschvorschau`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      expect({ aktive_konfis: res.body.aktive_konfis, befoerderte: res.body.befoerderte })
        .toEqual({ aktive_konfis: 1, befoerderte: 1 });
    });

    it('sichereKonfiZeitBefoerderter legt für sie keine Kopie an, nur für die Beförderte', async () => {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        const angelegt = await sichereKonfiZeitBefoerderter(client, J2, ORGS.andereGemeinde.id, null);
        await client.query('COMMIT');
        expect(angelegt).toBe(1);
      } finally {
        client.release();
      }
      expect(await historie(DOPPEL)).toEqual([]);
      expect(await historie(USERS.teamer2.id)).toEqual(['jahrgang_geloescht']);
    });
  });

  describe('nur Beförderte im Jahrgang (erlaubt)', () => {
    it('die Löschung läuft, die Konfi-Zeit der Beförderten ist gesichert, ihr Profil bleibt ohne Jahrgang', async () => {
      const res = await loescheJahrgang2();
      expect(res.status).toBe(200);
      expect(await historie(USERS.teamer2.id)).toEqual(['jahrgang_geloescht']);
      const { rows: [kp] } = await db.query(
        'SELECT jahrgang_id, gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [USERS.teamer2.id]);
      expect(kp).toEqual({ jahrgang_id: null, gottesdienst_points: 3 });
    });

    it('in der Zweitgemeinde befördert, zuhause Konfi-los: zählt als befördert', async () => {
      // Konto zuhause Teamer:in in Org 1, in Org 2 ueber user_organizations
      // Teamer:in und dort frueher Konfi.
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, 'doppel-team', 'x', 'Doppel Team', $2, 1, true)`, [DOPPEL, ROLES.teamer.id]);
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)', [DOPPEL, ROLES.teamer2.id]);
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 1, 1, 2)`, [DOPPEL, J2]);
      const res = await loescheJahrgang2();
      expect(res.status).toBe(200);
      expect(await historie(DOPPEL)).toEqual(['jahrgang_geloescht']);
    });

    it('nicht mehr Mitglied der Gemeinde des Profils: blockiert nicht, Profil wird gelöst', async () => {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, 'ehemals-dort', 'x', 'Ehemals dort', $2, 1, true)`, [DOPPEL, ROLES.teamer.id]);
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 1, 1, 2)`, [DOPPEL, J2]);
      const res = await loescheJahrgang2();
      expect(res.status).toBe(200);
      const { rows: [kp] } = await db.query('SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1', [DOPPEL]);
      expect(kp.jahrgang_id).toBeNull();
    });
  });
});
