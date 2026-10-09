// Meldungen der Content-Security-Policy (Simon, 09.10.2026).
//
// Die Web-App traegt seit dem 29.09.2026 eine scharfe CSP (frontend/nginx.conf):
// Der Browser blockiert, was sie nicht erlaubt. Ohne Meldungen faellt eine
// fehlende Adresse erst auf, wenn jemand sagt "das Bild laedt nicht". Mit
// `report-uri` und `report-to` schickt der Browser jeden Verstoss an
// POST /api/csp-meldung (routes/cspMeldung.js); hier werden sie gezaehlt.
//
// ABLAGE: dieselbe wie die Fehler-Gruppen der Kennzahlen (utils/apm.js) --
// im Speicher der Replica, zusammengefasst nach Direktive, blockierter
// Adresse und Seite, mit Anzahl, erstem und letztem Auftreten. Kein neues
// Tabellenwerk: Wie bei den Fehler-Gruppen ist die Frage "was wird gerade
// blockiert, seit wann, wie oft" -- nicht die Geschichte ueber Monate. Ein
// Neustart leert die Zaehler; der erste Verstoss jeder neuen Gruppe steht
// zusaetzlich als eine Zeile im Container-Protokoll.
//
// DATENSPARSAM: Gespeichert wird nur, was zum Beheben noetig ist --
//   - die Direktive (`img-src`, `connect-src` ...),
//   - die blockierte Adresse OHNE Abfrage und Anker (Herkunft und Pfad; bei
//     data:, blob: und Browser-Erweiterungen nur das Schema; Schluesselwoerter
//     wie `inline` und `eval` so, wie der Browser sie nennt),
//   - der Pfad der Seite OHNE Abfrage (dort stehen Einladungscodes und
//     Reset-Tokens) und ohne Kennungen (Zahlen und UUIDs werden zu :id),
//   - Zeitpunkt (erstes und letztes Auftreten) und Zaehler.
// Nicht gespeichert: Client-Adresse, Browserkennung, Codeauszug
// (`script-sample`), Zeile und Spalte, Konto.
//
// GRENZE: hoechstens MAX_GRUPPEN Gruppen je Replica. Was danach kommt, zaehlt
// in `verworfen` -- ein Programm, das erfundene Meldungen schickt, fuellt
// so weder den Speicher noch die Ansicht unbegrenzt.

const MAX_GRUPPEN = 200;
const ANZEIGE_GRUPPEN = 30;
const MAX_LAENGE = 200;

const gruppen = new Map();
let gesamt = 0;
let verworfen = 0;

/** Kennungen im Pfad zusammenfassen, damit /konfi/events/12 und /13 eine Gruppe sind. */
function pfadOhneKennungen(pfad) {
  return pfad
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:uuid')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{24,}(?=\/|$)/gi, '/:datei');
}

const kuerzen = (text) => (text.length > MAX_LAENGE ? `${text.slice(0, MAX_LAENGE - 1)}…` : text);

/** Die blockierte Adresse ohne Abfrage: Herkunft + Pfad, bei anderen Schemata nur das Schema. */
function blockierteAdresse(roh) {
  const text = typeof roh === 'string' ? roh.trim() : '';
  if (!text) return '(leer)';
  // Schluesselwoerter der Browser: inline, eval, wasm-eval, trusted-types-*,
  // in alten Fassungen auch "data" und "blob" ohne Doppelpunkt.
  if (/^[a-z][a-z-]{0,39}$/i.test(text)) return text.toLowerCase();
  let url;
  try {
    url = new URL(text);
  } catch {
    return 'unbekannt';
  }
  const schema = url.protocol.replace(/:$/, '').toLowerCase();
  if (['http', 'https', 'ws', 'wss'].includes(schema)) {
    return kuerzen(`${url.origin}${pfadOhneKennungen(url.pathname)}`);
  }
  // data:, blob:, chrome-extension:, moz-extension:, safari-web-extension: ...
  return /^[a-z][a-z0-9+.-]{0,39}$/.test(schema) ? schema : 'unbekannt';
}

/** Der Pfad der Seite ohne Abfrage und Kennungen. */
function seitenPfad(roh) {
  const text = typeof roh === 'string' ? roh.trim() : '';
  if (!text) return 'unbekannt';
  try {
    const url = new URL(text);
    return kuerzen(pfadOhneKennungen(url.pathname || '/'));
  } catch {
    return 'unbekannt';
  }
}

/** Direktive: effective-directive, sonst das erste Wort von violated-directive. */
function direktive(effektiv, verletzt) {
  const kandidat = typeof effektiv === 'string' && effektiv.trim()
    ? effektiv.trim()
    : (typeof verletzt === 'string' ? verletzt.trim().split(/\s+/)[0] : '');
  return /^[a-z][a-z-]{0,39}$/.test(kandidat || '') ? kandidat : 'unbekannt';
}

/**
 * Eine Meldung aus einem der beiden Formate in die gespeicherte Form bringen.
 *
 *   application/csp-report (report-uri, alle Browser):
 *     { "csp-report": { "document-uri", "blocked-uri", "effective-directive", "violated-directive", ... } }
 *   application/reports+json (report-to, Reporting API, Chromium):
 *     [ { "type": "csp-violation", "body": { "documentURL", "blockedURL", "effectiveDirective", ... } }, ... ]
 *
 * @returns {{direktive: string, blockiert: string, seite: string} | null}
 */
function ausAlterMeldung(meldung) {
  if (!meldung || typeof meldung !== 'object' || Array.isArray(meldung)) return null;
  return {
    direktive: direktive(meldung['effective-directive'], meldung['violated-directive']),
    blockiert: blockierteAdresse(meldung['blocked-uri']),
    seite: seitenPfad(meldung['document-uri']),
  };
}

function ausReportingApi(bericht) {
  if (!bericht || typeof bericht !== 'object' || bericht.type !== 'csp-violation') return null;
  const b = bericht.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  return {
    direktive: direktive(b.effectiveDirective, b.violatedDirective),
    blockiert: blockierteAdresse(b.blockedURL),
    seite: seitenPfad(b.documentURL || bericht.url),
  };
}

/** Hoechstens so viele Berichte aus einer Sendung (der Browser buendelt). */
const MAX_JE_SENDUNG = 20;

/**
 * Den Inhalt einer Sendung lesen. Liefert die Meldungen in gespeicherter Form
 * oder null, wenn der Inhalt keines der beiden Formate ist.
 */
function lies(inhalt) {
  if (Array.isArray(inhalt)) {
    return inhalt.slice(0, MAX_JE_SENDUNG).map(ausReportingApi).filter(Boolean);
  }
  if (inhalt && typeof inhalt === 'object' && inhalt['csp-report']) {
    const m = ausAlterMeldung(inhalt['csp-report']);
    return m ? [m] : null;
  }
  return null;
}

/**
 * Meldungen zaehlen. Gibt zurueck, welche Gruppen neu sind (fuer die eine
 * Protokollzeile je neuer Gruppe).
 */
function aufnehmen(meldungen, jetzt = new Date()) {
  const zeit = jetzt.toISOString();
  const neu = [];
  for (const m of meldungen) {
    gesamt += 1;
    const schluessel = `${m.direktive} ${m.blockiert} ${m.seite}`;
    const g = gruppen.get(schluessel);
    if (g) {
      g.anzahl += 1;
      g.zuletzt = zeit;
      continue;
    }
    if (gruppen.size >= MAX_GRUPPEN) {
      verworfen += 1;
      continue;
    }
    const eintrag = { ...m, anzahl: 1, seit: zeit, zuletzt: zeit };
    gruppen.set(schluessel, eintrag);
    neu.push(eintrag);
  }
  return neu;
}

/** Stand dieser Replica fuer den Kennzahlen-Schnappschuss. */
function stand() {
  return {
    gesamt,
    verworfen,
    gruppenAnzahl: gruppen.size,
    grenze: MAX_GRUPPEN,
    gruppen: [...gruppen.values()]
      .sort((a, b) => b.anzahl - a.anzahl || (a.zuletzt < b.zuletzt ? 1 : -1))
      .slice(0, ANZEIGE_GRUPPEN)
      .map((g) => ({ ...g })),
  };
}

/** Staende mehrerer Replicas zusammenfassen (wie die Fehler-Gruppen in apm.mergeSnapshots). */
function zusammenfuehren(staende) {
  const gueltig = staende.filter(Boolean);
  if (gueltig.length === 0) return undefined;
  const map = new Map();
  for (const s of gueltig) {
    for (const g of s.gruppen || []) {
      const k = `${g.direktive} ${g.blockiert} ${g.seite}`;
      const e = map.get(k);
      if (!e) { map.set(k, { ...g }); continue; }
      e.anzahl += g.anzahl;
      if (g.seit < e.seit) e.seit = g.seit;
      if (g.zuletzt > e.zuletzt) e.zuletzt = g.zuletzt;
    }
  }
  return {
    gesamt: gueltig.reduce((n, s) => n + (s.gesamt || 0), 0),
    verworfen: gueltig.reduce((n, s) => n + (s.verworfen || 0), 0),
    // Jede Replica zaehlt fuer sich -- die Gruppen ueberschneiden sich, die
    // Summe waere zu hoch. Das Maximum sagt, ob eine an ihre Grenze kommt.
    gruppenAnzahl: Math.max(...gueltig.map((s) => s.gruppenAnzahl || 0)),
    grenze: MAX_GRUPPEN,
    gruppen: [...map.values()].sort((a, b) => b.anzahl - a.anzahl).slice(0, ANZEIGE_GRUPPEN),
  };
}

/** Nur fuer Tests: Modulzustand leeren. */
function _leeren() {
  gruppen.clear();
  gesamt = 0;
  verworfen = 0;
}

module.exports = {
  lies, aufnehmen, stand, zusammenfuehren, blockierteAdresse, seitenPfad, _leeren,
  MAX_GRUPPEN, MAX_JE_SENDUNG,
};
