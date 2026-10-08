// Laeuft in JEDEM Test-Worker, vor den Testdateien (vitest setupFiles).
//
// Zweck: den sporadischen Abbruch abstellen, der rund 1 von 1200 Tests traf —
// wechselnd welchen und in wechselnden Dateien (challenges, events, konfi;
// belegt am 25./26.08.2026):
//
//   Error: Parse Error: Expected HTTP/, RTSP/ or ICE/
//   Error: socket hang up
//
// Ursache: Etliche Routen senden bewusst erst die Antwort und erledigen danach
// Push, Badges und Live-Updates (siehe utils/nachAntwort.js). supertest
// schliesst aber, sobald die Antwort da ist. Wird derselbe Socket danach fuer
// den naechsten Request wiederverwendet, waehrend der vorige Handler noch
// schreibt, landet dessen Rest im naechsten Request — und der HTTP-Parser
// bricht ab. Deshalb traf es nie einen bestimmten Test, sondern immer den, der
// zufaellig den wiederverwendeten Socket erwischte.
//
// Gegenmittel: keine Wiederverwendung. Ohne Keep-Alive bekommt jeder Request
// eine eigene Verbindung, und ein Nachlauf kann niemanden mehr treffen.
// Das betrifft ausschliesslich den Testlauf — Produktion nutzt diese Datei
// nicht.
const http = require('node:http');
const https = require('node:https');

http.globalAgent = new http.Agent({ keepAlive: false, maxSockets: Infinity });
https.globalAgent = new https.Agent({ keepAlive: false, maxSockets: Infinity });

// TESTSERVER LAUSCHEN NUR AUF 127.0.0.1 (08.10.2026).
//
// Die eigentliche Ursache der sporadischen 404 und "Parse Error: Expected
// HTTP/" in vollen Laeufen -- auf main wie auf Branches, einzeln immer gruen.
// supertest startet je Anfrage `app.listen(0)`: Node bindet dann `::` (alle
// Adressen), supertest verbindet sich aber mit 127.0.0.1 (lib/test.js,
// serverAddress). macOS vergibt fuer `::` auch einen Port, den ein ANDERER
// Prozess schon auf 127.0.0.1 belegt -- die engere Bindung gewinnt, und die
// Anfrage landet bei diesem Prozess. Gemessen am 08.10.2026: Die Diagnose
// protokollierte jede 404 auf Server- und Clientseite. Der Test
// "jahrgangLeitungEmpfaenger > Admin des Jahrgangs UND die Org-Admins ohne
// Zuweisung" bekam auf GET /api/admin/konfis (Port 49989) eine 404, die
// unser Server nie gesendet hatte; `lsof` zeigte auf 127.0.0.1:49989 einen
// Python-Dienst (ha_mcp sidecar), auf 127.0.0.1:50120 das Netz von Colima
// (limactl usernet). Der eine antwortet mit 404, der andere mit Bytes, die
// kein HTTP sind. Getroffen wird, wer zufaellig einen solchen Port zieht --
// deshalb wechselnd welcher Test, und nur in langen Laeufen, die den
// Portbereich (49152-65535) einmal umrunden.
//
// Mit 127.0.0.1 als Adresse vergibt das System nur Ports, die dort frei
// sind. Gilt fuer jedes listen(0) ohne Adresse im Testprozess (supertest,
// Socket.IO-Testserver); alle Testclients verbinden sich mit 127.0.0.1.
(function nurLoopback() {
  const net = require('node:net');
  const orig = net.Server.prototype.listen;
  // supertest liest server.address() SOFORT nach listen(0) (lib/test.js,
  // serverAddress). listen(0, '127.0.0.1') loest die Adresse aber asynchron
  // auf -- address() waere dann null. Deshalb wird der Griff hier synchron
  // auf 127.0.0.1 gebunden (net._createServerHandle, derselbe Weg wie im
  // Cluster) und listen mit diesem Griff gerufen; das ist ebenfalls
  // synchron.
  net.Server.prototype.listen = function listen(...a) {
    const portNull = (p) => p === 0 || p === '0';
    const nurPortUndRueckruf = a.length >= 1 && portNull(a[0])
      && (a.length === 1 || (a.length === 2 && typeof a[1] === 'function'));
    if (nurPortUndRueckruf) {
      const griff = net._createServerHandle('127.0.0.1', 0, 4);
      if (typeof griff !== 'number') {
        return orig.call(this, griff, ...(typeof a[1] === 'function' ? [a[1]] : []));
      }
    }
    return orig.apply(this, a);
  };
})();

// DER HANDLER SELBST IST AUCH EIN NACHLAEUFER (08.10.2026).
//
// Gemessen in drei vollen Laeufen mit einer Diagnose, die jede Abfrage dem
// Test zuordnet, aus dem ihre asynchrone Kette stammt (AsyncLocalStorage um
// pg.Pool.query): Nach dem TRUNCATE und Seed des naechsten Tests liefen noch
// Abfragen des vorigen -- 73 Stueck in einem Lauf. Ihre Quelle war nie
// nachAntwort, liveUpdate oder die Warteschlange, sondern der Rest eines
// Route-Handlers, der nach res.json() weiter mit await arbeitet, ohne die
// Arbeit in nachAntwort zu wickeln, z. B. PUT /users/:id (Chat-Sync nach der
// Antwort: INSERT INTO chat_rooms, chat_participants), DELETE der Absage mit
// einreihen() erst nach einem await, Push nach einem Challenge-Beitrag.
// Solche Zeilen landen im frisch geseedeten Stand des naechsten Tests und
// verschieben dessen Sequenzen -- daher die sporadischen 404 auf feste IDs
// und, wenn die Arbeit noch auf dem Socket haengt, "Parse Error: Expected
// HTTP/". warteAufAlleNachwehen sah diese Arbeit nicht: Registriert war nur,
// was nachAntwort/liveUpdate selbst anmelden.
//
// Deshalb hier, in jedem Test-Worker vor den Testdateien: Jeder Handler, der ein Promise liefert (jeder
// async-Handler, Express 5 wertet es ohnehin aus), meldet es als Nachwehe der
// App an. truncateAll und closePool warten dann bis zum Ende des Handlers --
// nicht nur bis zur Antwort. Produktion laedt diese Datei nie. Angemeldet
// wird in derselben Menge wie bei nachAntwort (app.locals.offeneNachwehen,
// utils/nachAntwort.js), gewartet in tests/helpers/testApp.js.
(function handlerAlsNachwehe() {
  const path = require('node:path');
  const layerPfad = require.resolve('router/lib/layer', { paths: [path.dirname(require.resolve('express'))] });
  const Layer = require(layerPfad);
  if (Layer.prototype.__alsNachwehe) return;
  const orig = Layer.prototype.handleRequest;
  Layer.prototype.handleRequest = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (typeof fn !== 'function' || fn.length > 3) return orig.call(this, req, res, next);
    const self = this;
    const umhuellt = Object.create(self);
    umhuellt.handle = function (...args) {
      const ret = fn.apply(this, args);
      if (ret && typeof ret.then === 'function') {
        const locals = req.app?.locals;
        if (locals) {
          if (!locals.offeneNachwehen) locals.offeneNachwehen = new Set();
          const lauf = Promise.resolve(ret).catch(() => {});
          locals.offeneNachwehen.add(lauf);
          lauf.finally(() => locals.offeneNachwehen.delete(lauf));
        }
      }
      return ret;
    };
    return orig.call(umhuellt, req, res, next);
  };
  Layer.prototype.__alsNachwehe = true;
})();
