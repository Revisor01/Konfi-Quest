// backend/tests/utils/konfiLimit.test.js
// Tests fuer die gemeinsame Limit-Pruef-Funktion checkKonfiLimit (Single Source of Truth).
// Per D-05/D-06/D-07: 4-Stufen-Logik (NULL/under_limit/grace/hard_block),
// COUNT nur Rolle 'konfi' der Org mit deleted_at IS NULL, org-isoliert.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { checkKonfiLimit } = require('../../utils/konfiLimit');

const ORG_ID = ORGS.testGemeinde.id;   // 1
const ANDERE_ORG_ID = ORGS.andereGemeinde.id; // 2

describe('checkKonfiLimit', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Seed legt 2 aktive Konfis in Org 1 an (konfi1, konfi2) und 1 in Org 2 (konfi3).
  });

  afterAll(async () => {
    await closePool();
  });

  // Hilfsfunktion: setzt max_konfis fuer eine Org.
  async function setLimit(orgId, value) {
    await db.query('UPDATE organizations SET max_konfis = $1 WHERE id = $2', [value, orgId]);
  }

  // Hilfsfunktion: legt n zusaetzliche aktive Konfis in Org 1 an.
  async function addKonfis(orgId, count, roleId) {
    for (let i = 0; i < count; i++) {
      await db.query(
        `INSERT INTO users (username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, 'x', $2, $3, $4, true)`,
        [`extra_konfi_${orgId}_${i}_${Date.now()}_${Math.random()}`, `Extra Konfi ${i}`, roleId, orgId]
      );
    }
  }

  it('Test 1: max_konfis IS NULL -> stufe under_limit, limit null', async () => {
    // Seed setzt max_konfis nicht -> NULL.
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.stufe).toBe('under_limit');
    expect(result.limit).toBeNull();
    expect(result.count).toBe(2); // konfi1 + konfi2
  });

  it('Test 2: count < max_konfis -> stufe under_limit', async () => {
    await setLimit(ORG_ID, 10); // 2 Konfis, Limit 10
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.stufe).toBe('under_limit');
    expect(result.limit).toBe(10);
    expect(result.count).toBe(2);
  });

  it('Test 3: max_konfis <= count < max_konfis+5 -> stufe grace', async () => {
    // Limit auf 2 setzen -> count (2) == limit (2) -> grace.
    await setLimit(ORG_ID, 2);
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.stufe).toBe('grace');
    expect(result.limit).toBe(2);
    expect(result.count).toBe(2);
  });

  it('Test 4: count am oberen Grace-Rand (max_konfis+4) -> noch grace', async () => {
    // Limit 2, 4 weitere Konfis -> count 6 = limit+4 (< limit+5) -> grace.
    await addKonfis(ORG_ID, 4, ROLES.konfi.id);
    await setLimit(ORG_ID, 2);
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.count).toBe(6);
    expect(result.stufe).toBe('grace');
  });

  it('Test 5: count >= max_konfis+5 -> stufe hard_block', async () => {
    // Limit 2, 5 weitere Konfis -> count 7 = limit+5 -> hard_block.
    await addKonfis(ORG_ID, 5, ROLES.konfi.id);
    await setLimit(ORG_ID, 2);
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.count).toBe(7);
    expect(result.stufe).toBe('hard_block');
    expect(result.limit).toBe(2);
  });

  it('Test 6: soft-geloeschter Konfi (deleted_at gesetzt) zaehlt NICHT', async () => {
    // konfi2 soft-loeschen -> count sinkt von 2 auf 1.
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);
    await setLimit(ORG_ID, 2);
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.count).toBe(1); // nur konfi1 aktiv
    expect(result.stufe).toBe('under_limit'); // 1 < 2
  });

  it('Test 7: Org-Isolation — Konfi anderer Org beeinflusst count nicht', async () => {
    // Viele Konfis in Org 2 anlegen, Org 1 bleibt bei 2.
    await addKonfis(ANDERE_ORG_ID, 10, ROLES.konfi2.id);
    await setLimit(ORG_ID, 5);
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.count).toBe(2); // nur Org-1-Konfis
    expect(result.stufe).toBe('under_limit');
  });

  it('Test 8: Teamer/Admin der Org zaehlen NICHT als Konfi', async () => {
    // Seed hat teamer1, admin1, orgAdmin1 in Org 1 — duerfen den Count nicht erhoehen.
    await setLimit(ORG_ID, 2);
    const result = await checkKonfiLimit(db, ORG_ID);
    expect(result.count).toBe(2); // weiterhin nur 2 Konfis
  });
});
