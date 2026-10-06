// Die Events des Teams als Karten im Raster oder als Liste (Web-Fassung von
// Mitmachen, 03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6).
// Der Umschalter Liste | Kacheln steht als letztes Element rechts neben der
// Suche; das Team startet mit den Kacheln, der Browser merkt sich die Wahl
// (useAnsicht, Simon, 06.10.2026). Filter und Suche gelten fuer beide gleich.
//
// Dieselben Events und Reiter wie die Liste der App: Alle (alles, auch Events nur
// fuer Konfis -- "Nur Info"), Meine (jede Buchung, egal in welchem Zustand) und
// Team (Team gesucht oder nur fuers Team). Karte und Zeile oeffnen das Event:
// /teamer/events?eventId=<id> -- derselbe Weg wie die Links aus Dashboard und
// Push, ein echter Link.

import React, { useMemo, useState } from 'react';
import { ICON_TERMIN } from '../../../shared/icons';
import { useApp } from '../../../../contexts/AppContext';
import { zaehltAlsMeiner } from '../../../shared/eventFormatting';
import { suchbegriff } from '../../../../utils/supportWeb';
import { jahrgaengeZeile, kommendeZuerst, teamFakten, teamListeStatus, terminSuchtTreffer } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebAnsichtUmschalter from '../../../web/WebAnsichtUmschalter';
import { ansichtVorgabe, useAnsicht } from '../../../web/useAnsicht';
import WebKnopf from '../../../web/WebKnopf';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import WebTerminAnsicht, { type WebTerminEintrag } from '../../../shared/web/termine/WebTerminAnsicht';
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
  const { user } = useApp();
  const [ansicht, setAnsicht] = useAnsicht('events-mitglied', ansichtVorgabe(user?.role_name));

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

  // Karte und Zeile rechnen aus denselben Eintraegen.
  const eintraege: WebTerminEintrag[] = sichtbar.map((e) => {
    const status = teamListeStatus(e);
    return {
      event: e,
      href: `/teamer/events?eventId=${e.id}`,
      status,
      fakten: teamFakten(e),
      gedaempft: status.gedaempft,
      statusZeigen: status.zeigtStatus,
      unterzeile: jahrgaengeZeile(e),
      materialAnzahl: e.material_count || 0,
    };
  });

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
          <WebAnsichtUmschalter wert={ansicht} onWert={setAnsicht} />
        </div>
      </div>

      {eintraege.length > 0 ? (
        <WebTerminAnsicht eintraege={eintraege} ansicht={ansicht} teamZeigen />
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
