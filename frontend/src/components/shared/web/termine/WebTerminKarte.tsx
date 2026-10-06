// Ein Event als Karte im Raster -- die Liste der Konfis und des Teams in der
// Web-Fassung (docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Die ganze Karte ist ein Link auf das Detail (echter <a>: Mittelklick oeffnet
// einen neuen Tab, Rechtsklick kopiert die Adresse); der Rand links traegt die
// Farbe des Status wie die Balken der App. Die Merkmale (Team, Konfirmation,
// Pflicht) stehen als Eck-Badges oben rechts -- dieselben Zeichen wie in der
// App und in ihrer Legende (EventLegendModal) --, der Status als Marke mit Wort.
//
// Dieselbe Karte fuer Konfis, Team und Leitung (Ansicht "Kacheln", Simon,
// 06.10.2026): Sie liest nur, was da ist. Die Leitung gibt ihre Knoepfe im Fuss
// mit (`fuss`: Kopieren, Absagen, Loeschen) -- wie die Challenge-Karte; sie
// liegen ueber dem Link der Karte.

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ANHANG,
  ICON_KATEGORIE_GEFUELLT,
  ICON_MATERIAL,
  ICON_ORT_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../../icons';
import EventCornerBadges from '../../EventCornerBadges';
import WebLink from '../../../web/WebLink';
import WebTreffer from '../../../web/WebTreffer';
import { kategorienText, titelDekoration } from '../../eventFormatting';
import type { Fakt, TerminStatus } from '../../../../utils/termineWeb';
import { terminDatumUhrzeit } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import { WebAbsageZeile, WebFakten, WebTerminMarken } from './WebTerminBausteine';
import '../../../../theme/web/termine.css';

export interface WebTerminKarteProps {
  event: Event;
  /** Das Detail, als echter Link. */
  href: string;
  status: TerminStatus;
  fakten: readonly Fakt[];
  /** Vergangen ohne Teilnahme: die Karte steht gedaempft da. */
  gedaempft?: boolean;
  /** Ein anderer Konfirmationstermin ist schon gebucht. */
  gesperrt?: boolean;
  /** Die Marke des Status zeigen? Vergangene ohne Teilnahme tragen keine. */
  statusZeigen?: boolean;
  /** Konfis sehen "Team gesucht" nicht. */
  teamZeigen: boolean;
  /** Zweite Zeile unter dem Titel (die Jahrgaenge). */
  unterzeile?: string;
  /** Anzahl des Materials am Event (nur Team). */
  materialAnzahl?: number;
  /** Die Leitung sieht auch die Serie. */
  serieZeigen?: boolean;
  /** Suchbegriff, in Titel und Ort hervorgehoben. */
  suche?: string;
  /** Knoepfe im Fuss (Leitung: Kopieren, Absagen, Loeschen). */
  fuss?: React.ReactNode;
}

const WebTerminKarte: React.FC<WebTerminKarteProps> = ({
  event, href, status, fakten, gedaempft = false, gesperrt = false, statusZeigen = true, teamZeigen, unterzeile, materialAnzahl = 0,
  serieZeigen = false, suche = '', fuss,
}) => {
  const titelId = useId();
  const { datum, uhrzeit } = terminDatumUhrzeit(event);
  const kategorien = kategorienText(event);
  const leise = gedaempft || gesperrt;
  const klassen = ['web-termin-karte', leise ? 'web-termin-karte--gedaempft' : ''].filter(Boolean).join(' ');
  const symbol = leise ? 'app-icon-color--muted' : '';

  return (
    <article className={klassen} style={{ '--web-akzent': status.farbe } as React.CSSProperties} aria-labelledby={titelId}>
      <EventCornerBadges
        event={event}
        statusText={status.text}
        statusColor={status.farbe}
        showStatus={false}
        grayOut={leise}
        hideTeam={!teamZeigen}
      />
      <header className="web-termin-karte__kopf">
        <h3 id={titelId} className="web-termin-karte__titel" style={{ textDecoration: titelDekoration('kachel', event) }}>
          <WebLink href={href} className="web-link--text web-termin-karte__link"><WebTreffer text={event.name} suche={suche} /></WebLink>
        </h3>
        {unterzeile && <p className="web-termin-karte__untertitel">{unterzeile}</p>}
      </header>

      <WebTerminMarken status={status} event={event} teamZeigen={teamZeigen} serieZeigen={serieZeigen} statusZeigen={statusZeigen} />
      <WebAbsageZeile event={event} />

      <ul className="web-fakten web-fakten--spalte">
        <li className="web-fakt">
          <IonIcon icon={ICON_TERMIN_GEFUELLT} className={`web-fakt__symbol ${symbol || 'app-icon-color--events'}`} aria-hidden="true" />
          <span className="web-nur-vorlesen">Datum: </span>{datum}{uhrzeit ? ` · ${uhrzeit} Uhr` : ''}
        </li>
        {event.location && (
          <li className="web-fakt">
            <IonIcon icon={ICON_ORT_GEFUELLT} className={`web-fakt__symbol ${symbol || 'app-icon-color--location'}`} aria-hidden="true" />
            <span className="web-nur-vorlesen">Ort: </span><WebTreffer text={event.location} suche={suche} />
          </li>
        )}
        {kategorien && (
          <li className="web-fakt">
            <IonIcon icon={ICON_KATEGORIE_GEFUELLT} className={`web-fakt__symbol ${symbol || 'app-icon-color--category'}`} aria-hidden="true" />
            <span className="web-nur-vorlesen">Kategorien: </span>{kategorien}
          </li>
        )}
        {event.bring_items && (
          <li className="web-fakt">
            <IonIcon icon={ICON_MATERIAL} className={`web-fakt__symbol ${symbol || 'app-icon-color--bring'}`} aria-hidden="true" />
            <span className="web-nur-vorlesen">Mitbringen: </span>{event.bring_items}
          </li>
        )}
        {materialAnzahl > 0 && (
          <li className="web-fakt">
            <IonIcon icon={ICON_ANHANG} className={`web-fakt__symbol ${symbol || 'app-icon-color--material'}`} aria-hidden="true" />
            {materialAnzahl} {materialAnzahl === 1 ? 'Material' : 'Materialien'}
          </li>
        )}
      </ul>

      <WebFakten fakten={fakten} gedaempft={leise} />

      {fuss && <footer className="web-termin-karte__fuss">{fuss}</footer>}
    </article>
  );
};

export default WebTerminKarte;
