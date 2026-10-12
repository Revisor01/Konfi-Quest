// Was im Lesebereich der Web-Fassung gewählt ist (web/WebPostfach): Die
// Adresse folgt der Wahl (…/vorgaenge/5), ohne dass Ionic eine neue Seite
// aufbaut -- Neuladen und Lesezeichen öffnen denselben Eintrag, und der
// Zurück-Knopf des Browsers springt nicht durch jede angesehene Mail.
//
// Die übrige Abfrage (?gemeinde=7, ?filter=neu) bleibt beim Wählen stehen,
// `?mail=` nicht: Es gilt nur dem Eintrag, mit dem die Seite geöffnet wurde
// (docs/planung/support-detailseiten.md, E). Bis 11.10.2026 hing es an
// jeder neuen Adresse.
//
// Ionic hält Seiten im Speicher. Betritt man die Seite eines Eintrags wieder
// (…/vorgaenge/1 aus der Übersicht, zum zweiten Mal), gilt der Eintrag der
// Adresse -- auch wenn man zwischendurch in der Liste einen anderen gewählt
// hatte (bis 12.10.2026 blieb der stehen, die Adresse nannte einen anderen).
// Die Liste ohne Eintrag in der Adresse behält ihre Wahl.

import { useCallback, useState } from 'react';
import { useWiedereintritt } from './useWiedereintritt';

/** Die Abfrage ohne `mail` -- mit „?" davor, leer ohne Rest. */
function abfrageOhneMail(search: string): string {
  const abfrage = new URLSearchParams(search);
  abfrage.delete('mail');
  const rest = abfrage.toString();
  return rest ? `?${rest}` : '';
}

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
  // Wieder betreten mit einem Eintrag in der Adresse: dieser, auch wenn die Kennung dieselbe ist.
  const eintritt = useWiedereintritt();
  const [eintrittGesehen, setEintrittGesehen] = useState(eintritt);
  if (eintritt !== eintrittGesehen) {
    setEintrittGesehen(eintritt);
    if (start !== null) setGewaehlt(start);
  }

  const waehlen = useCallback((id: number | null) => {
    setGewaehlt(id);
    if (typeof window === 'undefined') return;
    const pfad = id === null ? basis : `${basis}/${id}`;
    const abfrage = abfrageOhneMail(window.location.search);
    if (window.location.pathname !== pfad || window.location.search !== abfrage) {
      window.history.replaceState(window.history.state, '', `${pfad}${abfrage}`);
    }
  }, [basis]);

  return [gewaehlt, waehlen];
}
