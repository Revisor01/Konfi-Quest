// Tipp-Anzeige traegt den Namen (Audit 26.09.2026, Fachlogik
// Chat/Challenges/Rueckblick BF-12).
//
// Seit der Umstellung der Socket-Anmeldung auf die Datenbankpruefung
// (22.08.2026) trug socket.user nur id, organization_id, role_name und type.
// Das Tipp-Ereignis (utils/chatRoomAccess.js) liest aber
// socket.user.display_name -- es ging mit `userName: undefined` hinaus.
//
// Gemessen wird am echten Weg: ein Socket.io-Server mit der Anmeldung, die
// server.js einhaengt (utils/socketAnmeldung.js), und der Raum-Behandlung
// (socketRaumEreignisse); die Clients melden sich mit einem echten Token an.
// Dazu die Pruefungen, die die Anmeldung schon vorher hatte, als Gegenprobe:
// ohne Token, deaktiviertes Konto.
const http = require('http');
const { Server } = require('socket.io');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { verbindeSocketClient } = require('../helpers/socketClient');
const { socketRaumEreignisse } = require('../../utils/chatRoomAccess');
const { socketAnmeldung } = require('../../utils/socketAnmeldung');

describe('Socket-Anmeldung: Anzeigename fuer die Tipp-Anzeige', () => {
  let db;
  let server;
  let io;
  let port;
  let clients;

  beforeAll(async () => {
    db = getTestPool();
    server = http.createServer();
    io = new Server(server);
    io.use(socketAnmeldung(db, process.env.JWT_SECRET));
    io.on('connection', (socket) => {
      socketRaumEreignisse(socket, db);
    });
    await new Promise((r) => server.listen(0, r));
    port = server.address().port;
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    clients = [];
  });

  afterEach(async () => {
    for (const c of clients) await c.schliessen();
  });

  afterAll(async () => {
    io.close();
    await new Promise((r) => server.close(r));
    await closePool();
  });

  const verbinde = async (userKey) => {
    const c = await verbindeSocketClient(port, { token: generateToken(userKey) });
    clients.push(c);
    return c;
  };

  it('"userTyping" nennt den Namen aus der Datenbank', async () => {
    const konfi = await verbinde('konfi1');
    const admin = await verbinde('admin1');
    konfi.emit('joinRoom', CHAT_ROOMS.direct.id);
    admin.emit('joinRoom', CHAT_ROOMS.direct.id);
    await new Promise((r) => setTimeout(r, 200));

    konfi.emit('typing', CHAT_ROOMS.direct.id);
    const ereignisse = await admin.warteAuf('userTyping', 1);

    expect(ereignisse).toEqual([{
      roomId: CHAT_ROOMS.direct.id,
      userId: USERS.konfi1.id,
      userName: 'Test Konfi 1',
    }]);
  });

  it('der Name kommt aus der Datenbank, nicht aus dem Token', async () => {
    await db.query("UPDATE users SET display_name = 'Konfi Umbenannt' WHERE id = $1", [USERS.konfi1.id]);
    const konfi = await verbinde('konfi1');
    const admin = await verbinde('admin1');
    konfi.emit('joinRoom', CHAT_ROOMS.direct.id);
    admin.emit('joinRoom', CHAT_ROOMS.direct.id);
    await new Promise((r) => setTimeout(r, 200));

    konfi.emit('typing', CHAT_ROOMS.direct.id);
    const [ereignis] = await admin.warteAuf('userTyping', 1);

    expect(ereignis.userName).toBe('Konfi Umbenannt');
  });

  it('Gegenprobe: ohne Token keine Verbindung', async () => {
    await expect(verbindeSocketClient(port, {})).rejects.toThrow(/Authentication required/);
  });

  it('Gegenprobe: ein deaktiviertes Konto kommt nicht hinein', async () => {
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.konfi1.id]);
    await expect(verbindeSocketClient(port, { token: generateToken('konfi1') })).rejects.toThrow(/Invalid token/);
  });
});
