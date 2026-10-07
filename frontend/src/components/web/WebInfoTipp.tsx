// Eine Info, die beim Darueberfahren und beim Fokus erscheint (Web-Fassung).
// Der Ausloeser ist ein Knopf: per Tastatur erreichbar, und auf einem Tablet
// ab 992 px, das kein Darueberfahren kennt, oeffnet ein Tippen die Info.
// Escape schliesst sie. Die Info haengt ueber aria-describedby am Knopf und
// steht dafuer immer im Dokument -- verborgen, solange sie zu ist.
//
// Statt des title-Attributs (Simon, 07.10.2026: „beim hover bitte die info
// jeweils zeigen"): Der Browser zeigt title spaet, ungestaltet und nie per
// Tastatur.

import React, { useId, useState } from 'react';

export interface WebInfoTippProps {
  /** Der Inhalt der Info. */
  info: React.ReactNode;
  /** Was der Knopf zeigt (Symbol und Name). */
  children: React.ReactNode;
  /** Name fuer Vorleseprogramme, wenn der sichtbare Inhalt nicht reicht. */
  beschriftung?: string;
  klasse?: string;
}

const WebInfoTipp: React.FC<WebInfoTippProps> = ({ info, children, beschriftung, klasse }) => {
  const id = useId();
  const [ueber, setUeber] = useState(false);
  const [fokus, setFokus] = useState(false);
  const [getippt, setGetippt] = useState(false);
  const offen = ueber || fokus || getippt;

  const schliessen = () => {
    setUeber(false);
    setFokus(false);
    setGetippt(false);
  };

  return (
    <span
      className="web-infotipp"
      onMouseEnter={() => setUeber(true)}
      onMouseLeave={() => setUeber(false)}
    >
      <button
        type="button"
        className={['web-infotipp__ausloeser', klasse ?? ''].filter(Boolean).join(' ')}
        aria-label={beschriftung}
        aria-describedby={id}
        aria-expanded={offen}
        onFocus={() => setFokus(true)}
        onBlur={() => { setFokus(false); setGetippt(false); }}
        onClick={() => setGetippt((g) => !g)}
        onKeyDown={(e) => { if (e.key === 'Escape') schliessen(); }}
      >
        {children}
      </button>
      <span id={id} role="tooltip" className="web-infotipp__blase" hidden={!offen}>
        {info}
      </span>
    </span>
  );
};

export default WebInfoTipp;
