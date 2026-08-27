// Befund 27.08.2026, in Produktion gemessen: Ein fehlerhafter
// Socket.IO-Handshake brachte das Backend zum Absturz.
//
// Ursache: In server.js stand `server.on('request', app)`. Das haengt
// Express als ZWEITEN Listener an dasselbe 'request'-Event, an dem auch
// Engine.IO haengt — Node ruft dann beide auf. Engine.IO antwortet bei
// einem kaputten Handshake mit "Bad request" und schliesst die Antwort;
// unmittelbar danach laeuft Express ueber dieselbe Antwort und wirft
// ERR_HTTP_HEADERS_SENT. Der Fehler entsteht im Event-Handler, nicht in
// einer Middleware — keine error-Middleware faengt ihn, der Prozess stirbt.
//
// Gemessen: 20 Abstuerze in 45 Minuten normaler Nutzung, beide Replikas
// betroffen. `GET /socket.io/?transport=polling` (ohne EIO) genuegte.
//
// Dieser Test baut denselben Aufbau nach: ein Listener, der die Antwort
// abschliesst, und dahinter die App-Weiche aus server.js.
const http = require('http');
const { Server } = require('socket.io');

// Die Weiche, wie sie seit dem Fix in server.js steht.
function appWeiche(app) {
  return (req, res) => {
    if (res.headersSent || res.writableEnded) return;
    app(req, res);
  };
}

function starteServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer();
    const io = new Server(server);
    server.on('request', handler);
    server.listen(0, () => resolve({ server, io, port: server.address().port }));
  });
}

function hole(port, pfad) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pfad }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('Zeit abgelaufen')); });
  });
}

describe('Socket.IO und Express teilen sich das request-Event', () => {
  let aufbau;
  let appAufrufe;
  const app = (req, res) => {
    appAufrufe++;
    res.statusCode = 200;
    res.end('von Express');
  };

  beforeEach(() => { appAufrufe = 0; });

  afterEach(async () => {
    if (aufbau) {
      aufbau.io.close();
      await new Promise((r) => aufbau.server.close(r));
      aufbau = null;
    }
  });

  it('verbotener Fall: kaputter Handshake reisst die App NICHT mit', async () => {
    aufbau = await starteServer(appWeiche(app));
    // Genau die URL, die in Produktion den Absturz ausloeste.
    const res = await hole(aufbau.port, '/socket.io/?transport=polling');

    // Engine.IO hat geantwortet ...
    expect(res.status).toBe(400);
    // ... und Express wurde fuer diesen Request NICHT mehr aufgerufen.
    expect(appAufrufe).toBe(0);

    // Der Server lebt noch: ein normaler Request geht weiterhin durch.
    const zweiter = await hole(aufbau.port, '/api/irgendwas');
    expect(zweiter.status).toBe(200);
    expect(zweiter.body).toBe('von Express');
  });

  it('erlaubter Fall: normale Requests erreichen Express unveraendert', async () => {
    aufbau = await starteServer(appWeiche(app));
    const res = await hole(aufbau.port, '/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toBe('von Express');
    expect(appAufrufe).toBe(1);
  });

  it('Gegenprobe: OHNE die Weiche laeuft die App in die fertige Antwort', async () => {
    // Der alte Zustand — `server.on('request', app)` ohne Pruefung.
    // Express bekommt hier eine bereits abgeschlossene Antwort und wuerde in
    // Produktion ERR_HTTP_HEADERS_SENT werfen. Der Test haelt fest, dass die
    // App in dieser Fassung ueberhaupt aufgerufen wird — genau das ist der
    // Unterschied zum Fix oben.
    let sah = false;
    aufbau = await starteServer((req, res) => {
      if (req.url.startsWith('/socket.io/')) {
        // Engine.IO hat bereits geantwortet; die alte Fassung prueft das nicht.
        sah = res.headersSent || res.writableEnded;
      }
      if (!res.writableEnded) { res.statusCode = 200; res.end('von Express'); }
    });
    await hole(aufbau.port, '/socket.io/?transport=polling');
    expect(sah).toBe(true);
  });
});
