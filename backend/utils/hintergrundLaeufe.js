// Laufzeiten im Hintergrund (09.10.2026, Betrieb BF-10 Rest).
//
// /api/metrics/local zeigte den Cron-Leader, aber nicht, wann welcher Job
// zuletzt lief, wie lange er brauchte und ob er scheiterte; auch die Dauer
// eines Push-Versands und des Zaehler-Laufs stand in keiner Log-Zeile
// (01.10.2026: "nicht messbar ohne Code").
//
// ABLAGE: wie die Fehler-Gruppen und die CSP-Meldungen (utils/apm.js,
// utils/cspMeldungen.js) -- im Speicher der Replica. Die Frage ist "laeuft
// der Hintergrund, und wie lange braucht er gerade", nicht die Geschichte
// ueber Monate. Ein Neustart leert den Stand; der naechste Lauf fuellt ihn.
// Die Jobs fahren nur auf dem Cron-Leader -- die anderen Replicas melden
// deshalb keine Jobs, wohl aber Push-Versand (Pushes gehen von jeder
// Replica hinaus). mergeSnapshots fuehrt beides zusammen.
//
// PROTOKOLL: Jeder Lauf eines Jobs, der hoechstens stuendlich laeuft, und
// der Zaehler-Lauf (alle fuenf Minuten, ausdruecklich gewuenscht) schreiben
// eine Zeile mit Dauer. Jobs im Minuten-Takt schreiben nur, wenn sie
// scheitern oder laenger als AUFFAELLIG_MS brauchen -- sonst waeren es 1.440
// Zeilen am Tag ohne Aussage.

const AUFFAELLIG_MS = 1000;
const MAX_FEHLERTEXT = 200;

// Bezeichnung je Job -- die Oberflaeche zeigt sie, ohne eine eigene Liste
// fuehren zu muessen. `protokoll: 'immer'` siehe Dateikopf.
const JOBS = {
  zaehler: { bezeichnung: 'Zähler am App-Symbol', takt: 'alle 5 Minuten', protokoll: 'immer' },
  abzeichen: { bezeichnung: 'Abzeichen-Prüfung', takt: 'stündlich', protokoll: 'immer' },
  erinnerungen: { bezeichnung: 'Event-Erinnerungen', takt: 'alle 15 Minuten', protokoll: 'immer' },
  anmeldung_offen: { bezeichnung: 'Push „Anmeldung möglich“', takt: 'jede Minute', protokoll: 'auffaellig' },
  challenge_start: { bezeichnung: 'Push zum Challenge-Start', takt: 'alle 5 Minuten', protokoll: 'auffaellig' },
  offene_verbuchung: { bezeichnung: 'Hinweis auf offene Verbuchungen', takt: 'täglich 9 Uhr', protokoll: 'immer' },
  push_tokens: { bezeichnung: 'Push-Geräte aufräumen', takt: 'alle 6 Stunden', protokoll: 'immer' },
  refresh_tokens: { bezeichnung: 'Anmeldungen aufräumen', takt: 'alle 6 Stunden', protokoll: 'immer' },
  rueckblick: { bezeichnung: 'Jahresrückblick', takt: 'jährlich 6. Januar', protokoll: 'immer' },
  loesch_erinnerung: { bezeichnung: 'Erinnerung vor dem Löschen von Jahrgängen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  auto_loeschung: { bezeichnung: 'Automatisches Löschen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  mitteilungen_aufraeumen: { bezeichnung: 'Alte Mitteilungen aufräumen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  einladungen_aufraeumen: { bezeichnung: 'Mitteilungen erledigter Einladungen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  anfragen_aufraeumen: { bezeichnung: 'Anfragen aufräumen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  mails_aufraeumen: { bezeichnung: 'Nicht zugeordnete Mails aufräumen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  vorgaenge_aufraeumen: { bezeichnung: 'Archivierte Vorgänge aufräumen', takt: 'täglich 2 Uhr', protokoll: 'immer' },
  testphase: { bezeichnung: 'Ende der Testphase', takt: 'täglich 3 Uhr', protokoll: 'immer' },
  lizenz_erinnerung: { bezeichnung: 'Lizenz-Erinnerung', takt: 'täglich 3 Uhr', protokoll: 'immer' },
  kennzahlen_sichern: { bezeichnung: 'Kennzahlen sichern', takt: 'alle 5 Minuten', protokoll: 'auffaellig' },
  mail_abholung: { bezeichnung: 'Mails abholen', takt: 'alle 2 Minuten', protokoll: 'auffaellig' },
};

const laeufe = new Map();

const kuerzen = (text) => {
  const t = String(text == null ? '' : text);
  return t.length > MAX_FEHLERTEXT ? `${t.slice(0, MAX_FEHLERTEXT - 1)}…` : t;
};

function eintragFuer(name) {
  let e = laeufe.get(name);
  if (!e) {
    const job = JOBS[name] || {};
    e = {
      name,
      bezeichnung: job.bezeichnung || name,
      takt: job.takt || null,
      letzterStart: null,
      letztesEnde: null,
      dauerMs: null,
      ergebnis: null,
      fehler: null,
      anzahl: 0,
      fehlerAnzahl: 0,
      maxDauerMs: 0,
      gesamtDauerMs: 0,
    };
    laeufe.set(name, e);
  }
  return e;
}

/**
 * Einen Lauf messen: Start, Ende, Dauer, Ergebnis. Der Fehler geht
 * unveraendert weiter -- die Aufrufer behalten ihr try/catch und ihre
 * Protokollzeile.
 *
 * @param {string} name  Schluessel aus JOBS
 * @param {() => Promise<any>} fn
 * @param {{zusatz?: (ergebnis: any) => string|null, jetzt?: () => number}} [optionen]
 *   zusatz: kurzer Text fuer die Protokollzeile (z.B. "40 von 82 aktualisiert")
 */
async function messeLauf(name, fn, optionen = {}) {
  const jetzt = optionen.jetzt || Date.now;
  const e = eintragFuer(name);
  const start = jetzt();
  e.letzterStart = new Date(start).toISOString();
  e.ergebnis = 'laeuft';
  e.gemeldet = null;
  let ergebnis;
  let fehler = null;
  try {
    ergebnis = await fn();
    return ergebnis;
  } catch (err) {
    fehler = err;
    throw err;
  } finally {
    // Jobs, die ihren Fehler selbst abfangen und nur protokollieren, melden
    // ihn ueber laufFehler -- sonst stuende hier "ok".
    if (!fehler && e.gemeldet) fehler = e.gemeldet;
    e.gemeldet = null;
    const ende = jetzt();
    const dauer = Math.max(0, ende - start);
    e.letztesEnde = new Date(ende).toISOString();
    e.dauerMs = dauer;
    e.anzahl += 1;
    e.gesamtDauerMs += dauer;
    if (dauer > e.maxDauerMs) e.maxDauerMs = dauer;
    if (fehler) {
      e.ergebnis = 'fehler';
      e.fehler = kuerzen((fehler && (fehler.message || fehler.code)) || fehler);
      e.fehlerAnzahl += 1;
    } else {
      e.ergebnis = 'ok';
      e.fehler = null;
    }
    const job = JOBS[name] || {};
    if (job.protokoll === 'immer' || fehler || dauer >= AUFFAELLIG_MS) {
      let zusatz = null;
      if (!fehler && optionen.zusatz) {
        try { zusatz = optionen.zusatz(ergebnis); } catch { zusatz = null; }
      }
      const zeile = `Hintergrund: ${e.bezeichnung} in ${dauer} ms, ${fehler ? 'Fehler' : 'ok'}${zusatz ? ` (${zusatz})` : ''}`;
      // Bei einem Fehler als Warnung: Die Fehlerzeile selbst schreibt der
      // Aufrufer (oder der Job) wie bisher -- hier kommt nur die Dauer dazu.
      if (fehler) console.warn(zeile);
      else console.log(zeile);
    }
  }
}

/**
 * Fuer Jobs, die einen Fehler abfangen, statt ihn zu werfen (z.B.
 * runTrialExpiry gibt dann {locked: 0} zurueck): den laufenden Lauf als
 * gescheitert vermerken. Ausserhalb eines gemessenen Laufs ohne Wirkung.
 */
function laufFehler(name, err) {
  const e = laeufe.get(name);
  if (e && e.ergebnis === 'laeuft') e.gemeldet = err || new Error('Fehler');
}

// ------------------------------------------------------------------
// Push-Versand
// ------------------------------------------------------------------
//
// Gemessen wird ein Versand von seinem Aufruf bis zum letzten Geraet, je Weg:
//   einzeln  PushService.sendToUser (eine Person, direkt gerufen)
//   viele    PushService.sendToMultipleUsers (z.B. Absage, Leitung)
//   chat     PushService.sendChatNotificationToMany (eine Chat-Nachricht)
// Eine Protokollzeile schreibt nur ein Versand an viele, der laenger als
// PUSH_LANGSAM_MS braucht. Der Versand an viele schreibt sonst hoechstens
// seine Sammelzeilen (pushService.protokolliereBilanz, Betrieb BF-11:
// "alles zugestellt: keine Zeile") -- jede Absage und jede Chat-Nachricht mit
// einer Dauerzeile waere Laerm; die Dauer steht in den Kennzahlen.

const PUSH_LANGSAM_MS = 5000;
const PUSH_WEGE = ['einzeln', 'viele', 'chat'];
const leererWeg = () => ({ anzahl: 0, fehler: 0, empfaenger: 0, gesamtDauerMs: 0, maxDauerMs: 0, letzteDauerMs: null, zuletzt: null });
let pushJeWeg = Object.fromEntries(PUSH_WEGE.map((w) => [w, leererWeg()]));
let pushLangsamster = null;

/**
 * Einen Push-Versand verbuchen.
 * @param {{weg: 'einzeln'|'viele'|'chat', art?: string, empfaenger: number, dauerMs: number, fehler?: boolean, zeit?: Date}} v
 */
function pushVerbuchen({ weg, art = null, empfaenger, dauerMs, fehler = false, zeit = new Date() }) {
  const w = pushJeWeg[weg];
  if (!w) return;
  w.anzahl += 1;
  if (fehler) w.fehler += 1;
  w.empfaenger += empfaenger;
  w.gesamtDauerMs += dauerMs;
  if (dauerMs > w.maxDauerMs) w.maxDauerMs = dauerMs;
  w.letzteDauerMs = dauerMs;
  w.zuletzt = zeit.toISOString();
  if (!pushLangsamster || dauerMs > pushLangsamster.dauerMs) {
    pushLangsamster = { weg, art, empfaenger, dauerMs, zeit: zeit.toISOString() };
  }
  if (weg !== 'einzeln' && dauerMs >= PUSH_LANGSAM_MS) {
    console.warn(`Push ${art || weg}: ${empfaenger} Empfänger:innen in ${dauerMs} ms${fehler ? ', Fehler' : ''}`);
  }
}

/**
 * Einen Versand messen und verbuchen; Fehler gehen unveraendert weiter.
 * @param {{weg: string, art?: string, empfaenger: number}} angaben
 * @param {() => Promise<any>} fn
 */
async function messePush(angaben, fn) {
  const start = Date.now();
  let fehler = false;
  try {
    return await fn();
  } catch (err) {
    fehler = true;
    throw err;
  } finally {
    pushVerbuchen({ ...angaben, dauerMs: Date.now() - start, fehler });
  }
}

const mittel = (w) => (w.anzahl ? Math.round(w.gesamtDauerMs / w.anzahl) : null);

/** Stand dieser Replica fuer den Kennzahlen-Schnappschuss. */
function stand() {
  return {
    jobs: [...laeufe.values()]
      .map(({ gemeldet: _gemeldet, ...e }) => ({ ...e, mittelDauerMs: e.anzahl ? Math.round(e.gesamtDauerMs / e.anzahl) : null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    pushVersand: {
      jeWeg: Object.fromEntries(PUSH_WEGE.map((w) => [w, { ...pushJeWeg[w], mittelDauerMs: mittel(pushJeWeg[w]) }])),
      langsamster: pushLangsamster ? { ...pushLangsamster } : null,
    },
  };
}

/**
 * Staende mehrerer Replicas zusammenfassen. Jobs: je Name der juengste Lauf
 * (der Leader kann gewechselt haben), Zaehler addiert, Maximum behalten.
 * Push: je Weg addiert.
 *
 * @param {Array<{replica: string, stand: object}|null>} eintraege
 */
function zusammenfuehren(eintraege) {
  const gueltig = eintraege.filter((x) => x && x.stand);
  if (gueltig.length === 0) return undefined;
  const jobs = new Map();
  for (const { replica, stand: s } of gueltig) {
    for (const j of s.jobs || []) {
      const e = jobs.get(j.name);
      if (!e) { jobs.set(j.name, { ...j, replica }); continue; }
      const juenger = (j.letzterStart || '') > (e.letzterStart || '');
      const summe = {
        anzahl: e.anzahl + j.anzahl,
        fehlerAnzahl: e.fehlerAnzahl + j.fehlerAnzahl,
        gesamtDauerMs: e.gesamtDauerMs + j.gesamtDauerMs,
        maxDauerMs: Math.max(e.maxDauerMs, j.maxDauerMs),
      };
      jobs.set(j.name, { ...(juenger ? { ...j, replica } : e), ...summe });
    }
  }
  const jeWeg = Object.fromEntries(PUSH_WEGE.map((weg) => {
    const w = leererWeg();
    for (const { stand: s } of gueltig) {
      const x = s.pushVersand && s.pushVersand.jeWeg && s.pushVersand.jeWeg[weg];
      if (!x) continue;
      w.anzahl += x.anzahl;
      w.fehler += x.fehler;
      w.empfaenger += x.empfaenger;
      w.gesamtDauerMs += x.gesamtDauerMs;
      w.maxDauerMs = Math.max(w.maxDauerMs, x.maxDauerMs);
      if (x.zuletzt && (!w.zuletzt || x.zuletzt > w.zuletzt)) { w.zuletzt = x.zuletzt; w.letzteDauerMs = x.letzteDauerMs; }
    }
    return [weg, { ...w, mittelDauerMs: mittel(w) }];
  }));
  const langsamster = gueltig
    .map(({ stand: s }) => s.pushVersand && s.pushVersand.langsamster)
    .filter(Boolean)
    .sort((a, b) => b.dauerMs - a.dauerMs)[0] || null;
  return {
    jobs: [...jobs.values()]
      .map((j) => ({ ...j, mittelDauerMs: j.anzahl ? Math.round(j.gesamtDauerMs / j.anzahl) : null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    pushVersand: { jeWeg, langsamster },
  };
}

/** Nur fuer Tests: Modulzustand leeren. */
function _leeren() {
  laeufe.clear();
  pushJeWeg = Object.fromEntries(PUSH_WEGE.map((w) => [w, leererWeg()]));
  pushLangsamster = null;
}

module.exports = {
  messeLauf, laufFehler, messePush, pushVerbuchen, stand, zusammenfuehren, _leeren,
  JOBS, AUFFAELLIG_MS, PUSH_LANGSAM_MS,
};
