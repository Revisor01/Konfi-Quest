// Ein Menue hinter einem Knopf ("Mehr"): die Aktionen, die nicht dauernd im
// Raumkopf stehen sollen (Verlauf exportieren, Chat verlassen, loeschen).
//
// Verhalten wie ein Menue im Betriebssystem:
//   - der Knopf meldet aria-haspopup und aria-expanded;
//   - beim Oeffnen geht der Fokus auf den ersten Eintrag, Pfeil hoch und
//     runter wandern durch die Eintraege, Pos1 und Ende springen;
//   - Escape schliesst und gibt den Fokus an den Knopf zurueck, Tab und ein
//     Klick daneben schliessen ebenso;
//   - ein gesperrter Eintrag bleibt sichtbar und nennt per `title`, warum.

import React, { useEffect, useId, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_MEHR_VERTIKAL } from '../../shared/icons';

export interface WebMenueEintrag {
  text: string;
  onWaehlen: () => void;
  /** Rot: etwas, das sich nicht rueckgaengig machen laesst. */
  gefahr?: boolean;
  deaktiviert?: boolean;
  /** Erklaerung fuer einen gesperrten Eintrag ("Ohne Internetverbindung nicht moeglich"). */
  title?: string;
}

export interface WebMenueProps {
  /** Name des Knopfs fuer Vorleseprogramme ("Weitere Chat-Optionen"). */
  beschriftung: string;
  eintraege: ReadonlyArray<WebMenueEintrag>;
  deaktiviert?: boolean;
  title?: string;
}

const WebMenue: React.FC<WebMenueProps> = ({ beschriftung, eintraege, deaktiviert = false, title }) => {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const menueId = useId();

  const eintragKnoepfe = () => [...(liste.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])') ?? [])];

  // Beim Oeffnen auf den ersten Eintrag.
  useEffect(() => {
    if (offen) eintragKnoepfe()[0]?.focus();
  }, [offen]);

  // Ein Klick daneben schliesst. mousedown statt click: So schliesst auch ein
  // Klick auf einen anderen Knopf, bevor dessen Aktion laeuft.
  useEffect(() => {
    if (!offen) return;
    const daneben = (ereignis: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(ereignis.target as Node)) setOffen(false);
    };
    document.addEventListener('mousedown', daneben);
    return () => document.removeEventListener('mousedown', daneben);
  }, [offen]);

  const schliessen = (fokusZurueck: boolean) => {
    setOffen(false);
    if (fokusZurueck) knopf.current?.focus();
  };

  const taste = (ereignis: React.KeyboardEvent<HTMLElement>) => {
    if (ereignis.key === 'Escape') {
      ereignis.preventDefault();
      ereignis.stopPropagation();
      schliessen(true);
      return;
    }
    if (ereignis.key === 'Tab') {
      setOffen(false);
      return;
    }
    const alle = eintragKnoepfe();
    const aktuell = alle.indexOf(document.activeElement as HTMLButtonElement);
    const gehe = (ziel: number) => {
      ereignis.preventDefault();
      alle[(ziel + alle.length) % alle.length]?.focus();
    };
    if (ereignis.key === 'ArrowDown') gehe(aktuell + 1);
    else if (ereignis.key === 'ArrowUp') gehe(aktuell - 1);
    else if (ereignis.key === 'Home') gehe(0);
    else if (ereignis.key === 'End') gehe(alle.length - 1);
  };

  return (
    <div className="web-menue" ref={huelle} onKeyDown={offen ? taste : undefined}>
      <button
        type="button"
        ref={knopf}
        className="web-knopf web-knopf--text web-knopf--symbol"
        aria-label={beschriftung}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? menueId : undefined}
        title={title ?? beschriftung}
        disabled={deaktiviert}
        onClick={() => setOffen((o) => !o)}
      >
        <IonIcon icon={ICON_MEHR_VERTIKAL} aria-hidden="true" />
      </button>
      {offen && (
        <ul id={menueId} ref={liste} className="web-menue__liste" role="menu" aria-label={beschriftung}>
          {eintraege.map((eintrag) => (
            <li key={eintrag.text} role="none">
              <button
                type="button"
                role="menuitem"
                className={eintrag.gefahr ? 'web-menue__eintrag web-menue__eintrag--gefahr' : 'web-menue__eintrag'}
                disabled={eintrag.deaktiviert}
                title={eintrag.title}
                onClick={() => {
                  schliessen(true);
                  eintrag.onWaehlen();
                }}
              >
                {eintrag.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default WebMenue;
