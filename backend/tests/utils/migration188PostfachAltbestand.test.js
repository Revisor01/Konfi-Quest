// MIGRATION 188: Leitungs-Mitteilungen ueber eine Person, die keine Kennung
// der Person tragen, verlassen das Postfach (01.10.2026).
//
// Seit dem 27.09.2026 tragen die neun Arten "ueber eine Person"
// (utils/postfachAufraeumen.js, ARTEN_UEBER_PERSON) konfi_id oder user_id und
// gehen mit dem Konto der Person. Sieben davon trugen vorher nur den Namen im
// Text -- ein Abgleich ueber den Namen traefe Namensgleiche, deshalb blieben
// diese Zeilen bis zur 365-Tage-Frist stehen, mit Namen und Abmeldegrund von
// Konfis, auch wenn deren Konto laengst geloescht war. Simon, 01.10.2026, zu
// "den Altbestand ohne Kennung jetzt loeschen?": "ja".
//
// Geprueft wird die WIRKUNG der echten Datei aus backend/migrations/ auf einem
// nachgebauten Bestand: was geht, was bleibt, und dass ein zweiter Lauf nichts
// mehr findet.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { ARTEN_UEBER_PERSON } = require('../../utils/postfachAufraeumen');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '188_postfach_altbestand_ohne_kennung.sql'),
  'utf8'
);
const ORG = 1;

describe('Migration 188: Postfach-Altbestand ohne Kennung der Person', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  const eintrag = async (titel, type, data) => {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id, created_at)
       VALUES ($1, $2, 'x', $3, $4, $5, '2026-09-20 10:00')`,
      [USERS.admin1.id, titel, type, data === undefined ? null : JSON.stringify(data), ORG]
    );
  };
  const titel = async () => (await db.query(
    'SELECT title FROM notifications ORDER BY title'
  )).rows.map((r) => r.title);

  it('die Arten in der Migration sind genau ARTEN_UEBER_PERSON', () => {
    const inDerMigration = [...MIGRATION.matchAll(/^\s+'([a-z_]+)',?\s*(--.*)?$/gm)].map((m) => m[1]);
    expect(inDerMigration.sort()).toEqual([...ARTEN_UEBER_PERSON].sort());
  });

  it('ohne Kennung gehen sie -- mit Kennung und andere Arten bleiben', async () => {
    // Altbestand ohne Kennung, wie er vor dem 27.09.2026 geschrieben wurde.
    await eintrag('a-abmeldung-ohne', 'event_unregistration', { eventId: 7, reason: 'krank' });
    await eintrag('a-optout-ohne', 'event_opt_out', { event_id: 7 });
    await eintrag('a-registrierung-ohne', 'new_konfi_registration', null);
    await eintrag('a-beitrag-ohne', 'challenge_submission', { challenge_id: 3 });
    await eintrag('a-teamer-zusage-leer', 'teamer_event_booking', { user_id: '' });
    // Mit Kennung: bleibt und geht spaeter mit dem Konto.
    await eintrag('b-abmeldung-mit', 'event_unregistration', { eventId: 7, konfi_id: USERS.konfi1.id });
    await eintrag('b-beitrag-mit', 'challenge_submission', { challenge_id: 3, user_id: String(USERS.konfi2.id) });
    // Andere Arten ohne Kennung (eigene Mitteilungen, Verlauf): bleiben.
    await eintrag('c-punkte', 'bonus_points', null);
    await eintrag('c-genehmigt', 'activity_approved', { request_id: 9 });

    await db.query(MIGRATION);

    expect(await titel()).toEqual(['b-abmeldung-mit', 'b-beitrag-mit', 'c-genehmigt', 'c-punkte']);
  });

  it('ein zweiter Lauf findet nichts mehr', async () => {
    await eintrag('a-optin-ohne', 'event_opt_in', { event_id: 1 });
    await eintrag('b-antrag-mit', 'new_activity_request', { request_id: 4, konfi_id: USERS.konfi1.id });

    const erster = await db.query(MIGRATION);
    const zweiter = await db.query(MIGRATION);

    expect(erster.rowCount).toBe(1);
    expect(zweiter.rowCount).toBe(0);
    expect(await titel()).toEqual(['b-antrag-mit']);
  });
});
