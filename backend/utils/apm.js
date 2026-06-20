// apm.js — Leichtgewichtiges Application Performance Monitoring (in-memory).
//
// Sammelt pro Route-Schluessel (Methode + normalisierter Pfad) Anzahl, Fehlerrate
// und Antwortzeiten. Bewusst ohne externe Abhaengigkeit/DB: ein rollierendes
// Fenster der letzten N Dauer-Werte pro Route fuer eine p95-Naeherung. Reicht, um
// im Livebetrieb langsame/fehlerhafte Endpunkte zu erkennen, ohne Overhead.
//
// Zusaetzlich: Gauge fuer parallele (in-flight) Requests, ein rollierendes Log der
// letzten Fehler und ein 1-Sekunden-Bucket-Verlauf (Requests/Fehler pro Sekunde)
// fuer die letzten ~30 Minuten. Persistenz (Verlauf ueber Deploys hinweg) macht
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

// Sekunden-Buckets fuer den Live-Verlauf: Map<epochSec, { requests, errors, sumMs }>
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

function record(method, normPath, statusCode, durationMs, rawUrl) {
  const key = `${method} ${normPath}`;
  let s = stats.get(key);
  if (!s) {
    s = { count: 0, errors: 0, totalMs: 0, maxMs: 0, samples: [] };
    stats.set(key, s);
  }
  s.count += 1;
  s.totalMs += durationMs;
  if (durationMs > s.maxMs) s.maxMs = durationMs;
  const isError = statusCode >= 500;
  if (isError) s.errors += 1;
  s.samples.push(durationMs);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();

  // Sekunden-Bucket fuer den Verlauf
  const nowSec = Math.floor(Date.now() / 1000);
  let b = buckets.get(nowSec);
  if (!b) { b = { requests: 0, errors: 0, sumMs: 0 }; buckets.set(nowSec, b); }
  b.requests += 1;
  b.sumMs += durationMs;
  if (statusCode >= 400) b.errors += 1;
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

// Express-Middleware: misst jede Request-Dauer, zaehlt parallele Requests,
// loggt langsame Requests.
function apmMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  inFlight += 1;
  if (inFlight > maxInFlight) maxInFlight = inFlight;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    inFlight -= 1;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const rawUrl = req.originalUrl || req.url;
    record(req.method, normalizePath(rawUrl), res.statusCode, durationMs, rawUrl);
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
    routes.push({
      route,
      count: s.count,
      errors: s.errors,
      errorRate: s.count ? +(s.errors / s.count).toFixed(4) : 0,
      avgMs: s.count ? Math.round(s.totalMs / s.count) : 0,
      p95Ms: Math.round(percentile(sorted, 95)),
      maxMs: Math.round(s.maxMs),
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

// Requests pro Sekunde (Durchschnitt) ueber das letzte `windowSec`-Fenster.
function currentRps(windowSec = 10) {
  const nowSec = Math.floor(Date.now() / 1000);
  let sum = 0;
  for (let s = nowSec - windowSec; s <= nowSec; s++) {
    const b = buckets.get(s);
    if (b) sum += b.requests;
  }
  return +(sum / windowSec).toFixed(2);
}

// Vollstaendiges Aggregat fuer den /metrics-Endpoint.
function snapshot() {
  const routes = routeRows().sort((a, b) => b.p95Ms - a.p95Ms);
  let totalCount = 0;
  let totalErrors = 0;
  for (const r of routes) { totalCount += r.count; totalErrors += r.errors; }
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    totalRequests: totalCount,
    totalErrors,
    errorRate: totalCount ? +(totalErrors / totalCount).toFixed(4) : 0,
    inFlight,
    maxInFlight,
    rps: currentRps(),
    routesSlowest: routes.slice(0, 20),
    routesBusiest: [...routes].sort((a, b) => b.count - a.count).slice(0, 20),
    recentErrors: [...recentErrors].reverse(),
    timeline: timeline(30),
  };
}

// Kompaktes Objekt fuer die persistente Historie (apm_snapshots-Tabelle).
function persistSummary() {
  const routes = routeRows();
  let totalCount = 0;
  let totalErrors = 0;
  let worstP95 = 0;
  let worstRoute = null;
  for (const r of routes) {
    totalCount += r.count;
    totalErrors += r.errors;
    if (r.p95Ms > worstP95) { worstP95 = r.p95Ms; worstRoute = r.route; }
  }
  return {
    totalRequests: totalCount,
    totalErrors,
    maxInFlight,
    worstP95Ms: worstP95,
    worstRoute,
  };
}

module.exports = { apmMiddleware, snapshot, persistSummary };
