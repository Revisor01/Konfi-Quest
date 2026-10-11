import { useEffect } from 'react';

/**
 * Schreibt das breite Layout der Web-Version als `data-layout="breit"` an
 * <html> (Simon, 11.10.2026: „Web braucht eigene kompaktere Modale
 * überall"). theme/web-modale.css liest das Merkmal und stellt jedes
 * App-Modal im breiten Browserfenster kompakt dar: zentriert, so hoch wie
 * sein Inhalt, Radius und Schatten wie die Karten der Web-Fassung.
 *
 * WARUM AN <html> UND NICHT AM MODAL: Die App öffnet ihre Fenster an über
 * hundert Stellen (useIonModal, <IonModal>, Datumswähler). Ein Merkmal am
 * Dokument trifft sie alle, ohne dass ein Aufruf daran denken muss — wie
 * die Namen der Modale (utils/modalNamen.ts) und die Rollenfarbe
 * (rollenfarbeImDokument.ts). Und es folgt dem Fenster: Wer es unter
 * 992 px zieht, bekommt sofort wieder die Modale der App; Ionic zieht die
 * Größe eines offenen Modals nach, weil es --height beobachtet.
 *
 * Quelle ist dieselbe Frage wie für Leiste und Reiterleiste
 * (navigation/breitesLayout.ts). In den Apps ist sie nie wahr — dort steht
 * das Merkmal nie, auch nicht auf dem iPad quer.
 */
export function useLayoutImDokument(breit: boolean): void {
  useEffect(() => {
    if (!breit) return undefined;
    const wurzel = document.documentElement;
    wurzel.dataset.layout = 'breit';
    return () => {
      delete wurzel.dataset.layout;
    };
  }, [breit]);
}
