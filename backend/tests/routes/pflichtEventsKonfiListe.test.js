// backend/tests/routes/pflichtEventsKonfiListe.test.js
//
// Pflicht-Events "x von y" je Konfi -- in der Konfi-Liste der Leitung
// (GET /api/admin/konfis, additiv: pflicht_besucht, pflicht_faellig) und in
// der Anwesenheits-Statistik (GET /api/admin/konfis/:id/attendance-stats,
// total_mandatory, attended). Beide lesen EINE Regel
// (backend/utils/pflichtTermine.js).
//
// Simon, 13.10.2026: "eine anzahl der besuchten pflichtevents auf den listen
// und kacheln" -- "3 von 5" (besucht von bisher faelligen), "entschuldigt
// zaehlt als nicht besucht".
//
// Faellig ist ein Pflicht-Event der Gemeinde, das diese Konfi sieht (eigener
// Jahrgang oder Termin ohne jeden Jahrgang, nie "Nur Team";
// utils/konfiTerminSicht.js), nicht abgesagt und schon begonnen. Besucht
// heisst: Anwesenheit "anwesend". Entschuldigt, abwesend, abgemeldet oder
// nicht eingetragen zaehlt als nicht besucht.
//
// Bis 13.10.2026 zaehlte die Statistik nur die Termine des eigenen Jahrgangs:
// ein Pflicht-Event ohne Jahrgang fehlte, "Nur Team" mit Jahrgang zaehlte mit,
// und eine Konfi ohne Jahrgang bekam immer 0 von 0.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;

const JG_B = 311;           // zweiter Jahrgang derselben Gemeinde
const KONFI_B = 511;        // Konfi im Jahrgang B
const KONFI_OHNE_JG = 512;  // Konfi ohne Jahrgang

describe('Pflicht-Events je Konfi: Liste und Statistik (eine Regel)', () => {
  let db;
  let app;
  let t;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  async function termin({ org = ORG1, jahrgaenge = [], tage, pflicht = true, abgesagt = false, nurTeam = false }) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, cancelled, teamer_only,
                           max_participants, point_type, points)
       VALUES ('Termin', NOW() + make_interval(days => $1), $2, $3, $4, $5, 0, 'gemeinde', 0)
       RETURNING id`,
      [tage, org, pflicht, abgesagt, nurTeam]
    );
    for (const j of jahrgaenge) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, j]);
    }
    return e.id;
  }

  async function buchung(eventId, userId, { org = ORG1, status = 'confirmed', anwesenheit = null } = {}) {
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, userId, status, anwesenheit, org]
    );
  }

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 B', $2, '2027-05-01')`,
      [JG_B, ORG1]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'konfi_b', 'x', 'Berta Beispiel', 1, $3, true),
              ($2, 'konfi_ohne', 'x', 'Otto Ohne', 1, $3, true)`,
      [KONFI_B, KONFI_OHNE_JG, ORG1]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id)
       VALUES ($1, $2, $4), ($3, NULL, $4)`,
      [KONFI_B, JG_B, KONFI_OHNE_JG, ORG1]
    );
    // Leitung mit Jahrgang 1 (fuer den Jahrgangs-Filter der Liste).
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    for (const id of [KONFI_B, KONFI_OHNE_JG, USERS.admin1.id]) invalidateUserCache(id);

    const J1 = JAHRGAENGE.jahrgang1.id;
    t = {
      // faellig fuer Jahrgang 1
      j1Vorbei: await termin({ jahrgaenge: [J1], tage: -10 }),
      j1VorbeiZwei: await termin({ jahrgaenge: [J1], tage: -5 }),
      // nicht faellig: kuenftig, abgesagt, freiwillig, "Nur Team"
      j1Kuenftig: await termin({ jahrgaenge: [J1], tage: 5 }),
      j1Abgesagt: await termin({ jahrgaenge: [J1], tage: -4, abgesagt: true }),
      j1Freiwillig: await termin({ jahrgaenge: [J1], tage: -6, pflicht: false }),
      j1NurTeam: await termin({ jahrgaenge: [J1], tage: -7, nurTeam: true }),
      // ohne Jahrgang: faellig fuer alle Konfis der Gemeinde
      ohneJahrgang: await termin({ tage: -3 }),
      // fremder Jahrgang derselben Gemeinde
      jgB: await termin({ jahrgaenge: [JG_B], tage: -2 }),
      // fremde Gemeinde: mit Jahrgang und ohne
      org2Jahrgang: await termin({ org: ORG2, jahrgaenge: [JAHRGAENGE.jahrgang2.id], tage: -8 }),
      org2Ohne: await termin({ org: ORG2, tage: -9 }),
    };

    // Konfi 1: anwesend, entschuldigt, beim Termin ohne Jahrgang nicht eingetragen.
    // "anwesend" bei kuenftigem, abgesagtem, freiwilligem und "Nur Team"-Termin zaehlt nicht.
    await buchung(t.j1Vorbei, USERS.konfi1.id, { anwesenheit: 'present' });
    await buchung(t.j1VorbeiZwei, USERS.konfi1.id, { anwesenheit: 'excused' });
    await buchung(t.j1Kuenftig, USERS.konfi1.id, { anwesenheit: 'present' });
    await buchung(t.j1Abgesagt, USERS.konfi1.id, { anwesenheit: 'present' });
    await buchung(t.j1Freiwillig, USERS.konfi1.id, { anwesenheit: 'present' });
    await buchung(t.j1NurTeam, USERS.konfi1.id, { anwesenheit: 'present' });
    // Konfi 2: ueberall anwesend.
    await buchung(t.j1Vorbei, USERS.konfi2.id, { anwesenheit: 'present' });
    await buchung(t.j1VorbeiZwei, USERS.konfi2.id, { anwesenheit: 'present' });
    await buchung(t.ohneJahrgang, USERS.konfi2.id, { anwesenheit: 'present' });
    // Konfi B: Termin ohne Jahrgang anwesend, eigener Termin abgemeldet,
    // "anwesend" beim Termin eines fremden Jahrgangs zaehlt nicht.
    await buchung(t.ohneJahrgang, KONFI_B, { anwesenheit: 'present' });
    await buchung(t.jgB, KONFI_B, { status: 'opted_out' });
    await buchung(t.j1Vorbei, KONFI_B, { anwesenheit: 'present' });
    // Konfi ohne Jahrgang: Termin ohne Jahrgang als abwesend eingetragen.
    await buchung(t.ohneJahrgang, KONFI_OHNE_JG, { anwesenheit: 'absent' });
    // Gemeinde 2.
    await buchung(t.org2Jahrgang, USERS.konfi3.id, { org: ORG2, anwesenheit: 'present' });
    await buchung(t.org2Ohne, USERS.konfi3.id, { org: ORG2, anwesenheit: 'present' });
  });

  const liste = async (wer) => {
    const res = await request(app).get('/api/admin/konfis').set('Authorization', `Bearer ${generateToken(wer)}`);
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.map((k) => [k.id, { pflicht_besucht: k.pflicht_besucht, pflicht_faellig: k.pflicht_faellig }]));
  };

  const statistik = async (konfiId, wer = 'orgAdmin1') => {
    const res = await request(app)
      .get(`/api/admin/konfis/${konfiId}/attendance-stats`)
      .set('Authorization', `Bearer ${generateToken(wer)}`);
    expect(res.status).toBe(200);
    return res.body;
  };

  describe('GET /api/admin/konfis', () => {
    it('Gemeindeleitung: besucht von faellig je Konfi, als ganze Zahlen', async () => {
      expect(await liste('orgAdmin1')).toEqual({
        // faellig: j1Vorbei, j1VorbeiZwei, ohneJahrgang; besucht nur j1Vorbei (entschuldigt und nicht eingetragen zaehlen nicht)
        [USERS.konfi1.id]: { pflicht_besucht: 1, pflicht_faellig: 3 },
        [USERS.konfi2.id]: { pflicht_besucht: 3, pflicht_faellig: 3 },
        // faellig: ohneJahrgang, jgB (abgemeldet); der fremde Jahrgang zaehlt nicht
        [KONFI_B]: { pflicht_besucht: 1, pflicht_faellig: 2 },
        // ohne Jahrgang: nur der Termin ohne Jahrgang, abwesend
        [KONFI_OHNE_JG]: { pflicht_besucht: 0, pflicht_faellig: 1 },
      });
    });

    it('Leitung mit einem Jahrgang: dieselben Zahlen fuer ihre Konfis', async () => {
      expect(await liste('admin1')).toEqual({
        [USERS.konfi1.id]: { pflicht_besucht: 1, pflicht_faellig: 3 },
        [USERS.konfi2.id]: { pflicht_besucht: 3, pflicht_faellig: 3 },
      });
    });

    it('fremde Gemeinde: zaehlt nur ihre eigenen Termine, der Termin ohne Jahrgang der anderen Gemeinde zaehlt dort nicht', async () => {
      expect(await liste('orgAdmin2')).toEqual({
        [USERS.konfi3.id]: { pflicht_besucht: 2, pflicht_faellig: 2 },
      });
    });

    it('ohne faellige Pflicht-Events: 0 von 0, nicht null', async () => {
      await db.query('DELETE FROM events WHERE organization_id = $1', [ORG1]);
      expect(await liste('admin1')).toEqual({
        [USERS.konfi1.id]: { pflicht_besucht: 0, pflicht_faellig: 0 },
        [USERS.konfi2.id]: { pflicht_besucht: 0, pflicht_faellig: 0 },
      });
    });

    it('die bisherigen Felder bleiben (Antwortform der ausgelieferten Apps)', async () => {
      const res = await request(app).get('/api/admin/konfis').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(Array.isArray(res.body)).toBe(true);
      const konfi1 = res.body.find((k) => k.id === USERS.konfi1.id);
      expect(Object.keys(konfi1).sort()).toEqual([
        'badgeCount', 'gemeinde_enabled', 'gemeinde_points', 'gottesdienst_enabled', 'gottesdienst_points',
        'id', 'jahrgang_id', 'jahrgang_name', 'name', 'pflicht_besucht', 'pflicht_faellig',
        'target_gemeinde', 'target_gottesdienst', 'username',
      ]);
    });
  });

  describe('GET /api/admin/konfis/:id/attendance-stats', () => {
    it('Konfi 1: 1 von 3, verpasst sind der entschuldigte und der nicht eingetragene Termin', async () => {
      const s = await statistik(USERS.konfi1.id);
      expect(s.total_mandatory).toBe(3);
      expect(s.attended).toBe(1);
      expect(s.percentage).toBe(33);
      expect(s.missed_events.map((m) => m.event_id).sort((a, b) => a - b))
        .toEqual([t.j1VorbeiZwei, t.ohneJahrgang].sort((a, b) => a - b));
      expect(s.missed_events.every((m) => m.status === 'absent')).toBe(true);
    });

    it('Konfi B: der abgemeldete eigene Termin ist verpasst (opted_out), der fremde Jahrgang fehlt', async () => {
      const s = await statistik(KONFI_B);
      expect(s.total_mandatory).toBe(2);
      expect(s.attended).toBe(1);
      expect(s.missed_events).toHaveLength(1);
      expect(s.missed_events[0]).toEqual(expect.objectContaining({ event_id: t.jgB, status: 'opted_out' }));
    });

    it('Konfi ohne Jahrgang: der Termin ohne Jahrgang zaehlt (vorher immer 0 von 0)', async () => {
      const s = await statistik(KONFI_OHNE_JG);
      expect(s.total_mandatory).toBe(1);
      expect(s.attended).toBe(0);
      expect(s.percentage).toBe(0);
      expect(s.missed_events.map((m) => m.event_id)).toEqual([t.ohneJahrgang]);
    });

    it('Liste und Statistik sagen fuer jede Konfi dasselbe', async () => {
      const zahlen = await liste('orgAdmin1');
      for (const id of [USERS.konfi1.id, USERS.konfi2.id, KONFI_B, KONFI_OHNE_JG]) {
        const s = await statistik(id);
        expect({ id, besucht: s.attended, faellig: s.total_mandatory })
          .toEqual({ id, besucht: zahlen[id].pflicht_besucht, faellig: zahlen[id].pflicht_faellig });
      }
    });
  });
});
