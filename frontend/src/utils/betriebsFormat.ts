// Die Schreibweise der Betriebs-Kennzahlen (Seite "Betrieb"): Zahlen, Dauern,
// "vor 3 Std", die Farbe einer Dauer und eines Status. Eine Stelle fuer die
// Seite der App (admin/pages/AdminMetricsPage.tsx) und ihre Web-Fassung
// (admin/web/leitung/WebBetrieb.tsx) -- sonst liest dieselbe Zahl in beiden anders.
//
// Die Urteile selbst (Zustand, Apdex, Vergleich) stehen in betriebsKennzahlen.ts.

import { METRIK_AMPEL } from '../theme/colors';

/** "3 T 4 Std", "5 Std 12 Min", "42 Min" -- wie lange der Server schon laeuft. */
export const fmtUptime = (s: number): string => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  return `${m} Min`;
};

/** Eine Zahl mit deutschem Tausenderpunkt. */
export const fmtZahl = (n: number): string => n.toLocaleString('de-DE');

/** Millisekunden lesbar: unter einer Sekunde in ms, darueber in s bzw. Min. */
export const fmtDauer = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  return `${Math.round(ms / 60000)} Min`;
};

/**
 * "vor 3 Std" statt einer nackten Uhrzeit -- bei der Frage "seit wann geht das
 * so" ist die Spanne die Antwort, nicht der Zeitpunkt.
 */
export const fmtSeit = (iso: string): string => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std`;
  return `vor ${Math.round(std / 24)} T`;
};

/** Die Ampelfarbe (Token) einer Dauer: unter 200 ms gut, ab 1 s kritisch. */
export const msColor = (ms: number): string => (
  ms >= 1000 ? METRIK_AMPEL.kritisch : ms >= 500 ? METRIK_AMPEL.erhoeht : ms >= 200 ? METRIK_AMPEL.maessig : METRIK_AMPEL.gut
);

/** Die Ampelfarbe (Token) eines Status: ab 500 kritisch, ab 400 erhoeht. */
export const statusColor = (status: number): string => (
  status >= 500 ? METRIK_AMPEL.kritisch : status >= 400 ? METRIK_AMPEL.erhoeht : METRIK_AMPEL.gut
);

/** Was ein Status heisst: "Serverfehler", "nicht gefunden", "abgelehnt" ... */
export const statusBezeichnung = (status: number): string => (
  status >= 500 ? 'Serverfehler' : status === 404 ? 'nicht gefunden' : status === 403 ? 'abgelehnt' : status === 401 ? 'nicht angemeldet' : 'abgewiesen'
);

/**
 * Wie eine Veraenderung "heute gegen sonst" aussieht: der Pfeil und -- ab 10 %
 * Abweichung -- eine Farbe. Darunter ist es Rauschen und bekommt keine, sonst
 * leuchtet jeden Morgen irgendetwas rot, ohne dass etwas passiert waere. Mehr
 * Anfragen sind Nutzung, kein Problem ("neutral"): dort nur die Richtung.
 */
export function vergleichAnzeige(
  delta: number | null,
  bewertung: 'neutral' | 'wenigerIstBesser',
): { merklich: boolean; farbe: string; pfeil: string } {
  const merklich = delta !== null && Math.abs(delta) >= 10;
  const farbe = !merklich || bewertung === 'neutral'
    ? 'var(--app-text-system)'
    : delta! > 0 ? METRIK_AMPEL.erhoeht : METRIK_AMPEL.gut;
  const pfeil = delta === null ? '' : delta > 0 ? '▲' : delta < 0 ? '▼' : '=';
  return { merklich, farbe, pfeil };
}
