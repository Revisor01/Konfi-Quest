// MIGRATION 165 LEERT konfi_profiles.password_plain -- und laesst alles
// andere stehen (Audit 26.09.2026, Sicherheit BF-06 / Datenbank BF-06 / S-01).
//
// Die Spalte stammt aus der SQLite-Zeit. Heute liest sie keine Code-Stelle
// mehr; geschrieben wird nur NULL, und das nur, wenn die Leitung ein neues
// Einmalpasswort erzeugt (konfi-management.js). Jede Zeile, deren Passwort
// seither nie neu gesetzt wurde, traegt damit moeglicherweise noch das
// Klartext-Passwort eines Kindes -- und mit jedem Dump wandert es in jede
// Sicherung.
//
// Die Migration ist beim Testlauf laengst durch (globalSetup spielt sie
// ein). Geprueft wird deshalb ihre WIRKUNG: Der Vorher-Zustand wird
// kuenstlich hergestellt und die echte Datei aus backend/migrations/
// erneut ausgefuehrt -- wie bei Migration 153 (tests/utils).
//
// Seit Migration 176 (29.09.2026) laesst die Spalte nur noch NULL zu; einen
// Klartext kann der Test im gemeinsamen Test-Schema also nicht mehr
// hinschreiben. Er baut sich deshalb eine eigene Datenbank auf dem Stand
// VOR 176 -- dem Stand, auf den 165 beim Deploy traf.
const { truncateAll } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = migrationLesen('165_password_plain_leeren.sql');
const DB = 'konfi_test_mig165';

describe('Migration 165: Klartext-Passwoerter leeren', () => {
  let db;

  beforeAll(async () => {
    db = await dbAnlegen(DB);
    await produktionAufbauen(db, { vor: '176_kein_klartext_passwort.sql' });
  }, 180000);
  afterAll(async () => { await dbWegraeumen(db, DB); }, 120000);

  beforeEach(async () => {
    // truncateAll erwartet die Schnittstelle von database.js (getClient).
    await truncateAll({ query: (t, p) => db.query(t, p), getClient: () => db.connect() });
    await seed(db);
  });

  const profil = async (userId) => {
    const { rows: [row] } = await db.query(
      `SELECT password_plain, gottesdienst_points, gemeinde_points, jahrgang_id
         FROM konfi_profiles WHERE user_id = $1`,
      [userId]
    );
    return row;
  };

  it('setzt einen vorhandenen Klartext auf NULL', async () => {
    await db.query(
      'UPDATE konfi_profiles SET password_plain = $1 WHERE user_id = $2',
      ['Jesaja41,10', USERS.konfi1.id]
    );
    expect((await profil(USERS.konfi1.id)).password_plain).toBe('Jesaja41,10');

    await db.query(MIGRATION);

    expect((await profil(USERS.konfi1.id)).password_plain).toBeNull();
  });

  it('leert ALLE betroffenen Zeilen, auch ueber Gemeinden hinweg', async () => {
    await db.query(
      'UPDATE konfi_profiles SET password_plain = $1 WHERE user_id IN ($2, $3, $4)',
      ['Matthäus5,9', USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id]
    );

    await db.query(MIGRATION);

    const { rows: [{ anzahl }] } = await db.query(
      'SELECT COUNT(*)::int AS anzahl FROM konfi_profiles WHERE password_plain IS NOT NULL'
    );
    expect(anzahl).toBe(0);
  });

  it('laesst die uebrigen Felder und die Zeilen selbst unangetastet', async () => {
    await db.query(
      `UPDATE konfi_profiles SET password_plain = 'Rut4,17', gottesdienst_points = 7,
              gemeinde_points = 3 WHERE user_id = $1`,
      [USERS.konfi1.id]
    );
    const { rows: [{ vorher }] } = await db.query('SELECT COUNT(*)::int AS vorher FROM konfi_profiles');

    await db.query(MIGRATION);

    const nachher = await profil(USERS.konfi1.id);
    expect(nachher.password_plain).toBeNull();
    expect(nachher.gottesdienst_points).toBe(7);
    expect(nachher.gemeinde_points).toBe(3);
    expect(nachher.jahrgang_id).toBe(1);
    const { rows: [{ danach }] } = await db.query('SELECT COUNT(*)::int AS danach FROM konfi_profiles');
    expect(danach).toBe(vorher);
  });

  it('ist idempotent: ein zweiter Lauf aendert keine Zeile mehr', async () => {
    await db.query(
      'UPDATE konfi_profiles SET password_plain = $1 WHERE user_id = $2',
      ['Genesis1,1', USERS.konfi1.id]
    );
    await db.query(MIGRATION);

    // Der Datenschritt einzeln, um den rowCount zu sehen.
    const { rowCount } = await db.query(
      'UPDATE konfi_profiles SET password_plain = NULL WHERE password_plain IS NOT NULL'
    );
    expect(rowCount).toBe(0);
  });

  it('die Spalte bleibt bestehen (additiv; DROP COLUMN folgt spaeter)', async () => {
    await db.query(MIGRATION);
    const { rows } = await db.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'konfi_profiles'
          AND column_name = 'password_plain'`
    );
    expect(rows).toHaveLength(1);
  });
});
