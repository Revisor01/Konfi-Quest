// Fremde Gemeinde: Wer aus Organisation 2 kommt, sieht und aendert nichts aus
// Organisation 1 -- an genau den Routen, fuer die das bisher kein Test bewies.
//
// Anlass (Audit Tests 26.09.2026, BF-01 und BF-05): Der Gemeinde-Filter der
// Termin-Detailansicht (GET /api/events/:id) liess sich entfernen, ohne dass
// einer der 223 Tests in den vier aufrufenden Dateien fiel. Mindestens 23
// weitere geschuetzte Routen hatten ebenfalls keinen Test mit einem Token der
// ANDEREN Gemeinde. Diese Datei holt das nach -- als eigene Datei, damit die
// bestehenden Testdateien unberuehrt bleiben.
//
// Muster je Route:
//   - verbotener Fall: Token aus Org 2 (konfi3 = 6, teamer2 = 7, admin2 = 8,
//     orgAdmin2 = 9) gegen ein Objekt aus Org 1 -> GENAU der Status, den die
//     Route heute liefert (404 oder 403; im Code nachgesehen), und KEIN Feld
//     des fremden Objekts in der Antwort.
//   - erlaubter Fall: eigene Gemeinde -> 200, knapp.
//   - Listen-Routen ohne Objekt-Kennung: Org-2-Token bekommt ausschliesslich
//     Org-2-Zeilen -- auch dann, wenn in der Datenbank eine Zeile mit
//     Org-1-Bezug fuer diese Person liegt.
//
// Zwei Routen liefern fuer fremde Kennungen heute 200 mit LEEREM Ergebnis
// (attendance-count: {0, 0}; konfi/events/:id/participants: []). Der Filter
// steht im Code, es fliesst nichts ab; ob 404 die bessere Antwort waere, ist
// Sicherheit BF-16 (NIEDRIG). Hier wird der heutige Stand festgeschrieben --
// samt Beleg, dass der Filter wirkt: Das Org-1-Objekt HAT Buchungen, und die
// fremde Antwort zeigt trotzdem keine.
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, EVENTS, CHAT_ROOMS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// Echte gueltige 1x1-PNG (file-type verlangt eine valide Struktur).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
// konfi.js schreibt Antragsfotos fest nach backend/uploads/requests (relativ
// zum Modul), nicht ins Zwischenlager der Test-App.
const REQUESTS_DIR = path.join(__dirname, '../../uploads/requests');

// Die Fehlerantwort traegt NUR das Feld error -- kein Name, kein Token, keine
// Kennung des fremden Objekts.
function nurFehler(body) {
  expect(Object.keys(body)).toEqual(['error']);
}

// Kein Wert des fremden Objekts steht irgendwo in der Antwort.
function ohneFremddaten(body, ...werte) {
  const text = JSON.stringify(body);
  for (const wert of werte) {
    expect(text).not.toContain(String(wert));
  }
}

describe('Fremde Gemeinde: Org-2-Token gegen Objekte aus Org 1', () => {
  let app;
  let db;
  let t; // Tokens

  const EVENT_ORG1 = EVENTS.gottesdienstEvent.id;   // 1, 'Weihnachtsgottesdienst'
  const PFLICHT_ORG1 = EVENTS.pflichtEvent.id;      // 2, mandatory
  const EVENT_NAME_ORG1 = EVENTS.gottesdienstEvent.name;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    t = {
      konfi1: generateToken('konfi1'),
      konfi2: generateToken('konfi2'),
      teamer1: generateToken('teamer1'),
      admin1: generateToken('admin1'),
      orgAdmin1: generateToken('orgAdmin1'),
      // Org 2
      konfi3: generateToken('konfi3'),
      teamer2: generateToken('teamer2'),
      admin2: generateToken('admin2'),
      orgAdmin2: generateToken('orgAdmin2'),
    };
  });

  afterAll(async () => {
    await closePool();
  });

  async function buchung(eventId, userId, status = 'confirmed', orgId = ORGS.testGemeinde.id) {
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, $3, $4)`,
      [eventId, userId, status, orgId]
    );
  }

  // ==================================================================
  // BF-01: GET /api/events/:id (Termin-Detailansicht, liefert u. a. qr_token)
  // ==================================================================
  describe('GET /api/events/:id (Termin-Detailansicht)', () => {
    it('Konfi aus Org 2 -> 404, Antwort ohne Termindaten', async () => {
      const res = await request(app)
        .get(`/api/events/${EVENT_ORG1}`)
        .set('Authorization', `Bearer ${t.konfi3}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Event nicht gefunden');
      nurFehler(res.body);
      ohneFremddaten(res.body, EVENT_NAME_ORG1, 'qr_token');
    });

    it('Admin aus Org 2 -> 404 (Gemeinde-Filter greift vor der Jahrgangspruefung)', async () => {
      const res = await request(app)
        .get(`/api/events/${EVENT_ORG1}`)
        .set('Authorization', `Bearer ${t.admin2}`);
      expect(res.status).toBe(404);
      nurFehler(res.body);
    });

    it('eigene Gemeinde: Konfi aus Org 1 -> 200 mit dem Termin', async () => {
      const res = await request(app)
        .get(`/api/events/${EVENT_ORG1}`)
        .set('Authorization', `Bearer ${t.konfi1}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(EVENT_ORG1);
      expect(res.body.name).toBe(EVENT_NAME_ORG1);
    });
  });

  // ==================================================================
  // BF-05: POST /api/events/:id/generate-qr
  // ==================================================================
  describe('POST /api/events/:id/generate-qr', () => {
    it('Teamer:in aus Org 2 -> 404, kein Token erzeugt', async () => {
      const res = await request(app)
        .post(`/api/events/${EVENT_ORG1}/generate-qr`)
        .set('Authorization', `Bearer ${t.teamer2}`);
      expect(res.status).toBe(404);
      nurFehler(res.body);

      const { rows: [e] } = await db.query('SELECT qr_token FROM events WHERE id = $1', [EVENT_ORG1]);
      expect(e.qr_token).toBeNull();
    });

    it('eigene Gemeinde: Teamer:in aus Org 1 -> 200 mit qr_token', async () => {
      const res = await request(app)
        .post(`/api/events/${EVENT_ORG1}/generate-qr`)
        .set('Authorization', `Bearer ${t.teamer1}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
    });
  });

  // ==================================================================
  // BF-05: POST /api/events/qr-checkin
  // ==================================================================
  describe('POST /api/events/qr-checkin', () => {
    async function qrTokenOrg1() {
      const qr = await request(app)
        .post(`/api/events/${EVENT_ORG1}/generate-qr`)
        .set('Authorization', `Bearer ${t.admin1}`);
      expect(qr.status).toBe(200);
      // Der Check-in laeuft nur im Zeitfenster um event_date herum.
      await db.query('UPDATE events SET event_date = NOW() WHERE id = $1', [EVENT_ORG1]);
      return qr.body.qr_token;
    }

    it('Konfi aus Org 2 mit gueltigem Org-1-Token -> 403 wrong_organization, nichts eingecheckt', async () => {
      const token = await qrTokenOrg1();
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .post('/api/events/qr-checkin')
        .set('Authorization', `Bearer ${t.konfi3}`)
        .send({ token });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Kein Zugriff auf dieses Event', error_type: 'wrong_organization' });
      ohneFremddaten(res.body, EVENT_NAME_ORG1);

      const { rows } = await db.query(
        `SELECT attendance_status FROM event_bookings WHERE event_id = $1 AND attendance_status = 'present'`,
        [EVENT_ORG1]
      );
      expect(rows).toHaveLength(0);
    });

    it('eigene Gemeinde: angemeldete Konfi aus Org 1 -> 200 eingecheckt', async () => {
      const token = await qrTokenOrg1();
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .post('/api/events/qr-checkin')
        .set('Authorization', `Bearer ${t.konfi1}`)
        .send({ token });
      expect(res.status).toBe(200);
      expect(res.body.event_id).toBe(EVENT_ORG1);
      expect(res.body.event_name).toBe(EVENT_NAME_ORG1);
    });
  });

  // ==================================================================
  // BF-05: GET /api/events/:id/attendance-count
  // Heute 200 mit {0, 0} fuer fremde Kennungen (Sicherheit BF-16). Der
  // Filter wirkt: Der Org-1-Termin hat eine bestaetigte Buchung.
  // ==================================================================
  describe('GET /api/events/:id/attendance-count', () => {
    it('Teamer:in aus Org 2 -> 200 mit Nullen, obwohl der Termin eine Buchung hat', async () => {
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .get(`/api/events/${EVENT_ORG1}/attendance-count`)
        .set('Authorization', `Bearer ${t.teamer2}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ checked_in: 0, total: 0 });
    });

    it('eigene Gemeinde: Teamer:in aus Org 1 -> 200 mit der Buchung', async () => {
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .get(`/api/events/${EVENT_ORG1}/attendance-count`)
        .set('Authorization', `Bearer ${t.teamer1}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ checked_in: 0, total: 1 });
    });
  });

  // ==================================================================
  // BF-05: POST /api/konfi/upload-photo
  // Die Route hat KEINE Objekt-Kennung -- es gibt nichts Fremdes, worauf sie
  // zugreifen koennte. Festgehalten wird: Ein Org-2-Konto laedt fuer sich
  // hoch, und die Antwort traegt nur den eigenen, zufaelligen Dateinamen.
  // ==================================================================
  describe('POST /api/konfi/upload-photo', () => {
    const aufraeumen = [];
    afterEach(() => {
      for (const p of aufraeumen.splice(0)) {
        try { fs.unlinkSync(p); } catch { /* schon weg */ }
      }
    });

    it('Konfi aus Org 2 -> 200, Antwort nur filename + message, Name zufaellig (64 Hex)', async () => {
      const res = await request(app)
        .post('/api/konfi/upload-photo')
        .set('Authorization', `Bearer ${t.konfi3}`)
        .attach('photo', PNG, 'beweis.png');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['filename', 'message']);
      expect(res.body.filename).toMatch(/^[0-9a-f]{64}$/);
      aufraeumen.push(path.join(REQUESTS_DIR, res.body.filename));
    });
  });

  // ==================================================================
  // BF-05: POST /api/konfi/events/:id/opt-in
  // ==================================================================
  describe('POST /api/konfi/events/:id/opt-in', () => {
    it('Konfi aus Org 2 -> 404 am Pflichttermin aus Org 1', async () => {
      const res = await request(app)
        .post(`/api/konfi/events/${PFLICHT_ORG1}/opt-in`)
        .set('Authorization', `Bearer ${t.konfi3}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Event nicht gefunden');
      nurFehler(res.body);
    });

    it('eigene Gemeinde: abgemeldete Konfi aus Org 1 -> 200 wieder angemeldet', async () => {
      await buchung(PFLICHT_ORG1, USERS.konfi1.id, 'opted_out');

      const res = await request(app)
        .post(`/api/konfi/events/${PFLICHT_ORG1}/opt-in`)
        .set('Authorization', `Bearer ${t.konfi1}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Wieder angemeldet' });

      const { rows: [b] } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [PFLICHT_ORG1, USERS.konfi1.id]
      );
      expect(b.status).toBe('confirmed');
    });
  });

  // ==================================================================
  // BF-04/05: GET /api/konfi/events/:id/participants (anonymisiert)
  // Heute 200 [] fuer fremde Kennungen (Sicherheit BF-16). Der Filter wirkt:
  // Der Org-1-Termin hat eine bestaetigte Buchung.
  // ==================================================================
  describe('GET /api/konfi/events/:id/participants', () => {
    it('Konfi aus Org 2 -> 200 mit leerer Liste, obwohl der Termin Teilnehmende hat', async () => {
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .get(`/api/konfi/events/${EVENT_ORG1}/participants`)
        .set('Authorization', `Bearer ${t.konfi3}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('eigene Gemeinde: Konfi aus Org 1 -> 200 mit anonymisiertem Namen', async () => {
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .get(`/api/konfi/events/${EVENT_ORG1}/participants`)
        .set('Authorization', `Bearer ${t.konfi2}`);
      expect(res.status).toBe(200);
      // 'Test Konfi 1' -> Vorname + erster Buchstabe des letzten Teils.
      expect(res.body).toEqual([{ id: USERS.konfi1.id, display_name: 'Test 1.' }]);
    });
  });

  // ==================================================================
  // BF-05: GET /api/roles, GET /api/roles/:id, GET /api/roles/list/assignable
  // ==================================================================
  describe('GET /api/roles', () => {
    it('Org-Admin aus Org 2 -> 200 mit genau den Rollen von Org 2', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(200);
      expect(res.body.map(r => r.id)).toEqual([
        ROLES.orgAdmin2.id, ROLES.admin2.id, ROLES.teamer2.id, ROLES.konfi2.id,
      ]);
    });

    it('eigene Gemeinde: Org-Admin aus Org 1 -> 200 mit genau den Rollen von Org 1', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${t.orgAdmin1}`);
      expect(res.status).toBe(200);
      expect(res.body.map(r => r.id)).toEqual([
        ROLES.orgAdmin.id, ROLES.admin.id, ROLES.teamer.id, ROLES.konfi.id, ROLES.superAdmin.id,
      ]);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('Org-Admin aus Org 2 -> 404 fuer eine Rolle aus Org 1', async () => {
      const res = await request(app)
        .get(`/api/roles/${ROLES.admin.id}`)
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Rolle nicht gefunden');
      nurFehler(res.body);
    });

    it('eigene Gemeinde: Org-Admin aus Org 2 -> 200 fuer eine Rolle aus Org 2', async () => {
      const res = await request(app)
        .get(`/api/roles/${ROLES.admin2.id}`)
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ROLES.admin2.id);
      expect(res.body.name).toBe('admin');
    });
  });

  describe('GET /api/roles/list/assignable', () => {
    it('Org-Admin aus Org 2 -> 200 mit genau den zuweisbaren Rollen von Org 2', async () => {
      const res = await request(app)
        .get('/api/roles/list/assignable')
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(200);
      expect(res.body.map(r => r.id)).toEqual([ROLES.admin2.id, ROLES.teamer2.id, ROLES.konfi2.id]);
    });

    it('eigene Gemeinde: Org-Admin aus Org 1 -> 200 mit genau den zuweisbaren Rollen von Org 1', async () => {
      const res = await request(app)
        .get('/api/roles/list/assignable')
        .set('Authorization', `Bearer ${t.orgAdmin1}`);
      expect(res.status).toBe(200);
      expect(res.body.map(r => r.id)).toEqual([ROLES.admin.id, ROLES.teamer.id, ROLES.konfi.id]);
    });
  });

  // ==================================================================
  // BF-05: GET /api/admin/users/me/jahrgaenge
  // ==================================================================
  describe('GET /api/admin/users/me/jahrgaenge', () => {
    it('Teamer:in aus Org 2 sieht eine Zuweisung zu einem Org-1-Jahrgang NICHT', async () => {
      // Zeile mit Org-1-Bezug direkt in der Datenbank -- die Route muss sie
      // ueber den Jahrgang herausfiltern.
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [USERS.teamer2.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/admin/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${t.teamer2}`);
      expect(res.status).toBe(200);
      expect(res.body.map(j => j.id)).toEqual([JAHRGAENGE.jahrgang2.id]);
    });

    it('eigene Gemeinde: Teamer:in aus Org 1 -> 200 mit dem eigenen Jahrgang', async () => {
      const res = await request(app)
        .get('/api/admin/users/me/jahrgaenge')
        .set('Authorization', `Bearer ${t.teamer1}`);
      expect(res.status).toBe(200);
      expect(res.body.map(j => j.id)).toEqual([JAHRGAENGE.jahrgang1.id]);
    });
  });

  // ==================================================================
  // BF-04: DELETE /api/chat/rooms/:roomId/leave
  // ==================================================================
  describe('DELETE /api/chat/rooms/:roomId/leave', () => {
    it('Konfi aus Org 2 -> 404 am Gruppenraum aus Org 1', async () => {
      const res = await request(app)
        .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}/leave`)
        .set('Authorization', `Bearer ${t.konfi3}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Raum nicht gefunden');
      nurFehler(res.body);
    });

    it('eigene Gemeinde: Teamer:in aus Org 1 verlaesst den Gruppenraum -> 200', async () => {
      const res = await request(app)
        .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}/leave`)
        .set('Authorization', `Bearer ${t.teamer1}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Chat erfolgreich verlassen' });
    });
  });

  // ==================================================================
  // BF-04: GET /api/events/user/bookings (eigene Buchungen)
  // ==================================================================
  describe('GET /api/events/user/bookings', () => {
    it('Konfi aus Org 2 sieht eine Buchung an einem Org-1-Termin NICHT', async () => {
      // Zeile mit Org-1-Bezug direkt in der Datenbank.
      await buchung(EVENT_ORG1, USERS.konfi3.id, 'confirmed', ORGS.testGemeinde.id);

      const res = await request(app)
        .get('/api/events/user/bookings')
        .set('Authorization', `Bearer ${t.konfi3}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('eigene Gemeinde: Konfi aus Org 1 -> 200 mit der eigenen Buchung', async () => {
      await buchung(EVENT_ORG1, USERS.konfi1.id);

      const res = await request(app)
        .get('/api/events/user/bookings')
        .set('Authorization', `Bearer ${t.konfi1}`);
      expect(res.status).toBe(200);
      expect(res.body.map(b => b.event_id)).toEqual([EVENT_ORG1]);
    });
  });

  // ==================================================================
  // BF-04: PUT /api/admin/konfis/:id/teamer-since
  // ==================================================================
  describe('PUT /api/admin/konfis/:id/teamer-since', () => {
    it('Admin aus Org 2 -> 404 fuer eine Teamer:in aus Org 1, nichts geaendert', async () => {
      const res = await request(app)
        .put(`/api/admin/konfis/${USERS.teamer1.id}/teamer-since`)
        .set('Authorization', `Bearer ${t.admin2}`)
        .send({ teamer_since: '2024-01-01' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User nicht gefunden');
      nurFehler(res.body);

      const { rows: [u] } = await db.query('SELECT teamer_since FROM users WHERE id = $1', [USERS.teamer1.id]);
      expect(u.teamer_since).toBeNull();
    });

    it('eigene Gemeinde: Admin aus Org 1 -> 200, Datum gesetzt', async () => {
      const res = await request(app)
        .put(`/api/admin/konfis/${USERS.teamer1.id}/teamer-since`)
        .set('Authorization', `Bearer ${t.admin1}`)
        .send({ teamer_since: '2024-01-01' });
      expect(res.status).toBe(200);

      const { rows: [u] } = await db.query(
        "SELECT to_char(teamer_since, 'YYYY-MM-DD') AS tag FROM users WHERE id = $1",
        [USERS.teamer1.id]
      );
      expect(u.tag).toBe('2024-01-01');
    });
  });

  // ==================================================================
  // BF-04: GET /api/teamer/:userId/badges
  // ==================================================================
  describe('GET /api/teamer/:userId/badges', () => {
    it('Admin aus Org 2 -> 404 fuer eine Teamer:in aus Org 1', async () => {
      const res = await request(app)
        .get(`/api/teamer/${USERS.teamer1.id}/badges`)
        .set('Authorization', `Bearer ${t.admin2}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Teamer:in nicht gefunden');
      nurFehler(res.body);
    });

    it('eigene Gemeinde: Admin aus Org 1 -> 200', async () => {
      const res = await request(app)
        .get(`/api/teamer/${USERS.teamer1.id}/badges`)
        .set('Authorization', `Bearer ${t.admin1}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ earned: [] });
    });
  });

  // ==================================================================
  // BF-04: GET /api/teamer/activities und GET /api/teamer/requests
  // ==================================================================
  describe('GET /api/teamer/activities und /api/teamer/requests', () => {
    let aktivitaetOrg1;
    let aktivitaetOrg2;

    beforeEach(async () => {
      const { rows: [a1] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ('Team-Aktivität Org 1', 1, 'gemeinde', $1, 'teamer') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [a2] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ('Team-Aktivität Org 2', 1, 'gemeinde', $1, 'teamer') RETURNING id`,
        [ORGS.andereGemeinde.id]
      );
      aktivitaetOrg1 = a1.id;
      aktivitaetOrg2 = a2.id;
    });

    it('activities: Teamer:in aus Org 2 -> 200 mit genau der Org-2-Aktivitaet', async () => {
      const res = await request(app)
        .get('/api/teamer/activities')
        .set('Authorization', `Bearer ${t.teamer2}`);
      expect(res.status).toBe(200);
      expect(res.body.map(a => a.id)).toEqual([aktivitaetOrg2]);
    });

    it('activities: eigene Gemeinde, Teamer:in aus Org 1 -> 200 mit genau der Org-1-Aktivitaet', async () => {
      const res = await request(app)
        .get('/api/teamer/activities')
        .set('Authorization', `Bearer ${t.teamer1}`);
      expect(res.status).toBe(200);
      expect(res.body.map(a => a.id)).toEqual([aktivitaetOrg1]);
    });

    it('requests: Teamer:in aus Org 2 sieht einen eigenen Antrag mit Org-1-Bezug NICHT', async () => {
      // Ein Antrag in der eigenen Org und einer mit Org-1-Bezug (direkt in der
      // Datenbank) -- die Route liefert nur den eigenen.
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, organization_id)
         VALUES ($1, $2, CURRENT_DATE, $3), ($1, $4, CURRENT_DATE, $5)`,
        [USERS.teamer2.id, aktivitaetOrg2, ORGS.andereGemeinde.id, aktivitaetOrg1, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/teamer/requests')
        .set('Authorization', `Bearer ${t.teamer2}`);
      expect(res.status).toBe(200);
      expect(res.body.map(r => r.activity_id)).toEqual([aktivitaetOrg2]);
      ohneFremddaten(res.body, 'Team-Aktivität Org 1');
    });

    it('requests: eigene Gemeinde, Teamer:in aus Org 1 -> 200 mit dem eigenen Antrag', async () => {
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, organization_id)
         VALUES ($1, $2, CURRENT_DATE, $3)`,
        [USERS.teamer1.id, aktivitaetOrg1, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/teamer/requests')
        .set('Authorization', `Bearer ${t.teamer1}`);
      expect(res.status).toBe(200);
      expect(res.body.map(r => r.activity_id)).toEqual([aktivitaetOrg1]);
    });
  });

  // ==================================================================
  // BF-04: GET /api/challenges/admin/authors
  // ==================================================================
  // Org-Admin, nicht Admin: Ein Admin ohne Jahrgangszuweisung sieht hier keine
  // Konfis (viewableJahrgangIds), der Org-Admin alle Personen seiner Gemeinde.
  describe('GET /api/challenges/admin/authors', () => {
    it('Org-Admin aus Org 2 -> 200 mit genau den Personen aus Org 2', async () => {
      const res = await request(app)
        .get('/api/challenges/admin/authors')
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(200);
      expect(res.body.map(u => u.id).sort((a, b) => a - b)).toEqual([
        USERS.konfi3.id, USERS.teamer2.id, USERS.admin2.id, USERS.orgAdmin2.id,
      ]);
      ohneFremddaten(res.body, USERS.konfi1.display_name, USERS.admin1.display_name);
    });

    it('eigene Gemeinde: Org-Admin aus Org 1 -> 200 mit genau den Personen aus Org 1', async () => {
      const res = await request(app)
        .get('/api/challenges/admin/authors')
        .set('Authorization', `Bearer ${t.orgAdmin1}`);
      expect(res.status).toBe(200);
      // Rolle super_admin ist ausgeschlossen (Nutzer 10); Nutzer 11 traegt die
      // Rolle org_admin und steht deshalb drin.
      expect(res.body.map(u => u.id).sort((a, b) => a - b)).toEqual([
        USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, USERS.admin1.id,
        USERS.orgAdmin1.id, USERS.orgAdminSuper.id,
      ]);
    });
  });

  // ==================================================================
  // BF-04: Einladungscodes -- GET /api/auth/invite-codes,
  // POST /api/auth/invite-codes/:id/extend, DELETE /api/auth/invite-codes/:id
  // ==================================================================
  describe('Einladungscodes (/api/auth/invite-codes)', () => {
    let codeOrg1;
    let codeIdOrg1;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/invite-code')
        .set('Authorization', `Bearer ${t.orgAdmin1}`)
        .send({ jahrgang_id: JAHRGAENGE.jahrgang1.id });
      expect(res.status).toBe(200);
      codeOrg1 = res.body.invite_code;
      const { rows: [ic] } = await db.query('SELECT id FROM invite_codes WHERE code = $1', [codeOrg1]);
      codeIdOrg1 = ic.id;
    });

    it('GET: Org-Admin aus Org 2 -> 200 mit leerer Liste, der Org-1-Code fehlt', async () => {
      const res = await request(app)
        .get('/api/auth/invite-codes')
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('extend: Org-Admin aus Org 2 -> 404, Ablauf unveraendert', async () => {
      const { rows: [vorher] } = await db.query('SELECT expires_at FROM invite_codes WHERE id = $1', [codeIdOrg1]);

      const res = await request(app)
        .post(`/api/auth/invite-codes/${codeIdOrg1}/extend`)
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Einladungscode nicht gefunden');
      nurFehler(res.body);
      ohneFremddaten(res.body, codeOrg1);

      const { rows: [nachher] } = await db.query('SELECT expires_at FROM invite_codes WHERE id = $1', [codeIdOrg1]);
      expect(nachher.expires_at.getTime()).toBe(vorher.expires_at.getTime());
    });

    it('DELETE: Org-Admin aus Org 2 -> 404, Code bleibt bestehen', async () => {
      const res = await request(app)
        .delete(`/api/auth/invite-codes/${codeIdOrg1}`)
        .set('Authorization', `Bearer ${t.orgAdmin2}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Code nicht gefunden');
      nurFehler(res.body);

      const { rows } = await db.query('SELECT 1 FROM invite_codes WHERE id = $1', [codeIdOrg1]);
      expect(rows).toHaveLength(1);
    });

    it('eigene Gemeinde: Org-Admin aus Org 1 sieht, verlaengert und loescht den Code -> 200/200/200', async () => {
      const liste = await request(app)
        .get('/api/auth/invite-codes')
        .set('Authorization', `Bearer ${t.orgAdmin1}`);
      expect(liste.status).toBe(200);
      expect(liste.body.map(c => c.invite_code)).toEqual([codeOrg1]);

      const { rows: [vorher] } = await db.query('SELECT expires_at FROM invite_codes WHERE id = $1', [codeIdOrg1]);
      const verlaengert = await request(app)
        .post(`/api/auth/invite-codes/${codeIdOrg1}/extend`)
        .set('Authorization', `Bearer ${t.orgAdmin1}`);
      expect(verlaengert.status).toBe(200);
      const { rows: [nachher] } = await db.query('SELECT expires_at FROM invite_codes WHERE id = $1', [codeIdOrg1]);
      // Genau sieben Tage mehr.
      expect(nachher.expires_at.getTime() - vorher.expires_at.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

      const geloescht = await request(app)
        .delete(`/api/auth/invite-codes/${codeIdOrg1}`)
        .set('Authorization', `Bearer ${t.orgAdmin1}`);
      expect(geloescht.status).toBe(200);
      const { rows } = await db.query('SELECT 1 FROM invite_codes WHERE id = $1', [codeIdOrg1]);
      expect(rows).toHaveLength(0);
    });
  });
});
