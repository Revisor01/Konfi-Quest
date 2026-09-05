// Zentrale Stelle für wiederkehrende Icons.
//
// Warum (Simon, 04.09.2026): "Wir könnten Icons global tauschen, sodass wir
// die an einer Stelle nur definieren müssen. Ich überlege, mittels Icon dem
// Ganzen noch mal einen etwas anderen Look zu geben."
//
// Vorher stand `arrowBack` an 34 Stellen einzeln importiert — ein Wechsel
// hätte 34 Dateien angefasst und dabei zuverlässig eine vergessen.

/**
 * Zurück-Pfeil in Kopfzeilen.
 *
 * Eigenes SVG im Heroicons-Stil (Simons Wunsch, 05.09.2026: "einen coolen
 * Zurückpfeil ... Heroicons finde ich gut").
 *
 * ZUR STRICHSTÄRKE — der Grund für das eigene SVG: Ionicons hat KEINE dünnere
 * Variante. Alle Strich-Icons dort nutzen stroke-width 48 auf einer
 * Zeichenfläche von 512, das entspricht 2.25 auf 24er-Fläche. Auch die
 * `-outline`-Namen sind bei Pfeil und Chevron mit der Basisvariante identisch.
 * Heroicons "outline" zeichnet mit 1.5 auf 24 — ein Drittel dünner, und genau
 * das macht den leichteren, moderneren Eindruck.
 *
 * Als Data-URL, weil IonIcon `icon` entweder einen Ionicons-Namen ODER eine
 * URL entgegennimmt. Kein zusätzliches Paket, keine Netzabfrage, und der
 * Strich erbt über `stroke="currentColor"` die Farbe der Umgebung — sonst
 * bliebe der Pfeil im Dunkelmodus schwarz.
 *
 * Zum Ändern des Looks reicht es, hier ein anderes Icon zuzuweisen.
 */
const ZURUECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>`;

export const ICON_ZURUECK = `data:image/svg+xml,${encodeURIComponent(ZURUECK_SVG)}`;
