// Die Events der Konfis als Karten im Raster (Web-Fassung von Mitmachen,
// 03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Dieselben Events und dieselben Reiter wie die Liste der App -- Alle, Meine,
// Konfirmation, in dieser Reihenfolge (shared/web/termine/terminFilter.ts).
// Meine heisst: jede Person
// mit einer Buchung an diesem Event, egal in welchem Zustand (angemeldet,
// Warteliste, abgemeldet, abgesagt; zaehltAlsMeiner). Jede Karte ist ein Link
// auf das Event; ihre Farbe und ihr Status folgen derselben Rechnung wie die
// Karten der App (utils/termineWeb.ts, konfiListeStatus).

import React, { useMemo, useState } from 'react';
import { ICON_TERMIN } from '../../../shared/icons';
import { istVergangen, zaehltAlsMeiner } from '../../../shared/eventFormatting';
import { suchbegriff } from '../../../../utils/supportWeb';
import { konfiFakten, konfiListeStatus, kommendeZuerst, terminSuchtTreffer } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebKnopf from '../../../web/WebKnopf';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import WebTerminKarte from '../../../shared/web/termine/WebTerminKarte';
import { KONFI_EVENT_FILTER, type KonfiEventFilter } from '../../../shared/web/termine/terminFilter';
import '../../../../theme/web/termine.css';

const LEER: Record<KonfiEventFilter, { titel: string; text: string }> = {
  alle: { titel: 'Keine Events gefunden', text: 'Keine anstehenden Events' },
  meine: { titel: 'Keine Events gefunden', text: 'Du bist noch für keine Events angemeldet' },
  konfirmation: { titel: 'Keine Events gefunden', text: 'Keine Konfirmationstermine verfügbar' },
};

const WebKonfiEvents: React.FC<{ events: readonly Event[] }> = ({ events }) => {
  const [filter, setFilter] = useFilterAusAdresse<KonfiEventFilter>('/konfi/events', KONFI_EVENT_FILTER, 'meine');
  const [suche, setSuche] = useState('');

  // Hat die Konfi schon einen Konfirmationstermin gebucht? Dann sind die ANDEREN gesperrt.
  const hatKonfirmationGebucht = useMemo(
    () => events.some((e) => e.is_konfirmation && e.is_registered),
    [events],
  );

  const listen = useMemo<Record<KonfiEventFilter, Event[]>>(() => ({
    // Alle: wie in der App nur, was noch kommt, ohne Konfirmation (die hat ihren eigenen Reiter).
    alle: events.filter((e) => !e.is_konfirmation && !istVergangen(e)),
    meine: events.filter(zaehltAlsMeiner),
    konfirmation: events.filter((e) => e.is_konfirmation),
  }), [events]);

  const sichtbar = useMemo(
    () => kommendeZuerst(listen[filter]).filter((e) => terminSuchtTreffer(e, suche, true)),
    [listen, filter, suche],
  );
  const sucht = suchbegriff(suche) !== '';

  return (
    <>
      <div className="web-werkzeuge">
        <WebChips<KonfiEventFilter>
          beschriftung="Events anzeigen"
          wert={filter}
          onWert={setFilter}
          chips={[
            { wert: 'alle', label: 'Alle', zahl: listen.alle.length },
            { wert: 'meine', label: 'Meine', zahl: listen.meine.length },
            { wert: 'konfirmation', label: 'Konfirmation', zahl: listen.konfirmation.length },
          ]}
        />
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Events durchsuchen" platzhalter="Name oder Ort suchen" wert={suche} onWert={setSuche} />
        </div>
      </div>

      {sichtbar.length > 0 ? (
        <div className="web-termin-raster">
          {sichtbar.map((e) => {
            const status = konfiListeStatus(e, hatKonfirmationGebucht);
            return (
              <WebTerminKarte
                key={e.id}
                event={e}
                href={`/konfi/events/${e.id}`}
                status={status}
                fakten={konfiFakten(e)}
                gedaempft={status.gedaempft}
                gesperrt={status.gesperrt}
                statusZeigen={status.zeigtStatus}
                teamZeigen={false}
                unterzeile={undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="web-karte">
          <WebLeer
            icon={ICON_TERMIN}
            titel={sucht ? 'Keine Treffer' : LEER[filter].titel}
            text={sucht ? `Zu „${suche.trim()}“ gibt es in dieser Auswahl kein Event.` : LEER[filter].text}
            aktion={sucht
              ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf>
              : filter === 'meine' && listen.alle.length > 0
                ? <WebKnopf onClick={() => setFilter('alle')}>Alle Events ansehen</WebKnopf>
                : undefined}
          />
        </div>
      )}
    </>
  );
};

export default WebKonfiEvents;
