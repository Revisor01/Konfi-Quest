// Datums- und Zeitfeld der Web-Fassung (11.10.2026): ein echtes
// <input type="date|datetime-local|time"> mit sichtbarer Beschriftung --
// der Browser bringt Kalender, Tastatureingabe und das Format der Sprache
// mit. Die App nimmt dafuer ein Ionic-Fenster (IonDatetimeButton), das im
// Browser als zweites Modal aufgeht.
//
// Werte: dieselben lokalen Zeichenketten wie in den Formularen der App --
// "2026-10-11" (Datum), "2026-10-11T18:30:00" (Datum und Uhrzeit, lokal ohne
// Zeitzone, wie toIonDatetimeISO in utils/terminVorbelegung.ts), "18:30"
// (Uhrzeit). Ein laengerer Wert (ISO mit Uhrzeit) wird fuer das Feld
// gekuerzt; das Feld gibt immer die Form seiner Art zurueck. Wer ans
// Backend schickt, wandelt wie bisher (toBackendTimestamp).

import React, { useId } from 'react';
import { type WebDatumArt, INPUT_TYP, fuerFeld, ausFeld } from './webDatumWert';

export type { WebDatumArt };

export interface WebDatumProps {
  label: string;
  art: WebDatumArt;
  wert: string;
  onWert: (wert: string) => void;
  pflicht?: boolean;
  /** Frühester und spätester Wert, in derselben Form wie `wert`. */
  min?: string;
  max?: string;
  /** Schrittweite in Sekunden (z. B. 900 für Viertelstunden). */
  schritt?: number;
  hinweis?: string;
  deaktiviert?: boolean;
}

const WebDatum: React.FC<WebDatumProps> = ({
  label, art, wert, onWert, pflicht = false, min, max, schritt, hinweis, deaktiviert = false,
}) => {
  const id = useId();
  const hinweisId = `${id}-hinweis`;
  return (
    <div className="web-feld">
      <label htmlFor={id} className={pflicht ? 'web-feld__label web-feld__label--pflicht' : 'web-feld__label'}>{label}</label>
      <input
        id={id}
        className="web-eingabe web-eingabe--datum"
        type={INPUT_TYP[art]}
        value={fuerFeld(wert, art)}
        min={min ? fuerFeld(min, art) : undefined}
        max={max ? fuerFeld(max, art) : undefined}
        step={schritt}
        disabled={deaktiviert}
        aria-required={pflicht ? 'true' : undefined}
        aria-describedby={hinweis ? hinweisId : undefined}
        onChange={(e) => onWert(ausFeld(e.target.value, art))}
      />
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </div>
  );
};

export default WebDatum;
