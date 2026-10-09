#!/usr/bin/env node
/**
 * Testdaten fuer `npm run dunkelmodus:messen` (09.10.2026).
 *
 * Spielt den Test-Seed (backend/tests/helpers/seed.js) in eine FRISCHE
 * Datenbank mit Schema und Migrationen und legt dazu, was die Auflagen der
 * Messung verlangen -- sonst melden sie "Seed?" und enden mit Exit 1:
 *   - Jahrgangs-Zuweisung der Admins wie im E2E-Setup (sonst sieht admin1
 *     keine Konfi und den Knopf "Zur Teamer:in befoerdern" nicht, BF-08);
 *   - in Chatraum 1 Nachrichten mit Reaktionen, eine davon NICHT von konfi1
 *     (Reaktionszaehler an fremder Blase, BF-07);
 *   - einen offenen Antrag von konfi1 und eine laufende Challenge fuer
 *     Jahrgang 1 (Listen und Karten auf den Antrags- und Challenge-Seiten).
 *
 * Laeuft in der CI im Job "dunkelmodus" gegen den E2E-Stack und lokal gegen
 * jede Datenbank, die wie dort aufgesetzt ist
 * (docs/wissen/dunkelmodus-pruefen.md).
 *
 * Aufruf (aus frontend/):
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5444/postgres \
 *     node scripts/dunkelmodus-daten.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// pg aus dem Backend (dort deklariert) -- wie seed.js, das es von dort lädt.
const { Pool } = createRequire(new URL('../../backend/package.json', import.meta.url))('pg');
const { seed, USERS, ACTIVITIES, JAHRGAENGE, ORGS, CHAT_ROOMS } = require('../../backend/tests/helpers/seed.js');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5444/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await seed(pool);
    const org = ORGS.testGemeinde.id;
    const raum = CHAT_ROOMS.jahrgang.id;

    await pool.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id)
       VALUES ($1, $2), ($3, $4) ON CONFLICT DO NOTHING`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id, USERS.admin2.id, JAHRGAENGE.jahrgang2.id]
    );

    const nachricht = async (user, typ, text, minutenZurueck) => (await pool.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
       VALUES ($1, $2, $3, 'text', $4, NOW() - make_interval(mins => $5)) RETURNING id`,
      [raum, user.id, typ, text, minutenZurueck]
    )).rows[0].id;
    const reaktion = (nachrichtId, user, typ, emoji) => pool.query(
      `INSERT INTO chat_message_reactions (message_id, user_id, user_type, emoji) VALUES ($1, $2, $3, $4)`,
      [nachrichtId, user.id, typ, emoji]
    );
    const vomTeam = await nachricht(USERS.teamer1, 'teamer', 'Denkt an Sonntag, wir treffen uns um zehn vor der Kirche.', 30);
    const eigene = await nachricht(USERS.konfi1, 'konfi', 'Bin dabei!', 20);
    const vonKonfi2 = await nachricht(USERS.konfi2, 'konfi', 'Ich bringe Kuchen mit.', 10);
    await reaktion(vomTeam, USERS.konfi1, 'konfi', '👍');
    await reaktion(vomTeam, USERS.konfi2, 'konfi', '👍');
    await reaktion(eigene, USERS.teamer1, 'teamer', '❤️');
    await reaktion(vonKonfi2, USERS.konfi1, 'konfi', '😂');

    await pool.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, comment, status, organization_id)
       VALUES ($1, $2, CURRENT_DATE - 3, 'War beim Jugendgottesdienst.', 'pending', $3)`,
      [USERS.konfi1.id, ACTIVITIES.jugendgottesdienst.id, org]
    );

    const challenge = (await pool.query(
      `INSERT INTO challenges (organization_id, title, description, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Fotochallenge Gemeinde', 'Zeig uns deinen Lieblingsort in der Gemeinde.', 'Entdecker:in', $2,
               NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days', false)
       RETURNING id`,
      [org, USERS.admin1.id]
    )).rows[0].id;
    await pool.query(
      `INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)`,
      [challenge, JAHRGAENGE.jahrgang1.id]
    );

    console.log(`Testdaten fuer die Dunkelmodus-Messung eingespielt (Raum ${raum}: 3 Nachrichten, 4 Reaktionen; 1 Antrag; Challenge ${challenge}).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
