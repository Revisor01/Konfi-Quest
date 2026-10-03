// Kennzahl-Kachel der Web-Fassung: kleines Etikett, grosse Zahl, darunter
// ein Zusatz und -- wenn es eine Reihe dazu gibt -- eine kleine Linie. Mit
// `href` ist die ganze Kachel ein Link (offene Anfragen -> Anfragen).

import React from 'react';
import WebLink from './WebLink';

export interface WebKachelProps {
  label: string;
  /** Die Zahl, schon formatiert ("1.265"). */
  wert: string;
  /** Eine oder mehrere Zeilen darunter. */
  zusatz?: React.ReactNode[];
  /** Eine kleine Linie rechts neben dem Etikett (WebSpark). */
  spark?: React.ReactNode;
  href?: string;
  /** Hebt die Kachel hervor (offene Aufgaben). */
  achtung?: boolean;
  /** Satz fuer Vorleseprogramme, wenn er von "Etikett: Zahl" abweicht. */
  'aria-label'?: string;
}

const WebKachel: React.FC<WebKachelProps> = ({ label, wert, zusatz = [], spark, href, achtung = false, 'aria-label': ariaLabel }) => {
  const klassen = `web-kachel${achtung ? ' web-kachel--achtung' : ''}`;
  const inhalt = (
    <>
      <span className="web-kachel__label">
        {label}
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
