// MIGRATION 153 ZIEHT DEN BESTAND MIT -- und zwar idempotent.
//
// Die Migration ist beim Testlauf laengst durch (globalSetup spielt sie ein).
// Geprueft wird deshalb ihre WIRKUNG, indem der Vorher-Zustand kuenstlich
// wiederhergestellt und die Datenschritte erneut ausgefuehrt werden. Das ist
// naeher am Ernstfall als eine nachgebaute Kopie: gelesen wird die echte
// Datei aus backend/migrations/.
//
// WARUM DAS UEBERHAUPT GEPRUEFT WIRD: In Produktion standen am 15.09.2026
// sechs Buchungen auf attendance_status = 'excused' mit status = 'confirmed'.
// Bleiben die zurueck, gibt es dauerhaft zwei Sorten Abmeldung -- sechs, bei
// denen die Erinnerung weiter rausgeht und der Platz belegt bleibt, und alle
// uebrigen. Und ein zweiter Migrationslauf (Neuaufsetzen, Wiederholung nach
// Abbruch) darf daran nichts mehr aendern.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '153_abmeldung_im_buchungsstatus.sql'),
  'utf8'
);

// Nur die DATENschritte der Migration (Abschnitt C). Der DDL-Teil ist bereits
// angewandt und mit IF NOT EXISTS ohnehin wiederholbar; hier geht es um die
// beiden UPDATEs, an denen die Idempotenz haengt.
const DATENSCHRITTE = MIGRATION.slice(MIGRATION.indexOf('UPDATE event_bookings'));

describe('Migration 153: Bestandsdaten und Idempotenz', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  async function termin({ abgesagt = false } = {}) {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           point_type, points, cancelled)
       VALUES ('Konfistunde', NOW() - interval '3 days', $1, false, 20, 'gemeinde', 0, $2)
       RETURNING id`,
      [ORGS.testGemeinde.id, abgesagt]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [event.id, JAHRGAENGE.jahrgang1.id]
    );
    return event.id;
  }

  // Der Zustand VOR der Migration: attendance_status gesetzt, status noch
  // nicht mitgezogen, Kennzeichen auf dem Default.
  async function altbestand(eventId, userId, { status = 'confirmed', attendance = 'excused' } = {}) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, attendance_status,
                                   abgemeldet_durch_absage)
       VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
      [userId, eventId, status, ORGS.testGemeinde.id, attendance]
    );
    return b.id;
  }

  const buchung = async (bookingId) => {
    const { rows: [row] } = await db.query(
      'SELECT status, attendance_status, abgemeldet_durch_absage FROM event_bookings WHERE id = $1',
      [bookingId]
    );
    return row;
  };

  const migriere = () => db.query(DATENSCHRITTE);

  // Dieselben beiden UPDATEs einzeln, um ihre rowCounts zu sehen: Nur daran
  // laesst sich "es gibt nichts mehr zu tun" von "das Ergebnis sieht zufaellig
  // gleich aus" unterscheiden.
  async function zaehleAenderungen() {
    const client = await db.getClient();
    try {
      const a = await client.query(`
        UPDATE event_bookings
           SET status = 'excused'
         WHERE attendance_status = 'excused'
           AND status IN ('confirmed', 'waitlist')`);
      const b = await client.query(`
        UPDATE event_bookings eb
           SET abgemeldet_durch_absage = TRUE
          FROM events e
         WHERE e.id = eb.event_id
           AND e.cancelled = TRUE
           AND eb.status = 'excused'
           AND eb.attendance_status = 'excused'
           AND eb.abgemeldet_durch_absage = FALSE`);
      return [a.rowCount, b.rowCount];
    } finally {
      client.release();
    }
  }

  it('zieht eine Bestands-Abmeldung auf status = excused', async () => {
    const eventId = await termin();
    const bookingId = await altbestand(eventId, USERS.konfi1.id);
    expect((await buchung(bookingId)).status).toBe('confirmed');

    await migriere();

    const b = await buchung(bookingId);
    expect(b.status).toBe('excused');
    expect(b.attendance_status).toBe('excused');
  });

  it('erkennt eine Abmeldung aus einer Terminabsage am abgesagten Termin', async () => {
    const abgesagt = await termin({ abgesagt: true });
    const normal = await termin();
    const ausAbsage = await altbestand(abgesagt, USERS.konfi1.id);
    const einzeln = await altbestand(normal, USERS.konfi2.id);

    await migriere();

    expect((await buchung(ausAbsage)).abgemeldet_durch_absage).toBe(true);
    expect((await buchung(einzeln)).abgemeldet_durch_absage).toBe(false);
  });

  it('laesst eine Wartelisten-Abmeldung ebenfalls auf excused laufen', async () => {
    const eventId = await termin();
    const bookingId = await altbestand(eventId, USERS.konfi1.id, { status: 'waitlist' });

    await migriere();

    expect((await buchung(bookingId)).status).toBe('excused');
  });

  it('laesst eine SELBSTabmeldung auf opted_out stehen', async () => {
    // Auch dann, wenn die Leitung sie spaeter als abgemeldet verbucht hat.
    // Das haelt anwesenheitSelbstabmeldungUndUrheber.test.js ausdruecklich
    // fest -- die Migration darf es nicht umschreiben.
    const eventId = await termin();
    const bookingId = await altbestand(eventId, USERS.konfi1.id, { status: 'opted_out' });

    await migriere();

    expect((await buchung(bookingId)).status).toBe('opted_out');
  });

  it('fasst Buchungen OHNE Abmeldung nicht an', async () => {
    // GEGENPROBE: Die Migration uebersetzt, sie interpretiert nicht. Auch am
    // abgesagten Termin bleibt eine anwesende Person anwesend.
    const abgesagt = await termin({ abgesagt: true });
    const anwesend = await altbestand(abgesagt, USERS.konfi1.id, { attendance: 'present' });
    const offen = await altbestand(abgesagt, USERS.konfi2.id, { attendance: null });

    await migriere();

    const a = await buchung(anwesend);
    expect(a.status).toBe('confirmed');
    expect(a.abgemeldet_durch_absage).toBe(false);
    const o = await buchung(offen);
    expect(o.status).toBe('confirmed');
    expect(o.abgemeldet_durch_absage).toBe(false);
  });

  it('IDEMPOTENT: der zweite Lauf aendert keine einzige Zeile', async () => {
    const abgesagt = await termin({ abgesagt: true });
    const normal = await termin();
    await altbestand(abgesagt, USERS.konfi1.id);
    await altbestand(normal, USERS.konfi2.id);
    await altbestand(normal, USERS.teamer1.id, { attendance: 'present' });

    await migriere();
    const { rows: nachErstem } = await db.query(
      'SELECT id, status, attendance_status, abgemeldet_durch_absage FROM event_bookings ORDER BY id'
    );

    // Der zweite Lauf: rowCount MUSS 0 sein -- nicht "das Ergebnis ist
    // zufaellig gleich", sondern "es gibt nichts mehr zu tun".
    const [erstes, zweites] = await zaehleAenderungen();
    expect(erstes).toBe(0);
    expect(zweites).toBe(0);

    const { rows: nachZweitem } = await db.query(
      'SELECT id, status, attendance_status, abgemeldet_durch_absage FROM event_bookings ORDER BY id'
    );
    expect(nachZweitem).toEqual(nachErstem);
  });

  it('GEGENPROBE zur Idempotenz: der ERSTE Lauf aendert sehr wohl Zeilen', async () => {
    // Ohne diese Probe wuerde der Test oben auch gruen bleiben, wenn die
    // Migration ueberhaupt nichts taete.
    const abgesagt = await termin({ abgesagt: true });
    await altbestand(abgesagt, USERS.konfi1.id);
    await altbestand(abgesagt, USERS.konfi2.id);

    const [erstes, zweites] = await zaehleAenderungen();
    expect(erstes).toBe(2);
    expect(zweites).toBe(2);
  });

  describe('Der Constraint nach der Migration', () => {
    it('erlaubt alle sechs vorgesehenen Werte', async () => {
      const eventId = await termin();
      const bookingId = await altbestand(eventId, USERS.konfi1.id, { attendance: null });
      for (const wert of ['confirmed', 'waitlist', 'cancelled', 'opted_out', 'pending', 'excused']) {
        await db.query('UPDATE event_bookings SET status = $2 WHERE id = $1', [bookingId, wert]);
        expect((await buchung(bookingId)).status).toBe(wert);
      }
    });

    it('und nichts darueber hinaus', async () => {
      const eventId = await termin();
      const bookingId = await altbestand(eventId, USERS.konfi1.id, { attendance: null });
      await expect(
        db.query("UPDATE event_bookings SET status = 'irgendwas' WHERE id = $1", [bookingId])
      ).rejects.toThrow(/event_bookings_status_check/);
    });
  });
});
