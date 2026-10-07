// Angaben als Liste "Bezeichnung -- Wert" (<dl>): fuer die Karten "Angaben"
// und "Gemeinde" der Detailseiten. Die Bezeichnung steht links, der Wert
// rechts; Werte brechen um, statt die Karte zu sprengen. Vor der Bezeichnung
// steht immer das Symbol der App in ihrer Farbe (Simon, 07.10.2026: „also
// angaben immer mit icons") -- aus der Tabelle angabeSymbole.ts, oder von der
// Seite mitgegeben.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { angabeSymbol } from './angabeSymbole';

export interface WebAngabe {
  label: string;
  /** Fehlt der Wert (null, false, leer), steht ein Strich. */
  wert: React.ReactNode;
  /** Symbol vor der Bezeichnung; sonst aus der Tabelle (angabeSymbole.ts). */
  icon?: string;
  /** Farbe des Symbols als Klasse der App (app-icon-color--events ...). */
  iconKlasse?: string;
}

const fehlt = (wert: React.ReactNode): boolean => wert === null || wert === undefined || wert === false || wert === '';

const WebAngaben: React.FC<{ angaben: ReadonlyArray<WebAngabe>; beschriftung?: string }> = ({ angaben, beschriftung }) => (
  <dl className="web-angaben" aria-label={beschriftung}>
    {angaben.map((a) => {
      const tabelle = angabeSymbol(a.label);
      const icon = a.icon ?? tabelle.symbol.icon;
      const klasse = a.icon ? a.iconKlasse : tabelle.symbol.klasse;
      return (
      <div key={a.label} className="web-angaben__zeile">
        <dt className="web-angaben__label">
          <IonIcon
            icon={icon}
            className={['web-angaben__icon', klasse ?? ''].filter(Boolean).join(' ')}
            data-symbol={!a.icon && tabelle.ersatz ? 'ersatz' : undefined}
            aria-hidden="true"
          />
          {a.label}
        </dt>
        <dd className="web-angaben__wert">{fehlt(a.wert) ? <span className="web-gedaempft">–</span> : a.wert}</dd>
      </div>
      );
    })}
  </dl>
);

export default WebAngaben;
