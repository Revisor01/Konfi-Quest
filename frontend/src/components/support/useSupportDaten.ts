// Daten einer Web-Seite der Support-Ansicht laden und aktuell halten.
//
// `useWebDaten` laedt beim ersten Einhaengen und beim Zurueckkehren auf die
// Seite. Ionic haelt besuchte Seiten aber im Speicher: Aendert eine andere
// Seite etwas (Status gesetzt, Mail gelesen, einsortiert), steht diese hier
// weiter mit dem alten Stand da. Darum laedt sie zusaetzlich bei jeder Meldung
// „Support-Daten geaendert" und beim Wiederaufnehmen des Fensters
// (utils/supportAktualisieren.ts, docs/planung/support-vorgaenge.md,
// Entscheidung 8). Das Zurueckkehren uebernimmt useWebDaten schon.

import { useWebDaten, type WebDaten } from '../web/useWebDaten';
import { useSupportGeaendert } from '../../utils/supportAktualisieren';

export function useSupportDaten<T>(lader: () => Promise<T>): WebDaten<T> {
  const daten = useWebDaten(lader);
  useSupportGeaendert(daten.neuLaden, { beimBetreten: false });
  return daten;
}
