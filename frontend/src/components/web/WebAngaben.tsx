// Angaben als Liste "Bezeichnung -- Wert" (<dl>): fuer die Karten "Angaben"
// und "Gemeinde" der Detailseiten. Die Bezeichnung steht links, der Wert
// rechts; Werte brechen um, statt die Karte zu sprengen.

import React from 'react';

export interface WebAngabe {
  label: string;
  /** Fehlt der Wert (null, false, leer), steht ein Strich. */
  wert: React.ReactNode;
}

const fehlt = (wert: React.ReactNode): boolean => wert === null || wert === undefined || wert === false || wert === '';

const WebAngaben: React.FC<{ angaben: ReadonlyArray<WebAngabe>; beschriftung?: string }> = ({ angaben, beschriftung }) => (
  <dl className="web-angaben" aria-label={beschriftung}>
    {angaben.map((a) => (
      <div key={a.label} className="web-angaben__zeile">
        <dt className="web-angaben__label">{a.label}</dt>
        <dd className="web-angaben__wert">{fehlt(a.wert) ? <span className="web-gedaempft">–</span> : a.wert}</dd>
      </div>
    ))}
  </dl>
);

export default WebAngaben;
