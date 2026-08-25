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
