// Ein Dialog der Web-Fassung: ein Fenster ueber der Seite fuer ein
// Formular (Konto anlegen, Landeskirche anlegen, Event, Bonuspunkte). Seit
// 11.10.2026 die Form aller haeufigen Formulare im Browser (Simon: „Web
// braucht eigene kompaktere Modale überall"); die App oeffnet dafuer ihre
// Modale, und die uebrigen App-Modale stehen im Browser kompakt
// (theme/web-modale.css).
// Rueckfragen vor dem Loeschen oder Sperren bleiben bei der App (useIonAlert);
// dies hier ist fuer Formulare. Fragt ein offenes Fenster selbst nach
// (Ungespeicherte Aenderungen, Beitrag ausblenden), ist die Rueckfrage ein
// zweites WebDialog darueber -- mit `rueckfrage` in der Optik der
// Rueckfragen der App im Browser (theme/rueckfragen.css): Symbol ueber dem
// Titel, der Knopf mit art 'gefahr' rot gefuellt (13.10.2026).
//
// Verhalten wie ein echter Dialog:
//   - role="dialog", aria-modal, benannt nach seiner Ueberschrift;
//   - der Fokus geht beim Oeffnen hinein (auf das erste Feld) und beim
//     Schliessen zurueck an die Stelle, von der aus er geoeffnet wurde;
//   - Tab und Umschalt+Tab bleiben im Dialog;
//   - Escape und ein Klick auf den abgedunkelten Grund schliessen -- ausser
//     er ist `gesperrt`, weil gerade gesendet wird (dann auch das X).
// Er wird in <ion-app> gehaengt, nicht in die Seite: Ionics Seiten schneiden
// mit `contain` alles ab, was in ihnen "fixed" steht. In ion-app haengt Ionic
// auch seine Rueckfragen (ion-alert) und Meldungen (ion-toast); dort
// entscheidet der z-index, und der Grund (1000) liegt unter ihnen. Bis
// 12.10.2026 hing er an <body>, ueber der ganzen Ebene von ion-app
// (`contain`, `z-index: 0`): Eine Rueckfrage aus dem Dialog lag unsichtbar
// dahinter, eine Fehlermeldung abgedunkelt und halb verdeckt.

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IonIcon } from '@ionic/react';
import { ICON_SCHLIESSEN } from '../shared/icons';
import type { RueckfrageArt } from '../../utils/rueckfragenOptik';
import WebRueckfrageSymbol from './WebRueckfrageSymbol';

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
  /**
   * Breiter (720 statt 520 px) für Formulare mit vielen Feldern, die zu
   * zweit nebeneinander stehen (Event, Material). Kurze Formulare bleiben
   * schmal. Die Knopfleiste eines breiten Dialogs bleibt beim Scrollen unten
   * im Bild (theme/web-ansicht.css).
   */
  breit?: boolean;
  /**
   * Es wird gerade gesendet: Das X ist gesperrt, Escape und ein Klick auf
   * den Grund schliessen nicht -- wie das X der App-Modale
   * (`disabled={isSubmitting}`). Sonst ginge ein Fehler des Servers ins
   * Leere, und nach erneutem Oeffnen liesse sich derselbe Vorgang sofort ein
   * zweites Mal abschicken (Gegenpruefung 11.10.2026).
   */
  gesperrt?: boolean;
  /**
   * Das Fenster ist eine Rueckfrage vor etwas Folgenreichem: Ueber dem Titel
   * steht das Symbol (Muelleimer bei 'loeschen', Warndreieck bei 'warnung'),
   * der Knopf mit art 'gefahr' ist rot gefuellt -- wie die Rueckfragen der
   * App im Browser. Welche Art, entscheidet dieselbe Regel wie dort
   * (rueckfrageArt): loescht, entfernt oder leert der Knopf, 'loeschen'.
   */
  rueckfrage?: RueckfrageArt;
}

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WebDialog: React.FC<WebDialogProps> = ({ titel, onSchliessen, children, aktionen, beschreibung, onAbsenden, breit = false, gesperrt = false, rueckfrage }) => {
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

  // Beim Sperren wird meist der Knopf mitgesperrt, der das Senden ausgeloest
  // hat und den Fokus traegt. Der Browser nimmt ihm den Fokus und legt ihn auf
  // die Seite -- danach kaemen Escape und Tab nicht mehr im Dialog an. Der
  // Fokus geht deshalb auf das Fenster selbst.
  useEffect(() => {
    const knoten = fenster.current;
    if (!gesperrt || !knoten) return;
    const aktiv = document.activeElement;
    if (!(aktiv instanceof HTMLElement) || !knoten.contains(aktiv) || aktiv.matches(':disabled')) knoten.focus();
  }, [gesperrt]);

  const taste = (ereignis: React.KeyboardEvent<HTMLDivElement>) => {
    if (ereignis.key === 'Escape') {
      ereignis.stopPropagation();
      if (!gesperrt) schliessen.current();
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
    <div className="web-dialog-grund" onMouseDown={(e) => { if (e.target === e.currentTarget && !gesperrt) schliessen.current(); }}>
      <div
        ref={fenster}
        className={['web-dialog', breit ? 'web-dialog--breit' : '', rueckfrage ? 'web-rueckfrage' : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        aria-describedby={beschreibung ? beschreibungId : undefined}
        tabIndex={-1}
        onKeyDown={taste}
      >
        <header className="web-dialog__kopf">
          {rueckfrage && <WebRueckfrageSymbol art={rueckfrage} />}
          <h2 id={titelId} className="web-dialog__titel">{titel}</h2>
          <button type="button" className="web-knopf web-knopf--text web-knopf--symbol" aria-label="Schließen" disabled={gesperrt} onClick={() => schliessen.current()}>
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
    // Ohne ion-app (vor dem Start der App, in Tests) an <body>.
    document.querySelector('ion-app') ?? document.body,
  );
};

export default WebDialog;
