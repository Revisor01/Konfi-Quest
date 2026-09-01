// backend/tests/routes/teamerZusage.test.js
//
// "Ich bin dabei" / "Ich bin nicht dabei" fuer Teamer:innen
// (Nutzerwunsch 25.08.2026).
//
// Warum es das gibt: Bisher konnten Teamer:innen sich nur an- und abmelden.
// Wer absagte, verschwand aus der Liste — fuer die Leitung nicht von "hat noch
// nicht reagiert" zu unterscheiden. Eine Absage ist jetzt eine eigene,
// sichtbare Aussage.
//
// GRUND (Simons Anforderung 01.09.2026): freiwillig — AUSSER bei einer
// Absage NACH einer Zusage (confirmed ODER waitlist), dort Pflicht, damit
// die Leitung umplanen kann. Durchgesetzt im Backend (setzeTeamerZusage),
// nicht nur in der Oberflaeche. Bis dahin war der Grund durchgehend
// freiwillig; die Absage aus "offen" bleibt es.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Teamer: Zusage und Absage', () => {
  let app;
  let db;
  let teamerToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    teamerToken = generateToken('teamer1');
    // Termin fuer Teamer:innen oeffnen und in die Zukunft legen.
    await db.query(
      `UPDATE events SET teamer_needed = true, teamer_max_participants = 10,
              event_date = NOW() + interval '7 days'
        WHERE id = $1`,
      [EVENTS.gottesdienstEvent.id]
    );
  });

  afterAll(async () => {
    await closePool();
  });

  const zusage = (body) =>
    request(app)
      .post(`/api/teamer/events/${EVENTS.gottesdienstEvent.id}/zusage`)
      .set('Authorization', `Bearer ${teamerToken}`)
      .send(body);

  const status = async () => {
    const { rows } = await db.query(
      'SELECT status, opt_out_reason, opt_out_date, absage_nach_zusage FROM event_bookings WHERE user_id = $1 AND event_id = $2',
      [USERS.teamer1.id, EVENTS.gottesdienstEvent.id]
    );
    return rows[0] || null;
  };

  it('"dabei" legt eine bestaetigte Buchung an', async () => {
    const res = await zusage({ dabei: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
    expect((await status()).status).toBe('confirmed');
  });

  it('"nicht dabei" aus OFFEN wird als eigener Status gespeichert, ohne Grundzwang', async () => {
    // Absage ohne vorherige Zusage: Da wird nichts zurueckgenommen, es soll
    // nur die Rueckmeldung ueberhaupt da sein — Grund bleibt freiwillig.
    const res = await zusage({ dabei: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('opted_out');

    const s = await status();
    expect(s.status).toBe('opted_out');
    // Kein Grund noetig — anders als beim Konfi-Pflichttermin.
    expect(s.opt_out_reason).toBeNull();
    expect(s.opt_out_date).not.toBeNull();
    // Keine Zusage zurueckgenommen -> Kennzeichen bleibt false.
    expect(s.absage_nach_zusage).toBe(false);
  });

  it('speichert einen freiwillig mitgeschickten Grund', async () => {
    await zusage({ dabei: false, reason: 'Bin im Urlaub' });
    expect((await status()).opt_out_reason).toBe('Bin im Urlaub');
  });

  it('die Meinung laesst sich aendern: nicht dabei -> dabei', async () => {
    await zusage({ dabei: false, reason: 'Doch nicht' });
    expect((await status()).status).toBe('opted_out');

    const res = await zusage({ dabei: true });
    expect(res.status).toBe(200);

    const s = await status();
    expect(s.status).toBe('confirmed');
    // Grund und Datum werden beim Zurueckwechseln geleert.
    expect(s.opt_out_reason).toBeNull();
    expect(s.opt_out_date).toBeNull();
    expect(s.absage_nach_zusage).toBe(false);
  });

  // ==================================================================
  // Der Grund-Zwang: Absage NACH Zusage nur mit Grund (01.09.2026).
  // Beide Richtungen ausdruecklich getestet — der verbotene UND der
  // erlaubte Fall.
  // ==================================================================
  describe('Absage nach Zusage erfordert einen Grund', () => {
    it('Zusage -> Absage OHNE Grund wird abgelehnt (400, grund_erforderlich)', async () => {
      await zusage({ dabei: true });
      expect((await status()).status).toBe('confirmed');

      const res = await zusage({ dabei: false });
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('grund_erforderlich');

      // Die Zusage bleibt unangetastet stehen.
      const s = await status();
      expect(s.status).toBe('confirmed');
      expect(s.absage_nach_zusage).toBe(false);
    });

    it('auch ein Grund nur aus Leerzeichen zaehlt nicht', async () => {
      await zusage({ dabei: true });
      const res = await zusage({ dabei: false, reason: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('grund_erforderlich');
      expect((await status()).status).toBe('confirmed');
    });

    it('Zusage -> Absage MIT Grund wird gespeichert und gekennzeichnet', async () => {
      await zusage({ dabei: true });

      const res = await zusage({ dabei: false, reason: 'Familienfeier' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('opted_out');

      const s = await status();
      expect(s.status).toBe('opted_out');
      expect(s.opt_out_reason).toBe('Familienfeier');
      // Das Kennzeichen aus Migration 141: Diese Absage nahm eine Zusage
      // zurueck — fuer die Leitung der Unterschied zwischen "kein Problem"
      // und "kurzfristig umplanen".
      expect(s.absage_nach_zusage).toBe(true);
    });

    it('gilt auch von der WARTELISTE aus: die Aussage "Ich bin dabei" zaehlt', async () => {
      // Kontingent 1, Platz belegt -> die eigene Zusage landet auf der
      // Warteliste. Auch das war eine Zusage; ihre Ruecknahme braucht einen
      // Grund.
      await db.query(
        `UPDATE events SET teamer_max_participants = 1 WHERE id = $1`,
        [EVENTS.gottesdienstEvent.id]
      );
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES (250, 'belegt250', 'x', 'Belegt 250', 2, $1, true)`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, 250, 'confirmed', $2)`,
        [EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id]
      );

      await zusage({ dabei: true });
      expect((await status()).status).toBe('waitlist');

      const ohneGrund = await zusage({ dabei: false });
      expect(ohneGrund.status).toBe(400);
      expect(ohneGrund.body.error_code).toBe('grund_erforderlich');

      const mitGrund = await zusage({ dabei: false, reason: 'Klausurwoche' });
      expect(mitGrund.status).toBe(200);
      const s = await status();
      expect(s.status).toBe('opted_out');
      expect(s.absage_nach_zusage).toBe(true);
    });

    it('eine WIEDERHOLTE Absage braucht keinen Grund (nichts zurueckgenommen)', async () => {
      await zusage({ dabei: true });
      await zusage({ dabei: false, reason: 'Krank' });

      // Zweiter Versand derselben Absage (z.B. Offline-Warteschlange):
      // vorheriger Status ist schon opted_out, keine Zusage wird
      // zurueckgenommen -> kein Zwang.
      const res = await zusage({ dabei: false });
      expect(res.status).toBe(200);
      const s = await status();
      expect(s.status).toBe('opted_out');
      // Ein Duplikat darf die erste, begruendete Absage nicht zu einer
      // grundlosen machen: Grund und Kennzeichen bleiben stehen.
      expect(s.opt_out_reason).toBe('Krank');
      expect(s.absage_nach_zusage).toBe(true);
    });

    it('nach erneuter Zusage greift der Zwang wieder', async () => {
      await zusage({ dabei: true });
      await zusage({ dabei: false, reason: 'Krank' });
      await zusage({ dabei: true });

      const res = await zusage({ dabei: false });
      expect(res.status).toBe(400);
      expect(res.body.error_code).toBe('grund_erforderlich');
    });
  });

  it('legt bei mehrfacher Absage KEINE zweite Buchung an', async () => {
    await zusage({ dabei: false });
    await zusage({ dabei: false });
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS anzahl FROM event_bookings WHERE user_id = $1 AND event_id = $2',
      [USERS.teamer1.id, EVENTS.gottesdienstEvent.id]
    );
    expect(rows[0].anzahl).toBe(1);
  });

  // Befund M1 (26.08.2026): Diese Route setzte bei einer Zusage hart
  // status='confirmed' -- ohne jede Pruefung von teamer_max_participants,
  // teamer_waitlist_enabled oder teamer_max_waitlist_size. Der regulaere
  // Buchungsweg (events.js) prueft all das. Ueber die App war der Weg nicht
  // erreichbar (das Frontend ruft nur dabei=false), die Route stand aber offen
  // und die Funktion ist parametrisiert.
  describe('Teamer-Kontingent gilt auch bei der Zusage', () => {
    // Der Seed hat nur eine Teamer:in -- fuer volle Kontingente braucht es mehr.
    // ab-Parameter, damit zwei Aufrufe im selben Test nicht dieselben IDs
    // vergeben (event_bookings hat ein UNIQUE auf user_id+event_id).
    const belegen = async (anzahl, status = 'confirmed', ab = 200) => {
      for (let i = 0; i < anzahl; i++) {
        const id = ab + i;
        await db.query(
          `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
           VALUES ($1, $2, 'x', $3, 2, $4, true) ON CONFLICT (id) DO NOTHING`,
          [id, `belegt${id}`, `Belegt ${id}`, ORGS.testGemeinde.id]
        );
        await db.query(
          `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
           VALUES ($1, $2, $3, $4)`,
          [EVENTS.gottesdienstEvent.id, id, status, ORGS.testGemeinde.id]
        );
      }
    };

    const kontingent = async (max, wartelisteAn = true, maxWarteliste = 10) => {
      await db.query(
        `UPDATE events SET teamer_max_participants = $2, teamer_waitlist_enabled = $3,
                teamer_max_waitlist_size = $4 WHERE id = $1`,
        [EVENTS.gottesdienstEvent.id, max, wartelisteAn, maxWarteliste]
      );
    };

    it('volles Kontingent mit offener Warteliste -> Warteliste statt bestaetigt', async () => {
      await kontingent(1, true, 5);
      await belegen(1);

      const res = await zusage({ dabei: true });
      expect(res.status).toBe(200);

      const gebucht = await status();
      expect(gebucht.status).toBe('waitlist');
    });

    it('volles Kontingent OHNE Warteliste -> 400, keine Buchung', async () => {
      await kontingent(1, false);
      await belegen(1);

      const res = await zusage({ dabei: true });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Das Event ist leider bereits ausgebucht');
      expect(await status()).toBeNull();
    });

    it('volles Kontingent UND volle Warteliste -> 400', async () => {
      await kontingent(1, true, 1);
      await belegen(1);
      await belegen(1, 'waitlist', 300);

      const res = await zusage({ dabei: true });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Event ist voll und Warteliste ist auch voll');
    });

    it('freies Kontingent -> weiterhin bestaetigt', async () => {
      // Gegenprobe: Die Pruefung darf den Normalfall nicht mitnehmen.
      await kontingent(5);
      await belegen(1);

      const res = await zusage({ dabei: true });
      expect(res.status).toBe(200);
      expect((await status()).status).toBe('confirmed');
    });

    it('teamer_max_participants = 0 heisst unbegrenzt', async () => {
      await kontingent(0);
      await belegen(3);

      const res = await zusage({ dabei: true });
      expect(res.status).toBe(200);
      expect((await status()).status).toBe('confirmed');
    });

    it('die eigene bestehende Buchung sperrt einen nicht selbst aus', async () => {
      // Wer zusagt, absagt und erneut zusagt, darf nicht am eigenen Platz
      // scheitern -- der Platz gehoert noch ihm.
      await kontingent(1, false);
      await zusage({ dabei: true });
      // Absage nach Zusage: seit 01.09.2026 nur mit Grund.
      await zusage({ dabei: false, reason: 'Kurz verhindert' });

      const res = await zusage({ dabei: true });
      expect(res.status).toBe(200);
      expect((await status()).status).toBe('confirmed');
    });
  });

  it('lehnt Termine ab, fuer die keine Teamer:innen gesucht werden', async () => {
    await db.query(
      'UPDATE events SET teamer_needed = false, teamer_only = false WHERE id = $1',
      [EVENTS.gottesdienstEvent.id]
    );
    const res = await zusage({ dabei: true });
    expect(res.status).toBe(400);
    expect(await status()).toBeNull();
  });

  it('lehnt Termine in der Vergangenheit ab', async () => {
    await db.query(
      "UPDATE events SET event_date = NOW() - interval '1 day' WHERE id = $1",
      [EVENTS.gottesdienstEvent.id]
    );
    const res = await zusage({ dabei: true });
    expect(res.status).toBe(400);
  });

  it('lehnt abgesagte Termine ab', async () => {
    await db.query('UPDATE events SET cancelled = true WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
    const res = await zusage({ dabei: true });
    expect(res.status).toBe(400);
  });

  it('verlangt "dabei" als true oder false', async () => {
    const res = await zusage({ dabei: 'vielleicht' });
    expect(res.status).toBe(400);
  });

  it('ein Konfi darf diese Route nicht nutzen', async () => {
    const res = await request(app)
      .post(`/api/teamer/events/${EVENTS.gottesdienstEvent.id}/zusage`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send({ dabei: true });
    expect(res.status).toBe(403);
  });

  it('ein Termin aus einer fremden Organisation gibt 404', async () => {
    const res = await request(app)
      .post(`/api/teamer/events/${EVENTS.event2.id}/zusage`)
      .set('Authorization', `Bearer ${teamerToken}`)
      .send({ dabei: true });
    expect(res.status).toBe(404);
  });

  // ==================================================================
  // Kapazitaet: Eine Absage gibt den Team-Platz frei — mit konkreten
  // Zahlen, gemessen an der verbindlichen Sicht event_booking_stats
  // (Migration 136), gegen die auch zaehleBuchungen zaehlt.
  // ==================================================================
  describe('Kapazitaetszaehlung rund um die Absage', () => {
    const teamZahlen = async () => {
      const { rows: [z] } = await db.query(
        'SELECT teamer_confirmed, teamer_waitlist FROM event_booking_stats WHERE event_id = $1',
        [EVENTS.gottesdienstEvent.id]
      );
      return z;
    };

    const belege = async (id, bookingStatus) => {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 2, $4, true)`,
        [id, `teamk${id}`, `Team K ${id}`, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, $3, $4)`,
        [EVENTS.gottesdienstEvent.id, id, bookingStatus, ORGS.testGemeinde.id]
      );
    };

    it('vor der Absage 3 bestaetigt, danach 2 — der opted_out belegt keinen Platz', async () => {
      await belege(400, 'confirmed');
      await belege(401, 'confirmed');
      await zusage({ dabei: true });

      let z = await teamZahlen();
      expect(z.teamer_confirmed).toBe(3);
      expect(z.teamer_waitlist).toBe(0);

      const res = await zusage({ dabei: false, reason: 'Schicht getauscht' });
      expect(res.status).toBe(200);

      z = await teamZahlen();
      expect(z.teamer_confirmed).toBe(2);
      expect(z.teamer_waitlist).toBe(0);
      // Die Absage steht als eigene Zeile, nicht als geloeschte.
      expect((await status()).status).toBe('opted_out');
    });

    it('eine Absage aus CONFIRMED laesst die Team-Warteliste nachruecken', async () => {
      // Kontingent 1: die eigene Zusage nimmt den Platz, Nummer 402 wartet.
      await db.query(
        `UPDATE events SET teamer_max_participants = 1, teamer_waitlist_enabled = true,
                teamer_max_waitlist_size = 5 WHERE id = $1`,
        [EVENTS.gottesdienstEvent.id]
      );
      await zusage({ dabei: true });
      await belege(402, 'waitlist');

      let z = await teamZahlen();
      expect(z.teamer_confirmed).toBe(1);
      expect(z.teamer_waitlist).toBe(1);

      const res = await zusage({ dabei: false, reason: 'Pruefung verschoben' });
      expect(res.status).toBe(200);

      // 402 ist nachgerueckt: wieder 1 bestaetigt, Warteliste leer.
      z = await teamZahlen();
      expect(z.teamer_confirmed).toBe(1);
      expect(z.teamer_waitlist).toBe(0);
      const { rows: [nachgerueckt] } = await db.query(
        'SELECT status FROM event_bookings WHERE user_id = 402 AND event_id = $1',
        [EVENTS.gottesdienstEvent.id]
      );
      expect(nachgerueckt.status).toBe('confirmed');
    });

    it('eine Absage von der WARTELISTE laesst niemanden nachruecken', async () => {
      // Es wurde kein bestaetigter Platz frei — nachruecken waere falsch.
      await db.query(
        `UPDATE events SET teamer_max_participants = 1, teamer_waitlist_enabled = true,
                teamer_max_waitlist_size = 5 WHERE id = $1`,
        [EVENTS.gottesdienstEvent.id]
      );
      await belege(403, 'confirmed');
      await zusage({ dabei: true }); // -> waitlist
      await belege(404, 'waitlist');

      const res = await zusage({ dabei: false, reason: 'Doch keine Zeit' });
      expect(res.status).toBe(200);

      const z = await teamZahlen();
      expect(z.teamer_confirmed).toBe(1);
      expect(z.teamer_waitlist).toBe(1);
      const { rows: [wartet] } = await db.query(
        'SELECT status FROM event_bookings WHERE user_id = 404 AND event_id = $1',
        [EVENTS.gottesdienstEvent.id]
      );
      expect(wartet.status).toBe('waitlist');
    });
  });

  // ==================================================================
  // "Ich bin doch dabei" ueber den regulaeren Buchungsweg: Eine abgesagte
  // Teamer-Buchung wird reaktiviert statt mit 409 abgewiesen — genau den
  // 409 lief der Dabei-Knopf der App nach einer Absage vorher.
  // ==================================================================
  describe('Reaktivierung ueber POST /events/:id/book', () => {
    const book = (token) =>
      request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

    it('nach einer Absage bucht der Dabei-Knopf wieder (201, EINE Zeile)', async () => {
      await zusage({ dabei: false, reason: 'Erst abgesagt' });

      const res = await book(teamerToken);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');

      const { rows } = await db.query(
        'SELECT status, opt_out_reason, opt_out_date, absage_nach_zusage FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.teamer1.id, EVENTS.gottesdienstEvent.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('confirmed');
      expect(rows[0].opt_out_reason).toBeNull();
      expect(rows[0].opt_out_date).toBeNull();
      expect(rows[0].absage_nach_zusage).toBe(false);
    });

    it('eine AKTIVE Buchung meldet weiterhin 409', async () => {
      await zusage({ dabei: true });
      const res = await book(teamerToken);
      expect(res.status).toBe(409);
    });

    it('Gegenprobe: ein Konfi-Opt-out wird NICHT reaktiviert (409 bleibt)', async () => {
      // Konfis nehmen einen Pflicht-Opt-out ueber POST /konfi/events/:id/
      // opt-in zurueck (eigener Push an die Leitung) — der Buchungsweg darf
      // diesen Weg nicht stillschweigend ersetzen.
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id, opt_out_reason, opt_out_date)
         VALUES ($1, $2, 'opted_out', $3, 'Pflicht-Abmeldung', NOW())`,
        [EVENTS.gottesdienstEvent.id, USERS.konfi1.id, ORGS.testGemeinde.id]
      );
      const res = await book(generateToken('konfi1'));
      expect(res.status).toBe(409);
      const { rows: [k] } = await db.query(
        'SELECT status FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.konfi1.id, EVENTS.gottesdienstEvent.id]
      );
      expect(k.status).toBe('opted_out');
    });
  });

  // ==================================================================
  // Waechter fuer die Antwortform der Detailansicht (GET /events/:id).
  //
  // Hintergrund: Am 29.08.2026 wurde GET /teamer/badges von einem Array auf
  // ein Objekt umgestellt — die Store-Apps riefen .filter() darauf und das
  // Teamer-Dashboard stuerzte nach dem Login ab, bei gruenen Backend-Tests.
  // Dieser Test haelt fest, dass die BISHERIGEN Felder der Detailansicht da
  // sind und ihren Typ behalten; Neues darf nur ADDITIV dazukommen.
  // ==================================================================
  describe('Detailansicht: Antwortform bleibt stabil', () => {
    it('alle bisherigen Felder vorhanden, Typen unveraendert, Neues nur additiv', async () => {
      // Eine begruendete Teamer-Absage, damit die Teilnehmerliste den
      // vollen Fall zeigt.
      await zusage({ dabei: true });
      await zusage({ dabei: false, reason: 'Bin verreist' });

      const res = await request(app)
        .get(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`);
      expect(res.status).toBe(200);
      const b = res.body;

      // Arrays bleiben Arrays — daran haengen .filter()/.map() der Apps.
      expect(Array.isArray(b.participants)).toBe(true);
      expect(Array.isArray(b.timeslots)).toBe(true);
      expect(Array.isArray(b.series_events)).toBe(true);
      expect(Array.isArray(b.jahrgaenge)).toBe(true);
      expect(Array.isArray(b.categories)).toBe(true);
      expect(Array.isArray(b.unregistrations)).toBe(true);

      // Zaehler bleiben Zahlen.
      expect(typeof b.registered_count).toBe('number');
      expect(typeof b.pending_count).toBe('number');
      expect(typeof b.teamer_count).toBe('number');
      expect(typeof b.teamer_waitlist_count).toBe('number');
      expect(typeof b.available_spots).toBe('number');
      expect(typeof b.is_registered).toBe('boolean');

      // Event-Grunddaten.
      expect(typeof b.id).toBe('number');
      expect(typeof b.name).toBe('string');

      // Die abgesagte Teamer:in steht in participants — mit den BISHERIGEN
      // Feldern und dem NEUEN, additiven Kennzeichen.
      const absage = b.participants.find(p => p.user_id === USERS.teamer1.id);
      expect(absage.status).toBe('opted_out');
      expect(absage.opt_out_reason).toBe('Bin verreist');
      expect(typeof absage.participant_name).toBe('string');
      expect(absage.absage_nach_zusage).toBe(true);
    });
  });

  // ==================================================================
  // Migration 141: Bestandszeilen bleiben unveraendert.
  // ==================================================================
  describe('Migration 141 (absage_nach_zusage)', () => {
    it('die Spalte existiert mit Default false und NOT NULL', async () => {
      const { rows: [spalte] } = await db.query(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_name = 'event_bookings' AND column_name = 'absage_nach_zusage'`
      );
      expect(spalte.data_type).toBe('boolean');
      expect(spalte.is_nullable).toBe('NO');
      expect(spalte.column_default).toBe('false');
    });

    it('eine Zeile im Vor-141-Format bleibt feldweise unveraendert und bekommt false', async () => {
      // So sehen die 566 Produktionszeilen aus: OHNE das neue Feld
      // geschrieben. Es darf keinen Wert veraendern und faellt auf false.
      const { rows: [alt] } = await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id, opt_out_reason, opt_out_date)
         VALUES ($1, $2, 'opted_out', $3, 'Bestandsgrund', '2026-08-15T10:00:00Z')
         RETURNING status, opt_out_reason, opt_out_date, absage_nach_zusage`,
        [EVENTS.gottesdienstEvent.id, USERS.teamer1.id, ORGS.testGemeinde.id]
      );
      expect(alt.status).toBe('opted_out');
      expect(alt.opt_out_reason).toBe('Bestandsgrund');
      expect(new Date(alt.opt_out_date).toISOString()).toBe('2026-08-15T10:00:00.000Z');
      expect(alt.absage_nach_zusage).toBe(false);
    });
  });
});
