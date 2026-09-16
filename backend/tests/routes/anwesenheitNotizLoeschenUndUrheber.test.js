// Zwei Befunde aus Simons TestFlight-Lauf (13.09.2026).
//
// EINS -- Notiz loeschen: "Außerdem Vermerk löschen". Setzen und Aendern ging,
// Entfernen nicht: Im UPDATE stand `attendance_note = COALESCE($4,
// attendance_note)`, damit kam NULL nie durch. Ein leer geschicktes Feld
// bedeutet jetzt LOESCHEN; ein fehlendes Feld laesst die Notiz weiterhin
// stehen (so schicken ausgelieferte App-Fassungen, deren Verhalten sich NICHT
// aendern darf).
//
// ZWEI -- getrennte Urheber (Migration 149): "Was ist wenn einer einen Vermerk
// schreibt und einer den Grund. Wie wird das angezeigt." Mit einem einzigen
// Paar attendance_set_by/_at gar nicht -- wer zuletzt schrieb, ueberschrieb
// den anderen, und die Zeile behauptete, er habe beides eingetragen. Seither
// gilt attendance_set_by fuer STATUS samt Grund und note_set_by fuer die
// NOTIZ.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Notiz loeschen und getrennte Urheber fuer Status und Notiz', () => {
  let app;
  let db;
  let adminToken;
  // ZWEITE HANDELNDE PERSON: bis zum 16.09.2026 war das eine Teamer:in.
  // Seit die Anwesenheit hinter requireAdmin steht, bekaeme sie hier 403 --
  // und diese Tests pruefen nicht die Rolle, sondern WER ZULETZT GEAENDERT
  // HAT. Deshalb ist "Person B" jetzt ein zweiter Admin (orgAdmin1). Die
  // Rollen-Matrix zur Anwesenheit steht in rbacTermine.test.js.
  let zweiterAdminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    zweiterAdminToken = generateToken('orgAdmin1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  async function setupEvent({ points = 5 } = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Notiz-Event',
        event_date: futureDate.toISOString(),
        max_participants: 10,
        points,
        point_type: 'gemeinde',
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id;
    const konfiToken = generateToken('konfi1');
    await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
    const { rows: [booking] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, USERS.konfi1.id]
    );
    return { eventId, bookingId: booking.id };
  }

  const buchung = async (bookingId) => {
    const { rows } = await db.query(
      `SELECT attendance_status, excuse_reason, attendance_note,
              attendance_set_by, attendance_set_at, note_set_by, note_set_at
         FROM event_bookings WHERE id = $1`,
      [bookingId]
    );
    return rows[0];
  };

  const setze = (eventId, bookingId, token, body) =>
    request(app)
      .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  // ====================================================================
  // AUFGABE 2: Notiz loeschen
  // ====================================================================
  describe('Die Notiz laesst sich loeschen', () => {
    it('ein leer geschicktes Feld loescht die vorhandene Notiz', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });
      expect((await buchung(bookingId)).attendance_note).toBe('ging um 14 Uhr');

      const res = await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: ''
      });

      expect(res.status).toBe(200);
      expect((await buchung(bookingId)).attendance_note).toBeNull();
    });

    it('auch ein Feld aus Leerzeichen loescht', async () => {
      // "Gar keine Notiz" und "Notiz aus Leerzeichen" sind dasselbe --
      // sonst haette die Liste eine leere Zeile ohne Inhalt.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });

      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: '   '
      });

      expect((await buchung(bookingId)).attendance_note).toBeNull();
    });

    // GEGENPROBE ZUM ALT-APP-VERTRAG: Ausgelieferte App-Fassungen schicken
    // attendance_note gar nicht mit. Deren Verhalten darf sich NICHT aendern
    // -- ein Statuswechsel ohne das Feld muss die Notiz weiterhin stehen
    // lassen. Genau das unterscheidet "Feld fehlt" von "Feld ist leer".
    it('ein FEHLENDES Feld laesst die Notiz stehen (alte App-Fassungen)', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });

      // So schickt eine ausgelieferte App: nur der Status, kein Textfeld.
      await setze(eventId, bookingId, adminToken, { attendance_status: 'absent' });

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('absent');
      expect(b.attendance_note).toBe('ging um 14 Uhr');
    });

    it('eine geloeschte Notiz laesst sich wieder setzen', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, { attendance_status: 'present', attendance_note: 'erst so' });
      await setze(eventId, bookingId, adminToken, { attendance_status: 'present', attendance_note: '' });
      await setze(eventId, bookingId, adminToken, { attendance_status: 'present', attendance_note: 'dann so' });

      expect((await buchung(bookingId)).attendance_note).toBe('dann so');
    });

    it('das Loeschen der Notiz laesst den Abmeldegrund unberuehrt', async () => {
      // Zwei getrennte Felder: Wer die Notiz entfernt, entfernt nicht die
      // Abmeldung.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen',
        attendance_note: 'Attest liegt vor'
      });

      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen',
        attendance_note: ''
      });

      const b = await buchung(bookingId);
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_note).toBeNull();
      expect(b.attendance_status).toBe('excused');
    });

    it('das Loeschen der Notiz aendert den Status nicht und nimmt keine Punkte', async () => {
      const { eventId, bookingId } = await setupEvent({ points: 5 });
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });
      const { rows: [profilVorher] } = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]
      );
      expect(profilVorher.gemeinde_points).toBe(5);

      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: ''
      });

      expect((await buchung(bookingId)).attendance_status).toBe('present');
      const { rows: [profilNachher] } = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]
      );
      expect(profilNachher.gemeinde_points).toBe(5);
    });
  });

  // ====================================================================
  // AUFGABE 4: Urheber getrennt fuehren
  // ====================================================================
  describe('Status und Notiz haben je eigene Urheber', () => {
    it('wer den Status setzt, steht im Status-Paar', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, { attendance_status: 'present' });

      const b = await buchung(bookingId);
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.attendance_set_at).not.toBeNull();
      // Ohne mitgeschickte Notiz bleibt das Notiz-Paar leer: Es gibt keine
      // Notiz, also auch niemanden, der sie geschrieben haette.
      expect(b.note_set_by).toBeNull();
      expect(b.note_set_at).toBeNull();
    });

    it('wer die Notiz schreibt, steht im Notiz-Paar', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });

      const b = await buchung(bookingId);
      expect(b.note_set_by).toBe(USERS.admin1.id);
      expect(b.note_set_at).not.toBeNull();
    });

    // DER KERN VON SIMONS BEFUND: A traegt den Grund ein, B spaeter die Notiz.
    // Vor Migration 149 ueberschrieb B das eine Paar -- die Zeile behauptete
    // dann, B habe auch den Grund eingetragen.
    it('schreibt B nur die Notiz, bleibt A als Urheber des Status stehen', async () => {
      const { eventId, bookingId } = await setupEvent();
      // A (admin1) meldet ab, mit Grund.
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen'
      });
      // B (orgAdmin1) traegt spaeter nur eine Notiz nach -- mit demselben
      // Status, weil die Route ihn verlangt, und mit demselben Grund, damit
      // er nicht verloren geht.
      await setze(eventId, bookingId, zweiterAdminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen',
        attendance_note: 'Attest liegt vor'
      });

      const b = await buchung(bookingId);
      expect(b.note_set_by).toBe(USERS.orgAdmin1.id);
      // Hier faellt der Test ohne Migration 149: attendance_set_by stuende
      // auf B, und die Zeile behauptete, er habe den Grund aufgenommen.
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_note).toBe('Attest liegt vor');
    });

    it('aendert B spaeter den Status, bleibt A als Urheber der Notiz stehen', async () => {
      // Die Gegenrichtung: A schreibt die Notiz, B setzt danach den Status.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });
      // B setzt nur den Status -- ohne das Notiz-Feld, wie eine alte App.
      await setze(eventId, bookingId, zweiterAdminToken, { attendance_status: 'absent' });

      const b = await buchung(bookingId);
      expect(b.attendance_set_by).toBe(USERS.orgAdmin1.id);
      expect(b.note_set_by).toBe(USERS.admin1.id);
      expect(b.attendance_note).toBe('ging um 14 Uhr');
    });

    it('wird die Notiz geloescht, faellt auch ihr Urheber weg', async () => {
      // Ohne Notiz gibt es nichts, dessen Urheberschaft festzuhalten waere --
      // ein stehengebliebener Name behauptete eine Notiz, die es nicht gibt.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });
      expect((await buchung(bookingId)).note_set_by).toBe(USERS.admin1.id);

      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: ''
      });

      const b = await buchung(bookingId);
      expect(b.attendance_note).toBeNull();
      expect(b.note_set_by).toBeNull();
      expect(b.note_set_at).toBeNull();
      // Der Status-Urheber bleibt: Der Status steht ja weiterhin da.
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
    });

    it('ein erneutes Speichern desselben Standes aendert keinen Urheber', async () => {
      // "Feld kam mit" heisst nicht "jemand hat es geaendert": Wer nur eine
      // Notiz nachtraegt, MUSS den Status mitschicken (die Route verlangt
      // ihn). Wuerde das schon als Statusaenderung zaehlen, waere die
      // Trennung der beiden Paare wirkungslos.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });
      const vorher = await buchung(bookingId);

      // B schickt exakt denselben Stand noch einmal.
      await setze(eventId, bookingId, zweiterAdminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });

      const nachher = await buchung(bookingId);
      expect(nachher.attendance_set_by).toBe(USERS.admin1.id);
      expect(nachher.note_set_by).toBe(USERS.admin1.id);
      expect(nachher.attendance_set_at.getTime()).toBe(vorher.attendance_set_at.getTime());
      expect(nachher.note_set_at.getTime()).toBe(vorher.note_set_at.getTime());
    });

    it('aendert jemand Status UND Notiz zugleich, werden beide Paare gesetzt', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });

      await setze(eventId, bookingId, zweiterAdminToken, {
        attendance_status: 'absent',
        attendance_note: 'doch nicht da gewesen'
      });

      const b = await buchung(bookingId);
      expect(b.attendance_set_by).toBe(USERS.orgAdmin1.id);
      expect(b.note_set_by).toBe(USERS.orgAdmin1.id);
    });

    it('aendert sich nur der Grund, zaehlt das als Statusaenderung', async () => {
      // Der Grund gehoert zum Status (er wird beim Statuswechsel mit geleert)
      // und hat deshalb kein eigenes Paar. Wer ihn korrigiert, ist die
      // Person, bei der man nachfragt.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank'
      });

      await setze(eventId, bookingId, zweiterAdminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen'
      });

      const b = await buchung(bookingId);
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_set_by).toBe(USERS.orgAdmin1.id);
    });

    it('das Notiz-Paar bleibt unberuehrt, wenn das Feld gar nicht mitkommt', async () => {
      // Gegenprobe zum Alt-App-Vertrag auf der Urheber-Seite: Eine alte App
      // schickt nur den Status. Sie darf den Notiz-Urheber weder setzen noch
      // loeschen.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });
      const vorher = await buchung(bookingId);

      await setze(eventId, bookingId, zweiterAdminToken, { attendance_status: 'present' });

      const nachher = await buchung(bookingId);
      expect(nachher.note_set_by).toBe(USERS.admin1.id);
      expect(nachher.note_set_at.getTime()).toBe(vorher.note_set_at.getTime());
    });
  });

  // ====================================================================
  // Die Liste liefert beide Namen mit
  // ====================================================================
  describe('GET /api/events/:id liefert beide Urheber-Namen', () => {
    it('nennt Status-Urheber und Notiz-Urheber getrennt', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank'
      });
      await setze(eventId, bookingId, zweiterAdminToken, {
        attendance_status: 'excused',
        excuse_reason: 'krank',
        attendance_note: 'Attest liegt vor'
      });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const p = res.body.participants.find(x => x.id === bookingId);
      expect(p.attendance_set_by_name).toBe(USERS.admin1.display_name);
      expect(p.note_set_by_name).toBe(USERS.orgAdmin1.display_name);
      expect(p.note_set_at).not.toBeNull();
    });

    // GEGENPROBE ZUM LEFT JOIN: Ein INNER JOIN auf den Notiz-Urheber wuerde
    // jede Buchung ohne Notiz aus der Liste werfen -- und das sind fast alle.
    it('eine Buchung ohne Notiz bleibt in der Liste, mit note_set_by_name null', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, adminToken, { attendance_status: 'present' });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const p = res.body.participants.find(x => x.id === bookingId);
      expect(p).toBeTruthy();
      expect(p.note_set_by_name).toBeNull();
      expect(p.attendance_set_by_name).toBe(USERS.admin1.display_name);
    });

    it('eine Buchung ganz ohne Anwesenheit bleibt ebenfalls in der Liste', async () => {
      // Beide LEFT JOINs zugleich leer -- der Normalfall vor dem Verbuchen.
      const { eventId, bookingId } = await setupEvent();

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const p = res.body.participants.find(x => x.id === bookingId);
      expect(p).toBeTruthy();
      expect(p.attendance_set_by_name).toBeNull();
      expect(p.note_set_by_name).toBeNull();
    });
  });

  // ====================================================================
  // Sammelverbuchung: Status ja, Notiz nein
  // ====================================================================
  describe('Alle verbuchen setzt nur das Status-Paar', () => {
    it('schreibt den Urheber des Status, nicht den der Notiz', async () => {
      const { eventId, bookingId } = await setupEvent();

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolle: 'konfi' });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('present');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.note_set_by).toBeNull();
    });

    it('laesst eine vorhandene Notiz und ihren Urheber in Ruhe', async () => {
      // "Alle verbuchen" fasst nur unverbuchte Zeilen an -- eine Zeile mit
      // Notiz ist bereits verbucht und bleibt unberuehrt.
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, zweiterAdminToken, {
        attendance_status: 'present',
        attendance_note: 'ging um 14 Uhr'
      });

      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolle: 'konfi' });

      const b = await buchung(bookingId);
      expect(b.attendance_note).toBe('ging um 14 Uhr');
      expect(b.note_set_by).toBe(USERS.orgAdmin1.id);
      expect(b.attendance_set_by).toBe(USERS.orgAdmin1.id);
    });
  });
});
