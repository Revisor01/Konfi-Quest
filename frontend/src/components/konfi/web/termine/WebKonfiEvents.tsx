// Die Events der Konfis als Karten im Raster oder als Liste (Web-Fassung von
// Mitmachen, 03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6).
// Der Umschalter Liste | Kacheln steht als letztes Element rechts neben der
// Suche; Konfis starten mit den Kacheln, der Browser merkt sich die Wahl
// (useAnsicht, Simon, 06.10.2026). Filter und Suche gelten fuer beide gleich.
//
// Dieselben Events und dieselben Reiter wie die Liste der App -- Alle, Meine,
// Konfirmation, in dieser Reihenfolge (shared/web/termine/terminFilter.ts).
// Meine heisst: jede Person
// mit einer Buchung an diesem Event, egal in welchem Zustand (angemeldet,
// Warteliste, abgemeldet, abgesagt; zaehltAlsMeiner). Jede Karte und jede Zeile
// ist ein Link auf das Event; ihre Farbe und ihr Status folgen derselben
// Rechnung wie die Karten der App (utils/termineWeb.ts, konfiListeStatus).

import React, { useMemo, useState } from 'react';
import { ICON_TERMIN } from '../../../shared/icons';
import { useApp } from '../../../../contexts/AppContext';
import { istVergangen, zaehltAlsMeiner } from '../../../shared/eventFormatting';
import { suchbegriff } from '../../../../utils/supportWeb';
import { konfiFakten, konfiListeStatus, kommendeZuerst, terminSuchtTreffer } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebAnsichtUmschalter from '../../../web/WebAnsichtUmschalter';
import { ansichtVorgabe, useAnsicht } from '../../../web/useAnsicht';
import WebKnopf from '../../../web/WebKnopf';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import WebTerminAnsicht, { type WebTerminEintrag } from '../../../shared/web/termine/WebTerminAnsicht';
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
  const { user } = useApp();
  const [ansicht, setAnsicht] = useAnsicht('events-mitglied', ansichtVorgabe(user?.role_name));

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

  // Karte und Zeile rechnen aus denselben Eintraegen.
  const eintraege: WebTerminEintrag[] = sichtbar.map((e) => {
    const status = konfiListeStatus(e, hatKonfirmationGebucht);
    return {
      event: e,
      href: `/konfi/events/${e.id}`,
      status,
      fakten: konfiFakten(e),
      gedaempft: status.gedaempft,
      gesperrt: status.gesperrt,
      statusZeigen: status.zeigtStatus,
    };
  });

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
          <WebAnsichtUmschalter wert={ansicht} onWert={setAnsicht} />
        </div>
      </div>

      {eintraege.length > 0 ? (
        <WebTerminAnsicht eintraege={eintraege} ansicht={ansicht} teamZeigen={false} />
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
