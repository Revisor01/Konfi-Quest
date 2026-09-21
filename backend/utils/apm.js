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

// Map<routeKey, { count, errors, totalMs, maxMs, samples: number[] }>
const stats = new Map();
const startedAt = Date.now();

// In-flight (parallele) Requests jetzt + beobachtetes Maximum.
let inFlight = 0;
let maxInFlight = 0;

// Rollierendes Fehler-Log (neueste zuletzt).
const recentErrors = [];

// Sekunden-Buckets für den Live-Verlauf: Map<epochSec, { requests, errors, sumMs }>
const buckets = new Map();

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

function record(method, normPath, statusCode, durationMs, rawUrl, serverMs) {
  const key = `${method} ${normPath}`;
  let s = stats.get(key);
  if (!s) {
    s = { count: 0, errors: 0, totalMs: 0, maxMs: 0, samples: [], notModified: 0,
          serverTotalMs: 0, serverMaxMs: 0, serverSamples: [] };
    stats.set(key, s);
  }
  // Aeltere Eintraege aus einem laufenden Prozess kennen die Server-Felder
  // noch nicht — nachruesten statt NaN zu summieren.
  if (s.serverSamples === undefined) {
    s.serverTotalMs = 0; s.serverMaxMs = 0; s.serverSamples = [];
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
    record(req.method, normalizePath(rawUrl), res.statusCode, durationMs, rawUrl, serverMs);
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
    });
  }
  return routes;
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
  const routes = routeRows().sort((a, b) => b.p95Ms - a.p95Ms);
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
                                           sumServerAvg: 0, serverP95Ms: 0, serverMaxMs: 0 };
      e.count += r.count;
      e.errors += r.errors;
      e.sumAvg += r.avgMs * r.count;      // gewichteter Mittelwert ueber count
      e.p95Ms = Math.max(e.p95Ms, r.p95Ms);
      e.maxMs = Math.max(e.maxMs, r.maxMs);
      e.notModified += r.notModified || 0;
      // Serverzeit ueber beide Replicas mitfuehren, sonst faellt sie beim
      // Zusammenfassen weg und die Uebersicht zeigt wieder nur Gesamtzeiten.
      e.sumServerAvg += (r.serverAvgMs || 0) * r.count;
      e.serverP95Ms = Math.max(e.serverP95Ms, r.serverP95Ms || 0);
      e.serverMaxMs = Math.max(e.serverMaxMs, r.serverMaxMs || 0);
      routeMap.set(r.route, e);
    }
  };
  valid.forEach(s => { addRoutes(s.routesSlowest || []); addRoutes(s.routesBusiest || []); });
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
    routesSlowest: [...routes].sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 20),
    routesBusiest: [...routes].sort((a, b) => b.count - a.count).slice(0, 20),
    recentErrors,
    timeline: timelineMerged,
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
