// Freigabe der Datenbank-Verbindung in der Anwesenheits-Route.
//
// Schwesterdatei zu verbindungFreigabe.test.js (dort: chat.js, Raum loeschen).
// Gleicher Fehler, andere Route: In
// PUT /events/:id/participants/:participantId/attendance stand
// `client.release()` im try hinter dem COMMIT, danach liefen noch Badge-Check,
// Push, Live-Updates und `res.json(responseData)`. Wirft davon etwas -- und
// `liveUpdate.sendToUser` ist synchron und war NICHT einzeln abgesichert --,
// fing der Transaktions-catch den Fehler und schickte ein ROLLBACK auf einen
// Client, den der Pool laengst an einen ANDEREN Request weitergereicht hatte.
// Auf der physischen Verbindung stand dann:
// BEGIN | COMMIT | BEGIN | INSERT B | ROLLBACK -- der verspaetete ROLLBACK von
// A brach die Transaktion von B ab. Zusaetzlich reichte das zweite release()
// im catch den Client eines Fremden weiter; der Doppel-Release-Schutz von
// pg-pool greift dabei nicht, weil `release` bei jedem Checkout neu zugewiesen
// wird.
//
// Messbar gemacht mit einem Pool auf max: 1 -- beide Requests bekommen
// zwangslaeufig DIESELBE physische Verbindung -- und einem db-Wrapper, der
// jede Anweisung pro Verbindung protokolliert.
const request = require('supertest');
const { Pool } = require('pg');
const os = require('os');
const path = require('path');
const { createApp } = require('../../createApp');
const { truncateAll } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const liveUpdate = require('../../utils/liveUpdate');

require('pg').types.setTypeParser(20, (val) => parseInt(val, 10));

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

describe('Verbindungsfreigabe Anwesenheit: client.release() steht im finally', () => {
  let pool;            // echter Pool mit max: 1
  let db;              // Wrapper wie backend/database.js
  let verlauf;         // [{ verbindung, sql }]
  let hilfsPool;       // zweiter Pool fuer Aufbau/Pruefen (blockiert max:1 nicht)
  let eventId;
  let bookingId;

  const verbindungsNummern = new WeakMap();
  let naechsteNummer = 1;
  const nummerFuer = (client) => {
    const roh = client.connection || client;
    if (!verbindungsNummern.has(roh)) verbindungsNummern.set(roh, naechsteNummer++);
    return verbindungsNummern.get(roh);
  };

  const protokollieren = (client) => {
    if (client.__protokolliert) return client;
    client.__protokolliert = true;
    const echtesQuery = client.query.bind(client);
    // ALLE Argumente durchreichen: pg ruft query auch mit Callback auf
    // (z.B. beim Zurueckgeben an den Pool). Schluckt der Wrapper den
    // Callback, haengt der Pool beim naechsten Checkout.
    client.query = (...args) => {
      const text = args[0];
      const sql = typeof text === 'string' ? text : (text && text.text) || '';
      verlauf.push({ verbindung: nummerFuer(client), sql: sql.trim().split('\n')[0].slice(0, 60) });
      return echtesQuery(...args);
    };
    return client;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 1, options: '-c timezone=Europe/Berlin' });
    hilfsPool = new Pool({ connectionString: TEST_DB_URL, max: 2, options: '-c timezone=Europe/Berlin' });
    db = {
      query: (text, params) => pool.query(text, params),
      getClient: async () => protokollieren(await pool.connect()),
      end: () => pool.end(),
    };
  });

  afterAll(async () => {
    liveUpdate._reset();
    await pool.end();
    await hilfsPool.end();
  });

  beforeEach(async () => {
    verlauf = [];
    const hilfsDb = {
      query: (t, p) => hilfsPool.query(t, p),
      getClient: () => hilfsPool.connect(),
    };
    if (pool.idleCount !== pool.totalCount) {
      throw new Error(`Pool nicht frei: total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
    }
    await truncateAll(hilfsDb);
    await seed(hilfsDb);

    // admin1 braucht den Jahrgang von konfi1, sonst greift die Jahrgangs-Bindung.
    await hilfsPool.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

    // Freiwilliger Termin MIT Punkten und konfi1 als bestaetigte Buchung:
    // Nur dann laeuft die Route in den Zweig, der Punkte vergibt und
    // anschliessend das synchrone liveUpdate.sendToUser ruft.
    const zukunft = new Date();
    zukunft.setDate(zukunft.getDate() + 14);
    const { rows: [event] } = await hilfsPool.query(
      `INSERT INTO events (name, event_date, max_participants, points, point_type, mandatory, organization_id, created_by)
       VALUES ('Freigabe-Termin', $1, 10, 5, 'gemeinde', false, $2, $3) RETURNING id`,
      [zukunft.toISOString(), USERS.admin1.org_id, USERS.admin1.id]
    );
    eventId = event.id;
    await hilfsPool.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [eventId, JAHRGAENGE.jahrgang1.id]
    );
    const { rows: [buchung] } = await hilfsPool.query(
      `INSERT INTO event_bookings (event_id, user_id, status, booking_date)
       VALUES ($1, $2, 'confirmed', NOW()) RETURNING id`,
      [eventId, USERS.konfi1.id]
    );
    bookingId = buchung.id;
  });

  // App mit io-Stub. `wirftBei` bekommt den Raumnamen und entscheidet, ob der
  // Versand wirft; `vorDemWurf` wird davor gerufen (Signal fuer Request B).
  const appMit = ({ wirftBei = () => false, vorDemWurf = null } = {}) => {
    const io = {
      to: (raum) => ({
        emit: () => {
          if (!wirftBei(raum)) return;
          if (vorDemWurf) vorDemWurf();
          throw new Error('Socket kaputt');
        },
      }),
      emit: () => {},
      in: () => ({ emit: () => {} }),
    };
    // Die Termin-Routen rufen liveUpdate als Modul-Singleton, nicht ueber die
    // io-Option von createApp (die erreicht nur chat/activities/users).
    // Der Pool wird mitgegeben, sonst laedt liveUpdate das database-Singleton
    // gegen die Produktions-Adresse nach (siehe Kommentar in liveUpdate.init).
    liveUpdate.init(io, { query: (t, p) => hilfsPool.query(t, p) });
    return createApp(db, {
      uploadsDir: path.join(os.tmpdir(), 'konfi-test-uploads'),
      io,
    });
  };

  // Zweiter Request: schreibt in einer eigenen Transaktion auf DERSELBEN
  // physischen Verbindung (max: 1) eine Chat-Nachricht und committet.
  const zweiterRequestSchreibt = async () => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
         VALUES ($1, $2, 'konfi', 'text', 'Nachricht von B', NOW())`,
        [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  };

  const anzahlNachrichtenVonB = async () => {
    const { rows } = await hilfsPool.query(
      "SELECT COUNT(*)::int AS anzahl FROM chat_messages WHERE content = 'Nachricht von B'"
    );
    return rows[0].anzahl;
  };

  const anzahlPunkteZeilen = async () => {
    const { rows } = await hilfsPool.query(
      'SELECT COUNT(*)::int AS anzahl FROM event_points WHERE konfi_id = $1 AND event_id = $2',
      [USERS.konfi1.id, eventId]
    );
    return rows[0].anzahl;
  };

  const verlaufDerVerbindung = (nummer) =>
    verlauf.filter(e => e.verbindung === nummer).map(e => e.sql);

  const anwesendVerbuchen = (app) => request(app)
    .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
    .set('Authorization', `Bearer ${generateToken('admin1')}`)
    .send({ attendance_status: 'present' });

  it('verbotener Fall: wirft das Live-Update nach dem COMMIT, bleibt die Transaktion des naechsten Requests unversehrt', async () => {
    // Der zweite Request muss SCHON auf den Client warten, wenn A ihn
    // zurueckgibt. Nur dann liegt er mit seinem BEGIN VOR dem verspaeteten
    // ROLLBACK von A -- genau der gemessene Verlauf
    // BEGIN | COMMIT | BEGIN | INSERT B | ROLLBACK.
    // Das Signal setzt der io-Stub: Das synchrone
    // liveUpdate.sendToUser('konfi', ...) in der Nacharbeit ist die einzige
    // Stelle dort ohne eigenes try/catch — sein Wurf erreicht also den
    // Transaktions-catch.
    let bGestartet = null;
    const app = appMit({
      wirftBei: (raum) => raum === `user_konfi_${USERS.konfi1.id}`,
      vorDemWurf: () => { if (!bGestartet) bGestartet = zweiterRequestSchreibt(); },
    });

    const antwort = await anwesendVerbuchen(app);

    // Die Antwortform bleibt unveraendert: 200 mit denselben Feldern.
    expect(antwort.status).toBe(200);
    expect(antwort.body).toEqual({
      message: 'Anwesenheit aktualisiert und 5 gemeinde-Punkte vergeben',
      points_awarded: true,
    });

    // Das Live-Update hat geworfen — B ist also wirklich angestossen worden.
    expect(bGestartet).not.toBeNull();
    await bGestartet;

    // Es gibt genau eine physische Verbindung (max: 1).
    const verbindungen = new Set(verlauf.map(e => e.verbindung));
    expect(verbindungen.size).toBe(1);

    const anweisungen = verlaufDerVerbindung([...verbindungen][0]);
    const begins = anweisungen.map((sql, i) => ({ sql, i })).filter(e => e.sql === 'BEGIN');
    // Zwei Transaktionen: die Anwesenheits-Verbuchung und die von B.
    expect(begins.length).toBe(2);

    // Nach dem BEGIN von B darf KEIN ROLLBACK mehr kommen — auch nicht der
    // verspaetete von A.
    const nachBeginVonB = anweisungen.slice(begins[1].i);
    expect(nachBeginVonB).not.toContain('ROLLBACK');

    // Und der Datensatz von B steht nach dem COMMIT wirklich in der DB.
    expect(await anzahlNachrichtenVonB()).toBe(1);

    // Die Verbuchung selbst ist ebenfalls festgeschrieben: genau eine
    // Punktezeile, Status 'present'.
    expect(await anzahlPunkteZeilen()).toBe(1);
    const { rows: [buchung] } = await hilfsPool.query(
      'SELECT attendance_status FROM event_bookings WHERE id = $1', [bookingId]
    );
    expect(buchung.attendance_status).toBe('present');
  });

  it('erlaubter Fall: ohne Fehler kommt der zweite Request durch und der Pool haelt genau einen freien Client', async () => {
    const app = appMit({});

    const antwort = await anwesendVerbuchen(app);
    expect(antwort.status).toBe(200);
    expect(antwort.body).toEqual({
      message: 'Anwesenheit aktualisiert und 5 gemeinde-Punkte vergeben',
      points_awarded: true,
    });

    await zweiterRequestSchreibt();
    expect(await anzahlNachrichtenVonB()).toBe(1);
    expect(await anzahlPunkteZeilen()).toBe(1);

    // Genau ein Client, genau einmal freigegeben: Ein Doppel-Release wuerde
    // den Zaehler verruecken (idleCount 2 bei totalCount 1 ist unmoeglich,
    // pg-pool wuerde stattdessen den Client eines Fremden weiterreichen).
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(pool.waitingCount).toBe(0);
  });

  it('frueher Ausstieg: der 404 kommt unveraendert und gibt den Client trotzdem frei', async () => {
    const app = appMit({});

    const antwort = await request(app)
      .put(`/api/events/${eventId}/participants/999999/attendance`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ attendance_status: 'present' });

    expect(antwort.status).toBe(404);
    expect(antwort.body).toEqual({ error: 'Event oder Teilnehmer nicht gefunden, oder Zugriff verweigert' });

    // Der Client ist zurueck im Pool — der naechste Request bekommt ihn.
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    await zweiterRequestSchreibt();
    expect(await anzahlNachrichtenVonB()).toBe(1);

    // Und die abgebrochene Transaktion hat nichts hinterlassen.
    expect(await anzahlPunkteZeilen()).toBe(0);
  });

  it('Zaehlprobe: die Anwesenheits-Transaktion laeuft als BEGIN ... COMMIT ohne ROLLBACK durch', async () => {
    const app = appMit({ wirftBei: (raum) => raum === `user_konfi_${USERS.konfi1.id}` });

    await anwesendVerbuchen(app).expect(200);

    const anweisungen = verlaufDerVerbindung(1);
    const beginn = anweisungen.indexOf('BEGIN');
    expect(beginn).toBeGreaterThanOrEqual(0);
    const ende = anweisungen.indexOf('COMMIT');
    expect(ende).toBeGreaterThan(beginn);
    // Nur das Fenster der Transaktion betrachten: dahinter stehen die
    // Push-Abfragen der Nacharbeit, die ueber db (derselbe max:1-Pool) laufen.
    const transaktion = anweisungen.slice(beginn, ende + 1);
    expect(transaktion).not.toContain('ROLLBACK');
    // Kein verspaeteter ROLLBACK aus der Nacharbeit auf dieser Verbindung.
    expect(anweisungen).not.toContain('ROLLBACK');
    expect(anweisungen.filter(sql => sql === 'BEGIN').length).toBe(1);
  });
});
