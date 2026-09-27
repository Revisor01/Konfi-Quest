// backend/tests/routes/antragLeitungEmpfaenger.test.js
//
// Wer von einem neuen Aktivitaets-Antrag erfaehrt (27.09.2026).
//
// Simon: "Antraege duerfen auch nur an Admins des Jahrgangs gehen." Derselbe
// Grundsatz wie bei den Challenges: Org-Admins bekommen alles ihrer Gemeinde,
// Admins nur, was einen Bezug zu ihren zugewiesenen Jahrgaengen hat. Eine
// Mitteilung bekommt, wer den Antrag in seiner Liste sieht und bearbeiten
// darf -- nicht mehr und nicht weniger.
//
// Vorher: "Neuer Antrag eingegangen" (Postfach) und der Push gingen ueber
// ladeLeitungDerOrganisation an JEDEN Admin der Gemeinde. Die Antragsliste
// und pendingRequests sind seit 31.08./01.09.2026 jahrgangsgebunden -- ein
// Admin ohne passende Zuweisung bekam also eine Mitteilung (die auch noch an
// Glocke, Gemeinde-Umschalter und App-Symbol mitzaehlte) zu einem Antrag, den
// er nirgends oeffnen konnte.
//
// Seed: admin1 (Rolle admin, Org 1) hat KEINEN Jahrgang; konfi1 steht in
// Jahrgang 1, teamer1 ist Jahrgang 1 zugewiesen. orgAdmin1 und orgAdminSuper
// sind org_admin in Org 1. Push per Mock (wie pushEmpfaengerMultiOrg.test.js),
// Assertions auf konkrete Empfaengerlisten.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { appIconSummenJeOrganisation } = require('../../utils/appIconBadge');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;

// Ein eigener Jahrgang in Org 1, dem konfi1 NICHT angehoert.
const FREMDER_JAHRGANG = 90;

// Jede Person mit Push-Geraet: Token = 'token-<schluessel>'.
const MIT_GERAET = ['konfi1', 'teamer1', 'admin1', 'orgAdmin1', 'orgAdminSuper', 'konfi3', 'teamer2', 'admin2', 'orgAdmin2'];

describe('Neue Antraege melden sich nur bei der Leitung, die sie sieht', () => {
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

  const token = (schluessel) => generateToken(schluessel);

  // Wartet, bis der Versand nach der Antwort durch ist. Die Route arbeitet
  // ihn ueber nachAntwort ab; zusaetzlich kurz auf den ersten Push warten,
  // damit der Test auch gegen einen frei laufenden Nachlauf nicht zu frueh
  // prueft (in jedem Fall bekommt mindestens eine Org-Leitung die Meldung).
  async function warteAufVersand() {
    await warteAufNachwehen(app);
    for (let i = 0; i < 40 && antragsPushes().length === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    // Den Nachlauf ausklingen lassen (Pushes an mehrere Empfaenger).
    await new Promise((r) => setTimeout(r, 100));
    await warteAufNachwehen(app);
  }

  // Konfis stellen ueber /konfi/requests, das Team ueber /teamer/requests
  // (requireTeamer: auch admin und org_admin koennen dort stellen).
  async function antragStellen(schluessel = 'konfi1', activityId = ACTIVITIES.sonntagsgottesdienst.id,
    { teamWeg = schluessel.startsWith('teamer') } = {}) {
    const res = await request(app)
      .post(teamWeg ? '/api/teamer/requests' : '/api/konfi/requests')
      .set('Authorization', `Bearer ${token(schluessel)}`)
      .send({ activity_id: activityId, requested_date: '2026-06-01' });
    expect(res.status).toBe(201);
    await warteAufVersand();
    return res.body.id;
  }

  const antragsPushes = () => sendFirebasePushNotification.mock.calls
    .map(([tok, payload]) => ({ token: tok, data: payload.data }))
    .filter((p) => p.data && p.data.type === 'new_activity_request');
  const pushTokens = () => antragsPushes().map((p) => p.token).sort();

  // Postfach-Eintraege "Neuer Antrag eingegangen": Empfaenger-IDs, sortiert.
  const postfachEmpfaenger = async (antragId) => (await db.query(
    `SELECT user_id FROM notifications
      WHERE type = 'new_activity_request' AND (data->>'request_id')::int = $1
      ORDER BY user_id`,
    [antragId]
  )).rows.map((r) => r.user_id);

  // Was die Person in der aktiven Gemeinde sieht: Antragsliste und Zaehler.
  async function sicht(schluessel, antragId, aktiveOrg = null) {
    const mitOrg = (r) => (aktiveOrg ? r.set('X-Active-Organization', String(aktiveOrg)) : r);
    const liste = await mitOrg(request(app).get('/api/admin/activities/requests?status=pending')
      .set('Authorization', `Bearer ${token(schluessel)}`));
    const zaehler = await mitOrg(request(app).get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${token(schluessel)}`));
    expect(zaehler.status).toBe(200);
    return {
      listenStatus: liste.status,
      inListe: liste.status === 200 && liste.body.some((a) => a.id === antragId),
      pendingRequests: zaehler.body.pendingRequests
    };
  }

  // ------------------------------------------------------------------
  // Verbotene Faelle
  // ------------------------------------------------------------------
  describe('verboten', () => {
    it('Admin ohne Zuweisung auf den Jahrgang des Konfis bekommt weder Push noch Postfach-Eintrag', async () => {
      const antragId = await antragStellen();

      expect(pushTokens()).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      // ... und sieht ihn auch nicht (Paritaet).
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: false, pendingRequests: 0 });
    });

    it('Admin mit Zuweisung auf einen ANDEREN Jahrgang bekommt nichts', async () => {
      await zuweisen('admin1', FREMDER_JAHRGANG);
      const antragId = await antragStellen();

      expect(pushTokens()).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    });

    it('Zuweisung ohne Leserecht (can_view = false) reicht nicht -- wie in der Liste', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id, { canView: false });
      const antragId = await antragStellen();

      expect(pushTokens()).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: false, pendingRequests: 0 });
    });

    it('Teamer:innen des Jahrgangs bekommen nichts -- sie sehen und entscheiden Antraege nicht', async () => {
      // teamer1 ist im Seed Jahrgang 1 zugewiesen.
      const antragId = await antragStellen();

      expect(pushTokens()).not.toContain('token-teamer1');
      expect(await postfachEmpfaenger(antragId)).not.toContain(USERS.teamer1.id);
      const s = await sicht('teamer1', antragId);
      expect(s.listenStatus).toBe(403);
      expect(s.pendingRequests).toBe(0);
    });

    it('Konfi ohne Jahrgang: nur die Org-Admins, auch kein Admin mit Jahrgaengen', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      await db.query('UPDATE konfi_profiles SET jahrgang_id = NULL WHERE user_id = $1', [USERS.konfi1.id]);
      const antragId = await antragStellen();

      expect(pushTokens()).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      // Die Liste des Admins filtert ueber den Jahrgang des Konfis -- ohne
      // Jahrgang steht der Antrag nur bei der Gemeindeleitung.
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: false, pendingRequests: 0 });
      expect(await sicht('orgAdmin1', antragId)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
    });
  });

  // ------------------------------------------------------------------
  // Erlaubte Faelle
  // ------------------------------------------------------------------
  describe('erlaubt', () => {
    it('Admin mit Zuweisung auf den Jahrgang bekommt Push und Postfach-Eintrag, die Org-Admins immer', async () => {
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      const antragId = await antragStellen();

      expect(pushTokens()).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      for (const p of antragsPushes()) expect(p.data.organization_id).toBe(String(ORG1));
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
    });

    it('Antrag einer Teamer:in: jeder Admin der Gemeinde, auch ohne Jahrgang (Teamer-Ausnahme, wie die Liste)', async () => {
      const { rows: [akt] } = await db.query(
        `INSERT INTO activities (name, points, type, target_role, organization_id)
         VALUES ('Teamer-Schulung', 0, 'gemeinde', 'teamer', $1) RETURNING id`,
        [ORG1]
      );
      const antragId = await antragStellen('teamer1', akt.id);

      expect(pushTokens()).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
    });

    it('Admin mit dem Super-Admin-Merkmal sieht alle Antraege der Gemeinde und bekommt sie ohne Jahrgang', async () => {
      // Die Liste (activities.js) und badge-counts behandeln das Merkmal wie
      // org_admin -- die Mitteilung muss dasselbe tun.
      await db.query('UPDATE users SET is_super_admin = true WHERE id = $1', [USERS.admin1.id]);
      invalidateUserCache(USERS.admin1.id);
      const antragId = await antragStellen();

      expect(pushTokens()).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper']);
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
    });
  });

  // ------------------------------------------------------------------
  // Mehrere Gemeinden: beide Quellen der Zugehoerigkeit
  // ------------------------------------------------------------------
  describe('Mehrere Gemeinden (user_organizations)', () => {
    it('erlaubt: Admin in Org 2 nur ueber user_organizations, dem Jahrgang dort zugewiesen -- Push mit Org 2, Liste und Zaehler in Org 2', async () => {
      await zusatz('admin1', ORG2, ROLES.admin2.id);
      await zuweisen('admin1', JAHRGAENGE.jahrgang2.id);

      const antragId = await antragStellen('konfi3', ACTIVITIES.gottesdienst2.id);

      // admin2 (Org 2, ohne Jahrgang) bleibt draussen, orgAdmin2 immer.
      expect(pushTokens()).toEqual(['token-admin1', 'token-orgAdmin2']);
      const anAdmin1 = antragsPushes().find((p) => p.token === 'token-admin1');
      expect(anAdmin1.data.organization_id).toBe(String(ORG2));
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.admin1.id, USERS.orgAdmin2.id]);
      const { rows: [eintrag] } = await db.query(
        "SELECT organization_id FROM notifications WHERE type = 'new_activity_request' AND user_id = $1",
        [USERS.admin1.id]
      );
      expect(eintrag.organization_id).toBe(ORG2);

      expect(await sicht('admin1', antragId, ORG2)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
      // In seiner Stamm-Gemeinde steht der Antrag nicht.
      expect(await sicht('admin1', antragId)).toEqual({ listenStatus: 200, inListe: false, pendingRequests: 0 });
    });

    it('verboten: Admin in Org 2 ueber user_organizations OHNE Zuweisung auf den Jahrgang bekommt nichts', async () => {
      await zusatz('admin1', ORG2, ROLES.admin2.id);

      const antragId = await antragStellen('konfi3', ACTIVITIES.gottesdienst2.id);

      expect(pushTokens()).toEqual(['token-orgAdmin2']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin2.id]);
      expect(await sicht('admin1', antragId, ORG2)).toEqual({ listenStatus: 200, inListe: false, pendingRequests: 0 });
    });

    it('erlaubt: Org-Admin von Org 2 nur ueber user_organizations bekommt ihn ohne Jahrgang', async () => {
      await zusatz('orgAdmin1', ORG2, ROLES.orgAdmin2.id);

      const antragId = await antragStellen('konfi3', ACTIVITIES.gottesdienst2.id);

      expect(pushTokens()).toEqual(['token-orgAdmin1', 'token-orgAdmin2']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin1.id, USERS.orgAdmin2.id]);
      expect(await sicht('orgAdmin1', antragId, ORG2)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
    });

    it('verboten: Zuweisung auf den Jahrgang von Org 2 ohne Leitungsrolle dort reicht nicht', async () => {
      // admin1 ist in Org 2 nur Teamer:in -- die Rolle gilt je Gemeinde.
      await zusatz('admin1', ORG2, ROLES.teamer2.id);
      await zuweisen('admin1', JAHRGAENGE.jahrgang2.id);

      const antragId = await antragStellen('konfi3', ACTIVITIES.gottesdienst2.id);

      expect(pushTokens()).toEqual(['token-orgAdmin2']);
      expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin2.id]);
    });
  });

  // ------------------------------------------------------------------
  // Paritaet: Mitteilung <=> Liste <=> Zaehler (Reiter und App-Symbol)
  // ------------------------------------------------------------------
  describe('Paritaet', () => {
    // Je Konstellation fuer admin1: bekommt er die Mitteilung, dann sieht er
    // den Antrag in der Liste und zaehlt ihn -- und umgekehrt. Die
    // Gemeindeleitung laeuft in jeder Konstellation mit.
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

    // App-Symbol ohne Postfach: alle Mitteilungen gelesen, damit nur der
    // Antrags-Zaehler (antragZaehlerGebunden / antragZaehlerProOrg) wirkt.
    async function appSymbolOhnePostfach(schluessel) {
      await db.query('UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL');
      const { rows: jg } = await db.query(
        `SELECT uja.jahrgang_id AS id, uja.can_view FROM user_jahrgang_assignments uja
           JOIN jahrgaenge j ON j.id = uja.jahrgang_id
          WHERE uja.user_id = $1 AND j.organization_id = $2`,
        [USERS[schluessel].id, ORG1]
      );
      const rolle = schluessel === 'admin1' ? 'admin' : 'org_admin';
      const person = { id: USERS[schluessel].id, type: 'admin', organization_id: ORG1, role_name: rolle, assigned_jahrgaenge: jg };
      const summen = await appIconSummenJeOrganisation(db, [person]);
      return summen.get(`${person.id}_admin_${ORG1}`);
    }

    for (const [name, vorbereiten] of konstellationen) {
      it(`admin1 ${name}: Mitteilung, Liste, Reiter und App-Symbol sagen dasselbe`, async () => {
        await vorbereiten();
        const symbolVorher = await appSymbolOhnePostfach('admin1');
        const orgSymbolVorher = await appSymbolOhnePostfach('orgAdmin1');

        const antragId = await antragStellen();

        const bekommtPush = pushTokens().includes('token-admin1');
        const bekommtPostfach = (await postfachEmpfaenger(antragId)).includes(USERS.admin1.id);
        const s = await sicht('admin1', antragId);
        const symbolDiff = (await appSymbolOhnePostfach('admin1')) - symbolVorher;

        expect(bekommtPostfach).toBe(bekommtPush);
        expect(s.inListe).toBe(bekommtPush);
        expect(s.pendingRequests).toBe(bekommtPush ? 1 : 0);
        expect(symbolDiff).toBe(bekommtPush ? 1 : 0);

        // Die Gemeindeleitung: immer alles.
        expect(pushTokens()).toContain('token-orgAdmin1');
        expect(await sicht('orgAdmin1', antragId)).toEqual({ listenStatus: 200, inListe: true, pendingRequests: 1 });
        expect((await appSymbolOhnePostfach('orgAdmin1')) - orgSymbolVorher).toBe(1);
      });
    }

    it('die Konstellationen decken beide Ausgaenge ab (sonst prueft die Paritaet nichts)', async () => {
      await zuweisen('admin1', FREMDER_JAHRGANG);
      await zuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      await antragStellen();
      expect(pushTokens()).toContain('token-admin1');
    });
  });

  it('wer selbst einen Antrag stellt, bekommt keine Mitteilung darueber -- auch als Leitung ueber den Team-Weg', async () => {
    // POST /teamer/requests steht hinter requireTeamer, also koennen auch
    // admin und org_admin dort eine Team-Aktivitaet melden. Bis zum
    // 27.09.2026 bekamen sie dann "Neuer Antrag eingegangen" ueber den
    // eigenen Antrag.
    const { rows: [akt] } = await db.query(
      `INSERT INTO activities (name, points, type, target_role, organization_id)
       VALUES ('Teamer-Schulung', 0, 'gemeinde', 'teamer', $1) RETURNING id`,
      [ORG1]
    );
    const antragId = await antragStellen('orgAdmin1', akt.id, { teamWeg: true });

    expect(pushTokens()).toEqual(['token-admin1', 'token-orgAdminSuper']);
    expect(await postfachEmpfaenger(antragId)).toEqual([USERS.admin1.id, USERS.orgAdminSuper.id]);
  });

  it('kein Empfaenger doppelt -- auch nicht mit beiden Quellen der Zugehoerigkeit und Jahrgang', async () => {
    // orgAdmin1 fuehrt seine Stamm-Gemeinde zusaetzlich in
    // user_organizations (so hat Migration 101 alle Konten angelegt) -- hier
    // mit der Rolle admin statt org_admin, wie es im Altbestand vorkommen
    // kann -- und hat obendrein eine Zuweisung auf den Jahrgang. Er steht
    // damit unter den Org-Admins UND unter den zustaendigen Admins: trotzdem
    // genau ein Push und genau ein Postfach-Eintrag.
    await zusatz('orgAdmin1', ORG1, ROLES.admin.id);
    await zuweisen('orgAdmin1', JAHRGAENGE.jahrgang1.id);
    const antragId = await antragStellen();

    expect(pushTokens()).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
    expect(await postfachEmpfaenger(antragId)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    expect(pushTokens()).not.toContain('token-konfi1');
  });
});
