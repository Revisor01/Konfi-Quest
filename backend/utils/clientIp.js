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
// RUECKFALL, wenn der Header nicht gilt:
//   - vertrauter Peer, aber kein oder kein gueltiger Header: req.ip. Das ist
//     wegen `trust proxy 1` (createApp.js) der letzte Eintrag in
//     X-Forwarded-For -- den haengt der Proxy selbst an (Traefik: die Adresse
//     SEINES Gegenuebers). Hinter dem vorderen Proxy ist das dessen Adresse,
//     fuer alle dieselbe (der alte Zustand, Fall C im Auftrag 07).
//   - KEIN vertrauter Peer: dessen eigene Adresse (req.socket.remoteAddress),
//     NICHT req.ip (29.09.2026). Mit `trust proxy 1` liest Express req.ip aus
//     X-Forwarded-For, egal wer den Header geschickt hat -- wer das Backend am
//     Proxy vorbei erreicht, haette seine Adresse sonst ueber diesen Header
//     statt ueber X-Real-IP gesetzt. Gegenprobe in tests/utils/clientIp.test.js.
//   - ohne Peer-Adresse (Socket schon geschlossen): req.ip.
//
// WAS DAS BACKEND NICHT PRUEFEN KANN: ob der vordere Proxy einen vom Client
// geschickten X-Real-IP ueberschreibt (Fall B) oder durchreicht. Das haengt an
// dessen Konfiguration (`RequestHeader set`, nicht "nur wenn leer") und an
// Traefik (vorderer Proxy unter forwardedHeaders.trustedIPs, NICHT insecure --
// Traefik ersetzt X-Real-Ip von nicht vertrauten Absendern durch die eigene
// Sicht). Gemessen am 01.10.2026 (Auftrag 07 des lokalen Agenten,
// docs/README.md): Fall A -- der vordere Proxy ueberschreibt X-Real-IP.
const net = require('net');
const proxyaddr = require('proxy-addr');

const vertrauterProxy = proxyaddr.compile(['loopback', 'linklocal', 'uniquelocal']);

// IPv4-mapped-IPv6 (::ffff:203.0.113.9) wie IPv4 zaehlen -- so, wie req.ip es
// liefert; sonst truegen Anfragen ueber IPv4 zwei verschiedene Schluessel.
const ohneMapping = (adresse) => {
  const m = /^::ffff:(.+)$/i.exec(adresse);
  return m && net.isIPv4(m[1]) ? m[1] : adresse;
};

const clientIp = (req) => {
  const header = req.headers && req.headers['x-real-ip'];
  const peer = req.socket && req.socket.remoteAddress;
  if (!peer) return req.ip;
  if (!vertrauterProxy(peer, 0)) return ohneMapping(peer);
  if (typeof header === 'string') {
    const kandidat = header.trim();
    if (net.isIP(kandidat) !== 0) return kandidat;
  }
  return req.ip;
};

module.exports = { clientIp };
