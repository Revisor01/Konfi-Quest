// backend/tests/routes/chatDateiTokenImQuery.test.js
//
// Audit 26.09.2026, backend-fachlogik-chat-challenges-rueckblick BF-09:
// GET /api/chat/files/:filename nahm das Zugriffstoken auch aus ?token=.
// Ein Query-String steht im Zugriffslog des Reverse-Proxys (RequestPath) und
// in Referrern — wer die Logs liest, saehe gueltige Anmelde-Tokens von
// Konfis. Die Challenge-Dateiroute lehnt genau dieses Muster seit 04.08.2026
// ab; zwei Regeln fuer dieselbe Frage.
//
// Wer ?token= je gesendet hat (geprueft 28.09.2026 an den Quellen):
//   - aktuelle App: nirgends (Dateien laufen per axios mit Authorization-
//     Header, Videos ueber den Medien-Cache als Blob);
//   - Store-Fassungen 2.3.0, 2.2.0, 2.1.1, 2.0.0 und 1.3.0 (erste Fassung
//     vor dem App-Store-Release): ebenfalls nirgends
//     (`git grep "token=" <tag> -- frontend/src` → nur Kommentare);
//   - einziger Sender war ein Entwicklungsstand vom 05.08.2025 (Video-Tag mit
//     ?token=), einen Tag spaeter schon wieder ersetzt — lange vor dem
//     ersten Store-Build.
// Keine ausgelieferte App baut also auf den Fallback. Er faellt weg; die
// Route nimmt das Token nur noch aus dem Authorization-Header.
//
// Sicherheitsfix: der verbotene Fall (Token nur im Query → 401) UND der
// erlaubte (Token im Header → 200, auch wenn zusaetzlich etwas im Query steht).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('GET /api/chat/files/:filename — Token nur im Header, nicht im Query (BF-09)', () => {
  let app;
  let db;
  let konfi1Token;
  let datei;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    konfi1Token = generateToken('konfi1');

    const up = await request(app)
      .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
      .set('Authorization', `Bearer ${konfi1Token}`)
      .attach('file', PNG, { filename: 'bild.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    datei = up.body.file_path;
  });

  afterAll(async () => {
    await closePool();
  });

  const binaer = (req) => req.buffer(true).parse((res, cb) => {
    const teile = [];
    res.on('data', (t) => teile.push(t));
    res.on('end', () => cb(null, Buffer.concat(teile)));
  });

  it('verboten: gueltiges Token nur im Query-String → 401, keine Datei', async () => {
    const res = await request(app).get(`/api/chat/files/${datei}?token=${konfi1Token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Kein Token vorhanden' });
  });

  it('verboten: auch das Token eines berechtigten Leitungskontos zaehlt im Query nicht', async () => {
    const res = await request(app).get(`/api/chat/files/${datei}?token=${generateToken('admin1')}`);

    expect(res.status).toBe(401);
  });

  it('erlaubt: Token im Authorization-Header → 200 mit dem Originalinhalt', async () => {
    const res = await binaer(
      request(app)
        .get(`/api/chat/files/${datei}`)
        .set('Authorization', `Bearer ${konfi1Token}`)
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.equals(PNG)).toBe(true);
  });

  it('erlaubt: Header entscheidet, ein zusaetzliches ?token= stoert nicht und wird nicht ausgewertet', async () => {
    // Ein ungueltiges Query-Token neben einem gueltigen Header: 200. Umgekehrt
    // (gueltiges Query-Token, kaputter Header) waere es 401 — siehe unten.
    const res = await request(app)
      .get(`/api/chat/files/${datei}?token=kaputt`)
      .set('Authorization', `Bearer ${konfi1Token}`);

    expect(res.status).toBe(200);
  });

  it('verboten: kaputter Header wird nicht durch ein gueltiges Query-Token gerettet', async () => {
    const res = await request(app)
      .get(`/api/chat/files/${datei}?token=${konfi1Token}`)
      .set('Authorization', 'Bearer kaputt');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Ungültiger Token' });
  });
});
