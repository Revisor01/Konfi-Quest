// Kennzahl-Kachel der Web-Fassung: kleines Etikett, grosse Zahl, darunter
// ein Zusatz und -- wenn es eine Reihe dazu gibt -- eine kleine Linie. Mit
// `href` ist die ganze Kachel ein Link (offene Anfragen -> Anfragen).
// Mit `symbol` steht vor dem Etikett das Symbol der Kennzahl in seiner
// Bereichsfarbe (KENNZAHL_SYMBOL; Simon, 10.10.2026).

import React from 'react';
import { IonIcon } from '@ionic/react';
import WebLink from './WebLink';
import type { KennzahlSymbol } from './kennzahlSymbole';

export interface WebKachelProps {
  label: string;
  /** Die Zahl, schon formatiert ("1.265"). */
  wert: string;
  /** Eine oder mehrere Zeilen darunter. */
  zusatz?: React.ReactNode[];
  /** Eine kleine Linie rechts neben dem Etikett (WebSpark). */
  spark?: React.ReactNode;
  href?: string;
  /** Symbol und Bereichsfarbe vor dem Etikett (aus KENNZAHL_SYMBOL). */
  symbol?: KennzahlSymbol;
  /** Hebt die Kachel hervor (offene Aufgaben). */
  achtung?: boolean;
  /** Satz fuer Vorleseprogramme, wenn er von "Etikett: Zahl" abweicht. */
  'aria-label'?: string;
}

const WebKachel: React.FC<WebKachelProps> = ({ label, wert, zusatz = [], spark, href, symbol, achtung = false, 'aria-label': ariaLabel }) => {
  const klassen = `web-kachel${achtung ? ' web-kachel--achtung' : ''}`;
  const inhalt = (
    <>
      <span className="web-kachel__label">
        {symbol ? (
          <span className="web-kachel__titel">
            <IonIcon icon={symbol.icon} className="web-kachel__symbol" style={{ color: symbol.farbe }} aria-hidden="true" />
            {label}
          </span>
        ) : label}
        {spark}
      </span>
      <span className="web-kachel__wert">{wert}</span>
      <span className="web-kachel__zusatz">
        {zusatz.filter(Boolean).map((z, i) => <span key={i}>{z}</span>)}
      </span>
    </>
  );
  if (href) {
    return (
      <WebLink href={href} className={klassen} aria-label={ariaLabel ?? `${label}: ${wert}`}>{inhalt}</WebLink>
    );
  }
  return <div className={klassen} role="group" aria-label={ariaLabel ?? `${label}: ${wert}`}>{inhalt}</div>;
};

export default WebKachel;
