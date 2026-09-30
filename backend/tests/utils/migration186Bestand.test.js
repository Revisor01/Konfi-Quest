// MIGRATION 186 BRINGT DEN BESTAND AN REFRESH-TOKENS AUF DIE GRENZE -- und
// zwar idempotent.
//
// Die Migration ist beim Testlauf laengst durch (globalSetup spielt sie ein).
// Geprueft wird ihre WIRKUNG auf einem nachgebauten Altbestand: gelesen und
// ausgefuehrt wird die echte Datei aus backend/migrations/.
//
// In Produktion standen am 01.10.2026 1.281 offene Refresh-Tokens auf 133
// Konten, das groesste mit 208. Die Migration soll den Ueberhang beenden,
// die ELTESTEN zuerst -- nie das juengste Token eines Kontos, denn das ist das
// des Geraets, das die App gerade benutzt (es rotiert bei jeder Nutzung).
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { REFRESH_TOKENS_JE_KONTO } = require('../../utils/refreshTokenGrenze');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '186_refresh_tokens_obergrenze.sql'),
  'utf8'
);

describe('Migration 186: Refresh-Tokens auf die Grenze bringen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  // Ein offenes Token, vor `tageAlt` Tagen ausgestellt.
  const token = async (userId, name, tageAlt, { geraet = null, widerrufen = false } = {}) => {
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, device_id, revoked_at)
       VALUES ($1, $2, NOW() + INTERVAL '90 days' - make_interval(days => $3), NOW() - make_interval(days => $3), $4,
               CASE WHEN $5 THEN NOW() - INTERVAL '1 hour' END)`,
      [userId, name, tageAlt, geraet, widerrufen]
    );
  };
  const offen = async (userId) => (await db.query(
    `SELECT token_hash FROM refresh_tokens
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY token_hash`,
    [userId]
  )).rows.map((r) => r.token_hash);
  const migriere = () => db.query(MIGRATION);

  it('die Zehn in der Migration ist die Grenze aus utils/refreshTokenGrenze.js', () => {
    expect(MIGRATION).toMatch(/rang > 10;/);
    expect(REFRESH_TOKENS_JE_KONTO).toBe(10);
  });

  it('Konto mit 25 offenen Tokens: die zehn juengsten bleiben, die 15 aeltesten enden', async () => {
    for (let i = 1; i <= 25; i += 1) {
      await token(USERS.konfi1.id, `k1-${String(i).padStart(2, '0')}`, i); // k1-01 ist das juengste
    }
    await migriere();
    const erwartet = Array.from({ length: 10 }, (_, i) => `k1-${String(i + 1).padStart(2, '0')}`);
    expect(await offen(USERS.konfi1.id)).toEqual(erwartet);

    const { rows: [beendet] } = await db.query(
      `SELECT COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE expires_at <= NOW())::int AS abgelaufen
         FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NOT NULL`,
      [USERS.konfi1.id]
    );
    // Beendet wie beim Abmelden: widerrufen UND abgelaufen (keine Gnadenfrist).
    expect(beendet).toEqual({ n: 15, abgelaufen: 15 });
  });

  it('Konto an oder unter der Grenze: nichts aendert sich', async () => {
    for (let i = 1; i <= 10; i += 1) await token(USERS.konfi1.id, `k1-${String(i).padStart(2, '0')}`, i);
    for (let i = 1; i <= 3; i += 1) await token(USERS.konfi2.id, `k2-${i}`, i * 20);
    const { rowCount } = await db.query(
      `SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > NOW()`
    );
    expect(rowCount).toBe(13);
    await migriere();
    expect(await offen(USERS.konfi1.id)).toHaveLength(10);
    expect(await offen(USERS.konfi2.id)).toEqual(['k2-1', 'k2-2', 'k2-3']);
  });

  it('je Geraet bleibt das juengste; ungebundene Tokens und andere Geraete bleiben', async () => {
    await token(USERS.konfi1.id, 'a-neu', 1, { geraet: 'geraet-a' });
    await token(USERS.konfi1.id, 'a-alt', 5, { geraet: 'geraet-a' });
    await token(USERS.konfi1.id, 'a-uralt', 30, { geraet: 'geraet-a' });
    await token(USERS.konfi1.id, 'b', 40, { geraet: 'geraet-b' });
    await token(USERS.konfi1.id, 'ohne-1', 50);
    await token(USERS.konfi1.id, 'ohne-2', 60);
    // Dasselbe Geraet bei einem ANDEREN Konto (zwei Konten auf einem Telefon).
    await token(USERS.konfi2.id, 'k2-a', 2, { geraet: 'geraet-a' });
    await migriere();
    expect(await offen(USERS.konfi1.id)).toEqual(['a-neu', 'b', 'ohne-1', 'ohne-2']);
    expect(await offen(USERS.konfi2.id)).toEqual(['k2-a']);
  });

  it('bereits widerrufene Tokens bleiben, wie sie sind (Gnadenfrist und Diebstahl-Signal unberuehrt)', async () => {
    for (let i = 1; i <= 11; i += 1) await token(USERS.konfi1.id, `k1-${String(i).padStart(2, '0')}`, i);
    await token(USERS.konfi1.id, 'gerade-rotiert', 0, { widerrufen: true });
    await migriere();
    const { rows: [z] } = await db.query(
      `SELECT expires_at > NOW() AS im_fenster, revoked_at > NOW() - INTERVAL '2 hours' AS widerruf_unveraendert
         FROM refresh_tokens WHERE token_hash = 'gerade-rotiert'`
    );
    expect(z).toEqual({ im_fenster: true, widerruf_unveraendert: true });
    expect(await offen(USERS.konfi1.id)).toHaveLength(10);
  });

  it('ein zweiter Lauf aendert nichts mehr (idempotent)', async () => {
    for (let i = 1; i <= 14; i += 1) await token(USERS.konfi1.id, `k1-${String(i).padStart(2, '0')}`, i);
    await token(USERS.konfi1.id, 'g-neu', 0, { geraet: 'geraet-a' });
    await token(USERS.konfi1.id, 'g-alt', 20, { geraet: 'geraet-a' });
    await migriere();
    const vorher = await offen(USERS.konfi1.id);
    const { rows: [{ n: widerrufenVorher }] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_at IS NOT NULL'
    );
    const zweiter = await db.query(MIGRATION);
    // pg liefert bei mehreren Anweisungen je Anweisung ein Ergebnis.
    expect(zweiter.map((r) => r.rowCount)).toEqual([0, 0]);
    expect(await offen(USERS.konfi1.id)).toEqual(vorher);
    const { rows: [{ n: widerrufenNachher }] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_at IS NOT NULL'
    );
    expect(widerrufenNachher).toBe(widerrufenVorher);
    expect(vorher).toHaveLength(10);
    expect(vorher).toContain('g-neu');
    expect(vorher).not.toContain('g-alt');
  });
});
