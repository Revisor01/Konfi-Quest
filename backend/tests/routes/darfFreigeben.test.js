// backend/tests/routes/darfFreigeben.test.js
//
// „Darf freigeben" (Simon, 09.10.2026; docs/planung/darf-freigeben.md):
// drei Rechte je Jahrgangs-Zuweisung -- Antraege entscheiden, Events
// verbuchen, Challenge-Beitraege freigeben. Org-Admin hat sie immer. Wer ein
// Recht nicht hat, sieht die Liste weiter (nur lesend), bekommt aber weder
// Push noch Postfach-Eintrag noch Zahl, und der Server antwortet 403.
// Vorgabe fuer alle Zuweisungen: true -- niemand bekommt nach dem Deploy
// weniger.
//
// Je Vorgang der erlaubte UND der verbotene Fall, dazu die Vorgaenge ohne
// Jahrgang (Teamer-Antraege, Termine ohne Jahrgang, "Nur das Team") und die
// Teamer:innen (seit 09.10.2026 dasselbe Recht fuer Challenge-Beitraege).
//
// Seed: admin1 (Rolle admin, Org 1) ohne Jahrgang, konfi1 in Jahrgang 1,
// teamer1 Jahrgang 1 zugewiesen, orgAdmin1 org_admin in Org 1.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { appIconSummenAllerGemeinden } = require('../../utils/appIconBadge');
const { ladeLeitungZumAntrag } = require('../../utils/antragLeitungSicht');
const { ladeLeitungZumChallengeBeitrag } = require('../../utils/challengeLeitungSicht');
const { zaehleWartendeTermineJeLeitung } = require('../../utils/terminLeitungSicht');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG1 = ORGS.testGemeinde.id;
const J1 = JAHRGAENGE.jahrgang1.id;
const J_ZWEI = 91; // ein zweiter Jahrgang in Org 1, ohne Konfis

const MIT_GERAET = ['admin1', 'orgAdmin1', 'teamer1'];

describe('Darf freigeben: Antraege, Verbuchen, Challenge-Beitraege', () => {
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
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, 'Zweiter', $2, '2027-05-01')`,
      [J_ZWEI, ORG1]
    );
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => { await closePool(); });

  // ------------------------------------------------------------------
  // Helfer
  // ------------------------------------------------------------------
  const auth = (schluessel) => ({ Authorization: `Bearer ${generateToken(schluessel)}` });

  async function zuweisen(schluessel, jahrgangId, { antraege = true, verbuchen = true, challenges = true } = {}) {
    await db.query(
      `INSERT INTO user_jahrgang_assignments
         (user_id, jahrgang_id, can_view, can_edit, darf_antraege_entscheiden, darf_events_verbuchen, darf_challenges_freigeben)
       VALUES ($1, $2, true, true, $3, $4, $5)
       ON CONFLICT (user_id, jahrgang_id) DO UPDATE
         SET darf_antraege_entscheiden = $3, darf_events_verbuchen = $4, darf_challenges_freigeben = $5`,
      [USERS[schluessel].id, jahrgangId, antraege, verbuchen, challenges]
    );
    invalidateUserCache(USERS[schluessel].id);
  }

  async function antrag({ userId = USERS.konfi1.id, activityId = ACTIVITIES.sonntagsgottesdienst.id, status = 'pending' } = {}) {
    const { rows: [a] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
       VALUES ($1, $2, '2026-06-01', $3, $4) RETURNING id`,
      [userId, activityId, status, ORG1]
    );
    return a.id;
  }

  async function teamerAktivitaet() {
    const { rows: [a] } = await db.query(
      `INSERT INTO activities (name, points, type, organization_id, target_role)
       VALUES ('Teamer-Einsatz', 0, 'gemeinde', $1, 'teamer') RETURNING id`,
      [ORG1]
    );
    return a.id;
  }

  async function vergangenesEvent(id, { jahrgang = J1, teamerOnly = false } = {}) {
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, teamer_only, mandatory, max_participants, has_timeslots, points, point_type)
       VALUES ($1, $2, NOW() - interval '2 days', $3, $4, false, 0, false, 1, 'gemeinde')`,
      [id, `Event ${id}`, ORG1, teamerOnly]
    );
    if (jahrgang) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [id, jahrgang]);
    }
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, attendance_status, organization_id)
       VALUES ($1, $2, 'confirmed', NULL, $3) RETURNING id`,
      [USERS.konfi1.id, id, ORG1]
    );
    return b.id;
  }

  async function challengeMitBeitrag({ audience = 'konfis', jahrgang = J1, moderated = true, einreicher = USERS.konfi1.id } = {}) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Runde', 'd', $2, 'public', $3, '["text"]'::jsonb, 'A', $4,
               NOW() - interval '2 days', NOW() + interval '7 days', false)
       RETURNING id`,
      [ORG1, audience, moderated, USERS.orgAdmin1.id]
    );
    if (jahrgang) {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, jahrgang]);
    }
    const { rows: [s] } = await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status)
       VALUES ($1, $2, $3, 'text', 'Beitrag', 'pending') RETURNING id`,
      [c.id, einreicher, ORG1]
    );
    return { challengeId: c.id, submissionId: s.id };
  }

  async function zaehler(schluessel) {
    const res = await request(app).get('/api/notifications/badge-counts').set(auth(schluessel));
    expect(res.status).toBe(200);
    return res.body;
  }

  async function appSymbol(schluessel) {
    const jePerson = await appIconSummenAllerGemeinden(db, [USERS[schluessel].id]);
    return jePerson.get(USERS[schluessel].id).jeOrganisation.get(ORG1);
  }

  const pushTokens = (typ) => sendFirebasePushNotification.mock.calls
    .filter(([, payload]) => payload.data && payload.data.type === typ)
    .map(([tok]) => tok)
    .sort();

  // ==================================================================
  // Antraege entscheiden
  // ==================================================================
  describe('Antraege entscheiden', () => {
    it('erlaubt: Admin mit Recht am Jahrgang sieht, zaehlt und entscheidet', async () => {
      await zuweisen('admin1', J1);
      const id = await antrag();

      const liste = await request(app).get('/api/admin/activities/requests?status=pending').set(auth('admin1'));
      expect(liste.status).toBe(200);
      expect(liste.body.map((a) => [a.id, a.darf_entscheiden])).toEqual([[id, true]]);
      expect((await zaehler('admin1')).pendingRequests).toBe(1);
      expect(await appSymbol('admin1')).toBe(1);
      expect(await ladeLeitungZumAntrag(db, id)).toEqual([USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);

      const res = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('admin1')).send({ status: 'approved' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('verboten: ohne Recht bleibt der Antrag sichtbar, aber ohne Zahl, ohne Empfang und mit 403', async () => {
      await zuweisen('admin1', J1, { antraege: false });
      const id = await antrag();

      const liste = await request(app).get('/api/admin/activities/requests?status=pending').set(auth('admin1'));
      expect(liste.status).toBe(200);
      expect(liste.body.map((a) => [a.id, a.darf_entscheiden])).toEqual([[id, false]]);
      const einzeln = await request(app).get(`/api/admin/activities/requests/${id}`).set(auth('admin1'));
      expect(einzeln.status).toBe(200);
      expect(einzeln.body.darf_entscheiden).toBe(false);

      expect((await zaehler('admin1')).pendingRequests).toBe(0);
      expect(await appSymbol('admin1')).toBe(0);
      expect(await ladeLeitungZumAntrag(db, id)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);

      const res = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('admin1')).send({ status: 'approved' });
      expect(res.status).toBe(403);
      const { rows: [nachher] } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
      expect(nachher.status).toBe('pending');
    });

    it('verboten: auch Zuruecksetzen braucht das Recht; die Gemeindeleitung darf es', async () => {
      await zuweisen('admin1', J1, { antraege: false });
      const id = await antrag();
      const ok = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('orgAdmin1')).send({ status: 'approved' });
      expect(ok.status).toBe(200);
      await warteAufNachwehen(app);

      const verboten = await request(app).put(`/api/admin/activities/requests/${id}/reset`).set(auth('admin1'));
      expect(verboten.status).toBe(403);
      const erlaubt = await request(app).put(`/api/admin/activities/requests/${id}/reset`).set(auth('orgAdmin1'));
      expect(erlaubt.status).toBe(200);
    });

    it('Gemeindeleitung ohne jede Zuweisung darf immer', async () => {
      const id = await antrag();
      const liste = await request(app).get('/api/admin/activities/requests?status=pending').set(auth('orgAdmin1'));
      expect(liste.body.map((a) => a.darf_entscheiden)).toEqual([true]);
      expect((await zaehler('orgAdmin1')).pendingRequests).toBe(1);
    });

    it('Push und Postfach "Neuer Antrag" nur an, wer entscheiden darf', async () => {
      await zuweisen('admin1', J1, { antraege: false });
      const res = await request(app).post('/api/konfi/requests').set(auth('konfi1'))
        .send({ activity_id: ACTIVITIES.sonntagsgottesdienst.id, requested_date: '2026-06-01' });
      expect(res.status).toBe(201);
      await warteAufNachwehen(app);

      expect(pushTokens('new_activity_request')).toEqual(['token-orgAdmin1']);
      const { rows } = await db.query(
        "SELECT user_id FROM notifications WHERE type = 'new_activity_request' ORDER BY user_id");
      expect(rows.map((r) => Number(r.user_id))).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
    });

    it('erlaubt: mit Recht bekommt der Admin Push und Postfach', async () => {
      await zuweisen('admin1', J1);
      const res = await request(app).post('/api/konfi/requests').set(auth('konfi1'))
        .send({ activity_id: ACTIVITIES.sonntagsgottesdienst.id, requested_date: '2026-06-01' });
      expect(res.status).toBe(201);
      await warteAufNachwehen(app);
      expect(pushTokens('new_activity_request')).toEqual(['token-admin1', 'token-orgAdmin1']);
    });

    describe('Antraege von Teamer:innen (ohne Jahrgang)', () => {
      it('ohne Zuweisung: wie bisher -- der Admin darf', async () => {
        const id = await antrag({ userId: USERS.teamer1.id, activityId: await teamerAktivitaet() });
        const liste = await request(app).get('/api/admin/activities/requests?status=pending').set(auth('admin1'));
        expect(liste.body.map((a) => [a.id, a.darf_entscheiden])).toEqual([[id, true]]);
        expect((await zaehler('admin1')).pendingRequests).toBe(1);
      });

      it('verboten: Recht in keinem seiner Jahrgaenge -- auch Teamer-Antraege nicht', async () => {
        await zuweisen('admin1', J1, { antraege: false });
        const id = await antrag({ userId: USERS.teamer1.id, activityId: await teamerAktivitaet() });
        const liste = await request(app).get('/api/admin/activities/requests?status=pending').set(auth('admin1'));
        expect(liste.body.map((a) => [a.id, a.darf_entscheiden])).toEqual([[id, false]]);
        expect((await zaehler('admin1')).pendingRequests).toBe(0);
        expect(await ladeLeitungZumAntrag(db, id)).toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id]);
        const res = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('admin1')).send({ status: 'approved' });
        expect(res.status).toBe(403);
      });

      it('erlaubt: Recht in mindestens einem Jahrgang genuegt', async () => {
        await zuweisen('admin1', J1, { antraege: false });
        await zuweisen('admin1', J_ZWEI, { antraege: true });
        const id = await antrag({ userId: USERS.teamer1.id, activityId: await teamerAktivitaet() });
        expect((await zaehler('admin1')).pendingRequests).toBe(1);
        const res = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('admin1')).send({ status: 'approved' });
        expect(res.status).toBe(200);
        await warteAufNachwehen(app);
      });
    });
  });

  // ==================================================================
  // Events verbuchen
  // ==================================================================
  describe('Events verbuchen', () => {
    it('erlaubt: Admin mit Recht sieht, zaehlt und verbucht', async () => {
      await zuweisen('admin1', J1);
      const buchung = await vergangenesEvent(401);

      const detail = await request(app).get('/api/events/401').set(auth('admin1'));
      expect(detail.status).toBe(200);
      expect(detail.body.darf_verbuchen).toBe(true);
      expect((await zaehler('admin1')).pendingEvents).toBe(1);
      expect(await appSymbol('admin1')).toBe(1);

      const res = await request(app).put(`/api/events/401/participants/${buchung}/attendance`).set(auth('admin1'))
        .send({ attendance_status: 'present' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('verboten: ohne Recht bleibt der Termin lesbar, ohne Zahl und mit 403 beim Verbuchen', async () => {
      await zuweisen('admin1', J1, { verbuchen: false });
      const buchung = await vergangenesEvent(402);

      const detail = await request(app).get('/api/events/402').set(auth('admin1'));
      expect(detail.status).toBe(200);
      expect(detail.body.darf_verbuchen).toBe(false);
      expect(detail.body.participants.map((p) => p.id)).toEqual([buchung]);
      expect((await zaehler('admin1')).pendingEvents).toBe(0);
      expect(await appSymbol('admin1')).toBe(0);

      const einzeln = await request(app).put(`/api/events/402/participants/${buchung}/attendance`).set(auth('admin1'))
        .send({ attendance_status: 'present' });
      expect(einzeln.status).toBe(403);
      const alle = await request(app).put('/api/events/402/participants/attendance-all').set(auth('admin1')).send({});
      expect(alle.status).toBe(403);
      const { rows: [b] } = await db.query('SELECT attendance_status FROM event_bookings WHERE id = $1', [buchung]);
      expect(b.attendance_status).toBe(null);
    });

    it('Verbuchen-Erinnerung nur an, wer verbuchen darf', async () => {
      await zuweisen('admin1', J1, { verbuchen: false });
      await vergangenesEvent(403);
      const zahlen = await zaehleWartendeTermineJeLeitung(db, [ORG1]);
      expect(zahlen.map((z) => [z.user_id, z.anzahl])).toEqual([[USERS.orgAdmin1.id, 1], [USERS.orgAdminSuper.id, 1]]);
    });

    it('erlaubt: mit Recht bekommt der Admin die Erinnerung', async () => {
      await zuweisen('admin1', J1);
      await vergangenesEvent(404);
      const zahlen = await zaehleWartendeTermineJeLeitung(db, [ORG1]);
      expect(zahlen.map((z) => [z.user_id, z.anzahl])).toEqual(
        [[USERS.admin1.id, 1], [USERS.orgAdmin1.id, 1], [USERS.orgAdminSuper.id, 1]]);
    });

    it('Termin ohne Jahrgang: ohne Zuweisung wie bisher erlaubt, mit entzogenem Recht verboten', async () => {
      const buchung = await vergangenesEvent(405, { jahrgang: null });
      expect((await request(app).get('/api/events/405').set(auth('admin1'))).body.darf_verbuchen).toBe(true);
      expect((await zaehler('admin1')).pendingEvents).toBe(1);

      await zuweisen('admin1', J1, { verbuchen: false });
      expect((await request(app).get('/api/events/405').set(auth('admin1'))).body.darf_verbuchen).toBe(false);
      expect((await zaehler('admin1')).pendingEvents).toBe(0);
      const res = await request(app).put(`/api/events/405/participants/${buchung}/attendance`).set(auth('admin1'))
        .send({ attendance_status: 'present' });
      expect(res.status).toBe(403);
    });
  });

  // ==================================================================
  // Challenge-Beitraege freigeben
  // ==================================================================
  describe('Challenge-Beitraege freigeben', () => {
    it('erlaubt: Admin mit Recht sieht, zaehlt und gibt frei', async () => {
      await zuweisen('admin1', J1);
      const { challengeId, submissionId } = await challengeMitBeitrag();

      const detail = await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('admin1'));
      expect(detail.status).toBe(200);
      expect(detail.body.darf_freigeben).toBe(true);
      expect((await zaehler('admin1')).pendingChallenges).toBe(1);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.konfi1.id }))
        .toEqual([USERS.teamer1.id, USERS.admin1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id].sort((a, b) => a - b));

      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('admin1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('verboten: ohne Recht bleibt die Challenge lesbar, ohne Zahl, ohne Push und mit 403', async () => {
      await zuweisen('admin1', J1, { challenges: false });
      const { challengeId, submissionId } = await challengeMitBeitrag();

      const detail = await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('admin1'));
      expect(detail.status).toBe(200);
      expect(detail.body.darf_freigeben).toBe(false);
      const beitraege = await request(app).get(`/api/challenges/admin/${challengeId}/submissions`).set(auth('admin1'));
      expect(beitraege.status).toBe(200);
      expect((await zaehler('admin1')).pendingChallenges).toBe(0);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.konfi1.id }))
        .toEqual([USERS.teamer1.id, USERS.orgAdmin1.id, USERS.orgAdminSuper.id].sort((a, b) => a - b));

      for (const action of ['approve', 'hide', 'anonymize']) {
        const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('admin1'))
          .send({ action });
        expect(res.status).toBe(403);
      }
      const { rows: [s] } = await db.query('SELECT moderation_status FROM challenge_submissions WHERE id = $1', [submissionId]);
      expect(s.moderation_status).toBe('pending');
    });

    it('unmoderierte Challenge: den Hinweis auf den neuen Beitrag bekommt, wer sieht', async () => {
      await zuweisen('admin1', J1, { challenges: false });
      const { challengeId } = await challengeMitBeitrag({ moderated: false });
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: false, ausser: USERS.konfi1.id }))
        .toContain(USERS.admin1.id);
    });

    it('der Push "Neuer Challenge-Beitrag" folgt derselben Liste', async () => {
      await zuweisen('admin1', J1, { challenges: false });
      const { challengeId } = await challengeMitBeitrag();
      const PushService = require('../../services/pushService');
      await PushService.sendChallengeSubmissionToLeadership(db, ORG1, challengeId, 'Runde', 'Konfi', true, USERS.konfi1.id);
      expect(pushTokens('challenge_submission')).toEqual(['token-orgAdmin1', 'token-teamer1']);
    });

    it('"Nur das Team": verboten, wenn das Recht in keinem Jahrgang besteht', async () => {
      await zuweisen('admin1', J1, { challenges: false });
      const { challengeId, submissionId } = await challengeMitBeitrag({ audience: 'nur_team', jahrgang: null, einreicher: USERS.teamer1.id });
      expect((await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('admin1'))).body.darf_freigeben).toBe(false);
      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('admin1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(403);
    });

    it('"Nur das Team": erlaubt ohne Zuweisung (wie bisher)', async () => {
      const { challengeId, submissionId } = await challengeMitBeitrag({ audience: 'nur_team', jahrgang: null, einreicher: USERS.teamer1.id });
      expect((await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('admin1'))).body.darf_freigeben).toBe(true);
      expect((await zaehler('admin1')).pendingChallenges).toBe(1);
      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('admin1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });
  });

  // ==================================================================
  // Teamer:innen (Simon, 09.10.2026: "dasselbe Rechtemanagement je
  // Jahrgang ... bezogen auf Challenges"). Gemessen vorher: Von den drei
  // Handlungen konnten Teamer:innen nur Challenge-Beitraege moderieren
  // (requireTeamer); Antraege entscheiden und Verbuchen sind requireAdmin.
  // Seed: teamer1 an J1 mit can_view = true, can_edit = false.
  // ==================================================================
  describe('Teamer:innen: Challenge-Beitraege freigeben', () => {
    const teamerRecht = async (jahrgangId, wert) => {
      await db.query(
        'UPDATE user_jahrgang_assignments SET darf_challenges_freigeben = $3 WHERE user_id = $1 AND jahrgang_id = $2',
        [USERS.teamer1.id, jahrgangId, wert]
      );
      invalidateUserCache(USERS.teamer1.id);
    };

    it('erlaubt: mit Recht (Vorgabe) sieht, zaehlt, bekommt und moderiert sie -- can_edit braucht es nicht', async () => {
      const { rows: [z] } = await db.query(
        'SELECT can_view, can_edit, darf_challenges_freigeben FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      expect(z).toEqual({ can_view: true, can_edit: false, darf_challenges_freigeben: true });
      const { challengeId, submissionId } = await challengeMitBeitrag();

      expect((await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('teamer1'))).body.darf_freigeben).toBe(true);
      const z1 = await zaehler('teamer1');
      expect([z1.pendingChallenges, z1.challengeApprovals.total]).toEqual([1, 1]);
      expect(await appSymbol('teamer1')).toBe(1);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.konfi1.id }))
        .toContain(USERS.teamer1.id);

      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('teamer1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('verboten: ohne Recht bleibt die Challenge lesbar, ohne Zahl, ohne Push und mit 403', async () => {
      await teamerRecht(J1, false);
      const { challengeId, submissionId } = await challengeMitBeitrag();

      const detail = await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('teamer1'));
      expect(detail.status).toBe(200);
      expect(detail.body.darf_freigeben).toBe(false);
      expect((await request(app).get(`/api/challenges/admin/${challengeId}/submissions`).set(auth('teamer1'))).status).toBe(200);
      const z = await zaehler('teamer1');
      expect([z.pendingChallenges, z.challengeApprovals.total]).toEqual([0, 0]);
      expect(await appSymbol('teamer1')).toBe(0);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.konfi1.id }))
        .toEqual([USERS.orgAdmin1.id, USERS.orgAdminSuper.id].sort((a, b) => a - b));

      const PushService = require('../../services/pushService');
      await PushService.sendChallengeSubmissionToLeadership(db, ORG1, challengeId, 'Runde', 'Konfi', true, USERS.konfi1.id);
      expect(pushTokens('challenge_submission')).toEqual(['token-orgAdmin1']);

      for (const action of ['approve', 'hide', 'unhide', 'anonymize']) {
        const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('teamer1'))
          .send({ action });
        expect(res.status).toBe(403);
      }
      const { rows: [s] } = await db.query('SELECT moderation_status FROM challenge_submissions WHERE id = $1', [submissionId]);
      expect(s.moderation_status).toBe('pending');
    });

    it('unmoderierte Challenge: den Hinweis auf den neuen Beitrag bekommt sie weiter, weil sie sieht', async () => {
      await teamerRecht(J1, false);
      const { challengeId } = await challengeMitBeitrag({ moderated: false });
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: false, ausser: USERS.konfi1.id }))
        .toContain(USERS.teamer1.id);
    });

    it('ohne Sicht kein Recht: eine Zuweisung ohne can_view gibt das Recht nicht', async () => {
      await db.query('UPDATE user_jahrgang_assignments SET can_view = false WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);
      const { challengeId, submissionId } = await challengeMitBeitrag();
      expect((await zaehler('teamer1')).pendingChallenges).toBe(0);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.konfi1.id }))
        .not.toContain(USERS.teamer1.id);
      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('teamer1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(403);
    });

    it('"Nur das Team": verboten, wenn das Recht in keinem ihrer Jahrgaenge besteht', async () => {
      await teamerRecht(J1, false);
      const { challengeId, submissionId } = await challengeMitBeitrag({ audience: 'nur_team', jahrgang: null, einreicher: USERS.admin1.id });
      expect((await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('teamer1'))).body.darf_freigeben).toBe(false);
      expect((await zaehler('teamer1')).pendingChallenges).toBe(0);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.admin1.id }))
        .not.toContain(USERS.teamer1.id);
      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('teamer1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(403);
    });

    it('"Nur das Team": erlaubt mit Recht in mindestens einem Jahrgang', async () => {
      await teamerRecht(J1, false);
      await db.query(
        `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit, darf_challenges_freigeben)
         VALUES ($1, $2, true, false, true)`, [USERS.teamer1.id, J_ZWEI]);
      invalidateUserCache(USERS.teamer1.id);
      const { challengeId, submissionId } = await challengeMitBeitrag({ audience: 'nur_team', jahrgang: null, einreicher: USERS.admin1.id });
      expect((await zaehler('teamer1')).pendingChallenges).toBe(1);
      expect(await ladeLeitungZumChallengeBeitrag(db, challengeId, { moderiert: true, ausser: USERS.admin1.id }))
        .toContain(USERS.teamer1.id);
      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('teamer1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('"Nur das Team": erlaubt ohne jede Zuweisung (wie bisher)', async () => {
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);
      const { challengeId, submissionId } = await challengeMitBeitrag({ audience: 'nur_team', jahrgang: null, einreicher: USERS.admin1.id });
      expect((await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('teamer1'))).body.darf_freigeben).toBe(true);
      expect((await zaehler('teamer1')).pendingChallenges).toBe(1);
      const res = await request(app).put(`/api/challenges/admin/submissions/${submissionId}/moderate`).set(auth('teamer1'))
        .send({ action: 'approve' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('keine neue Befugnis: Antraege entscheiden und Verbuchen bleiben trotz gesetzter Rechte verboten', async () => {
      const { rows: [z] } = await db.query(
        'SELECT darf_antraege_entscheiden AS a, darf_events_verbuchen AS v FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      expect(z).toEqual({ a: true, v: true });
      const id = await antrag();
      const entscheiden = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('teamer1')).send({ status: 'approved' });
      expect(entscheiden.status).toBe(403);
      const buchung = await vergangenesEvent(420);
      const verbuchen = await request(app).put(`/api/events/420/participants/${buchung}/attendance`).set(auth('teamer1'))
        .send({ attendance_status: 'present' });
      expect(verbuchen.status).toBe(403);
      const { rows: [b] } = await db.query('SELECT attendance_status FROM event_bookings WHERE id = $1', [buchung]);
      expect(b.attendance_status).toBe(null);
      expect((await request(app).get('/api/events/420').set(auth('teamer1'))).body.darf_verbuchen).toBe(false);
    });
  });

  // ==================================================================
  // Rechte vergeben (POST /users/:id/jahrgaenge)
  // ==================================================================
  describe('Rechte vergeben', () => {
    const rechte = async (schluessel) => (await db.query(
      `SELECT jahrgang_id, darf_antraege_entscheiden AS a, darf_events_verbuchen AS v, darf_challenges_freigeben AS c
         FROM user_jahrgang_assignments WHERE user_id = $1 ORDER BY jahrgang_id`,
      [USERS[schluessel].id]
    )).rows.map((r) => [Number(r.jahrgang_id), r.a, r.v, r.c]);

    it('erlaubt: die Gemeindeleitung setzt die Rechte je Jahrgang; GET liefert sie', async () => {
      const res = await request(app).post(`/api/users/${USERS.admin1.id}/jahrgaenge`).set(auth('orgAdmin1')).send({
        jahrgang_assignments: [
          { jahrgang_id: J1, can_view: true, can_edit: true, darf_antraege_entscheiden: false, darf_events_verbuchen: true, darf_challenges_freigeben: false },
          { jahrgang_id: J_ZWEI, can_view: true, can_edit: true }
        ]
      });
      expect(res.status).toBe(200);
      expect(await rechte('admin1')).toEqual([[J1, false, true, false], [J_ZWEI, true, true, true]]);

      const get = await request(app).get(`/api/users/${USERS.admin1.id}/jahrgaenge`).set(auth('orgAdmin1'));
      expect(get.body.map((j) => [j.id, j.darf_antraege_entscheiden, j.darf_events_verbuchen, j.darf_challenges_freigeben]))
        .toEqual([[J1, false, true, false], [J_ZWEI, true, true, true]]);
    });

    it('verboten: ein Admin vergibt keine Rechte (auch nicht an Teamer:innen)', async () => {
      await zuweisen('admin1', J1);
      const res = await request(app).post(`/api/users/${USERS.teamer1.id}/jahrgaenge`).set(auth('admin1')).send({
        jahrgang_assignments: [{ jahrgang_id: J1, can_view: true, can_edit: true, darf_challenges_freigeben: false }]
      });
      expect(res.status).toBe(403);
      expect(await rechte('teamer1')).toEqual([[J1, true, true, true]]);
    });

    it('erlaubt: die Gemeindeleitung setzt das Recht einer Teamer:in; es wirkt sofort', async () => {
      const { challengeId } = await challengeMitBeitrag();
      expect((await zaehler('teamer1')).pendingChallenges).toBe(1);
      const res = await request(app).post(`/api/users/${USERS.teamer1.id}/jahrgaenge`).set(auth('orgAdmin1')).send({
        jahrgang_assignments: [{ jahrgang_id: J1, can_view: true, can_edit: false, darf_challenges_freigeben: false }]
      });
      expect(res.status).toBe(200);
      expect(await rechte('teamer1')).toEqual([[J1, true, true, false]]);
      expect((await zaehler('teamer1')).pendingChallenges).toBe(0);
      expect((await request(app).get(`/api/challenges/admin/${challengeId}`).set(auth('teamer1'))).body.darf_freigeben).toBe(false);
    });

    it('Store-App ohne die Felder: das Recht einer Teamer:in bleibt stehen', async () => {
      await db.query('UPDATE user_jahrgang_assignments SET darf_challenges_freigeben = false WHERE user_id = $1', [USERS.teamer1.id]);
      // Ein Admin ordnet die Teamer:in neu zu -- so, wie es jede App schickt.
      await zuweisen('admin1', J1);
      const res = await request(app).post(`/api/users/${USERS.teamer1.id}/jahrgaenge`).set(auth('admin1')).send({
        jahrgang_assignments: [{ jahrgang_id: J1, can_view: true, can_edit: true }]
      });
      expect(res.status).toBe(200);
      expect(await rechte('teamer1')).toEqual([[J1, true, true, false]]);
    });

    it('Store-App ohne die Felder: Speichern laesst gesetzte Rechte stehen', async () => {
      await zuweisen('admin1', J1, { antraege: false, verbuchen: false, challenges: true });
      // Genau die Form, die UserManagementModal in 2.2.x/2.3.x schickt.
      const res = await request(app).post(`/api/users/${USERS.admin1.id}/jahrgaenge`).set(auth('orgAdmin1')).send({
        jahrgang_assignments: [{ jahrgang_id: J1, can_view: true, can_edit: true }, { jahrgang_id: J_ZWEI, can_view: true, can_edit: true }]
      });
      expect(res.status).toBe(200);
      expect(await rechte('admin1')).toEqual([[J1, false, false, true], [J_ZWEI, true, true, true]]);
    });

    it('verboten: ein Recht, das kein Wahrheitswert ist, wird abgewiesen', async () => {
      const res = await request(app).post(`/api/users/${USERS.admin1.id}/jahrgaenge`).set(auth('orgAdmin1')).send({
        jahrgang_assignments: [{ jahrgang_id: J1, darf_antraege_entscheiden: 'nein' }]
      });
      expect(res.status).toBe(400);
      expect(await rechte('admin1')).toEqual([]);
    });

    it('das entzogene Recht wirkt sofort (Rechte-Cache geleert)', async () => {
      await zuweisen('admin1', J1);
      const id = await antrag();
      expect((await zaehler('admin1')).pendingRequests).toBe(1);
      const res = await request(app).post(`/api/users/${USERS.admin1.id}/jahrgaenge`).set(auth('orgAdmin1')).send({
        jahrgang_assignments: [{ jahrgang_id: J1, can_view: true, can_edit: true, darf_antraege_entscheiden: false }]
      });
      expect(res.status).toBe(200);
      expect((await zaehler('admin1')).pendingRequests).toBe(0);
      const put = await request(app).put(`/api/admin/activities/requests/${id}`).set(auth('admin1')).send({ status: 'approved' });
      expect(put.status).toBe(403);
    });
  });

  // ==================================================================
  // Keine persoenliche Abwahl: allein das Recht entscheidet
  // ==================================================================
  // Simon, 09.10.2026: „Du darfst nicht verwalten, dann brauchst du es nicht
  // sehen. Aber passiert bei Challenges was, dann guckst du es dir
  // gefaelligst an." Die Kennzahlen-Wahl ist wieder entfernt (Migration 205).
  describe('Allein das Recht: mit Recht Zahl und Push, ohne Recht nichts', () => {
    async function allesAnlegen() {
      const res = await request(app).post('/api/konfi/requests').set(auth('konfi1'))
        .send({ activity_id: ACTIVITIES.sonntagsgottesdienst.id, requested_date: '2026-06-01' });
      expect(res.status).toBe(201);
      await warteAufNachwehen(app);
      await vergangenesEvent(420);
      const { challengeId } = await challengeMitBeitrag();
      const PushService = require('../../services/pushService');
      await PushService.sendChallengeSubmissionToLeadership(db, ORG1, challengeId, 'Runde', 'Konfi', true, USERS.konfi1.id);
      return challengeId;
    }

    it('die Routen der Kennzahlen-Wahl gibt es nicht mehr', async () => {
      for (const schluessel of ['admin1', 'orgAdmin1', 'teamer1']) {
        expect((await request(app).get('/api/notifications/kennzahlen').set(auth(schluessel))).status).toBe(404);
        expect((await request(app).put('/api/notifications/kennzahlen').set(auth(schluessel)).send({ challenges: false })).status).toBe(404);
      }
    });

    it('die Tabelle der Kennzahlen-Wahl ist entfernt', async () => {
      const { rows: [r] } = await db.query("SELECT to_regclass('public.leitung_kennzahlen') AS t");
      expect(r.t).toBe(null);
    });

    it('erlaubt: Admin mit allen drei Rechten bekommt jede Zahl, die Summe am App-Symbol und jeden Push', async () => {
      await zuweisen('admin1', J1);
      await allesAnlegen();

      const z = await zaehler('admin1');
      expect([z.pendingRequests, z.pendingEvents, z.pendingChallenges, z.challengeApprovals.total]).toEqual([1, 1, 1, 1]);
      expect(await appSymbol('admin1')).toBe(3);
      expect(pushTokens('new_activity_request')).toEqual(['token-admin1', 'token-orgAdmin1']);
      expect(pushTokens('challenge_submission')).toEqual(['token-admin1', 'token-orgAdmin1', 'token-teamer1']);
      const erinnerung = await zaehleWartendeTermineJeLeitung(db, [ORG1]);
      expect(erinnerung.map((e) => e.user_id)).toContain(USERS.admin1.id);
    });

    it('verboten: Admin ohne die drei Rechte bekommt keine Zahl, nichts am App-Symbol, keinen Push', async () => {
      await zuweisen('admin1', J1, { antraege: false, verbuchen: false, challenges: false });
      await allesAnlegen();

      const z = await zaehler('admin1');
      expect([z.pendingRequests, z.pendingEvents, z.pendingChallenges, z.challengeApprovals.total]).toEqual([0, 0, 0, 0]);
      expect(await appSymbol('admin1')).toBe(0);
      expect(pushTokens('new_activity_request')).toEqual(['token-orgAdmin1']);
      expect(pushTokens('challenge_submission')).toEqual(['token-orgAdmin1', 'token-teamer1']);
      const erinnerung = await zaehleWartendeTermineJeLeitung(db, [ORG1]);
      expect(erinnerung.map((e) => e.user_id)).not.toContain(USERS.admin1.id);
    });

    it('erlaubt: Teamer:in mit Recht bekommt Zahl, App-Symbol und Push zum Challenge-Beitrag', async () => {
      await allesAnlegen();
      const z = await zaehler('teamer1');
      expect([z.pendingChallenges, z.challengeApprovals.total]).toEqual([1, 1]);
      expect(await appSymbol('teamer1')).toBe(1);
      expect(pushTokens('challenge_submission')).toContain('token-teamer1');
    });

    it('verboten: Teamer:in ohne Recht bekommt nichts davon', async () => {
      await db.query(
        'UPDATE user_jahrgang_assignments SET darf_challenges_freigeben = false WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);
      await allesAnlegen();
      const z = await zaehler('teamer1');
      expect([z.pendingChallenges, z.challengeApprovals.total]).toEqual([0, 0]);
      expect(await appSymbol('teamer1')).toBe(0);
      expect(pushTokens('challenge_submission')).not.toContain('token-teamer1');
    });
  });
});
