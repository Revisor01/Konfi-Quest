// backend/tests/routes/kontoLoeschenWege.test.js
//
// KONTO LOESCHEN LOESCHT WIRKLICH ALLES -- auf jedem Weg (Simon, 28.09.2026:
// "konto löschen muss wirklich alles löschen.").
//
// Vier Wege loeschen ein Konto, jeder hatte bis hierher seinen eigenen Code
// (utils/konfiDeletion.js fuer die ersten drei, ein eigener Block in
// routes/users.js fuer den vierten). Jeder Test hier legt eine Person an, die
// in JEDER Tabelle mit Personenbezug vorkommt (helpers/vollePerson.js), laesst
// den Weg laufen und prueft denselben Befund: Keine Zeile zeigt mehr auf
// sie, die Dinge der Gemeinde stehen noch (Verweis NULL), Zweiergespraech,
// Anmeldesperre, Mitteilungen ueber sie und ihre Dateien sind weg.
//
// Gegenprobe vor der Umstellung auf utils/kontoLoeschen.js: alle vier Tests
// rot -- der Einladungscode der Gemeinde verschwand, das Zweiergespraech mit
// ihrem Namen blieb samt Datei der Leitung, der Zaehler der Anmeldesperre
// blieb stehen.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, PASSWORD } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');
const {
  legeVollePersonAn, unbelegteSpalten, befundNachLoeschung, erwarteterBefund, dateienAufraeumen,
} = require('../helpers/vollePerson');

describe('Konto löschen nimmt auf jedem Weg alles mit', () => {
  let app;
  let db;
  let voll = null;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterEach(() => { dateienAufraeumen(voll); voll = null; });
  afterAll(async () => { await closePool(); });

  const bearer = (wer) => `Bearer ${generateToken(wer)}`;

  it('DELETE /admin/konfis/:id', async () => {
    voll = await legeVollePersonAn(db, USERS.konfi1.id);
    expect(await unbelegteSpalten(db, USERS.konfi1.id)).toEqual([]);

    const res = await request(app)
      .delete(`/api/admin/konfis/${USERS.konfi1.id}`)
      .set('Authorization', bearer('orgAdmin1'));
    await warteAufNachwehen(app);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Konfi erfolgreich gelöscht' });
    expect(await befundNachLoeschung(db, voll)).toEqual(erwarteterBefund(voll));
  });

  it('POST /auth/delete-account (Teamer:in löscht sich selbst)', async () => {
    voll = await legeVollePersonAn(db, USERS.teamer1.id);
    expect(await unbelegteSpalten(db, USERS.teamer1.id)).toEqual([]);

    const res = await request(app)
      .post('/api/auth/delete-account')
      .set('Authorization', bearer('teamer1'))
      .send({ password: PASSWORD });
    await warteAufNachwehen(app);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Account erfolgreich gelöscht' });
    expect(await befundNachLoeschung(db, voll)).toEqual(erwarteterBefund(voll));
  });

  it('DELETE /users/:id (nur in dieser Gemeinde Mitglied)', async () => {
    // Ohne weitere Gemeinde: mit ihr zoege das Konto um statt zu gehen.
    voll = await legeVollePersonAn(db, USERS.teamer1.id, { weitereGemeinde: false });
    expect(await unbelegteSpalten(db, USERS.teamer1.id, { ausser: ['user_organizations.user_id'] })).toEqual([]);

    const res = await request(app)
      .delete(`/api/users/${USERS.teamer1.id}`)
      .set('Authorization', bearer('orgAdmin1'));
    await warteAufNachwehen(app);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Benutzer erfolgreich gelöscht', konto_bleibt: false });
    expect(await befundNachLoeschung(db, voll)).toEqual(erwarteterBefund(voll));
  });

  it('DELETE /users/:id lässt auf den frei werdenden Team-Platz nachrücken', async () => {
    // Bis zum 28.09.2026 blieb der Platz hier leer -- die drei anderen Wege
    // liessen seit dem 15.09.2026 nachruecken, dieser nicht.
    const { rows: [wartet] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ('wartet_team', 'Wartende Teamerin', 'x', $1, $2) RETURNING id`,
      [ROLES.teamer.id, ORGS.testGemeinde.id]);
    await db.query(
      `UPDATE events SET teamer_max_participants = 1, teamer_waitlist_enabled = true, teamer_needed = true
        WHERE id = 1`);
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, created_at)
       VALUES ($1, 1, 'confirmed', $3, NOW() - interval '1 hour', NOW() - interval '1 hour'),
              ($2, 1, 'waitlist', $3, NOW(), NOW())`,
      [USERS.teamer1.id, wartet.id, ORGS.testGemeinde.id]);
    const push = vi.spyOn(PushService, 'sendWaitlistPromotionToTeamer').mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/users/${USERS.teamer1.id}`)
      .set('Authorization', bearer('orgAdmin1'));
    await warteAufNachwehen(app);

    expect(res.status).toBe(200);
    const { rows: [b] } = await db.query(
      'SELECT status, war_auf_warteliste FROM event_bookings WHERE user_id = $1 AND event_id = 1', [wartet.id]);
    expect(b).toEqual({ status: 'confirmed', war_auf_warteliste: true });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][1]).toBe(Number(wartet.id));
    vi.restoreAllMocks();
  });

  // DIE MELDUNG NACH DER LOESCHUNG LAEUFT UEBER nachAntwort (29.09.2026,
  // Paket I2). Der Test oben war wacklig (1 von 4 Laeufen rot): Die drei
  // Routen warteten nach res.json direkt auf meldeNachKontoLoeschung, nicht
  // ueber nachAntwort -- warteAufNachwehen wusste davon nichts, und die
  // Pruefung kam je nach Last vor oder nach dem Push. Hier sichtbar gemacht
  // mit einem Push, der sich 200 ms Zeit laesst: Nach warteAufNachwehen muss
  // er durch sein.
  describe('Meldung an Nachrückende ist durch, wenn die Nachläufe der Antwort durch sind', () => {
    const langsamerPush = (methode) => {
      const stand = { fertig: 0 };
      vi.spyOn(PushService, methode).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 200));
        stand.fertig += 1;
      });
      return stand;
    };
    afterEach(() => { vi.restoreAllMocks(); });

    // Ein Platz im Team fuer teamer1, dahinter eine Wartende.
    const teamWarteliste = async () => {
      const { rows: [wartet] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
         VALUES ('wartet_team2', 'Wartende Teamerin', 'x', $1, $2) RETURNING id`,
        [ROLES.teamer.id, ORGS.testGemeinde.id]);
      await db.query(
        `UPDATE events SET teamer_max_participants = 1, teamer_waitlist_enabled = true, teamer_needed = true
          WHERE id = 1`);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, created_at)
         VALUES ($1, 1, 'confirmed', $3, NOW() - interval '1 hour', NOW() - interval '1 hour'),
                ($2, 1, 'waitlist', $3, NOW(), NOW())`,
        [USERS.teamer1.id, wartet.id, ORGS.testGemeinde.id]);
    };

    it('DELETE /users/:id', async () => {
      await teamWarteliste();
      const push = langsamerPush('sendWaitlistPromotionToTeamer');

      const res = await request(app)
        .delete(`/api/users/${USERS.teamer1.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      await warteAufNachwehen(app);

      expect(res.status).toBe(200);
      expect(push.fertig).toBe(1);
    });

    it('POST /auth/delete-account', async () => {
      await teamWarteliste();
      const push = langsamerPush('sendWaitlistPromotionToTeamer');

      const res = await request(app)
        .post('/api/auth/delete-account')
        .set('Authorization', bearer('teamer1'))
        .send({ password: PASSWORD });
      await warteAufNachwehen(app);

      expect(res.status).toBe(200);
      expect(push.fertig).toBe(1);
    });

    it('DELETE /admin/konfis/:id', async () => {
      // Ein Konfi-Platz fuer konfi1, konfi2 wartet.
      await db.query(
        `UPDATE events SET max_participants = 1, waitlist_enabled = true, cancelled = false,
                           event_date = NOW() + interval '7 days'
          WHERE id = 1`);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, created_at)
         VALUES ($1, 1, 'confirmed', $3, NOW() - interval '1 hour', NOW() - interval '1 hour'),
                ($2, 1, 'waitlist', $3, NOW(), NOW())`,
        [USERS.konfi1.id, USERS.konfi2.id, ORGS.testGemeinde.id]);
      const push = langsamerPush('sendWaitlistPromotionToKonfi');

      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      await warteAufNachwehen(app);

      expect(res.status).toBe(200);
      const { rows: [b] } = await db.query(
        'SELECT status FROM event_bookings WHERE user_id = $1 AND event_id = 1', [USERS.konfi2.id]);
      expect(b.status).toBe('confirmed');
      expect(push.fertig).toBe(1);
    });
  });

  it('automatische Löschung 120 Tage nach der Konfirmation', async () => {
    // Eigener Jahrgang mit Konfirmation vor 130 Tagen -- der des Seeds hat
    // keine und bleibt unberuehrt (konfi2 ist Gegenueber in der Fixture).
    const { rows: [jg] } = await db.query(
      `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
       VALUES ('2024/2025', $1, CURRENT_DATE - 130) RETURNING id`, [ORGS.testGemeinde.id]);
    const { rows: [konfirmation] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, is_konfirmation, cancelled)
       VALUES ('Konfirmation', NOW() - interval '130 days', $1, true, false) RETURNING id`, [ORGS.testGemeinde.id]);
    await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [konfirmation.id, jg.id]);
    const { rows: [konfi] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ('ehemalig', 'Ehemalige Konfi', 'x', $1, $2) RETURNING id`, [ROLES.konfi.id, ORGS.testGemeinde.id]);
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, $3)`, [konfi.id, jg.id, ORGS.testGemeinde.id]);
    // Ohne Mitgliedschaft in einer weiteren Gemeinde: Eine Konfi ist nie
    // zugleich woanders im Team (Simon, 28.09.2026: "Konfi und Team geht
    // nicht parallel"), und ein Altbestands-Mischkonto ueberspringt die
    // automatische Loeschung bewusst (autoLoeschungWoandersImTeam.test.js).
    voll = await legeVollePersonAn(db, konfi.id, { weitereGemeinde: false });
    expect(await unbelegteSpalten(db, konfi.id, { ausser: ['user_organizations.user_id'] })).toEqual([]);

    const ergebnis = await BackgroundService.runAutoDeletion(db);

    expect(ergebnis).toEqual({ soft: 0, hard: 1 });
    expect(await befundNachLoeschung(db, voll)).toEqual(erwarteterBefund(voll));
  });
});
