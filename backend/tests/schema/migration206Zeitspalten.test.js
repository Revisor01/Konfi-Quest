// MIGRATION 206: Die letzten 24 Zeitspalten ohne Zeitzone werden timestamptz
// (09.10.2026, Datenbank BF-11, Rest).
//
// Der Bestand ist UTC -- bis auf das, was in Produktion nachweislich in
// Berliner Zeit geschrieben wurde: alles mit NOW() vom 21. bis 23.08.2026
// (alle Sitzungen der Backends liefen da in Berliner Zeit) und einige von
// Hand per psql geschriebene Zeilen.
//
// Seit 10.10.2026 steht 206 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Umrechnung des Bestands, Antwort an die Apps Zeichen fuer
// Zeichen gleich, zweiter Lauf) liegt in der Git-Historie (zuletzt Commit
// 3b935178). Geprueft wird hier das gemeinsame Test-Schema (Deploy-Weg):
// keine Zeitspalte ohne Zone, die Vorgaben und die View.
const { getTestPool, closePool } = require('../helpers/db');

const OHNE_ZONE = `
  SELECT table_name || '.' || column_name AS spalte FROM information_schema.columns
   WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
   ORDER BY 1`;

describe('Migration 206 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('keine Zeitspalte ohne Zone', async () => {
    expect((await db.query(OHNE_ZONE)).rows).toEqual([]);
  });

  it('Vorgaben bleiben; die Datumsvorgaben rechnen im Berliner Tag', async () => {
    const { rows } = await db.query(`
      SELECT table_name || '.' || column_name AS spalte, column_default AS vorgabe
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (('notifications', 'created_at'), ('refresh_tokens', 'created_at'),
                                           ('event_reminders', 'sent_at'), ('refresh_tokens', 'expires_at'),
                                           ('bonus_points', 'completed_date'), ('user_activities', 'completed_date'))
       ORDER BY 1`);
    expect(rows).toEqual([
      { spalte: 'bonus_points.completed_date', vorgabe: "((now() AT TIME ZONE 'Europe/Berlin'::text))::date" },
      { spalte: 'event_reminders.sent_at', vorgabe: 'now()' },
      { spalte: 'notifications.created_at', vorgabe: 'CURRENT_TIMESTAMP' },
      { spalte: 'refresh_tokens.created_at', vorgabe: 'now()' },
      { spalte: 'refresh_tokens.expires_at', vorgabe: null },
      { spalte: 'user_activities.completed_date', vorgabe: "((now() AT TIME ZONE 'Europe/Berlin'::text))::date" },
    ]);
  });

  it('die View event_booking_stats steht (206 hatte sie fuer die Typaenderung neu angelegt)', async () => {
    const { rows } = await db.query(
      "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_booking_stats'");
    expect(rows).toEqual([{ table_name: 'event_booking_stats' }]);
  });
});
