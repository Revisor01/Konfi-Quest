// backend/tests/utils/kontoLoeschen.test.js
//
// Die gemeinsame Loeschfunktion fuer alle Kontoloeschwege (utils/kontoLoeschen.js)
// und ihr Waechter. Simon, 28.09.2026: "konto löschen muss wirklich alles löschen."
//
// BESTANDSAUFNAHME 28.09.2026 (vor der Umstellung, nachgemessen mit
// tests/routes/kontoLoeschenWege.test.js):
//
//   Personenbezug MIT Fremdschluessel: 51 Spalten in 35 Tabellen zeigen auf
//   users (55 Constraints -- vier Spalten tragen aus der SQLite-Zeit zwei).
//   27 davon sind Eigentum der Person, 24 Urheberschaft an Dingen der Gemeinde
//   oder anderer (LOESCHREGELN).
//   OHNE Fremdschluessel: der Zaehler der Anmeldesperre (rate_limit_zaehler,
//   Hash ueber den Benutzernamen), die Mitteilungen UEBER die Person bei der
//   Leitung (notifications.data: konfi_id, user_id, request_id), der Name
//   eines Zweiergespraechs (chat_rooms.name = Anzeigename der angeschriebenen
//   Person), die Dateien unter uploads/requests, uploads/challenges und
//   uploads/chat. Profilbilder, Vorschaubilder oder zweite Fassungen gibt es
//   nicht: verschluesselt wird unter demselben Namen (utils/photoCrypto.js).
//   Material-Dateien gehoeren der Gemeinde, nicht der Person.
//
//   DELETE /admin/konfis/:id, POST /auth/delete-account und die automatische
//   Loeschung (gemeinsam utils/konfiDeletion.js) nahmen jede Zeile der Person
//   mit, ausdruecklich oder per ON DELETE CASCADE. Liegen blieben das
//   Zweiergespraech (Raum mit ihrem Namen, Nachrichten und Dateien der
//   anderen Seite) und der Zaehler der Anmeldesperre (bis zu einer Stunde).
//   Zu viel ging: die Einladungscodes, die die Person fuer die Gemeinde
//   angelegt hatte. Dateien wurden VOR dem COMMIT des Aufrufers geloescht.
//   Hatte die Person Antraege, Beitraege oder Buchungen in einer WEITEREN
//   Gemeinde, scheiterte die Loeschung mit 500 (Fremdschluessel
//   activity_requests_konfi_id_fkey): Eine eingeladene Teamer:in mit einem
//   Antrag dort konnte ihr Konto nicht loeschen, die automatische Loeschung
//   zaehlte den Fall als fehlgeschlagen.
//   DELETE /users/:id (eigener Block in routes/users.js): dasselbe, dazu
//   ruecke niemand auf frei werdende Plaetze nach, und ein Zweiergespraech
//   ging nur, wenn niemand mehr darin sass -- also praktisch nie.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS } = require('../helpers/seed');
const {
  LOESCHREGELN, pruefeLoeschregeln, fremdschluesselAufUsers,
  kontoDatenLoeschen, kontenDatenLoeschen, kontoDateienLoeschen, meldeNachKontoLoeschung,
} = require('../../utils/kontoLoeschen');
const { CHAT_DIR, CHALLENGES_DIR, REQUESTS_DIR } = require('../../utils/photoStorage');
const liveUpdate = require('../../utils/liveUpdate');
const PushService = require('../../services/pushService');
const {
  legeVollePersonAn, unbelegteSpalten, befundNachLoeschung, erwarteterBefund, dateienAufraeumen,
  dateiDa, hexName, legeDateiAn,
} = require('../helpers/vollePerson');

describe('Konto löschen (utils/kontoLoeschen.js)', () => {
  let db;
  let voll = null;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });
  afterEach(() => {
    dateienAufraeumen(voll);
    voll = null;
    vi.restoreAllMocks();
  });
  afterAll(async () => { await closePool(); });

  /** Eine neue Teamer:in in Org 1 -- nicht aus dem Seed, damit sie niemandem fehlt. */
  async function neuePerson(username = 'wird_geloescht', rolle = ROLES.teamer.id, org = ORGS.testGemeinde.id) {
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
      [username, `Person ${username}`, rolle, org]);
    return Number(u.id);
  }

  async function inTransaktion(arbeit, { festschreiben = true } = {}) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const ergebnis = await arbeit(client);
      await client.query(festschreiben ? 'COMMIT' : 'ROLLBACK');
      return ergebnis;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ==================================================================
  // Der Waechter
  // ==================================================================
  describe('Wächter: jede Fremdschlüssel-Spalte auf users hat eine Löschregel', () => {
    it('information_schema und LOESCHREGELN decken sich in beide Richtungen', async () => {
      expect(await pruefeLoeschregeln(db)).toEqual({ fehlend: [], veraltet: [] });
      // Jede Fremdschluessel-Spalte ist geregelt (56 im Schema der Produktion samt Migration 191,
      // 193 und 195; 204 legte leitung_kennzahlen an, 205 entfernte sie wieder;
      // wrapped.test.js nimmt einer davon zeitweise den Fremdschluessel).
      const regeln = Object.keys(LOESCHREGELN);
      expect((await fremdschluesselAufUsers(db)).every((s) => regeln.includes(s))).toBe(true);
      expect(regeln.length).toBe(56);
    });

    it('eine Regel für eine Spalte, die es nicht mehr gibt, fällt auf', async () => {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query('ALTER TABLE levels RENAME COLUMN created_by TO angelegt_von');
        expect(await pruefeLoeschregeln(client)).toEqual({
          fehlend: ['levels.angelegt_von'],
          veraltet: ['levels.created_by'],
        });
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });

    it('eine geregelte Spalte ohne Fremdschlüssel stört nicht', async () => {
      // So hinterliess tests/routes/wrapped.test.js bis zum 29.09.2026 die
      // Spalte approved_by: gedroppt und ohne Fremdschluessel neu angelegt.
      // Seither stellt die Datei den Fremdschluessel wieder her und prueft den
      // Rueckbau. Der Fall bleibt trotzdem abgedeckt: Die Regel wirkt auch
      // ohne Fremdschluessel (UPDATE ueber die Spalte) -- der Waechter darf
      // nicht fallen.
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query('ALTER TABLE challenge_submissions DROP CONSTRAINT challenge_submissions_approved_by_fkey');
        expect(await pruefeLoeschregeln(client)).toEqual({ fehlend: [], veraltet: [] });
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });

    it('jede Regel heißt loeschen oder nullen', () => {
      const unbekannt = Object.entries(LOESCHREGELN).filter(([, r]) => r !== 'loeschen' && r !== 'nullen');
      expect(unbekannt).toEqual([]);
    });

    it('eine neue Tabelle mit Verweis auf users und ohne Regel fällt auf', async () => {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query(
          'CREATE TABLE waechter_probe (id SERIAL PRIMARY KEY, besitzer_id INTEGER REFERENCES users(id))');
        expect(await pruefeLoeschregeln(client)).toEqual({ fehlend: ['waechter_probe.besitzer_id'], veraltet: [] });
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });
  });

  // ==================================================================
  // Die Loeschung selbst
  // ==================================================================
  describe('kontoDatenLoeschen', () => {
    it('nimmt alles der Person mit und lässt der Gemeinde ihre Dinge', async () => {
      const P = await neuePerson();
      voll = await legeVollePersonAn(db, P);
      expect(await unbelegteSpalten(db, P)).toEqual([]);

      const ergebnis = await inTransaktion((client) => kontoDatenLoeschen(client, P));
      const dateien = await kontoDateienLoeschen(ergebnis.dateien);

      expect(await befundNachLoeschung(db, voll)).toEqual(erwarteterBefund(voll));
      // Zwei Antragsfotos, zwei Beitraege (je Gemeinde eines), zwei Chat-Dateien
      // (die eigene und die der Leitung im Zweiergespraech).
      expect({
        antragsfotos: ergebnis.dateien.antragsfotos.length,
        challenge: ergebnis.dateien.challenge.length,
        chat: ergebnis.dateien.chat.length,
      }).toEqual({ antragsfotos: 2, challenge: 2, chat: 2 });
      expect(dateien).toEqual({ entfernt: 6, fehlten: 0, fehler: 0 });
      expect(ergebnis.gespraechspartner).toEqual([{ user_id: USERS.admin1.id, user_type: 'admin' }]);
    });

    it('ROLLBACK: keine Zeile und keine Datei geht verloren', async () => {
      const P = await neuePerson();
      voll = await legeVollePersonAn(db, P);

      const ergebnis = await inTransaktion((client) => kontoDatenLoeschen(client, P), { festschreiben: false });

      // Die Funktion selbst fasst keine Datei an -- das tut erst der Aufrufer
      // nach dem COMMIT.
      expect(ergebnis.dateien.chat.length).toBe(2);
      expect(await unbelegteSpalten(db, P)).toEqual([]);
      expect(voll.dateien.eigene.filter(dateiDa).length).toBe(voll.dateien.eigene.length);
      expect(voll.dateien.zweierraum.filter(dateiDa).length).toBe(1);
    });

    it('unbekanntes Konto: null, nichts geschieht', async () => {
      expect(await inTransaktion((client) => kontoDatenLoeschen(client, 99999))).toBeNull();
      const { rows: [z] } = await db.query('SELECT COUNT(*)::int AS n FROM users');
      expect(z.n).toBe(Object.keys(USERS).length);
    });

    it('lässt die anderen Konten derselben Gemeinde unberührt', async () => {
      const P = await neuePerson();
      await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
         VALUES ($1, 2, 'gemeinde', 'fremd', $2, 1), ($3, 2, 'gemeinde', 'eigen', $2, 1)`,
        [USERS.konfi2.id, USERS.admin1.id, P]);

      await inTransaktion((client) => kontoDatenLoeschen(client, P));

      const { rows } = await db.query('SELECT konfi_id FROM bonus_points ORDER BY id');
      // konfi1 aus dem Seed, konfi2 von hier -- die Person ist weg.
      expect(rows.map((r) => Number(r.konfi_id))).toEqual([USERS.konfi1.id, USERS.konfi2.id]);
      const { rows: [z] } = await db.query('SELECT COUNT(*)::int AS n FROM users WHERE id = ANY($1::int[])',
        [[USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, USERS.admin1.id]]);
      expect(z.n).toBe(4);
    });

    it('Nachrücken in einer weiteren Gemeinde: Team-Platz an die wartende Teamer:in, Meldung dort', async () => {
      const P = await neuePerson();
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [P, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      await db.query(
        `UPDATE events SET teamer_max_participants = 1, teamer_waitlist_enabled = true, teamer_needed = true
          WHERE id = 4`);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, created_at)
         VALUES ($1, 4, 'confirmed', 2, NOW() - interval '1 hour', NOW() - interval '1 hour'),
                ($2, 4, 'waitlist', 2, NOW(), NOW())`,
        [P, USERS.teamer2.id]);
      const push = vi.spyOn(PushService, 'sendWaitlistPromotionToTeamer').mockResolvedValue(undefined);

      const ergebnis = await inTransaktion((client) => kontoDatenLoeschen(client, P));
      await meldeNachKontoLoeschung(db, ergebnis);

      expect(ergebnis.nachgerueckt).toEqual([
        { eventId: 4, userId: USERS.teamer2.id, seite: 'team', organizationId: ORGS.andereGemeinde.id },
      ]);
      const { rows: [b] } = await db.query(
        'SELECT status FROM event_bookings WHERE user_id = $1 AND event_id = 4', [USERS.teamer2.id]);
      expect(b.status).toBe('confirmed');
      expect(push).toHaveBeenCalledTimes(1);
      // Gemeinde der Meldung: die des Events, nicht die Stamm-Gemeinde der Person.
      expect(push.mock.calls[0][1]).toBe(USERS.teamer2.id);
      expect(push.mock.calls[0][4]).toBe(4);
      expect(push.mock.calls[0][5]).toBe(ORGS.andereGemeinde.id);
    });

    it('gesperrte Gemeinde (melden: false): nachgerückt, aber keine Meldung', async () => {
      const P = await neuePerson('konfi_weg', ROLES.konfi.id);
      await db.query('UPDATE events SET max_participants = 1, waitlist_enabled = true WHERE id = 1');
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, created_at)
         VALUES ($1, 1, 'confirmed', 1, NOW() - interval '1 hour', NOW() - interval '1 hour'),
                ($2, 1, 'waitlist', 1, NOW(), NOW())`,
        [P, USERS.konfi2.id]);
      const push = vi.spyOn(PushService, 'sendWaitlistPromotionToKonfi').mockResolvedValue(undefined);

      const ergebnis = await inTransaktion((client) => kontoDatenLoeschen(client, P));
      await meldeNachKontoLoeschung(db, ergebnis, { melden: false });

      expect(ergebnis.nachgerueckt).toEqual([
        { eventId: 1, userId: USERS.konfi2.id, seite: 'konfi', organizationId: ORGS.testGemeinde.id },
      ]);
      expect(push).not.toHaveBeenCalled();
    });
  });

  // ==================================================================
  // Mehrere Konten in einem Durchgang (Gemeinde loeschen, 29.09.2026)
  // ==================================================================
  describe('kontenDatenLoeschen', () => {
    it('volle Person und zwei weitere: alles weg, dieselbe Regel wie einzeln', async () => {
      const P = await neuePerson();
      voll = await legeVollePersonAn(db, P);
      const Q = await neuePerson('auch_weg', ROLES.konfi.id);
      const R = await neuePerson('auch_weg_2');
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, 'Neue Registrierung', 'Q', 'new_konfi_registration', $2, 1),
                ($1, 'Neuer Beitrag', 'R', 'challenge_submission', $3, 1)`,
        [USERS.admin1.id, JSON.stringify({ konfi_id: Q }), JSON.stringify({ user_id: R })]);

      const ergebnis = await inTransaktion((client) => kontenDatenLoeschen(client, [P, Q, R, 99999]));
      await kontoDateienLoeschen(ergebnis.dateien);

      expect(ergebnis.geloescht).toEqual([P, Q, R]);
      expect(await befundNachLoeschung(db, voll)).toEqual(erwarteterBefund(voll));
      const { rows: [z] } = await db.query('SELECT COUNT(*)::int AS n FROM users WHERE id = ANY($1::int[])', [[P, Q, R]]);
      expect(z.n).toBe(0);
      // Die Mitteilungen ueber Q und R bei der Leitung gehen mit.
      const { rows: [m] } = await db.query(
        `SELECT COUNT(*)::int AS n FROM notifications WHERE message IN ('Q', 'R')`);
      expect(m.n).toBe(0);
    });

    it('rückt nicht eine Person nach, die im selben Durchgang geht', async () => {
      const P = await neuePerson('bestaetigt_weg', ROLES.konfi.id);
      const Q = await neuePerson('wartet_weg', ROLES.konfi.id);
      await db.query('UPDATE events SET max_participants = 1, waitlist_enabled = true WHERE id = 1');
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date, created_at)
         VALUES ($1, 1, 'confirmed', 1, NOW() - interval '2 hours', NOW() - interval '2 hours'),
                ($2, 1, 'waitlist', 1, NOW() - interval '1 hour', NOW() - interval '1 hour'),
                ($3, 1, 'waitlist', 1, NOW(), NOW())`,
        [P, Q, USERS.konfi2.id]);

      const ergebnis = await inTransaktion((client) => kontenDatenLoeschen(client, [P, Q]));

      expect(ergebnis.nachgerueckt).toEqual([
        { eventId: 1, userId: USERS.konfi2.id, seite: 'konfi', organizationId: ORGS.testGemeinde.id },
      ]);
      const { rows } = await db.query('SELECT user_id, status FROM event_bookings WHERE event_id = 1 ORDER BY id');
      expect(rows.map((r) => ({ user_id: Number(r.user_id), status: r.status })))
        .toEqual([{ user_id: USERS.konfi2.id, status: 'confirmed' }]);
    });

    it('leere oder unbekannte Liste: nichts geschieht', async () => {
      const leer = { geloescht: [], nachgerueckt: [], dateien: { antragsfotos: [], challenge: [], chat: [] }, gespraechspartner: [] };
      expect(await inTransaktion((client) => kontenDatenLoeschen(client, []))).toEqual(leer);
      expect(await inTransaktion((client) => kontenDatenLoeschen(client, [99998, 99999]))).toEqual(leer);
      const { rows: [z] } = await db.query('SELECT COUNT(*)::int AS n FROM users');
      expect(z.n).toBe(Object.keys(USERS).length);
    });
  });

  // ==================================================================
  // Nach dem COMMIT
  // ==================================================================
  describe('kontoDateienLoeschen', () => {
    const angelegt = [];
    afterEach(() => {
      for (const p of angelegt.splice(0)) {
        try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* weg */ }
      }
    });

    it('entfernt, zählt Fehlendes und protokolliert Fehler ohne Namen und Pfade', async () => {
      const da = legeDateiAn(CHAT_DIR, hexName());
      angelegt.push(path.join(CHAT_DIR, da.name));
      const fehlt = hexName();
      // Ein Verzeichnis unter dem Namen: unlink scheitert (EISDIR/EPERM), nicht ENOENT.
      const sperrig = hexName();
      fs.mkdirSync(path.join(CHAT_DIR, sperrig), { recursive: true });
      angelegt.push(path.join(CHAT_DIR, sperrig));
      const protokoll = vi.spyOn(console, 'error').mockImplementation(() => {});

      const summe = await kontoDateienLoeschen({
        chat: [da.name, fehlt, sperrig, '../ausbruch'],
        challenge: [],
        antragsfotos: [],
      });

      expect(summe).toEqual({ entfernt: 1, fehlten: 1, fehler: 2 });
      expect(dateiDa(da)).toBe(false);
      expect(protokoll).toHaveBeenCalledTimes(1);
      const zeile = protokoll.mock.calls[0].join(' ');
      expect(zeile).toMatch(/^Konto löschen: 2 von 4 Dateien \(chat\) nicht entfernt/);
      for (const verraeterisch of [da.name, fehlt, sperrig, 'ausbruch', CHAT_DIR, CHALLENGES_DIR, REQUESTS_DIR]) {
        expect(zeile).not.toContain(verraeterisch);
      }
    });

    it('ohne Dateien: nichts zu tun, kein Protokoll', async () => {
      const protokoll = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await kontoDateienLoeschen(undefined)).toEqual({ entfernt: 0, fehlten: 0, fehler: 0 });
      expect(await kontoDateienLoeschen({ chat: [], challenge: [], antragsfotos: [] }))
        .toEqual({ entfernt: 0, fehlten: 0, fehler: 0 });
      expect(protokoll).not.toHaveBeenCalled();
    });
  });

  describe('meldeNachKontoLoeschung', () => {
    it('frischt die Chatliste der Gesprächspartner:innen auf (roomsChanged)', async () => {
      const gesendet = [];
      liveUpdate.init({ to: (raum) => ({ emit: (ereignis) => gesendet.push(`${raum}:${ereignis}`) }) });
      try {
        await meldeNachKontoLoeschung(db, {
          nachgerueckt: [],
          dateien: {},
          gespraechspartner: [
            { user_id: 4, user_type: 'admin' },
            { user_id: 2, user_type: 'konfi' },
            { user_id: 4, user_type: 'admin' },
          ],
        });
      } finally {
        liveUpdate._reset();
      }
      expect(gesendet).toEqual(['user_admin_4:roomsChanged', 'user_konfi_2:roomsChanged']);
    });
  });
});
