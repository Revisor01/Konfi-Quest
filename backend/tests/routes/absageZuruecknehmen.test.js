// EINE ABSAGE ZURUECKNEHMEN: PUT /api/events/:id/reaktivieren (16.09.2026)
//
// Simons Entscheidung, woertlich:
//   "Ich möchte es einfach wieder aufleben lassen. Ohne dass Status zurück
//    kommt. Wir drücken es zurück, alle kriegen einen Push: Findet doch statt.
//    Dann sind alle einfach angemeldet und gut. Können sich austragen."
//
// DER KERNFALL, um den sich die Haelfte dieser Tests dreht:
//   "Wenn vorher abgemeldet selbst oder fremd muss das gemerkt sein. [...]
//    Könnte ja auch sein wir sagen eine Pflicht ab, manche sind entschuldigt,
//    dann machen wir es doch. Status bei allen zurück außer bei denen."
//
// Aufgehoben wird also NUR, was aus DIESER Absage stammt
// (abgemeldet_durch_absage, Migration 153). Wer vorher selbst ('opted_out')
// oder von der Leitung ('excused') abgemeldet war, bleibt abgemeldet -- und
// bekommt auch keinen Push, denn "du bist wieder angemeldet" waere fuer sie
// falsch.
//
// UND: Jede Person kehrt auf IHREN alten Status zurueck (status_vor_absage,
// Migration 155). Eine Wartende darf nicht als Angemeldete zurueckkommen --
// sie haette sonst einen Platz, den sie nie hatte.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');
const PushService = require('../../services/pushService');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const JG_FREMD = 322;      // Jahrgang, in dem ADMIN_MIT_JG NICHT ist
const ADMIN_MIT_JG = 422;  // Admin, nur in jahrgang1
// Weitere Konfis: der Seed hat in Org 1 nur konfi1 und konfi2, die
// Wartelisten- und Abmelde-Faelle brauchen mehr.
const KONFI_A = 431;
const KONFI_B = 432;
const KONFI_C = 433;
const KONFI_D = 434;

function tokenFuer(id, roleId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Absage zuruecknehmen: PUT /api/events/:id/reaktivieren', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
  let teamerToken;
  let adminMitJgToken;
  const konfiTokens = {};

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // Spies IMMER zuruecksetzen, auch wenn eine Assertion vorher geworfen hat.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');
    teamerToken = generateToken('teamer1');

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 Fremd (Reaktivieren)', 1, '2027-05-01')`,
      [JG_FREMD]
    );
    // admin1 legt ALLE Termine dieser Suite an -- auch den im "fremden"
    // Jahrgang. Fremd ist der nur fuer ADMIN_MIT_JG, und genau daran haengt
    // der 403-Test.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true), ($1, $3, true, true)`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id, JG_FREMD]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'reakt_admin', 'x', 'Reakt Admin', 3, 1, true)`,
      [ADMIN_MIT_JG]
    );
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [ADMIN_MIT_JG, JAHRGAENGE.jahrgang1.id]
    );
    adminMitJgToken = tokenFuer(ADMIN_MIT_JG, 3);

    // Vier weitere Konfis im jahrgang1 -- role_id 1 wie konfi1/konfi2.
    for (const [id, name] of [[KONFI_A, 'A'], [KONFI_B, 'B'], [KONFI_C, 'C'], [KONFI_D, 'D']]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 1, 1, true)`,
        [id, `reakt_konfi_${name.toLowerCase()}`, `Konfi ${name}`]
      );
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, true)',
        [id, JAHRGAENGE.jahrgang1.id]
      );
      await db.query(
        'INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id, gemeinde_points, gottesdienst_points) VALUES ($1, $2, 1, 0, 0)',
        [id, JAHRGAENGE.jahrgang1.id]
      );
      konfiTokens[name] = tokenFuer(id, 1, 'konfi');
    }

    const { invalidateUserCache } = require('../../middleware/rbac');
    [USERS.admin1.id, ADMIN_MIT_JG, KONFI_A, KONFI_B, KONFI_C, KONFI_D].forEach(invalidateUserCache);
  });

  // --------------------------------------------------------------
  // Hilfen
  // --------------------------------------------------------------

  /** Termin im jahrgang1, Kapazitaet und Warteliste steuerbar. */
  async function termin({ maxParticipants = 10, warteliste = false, punkte = 0, jahrgangId = JAHRGAENGE.jahrgang1.id } = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Konfifreizeit',
        event_date: futureDate.toISOString(),
        max_participants: maxParticipants,
        points: punkte,
        waitlist_enabled: warteliste,
        max_waitlist_size: 10,
        jahrgang_ids: [jahrgangId],
      });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function buche(eventId, token, erwarteterStatus = 201) {
    const res = await request(app)
      .post(`/api/events/${eventId}/book`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(erwarteterStatus);
    return res;
  }

  async function absagen(eventId, grund = 'Heizung defekt', token = adminToken) {
    const res = await request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send(grund === null ? {} : { cancelled_reason: grund });
    expect(res.status).toBe(200);
    return res;
  }

  async function reaktivieren(eventId, token = adminToken) {
    return request(app)
      .put(`/api/events/${eventId}/reaktivieren`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
  }

  /**
   * Die Anwesenheits-Route adressiert die BUCHUNG (eb.id), nicht die Person.
   * Ohne diese Uebersetzung trifft sie zufaellig die falsche Zeile oder gar
   * keine (404) -- je nachdem, wie die Ids gerade laufen.
   */
  async function buchungsId(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    expect(row).toBeTruthy();
    return row.id;
  }

  async function buchung(eventId, userId) {
    const { rows: [row] } = await db.query(
      `SELECT status, attendance_status, excuse_reason, abgemeldet_durch_absage,
              status_vor_absage
         FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    return row;
  }

  async function eventZeile(eventId) {
    const { rows: [row] } = await db.query(
      `SELECT cancelled, cancelled_at, cancelled_by, cancelled_reason,
              cancelled_reason_set_by, cancelled_reason_set_at
         FROM events WHERE id = $1`,
      [eventId]
    );
    return row;
  }

  /** Push abfangen: liefert { empfaenger, meldung, aufrufe }. */
  function pushSpion() {
    const gefangen = { empfaenger: null, meldung: null, aufrufe: 0 };
    vi.spyOn(PushService, 'sendToMultipleUsers').mockImplementation(async (_db, ids, meldung) => {
      gefangen.aufrufe += 1;
      gefangen.empfaenger = [...ids];
      gefangen.meldung = meldung;
      return { success: true };
    });
    return gefangen;
  }

  // --------------------------------------------------------------
  describe('Der Termin lebt wieder', () => {
    it('setzt cancelled zurueck und raeumt alle sechs Absage-Felder', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');

      // Gegenprobe zur Ausgangslage: Vorher steht die Absage wirklich da.
      const vorher = await eventZeile(eventId);
      expect(vorher.cancelled).toBe(true);
      expect(vorher.cancelled_by).toBe(USERS.admin1.id);
      expect(vorher.cancelled_reason).toBe('Heizung defekt');
      expect(vorher.cancelled_at).not.toBeNull();
      expect(vorher.cancelled_reason_set_by).toBe(USERS.admin1.id);
      expect(vorher.cancelled_reason_set_at).not.toBeNull();

      const res = await reaktivieren(eventId);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Die Absage für "Konfifreizeit" wurde zurückgenommen');
      expect(res.body.reaktiviert).toBe(1);
      expect(res.body.participants_notified).toBe(1);

      const nachher = await eventZeile(eventId);
      expect(nachher.cancelled).toBe(false);
      expect(nachher.cancelled_at).toBeNull();
      expect(nachher.cancelled_by).toBeNull();
      // Der Grund beschreibt eine Absage, die es nicht mehr gibt.
      expect(nachher.cancelled_reason).toBeNull();
      expect(nachher.cancelled_reason_set_by).toBeNull();
      expect(nachher.cancelled_reason_set_at).toBeNull();
    });

    it('400, wenn der Termin gar nicht abgesagt ist — und nichts wird angefasst', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);

      const res = await reaktivieren(eventId);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Event ist nicht abgesagt');

      // Die Buchung steht unveraendert da.
      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('confirmed');
      expect(b.abgemeldet_durch_absage).toBe(false);
    });

    it('404 bei einem Termin aus einer fremden Organisation', async () => {
      const eventId = await termin();
      await absagen(eventId);

      // Der Org-Admin der ZWEITEN Organisation sieht den Termin nicht --
      // ein echter Seed-Benutzer, damit RBAC seine Organisation aus der
      // Datenbank laedt und nicht aus einem erfundenen Token.
      const res = await reaktivieren(eventId, generateToken('orgAdmin2'));
      expect(res.status).toBe(404);

      // Der Termin bleibt abgesagt.
      expect((await eventZeile(eventId)).cancelled).toBe(true);
    });
  });

  // --------------------------------------------------------------
  describe('Wer zurueckkommt — und auf welchen Status', () => {
    it('die durch die Absage Abgemeldeten sind wieder angemeldet, ohne Abmelde-Spuren', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');

      // Gegenprobe: Nach der Absage ist die Buchung wirklich abgemeldet.
      const nachAbsage = await buchung(eventId, USERS.konfi1.id);
      expect(nachAbsage.status).toBe('excused');
      expect(nachAbsage.attendance_status).toBe('excused');
      expect(nachAbsage.excuse_reason).toBe('Heizung defekt');
      expect(nachAbsage.abgemeldet_durch_absage).toBe(true);
      expect(nachAbsage.status_vor_absage).toBe('confirmed');

      expect((await reaktivieren(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('confirmed');
      expect(b.attendance_status).toBeNull();
      expect(b.excuse_reason).toBeNull();
      expect(b.abgemeldet_durch_absage).toBe(false);
      expect(b.status_vor_absage).toBeNull();
    });

    it('WER AUF DER WARTELISTE WAR, KOMMT AUF DIE WARTELISTE ZURUECK — nicht auf confirmed', async () => {
      // Zwei Plaetze, vier Anmeldungen: zwei bestaetigt, zwei warten.
      const eventId = await termin({ maxParticipants: 2, warteliste: true });
      await buche(eventId, konfiToken);            // konfi1  -> confirmed
      await buche(eventId, konfiTokens.A);          // A       -> confirmed
      await buche(eventId, konfiTokens.B);          // B       -> waitlist
      await buche(eventId, konfiTokens.C);          // C       -> waitlist

      // Gegenprobe zur Ausgangslage: Die Aufteilung stimmt wirklich.
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_A)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_B)).status).toBe('waitlist');
      expect((await buchung(eventId, KONFI_C)).status).toBe('waitlist');

      await absagen(eventId);

      // Nach der Absage sehen alle vier gleich aus -- genau deshalb braucht
      // es status_vor_absage.
      for (const id of [USERS.konfi1.id, KONFI_A, KONFI_B, KONFI_C]) {
        expect((await buchung(eventId, id)).status).toBe('excused');
      }
      expect((await buchung(eventId, KONFI_B)).status_vor_absage).toBe('waitlist');

      expect((await reaktivieren(eventId)).status).toBe(200);

      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_A)).status).toBe('confirmed');
      // DAS IST DER PUNKT: B und C haben nie einen Platz gehabt.
      expect((await buchung(eventId, KONFI_B)).status).toBe('waitlist');
      expect((await buchung(eventId, KONFI_C)).status).toBe('waitlist');

      // Und der Termin ist nicht ueberbucht: genau zwei Bestaetigte auf zwei
      // Plaetzen.
      const { rows: [zaehler] } = await db.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'confirmed')::int as bestaetigt,
                COUNT(*) FILTER (WHERE status = 'waitlist')::int as wartend
           FROM event_bookings WHERE event_id = $1`,
        [eventId]
      );
      expect(zaehler.bestaetigt).toBe(2);
      expect(zaehler.wartend).toBe(2);
    });

    it('SIMONS KERNFALL: wer sich VOR der Absage selbst abgemeldet hat, bleibt abgemeldet', async () => {
      // Pflichttermin -- nur da gibt es den Konfi-Opt-out.
      const eventId = await termin();
      await db.query('UPDATE events SET mandatory = true WHERE id = $1', [eventId]);
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);

      // konfi1 meldet sich SELBST ab, bevor der Termin abgesagt wird.
      const optOut = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub mit den Eltern' });
      expect(optOut.status).toBe(200);

      // Gegenprobe zur Ausgangslage.
      const vorAbsage = await buchung(eventId, USERS.konfi1.id);
      expect(vorAbsage.status).toBe('opted_out');
      expect(vorAbsage.abgemeldet_durch_absage).toBe(false);

      await absagen(eventId, 'Heizung defekt');

      // Die Absage laesst die Selbstabmeldung in Ruhe (sie waehlt nur
      // 'confirmed'/'waitlist').
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('opted_out');

      expect((await reaktivieren(eventId)).status).toBe(200);

      // DAS IST SIMONS FALL: Sie bleibt abgemeldet.
      const nachher = await buchung(eventId, USERS.konfi1.id);
      expect(nachher.status).toBe('opted_out');
      expect(nachher.abgemeldet_durch_absage).toBe(false);
      // A dagegen ist wieder angemeldet.
      expect((await buchung(eventId, KONFI_A)).status).toBe('confirmed');
    });

    it('SIMONS KERNFALL: wer VOR der Absage von der Leitung abgemeldet wurde, bleibt abgemeldet', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);

      // Die Leitung meldet konfi1 einzeln ab -- die Mutter hat angerufen.
      const abmelden = await request(app)
        .put(`/api/events/${eventId}/participants/${await buchungsId(eventId, USERS.konfi1.id)}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen' });
      expect(abmelden.status).toBe(200);

      // Gegenprobe zur Ausgangslage: 'excused', ABER nicht aus einer Absage.
      const vorAbsage = await buchung(eventId, USERS.konfi1.id);
      expect(vorAbsage.status).toBe('excused');
      expect(vorAbsage.attendance_status).toBe('excused');
      expect(vorAbsage.abgemeldet_durch_absage).toBe(false);
      expect(vorAbsage.excuse_reason).toBe('krank, Mutter hat angerufen');

      await absagen(eventId, 'Heizung defekt');
      expect((await reaktivieren(eventId)).status).toBe(200);

      // DAS IST SIMONS FALL, zweite Haelfte: "Status bei allen zurück außer
      // bei denen." Der persoenliche Grund steht weiter da.
      const nachher = await buchung(eventId, USERS.konfi1.id);
      expect(nachher.status).toBe('excused');
      expect(nachher.attendance_status).toBe('excused');
      expect(nachher.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(nachher.abgemeldet_durch_absage).toBe(false);
      // A ist wieder angemeldet.
      expect((await buchung(eventId, KONFI_A)).status).toBe('confirmed');
    });

    it('wer schon auf present oder absent stand, bleibt unangetastet', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);
      await buche(eventId, konfiTokens.B);

      await request(app)
        .put(`/api/events/${eventId}/participants/${await buchungsId(eventId, USERS.konfi1.id)}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' })
        .expect(200);
      await request(app)
        .put(`/api/events/${eventId}/participants/${await buchungsId(eventId, KONFI_A)}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent' })
        .expect(200);

      await absagen(eventId, 'Heizung defekt');

      // Gegenprobe: Die Absage hat die beiden nicht angefasst.
      expect((await buchung(eventId, USERS.konfi1.id)).attendance_status).toBe('present');
      expect((await buchung(eventId, KONFI_A)).attendance_status).toBe('absent');

      expect((await reaktivieren(eventId)).status).toBe(200);

      const anwesend = await buchung(eventId, USERS.konfi1.id);
      expect(anwesend.attendance_status).toBe('present');
      expect(anwesend.status).toBe('confirmed');
      expect(anwesend.abgemeldet_durch_absage).toBe(false);

      const abwesend = await buchung(eventId, KONFI_A);
      expect(abwesend.attendance_status).toBe('absent');
      expect(abwesend.status).toBe('confirmed');
      expect(abwesend.abgemeldet_durch_absage).toBe(false);

      // Nur B war durch die Absage abgemeldet und kommt zurueck.
      expect((await buchung(eventId, KONFI_B)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_B)).attendance_status).toBeNull();
    });

    it('ohne status_vor_absage (Altbestand) faellt es auf confirmed zurueck', async () => {
      // Bestandsdaten von vor Migration 155: abgemeldet_durch_absage steht,
      // status_vor_absage nicht. Migration 153 hat genau solche Zeilen
      // hergestellt.
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId);
      await db.query(
        'UPDATE event_bookings SET status_vor_absage = NULL WHERE event_id = $1',
        [eventId]
      );
      expect((await buchung(eventId, USERS.konfi1.id)).status_vor_absage).toBeNull();

      expect((await reaktivieren(eventId)).status).toBe(200);

      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });
  });

  // --------------------------------------------------------------
  describe('Punkte kommen NICHT zurueck', () => {
    it('die Absage nimmt die Punkte, das Zuruecknehmen gibt sie nicht wieder', async () => {
      // Simon: "Bleiben weg, neu vergeben" -- der Termin findet ja erst statt.
      const eventId = await termin({ punkte: 5 });
      await buche(eventId, konfiToken);

      // Anwesenheit verbuchen gibt Punkte ...
      await request(app)
        .put(`/api/events/${eventId}/participants/${await buchungsId(eventId, USERS.konfi1.id)}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' })
        .expect(200);

      const punkteNachher = async () => {
        const { rows: [p] } = await db.query(
          'SELECT gemeinde_points, gottesdienst_points FROM konfi_profiles WHERE user_id = $1',
          [USERS.konfi1.id]
        );
        const { rows: ep } = await db.query(
          'SELECT points FROM event_points WHERE event_id = $1 AND konfi_id = $2',
          [eventId, USERS.konfi1.id]
        );
        return { profil: p, eintraege: ep.length };
      };

      const mitPunkten = await punkteNachher();
      expect(mitPunkten.eintraege).toBe(1);
      const summeVorher = mitPunkten.profil.gemeinde_points + mitPunkten.profil.gottesdienst_points;
      expect(summeVorher).toBe(5);

      // ... die Anwesenheit zuruecknehmen, damit die Absage die Buchung
      // ueberhaupt greift (sie waehlt nur attendance_status IS NULL). Die
      // Punkte bleiben dabei am Termin haengen -- genau der Stand, den
      // meldeAlleAbBeiAbsage abraeumt.
      await db.query(
        'UPDATE event_bookings SET attendance_status = NULL WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );

      await absagen(eventId, 'Heizung defekt');

      // Gegenprobe: Die Absage hat die Punkte wirklich zurueckgenommen.
      const nachAbsage = await punkteNachher();
      expect(nachAbsage.eintraege).toBe(0);
      expect(nachAbsage.profil.gemeinde_points + nachAbsage.profil.gottesdienst_points).toBe(0);

      expect((await reaktivieren(eventId)).status).toBe(200);

      // DAS IST DIE ENTSCHEIDUNG: Sie bleiben weg.
      const nachReakt = await punkteNachher();
      expect(nachReakt.eintraege).toBe(0);
      expect(nachReakt.profil.gemeinde_points + nachReakt.profil.gottesdienst_points).toBe(0);
      // Die Buchung ist trotzdem wieder offen und verbuchbar.
      expect((await buchung(eventId, USERS.konfi1.id)).attendance_status).toBeNull();
    });
  });

  // --------------------------------------------------------------
  describe('Der Push "Findet doch statt"', () => {
    it('geht an GENAU die Reaktivierten — nicht an die dauerhaft Abgemeldeten', async () => {
      const eventId = await termin();
      await db.query('UPDATE events SET mandatory = true WHERE id = $1', [eventId]);
      await buche(eventId, konfiToken);      // konfi1: meldet sich selbst ab
      await buche(eventId, konfiTokens.A);   // A: wird von der Leitung abgemeldet
      await buche(eventId, konfiTokens.B);   // B: kommt zurueck
      await buche(eventId, konfiTokens.C);   // C: kommt zurueck

      await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub mit den Eltern' })
        .expect(200);
      await request(app)
        .put(`/api/events/${eventId}/participants/${await buchungsId(eventId, KONFI_A)}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' })
        .expect(200);

      await absagen(eventId, 'Heizung defekt');

      const push = pushSpion();
      const res = await reaktivieren(eventId);
      expect(res.status).toBe(200);

      expect(push.aufrufe).toBe(1);
      // KONKRETE EMPFAENGERLISTE, nicht nur die Anzahl: Wer abgemeldet
      // bleibt, darf keine Nachricht bekommen, die ihn nichts angeht.
      expect([...push.empfaenger].sort((a, b) => a - b)).toEqual([KONFI_B, KONFI_C]);
      expect(push.empfaenger).not.toContain(USERS.konfi1.id);
      expect(push.empfaenger).not.toContain(KONFI_A);

      expect(res.body.reaktiviert).toBe(2);
      expect(res.body.participants_notified).toBe(2);
    });

    it('Wortlaut, Typ und Sprungziel', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');

      const push = pushSpion();
      expect((await reaktivieren(eventId)).status).toBe(200);

      expect(push.meldung.title).toBe('Termin findet doch statt');
      expect(push.meldung.body.startsWith('"Konfifreizeit" am ')).toBe(true);
      expect(push.meldung.body.endsWith(
        'findet doch statt. Du bist wieder angemeldet – prüf bitte, ob du Zeit hast, und melde dich sonst ab.'
      )).toBe(true);
      expect(push.meldung.data.type).toBe('event_reactivated');
      expect(push.meldung.data.event_name).toBe('Konfifreizeit');
      // Sprungziel: Wer den Push antippt, landet am Termin -- dort meldet er
      // sich ab, wenn er doch nicht kann.
      expect(push.meldung.data.event_id).toBe(String(eventId));
      expect(push.meldung.data.organization_id).toBe('1');
      // Der Absagegrund gehoert NICHT hinein: Er beschreibt eine Absage, die
      // es nicht mehr gibt.
      expect(push.meldung.data.cancelled_reason).toBeUndefined();
    });

    it('niemand reaktiviert -> gar kein Push', async () => {
      // Termin ohne Buchungen: Es gibt nichts wiederherzustellen.
      const eventId = await termin();
      await absagen(eventId, 'Heizung defekt');

      const push = pushSpion();
      const res = await reaktivieren(eventId);

      expect(res.status).toBe(200);
      expect(res.body.reaktiviert).toBe(0);
      expect(push.aufrufe).toBe(0);
      // Der Termin lebt trotzdem wieder.
      expect((await eventZeile(eventId)).cancelled).toBe(false);
    });
  });

  // --------------------------------------------------------------
  describe('Berechtigung', () => {
    it('ERLAUBT: eine Teamer:in darf zuruecknehmen — sie darf auch absagen', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt', teamerToken);

      const res = await reaktivieren(eventId, teamerToken);

      expect(res.status).toBe(200);
      expect((await eventZeile(eventId)).cancelled).toBe(false);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });

    it('VERBOTEN: eine Konfi bekommt 403 — der Termin bleibt abgesagt', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');

      const res = await reaktivieren(eventId, konfiToken);

      expect(res.status).toBe(403);
      const e = await eventZeile(eventId);
      expect(e.cancelled).toBe(true);
      expect(e.cancelled_reason).toBe('Heizung defekt');
      // Und die Abmeldung steht unveraendert.
      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('excused');
      expect(b.abgemeldet_durch_absage).toBe(true);
    });

    it('VERBOTEN: fremder Jahrgang — 403, nichts geaendert', async () => {
      // Termin liegt im FREMDEN Jahrgang; ADMIN_MIT_JG ist nur in jahrgang1.
      const eventId = await termin({ jahrgangId: JG_FREMD });
      await absagen(eventId, 'Heizung defekt');

      const res = await reaktivieren(eventId, adminMitJgToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Termin');
      expect((await eventZeile(eventId)).cancelled).toBe(true);
    });

    it('ERLAUBT: eigener Jahrgang — dieselbe Person, anderer Termin', async () => {
      // Die Gegenprobe zum Test darueber: Nicht die Rolle sperrt, sondern der
      // Jahrgang.
      const eventId = await termin({ jahrgangId: JAHRGAENGE.jahrgang1.id });
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');

      const res = await reaktivieren(eventId, adminMitJgToken);

      expect(res.status).toBe(200);
      expect((await eventZeile(eventId)).cancelled).toBe(false);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });
  });

  // --------------------------------------------------------------
  describe('Danach ist der Termin wieder normal nutzbar', () => {
    it('Anmelden geht wieder', async () => {
      const eventId = await termin({ maxParticipants: 5 });
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');

      // Gegenprobe: An einem abgesagten Termin geht Anmelden NICHT.
      const waehrendAbsage = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiTokens.A}`);
      expect(waehrendAbsage.status).not.toBe(201);

      expect((await reaktivieren(eventId)).status).toBe(200);

      await buche(eventId, konfiTokens.A);
      expect((await buchung(eventId, KONFI_A)).status).toBe('confirmed');
    });

    it('DIE WARTELISTE RUECKT WIEDER NACH — der Guard greift nicht mehr', async () => {
      // Ein Platz, zwei Anmeldungen: konfi1 bestaetigt, A wartet.
      const eventId = await termin({ maxParticipants: 1, warteliste: true });
      await db.query('UPDATE events SET mandatory = true WHERE id = $1', [eventId]);
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_A)).status).toBe('waitlist');

      await absagen(eventId, 'Heizung defekt');
      expect((await reaktivieren(eventId)).status).toBe(200);

      // Beide sind auf ihrem alten Stand.
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_A)).status).toBe('waitlist');

      // konfi1 meldet sich ab -> der Platz wird frei -> A rueckt nach.
      await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub mit den Eltern' })
        .expect(200);

      // DAS IST DER PUNKT: Waere der Termin noch abgesagt, liefere
      // promoteFromWaitlist null und A bliebe auf der Warteliste stehen.
      expect((await buchung(eventId, KONFI_A)).status).toBe('confirmed');
    });

    it('waehrend der Absage rueckt niemand nach — die Gegenprobe zum Test darueber', async () => {
      const eventId = await termin({ maxParticipants: 1, warteliste: true });
      await db.query('UPDATE events SET mandatory = true WHERE id = $1', [eventId]);
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);

      await absagen(eventId, 'Heizung defekt');

      // Beide sind abgemeldet; das Freiwerden eines Platzes veraendert daran
      // nichts, weil an einem abgesagten Termin niemand nachrueckt.
      expect((await buchung(eventId, KONFI_A)).status).toBe('excused');
      expect((await buchung(eventId, KONFI_A)).status_vor_absage).toBe('waitlist');
    });
  });

  // --------------------------------------------------------------
  describe('Die Zahl fuer die Rueckfrage', () => {
    it('durch_absage_abgemeldet_count zaehlt nur, wer wirklich zurueckkommt', async () => {
      const eventId = await termin();
      await db.query('UPDATE events SET mandatory = true WHERE id = $1', [eventId]);
      await buche(eventId, konfiToken);      // meldet sich selbst ab
      await buche(eventId, konfiTokens.A);   // wird von der Leitung abgemeldet
      await buche(eventId, konfiTokens.B);   // kommt zurueck
      await buche(eventId, konfiTokens.C);   // kommt zurueck

      await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub mit den Eltern' })
        .expect(200);
      await request(app)
        .put(`/api/events/${eventId}/participants/${await buchungsId(eventId, KONFI_A)}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' })
        .expect(200);

      await absagen(eventId, 'Heizung defekt');

      const liste = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(liste.status).toBe(200);
      const eintrag = liste.body.find(e => e.id === eventId);
      expect(eintrag).toBeDefined();
      // Zwei, nicht vier: Die beiden vorher Abgemeldeten bleiben abgemeldet.
      expect(eintrag.durch_absage_abgemeldet_count).toBe(2);

      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.durch_absage_abgemeldet_count).toBe(2);

      // Und die Zahl deckt sich mit dem, was dann wirklich passiert.
      const res = await reaktivieren(eventId);
      expect(res.body.reaktiviert).toBe(2);
    });

    it('die Zahl steht in ALLEN DREI Lese-Pfaden — auch in GET /events', async () => {
      // Die Team-Ansicht nimmt ihren Termin aus GET /events, nicht aus
      // /events/cancelled. Fehlte die Spalte dort, naennte ihre Rueckfrage
      // immer "0 Personen" -- und liefe damit der Wirkung davon.
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);
      await absagen(eventId, 'Heizung defekt');

      const liste = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(liste.status).toBe(200);
      const ausListe = liste.body.find(e => e.id === eventId);
      expect(ausListe).toBeDefined();
      expect(ausListe.durch_absage_abgemeldet_count).toBe(2);

      const abgesagteListe = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(abgesagteListe.body.find(e => e.id === eventId).durch_absage_abgemeldet_count).toBe(2);

      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.body.durch_absage_abgemeldet_count).toBe(2);
    });

    it('nach dem Zuruecknehmen steht die Zahl auf 0', async () => {
      const eventId = await termin();
      await buche(eventId, konfiToken);
      await absagen(eventId, 'Heizung defekt');
      expect((await reaktivieren(eventId)).status).toBe(200);

      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.body.durch_absage_abgemeldet_count).toBe(0);
      expect(detail.body.cancelled).toBe(false);
    });
  });

  // --------------------------------------------------------------
  describe('Absagen, zuruecknehmen, wieder absagen', () => {
    it('der zweite Durchlauf verhaelt sich wie der erste', async () => {
      const eventId = await termin({ maxParticipants: 1, warteliste: true });
      await buche(eventId, konfiToken);
      await buche(eventId, konfiTokens.A);

      await absagen(eventId, 'Heizung defekt');
      expect((await reaktivieren(eventId)).status).toBe(200);

      // Zweite Absage -- mit einem anderen Grund.
      await absagen(eventId, 'Sturmwarnung');
      const nachZweiter = await buchung(eventId, KONFI_A);
      expect(nachZweiter.status).toBe('excused');
      expect(nachZweiter.excuse_reason).toBe('Sturmwarnung');
      expect(nachZweiter.status_vor_absage).toBe('waitlist');
      // Der alte Grund ist nicht als Vorbelegung zurueckgekommen.
      expect((await eventZeile(eventId)).cancelled_reason).toBe('Sturmwarnung');

      expect((await reaktivieren(eventId)).status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, KONFI_A)).status).toBe('waitlist');
    });
  });
});
