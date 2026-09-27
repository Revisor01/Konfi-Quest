// backend/tests/routes/terminLeitungEmpfaenger.test.js
//
// Wer von Abmeldungen und Zusagen zu einem Termin erfaehrt (27.09.2026,
// Audit wer-bekommt-was BF-01, BF-18, F-10).
//
// Regel (CLAUDE.md "Wer sieht und bekommt was"): Org-Admins bekommen alles
// ihrer Gemeinde; Admins nur Termine ihrer zugewiesenen Jahrgaenge; Termine
// "Nur Team" und Termine ohne jeden Jahrgang gehen an alle Admins
// (Team-Ausnahme). Eine Mitteilung bekommt, wer den Termin in seiner Liste
// sieht -- nicht mehr und nicht weniger.
//
// Vorher gingen Konfi-Abmeldung samt Grund, Pflicht-Opt-out/-in und die
// Zu-/Absagen des Teams ueber ladeLeitungDerOrganisation an JEDEN Admin der
// Gemeinde -- auch an Admins fremder Jahrgaenge, die den Termin danach mit
// 403 nicht oeffnen konnten. Und eine Konfi-Abmeldung ueber DELETE
// /events/:id/book meldete sich bei niemandem (BF-18).
//
// Seed: admin1 (Rolle admin, Org 1) hat KEINEN Jahrgang; konfi1 steht in
// Jahrgang 1, teamer1 ist Jahrgang 1 zugewiesen. orgAdmin1 und orgAdminSuper
// sind org_admin in Org 1. Termin 1 (freiwillig) und 2 (Pflicht) gehoeren
// Jahrgang 1, Termin 4 gehoert Org 2 / Jahrgang 2. Push per Mock.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;
const TERMIN = EVENTS.gottesdienstEvent.id;       // Jahrgang 1, freiwillig
const PFLICHT = EVENTS.pflichtEvent.id;           // Jahrgang 1, Pflicht
const TERMIN_ORG2 = EVENTS.event2.id;             // Org 2, Jahrgang 2
const NUR_TEAM = 50;                              // "Nur Team", ohne Jahrgang
const OHNE_JAHRGANG = 51;                         // Team gesucht, ohne Jahrgang

// Ein eigener Jahrgang in Org 1, dem konfi1 NICHT angehoert.
const FREMDER_JAHRGANG = 90;

const MIT_GERAET = ['konfi1', 'konfi3', 'teamer1', 'admin1', 'orgAdmin1', 'orgAdminSuper', 'teamer2', 'admin2', 'orgAdmin2'];

describe('Termin-Meldungen gehen nur an die Leitung, die den Termin sieht', () => {
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
    // Das Team wird bei Termin 1 gesucht -- sonst gibt es nichts zuzusagen.
    await db.query('UPDATE events SET teamer_needed = true WHERE id = $1', [TERMIN]);
    // "Nur Team" und ein Termin ohne jeden Jahrgang (beide Team-Ausnahmen).
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, teamer_only, teamer_needed, mandatory, max_participants, has_timeslots)
       VALUES ($1, 'Teamtreffen', NOW() + interval '7 days', $3, true, false, false, 0, false),
              ($2, 'Gemeindefest', NOW() + interval '7 days', $3, false, true, false, 0, false)`,
      [NUR_TEAM, OHNE_JAHRGANG, ORG1]
    );
    // Gebuchte Konfis: konfi1 an Termin 1 und am Pflichttermin, konfi3 an
    // Termin 4 (Org 2).
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES
         ($1, $2, 'confirmed', $4), ($1, $3, 'confirmed', $4), ($5, $6, 'confirmed', $7)`,
      [USERS.konfi1.id, TERMIN, PFLICHT, ORG1, USERS.konfi3.id, TERMIN_ORG2, ORG2]
    );
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => { await closePool(); });

  // ------------------------------------------------------------------
  // Helfer
  // ------------------------------------------------------------------
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

  const auth = (schluessel) => ({ Authorization: `Bearer ${generateToken(schluessel)}` });

  const pushes = (typ) => sendFirebasePushNotification.mock.calls
    .map(([tok, payload]) => ({ token: tok, data: payload.data, body: payload.body }))
    .filter((p) => p.data && p.data.type === typ);
  const tokens = (typ) => pushes(typ).map((p) => p.token).sort();

  // Wartet, bis der Versand nach der Antwort durch ist: ueber nachAntwort
  // und zusaetzlich auf den ersten Push der Art (in jedem Fall bekommt die
  // Gemeindeleitung die Meldung), damit der Test auch gegen einen frei
  // laufenden Nachlauf nicht zu frueh prueft.
  async function warteAufVersand(typ) {
    await warteAufNachwehen(app);
    for (let i = 0; i < 40 && pushes(typ).length === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 150));
    await warteAufNachwehen(app);
  }

  // Postfach-Empfaenger einer Art zu einem Termin, sortiert.
  const postfach = async (typ, eventId) => (await db.query(
    `SELECT user_id FROM notifications
      WHERE type = $1 AND COALESCE(data->>'event_id', data->>'eventId') = $2
      ORDER BY user_id`,
    [typ, String(eventId)]
  )).rows.map((r) => Number(r.user_id));

  // Die Vorgaenge, jeweils ueber die Route, die die App ruft.
  const vorgang = {
    async konfiAbmeldung(schluessel = 'konfi1', eventId = TERMIN) {
      const res = await request(app).delete(`/api/konfi/events/${eventId}/register`)
        .set(auth(schluessel)).send({ reason: 'krank, Fieber seit gestern' });
      expect(res.status).toBe(200);
      await warteAufVersand('event_unregistration');
    },
    async optOut() {
      const res = await request(app).post(`/api/konfi/events/${PFLICHT}/opt-out`)
        .set(auth('konfi1')).send({ reason: 'Arzttermin am Vormittag' });
      expect(res.status).toBe(200);
      await warteAufVersand('event_opt_out');
    },
    async optIn() {
      const res = await request(app).post(`/api/konfi/events/${PFLICHT}/opt-in`).set(auth('konfi1'));
      expect(res.status).toBe(200);
      await warteAufVersand('event_opt_in');
    },
    async teamZusage(eventId = TERMIN, schluessel = 'teamer1') {
      const res = await request(app).post(`/api/teamer/events/${eventId}/zusage`)
        .set(auth(schluessel)).send({ dabei: true });
      expect(res.status).toBe(200);
      await warteAufVersand('teamer_event_booking');
    },
    async teamAbsage(eventId = TERMIN) {
      const res = await request(app).post(`/api/teamer/events/${eventId}/zusage`)
        .set(auth('teamer1')).send({ dabei: false, reason: 'Familienfeier' });
      expect(res.status).toBe(200);
      await warteAufVersand('teamer_event_cancellation');
    },
    async teamBuchung(eventId = TERMIN) {
      const res = await request(app).post(`/api/events/${eventId}/book`).set(auth('teamer1')).send({});
      expect(res.status).toBe(201);
      await warteAufVersand('teamer_event_booking');
    },
    async teamStorno(eventId = TERMIN) {
      const res = await request(app).delete(`/api/events/${eventId}/book`).set(auth('teamer1'));
      expect(res.status).toBe(200);
      await warteAufVersand('teamer_event_cancellation');
    },
  };

  // Was admin1 (oder wer) vom Termin sieht: Terminliste und Detail.
  async function sicht(schluessel, eventId, aktiveOrg = null) {
    const mitOrg = (r) => (aktiveOrg ? r.set('X-Active-Organization', String(aktiveOrg)) : r);
    const liste = await mitOrg(request(app).get('/api/events').set(auth(schluessel)));
    const detail = await mitOrg(request(app).get(`/api/events/${eventId}`).set(auth(schluessel)));
    expect(liste.status).toBe(200);
    return {
      inListe: liste.body.some((e) => e.id === eventId),
      detailStatus: detail.status
    };
  }

  const ORG1_LEITUNG = ['token-orgAdmin1', 'token-orgAdminSuper'];
  const MIT_ADMIN1 = ['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper'];

  // ------------------------------------------------------------------
  // Verbotene Faelle
  // ------------------------------------------------------------------
  describe('verboten', () => {
    it('Konfi-Abmeldung: Admin ohne Zuweisung bekommt weder Push noch Postfach -- und sieht den Termin nicht', async () => {
      await vorgang.konfiAbmeldung();

      expect(tokens('event_unregistration')).toEqual(ORG1_LEITUNG);
      expect(await postfach('event_unregistration', TERMIN)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      expect(await sicht('admin1', TERMIN)).toEqual({ inListe: false, detailStatus: 403 });
    });

    it('Konfi-Abmeldung: Admin eines fremden Jahrgangs bekommt nichts', async () => {
      await zuweisen('admin1', FREMDER_JAHRGANG);
      await vorgang.konfiAbmeldung();
      expect(tokens('event_unregistration')).toEqual(ORG1_LEITUNG);
    });

    it('Konfi-Abmeldung: Zuweisung ohne Leserecht (can_view = false) reicht nicht -- wie in der Liste', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id, { canView: false });
      await vorgang.konfiAbmeldung();
      expect(tokens('event_unregistration')).toEqual(ORG1_LEITUNG);
      expect(await sicht('admin1', TERMIN)).toEqual({ inListe: false, detailStatus: 403 });
    });

    it('Pflicht-Opt-out samt Grund und Opt-in: nicht an Admins ohne passende Zuweisung', async () => {
      await zuweisen('admin1', FREMDER_JAHRGANG);
      await vorgang.optOut();
      expect(tokens('event_opt_out')).toEqual(ORG1_LEITUNG);
      expect(await postfach('event_opt_out', PFLICHT)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);

      await vorgang.optIn();
      expect(tokens('event_opt_in')).toEqual(ORG1_LEITUNG);
      expect(await postfach('event_opt_in', PFLICHT)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    });

    it('Zu- und Absage des Teams zu einem Jahrgangstermin: nicht an Admins ohne Zuweisung', async () => {
      await vorgang.teamZusage();
      expect(tokens('teamer_event_booking')).toEqual(ORG1_LEITUNG);
      expect(await postfach('teamer_event_booking', TERMIN)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);

      await vorgang.teamAbsage();
      expect(tokens('teamer_event_cancellation')).toEqual(ORG1_LEITUNG);
      const [absage] = pushes('teamer_event_cancellation');
      expect(absage.body).toContain('Familienfeier');
    });

    it('Buchung und Storno des Teams ueber /events/:id/book: nicht an Admins ohne Zuweisung', async () => {
      await vorgang.teamBuchung();
      expect(tokens('teamer_event_booking')).toEqual(ORG1_LEITUNG);
      await vorgang.teamStorno();
      expect(tokens('teamer_event_cancellation')).toEqual(ORG1_LEITUNG);
    });

    it('Teamer:innen des Jahrgangs bekommen keine Leitungs-Meldung (F-10)', async () => {
      await vorgang.konfiAbmeldung();
      expect(tokens('event_unregistration')).not.toContain('token-teamer1');
      expect(await postfach('event_unregistration', TERMIN)).not.toContain(USERS.teamer1.id);
    });
  });

  // ------------------------------------------------------------------
  // Erlaubte Faelle
  // ------------------------------------------------------------------
  describe('erlaubt', () => {
    it('Admin mit Zuweisung auf den Jahrgang bekommt die Abmeldung samt Grund, die Org-Admins immer', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      await vorgang.konfiAbmeldung();

      expect(tokens('event_unregistration')).toEqual(MIT_ADMIN1);
      expect(await postfach('event_unregistration', TERMIN)).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      const anAdmin1 = pushes('event_unregistration').find((p) => p.token === 'token-admin1');
      expect(anAdmin1.body).toBe('Test Konfi 1 hat sich von "Weihnachtsgottesdienst" abgemeldet. Grund: krank, Fieber seit gestern');
      expect(anAdmin1.data.organization_id).toBe(String(ORG1));
      expect(await sicht('admin1', TERMIN)).toEqual({ inListe: true, detailStatus: 200 });
    });

    it('ein gemeinsamer Jahrgang genuegt: Termin fuer zwei Jahrgaenge, Admin nur des anderen', async () => {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [TERMIN, FREMDER_JAHRGANG]);
      await zuweisen('admin1', FREMDER_JAHRGANG);
      await vorgang.konfiAbmeldung();
      expect(tokens('event_unregistration')).toEqual(MIT_ADMIN1);
      expect(await sicht('admin1', TERMIN)).toEqual({ inListe: true, detailStatus: 200 });
    });

    it('Pflicht-Opt-out und Opt-in an den Admin des Jahrgangs', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      await vorgang.optOut();
      expect(tokens('event_opt_out')).toEqual(MIT_ADMIN1);
      await vorgang.optIn();
      expect(tokens('event_opt_in')).toEqual(MIT_ADMIN1);
    });

    it('Team-Ausnahme "Nur Team": jeder Admin, auch ohne Jahrgang', async () => {
      await vorgang.teamZusage(NUR_TEAM);
      expect(tokens('teamer_event_booking')).toEqual(MIT_ADMIN1);
      expect(await postfach('teamer_event_booking', NUR_TEAM)).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      expect(await sicht('admin1', NUR_TEAM)).toEqual({ inListe: true, detailStatus: 200 });

      await vorgang.teamAbsage(NUR_TEAM);
      expect(tokens('teamer_event_cancellation')).toEqual(MIT_ADMIN1);
    });

    it('Team-Ausnahme Termin ohne jeden Jahrgang: jeder Admin, auch ohne Jahrgang', async () => {
      await vorgang.teamZusage(OHNE_JAHRGANG);
      expect(tokens('teamer_event_booking')).toEqual(MIT_ADMIN1);
      expect(await sicht('admin1', OHNE_JAHRGANG)).toEqual({ inListe: true, detailStatus: 200 });
    });

    it('Admin mit dem Super-Admin-Merkmal sieht jeden Termin und bekommt die Meldung ohne Jahrgang', async () => {
      await db.query('UPDATE users SET is_super_admin = true WHERE id = $1', [USERS.admin1.id]);
      invalidateUserCache(USERS.admin1.id);
      await vorgang.konfiAbmeldung();
      expect(tokens('event_unregistration')).toEqual(MIT_ADMIN1);
      expect(await sicht('admin1', TERMIN)).toEqual({ inListe: true, detailStatus: 200 });
    });

    it('wer selbst zusagt, bekommt keine Meldung ueber die eigene Zusage -- auch als Org-Admin', async () => {
      // Die Zusage-Route steht hinter requireTeamer: auch die Leitung sagt dort zu.
      await vorgang.teamZusage(NUR_TEAM, 'orgAdmin1');
      expect(tokens('teamer_event_booking')).toEqual(['token-admin1', 'token-orgAdminSuper']);
    });
  });

  // ------------------------------------------------------------------
  // BF-18: Konfi-Storno ueber DELETE /events/:id/book
  // ------------------------------------------------------------------
  describe('Konfi-Storno ueber /events/:id/book meldet sich wie die Abmeldung ueber /konfi/events/:id/register', () => {
    it('Leitung des Jahrgangs bekommt event_unregistration samt Grund, die Konfi ihre Bestaetigung', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      const res = await request(app).delete(`/api/events/${TERMIN}/book`)
        .set(auth('konfi1')).send({ reason: 'krank' });
      expect(res.status).toBe(200);
      await warteAufVersand('event_unregistration');

      expect(tokens('event_unregistration')).toEqual(MIT_ADMIN1);
      const [meldung] = pushes('event_unregistration');
      expect(meldung.body).toBe('Test Konfi 1 hat sich von "Weihnachtsgottesdienst" abgemeldet. Grund: krank');
      expect(meldung.data.event_id).toBe(String(TERMIN));
      expect(await postfach('event_unregistration', TERMIN)).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      expect(tokens('event_unregistered')).toEqual(['token-konfi1']);
    });

    it('verboten: Admin ohne Zuweisung bekommt auch auf diesem Weg nichts', async () => {
      const res = await request(app).delete(`/api/events/${TERMIN}/book`)
        .set(auth('konfi1')).send({ reason: 'krank' });
      expect(res.status).toBe(200);
      await warteAufVersand('event_unregistration');
      expect(tokens('event_unregistration')).toEqual(ORG1_LEITUNG);
    });

    it('beide Wege erreichen dieselben Empfaenger mit demselben Text', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      await vorgang.konfiAbmeldung();
      const regulaer = pushes('event_unregistration').map((p) => [p.token, p.body]).sort();

      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [USERS.konfi1.id, TERMIN, ORG1]
      );
      sendFirebasePushNotification.mockClear();
      const res = await request(app).delete(`/api/events/${TERMIN}/book`)
        .set(auth('konfi1')).send({ reason: 'krank, Fieber seit gestern' });
      expect(res.status).toBe(200);
      await warteAufVersand('event_unregistration');

      expect(pushes('event_unregistration').map((p) => [p.token, p.body]).sort()).toEqual(regulaer);
    });
  });

  // ------------------------------------------------------------------
  // Mehrere Gemeinden: beide Quellen der Zugehoerigkeit, Rolle je Gemeinde
  // ------------------------------------------------------------------
  describe('Mehrere Gemeinden (user_organizations)', () => {
    it('erlaubt: Admin in Org 2 nur ueber user_organizations, dem Jahrgang dort zugewiesen -- Push und Postfach mit Org 2', async () => {
      await zusatz('admin1', ORG2, ROLES.admin2.id);
      await zuweisen('admin1', JAHRGAENGE.jahrgang2.id);

      await vorgang.konfiAbmeldung('konfi3', TERMIN_ORG2);

      // admin2 (Org 2, ohne Jahrgang) bleibt draussen, orgAdmin2 immer.
      expect(tokens('event_unregistration')).toEqual(['token-admin1', 'token-orgAdmin2']);
      const anAdmin1 = pushes('event_unregistration').find((p) => p.token === 'token-admin1');
      expect(anAdmin1.data.organization_id).toBe(String(ORG2));
      const { rows: [eintrag] } = await db.query(
        "SELECT organization_id FROM notifications WHERE type = 'event_unregistration' AND user_id = $1",
        [USERS.admin1.id]
      );
      expect(Number(eintrag.organization_id)).toBe(ORG2);
      expect(await sicht('admin1', TERMIN_ORG2, ORG2)).toEqual({ inListe: true, detailStatus: 200 });
    });

    it('verboten: Admin in Org 2 ueber user_organizations OHNE Zuweisung bekommt nichts', async () => {
      await zusatz('admin1', ORG2, ROLES.admin2.id);
      await vorgang.konfiAbmeldung('konfi3', TERMIN_ORG2);
      expect(tokens('event_unregistration')).toEqual(['token-orgAdmin2']);
      expect(await sicht('admin1', TERMIN_ORG2, ORG2)).toEqual({ inListe: false, detailStatus: 403 });
    });

    it('erlaubt: Org-Admin von Org 2 nur ueber user_organizations bekommt sie ohne Jahrgang', async () => {
      await zusatz('orgAdmin1', ORG2, ROLES.orgAdmin2.id);
      await vorgang.konfiAbmeldung('konfi3', TERMIN_ORG2);
      expect(tokens('event_unregistration')).toEqual(['token-orgAdmin1', 'token-orgAdmin2']);
    });

    it('verboten: Zuweisung auf Jahrgang 2 ohne Leitungsrolle in Org 2 reicht nicht', async () => {
      await zusatz('admin1', ORG2, ROLES.teamer2.id);
      await zuweisen('admin1', JAHRGAENGE.jahrgang2.id);
      await vorgang.konfiAbmeldung('konfi3', TERMIN_ORG2);
      expect(tokens('event_unregistration')).toEqual(['token-orgAdmin2']);
    });
  });

  // ------------------------------------------------------------------
  // Paritaet: Mitteilung <=> Postfach <=> Terminliste <=> Termin-Detail
  // ------------------------------------------------------------------
  describe('Paritaet', () => {
    const konstellationen = [
      ['ohne Zuweisung', async () => {}],
      ['Zuweisung auf den Jahrgang', async () => zuweisen('admin1', JAHRGAENGE.jahrgang1.id)],
      ['Zuweisung auf einen fremden Jahrgang', async () => zuweisen('admin1', FREMDER_JAHRGANG)],
      ['Zuweisung ohne Leserecht', async () => zuweisen('admin1', JAHRGAENGE.jahrgang1.id, { canView: false })],
      ['beide Jahrgaenge', async () => {
        await zuweisen('admin1', FREMDER_JAHRGANG);
        await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      }],
    ];

    for (const [name, vorbereiten] of konstellationen) {
      it(`admin1 ${name}: Push, Postfach, Liste und Detail sagen dasselbe -- bei Abmeldung und Team-Zusage`, async () => {
        await vorbereiten();
        await vorgang.konfiAbmeldung();
        await vorgang.teamZusage();

        const s = await sicht('admin1', TERMIN);
        for (const typ of ['event_unregistration', 'teamer_event_booking']) {
          const bekommtPush = tokens(typ).includes('token-admin1');
          const bekommtPostfach = (await postfach(typ, TERMIN)).includes(USERS.admin1.id);
          expect(bekommtPostfach, typ).toBe(bekommtPush);
          expect(s.inListe, typ).toBe(bekommtPush);
          expect(s.detailStatus, typ).toBe(bekommtPush ? 200 : 403);
          // Die Gemeindeleitung: immer.
          expect(tokens(typ), typ).toEqual(expect.arrayContaining(ORG1_LEITUNG));
        }
      });
    }

    it('die Konstellationen decken beide Ausgaenge ab (sonst prueft die Paritaet nichts)', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      await vorgang.konfiAbmeldung();
      expect(tokens('event_unregistration')).toContain('token-admin1');
    });
  });

  it('kein Empfaenger doppelt -- auch nicht mit beiden Quellen der Zugehoerigkeit und Jahrgang', async () => {
    // orgAdmin1 fuehrt seine Stamm-Gemeinde zusaetzlich in user_organizations
    // (Migration 101), hier mit der Rolle admin, und hat obendrein eine
    // Zuweisung auf den Jahrgang: trotzdem genau ein Push und ein Eintrag.
    await zusatz('orgAdmin1', ORG1, ROLES.admin.id);
    await zuweisen('orgAdmin1', JAHRGAENGE.jahrgang1.id);
    await vorgang.konfiAbmeldung();

    expect(tokens('event_unregistration')).toEqual(ORG1_LEITUNG);
    expect(await postfach('event_unregistration', TERMIN)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
  });
});
