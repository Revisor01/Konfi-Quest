// MIGRATION 189: Dateinamen, die multer als Latin-1 gelesen hat, werden
// wieder zu den Namen, die die Person gewaehlt hat (01.10.2026).
//
// Simons Geraetetest: „Gebetswürfel Vorlage.pdf" stand im Chat als
// „GebetswÃ¼rfel Vorlage.pdf". Neue Uploads liest createApp.js als UTF-8
// (tests/routes/dateinameUmlaute.test.js); diese Migration repariert den
// Bestand in Chat, Material und Challenges.
//
// Geprueft wird die WIRKUNG der echten Datei aus backend/migrations/: was
// repariert wird, was bleibt (richtige Umlaute, Zeichen ausserhalb von
// Latin-1, reines ASCII) und dass ein zweiter Lauf nichts mehr aendert.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, CHAT_ROOMS } = require('../helpers/seed');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '189_dateinamen_utf8_reparieren.sql'),
  'utf8'
);

// Wie multer den Namen bisher las: die UTF-8-Bytes als Latin-1.
const alsLatin1Gelesen = (name) => Buffer.from(name, 'utf8').toString('latin1');

const FAELLE = [
  // [gespeichert, erwartet nach der Migration]
  [alsLatin1Gelesen('Gebetswürfel Vorlage.pdf'), 'Gebetswürfel Vorlage.pdf'],
  [alsLatin1Gelesen('Großbüllesheim – Ölbild.png'), 'Großbüllesheim – Ölbild.png'],
  [alsLatin1Gelesen('Kosten 5 €.docx'), 'Kosten 5 €.docx'],
  [alsLatin1Gelesen('„Andacht" 🙏.pdf'), '„Andacht" 🙏.pdf'],
  // Richtig gespeichert (etwa vom Browser nach dem Fix): bleibt.
  ['Gebetswürfel Vorlage.pdf', 'Gebetswürfel Vorlage.pdf'],
  ['Kosten 5 €.docx', 'Kosten 5 €.docx'],
  ['Ärger über Öl.txt', 'Ärger über Öl.txt'],
  // Reines ASCII: bleibt.
  ['Plan_2026-10.pdf', 'Plan_2026-10.pdf'],
];

describe('Migration 189: Dateinamen mit Umlauten reparieren', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  it('die Test-Datenbank rechnet in UTF8 wie Produktion und CI', async () => {
    // In einer Datenbank mit SQL_ASCII ist convert_to wirkungslos, die
    // Migration aendert dort nichts -- dann waeren die Tests unten sinnlos.
    // postgres:15-alpine (CI, Produktion) legt UTF8 an.
    const { rows } = await db.query('SHOW server_encoding');
    expect(rows[0].server_encoding).toBe('UTF8');
  });

  it('die Fixtures bilden den Fehler wirklich ab', () => {
    expect(alsLatin1Gelesen('Gebetswürfel Vorlage.pdf')).toBe('GebetswÃ¼rfel Vorlage.pdf');
  });

  it('Chat: falsch gelesene Namen werden repariert, alles andere bleibt', async () => {
    for (const [gespeichert] of FAELLE) {
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name)
         VALUES ($1, $2, 'konfi', 'file', '', 'x', $3)`,
        [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id, gespeichert]
      );
    }

    await db.query(MIGRATION);

    const { rows } = await db.query('SELECT file_name FROM chat_messages ORDER BY id');
    expect(rows.map((r) => r.file_name)).toEqual(FAELLE.map(([, erwartet]) => erwartet));
  });

  it('Material und Challenge-Beiträge: ebenso', async () => {
    const { rows: [material] } = await db.query(
      "INSERT INTO materials (title, organization_id) VALUES ('Freizeit', $1) RETURNING id",
      [ORGS.testGemeinde.id]
    );
    const { rows: [challenge] } = await db.query(
      `INSERT INTO challenges
         (organization_id, title, description, challenge_type, audience, visibility, moderated,
          allowed_media, allow_multiple, badge_icon, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Fotos', 'x', 'frei', 'konfis', 'public', false, '["photo"]'::jsonb, true, 'flag', 'B', $2,
               NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false)
       RETURNING id`,
      [ORGS.testGemeinde.id, USERS.admin1.id]
    );
    for (const [gespeichert] of FAELLE) {
      await db.query(
        `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
         VALUES ($1, $2, md5(random()::text), 'application/pdf', 1)`,
        [material.id, gespeichert]
      );
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path, file_name)
         VALUES ($1, $2, $3, 'photo', 'x', $4)`,
        [challenge.id, USERS.konfi1.id, ORGS.testGemeinde.id, gespeichert]
      );
    }

    await db.query(MIGRATION);

    const erwartet = FAELLE.map(([, e]) => e);
    const material_ = await db.query('SELECT original_name FROM material_files ORDER BY id');
    const beitraege = await db.query('SELECT file_name FROM challenge_submissions ORDER BY id');
    expect(material_.rows.map((r) => r.original_name)).toEqual(erwartet);
    expect(beitraege.rows.map((r) => r.file_name)).toEqual(erwartet);
  });

  it('ein zweiter Lauf ändert nichts mehr -- auch nicht an reparierten Namen', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name)
       VALUES ($1, $2, 'konfi', 'file', '', 'x', $3)`,
      [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id, alsLatin1Gelesen('Gebetswürfel Vorlage.pdf')]
    );

    await db.query(MIGRATION);
    await db.query(MIGRATION);

    const { rows } = await db.query('SELECT file_name FROM chat_messages');
    expect(rows.map((r) => r.file_name)).toEqual(['Gebetswürfel Vorlage.pdf']);
  });

  it('Nachrichten ohne Datei bleiben unberührt', async () => {
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
       VALUES ($1, $2, 'konfi', 'text', $3)`,
      [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id, alsLatin1Gelesen('Grüße')]
    );

    await db.query(MIGRATION);

    const { rows } = await db.query('SELECT content, file_name FROM chat_messages');
    expect(rows).toEqual([{ content: alsLatin1Gelesen('Grüße'), file_name: null }]);
  });
});
