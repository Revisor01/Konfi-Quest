// backend/tests/routes/challengeNeuigkeiten.test.js
//
// Challenge-Neuigkeiten fuer Konfis (24.09.2026, Simon: "Badge-Indikator
// genau wie beim Chat -- auf der Challenge, am Reiter, am App-Icon").
//
// Der Chat zaehlt fremde Nachrichten seit dem letzten Oeffnen des Raums.
// Uebertragen zaehlt eine Challenge, was seit dem letzten Oeffnen der
// Detailansicht dazukam: die Challenge selbst (nie geoeffnet), fremde
// Beitraege in der Galerie, Moderation eigener Beitraege durch andere.
// Nur laufende Challenges, nur das, was die Person auch sehen darf.
//
// Diese Tests halten die Regel an der Quelle fest -- GET
// /notifications/badge-counts, Feld challengeUpdates -- und die Route, die
// den Lesezeitpunkt setzt. Die Summe fuers App-Icon prueft
// utils/appIconBadgeParitaet.test.js gegen dieselben Zahlen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Challenge-Neuigkeiten (Konfi-Zaehler wie beim Chat)', () => {
  let app;
  let db;
  let konfiToken;
  let teamerToken;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    teamerToken = generateToken('teamer1');
  });

  afterAll(async () => { await closePool(); });

  // --- Helfer -----------------------------------------------------------

  /** Laufende, oeffentliche, moderierte Challenge fuer jahrgang1 -- alles ueberschreibbar. */
  const challengeAnlegen = async (opts = {}) => {
    const {
      audience = 'konfis',
      visibility = 'public',
      moderated = true,
      isDraft = false,
      startsAt = "NOW() - interval '1 day'",
      endsAt = "NOW() + interval '7 days'",
      jahrgangId = JAHRGAENGE.jahrgang1.id
    } = opts;
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name, visibility, moderated,
                               starts_at, ends_at, is_draft, audience)
       VALUES ($1, 'Test-Challenge', 'Beschreibung', 'Stempel', $2, $3, ${startsAt}, ${endsAt}, $4, $5)
       RETURNING id`,
      [ORGS.testGemeinde.id, visibility, moderated, isDraft, audience]
    );
    if (jahrgangId !== null && audience !== 'nur_team') {
      await db.query(
        'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [id, jahrgangId]
      );
    }
    return id;
  };

  /** Beitrag mit frei waehlbarem Moderationsstand. Zeitstempel in SQL, damit sie sicher NACH einem Lesezeitpunkt liegen. */
  const beitrag = async (challengeId, userId, opts = {}) => {
    const {
      status = 'approved',
      consent = null,
      approvedBy = null,
      approvedAt = approvedBy ? 'NOW()' : 'NULL',
      hiddenBy = null,
      hiddenAt = hiddenBy ? 'NOW()' : 'NULL'
    } = opts;
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content,
                                          konfi_consent, moderation_status, approved_by, approved_at, hidden_by, hidden_at)
       VALUES ($1, $2, $3, 'text', 'Text', $4, $5, $6, ${approvedAt}, $7, ${hiddenAt})`,
      [challengeId, userId, ORGS.testGemeinde.id, consent, status, approvedBy, hiddenBy]
    );
  };

  /** Lesezeitpunkt direkt setzen -- eine Minute zurueck, damit alles Folgende sicher "danach" ist. */
  const gelesenVorEinerMinute = async (challengeId, user = USERS.konfi1) => {
    await db.query(
      `INSERT INTO challenge_read_status (challenge_id, user_id, user_type, last_read_at)
       VALUES ($1, $2, $3, NOW() - interval '1 minute')`,
      [challengeId, user.id, user.type]
    );
  };

  const zaehler = async (token) => {
    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.challengeUpdates;
  };

  // --- Was zaehlt ---------------------------------------------------------

  it('eine nie geoeffnete laufende Challenge zaehlt 1 -- am Eintrag und in der Summe', async () => {
    const id = await challengeAnlegen();
    const u = await zaehler(konfiToken);
    expect(u.total).toBe(1);
    expect(u.byChallenge).toEqual({ [id]: 1 });
  });

  it('nach dem Oeffnen zaehlt sie 0', async () => {
    const id = await challengeAnlegen();
    await gelesenVorEinerMinute(id);
    const u = await zaehler(konfiToken);
    expect(u.total).toBe(0);
    expect(u.byChallenge).toEqual({});
  });

  it('ein fremder Beitrag, der nach dem Oeffnen in der Galerie erschien, zaehlt 1', async () => {
    const id = await challengeAnlegen({ moderated: false });
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi2.id);
    const u = await zaehler(konfiToken);
    expect(u.total).toBe(1);
    expect(u.byChallenge).toEqual({ [id]: 1 });
  });

  it('ein fremder Beitrag, der VOR dem Oeffnen erschien, zaehlt nicht mehr', async () => {
    // Beitrag von gestern, gelesen vor einer Minute -> nichts Neues.
    const id = await challengeAnlegen({ moderated: false });
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content,
                                          moderation_status, created_at)
       VALUES ($1, $2, $3, 'text', 'Alt', 'approved', NOW() - interval '1 day')`,
      [id, USERS.konfi2.id, ORGS.testGemeinde.id]
    );
    await gelesenVorEinerMinute(id);
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('bei moderierten Challenges zaehlt der Zeitpunkt der Freigabe, nicht der Einreichung', async () => {
    // Eingereicht gestern, freigegeben jetzt, gelesen vor einer Minute:
    // Die Freigabe liegt NACH dem Lesen -> der Beitrag ist neu in der Galerie.
    const id = await challengeAnlegen();
    await gelesenVorEinerMinute(id);
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content,
                                          moderation_status, approved_by, approved_at, created_at)
       VALUES ($1, $2, $3, 'text', 'Spaet freigegeben', 'approved', $4, NOW(), NOW() - interval '1 day')`,
      [id, USERS.konfi2.id, ORGS.testGemeinde.id, USERS.admin1.id]
    );
    expect((await zaehler(konfiToken)).total).toBe(1);
  });

  it('ein fremder Beitrag, der noch auf Freigabe wartet, zaehlt nicht', async () => {
    const id = await challengeAnlegen();
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi2.id, { status: 'pending' });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('ein fremder Beitrag "nur fuer die Leitung" zaehlt nicht -- die Person sieht ihn nie', async () => {
    const id = await challengeAnlegen({ visibility: 'konfi_choice', moderated: false });
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi2.id, { consent: 'private' });
    // Gegenprobe im selben Aufbau: ein oeffentlicher Beitrag zaehlt wohl.
    expect((await zaehler(konfiToken)).total).toBe(0);
    await beitrag(id, USERS.konfi2.id, { consent: 'anonymous' });
    expect((await zaehler(konfiToken)).total).toBe(1);
  });

  it('bei einer "Nur Leitung"-Challenge zaehlen fremde Beitraege nie', async () => {
    const id = await challengeAnlegen({ visibility: 'private', moderated: false });
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi2.id);
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('der eigene Beitrag zaehlt nicht -- wie die eigene Nachricht im Chat', async () => {
    const id = await challengeAnlegen({ moderated: false });
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi1.id);
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('die Freigabe des eigenen Beitrags durch die Leitung zaehlt 1', async () => {
    const id = await challengeAnlegen();
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi1.id, { approvedBy: USERS.admin1.id });
    const u = await zaehler(konfiToken);
    expect(u.total).toBe(1);
    expect(u.byChallenge).toEqual({ [id]: 1 });
  });

  it('das Ausblenden des eigenen Beitrags zaehlt 1', async () => {
    const id = await challengeAnlegen();
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi1.id, { status: 'hidden', hiddenBy: USERS.admin1.id });
    expect((await zaehler(konfiToken)).total).toBe(1);
  });

  it('der eigene Beitrag ohne Moderation (automatisch freigegeben) zaehlt nicht', async () => {
    // approved_by bleibt dort NULL (routes/challenges.js) -- niemand hat
    // gehandelt, also gibt es nichts zu melden.
    const id = await challengeAnlegen({ moderated: false });
    await gelesenVorEinerMinute(id);
    await beitrag(id, USERS.konfi1.id, { status: 'approved' });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('alles zusammen: neue Challenge + zwei fremde Beitraege + eigene Freigabe = 4', async () => {
    const id = await challengeAnlegen();
    await beitrag(id, USERS.konfi2.id, { approvedBy: USERS.admin1.id });
    await beitrag(id, USERS.konfi2.id, { approvedBy: USERS.admin1.id });
    await beitrag(id, USERS.konfi1.id, { approvedBy: USERS.admin1.id });
    const u = await zaehler(konfiToken);
    expect(u.total).toBe(4);
    expect(u.byChallenge).toEqual({ [id]: 4 });
  });

  it('zwei Challenges liefern getrennte Zahlen je Eintrag', async () => {
    const a = await challengeAnlegen();
    const b = await challengeAnlegen({ moderated: false });
    await beitrag(b, USERS.konfi2.id);
    const u = await zaehler(konfiToken);
    expect(u.byChallenge).toEqual({ [a]: 1, [b]: 2 });
    expect(u.total).toBe(3);
  });

  // --- Was NICHT zaehlt: Sichtbarkeit und Zustand ----------------------------

  it('eine beendete Challenge zaehlt nicht -- dort gibt es nichts mehr zu tun', async () => {
    await challengeAnlegen({ startsAt: "NOW() - interval '10 days'", endsAt: "NOW() - interval '1 day'" });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('eine geplante Challenge zaehlt nicht -- Konfis sehen sie noch nicht', async () => {
    await challengeAnlegen({ startsAt: "NOW() + interval '1 day'", endsAt: "NOW() + interval '7 days'" });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('ein Entwurf zaehlt nicht', async () => {
    await challengeAnlegen({ isDraft: true });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('eine Team-Challenge zaehlt fuer Konfis nicht -- sie existiert fuer sie nicht', async () => {
    await challengeAnlegen({ audience: 'nur_team' });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('eine Challenge eines fremden Jahrgangs zaehlt nicht', async () => {
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES (901, 'Fremd 2027', $1, '2027-05-01')`,
      [ORGS.testGemeinde.id]
    );
    await challengeAnlegen({ jahrgangId: 901 });
    expect((await zaehler(konfiToken)).total).toBe(0);
  });

  it('Teamer:innen bekommen 0 -- ihr Reiter zaehlt die Freigaben, nicht die Neuigkeiten', async () => {
    // teamer1 ist jahrgang1 zugewiesen und wuerde die Challenge SEHEN --
    // der Neuigkeiten-Zaehler ist trotzdem allein Sache der Konfis.
    const id = await challengeAnlegen({ audience: 'konfis_und_team' });
    await beitrag(id, USERS.konfi2.id, { status: 'pending' });
    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${teamerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.challengeUpdates).toEqual({ total: 0, byChallenge: {} });
    // Gegenprobe: die Freigabe steht bei ihr sehr wohl am Reiter.
    expect(res.body.pendingChallenges).toBe(1);
  });

  it('die uebrigen Felder von badge-counts bleiben unveraendert (Alt-App-Vertrag)', async () => {
    await challengeAnlegen();
    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(res.status).toBe(200);
    expect(res.body.chat).toEqual({ total: 0, byRoom: { 1: 0, 2: 0 } });
    expect(res.body.pendingRequests).toBe(0);
    expect(res.body.pendingEvents).toBe(0);
    expect(res.body.pendingChallenges).toBe(0);
    expect(res.body.newBadges).toBe(0);
  });

  // --- Die Route, die den Lesezeitpunkt setzt ---------------------------------

  describe('POST /api/challenges/konfi/:id/mark-read', () => {
    const markRead = (id, token) =>
      request(app)
        .post(`/api/challenges/konfi/${id}/mark-read`)
        .set('Authorization', `Bearer ${token}`);

    it('setzt den Lesezeitpunkt und nimmt die Zahl vom Eintrag', async () => {
      const id = await challengeAnlegen();
      expect((await zaehler(konfiToken)).total).toBe(1);

      const res = await markRead(id, konfiToken);
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT last_read_at FROM challenge_read_status WHERE challenge_id = $1 AND user_id = $2 AND user_type = $3',
        [id, USERS.konfi1.id, 'konfi']
      );
      expect(rows).toHaveLength(1);
      expect((await zaehler(konfiToken)).total).toBe(0);
    });

    it('ein zweiter Aufruf schiebt den Zeitpunkt nach vorn (Upsert, keine zweite Zeile)', async () => {
      const id = await challengeAnlegen();
      await gelesenVorEinerMinute(id);
      // Ein Beitrag nach dem ersten Lesen: zaehlt ...
      await beitrag(id, USERS.konfi2.id, { approvedBy: USERS.admin1.id });
      expect((await zaehler(konfiToken)).total).toBe(1);
      // ... bis erneut geoeffnet wird.
      expect((await markRead(id, konfiToken)).status).toBe(200);
      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM challenge_read_status WHERE challenge_id = $1 AND user_id = $2',
        [id, USERS.konfi1.id]
      );
      expect(rows[0].c).toBe(1);
      expect((await zaehler(konfiToken)).total).toBe(0);
    });

    it('eine Team-Challenge liefert Konfis 404 -- die Existenz sickert nicht durch', async () => {
      const id = await challengeAnlegen({ audience: 'nur_team' });
      expect((await markRead(id, konfiToken)).status).toBe(404);
    });

    it('eine Challenge eines fremden Jahrgangs liefert 403', async () => {
      await db.query(
        `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
         VALUES (901, 'Fremd 2027', $1, '2027-05-01')`,
        [ORGS.testGemeinde.id]
      );
      const id = await challengeAnlegen({ jahrgangId: 901 });
      expect((await markRead(id, konfiToken)).status).toBe(403);
    });

    it('ein Entwurf liefert 404', async () => {
      const id = await challengeAnlegen({ isDraft: true });
      expect((await markRead(id, konfiToken)).status).toBe(404);
    });

    it('eine unbekannte Challenge liefert 404', async () => {
      expect((await markRead(999999, konfiToken)).status).toBe(404);
    });

    it('ohne Anmeldung 401', async () => {
      const id = await challengeAnlegen();
      const res = await request(app).post(`/api/challenges/konfi/${id}/mark-read`);
      expect(res.status).toBe(401);
    });

    it('Teamer:innen duerfen die Route ebenfalls aufrufen (dieselbe Detailansicht)', async () => {
      const id = await challengeAnlegen({ audience: 'konfis_und_team' });
      expect((await markRead(id, teamerToken)).status).toBe(200);
    });
  });
});
