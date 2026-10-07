// Ein Event als Karte im Raster -- die Liste der Konfis und des Teams in der
// Web-Fassung (docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Gebaut wie die Challenge-Karte (WebBildKarte; Simon, 07.10.2026): im Kopf
// der Titel („evet titel gerne in den header der kachel") mit Art und
// Kategorien auf der Farbe des Status (wie die
// Balken der App); Status und Merkmale (Pflicht, Konfirmation, Team, Serie)
// stehen als Chips darunter -- keine Eck-Badges wie in der App (Simon,
// 07.10.2026: „die corner badges funktionieren so nicht. sollten chips sein"). Die ganze
// Karte ist ein Link auf das Detail (echter <a>: Mittelklick oeffnet einen
// neuen Tab, Rechtsklick kopiert die Adresse).
//
// Dieselbe Karte fuer Konfis, Team und Leitung (Ansicht "Kacheln", Simon,
// 06.10.2026): Sie liest nur, was da ist. Die Leitung gibt ihre Knoepfe im Fuss
// mit (`fuss`: Kopieren, Absagen, Loeschen) -- wie die Challenge-Karte; sie
// liegen ueber dem Link der Karte.

import React from 'react';
import {
  ICON_ANHANG,
  ICON_MATERIAL,
  ICON_ORT_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../../icons';
import WebBildKarte, { WebBildKarteSymbol } from '../../../web/WebBildKarte';
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
  const { datum, uhrzeit } = terminDatumUhrzeit(event);
  const kategorien = kategorienText(event);
  const leise = gedaempft || gesperrt;

  return (
    <WebBildKarte
      // Der Kopf traegt die Farbe des Status wie die Balken der App.
      akzent={status.farbe}
      gedaempft={leise}
      klasse={['web-termin-karte', leise ? 'web-termin-karte--gedaempft' : ''].filter(Boolean).join(' ')}
      symbol={<WebBildKarteSymbol icon={ICON_TERMIN_GEFUELLT} />}
      label={kategorien ? `Event · ${kategorien}` : 'Event'}
      titelImKopf
      marken={<WebTerminMarken status={status} event={event} teamZeigen={teamZeigen} serieZeigen={serieZeigen} statusZeigen={statusZeigen} />}
      titel={<WebTreffer text={event.name} suche={suche} />}
      titelStil={{ textDecoration: titelDekoration('kachel', event) }}
      href={href}
      unterzeile={unterzeile}
      angaben={[
        { icon: ICON_TERMIN_GEFUELLT, inhalt: <><span className="web-nur-vorlesen">Datum: </span>{datum}{uhrzeit ? ` · ${uhrzeit} Uhr` : ''}</>, farbe: 'var(--app-color-events)' },
        event.location && { icon: ICON_ORT_GEFUELLT, inhalt: <><span className="web-nur-vorlesen">Ort: </span><WebTreffer text={event.location} suche={suche} /></>, farbe: 'var(--app-color-events)' },
        event.bring_items && { icon: ICON_MATERIAL, inhalt: <><span className="web-nur-vorlesen">Mitbringen: </span>{event.bring_items}</>, farbe: 'var(--app-color-konfis)' },
        materialAnzahl > 0 && { icon: ICON_ANHANG, inhalt: `${materialAnzahl} ${materialAnzahl === 1 ? 'Material' : 'Materialien'}`, farbe: 'var(--app-color-material)' },
      ]}
      fuss={fuss}
    >
      <WebAbsageZeile event={event} />
      <WebFakten fakten={fakten} gedaempft={leise} />
    </WebBildKarte>
  );
};

export default WebTerminKarte;
