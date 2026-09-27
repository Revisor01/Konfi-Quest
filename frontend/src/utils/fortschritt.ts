// Die Texte der Fortschrittsanzeige beim Laden und Senden von Dateien —
// EINMAL, für Chat und Challenges (27.09.2026). Der Balken dazu ist
// components/shared/FortschrittsBalken.tsx.
//
// Entstanden im Chat (11.09.2026, Simon: Wer eine PDF antippte, sah nichts
// passieren und tippte weiter). Seit dem 27.09.2026 zeigen auch die Bilder,
// Videos und Aufnahmen der Challenges genau diese Anzeige (Simon: "Und wir
// brauchen die gleichen Systeme wie Download-Fortschritt etc. bei
// Challenges.").

/**
 * "Wird geladen… 40 %" — oder ohne Zahl, solange der Server keine Größe
 * meldet. Dann läuft die Anzeige unbestimmt statt auf einer geratenen Zahl.
 */
export const ladeText = (prozent: number | null | undefined): string =>
  prozent != null ? `Wird geladen… ${prozent} %` : 'Wird geladen…';

/**
 * "Wird gesendet… 40 %". Bei 100 % rechnet der Server noch (Bild umrechnen,
 * verschlüsseln) — ein Balken, der bei 100 stehenbleibt, sähe sonst aus wie
 * ein Hänger.
 */
export const sendeText = (prozent: number): string =>
  prozent >= 100 ? 'Wird verarbeitet…' : `Wird gesendet… ${prozent} %`;
