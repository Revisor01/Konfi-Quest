// backend/tests/services/jahrgangLeitungEmpfaenger.test.js
//
// Wer von einer neuen Registrierung und der Warnung vor dem Loeschen eines
// Jahrgangs erfaehrt (27.09.2026, Audit wer-bekommt-was BF-01, BF-03,
// F-02, F-03, F-14).
//
// Regel (CLAUDE.md "Wer sieht und bekommt was"): Org-Admins bekommen alles
// ihrer Gemeinde; Admins nur, was ihre zugewiesenen Jahrgaenge betrifft;
// Teamer:innen bekommen keine Leitungs-Meldung zu Konfis.
//
//   Neue Registrierung   Org-Admins immer (auch ohne Zuweisung) + Admins mit
//                        Leserecht auf den Jahrgang -- genau wer die neue
//                        Konfi in der Konfi-Liste sieht. Kein Rueckfall an
//                        alle Admins, wenn niemand zugewiesen ist (F-03).
//   Loeschwarnung        Org-Admins + Admins mit SCHREIBrecht auf den
//                        Jahrgang -- Befoerdern verlangt Schreibrecht (F-14).
//
// Vorher: Die Registrierung verlangte auch von Org-Admins eine Zuweisung
// (sie fielen heraus, sobald ein Admin zugewiesen war) und ging ohne
// zugewiesenen Admin an ALLE Admins; die Loeschwarnung ging an jeden Admin
// der Gemeinde.
//
// Seed: admin1 (Rolle admin, Org 1) ohne Jahrgang; teamer1 Jahrgang 1;
// orgAdmin1 und orgAdminSuper org_admin in Org 1; admin2 (ohne Jahrgang) und
// orgAdmin2 in Org 2. Push und Mail per Mock.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const emailService = require('../../services/emailService');
const BackgroundService = require('../../services/backgroundService');

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;
const J1 = JAHRGAENGE.jahrgang1.id;
const J2 = JAHRGAENGE.jahrgang2.id;
const FREMDER_JAHRGANG = 90;

const MIT_GERAET = ['teamer1', 'admin1', 'orgAdmin1', 'orgAdminSuper', 'teamer2', 'admin2', 'orgAdmin2'];

describe('Jahrgangs-Meldungen gehen an die zustaendige Leitung', () => {
  let app;
  let db;
  let mailLoeschwarnung;

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
      await db.query('UPDATE users SET email = $2 WHERE id = $1',
        [USERS[schluessel].id, `${schluessel.toLowerCase()}@beispiel.invalid`]);
    }
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, 'Fremder Jahrgang', $2, '2027-05-01')`,
      [FREMDER_JAHRGANG, ORG1]
    );
    sendFirebasePushNotification.mockClear();
    mailLoeschwarnung = vi.spyOn(emailService, 'sendJahrgangDeletionWarningEmail').mockReset().mockResolvedValue({ success: true });
  });

  afterAll(async () => { await closePool(); });

  // ------------------------------------------------------------------
  // Helfer
  // ------------------------------------------------------------------
  const zuweisen = async (schluessel, jahrgangId, { canView = true, canEdit = false } = {}) => {
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, $3, $4)',
      [USERS[schluessel].id, jahrgangId, canView, canEdit]
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

  const pushes = (typ) => sendFirebasePushNotification.mock.calls
    .map(([tok, payload]) => ({ token: tok, data: payload.data }))
    .filter((p) => p.data && p.data.type === typ);
  const tokens = (typ) => pushes(typ).map((p) => p.token).sort();

  const postfach = async (typ) => (await db.query(
    'SELECT user_id FROM notifications WHERE type = $1 ORDER BY user_id', [typ]
  )).rows.map((r) => Number(r.user_id));

  // ==================================================================
  // Neue Registrierung (BF-03, F-02, F-03)
  // ==================================================================
  describe('Neue Registrierung', () => {
    let lfd = 0;
    async function registrieren(jahrgangId = J1, orgId = ORG1) {
      lfd += 1;
      const code = `REG${String(lfd).padStart(4, '0')}`;
      await db.query(
        `INSERT INTO invite_codes (code, organization_id, jahrgang_id, created_by, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + interval '7 days')`,
        [code, orgId, jahrgangId, orgId === ORG1 ? USERS.orgAdmin1.id : USERS.orgAdmin2.id]
      );
      const res = await request(app).post('/api/auth/register-konfi').send({
        invite_code: code,
        display_name: `Neue Konfi ${lfd}`,
        username: `neuekonfi${lfd}`,
        password: 'TestPasswort123!'
      });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
      return { id: res.body.user.id, name: `Neue Konfi ${lfd}` };
    }

    // Steht die neue Konfi in der Konfi-Liste dieser Person?
    async function inKonfiListe(schluessel, konfiId, aktiveOrg = null) {
      const res = await request(app).get('/api/admin/konfis').set(auth(schluessel, aktiveOrg));
      expect(res.status).toBe(200);
      return res.body.some((k) => Number(k.id) === Number(konfiId));
    }

    describe('verboten', () => {
      it('ohne zugewiesenen Admin kein Rueckfall an alle Admins: nur die Gemeindeleitung', async () => {
        const konfi = await registrieren();
        expect(tokens('new_konfi_registration')).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
        expect(await postfach('new_konfi_registration')).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
        expect(await inKonfiListe('admin1', konfi.id)).toBe(false);
      });

      it('Admin eines fremden Jahrgangs bekommt nichts', async () => {
        await zuweisen('admin1', FREMDER_JAHRGANG);
        await registrieren();
        expect(tokens('new_konfi_registration')).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      });

      it('Zuweisung ohne Leserecht (can_view = false) reicht nicht -- wie in der Konfi-Liste', async () => {
        await zuweisen('admin1', J1, { canView: false });
        const konfi = await registrieren();
        expect(tokens('new_konfi_registration')).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
        expect(await inKonfiListe('admin1', konfi.id)).toBe(false);
      });

      it('Teamer:innen des Jahrgangs bekommen sie nicht (F-02)', async () => {
        // teamer1 ist im Seed Jahrgang 1 zugewiesen.
        await registrieren();
        expect(tokens('new_konfi_registration')).not.toContain('token-teamer1');
        expect(await postfach('new_konfi_registration')).not.toContain(USERS.teamer1.id);
      });
    });

    describe('erlaubt', () => {
      it('Admin des Jahrgangs UND die Org-Admins ohne Zuweisung -- vorher fielen die Org-Admins heraus', async () => {
        await zuweisen('admin1', J1);
        const konfi = await registrieren();
        expect(tokens('new_konfi_registration')).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper']);
        expect(await postfach('new_konfi_registration')).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
        expect(await inKonfiListe('admin1', konfi.id)).toBe(true);
        expect(await inKonfiListe('orgAdmin1', konfi.id)).toBe(true);
        for (const p of pushes('new_konfi_registration')) {
          expect(p.data).toMatchObject({ organization_id: String(ORG1), jahrgang_id: String(J1) });
        }
      });

      it('Admin mit dem Super-Admin-Merkmal sieht alle Konfis und bekommt sie ohne Jahrgang', async () => {
        await db.query('UPDATE users SET is_super_admin = true WHERE id = $1', [USERS.admin1.id]);
        invalidateUserCache(USERS.admin1.id);
        const konfi = await registrieren();
        expect(tokens('new_konfi_registration')).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper']);
        expect(await inKonfiListe('admin1', konfi.id)).toBe(true);
      });
    });

    describe('Mehrere Gemeinden', () => {
      it('erlaubt: Admin von Org 2 nur ueber user_organizations mit Jahrgang 2, Org-Admin von Org 2 nur ueber user_organizations', async () => {
        await zusatz('admin1', ORG2, ROLES.admin2.id);
        await zuweisen('admin1', J2);
        await zusatz('orgAdmin1', ORG2, ROLES.orgAdmin2.id);
        const konfi = await registrieren(J2, ORG2);

        // admin2 (Org 2, ohne Jahrgang) bleibt draussen.
        expect(tokens('new_konfi_registration')).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdmin2']);
        for (const p of pushes('new_konfi_registration')) expect(p.data.organization_id).toBe(String(ORG2));
        expect(await inKonfiListe('admin1', konfi.id, ORG2)).toBe(true);
        expect(await inKonfiListe('admin2', konfi.id)).toBe(false);
      });

      it('verboten: Admin von Org 2 ohne Zuweisung auf Jahrgang 2 bekommt nichts', async () => {
        await zusatz('admin1', ORG2, ROLES.admin2.id);
        await registrieren(J2, ORG2);
        expect(tokens('new_konfi_registration')).toEqual(['token-orgAdmin2']);
      });
    });

    describe('Paritaet: Mitteilung <=> Konfi-Liste', () => {
      const konstellationen = [
        ['ohne Zuweisung', async () => {}],
        ['Zuweisung auf den Jahrgang', async () => zuweisen('admin1', J1)],
        ['fremder Jahrgang', async () => zuweisen('admin1', FREMDER_JAHRGANG)],
        ['ohne Leserecht', async () => zuweisen('admin1', J1, { canView: false })],
      ];
      for (const [name, vorbereiten] of konstellationen) {
        it(`admin1 ${name}: Push, Postfach und Konfi-Liste sagen dasselbe`, async () => {
          await vorbereiten();
          const konfi = await registrieren();
          const bekommt = tokens('new_konfi_registration').includes('token-admin1');
          expect((await postfach('new_konfi_registration')).includes(USERS.admin1.id)).toBe(bekommt);
          expect(await inKonfiListe('admin1', konfi.id)).toBe(bekommt);
          expect(tokens('new_konfi_registration')).toEqual(expect.arrayContaining(['token-orgAdmin1', 'token-orgAdminSuper']));
        });
      }
    });
  });

  // ==================================================================
  // Warnung vor dem Loeschen eines Jahrgangs (BF-01, F-14)
  // ==================================================================
  describe('Loeschwarnung', () => {
    let eventId = 9700;
    async function konfirmationVorTagen(jahrgangId, orgId, tage = 55) {
      eventId += 1;
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, mandatory, has_timeslots)
         VALUES ($1, 'Konfirmation', CURRENT_DATE - ($3 || ' days')::interval, $2, true, false, false, false)`,
        [eventId, orgId, String(tage)]
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [eventId, jahrgangId]);
    }
    const mails = () => mailLoeschwarnung.mock.calls.map(([adresse]) => adresse).sort();
    const warnen = async () => BackgroundService.runJahrgangDeletionReminders(db);

    it('verboten: Admin ohne Zuweisung bekommt weder Push noch Mail noch Postfach', async () => {
      await konfirmationVorTagen(J1, ORG1);
      await warnen();
      expect(tokens('jahrgang_deletion_warning')).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      expect(mails()).toEqual(['orgadmin1@beispiel.invalid', 'orgadminsuper@beispiel.invalid']);
      expect(await postfach('jahrgang_deletion_warning')).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    });

    it('verboten: nur Leserecht auf den Jahrgang reicht nicht -- Befoerdern verlangt Schreibrecht (F-14)', async () => {
      await zuweisen('admin1', J1, { canView: true, canEdit: false });
      await konfirmationVorTagen(J1, ORG1);
      await warnen();
      expect(tokens('jahrgang_deletion_warning')).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
      expect(mails()).toEqual(['orgadmin1@beispiel.invalid', 'orgadminsuper@beispiel.invalid']);
      // ... und Befoerdern wird ihm verweigert.
      const res = await request(app).post(`/api/admin/konfis/${USERS.konfi1.id}/promote-teamer`).set(auth('admin1'));
      expect(res.status).toBe(403);
    });

    it('verboten: Teamer:in mit Schreibrecht bekommt sie nicht', async () => {
      await db.query('UPDATE user_jahrgang_assignments SET can_edit = true WHERE user_id = $1', [USERS.teamer1.id]);
      await konfirmationVorTagen(J1, ORG1);
      await warnen();
      expect(tokens('jahrgang_deletion_warning')).not.toContain('token-teamer1');
      expect(mails()).not.toContain('teamer1@beispiel.invalid');
    });

    it('erlaubt: Admin mit Schreibrecht auf den Jahrgang bekommt Push, Mail und Postfach -- und darf befoerdern', async () => {
      await zuweisen('admin1', J1, { canView: true, canEdit: true });
      await konfirmationVorTagen(J1, ORG1);
      await warnen();
      expect(tokens('jahrgang_deletion_warning')).toEqual(['token-admin1', 'token-orgAdmin1', 'token-orgAdminSuper']);
      expect(mails()).toEqual(['admin1@beispiel.invalid', 'orgadmin1@beispiel.invalid', 'orgadminsuper@beispiel.invalid']);
      expect(await postfach('jahrgang_deletion_warning')).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
      const res = await request(app).post(`/api/admin/konfis/${USERS.konfi1.id}/promote-teamer`).set(auth('admin1'));
      expect(res.status).toBe(200);
    });

    it('verboten: Schreibrecht auf einen ANDEREN Jahrgang reicht nicht', async () => {
      await zuweisen('admin1', FREMDER_JAHRGANG, { canView: true, canEdit: true });
      await konfirmationVorTagen(J1, ORG1);
      await warnen();
      expect(tokens('jahrgang_deletion_warning')).toEqual(['token-orgAdmin1', 'token-orgAdminSuper']);
    });

    it('Mehrere Gemeinden: Org-Admin von Org 2 nur ueber user_organizations bekommt sie, admin2 ohne Zuweisung nicht', async () => {
      await zusatz('orgAdmin1', ORG2, ROLES.orgAdmin2.id);
      await konfirmationVorTagen(J2, ORG2);
      await warnen();
      expect(tokens('jahrgang_deletion_warning')).toEqual(['token-orgAdmin1', 'token-orgAdmin2']);
      for (const p of pushes('jahrgang_deletion_warning')) expect(p.data.organization_id).toBe(String(ORG2));
      expect(mails()).toEqual(['orgadmin1@beispiel.invalid', 'orgadmin2@beispiel.invalid']);
    });
  });
});
