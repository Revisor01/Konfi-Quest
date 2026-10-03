import { Capacitor } from '@capacitor/core';

/**
 * Die Zusage der Web-Version: Hier darf sich ein Konto ohne Gemeinde anmelden.
 *
 * Support-Konten haben keine Gemeinde und arbeiten nur im Browser (Simon,
 * 03.10.2026; docs/planung/web-version.md, Punkt 13). Der Server meldet ein
 * solches Konto bei Anmeldung und Refresh nur an, wenn die Anfrage
 * `kann_ohne_gemeinde: true` traegt; sonst kommt 403 `user_inactive` mit
 * `grund: 'konto_ohne_gemeinde'` und einem Hinweis auf die Web-Version
 * (backend/routes/auth.js, OHNE_GEMEINDE_ANTWORT).
 *
 * Die Apps auf iPhone und Android schicken die Zusage nie -- dieselbe
 * Codebasis, unterschieden ueber Capacitor.isNativePlatform(). Fuer Konten
 * mit Gemeinde aendert das Feld nichts.
 *
 * @returns die Felder fuer den Anfragekoerper: in der Web-Version
 *   `{ kann_ohne_gemeinde: true }`, in den Apps ein leeres Objekt.
 */
export function ohneGemeindeZusage(): { kann_ohne_gemeinde?: true } {
  return Capacitor.isNativePlatform() ? {} : { kann_ohne_gemeinde: true };
}
