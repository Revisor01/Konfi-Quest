// backend/tests/services/verbuchenErinnerung.test.js
//
// "Events warten auf Verbuchung" (09:00) und der Verbuchen-Zaehler
// (27.09.2026, Audit wer-bekommt-was BF-10, BF-11).
//
// BF-10: Der Lauf zaehlte je Gemeinde und schickte dieselbe Zahl an jeden
// Admin -- auch an Admins, deren Verbuchen-Reiter keinen dieser Events zeigt.
// Jetzt bekommt jede Person die Zahl, die IHR Zaehler pendingEvents zeigt;
// wer 0 haette, bekommt nichts.
//
// BF-11: Der Zaehler (badge-counts und App-Symbol) zaehlte "Team gesucht"-
// Events fremder Jahrgaenge mit, die Eventliste seit dem 08.09.2026 nicht --
// eine rote Zahl, die sich nicht abarbeiten liess.
//
// Liste = Zaehler = Mitteilung: alle drei lesen utils/terminLeitungSicht.js.
//
// Seed: admin1 (Rolle admin, Org 1) ohne Jahrgang; orgAdmin1 und
// orgAdminSuper org_admin in Org 1; admin2 (ohne Jahrgang) und orgAdmin2 in
// Org 2. Push per Mock.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { appIconSummenJeOrganisation } = require('../../utils/appIconBadge');
const { zaehleWartendeTermineJeLeitung } = require('../../utils/terminLeitungSicht');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const BackgroundService = require('../../services/backgroundService');

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;
const J1 = JAHRGAENGE.jahrgang1.id;
const J2 = JAHRGAENGE.jahrgang2.id;
const FREMDER_JAHRGANG = 90;

// Vergangene Events mit unverbuchter Buchung -- je eine Art.
const E_J1 = 301;             // Jahrgang 1
const E_FREMD = 302;          // fremder Jahrgang
const E_GESUCHT_FREMD = 303;  // fremder Jahrgang, "Team gesucht" (BF-11)
const E_NUR_TEAM = 304;       // "Nur Team", ohne Jahrgang
const E_OHNE = 305;           // ohne jeden Jahrgang
const E_ORG2 = 306;           // Org 2, Jahrgang 2

const MIT_GERAET = ['admin1', 'orgAdmin1', 'orgAdminSuper', 'admin2', 'orgAdmin2', 'teamer1'];

describe('Verbuchen: Erinnerung, Zaehler und Liste nach derselben Regel', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    for (const schluessel of MIT_GERAET) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [USERS[schluessel].id, `token-${schluessel}`, `dev-${schluessel}`]
      );
    }
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, 'Fremder Jahrgang', $2, '2027-05-01')`,
      [FREMDER_JAHRGANG, ORG1]
    );
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => { await closePool(); });

  // ------------------------------------------------------------------
  // Helfer
  // ------------------------------------------------------------------
  async function vergangenesEvent(id, { orgId = ORG1, jahrgang = null, teamerOnly = false, teamerNeeded = false, gebucht = USERS.konfi1.id } = {}) {
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, teamer_only, teamer_needed, mandatory, max_participants, has_timeslots)
       VALUES ($1, $2, NOW() - interval '2 days', $3, $4, $5, false, 0, false)`,
      [id, `Event ${id}`, orgId, teamerOnly, teamerNeeded]
    );
    if (jahrgang) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [id, jahrgang]);
    }
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, attendance_status, organization_id)
       VALUES ($1, $2, 'confirmed', NULL, $3)`,
      [gebucht, id, orgId]
    );
  }

  async function alleArtenInOrg1() {
    await vergangenesEvent(E_J1, { jahrgang: J1 });
    await vergangenesEvent(E_FREMD, { jahrgang: FREMDER_JAHRGANG });
    await vergangenesEvent(E_GESUCHT_FREMD, { jahrgang: FREMDER_JAHRGANG, teamerNeeded: true, gebucht: USERS.teamer1.id });
    await vergangenesEvent(E_NUR_TEAM, { teamerOnly: true, gebucht: USERS.teamer1.id });
    await vergangenesEvent(E_OHNE, {});
  }

  const zuweisen = async (schluessel, jahrgangId, { canView = true } = {}) => {
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, $3)',
      [USERS[schluessel].id, jahrgangId, canView]
    );
    invalidateUserCache(USERS[schluessel].id);
  };

  const zusatz = async (schluessel, orgId, roleId) => {
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [USERS[schluessel].id, orgId, roleId]
    );
    invalidateUserCache(USERS[schluessel].id);
  };

  const auth = (schluessel, aktiveOrg = null) => {
    const kopf = { Authorization: `Bearer ${generateToken(schluessel)}` };
    if (aktiveOrg) kopf['X-Active-Organization'] = String(aktiveOrg);
    return kopf;
  };

  // Was die Erinnerung je Geraet meldet: { token: Zahl }
  function erinnerungen() {
    const ergebnis = {};
    for (const [tok, payload] of sendFirebasePushNotification.mock.calls) {
      if (payload.data?.type !== 'events_pending_approval') continue;
      ergebnis[tok] = Number(payload.data.count);
    }
    return ergebnis;
  }

  async function erinnern() {
    await BackgroundService.checkPendingEvents(db);
  }

  // Der Verbuchen-Reiter der Person: dieselbe Auswahl wie die App
  // (frontend eventFormatting.ts, zuVerbuchendeTermine): begonnen, offene
  // Buchungen, nicht abgesagt.
  async function verbuchenListe(schluessel, aktiveOrg = null) {
    const res = await request(app).get('/api/events').set(auth(schluessel, aktiveOrg));
    expect(res.status).toBe(200);
    return res.body
      .filter((e) => new Date(e.event_date) < new Date() && e.pending_bookings_count > 0 && !e.cancelled)
      .map((e) => e.id)
      .sort((a, b) => a - b);
  }

  async function zaehler(schluessel, aktiveOrg = null) {
    const res = await request(app).get('/api/notifications/badge-counts').set(auth(schluessel, aktiveOrg));
    expect(res.status).toBe(200);
    return res.body.pendingEvents;
  }

  // App-Symbol ohne Postfach: alle Mitteilungen gelesen, damit nur der
  // Verbuchen-Baustein wirkt (Chat, Antraege, Challenges sind im Seed leer).
  async function appSymbol(schluessel, orgId = ORG1, rolle = 'admin') {
    await db.query('UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL');
    const { rows: jg } = await db.query(
      `SELECT uja.jahrgang_id AS id, uja.can_view FROM user_jahrgang_assignments uja
         JOIN jahrgaenge j ON j.id = uja.jahrgang_id
        WHERE uja.user_id = $1 AND j.organization_id = $2`,
      [USERS[schluessel].id, orgId]
    );
    const person = { id: USERS[schluessel].id, type: 'admin', organization_id: orgId, role_name: rolle, assigned_jahrgaenge: jg };
    const summen = await appIconSummenJeOrganisation(db, [person]);
    return summen.get(`${person.id}_admin_${orgId}`);
  }

  // ------------------------------------------------------------------
  // BF-10: je Person die eigene Zahl
  // ------------------------------------------------------------------
  describe('Erinnerung je Person (BF-10)', () => {
    it('Admin ohne Jahrgang: nur "Nur Team" und Events ohne Jahrgang -- die Gemeindeleitung alle', async () => {
      await alleArtenInOrg1();
      await erinnern();
      expect(erinnerungen()).toEqual({ 'token-admin1': 2, 'token-orgAdmin1': 5, 'token-orgAdminSuper': 5 });
    });

    it('Admin des Jahrgangs 1: dazu das Event seines Jahrgangs', async () => {
      await zuweisen('admin1', J1);
      await alleArtenInOrg1();
      await erinnern();
      expect(erinnerungen()['token-admin1']).toBe(3);
    });

    it('verboten: wer 0 haette, bekommt nichts -- auch nicht die Zahl der Gemeinde', async () => {
      await vergangenesEvent(E_J1, { jahrgang: J1 });
      await erinnern();
      expect(erinnerungen()).toEqual({ 'token-orgAdmin1': 1, 'token-orgAdminSuper': 1 });
      const { rows } = await db.query(
        "SELECT user_id FROM notifications WHERE type = 'events_pending_approval' ORDER BY user_id"
      );
      expect(rows.map((r) => Number(r.user_id))).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    });

    it('verboten: Zuweisung ohne Leserecht zaehlt nicht', async () => {
      await zuweisen('admin1', J1, { canView: false });
      await vergangenesEvent(E_J1, { jahrgang: J1 });
      await erinnern();
      expect(erinnerungen()['token-admin1']).toBeUndefined();
    });

    it('Teamer:innen bekommen die Erinnerung nicht', async () => {
      await alleArtenInOrg1();
      await erinnern();
      expect(erinnerungen()['token-teamer1']).toBeUndefined();
    });

    it('Mehrere Gemeinden: Admin von Org 2 nur ueber user_organizations bekommt die Zahl von Org 2 mit Org 2 im Payload', async () => {
      await zusatz('admin1', ORG2, ROLES.admin2.id);
      await zuweisen('admin1', J2);
      await vergangenesEvent(E_ORG2, { orgId: ORG2, jahrgang: J2, gebucht: USERS.konfi3.id });
      await erinnern();
      // admin2 (ohne Jahrgang) bekommt nichts, orgAdmin2 immer.
      expect(erinnerungen()).toEqual({ 'token-admin1': 1, 'token-orgAdmin2': 1 });
      const anAdmin1 = sendFirebasePushNotification.mock.calls.find(([tok]) => tok === 'token-admin1');
      expect(anAdmin1[1].data.organization_id).toBe(String(ORG2));
      expect(await zaehler('admin1', ORG2)).toBe(1);
      expect(await zaehler('admin2')).toBe(0);
    });

    it('Mehrere Gemeinden: je Gemeinde eine eigene Meldung mit der Zahl dieser Gemeinde', async () => {
      await zusatz('orgAdmin1', ORG2, ROLES.orgAdmin2.id);
      await alleArtenInOrg1();
      await vergangenesEvent(E_ORG2, { orgId: ORG2, jahrgang: J2, gebucht: USERS.konfi3.id });
      await erinnern();
      const anOrgAdmin1 = sendFirebasePushNotification.mock.calls
        .filter(([tok, p]) => tok === 'token-orgAdmin1' && p.data.type === 'events_pending_approval')
        .map(([, p]) => [p.data.organization_id, p.data.count])
        .sort();
      expect(anOrgAdmin1).toEqual([[String(ORG1), '5'], [String(ORG2), '1']]);
    });

    it('bundelt: die Zaehlung kostet dieselbe Zahl an Abfragen fuer 2 wie fuer 12 Admins', async () => {
      await alleArtenInOrg1();
      const abfragenFuer = async () => {
        let n = 0;
        const zaehlendeDb = { query: (...a) => { n += 1; return db.query(...a); } };
        const zahlen = await zaehleWartendeTermineJeLeitung(zaehlendeDb, [ORG1]);
        return { n, personen: zahlen.length };
      };
      const vorher = await abfragenFuer();
      for (let i = 0; i < 10; i++) {
        const { rows: [u] } = await db.query(
          `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
           VALUES ($1, $1, 'x', $2, $3, true) RETURNING id`,
          [`zusatzadmin${i}`, ROLES.admin.id, ORG1]
        );
        expect(Number(u.id)).toBeGreaterThan(0);
      }
      const nachher = await abfragenFuer();
      expect(nachher.personen).toBe(vorher.personen + 10);
      expect(nachher.n).toBe(vorher.n);
      expect(nachher.n).toBe(3);
    });
  });

  // ------------------------------------------------------------------
  // BF-11: "Team gesucht" fremder Jahrgaenge zaehlt nicht
  // ------------------------------------------------------------------
  describe('"Team gesucht" eines fremden Jahrgangs (BF-11)', () => {
    it('verboten: weder in Liste noch Reiter noch App-Symbol noch Erinnerung', async () => {
      await zuweisen('admin1', J1);
      await vergangenesEvent(E_GESUCHT_FREMD, { jahrgang: FREMDER_JAHRGANG, teamerNeeded: true, gebucht: USERS.teamer1.id });

      expect(await verbuchenListe('admin1')).toEqual([]);
      expect(await zaehler('admin1')).toBe(0);
      expect(await appSymbol('admin1')).toBe(0);
      const detail = await request(app).get(`/api/events/${E_GESUCHT_FREMD}`).set(auth('admin1'));
      expect(detail.status).toBe(403);
      await erinnern();
      expect(erinnerungen()['token-admin1']).toBeUndefined();
    });

    it('erlaubt: Admin des fremden Jahrgangs zaehlt es ueberall', async () => {
      await zuweisen('admin1', FREMDER_JAHRGANG);
      await vergangenesEvent(E_GESUCHT_FREMD, { jahrgang: FREMDER_JAHRGANG, teamerNeeded: true, gebucht: USERS.teamer1.id });

      expect(await verbuchenListe('admin1')).toEqual([E_GESUCHT_FREMD]);
      expect(await zaehler('admin1')).toBe(1);
      expect(await appSymbol('admin1')).toBe(1);
      await erinnern();
      expect(erinnerungen()['token-admin1']).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Paritaet: Erinnerung <=> Reiter <=> App-Symbol <=> Liste
  // ------------------------------------------------------------------
  describe('Paritaet', () => {
    const konstellationen = [
      ['ohne Zuweisung', async () => {}],
      ['Jahrgang 1', async () => zuweisen('admin1', J1)],
      ['fremder Jahrgang', async () => zuweisen('admin1', FREMDER_JAHRGANG)],
      ['ohne Leserecht', async () => zuweisen('admin1', J1, { canView: false })],
      ['beide Jahrgaenge', async () => { await zuweisen('admin1', J1); await zuweisen('admin1', FREMDER_JAHRGANG); }],
    ];

    for (const [name, vorbereiten] of konstellationen) {
      it(`admin1 ${name}: Erinnerung, Reiter, App-Symbol und Liste nennen dieselbe Zahl`, async () => {
        await vorbereiten();
        await alleArtenInOrg1();

        const liste = await verbuchenListe('admin1');
        const reiter = await zaehler('admin1');
        const symbol = await appSymbol('admin1');
        await erinnern();
        const erinnerung = erinnerungen()['token-admin1'] || 0;

        expect(reiter).toBe(liste.length);
        expect(symbol).toBe(liste.length);
        expect(erinnerung).toBe(liste.length);

        // Die Gemeindeleitung: alle fuenf.
        expect(await verbuchenListe('orgAdmin1')).toEqual([E_J1, E_FREMD, E_GESUCHT_FREMD, E_NUR_TEAM, E_OHNE]);
        expect(await zaehler('orgAdmin1')).toBe(5);
        expect(erinnerungen()['token-orgAdmin1']).toBe(5);
      });
    }

    it('Buchungen geloeschter Konten zaehlen nirgends -- wie in der Liste', async () => {
      await vergangenesEvent(E_OHNE, { gebucht: USERS.konfi2.id });
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);

      expect(await verbuchenListe('orgAdmin1')).toEqual([]);
      expect(await zaehler('orgAdmin1')).toBe(0);
      expect(await appSymbol('orgAdmin1', ORG1, 'org_admin')).toBe(0);
      await erinnern();
      expect(erinnerungen()).toEqual({});
    });

    it('ein begonnenes Event von heute zaehlt ueberall -- wie im Reiter der App', async () => {
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, mandatory, max_participants, has_timeslots)
         VALUES ($1, 'Konfi-Samstag', NOW() - interval '1 minute', $2, false, 0, false)`,
        [E_OHNE, ORG1]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [USERS.konfi1.id, E_OHNE, ORG1]
      );
      expect(await verbuchenListe('orgAdmin1')).toEqual([E_OHNE]);
      expect(await zaehler('orgAdmin1')).toBe(1);
      await erinnern();
      expect(erinnerungen()['token-orgAdmin1']).toBe(1);
    });
  });
});
