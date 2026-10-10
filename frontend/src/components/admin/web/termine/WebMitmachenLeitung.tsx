// Mitmachen der Leitung in der Web-Fassung (/admin/events, 03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): zwei Reiter oben --
// Events und Aktivitaeten (die gemeldeten, wie in der App; Simon, 06.10.2026:
// „er soll Aktivitäten heißen überall") --, ueber die Adresse gewaehlt
// (`?segment=`, wie die Deep-Links der App), darunter die Tabelle des Reiters.
// Der Katalog der Aktivitaeten steht wie in der App unter Mehr.
//
// Die Seite (AdminEventsPage) laedt die Daten und besitzt die Funktionen
// (Absagen, Kopieren, Loeschen, Antrag pruefen ...) -- sie reicht beides
// herein. Hier stehen nur die Knoepfe im Kopf und die Weiche: Beide Reiter
// sind eigene Listen-Seiten (WebListenSeite: WebEventsLeitung, WebAntraege),
// die Reiter von Mitmachen stehen bei beiden ueber der Werkzeugzeile.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_HINZUFUEGEN } from '../../../shared/icons';
import WebKnopf from '../../../web/WebKnopf';
import WebLegendeKnopf from '../../../shared/web/termine/WebLegendeKnopf';
import type { Event } from '../../../../types/event';
import WebEventsLeitung from './WebEventsLeitung';
import WebAntraege from './WebAntraege';
import WebLeitungReiter from './WebLeitungReiter';
import type { AntragAktionen, AntragZeile, LeitungSegment, TerminAktionen } from './typen';
import '../../../../theme/web/termine.css';

export interface WebMitmachenLeitungProps {
  /** Fuer die Modale, die ueber dieser Seite aufklappen (useModalPage). */
  pageRef: React.Ref<HTMLElement>;
  presentingElement?: HTMLElement | null;
  segment: LeitungSegment;

  events: readonly Event[];
  abgesagte: readonly Event[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  eventsLaden: boolean;
  /** Das Neuladen der Events ist gescheitert, und es gibt keinen Stand. */
  eventsFehler?: boolean;
  /** Orange Zahl am Reiter: Events, die auf Verbuchung warten (BadgeContext). */
  wartendVerbuchen: number;

  antraege: readonly AntragZeile[];
  antraegeLaden: boolean;
  ohneJahrgang: boolean;
  /** Orange Zahl am Reiter: Antraege, die auf eine Entscheidung warten (BadgeContext). */
  wartendeAntraege: number;

  darfVerwalten: boolean;
  terminAktionen: TerminAktionen;
  antragAktionen: AntragAktionen;
  neuLaden: () => Promise<void>;
  antraegeNeuLaden: () => Promise<void>;
}

const WebMitmachenLeitung: React.FC<WebMitmachenLeitungProps> = (p) => {
  const { segment } = p;

  const aktionen = (
    <>
      {segment === 'events' && <WebLegendeKnopf variante="admin" presentingElement={p.presentingElement} />}
      <WebKnopf onClick={() => { void (segment === 'antraege' ? p.antraegeNeuLaden() : p.neuLaden()); }}>
        <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
        Aktualisieren
      </WebKnopf>
      {segment === 'events' && p.darfVerwalten && (
        <WebKnopf art="primaer" onClick={p.terminAktionen.neu} aria-label="Neues Event anlegen">
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Event
        </WebKnopf>
      )}
    </>
  );

  const reiter = <WebLeitungReiter segment={segment} wartendVerbuchen={p.wartendVerbuchen} wartendeAntraege={p.wartendeAntraege} />;

  if (segment === 'antraege') {
    return (
      <WebAntraege
        antraege={p.antraege}
        ohneJahrgang={p.ohneJahrgang}
        aktionen={p.antragAktionen}
        laedt={p.antraegeLaden}
        kopfAktionen={aktionen}
        oben={reiter}
        pageRef={p.pageRef}
      />
    );
  }

  return (
    <WebEventsLeitung
      events={p.events}
      abgesagte={p.abgesagte}
      jahrgaenge={p.jahrgaenge}
      darfVerwalten={p.darfVerwalten}
      aktionen={p.terminAktionen}
      laedt={p.eventsLaden}
      fehler={p.eventsFehler ? { onErneut: () => { void p.neuLaden(); } } : undefined}
      kopfAktionen={aktionen}
      oben={reiter}
      pageRef={p.pageRef}
    />
  );
};

export default WebMitmachenLeitung;
