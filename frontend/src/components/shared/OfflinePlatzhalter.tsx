import React from 'react';
import { IonIcon } from '@ionic/react';
import { cloudOfflineOutline } from 'ionicons/icons';

/**
 * Eine Zeile, die sagt, was gerade fehlt — statt einen Abschnitt kommentarlos
 * auszublenden.
 *
 * Simons Kritik vom 29.08.2026: "nichtmal dann weiß ich, ob es richtig
 * angezeigt wird". Detailansichten zeigten offline ihren Grundstand aus dem
 * Listen-Cache, aber Abschnitte, deren Daten an der Detail-Route haengen
 * (Zeitfenster, Teilnehmerliste, Anwesenheit), verschwanden wortlos: Die
 * Bedingung lautete `length > 0`, und offline blieb die Liste eben leer.
 * Wer die Seite so sah, konnte nicht unterscheiden, ob es keine Teilnehmer
 * gibt oder ob sie nur nicht geladen wurden.
 *
 * Bewusst schmal gehalten: eine graue Zeile mit Wolken-Symbol, kein Alarm.
 * Dass etwas fehlt, ist eine Information, kein Fehler.
 */
interface Props {
  /** Was fehlt, im Nominativ Plural — z.B. "Die Teilnehmerliste". */
  was: string;
}

const OfflinePlatzhalter: React.FC<Props> = ({ was }) => (
  <div className="app-offline-platzhalter">
    <IonIcon icon={cloudOfflineOutline} aria-hidden="true" />
    <span>{was} ist offline nicht verfügbar.</span>
  </div>
);

export default OfflinePlatzhalter;
