// GET /api/support/uebersicht -- das Dashboard der Support-Ansicht (Web;
// docs/planung/support-web.md, Entscheidungen 3 und 5; routes/supportUebersicht.js).
//
// Geprueft mit festen Zeitstempeln gegen ein festes "jetzt" (vi.setSystemTime;
// die Route bildet Monate und Wochen aus dem Zeitpunkt der Anfrage, nicht aus
// der Datenbank-Uhr): Rechte (nur Super-Admin), die Form, die Reihen ueber 12
// Kalendermonate und 12 ISO-Wochen in Berliner Zeit -- lueckenlos mit 0, in der
// Reihenfolge aelteste zuerst, mit den Grenzfaellen um Mitternacht Berlin
// (die UTC-Rechnung faende sie im Nachbarmonat bzw. in der Nachbarwoche) und am
// Jahreswechsel (ISO-Jahr), die Kennzahlen mit Konten je Rolle ueber beide
// Quellen der Zugehoerigkeit, die neuesten Anfragen und Mails und die
// Testphasen, die bald enden. Interne Gemeinden: supportInterneGemeinden.test.js.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { SUPPORT, supportKontoAnlegen, supportToken } = require('../helpers/kontoOhneGemeinde');
const { supportDaten } = require('../helpers/supportDaten');

// Samstag, 03.10.2026, 10:00 Uhr Berlin -- ISO-Woche 2026-W40. Die Sommerzeit
// endet am 25.10.2026 (danach UTC+1).
const JETZT = new Date('2026-10-03T08:00:00Z');
const MONATE = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const WOCHEN = ['2026-W29', '2026-W30', '2026-W31', '2026-W32', '2026-W33', '2026-W34',
  '2026-W35', '2026-W36', '2026-W37', '2026-W38', '2026-W39', '2026-W40'];

/** Eine Reihe der Laenge 12 mit Nullen und den Werten an den Stellen. */
const reihe = (eintraege) => {
  const r = Array(12).fill(0);
  for (const [i, wert] of Object.entries(eintraege)) r[Number(i)] = wert;
  return r;
};

describe('GET /api/support/uebersicht', () => {
  let app;
  let db;
  let d;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); d = supportDaten(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await supportKontoAnlegen(db);
    // Alles, was der Seed mit NOW() anlegt, bekommt einen festen Zeitpunkt
    // vor dem Fenster -- sonst wanderte es mit dem Kalender in die Reihen.
    await db.query("UPDATE users SET created_at = '2025-06-15T10:00:00Z'");
    await db.query("UPDATE organizations SET created_at = '2025-06-15T10:00:00Z'");
    for (const u of [...Object.values(USERS), SUPPORT]) invalidateUserCache(u.id);
    // Nur Date: Zeitgeber der Verbindungen und Anfragen laufen echt weiter.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(JETZT);
  });
  afterEach(() => { vi.useRealTimers(); });

  const SUPER = () => generateToken('orgAdminSuper');
  const als = (token) => ({
    get: (pfad) => request(app).get(pfad).set('Authorization', `Bearer ${token}`),
  });
  const uebersicht = async () => {
    const res = await als(SUPER()).get('/api/support/uebersicht');
    expect(res.status).toBe(200);
    return res.body;
  };

  const erstellt = (userId, zeit) => db.query('UPDATE users SET created_at = $2 WHERE id = $1', [userId, zeit]);

  // ==========================================================================
  // Rechte
  // ==========================================================================
  describe('Rechte: nur Super-Admin', () => {
    const ROUTEN = ['/api/support/uebersicht', '/api/support/gemeinden'];

    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verboten: %s bekommt auf beiden Routen 403', async (wer) => {
      const status = [];
      for (const pfad of ROUTEN) status.push([pfad, (await als(generateToken(wer)).get(pfad)).status]);
      expect(status).toEqual(ROUTEN.map((pfad) => [pfad, 403]));
    });

    it('verboten: ohne Anmeldung 401 auf beiden Routen', async () => {
      const status = [];
      for (const pfad of ROUTEN) status.push([pfad, (await request(app).get(pfad)).status]);
      expect(status).toEqual(ROUTEN.map((pfad) => [pfad, 401]));
    });

    it.each([
      ['Super-Admin mit Gemeinde (Gemeindeleitung, Merkmal)', () => generateToken('orgAdminSuper')],
      ['Super-Admin-Rolle', () => generateToken('superAdmin')],
      ['Support-Konto ohne Gemeinde', () => supportToken()],
    ])('erlaubt: %s bekommt auf beiden Routen 200', async (_wer, token) => {
      const status = [];
      for (const pfad of ROUTEN) status.push([pfad, (await als(token()).get(pfad)).status]);
      expect(status).toEqual(ROUTEN.map((pfad) => [pfad, 200]));
    });
  });

  // ==========================================================================
  // Form und Grundzustand
  // ==========================================================================
  describe('Form', () => {
    it('nur der Seed: genau die Felder des Vertrags, alle Reihen lang 12 und lückenlos mit 0', async () => {
      const body = await uebersicht();
      expect(Object.keys(body)).toEqual(
        ['kennzahlen', 'entwicklung', 'aktivitaet', 'neueste_anfragen', 'neueste_mails', 'testphase_endet']);
      expect(body).toEqual({
        kennzahlen: {
          gemeinden: { gesamt: 2, testphase: 0, lizenz: 0, unbegrenzt: 2, gesperrt: 0 },
          konten: { konfi: 3, teamer: 2, admin: 2, org_admin: 3 },
          aktiv_30_tage: 0,
          anfragen_offen: 0,
          mails_ungelesen: 0,
        },
        entwicklung: {
          monate: MONATE,
          gemeinden_neu: reihe({}),
          konten_neu: { konfi: reihe({}), team: reihe({}) },
          konten_gesamt: Array(12).fill(10),
          anfragen_neu: reihe({}),
        },
        aktivitaet: { wochen: WOCHEN, antraege: reihe({}), buchungen: reihe({}), nachrichten: reihe({}) },
        neueste_anfragen: [],
        neueste_mails: [],
        testphase_endet: [],
      });
    });
  });

  // ==========================================================================
  // Abfragen
  // ==========================================================================
  describe('Abfragen', () => {
    /** Alle Anweisungen, die die Route auf Verbindungen aus dem Pool absetzt, in der Reihenfolge. */
    const anweisungen = async () => {
      const aufrufe = [];
      const echt = db.getClient;
      const spaeh = vi.spyOn(db, 'getClient').mockImplementation(async () => {
        const client = await echt();
        const query = client.query.bind(client);
        client.query = (text, ...rest) => { aufrufe.push(String(text).replace(/\s+/g, ' ').trim()); return query(text, ...rest); };
        return client;
      });
      try {
        await uebersicht();
      } finally {
        spaeh.mockRestore();
      }
      return aufrufe;
    };

    it('acht Abfragen in einer schreibgeschützten Transaktion ohne JIT -- unabhängig von der Zahl der Gemeinden', async () => {
      // Ohne JIT: Mit JIT brauchte die Wochenabfrage auf 300.000 Nachrichten 1.150 ms statt 58 ms (siehe Route).
      const wenige = await anweisungen();
      expect(wenige).toHaveLength(11);
      expect(wenige[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      expect(wenige[1]).toBe('SET LOCAL jit = off');
      expect(wenige[10]).toBe('COMMIT');
      expect(wenige.slice(2, 10).every((a) => /^(WITH|SELECT) /.test(a))).toBe(true);

      for (let id = 3; id < 28; id += 1) {
        const r = await d.gemeinde({ id });
        await d.konto({ id: 100 + id, organization_id: id, role_id: r.org_admin });
        await d.konto({ id: 200 + id, organization_id: id, role_id: r.konfi });
      }
      expect(await anweisungen()).toHaveLength(11);
      expect((await uebersicht()).kennzahlen.gemeinden.gesamt).toBe(27);
    });
  });

  // ==========================================================================
  // Entwicklung: 12 Kalendermonate in Berliner Zeit
  // ==========================================================================
  describe('Entwicklung: Kalendermonate', () => {
    it('Konten, Gemeinden und Anfragen je Monat -- mit den Grenzen um Mitternacht Berlin', async () => {
      // Konten (jede Zeile: Zeitpunkt UTC -> Monat in Berlin)
      await erstellt(2, '2026-03-20T12:00:00Z'); // Konfi        -> 2026-03
      await erstellt(6, '2026-09-30T22:30:00Z'); // Konfi        -> 2026-10 (Berlin: 01.10., 00:30; UTC: September)
      await erstellt(3, '2025-10-31T23:30:00Z'); // Teamer:in    -> 2025-11 (Berlin: 01.11., 00:30; UTC: Oktober, vor dem Fenster)
      await erstellt(7, '2026-03-31T22:30:00Z'); // Teamer:in    -> 2026-04 (Berlin: 01.04., 00:30; UTC: Maerz)
      await erstellt(4, '2026-01-10T12:00:00Z'); // Admin        -> 2026-01
      await erstellt(10, '2026-09-15T12:00:00Z'); // Rolle super_admin: gehoert zu keinen der vier Rollen, zaehlt nicht
      await erstellt(50, '2026-09-20T12:00:00Z'); // Support-Konto ohne Gemeinde: zaehlt nicht
      // Gesperrt und geloescht zaehlen nicht
      const r1 = { konfi: 1 };
      await d.konto({ id: 63, organization_id: 1, role_id: r1.konfi, is_active: false, created_at: '2026-08-10T12:00:00Z' });
      await d.konto({ id: 64, organization_id: 1, role_id: r1.konfi, deleted_at: '2026-09-01T00:00:00', created_at: '2026-08-11T12:00:00Z' });

      // Gemeinden
      await db.query("UPDATE organizations SET created_at = '2026-05-31T22:30:00Z' WHERE id = 2"); // -> 2026-06 (Berlin: 01.06., 00:30)
      await d.gemeinde({ id: 3, created_at: '2026-08-15T12:00:00Z' }); // -> 2026-08
      await d.gemeinde({ id: 4, intern: true, created_at: '2026-08-16T12:00:00Z' }); // intern: zaehlt nicht
      await d.gemeinde({ id: 5, created_at: '2025-10-31T23:30:00Z' }); // -> 2025-11 (erste Stunde des Fensters in Berlin)
      await d.gemeinde({ id: 6, created_at: '2025-10-31T22:30:00Z' }); // 23:30 Berlin am 31.10.: vor dem Fenster

      // Anfragen (Monatsende 31.10.2026: nach der Zeitumstellung gilt UTC+1)
      await d.anfrage({ created_at: '2025-10-31T23:30:00Z' }); // -> 2025-11
      await d.anfrage({ created_at: '2025-11-15T12:00:00Z' }); // -> 2025-11
      await d.anfrage({ created_at: '2025-10-31T22:30:00Z' }); // vor dem Fenster
      await d.anfrage({ created_at: '2026-10-02T12:00:00Z' }); // -> 2026-10
      await d.anfrage({ created_at: '2026-10-31T22:30:00Z' }); // 23:30 Berlin am 31.10. -> 2026-10
      await d.anfrage({ created_at: '2026-10-31T23:30:00Z' }); // 00:30 Berlin am 01.11.: nach dem Fenster

      const { entwicklung } = await uebersicht();
      expect(entwicklung).toEqual({
        monate: MONATE,
        gemeinden_neu: reihe({ 0: 1, 7: 1, 9: 1 }),
        konten_neu: {
          konfi: reihe({ 4: 1, 11: 1 }),
          team: reihe({ 0: 1, 2: 1, 5: 1 }),
        },
        // Vor dem Fenster standen fuenf Konten da (Konfi 1, Admin 2, drei Leitungen);
        // dazu je Monat die Neuen: ... 6 (+Teamer:in), 7 (+Admin), 8 (+Konfi), 9 (+Teamer:in), 10 (+Konfi).
        konten_gesamt: [6, 6, 7, 7, 8, 9, 9, 9, 9, 9, 9, 10],
        anfragen_neu: reihe({ 0: 2, 11: 2 }),
      });
    });

    it('ein Konto in drei Gemeinden zählt in der Entwicklung einmal, als Team', async () => {
      const r3 = await d.gemeinde({ id: 3 });
      await d.konto({ id: 60, organization_id: 1, role_id: 2, created_at: '2026-03-10T12:00:00Z' }); // Teamer:in in Gemeinde 1
      await d.zusatz(60, 2, 7); // ... und in Gemeinde 2
      await d.zusatz(60, 3, r3.org_admin); // ... und Leitung in Gemeinde 3

      const { entwicklung, kennzahlen } = await uebersicht();
      expect(entwicklung.konten_neu).toEqual({ konfi: reihe({}), team: reihe({ 4: 1 }) });
      expect(entwicklung.konten_gesamt).toEqual([10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11]);
      // je Rolle einmal: Teamer:in (nicht zweimal) und Leitung
      expect(kennzahlen.konten).toEqual({ konfi: 3, teamer: 3, admin: 2, org_admin: 4 });
    });
  });

  // ==========================================================================
  // Aktivitaet: 12 ISO-Wochen in Berliner Zeit
  // ==========================================================================
  describe('Aktivität: ISO-Wochen', () => {
    const antrag = (organizationId, zeit, userId = 1) => db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id, created_at)
       VALUES ($1, $2, '2026-09-01', 'pending', $3, $4)`,
      [userId, organizationId === 2 ? 5 : 1, organizationId, zeit]);
    const buchung = (eventId, userId, organizationId, zeit, status = 'confirmed') => db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
       VALUES ($1, $2, $3, $4, $5)`, [eventId, userId, status, zeit, organizationId]);
    const nachricht = (roomId, zeit, geloescht = null) => db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at, deleted_at)
       VALUES ($1, 4, 'admin', 'text', 'Hallo', $2, $3)`, [roomId, zeit, geloescht]);

    it('Anträge, Buchungen und Nachrichten je Woche -- mit den Grenzen um Mitternacht Berlin', async () => {
      await d.gemeinde({ id: 4, intern: true });
      await db.query(
        "INSERT INTO chat_rooms (id, name, type, created_by, organization_id) VALUES (10, 'Intern', 'group', 4, 4)");

      // Anträge (activity_requests). Wochen: W40 beginnt Mo 28.09., 00:00 Berlin = Sa 27.09., 22:00 UTC.
      await antrag(1, '2026-10-01T09:00:00Z'); // W40
      await antrag(1, '2026-09-27T22:30:00Z'); // W40 (Berlin: Mo 28.09., 00:30; UTC: Sonntag, W39)
      await antrag(1, '2026-09-27T21:30:00Z'); // W39 (Berlin: So 27.09., 23:30)
      await antrag(1, '2026-07-12T22:30:00Z'); // W29 (Berlin: Mo 13.07., 00:30; UTC: Sonntag, W28 -- vor dem Fenster)
      await antrag(1, '2026-07-12T21:30:00Z'); // So 12.07., 23:30 Berlin: W28, vor dem Fenster
      await antrag(2, '2026-09-10T10:00:00Z'); // W37, andere Gemeinde
      await antrag(4, '2026-10-01T09:00:00Z'); // interne Gemeinde: zaehlt nicht
      await antrag(1, '2026-10-04T22:30:00Z'); // Mo 05.10., 00:30 Berlin: W41, nach dem Fenster

      // Buchungen (event_bookings, Zeitpunkt booking_date); jeder Status zaehlt
      await buchung(1, 1, 1, '2026-08-05T10:00:00Z'); // W32
      await buchung(1, 2, 1, '2026-08-06T10:00:00Z'); // W32
      await buchung(2, 1, 1, '2026-10-04T10:00:00Z'); // W40 (So 04.10.)
      await buchung(4, 6, 2, '2026-09-02T10:00:00Z', 'cancelled'); // W36, abgesagt zaehlt mit
      await buchung(3, 2, 4, '2026-09-02T10:00:00Z'); // interne Gemeinde: zaehlt nicht
      await buchung(3, 1, 1, null); // ohne Zeitpunkt: zaehlt nicht
      await buchung(2, 2, 1, '2026-10-04T22:30:00Z'); // W41, nach dem Fenster

      // Nachrichten (chat_messages; die Gemeinde kommt vom Raum)
      await nachricht(1, '2026-09-14T08:00:00Z'); // W38
      await nachricht(1, '2026-09-14T09:00:00Z'); // W38
      await nachricht(1, '2026-09-14T10:00:00Z', '2026-09-14T11:00:00'); // W38, spaeter geloescht -- gesendet war sie
      await nachricht(1, '2026-09-27T22:30:00Z'); // W40 (Berlin: Mo 28.09.)
      await nachricht(4, '2026-07-14T10:00:00Z'); // W29, Raum der anderen Gemeinde
      await nachricht(10, '2026-09-14T08:00:00Z'); // Raum der internen Gemeinde: zaehlt nicht

      const { aktivitaet } = await uebersicht();
      expect(aktivitaet).toEqual({
        wochen: WOCHEN,
        antraege: reihe({ 0: 1, 8: 1, 10: 1, 11: 2 }),
        buchungen: reihe({ 3: 2, 7: 1, 11: 1 }),
        nachrichten: reihe({ 0: 1, 9: 3, 11: 1 }),
      });
    });
  });

  // ==========================================================================
  // Jahreswechsel: ISO-Jahr statt Kalenderjahr
  // ==========================================================================
  describe('Jahreswechsel', () => {
    it('Wochen tragen das ISO-Jahr: 29.12.2025 bis 04.01.2026 ist 2026-W01', async () => {
      vi.setSystemTime(new Date('2026-01-02T10:00:00Z')); // Freitag in 2026-W01
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at) VALUES
           (1, 4, 'admin', 'text', 'a', '2025-12-30T12:00:00Z'),
           (1, 4, 'admin', 'text', 'b', '2025-12-28T12:00:00Z')`);
      const { aktivitaet, entwicklung } = await uebersicht();
      expect(aktivitaet.wochen).toEqual([
        '2025-W42', '2025-W43', '2025-W44', '2025-W45', '2025-W46', '2025-W47',
        '2025-W48', '2025-W49', '2025-W50', '2025-W51', '2025-W52', '2026-W01']);
      // Di 30.12.2025 liegt in 2026-W01, So 28.12.2025 noch in 2025-W52.
      expect(aktivitaet.nachrichten).toEqual(reihe({ 10: 1, 11: 1 }));
      expect(entwicklung.monate).toEqual([
        '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07',
        '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']);
    });

    it('2026 hat 53 ISO-Wochen: 2026-W53 steht vor 2027-W01', async () => {
      vi.setSystemTime(new Date('2027-01-06T10:00:00Z')); // Mittwoch in 2027-W01
      await db.query(
        "INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at) VALUES (1, 4, 'admin', 'text', 'a', '2026-12-31T12:00:00Z')");
      const { aktivitaet, entwicklung } = await uebersicht();
      expect(aktivitaet.wochen).toEqual([
        '2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47', '2026-W48',
        '2026-W49', '2026-W50', '2026-W51', '2026-W52', '2026-W53', '2027-W01']);
      expect(aktivitaet.nachrichten).toEqual(reihe({ 10: 1 }));
      expect(entwicklung.monate[11]).toBe('2027-01');
    });
  });

  // ==========================================================================
  // Kennzahlen
  // ==========================================================================
  describe('Kennzahlen', () => {
    it('Gemeinden nach Laufzeit, Konten je Rolle über beide Quellen, aktive Konten, offene Anfragen, ungelesene Mails', async () => {
      // Gemeinden: 1 unbegrenzt (Seed), 2 Testphase, 3 Lizenz, 4 intern, 5 gesperrt, 6 Testphase (spaeter)
      await db.query("UPDATE organizations SET is_trial = true, trial_ends_at = '2026-10-10T08:00:00Z' WHERE id = 2");
      const r3 = await d.gemeinde({ id: 3, is_trial: false, trial_ends_at: '2027-03-01T00:00:00Z' });
      const r4 = await d.gemeinde({ id: 4, intern: true, is_trial: true, trial_ends_at: '2026-10-05T08:00:00Z' });
      await d.gemeinde({ id: 5, is_active: false, is_trial: true, trial_ends_at: '2026-10-06T08:00:00Z' });
      await d.gemeinde({ id: 6, is_trial: true, trial_ends_at: '2026-12-31T00:00:00Z' });

      // Konten
      await d.konto({ id: 60, organization_id: 1, role_id: 2, last_login_at: '2026-09-30T08:00:00Z' }); // Teamer:in in 1 und 2, Leitung in 3
      await d.zusatz(60, 2, 7);
      await d.zusatz(60, 3, r3.org_admin);
      await d.konto({ id: 61, organization_id: 4, role_id: r4.konfi, last_login_at: '2026-10-02T08:00:00Z' }); // nur in der internen Gemeinde
      await d.konto({ id: 62, organization_id: 4, role_id: r4.teamer, last_login_at: '2026-10-02T08:00:00Z' }); // intern, aber Teamer:in in Gemeinde 1
      await d.zusatz(62, 1, 2);
      await d.konto({ id: 63, organization_id: 1, role_id: 1, is_active: false }); // gesperrt
      await d.konto({ id: 64, organization_id: 1, role_id: 1, deleted_at: '2026-09-01T00:00:00' }); // geloescht

      // aktiv in 30 Tagen (bis 03.09.2026, 08:00 UTC): Anmeldung oder erneuerte Anmeldung
      await db.query("UPDATE users SET last_login_at = '2026-09-28T08:00:00Z' WHERE id = 1"); // aktiv
      await db.query("UPDATE users SET last_login_at = '2026-09-03T09:00:00Z' WHERE id = 2"); // 29 Tage 23 Stunden: aktiv
      await db.query("UPDATE users SET last_login_at = '2026-09-03T07:00:00Z' WHERE id = 6"); // 30 Tage 1 Stunde: nicht
      await db.query("UPDATE users SET last_login_at = '2026-09-02T08:00:00Z' WHERE id = 3"); // nicht
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
         VALUES (4, repeat('a', 64), '2026-11-01 00:00:00', '2026-09-23 08:00:00')`); // Admin 1: nur ein Refresh-Token, aktiv

      // Anfragen: drei offen (neu, neu, in_arbeit), zwei erledigt
      const offen = await d.anfrage({ status: 'neu' });
      await d.anfrage({ status: 'neu' });
      await d.anfrage({ status: 'in_arbeit' });
      await d.anfrage({ status: 'angelegt' });
      await d.anfrage({ status: 'abgelehnt' });

      // Mails: drei ungelesen eingehend (offen, zur Anfrage, zur INTERNEN Gemeinde -- Mails werden nicht nach intern gefiltert)
      await d.mail();
      await d.mail({ anfrage_id: offen });
      await d.mail({ organization_id: 4 });
      await d.mail({ gelesen_am: '2026-09-02T10:00:00Z' }); // gelesen
      await d.mail({ richtung: 'aus' }); // ausgehend zaehlt nie

      const { kennzahlen } = await uebersicht();
      expect(kennzahlen).toEqual({
        // Gemeinden 1, 2, 3, 5, 6 (4 ist intern); gesperrt (5) steht nur dort
        gemeinden: { gesamt: 5, testphase: 2, lizenz: 1, unbegrenzt: 1, gesperrt: 1 },
        // Konfi 1, 2, 3 (61 nur intern, 63 gesperrt, 64 geloescht); Teamer:in 3, 7, 60 (einmal, trotz zwei Gemeinden), 62
        // (Mitglied in Gemeinde 1); Admin 4, 8; Leitung 5, 9, 11 und 60 (in Gemeinde 3)
        konten: { konfi: 3, teamer: 4, admin: 2, org_admin: 4 },
        // Konfi 1, Konfi 2, Admin 1 (Refresh-Token), 60, 62 -- je Konto einmal
        aktiv_30_tage: 5,
        anfragen_offen: 3,
        mails_ungelesen: 3,
      });
    });
  });

  // ==========================================================================
  // Neueste Anfragen und Mails
  // ==========================================================================
  describe('neueste Anfragen und Mails', () => {
    it('die fünf neuesten Anfragen, neueste zuerst, bei gleichem Zeitpunkt die mit der größeren Kennung; ungelesen aus den Mails', async () => {
      const ids = [];
      for (const [i, tag] of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].entries()) {
        ids.push(await d.anfrage({ gemeinde: `Gemeinde ${i + 1}`, created_at: `${tag}T10:00:00Z` }));
      }
      ids.push(await d.anfrage({ gemeinde: 'Gemeinde 6', status: 'in_arbeit', wunsch_lizenz: 'standard', kontakt_name: 'Frau Sechs', created_at: '2026-09-06T10:00:00Z' }));
      ids.push(await d.anfrage({ gemeinde: 'Gemeinde 7', status: 'abgelehnt', created_at: '2026-09-06T10:00:00Z' }));
      // Mails an Anfrage 7: zwei ungelesene eingehende, eine gelesene, eine ausgehende -- ungelesen = 2
      await d.mail({ anfrage_id: ids[6] });
      await d.mail({ anfrage_id: ids[6] });
      await d.mail({ anfrage_id: ids[6], gelesen_am: '2026-09-07T10:00:00Z' });
      await d.mail({ anfrage_id: ids[6], richtung: 'aus' });

      const { neueste_anfragen: liste } = await uebersicht();
      expect(liste).toEqual([
        { id: ids[6], gemeinde: 'Gemeinde 7', kontakt_name: 'Pastorin Probe', status: 'abgelehnt', wunsch_lizenz: null, created_at: '2026-09-06T10:00:00.000Z', ungelesen: 2 },
        { id: ids[5], gemeinde: 'Gemeinde 6', kontakt_name: 'Frau Sechs', status: 'in_arbeit', wunsch_lizenz: 'standard', created_at: '2026-09-06T10:00:00.000Z', ungelesen: 0 },
        { id: ids[4], gemeinde: 'Gemeinde 5', kontakt_name: 'Pastorin Probe', status: 'neu', wunsch_lizenz: null, created_at: '2026-09-05T10:00:00.000Z', ungelesen: 0 },
        { id: ids[3], gemeinde: 'Gemeinde 4', kontakt_name: 'Pastorin Probe', status: 'neu', wunsch_lizenz: null, created_at: '2026-09-04T10:00:00.000Z', ungelesen: 0 },
        { id: ids[2], gemeinde: 'Gemeinde 3', kontakt_name: 'Pastorin Probe', status: 'neu', wunsch_lizenz: null, created_at: '2026-09-03T10:00:00.000Z', ungelesen: 0 },
      ]);
    });

    it('die fünf neuesten EINGEHENDEN Mails, zugeordnet oder nicht, mit dem Gemeindenamen der Zuordnung', async () => {
      await d.gemeinde({ id: 3, anzeige: 'Evangelische Kirchengemeinde Beispiel' });
      await d.gemeinde({ id: 4, intern: true, anzeige: 'Test Teamer Sicht' });
      await d.gemeinde({ id: 5, name: 'nur-systemname', anzeige: '  ' }); // ohne Anzeigenamen: der Name
      const anfrageId = await d.anfrage({ gemeinde: 'Kirchengemeinde Büsum' });
      const stunde = (h) => new Date(Date.UTC(2026, 8, 20, h));

      await d.mail({ betreff: 'zu alt', gesendet_am: stunde(1) });
      const offen = await d.mail({ betreff: 'offen', von_name: 'Erika', gesendet_am: stunde(2), postfach: 'support' });
      const zurAnfrage = await d.mail({ betreff: 'Anfrage', anfrage_id: anfrageId, gesendet_am: stunde(3), gelesen_am: stunde(4) });
      const zurGemeinde = await d.mail({ betreff: 'Gemeinde', organization_id: 3, gesendet_am: stunde(5) });
      const zurInternen = await d.mail({ betreff: 'Intern', organization_id: 4, gesendet_am: stunde(6) });
      const ohneAnzeige = await d.mail({ betreff: 'Ohne Anzeigenamen', organization_id: 5, gesendet_am: stunde(7) });
      await d.mail({ betreff: 'ausgehend', richtung: 'aus', gesendet_am: stunde(8) }); // zaehlt nicht

      const { neueste_mails: liste } = await uebersicht();
      const iso = (h) => stunde(h).toISOString();
      const absender = { von_adresse: 'absender@beispiel.example', von_name: null };
      expect(liste).toEqual([
        { id: ohneAnzeige, postfach: 'moin', ...absender, betreff: 'Ohne Anzeigenamen', gesendet_am: iso(7), gelesen_am: null, anfrage_id: null, organization_id: 5, gemeinde_name: 'nur-systemname' },
        { id: zurInternen, postfach: 'moin', ...absender, betreff: 'Intern', gesendet_am: iso(6), gelesen_am: null, anfrage_id: null, organization_id: 4, gemeinde_name: 'Test Teamer Sicht' },
        { id: zurGemeinde, postfach: 'moin', ...absender, betreff: 'Gemeinde', gesendet_am: iso(5), gelesen_am: null, anfrage_id: null, organization_id: 3, gemeinde_name: 'Evangelische Kirchengemeinde Beispiel' },
        { id: zurAnfrage, postfach: 'moin', ...absender, betreff: 'Anfrage', gesendet_am: iso(3), gelesen_am: iso(4), anfrage_id: anfrageId, organization_id: null, gemeinde_name: 'Kirchengemeinde Büsum' },
        { id: offen, postfach: 'support', von_adresse: 'absender@beispiel.example', von_name: 'Erika', betreff: 'offen', gesendet_am: iso(2), gelesen_am: null, anfrage_id: null, organization_id: null, gemeinde_name: null },
      ]);
    });
  });

  // ==========================================================================
  // Testphasen, die bald enden
  // ==========================================================================
  describe('testphase_endet', () => {
    it('laufende Testphasen der nächsten 14 Tage, früheste zuerst; Grenzen, Lizenz, gesperrt und intern bleiben draußen', async () => {
      const g = (id, f) => d.gemeinde({ id, is_trial: true, ...f });
      await g(3, { anzeige: 'Später', trial_ends_at: '2026-10-12T08:00:00Z' });
      await g(4, { anzeige: 'Früher', trial_ends_at: '2026-10-04T08:00:00Z' });
      await g(5, { anzeige: 'Genau vierzehn Tage', trial_ends_at: '2026-10-17T08:00:00Z' }); // Obergrenze: eingeschlossen
      await g(6, { anzeige: 'Eine Sekunde zu spät', trial_ends_at: '2026-10-17T08:00:01Z' });
      await g(7, { anzeige: 'Genau jetzt', trial_ends_at: '2026-10-03T08:00:00Z' }); // Untergrenze: schon vorbei
      await g(8, { anzeige: 'Schon abgelaufen', trial_ends_at: '2026-10-02T08:00:00Z' });
      await g(9, { anzeige: 'Lizenz', is_trial: false, trial_ends_at: '2026-10-08T08:00:00Z' }); // keine Testphase
      await g(10, { anzeige: 'Gesperrt', is_active: false, trial_ends_at: '2026-10-05T08:00:00Z' });
      await g(11, { anzeige: 'Intern', intern: true, trial_ends_at: '2026-10-06T08:00:00Z' });
      await g(12, { anzeige: 'Unbegrenzt', is_trial: false, trial_ends_at: null });

      const { testphase_endet: liste } = await uebersicht();
      expect(liste).toEqual([
        { id: 4, display_name: 'Früher', trial_ends_at: '2026-10-04T08:00:00.000Z' },
        { id: 3, display_name: 'Später', trial_ends_at: '2026-10-12T08:00:00.000Z' },
        { id: 5, display_name: 'Genau vierzehn Tage', trial_ends_at: '2026-10-17T08:00:00.000Z' },
      ]);
    });
  });
});
