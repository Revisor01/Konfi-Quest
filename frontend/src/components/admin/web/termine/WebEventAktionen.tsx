// Die Aktionen der Leitung an einem Event -- Kopieren, Absagen (am abgesagten:
// Absagegrund bearbeiten und Absage zuruecknehmen) und Loeschen --, einmal fuer
// die Zeile der Liste (nur Symbole) und einmal fuer den Fuss der Karte (Symbol
// und Wort). Beide rufen dieselben Funktionen der Seite (AdminEventsPage, `TerminAktionen`),
// mit denselben Rueckfragen und Modalen wie die Wischaktionen der App.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_BEARBEITEN,
  ICON_GESPERRT,
  ICON_KOPIEREN,
  ICON_LOESCHEN,
  ICON_RUECKGAENGIG,
} from '../../../shared/icons';
import { istAbgesagt } from '../../../shared/eventFormatting';
import WebKnopf from '../../../web/WebKnopf';
import type { Event } from '../../../../types/event';
import type { TerminAktionen } from './typen';
import '../../../../theme/web/termine.css';

interface EventKnopf {
  schluessel: string;
  /** Der Name fuer Vorleseprogramme und der Tooltip in der Zeile. */
  label: string;
  /** Das Wort im Knopf auf der Karte. */
  kurz: string;
  icon: string;
  gefahr?: boolean;
  onClick: () => void;
}

/** Die Knoepfe eines Events in ihrer Reihenfolge -- die eine Quelle fuer Zeile und Karte. */
function eventKnoepfe(event: Event, aktionen: TerminAktionen): EventKnopf[] {
  const abgesagt = istAbgesagt(event);
  return [
    ...(abgesagt ? [{
      schluessel: 'zuruecknehmen', label: 'Absage zurücknehmen', kurz: 'Zurücknehmen', icon: ICON_RUECKGAENGIG,
      onClick: () => aktionen.zuruecknehmen(event),
    }] : []),
    { schluessel: 'kopieren', label: 'Event kopieren', kurz: 'Kopieren', icon: ICON_KOPIEREN, onClick: () => aktionen.kopieren(event) },
    {
      schluessel: 'absagen',
      label: abgesagt ? 'Absagegrund bearbeiten' : 'Event absagen',
      kurz: abgesagt ? 'Grund bearbeiten' : 'Absagen',
      icon: abgesagt ? ICON_BEARBEITEN : ICON_GESPERRT,
      onClick: () => aktionen.absagen(event),
    },
    { schluessel: 'loeschen', label: 'Event löschen', kurz: 'Löschen', icon: ICON_LOESCHEN, gefahr: true, onClick: () => aktionen.loeschen(event) },
  ];
}

export interface WebEventAktionenProps {
  event: Event;
  aktionen: TerminAktionen;
  /** Karte: Symbol und Wort, der Name des Events im Namen des Knopfes. Sonst nur Symbole (Zeile). */
  mitText?: boolean;
}

const WebEventAktionen: React.FC<WebEventAktionenProps> = ({ event, aktionen, mitText = false }) => {
  const knoepfe = eventKnoepfe(event, aktionen);
  if (mitText) {
    return (
      <>
        {knoepfe.map((k) => (
          <WebKnopf
            key={k.schluessel}
            klein
            vorn
            art={k.gefahr ? 'gefahr' : 'sekundaer'}
            aria-label={`${k.label}: ${event.name}`}
            onClick={k.onClick}
          >
            <IonIcon icon={k.icon} aria-hidden="true" />
            {k.kurz}
          </WebKnopf>
        ))}
      </>
    );
  }
  return (
    <div className="web-termin-aktionen">
      {knoepfe.map((k) => (
        <WebKnopf
          key={k.schluessel}
          klein
          symbol
          vorn
          art={k.gefahr ? 'gefahr' : 'sekundaer'}
          aria-label={k.label}
          title={k.label}
          onClick={k.onClick}
        >
          <IonIcon icon={k.icon} aria-hidden="true" />
        </WebKnopf>
      ))}
    </div>
  );
};

export default WebEventAktionen;
