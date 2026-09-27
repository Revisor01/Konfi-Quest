/**
 * Helfer, um aus einem gefangenen Fehler (typischerweise von axios) die
 * anzeigbare Meldung zu gewinnen — ohne `any` im Catch-Block.
 *
 * Entspricht dem bisherigen Muster `err.response?.data?.error || fallback`:
 * fehlt das Feld, ist es leer oder kein String, gibt es den Fallback.
 */

/** Fehlerantwort des Backends — durchgaengig `{ error: "..." }`. */
export interface ApiFehlerAntwort {
  error?: string;
  error_code?: string;
  [feld: string]: unknown;
}

interface MitResponse {
  response?: {
    status?: number;
    data?: {
      error?: unknown;
    };
  };
  code?: unknown;
}

function alsObjekt(err: unknown): MitResponse | null {
  return typeof err === 'object' && err !== null ? (err as MitResponse) : null;
}

/**
 * Herkunft der zuletzt gelieferten FREMDEN Texte — nur fuer die anonyme
 * Fehlermessung (`setError` in AppContext).
 *
 * WARUM: Die Messung uebertraegt einen Meldungstext nur noch, wenn er zu den
 * Texten der App gehoert (utils/bekannteFehlertexte.ts). Ein Server-Text kann
 * Namen, Titel oder Dateinamen enthalten und faellt deshalb heraus (Befund B1,
 * docs/messung/umami.md). Damit waere an den meisten Stellen auch das WO
 * verloren: Von 80 Aufrufen `setError(fehlerText(err, 'Ersatz'))` geben 78
 * weder Ort noch Fehlerobjekt mit (gezaehlt am 27.09.2026). Der Ersatztext
 * der Aufrufstelle IST aber ein Text der App und benennt die Stelle — er
 * tritt in der Messung an die Stelle des Server-Textes, dazu die grobe Art
 * aus dem Fehlerobjekt.
 *
 * Der fremde Text dient hier nur als Schluessel im Speicher: hoechstens
 * HERKUNFT_MAX Eintraege, jeder HERKUNFT_GUELTIG_MS lang und nur einmal
 * abrufbar. Er verlaesst das Geraet nicht.
 */
const HERKUNFT_MAX = 10;
const HERKUNFT_GUELTIG_MS = 10_000;
const herkunft = new Map<string, { ersatz: string; art: string; zeit: number }>();

function merkeHerkunft(text: string, ersatz: string, err: unknown): void {
  herkunft.delete(text);
  herkunft.set(text, { ersatz, art: fehlerArt(err), zeit: Date.now() });
  while (herkunft.size > HERKUNFT_MAX) {
    const aeltester = herkunft.keys().next().value;
    if (aeltester === undefined) break;
    herkunft.delete(aeltester);
  }
}

/**
 * Hat `fehlerText`/`fehlerTextOderMessage` gerade diesen Text anstelle ihres
 * Ersatztextes geliefert? Dann: der Ersatztext und die grobe Art (`http-409`,
 * `netz` …). Der Eintrag wird dabei verbraucht.
 */
export function herkunftDesFehlertexts(text: string): { ersatz: string; art: string } | undefined {
  const eintrag = herkunft.get(text);
  if (!eintrag) return undefined;
  herkunft.delete(text);
  if (Date.now() - eintrag.zeit > HERKUNFT_GUELTIG_MS) return undefined;
  return { ersatz: eintrag.ersatz, art: eintrag.art };
}

/**
 * Server-Fehlermeldung aus `err.response.data.error`, sonst der Fallback.
 */
export function fehlerText(err: unknown, fallback: string): string {
  const serverfehler = alsObjekt(err)?.response?.data?.error;
  if (typeof serverfehler === 'string' && serverfehler) {
    merkeHerkunft(serverfehler, fallback, err);
    return serverfehler;
  }
  return fallback;
}

/**
 * Wie fehlerText, faellt aber vor dem Fallback noch auf `err.message`
 * zurueck (bisheriges Muster der Upload-Pfade:
 * `err.response?.data?.error || err.message || fallback`).
 */
export function fehlerTextOderMessage(err: unknown, fallback: string): string {
  const serverfehler = alsObjekt(err)?.response?.data?.error;
  if (typeof serverfehler === 'string' && serverfehler) {
    merkeHerkunft(serverfehler, fallback, err);
    return serverfehler;
  }
  const message = (alsObjekt(err) as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message) {
    merkeHerkunft(message, fallback, err);
    return message;
  }
  return fallback;
}

/**
 * HTTP-Status aus `err.response.status`, sonst undefined
 * (auch bei Netzwerkfehlern ohne Response).
 */
export function fehlerStatus(err: unknown): number | undefined {
  const status = alsObjekt(err)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Netzwerkfehler: keine Response vorhanden oder axios-Code ERR_NETWORK.
 * (Ein plain `Error` ohne response zählt wie bisher als Netzwerkfehler.)
 */
export function istNetzwerkfehler(err: unknown): boolean {
  const obj = alsObjekt(err);
  return !obj?.response || obj.code === 'ERR_NETWORK';
}

/**
 * Rohdaten der Fehlerantwort (`err.response.data`), sonst undefined.
 *
 * Fuer die Stellen, die neben der Meldung noch Begleitfelder auswerten —
 * etwa `error_code`, `canForceDelete` oder `next_tier` bei den Tarifgrenzen.
 */
export function fehlerDaten(err: unknown): ApiFehlerAntwort | undefined {
  const daten = alsObjekt(err)?.response?.data;
  return typeof daten === 'object' && daten !== null ? (daten as ApiFehlerAntwort) : undefined;
}

/**
 * Engt einen `unknown` aus dem Catch auf die gelesene Form ein. Gibt immer
 * ein Objekt zurueck, damit Aufrufer gefahrlos `?.` benutzen koennen.
 */
export function alsApiFehler(err: unknown): { response?: { status?: number; data?: ApiFehlerAntwort }; message?: string; code?: string } {
  return alsObjekt(err) !== null ? (err as { response?: { status?: number; data?: ApiFehlerAntwort }; message?: string; code?: string }) : {};
}

/**
 * Grobe Ursache eines gefangenen Fehlers, fuer die anonyme Messung.
 *
 * Beantwortet das WARUM, ohne irgendetwas ueber die Person oder ihre Daten zu
 * verraten. Das Ergebnis ist IMMER einer von wenigen festen Werten:
 *
 * - `http-403`, `http-404`, `http-500` …  — der Status, sonst nichts. Kein
 *   Text der Antwort, keine URL, keine Kennung.
 * - `timeout`                              — die Anfrage lief in die Zeitgrenze.
 * - `netz`                                 — offline oder Verbindung abgerissen.
 * - `abbruch`                              — die Anfrage wurde abgebrochen
 *                                            (Seitenwechsel), kein echter Fehler.
 * - `intern`                               — im Browser aufgetreten, keine
 *                                            Anfrage im Spiel (z.B. ein
 *                                            fehlgeschlagenes natives Plugin).
 *
 * Niemals uebertragen werden `err.message`, `err.response.data`, Dateinamen,
 * Kennungen oder URLs — die enthalten Namen und Freitext. Der Status ist eine
 * dreistellige Zahl aus einer festen Menge und damit nicht rueckfuehrbar.
 */
export function fehlerArt(err: unknown): string {
  const obj = alsObjekt(err) as { code?: unknown; name?: unknown } | null;
  const code = typeof obj?.code === 'string' ? obj.code : '';
  const name = typeof obj?.name === 'string' ? obj.name : '';

  // Zeitgrenze VOR dem Netzwerkfehler pruefen: axios liefert bei einem Timeout
  // ebenfalls keine Response, `istNetzwerkfehler` wuerde es sonst schlucken.
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || name === 'TimeoutError') {
    return 'timeout';
  }
  if (code === 'ERR_CANCELED' || name === 'CanceledError' || name === 'AbortError') {
    return 'abbruch';
  }

  const status = fehlerStatus(err);
  if (typeof status === 'number' && status >= 100 && status <= 599) {
    return `http-${status}`;
  }

  // axios meldet einen abgerissenen Transport als ERR_NETWORK; ein `fetch`
  // scheitert stattdessen mit einem TypeError ohne jede Kennzeichnung.
  if (code === 'ERR_NETWORK') return 'netz';

  // Kein axios-Fehler mit Status: entweder ein Netzwerkproblem ohne
  // Kennzeichnung oder ein Fehler im Browser selbst. Ist das Geraet offline,
  // ist es das Netz.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'netz';
  }
  return 'intern';
}
