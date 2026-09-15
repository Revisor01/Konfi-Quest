// Absagen meldet alle Angemeldeten ab (Entscheidung Simon, 15.09.2026).
//
// DER FEHLER, DEN DAS BEHEBT: Eine Absage setzte nur events.cancelled und
// liess die Buchungen auf 'confirmed' mit attendance_status NULL stehen. Der
// Termin galt dadurch weiter als "noch zu verbuchen" -- er zaehlte im Badge
// mit und fiel aus dem Vergangen-Reiter. Genau das waren am Morgen des
// 15.09.2026 zwei Fehler auf einmal (Kommentar in backgroundService.js,
// Befund H1).
//
// Der Termin hat nicht stattgefunden. Niemand war anwesend, niemand muss ihn
// noch verbuchen -- also wird abgemeldet, mit dem Absagegrund als Grund, und
// bereits vergebene Punkte werden zurueckgenommen (wie beim manuellen
// Abmelden, Migration 147: "zaehlt wie ne Abmeldung").
//
// ABMELDEN IST DIE VOREINSTELLUNG, NICHT DAS ENDE (Simon, 15.09.2026: "Und
// theoretisch kann ich dennoch Punkte vergeben wenn ich das will"): Waren
// drei Konfis schon da und haben geholfen, muss die Leitung sie danach auf
// anwesend setzen und ihnen Punkte geben koennen. Der letzte describe-Block
// prueft genau diesen Weg -- er ist der Grund, warum ein abgesagter Termin
// NICHT schreibgeschuetzt sein darf.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { berechneAppIconSumme } = require('../../utils/appIconBadge');

describe('Absage meldet alle Angemeldeten ab', () => {
  let app, db, adminToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    // Die Rolle 'admin' zaehlt seit der Jahrgangs-Bindung nur ihre
    // zugewiesenen Jahrgaenge; admin1 hat im Seed keine.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  // Ein Termin mit Punkten, an dem sich Personen anmelden koennen. Die
  // Buchungen werden direkt gesetzt, damit auch Warteliste und bereits
  // verbuchte Staende gezielt herstellbar sind.
  async function termin({ punkte = 5, punktTyp = 'gemeinde', vergangen = false } = {}) {
    const datum = vergangen ? "NOW() - interval '2 days'" : "NOW() + interval '14 days'";
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           point_type, points, cancelled)
       VALUES ('Konfifreizeit', ${datum}, $1, false, 20, $2, $3, false)
       RETURNING id`,
      [ORGS.testGemeinde.id, punktTyp, punkte]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [event.id, JAHRGAENGE.jahrgang1.id]
    );
    return event.id;
  }

  async function bucht(eventId, userId, status = 'confirmed', attendance = null) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, attendance_status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, eventId, status, ORGS.testGemeinde.id, attendance]
    );
    return b.id;
  }

  // Punkte vergeben wie der Verbuchungsweg: Beleg in event_points UND Saldo
  // im Profil. Beides muss die Ruecknahme wieder einfangen.
  async function gibPunkte(eventId, userId, punkte, typ = 'gemeinde') {
    await db.query(
      `INSERT INTO event_points (konfi_id, event_id, points, point_type, description, awarded_date, admin_id, organization_id)
       VALUES ($1, $2, $3, $4, 'Event-Teilnahme', NOW(), $5, $6)`,
      [userId, eventId, punkte, typ, USERS.admin1.id, ORGS.testGemeinde.id]
    );
    const spalte = typ === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
    await db.query(
      `UPDATE konfi_profiles SET ${spalte} = ${spalte} + $1 WHERE user_id = $2`,
      [punkte, userId]
    );
  }

  const absagen = (eventId, body = {}) =>
    request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

  const buchung = async (eventId, userId) => {
    const { rows: [row] } = await db.query(
      `SELECT status, attendance_status, excuse_reason, attendance_set_by, checkin_quelle
         FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    return row;
  };

  const saldo = async (userId, typ = 'gemeinde') => {
    const spalte = typ === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
    const { rows: [row] } = await db.query(
      `SELECT ${spalte} AS punkte FROM konfi_profiles WHERE user_id = $1`,
      [userId]
    );
    return row.punkte;
  };

  describe('Drei Angemeldete werden alle abgemeldet', () => {
    it('setzt bei allen dreien excused mit dem Absagegrund', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);
      await bucht(eventId, USERS.konfi2.id);
      await bucht(eventId, USERS.admin1.id);

      const res = await absagen(eventId, { cancelled_reason: 'Heizung defekt' });
      expect(res.status).toBe(200);

      for (const u of [USERS.konfi1, USERS.konfi2, USERS.admin1]) {
        const b = await buchung(eventId, u.id);
        expect(b.attendance_status).toBe('excused');
        expect(b.excuse_reason).toBe('Heizung defekt');
      }
    });

    // Der Alt-App-Vertrag: `status` bleibt 'confirmed'. Ausgelieferte
    // App-Fassungen filtern ihre Teilnehmerlisten ueber
    // `p.status === 'confirmed'` (EventDetailView, EventDetailSections) --
    // wuerde der Wert wechseln, verschwaenden die Personen dort aus der Liste.
    it('laesst status auf confirmed stehen (Alt-App-Vertrag)', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);

      expect((await absagen(eventId)).status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });

    // Die Absage ist keine Anwesenheitsbeurteilung: Niemand hat hier eine
    // Anwesenheit eingetragen, der Termin faellt aus. Stuende die absagende
    // Person drin, laese die Teilnehmerliste "Eingetragen von Test Admin 1"
    // an jeder Zeile -- eine falsche Zuschreibung (Migration 148). Wer
    // abgesagt hat, steht in events.cancelled_by.
    it('setzt weder attendance_set_by noch checkin_quelle', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);

      expect((await absagen(eventId)).status).toBe(200);
      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.attendance_set_by).toBeNull();
      expect(b.checkin_quelle).toBeNull();

      const { rows: [e] } = await db.query('SELECT cancelled_by FROM events WHERE id = $1', [eventId]);
      expect(e.cancelled_by).toBe(USERS.admin1.id);
    });
  });

  describe('Punkte werden zurueckgenommen', () => {
    it('zieht die vergebenen Punkte vom Saldo ab und loescht den Beleg', async () => {
      const eventId = await termin({ punkte: 5 });
      await bucht(eventId, USERS.konfi1.id);
      const vorher = await saldo(USERS.konfi1.id);
      await gibPunkte(eventId, USERS.konfi1.id, 5);
      expect(await saldo(USERS.konfi1.id)).toBe(vorher + 5);

      expect((await absagen(eventId)).status).toBe(200);

      expect(await saldo(USERS.konfi1.id)).toBe(vorher);
      const { rows } = await db.query(
        'SELECT id FROM event_points WHERE event_id = $1 AND konfi_id = $2',
        [eventId, USERS.konfi1.id]
      );
      expect(rows).toHaveLength(0);
    });

    it('trennt Gottesdienst- von Gemeinde-Punkten', async () => {
      const eventId = await termin({ punkte: 3, punktTyp: 'gottesdienst' });
      await bucht(eventId, USERS.konfi1.id);
      const gdVorher = await saldo(USERS.konfi1.id, 'gottesdienst');
      const gemVorher = await saldo(USERS.konfi1.id, 'gemeinde');
      await gibPunkte(eventId, USERS.konfi1.id, 3, 'gottesdienst');

      expect((await absagen(eventId)).status).toBe(200);

      expect(await saldo(USERS.konfi1.id, 'gottesdienst')).toBe(gdVorher);
      expect(await saldo(USERS.konfi1.id, 'gemeinde')).toBe(gemVorher);
    });

    // Punkte an einem ANDEREN Termin duerfen die Absage nicht beruehren --
    // sonst zoege ein Mengen-UPDATE ohne event_id-Filter den ganzen Saldo ab.
    it('laesst Punkte anderer Termine unberuehrt', async () => {
      const abgesagt = await termin({ punkte: 5 });
      const anderer = await termin({ punkte: 7 });
      await bucht(abgesagt, USERS.konfi1.id);
      await bucht(anderer, USERS.konfi1.id);
      const vorher = await saldo(USERS.konfi1.id);
      await gibPunkte(abgesagt, USERS.konfi1.id, 5);
      await gibPunkte(anderer, USERS.konfi1.id, 7);

      expect((await absagen(abgesagt)).status).toBe(200);

      expect(await saldo(USERS.konfi1.id)).toBe(vorher + 7);
    });
  });

  // Die Warteliste bekommt denselben Absage-Push wie die Angemeldeten (die
  // Route adressiert status IN ('confirmed','waitlist')). Eine Wartende, die
  // auf NULL stehen bliebe, waere genau der offene Posten, gegen den diese
  // Aenderung antritt -- und nachruecken kann sie ohnehin nicht mehr.
  describe('Warteliste wird mit abgemeldet', () => {
    it('meldet auch Wartende ab, ohne ihren status zu aendern', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, USERS.konfi2.id, 'waitlist');

      expect((await absagen(eventId, { cancelled_reason: 'Sturm' })).status).toBe(200);

      const w = await buchung(eventId, USERS.konfi2.id);
      expect(w.attendance_status).toBe('excused');
      expect(w.excuse_reason).toBe('Sturm');
      expect(w.status).toBe('waitlist');
    });
  });

  // DER WICHTIGE FALL: Wer bereits abgemeldet ist, darf nicht ein zweites Mal
  // angefasst werden -- sonst wuerden die Punkte doppelt abgezogen und der
  // eingetragene Grund ("krank, Mutter hat angerufen") durch den Absagegrund
  // ueberschrieben.
  describe('Bereits verbuchte Staende bleiben unangetastet', () => {
    it('ueberschreibt weder Grund noch Urheber einer bestehenden Abmeldung', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed', 'excused');
      await db.query(
        `UPDATE event_bookings SET excuse_reason = 'krank, Mutter hat angerufen',
                                   attendance_set_by = $2, attendance_set_at = NOW()
          WHERE id = $1`,
        [bookingId, USERS.admin1.id]
      );

      expect((await absagen(eventId, { cancelled_reason: 'Heizung defekt' })).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
    });

    it('zieht die Punkte einer bereits abgemeldeten Person NICHT erneut ab', async () => {
      const eventId = await termin({ punkte: 5 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed', 'excused');
      const vorher = await saldo(USERS.konfi1.id);
      // Der Beleg steht noch, der Saldo wurde beim manuellen Abmelden aber
      // schon bereinigt -- genau die Lage, in der ein zweiter Abzug den
      // Saldo unter den richtigen Wert druecken wuerde.
      await db.query(
        `INSERT INTO event_points (konfi_id, event_id, points, point_type, description, awarded_date, admin_id, organization_id)
         VALUES ($1, $2, 5, 'gemeinde', 'Rest', NOW(), $3, $4)`,
        [USERS.konfi1.id, eventId, USERS.admin1.id, ORGS.testGemeinde.id]
      );

      expect((await absagen(eventId)).status).toBe(200);

      expect(await saldo(USERS.konfi1.id)).toBe(vorher);
    });

    it('laesst eine bereits als anwesend verbuchte Person auf present', async () => {
      const eventId = await termin({ punkte: 5 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed', 'present');
      const vorher = await saldo(USERS.konfi1.id);
      await gibPunkte(eventId, USERS.konfi1.id, 5);

      expect((await absagen(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.attendance_status).toBe('present');
      expect(await saldo(USERS.konfi1.id)).toBe(vorher + 5);
    });
  });

  describe('Absage ohne Grund', () => {
    it('setzt excused mit dem festen Text', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);

      const res = await absagen(eventId);
      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBeNull();

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('Termin abgesagt');
    });

    // Ein Grund aus lauter Leerzeichen ist kein Grund -- die Route
    // normalisiert ihn auf NULL, also greift derselbe feste Text.
    it('behandelt einen leeren Grund wie gar keinen', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);

      expect((await absagen(eventId, { cancelled_reason: '   ' })).status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).excuse_reason).toBe('Termin abgesagt');
    });
  });

  // Die Antwortform ist ein Vertrag: Ausgelieferte App-Fassungen lesen genau
  // diese Felder. Das Abmelden darf daran nichts aendern.
  describe('Antwortform von PUT /:id/cancel bleibt unveraendert', () => {
    it('liefert message, participants_notified und notification_message wie bisher', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);
      await bucht(eventId, USERS.konfi2.id, 'waitlist');

      const res = await absagen(eventId, { cancelled_reason: 'Sturm' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Event "Konfifreizeit" wurde abgesagt');
      expect(res.body.participants_notified).toBe(2);
      expect(res.body.notification_message).toBe('Das Event wurde abgesagt.');
      expect(res.body.cancelled_reason).toBe('Sturm');
    });
  });

  // Der Zaehler-Fix vom Morgen des 15.09.2026 bleibt gueltig: Nach der Absage
  // steht der Termin in KEINEM Badge-Zaehler. Geprueft wird hier der Weg ueber
  // die Route (nicht wie in terminZaehlerAbsage.test.js ueber ein direkt
  // gesetztes cancelled), damit auch das Zusammenspiel mit dem Abmelden zaehlt.
  describe('Nach der Absage in keinem Zaehler', () => {
    it('badge-counts und App-Icon melden 0', async () => {
      const eventId = await termin({ vergangen: true });
      await bucht(eventId, USERS.konfi1.id);

      expect((await absagen(eventId)).status).toBe(200);

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pendingEvents).toBe(0);

      const summe = await berechneAppIconSumme(db, {
        id: USERS.admin1.id,
        type: 'admin',
        role_name: 'admin',
        organization_id: ORGS.testGemeinde.id,
        assigned_jahrgaenge: [{ id: JAHRGAENGE.jahrgang1.id, can_view: true }]
      });
      expect(summe).toBe(0);
    });
  });

  // TRANSAKTION: Abmelden und Absagen gehoeren zusammen. Schlaegt das
  // Abmelden fehl, darf der Termin nicht halb abgesagt zurueckbleiben --
  // ein abgesagter Termin mit offenen Buchungen ist genau der Zustand,
  // gegen den diese Aenderung antritt.
  describe('Transaktion: schlaegt das Abmelden fehl, ist der Termin nicht abgesagt', () => {
    // Der Fehler wird in der DATENBANK ausgeloest, nicht per Spy: Die Route
    // holt `meldeAlleAbBeiAbsage` beim Laden aus dem Modul heraus, ein Spy auf
    // dem Export erreicht sie also gar nicht mehr (nachgemessen 15.09.2026 --
    // die Absage lief mit Spy unveraendert auf 200 durch und der Test haette
    // nichts geprueft). Ein Trigger auf event_bookings laesst genau das
    // Mengen-UPDATE scheitern, das die Abmeldung schreibt, und damit faellt
    // der echte Weg um -- nicht ein nachgebauter.
    it('rollt die Absage zurueck', async () => {
      const eventId = await termin();
      await bucht(eventId, USERS.konfi1.id);

      await db.query(`
        CREATE OR REPLACE FUNCTION absage_test_bremse() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'Abmelden fehlgeschlagen'; END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER absage_test_bremse_trg
          BEFORE UPDATE OF attendance_status ON event_bookings
          FOR EACH ROW EXECUTE FUNCTION absage_test_bremse();
      `);
      try {
        const res = await absagen(eventId);
        expect(res.status).toBe(500);
      } finally {
        await db.query('DROP TRIGGER IF EXISTS absage_test_bremse_trg ON event_bookings');
        await db.query('DROP FUNCTION IF EXISTS absage_test_bremse()');
      }

      const { rows: [e] } = await db.query(
        'SELECT cancelled, cancelled_at, cancelled_reason FROM events WHERE id = $1',
        [eventId]
      );
      expect(e.cancelled).toBe(false);
      expect(e.cancelled_at).toBeNull();

      // Und die Buchung steht unveraendert da.
      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.attendance_status).toBeNull();
      expect(b.status).toBe('confirmed');
    });
  });

  // SIMONS ERGAENZUNG (15.09.2026): "Und theoretisch kann ich dennoch Punkte
  // vergeben wenn ich das will. Aber das ist erstmal der Standard."
  //
  // Das automatische Abmelden ist die VOREINSTELLUNG. Ein abgesagter Termin
  // bleibt bearbeitbar: Waren drei Konfis schon da und haben geholfen, setzt
  // die Leitung sie danach auf anwesend -- mit Punkten. Ohne diese Tests
  // koennte eine spaetere Sperre ("Termin ist abgesagt") unbemerkt einziehen
  // und die Absage zur Einbahnstrasse machen.
  describe('Nach der Absage bleibt die Anwesenheit aenderbar', () => {
    const setzeAnwesenheit = (eventId, bookingId, body) =>
      request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

    it('setzt eine Person auf anwesend und vergibt die Punkte', async () => {
      const eventId = await termin({ punkte: 5 });
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      const vorher = await saldo(USERS.konfi1.id);

      expect((await absagen(eventId, { cancelled_reason: 'Heizung defekt' })).status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).attendance_status).toBe('excused');

      const res = await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' });
      expect(res.status).toBe(200);
      expect(res.body.points_awarded).toBe(true);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.attendance_status).toBe('present');
      // Der Absagegrund weicht beim Wechsel auf 'present' -- er gehoert zu
      // 'excused' (events/anwesenheit.js) und stuende sonst an einer
      // Buchung, die auf anwesend steht.
      expect(b.excuse_reason).toBeNull();
      expect(await saldo(USERS.konfi1.id)).toBe(vorher + 5);
    });

    it('nimmt die so vergebenen Punkte nicht nachtraeglich wieder weg', async () => {
      const eventId = await termin({ punkte: 5 });
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      const vorher = await saldo(USERS.konfi1.id);
      expect((await absagen(eventId)).status).toBe(200);
      expect((await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' })).status).toBe(200);

      // Ein zweiter Absageversuch prallt ab (der Termin ist bereits abgesagt)
      // -- und darf die Punkte erst recht nicht anfassen.
      const zweite = await absagen(eventId);
      expect(zweite.status).toBe(400);

      expect(await saldo(USERS.konfi1.id)).toBe(vorher + 5);
      expect((await buchung(eventId, USERS.konfi1.id)).attendance_status).toBe('present');
    });

    it('laesst die uebrigen Personen auf abgemeldet stehen', async () => {
      const eventId = await termin({ punkte: 5 });
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await bucht(eventId, USERS.konfi2.id);

      expect((await absagen(eventId, { cancelled_reason: 'Heizung defekt' })).status).toBe(200);
      expect((await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' })).status).toBe(200);

      const andere = await buchung(eventId, USERS.konfi2.id);
      expect(andere.attendance_status).toBe('excused');
      expect(andere.excuse_reason).toBe('Heizung defekt');
    });

    it('laesst den Absagegrund durch einen eigenen Grund ersetzen', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      expect((await absagen(eventId, { cancelled_reason: 'Heizung defekt' })).status).toBe(200);

      const res = await setzeAnwesenheit(eventId, bookingId, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen'
      });
      expect(res.status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
    });
  });
});
