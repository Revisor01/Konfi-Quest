// apm.js — Leichtgewichtiges Application Performance Monitoring (in-memory).
//
// Sammelt pro Route-Schluessel (Methode + normalisierter Pfad) Anzahl, Fehlerrate
// und Antwortzeiten. Bewusst ohne externe Abhaengigkeit/DB: ein rollierendes
// Fenster der letzten N Dauer-Werte pro Route fuer eine p95-Naeherung. Reicht, um
// im Livebetrieb langsame/fehlerhafte Endpunkte zu erkennen, ohne Overhead.
//
// Zugriff: GET /api/metrics (super_admin) liefert die Aggregate.
// Langsame Requests (> SLOW_MS) werden zusaetzlich ins Log geschrieben.

const SLOW_MS = 1000;          // Schwelle fuer "langsamer Request" (Log-Warnung)
const MAX_SAMPLES = 200;       // rollierende Dauer-Stichproben pro Route (p95)

// Map<routeKey, { count, errors, totalMs, maxMs, samples: number[] }>
const stats = new Map();
const startedAt = Date.now();

// Normalisiert den Pfad, damit IDs nicht zu tausenden Einzel-Routen explodieren:
// /api/admin/konfis/42 -> /api/admin/konfis/:id
function normalizePath(path) {
  return path
    .split('?')[0]
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:uuid');
}

function record(method, path, statusCode, durationMs) {
  const key = `${method} ${normalizePath(path)}`;
  let s = stats.get(key);
  if (!s) {
    s = { count: 0, errors: 0, totalMs: 0, maxMs: 0, samples: [] };
    stats.set(key, s);
  }
  s.count += 1;
  s.totalMs += durationMs;
  if (durationMs > s.maxMs) s.maxMs = durationMs;
  if (statusCode >= 500) s.errors += 1;
  s.samples.push(durationMs);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

// Express-Middleware: misst jede Request-Dauer und loggt langsame Requests.
function apmMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    record(req.method, req.originalUrl || req.url, res.statusCode, durationMs);
    if (durationMs > SLOW_MS) {
      console.warn(`[APM] LANGSAM ${Math.round(durationMs)}ms ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
    }
  });
  next();
}

// Aggregat fuer den /metrics-Endpoint.
function snapshot() {
  const routes = [];
  let totalCount = 0;
  let totalErrors = 0;
  for (const [route, s] of stats.entries()) {
    const sorted = [...s.samples].sort((a, b) => a - b);
    totalCount += s.count;
    totalErrors += s.errors;
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
  // Langsamste zuerst (nach p95), damit Problem-Endpunkte oben stehen.
  routes.sort((a, b) => b.p95Ms - a.p95Ms);
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    totalRequests: totalCount,
    totalErrors,
    errorRate: totalCount ? +(totalErrors / totalCount).toFixed(4) : 0,
    routes,
  };
}

module.exports = { apmMiddleware, snapshot };
