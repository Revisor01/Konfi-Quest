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
// BEWUSST OHNE Begruendungszwang, anders als bei Konfis auf Pflichtterminen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS } = require('../helpers/seed');
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
      'SELECT status, opt_out_reason, opt_out_date FROM event_bookings WHERE user_id = $1 AND event_id = $2',
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

  it('"nicht dabei" wird als eigener Status gespeichert, OHNE Grundzwang', async () => {
    const res = await zusage({ dabei: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('opted_out');

    const s = await status();
    expect(s.status).toBe('opted_out');
    // Kein Grund noetig — anders als beim Konfi-Pflichttermin.
    expect(s.opt_out_reason).toBeNull();
    expect(s.opt_out_date).not.toBeNull();
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
});
