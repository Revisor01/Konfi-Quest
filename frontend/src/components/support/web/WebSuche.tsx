// Suchfeld der Web-Fassung: ein natives <input type="search"> mit Symbol und
// Leeren-Knopf -- Live-Suche, ohne Absenden. Der Name fuer Vorleseprogramme
// ist `beschriftung` (aria-label), der Platzhalter nur ein Beispiel.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SCHLIESSEN, ICON_SUCHE } from '../../shared/icons';
import WebKnopf from './WebKnopf';

export interface WebSucheProps {
  beschriftung: string;
  platzhalter?: string;
  wert: string;
  onWert: (wert: string) => void;
}

const WebSuche: React.FC<WebSucheProps> = ({ beschriftung, platzhalter, wert, onWert }) => (
  <div className="web-suche" role="search">
    <IonIcon icon={ICON_SUCHE} className="web-suche__symbol" aria-hidden="true" />
    <input
      type="search"
      className="web-suche__eingabe"
      aria-label={beschriftung}
      placeholder={platzhalter}
      value={wert}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => onWert(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape' && wert) { e.preventDefault(); onWert(''); } }}
    />
    {wert && (
      <span className="web-suche__leeren">
        <WebKnopf art="text" klein symbol aria-label="Suchbegriff löschen" title="Suchbegriff löschen" onClick={() => onWert('')}>
          <IonIcon icon={ICON_SCHLIESSEN} aria-hidden="true" />
        </WebKnopf>
      </span>
    )}
  </div>
);

export default WebSuche;
