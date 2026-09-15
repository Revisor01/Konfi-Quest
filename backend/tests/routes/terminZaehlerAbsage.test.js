// backend/tests/routes/terminZaehlerAbsage.test.js
//
// Abgesagte Termine duerfen in keinem Zaehler auftauchen. Der "Verbuchen"-Tab
// zeigt sie nicht an (AdminEventsPage) -- zaehlte der Reiter sie mit, stuende
// dort eine rote Zahl, hinter der eine leere Liste wartet. Genau diese
// Fehlerklasse beschreibt der Kommentar in routes/notifications.js als die zu
// vermeidende.
//
// Es gibt drei Stellen, die unverarbeitete Termine zaehlen, und sie muessen
// alle drei dasselbe tun (Paritaets-Invariante B2b):
//
//   1. GET /notifications/badge-counts  -> pendingEvents  (Reiter im Client)
//   2. terminZaehlerProOrg              -> org-weite Leitung (App-Icon)
//   3. terminZaehlerGebunden            -> gebundener Admin (App-Icon)
//
// Geprueft wird jeweils der verbotene Fall (abgesagt zaehlt nicht), der
// erlaubte (nicht abgesagt zaehlt) und der Altbestand: `cancelled IS NULL`
// ist KEINE Absage und muss mitzaehlen. Deshalb steht in den Abfragen
// `IS NOT TRUE` und nicht `= FALSE` -- die Spalte ist nullable.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { berechneAppIconSumme } = require('../../utils/appIconBadge');

describe('Abgesagte Termine zaehlen in keinem Termin-Zaehler mit', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Die Rolle 'admin' zaehlt seit der Jahrgangs-Bindung nur ihre
    // zugewiesenen Jahrgaenge; admin1 hat im Seed keine.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });
  afterAll(async () => { await closePool(); });

  // Legt einen vergangenen Termin mit EINER bestaetigten, unverbuchten
  // Buchung an -- also genau das, was die Zaehler aufgreifen sollen.
  // `cancelled` wird als Wert uebergeben, damit auch NULL gesetzt werden kann.
  const vergangenerTerminMitOffenerBuchung = async (cancelled) => {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           point_type, points, cancelled)
       VALUES ('Zaehler-Termin', NOW() - interval '2 days', $1, false, 20, 'gemeinde', 1, $2)
       RETURNING id`,
      [ORGS.testGemeinde.id, cancelled]
    );
    await db.query(
      `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)`,
      [event.id, JAHRGAENGE.jahrgang1.id]
    );
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [USERS.konfi1.id, event.id, ORGS.testGemeinde.id]
    );
    return event.id;
  };

  // 1. badge-counts (Reiter-Zaehler im Client)
  const pendingEvents = async (tokenName) => {
    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${generateToken(tokenName)}`);
    expect(res.status).toBe(200);
    return res.body.pendingEvents;
  };

  // 2. terminZaehlerProOrg -- ueber die org-weite Leitung (org_admin).
  //    Chat und andere Bausteine sind im Seed leer, die Summe ist also
  //    genau die Termin-Zahl.
  const appIconOrgWeit = () => berechneAppIconSumme(db, {
    id: USERS.orgAdmin1.id,
    type: 'admin',
    role_name: 'org_admin',
    organization_id: ORGS.testGemeinde.id,
    assigned_jahrgaenge: []
  });

  // 3. terminZaehlerGebunden -- ueber den an jahrgang1 gebundenen Admin.
  const appIconGebunden = () => berechneAppIconSumme(db, {
    id: USERS.admin1.id,
    type: 'admin',
    role_name: 'admin',
    organization_id: ORGS.testGemeinde.id,
    assigned_jahrgaenge: [{ id: JAHRGAENGE.jahrgang1.id, can_view: true }]
  });

  describe('verbotener Fall: abgesagter Termin', () => {
    it('badge-counts zaehlt ihn nicht', async () => {
      await vergangenerTerminMitOffenerBuchung(true);
      expect(await pendingEvents('admin1')).toBe(0);
      expect(await pendingEvents('orgAdmin1')).toBe(0);
    });

    it('terminZaehlerProOrg zaehlt ihn nicht', async () => {
      await vergangenerTerminMitOffenerBuchung(true);
      expect(await appIconOrgWeit()).toBe(0);
    });

    it('terminZaehlerGebunden zaehlt ihn nicht', async () => {
      await vergangenerTerminMitOffenerBuchung(true);
      expect(await appIconGebunden()).toBe(0);
    });
  });

  describe('erlaubter Fall: nicht abgesagter Termin', () => {
    it('badge-counts zaehlt ihn', async () => {
      await vergangenerTerminMitOffenerBuchung(false);
      expect(await pendingEvents('admin1')).toBe(1);
      expect(await pendingEvents('orgAdmin1')).toBe(1);
    });

    it('terminZaehlerProOrg zaehlt ihn', async () => {
      await vergangenerTerminMitOffenerBuchung(false);
      expect(await appIconOrgWeit()).toBe(1);
    });

    it('terminZaehlerGebunden zaehlt ihn', async () => {
      await vergangenerTerminMitOffenerBuchung(false);
      expect(await appIconGebunden()).toBe(1);
    });
  });

  // Altbestand: Die Spalte kam erst spaeter dazu (nullable, ohne Backfill).
  // NULL heisst "nie abgesagt" und muss zaehlen -- ein `= FALSE` wuerde diese
  // Termine stillschweigend aus allen Zaehlern werfen.
  describe('Altbestand: cancelled IS NULL ist keine Absage', () => {
    it('badge-counts zaehlt ihn', async () => {
      await vergangenerTerminMitOffenerBuchung(null);
      expect(await pendingEvents('admin1')).toBe(1);
      expect(await pendingEvents('orgAdmin1')).toBe(1);
    });

    it('terminZaehlerProOrg zaehlt ihn', async () => {
      await vergangenerTerminMitOffenerBuchung(null);
      expect(await appIconOrgWeit()).toBe(1);
    });

    it('terminZaehlerGebunden zaehlt ihn', async () => {
      await vergangenerTerminMitOffenerBuchung(null);
      expect(await appIconGebunden()).toBe(1);
    });
  });

  // BESTANDSFALL: Die Absage liegt in der Vergangenheit, die Buchungen stehen
  // unveraendert auf 'confirmed' mit attendance_status NULL -- niemand raeumt
  // sie auf, weil abgesagte Termine gar nicht zum Verbuchen angezeigt werden.
  // Genau diese Lage steht beim Nutzer am Geraet. Geprueft wird deshalb nicht
  // nur der Zaehler, sondern die Zahl, die tatsaechlich ans Geraet geht:
  // PushService.berechneBadge -- dieselbe Funktion, die jeder Push und der
  // Fuenf-Minuten-Lauf des Hintergrunddienstes verwendet.
  describe('Bestandsfall: zwei bereits abgesagte Termine mit offenen Buchungen', () => {
    beforeEach(async () => {
      await vergangenerTerminMitOffenerBuchung(true);
      await vergangenerTerminMitOffenerBuchung(true);
    });

    it('badge-counts meldet 0 fuer beide Leitungsrollen', async () => {
      expect(await pendingEvents('admin1')).toBe(0);
      expect(await pendingEvents('orgAdmin1')).toBe(0);
    });

    it('beide App-Icon-Zaehler melden 0', async () => {
      expect(await appIconOrgWeit()).toBe(0);
      expect(await appIconGebunden()).toBe(0);
    });

    it('die ans Geraet gesendete Zahl (berechneBadge) ist 0', async () => {
      // berechneBadge laedt die Person selbst aus der DB (Rolle, Orgs,
      // Jahrgaenge) -- also derselbe Weg wie in Produktion, ohne dass der Test
      // die Rolle von Hand setzt.
      const PushService = require('../../services/pushService');
      expect(await PushService.berechneBadge(db, USERS.admin1.id)).toBe(0);
      expect(await PushService.berechneBadge(db, USERS.orgAdmin1.id)).toBe(0);
    });
  });

  // Gemischt: Nur der nicht abgesagte von dreien darf uebrig bleiben --
  // so faellt der Test auch dann, wenn ein Zaehler pauschal alles oder
  // pauschal nichts zaehlt.
  it('drei Termine, nur einer offen: alle drei Zaehler melden 1', async () => {
    await vergangenerTerminMitOffenerBuchung(true);
    await vergangenerTerminMitOffenerBuchung(true);
    await vergangenerTerminMitOffenerBuchung(false);

    expect(await pendingEvents('admin1')).toBe(1);
    expect(await pendingEvents('orgAdmin1')).toBe(1);
    expect(await appIconOrgWeit()).toBe(1);
    expect(await appIconGebunden()).toBe(1);
  });
});
