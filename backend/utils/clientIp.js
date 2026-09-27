// Echte Client-Adresse fuer die Rate-Limiter.
//
// WARUM NICHT EINFACH req.ip: Vor dem Backend stehen zwei Proxys (Apache des
// Hosters -> Traefik -> Backend). Apache setzt X-Real-IP auf die Adresse des
// Clients, liefert aber kein X-Forwarded-For, das Express mit `trust proxy`
// zuverlaessig auswerten koennte. In Produktion nachgemessen: req.ip war fuer
// ALLE Anfragen die Adresse des Proxys -- jeder IP-Limiter zaehlte damit
// global ueber alle Nutzer:innen, eine Konfi-Gruppe flog gemeinsam mit 429
// (Kommentar in server.js). Deshalb zaehlen die Limiter auf X-Real-IP.
//
// WARUM NICHT EINFACH DEN HEADER (Audit 26.09.2026, Sicherheit BF-13): Ein
// Header ist Nutzereingabe. Wer das Backend erreicht, ohne durch den eigenen
// Proxy zu gehen, setzt X-Real-IP selbst -- mit jeder Anfrage eine andere
// Adresse -- und kein Limiter greift mehr. Der Header wird deshalb nur noch
// angenommen, wenn die Anfrage nachweislich vom Proxy kommt: Der direkte
// Gegenueber (req.socket.remoteAddress) muss im Docker-Netz liegen.
//
// WARUM DIE PRUEFUNG UEBER DEN PEER UND NICHT UEBER `trust proxy` MIT
// HOP-ZAHL: Die Hop-Zahl haengt davon ab, ob Apache X-Forwarded-For anhaengt
// oder nicht -- genau das ist in Produktion offen (Bericht, "Auf Produktion
// nachzumessen" Nr. 4). Die Netzgrenze dagegen ist sicher: backend, backend2
// und backend-test haengen ausschliesslich an den Compose-Netzen `traefik`
// und `internal` (deploy/compose.konfi_quest.yml); der Port 5000 ist nicht
// auf dem Host veroeffentlicht. Alles, was das Backend erreicht, kommt aus
// einem privaten Bereich -- oder es ist ein Aufbau, dem nicht zu trauen ist.
//
// VERTRAUT werden Loopback (127/8, ::1), Link-Local und die privaten Bereiche
// (10/8, 172.16/12, 192.168/16, fc00::/7). Docker vergibt fuer seine Netze
// Adressen aus 172.16/12 oder 192.168/16; IPv4-mapped-IPv6 (::ffff:172.18.0.5)
// wird von proxy-addr auf IPv4 zurueckgefuehrt. Loopback deckt die lokale
// Entwicklung und die Tests (supertest verbindet ueber 127.0.0.1) ab.
//
// Faellt der Header weg -- kein vertrauter Peer, kein Header, kein gueltiger
// Wert --, gilt req.ip. Das ist hinter dem Proxy die Proxy-Adresse (der alte
// Zustand), ohne Proxy die echte Adresse des Clients.
const net = require('net');
const proxyaddr = require('proxy-addr');

const vertrauterProxy = proxyaddr.compile(['loopback', 'linklocal', 'uniquelocal']);

const clientIp = (req) => {
  const header = req.headers && req.headers['x-real-ip'];
  const peer = req.socket && req.socket.remoteAddress;
  if (typeof header === 'string' && peer && vertrauterProxy(peer, 0)) {
    const kandidat = header.trim();
    if (net.isIP(kandidat) !== 0) return kandidat;
  }
  return req.ip;
};

module.exports = { clientIp };
