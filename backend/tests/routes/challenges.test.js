// Integrationstests für Challenges 2.0 (backend/routes/challenges.js).
//
// Schwerpunkt liegt auf der zentralen Sichtbarkeitslogik (PUBLIC_SUBMISSION_SQL /
// isSubmissionPublic), weil Galerie, Datei-Auslieferung und Export alle darauf
// aufbauen und NIE auseinanderlaufen duerfen. Danach: Auto-Approve, Sperr-Logik
// nach Start, RBAC/Org-Isolation, allow_multiple, konfi_consent-Fallback,
// media_type-Validierung, Delete/Abzeichen, Export, Moderationszyklus.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// Echte gueltige 1x1-PNG (file-type verlangt valide Struktur für die
// Magic-Bytes-Prüfung in challenges.js).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

describe('Challenges Routes', () => {
  let app;
  let db;
  let konfi1Token, konfi2Token, teamer1Token, admin1Token, orgAdmin1Token;
  let konfi3Token, teamer2Token, admin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfi1Token = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
    teamer1Token = generateToken('teamer1');
    admin1Token = generateToken('admin1');
    orgAdmin1Token = generateToken('orgAdmin1');
    konfi3Token = generateToken('konfi3');
    teamer2Token = generateToken('teamer2');
    admin2Token = generateToken('admin2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // Helper: Challenge direkt in der DB anlegen (volle Kontrolle über
  // starts_at/visibility/moderated, die per API nach Start gesperrt sind).
  // ================================================================
  async function createChallenge(overrides = {}) {
    const opts = {
      organization_id: ORGS.testGemeinde.id,
      title: 'Testchallenge',
      description: 'Beschreibung der Testchallenge',
      challenge_type: 'frei',
      audience: 'konfis',
      visibility: 'konfi_choice',
      moderated: true,
      allowed_media: ['text', 'photo', 'audio', 'video', 'link'],
      allow_multiple: true,
      badge_icon: 'flag',
      badge_name: 'Testabzeichen',
      created_by: USERS.admin1.id,
      starts_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // gestern -> aktiv
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // in 7 Tagen
      is_draft: false,
      ...overrides,
    };
    const { rows: [row] } = await db.query(
      `INSERT INTO challenges
         (organization_id, title, description, challenge_type, audience, visibility, moderated,
          allowed_media, allow_multiple, badge_icon, badge_name, created_by,
          starts_at, ends_at, is_draft)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        opts.organization_id, opts.title, opts.description, opts.challenge_type,
        opts.audience, opts.visibility, opts.moderated, JSON.stringify(opts.allowed_media),
        opts.allow_multiple, opts.badge_icon, opts.badge_name, opts.created_by,
        opts.starts_at, opts.ends_at, opts.is_draft,
      ]
    );
    return row;
  }

  async function assignJahrgang(challengeId, jahrgangId) {
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [challengeId, jahrgangId]
    );
  }

  // Submission direkt in der DB anlegen (volle Kontrolle über moderation_status,
  // konfi_consent — Kombinationen, die per API nicht in dieser Form erreichbar sind).
  async function createSubmission(overrides = {}) {
    const opts = {
      challenge_id: null,
      user_id: USERS.konfi1.id,
      organization_id: ORGS.testGemeinde.id,
      media_type: 'text',
      text_content: 'Mein Beitrag',
      file_path: null,
      file_name: null,
      link_url: null,
      konfi_consent: null,
      moderation_status: 'pending',
      ...overrides,
    };
    const { rows: [row] } = await db.query(
      `INSERT INTO challenge_submissions
         (challenge_id, user_id, organization_id, media_type, text_content,
          file_path, file_name, link_url, konfi_consent, moderation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        opts.challenge_id, opts.user_id, opts.organization_id, opts.media_type,
        opts.text_content, opts.file_path, opts.file_name, opts.link_url,
        opts.konfi_consent, opts.moderation_status,
      ]
    );
    return row;
  }

  // Baut eine aktive Challenge (jahrgang1, Org 1) + eine Submission von konfi2
  // (damit konfi1 sie in der Galerie als FREMDEN Beitrag sehen kann) und liefert
  // beide IDs zurück.
  async function setupChallengeWithForeignSubmission(challengeOverrides, submissionOverrides) {
    const challenge = await createChallenge(challengeOverrides);
    await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
    const submission = await createSubmission({
      challenge_id: challenge.id,
      user_id: USERS.konfi2.id,
      ...submissionOverrides,
    });
    return { challenge, submission };
  }

  // ================================================================
  // 1. Sichtbarkeitslogik der Galerie
  //    visibility x konfi_consent x moderation_status -> sichtbar? mit Name?
  // ================================================================
  describe('Sichtbarkeitslogik der Galerie (GET /konfi/:id)', () => {
    async function galleryFor(konfiToken, challengeId) {
      const res = await request(app)
        .get(`/api/challenges/konfi/${challengeId}`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);
      return res.body.gallery;
    }

    it('visibility=public + approved -> sichtbar MIT Namen', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { konfi_consent: null, moderation_status: 'approved' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(1);
      expect(gallery[0].display_name).toBe(USERS.konfi2.display_name);
      expect(gallery[0].is_anonymous).toBe(false);
    });

    it('visibility=public + pending -> NICHT sichtbar (moderiert, noch nicht freigegeben)', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'public', moderated: true },
        { konfi_consent: null, moderation_status: 'pending' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(0);
    });

    it('visibility=public + hidden -> NICHT sichtbar (hidden schlaegt alles)', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { konfi_consent: null, moderation_status: 'hidden' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(0);
    });

    it('visibility=konfi_choice + consent=publish + approved -> sichtbar MIT Namen', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'publish', moderation_status: 'approved' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(1);
      expect(gallery[0].display_name).toBe(USERS.konfi2.display_name);
      expect(gallery[0].is_anonymous).toBe(false);
    });

    it('visibility=konfi_choice + consent=anonymous + approved -> sichtbar OHNE Namen', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'anonymous', moderation_status: 'approved' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(1);
      expect(gallery[0].display_name).toBeNull();
      expect(gallery[0].is_anonymous).toBe(true);
      // Der Name darf nicht irgendwo versteckt in der Response auftauchen.
      expect(JSON.stringify(gallery[0])).not.toContain(USERS.konfi2.display_name);
    });

    it('visibility=konfi_choice + consent=private + approved -> NICHT sichtbar', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'private', moderation_status: 'approved' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(0);
    });

    it('visibility=konfi_choice + consent=publish + pending -> NICHT sichtbar', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'publish', moderation_status: 'pending' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(0);
    });

    it('visibility=konfi_choice + consent=anonymous + hidden -> NICHT sichtbar (hidden schlaegt alles)', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'anonymous', moderation_status: 'hidden' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(0);
    });

    it('visibility=private + approved -> NIE oeffentlich sichtbar, egal welcher consent', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'private' },
        { konfi_consent: null, moderation_status: 'approved' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(0);
    });

    it('moderated=false -> Submission bereits als approved erfasst, ist sofort in der Galerie sichtbar', async () => {
      // moderated=false gilt für die Challenge; die Submission wird über die
      // API angelegt (Auto-Approve, siehe Block 2), hier direkt approved geseedet.
      const { challenge } = await setupChallengeWithForeignSubmission(
        { visibility: 'public', moderated: false },
        { konfi_consent: null, moderation_status: 'approved' }
      );
      const gallery = await galleryFor(konfi1Token, challenge.id);
      expect(gallery.length).toBe(1);
    });

    it('Eigene Submission erscheint NIE in der Galerie-Liste (die liegt separat in own_submissions)', async () => {
      const challenge = await createChallenge({ visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        moderation_status: 'approved',
      });

      const res = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.gallery.length).toBe(0);
      expect(res.body.own_submissions.length).toBe(1);
    });

    it('Leitung (Admin) sieht in der Sammelansicht IMMER alles, auch pending/hidden/private', async () => {
      const challenge = await createChallenge({ visibility: 'private', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'pending' });
      await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi2.id, moderation_status: 'hidden' });

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.submissions.length).toBe(2);
    });
  });

  // ================================================================
  // 2. Auto-Approve
  // ================================================================
  describe('Auto-Approve bei moderated=false', () => {
    it('moderated=false -> Submission ist sofort approved', async () => {
      const challenge = await createChallenge({ moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Sofort sichtbar' });

      expect(res.status).toBe(201);
      expect(res.body.moderation_status).toBe('approved');
    });

    it('moderated=true -> Submission ist pending', async () => {
      const challenge = await createChallenge({ moderated: true, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Muss erst freigegeben werden' });

      expect(res.status).toBe(201);
      expect(res.body.moderation_status).toBe('pending');
    });
  });

  // ================================================================
  // 3. Sperr-Logik nach Start (PUT /admin/:id)
  // ================================================================
  describe('Sperr-Logik nach Start (PUT /admin/:id)', () => {
    async function startedChallenge(overrides = {}) {
      const challenge = await createChallenge({
        starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // vor 1h
        is_draft: false,
        ...overrides,
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      return challenge;
    }

    it('visibility aendern nach Start -> 409', async () => {
      const challenge = await startedChallenge({ visibility: 'public' });
      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ visibility: 'private' });
      expect(res.status).toBe(409);
    });

    it('moderated aendern nach Start -> 409', async () => {
      const challenge = await startedChallenge({ moderated: true });
      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ moderated: false });
      expect(res.status).toBe(409);
    });

    it('starts_at aendern nach Start -> 409', async () => {
      const challenge = await startedChallenge();
      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
      expect(res.status).toBe(409);
    });

    it('allowed_media aendern nach Start -> 409', async () => {
      const challenge = await startedChallenge({ allowed_media: ['text', 'photo'] });
      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ allowed_media: ['text'] });
      expect(res.status).toBe(409);
    });

    it('title/description/ends_at nach Start aendern -> 200', async () => {
      const challenge = await startedChallenge();
      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          title: 'Neuer Titel',
          description: 'Neue Beschreibung',
          ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Neuer Titel');
      expect(res.body.description).toBe('Neue Beschreibung');
    });

    it('badge_icon/badge_name nach Start aendern -> 200', async () => {
      const challenge = await startedChallenge();
      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ badge_icon: 'star', badge_name: 'Neues Abzeichen' });
      expect(res.status).toBe(200);
      expect(res.body.badge_icon).toBe('star');
      expect(res.body.badge_name).toBe('Neues Abzeichen');
    });

    it('Vor dem Start ist visibility/moderated/starts_at/allowed_media weiterhin frei aenderbar', async () => {
      const challenge = await createChallenge({
        starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // in 1h -> noch nicht gestartet
        visibility: 'public',
        moderated: true,
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ visibility: 'private', moderated: false, allowed_media: ['text'] });
      expect(res.status).toBe(200);
      expect(res.body.visibility).toBe('private');
      expect(res.body.moderated).toBe(false);
    });

    it('Draft mit vergangenem starts_at ist NICHT "gestartet" (is_draft blockt) -> alles aenderbar', async () => {
      const challenge = await createChallenge({
        starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        is_draft: true,
        visibility: 'public',
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ visibility: 'private' });
      expect(res.status).toBe(200);
      expect(res.body.visibility).toBe('private');
    });
  });

  // ================================================================
  // 4. RBAC
  // ================================================================
  describe('RBAC', () => {
    it('Konfi kann nicht moderieren -> 403', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi2.id });

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ action: 'approve' });
      expect(res.status).toBe(403);
    });

    it('Konfi sieht keine Drafts in GET /konfi', async () => {
      const draft = await createChallenge({ is_draft: true, title: 'Geheimer Entwurf' });
      await assignJahrgang(draft.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      const titles = [...res.body.active, ...res.body.archive].map(c => c.title);
      expect(titles).not.toContain('Geheimer Entwurf');
    });

    it('Konfi sieht keinen Draft per Detail-Route (GET /konfi/:id) -> 404', async () => {
      const draft = await createChallenge({ is_draft: true });
      await assignJahrgang(draft.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .get(`/api/challenges/konfi/${draft.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(404);
    });

    it('Konfi sieht keine Challenges fremder Jahrgaenge (nicht in GET /konfi)', async () => {
      // Challenge für Org 1, aber NUR jahrgang2 zugeordnet (jahrgang2 ist Org 2 -
      // in derselben Org wäre das ein zweiter Jahrgang; hier reicht: konfi1 ist
      // jahrgang1, die Challenge ist keinem Jahrgang von konfi1 zugeordnet).
      const { rows: [ownJahrgang] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('Anderer Jahrgang', $1, '2026-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const challenge = await createChallenge({ title: 'Nur fuer anderen Jahrgang' });
      await assignJahrgang(challenge.id, ownJahrgang.id);

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      const titles = [...res.body.active, ...res.body.archive].map(c => c.title);
      expect(titles).not.toContain('Nur fuer anderen Jahrgang');
    });

    it('Konfi bekommt 403 bei Detail-Zugriff auf Challenge fremden Jahrgangs (Org gleich, Jahrgang fremd)', async () => {
      const { rows: [ownJahrgang] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('Anderer Jahrgang 2', $1, '2026-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, ownJahrgang.id);

      const res = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(403);
    });

    it('Teamer sieht/verwaltet nur zugewiesene Jahrgaenge: fremde Challenge (kein zugewiesener Jahrgang) -> 403', async () => {
      // teamer1 ist nur jahrgang1 zugewiesen. Neuer Jahrgang OHNE Zuweisung:
      const { rows: [fremderJahrgang] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('Teamer-fremder Jahrgang', $1, '2026-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, fremderJahrgang.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ title: 'Umbenannt' });
      expect(res.status).toBe(403);
    });

    it('Teamer verwaltet zugewiesenen Jahrgang erfolgreich -> 200', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ title: 'Von Teamer umbenannt' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Von Teamer umbenannt');
    });

    it('GET /admin: Teamer sieht nur Challenges seiner zugewiesenen Jahrgaenge', async () => {
      const eigene = await createChallenge({ title: 'Teamer-Challenge' });
      await assignJahrgang(eigene.id, JAHRGAENGE.jahrgang1.id);

      const { rows: [fremderJahrgang] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('Fremd', $1, '2026-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const fremde = await createChallenge({ title: 'Fremde-Challenge' });
      await assignJahrgang(fremde.id, fremderJahrgang.id);

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(200);
      const titles = res.body.map(c => c.title);
      expect(titles).toContain('Teamer-Challenge');
      expect(titles).not.toContain('Fremde-Challenge');
    });

    it('Admin/Org-Admin sehen in GET /admin alle Challenges der Org (keine Jahrgangs-Einschraenkung)', async () => {
      const { rows: [jg] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('Beliebig', $1, '2026-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const challenge = await createChallenge({ title: 'Fuer Admin sichtbar' });
      await assignJahrgang(challenge.id, jg.id);

      const res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${orgAdmin1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.map(c => c.title)).toContain('Fuer Admin sichtbar');
    });

    it('Cross-Org: Konfi aus Org 2 bekommt 404 auf Challenge aus Org 1', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi3Token}`);
      expect(res.status).toBe(404);
    });

    it('Cross-Org: Teamer aus Org 2 bekommt 404 auf Challenge aus Org 1 (PUT)', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${teamer2Token}`)
        .send({ title: 'Uebernommen' });
      expect(res.status).toBe(404);
    });

    it('Cross-Org: Admin aus Org 2 bekommt 404 auf Submissions-Sammelansicht aus Org 1', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });

    it('Cross-Org: Konfi aus Org 2 kann keinen Beitrag zu Challenge aus Org 1 einreichen -> 404', async () => {
      const challenge = await createChallenge({ moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi3Token}`)
        .send({ media_type: 'text', text_content: 'Fremdeinreichung' });
      expect(res.status).toBe(404);
    });

    it('Cross-Org: Moderation einer fremden Submission -> 404', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id });

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ action: 'approve' });
      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // 5. allow_multiple
  // ================================================================
  describe('allow_multiple', () => {
    it('allow_multiple=false -> zweite Submission gibt 409', async () => {
      const challenge = await createChallenge({ allow_multiple: false, moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const first = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Erster Beitrag' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Zweiter Beitrag' });
      expect(second.status).toBe(409);
    });

    it('allow_multiple=true -> mehrere Submissions moeglich', async () => {
      const challenge = await createChallenge({ allow_multiple: true, moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const first = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Erster Beitrag' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Zweiter Beitrag' });
      expect(second.status).toBe(201);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS n FROM challenge_submissions WHERE challenge_id = $1 AND user_id = $2',
        [challenge.id, USERS.konfi1.id]
      );
      expect(rows[0].n).toBe(2);
    });

    it('allow_multiple=false gilt NUR pro Konfi (anderer Konfi kann trotzdem einreichen)', async () => {
      const challenge = await createChallenge({ allow_multiple: false, moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const first = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Konfi1' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ media_type: 'text', text_content: 'Konfi2' });
      expect(second.status).toBe(201);
    });
  });

  // ================================================================
  // 6. konfi_consent-Fallback
  // ================================================================
  describe('konfi_consent-Fallback', () => {
    it('visibility=konfi_choice ohne consent im Body -> Fallback publish', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: false });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Ohne explizite Auswahl' });

      expect(res.status).toBe(201);
      expect(res.body.konfi_consent).toBe('publish');
    });

    it('visibility=konfi_choice mit konfi_consent=anonymous -> wird uebernommen', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: false });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Anonym bitte', konfi_consent: 'anonymous' });

      expect(res.status).toBe(201);
      expect(res.body.konfi_consent).toBe('anonymous');
    });

    it('visibility=public -> konfi_consent wird ignoriert/NULL, egal was gesendet wird', async () => {
      const challenge = await createChallenge({ visibility: 'public', moderated: false });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Trotzdem gesendet', konfi_consent: 'anonymous' });

      expect(res.status).toBe(201);
      expect(res.body.konfi_consent).toBeNull();
    });

    it('visibility=private -> konfi_consent wird ignoriert/NULL', async () => {
      const challenge = await createChallenge({ visibility: 'private', moderated: false });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Privat', konfi_consent: 'publish' });

      expect(res.status).toBe(201);
      expect(res.body.konfi_consent).toBeNull();
    });

    it('visibility=konfi_choice mit ungueltigem consent-Wert -> 400', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: false });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Falscher Wert', konfi_consent: 'geheim' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // 7. media_type-Validierung / Pflichtfelder
  // ================================================================
  describe('media_type-Validierung gegen allowed_media', () => {
    it('media_type nicht in allowed_media -> 400', async () => {
      const challenge = await createChallenge({ allowed_media: ['text'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'link', link_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' });

      expect(res.status).toBe(400);
    });

    it('media_type komplett unbekannt -> 400', async () => {
      const challenge = await createChallenge({ moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'gif', text_content: 'x' });

      expect(res.status).toBe(400);
    });

    it('media_type=text ohne text_content -> 400', async () => {
      const challenge = await createChallenge({ allowed_media: ['text'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text' });

      expect(res.status).toBe(400);
    });

    it('media_type=link ohne gueltige URL -> 400', async () => {
      const challenge = await createChallenge({ allowed_media: ['link'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'link', link_url: 'nicht-http' });

      expect(res.status).toBe(400);
    });

    // ----------------------------------------------------------------
    // Erlaubnisliste fuer Link-Beitraege (utils/musikLinks): nur Spotify,
    // Apple Music, YouTube Music und Deezer. Der Metadaten-Abruf laeuft
    // ueber global fetch — hier gestubbt, damit kein Test ins Netz geht.
    // ----------------------------------------------------------------
    const FEHLERTEXT_MUSIK = 'Hier gehen nur Musik-Links: Spotify, Apple Music, YouTube Music und Deezer. Bitte teile den Link direkt aus einer dieser Apps.';

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('media_type=link mit Spotify-URL -> 201, Titel/Interpret aus oEmbed gespeichert', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ title: 'Testlied', author_name: 'Testband' })
      })));
      const challenge = await createChallenge({ allowed_media: ['link'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'link', link_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' });

      expect(res.status).toBe(201);
      expect(res.body.link_url).toBe('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
      expect(res.body.link_title).toBe('Testlied');
      expect(res.body.link_author).toBe('Testband');

      const { rows: [gespeichert] } = await db.query(
        'SELECT link_title, link_author FROM challenge_submissions WHERE id = $1',
        [res.body.id]
      );
      expect(gespeichert.link_title).toBe('Testlied');
      expect(gespeichert.link_author).toBe('Testband');
    });

    it('Metadaten-Abruf scheitert -> Beitrag wird TROTZDEM gespeichert, ohne Titel', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
      const challenge = await createChallenge({ allowed_media: ['link'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'link', link_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' });

      expect(res.status).toBe(201);
      expect(res.body.link_title).toBeNull();
      expect(res.body.link_author).toBeNull();
    });

    it('Link von fremder Domain -> 400 mit Nennung der erlaubten Dienste', async () => {
      const challenge = await createChallenge({ allowed_media: ['link'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'link', link_url: 'https://example.org/song' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(FEHLERTEXT_MUSIK);
    });

    it('Umgehungsversuche (Host im Query, fremde Subdomain, Userinfo, javascript:) -> 400', async () => {
      const challenge = await createChallenge({ allowed_media: ['link'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const angriffe = [
        'https://boese.de/?x=open.spotify.com',
        'https://open.spotify.com.boese.de/track/x',
        'https://open.spotify.com@boese.de/track/x',
        'javascript:alert(1)'
      ];
      for (const linkUrl of angriffe) {
        const res = await request(app)
          .post(`/api/challenges/konfi/${challenge.id}/submissions`)
          .set('Authorization', `Bearer ${konfi1Token}`)
          .send({ media_type: 'link', link_url: linkUrl });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(FEHLERTEXT_MUSIK);
      }
      const { rows: [{ n }] } = await db.query(
        'SELECT COUNT(*)::int AS n FROM challenge_submissions WHERE challenge_id = $1',
        [challenge.id]
      );
      expect(n).toBe(0);
    });

    it('media_type=photo ohne Datei -> 400', async () => {
      const challenge = await createChallenge({ allowed_media: ['photo'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'photo' });

      expect(res.status).toBe(400);
    });

    it('media_type=photo mit gueltiger PNG-Datei -> 201, Datei wird verschluesselt gespeichert', async () => {
      const challenge = await createChallenge({ allowed_media: ['photo'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .field('media_type', 'photo')
        .attach('file', PNG, { filename: 'beitrag.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.file_path).toMatch(/^[a-f0-9]+$/);
      expect(res.body.file_name).toBe('beitrag.png');
    });

    it('media_type=photo mit vorgetaeuschter Datei (Text als .png) -> 415 (Magic-Bytes-Pruefung)', async () => {
      const challenge = await createChallenge({ allowed_media: ['photo'], moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const fakeImage = Buffer.from('Das ist gar kein Bild, nur Text');
      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .field('media_type', 'photo')
        .attach('file', fakeImage, { filename: 'faelschung.png', contentType: 'image/png' });

      expect(res.status).toBe(415);
    });

    it('Challenge nicht aktiv (noch nicht gestartet) -> 409 bei Submission', async () => {
      const challenge = await createChallenge({
        starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        is_draft: false,
        visibility: 'public',
        moderated: false,
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Zu frueh' });
      // Route liefert 404 für is_draft, aber für "gestartet in der Zukunft, kein Draft"
      // greift die isActive()-Prüfung -> 409.
      expect(res.status).toBe(409);
    });

    it('Challenge bereits beendet -> 409 bei Submission', async () => {
      const challenge = await createChallenge({
        starts_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'public',
        moderated: false,
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Zu spaet' });
      expect(res.status).toBe(409);
    });
  });

  // ================================================================
  // 8. DELETE /konfi/submissions/:id (gesperrt) + Abzeichen (marks)
  // ================================================================
  // Design-Entscheidung: Konfis duerfen eingereichte Beitraege NICHT mehr
  // zurueckziehen. Der Endpoint existiert als Route weiter, antwortet aber
  // immer mit 403 — unabhaengig von Eigentuemerschaft. Die alte
  // Existenz-Leak-Schutz-Frage (eigene vs. fremde Submission -> 404) stellt
  // sich damit nicht mehr: es wird gar nicht mehr bis zum Lookup vorgedrungen.
  describe('DELETE /konfi/submissions/:id ist gesperrt', () => {
    it('Konfi kann eigene Submission NICHT loeschen -> 403', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id });

      const res = await request(app)
        .delete(`/api/challenges/konfi/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(403);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(1);
    });

    it('Konfi kann auch die Submission eines anderen Konfis NICHT loeschen -> 403', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi2.id });

      // Die Sperre greift bereits vor jedem Eigentuems-Check: Ergebnis ist
      // für eigene und fremde Submissions identisch (403), es gibt keinen
      // Unterschied mehr zu verraten.
      const res = await request(app)
        .delete(`/api/challenges/konfi/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(403);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(1);
    });

    it('Nicht-Konfi (z.B. Teamer) bekommt ebenfalls 403', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id });

      const res = await request(app)
        .delete(`/api/challenges/konfi/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(403);
    });

    it('Abzeichen (marks) erscheint nach erster FREIGEGEBENER Submission', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      // Seit 24.08.2026 zaehlt bei moderierten Challenges nur ein
      // approved-Beitrag als Abzeichen — pending reicht nicht mehr
      // (eigener Testblock "Abzeichen erst nach Freigabe" weiter unten).
      await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'approved' });

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      const mark = res.body.marks.find(m => m.challenge_id === challenge.id);
      expect(mark).toBeDefined();
      expect(mark.badge_icon).toBe(challenge.badge_icon);
      expect(mark.badge_name).toBe(challenge.badge_name);
    });

    it('Abzeichen bleibt bestehen, weil die Submission nicht mehr geloescht werden kann', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'approved' });

      // Vorher: Abzeichen da
      let res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.body.marks.some(m => m.challenge_id === challenge.id)).toBe(true);

      // Loeschversuch wird abgelehnt
      const del = await request(app)
        .delete(`/api/challenges/konfi/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(del.status).toBe(403);

      // Nachher: Abzeichen weiterhin da
      res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.body.marks.some(m => m.challenge_id === challenge.id)).toBe(true);
    });
  });

  // ================================================================
  // 9. Export (GET /admin/:id/export)
  // ================================================================
  describe('Export GET /admin/:id/export', () => {
    it('Export enthaelt Texte und Links der nicht ausgeblendeten Beitraege', async () => {
      const challenge = await createChallenge({ visibility: 'public', title: 'Export-Challenge' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id,
        media_type: 'text', text_content: 'Mein Gebet fuer den Sonntag', moderation_status: 'approved',
      });
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi2.id,
        media_type: 'link', text_content: null, link_url: 'https://example.org/song',
        moderation_status: 'approved',
      });

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Export-Challenge');
      expect(res.text).toContain('Mein Gebet fuer den Sonntag');
      expect(res.text).toContain('https://example.org/song');
      expect(res.text).toContain(USERS.konfi1.display_name);
    });

    it('Export bei anonymous-consent zeigt den Beitrag OHNE den echten Namen', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', title: 'Anonym-Export' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id,
        media_type: 'text', text_content: 'Anonymer Beitrag',
        konfi_consent: 'anonymous', moderation_status: 'approved',
      });

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Anonymer Beitrag');
      expect(res.text).not.toContain(USERS.konfi1.display_name);
      expect(res.text).toContain('Anonym');
    });

    it('Export lässt hidden-Beitraege komplett aus', async () => {
      const challenge = await createChallenge({ visibility: 'public', title: 'Hidden-Export' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id,
        media_type: 'text', text_content: 'Ausgeblendeter Text', moderation_status: 'hidden',
      });

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(res.text).not.toContain('Ausgeblendeter Text');
    });

    it('Konfi bekommt 403 beim Export (Leitungs-Endpunkt)', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/export`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // 10. Moderations-Zyklus (approve/hide/unhide)
  // ================================================================
  describe('Moderation: approve/hide/unhide-Zyklus', () => {
    it('approve setzt moderation_status auf approved', async () => {
      const challenge = await createChallenge({ moderated: true, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'pending' });

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'approve' });
      expect(res.status).toBe(200);
      expect(res.body.moderation_status).toBe('approved');
    });

    it('hide blendet einen bereits approved-Beitrag aus der Galerie aus (hidden schlaegt alles)', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public', moderated: true },
        { konfi_consent: null, moderation_status: 'approved' }
      );

      // Vorher: in der Galerie für konfi1 sichtbar
      let galleryRes = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(galleryRes.body.gallery.length).toBe(1);

      const hideRes = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide' });
      expect(hideRes.status).toBe(200);
      expect(hideRes.body.moderation_status).toBe('hidden');

      // Nachher: aus der Galerie verschwunden
      galleryRes = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(galleryRes.body.gallery.length).toBe(0);
    });

    it('unhide macht einen ausgeblendeten Beitrag wieder approved und in der Galerie sichtbar', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public', moderated: true },
        { konfi_consent: null, moderation_status: 'hidden' }
      );

      const unhideRes = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'unhide' });
      expect(unhideRes.status).toBe(200);
      expect(unhideRes.body.moderation_status).toBe('approved');

      const galleryRes = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(galleryRes.body.gallery.length).toBe(1);
    });

    it('hide raeumt hidden_by/hidden_at, unhide setzt sie wieder zurueck auf NULL', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'approved' });

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide' });

      let row = (await db.query('SELECT hidden_by, hidden_at FROM challenge_submissions WHERE id = $1', [submission.id])).rows[0];
      expect(row.hidden_by).toBe(USERS.admin1.id);
      expect(row.hidden_at).not.toBeNull();

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'unhide' });

      row = (await db.query('SELECT hidden_by, hidden_at FROM challenge_submissions WHERE id = $1', [submission.id])).rows[0];
      expect(row.hidden_by).toBeNull();
      expect(row.hidden_at).toBeNull();
    });

    it('Ungueltige Moderations-Aktion -> 400', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({ challenge_id: challenge.id, user_id: USERS.konfi1.id });

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'bogus' });
      expect(res.status).toBe(400);
    });

    it('Sammelansicht (GET /admin/:id/submissions) markiert is_public/is_anonymous korrekt', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const anon = await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id,
        konfi_consent: 'anonymous', moderation_status: 'approved',
      });
      const priv = await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi2.id,
        konfi_consent: 'private', moderation_status: 'approved',
      });

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);

      const anonRow = res.body.submissions.find(s => s.id === anon.id);
      const privRow = res.body.submissions.find(s => s.id === priv.id);
      expect(anonRow.is_public).toBe(true);
      expect(anonRow.is_anonymous).toBe(true);
      // Leitung sieht den echten Namen trotzdem (Anonymitaet gilt nur gegenueber der Gruppe)
      expect(anonRow.display_name).toBe(USERS.konfi1.display_name);
      expect(privRow.is_public).toBe(false);
      expect(privRow.is_anonymous).toBe(false);
    });
  });

  // ================================================================
  // Datei-Auslieferung GET /files/:filename — Zugriff der Leitung
  // ================================================================
  describe('Datei-Auslieferung (GET /files/:filename)', () => {
    it('Admin der Org kann eine Submission-Datei laden -> 200', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const filename = 'a'.repeat(64);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'pending',
      });

      // Echte (verschluesselte) Datei auf der Platte ablegen, damit der
      // Endpoint bis zum Ende durchlaeuft (Access-Check UND Datei-Lesen).
      const { encryptBuffer } = require('../../utils/photoCrypto');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const dir = path.join(os.tmpdir(), 'konfi-test-uploads', 'challenges');
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, filename), encryptBuffer(PNG));

      const res = await request(app)
        .get(`/api/challenges/files/${filename}`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);

      await fs.promises.rm(path.join(dir, filename), { force: true });
    });

    it('Teamer mit zugewiesenem Jahrgang kann eine Submission-Datei laden -> 200', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const filename = 'b'.repeat(64);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'pending',
      });

      const { encryptBuffer } = require('../../utils/photoCrypto');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const dir = path.join(os.tmpdir(), 'konfi-test-uploads', 'challenges');
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, filename), encryptBuffer(PNG));

      const res = await request(app)
        .get(`/api/challenges/files/${filename}`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(200);

      await fs.promises.rm(path.join(dir, filename), { force: true });
    });

    it('Teamer OHNE zugewiesenen Jahrgang der Challenge bekommt 403 (NICHT 401)', async () => {
      // teamer1 ist laut Seed nur jahrgang1 zugewiesen -> jahrgang2 nutzen
      const challenge = await createChallenge({ visibility: 'private', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang2.id);
      const filename = 'e'.repeat(64);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi2.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'pending',
      });

      const res = await request(app)
        .get(`/api/challenges/files/${filename}`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(403);
    });

    it('Konfi-Eigentuemer kann die eigene Datei laden -> 200', async () => {
      const challenge = await createChallenge({ visibility: 'private', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const filename = 'c'.repeat(64);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'pending',
      });

      const { encryptBuffer } = require('../../utils/photoCrypto');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const dir = path.join(os.tmpdir(), 'konfi-test-uploads', 'challenges');
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, filename), encryptBuffer(PNG));

      const res = await request(app)
        .get(`/api/challenges/files/${filename}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);

      await fs.promises.rm(path.join(dir, filename), { force: true });
    });

    it('Fremde Org bekommt 404, NICHT 401 (kein Leak ob die Datei existiert)', async () => {
      const challenge = await createChallenge({ visibility: 'konfi_choice', moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const filename = 'f'.repeat(64);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'approved',
      });

      const res = await request(app)
        .get(`/api/challenges/files/${filename}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/challenges/files/' + 'a'.repeat(64));
      expect(res.status).toBe(401);
    });

    it('Multi-Org: Admin aktiv auf Sekundaer-Org umgeschaltet kann eine Datei dieser Org laden -> 200 (vorher faelschlich 404 gegen die Primaer-Org)', async () => {
      // admin1 zusaetzlich als Mitglied der zweiten Org eintragen (Org-Switcher).
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [USERS.admin1.id, ORGS.andereGemeinde.id, USERS.admin2.role_id]
      );

      const challenge = await createChallenge({
        organization_id: ORGS.andereGemeinde.id,
        visibility: 'konfi_choice',
        moderated: true,
        created_by: USERS.admin2.id,
      });
      const filename = 'd'.repeat(64);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi3.id,
        organization_id: ORGS.andereGemeinde.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'pending',
      });

      const { encryptBuffer } = require('../../utils/photoCrypto');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const dir = path.join(os.tmpdir(), 'konfi-test-uploads', 'challenges');
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, filename), encryptBuffer(PNG));

      const res = await request(app)
        .get(`/api/challenges/files/${filename}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .set('X-Active-Organization', String(ORGS.andereGemeinde.id));
      expect(res.status).toBe(200);

      await fs.promises.rm(path.join(dir, filename), { force: true });
    });
  });

  // ================================================================
  // Teilnahme-Kreis (audience, Migration 121)
  //
  // Kern der Entscheidung vom 08.08.2026: Das Team darf mitmachen, nicht nur
  // moderieren. audience regelt WER einreicht (visibility bleibt: wer SIEHT).
  // ================================================================
  describe('Teilnahme-Kreis (audience)', () => {
    it("audience='konfis': Teamer darf NICHT einreichen -> 403", async () => {
      const challenge = await createChallenge({ audience: 'konfis' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ media_type: 'text', text_content: 'Teamer-Beitrag' });
      expect(res.status).toBe(403);
    });

    it("audience='konfis_und_team': Teamer UND Konfi duerfen einreichen", async () => {
      const challenge = await createChallenge({ audience: 'konfis_und_team' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const teamerRes = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ media_type: 'text', text_content: 'Teamer-Beitrag' });
      expect(teamerRes.status).toBe(201);

      const konfiRes = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Konfi-Beitrag' });
      expect(konfiRes.status).toBe(201);
    });

    it("audience='nur_team': Konfi sieht die Challenge NICHT (Detail -> 404, Liste leer)", async () => {
      const challenge = await createChallenge({ audience: 'nur_team' });

      const detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(detail.status).toBe(404);

      const list = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(list.status).toBe(200);
      expect(list.body.active.map((c) => c.id)).not.toContain(challenge.id);
    });

    it("audience='nur_team': Konfi kann NICHT einreichen -> 403", async () => {
      const challenge = await createChallenge({ audience: 'nur_team' });

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Konfi will mitmachen' });
      expect(res.status).toBe(403);
    });

    it("audience='nur_team' ist ORG-WEIT: Teamer OHNE Jahrgangs-Zuordnung darf einreichen", async () => {
      // Bewusst KEIN assignJahrgang — 'nur_team' läuft über die Rolle.
      const challenge = await createChallenge({ audience: 'nur_team' });

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ media_type: 'text', text_content: 'Team-Runde' });
      expect(res.status).toBe(201);

      const list = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(list.body.active.map((c) => c.id)).toContain(challenge.id);
    });

    it("audience='nur_team': Org-Isolation haelt (Teamer einer FREMDEN Org -> 403)", async () => {
      const challenge = await createChallenge({ audience: 'nur_team' });

      const res = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${teamer2Token}`)
        .send({ media_type: 'text', text_content: 'Fremde Org' });
      expect([403, 404]).toContain(res.status);
    });

    it('audience nach Start aendern -> 409 (Konsens-Integritaet wie visibility)', async () => {
      const challenge = await createChallenge({ audience: 'konfis' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ audience: 'konfis_und_team' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Teilnahme-Kreis/);
    });

    it("Wechsel auf 'nur_team' vor dem Start raeumt Jahrgangs-Zuordnungen ab", async () => {
      const challenge = await createChallenge({
        audience: 'konfis',
        is_draft: true,
        starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/challenges/admin/${challenge.id}`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ audience: 'nur_team' });
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT 1 FROM challenge_jahrgang_assignments WHERE challenge_id = $1',
        [challenge.id]
      );
      expect(rows).toHaveLength(0);
    });

    it('Galerie liefert Rolle und Jahrgang des Verfassers (Herkunft transparent)', async () => {
      const challenge = await createChallenge({
        audience: 'konfis_und_team',
        visibility: 'public',
        moderated: false,
      });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.teamer1.id,
        moderation_status: 'approved',
      });

      const res = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.gallery).toHaveLength(1);
      expect(res.body.gallery[0].role_name).toBe('teamer');
      expect(res.body.gallery[0].display_name).toBeTruthy();
    });

    it('Anonyme Beitraege liefern WEDER Name NOCH Rolle/Jahrgang', async () => {
      const { challenge } = await setupChallengeWithForeignSubmission(
        { audience: 'konfis_und_team', visibility: 'konfi_choice' },
        { konfi_consent: 'anonymous', moderation_status: 'approved' }
      );

      const res = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.body.gallery[0].display_name).toBeNull();
      expect(res.body.gallery[0].role_name).toBeNull();
      expect(res.body.gallery[0].jahrgang_name).toBeNull();
      expect(res.body.gallery[0].is_anonymous).toBe(true);
    });
  });

  // ================================================================
  // Nachtraegliche Anonymisierung durch die Leitung (User-Wunsch 08.08.2026)
  // ================================================================
  describe('Moderation: anonymize / deanonymize', () => {
    it('anonymize setzt konfi_consent auf anonymous -> Galerie zeigt keinen Namen', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'publish', moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'anonymize' });
      expect(res.status).toBe(200);
      expect(res.body.konfi_consent).toBe('anonymous');

      const detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(detail.body.gallery[0].display_name).toBeNull();
    });

    it('Anonymitaet ist eine EINBAHNSTRASSE: deanonymize gibt es nicht -> 400', async () => {
      const { submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'anonymous', moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'deanonymize' });
      expect(res.status).toBe(400);
    });

    it('Bereits anonymer Beitrag laesst sich nicht erneut umstellen -> 409', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'anonymous', moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'anonymize' });
      expect(res.status).toBe(409);

      // Und er bleibt in der Galerie ohne Namen.
      const detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(detail.body.gallery[0].display_name).toBeNull();
    });

    it("consent='private' laesst sich NICHT aufweichen -> 409 (staerkste Zusage des Konfi)", async () => {
      const { submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'private', moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'anonymize' });
      expect(res.status).toBe(409);
    });

    it('anonymize bei visibility=public -> 200, Galerie zeigt keinen Namen mehr (User-Entscheid 24.08.2026)', async () => {
      // Frueher 409 ("dort gibt es keinen Konsens") — seitdem die Leitung
      // Beitraege ueberall nachtraeglich anonymisieren kann, gilt der Konsens
      // 'anonymous' auch bei public-Challenges und blendet den Namen aus.
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'anonymize' });
      expect(res.status).toBe(200);
      expect(res.body.konfi_consent).toBe('anonymous');

      // Beitrag bleibt in der Galerie sichtbar (public), aber ohne Namen.
      const detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(detail.body.gallery).toHaveLength(1);
      expect(detail.body.gallery[0].display_name).toBeNull();
      expect(detail.body.gallery[0].is_anonymous).toBe(true);
    });

    it('anonymize bei public wirkt auch im Export (Name wird zu "Anonym")', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved', text_content: 'Exporttext ohne Namen' }
      );

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'anonymize' });

      const res = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Anonym');
      expect(res.text).not.toContain(USERS.konfi2.display_name);
    });

    it('anonymize aendert den Freigabe-Status NICHT', async () => {
      const { submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'publish', moderation_status: 'pending' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'anonymize' });
      expect(res.status).toBe(200);
      expect(res.body.moderation_status).toBe('pending');
    });

    it('Konfi darf nicht anonymisieren -> 403', async () => {
      const { submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'konfi_choice' },
        { konfi_consent: 'publish', moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ action: 'anonymize' });
      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // Abzeichen erst nach Freigabe (User-Entscheid 24.08.2026):
  // Bei moderierten Challenges zaehlt NUR ein approved-Beitrag als Abzeichen;
  // ohne Moderation sofort (der Beitrag wird direkt approved gespeichert).
  // Die Regel gilt fuer ALLE Rollen gleich, auch fuer die Leitung
  // ("Gleiche Regel fuer alle").
  // ================================================================
  describe('Abzeichen erst nach Freigabe', () => {
    it('moderiert + pending -> KEIN Abzeichen, aber has_submission bleibt true', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'pending'
      });

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      const c = res.body.active.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(false);
      // "Schon eingereicht" haengt NICHT an der Freigabe.
      expect(c.has_submission).toBe(true);
      expect(c.own_submission_count).toBe(1);
      expect(res.body.marks.some(m => m.challenge_id === challenge.id)).toBe(false);
    });

    it('moderiert + approved -> Abzeichen da (Liste UND marks)', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'approved'
      });

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);
      const c = res.body.active.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(true);
      const mark = res.body.marks.find(m => m.challenge_id === challenge.id);
      expect(mark).toBeDefined();
      expect(mark.badge_name).toBe(challenge.badge_name);
    });

    it('nicht moderiert -> Einreichung per API ist sofort approved, Abzeichen sofort da', async () => {
      const challenge = await createChallenge({ moderated: false, visibility: 'public' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);

      // Belegt die Annahme (nicht nur vermutet): ohne Moderation speichert die
      // Route direkt approved.
      const sub = await request(app)
        .post(`/api/challenges/konfi/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ media_type: 'text', text_content: 'Sofort frei' });
      expect(sub.status).toBe(201);
      expect(sub.body.moderation_status).toBe('approved');

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      const c = res.body.active.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(true);
      expect(res.body.marks.some(m => m.challenge_id === challenge.id)).toBe(true);
    });

    it('Freigabe ueber die API macht das Abzeichen sichtbar (pending -> approve)', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'pending'
      });

      const mod = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'approve' });
      expect(mod.status).toBe(200);

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      const c = res.body.active.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(true);
    });

    it('hidden -> kein Abzeichen (auch wenn der Beitrag frueher freigegeben war)', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'hidden'
      });

      const res = await request(app)
        .get('/api/challenges/konfi')
        .set('Authorization', `Bearer ${konfi1Token}`);
      const c = res.body.active.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(false);
      expect(res.body.marks.some(m => m.challenge_id === challenge.id)).toBe(false);
    });

    it('Detail (GET /konfi/:id): has_badge false bei pending, true nach Freigabe', async () => {
      const challenge = await createChallenge({ moderated: true });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id, user_id: USERS.konfi1.id, moderation_status: 'pending'
      });

      let detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(detail.status).toBe(200);
      expect(detail.body.challenge.has_badge).toBe(false);
      expect(detail.body.challenge.has_submission).toBe(true);

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'approve' });

      detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(detail.body.challenge.has_badge).toBe(true);
    });

    it('GLEICHE Regel fuer die Leitung: eigener pending-Beitrag zaehlt in GET /admin nicht als Abzeichen', async () => {
      // User-Entscheid 24.08.2026 ("Gleiche Regel fuer alle"): Auch wer selbst
      // freigeben koennte, bekommt das Abzeichen erst nach der Freigabe.
      const challenge = await createChallenge({ moderated: true, audience: 'konfis_und_team' });
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id, user_id: USERS.admin1.id, moderation_status: 'pending'
      });

      let res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);
      let c = res.body.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(false);
      expect(c.own_submission_count).toBe(1);

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'approve' });

      res = await request(app)
        .get('/api/challenges/admin')
        .set('Authorization', `Bearer ${admin1Token}`);
      c = res.body.find(x => x.id === challenge.id);
      expect(c.has_badge).toBe(true);
    });
  });

  // ================================================================
  // Begruendung beim Ausblenden (moderation_note, Migration 126)
  // ================================================================
  describe('Begruendung beim Ausblenden (moderation_note)', () => {
    it('hide mit reason speichert die Begruendung; die einreichende Person sieht sie bei ihren Beitraegen', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide', reason: 'Bitte ohne Nachnamen einreichen.' });
      expect(res.status).toBe(200);
      expect(res.body.moderation_status).toBe('hidden');
      expect(res.body.moderation_note).toBe('Bitte ohne Nachnamen einreichen.');

      // Die einreichende Person (konfi2) sieht die Begruendung an ihrem Beitrag.
      const detail = await request(app)
        .get(`/api/challenges/konfi/${challenge.id}`)
        .set('Authorization', `Bearer ${konfi2Token}`);
      expect(detail.status).toBe(200);
      expect(detail.body.own_submissions).toHaveLength(1);
      expect(detail.body.own_submissions[0].moderation_status).toBe('hidden');
      expect(detail.body.own_submissions[0].moderation_note).toBe('Bitte ohne Nachnamen einreichen.');
    });

    it('hide OHNE reason funktioniert genauso -> moderation_note bleibt NULL (Begruendung ist optional)', async () => {
      const { submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(200);
      expect(res.body.moderation_status).toBe('hidden');
      expect(res.body.moderation_note).toBeNull();
    });

    it('unhide raeumt die Begruendung ab (sie gehoert zum hidden-Zustand)', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved' }
      );

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide', reason: 'Kurz geprueft.' });

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'unhide' });
      expect(res.status).toBe(200);
      expect(res.body.moderation_status).toBe('approved');
      expect(res.body.moderation_note).toBeNull();

      // Auch in der Sammelansicht der Leitung ist die Notiz weg.
      const list = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(list.body.submissions[0].moderation_note).toBeNull();
    });

    it('Sammelansicht der Leitung liefert moderation_note mit', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved' }
      );

      await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide', reason: 'Passt nicht zur Aufgabe.' });

      const list = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(list.status).toBe(200);
      expect(list.body.submissions[0].moderation_note).toBe('Passt nicht zur Aufgabe.');
    });

    it('reason laenger als 500 Zeichen -> 400, Beitrag bleibt sichtbar', async () => {
      const { challenge, submission } = await setupChallengeWithForeignSubmission(
        { visibility: 'public' },
        { moderation_status: 'approved' }
      );

      const res = await request(app)
        .put(`/api/challenges/admin/submissions/${submission.id}/moderate`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ action: 'hide', reason: 'x'.repeat(501) });
      expect(res.status).toBe(400);

      const list = await request(app)
        .get(`/api/challenges/admin/${challenge.id}/submissions`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(list.body.submissions[0].moderation_status).toBe('approved');
    });
  });

  // ================================================================
  // DELETE /admin/submissions/:id — einzelnen Beitrag endgueltig loeschen
  // (Datei UND Datenbank-Zeile; Nutzerwunsch 26.08.2026, Befund M8)
  // ================================================================
  describe('DELETE /admin/submissions/:id (endgueltig, mit Datei)', () => {
    const fs = require('fs');
    const path = require('path');
    // deleteChallengeFile loescht in photoStorage.CHALLENGES_DIR
    // (backend/uploads/challenges) — dort muss die Testdatei liegen.
    const { CHALLENGES_DIR } = require('../../utils/photoStorage');

    async function setupWithFile(filename) {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        media_type: 'photo',
        text_content: null,
        file_path: filename,
        file_name: 'test.png',
        moderation_status: 'approved',
      });
      await fs.promises.mkdir(CHALLENGES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(CHALLENGES_DIR, filename), PNG);
      return { challenge, submission };
    }

    it('Leitung loescht Beitrag -> 200, DB-Zeile weg UND Datei weg', async () => {
      const filename = 'f'.repeat(64);
      const { submission } = await setupWithFile(filename);

      const res = await request(app)
        .delete(`/api/challenges/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(0);
      expect(fs.existsSync(path.join(CHALLENGES_DIR, filename))).toBe(false);
    });

    it('Fehlende Datei kippt nichts: Beitrag ohne existierende Datei -> 200, Zeile weg', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        media_type: 'photo',
        text_content: null,
        file_path: '0'.repeat(64), // Datei liegt NICHT auf der Platte
        file_name: 'weg.png',
        moderation_status: 'approved',
      });

      const res = await request(app)
        .delete(`/api/challenges/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(0);
    });

    it('Teamer mit zugewiesenem Jahrgang darf loeschen -> 200', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        moderation_status: 'pending',
      });

      const res = await request(app)
        .delete(`/api/challenges/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(0);
    });

    it('Verbotener Fall: Konfi bekommt 403, Zeile und Datei bleiben', async () => {
      const filename = 'd'.repeat(64);
      const { submission } = await setupWithFile(filename);

      const res = await request(app)
        .delete(`/api/challenges/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(403);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(1);
      expect(fs.existsSync(path.join(CHALLENGES_DIR, filename))).toBe(true);

      await fs.promises.rm(path.join(CHALLENGES_DIR, filename), { force: true });
    });

    it('Leitung einer ANDEREN Org bekommt 404, Zeile bleibt', async () => {
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang1.id);
      const submission = await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi1.id,
        moderation_status: 'approved',
      });

      const res = await request(app)
        .delete(`/api/challenges/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(1);
    });

    it('Teamer OHNE zugewiesenen Jahrgang der Challenge bekommt 403', async () => {
      // teamer1 ist laut Seed nur jahrgang1 zugewiesen -> jahrgang2 nutzen
      const challenge = await createChallenge();
      await assignJahrgang(challenge.id, JAHRGAENGE.jahrgang2.id);
      const submission = await createSubmission({
        challenge_id: challenge.id,
        user_id: USERS.konfi2.id,
        moderation_status: 'approved',
      });

      const res = await request(app)
        .delete(`/api/challenges/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(403);

      const { rows } = await db.query('SELECT 1 FROM challenge_submissions WHERE id = $1', [submission.id]);
      expect(rows.length).toBe(1);
    });
  });
});
