// backend/tests/helpers/socketClient.js -- ein kleiner Socket.IO-Client fuer Tests
//
// Das Backend hat `socket.io` (Server), aber keinen `socket.io-client` in den
// Abhaengigkeiten -- und eine neue Abhaengigkeit nur fuer Tests waere der
// falsche Preis. Fuer die Frage "wie oft kommt ein Ereignis bei EINEM Client
// an?" reicht das Drahtprotokoll selbst: Engine.IO v4 ueber WebSocket (`ws`
// bringt engine.io ohnehin mit) und darauf die Socket.IO-Pakete.
//
//   Engine.IO:  0 = open, 2 = ping (Antwort 3 = pong), 4 = Nachricht
//   Socket.IO:  40 = CONNECT (optional mit auth-JSON), 42 = EVENT,
//               44 = CONNECT_ERROR
//
// Mehr braucht es nicht: kein Binaerdaten, keine Acks, nur der Default-
// Namespace. Wer Reconnects oder Namespaces testen will, braucht den echten
// Client.
const WebSocket = require('ws');

/**
 * Verbindet einen Client und wartet, bis der Socket.IO-Namespace bestaetigt
 * ist.
 *
 * @param {number} port
 * @param {object} [auth]  Inhalt des CONNECT-Pakets (socket.handshake.auth)
 * @returns {Promise<{
 *   emit: (event: string, ...args: any[]) => void,
 *   ereignisse: (event: string) => any[],
 *   warteAuf: (event: string, anzahl?: number, ms?: number) => Promise<any[]>,
 *   schliessen: () => Promise<void>
 * }>}
 */
function verbindeSocketClient(port, auth = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
    const empfangen = [];
    const zuhoerer = new Set();
    let verbunden = false;

    const timer = setTimeout(() => reject(new Error('Socket.IO-Verbindung kam nicht zustande')), 5000);

    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
    ws.on('message', (roh) => {
      const text = roh.toString();
      // Engine.IO-Paket
      if (text[0] === '0') {
        // open -> Namespace betreten, auth als JSON anhaengen
        ws.send('40' + JSON.stringify(auth));
        return;
      }
      if (text[0] === '2') { ws.send('3'); return; }
      if (text[0] !== '4') return;
      // Socket.IO-Paket
      const typ = text[1];
      if (typ === '0') {
        verbunden = true;
        clearTimeout(timer);
        resolve(client);
        return;
      }
      if (typ === '4') {
        clearTimeout(timer);
        reject(new Error('Socket.IO CONNECT_ERROR: ' + text.slice(2)));
        return;
      }
      if (typ === '2') {
        // 42[<ack-id>]["event", ...args]
        const start = text.indexOf('[');
        if (start === -1) return;
        const [event, ...args] = JSON.parse(text.slice(start));
        empfangen.push({ event, args });
        for (const z of zuhoerer) z();
      }
    });

    const client = {
      emit(event, ...args) {
        ws.send('42' + JSON.stringify([event, ...args]));
      },
      ereignisse(event) {
        return empfangen.filter((e) => e.event === event).map((e) => e.args[0]);
      },
      // Wartet, bis MINDESTENS `anzahl` Ereignisse dieses Namens da sind --
      // und dann noch `nachlauf` ms, damit ein etwaiges zweites Exemplar auch
      // noch eintreffen kann. Ohne den Nachlauf saehe ein Test "genau einmal"
      // nie ein Duplikat, das eine Millisekunde spaeter kommt.
      async warteAuf(event, anzahl = 1, ms = 3000, nachlauf = 300) {
        const bis = Date.now() + ms;
        while (client.ereignisse(event).length < anzahl && Date.now() < bis) {
          await new Promise((r) => {
            const z = () => { zuhoerer.delete(z); r(); };
            zuhoerer.add(z);
            setTimeout(z, 50);
          });
        }
        await new Promise((r) => setTimeout(r, nachlauf));
        return client.ereignisse(event);
      },
      get verbunden() { return verbunden; },
      schliessen() {
        return new Promise((r) => {
          if (ws.readyState === WebSocket.CLOSED) return r();
          ws.once('close', () => r());
          ws.close();
        });
      },
    };
  });
}

module.exports = { verbindeSocketClient };
