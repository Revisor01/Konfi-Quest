// Filter-Chips mit Zahl der Challenge-Seiten in der Web-Fassung: genau einer
// ist gewaehlt (aria-pressed). Wie WebChips (components/web/WebChips.tsx),
// dazu die ORANGE Zahl fuer Wartendes -- wie am Reiter der App (SegmentZahl):
// so viele Beitraege warten auf Freigabe. Rot steht bei Challenges fuer
// Neues, orange fuer Wartendes; die beiden werden nicht vermischt.

import React from 'react';
import '../../../../theme/web/challenges.css';

export interface WebChallengeChip<W extends string> {
  wert: W;
  label: string;
  /** Zahl hinter dem Namen; fehlt sie, steht keine da. */
  zahl?: number;
  /** Farbe der Zahl, wenn sie groesser als 0 ist: orange fuer Wartendes. */
  ton?: 'orange';
  /** Satz fuer Vorleseprogramme hinter der Zahl ("Beiträge warten auf Freigabe"). */
  zahlText?: string;
}

export interface WebChallengeChipsProps<W extends string> {
  /** Name der Gruppe fuer Vorleseprogramme. */
  beschriftung: string;
  chips: ReadonlyArray<WebChallengeChip<W>>;
  wert: W;
  onWert: (wert: W) => void;
}

function WebChallengeChips<W extends string>({ beschriftung, chips, wert, onWert }: WebChallengeChipsProps<W>): React.ReactElement {
  return (
    <div className="web-chips" role="group" aria-label={beschriftung}>
      {chips.map((c) => (
        <button key={c.wert} type="button" className="web-chip" aria-pressed={c.wert === wert} onClick={() => onWert(c.wert)}>
          {c.label}
          {c.zahl !== undefined && (
            <span className={c.ton === 'orange' && c.zahl > 0 ? 'web-chip__zahl web-chip__zahl--orange' : 'web-chip__zahl'}>
              {c.zahl}
              {c.zahlText && c.zahl > 0 && <span className="web-nur-vorlesen"> {c.zahlText}</span>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default WebChallengeChips;
