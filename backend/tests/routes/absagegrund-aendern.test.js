// Absagegrund eines BEREITS abgesagten Termins aendern, nachtragen oder
// loeschen (Migration 152, 15.09.2026).
//
// Simons Befund: Ein Termin ist abgesagt, der Grund fehlt oder hat einen
// Tippfehler. Rankommen ging nicht -- PUT /events/:id/cancel lehnt einen
// bereits abgesagten Termin mit 400 ab. Wer beim Absagen in Eile nichts
// eingetragen hatte, hatte die Gelegenheit fuer immer verpasst.
//
// DER WUNDE PUNKT IST DIE ALTE ROUTE: Die 400 in /cancel ist Vertrag.
// Ausgelieferte App-Fassungen verlassen sich darauf, dass ein zweiter Aufruf
// abprallt -- etwa beim Doppeltippen auf wackeligem Netz. Deshalb eine NEUE
// Route, und deshalb ein Test, der die alte in Ruhe laesst und nachweist,
// dass sie sich nicht veraendert hat.
//
// UND DER ZWEITE: cancelled_by darf beim Korrigieren NICHT wechseln. Sonst
// staende unter dem Termin "Abgesagt von Anna Meier", weil Anna einen
// Buchstaben getauscht hat. Wer abgesagt hat, hat abgesagt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');
const PushService = require('../../services/pushService');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const JG_FREMD = 312;       // Jahrgang, in dem ADMIN_MIT_JG NICHT ist
const ADMIN_MIT_JG = 412;   // Admin, nur in jahrgang1
const ZWEITER_ADMIN = 413;  // Korrigiert spaeter den Grund, hat NICHT abgesagt

function tokenFuer(id, roleId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Absagegrund aendern: PUT /api/events/:id/absagegrund', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
  let adminMitJgToken;
  let zweiterAdminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // Spies IMMER zuruecksetzen, auch wenn eine Assertion vorher geworfen hat
  // (dieselbe Falle wie in absagegrund.test.js, 15.09.2026).
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');

    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 Fremd (Grund)', 1, '2027-05-01')`,
      [JG_FREMD]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'grund_admin', 'x', 'Grund Admin', 3, 1, true),
              ($2, 'grund_admin2', 'x', 'Anna Meier', 3, 1, true)`,
      [ADMIN_MIT_JG, ZWEITER_ADMIN]
    );
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true), ($3, $2, true, true)`,
      [ADMIN_MIT_JG, JAHRGAENGE.jahrgang1.id, ZWEITER_ADMIN]
    );
    adminMitJgToken = tokenFuer(ADMIN_MIT_JG, 3);
    zweiterAdminToken = tokenFuer(ZWEITER_ADMIN, 3);

    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(USERS.admin1.id);
    invalidateUserCache(ADMIN_MIT_JG);
    invalidateUserCache(ZWEITER_ADMIN);
  });

  // Termin mit angemeldeter konfi1 — damit sichtbar wird, ob beim Aendern des
  // Grundes faelschlich ein Push rausgeht (ohne Teilnehmende wuerde die
  // Cancel-Route ihn ohnehin ueberspringen, der Test bewiese dann nichts).
  async function terminMitKonfi() {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Konfifreizeit',
        event_date: futureDate.toISOString(),
        max_participants: 10,
        points: 0,
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id;
    const buchung = await request(app)
      .post(`/api/events/${eventId}/book`)
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(buchung.status).toBe(201);
    return eventId;
  }

  // Sagt ab und liefert die Event-Id zurueck. grund === null heisst: ohne.
  async function abgesagterTermin(grund, token = adminToken) {
    const eventId = await terminMitKonfi();
    const res = await request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send(grund === null ? {} : { cancelled_reason: grund });
    expect(res.status).toBe(200);
    return eventId;
  }

  const termin = async (eventId) => {
    const { rows: [row] } = await db.query(
      `SELECT cancelled, cancelled_reason, cancelled_by, cancelled_at,
              cancelled_reason_set_by, cancelled_reason_set_at
         FROM events WHERE id = $1`,
      [eventId]
    );
    return row;
  };

  describe('Nachtragen, aendern, loeschen', () => {
    it('traegt einen Grund nach, wo vorher keiner stand', async () => {
      const eventId = await abgesagterTermin(null);
      // Gegenprobe zur Ausgangslage: Vorher steht wirklich nichts da.
      expect((await termin(eventId)).cancelled_reason).toBeNull();

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(res.body.message).toBe('Absagegrund für "Konfifreizeit" wurde gespeichert');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled).toBe(true);
      expect(gespeichert.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(gespeichert.cancelled_reason_set_by).toBe(USERS.admin1.id);
      expect(gespeichert.cancelled_reason_set_at).not.toBeNull();
    });

    it('aendert einen vorhandenen Grund — der alte ist weg', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Wasserrohrbruch im Gemeindehaus' });

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBe('Wasserrohrbruch im Gemeindehaus');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBe('Wasserrohrbruch im Gemeindehaus');
    });

    it('loescht den Grund: leerer Text wird NULL, nicht ""', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: '   ' });

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBeNull();
      expect(res.body.message).toBe('Absagegrund für "Konfifreizeit" wurde entfernt');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBeNull();
    });

    it('ein fehlendes Feld loescht den Grund ebenfalls — die Route SETZT, sie ergaenzt nicht', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBeNull();
      expect((await termin(eventId)).cancelled_reason).toBeNull();
    });

    it('trimmt den Grund und begrenzt ihn auf 500 Zeichen — wie beim Absagen', async () => {
      const eventId = await abgesagterTermin(null);

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: `  ${'x'.repeat(600)}  ` });

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBe('x'.repeat(500));
      expect((await termin(eventId)).cancelled_reason).toBe('x'.repeat(500));
    });

    it('trimmt auch aussen, ohne innen zu kuerzen', async () => {
      const eventId = await abgesagterTermin(null);

      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: '  Heizung im Gemeindehaus defekt  ' });

      expect((await termin(eventId)).cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
    });
  });

  describe('Wer hat abgesagt, wer hat korrigiert', () => {
    it('cancelled_by BLEIBT beim Absagenden, auch wenn jemand anderes korrigiert', async () => {
      // admin1 sagt ab, Anna Meier korrigiert spaeter einen Tippfehler.
      const eventId = await abgesagterTermin('Heizung defkt');
      const vorher = await termin(eventId);
      expect(vorher.cancelled_by).toBe(USERS.admin1.id);
      expect(vorher.cancelled_reason_set_by).toBe(USERS.admin1.id);

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${zweiterAdminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });
      expect(res.status).toBe(200);

      const nachher = await termin(eventId);
      // DAS IST DER PUNKT: "Abgesagt von" darf nicht ploetzlich Anna nennen.
      expect(nachher.cancelled_by).toBe(USERS.admin1.id);
      // Wer korrigiert hat, steht trotzdem fest.
      expect(nachher.cancelled_reason_set_by).toBe(ZWEITER_ADMIN);
      expect(nachher.cancelled_reason).toBe('Heizung defekt');
    });

    it('cancelled_at bleibt ebenfalls stehen — die Absage war damals', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');
      const vorher = await termin(eventId);

      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${zweiterAdminToken}`)
        .send({ cancelled_reason: 'Wasserrohrbruch' });

      const nachher = await termin(eventId);
      expect(nachher.cancelled_at.getTime()).toBe(vorher.cancelled_at.getTime());
      // Der Grund-Zeitstempel dagegen wandert mit.
      expect(nachher.cancelled_reason_set_at.getTime())
        .toBeGreaterThanOrEqual(vorher.cancelled_reason_set_at.getTime());
    });

    it('beim Absagen zeigen beide Urheber auf dieselbe Person', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');
      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_by).toBe(USERS.admin1.id);
      expect(gespeichert.cancelled_reason_set_by).toBe(USERS.admin1.id);
    });
  });

  describe('Ausgeliefert wird der neue Stand', () => {
    it('Leitung sieht Grund und beide Namen in Liste, Detail und /events/cancelled', async () => {
      const eventId = await abgesagterTermin(null);

      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${zweiterAdminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      const liste = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(liste.status).toBe(200);
      const ausListe = liste.body.find(e => e.id === eventId);
      expect(ausListe.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(ausListe.cancelled_by_name).toBe(USERS.admin1.display_name);
      expect(ausListe.cancelled_reason_set_by_name).toBe('Anna Meier');

      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(detail.body.cancelled_by_name).toBe(USERS.admin1.display_name);
      expect(detail.body.cancelled_reason_set_by_name).toBe('Anna Meier');
      expect(detail.body.cancelled_reason_set_at).not.toBeNull();

      const abgesagt = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(abgesagt.status).toBe(200);
      const ausAbgesagt = abgesagt.body.find(e => e.id === eventId);
      expect(ausAbgesagt).toBeTruthy();
      expect(ausAbgesagt.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(ausAbgesagt.cancelled_reason_set_by_name).toBe('Anna Meier');
    });

    it('die Konfi sieht den nachgetragenen Grund — er ist fuer alle da', async () => {
      const eventId = await abgesagterTermin(null);

      const vorher = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(vorher.body.find(e => e.id === eventId).cancelled_reason).toBeNull();

      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      const nachher = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(nachher.status).toBe(200);
      const ausKonfiListe = nachher.body.find(e => e.id === eventId);
      expect(ausKonfiListe.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(ausKonfiListe.cancelled_by_name).toBe(USERS.admin1.display_name);
    });

    it('ein geloeschter Grund verschwindet auch in der Auslieferung', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: '' });

      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.body.cancelled_reason).toBeNull();

      const konfiListe = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(konfiListe.body.find(e => e.id === eventId).cancelled_reason).toBeNull();
    });
  });

  describe('Der korrigierte Grund erreicht auch die Teilnehmenden', () => {
    // DER FEHLER (15.09.2026): Die Absage meldet alle Angemeldeten ab und
    // traegt den Absagegrund als excuse_reason ein. Diese Route schrieb
    // danach nur an events.cancelled_reason — am Termin stand der korrigierte
    // Grund, in der Teilnehmerliste bei jeder Person weiter der alte.
    //
    // UND DIE GRENZE: Wer einen EIGENEN Grund bekommen hat ("krank, Mutter
    // hat angerufen"), behaelt ihn. Das Handbuch verspricht genau diesen Weg;
    // er darf nicht von der naechsten Tippfehler-Korrektur ueberschrieben
    // werden. Die Unterscheidung traegt abgemeldet_durch_absage
    // (Migration 153).

    const buchung = async (eventId, userId) => {
      const { rows: [row] } = await db.query(
        `SELECT excuse_reason, attendance_status, abgemeldet_durch_absage
           FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId]
      );
      return row;
    };

    it('der neue Grund steht danach auch bei der abgemeldeten Konfi', async () => {
      const eventId = await abgesagterTermin('Heizng defket');

      // Ausgangslage pruefen, sonst bewiese der Test unten nichts: Die Absage
      // hat wirklich abgemeldet, mit dem alten Text und als Absage erkennbar.
      const vorher = await buchung(eventId, USERS.konfi1.id);
      expect(vorher.attendance_status).toBe('excused');
      expect(vorher.excuse_reason).toBe('Heizng defket');
      expect(vorher.abgemeldet_durch_absage).toBe(true);

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });
      expect(res.status).toBe(200);

      const nachher = await buchung(eventId, USERS.konfi1.id);
      expect(nachher.excuse_reason).toBe('Heizung im Gemeindehaus defekt');
      // Der Abmeldestand selbst bleibt, wie er war — korrigiert wurde ein
      // Text, nicht die Abmeldung.
      expect(nachher.attendance_status).toBe('excused');
      expect(nachher.abgemeldet_durch_absage).toBe(true);
      // Und Termin und Buchung sagen jetzt dasselbe. Genau das lief vorher
      // auseinander.
      expect((await termin(eventId)).cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
    });

    it('VERBOTEN: ein von Hand eingetragener Grund bleibt unberuehrt', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      // Die Leitung ersetzt bei EINER Person den Grund durch einen eigenen —
      // der Weg, den das Handbuch beschreibt.
      const einzeln = await request(app)
        .put(`/api/events/${eventId}/participants/${USERS.konfi1.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen' });
      expect(einzeln.status).toBe(200);

      // Gegenprobe zur Ausgangslage: Diese Abmeldung gilt jetzt als
      // Einzelentscheidung, nicht mehr als Absage.
      const vorher = await buchung(eventId, USERS.konfi1.id);
      expect(vorher.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(vorher.abgemeldet_durch_absage).toBe(false);

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Wasserrohrbruch im Gemeindehaus' });
      expect(res.status).toBe(200);

      const nachher = await buchung(eventId, USERS.konfi1.id);
      expect(nachher.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(nachher.abgemeldet_durch_absage).toBe(false);
      // Am Termin steht trotzdem der neue Grund — die Korrektur ist
      // angekommen, sie hat nur diese eine Person in Ruhe gelassen.
      expect((await termin(eventId)).cancelled_reason).toBe('Wasserrohrbruch im Gemeindehaus');
    });

    it('ERLAUBT und VERBOTEN im selben Termin: die eine bekommt den neuen Text, die andere behaelt ihren', async () => {
      // Der Fall, um den es wirklich geht: Ein Termin, zwei Personen, ein
      // Durchlauf. Getrennte Tests koennten beide gruen sein, waehrend die
      // Auswahl in der Menge trotzdem falsch greift.
      const eventId = await abgesagterTermin('Heizng defket');

      // konfi2 dazubuchen und den Termin erneut absagen geht nicht (400).
      // Stattdessen wird die zweite Buchung direkt hergestellt — genau so,
      // wie die Absage sie angelegt haette.
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status,
                                     excuse_reason, abgemeldet_durch_absage)
         VALUES ($1, $2, 'excused', 'excused', 'Heizng defket', TRUE)`,
        [eventId, USERS.konfi2.id]
      );
      await request(app)
        .put(`/api/events/${eventId}/participants/${USERS.konfi1.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen' });

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });
      expect(res.status).toBe(200);

      expect((await buchung(eventId, USERS.konfi1.id)).excuse_reason)
        .toBe('krank, Mutter hat angerufen');
      expect((await buchung(eventId, USERS.konfi2.id)).excuse_reason)
        .toBe('Heizung im Gemeindehaus defekt');
    });

    it('wird der Grund geleert, steht bei den Abgemeldeten wieder "Termin abgesagt" — nicht NULL', async () => {
      // Dieselbe Regel wie beim Absagen ohne Grund (bookingUtils,
      // ABSAGE_OHNE_GRUND). NULL laese die Zeile als "abgemeldet, Grund
      // unbekannt" lesen — der Grund ist aber bekannt: Der Termin faellt aus.
      const eventId = await abgesagterTermin('Heizung defekt');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: '' });
      expect(res.status).toBe(200);
      expect((await termin(eventId)).cancelled_reason).toBeNull();

      expect((await buchung(eventId, USERS.konfi1.id)).excuse_reason).toBe('Termin abgesagt');
    });

    it('bei 403 bleibt auch der Grund an den Buchungen stehen', async () => {
      // Die Buchungen haengen an derselben Transaktion wie der Termin. Wird
      // die Aenderung abgewiesen, darf auch dort nichts umgeschrieben sein.
      const eventId = await abgesagterTermin('Heizung defekt');
      await db.query('DELETE FROM event_jahrgang_assignments WHERE event_id = $1', [eventId]);
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [eventId, JG_FREMD]
      );

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ cancelled_reason: 'Reingepfuscht' });

      expect(res.status).toBe(403);
      expect((await buchung(eventId, USERS.konfi1.id)).excuse_reason).toBe('Heizung defekt');
    });
  });

  describe('Kein Push bei einer Korrektur', () => {
    // Entscheidung Simon, 15.09.2026: Die Absage ist schon gemeldet. Ein
    // zweiter Push "Leider abgesagt" an dieselben zwanzig Konfis, weil jemand
    // einen Buchstaben getauscht hat, laese sich wie eine zweite Absage.
    it('weder beim Nachtragen noch beim Aendern noch beim Loeschen geht etwas raus', async () => {
      const eventId = await abgesagterTermin(null);

      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async () => ({ success: true }));

      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });
      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Wasserrohrbruch' });
      await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: '' });

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('Gegenprobe: dieselbe Konfi bekommt beim ABSAGEN sehr wohl einen Push', async () => {
      // Ohne diesen Test bewiese der vorige nichts: Er waere auch dann gruen,
      // wenn in dieser Testumgebung ueberhaupt kein Push zustande kaeme.
      const eventId = await terminMitKonfi();

      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async () => ({ success: true }));

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Nicht abgesagte und nicht vorhandene Termine', () => {
    it('ein LAUFENDER Termin wird mit 400 abgelehnt, nichts wird geschrieben', async () => {
      const eventId = await terminMitKonfi();

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Event ist nicht abgesagt');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled === true).toBe(false);
      expect(gespeichert.cancelled_reason).toBeNull();
      expect(gespeichert.cancelled_reason_set_by).toBeNull();
    });

    it('ein unbekannter Termin wird mit 404 abgelehnt', async () => {
      const res = await request(app)
        .put('/api/events/999999/absagegrund')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Event nicht gefunden');
    });
  });

  describe('Berechtigung: identisch zum Absagen', () => {
    // Legt einen ABGESAGTEN Termin direkt in der DB an, einem Jahrgang
    // zugeordnet — ueber die API ginge das im fremden Jahrgang gar nicht.
    async function abgesagterTerminImJahrgang(jahrgangId, grund = 'Alter Grund') {
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id,
                             max_participants, cancelled, cancelled_at, cancelled_reason, cancelled_by)
         VALUES ('Fremder Termin', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, 20,
                 TRUE, NOW(), $1, $2)
         RETURNING id`,
        [grund, USERS.admin1.id]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, jahrgangId]
      );
      return event.id;
    }

    it('VERBOTEN: fremder Jahrgang — 403, der Grund bleibt unveraendert', async () => {
      const eventId = await abgesagterTerminImJahrgang(JG_FREMD, 'Alter Grund');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ cancelled_reason: 'Reingepfuscht' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Termin');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBe('Alter Grund');
      expect(gespeichert.cancelled_reason_set_by).toBeNull();
    });

    it('ERLAUBT: eigener Jahrgang — 200, neuer Grund und Urheber stehen', async () => {
      const eventId = await abgesagterTerminImJahrgang(JAHRGAENGE.jahrgang1.id, 'Alter Grund');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ cancelled_reason: 'Neuer Grund' });

      expect(res.status).toBe(200);

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBe('Neuer Grund');
      expect(gespeichert.cancelled_reason_set_by).toBe(ADMIN_MIT_JG);
      // Auch hier: Die Absage stammt weiterhin von admin1.
      expect(gespeichert.cancelled_by).toBe(USERS.admin1.id);
    });

    it('VERBOTEN: eine Konfi aendert gar nichts — 403, der Grund bleibt', async () => {
      const eventId = await abgesagterTerminImJahrgang(JAHRGAENGE.jahrgang1.id, 'Alter Grund');

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ cancelled_reason: 'Faellt aus weil ich keine Lust habe' });

      expect(res.status).toBe(403);

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBe('Alter Grund');
      expect(gespeichert.cancelled_reason_set_by).toBeNull();
    });

    it('VERBOTEN: eine Konfi auch bei einem reinen TEAM-Termin — hier haelt nur die Rolle', async () => {
      // WARUM DIESER TEST NEBEN DEM VORIGEN: Bei einem jahrgangsgebundenen
      // Termin halten ZWEI Sperren gleichzeitig (requireTeamer und
      // darfTermin), und der Test oben kann nicht unterscheiden, welche davon
      // gegriffen hat. Bei einem teamer_only-Termin gibt darfTermin
      // ausdruecklich immer `erlaubt: true` zurueck (utils/jahrgangsZugriff.js:
      // "Reine Teamer-Termine haengen an keinem Jahrgang") -- hier haelt allein
      // requireTeamer. Faellt die Middleware weg, faellt genau dieser Test.
      // Aufgefallen bei der Gegenprobe (15.09.2026): Ohne ihn blieb die Suite
      // gruen, obwohl requireTeamer entfernt war.
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id,
                             max_participants, teamer_only, cancelled, cancelled_at, cancelled_reason)
         VALUES ('Teamrunde', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, 20,
                 TRUE, TRUE, NOW(), 'Alter Grund')
         RETURNING id`
      );

      const res = await request(app)
        .put(`/api/events/${event.id}/absagegrund`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ cancelled_reason: 'Reingepfuscht' });

      expect(res.status).toBe(403);
      expect((await termin(event.id)).cancelled_reason).toBe('Alter Grund');
    });

    it('VERBOTEN: eine Teamerin auch bei einem reinen TEAM-Termin — 403 (16.09.2026)', async () => {
      // UMGEDREHT, KEINE AUFWEICHUNG: Bis zum 16.09.2026 stand hier der
      // erlaubte Gegenpart ("requireTeamer laesst Teamer:innen durch").
      // Simon woertlich: "teamer erstellen keine veranstaltungen fertig. das
      // machen admins und org admins. [...] also auch nicht loeschen und
      // absagen". Auch der reine TEAM-Termin macht da keine Ausnahme -- der
      // Grund steht bei allen Teilnehmenden auf dem Bildschirm.
      //
      // Der erlaubte Gegenpart, ohne den sich die Sperre oben auch durch ein
      // pauschales 403 erfuellen liesse, steht jetzt direkt darunter mit
      // einem ADMIN-Token.
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id,
                             max_participants, teamer_only, cancelled, cancelled_at, cancelled_reason)
         VALUES ('Teamrunde', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, 20,
                 TRUE, TRUE, NOW(), 'Alter Grund')
         RETURNING id`
      );

      const res = await request(app)
        .put(`/api/events/${event.id}/absagegrund`)
        .set('Authorization', `Bearer ${generateToken('teamer1')}`)
        .send({ cancelled_reason: 'Neuer Grund' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');
      expect((await termin(event.id)).cancelled_reason).toBe('Alter Grund');
    });

    it('ERLAUBT: ein Admin bei demselben reinen TEAM-Termin — 200', async () => {
      // Der erlaubte Gegenpart zum Test darueber: darfTermin sperrt reine
      // Team-Termine bewusst nicht, es scheitert allein an der Rolle. Ohne
      // diesen Test liesse sich das 403 oben auch durch eine Route erfuellen,
      // die gar niemanden mehr durchlaesst.
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id,
                             max_participants, teamer_only, cancelled, cancelled_at, cancelled_reason)
         VALUES ('Teamrunde', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, 20,
                 TRUE, TRUE, NOW(), 'Alter Grund')
         RETURNING id`
      );

      const res = await request(app)
        .put(`/api/events/${event.id}/absagegrund`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({ cancelled_reason: 'Neuer Grund' });

      expect(res.status).toBe(200);
      expect((await termin(event.id)).cancelled_reason).toBe('Neuer Grund');
    });

    it('VERBOTEN: ein Termin aus einer FREMDEN Organisation — 404, nichts geaendert', async () => {
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id,
                             max_participants, cancelled, cancelled_at, cancelled_reason)
         VALUES ('Fremde Org', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 2, 20,
                 TRUE, NOW(), 'Alter Grund')
         RETURNING id`
      );

      const res = await request(app)
        .put(`/api/events/${event.id}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Reingepfuscht' });

      expect(res.status).toBe(404);
      expect((await termin(event.id)).cancelled_reason).toBe('Alter Grund');
    });
  });

  describe('Rueckwaertskompatibilitaet: PUT /cancel bleibt, wie es war', () => {
    // DER VERTRAG: Ausgelieferte App-Fassungen rufen /cancel auf und verlassen
    // sich darauf, dass ein zweiter Aufruf abprallt (Doppeltippen auf
    // wackeligem Netz). Naehme /cancel den Nachtrage-Fall mit, wuerde aus
    // einem folgenlosen Fehlschlag ein zweiter Schreibvorgang — und ein
    // vorhandener Grund waere nach jedem Doppeltipp weg.
    it('ein zweiter /cancel auf denselben Termin bleibt bei 400', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notification_message: 'Das Event wurde leider abgesagt.' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Event ist bereits abgesagt');
    });

    it('der Doppeltipp einer alten App laesst den Grund UNVERAENDERT stehen', async () => {
      const eventId = await abgesagterTermin('Heizung im Gemeindehaus defekt');

      // Eine alte App schickt ausschliesslich notification_message — kein
      // cancelled_reason. Wuerde /cancel den Fall mitnehmen, staende danach
      // NULL im Grund.
      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notification_message: 'Das Event wurde leider abgesagt.' });

      // Auf die 400 pruefen und NICHT nur darauf, dass der Grund noch
      // dasteht: Bei der Gegenprobe (15.09.2026) blieb dieser Test gruen,
      // obwohl der Guard entfernt war — die Route lief dann in einen
      // Folgefehler und antwortete mit 500, ohne zu schreiben. Der Grund
      // ueberlebte also aus dem falschen Grund.
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Event ist bereits abgesagt');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(gespeichert.cancelled_by).toBe(USERS.admin1.id);
    });

    it('der Doppeltipp loest KEINEN zweiten Push aus', async () => {
      const eventId = await abgesagterTermin('Heizung defekt');

      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async () => ({ success: true }));

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notification_message: 'Das Event wurde leider abgesagt.' });

      expect(res.status).toBe(400);
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });
});
