/**
 * Fehlermeldungen aus einem `catch` in einen anzeigbaren Text verwandeln.
 *
 * Warum diese Datei existiert: In `catch (e)` ist der Wert `unknown` — er kann
 * alles sein, was irgendwo geworfen wurde. Bis zum 30.08.2026 stand deshalb
 * überall `catch (error: any)` und direkt dahinter `error.response.data.error`.
 * Das ist gleich doppelt unsicher: `any` schaltet jede Prüfung ab, und die
 * Kette greift bei einem Netzwerkfehler (dann gibt es gar keine `response`)
 * oder bei einem geworfenen String ins Leere.
 *
 * Die Regel steht jetzt an EINER Stelle. Wer einen Fehler anzeigen will,
 * benutzt `fehlerText()` statt selbst durch die Antwort zu greifen.
 *
 * Das Backend antwortet bei Fehlern einheitlich mit `{ error: "..." }`
 * (siehe backend/routes/**). Genau dieses Feld wird bevorzugt, weil es den
 * fachlich gemeinten Satz enthält ("Dieser Termin ist schon voll"), während
 * `error.message` nur die technische Hülle nennt ("Request failed with
 * status code 409").
 */

/** Fehlerantwort des Backends — überall `{ error: "..." }`. */
export interface ApiFehlerAntwort {
  error?: string;
  error_code?: string;
  [feld: string]: unknown;
}

/**
 * Ein Fehler, wie axios ihn wirft. Bewusst schmal gehalten: nur was hier
 * gelesen wird. Kein Import von `AxiosError`, damit auch ein von Hand
 * geworfenes Objekt derselben Form passt.
 */
export interface ApiFehler {
  response?: {
    status?: number;
    data?: ApiFehlerAntwort;
  };
  message?: string;
  code?: string;
}

/** Prüft, ob der Wert ein Objekt ist (und nicht null). */
const istObjekt = (wert: unknown): wert is Record<string, unknown> =>
  typeof wert === 'object' && wert !== null;

/**
 * Engt einen `unknown` aus dem `catch` auf die gelesene Form ein.
 * Gibt immer ein Objekt zurück, damit Aufrufer gefahrlos `?.` benutzen können.
 */
export const alsApiFehler = (fehler: unknown): ApiFehler =>
  istObjekt(fehler) ? (fehler as ApiFehler) : {};

/** HTTP-Status der Fehlerantwort, falls es eine gab. */
export const fehlerStatus = (fehler: unknown): number | undefined =>
  alsApiFehler(fehler).response?.status;

/** Rohdaten der Fehlerantwort, falls es eine gab. */
export const fehlerDaten = (fehler: unknown): ApiFehlerAntwort | undefined =>
  alsApiFehler(fehler).response?.data;

/**
 * Der Satz aus der Backend-Antwort (`{ error: "..." }`), sonst der
 * mitgegebene Ersatztext.
 *
 * Für den Normalfall: eine Meldung, die die Leitung lesen soll.
 */
export const fehlerText = (fehler: unknown, ersatz: string): string => {
  const text = fehlerDaten(fehler)?.error;
  return typeof text === 'string' && text.trim() !== '' ? text : ersatz;
};

/**
 * Wie `fehlerText`, greift aber zusätzlich auf `error.message` zurück, bevor
 * der Ersatztext genommen wird.
 *
 * Für Stellen, an denen auch nicht-HTTP-Fehler auflaufen (Datei lesen,
 * Kamera, JSON parsen) — dort ist `message` das Einzige, was es gibt.
 */
export const fehlerTextOderMessage = (fehler: unknown, ersatz: string): string => {
  const ausAntwort = fehlerDaten(fehler)?.error;
  if (typeof ausAntwort === 'string' && ausAntwort.trim() !== '') return ausAntwort;
  const message = alsApiFehler(fehler).message;
  if (typeof message === 'string' && message.trim() !== '') return message;
  return ersatz;
};
