// apm.js — Leichtgewichtiges Application Performance Monitoring (in-memory).
//
// Sammelt pro Route-Schlüssel (Methode + normalisierter Pfad) Anzahl, Fehlerrate
// und Antwortzeiten. Bewusst ohne externe Abhaengigkeit/DB: ein rollierendes
// Fenster der letzten N Dauer-Werte pro Route für eine p95-Naeherung. Reicht, um
// im Livebetrieb langsame/fehlerhafte Endpunkte zu erkennen, ohne Overhead.
//
// Zusaetzlich: Gauge für parallele (in-flight) Requests, ein rollierendes Log der
// letzten Fehler und ein 1-Sekunden-Bucket-Verlauf (Requests/Fehler pro Sekunde)
// für die letzten ~30 Minuten. Persistenz (Verlauf über Deploys hinweg) macht
// der BackgroundService via snapshot() -> apm_snapshots-Tabelle.

const SLOW_MS = 1000;          // Schwelle fuer "langsamer Request" (Log-Warnung)
const MAX_SAMPLES = 200;       // rollierende Dauer-Stichproben pro Route (p95)
const MAX_ERRORS = 50;         // rollierendes Fenster letzter Fehler
const HISTORY_SECONDS = 1800;  // Sekunden-Buckets (30 min) fuer Live-Verlauf

/*
 * Apdex — "wie viele Anfragen waren schnell genug".
 *
 * Statt einer nackten Millisekunden-Zahl teilt Apdex jede Anfrage in drei
 * Toepfe und macht daraus EINE Zahl zwischen 0 und 1:
 *   zufrieden   <= T          (voll gezaehlt)
 *   toleriert   <= 4 * T      (halb gezaehlt)
 *   frustriert   > 4 * T      (nicht gezaehlt)
 * Apdex = (zufrieden + toleriert/2) / alle.
 *
 * T = 500 ms. Damit deckt sich die Einteilung mit der Ampel im Dashboard
 * (gruen < 500 ms, kritisch ab 1000 ms) und mit 4*T = 2000 ms liegt die
 * Frust-Grenze dort, wo eine Anfrage sich wirklich nach Hakeln anfuehlt.
 *
 * Gemessen wird die SERVERZEIT, nicht die Gesamtzeit — aus demselben Grund
 * wie bei worstP95Ms in persistSummary(): Ein Foto-Upload ueber Mobilfunk
 * wuerde sonst den Wert bestimmen, obwohl am Server nichts langsam ist.
 * Wie es sich fuer Konfis ANFUEHLT, steht daneben in ueber1sCount
 * (Gesamtzeit inkl. Leitung).
 *
 * 5xx zaehlen immer als frustriert, egal wie schnell sie kamen — eine
 * schnelle Fehlermeldung ist kein zufriedener Nutzer.
 */
const APDEX_T_MS = 500;
const APDEX_TOLERIERT_MS = APDEX_T_MS * 4;

// Fenster fuer die Nutzer:innen-Zaehlung (Minuten-Buckets).
const NUTZER_FENSTER_MINUTEN = 60;

// Map<routeKey, { count, errors, totalMs, maxMs, samples: number[] }>
const stats = new Map();
const startedAt = Date.now();

// In-flight (parallele) Requests jetzt + beobachtetes Maximum.
let inFlight = 0;
let maxInFlight = 0;

// Rollierendes Fehler-Log (neueste zuletzt).
const recentErrors = [];

/*
 * Fehler-Gruppen: Map<"route status", {...}>.
 *
 * Das rollierende Log oben haelt nur die letzten 50 Eintraege. Bei einer
 * Route, die im Minutentakt 500 wirft, ist es nach einer halben Stunde voll
 * mit demselben Fehler, und "seit wann geht das so" ist nicht mehr zu sehen.
 * Die Gruppen zaehlen dagegen ueber die gesamte Laufzeit und merken sich
 * das erste und das letzte Auftreten. Die Zahl der Gruppen ist durch die
 * Zahl der Routen begrenzt, nicht durch die Zahl der Fehler.
 */
const fehlerGruppen = new Map();

// Sekunden-Buckets für den Live-Verlauf: Map<epochSec, { requests, errors, sumMs }>
const buckets = new Map();

// Verteilung der Antwort-Klassen ueber die gesamte Laufzeit. Beantwortet die
// Frage "was kommt eigentlich zurueck" ohne dass man Routen durchzaehlen muss.
// 404 steht bewusst getrennt: Es ist keine Stoerung des Dienstes (siehe unten),
// aber ein Haufen davon heisst, dass eine App auf etwas zeigt, das es nicht
// mehr gibt.
const statusKlassen = { erfolg: 0, ausDemCache: 0, umleitung: 0, nichtGefunden: 0, abgelehnt: 0, serverfehler: 0 };

// Apdex-Zaehler ueber die gesamte Laufzeit (Serverzeit, siehe Konstanten oben).
const apdex = { zufrieden: 0, toleriert: 0, frustriert: 0 };

// Anfragen, deren GESAMTZEIT (inkl. Leitung) ueber SLOW_MS lag — das ist das,
// was auf dem Geraet als Warten ankommt.
let ueber1sCount = 0;

/*
 * Nutzer:innen im Zeitfenster.
 *
 * apmMiddleware laeuft vor der Anmeldepruefung, req.user ist aber zum
 * Zeitpunkt von res.on('finish') gesetzt (verifyTokenRBAC lief da schon).
 * Gespeichert wird NICHT die Konto-ID, sondern ein gekuerzter Hash davon:
 * Fuer "wie viele verschiedene Menschen" reicht das, und in der Antwort des
 * Metrik-Endpunkts steht dann keine Kontonummer. Der Hash wird je ID einmal
 * berechnet und gemerkt.
 *
 * Die Schluessel stehen im Snapshot, damit mergeSnapshots() bei mehreren
 * Replicas die VEREINIGUNG bilden kann: Wer auf beiden Replicas landete,
 * wuerde sonst doppelt gezaehlt.
 */
const nutzerProMinute = new Map();    // Map<epochMinute, Set<hash>>
const betroffenProMinute = new Map(); // Map<epochMinute, Set<hash>> — langsam oder 5xx
const hashCache = new Map();          // Map<userId, hash>

function nutzerSchluessel(userId) {
  const k = String(userId);
  let h = hashCache.get(k);
  if (!h) {
    h = require('crypto').createHash('sha256').update(k).digest('hex').slice(0, 10);
    // Der Cache waechst mit der Zahl der Konten, nicht mit den Anfragen.
    if (hashCache.size < 10000) hashCache.set(k, h);
  }
  return h;
}

function trimNutzer(nowMin) {
  const cutoff = nowMin - NUTZER_FENSTER_MINUTEN * 60;
  for (const m of nutzerProMinute.keys()) if (m < cutoff) nutzerProMinute.delete(m);
  for (const m of betroffenProMinute.keys()) if (m < cutoff) betroffenProMinute.delete(m);
}

function nutzerFenster() {
  const nowMin = Math.floor(Date.now() / 60000) * 60;
  trimNutzer(nowMin);
  const aktiv = new Set();
  const betroffen = new Set();
  for (const s of nutzerProMinute.values()) for (const h of s) aktiv.add(h);
  for (const s of betroffenProMinute.values()) for (const h of s) betroffen.add(h);
  return {
    fensterMinuten: NUTZER_FENSTER_MINUTEN,
    aktiv: aktiv.size,
    betroffen: betroffen.size,
    schluessel: [...aktiv],
    betroffeneSchluessel: [...betroffen],
  };
}

// Normalisiert den Pfad, damit IDs nicht zu tausenden Einzel-Routen explodieren:
// /api/admin/konfis/42 -> /api/admin/konfis/:id
function normalizePath(path) {
  return path
    .split('?')[0]
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:uuid');
}

function trimBuckets(nowSec) {
  const cutoff = nowSec - HISTORY_SECONDS;
  for (const sec of buckets.keys()) {
    if (sec < cutoff) buckets.delete(sec);
  }
}

function record(method, normPath, statusCode, durationMs, rawUrl, serverMs, userId) {
  const key = `${method} ${normPath}`;
  let s = stats.get(key);
  if (!s) {
    s = { count: 0, errors: 0, totalMs: 0, maxMs: 0, samples: [], notModified: 0,
          serverTotalMs: 0, serverMaxMs: 0, serverSamples: [],
          langsam: 0, zufrieden: 0, toleriert: 0, frustriert: 0 };
    stats.set(key, s);
  }
  // Aeltere Eintraege aus einem laufenden Prozess kennen die Server-Felder
  // noch nicht — nachruesten statt NaN zu summieren.
  if (s.serverSamples === undefined) {
    s.serverTotalMs = 0; s.serverMaxMs = 0; s.serverSamples = [];
  }
  if (s.langsam === undefined) {
    s.langsam = 0; s.zufrieden = 0; s.toleriert = 0; s.frustriert = 0;
  }
  const srvMs = typeof serverMs === 'number' ? serverMs : durationMs;
  s.count += 1;
  s.totalMs += durationMs;
  if (durationMs > s.maxMs) s.maxMs = durationMs;
  s.serverTotalMs += srvMs;
  if (srvMs > s.serverMaxMs) s.serverMaxMs = srvMs;
  s.serverSamples.push(srvMs);
  if (s.serverSamples.length > MAX_SAMPLES) s.serverSamples.shift();
  // 304 = der Client hatte die Daten schon, es ging nur die Rueckfrage ueber
  // die Leitung. Ein hoher Anteil ist GUT: Er bedeutet wenig uebertragene
  // Bytes. Gemessen am 31.08.2026 lagen 79 % der Startanfragen bei 304.
  if (statusCode === 304) s.notModified += 1;
  const isError = statusCode >= 500;
  if (isError) s.errors += 1;
  s.samples.push(durationMs);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();

  // Antwort-Klasse zaehlen (genau ein Topf je Anfrage).
  if (isError) statusKlassen.serverfehler += 1;
  else if (statusCode === 404) statusKlassen.nichtGefunden += 1;
  else if (statusCode >= 400) statusKlassen.abgelehnt += 1;
  else if (statusCode === 304) statusKlassen.ausDemCache += 1;
  else if (statusCode >= 300) statusKlassen.umleitung += 1;
  else statusKlassen.erfolg += 1;

  // Apdex auf der SERVERZEIT; 5xx immer frustriert (s. Kommentar oben).
  const topf = isError ? 'frustriert'
    : srvMs <= APDEX_T_MS ? 'zufrieden'
      : srvMs <= APDEX_TOLERIERT_MS ? 'toleriert'
        : 'frustriert';
  apdex[topf] += 1;
  s[topf] += 1;

  // Gefuehlte Wartezeit: Gesamtzeit inkl. Leitung ueber der Schwelle.
  const istLangsam = durationMs > SLOW_MS;
  if (istLangsam) { ueber1sCount += 1; s.langsam += 1; }

  // Nutzer:innen im Fenster. Anonyme Anfragen (Anmeldung, oeffentliche
  // Routen) haben keine ID und zaehlen deshalb nicht mit — die Zahl meint
  // "angemeldete Menschen", nicht "Geraete".
  if (userId !== undefined && userId !== null) {
    const minute = Math.floor(Date.now() / 60000) * 60;
    const h = nutzerSchluessel(userId);
    let n = nutzerProMinute.get(minute);
    if (!n) { n = new Set(); nutzerProMinute.set(minute, n); }
    n.add(h);
    if (istLangsam || isError) {
      let b = betroffenProMinute.get(minute);
      if (!b) { b = new Set(); betroffenProMinute.set(minute, b); }
      b.add(h);
    }
    if (nutzerProMinute.size > NUTZER_FENSTER_MINUTEN + 5) trimNutzer(minute);
  }

  // Sekunden-Bucket für den Verlauf
  const nowSec = Math.floor(Date.now() / 1000);
  let b = buckets.get(nowSec);
  if (!b) { b = { requests: 0, errors: 0, sumMs: 0 }; buckets.set(nowSec, b); }
  b.requests += 1;
  b.sumMs += durationMs;
  // 404 zaehlt NICHT als Fehler: Der Client hat etwas angefragt, das es
  // nicht gibt — das ist keine Stoerung des Dienstes und darf die Fehlerrate
  // nicht heben. Sichtbar bleibt es trotzdem im Fehler-Log unten.
  if (statusCode >= 400 && statusCode !== 404) b.errors += 1;
  if (buckets.size > HISTORY_SECONDS + 60) trimBuckets(nowSec);

  // Fehler (4xx + 5xx) ins rollierende Fehler-Log
  if (statusCode >= 400) {
    recentErrors.push({
      route: key,
      url: rawUrl,
      status: statusCode,
      durationMs: Math.round(durationMs),
      at: new Date().toISOString(),
    });
    if (recentErrors.length > MAX_ERRORS) recentErrors.shift();

    const gKey = `${key} ${statusCode}`;
    const jetzt = new Date().toISOString();
    let g = fehlerGruppen.get(gKey);
    if (!g) {
      g = { route: key, status: statusCode, anzahl: 0, seit: jetzt, zuletzt: jetzt, beispielUrl: rawUrl };
      fehlerGruppen.set(gKey, g);
    }
    g.anzahl += 1;
    g.zuletzt = jetzt;
    g.beispielUrl = rawUrl;
  }
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

// Infrastruktur-Endpoints, die NICHT in die Nutzungsstatistik gehören:
// - /api/health: Docker- + Traefik-Loadbalancer-Healthchecks (bei 2 Replicas ~30/min,
//   sinnvoll fuers Zero-Downtime-Routing, aber keine echten Nutzeranfragen).
// - /api/status: Uptime-Kuma/Readiness-Polling.
// - /api/metrics*: das Dashboard selbst (Auto-Refresh alle 5s) wuerde sich sonst
//   in die eigene Statistik schreiben.
const IGNORED_PATHS = /^\/api\/(health|status|metrics)\b/;

// Anfragen, die es in dieser App NIE gab: Scanner klopfen an jeder
// oeffentlichen Domain nach Zugangsdaten, Quellcode und fremden
// Banking-Skripten (.env, .git, twint_ch.js, antibot-client.js ...).
// Sie finden nichts — hinter der API liegt kein Dateisystem —, fuellten
// aber die Fehlerliste im Performance-Dashboard und verdeckten damit die
// echten Fehler (Simons Screenshot 31.08.2026: 12 von 12 Eintraegen waren
// Bot-Anfragen).
//
// Bewusst nach dem MUSTER und nicht nach Statuscode: Ein 404 auf einer
// ECHTEN Route (Termin geloescht, alter Push-Link) ist ein Befund und soll
// sichtbar bleiben.
const SCANNER_PATHS = /(^\/\.|\/\.(env|git|vscode|aws|ssh)|^\/(js|assets|static|functions|cgi-bin|wp-|vendor|phpmyadmin)\/|\.(php|asp|aspx|jsp)$|^\/(robots\.txt|favicon\.ico|sitemap\.xml|bot-connect\.js)$|^\/@vite)/i;

// Express-Middleware: misst jede Request-Dauer, zählt parallele Requests,
// loggt langsame Requests. Infrastruktur-Pings (s.o.) werden übersprungen.
function apmMiddleware(req, res, next) {
  const pfad = (req.originalUrl || req.url || '').split('?')[0];
  if (IGNORED_PATHS.test(pfad) || SCANNER_PATHS.test(pfad)) {
    return next();
  }
  const start = process.hrtime.bigint();
  inFlight += 1;
  if (inFlight > maxInFlight) maxInFlight = inFlight;
  let done = false;

  /*
   * Serverzeit vs. Leitungszeit.
   *
   * Die Uhr oben laeuft ab Middleware-Eintritt — also BEVOR der Body
   * empfangen ist. Bei einem Foto-Upload ueber Mobilfunk steckt darin
   * minutenlanges Warten auf das Geraet. Gemessen am 21.09.2026 stand in
   * worst_p95_ms 56 315 ms fuer POST /api/konfi/upload-photo, waehrend
   * dieselbe Route mit kleinem Bild in 133-208 ms antwortete.
   *
   * Nachgestellt mit echter Leitungsverzoegerung (400 kB in 8 Haeppchen,
   * je 150 ms Pause): Gesamt 1269 ms, davon 1221 ms Warten auf die Leitung
   * und 26 ms Serverarbeit. Die alte Zahl ist also zu 96 % Netz.
   *
   * Ein frueherer Anlauf (31.08.2026) wurde wieder entfernt, weil er von
   * Middleware-Eintritt bis res.end mass und damit dasselbe Warten enthielt;
   * seine Tests liefen im Loopback, wo es kein Warten gibt, und waren
   * deshalb gruen. Hier wird stattdessen der Moment festgehalten, in dem der
   * Body VOLLSTAENDIG gelesen ist ('end' auf dem Request-Stream) — ab da
   * arbeitet wirklich der Server.
   */
  let bodyFertig = null;
  if (req.readable) {
    req.once('end', () => { bodyFertig = process.hrtime.bigint(); });
  }

  // res.end() laeuft, wenn der Handler die Antwort fertig geschrieben hat —
  // VOR der Auslieferung. Der Abstand zu res.on('finish') ist die Zeit auf
  // der Leitung. Ohne diese Trennung schreibt das APM Wartezeit des Geraets
  // der Route zu und laesst sie langsam aussehen (Befund 31.08.2026: 16 von
  // 26 Anfragen ueber 1 s waren 304 mit LEEREM Body).
  const finish = () => {
    if (done) return;
    done = true;
    inFlight -= 1;
    const ende = process.hrtime.bigint();
    const durationMs = Number(ende - start) / 1e6;
    // Ab vollstaendig gelesenem Body bis zur fertigen Antwort: das ist die
    // Zeit, auf die der Server Einfluss hat. Ohne 'end' (z. B. GET ohne Body,
    // vom Parser schon geschluckt) ist beides gleich.
    const serverMs = bodyFertig ? Number(ende - bodyFertig) / 1e6 : durationMs;
    const rawUrl = req.originalUrl || req.url;
    // req.user setzt verifyTokenRBAC; zum Zeitpunkt von 'finish' ist es da,
    // falls die Route ueberhaupt angemeldet ist.
    record(req.method, normalizePath(rawUrl), res.statusCode, durationMs, rawUrl, serverMs, req.user?.id);
    if (durationMs > SLOW_MS) {
      console.warn(`[APM] LANGSAM ${Math.round(durationMs)}ms ${req.method} ${rawUrl} -> ${res.statusCode}`);
    }
  };
  res.on('finish', finish);
  res.on('close', finish);
  next();
}

// Route-Aggregate (sortierbar). limit=0 -> alle.
function routeRows() {
  const routes = [];
  for (const [route, s] of stats.entries()) {
    const sorted = [...s.samples].sort((a, b) => a - b);
    const avgMs = s.count ? Math.round(s.totalMs / s.count) : 0;
    // Serverzeit: ohne Warten auf die Leitung. Das ist der Wert, an dem sich
    // eine Aenderung am Code ablesen laesst.
    const srvSorted = [...(s.serverSamples || [])].sort((a, b) => a - b);
    const serverAvgMs = s.count ? Math.round((s.serverTotalMs || 0) / s.count) : 0;
    const serverP95Ms = srvSorted.length ? Math.round(percentile(srvSorted, 95)) : 0;
    routes.push({
      route,
      count: s.count,
      errors: s.errors,
      errorRate: s.count ? +(s.errors / s.count).toFixed(4) : 0,
      avgMs,
      p95Ms: Math.round(percentile(sorted, 95)),
      maxMs: Math.round(s.maxMs),
      serverAvgMs,
      serverP95Ms,
      serverMaxMs: Math.round(s.serverMaxMs || 0),
      // Wie viel der Gesamtzeit ging auf die Leitung? Hoch = das Geraet war
      // langsam, nicht der Server.
      netzAvgMs: Math.max(0, avgMs - serverAvgMs),
      // Cache-Quote: Anteil der Anfragen, die mit 304 beantwortet wurden.
      notModified: s.notModified || 0,
      cacheQuote: s.count ? Math.round(((s.notModified || 0) / s.count) * 100) : 0,
      // Median: die TYPISCHE Anfrage. Das p95 zeigt den schlechten Rand, der
      // Median zeigt den Normalfall — erst beide zusammen sagen, ob eine
      // Route grundsaetzlich langsam ist oder nur gelegentlich ausreisst.
      p50Ms: Math.round(percentile(sorted, 50)),
      serverP50Ms: srvSorted.length ? Math.round(percentile(srvSorted, 50)) : 0,
      // Auf wie vielen Stichproben beruhen p50 und p95? (22.09.2026)
      //
      // Bei wenigen Aufrufen IST der p95 der langsamste Einzelwert. Gemessen
      // an Produktion: bei 10 von 12 Routen war p95 exakt gleich max, bei
      // Stichproben von 1 bis 38. Die Zahl 1179 ms fuer badges/v2 kam von
      // EINEM Aufruf unter 33 — das Fenster wird nur nach Laenge getrimmt,
      // nie nach Alter, der Ausreisser bleibt also stehen. Ohne diese Zahl
      // liest sich so ein p95 wie eine Eigenschaft der Route.
      stichproben: srvSorted.length,
      // Anfragen ueber 1 s (Gesamtzeit) — das, was auf dem Geraet als Warten
      // ankommt.
      langsam: s.langsam || 0,
      langsamQuote: s.count ? Math.round(((s.langsam || 0) / s.count) * 100) : 0,
      // Gesamte Serverzeit dieser Route: Anzahl x Durchschnitt. DIE Zahl fuer
      // "wo lohnt sich Arbeit": Eine Route mit 400 ms und 5 Aufrufen kostet
      // 2 Sekunden, eine mit 60 ms und 3000 Aufrufen kostet 3 Minuten. Nach
      // p95 sortiert stuende die erste oben — geholfen ist damit niemandem.
      serverZeitGesamtMs: Math.round(s.serverTotalMs || 0),
      apdex: apdexWert(s.zufrieden || 0, s.toleriert || 0, s.frustriert || 0),
    });
  }
  return routes;
}

// Apdex-Formel: (zufrieden + toleriert/2) / alle. Ohne Anfragen gibt es
// keinen Wert — dann null statt 0, sonst sieht eine ungenutzte Route aus wie
// eine kaputte.
function apdexWert(zufrieden, toleriert, frustriert) {
  const alle = zufrieden + toleriert + frustriert;
  if (!alle) return null;
  return +((zufrieden + toleriert / 2) / alle).toFixed(3);
}

// Verlauf: pro Minute aggregierte Buckets der letzten `minutes` Minuten.
function timeline(minutes = 30) {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - minutes * 60;
  const perMinute = new Map(); // Map<epochMinute, {requests,errors,sumMs}>
  for (const [sec, b] of buckets.entries()) {
    if (sec < fromSec) continue;
    const min = Math.floor(sec / 60) * 60;
    let m = perMinute.get(min);
    if (!m) { m = { requests: 0, errors: 0, sumMs: 0 }; perMinute.set(min, m); }
    m.requests += b.requests;
    m.errors += b.errors;
    m.sumMs += b.sumMs;
  }
  return [...perMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([min, m]) => ({
      t: new Date(min * 1000).toISOString(),
      requests: m.requests,
      errors: m.errors,
      avgMs: m.requests ? Math.round(m.sumMs / m.requests) : 0,
    }));
}

// Requests pro Sekunde (Durchschnitt) über das letzte `windowSec`-Fenster.
function currentRps(windowSec = 10) {
  const nowSec = Math.floor(Date.now() / 1000);
  let sum = 0;
  for (let s = nowSec - windowSec; s <= nowSec; s++) {
    const b = buckets.get(s);
    if (b) sum += b.requests;
  }
  return +(sum / windowSec).toFixed(2);
}

// Kennung dieser Replica (Container-Hostname) — zur Lastverteilungs-Anzeige bei
// mehreren Backend-Replicas. HOSTNAME setzt Docker pro Container.
const REPLICA_ID = process.env.HOSTNAME || 'single';

// Vollstaendiges Aggregat DIESER Replica (in-memory). Bei mehreren Replicas mergen
// mergeSnapshots() die Einzel-Snapshots zu einem Gesamtbild.
function snapshot() {
  /*
   * Sortiert wird nach SERVERzeit (22.09.2026).
   *
   * Bis dahin stand hier b.p95Ms — die Gesamtzeit inklusive Warten auf die
   * Leitung. Weil die Liste danach auf 20 Routen abgeschnitten wird,
   * entschied damit die Mobilfunkverbindung des Geraets, welche Routen
   * ueberhaupt in der Ansicht auftauchen: Eine Route mit dicker Antwort auf
   * langsamer Leitung verdraengte eine, die wirklich den Server beschaeftigt.
   *
   * Gemessen an Produktion: GET /api/events/:id stand dadurch an 9,5 % aller
   * Messpunkte (373 von 3907, 14 Tage) als "langsamste Route" — bei einem
   * Median von 17 ms Serverzeit. Die Umstellung vom 21.09.2026 hatte
   * persistSummary() erreicht, diese Sortierung aber nicht.
   *
   * Die Gesamtzeit bleibt je Route in p95Ms erhalten, fuer die Frage "wie
   * schnell fuehlt es sich auf dem Geraet an".
   */
  const routes = routeRows().sort((a, b) => b.serverP95Ms - a.serverP95Ms);
  let totalCount = 0;
  let totalErrors = 0;
  let totalNotModified = 0;
  for (const r of routes) { totalCount += r.count; totalErrors += r.errors; totalNotModified += r.notModified || 0; }
  return {
    replica: REPLICA_ID,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    totalRequests: totalCount,
    totalErrors,
    errorRate: totalCount ? +(totalErrors / totalCount).toFixed(4) : 0,
    // Wie oft der Client die Daten schon hatte (304). Hoch ist gut: Dann
    // ging nur die Rueckfrage ueber die Leitung, keine Nutzdaten.
    totalNotModified,
    cacheQuote: totalCount ? Math.round((totalNotModified / totalCount) * 100) : 0,
    inFlight,
    maxInFlight,
    rps: currentRps(),
    routesSlowest: routes.slice(0, 20),
    routesBusiest: [...routes].sort((a, b) => b.count - a.count).slice(0, 20),
    recentErrors: [...recentErrors].reverse(),
    timeline: timeline(30),

    // --- ab hier zusaetzliche Kennzahlen (22.09.2026). Alles oben bleibt
    // unveraendert: Aeltere App-Versionen lesen dieselbe Antwort. ---

    // Eine Zahl fuer "waren die Anfragen schnell genug" (Serverzeit).
    apdex: {
      wert: apdexWert(apdex.zufrieden, apdex.toleriert, apdex.frustriert),
      zufrieden: apdex.zufrieden,
      toleriert: apdex.toleriert,
      frustriert: apdex.frustriert,
      schwelleMs: APDEX_T_MS,
      toleriertBisMs: APDEX_TOLERIERT_MS,
    },
    // Gefuehlte Wartezeit: Gesamtzeit inkl. Leitung ueber 1 s.
    ueber1s: {
      anzahl: ueber1sCount,
      quote: totalCount ? +((ueber1sCount / totalCount) * 100).toFixed(1) : 0,
      schwelleMs: SLOW_MS,
    },
    statusKlassen: { ...statusKlassen },
    nutzer: nutzerFenster(),
    // Wo lohnt sich Arbeit: Routen nach GESAMTER Serverzeit, nicht nach p95.
    routesPotenzial: [...routes].sort((a, b) => b.serverZeitGesamtMs - a.serverZeitGesamtMs).slice(0, 20),
    fehlerGruppen: [...fehlerGruppen.values()].sort((a, b) => b.anzahl - a.anzahl).slice(0, 20),
  };
}

// Mergt mehrere Replica-Snapshots zu EINEM Gesamtbild + Lastverteilung pro Replica.
// Counts/Errors/inFlight werden summiert, p95/avg/max pro Route über die Replicas
// zusammengefasst (max p95, gewichteter avg), Timelines pro Minute addiert.
function mergeSnapshots(snaps) {
  const valid = snaps.filter(Boolean);
  if (valid.length === 0) return null;
  if (valid.length === 1) {
    return { ...valid[0], replicas: [{ replica: valid[0].replica, requests: valid[0].totalRequests, inFlight: valid[0].inFlight, share: 1 }] };
  }

  // Routen über Replicas zusammenfassen (Key = route).
  const routeMap = new Map();
  const addRoutes = (rows) => {
    for (const r of rows) {
      const e = routeMap.get(r.route) || { route: r.route, count: 0, errors: 0, sumAvg: 0, p95Ms: 0, maxMs: 0, notModified: 0,
                                           sumServerAvg: 0, serverP95Ms: 0, serverMaxMs: 0,
                                           p50Ms: 0, serverP50Ms: 0, langsam: 0, serverZeitGesamtMs: 0,
                                           stichproben: 0, apdexGewicht: 0, apdexSumme: 0 };
      e.count += r.count;
      e.errors += r.errors;
      e.sumAvg += r.avgMs * r.count;      // gewichteter Mittelwert ueber count
      e.p95Ms = Math.max(e.p95Ms, r.p95Ms);
      e.maxMs = Math.max(e.maxMs, r.maxMs);
      e.notModified += r.notModified || 0;
      // Median ueber Replicas: Der echte Median laesst sich aus zwei
      // Teilmedianen nicht herstellen, ohne die Stichproben selbst zu haben.
      // Genommen wird der groessere — lieber vorsichtig zu langsam schaetzen
      // als eine Route zu gut aussehen lassen.
      e.p50Ms = Math.max(e.p50Ms, r.p50Ms || 0);
      e.serverP50Ms = Math.max(e.serverP50Ms, r.serverP50Ms || 0);
      e.langsam += r.langsam || 0;
      // Stichproben addieren sich ueber Replicas sauber: Jede Replica hat
      // ihre eigenen Messwerte, zusammen sind es entsprechend mehr.
      e.stichproben += r.stichproben || 0;
      // Serverzeit ist eine Summe und addiert sich ueber Replicas sauber.
      e.serverZeitGesamtMs += r.serverZeitGesamtMs || 0;
      if (typeof r.apdex === 'number') { e.apdexSumme += r.apdex * r.count; e.apdexGewicht += r.count; }
      // Serverzeit ueber beide Replicas mitfuehren, sonst faellt sie beim
      // Zusammenfassen weg und die Uebersicht zeigt wieder nur Gesamtzeiten.
      e.sumServerAvg += (r.serverAvgMs || 0) * r.count;
      e.serverP95Ms = Math.max(e.serverP95Ms, r.serverP95Ms || 0);
      e.serverMaxMs = Math.max(e.serverMaxMs, r.serverMaxMs || 0);
      routeMap.set(r.route, e);
    }
  };
  // addRoutes summiert je Route — dieselbe Route darf deshalb nur EINMAL je
  // Replica hineingehen, auch wenn sie in mehreren Listen steht.
  valid.forEach(s => {
    const gesehen = new Set();
    for (const r of [...(s.routesSlowest || []), ...(s.routesBusiest || []), ...(s.routesPotenzial || [])]) {
      if (gesehen.has(r.route)) continue;
      gesehen.add(r.route);
      addRoutes([r]);
    }
  });
  const routes = [...routeMap.values()].map(e => {
    const avgMs = e.count ? Math.round(e.sumAvg / e.count) : 0;
    return {
      route: e.route,
      count: e.count,
      errors: e.errors,
      errorRate: e.count ? +(e.errors / e.count).toFixed(4) : 0,
      avgMs,
      p95Ms: e.p95Ms,
      maxMs: e.maxMs,
      serverAvgMs: e.count ? Math.round(e.sumServerAvg / e.count) : 0,
      serverP95Ms: e.serverP95Ms,
      serverMaxMs: e.serverMaxMs,
      netzAvgMs: Math.max(0, avgMs - (e.count ? Math.round(e.sumServerAvg / e.count) : 0)),
      notModified: e.notModified,
      cacheQuote: e.count ? Math.round((e.notModified / e.count) * 100) : 0,
      p50Ms: e.p50Ms,
      serverP50Ms: e.serverP50Ms,
      langsam: e.langsam,
      langsamQuote: e.count ? Math.round((e.langsam / e.count) * 100) : 0,
      serverZeitGesamtMs: e.serverZeitGesamtMs,
      stichproben: e.stichproben,
      apdex: e.apdexGewicht ? +(e.apdexSumme / e.apdexGewicht).toFixed(3) : null,
    };
  });

  // Timeline pro Minute (ISO-Zeit) addieren.
  const tlMap = new Map();
  valid.forEach(s => (s.timeline || []).forEach(p => {
    const e = tlMap.get(p.t) || { t: p.t, requests: 0, errors: 0, sumAvg: 0 };
    e.requests += p.requests;
    e.errors += p.errors;
    e.sumAvg += p.avgMs * p.requests;
    tlMap.set(p.t, e);
  }));
  const timelineMerged = [...tlMap.values()]
    .sort((a, b) => new Date(a.t) - new Date(b.t))
    .map(e => ({ t: e.t, requests: e.requests, errors: e.errors, avgMs: e.requests ? Math.round(e.sumAvg / e.requests) : 0 }));

  const totalRequests = valid.reduce((s, x) => s + x.totalRequests, 0);
  const totalErrors = valid.reduce((s, x) => s + x.totalErrors, 0);
  const totalNotModified = valid.reduce((s, x) => s + (x.totalNotModified || 0), 0);
  const recentErrors = valid.flatMap(x => x.recentErrors || [])
    .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 50);

  // Apdex-Toepfe sind Zaehler und addieren sich.
  const apdexSumme = valid.reduce((acc, x) => {
    const a = x.apdex || {};
    acc.zufrieden += a.zufrieden || 0;
    acc.toleriert += a.toleriert || 0;
    acc.frustriert += a.frustriert || 0;
    return acc;
  }, { zufrieden: 0, toleriert: 0, frustriert: 0 });

  const klassen = { erfolg: 0, ausDemCache: 0, umleitung: 0, nichtGefunden: 0, abgelehnt: 0, serverfehler: 0 };
  valid.forEach(x => {
    for (const k of Object.keys(klassen)) klassen[k] += (x.statusKlassen || {})[k] || 0;
  });

  const ueber1sAnzahl = valid.reduce((s, x) => s + ((x.ueber1s || {}).anzahl || 0), 0);

  /*
   * Nutzer:innen ueber Replicas: VEREINIGUNG, nicht Summe. Wer in derselben
   * Stunde auf beiden Replicas landete — bei Round-Robin also praktisch
   * jede:r —, wuerde sonst doppelt gezaehlt und aus 112 Konten wuerden
   * schnell 200 "aktive Nutzer:innen".
   */
  const aktivSet = new Set();
  const betroffenSet = new Set();
  valid.forEach(x => {
    ((x.nutzer || {}).schluessel || []).forEach(h => aktivSet.add(h));
    ((x.nutzer || {}).betroffeneSchluessel || []).forEach(h => betroffenSet.add(h));
  });

  // Fehler-Gruppen ueber Replicas zusammenfassen: Anzahl addieren, frühestes
  // "seit" und spaetestes "zuletzt" behalten.
  const gruppenMap = new Map();
  valid.forEach(x => (x.fehlerGruppen || []).forEach(g => {
    const k = `${g.route} ${g.status}`;
    const e = gruppenMap.get(k);
    if (!e) { gruppenMap.set(k, { ...g }); return; }
    e.anzahl += g.anzahl;
    if (g.seit < e.seit) e.seit = g.seit;
    if (g.zuletzt > e.zuletzt) { e.zuletzt = g.zuletzt; e.beispielUrl = g.beispielUrl; }
  }));

  return {
    uptimeSeconds: Math.max(...valid.map(x => x.uptimeSeconds)),
    totalRequests,
    totalErrors,
    errorRate: totalRequests ? +(totalErrors / totalRequests).toFixed(4) : 0,
    totalNotModified,
    cacheQuote: totalRequests ? Math.round((totalNotModified / totalRequests) * 100) : 0,
    inFlight: valid.reduce((s, x) => s + x.inFlight, 0),
    maxInFlight: valid.reduce((s, x) => s + x.maxInFlight, 0),
    rps: +valid.reduce((s, x) => s + x.rps, 0).toFixed(2),
    // Nach SERVERzeit, wie in snapshot() — sonst greift die Korrektur vom
    // 22.09.2026 nur im Ein-Container-Betrieb und die Ansicht zeigte bei
    // mehreren Replicas weiter die Leitungszeit als Reihenfolge.
    routesSlowest: [...routes].sort((a, b) => b.serverP95Ms - a.serverP95Ms).slice(0, 20),
    routesBusiest: [...routes].sort((a, b) => b.count - a.count).slice(0, 20),
    recentErrors,
    timeline: timelineMerged,
    apdex: {
      wert: apdexWert(apdexSumme.zufrieden, apdexSumme.toleriert, apdexSumme.frustriert),
      ...apdexSumme,
      schwelleMs: APDEX_T_MS,
      toleriertBisMs: APDEX_TOLERIERT_MS,
    },
    ueber1s: {
      anzahl: ueber1sAnzahl,
      quote: totalRequests ? +((ueber1sAnzahl / totalRequests) * 100).toFixed(1) : 0,
      schwelleMs: SLOW_MS,
    },
    statusKlassen: klassen,
    nutzer: {
      fensterMinuten: NUTZER_FENSTER_MINUTEN,
      aktiv: aktivSet.size,
      betroffen: betroffenSet.size,
      schluessel: [...aktivSet],
      betroffeneSchluessel: [...betroffenSet],
    },
    routesPotenzial: [...routes].sort((a, b) => b.serverZeitGesamtMs - a.serverZeitGesamtMs).slice(0, 20),
    fehlerGruppen: [...gruppenMap.values()].sort((a, b) => b.anzahl - a.anzahl).slice(0, 20),
    // Lastverteilung: Anteil der Requests pro Replica.
    replicas: valid.map(x => ({
      replica: x.replica,
      requests: x.totalRequests,
      inFlight: x.inFlight,
      share: totalRequests ? +(x.totalRequests / totalRequests).toFixed(3) : 0,
    })),
  };
}

// Kompaktes Objekt für die persistente Historie (apm_snapshots-Tabelle).
function persistSummary() {
  const routes = routeRows();
  let totalCount = 0;
  let totalErrors = 0;
  let worstP95 = 0;
  let worstRoute = null;
  /*
   * Bewertet wird die SERVERZEIT, nicht die Gesamtzeit.
   *
   * Bis zum 21.09.2026 stand hier r.p95Ms — inklusive Warten auf die
   * Leitung. In der Verlaufstabelle stand deshalb einen Tag lang
   * "56 315 ms POST /api/konfi/upload-photo", waehrend dieselbe Route
   * gemessen in 133-208 ms antwortete: Ein einzelnes grosses Foto ueber
   * Mobilfunk hatte den Wert gesetzt, und das rollierende Fenster von 200
   * Stichproben haelt ihn bei einer selten genutzten Route tagelang fest.
   *
   * Eine Kennzahl, die die Netzverbindung der Konfis misst, sagt nichts
   * darueber, ob der Server schnell ist. Die Gesamtzeit bleibt je Route in
   * p95Ms erhalten — fuer die Frage "wie schnell fuehlt es sich an".
   */
  for (const r of routes) {
    totalCount += r.count;
    totalErrors += r.errors;
    if (r.serverP95Ms > worstP95) { worstP95 = r.serverP95Ms; worstRoute = r.route; }
  }
  return {
    totalRequests: totalCount,
    totalErrors,
    maxInFlight,
    worstP95Ms: worstP95,
    worstRoute,
  };
}

module.exports = { apmMiddleware, snapshot, mergeSnapshots, persistSummary, REPLICA_ID };
