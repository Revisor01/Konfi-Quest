/**
 * Helfer, um aus einem gefangenen Fehler (typischerweise von axios) die
 * anzeigbare Meldung zu gewinnen — ohne `any` im Catch-Block.
 *
 * Entspricht dem bisherigen Muster `err.response?.data?.error || fallback`:
 * fehlt das Feld, ist es leer oder kein String, gibt es den Fallback.
 */

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
 * Server-Fehlermeldung aus `err.response.data.error`, sonst der Fallback.
 */
export function fehlerText(err: unknown, fallback: string): string {
  const serverfehler = alsObjekt(err)?.response?.data?.error;
  if (typeof serverfehler === 'string' && serverfehler) {
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
    return serverfehler;
  }
  const message = (alsObjekt(err) as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message) {
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
