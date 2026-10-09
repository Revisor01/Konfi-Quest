import { offlineCache, CACHE_TTL } from './offlineCache';
import type { NetzZuerstErgebnis } from './netzZuerst';

// Besuchte Detailseiten bewahren ihre Antwort auf (09.10.2026, Simon: „Details
// aus Cache ist gut."). Vorher zeigten Konfi-Termin, Leitungs-Termin und die
// Seite einer Person ohne Netz nur den Grundstand aus der Liste und für alles
// Weitere die graue Zeile (OfflinePlatzhalter). Jetzt geht eine Seite, die
// schon einmal mit Netz offen war, ohne Netz noch einmal so auf.
//
// Dasselbe Muster wie Challenge-Beiträge und Material (netzZuerst.ts): Mit
// Netz entscheidet immer der Server, der gemerkte Stand hilft nur ohne
// Antwort. Gemerkt wird die Antwort, die die Seite ohnehin abruft — keine
// zusätzliche Anfrage. Ohne Netz fragt die Seite gar nicht erst.
//
// Konto und Gemeinde: Der Stand liegt im offlineCache und trägt damit die
// Kennung des Kontos im Schlüssel (anderes Konto findet nichts); Abmelden und
// Gemeindewechsel leeren den offlineCache ganz. Die Gemeinde steht zusätzlich
// im Schlüssel der Seite, wie bei den Listen ('admin:events:<org>').
//
// Obergrenze: Das Verzeichnis führt die Schlüssel, zuletzt besuchte vorn.
// Mehr als DETAIL_HOECHSTZAHL — der am längsten nicht besuchte fliegt raus.

/** So viele Detail-Antworten hält ein Konto höchstens vor. */
export const DETAIL_HOECHSTZAHL = 60;

/** Schlüssel des Verzeichnisses im offlineCache (je Konto, wie alles dort). */
export const DETAIL_VERZEICHNIS = 'detail:verzeichnis';

// Merken und Vergessen nacheinander: Beide lesen und schreiben das
// Verzeichnis. Zwei gleichzeitige Aufrufe (Termin und sein Material) würden
// sich sonst gegenseitig einen Eintrag überschreiben.
let kette: Promise<unknown> = Promise.resolve();
const nacheinander = <T>(schritt: () => Promise<T>): Promise<T> => {
  const lauf = kette.then(schritt, schritt);
  kette = lauf.catch(() => undefined);
  return lauf;
};

const verzeichnisLesen = async (): Promise<string[]> => {
  const eintrag = await offlineCache.get<string[]>(DETAIL_VERZEICHNIS).catch(() => null);
  return Array.isArray(eintrag?.data) ? eintrag.data.filter((k) => typeof k === 'string') : [];
};

/** Eine Antwort merken; der Schlüssel rückt im Verzeichnis nach vorn. */
export function detailMerken<T>(schluessel: string, daten: T): Promise<void> {
  return nacheinander(async () => {
    await offlineCache.set(schluessel, daten, CACHE_TTL.PROFILE);
    const liste = [schluessel, ...(await verzeichnisLesen()).filter((k) => k !== schluessel)];
    await offlineCache.set(DETAIL_VERZEICHNIS, liste.slice(0, DETAIL_HOECHSTZAHL), CACHE_TTL.PROFILE);
    for (const alt of liste.slice(DETAIL_HOECHSTZAHL)) {
      await offlineCache.remove(alt);
    }
  });
}

/** Einen gemerkten Stand entfernen — etwa wenn der Server 403/404 sagt. */
export function detailVergessen(schluessel: string): Promise<void> {
  return nacheinander(async () => {
    await offlineCache.remove(schluessel);
    const liste = await verzeichnisLesen();
    if (liste.includes(schluessel)) {
      await offlineCache.set(DETAIL_VERZEICHNIS, liste.filter((k) => k !== schluessel), CACHE_TTL.PROFILE);
    }
  });
}

/** Der gemerkte Stand, oder null. Fragt nie den Server. */
export async function gemerktesDetail<T>(schluessel: string): Promise<T | null> {
  const eintrag = await offlineCache.get<T>(schluessel).catch(() => null);
  return eintrag ? eintrag.data : null;
}

const statusVon = (fehler: unknown): number | undefined =>
  (fehler as { response?: { status?: number } })?.response?.status;
const ohneAntwort = (fehler: unknown): boolean =>
  (fehler as { response?: unknown })?.response === undefined;

/**
 * Eine Detail-Antwort laden.
 * - Ohne Netz: nur der gemerkte Stand (`ausSpeicher: true`), sonst null —
 *   keine Anfrage.
 * - Mit Netz: der Server; die Antwort wird gemerkt. Kommt keine Antwort, hilft
 *   der gemerkte Stand. Sagt der Server 403 oder 404, wird der gemerkte Stand
 *   vergessen und der Fehler weitergereicht — wer etwas nicht mehr sehen darf,
 *   soll es auch nicht aus dem Speicher sehen.
 */
export async function detailLaden<T>(
  schluessel: string,
  abruf: () => Promise<T>,
  online: boolean
): Promise<NetzZuerstErgebnis<T> | null> {
  if (!online) {
    const daten = await gemerktesDetail<T>(schluessel);
    return daten === null ? null : { daten, ausSpeicher: true };
  }
  try {
    const daten = await abruf();
    // Nicht abwarten: Die Anzeige soll nicht auf das Schreiben warten.
    void detailMerken(schluessel, daten).catch(() => undefined);
    return { daten, ausSpeicher: false };
  } catch (fehler) {
    const status = statusVon(fehler);
    if (status === 403 || status === 404) {
      await detailVergessen(schluessel).catch(() => undefined);
      throw fehler;
    }
    if (!ohneAntwort(fehler)) throw fehler;
    const daten = await gemerktesDetail<T>(schluessel);
    if (daten === null) throw fehler;
    return { daten, ausSpeicher: true };
  }
}
