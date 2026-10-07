// Eine Info, die beim Darueberfahren und beim Fokus erscheint (Web-Fassung).
// Der Ausloeser ist ein Knopf: per Tastatur erreichbar, und auf einem Tablet
// ab 992 px, das kein Darueberfahren kennt, oeffnet ein Tippen die Info.
// Escape schliesst sie. Die Info haengt ueber aria-describedby am Ausloeser
// und steht dafuer immer im Dokument -- verborgen, solange sie zu ist.
//
// Mit `href` ist der Ausloeser ein Link (Stempel fuehren zu ihrer Challenge):
// Ein Klick oeffnet dann das Ziel wie WebLink, Mittelklick einen neuen Tab;
// die Info kommt weiter bei Darueberfahren und Fokus.
//
// Statt des title-Attributs (Simon, 07.10.2026: „beim hover bitte die info
// jeweils zeigen"): Der Browser zeigt title spaet, ungestaltet und nie per
// Tastatur.

import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { useIonRouter } from '@ionic/react';

export interface WebInfoTippProps {
  /** Der Inhalt der Info. */
  info: React.ReactNode;
  /** Was der Ausloeser zeigt (Symbol und Name). */
  children: React.ReactNode;
  /** Name fuer Vorleseprogramme, wenn der sichtbare Inhalt nicht reicht. */
  beschriftung?: string;
  klasse?: string;
  /** Ziel eines Klicks; ohne `href` ist der Ausloeser ein Knopf. */
  href?: string;
}

const WebInfoTipp: React.FC<WebInfoTippProps> = ({ info, children, beschriftung, klasse, href }) => {
  const id = useId();
  const router = useIonRouter();
  const [ueber, setUeber] = useState(false);
  const [fokus, setFokus] = useState(false);
  const [getippt, setGetippt] = useState(false);
  const offen = ueber || fokus || getippt;
  const blase = useRef<HTMLSpanElement>(null);

  // Die Info steht mittig unter dem Ausloeser. Am Rand des Inhalts (links die
  // Leiste, rechts das Fenster) rueckt sie so weit ein, dass sie ganz zu
  // sehen ist -- der Inhaltsbereich (ion-content) schneidet sonst ab.
  useLayoutEffect(() => {
    const el = blase.current;
    if (!offen || !el) return;
    el.style.setProperty('--web-infotipp-versatz', '0px');
    const rahmen = el.closest('ion-content')?.getBoundingClientRect()
      ?? { left: 0, right: window.innerWidth };
    const box = el.getBoundingClientRect();
    const RAND = 8;
    let versatz = 0;
    if (box.left < rahmen.left + RAND) versatz = rahmen.left + RAND - box.left;
    else if (box.right > rahmen.right - RAND) versatz = rahmen.right - RAND - box.right;
    el.style.setProperty('--web-infotipp-versatz', `${versatz}px`);
  }, [offen]);

  const schliessen = () => {
    setUeber(false);
    setFokus(false);
    setGetippt(false);
  };

  const gemeinsam = {
    className: ['web-infotipp__ausloeser', klasse ?? ''].filter(Boolean).join(' '),
    'aria-label': beschriftung,
    'aria-describedby': id,
    onFocus: () => setFokus(true),
    onBlur: () => { setFokus(false); setGetippt(false); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') schliessen(); },
  };

  return (
    <span
      className="web-infotipp"
      onMouseEnter={() => setUeber(true)}
      onMouseLeave={() => setUeber(false)}
    >
      {href ? (
        <a
          {...gemeinsam}
          href={href}
          onClick={(e) => {
            // Neuer Tab, neues Fenster: Das erledigt der Browser (wie WebLink).
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            router.push(href, 'none', 'push');
          }}
        >
          {children}
        </a>
      ) : (
        <button
          {...gemeinsam}
          type="button"
          aria-expanded={offen}
          onClick={() => setGetippt((g) => !g)}
        >
          {children}
        </button>
      )}
      <span ref={blase} id={id} role="tooltip" className="web-infotipp__blase" hidden={!offen}>
        {info}
      </span>
    </span>
  );
};

export default WebInfoTipp;
