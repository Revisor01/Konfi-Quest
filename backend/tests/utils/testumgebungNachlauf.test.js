// backend/tests/utils/testumgebungNachlauf.test.js
//
// Waechter fuer die zwei Vorkehrungen in tests/setupTests.js gegen die
// sporadischen 404 und "Parse Error: Expected HTTP/" in vollen Laeufen
// (Befund und Messung vom 08.10.2026 stehen dort).
//
// 1. Testserver lauschen nur auf 127.0.0.1. Sonst kann ein listen(0) einen
//    Port bekommen, den ein anderer Prozess auf 127.0.0.1 haelt -- die
//    Anfrage des Tests landet dann bei diesem Prozess.
// 2. Der Rest eines Route-Handlers nach res.json() zaehlt als Nachwehe der
//    App. Sonst laeuft er nach dem TRUNCATE des naechsten Tests weiter und
//    schreibt in dessen frischen Stand.

const http = require('node:http');
const express = require('express');
const request = require('supertest');
const { warteAufNachwehen } = require('../../utils/nachAntwort');

describe('Testumgebung: kein Nachlauf trifft den naechsten Test', () => {
  it('listen(0) ohne Adresse bindet 127.0.0.1, nicht alle Adressen', async () => {
    const server = http.createServer();
    await new Promise((r) => server.listen(0, r));
    try {
      expect(server.address().address).toBe('127.0.0.1');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('express app.listen(0), wie supertest es ruft, bindet 127.0.0.1', async () => {
    const app = express();
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    try {
      expect(server.address().address).toBe('127.0.0.1');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('eine ausdrueckliche Adresse bleibt, wie sie ist', async () => {
    const server = http.createServer();
    await new Promise((r) => server.listen(0, '::1', r));
    try {
      expect(server.address().address).toBe('::1');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('der Rest eines Handlers nach res.json() wird abgewartet', async () => {
    const app = express();
    let fertig = false;
    app.get('/nachlauf', async (req, res) => {
      res.json({ ok: true });
      await new Promise((r) => setTimeout(r, 50));
      fertig = true;
    });

    const res = await request(app).get('/nachlauf');
    expect(res.status).toBe(200);
    // Die Antwort ist da, der Handler laeuft noch.
    expect(fertig).toBe(false);

    await warteAufNachwehen(app);
    expect(fertig).toBe(true);
  });
});
