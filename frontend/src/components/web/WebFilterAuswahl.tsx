// Eine Auswahl in der Werkzeugzeile der Web-Fassung (Jahrgang, Sortieren):
// ein echtes <select>, der Name steht als aria-label -- kein Beschriftungstext
// darueber. Bis 10.10.2026 im Bereich der Leitung
// (admin/web/leitung/WebLeitungBausteine.tsx), seitdem fuer alle Listen-Seiten
// (WebListenSeite).

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN } from '../shared/icons';

export interface WebFilterOption {
  wert: string;
  label: string;
}

export interface WebFilterAuswahlProps {
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  optionen: ReadonlyArray<WebFilterOption>;
}

const WebFilterAuswahl: React.FC<WebFilterAuswahlProps> = ({ label, wert, onWert, optionen }) => (
  <div className="web-auswahl web-filterauswahl">
    <select className="web-eingabe web-eingabe--auswahl" aria-label={label} value={wert} onChange={(e) => onWert(e.target.value)}>
      {optionen.map((o) => <option key={o.wert} value={o.wert}>{o.label}</option>)}
    </select>
    <IonIcon icon={ICON_AUFKLAPPEN} className="web-auswahl__pfeil" aria-hidden="true" />
  </div>
);

export default WebFilterAuswahl;
