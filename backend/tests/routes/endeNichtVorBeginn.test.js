// Ein Termin, dessen Ende vor dem Beginn liegt (Audit 26.09.2026, Leitung BF-03)
//
// DER BEFUND: Weder Formular noch Backend verglichen Ende und Beginn. Wer
// beim Ende versehentlich einen frueheren Tag waehlte, speicherte ohne
// Warnung. Die Leitungsliste rechnet mit dem Ende und sortierte den Termin
// sofort unter "Vergangen", die Konfis sahen ihn als vorbei -- waehrend der
// Anmeldeschluss vom Beginn aus rechnet und der Termin zugleich "offen" wirkte.
//
// DIE REGEL (validierung.js, pruefeEndeNachBeginn), fuer POST /, PUT /:id und
// POST /series gleich:
//   VERBOTEN:  Ende vor Beginn -> 400, error_code 'ende_vor_beginn', nichts
//              gespeichert
//   ERLAUBT:   Ende nach Beginn, Ende GLEICH Beginn, gar kein Ende
//
// DAZU DIE SERIE: Sie uebertrug bis zum 28.09.2026 nur die UHRZEIT des Endes
// auf den Tag jedes Serientermins. Ein erster Termin, der an einem spaeteren
// Tag endet (Wochenende, Nacht ueber Mitternacht), ergab damit Serientermine,
// die vor ihrem Beginn endeten -- vom Server selbst erzeugt. Jetzt erbt jeder
// Termin die DAUER des ersten.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Das Ende eines Termins liegt nicht vor seinem Beginn', () => {
  let app;
  let db;
  let adminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('orgAdmin1');
  });

  const STUNDE = 60 * 60 * 1000;
  // Fester Beginn in einer Woche, auf die volle Stunde -- keine Abhaengigkeit
  // von der Uhrzeit des Testlaufs.
  const beginn = new Date(Math.ceil((Date.now() + 7 * 24 * STUNDE) / STUNDE) * STUNDE);
  const um = (stundenNachBeginn) => new Date(beginn.getTime() + stundenNachBeginn * STUNDE).toISOString();

  const grundtermin = {
    name: 'Konfistunde',
    description: 'Ende und Beginn',
    location: 'Gemeindehaus',
    points: 1,
    point_type: 'gemeinde',
    type: 'event',
    max_participants: 10,
    category_ids: [],
    jahrgang_ids: [],
    event_date: beginn.toISOString(),
  };

  const anlegen = (daten) => request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...grundtermin, ...daten });

  const anzahl = async (muster) => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM events WHERE name LIKE $1', [muster]
    );
    return r.n;
  };

  // ------------------------------------------------------------------
  // POST /api/events
  // ------------------------------------------------------------------
  describe('Anlegen', () => {
    it('VERBOTEN: Ende einen Tag vor dem Beginn — 400 mit error_code, nichts angelegt', async () => {
      const res = await anlegen({ name: 'Ende gestern', event_end_time: um(-24) });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Das Ende liegt vor dem Beginn',
        error_code: 'ende_vor_beginn'
      });
      expect(await anzahl('Ende gestern')).toBe(0);
    });

    it('VERBOTEN: auch eine Minute zu frueh', async () => {
      const res = await anlegen({
        name: 'Eine Minute',
        event_end_time: new Date(beginn.getTime() - 60 * 1000).toISOString()
      });
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('ende_vor_beginn');
    });

    it('ERLAUBT: Ende zwei Stunden nach dem Beginn', async () => {
      const res = await anlegen({ name: 'Normal', event_end_time: um(2) });
      expect(res.status).toBe(201);
      expect(await anzahl('Normal')).toBe(1);
    });

    it('ERLAUBT: Ende genau auf dem Beginn', async () => {
      const res = await anlegen({ name: 'Ohne Dauer', event_end_time: um(0) });
      expect(res.status).toBe(201);
    });

    it('ERLAUBT: gar kein Ende', async () => {
      const res = await anlegen({ name: 'Ohne Ende', event_end_time: null });
      expect(res.status).toBe(201);
      const { rows: [e] } = await db.query('SELECT event_end_time FROM events WHERE id = $1', [res.body.id]);
      expect(e.event_end_time).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/events/:id
  // ------------------------------------------------------------------
  describe('Bearbeiten', () => {
    it('VERBOTEN: das Ende nachtraeglich vor den Beginn legen — 400, alter Stand bleibt', async () => {
      const angelegt = await anlegen({ name: 'Bestand', event_end_time: um(2) });
      expect(angelegt.status).toBe(201);

      const res = await request(app)
        .put(`/api/events/${angelegt.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...grundtermin, name: 'Bestand', event_end_time: um(-3) });

      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('ende_vor_beginn');

      const { rows: [e] } = await db.query('SELECT event_end_time FROM events WHERE id = $1', [angelegt.body.id]);
      expect(new Date(e.event_end_time).toISOString()).toBe(um(2));
    });

    it('VERBOTEN: den Beginn hinter das Ende schieben', async () => {
      const angelegt = await anlegen({ name: 'Verschoben', event_end_time: um(2) });

      const res = await request(app)
        .put(`/api/events/${angelegt.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...grundtermin, name: 'Verschoben', event_date: um(5), event_end_time: um(2) });

      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('ende_vor_beginn');
    });

    it('ERLAUBT: Ende spaeter setzen', async () => {
      const angelegt = await anlegen({ name: 'Laenger', event_end_time: um(2) });

      const res = await request(app)
        .put(`/api/events/${angelegt.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...grundtermin, name: 'Laenger', event_end_time: um(3) });

      expect(res.status).toBe(200);
      const { rows: [e] } = await db.query('SELECT event_end_time FROM events WHERE id = $1', [angelegt.body.id]);
      expect(new Date(e.event_end_time).toISOString()).toBe(um(3));
    });
  });

  // ------------------------------------------------------------------
  // POST /api/events/series
  // ------------------------------------------------------------------
  describe('Serie', () => {
    const serie = (daten) => request(app)
      .post('/api/events/series')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...grundtermin, series_count: 3, series_interval: 'week', ...daten });

    it('VERBOTEN: Ende vor dem Beginn — 400, keine Serie angelegt', async () => {
      const res = await serie({ name: 'Serie rueckwaerts', event_end_time: um(-1) });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Das Ende liegt vor dem Beginn',
        error_code: 'ende_vor_beginn'
      });
      expect(await anzahl('Serie rueckwaerts%')).toBe(0);
    });

    it('ERLAUBT: Ende am selben Tag — jeder Termin dauert zwei Stunden', async () => {
      const res = await serie({ name: 'Abendserie', event_end_time: um(2) });
      expect(res.status).toBe(201);

      const { rows } = await db.query(
        "SELECT event_date, event_end_time FROM events WHERE name LIKE 'Abendserie #%' ORDER BY event_date"
      );
      expect(rows.length).toBe(3);
      for (const r of rows) {
        expect(new Date(r.event_end_time) - new Date(r.event_date)).toBe(2 * STUNDE);
      }
    });

    it('ERLAUBT: erster Termin endet am Folgetag — JEDER Termin endet nach seinem Beginn, mit derselben Dauer', async () => {
      // Freitag bis Samstag, 26 Stunden. Vorher bekam jeder Serientermin nur
      // die Uhrzeit des Endes auf seinen eigenen Tag gesetzt: 26 Stunden
      // wurden zu 2 -- oder, bei einem Beginn am spaeten Abend, zu einem Ende
      // VOR dem Beginn.
      const res = await serie({ name: 'Wochenendserie', event_end_time: um(26) });
      expect(res.status).toBe(201);

      const { rows } = await db.query(
        "SELECT event_date, event_end_time FROM events WHERE name LIKE 'Wochenendserie #%' ORDER BY event_date"
      );
      expect(rows.length).toBe(3);
      for (const r of rows) {
        expect(new Date(r.event_end_time) - new Date(r.event_date)).toBe(26 * STUNDE);
      }
    });

    it('ERLAUBT: Serie ohne Ende bleibt ohne Ende', async () => {
      const res = await serie({ name: 'Offene Serie', event_end_time: null });
      expect(res.status).toBe(201);

      const { rows } = await db.query(
        "SELECT event_end_time FROM events WHERE name LIKE 'Offene Serie #%'"
      );
      expect(rows.length).toBe(3);
      expect(rows.every((r) => r.event_end_time === null)).toBe(true);
    });
  });
});
