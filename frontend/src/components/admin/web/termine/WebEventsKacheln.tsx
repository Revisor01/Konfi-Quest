// Die Events der Leitung als Karten im Raster (Ansicht "Kacheln" neben der
// Liste, Simon, 06.10.2026): dieselbe Karte wie bei Konfis und Team
// (WebTerminKarte), mit denselben Angaben wie die Zeile der Liste -- Name,
// Jahrgaenge, Datum, Ort, Teilnahme mit Plaetzen, Punkte, Status und Marken --
// und denselben Aktionen im Fuss (WebEventAktionen). Die Karte ist ein Link
// auf das Event.

import React from 'react';
import { jahrgaengeZeile, leitungFakten, leitungListeStatus } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebTerminKarte from '../../../shared/web/termine/WebTerminKarte';
import WebEventAktionen from './WebEventAktionen';
import type { TerminAktionen } from './typen';
import '../../../../theme/web/termine.css';

export interface WebEventsKachelnProps {
  /** Schon gefiltert und sortiert -- wie fuer die Liste. */
  events: readonly Event[];
  /** Terminverwaltung ist Leitungssache (utils/terminRechte.ts): ohne sie kein Fuss. */
  darfVerwalten: boolean;
  aktionen: TerminAktionen;
  /** Suchbegriff, in Titel und Ort hervorgehoben (wie in der Liste). */
  suche: string;
}

const WebEventsKacheln: React.FC<WebEventsKachelnProps> = ({ events, darfVerwalten, aktionen, suche }) => (
  <div className="web-termin-raster">
    {events.map((e) => {
      const status = leitungListeStatus(e);
      return (
        <WebTerminKarte
          key={e.id}
          event={e}
          href={`/admin/events/${e.id}`}
          status={status}
          fakten={leitungFakten(e)}
          gedaempft={status.gedaempft}
          teamZeigen
          serieZeigen
          unterzeile={jahrgaengeZeile(e)}
          suche={suche}
          fuss={darfVerwalten ? <WebEventAktionen event={e} aktionen={aktionen} mitText /> : undefined}
        />
      );
    })}
  </div>
);

export default WebEventsKacheln;
