// Ein Schalter der Web-Fassung (an/aus), z. B. "Testphase". Ein echtes
// Ankreuzfeld mit role="switch" -- die Leertaste schaltet, der Zustand steht
// in aria-checked, der Name ist der Text daneben.

import React, { useId } from 'react';

export interface WebSchalterProps {
  label: string;
  an: boolean;
  onAn: (an: boolean) => void;
  deaktiviert?: boolean;
  hinweis?: string;
}

const WebSchalter: React.FC<WebSchalterProps> = ({ label, an, onAn, deaktiviert = false, hinweis }) => {
  const id = useId();
  const hinweisId = `${id}-hinweis`;
  return (
    <div className="web-feld">
      <label className="web-schalter">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="web-schalter__eingabe"
          checked={an}
          disabled={deaktiviert}
          aria-checked={an}
          aria-describedby={hinweis ? hinweisId : undefined}
          onChange={(e) => onAn(e.target.checked)}
        />
        <span className="web-schalter__spur" aria-hidden="true"><span className="web-schalter__knopf" /></span>
        <span className="web-schalter__text">{label}</span>
      </label>
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </div>
  );
};

export default WebSchalter;
