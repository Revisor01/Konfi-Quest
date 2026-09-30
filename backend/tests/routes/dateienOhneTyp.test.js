// Dateien ohne (brauchbaren) Typ vom Geraet (Simons Befund 29.09.2026,
// Android-Testbuild 128): „Word hab ich mir versucht vom Android eine
// rauszuschicken — eine .docx Datei ging nicht :( … docx konnte ich nicht
// hochladen, schlägt einfach fehl das senden."
//
// Der Upload-Filter liess nur Dateien durch, deren vom Geraet gemeldeter Typ
// auf einer Liste stand, und verwarf andere STILL (cb(null, false)). Meldet
// das Geraet fuer eine Datei keinen Typ, schickt das WebView sie als
// application/octet-stream -- die Route sah dann gar keine Datei und
// antwortete 400 „Inhalt oder Datei erforderlich"; mit Text dabei ging die
// Nachricht OHNE die Datei raus.
//
// Jetzt: Bei einer allgemeinen Angabe entscheidet die Endung, und die
// Pruefung der Kopfbytes (file-type) entscheidet, ob der Inhalt dazu passt.
// Was der Filter verwirft, bekommt 415 mit einem Satz, den man versteht.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, CHAT_ROOMS, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { wordDatei, tonDatei, programmDatei, multipartOhneTyp, DOCX_TYP } = require('../helpers/bueroDatei');
const { leseKopfBytes } = require('../../utils/photoCrypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Rohbytes aus der Antwort, gleich welcher Content-Type.
function roh(res, callback) {
  const teile = [];
  res.on('data', (t) => teile.push(t));
  res.on('end', () => callback(null, Buffer.concat(teile)));
}

describe('Dateien ohne Typ vom Geraet: die Endung entscheidet, die Kopfbytes pruefen', () => {
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

  const nachrichten = async () => (await db.query('SELECT COUNT(*)::int AS n FROM chat_messages')).rows[0].n;
  const chatUrl = `/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`;

  const imChat = (inhalt, filename, contentType, text) => {
    const anfrage = request(app).post(chatUrl).set('Authorization', `Bearer ${konfi}`);
    if (text) anfrage.field('content', text);
    return anfrage.attach('file', inhalt, { filename, contentType });
  };

  describe('file-type erkennt eine Word-Datei an ihren ersten 4.100 Bytes', () => {
    // Die Route prueft nur die Kopfbytes (leseKopfBytes). Belegt, was file-type
    // dort je nach Bauweise sieht: docx -- oder application/zip, wenn in den
    // 4.100 Bytes nichts die Word-Datei verraet. Beides steht auf der Liste der
    // Route.
    //
    // Liegt [Content_Types].xml hinter den Kopfbytes, schliesst file-type seit
    // 22.1.1 aus den Verzeichnisnamen: Ein Eintrag unter word/ im Kopf reicht
    // fuer docx (Bauweise libreoffice; mit 22.0.2 kam dort application/zip).
    // Steht vorn nur ein grosses Vorschaubild ausserhalb von word/, bleibt es
    // bei application/zip (Bauweise vorschau) -- dieser Fall haelt den
    // ZIP-Weg der Route unter Test.
    it.each([
      ['word', DOCX_TYP],
      ['libreoffice', DOCX_TYP],
      ['vorschau', 'application/zip'],
    ])('Bauweise %s -> %s', async (bauweise, erwartet) => {
      const pfad = path.join(os.tmpdir(), `kopfbytes-${crypto.randomBytes(6).toString('hex')}.docx`);
      fs.writeFileSync(pfad, wordDatei(bauweise));
      try {
        const kopf = await leseKopfBytes(pfad);
        expect(kopf.length).toBe(4100 < fs.statSync(pfad).size ? 4100 : fs.statSync(pfad).size);
        const { fileTypeFromBuffer } = await import('file-type');
        expect((await fileTypeFromBuffer(kopf)).mime).toBe(erwartet);
      } finally {
        fs.unlinkSync(pfad);
      }
    });
  });

  describe('Chat', () => {
    it('ERLAUBT: Word-Datei als application/octet-stream -> 200, als Datei-Nachricht mit dem Typ der Endung ausgeliefert', async () => {
      const docx = wordDatei('word');
      const res = await imChat(docx, 'Einladung.docx', 'application/octet-stream');

      expect(res.status).toBe(200);
      expect(res.body.file_name).toBe('Einladung.docx');
      expect(res.body.message_type).toBe('file');
      expect(await nachrichten()).toBe(1);

      const datei = await request(app)
        .get(`/api/chat/files/${res.body.file_path}`)
        .set('Authorization', `Bearer ${konfi}`)
        .buffer(true).parse(roh);
      expect(datei.status).toBe(200);
      expect(datei.headers['content-type']).toBe(DOCX_TYP);
      expect(datei.body.equals(docx)).toBe(true);
    });

    it('ERLAUBT: Word-Datei ganz ohne Typ-Zeile -> 200', async () => {
      const { koerper, typ } = multipartOhneTyp('file', 'Einladung.docx', wordDatei('word'));
      const res = await request(app).post(chatUrl)
        .set('Authorization', `Bearer ${konfi}`)
        .set('Content-Type', typ)
        .send(koerper);

      expect(res.status).toBe(200);
      expect(res.body.file_name).toBe('Einladung.docx');
    });

    it.each(['libreoffice', 'vorschau'])('ERLAUBT: Word-Datei in Bauweise %s ([Content_Types].xml hinter dem Kopf) -> 200', async (bauweise) => {
      const res = await imChat(wordDatei(bauweise), 'Plan.docx', 'application/octet-stream');
      expect(res.status).toBe(200);
    });

    it('ERLAUBT wie bisher: Word-Datei mit ihrem richtigen Typ -> 200', async () => {
      const res = await imChat(wordDatei('word'), 'Einladung.docx', DOCX_TYP);
      expect(res.status).toBe(200);
    });

    it('ERLAUBT wie bisher: die Warteschlange alter Apps schickt Dateien ohne Typ als image/jpeg -> 200', async () => {
      // Store-Apps bis 2.3.0 setzen in der Warteschlange bei fehlendem Typ
      // image/jpeg (writeQueue.resolveLocalFile). Das muss weiter durchgehen.
      const res = await imChat(wordDatei('word'), 'Einladung.docx', 'image/jpeg');
      expect(res.status).toBe(200);
      expect(res.body.message_type).toBe('file');
    });

    it('ERLAUBT: Textdatei als application/octet-stream -> 200, geprueft als Text und so ausgeliefert', async () => {
      const res = await imChat(Buffer.from('Treffpunkt: Kirche\n', 'utf8'), 'ablauf.txt', 'application/octet-stream');
      expect(res.status).toBe(200);

      const datei = await request(app)
        .get(`/api/chat/files/${res.body.file_path}`)
        .set('Authorization', `Bearer ${konfi}`)
        .buffer(true).parse(roh);
      expect(datei.headers['content-type']).toBe('text/plain; charset=utf-8');
    });

    it('VERBOTEN: HTML als .txt ohne Typ geht trotzdem durch die Textpruefung -> 415', async () => {
      const res = await imChat(Buffer.from('<script>alert(1)</script>'), 'notiz.txt', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Textdateien mit HTML oder Skript werden nicht angenommen.' });
      expect(await nachrichten()).toBe(0);
    });

    it('VERBOTEN: ein umbenanntes Programm (.docx, ohne Typ) -> 415 an den Kopfbytes', async () => {
      const res = await imChat(programmDatei(), 'Einladung.docx', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dateityp konnte nicht verifiziert werden' });
      expect(await nachrichten()).toBe(0);
    });

    it('VERBOTEN: ein Programm, das sich als solches meldet, aber .docx heisst -> 415 an den Kopfbytes', async () => {
      const res = await imChat(programmDatei(), 'Einladung.docx', 'application/x-msdownload');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dateityp konnte nicht verifiziert werden' });
      expect(await nachrichten()).toBe(0);
    });

    it('ERLAUBT: Sprachmemo (.m4a), vom Browser als audio/x-m4a gemeldet -> 200', async () => {
      // Die Auswahl im Chat bietet .m4a an; Browser melden den Typ oft unter
      // diesem zweiten Namen, der nicht auf der Liste steht.
      const res = await imChat(tonDatei(), 'Sprachmemo.m4a', 'audio/x-m4a');
      expect(res.status).toBe(200);
      expect(res.body.message_type).toBe('file');
    });

    it('VERBOTEN: Zufallsbytes als .docx -> 415', async () => {
      const res = await imChat(crypto.randomBytes(5000), 'Einladung.docx', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(await nachrichten()).toBe(0);
    });

    it('VERBOTEN: nicht erlaubte Endung ohne Typ -> 415 mit verstaendlichem Satz statt stiller 400', async () => {
      const res = await imChat(programmDatei(), 'setup.exe', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dieser Dateityp kann nicht gesendet werden.' });
      expect(await nachrichten()).toBe(0);
    });

    it('VERBOTEN: nicht erlaubter Typ -> 415, auch mit Text dabei -- keine Nachricht ohne die Datei', async () => {
      // Vorher ging hier der Text raus und die Datei verschwand still.
      const res = await imChat(programmDatei(), 'setup.exe', 'application/x-msdownload', 'Hier das Programm');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dieser Dateityp kann nicht gesendet werden.' });
      expect(await nachrichten()).toBe(0);
    });

    it('VERBOTEN: eine Excel-Datei ohne Typ -> 415 (im Chat nicht erlaubt, im Material schon)', async () => {
      const res = await imChat(wordDatei('word'), 'Liste.xlsx', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dieser Dateityp kann nicht gesendet werden.' });
    });

    it('das Zwischenlager bleibt auch bei abgewiesenen Dateien leer', async () => {
      const lager = path.join(os.tmpdir(), 'konfi-test-uploads', 'tmp');
      const vorher = fs.existsSync(lager) ? fs.readdirSync(lager).length : 0;
      await imChat(programmDatei(), 'setup.exe', 'application/octet-stream');
      await new Promise((weiter) => setTimeout(weiter, 50));
      const nachher = fs.existsSync(lager) ? fs.readdirSync(lager).length : 0;
      expect(nachher).toBe(vorher);
    });
  });

  describe('Material', () => {
    let materialId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/material')
        .set('Authorization', `Bearer ${leitung}`)
        .send({ title: 'Freizeit' });
      expect(res.status).toBe(201);
      materialId = res.body.id;
    });

    const hochladen = (inhalt, filename, contentType) => request(app)
      .post(`/api/material/${materialId}/files`)
      .set('Authorization', `Bearer ${leitung}`)
      .attach('files', inhalt, { filename, contentType });

    const dateien = async () => (await db.query(
      'SELECT original_name, mime_type FROM material_files WHERE material_id = $1', [materialId]
    )).rows;

    it('ERLAUBT: Word-Datei als application/octet-stream -> 201, gespeichert mit dem Typ der Endung', async () => {
      const res = await hochladen(wordDatei('word'), 'Ablauf.docx', 'application/octet-stream');
      expect(res.status).toBe(201);
      expect(res.body[0].mime_type).toBe(DOCX_TYP);
      expect(await dateien()).toEqual([{ original_name: 'Ablauf.docx', mime_type: DOCX_TYP }]);
    });

    it('ERLAUBT: Excel-Datei ohne Typ -> 201 (im Material erlaubt)', async () => {
      const res = await hochladen(wordDatei('word'), 'Liste.xlsx', 'application/octet-stream');
      expect(res.status).toBe(201);
      expect(res.body[0].mime_type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('VERBOTEN: nicht erlaubte Endung -> 415 mit verstaendlichem Satz, nichts gespeichert', async () => {
      const res = await hochladen(programmDatei(), 'setup.exe', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dieser Dateityp kann nicht hochgeladen werden.' });
      expect(await dateien()).toEqual([]);
    });

    it('VERBOTEN: ein umbenanntes Programm -> 415 an den Kopfbytes', async () => {
      const res = await hochladen(programmDatei(), 'Ablauf.docx', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(await dateien()).toEqual([]);
    });
  });

  describe('Challenges', () => {
    let challengeId;

    beforeEach(async () => {
      const { rows: [c] } = await db.query(
        `INSERT INTO challenges
           (organization_id, title, description, challenge_type, audience, visibility, moderated,
            allowed_media, allow_multiple, badge_icon, badge_name, created_by, starts_at, ends_at, is_draft)
         VALUES ($1, 'Foto-Challenge', 'Zeig uns was', 'frei', 'konfis', 'public', false,
                 '["photo"]'::jsonb, true, 'flag', 'Fotograf:in', $2,
                 NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false)
         RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      challengeId = c.id;
      await db.query(
        'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [challengeId, JAHRGAENGE.jahrgang1.id]
      );
    });

    const einreichen = (inhalt, filename, contentType) => request(app)
      .post(`/api/challenges/konfi/${challengeId}/submissions`)
      .set('Authorization', `Bearer ${konfi}`)
      .field('media_type', 'photo')
      .attach('file', inhalt, { filename, contentType });

    it('ERLAUBT: Foto als application/octet-stream -> 201', async () => {
      const res = await einreichen(PNG, 'beitrag.png', 'application/octet-stream');
      expect(res.status).toBe(201);
      expect(res.body.file_name).toBe('beitrag.png');
    });

    it('VERBOTEN: nicht erlaubte Endung -> 415 mit verstaendlichem Satz statt „Bitte wähle eine Datei aus."', async () => {
      const res = await einreichen(programmDatei(), 'setup.exe', 'application/octet-stream');
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dieser Dateityp kann nicht hochgeladen werden.' });
    });
  });

  describe('Nachweisfoto eines Antrags', () => {
    const REQUESTS_DIR = path.join(__dirname, '../../uploads/requests');
    const aufraeumen = [];
    afterEach(() => {
      for (const p of aufraeumen.splice(0)) {
        try { fs.unlinkSync(p); } catch { /* schon weg */ }
      }
    });

    const hochladen = (inhalt, filename, contentType) => request(app)
      .post('/api/konfi/upload-photo')
      .set('Authorization', `Bearer ${konfi}`)
      .attach('photo', inhalt, { filename, contentType });

    it('ERLAUBT: Foto als application/octet-stream -> 200', async () => {
      const res = await hochladen(PNG, 'nachweis.png', 'application/octet-stream');
      expect(res.status).toBe(200);
      expect(res.body.filename).toMatch(/^[0-9a-f]{64}$/);
      aufraeumen.push(path.join(REQUESTS_DIR, res.body.filename));
    });

    it('VERBOTEN: kein Bild -> 415 mit verstaendlichem Satz statt „Kein Foto hochgeladen"', async () => {
      const res = await hochladen(wordDatei('word'), 'Einladung.docx', DOCX_TYP);
      expect(res.status).toBe(415);
      expect(res.body).toEqual({ error: 'Dieser Dateityp kann nicht hochgeladen werden.' });
    });
  });
});
