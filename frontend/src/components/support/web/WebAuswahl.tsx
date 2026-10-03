// Auswahl der Web-Fassung: ein echtes <select> mit sichtbarer Beschriftung --
// bedienbar mit Tastatur und Vorleseprogramm wie jedes Auswahlfeld des
// Browsers. Optionswerte sind Text; wer Zahlen braucht, wandelt am Rand.

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN } from '../../shared/icons';

export interface WebOption {
  wert: string;
  label: string;
}

export interface WebAuswahlProps {
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  optionen: ReadonlyArray<WebOption>;
  pflicht?: boolean;
  deaktiviert?: boolean;
  hinweis?: string;
}

const WebAuswahl: React.FC<WebAuswahlProps> = ({ label, wert, onWert, optionen, pflicht = false, deaktiviert = false, hinweis }) => {
  const id = useId();
  const hinweisId = `${id}-hinweis`;
  return (
    <div className="web-feld">
      <label htmlFor={id} className={pflicht ? 'web-feld__label web-feld__label--pflicht' : 'web-feld__label'}>{label}</label>
      <div className="web-auswahl">
        <select
          id={id}
          className="web-eingabe web-eingabe--auswahl"
          value={wert}
          disabled={deaktiviert}
          aria-required={pflicht ? 'true' : undefined}
          aria-describedby={hinweis ? hinweisId : undefined}
          onChange={(e) => onWert(e.target.value)}
        >
          {optionen.map((o) => <option key={o.wert} value={o.wert}>{o.label}</option>)}
        </select>
        <IonIcon icon={ICON_AUFKLAPPEN} className="web-auswahl__pfeil" aria-hidden="true" />
      </div>
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </div>
  );
};

export default WebAuswahl;
