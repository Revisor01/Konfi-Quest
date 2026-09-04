// Zentrale Stelle für wiederkehrende Icons.
//
// Warum (Simon, 04.09.2026): "Wir könnten Icons global tauschen, sodass wir
// die an einer Stelle nur definieren müssen. Ich überlege, mittels Icon dem
// Ganzen noch mal einen etwas anderen Look zu geben."
//
// Vorher stand `arrowBack` an 34 Stellen einzeln importiert — ein Wechsel
// hätte 34 Dateien angefasst und dabei zuverlässig eine vergessen.
//
// ZUR STRICHSTÄRKE: Ionicons hat KEINE dünnere Variante. Alle Strich-Icons
// nutzen stroke-width 48 bei einer Zeichenfläche von 512, auch die
// `-outline`-Namen (die sind bei Pfeil und Chevron identisch mit der
// Basisvariante). Leichter wirkt der Chevron, weil ihm der lange Querstrich
// des Pfeils fehlt — halb so viel Tinte bei gleicher Stärke. Wer es wirklich
// dünner will, braucht ein eigenes SVG mit stroke-width 24-32.
import { chevronBack } from 'ionicons/icons';

/**
 * Zurück-Pfeil in Kopfzeilen.
 *
 * Seit 04.09.2026 der Chevron statt `arrowBack`: schlanker im Erscheinen und
 * zugleich das auf iOS übliche Zurück-Zeichen. Zum Ändern des Looks reicht
 * es, hier ein anderes Icon zuzuweisen.
 */
export const ICON_ZURUECK = chevronBack;
