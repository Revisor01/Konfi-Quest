import { useCallback, useState } from 'react';

/**
 * Lange Listen schrittweise zeigen (Audit 26.09.2026, Leitung BF-14).
 *
 * GEMESSEN am 29.09.2026 (Chromium, Android-Kennung, 390 x 844, CPU 4-fach
 * gedrosselt, lokale Instanz mit 150 Konfis, 500 Antraegen, 120 Events;
 * Median aus 6 Laeufen, vorher und nachher abwechselnd): Die Leitungs-Listen
 * rendern jede Zeile als IonItemSliding mit Schatten-DOM.
 *   - "Verbucht" (416 Antraege): 10,5 s -> 1,1 s bis zur letzten Zeile,
 *     laengster Hauptthread-Block 6,3 s -> 0,4 s;
 *   - Konfi-Liste (150 Konfis) oeffnen: 3,1 s -> 1,7 s;
 *   - Events (62 anstehende): 2,0 s -> 2,0 s -- dort traegt die Seite selbst
 *     den Grossteil, die Zeilen wenig;
 *   - naechste 30 Zeilen beim Scrollen: 1,0 s;
 *   - Tastendruck in der Konfi-Suche: 0,4 s vorher, 0,5 s nachher -- bleibt
 *     (React gleicht die Zeilen ueber ihre Schluessel ab, die Kosten liegen
 *     nicht im Anzahl-Rendern).
 * Ohne Drosselung vorher 2,7 s ("Verbucht") und 1,0 s (Konfis).
 *
 * DER WEG: Nur die ersten `schritt` Zeilen rendern; weitere kommen dazu, wenn
 * man nach unten scrollt (IonInfiniteScroll, shared/WeitereEintraege.tsx)
 * oder den Knopf darunter antippt. Suche, Filter und Sortierung laufen weiter
 * ueber die GANZE Liste -- nur das Rendern ist begrenzt, Zaehler und Treffer
 * bleiben vollstaendig.
 *
 * BEWUSST KEINE echte Virtualisierung (Zeilen ausserhalb des Bildes
 * entfernen): IonItemSliding, die Wisch-Aktionen, Pull-to-refresh und die
 * Kopfzeilen haengen am normalen Dokumentfluss im IonContent. Schrittweises
 * Anhaengen aendert daran nichts; einmal gerenderte Zeilen bleiben stehen.
 *
 * `zuruecksetzenBei`: ein Schluessel aus Suche/Filter/Reiter. Aendert er sich,
 * beginnt die Liste wieder mit dem ersten Schritt -- im SELBEN Render, damit
 * ein Tastendruck nie erst die alte, lange Liste neu zeichnet.
 */
export const LISTE_SCHRITT = 30;

export function useSchrittweiseListe<T>(
  eintraege: T[],
  zuruecksetzenBei: string,
  schritt: number = LISTE_SCHRITT,
): { sichtbar: T[]; weitere: number; mehrZeigen: () => void } {
  const [stand, setStand] = useState({ schluessel: zuruecksetzenBei, anzahl: schritt });

  let anzahl = stand.anzahl;
  if (stand.schluessel !== zuruecksetzenBei) {
    // Abgeleiteter Zustand nach React-Muster: waehrend des Renderns
    // zuruecksetzen, React verwirft diesen Durchlauf und rendert sofort neu.
    setStand({ schluessel: zuruecksetzenBei, anzahl: schritt });
    anzahl = schritt;
  }

  const sichtbar = eintraege.length > anzahl ? eintraege.slice(0, anzahl) : eintraege;
  const weitere = eintraege.length - sichtbar.length;
  const mehrZeigen = useCallback(() => {
    setStand((s) => ({ ...s, anzahl: s.anzahl + schritt }));
  }, [schritt]);

  return { sichtbar, weitere, mehrZeigen };
}
