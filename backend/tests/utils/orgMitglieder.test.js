// backend/tests/utils/orgMitglieder.test.js
//
// Befund 25.09.2026, in Produktion gemessen: Die Empfaenger-Abfragen der
// Leitungs-Meldungen fragten nur `users.organization_id` -- die
// Stamm-Organisation. Nutzer 41 ist org_admin in den Organisationen 1, 2 und
// 4 (user_organizations), zuhause aber in 1: Eine Challenge in Organisation 4
// loeste den Push an die Leitung aus, er bekam ihn nicht.
//
// Der Helfer vereint beide Quellen der Zugehoerigkeit und nimmt die Rolle je
// Organisation aus der jeweiligen Quelle. Die Tests pruefen auf konkrete
// Listen -- ein Zaehler oder ein "toBeDefined" wuerde den Fehler verdecken.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { ladeMitgliederDerOrganisation, ladeLeitungDerOrganisation, ladeMitgliedschaftenVieler } = require('../../utils/orgMitglieder');

// Der Seed legt KEINE user_organizations an -- jede Zusatzzugehoerigkeit
// wird hier ausdruecklich gesetzt.
const zusatz = (db, userId, orgId, roleId) => db.query(
  'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
  [userId, orgId, roleId]
);

// pg liefert users.id (bigint) als String -- fuer den Vergleich auf Zahlen.
const ids = (liste) => liste.map(Number).sort((a, b) => a - b);

describe('orgMitglieder: Zugehoerigkeit ueber beide Quellen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  it('Stamm-Organisation: die Leitung wie bisher (Org 1: admin1, orgAdmin1, orgAdminSuper)', async () => {
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.testGemeinde.id)))
      .toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id)))
      .toEqual([USERS.admin2.id, USERS.orgAdmin2.id]);
  });

  it('erlaubt: org_admin der ZUSATZ-Organisation gehoert zur Leitung dort', async () => {
    // orgAdmin1 (Stamm-Org 1) ist in Org 2 ebenfalls org_admin.
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id)))
      .toEqual([USERS.orgAdmin1.id, USERS.admin2.id, USERS.orgAdmin2.id]);
  });

  it('verboten: ohne Zugehoerigkeit zu Org 2 bleibt admin1 draussen', async () => {
    // admin1 hat nur die Stamm-Org 1 -- kein Eintrag fuer Org 2.
    const leitung = ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id));
    expect(leitung).not.toContain(USERS.admin1.id);
    expect(leitung).toEqual([USERS.admin2.id, USERS.orgAdmin2.id]);
  });

  it('verboten: wer in der Zusatz-Organisation nur Teamer:in ist, gehoert dort NICHT zur Leitung', async () => {
    // orgAdmin1 ist zuhause org_admin -- in Org 2 aber nur Teamer:in. Die
    // Rolle am Nutzerkonto darf hier nicht zaehlen.
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id);
    const leitung = ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id));
    expect(leitung).not.toContain(USERS.orgAdmin1.id);
    expect(leitung).toEqual([USERS.admin2.id, USERS.orgAdmin2.id]);
    // ... aber als Teamer:in zaehlt sie dort.
    expect(ids(await ladeMitgliederDerOrganisation(db, ORGS.andereGemeinde.id, ['teamer'])))
      .toEqual([USERS.orgAdmin1.id, USERS.teamer2.id]);
  });

  it('umgekehrt: Teamer:in zuhause, org_admin in der Zusatz-Organisation -> Leitung dort', async () => {
    await zusatz(db, USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id)))
      .toEqual([USERS.teamer1.id, USERS.admin2.id, USERS.orgAdmin2.id]);
    // In der Stamm-Org bleibt sie Teamer:in, nicht Leitung.
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.testGemeinde.id)))
      .not.toContain(USERS.teamer1.id);
  });

  it('keine Doppelten: Stamm-Org zusaetzlich in user_organizations (Migration 101 hat das fuer alle angelegt)', async () => {
    await zusatz(db, USERS.admin1.id, ORGS.testGemeinde.id, ROLES.admin.id);
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.testGemeinde.id)))
      .toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
  });

  it('gesperrte und geloeschte Konten fallen in beiden Quellen raus', async () => {
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.orgAdmin1.id]);
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.admin2.id]);
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id)))
      .toEqual([USERS.orgAdmin2.id]);
  });

  it('jahrgangIds: nur Personen mit Zuweisung auf den Jahrgang -- aus beiden Quellen', async () => {
    // orgAdmin1 ist in Org 2 org_admin UND dem Jahrgang 2 zugewiesen.
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
      [USERS.orgAdmin1.id, JAHRGAENGE.jahrgang2.id]
    );
    // admin2 und orgAdmin2 haben laut Seed keine Zuweisung.
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id, { jahrgangIds: [JAHRGAENGE.jahrgang2.id] })))
      .toEqual([USERS.orgAdmin1.id]);
    // Zuweisung ohne Zugehoerigkeit zur Org reicht nicht (Jahrgang 2 gehoert Org 2).
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang2.id]
    );
    expect(ids(await ladeLeitungDerOrganisation(db, ORGS.andereGemeinde.id, { jahrgangIds: [JAHRGAENGE.jahrgang2.id] })))
      .toEqual([USERS.orgAdmin1.id]);
  });

  it('leere Rollen- oder Jahrgangsliste: niemand, ohne Abfrage-Fehler', async () => {
    expect(await ladeMitgliederDerOrganisation(db, ORGS.testGemeinde.id, [])).toEqual([]);
    expect(await ladeLeitungDerOrganisation(db, ORGS.testGemeinde.id, { jahrgangIds: [] })).toEqual([]);
  });
});

// Die Gegenrichtung fuer viele Personen (27.09.2026, Befund BF-12): Aus ihr
// rechnen Push, Hintergrund-Lauf und Gemeinde-Umschalter die Zahl am
// App-Symbol. Vorher hatten Push und Hintergrund eigene Fassungen mit der
// Rolle am Nutzerkonto fuer jede Gemeinde.
describe('orgMitglieder: Gemeinden vieler Personen (ladeMitgliedschaftenVieler)', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  const kurz = (eintrag) => eintrag.mitgliedschaften.map((m) => [m.organization_id, m.role_name, m.type]);

  it('die Stamm-Gemeinde ist immer dabei und steht vorn -- auch ohne Zeile in user_organizations', async () => {
    await zusatz(db, USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    const jePerson = await ladeMitgliedschaftenVieler(db, [USERS.teamer1.id, USERS.konfi1.id]);
    expect(kurz(jePerson.get(USERS.teamer1.id))).toEqual([[1, 'teamer', 'teamer'], [2, 'org_admin', 'admin']]);
    expect(jePerson.get(USERS.teamer1.id).stamm_organization_id).toBe(1);
    expect(kurz(jePerson.get(USERS.konfi1.id))).toEqual([[1, 'konfi', 'konfi']]);
  });

  it('die Stamm-Gemeinde steht vorn, auch wenn ihre id groesser ist', async () => {
    // orgAdmin2 ist in Org 2 zuhause und in Org 1 Teamer:in.
    await zusatz(db, USERS.orgAdmin2.id, ORGS.testGemeinde.id, ROLES.teamer.id);
    const jePerson = await ladeMitgliedschaftenVieler(db, [USERS.orgAdmin2.id]);
    expect(kurz(jePerson.get(USERS.orgAdmin2.id))).toEqual([[2, 'org_admin', 'admin'], [1, 'teamer', 'teamer']]);
  });

  it('Jahrgaenge je Gemeinde: eine Zuweisung aus Org 1 zaehlt nicht in Org 2', async () => {
    await zusatz(db, USERS.admin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id);
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true), ($1, $3, true, false)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id]
    );
    const [stamm, zweit] = (await ladeMitgliedschaftenVieler(db, [USERS.admin1.id])).get(USERS.admin1.id).mitgliedschaften;
    expect(stamm.assigned_jahrgaenge.map((j) => j.id)).toEqual([JAHRGAENGE.jahrgang1.id]);
    expect(zweit.assigned_jahrgaenge.map((j) => j.id)).toEqual([JAHRGAENGE.jahrgang2.id]);
  });

  it('Stamm-Gemeinde doppelt in user_organizations: die Rolle am Nutzerkonto gewinnt, ein Eintrag', async () => {
    await zusatz(db, USERS.admin1.id, ORGS.testGemeinde.id, ROLES.teamer.id);
    const jePerson = await ladeMitgliedschaftenVieler(db, [USERS.admin1.id]);
    expect(kurz(jePerson.get(USERS.admin1.id))).toEqual([[1, 'admin', 'admin']]);
  });

  it('gesperrte Gemeinde faellt heraus, die Stamm-Gemeinde bleibt als Rueckfall fuer den Push bekannt', async () => {
    await zusatz(db, USERS.orgAdmin1.id, ORGS.andereGemeinde.id, ROLES.orgAdmin2.id);
    await db.query('UPDATE organizations SET is_active = false WHERE id = $1', [ORGS.testGemeinde.id]);
    const eintrag = (await ladeMitgliedschaftenVieler(db, [USERS.orgAdmin1.id])).get(USERS.orgAdmin1.id);
    expect(kurz(eintrag)).toEqual([[2, 'org_admin', 'admin']]);
    expect(eintrag.stamm_organization_id).toBe(1);
  });

  it('geloeschte und unbekannte Konten fehlen; leere Liste ohne Abfrage', async () => {
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.admin2.id]);
    const jePerson = await ladeMitgliedschaftenVieler(db, [USERS.admin2.id, 99999, USERS.konfi3.id]);
    expect([...jePerson.keys()]).toEqual([USERS.konfi3.id]);
    const keineAbfrage = { query: () => { throw new Error('darf nicht laufen'); } };
    expect((await ladeMitgliedschaftenVieler(keineAbfrage, [])).size).toBe(0);
  });
});
