// Die Tabelle der Web-Fassung steht seit 10.10.2026 in WebListe.tsx -- EINE
// Tabelle fuer alle Seiten (sortiert selbst nach `sortWert` oder nach der
// Ordnung der Seite, mit Namenszelle, Aktionen und Leerzustand). Dieser Name
// reicht nur noch durch, bis keine Seite ihn mehr nutzt; neue Seiten nehmen
// WebListe (oder gleich WebListenSeite).

import WebListe from './WebListe';

export { WebSortKopf, type WebSpalte, type WebListeProps as WebTabelleProps } from './WebListe';
export default WebListe;
