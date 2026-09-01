import { useLocation } from 'react-router-dom';

// Einziger Zugriff der App auf den Standort des Routers.
//
// Neun Dateien importierten `useLocation` direkt aus react-router-dom — der
// letzte ungeschuetzte Direktzugriff. Nach diesem Hook importiert ausserhalb
// von src/navigation/ keine einzige Datei mehr react-router. Beim naechsten
// Router-Wechsel (nach Ionic 8 -> 9 kommt irgendwann der uebernaechste) ist
// dieses Verzeichnis die einzige Stelle, die angefasst werden muss.
//
// Die Form ist in react-router 5 und 6 identisch — der Hook kostet heute
// nichts und spart spaeter neun Aenderungen.

export interface AppLocation {
  pathname: string;
  search: string;
  state: unknown;
}

export const useAppLocation = (): AppLocation => {
  const loc = useLocation();
  return { pathname: loc.pathname, search: loc.search, state: loc.state };
};
