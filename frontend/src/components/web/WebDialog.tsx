// Ein Dialog der Web-Fassung: ein Fenster ueber der Seite fuer ein kurzes
// Formular (Konto anlegen, Landeskirche anlegen, Kirchenkreis bearbeiten).
// Rueckfragen vor dem Loeschen oder Sperren bleiben bei der App (useIonAlert);
// dies hier ist nur fuer Formulare.
//
// Verhalten wie ein echter Dialog:
//   - role="dialog", aria-modal, benannt nach seiner Ueberschrift;
//   - der Fokus geht beim Oeffnen hinein (auf das erste Feld) und beim
//     Schliessen zurueck an die Stelle, von der aus er geoeffnet wurde;
//   - Tab und Umschalt+Tab bleiben im Dialog;
//   - Escape und ein Klick auf den abgedunkelten Grund schliessen.
// Er wird an <body> gehaengt: Ionics Seiten schneiden mit `contain` alles ab,
// was in ihnen "fixed" steht.

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IonIcon } from '@ionic/react';
import { ICON_SCHLIESSEN } from '../shared/icons';

export interface WebDialogProps {
  titel: string;
  onSchliessen: () => void;
  children: React.ReactNode;
  /** Knoepfe unten (Speichern, Abbrechen). */
  aktionen?: React.ReactNode;
  /** Ein erklarender Satz unter der Ueberschrift. */
  beschreibung?: string;
  /**
   * Der Dialog ist ein Formular: Enter in einem Feld und ein Knopf mit
   * `absenden` rufen dies auf.
   */
  onAbsenden?: () => void;
}

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WebDialog: React.FC<WebDialogProps> = ({ titel, onSchliessen, children, aktionen, beschreibung, onAbsenden }) => {
  const titelId = useId();
  const beschreibungId = useId();
  const fenster = useRef<HTMLDivElement>(null);
  // Der Rueckruf kann bei jedem Rendern ein anderer sein; der Effekt soll nicht davon abhaengen.
  const schliessen = useRef(onSchliessen);
  useEffect(() => { schliessen.current = onSchliessen; }, [onSchliessen]);

  useEffect(() => {
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const knoten = fenster.current;
    if (knoten) {
      // Das erste Eingabefeld; sonst der Dialog selbst.
      const erstes = knoten.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?? knoten.querySelector<HTMLElement>(FOKUSSIERBAR);
      (erstes ?? knoten).focus();
    }
    return () => { vorher?.focus(); };
  }, []);

  const taste = (ereignis: React.KeyboardEvent<HTMLDivElement>) => {
    if (ereignis.key === 'Escape') {
      ereignis.stopPropagation();
      schliessen.current();
      return;
    }
    if (ereignis.key !== 'Tab' || !fenster.current) return;
    const liste = [...fenster.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR)];
    if (liste.length === 0) {
      ereignis.preventDefault();
      return;
    }
    const erstes = liste[0];
    const letztes = liste[liste.length - 1];
    const aktiv = document.activeElement;
    if (ereignis.shiftKey && (aktiv === erstes || aktiv === fenster.current)) {
      ereignis.preventDefault();
      letztes.focus();
    } else if (!ereignis.shiftKey && aktiv === letztes) {
      ereignis.preventDefault();
      erstes.focus();
    }
  };

  return createPortal(
    <div className="web-dialog-grund" onMouseDown={(e) => { if (e.target === e.currentTarget) schliessen.current(); }}>
      <div
        ref={fenster}
        className="web-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        aria-describedby={beschreibung ? beschreibungId : undefined}
        tabIndex={-1}
        onKeyDown={taste}
      >
        <header className="web-dialog__kopf">
          <h2 id={titelId} className="web-dialog__titel">{titel}</h2>
          <button type="button" className="web-knopf web-knopf--text web-knopf--symbol" aria-label="Schließen" onClick={() => schliessen.current()}>
            <IonIcon icon={ICON_SCHLIESSEN} aria-hidden="true" />
          </button>
        </header>
        {beschreibung && <p id={beschreibungId} className="web-dialog__beschreibung">{beschreibung}</p>}
        {onAbsenden ? (
          <form className="web-dialog__form" onSubmit={(e) => { e.preventDefault(); onAbsenden(); }}>
            <div className="web-dialog__inhalt">{children}</div>
            {aktionen && <footer className="web-dialog__aktionen">{aktionen}</footer>}
          </form>
        ) : (
          <>
            <div className="web-dialog__inhalt">{children}</div>
            {aktionen && <footer className="web-dialog__aktionen">{aktionen}</footer>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default WebDialog;
