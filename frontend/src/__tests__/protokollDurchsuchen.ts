import { vi, type MockInstance } from 'vitest';

/**
 * Hilfen fuer Tests, die pruefen, dass ein Geheimnis (Passwort, Token) NICHT
 * im Konsolenprotokoll landet.
 *
 * Die Konsole des Geraets zeigt ein uebergebenes Objekt vollstaendig an --
 * auch verschachtelte und nicht aufzaehlbare Felder wie `cause`,
 * `config.data` oder `config.headers.Authorization` eines axios-Fehlers.
 * Deshalb reicht es nicht, nur die obersten Felder anzusehen: `enthaeltText`
 * geht jedes eigene Feld durch, auch die nicht aufzaehlbaren.
 */
export function enthaeltText(wert: unknown, gesucht: string, gesehen = new WeakSet<object>()): boolean {
  if (typeof wert === 'string') return wert.includes(gesucht);
  if (wert === null || (typeof wert !== 'object' && typeof wert !== 'function')) return false;
  const objekt = wert as object;
  if (gesehen.has(objekt)) return false;
  gesehen.add(objekt);

  if (objekt instanceof Map) {
    for (const [schluessel, inhalt] of objekt) {
      if (enthaeltText(schluessel, gesucht, gesehen) || enthaeltText(inhalt, gesucht, gesehen)) return true;
    }
  }
  if (objekt instanceof Set) {
    for (const inhalt of objekt) {
      if (enthaeltText(inhalt, gesucht, gesehen)) return true;
    }
  }

  for (const schluessel of Reflect.ownKeys(objekt)) {
    let inhalt: unknown;
    try {
      inhalt = (objekt as Record<PropertyKey, unknown>)[schluessel];
    } catch {
      continue;
    }
    if (enthaeltText(inhalt, gesucht, gesehen)) return true;
  }
  return false;
}

const KONSOLEN_METHODEN = ['log', 'info', 'warn', 'error', 'debug'] as const;

/**
 * Faengt alle Konsolenaufrufe ab (ohne sie auszugeben) und liefert eine
 * Abfrage, ob einer davon `gesucht` enthaelt. `aufrufe()` gibt die
 * Argumente aller Aufrufe zurueck, fuer Pruefungen auf den erlaubten Inhalt.
 */
export function konsoleMitschneiden() {
  const spione: MockInstance[] = KONSOLEN_METHODEN.map((methode) =>
    vi.spyOn(console, methode).mockImplementation(() => undefined)
  );
  const aufrufe = (): unknown[][] => spione.flatMap((spion) => spion.mock.calls as unknown[][]);
  return {
    aufrufe,
    enthaelt: (gesucht: string) => aufrufe().some((argumente) => enthaeltText(argumente, gesucht)),
    beenden: () => spione.forEach((spion) => spion.mockRestore()),
  };
}
