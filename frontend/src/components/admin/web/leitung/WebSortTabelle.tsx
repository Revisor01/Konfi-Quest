// Die Tabelle mit Spalten, die sich sortieren lassen, steht seit 10.10.2026 in
// components/web/WebListe.tsx -- dieselbe Tabelle wie WebTabelle, die Ordnung
// haelt auf Wunsch die Seite (`sortierung`/`onSortieren`). Dieser Name reicht
// nur noch durch, bis keine Seite ihn mehr nutzt (Benutzer:innen, offene
// Einladungen, Karten der Konfi-Detailseite).

import WebListe from '../../../web/WebListe';
import '../../../../theme/web/leitung.css';

export type { WebSpalte as WebSortSpalte, WebSortierung, WebListeProps as WebSortTabelleProps } from '../../../web/WebListe';
export default WebListe;
