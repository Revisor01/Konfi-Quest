// Mehrzeiliges Feld der Web-Fassung (Antwort, Notiz, Baustein, Fusszeile):
// wie WebFeld, aber ein <textarea>. Die Zeilenzahl ist die Starthoehe; das
// Feld laesst sich in der Hoehe ziehen.

import React, { useId } from 'react';

export interface WebTextfeldProps {
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  pflicht?: boolean;
  zeilen?: number;
  hinweis?: string;
  deaktiviert?: boolean;
}

const WebTextfeld: React.FC<WebTextfeldProps> = ({
  label, wert, onWert, pflicht = false, zeilen = 6, hinweis, deaktiviert = false,
}) => {
  const id = useId();
  const hinweisId = `${id}-hinweis`;
  return (
    <div className="web-feld">
      <label htmlFor={id} className={pflicht ? 'web-feld__label web-feld__label--pflicht' : 'web-feld__label'}>{label}</label>
      <textarea
        id={id}
        className="web-eingabe web-eingabe--text"
        rows={zeilen}
        value={wert}
        disabled={deaktiviert}
        aria-required={pflicht ? 'true' : undefined}
        aria-describedby={hinweis ? hinweisId : undefined}
        onChange={(e) => onWert(e.target.value)}
      />
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </div>
  );
};

export default WebTextfeld;
