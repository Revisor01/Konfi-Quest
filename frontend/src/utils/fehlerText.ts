/**
 * Zentrale Auswertung von Fehlern aus `catch`.
 *
 * In `catch (err)` ist `err` seit TypeScript 4.4 `unknown` — geworfen werden
 * kann alles. Das Frontend spricht ueber axios mit der API; deren
 * Fehlerantworten tragen die Meldung in `response.data.error`. Diese Helfer
 * engen `unknown` gezielt ein, statt die Pruefung ueber Dutzende
 * catch-Bloecke zu streuen.
 */

interface ApiFehlerAntwort {
  response?: {
    status?: number;
    data?: {
      error?: unknown;
      message?: unknown;
    };
  };
  message?: unknown;
  code?: unknown;
}

const istObjekt = (wert: unknown): wert is Record<string, unknown> =>
  typeof wert === 'object' && wert !== null;

/** Sicht auf einen unbekannten Fehler als moegliche API-Fehlerantwort. */
export const apiFehler = (fehler: unknown): ApiFehlerAntwort =>
  (istObjekt(fehler) ? fehler : {}) as ApiFehlerAntwort;

/** HTTP-Status einer API-Fehlerantwort, sonst `undefined`. */
export const fehlerStatus = (fehler: unknown): number | undefined => {
  const status = apiFehler(fehler).response?.status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * Meldung aus `response.data.error`, sonst `fallback`.
 *
 * Entspricht dem bisherigen `err.response?.data?.error || 'Fallback'` — nur
 * ohne `any`.
 */
export const fehlerText = (fehler: unknown, fallback: string): string => {
  const meldung = apiFehler(fehler).response?.data?.error;
  return typeof meldung === 'string' && meldung.length > 0 ? meldung : fallback;
};

/**
 * Wie `fehlerText`, faellt aber vor dem `fallback` noch auf `error.message`
 * zurueck — fuer die Stellen, die bisher
 * `err.response?.data?.error || err.message || 'Fallback'` schrieben.
 */
export const fehlerTextOderMessage = (fehler: unknown, fallback: string): string => {
  const daten = apiFehler(fehler);
  const meldung = daten.response?.data?.error;
  if (typeof meldung === 'string' && meldung.length > 0) return meldung;
  if (typeof daten.message === 'string' && daten.message.length > 0) return daten.message;
  return fallback;
};
