// Die Events des Teams als Karten im Raster (Web-Fassung von Mitmachen,
// 03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Dieselben Events und Reiter wie die Liste der App: Alle (alles, auch Events nur
// fuer Konfis -- "Nur Info"), Meine (jede Buchung, egal in welchem Zustand) und
// Team (Team gesucht oder nur fuers Team). Eine Karte oeffnet das Event:
// /teamer/events?eventId=<id> -- derselbe Weg wie die Links aus Dashboard und
// Push, ein echter Link.

import React, { useMemo, useState } from 'react';
import { ICON_TERMIN } from '../../../shared/icons';
import { zaehltAlsMeiner } from '../../../shared/eventFormatting';
import { suchbegriff } from '../../../../utils/supportWeb';
import { kommendeZuerst, teamFakten, teamListeStatus, terminSuchtTreffer } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebKnopf from '../../../web/WebKnopf';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import WebTerminKarte from '../../../shared/web/termine/WebTerminKarte';
import { TEAM_EVENT_FILTER, type TeamEventFilter } from '../../../shared/web/termine/terminFilter';
import '../../../../theme/web/termine.css';

const LEER: Record<TeamEventFilter, string> = {
  meine: 'Du bist noch bei keinem Event dabei',
  alle: 'Keine Events vorhanden',
  team: 'Keine Events fürs Team verfügbar',
};

const WebTeamEvents: React.FC<{ events: readonly Event[] }> = ({ events }) => {
  const [filter, setFilter] = useFilterAusAdresse<TeamEventFilter>('/teamer/events', TEAM_EVENT_FILTER, 'meine');
  const [suche, setSuche] = useState('');

  const listen = useMemo<Record<TeamEventFilter, Event[]>>(() => ({
    // "Alle" heisst alle -- auch reine Team-Events (User-Hinweis 25.08.2026).
    alle: [...events],
    meine: events.filter(zaehltAlsMeiner),
    team: events.filter((e) => e.teamer_needed || e.teamer_only),
  }), [events]);

  const sichtbar = useMemo(
    () => kommendeZuerst(listen[filter]).filter((e) => terminSuchtTreffer(e, suche)),
    [listen, filter, suche],
  );
  const sucht = suchbegriff(suche) !== '';

  return (
    <>
      <div className="web-werkzeuge">
        <WebChips<TeamEventFilter>
          beschriftung="Events anzeigen"
          wert={filter}
          onWert={setFilter}
          chips={[
            { wert: 'alle', label: 'Alle', zahl: listen.alle.length },
            { wert: 'meine', label: 'Meine', zahl: listen.meine.length },
            { wert: 'team', label: 'Team', zahl: listen.team.length },
          ]}
        />
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Events durchsuchen" platzhalter="Name oder Ort suchen" wert={suche} onWert={setSuche} />
        </div>
      </div>

      {sichtbar.length > 0 ? (
        <div className="web-termin-raster">
          {sichtbar.map((e) => {
            const status = teamListeStatus(e);
            return (
              <WebTerminKarte
                key={e.id}
                event={e}
                href={`/teamer/events?eventId=${e.id}`}
                status={status}
                fakten={teamFakten(e)}
                gedaempft={status.gedaempft}
                statusZeigen={status.zeigtStatus}
                teamZeigen
                unterzeile={e.jahrgang_names ? e.jahrgang_names.split(',').map((n) => n.trim()).join(' · ') : undefined}
                materialAnzahl={e.material_count || 0}
              />
            );
          })}
        </div>
      ) : (
        <div className="web-karte">
          <WebLeer
            icon={ICON_TERMIN}
            titel={sucht ? 'Keine Treffer' : 'Keine Events'}
            text={sucht ? `Zu „${suche.trim()}“ gibt es in dieser Auswahl kein Event.` : LEER[filter]}
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

export default WebTeamEvents;
