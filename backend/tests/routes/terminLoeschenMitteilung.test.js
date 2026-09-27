// backend/tests/routes/terminLoeschenMitteilung.test.js
//
// Termin geloescht statt abgesagt: Alle Gebuchten erfahren es -- Konfis UND
// Team (Audit "Wer bekommt was" 27.09.2026, BF-06).
//
// Die Absage (PUT /api/events/:id/cancel) meldet sich bei allen Gebuchten
// ('confirmed', 'waitlist', 'excused'), ohne Rollenfilter. Das Loeschen
// eines NICHT abgesagten Termins sammelte dagegen nur Buchungen mit der
// Stamm-Rolle 'konfi' ein. Gebuchte Teamer:innen und Leitungen, die sich
// selbst eingetragen hatten, erfuhren nichts; bei "Nur Team"-Terminen gab es
// gar keine Empfaenger. Ihre Termin-Mitteilungen im Postfach gingen dabei
// mit dem Termin weg.
//
// Firebase ist gemockt wie in pushEmpfaengerMultiOrg.test.js; geprueft wird
// die konkrete Empfaengerliste (sortierte Tokens).
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG1 = ORGS.testGemeinde.id;

const TOKEN_ZU = {
  [USERS.konfi1.id]: 'token-konfi1',
  [USERS.konfi2.id]: 'token-konfi2',
  [USERS.teamer1.id]: 'token-teamer1',
  [USERS.admin1.id]: 'token-admin1',
  [USERS.orgAdmin1.id]: 'token-orgadmin1',
};

// Nur die Mitteilungen ueber den Termin: stille Zaehler-Pushes laufen ueber
// sendFirebaseSilentPush und stehen hier nicht.
const empfaenger = (typ = 'event_cancelled') => sendFirebasePushNotification.mock.calls
  .filter(([, payload]) => payload.data && payload.data.type === typ)
  .map(([token]) => token)
  .sort();

describe('Termin geloescht: alle Gebuchten bekommen die Mitteilung (BF-06)', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const [userId, token] of Object.entries(TOKEN_ZU)) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [userId, token, `dev-${token}`]
      );
    }
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => {
    await closePool();
  });

  async function termin({ teamerOnly = false, jahrgang = JAHRGAENGE.jahrgang1.id, name = 'Teamtreffen' } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, teamer_only, teamer_needed, mandatory,
                           max_participants, teamer_max_participants, registration_open_notified)
       VALUES ($1, NOW() + INTERVAL '5 days', $2, $3, $4, false, 20, 5, true)
       RETURNING id`,
      [name, ORG1, teamerOnly, !teamerOnly]
    );
    if (jahrgang && !teamerOnly) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jahrgang]);
    }
    return e.id;
  }

  const buchung = (eventId, userId, status) => db.query(
    `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, $3, $4)`,
    [eventId, userId, status, ORG1]
  );

  async function loeschen(eventId) {
    const res = await request(app)
      .delete(`/api/events/${eventId}?force=true`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
  }

  async function absagen(eventId) {
    const res = await request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
      .send({});
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
    return res.body;
  }

  it('erlaubt: "Nur Team"-Termin loeschen -- die zugesagte Teamer:in erfaehrt es', async () => {
    const id = await termin({ teamerOnly: true });
    await buchung(id, USERS.teamer1.id, 'confirmed');

    await loeschen(id);

    expect(empfaenger()).toEqual(['token-teamer1']);
    // Und die Mitteilung steht in ihrem Postfach (die Termin-Mitteilungen
    // gehen mit dem Termin, diese kommt danach und bleibt).
    const { rows } = await db.query(
      `SELECT type FROM notifications WHERE user_id = $1 AND type = 'event_cancelled'`,
      [USERS.teamer1.id]
    );
    expect(rows.length).toBe(1);
  });

  it('erlaubt: Konfis, Team, Leitung und Wartende eines Jahrgangstermins -- jede Person einmal', async () => {
    const id = await termin();
    await buchung(id, USERS.konfi1.id, 'confirmed');
    await buchung(id, USERS.konfi2.id, 'waitlist');
    await buchung(id, USERS.teamer1.id, 'confirmed');
    await buchung(id, USERS.admin1.id, 'confirmed');

    await loeschen(id);

    expect(empfaenger()).toEqual(['token-admin1', 'token-konfi1', 'token-konfi2', 'token-teamer1']);
  });

  it('verboten: wer sich selbst abgemeldet hat, nicht gebucht war oder geloescht ist, bekommt nichts', async () => {
    const id = await termin();
    await buchung(id, USERS.konfi1.id, 'opted_out');
    await buchung(id, USERS.teamer1.id, 'confirmed');
    await buchung(id, USERS.konfi2.id, 'confirmed');
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);

    await loeschen(id);

    // Nur teamer1. konfi1 hat sich abgemeldet, konfi2 ist geloescht, admin1
    // und orgAdmin1 (die loeschende Person) waren nicht gebucht.
    expect(empfaenger()).toEqual(['token-teamer1']);
  });

  it('ein bereits abgesagter Termin meldet sich beim Loeschen nicht ein zweites Mal -- auch beim Team nicht', async () => {
    const id = await termin({ teamerOnly: true });
    await buchung(id, USERS.teamer1.id, 'confirmed');
    await absagen(id);
    expect(empfaenger()).toEqual(['token-teamer1']);
    sendFirebasePushNotification.mockClear();

    await loeschen(id);

    expect(empfaenger()).toEqual([]);
  });

  it('Paritaet: Loeschen erreicht genau die, die eine Absage erreicht haette', async () => {
    const buchungen = [
      [USERS.konfi1.id, 'confirmed'],
      [USERS.konfi2.id, 'waitlist'],
      [USERS.teamer1.id, 'confirmed'],
      [USERS.admin1.id, 'excused'],     // einzeln abgemeldet -- die Absage meldet sie trotzdem
      [USERS.orgAdmin1.id, 'opted_out'] // selbst abgemeldet -- die Absage meldet sie nicht
    ];
    const abzusagen = await termin({ name: 'A' });
    const zuLoeschen = await termin({ name: 'B' });
    for (const [userId, status] of buchungen) {
      await buchung(abzusagen, userId, status);
      await buchung(zuLoeschen, userId, status);
    }

    const antwort = await absagen(abzusagen);
    const nachAbsage = empfaenger();
    sendFirebasePushNotification.mockClear();
    await loeschen(zuLoeschen);
    const nachLoeschen = empfaenger();

    expect(nachAbsage).toEqual(['token-admin1', 'token-konfi1', 'token-konfi2', 'token-teamer1']);
    expect(nachLoeschen).toEqual(nachAbsage);
    // Die Antwort der Absage zaehlt dieselben Personen (Alt-App-Feld).
    expect(antwort.participants_notified).toBe(4);
  });
});
