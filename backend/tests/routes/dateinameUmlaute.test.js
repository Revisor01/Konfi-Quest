// Dateinamen mit Umlauten kommen so an, wie sie heissen (01.10.2026).
//
// Simons Geraetetest: Eine PDF namens „Gebetswürfel Vorlage.pdf" stand im Chat
// als „GebetswÃ¼rfel Vorlage.pdf". Browser und Apps schicken den Dateinamen im
// Multipart-Kopf als UTF-8; multer las ihn ohne Angabe als Latin-1
// (defParamCharset 'latin1' ist dort die Vorgabe). Aus den zwei Bytes von „ü"
// wurden zwei Zeichen, und so landete der Name in der Datenbank.
//
// supertest schickt den Namen wie ein Browser: roh in UTF-8, ohne filename*.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, CHAT_ROOMS, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const NAME_PDF = 'Gebetswürfel Vorlage.pdf';
const NAME_BILD = 'Konfirmanden-Freizeit Großbüllesheim – Ölbild.png';

describe('Dateinamen mit Umlauten', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  it('Chat: der Name steht mit Umlaut in Antwort und Datenbank', async () => {
    const res = await request(app)
      .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .attach('file', PDF, { filename: NAME_PDF, contentType: 'application/pdf' });

    // Der Chat antwortet auf eine neue Nachricht mit 200 (wie in chat.test.js).
    expect(res.status).toBe(200);
    expect(res.body.file_name).toBe(NAME_PDF);
    const { rows } = await db.query('SELECT file_name FROM chat_messages WHERE id = $1', [res.body.id]);
    expect(rows[0].file_name).toBe(NAME_PDF);
  });

  it('Material: der Name steht mit Umlaut, auch mit ß, Gedankenstrich und großem Ö', async () => {
    const leitung = generateToken('orgAdmin1');
    const angelegt = await request(app)
      .post('/api/material')
      .set('Authorization', `Bearer ${leitung}`)
      .send({ title: 'Freizeit' });
    expect(angelegt.status).toBe(201);

    const res = await request(app)
      .post(`/api/material/${angelegt.body.id}/files`)
      .set('Authorization', `Bearer ${leitung}`)
      .attach('files', PDF, { filename: NAME_PDF, contentType: 'application/pdf' })
      .attach('files', PNG, { filename: NAME_BILD, contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.map((d) => d.original_name).sort()).toEqual([NAME_PDF, NAME_BILD].sort());
    const { rows } = await db.query(
      'SELECT original_name FROM material_files WHERE material_id = $1 ORDER BY original_name',
      [angelegt.body.id]
    );
    expect(rows.map((r) => r.original_name)).toEqual([NAME_PDF, NAME_BILD].sort());
  });

  it('Challenge-Beitrag: der Name steht mit Umlaut', async () => {
    const { rows: [challenge] } = await db.query(
      `INSERT INTO challenges
         (organization_id, title, description, challenge_type, audience, visibility, moderated,
          allowed_media, allow_multiple, badge_icon, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Fotos', 'x', 'frei', 'konfis', 'public', false, '["photo"]'::jsonb, true, 'flag', 'B', $2,
               NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false)
       RETURNING id`,
      [ORGS.testGemeinde.id, USERS.admin1.id]
    );
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [challenge.id, JAHRGAENGE.jahrgang1.id]
    );

    const res = await request(app)
      .post(`/api/challenges/konfi/${challenge.id}/submissions`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .field('media_type', 'photo')
      .attach('file', PNG, { filename: NAME_BILD, contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.file_name).toBe(NAME_BILD);
  });

  it('ein Name ohne Umlaut bleibt, wie er ist', async () => {
    const res = await request(app)
      .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .attach('file', PDF, { filename: 'Plan_2026-10.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.file_name).toBe('Plan_2026-10.pdf');
  });
});
