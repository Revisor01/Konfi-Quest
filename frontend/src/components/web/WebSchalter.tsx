// Ein Schalter der Web-Fassung (an/aus), z. B. "Testphase". Ein echtes
// Ankreuzfeld mit role="switch" -- die Leertaste schaltet, der Zustand steht
// in aria-checked, der Name ist der Text daneben.
//
// `wartet`: Ein sofort speichernder Schalter, dessen Wechsel gerade zum Server
// geht (Benachrichtigungen). Er nimmt keinen weiteren Wechsel an und meldet
// sich als nicht verfügbar (aria-disabled), bleibt aber fokussierbar -- mit
// `disabled` verlöre er den Fokus, das Fenster holte ihn zu sich, und wer per
// Tastatur mehrere Schalter nacheinander umlegt, müsste jedes Mal neu vom X
// aus hinlaufen (Befund 15.10.2026).

import React, { useId } from 'react';

export interface WebSchalterProps {
  label: string;
  an: boolean;
  onAn: (an: boolean) => void;
  deaktiviert?: boolean;
  /** Wechsel wird gerade gespeichert: kein weiterer Wechsel, der Fokus bleibt. */
  wartet?: boolean;
  hinweis?: string;
}

const WebSchalter: React.FC<WebSchalterProps> = ({ label, an, onAn, deaktiviert = false, wartet = false, hinweis }) => {
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
          aria-disabled={wartet || undefined}
          aria-checked={an}
          aria-describedby={hinweis ? hinweisId : undefined}
          onChange={(e) => { if (!wartet) onAn(e.target.checked); }}
        />
        <span className="web-schalter__spur" aria-hidden="true"><span className="web-schalter__knopf" /></span>
        <span className="web-schalter__text">{label}</span>
      </label>
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </div>
  );
};

export default WebSchalter;
