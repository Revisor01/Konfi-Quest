// Text-Uploads werden auf ihren Inhalt geprueft (Audit Sicherheit BF-20,
// 29.09.2026).
//
// Chat und Material nahmen text/plain und text/csv allein nach dem
// angegebenen Typ an ("Header vertrauen") -- eine HTML-Seite oder eine
// Programmdatei mit dem Typ text/plain lag danach als Datei der Gemeinde im
// Chat. Jetzt: hoechstens 2 MB, keine Binaerdaten, keine HTML-/Skript-
// Signatur; ausgeliefert wird Text immer als text/plain bzw. text/csv mit
// charset. Windows-1252 (Excel-CSV) bleibt erlaubt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// Rohbytes aus der Antwort, gleich welcher Content-Type.
function roh(res, callback) {
  const teile = [];
  res.on('data', (t) => teile.push(t));
  res.on('end', () => callback(null, Buffer.concat(teile)));
}

describe('Text-Uploads: Inhalt statt Header', () => {
  let app;
  let db;
  let konfi;
  let leitung;

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
    konfi = generateToken('konfi1');
    leitung = generateToken('orgAdmin1');
  });

  const imChat = (inhalt, filename = 'notiz.txt', contentType = 'text/plain') => request(app)
    .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
    .set('Authorization', `Bearer ${konfi}`)
    .attach('file', Buffer.isBuffer(inhalt) ? inhalt : Buffer.from(inhalt, 'utf8'), { filename, contentType });

  const dateiNachrichten = async () => (await db.query(
    'SELECT COUNT(*)::int AS n FROM chat_messages WHERE file_path IS NOT NULL'
  )).rows[0].n;

  describe('Chat', () => {
    it('VERBOTEN: Skript in einer "Textdatei" -> 415, keine Nachricht', async () => {
      const res = await imChat('Hallo\n<script>alert(document.cookie)</script>\n');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Textdateien mit HTML oder Skript werden nicht angenommen.' });
      expect(await dateiNachrichten()).toBe(0);
    });

    it('VERBOTEN: HTML-Seite in anderer Schreibweise -> 415', async () => {
      const res = await imChat('<!DocType HTML><HTML><body>Gewinn!</body></HTML>', 'seite.txt');
      expect(res.status).toBe(415);
      expect(await dateiNachrichten()).toBe(0);
    });

    it('VERBOTEN: Binaerdaten mit Typ text/plain -> 415', async () => {
      const res = await imChat(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]), 'programm.txt');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Die Datei ist keine Textdatei.' });
      expect(await dateiNachrichten()).toBe(0);
    });

    it('VERBOTEN: Textdatei ueber 2 MB -> 413', async () => {
      const res = await imChat('a'.repeat(2 * 1024 * 1024 + 1));
      expect(res.status).toBe(413);
      expect(res.body).toEqual({ error: 'Textdatei ist zu groß (max. 2 MB).' });
      expect(await dateiNachrichten()).toBe(0);
    });

    it('ERLAUBT: gewoehnlicher Text mit Umlauten und "<" -> 200, ausgeliefert als text/plain; charset=utf-8', async () => {
      const inhalt = 'Treffpunkt: Gemeindehaus, Größe < 30 Personen <3\nMitbringen: Schlafsack\n';
      const res = await imChat(inhalt, 'ablauf.txt');
      expect(res.status).toBe(200);

      const datei = await request(app)
        .get(`/api/chat/files/${res.body.file_path}`)
        .set('Authorization', `Bearer ${konfi}`)
        .buffer(true).parse(roh);
      expect(datei.status).toBe(200);
      expect(datei.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(datei.body.toString('utf8')).toBe(inhalt);
    });

    it('ERLAUBT: CSV aus Excel in Windows-1252 -> 200, ausgeliefert als text/csv; charset=utf-8', async () => {
      const latin1 = Buffer.from('Name;Ort\nMüller;Büsum\n', 'latin1');
      const res = await imChat(latin1, 'liste.csv', 'text/csv');
      expect(res.status).toBe(200);

      const datei = await request(app)
        .get(`/api/chat/files/${res.body.file_path}`)
        .set('Authorization', `Bearer ${konfi}`)
        .buffer(true).parse(roh);
      expect(datei.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(datei.body.equals(latin1)).toBe(true);
    });
  });

  describe('Material', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${leitung}`)
        .send({ title: 'Handzettel' });
      expect(res.status).toBe(201);
      materialId = res.body.id;
    });

    const hochladen = (inhalt, filename, contentType = 'text/plain') => request(app)
      .post(`/api/material/${materialId}/files`)
      .set('Authorization', `Bearer ${leitung}`)
      .attach('files', Buffer.from(inhalt, 'utf8'), { filename, contentType });

    const dateien = async () => (await db.query(
      'SELECT COUNT(*)::int AS n FROM material_files WHERE material_id = $1', [materialId]
    )).rows[0].n;

    it('VERBOTEN: HTML als text/plain -> 415, keine Datei', async () => {
      const res = await hochladen('<html><iframe src="https://boese.example"></iframe></html>', 'info.txt');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Textdateien mit HTML oder Skript werden nicht angenommen. (info.txt)' });
      expect(await dateien()).toBe(0);
    });

    it('ERLAUBT: Text -> 201, ausgeliefert als text/plain; charset=utf-8', async () => {
      const res = await hochladen('Ablauf Freizeit\n1. Anreise\n', 'ablauf.txt');
      expect(res.status).toBe(201);
      expect(res.body[0].mime_type).toBe('text/plain');

      const { rows: [f] } = await db.query('SELECT stored_name FROM material_files WHERE id = $1', [res.body[0].id]);
      const datei = await request(app)
        .get(`/api/material/files/${f.stored_name}`)
        .set('Authorization', `Bearer ${leitung}`)
        .buffer(true).parse(roh);
      expect(datei.status).toBe(200);
      expect(datei.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(datei.body.toString('utf8')).toBe('Ablauf Freizeit\n1. Anreise\n');
    });
  });
});
