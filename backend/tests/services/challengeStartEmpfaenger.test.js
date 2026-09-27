// backend/tests/services/challengeStartEmpfaenger.test.js
//
// Challenge-Start: Mitteilung und "neue Challenge" im Zaehler fuer alle, die
// mitmachen duerfen (Audit "Wer bekommt was" 27.09.2026, BF-07 / F-04).
//
// Vorher gingen die Empfaenger nur ueber die Jahrgaenge an Konfis: Bei
// "Nur das Team" bekam niemand eine Mitteilung, bei "Jahrgang und Team" nur
// die Konfis. Das Team sah beide Challenges in der Liste und durfte
// einreichen, bekam aber weder Push noch eine Zahl fuer die neue Challenge.
//
// Regel (CLAUDE.md "Wer sieht und bekommt was", F-04 wie empfohlen):
//   "Nur das Team"       das ganze Team der Gemeinde
//   "Jahrgang und Team"  Konfis und Team der Jahrgaenge, Org-Admins immer
//   "Nur die Konfis"     die Konfis der Jahrgaenge (das Team liest mit)
// Keine Doppelten, wer die Challenge angelegt hat nie.
//
// Firebase gemockt wie in pushEmpfaengerMultiOrg.test.js; geprueft wird die
// konkrete Empfaengerliste.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');
const BackgroundService = require('../../services/backgroundService');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const ORG1 = ORGS.testGemeinde.id;
const JG1 = JAHRGAENGE.jahrgang1.id;

// Zusaetzlich zum Seed (Org 1): zweiter Jahrgang B mit Konfi und Teamer:in,
// ein Admin des Jahrgangs 1, eine Teamer:in ohne Jahrgang, eine Teamer:in,
// die Jahrgang 1 nur ohne Leserecht zugewiesen hat.
const JG_B = 321;
const KONFI_B = 531;
const TEAMER_B = 532;
const ADMIN_J1 = 533;
const TEAMER_OHNE_JG = 534;
const TEAMER_OHNE_LESERECHT = 535;

const PERSONEN = {
  konfi1: { id: USERS.konfi1.id, type: 'konfi', role_id: ROLES.konfi.id },
  konfi2: { id: USERS.konfi2.id, type: 'konfi', role_id: ROLES.konfi.id },
  konfiB: { id: KONFI_B, type: 'konfi', role_id: ROLES.konfi.id },
  teamer1: { id: USERS.teamer1.id, type: 'teamer', role_id: ROLES.teamer.id },
  teamerB: { id: TEAMER_B, type: 'teamer', role_id: ROLES.teamer.id },
  teamerOhneJg: { id: TEAMER_OHNE_JG, type: 'teamer', role_id: ROLES.teamer.id },
  teamerOhneLeserecht: { id: TEAMER_OHNE_LESERECHT, type: 'teamer', role_id: ROLES.teamer.id },
  admin1: { id: USERS.admin1.id, type: 'admin', role_id: ROLES.admin.id },
  adminJ1: { id: ADMIN_J1, type: 'admin', role_id: ROLES.admin.id },
  orgAdmin1: { id: USERS.orgAdmin1.id, type: 'admin', role_id: ROLES.orgAdmin.id },
};
const NAME_ZU_ID = Object.fromEntries(Object.entries(PERSONEN).map(([n, p]) => [String(p.id), n]));

// Tokens tragen den Namen der Person, damit die Erwartungen lesbar bleiben.
const TOKEN_ZU = {
  ...Object.fromEntries(Object.entries(PERSONEN).map(([n, p]) => [p.id, `token-${n}`])),
  [USERS.orgAdminSuper.id]: 'token-orgAdminSuper',
  [USERS.superAdmin.id]: 'token-superAdmin',
  [USERS.konfi3.id]: 'token-konfi3',
  [USERS.teamer2.id]: 'token-teamer2',
  [USERS.orgAdmin2.id]: 'token-orgAdmin2',
};

const empfangen = () => sendFirebasePushNotification.mock.calls
  .filter(([, payload]) => payload.data && payload.data.type === 'challenge_started')
  .map(([token]) => token.replace(/^token-/, ''))
  .sort();

const tokenFuer = (name) => {
  const p = PERSONEN[name];
  return jwt.sign(
    { id: p.id, type: p.type, display_name: name, organization_id: ORG1, role_id: p.role_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

describe('Challenge-Start: Mitteilung und Zaehler fuer alle, die mitmachen (BF-07)', () => {
  let db;
  let app;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, '2026/2027 B', $2, '2027-05-01')`,
      [JG_B, ORG1]
    );
    for (const name of ['konfiB', 'teamerB', 'adminJ1', 'teamerOhneJg', 'teamerOhneLeserecht']) {
      const p = PERSONEN[name];
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $2, $3, $4, true)`,
        [p.id, name.toLowerCase(), p.role_id, ORG1]
      );
    }
    await db.query(
      'INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id) VALUES ($1, $2, $3)',
      [KONFI_B, JG_B, ORG1]
    );
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true), ($3, $4, true, true), ($5, $4, false, false)`,
      [TEAMER_B, JG_B, ADMIN_J1, JG1, TEAMER_OHNE_LESERECHT]
    );
    for (const [userId, token] of Object.entries(TOKEN_ZU)) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [userId, token, `dev-${token}`]
      );
    }
    for (const p of Object.values(PERSONEN)) invalidateUserCache(p.id);
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => {
    await closePool();
  });

  async function challenge({ audience, jahrgaenge = [], createdBy = null, titel = 'Runde' }) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft, start_push_sent)
       VALUES ($1, $2, 'd', $3, 'public', false, '["text"]'::jsonb, 'A', $4,
               NOW() - interval '1 minute', NOW() + interval '7 days', false, false)
       RETURNING id`,
      [ORG1, titel, audience, createdBy]
    );
    for (const j of jahrgaenge) {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, j]);
    }
    return c.id;
  }

  const starten = (id) => PushService.sendChallengeStartedToJahrgaenge(db, id, 'Runde');

  // ------------------------------------------------------------------
  // Start-Mitteilung
  // ------------------------------------------------------------------

  it('"Nur das Team": das ganze Team der Gemeinde, auch ohne Jahrgang', async () => {
    await starten(await challenge({ audience: 'nur_team' }));
    expect(empfangen()).toEqual([
      'admin1', 'adminJ1', 'orgAdmin1', 'orgAdminSuper',
      'teamer1', 'teamerB', 'teamerOhneJg', 'teamerOhneLeserecht'
    ]);
  });

  it('verboten: Konfis bekommen den Start einer "Nur das Team"-Challenge nicht', async () => {
    // Mit einer Jahrgangs-Zuordnung, wie sie ein Altbestand tragen kann: Die
    // Konfis fallen ueber den Teilnahmekreis heraus, nicht nur, weil
    // "Nur das Team" normalerweise keine Jahrgaenge hat.
    await starten(await challenge({ audience: 'nur_team', jahrgaenge: [JG1, JG_B] }));
    const e = empfangen();
    for (const konfi of ['konfi1', 'konfi2', 'konfiB', 'konfi3']) expect(e).not.toContain(konfi);
  });

  it('"Jahrgang und Team": Konfis und Team des Jahrgangs, Org-Admins immer', async () => {
    await starten(await challenge({ audience: 'konfis_und_team', jahrgaenge: [JG1] }));
    expect(empfangen()).toEqual(['adminJ1', 'konfi1', 'konfi2', 'orgAdmin1', 'orgAdminSuper', 'teamer1']);
  });

  it('verboten: Teamer:in und Admin ohne Jahrgang, fremder Jahrgang und Zuweisung ohne Leserecht bekommen "Jahrgang und Team" nicht', async () => {
    await starten(await challenge({ audience: 'konfis_und_team', jahrgaenge: [JG1] }));
    const e = empfangen();
    for (const name of ['teamerOhneJg', 'admin1', 'teamerB', 'konfiB', 'teamerOhneLeserecht']) {
      expect(e).not.toContain(name);
    }
  });

  it('"Nur die Konfis": nur die Konfis der Jahrgaenge', async () => {
    await starten(await challenge({ audience: 'konfis', jahrgaenge: [JG1, JG_B] }));
    expect(empfangen()).toEqual(['konfi1', 'konfi2', 'konfiB']);
  });

  it('nie an Super-Admin und an andere Gemeinden', async () => {
    await starten(await challenge({ audience: 'nur_team' }));
    const e = empfangen();
    for (const name of ['superAdmin', 'teamer2', 'orgAdmin2', 'konfi3']) expect(e).not.toContain(name);
  });

  it('die startende Person nie, jede andere genau einmal -- auch mit zwei Zugehoerigkeiten', async () => {
    // orgAdmin2 (Stamm Org 2) arbeitet ueber user_organizations in Org 1 als
    // Teamer:in mit; teamer1 steht zusaetzlich doppelt in Org 1.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3), ($4, $2, $3)',
      [USERS.orgAdmin2.id, ORG1, ROLES.teamer.id, USERS.teamer1.id]
    );
    await starten(await challenge({ audience: 'nur_team', createdBy: USERS.teamer1.id }));
    expect(empfangen()).toEqual([
      'admin1', 'adminJ1', 'orgAdmin1', 'orgAdmin2', 'orgAdminSuper',
      'teamerB', 'teamerOhneJg', 'teamerOhneLeserecht'
    ]);
  });

  it('der Hintergrundlauf startet mit denselben Empfaengern und meldet nur einmal', async () => {
    await challenge({ audience: 'konfis_und_team', jahrgaenge: [JG1], createdBy: USERS.orgAdmin1.id });
    await BackgroundService.sendChallengeStartPushes(db);
    await BackgroundService.sendChallengeStartPushes(db);
    expect(empfangen()).toEqual(['adminJ1', 'konfi1', 'konfi2', 'orgAdminSuper', 'teamer1']);
  });

  it('Paritaet: die Start-Mitteilung bekommt genau, wer die Challenge in GET /api/challenges/konfi findet', async () => {
    const ids = {
      nurTeam: await challenge({ audience: 'nur_team' }),
      jahrgangUndTeam: await challenge({ audience: 'konfis_und_team', jahrgaenge: [JG1] }),
      nurKonfis: await challenge({ audience: 'konfis', jahrgaenge: [JG1] }),
      beideJahrgaenge: await challenge({ audience: 'konfis_und_team', jahrgaenge: [JG1, JG_B] }),
    };
    const liste = {};
    for (const name of Object.keys(PERSONEN)) {
      const res = await request(app).get('/api/challenges/konfi').set('Authorization', `Bearer ${tokenFuer(name)}`);
      expect(res.status).toBe(200);
      liste[name] = new Set(res.body.active.map((c) => c.id));
    }
    for (const [art, id] of Object.entries(ids)) {
      sendFirebasePushNotification.mockClear();
      await starten(id);
      const bekommen = empfangen().filter((n) => n in PERSONEN);
      const sehen = Object.keys(PERSONEN).filter((n) => liste[n].has(id)).sort();
      expect({ art, bekommen }).toEqual({ art, bekommen: sehen });
    }
    // Beide Richtungen sind besetzt: Die Liste zeigt die Challenges wirklich.
    expect(liste.teamerOhneJg.has(ids.nurTeam)).toBe(true);
    expect(liste.teamer1.has(ids.jahrgangUndTeam)).toBe(true);
    expect(liste.teamer1.has(ids.nurKonfis)).toBe(false);
  });

  // ------------------------------------------------------------------
  // "Neue Challenge" im Zaehler des Teams
  // ------------------------------------------------------------------

  const zaehler = async (name) => {
    const res = await request(app).get('/api/notifications/badge-counts').set('Authorization', `Bearer ${tokenFuer(name)}`);
    expect(res.status).toBe(200);
    return res.body;
  };
  const oeffnen = async (name, id) => {
    const res = await request(app).post(`/api/challenges/konfi/${id}/mark-read`).set('Authorization', `Bearer ${tokenFuer(name)}`);
    expect(res.status).toBe(200);
  };

  it('Zaehler: eine nie geoeffnete, laufende Challenge, bei der das Team mitmacht, zaehlt als neu -- bis zum Oeffnen', async () => {
    const id = await challenge({ audience: 'nur_team' });
    expect((await zaehler('teamerOhneJg')).challengeUpdates).toEqual({ total: 1, byChallenge: { [id]: 1 } });
    await oeffnen('teamerOhneJg', id);
    expect((await zaehler('teamerOhneJg')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
  });

  it('Zaehler: "Jahrgang und Team" zaehlt beim Team des Jahrgangs, nicht ohne Jahrgang', async () => {
    const id = await challenge({ audience: 'konfis_und_team', jahrgaenge: [JG1] });
    expect((await zaehler('teamer1')).challengeUpdates).toEqual({ total: 1, byChallenge: { [id]: 1 } });
    expect((await zaehler('orgAdmin1')).challengeUpdates).toEqual({ total: 1, byChallenge: { [id]: 1 } });
    expect((await zaehler('teamerOhneJg')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
    expect((await zaehler('admin1')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
  });

  it('Zaehler: bei "Nur die Konfis" ist die Challenge fuers Team nicht neu -- das Team liest nur mit', async () => {
    await challenge({ audience: 'konfis', jahrgaenge: [JG1] });
    expect((await zaehler('teamer1')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
    expect((await zaehler('orgAdmin1')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
  });

  it('Zaehler: fuer die Person, die sie angelegt hat, ist die eigene Challenge nicht neu', async () => {
    const id = await challenge({ audience: 'nur_team', createdBy: USERS.teamer1.id });
    expect((await zaehler('teamer1')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
    expect((await zaehler('teamerB')).challengeUpdates).toEqual({ total: 1, byChallenge: { [id]: 1 } });
  });

  it('Zaehler: Entwurf, noch nicht gestartet und beendet zaehlen nicht', async () => {
    const entwurf = await challenge({ audience: 'nur_team' });
    await db.query('UPDATE challenges SET is_draft = true WHERE id = $1', [entwurf]);
    const spaeter = await challenge({ audience: 'nur_team' });
    await db.query(`UPDATE challenges SET starts_at = NOW() + interval '1 day' WHERE id = $1`, [spaeter]);
    const vorbei = await challenge({ audience: 'nur_team' });
    await db.query(`UPDATE challenges SET starts_at = NOW() - interval '9 days', ends_at = NOW() - interval '1 hour' WHERE id = $1`, [vorbei]);
    expect((await zaehler('teamer1')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
  });

  it('Zaehler: dieselbe Zahl am Gemeinde-Umschalter (App-Symbol-Rechnung)', async () => {
    await challenge({ audience: 'nur_team' });
    const res = await request(app).get('/api/notifications/badge-counts/je-organisation')
      .set('Authorization', `Bearer ${tokenFuer('teamerOhneJg')}`);
    expect(res.status).toBe(200);
    expect(res.body.jeOrganisation).toEqual({ [ORG1]: { offen: 1 } });
  });

  it('Zaehler: die Antwortform von badge-counts bleibt (nur Werte aendern sich)', async () => {
    await challenge({ audience: 'nur_team' });
    const z = await zaehler('teamer1');
    expect(Object.keys(z).sort()).toEqual([
      'challengeApprovals', 'challengeUpdates', 'chat', 'newBadges',
      'pendingChallenges', 'pendingEvents', 'pendingRequests', 'postfach'
    ]);
    expect(Object.keys(z.challengeUpdates).sort()).toEqual(['byChallenge', 'total']);
  });
});
