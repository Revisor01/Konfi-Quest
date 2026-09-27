export const getYearWeek = (date: Date): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const yearWeek = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${yearWeek.toString().padStart(2, '0')}`;
};

/**
 * DIE DATUMSFORMATE DER APP -- an dieser einen Stelle (UI-Audit BF-14).
 *
 * Bis zum 27.09.2026 formatierte jede Ansicht selbst: 88 Aufrufe von
 * toLocaleDateString/-TimeString/-String mit 17 verschiedenen Optionssätzen.
 * Derselbe Tag stand als „14.09.2026" (Termin), „8. Sept. 2026" (Rückblick,
 * Profil), „8.9.2026" (Jahrgang), „Mo., 14. Sept." (Startseite) da.
 *
 * Es gibt genau drei Formate:
 *   datumKurz   14.09.2026                   Listen, Karten, Metazeilen
 *               14.09.  (ohneJahr)           wo der Platz knapp und das Jahr
 *                                            klar ist: Spaltenköpfe, Chat
 *               Mo., 14.09.2026              Event-Karten der Startseite
 *                       (mitWochentag)       (Simon, 27.09.2026: „Wochentag
 *                                            finde ich eine gute Idee")
 *   datumLang   Montag, 14. September 2026   Überschriften, Detail, Rückfragen
 *   uhrzeit     18:00                        „Uhr" steht, wo es der Satz will
 * und eine Verbindung daraus: datumUhrzeit = „14.09.2026, 18:00".
 *
 * ZEITZONE: die des Geräts, genau wie vorher (toLocale* ohne timeZone). Das
 * Backend liefert Zeitpunkte in UTC; ein Gerät in Deutschland zeigt sie in
 * Europe/Berlin, mit Sommer- und Winterzeit. Bewusst NICHT fest Europe/Berlin
 * -- dieselbe Entscheidung wie bei kalendertag() in shared/eventFormatting.ts.
 *
 * NUR ANZEIGE: Nichts hiervon geht ans Backend. Werte für die API
 * (JJJJ-MM-TT, ISO) entstehen anderswo und bleiben unberührt.
 *
 * Ungültige oder leere Eingaben ergeben '' (keine „Invalid Date").
 * Neue Sonderformate verhindert der Test datumsformate.test.ts.
 */
type Zeitpunkt = Date | string | number | null | undefined;

const KURZ: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
const KURZ_OHNE_JAHR: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
const KURZ_MIT_WOCHENTAG: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' };
const LANG: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const UHRZEIT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

const alsDatum = (wert: Zeitpunkt): Date | null => {
  if (wert === null || wert === undefined || wert === '') return null;
  const d = wert instanceof Date ? wert : new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** 14.09.2026 -- oder 14.09. mit { ohneJahr: true }, Mo., 14.09.2026 mit { mitWochentag: true }. */
export const datumKurz = (
  wert: Zeitpunkt,
  { ohneJahr = false, mitWochentag = false }: { ohneJahr?: boolean; mitWochentag?: boolean } = {}
): string => {
  const d = alsDatum(wert);
  if (!d) return '';
  return d.toLocaleDateString('de-DE', mitWochentag ? KURZ_MIT_WOCHENTAG : ohneJahr ? KURZ_OHNE_JAHR : KURZ);
};

/** Montag, 14. September 2026 */
export const datumLang = (wert: Zeitpunkt): string => {
  const d = alsDatum(wert);
  return d ? d.toLocaleDateString('de-DE', LANG) : '';
};

/** 18:00 */
export const uhrzeit = (wert: Zeitpunkt): string => {
  const d = alsDatum(wert);
  return d ? d.toLocaleTimeString('de-DE', UHRZEIT) : '';
};

/** 14.09.2026, 18:00 -- oder 14.09., 18:00 mit { ohneJahr: true }. */
export const datumUhrzeit = (wert: Zeitpunkt, optionen: { ohneJahr?: boolean } = {}): string => {
  const d = alsDatum(wert);
  return d ? `${datumKurz(d, optionen)}, ${uhrzeit(d)}` : '';
};

export const isToday = (date: Date | string): boolean => {
  const today = new Date();
  const d = new Date(date);
  return today.toDateString() === d.toDateString();
};

/**
 * Converts a UTC date string to user's local time
 */
export const parseLocalTime = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  // Create date from UTC string - this automatically converts to local time
  const date = new Date(dateString);
  return date;
};

/**
 * Gets current time in user's timezone
 */
export const getLocalNow = (): Date => {
  return new Date();
};



// Am 10.09.2026 entfernt, alle ohne Aufrufer im Frontend: getWeekOfYear,
// getRelativeTime, isThisWeek und getUserTimezone. getYearWeek bleibt, sie
// wird gebraucht.
// Am 27.09.2026 entfernt, ohne Aufrufer: formatDate(datum, format) und
// formatDateTime -- ersetzt durch datumKurz und datumUhrzeit oben.