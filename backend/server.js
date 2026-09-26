// --- START OF FILE server.js ---
// Produktions-Wrapper: Startet Server + Socket.IO + SMTP + Cron + Firebase
// Die Express-App wird von createApp.js erstellt (testbare Factory).

const http = require('http');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// ====================================================================
// SERVER CONFIGURATION
// ====================================================================

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required!');
  process.exit(1);
}

// ====================================================================
// DATABASE INITIALIZATION
// ====================================================================

const db = require('./database');
const { darfRaumBetreten } = require('./utils/chatRoomAccess');

// Gemeinsamer Zaehler-Speicher fuer die Rate-Limiter (Audit 26.09.2026,
// Betrieb BF-09 / S-10): Ohne `store` zaehlte express-rate-limit je Prozess
// im Speicher, und hinter Traefik mit zwei Replicas galt jedes Limit doppelt
// (40 statt 20 Doku-Passwort-Versuche, 600 statt 300 Login-Fehlversuche);
// 429 kam scheinbar zufaellig. Der Store zaehlt in der vorhandenen Postgres
// (Tabelle rate_limit_zaehler, Migration 167) und faellt bei einem
// Datenbankausfall auf den Speicher je Prozess zurueck. Jeder Limiter
// bekommt seine EIGENE Instanz mit eigenem Praefix.
//
// Bewusst NICHT geteilt: der allgemeine Flutschutz (generalLimiter, 2000 je
// Viertelstunde). Er liegt vor JEDER Anfrage -- auch vor den
// Gesundheitspruefungen von Traefik und Docker -- und ein Datenbankschreiben
// je API-Aufruf waere fuer eine Bremse, die kein Passwort schuetzt, der
// falsche Preis. Er zaehlt weiter je Replica; effektiv also das Doppelte.
const { PostgresRateLimitStore } = require('./utils/rateLimitStore');
const geteilterZaehler = (name) => new PostgresRateLimitStore(db, { prefix: name });

// ====================================================================
// HTTP SERVER (ohne App — App kommt nach Socket.IO Setup)
// ====================================================================

const server = http.createServer();

// ====================================================================
// SOCKET.IO SETUP
// ====================================================================

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://konfi-quest.de,https://www.konfi-quest.de').split(',');

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO-Events REPLIKA-UEBERGREIFEND verteilen (Audit 03.07.2026, Phase A2):
// Es laufen zwei Backend-Instanzen hinter Traefik. Ohne Adapter emittet jede
// Instanz nur an ihre EIGENEN Sockets — ein io.emit() der Replika, die den
// Request verarbeitet hat, erreichte Clients auf der anderen Replika NIE
// (betraf alle LiveUpdates und Chat-Events). Der postgres-adapter nutzt die
// vorhandene DB als Event-Bus (NOTIFY/LISTEN); Payloads > ~8000 Bytes laufen
// über die Tabelle socket_io_attachments (Migration 109).
const { createAdapter: createPgAdapter } = require('@socket.io/postgres-adapter');
const { Pool: PgPool } = require('pg');
const { mitVerbindungsschutz } = require('./utils/socketAdapterVerbindung');

// Eigener kleiner Pool für den Adapter (dedizierte LISTEN-Connection + Queries),
// getrennt vom App-Pool in database.js, damit die dauerhafte LISTEN-Verbindung
// keinen App-Slot belegt.
const socketAdapterPool = new PgPool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_SOCKET_ADAPTER_POOL_MAX || '2', 10),
  // Wie der App-Pool (database.js): Nach einem Datenbank-Ausfall versucht der
  // Adapter alle 1-3 s eine Neuverbindung; ohne Grenze hinge ein einzelner
  // Versuch gegen einen nicht erreichbaren Host minutenlang im TCP-Timeout.
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10),
});
// Nur fuer LEERLAUFENDE Pool-Verbindungen. Die dauerhaft ausgecheckte
// LISTEN-Verbindung des Adapters hoert hier NICHT mit -- dafuer die Huelle.
socketAdapterPool.on('error', (err) => {
  console.error('Socket.IO-Adapter-Pool Fehler:', err.message);
});
// Huelle (Audit 26.09.2026, Betrieb BF-01): Der Adapter bindet an seinen
// LISTEN-Client kein 'error'. Riss die Datenbankverbindung ab (Neustart,
// OOM-Kill, Failover), warf Node uncaughtException, und gracefulShutdown unten
// beendete JEDE Replica im selben Moment -- Totalausfall bis Docker neu
// startete. Die Huelle loggt den Abbruch, laesst den Adapter neu verbinden und
// gibt den toten Client an den Pool zurueck (utils/socketAdapterVerbindung.js).
io.adapter(createPgAdapter(mitVerbindungsschutz(socketAdapterPool), {
  errorHandler: (err) => console.error('Socket.IO-Postgres-Adapter Fehler:', err.message),
}));

// Engine-Level Events
io.engine.on('connection_error', (err) => {
  console.warn('Socket.io Engine connection_error:', err.code, err.message);
});

// Socket.io JWT Authentication Middleware
//
// Frueher stand hier `socket.user = decoded` — die Angaben aus dem Token
// galten damit ungeprueft, und ein Socket lebt deutlich laenger als die
// 15 Minuten Token-Laufzeit. Ein geloeschtes, deaktiviertes oder per
// Passwortwechsel gesperrtes Konto behielt seine Live-Verbindung
// (Audit 22.08.2026). Die Prüfung kostet EINE Query je Verbindungsaufbau,
// nicht je Nachricht — der Socket verbindet sich einmal und bleibt dann.
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.warn('Socket.io Auth fehlgeschlagen:', err.message);
    return next(new Error('Invalid token'));
  }

  try {
    const { rows: [nutzer] } = await db.query(
      `SELECT u.id, u.organization_id, u.token_invalidated_at, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.deleted_at IS NULL AND u.is_active = true`,
      [decoded.id]
    );
    if (!nutzer) {
      return next(new Error('Invalid token'));
    }

    // Soft-Revoke wie in rbac.js: Sperren aus einem Passwortwechsel gelten auch hier.
    if (nutzer.token_invalidated_at) {
      const ausgestellt = decoded.iat;
      const gesperrtAb = Math.floor(new Date(nutzer.token_invalidated_at).getTime() / 1000);
      if (ausgestellt < gesperrtAb) {
        return next(new Error('Token invalidated'));
      }
    }

    // Aktive Organisation aufloesen (Umschalter). Ohne das arbeitet der Socket
    // immer in der Primaer-Org — die Raum-Prüfungen unten (joinRoom) hätten
    // in einer Zweit-Gemeinde die falsche Organisation verglichen.
    let orgId = nutzer.organization_id;
    let rolle = nutzer.role_name;
    const tokenOrg = decoded.active_organization_id ? parseInt(decoded.active_organization_id) : null;

    if (Number.isInteger(tokenOrg) && tokenOrg !== orgId) {
      const { rows: [mitgliedschaft] } = await db.query(
        `SELECT uo.organization_id, r.name AS role_name
         FROM user_organizations uo
         JOIN roles r ON uo.role_id = r.id
         WHERE uo.user_id = $1 AND uo.organization_id = $2`,
        [decoded.id, tokenOrg]
      );
      if (!mitgliedschaft) {
        return next(new Error('Kein Zugriff auf diese Organisation'));
      }
      orgId = mitgliedschaft.organization_id;
      rolle = mitgliedschaft.role_name;
    }

    socket.user = {
      id: nutzer.id,
      organization_id: orgId,
      role_name: rolle,
      type: rolle === 'konfi' ? 'konfi' : rolle === 'teamer' ? 'teamer' : 'admin'
    };
    next();
  } catch (err) {
    console.error('Socket.io Auth: Datenbankfehler:', err.message);
    return next(new Error('Authentication failed'));
  }
});

// Socket.io Connection Handler
io.on('connection', (socket) => {
  const userRoom = `user_${socket.user.type}_${socket.user.id}`;
  socket.join(userRoom);

  socket.on('joinRoom', async (roomId) => {
    try {
      const erlaubt = await darfRaumBetreten(db, roomId, socket.user);
      if (!erlaubt.ok) {
        console.warn(`Socket joinRoom abgelehnt: User ${socket.user.id} -> Room ${roomId} (${erlaubt.grund})`);
        return;
      }
      socket.join(`room_${roomId}`);
    } catch (err) {
      console.error('Socket joinRoom Fehler:', err.message);
    }
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(`room_${roomId}`);
  });

  // Auch hier Teilnehmerschaft prüfen: Ohne sie liesse sich über die
  // Tipp-Anzeige verraten, wer gerade in einem fremden Raum schreibt.
  socket.on('typing', async (roomId) => {
    try {
      const erlaubt = await darfRaumBetreten(db, roomId, socket.user);
      if (!erlaubt.ok) return;
      socket.to(`room_${roomId}`).emit('userTyping', {
        roomId,
        userId: socket.user.id,
        userName: socket.user.display_name
      });
    } catch (err) {
      console.error('Socket typing Fehler:', err.message);
    }
  });

  socket.on('stopTyping', async (roomId) => {
    try {
      const erlaubt = await darfRaumBetreten(db, roomId, socket.user);
      if (!erlaubt.ok) return;
      socket.to(`room_${roomId}`).emit('userStoppedTyping', {
        roomId,
        userId: socket.user.id
      });
    } catch (err) {
      console.error('Socket stopTyping Fehler:', err.message);
    }
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'server namespace disconnect') {
      console.log(`Socket disconnected for user ${socket.user.id}: forced (role change)`);
    }
  });
});

// liveUpdate mit io initialisieren (DI statt globaler Variable)
const liveUpdate = require('./utils/liveUpdate');
liveUpdate.init(io, db);

// ====================================================================
// SMTP CONFIGURATION
// ====================================================================

const { smtpKonfiguration } = require('./utils/smtpKonfiguration');

// Host, Port, Nutzer, Passwort und TLS kommen aus der Umgebung -- ohne
// eingebauten Fallback-Host oder -Nutzer (Audit 26.09.2026, Sicherheit
// BF-12 / S-15; hier standen ein Hostname und eine Absenderadresse im Code)
// und mit Zertifikatspruefung (BF-09; hier stand `rejectUnauthorized: false`).
// Fehlen SMTP_HOST oder SMTP_USER, warnt smtpKonfiguration() beim Start;
// Begruendung und Notnagel stehen in utils/smtpKonfiguration.js.
const SMTP_CONFIG = smtpKonfiguration();
const smtpKonfiguriert = Boolean(SMTP_CONFIG.host && SMTP_CONFIG.auth.user && SMTP_CONFIG.auth.pass);

const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Nur pruefen, wenn es etwas zu pruefen gibt: Ohne Host liefe der Versuch
// gegen localhost und meldete einen irrefuehrenden Verbindungsfehler statt
// der Warnung von oben.
if (smtpKonfiguriert) {
  transporter.verify(function(error, success) {
    if (error) {
      console.error('SMTP connection failed:', error);
    }
  });
}

// ====================================================================
// RATE LIMITING
// ====================================================================

const { ipKeyGenerator } = require('express-rate-limit');

// Gemeinsamer Key-Generator: zählt PRO eingeloggtem User (aus dem JWT), nicht
// pro IP. Sonst teilen sich alle Konfis/Teamer einer Gemeinde hinter EINER
// WLAN-IP dasselbe Kontingent -> ein volles WLAN sperrt alle aus ("Zu viele
// Anfragen", scheinbar zufaellig). Unauthentifizierte Requests (Login/Register)
// fallen auf die IP zurück (IPv6-sicher via ipKeyGenerator).
// Echte Client-IP: Apache (KeyHelp) setzt X-Real-IP = %{REMOTE_ADDR}, ABER kein
// trust-proxy-konformes X-Forwarded-For -> req.ip war für ALLE die Proxy-IP
// (gleicher Key) -> der Limiter zählte GLOBAL über alle Nutzer -> eine Gruppe
// flog gleichzeitig mit 429. Daher X-Real-IP bevorzugen, dann erst req.ip.
//
// Seit dem 26.09.2026 (Audit Sicherheit BF-13) gilt der Header nur noch, wenn
// die Anfrage aus dem Docker-Netz kommt -- sonst setzt ihn ein Client selbst
// und umgeht jedes Limit. Dieselbe Funktion nutzt auch der Passwort-Reset-
// Limiter in routes/auth.js; Begruendung und Regel stehen in utils/clientIp.js.
const { clientIp } = require('./utils/clientIp');
const userOrIpKey = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // ungueltiges/abgelaufenes Token -> IP-Fallback
    }
  }
  return ipKeyGenerator(clientIp(req));
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  keyGenerator: userOrIpKey,
  message: { error: 'Zu viele Anfragen. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ACHTUNG: Hinter dem Reverse-Proxy (Apache->Traefik) wird die echte Client-IP
// derzeit nicht zuverlaessig unterschieden -> der Limiter zählt faktisch GLOBAL
// über alle Nutzer. Bei einer Konfi-Gruppe (viele Logins/Token-Refreshes
// gleichzeitig) war max:30 viel zu niedrig -> ALLE flogen gleichzeitig mit 429.
// Hoch auf 300 Fehlversuche/15min (skipSuccessfulRequests: Erfolge zählen NICHT)
// -> Gruppen-Onboarding läuft, echter Brute-Force wird weiter gebremst.
const authLimiter = rateLimit({
  store: geteilterZaehler('auth'),
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => ipKeyGenerator(clientIp(req)), // echte Client-IP (X-Real-IP), NICHT Proxy-IP
  message: { error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Registrierung: Beim Onboarding einer Konfi-Gruppe registrieren sich viele
// hintereinander aus DEMSELBEN Gemeinde-WLAN (gleiche IP). 5/Stunde war viel
// zu eng. Erfolgreiche Registrierungen zählen nicht mit, damit nur echte
// Missbrauchs-Schleifen (Fehlversuche) gebremst werden.
const registerLimiter = rateLimit({
  store: geteilterZaehler('register'),
  windowMs: 60 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => ipKeyGenerator(clientIp(req)), // echte Client-IP (X-Real-IP)
  message: { error: 'Zu viele Registrierungen. Bitte warte eine Stunde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Doku-Anmeldung (/api/docs-auth/anmelden): EIN gemeinsames Passwort ohne
// Benutzernamen — der globale Limiter (2000/15min) ist als einzige Bremse
// viel zu weit, damit liesse sich das Passwort schlicht durchprobieren
// (CodeQL-Befund 101, 24.08.2026). Erfolgreiche Anmeldungen zählen nicht,
// 20 Fehlversuche pro Viertelstunde reichen für Vertipper locker.
const docsLoginLimiter = rateLimit({
  store: geteilterZaehler('docs'),
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => ipKeyGenerator(clientIp(req)), // echte Client-IP (X-Real-IP)
  message: { error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const chatMessageLimiter = rateLimit({
  store: geteilterZaehler('chat'),
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  message: { error: 'Zu viele Nachrichten. Bitte warte einen Moment.' },
  standardHeaders: true,
  legacyHeaders: false
});

const eventBookingLimiter = rateLimit({
  store: geteilterZaehler('buchung'),
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  message: { error: 'Zu viele Buchungsanfragen. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimiter = rateLimit({
  store: geteilterZaehler('upload'),
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: userOrIpKey,
  message: { error: 'Zu viele Uploads. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Team-Chat leeren: entfernt ALLE Nachrichten eines Raums samt Dateianhaengen
// (Schleife ueber unlink). Der generalLimiter mit 2000/15min ist fuer eine so
// teure Operation viel zu weit gefasst; CodeQL hat die Route deshalb als
// "Missing rate limiting" gemeldet (26.08.2026). Zehn Leerungen pro Viertel-
// stunde reichen fuer jeden echten Bedarf der Leitung.
const chatClearLimiter = rateLimit({
  store: geteilterZaehler('chat-leeren'),
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: userOrIpKey,
  message: { error: 'Zu viele Leerungen des Team-Chats. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

const orgLimiter = rateLimit({
  store: geteilterZaehler('org'),
  // Deckt ALLE /api/organizations-Routen ab. GET (Lesen: Liste, Detail, Admins)
  // wird per skip ausgenommen und fällt auf den generalLimiter. Nur Schreib-Ops
  // (POST/PUT/PATCH/DELETE) zählen hier, pro User (nicht pro IP).
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyGenerator: userOrIpKey,
  skip: (req) => req.method === 'GET',
  message: { error: 'Zu viele Anfragen an die Organisationsverwaltung. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ====================================================================
// EXPRESS APP (via createApp Factory)
// ====================================================================

const { createApp } = require('./createApp');

const app = createApp(db, {
  // Dieselbe Liste wie Socket.IO oben. Wirkt nur, wenn CORS_ORIGINS gesetzt
  // ist — in Produktion liegen Oberflaeche und API auf derselben Domain.
  corsOrigins: process.env.CORS_ORIGINS ? ALLOWED_ORIGINS : null,
  transporter,
  smtpConfig: SMTP_CONFIG,
  io,
  rateLimiters: {
    general: generalLimiter,
    authLimiter,
    registerLimiter,
    docsLoginLimiter,
    chatMessageLimiter,
    chatClearLimiter,
    eventBookingLimiter,
    uploadLimiter,
    orgLimiter,
  },
});

// HTTP-Requests an die Express-App weiterleiten — ABER nur die, die
// Socket.IO nicht schon selbst beantwortet hat.
//
// Befund 27.08.2026, in Produktion gemessen: Hier stand
// `server.on('request', app)`. Das haengt Express als ZWEITEN Listener an
// dasselbe Event, an dem auch Engine.IO haengt — Node ruft dann BEIDE auf.
// Bei einem fehlerhaften Handshake (z.B. /socket.io/?transport=polling ohne
// EIO-Parameter) antwortet Engine.IO mit "Bad request" und schliesst die
// Antwort; unmittelbar danach laeuft Express ueber dieselbe, bereits
// abgeschlossene Antwort und wirft ERR_HTTP_HEADERS_SENT. Der Fehler
// entsteht im Event-Handler, nicht in einer Express-Middleware — keine
// error-Middleware faengt ihn, der Prozess stirbt.
//
// Gemessen: 20 Abstuerze in 45 Minuten normaler Nutzung, beide Replikas
// betroffen (RestartCount 9 bzw. 11). Eine einzige URL genuegte, um das
// Backend reproduzierbar umzuwerfen.
//
// Der Fix behaelt die Reihenfolge bei (Socket.IO zuerst, siehe oben) und
// prueft nur, ob die Antwort schon steht.
// Waehrend des Herunterfahrens (siehe gracefulShutdown) meldet der
// Gesundheitspfad 503, damit Traefik diese Replica aus dem Pool nimmt,
// BEVOR der Server keine Verbindungen mehr annimmt. Alle anderen Anfragen
// werden in dieser Zeit noch normal beantwortet. Zwei Felder wie im
// gesunden Fall (createApp.js), nur mit anderem Status.
let wirdBeendet = false;

server.on('request', (req, res) => {
  // Engine.IO hat bereits geantwortet (Handshake abgelehnt) -> nichts tun.
  if (res.headersSent || res.writableEnded) return;
  if (wirdBeendet && req.url === '/api/health') {
    res.writeHead(503, { 'Content-Type': 'application/json', Connection: 'close' });
    res.end(JSON.stringify({ status: 'STOPPING', message: 'Konfi Points API wird beendet' }));
    return;
  }
  app(req, res);
});

// ====================================================================
// CHAT SYSTEM INITIALIZATION
// ====================================================================
//
// Hier stand `setImmediate(() => initializeChatRooms(db))`. initializeChatRooms
// war aber eine Fabrik: sie LIEFERTE die eigentliche Initialisierung zurueck,
// statt sie auszufuehren. Der Aufruf erzeugte die innere Funktion und verwarf
// sie ungenutzt — seit dem 21.07.2025 lief beim Start also nichts.
//
// Der Aufruf ist ersatzlos entfallen, statt ihn scharf zu schalten: Die Anlage
// der Jahrgangs-Chats erledigt `syncJahrgangChat` (utils/jahrgangChat.js) —
// beim Anlegen eines Jahrgangs, beim Zuweisen von Konfis und Teamer:innen und
// beim Laden der Raeume (GET /chat/rooms). Diese Fassung ist idempotent, nimmt
// geloeschte und inaktive Konten aus, setzt Admins und Teamer:innen nach der
// Zuweisungsregel und traegt den anlegenden Nutzer als created_by ein.
//
// Die alte Fassung konnte das nicht: Sie fuegte Teilnehmer ohne
// ON CONFLICT ein, kannte weder deleted_at noch is_active, trug ausser Konfis
// niemanden ein und fiel fuer created_by auf die feste Nutzer-ID 1 zurueck —
// die je nach Organisation einem fremden Konto gehoert. Ein Scharfschalten
// haette diese Fehler nach 14 Monaten erstmals wirksam gemacht.

// ====================================================================
// BACKGROUND SERVICES INITIALIZATION
// ====================================================================

// Hintergrund-Jobs (Cron: Auto-Deletion, Reminder, APM-Snapshots, Token-Cleanup,
// Wrapped) duerfen bei MEHREREN Backend-Replicas (Zero-Downtime-Setup) nur EINMAL
// laufen, sonst gibt es Doppel-Pushes/-Loeschungen/-Snapshots. Nur die Replica mit
// RUN_BACKGROUND_JOBS!=='false' startet sie. Default = an (Single-Replica/lokal
// unverändert); im 2-Replica-Stack setzt nur backend2 RUN_BACKGROUND_JOBS=false.
const BackgroundService = require('./services/backgroundService');
if (process.env.RUN_BACKGROUND_JOBS !== 'false') {
  BackgroundService.startAllServices(db, { wrappedRouter: app.wrappedRouter });
  console.warn('Hintergrund-Jobs gestartet (diese Replica ist der Cron-Leader).');
} else {
  console.warn('Hintergrund-Jobs DEAKTIVIERT (RUN_BACKGROUND_JOBS=false) — andere Replica ist Cron-Leader.');
}

// ====================================================================
// SERVER STARTUP
// ====================================================================

// Firebase Status ermitteln
let firebaseStatus = 'Nicht konfiguriert';
try {
  const firebase = require('./push/firebase');
  const fbApp = firebase.initializeFirebase();
  if (fbApp) firebaseStatus = 'Verbunden';
} catch (e) {
  // Firebase nicht verfuegbar
}

const uploadsDir = require('path').join(__dirname, 'uploads');
const smtpStatus = smtpKonfiguriert ? 'Konfiguriert' : 'Nicht konfiguriert';

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  KONFI QUEST API - Server gestartet');
  console.log('========================================');
  console.log(`  Port:         ${PORT}`);
  console.log(`  Environment:  ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Database:     PostgreSQL (verbunden)`);
  console.log(`  WebSocket:    Bereit`);
  console.log(`  Uploads:      ${uploadsDir}`);
  console.log('----------------------------------------');
  console.log('  Services:');
  console.log(`  - SMTP:       ${smtpStatus}`);
  console.log(`  - Firebase:   ${firebaseStatus}`);
  console.log('  - Background: Gestartet');
  console.log('========================================');
});

// ====================================================================
// GRACEFUL SHUTDOWN
// ====================================================================

// exitCode: 0 bei einem regulaeren Signal, 1 nach einem Absturz. Sonst meldet
// der Container "sauber beendet", obwohl eine unbehandelte Exception ihn
// heruntergefahren hat — in der Neustart-Statistik nicht mehr unterscheidbar.
//
// REIHENFOLGE (Audit 26.09.2026, Betrieb BF-07). Bis dahin stand hier
// server.close() -> db.end() -> socketAdapterPool.end(), und JEDER Stopp
// endete nach exakt 10 s mit Exit 1: Der Socket.IO-Postgres-Adapter haelt
// fuer LISTEN dauerhaft einen Client aus socketAdapterPool ausgecheckt und
// gibt ihn nur ueber io.close() zurueck. pool.end() wartet auf die Rueckgabe
// aller Clients -- also ewig --, waehrend der 30-s-Aufraeumtimer des Adapters
// weiter DELETE auf den geschlossenen Pool absetzte ("Cannot use a pool
// after calling end on the pool"). Nach 10 s griff der Notausstieg mit
// Exit 1. Gemessen: Exit 1 nach 10 014 ms, bei jedem Deploy, je Replica.
//
// Jetzt: (1) Gesundheitspfad auf 503 und optional SHUTDOWN_DRAIN_MS warten,
// damit Traefik (Pruefintervall 5 s) die Replica aus dem Pool nimmt, solange
// sie noch antwortet; (2) Hintergrund-Jobs anhalten; (3) io.close() -- trennt
// die Sockets, schliesst den Adapter (LISTEN-Client zurueck, Timer aus) und
// den HTTP-Server; leerlaufende Keep-Alive-Verbindungen werden sofort
// geschlossen, laufende Anfragen bekommen SHUTDOWN_REQUEST_GRACE_MS;
// (4) erst dann die Pools. Der Notausstieg bleibt als letztes Netz.
const SHUTDOWN_DRAIN_MS = parseInt(process.env.SHUTDOWN_DRAIN_MS || '0', 10);
const SHUTDOWN_REQUEST_GRACE_MS = parseInt(process.env.SHUTDOWN_REQUEST_GRACE_MS || '5000', 10);
const SHUTDOWN_TIMEOUT_MS = 10000;
const schlafen = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let shutdownLaeuft = false;
const gracefulShutdown = async (signal, exitCode = 0) => {
  if (shutdownLaeuft) return; // zweites Signal waehrend des Herunterfahrens
  shutdownLaeuft = true;
  const begonnen = Date.now();
  console.warn(`${signal} empfangen - Graceful Shutdown...`);

  const notausstieg = setTimeout(() => {
    console.error('Shutdown-Timeout erreicht - erzwinge Beendigung');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  notausstieg.unref();

  // (1) Aus dem Traefik-Pool nehmen lassen, solange noch geantwortet wird.
  wirdBeendet = true;
  if (SHUTDOWN_DRAIN_MS > 0) {
    await schlafen(SHUTDOWN_DRAIN_MS);
  }

  // (2) Keine neuen Job-Laeufe mehr anstossen.
  try {
    BackgroundService.stopAllServices();
  } catch (err) {
    console.error('Fehler beim Anhalten der Hintergrund-Jobs:', err.message);
  }

  // (3) Sockets, Adapter, HTTP-Server.
  try {
    const ioZu = io.close();
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
    const abbruch = setTimeout(() => {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    }, SHUTDOWN_REQUEST_GRACE_MS);
    abbruch.unref();
    await ioZu;
    clearTimeout(abbruch);
    console.warn('HTTP-Server und Socket.IO geschlossen.');
  } catch (err) {
    console.error('Fehler beim Schliessen von HTTP-Server/Socket.IO:', err.message);
  }

  // (4) Pools -- jetzt haelt niemand mehr einen Client.
  try {
    await db.end();
    console.warn('Datenbankverbindung geschlossen.');
  } catch (err) {
    console.error('Fehler beim Schliessen der Datenbankverbindung:', err.message);
  }
  try {
    await socketAdapterPool.end();
    console.warn('Socket.IO-Adapter-Pool geschlossen.');
  } catch (err) {
    console.error('Fehler beim Schliessen des Adapter-Pools:', err.message);
  }

  console.warn(`Shutdown abgeschlossen nach ${Date.now() - begonnen} ms (Exit ${exitCode}).`);
  process.exit(exitCode);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ====================================================================
// LETZTES NETZ: UNBEHANDELTE FEHLER
// ====================================================================

// Eine unbehandelte Promise-Ablehnung beendet den Prozess (Node-Standard seit 15).
// Genau das ist hier falsch: Ein einzelner fehlgeschlagener Hintergrund-Job (etwa
// ein Erstlauf, dessen Tabelle beim Boot noch nicht migriert ist) wuerde mit
// `restart: unless-stopped` eine Neustartschleife ausloesen. Und weil nur die
// Cron-Leader-Replica die Hintergrund-Jobs startet, antwortet die zweite Replica
// dabei weiter — der Ausfall bliebe von aussen unsichtbar, waehrend Erinnerungen,
// Token-Cleanup, Auto-Loeschung und APM stillstehen.
// Deshalb: NUR LOGGEN, nicht beenden. Der Prozesszustand ist nach einer
// abgelehnten Promise unveraendert; der Aufrufer gehoert repariert, nicht der
// Server neu gestartet.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unbehandelte Promise-Ablehnung (Prozess laeuft weiter):', reason, promise);
});

// Bei einer unbehandelten Exception ist der Prozesszustand dagegen unklar
// (halb ausgefuehrte Handler, offene Transaktionen). Hier ist der geordnete
// Shutdown richtig — der Orchestrator startet danach sauber neu.
process.on('uncaughtException', (err) => {
  console.error('Unbehandelte Exception - geordneter Shutdown:', err);
  gracefulShutdown('uncaughtException', 1);
});
