// Das Symbol einer Rückfrage der Web-Fassung: ein rot (Löschen) bzw. orange
// (Warnung) hinterlegter Kreis mit Mülleimer bzw. Warndreieck -- dasselbe,
// das die Rückfragen der App (ion-alert, utils/rueckfragenOptik.ts) über
// ihrem Titel tragen (Simon im Seiten-Interview, 13.10.2026: „die
// loeschenmodal duerften ein symbol haben und einen roten button").
//
// Es steht im Kopf eines WebDialog mit `rueckfrage` und, `klein`, vorn in
// einer Rückfrage, die in einer Zeile nachfragt (Datei löschen im Material).
// Farben und Größe stehen in theme/rueckfragen.css (Teil 4). Das Symbol ist
// Schmuck; was gefragt wird, sagen Titel und Knopf.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { RUECKFRAGE_SYMBOLE, type RueckfrageArt } from '../../utils/rueckfragenOptik';

export interface WebRueckfrageSymbolProps {
  art: RueckfrageArt;
  /** Kleiner, für eine Rückfrage in einer Zeile. */
  klein?: boolean;
}

const WebRueckfrageSymbol: React.FC<WebRueckfrageSymbolProps> = ({ art, klein = false }) => (
  <span
    className={`web-rueckfrage-symbol web-rueckfrage-symbol--${art}${klein ? ' web-rueckfrage-symbol--klein' : ''}`}
    aria-hidden="true"
  >
    <IonIcon icon={RUECKFRAGE_SYMBOLE[art]} />
  </span>
);

export default WebRueckfrageSymbol;
