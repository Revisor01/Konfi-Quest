// backend/tests/routes/konfiTeamerKopienCharakterisierung.test.js
//
// Charakterisierung der Routen, die in routes/konfi.js und routes/teamer.js
// je einmal standen (offene Befunde, „Doppelter Code Konfi/Team", 09.10.2026):
// Konfispruch setzen und lesen, Spruchliste, Bibeluebersetzung der
// Tageslosung, eigenen Antrag stellen und loeschen, Abzeichen als gesehen
// markieren.
//
// Die Tests halten die Antworten fest, wie sie VOR dem Zusammenlegen waren --
// Statuscode und Rumpf byte-gleich (toEqual auf den ganzen Rumpf), weil die
// Store-Apps sie lesen. Bewusste Unterschiede zwischen Konfi und Team stehen
// ausdruecklich drin: Das Team legt die Profilzeile an (Upsert), die Konfi
// nicht; die Erfolgs- und Fehlertexte der Antragsrouten unterscheiden sich.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfi/Team: zusammengelegte Kopien behalten ihre Antworten', () => {
  let app;
  let db;
  let josua;
  let teamerAktivitaet;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    ({ rows: [{ id: josua }] } = await db.query(
      `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
       VALUES ('Josua 1,9', 'Josua', 1, 9, NULL, 1) RETURNING id`));
    await db.query(
      `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
       VALUES ($1, 'luther2017', 'Sei getrost und unverzagt.'), ($1, 'bigs', 'Sei stark und mutig.')`,
      [josua]
    );
    ({ rows: [{ id: teamerAktivitaet }] } = await db.query(
      `INSERT INTO activities (name, points, type, organization_id, target_role)
       VALUES ('Gruppenleitung', 2, 'gemeinde', $1, 'teamer') RETURNING id`,
      [ORGS.testGemeinde.id]
    ));
  });

  afterAll(async () => {
    await closePool();
  });

  const auth = (wer) => `Bearer ${generateToken(wer)}`;
  const WEGE = [
    { rolle: 'konfi', wer: 'konfi1', userId: () => USERS.konfi1.id },
    { rolle: 'teamer', wer: 'teamer1', userId: () => USERS.teamer1.id },
  ];

  // ================================================================
  // PATCH /:rolle/profile — Konfispruch setzen
  // ================================================================
  describe.each(WEGE)('PATCH /api/$rolle/profile', ({ rolle, wer, userId }) => {
    const setzen = (body) => request(app)
      .patch(`/api/${rolle}/profile`).set('Authorization', auth(wer)).send(body);

    beforeEach(async () => {
      // Gleiche Ausgangslage auf beiden Wegen: eine Profilzeile.
      await db.query(
        `INSERT INTO konfi_profiles (user_id, organization_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId(), ORGS.testGemeinde.id]
      );
    });

    it('Listen-Wahl: 200 mit {success, konfspruch}', async () => {
      const res = await setzen({ konfspruch_id: String(josua), translation: 'bigs' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        konfspruch: { source: 'liste', id: Number(josua), translation: 'bigs' }
      });
      const { rows: [kp] } = await db.query(
        'SELECT konfspruch_id::int AS id, konfspruch_translation, konfspruch_freitext FROM konfi_profiles WHERE user_id = $1',
        [userId()]
      );
      expect(kp).toEqual({ id: Number(josua), konfspruch_translation: 'bigs', konfspruch_freitext: null });
    });

    it('ungueltige Spruch-ID: 400', async () => {
      const res = await setzen({ konfspruch_id: 'abc', translation: 'bigs' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Ungültige Spruch-ID' });
    });

    it('ungueltige Uebersetzung: 400 mit der Liste', async () => {
      const res = await setzen({ konfspruch_id: josua, translation: 'LUT' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Ungültige Bibelübersetzung',
        valid_translations: ['luther2017', 'bigs', 'gute_nachricht', 'elberfelder']
      });
    });

    it('unbekannter Spruch: 404', async () => {
      const res = await setzen({ konfspruch_id: 999999, translation: 'bigs' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Konfispruch nicht gefunden' });
    });

    it('eigener Spruch: 200, getrimmt', async () => {
      const res = await setzen({ konfspruch_freitext: '  Mein Spruch ', konfspruch_freitext_referenz: ' Ps 1 ' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        konfspruch: { source: 'freitext', text: 'Mein Spruch', reference: 'Ps 1' }
      });
    });

    it.each([
      [{ konfspruch_freitext: '   ', konfspruch_freitext_referenz: 'Ps 1' }, 'Der Spruchtext darf nicht leer sein'],
      [{ konfspruch_freitext: 'Text' }, 'Bei einem eigenen Spruch ist die Stellenangabe (Referenz) verpflichtend'],
      [{ konfspruch_freitext: 'Text', konfspruch_freitext_referenz: 'x'.repeat(101) }, 'Die Stellenangabe darf höchstens 100 Zeichen lang sein'],
      [{ konfspruch_freitext: 'x'.repeat(1001), konfspruch_freitext_referenz: 'Ps 1' }, 'Der Spruchtext ist zu lang'],
      [{}, 'Bitte entweder einen Spruch aus der Liste (konfspruch_id + translation) oder einen eigenen Spruch (konfspruch_freitext + konfspruch_freitext_referenz) angeben'],
    ])('Pruefliste: %j -> 400', async (body, fehler) => {
      const res = await setzen(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: fehler });
    });
  });

  describe('PATCH /profile: bewusste Unterschiede zwischen Konfi und Team', () => {
    it('Konfi ohne Profilzeile: 200, aber keine Zeile angelegt', async () => {
      await db.query('DELETE FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      const res = await request(app).patch('/api/konfi/profile')
        .set('Authorization', auth('konfi1')).send({ konfspruch_id: josua, translation: 'bigs' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, konfspruch: { source: 'liste', id: Number(josua), translation: 'bigs' } });
      const { rows } = await db.query('SELECT 1 FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(rows).toHaveLength(0);
    });

    it('Team ohne Profilzeile: die Zeile wird angelegt', async () => {
      await db.query('DELETE FROM konfi_profiles WHERE user_id = $1', [USERS.teamer1.id]);
      const res = await request(app).patch('/api/teamer/profile')
        .set('Authorization', auth('teamer1')).send({ konfspruch_freitext: 'Mein Spruch', konfspruch_freitext_referenz: 'Ps 1' });
      expect(res.status).toBe(200);
      const { rows: [kp] } = await db.query(
        'SELECT konfspruch_freitext, organization_id::int AS org FROM konfi_profiles WHERE user_id = $1',
        [USERS.teamer1.id]
      );
      expect(kp).toEqual({ konfspruch_freitext: 'Mein Spruch', org: ORGS.testGemeinde.id });
    });

    it('fremde Rolle: 403 mit dem Text des jeweiligen Wegs', async () => {
      const k = await request(app).patch('/api/konfi/profile')
        .set('Authorization', auth('teamer1')).send({ konfspruch_id: josua, translation: 'bigs' });
      expect(k.status).toBe(403);
      expect(k.body).toEqual({ error: 'Konfi-Zugriff erforderlich' });
      const t = await request(app).patch('/api/teamer/profile')
        .set('Authorization', auth('admin1')).send({ konfspruch_id: josua, translation: 'bigs' });
      expect(t.status).toBe(403);
      expect(t.body).toEqual({ error: 'Nur das Team kann seinen Konfispruch setzen' });
    });
  });

  // ================================================================
  // Spruch lesen und Spruchliste
  // ================================================================
  describe('Konfispruch lesen', () => {
    it('beide Wege liefern dieselbe Form fuer den gewaehlten Spruch', async () => {
      for (const { rolle, wer } of WEGE) {
        await db.query(
          `INSERT INTO konfi_profiles (user_id, organization_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
          [USERS[wer].id, ORGS.testGemeinde.id]
        );
        const r = await request(app).patch(`/api/${rolle}/profile`)
          .set('Authorization', auth(wer)).send({ konfspruch_id: josua, translation: 'bigs' });
        expect(r.status).toBe(200);
      }
      const erwartet = { source: 'liste', id: Number(josua), reference: 'Josua 1,9', text: 'Sei stark und mutig.', translation: 'bigs' };
      const konfi = await request(app).get('/api/konfi/profile').set('Authorization', auth('konfi1'));
      expect(konfi.status).toBe(200);
      expect(konfi.body.konfspruch).toEqual(erwartet);
      const team = await request(app).get('/api/teamer/dashboard').set('Authorization', auth('teamer1'));
      expect(team.status).toBe(200);
      expect(team.body.konfspruch).toEqual(erwartet);
    });

    it('eigener Spruch im Team-Dashboard: {source, text, reference}', async () => {
      await db.query(
        `INSERT INTO konfi_profiles (user_id, organization_id, konfspruch_freitext, konfspruch_freitext_referenz)
         VALUES ($1, $2, 'Mein Spruch', 'Ps 1') ON CONFLICT (user_id) DO UPDATE
         SET konfspruch_freitext = 'Mein Spruch', konfspruch_freitext_referenz = 'Ps 1', konfspruch_id = NULL`,
        [USERS.teamer1.id, ORGS.testGemeinde.id]
      );
      const team = await request(app).get('/api/teamer/dashboard').set('Authorization', auth('teamer1'));
      expect(team.body.konfspruch).toEqual({ source: 'freitext', text: 'Mein Spruch', reference: 'Ps 1' });
    });

    it('GET /konfsprueche: beide Wege liefern dieselbe Liste', async () => {
      const erwartet = [{
        id: Number(josua), reference: 'Josua 1,9', book: 'Josua', chapter: 1, verse: 9,
        uebersetzungen: { luther2017: 'Sei getrost und unverzagt.', bigs: 'Sei stark und mutig.', gute_nachricht: '', elberfelder: '' }
      }];
      for (const { rolle, wer } of WEGE) {
        const res = await request(app).get(`/api/${rolle}/konfsprueche`).set('Authorization', auth(wer));
        expect(res.status).toBe(200);
        expect(res.body.map((s) => ({ ...s, id: Number(s.id) }))).toEqual(erwartet);
      }
    });

    it('GET /teamer/konfsprueche: fremde Rolle 403', async () => {
      const res = await request(app).get('/api/teamer/konfsprueche').set('Authorization', auth('admin1'));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Nur das Team kann die Spruchliste abrufen' });
    });
  });

  // ================================================================
  // PUT /:rolle/bible-translation
  // ================================================================
  describe.each(WEGE)('PUT /api/$rolle/bible-translation', ({ rolle, wer, userId }) => {
    const setzen = (body) => request(app)
      .put(`/api/${rolle}/bible-translation`).set('Authorization', auth(wer)).send(body);

    it('gueltig: 200 und an users gespeichert', async () => {
      const res = await setzen({ translation: 'ELB' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Bibelübersetzung erfolgreich aktualisiert', translation: 'ELB' });
      const { rows: [u] } = await db.query('SELECT bible_translation FROM users WHERE id = $1', [userId()]);
      expect(u.bible_translation).toBe('ELB');
    });

    it('ungueltig: 400 mit der Liste', async () => {
      const res = await setzen({ translation: 'RVR60' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Ungültige Bibelübersetzung', valid_translations: ['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG'] });
    });
  });

  // ================================================================
  // Eigener Antrag: stellen und loeschen
  // ================================================================
  const ANTRAG = {
    konfi: { aktivitaet: () => ACTIVITIES.sonntagsgottesdienst.id, eingereicht: 'Antrag erfolgreich eingereicht',
      geloescht: 'Antrag erfolgreich gelöscht', nichtWartend: 'Nur wartende Anträge können gelöscht werden' },
    teamer: { aktivitaet: () => teamerAktivitaet, eingereicht: 'Antrag eingereicht',
      geloescht: 'Antrag gelöscht', nichtWartend: 'Nur ausstehende Anträge können gelöscht werden' },
  };

  describe.each(WEGE)('Antrag: /api/$rolle/requests', ({ rolle, wer, userId }) => {
    const stellen = (body) => request(app)
      .post(`/api/${rolle}/requests`).set('Authorization', auth(wer)).send(body);

    it('stellen: 201 {id, message}, Mitteilung an die Person, Datum wie angegeben', async () => {
      const res = await stellen({ activity_id: ANTRAG[rolle].aktivitaet(), requested_date: '2026-10-01', description: 'War da' });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['id', 'message']);
      expect(res.body.message).toBe(ANTRAG[rolle].eingereicht);
      const { rows: [ar] } = await db.query(
        `SELECT user_id::int AS user_id, activity_id::int AS activity_id, to_char(requested_date, 'YYYY-MM-DD') AS datum,
                comment, status, organization_id::int AS org FROM activity_requests WHERE id = $1`,
        [res.body.id]
      );
      expect(ar).toEqual({ user_id: userId(), activity_id: Number(ANTRAG[rolle].aktivitaet()), datum: '2026-10-01', comment: 'War da', status: 'pending', org: ORGS.testGemeinde.id });
      const { rows: mitteilungen } = await db.query(
        `SELECT title, type FROM notifications WHERE user_id = $1 AND type = 'activity_request_submitted'`, [userId()]);
      expect(mitteilungen).toEqual([{ title: 'Antrag eingereicht', type: 'activity_request_submitted' }]);
    });

    it('Aktivitaet der anderen Rolle: 404', async () => {
      const andere = rolle === 'konfi' ? ANTRAG.teamer.aktivitaet() : ANTRAG.konfi.aktivitaet();
      const res = await stellen({ activity_id: andere, requested_date: '2026-10-01' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Aktivität nicht gefunden' });
    });

    it('gleiche client_id zweimal: 200 mit dem vorhandenen Antrag, keine zweite Zeile', async () => {
      const clientId = '6f1c2b8e-1d4a-4c8e-9a2b-3c4d5e6f7a8b';
      const erst = await stellen({ activity_id: ANTRAG[rolle].aktivitaet(), requested_date: '2026-10-01', client_id: clientId });
      expect(erst.status).toBe(201);
      const zweit = await stellen({ activity_id: ANTRAG[rolle].aktivitaet(), requested_date: '2026-10-01', client_id: clientId });
      expect(zweit.status).toBe(200);
      expect(Number(zweit.body.id)).toBe(Number(erst.body.id));
      const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM activity_requests WHERE client_id = $1', [clientId]);
      expect(n).toBe(1);
    });

    it('loeschen: 200, Zeile weg; danach 404', async () => {
      const neu = await stellen({ activity_id: ANTRAG[rolle].aktivitaet(), requested_date: '2026-10-01' });
      const res = await request(app).delete(`/api/${rolle}/requests/${neu.body.id}`).set('Authorization', auth(wer));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: ANTRAG[rolle].geloescht });
      const { rows } = await db.query('SELECT 1 FROM activity_requests WHERE id = $1', [neu.body.id]);
      expect(rows).toHaveLength(0);
      const nochmal = await request(app).delete(`/api/${rolle}/requests/${neu.body.id}`).set('Authorization', auth(wer));
      expect(nochmal.status).toBe(404);
      expect(nochmal.body).toEqual({ error: 'Antrag nicht gefunden' });
    });

    it('loeschen eines entschiedenen Antrags: 400 mit dem Text des Wegs', async () => {
      const neu = await stellen({ activity_id: ANTRAG[rolle].aktivitaet(), requested_date: '2026-10-01' });
      await db.query(`UPDATE activity_requests SET status = 'approved' WHERE id = $1`, [neu.body.id]);
      const res = await request(app).delete(`/api/${rolle}/requests/${neu.body.id}`).set('Authorization', auth(wer));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: ANTRAG[rolle].nichtWartend });
      const { rows } = await db.query('SELECT 1 FROM activity_requests WHERE id = $1', [neu.body.id]);
      expect(rows).toHaveLength(1);
    });

    it('fremden Antrag loeschen: 404, der Antrag bleibt', async () => {
      const { rows: [fremd] } = await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
         VALUES ($1, $2, '2026-10-01', 'pending', $3) RETURNING id`,
        [USERS.konfi2.id, ANTRAG[rolle].aktivitaet(), ORGS.testGemeinde.id]
      );
      const res = await request(app).delete(`/api/${rolle}/requests/${fremd.id}`).set('Authorization', auth(wer));
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Antrag nicht gefunden' });
      const { rows } = await db.query('SELECT 1 FROM activity_requests WHERE id = $1', [fremd.id]);
      expect(rows).toHaveLength(1);
    });
  });

  // ================================================================
  // Abzeichen als gesehen markieren
  // ================================================================
  describe('Abzeichen als gesehen markieren', () => {
    async function ungesehen(userId) {
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id, seen) VALUES ($1, 1, $2, false)
         ON CONFLICT DO NOTHING`, [userId, ORGS.testGemeinde.id]);
      await db.query('UPDATE user_badges SET seen = false WHERE user_id = $1', [userId]);
    }
    const offen = async (userId) => (await db.query(
      'SELECT COUNT(*)::int AS n FROM user_badges WHERE user_id = $1 AND seen = false', [userId])).rows[0].n;

    it('POST /konfi/badges/mark-seen: 200 mit Text, alles gesehen', async () => {
      await ungesehen(USERS.konfi1.id);
      const res = await request(app).post('/api/konfi/badges/mark-seen').set('Authorization', auth('konfi1'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Alle Badges als gesehen markiert' });
      expect(await offen(USERS.konfi1.id)).toBe(0);
    });

    it.each(['put', 'post'])('%s /teamer/badges/mark-seen: 200 mit Text, alles gesehen', async (verb) => {
      await ungesehen(USERS.teamer1.id);
      const res = await request(app)[verb]('/api/teamer/badges/mark-seen').set('Authorization', auth('teamer1'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Badges als gesehen markiert' });
      expect(await offen(USERS.teamer1.id)).toBe(0);
    });
  });
});
