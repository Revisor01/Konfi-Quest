// MIGRATION 214: Eine verbuchte Aktivitaet kennt ihren Antrag (13.10.2026).
//
// Geprueft auf dem Stand, auf den 214 beim Deploy trifft: genehmigte Antraege
// und ihre Zeilen in user_activities OHNE Verknuepfung. Zugeordnet wird nur,
// was eindeutig ist -- GENAU EIN genehmigter Antrag zu Person, Aktivitaet und
// Datum und genau eine Zeile dazu. Alles andere bleibt ohne Antrag: lieber
// kein Link als ein falscher. Ein zweiter Lauf aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '214_aktivitaet_kennt_antrag.sql';
const DB = 'konfi_test_mig214';

describe('Migration 214 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  const ids = {};

  const eins = async (sql, werte) => (await pool.query(sql, werte)).rows[0].id;
  const antrag = (status, tag) => eins(
    `INSERT INTO activity_requests (user_id, activity_id, status, requested_date, organization_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ids.konfi, ids.aktivitaet, status, tag, ids.org]
  );
  const zeile = (tag, aktivitaet = ids.aktivitaet) => eins(
    `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id, points, type)
     VALUES ($1, $2, $3, $4, $5, 1, 'gottesdienst') RETURNING id`,
    [ids.konfi, aktivitaet, ids.leitung, tag, ids.org]
  );
  const antragVon = async (uaId) => {
    const { rows: [r] } = await pool.query('SELECT request_id FROM user_activities WHERE id = $1', [uaId]);
    return r.request_id === null ? null : Number(r.request_id);
  };

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });

    ids.org = await eins(`INSERT INTO organizations (name, slug, display_name) VALUES ('M214', 'm214', 'M214') RETURNING id`);
    ids.rolle = await eins(`INSERT INTO roles (organization_id, name) VALUES ($1, 'konfi') RETURNING id`, [ids.org]);
    ids.konfi = await eins(
      `INSERT INTO users (organization_id, username, display_name, role_id) VALUES ($1, 'k214', 'Konfi 214', $2) RETURNING id`,
      [ids.org, ids.rolle]
    );
    ids.leitung = await eins(
      `INSERT INTO users (organization_id, username, display_name, role_id) VALUES ($1, 'l214', 'Leitung 214', $2) RETURNING id`,
      [ids.org, ids.rolle]
    );
    ids.aktivitaet = await eins(
      `INSERT INTO activities (name, points, type, organization_id) VALUES ('Gottesdienst', 1, 'gottesdienst', $1) RETURNING id`,
      [ids.org]
    );
    ids.andereAktivitaet = await eins(
      `INSERT INTO activities (name, points, type, organization_id) VALUES ('Kirchencafé', 1, 'gemeinde', $1) RETURNING id`,
      [ids.org]
    );

    // a) eindeutig: ein genehmigter Antrag, eine Zeile -> zuordnen
    ids.aAntrag = await antrag('approved', '2026-09-06');
    ids.aZeile = await zeile('2026-09-06');
    // b) zwei genehmigte Antraege am selben Tag, zwei Zeilen -> nichts
    ids.bAntrag1 = await antrag('approved', '2026-09-13');
    ids.bAntrag2 = await antrag('approved', '2026-09-13');
    ids.bZeile1 = await zeile('2026-09-13');
    ids.bZeile2 = await zeile('2026-09-13');
    // c) ein genehmigter Antrag, aber am selben Tag noch eine Eintragung der Leitung -> nichts
    ids.cAntrag = await antrag('approved', '2026-09-20');
    ids.cZeile1 = await zeile('2026-09-20');
    ids.cZeile2 = await zeile('2026-09-20');
    // d) abgelehnter Antrag, Zeile der Leitung am selben Tag -> nichts
    ids.dAntrag = await antrag('rejected', '2026-09-27');
    ids.dZeile = await zeile('2026-09-27');
    // e) genehmigter Antrag, Zeile an einem anderen Tag -> nichts
    ids.eAntrag = await antrag('approved', '2026-10-04');
    ids.eZeile = await zeile('2026-10-05');
    // f) Zeile einer anderen Aktivitaet am Tag eines genehmigten Antrags -> nichts
    ids.fAntrag = await antrag('approved', '2026-10-11');
    ids.fZeile = await zeile('2026-10-11', ids.andereAktivitaet);
    // g) zwei genehmigte Antraege am selben Tag, nur eine Zeile -> nichts (welcher waere es?)
    ids.gAntrag1 = await antrag('approved', '2026-10-18');
    ids.gAntrag2 = await antrag('approved', '2026-10-18');
    ids.gZeile = await zeile('2026-10-18');
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('vorher gibt es die Spalte nicht', async () => {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'user_activities' AND column_name = 'request_id'`);
    expect(rows).toHaveLength(0);
  });

  it('danach: nur der eindeutige Fall ist zugeordnet', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await antragVon(ids.aZeile)).toBe(ids.aAntrag);
    for (const name of ['bZeile1', 'bZeile2', 'cZeile1', 'cZeile2', 'dZeile', 'eZeile', 'fZeile', 'gZeile']) {
      expect([name, await antragVon(ids[name])]).toEqual([name, null]);
    }
  });

  it('Spalte als bigint mit Fremdschluessel ON DELETE SET NULL und Index', async () => {
    const { rows: [spalte] } = await pool.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'user_activities' AND column_name = 'request_id'`);
    expect(spalte).toEqual({ data_type: 'bigint', is_nullable: 'YES' });
    const { rows: [fk] } = await pool.query(
      `SELECT confdeltype, confrelid::regclass::text AS ziel FROM pg_constraint
        WHERE conrelid = 'user_activities'::regclass AND contype = 'f'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'user_activities'::regclass AND attname = 'request_id')]`);
    expect(fk).toEqual({ confdeltype: 'n', ziel: 'activity_requests' });
    const { rows: index } = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'user_activities' AND indexname = 'idx_user_activities_request_id'`);
    expect(index).toHaveLength(1);
  });

  it('ein zweiter Lauf geht durch und aendert nichts', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await antragVon(ids.aZeile)).toBe(ids.aAntrag);
    expect(await antragVon(ids.bZeile1)).toBeNull();
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM user_activities WHERE request_id IS NOT NULL');
    expect(n).toBe(1);
  });

  it('der Antrag wird geloescht: die Zeile bleibt, ohne Antrag', async () => {
    await pool.query('DELETE FROM activity_requests WHERE id = $1', [ids.aAntrag]);
    expect(await antragVon(ids.aZeile)).toBeNull();
  });
});

describe('Migration 214 im gemeinsamen Test-Schema', () => {
  afterAll(async () => { await closePool(); });

  it('user_activities hat die Spalte request_id', async () => {
    const { rows } = await getTestPool().query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'user_activities' AND column_name = 'request_id'`);
    expect(rows).toHaveLength(1);
  });
});
