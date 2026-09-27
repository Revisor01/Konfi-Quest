// backend/tests/routes/postfachGehtMitKontoUndGemeinde.test.js
//
// Audit "Wer bekommt was" 27.09.2026, Befund BF-13, Frage F-07 (Simon: "ja"):
//
//   - Leitungs-Mitteilungen UEBER eine Person verschwinden mit ihrem Konto.
//     Vorher standen "Neue Registrierung", Abmeldungen samt Grund, Opt-out/-in
//     und Challenge-Beitraege mit ihrem Namen noch ein Jahr bei der Leitung
//     (Audit A13: 5 Reste nach DELETE /admin/konfis/2).
//   - Die Mitteilungen einer Gemeinde verschwinden mit dem Ende der
//     Mitgliedschaft dort -- auf allen drei Wegen (utils/mitgliedschaftEnde.js).
//     Vorher las die Person das Postfach der alten Gemeinde weiter, die
//     Eintraege zaehlten an Glocke und App-Symbol.
//   - Bei entzogener Jahrgangszuweisung bleiben sie als Verlauf.
//
// Geschrieben werden die Mitteilungen ueber die ECHTEN Wege (Registrierung,
// Opt-out/-in, Abmeldung, Challenge-Beitrag, Teamer-Zu-/Absage) -- nur so
// zeigt der Test, dass die Schreibstellen die Kennung der Person mitfuehren.
// Die Zaehler (badge-counts, badge-counts/je-organisation) werden nach dem
// Loeschen auf den konkreten Wert geprueft.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const {
  loescheMitteilungenUeberPerson,
  ARTEN_UEBER_PERSON
} = require('../../utils/postfachAufraeumen');

describe('Postfach: Mitteilungen gehen mit dem Konto und mit der Mitgliedschaft (BF-13)', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterAll(async () => { await closePool(); });

  const bearer = (wer) => `Bearer ${generateToken(wer)}`;

  // Einige Routen senden nach der Antwort, ohne nachAntwort (konfi.js
  // Opt-out/-in, Abmeldung). Kurz pollen, dann HART pruefen.
  async function warteBis(pruefen, maxMs = 3000) {
    const ende = Date.now() + maxMs;
    for (;;) {
      await warteAufNachwehen(app);
      if (await pruefen()) return;
      if (Date.now() > ende) return;
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // Wie viele Mitteilungen nennen diesen Namen -- bei wem?
  async function mitteilungenMit(name, userId = null) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS c FROM notifications
        WHERE (title LIKE '%' || $1 || '%' OR message LIKE '%' || $1 || '%')
          AND ($2::int IS NULL OR user_id = $2::int)`,
      [name, userId]
    );
    return rows[0].c;
  }

  const glocke = async (wer) => {
    const res = await request(app).get('/api/notifications/badge-counts').set('Authorization', bearer(wer));
    expect(res.status).toBe(200);
    return res.body.postfach.ungelesen;
  };
  const umschalter = async (wer) => {
    const res = await request(app).get('/api/notifications/badge-counts/je-organisation').set('Authorization', bearer(wer));
    expect(res.status).toBe(200);
    return res.body.jeOrganisation;
  };

  // Test Konfi 1 meldet sich vom Pflicht-Event ab -- die Mitteilung UEBER
  // eine andere Person, die nach jeder Loeschung stehen bleiben muss.
  async function optOutKonfi1() {
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [USERS.konfi1.id, EVENTS.pflichtEvent.id, ORGS.testGemeinde.id]
    );
    const res = await request(app)
      .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-out`)
      .set('Authorization', bearer('konfi1'))
      .send({ reason: 'Oma hat Geburtstag' });
    expect(res.status).toBe(200);
    await warteBis(async () => (await mitteilungenMit('Test Konfi 1', USERS.orgAdmin1.id)) === 1);
    expect(await mitteilungenMit('Test Konfi 1', USERS.orgAdmin1.id)).toBe(1);
  }

  // =====================================================================
  // KONTO GELOESCHT
  // =====================================================================
  describe('Konto geloescht: Leitungs-Mitteilungen ueber die Person gehen mit', () => {
    async function challengeFuerJahrgang1() {
      const { rows: [c] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
           allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
         VALUES ($1, 'Fotorallye', 'd', 'konfis', 'public', false, '["text"]'::jsonb, 'A', $2,
                 NOW() - interval '1 day', NOW() + interval '7 days', false)
         RETURNING id`,
        [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
      );
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [c.id, JAHRGAENGE.jahrgang1.id]);
      return c.id;
    }

    // Eine Konfi registriert sich und erzeugt alle Leitungs-Mitteilungen,
    // die es ueber eine Konfi gibt: Registrierung, Opt-out, Opt-in,
    // Abmeldung von einem freiwilligen Event, Challenge-Beitrag.
    async function emmaMitAllenMeldungen() {
      const challengeId = await challengeFuerJahrgang1();
      const code = await request(app)
        .post('/api/auth/invite-code')
        .set('Authorization', bearer('orgAdmin1'))
        .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id });
      expect(code.status).toBe(200);

      const reg = await request(app)
        .post('/api/auth/register-konfi')
        .send({ invite_code: code.body.invite_code, display_name: 'Emma Beispiel', username: 'emmab', password: 'TestPasswort123!' });
      expect(reg.status).toBe(200);
      const emma = { id: reg.body.user.id, token: `Bearer ${reg.body.token}` };

      // Die Registrierung hat sie ins Pflicht-Event eingetragen.
      const optOut = await request(app)
        .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-out`)
        .set('Authorization', emma.token)
        .send({ reason: 'Arzttermin in der Stadt' });
      expect(optOut.status).toBe(200);
      await warteBis(async () => (await mitteilungenMit('Emma Beispiel', USERS.orgAdmin1.id)) === 2);

      const optIn = await request(app)
        .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-in`)
        .set('Authorization', emma.token);
      expect(optIn.status).toBe(200);
      await warteBis(async () => (await mitteilungenMit('Emma Beispiel', USERS.orgAdmin1.id)) === 3);

      const anmelden = await request(app)
        .post(`/api/konfi/events/${EVENTS.gottesdienstEvent.id}/register`)
        .set('Authorization', emma.token);
      expect(anmelden.status).toBe(200);
      const abmelden = await request(app)
        .delete(`/api/konfi/events/${EVENTS.gottesdienstEvent.id}/register`)
        .set('Authorization', emma.token)
        .send({ reason: 'Fieber seit gestern' });
      expect(abmelden.status).toBe(200);
      await warteBis(async () => (await mitteilungenMit('Emma Beispiel', USERS.orgAdmin1.id)) === 4);

      const beitrag = await request(app)
        .post(`/api/challenges/konfi/${challengeId}/submissions`)
        .set('Authorization', emma.token)
        .send({ media_type: 'text', text_content: 'Mein Beitrag' });
      expect(beitrag.status).toBe(201);
      await warteBis(async () => (await mitteilungenMit('Emma Beispiel', USERS.orgAdmin1.id)) === 5);

      // orgAdmin1 sieht alles der Gemeinde: fuenf Mitteilungen ueber Emma.
      expect(await mitteilungenMit('Emma Beispiel', USERS.orgAdmin1.id)).toBe(5);
      const { rows: arten } = await db.query(
        `SELECT type FROM notifications WHERE user_id = $1 AND message LIKE '%Emma Beispiel%' ORDER BY type`,
        [USERS.orgAdmin1.id]
      );
      expect(arten.map((r) => r.type)).toEqual([
        'challenge_submission', 'event_opt_in', 'event_opt_out', 'event_unregistration', 'new_konfi_registration'
      ]);
      return emma;
    }

    it('VERBOTEN: nach DELETE /admin/konfis/:id nennt keine Mitteilung mehr ihren Namen -- bei niemandem', async () => {
      const emma = await emmaMitAllenMeldungen();
      await optOutKonfi1();
      expect(await glocke('orgAdmin1')).toBe(6);

      const res = await request(app)
        .delete(`/api/admin/konfis/${emma.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);

      expect(await mitteilungenMit('Emma Beispiel')).toBe(0);
    });

    it('ERLAUBT: die Mitteilung ueber eine andere Konfi bleibt -- Glocke 1, Umschalter 1', async () => {
      const emma = await emmaMitAllenMeldungen();
      await optOutKonfi1();
      const vorherKonfi1 = await mitteilungenMit('Test Konfi 1');

      const res = await request(app)
        .delete(`/api/admin/konfis/${emma.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);

      expect(await mitteilungenMit('Test Konfi 1')).toBe(vorherKonfi1);
      expect(await glocke('orgAdmin1')).toBe(1);
      // Umschalter und App-Symbol: sonst ist fuer orgAdmin1 nichts offen.
      expect(await umschalter('orgAdmin1')).toEqual({ [ORGS.testGemeinde.id]: { offen: 1 } });
    });

    it('Selbstloeschung (POST /auth/delete-account) geht denselben Weg', async () => {
      await optOutKonfi1();
      expect(await mitteilungenMit('Test Konfi 1', USERS.orgAdmin1.id)).toBe(1);

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', bearer('konfi1'))
        .send({ password: 'testpasswort123' });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);

      expect(await mitteilungenMit('Test Konfi 1')).toBe(0);
      expect(await glocke('orgAdmin1')).toBe(0);
    });

    // Der Weg fuer alle Rollen ueber die Benutzerverwaltung (users.js, Fall 3:
    // nur hier Mitglied). Teamer-Zu- und -Absagen tragen den Namen und --
    // bei der Absage -- den Grund.
    async function teamerZuUndAbsage() {
      const { rows: [termin] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, teamer_only, max_participants, point_type, points)
         VALUES ('Teamtreffen', NOW() + interval '5 days', $1, true, 0, 'gemeinde', 0) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const zu = await request(app)
        .post(`/api/teamer/events/${termin.id}/zusage`)
        .set('Authorization', bearer('teamer1'))
        .send({ dabei: true });
      expect(zu.status).toBe(200);
      const ab = await request(app)
        .post(`/api/teamer/events/${termin.id}/zusage`)
        .set('Authorization', bearer('teamer1'))
        .send({ dabei: false, reason: 'Klausur am selben Tag' });
      expect(ab.status).toBe(200);
      await warteBis(async () => (await mitteilungenMit('Test Teamer 1', USERS.orgAdmin1.id)) === 2);
      expect(await mitteilungenMit('Test Teamer 1', USERS.orgAdmin1.id)).toBe(2);
    }

    it('VERBOTEN: DELETE /admin/users/:id (Teamer:in) nimmt Zu- und Absage aus den Postfaechern der Leitung', async () => {
      await teamerZuUndAbsage();

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      expect(res.status).toBe(200);
      expect(res.body.konto_bleibt).toBe(false);
      await warteAufNachwehen(app);

      expect(await mitteilungenMit('Test Teamer 1')).toBe(0);
    });

    it('ERLAUBT: dabei bleibt die Mitteilung ueber die Konfi stehen -- Glocke 1', async () => {
      await teamerZuUndAbsage();
      await optOutKonfi1();
      expect(await glocke('orgAdmin1')).toBe(3);

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);

      expect(await mitteilungenMit('Test Konfi 1', USERS.orgAdmin1.id)).toBe(1);
      expect(await glocke('orgAdmin1')).toBe(1);
    });
  });

  // =====================================================================
  // MITGLIEDSCHAFT BEENDET
  // =====================================================================
  describe('Mitgliedschaft beendet: die Mitteilungen dieser Gemeinde gehen mit', () => {
    async function mitteilung(userId, orgId, type = 'event_unregistration', title = 'Event-Abmeldung') {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, $2, 'Text', $3, $4::jsonb, $5)`,
        [userId, title, type, JSON.stringify({ type, organization_id: String(orgId) }), orgId]
      );
    }
    async function gemeindenImPostfach(userId) {
      const { rows } = await db.query(
        'SELECT organization_id, COUNT(*)::int AS c FROM notifications WHERE user_id = $1 GROUP BY organization_id ORDER BY organization_id',
        [userId]
      );
      return rows.map((r) => [Number(r.organization_id), r.c]);
    }

    // admin1 (Stamm Org 1) arbeitet in Org 2 als Teamer:in mit.
    async function admin1AuchInOrg2() {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.admin1.id, ORGS.andereGemeinde.id, ROLES.teamer2.id]
      );
      await mitteilung(USERS.admin1.id, ORGS.testGemeinde.id);
      await mitteilung(USERS.admin1.id, ORGS.testGemeinde.id, 'teamer_event_booking', 'Teamer:in angemeldet');
      await mitteilung(USERS.admin1.id, ORGS.andereGemeinde.id, 'challenge_submission', 'Neuer Challenge-Beitrag');
      await mitteilung(USERS.admin1.id, ORGS.andereGemeinde.id, 'events_pending_approval', 'Events warten');
      expect(await gemeindenImPostfach(USERS.admin1.id)).toEqual([[1, 2], [2, 2]]);
      expect(await umschalter('admin1')).toEqual({ 1: { offen: 2 }, 2: { offen: 2 } });
    }

    it('Leitung beendet die Mitgliedschaft (DELETE /admin/users/:id, Fall 1): Org-2-Eintraege weg, Glocke 2, Umschalter 2', async () => {
      await admin1AuchInOrg2();

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.admin1.id}`)
        .set('Authorization', bearer('orgAdmin2'));
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Mitgliedschaft in dieser Gemeinde beendet');
      await warteAufNachwehen(app);
      invalidateUserCache(USERS.admin1.id);

      expect(await gemeindenImPostfach(USERS.admin1.id)).toEqual([[1, 2]]);
      expect(await glocke('admin1')).toBe(2);
      expect(await umschalter('admin1')).toEqual({ 1: { offen: 2 } });
    });

    it('Super-Admin entzieht die Mitgliedschaft (DELETE /organizations/:id/members/:userId): dasselbe', async () => {
      await admin1AuchInOrg2();

      const res = await request(app)
        .delete(`/api/organizations/${ORGS.andereGemeinde.id}/members/${USERS.admin1.id}`)
        .set('Authorization', bearer('superAdmin'));
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
      invalidateUserCache(USERS.admin1.id);

      expect(await gemeindenImPostfach(USERS.admin1.id)).toEqual([[1, 2]]);
      expect(await glocke('admin1')).toBe(2);
      expect(await umschalter('admin1')).toEqual({ 1: { offen: 2 } });
    });

    it('Umzug (DELETE /admin/users/:id, hier zuhause und anderswo Mitglied): die Eintraege der alten Gemeinde gehen, die der neuen bleiben', async () => {
      // teamer1 ist in Org 1 zuhause und arbeitet in Org 2 als Admin mit.
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.teamer1.id, ORGS.andereGemeinde.id, ROLES.admin2.id]
      );
      await mitteilung(USERS.teamer1.id, ORGS.testGemeinde.id, 'challenge_submission', 'Neuer Challenge-Beitrag');
      await mitteilung(USERS.teamer1.id, ORGS.testGemeinde.id, 'teamer_event_booking', 'Teamer:in angemeldet');
      await mitteilung(USERS.teamer1.id, ORGS.andereGemeinde.id);
      // Die Mitteilungen der anderen Personen bleiben ohnehin.
      await mitteilung(USERS.admin1.id, ORGS.testGemeinde.id);

      const res = await request(app)
        .delete(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      expect(res.status).toBe(200);
      expect(res.body.konto_bleibt).toBe(true);
      await warteAufNachwehen(app);
      invalidateUserCache(USERS.teamer1.id);

      expect(await gemeindenImPostfach(USERS.teamer1.id)).toEqual([[2, 1]]);
      expect(await gemeindenImPostfach(USERS.admin1.id)).toEqual([[1, 1]]);
      const { rows: [{ c }] } = await db.query(
        'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL', [USERS.teamer1.id]
      );
      expect(c).toBe(1);
    });

    it('ERLAUBT: entzogene Jahrgangszuweisung laesst das Postfach als Verlauf stehen', async () => {
      await mitteilung(USERS.teamer1.id, ORGS.testGemeinde.id, 'challenge_submission', 'Neuer Challenge-Beitrag');
      await mitteilung(USERS.teamer1.id, ORGS.testGemeinde.id, 'teamer_event_booking', 'Teamer:in angemeldet');

      const res = await request(app)
        .post(`/api/admin/users/${USERS.teamer1.id}/jahrgaenge`)
        .set('Authorization', bearer('orgAdmin1'))
        .send({ jahrgang_assignments: [] });
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);

      const { rows: zuweisungen } = await db.query(
        'SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]
      );
      expect(zuweisungen).toEqual([]);
      expect(await gemeindenImPostfach(USERS.teamer1.id)).toEqual([[1, 2]]);
    });
  });

  // =====================================================================
  // DIE REGEL-STELLE
  // =====================================================================
  describe('loescheMitteilungenUeberPerson', () => {
    async function mitteilung(userId, type, data) {
      const { rows: [{ id }] } = await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, 'T', 'M', $2, $3::jsonb, $4) RETURNING id`,
        [userId, type, JSON.stringify(data), ORGS.testGemeinde.id]
      );
      return id;
    }

    it('nimmt jede Art ueber die Person, ob die Kennung unter konfi_id oder user_id liegt -- sonst nichts', async () => {
      const P = USERS.konfi2.id;
      const gehen = [];
      for (const art of ARTEN_UEBER_PERSON) {
        gehen.push(await mitteilung(USERS.orgAdmin1.id, art, { konfi_id: String(P) }));
        gehen.push(await mitteilung(USERS.orgAdmin1.id, art, { user_id: P }));
      }
      const bleiben = [
        // Andere Person
        await mitteilung(USERS.orgAdmin1.id, 'event_opt_out', { konfi_id: String(USERS.konfi1.id) }),
        // Bestandsdaten OHNE Kennung: nichts raten, auch wenn der Name passt.
        await mitteilung(USERS.orgAdmin1.id, 'event_opt_out', { konfi_name: 'Test Konfi 2', event_id: '2' }),
        // Art, die nicht ueber eine Person berichtet (Verlauf der Empfaengerin)
        await mitteilung(USERS.admin1.id, 'events_pending_approval', { user_id: String(P) })
      ];

      const geloescht = await loescheMitteilungenUeberPerson(db, P);

      expect(geloescht).toBe(gehen.length);
      const { rows } = await db.query('SELECT id FROM notifications ORDER BY id');
      expect(rows.map((r) => r.id)).toEqual(bleiben);
    });

    it('ohne Kennung passiert nichts', async () => {
      await mitteilung(USERS.orgAdmin1.id, 'event_opt_out', { konfi_id: '2' });
      expect(await loescheMitteilungenUeberPerson(db, null)).toBe(0);
      expect(await loescheMitteilungenUeberPerson(db, '')).toBe(0);
      const { rows: [{ c }] } = await db.query('SELECT COUNT(*)::int AS c FROM notifications');
      expect(c).toBe(1);
    });
  });
});
