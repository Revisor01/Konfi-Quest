// Ein Fortschrittsbalken der Web-Fassung (Punkte gegen Ziel, Level, Badge).
// Ein echtes `progressbar` mit Name und Wert für Vorleseprogramme; die Breite
// ist auf 100 Prozent begrenzt, die Zahl daneben darf darüber hinausgehen.

import React from 'react';
import '../../../theme/web/start.css';

export interface WebFortschrittProps {
  /** Wert in Prozent (0 bis 100 und darüber; der Balken füllt höchstens ganz). */
  prozent: number;
  /** Name für Vorleseprogramme: „Gottesdienst-Punkte". */
  beschriftung: string;
  /** Farbton des Balkens. */
  ton?: 'gesamt' | 'gottesdienst' | 'gemeinde' | 'level' | 'info';
  /** Satz für Vorleseprogramme, z. B. „8 von 10". */
  wertText?: string;
}

const WebFortschritt: React.FC<WebFortschrittProps> = ({ prozent, beschriftung, ton = 'info', wertText }) => {
  const gerundet = Math.max(0, Math.round(prozent));
  const breite = Math.min(gerundet, 100);
  return (
    <div
      className="web-fortschritt"
      role="progressbar"
      aria-label={beschriftung}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={breite}
      aria-valuetext={wertText ?? `${gerundet} Prozent`}
    >
      <span className={`web-fortschritt__fuellung web-fortschritt__fuellung--${ton}`} style={{ width: `${breite}%` }} />
    </div>
  );
};

export default WebFortschritt;
