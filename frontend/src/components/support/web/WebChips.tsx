// Filter-Chips mit Zahl der Web-Fassung. Genau einer ist gewaehlt
// (aria-pressed); eine rote Zahl (`rot`) zeigt etwas, das Arbeit macht
// (ungelesene, nicht zugeordnete Mails).

import React from 'react';

export interface WebChip<W extends string> {
  wert: W;
  label: string;
  /** Anzahl hinter dem Namen; fehlt sie, steht keine Zahl da. */
  zahl?: number;
  /** Die Zahl in Rot, wenn sie groesser als 0 ist. */
  rot?: boolean;
  /** Satz fuer Vorleseprogramme, z. B. "3 ungelesen". */
  zahlText?: string;
}

export interface WebChipsProps<W extends string> {
  /** Name der Gruppe fuer Vorleseprogramme ("Status", "Postfach"). */
  beschriftung: string;
  chips: ReadonlyArray<WebChip<W>>;
  wert: W;
  onWert: (wert: W) => void;
}

function WebChips<W extends string>({ beschriftung, chips, wert, onWert }: WebChipsProps<W>): React.ReactElement {
  return (
    <div className="web-chips" role="group" aria-label={beschriftung}>
      {chips.map((c) => (
        <button
          key={c.wert}
          type="button"
          className="web-chip"
          aria-pressed={c.wert === wert}
          onClick={() => onWert(c.wert)}
        >
          {c.label}
          {c.zahl !== undefined && (
            <span className={c.rot && c.zahl > 0 ? 'web-chip__zahl web-chip__zahl--rot' : 'web-chip__zahl'}>
              {c.zahl}
              {c.zahlText && c.zahl > 0 && <span className="web-nur-vorlesen"> {c.zahlText}</span>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default WebChips;
