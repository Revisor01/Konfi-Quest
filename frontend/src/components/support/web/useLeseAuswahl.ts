// Was im Lesebereich der Web-Fassung gewählt ist (web/WebPostfach): Die
// Adresse folgt der Wahl (…/vorgaenge/5), ohne dass Ionic eine neue Seite
// aufbaut -- Neuladen und Lesezeichen öffnen denselben Eintrag, und der
// Zurück-Knopf des Browsers springt nicht durch jede angesehene Mail.

import { useCallback, useState } from 'react';

/** Die gewählte Kennung und das Wählen; die Adresse zeigt immer auf sie. */
export function useLeseAuswahl(basis: string, roherStart: number | null = null): [number | null, (id: number | null) => void] {
  // Nur eine echte Kennung waehlt etwas: „/post/abc" ergibt NaN, und NaN ist
  // sich selbst nie gleich -- das Nachziehen unten liefe endlos.
  const start = roherStart !== null && Number.isInteger(roherStart) && roherStart > 0 ? roherStart : null;
  const [gewaehlt, setGewaehlt] = useState<number | null>(start);
  // Ionic hält Seiten im Speicher: Kommt dieselbe Seite mit einer anderen
  // Kennung wieder, gilt die neue (nachgezogen beim Rendern).
  const [letzterStart, setLetzterStart] = useState(start);
  if (start !== letzterStart) {
    setLetzterStart(start);
    setGewaehlt(start);
  }

  const waehlen = useCallback((id: number | null) => {
    setGewaehlt(id);
    if (typeof window === 'undefined') return;
    const pfad = id === null ? basis : `${basis}/${id}`;
    if (window.location.pathname !== pfad) {
      window.history.replaceState(window.history.state, '', `${pfad}${window.location.search}`);
    }
  }, [basis]);

  return [gewaehlt, waehlen];
}

