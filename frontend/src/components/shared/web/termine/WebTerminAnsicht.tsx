// Die Events von Konfis und Team in einer der beiden Ansichten (Simon,
// 06.10.2026: Liste | Kacheln auf Events, Challenges und Konfis): als Karten im
// Raster (WebTerminKarte, die Vorgabe) oder als Liste (Tabelle). Beide zeigen
// dieselben Eintraege in derselben Reihenfolge und rechnen Status, Zahlen und
// "blass" aus denselben Eintraegen -- die Seiten der Rollen (WebKonfiEvents,
// WebTeamEvents) bauen sie einmal und reichen sie herein.
//
// Die Zeile der Liste ist wie die Zeile der Leitung: ein echter Link auf den
// Namen, dessen Netz sich ueber die ganze Zeile spannt (`web-link--zeile`);
// der eigene Status steht mit denselben Marken da wie auf der Karte.

import React from 'react';
import { istAbgesagt, kategorienText, titelDekoration } from '../../eventFormatting';
import { zeitspanneKurz, type Fakt, type TerminStatus } from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import type { WebAnsicht } from '../../../web/useAnsicht';
import WebLink from '../../../web/WebLink';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebAbsageZeile, WebFakten, WebTerminMarken } from './WebTerminBausteine';
import WebTerminKarte from './WebTerminKarte';
import '../../../../theme/web/termine.css';

/** Ein Event mit allem, was beide Ansichten von ihm zeigen. */
export interface WebTerminEintrag {
  event: Event;
  /** Das Detail, als echter Link. */
  href: string;
  status: TerminStatus;
  fakten: readonly Fakt[];
  /** Vergangen ohne Teilnahme: blass. */
  gedaempft?: boolean;
  /** Ein anderer Konfirmationstermin ist schon gebucht: blass. */
  gesperrt?: boolean;
  /** Die Marke des Status zeigen? Vergangene ohne Teilnahme tragen keine. */
  statusZeigen?: boolean;
  /** Zweite Zeile unter dem Namen (die Jahrgaenge). */
  unterzeile?: string;
  /** Anzahl des Materials am Event (nur Team, nur auf der Karte). */
  materialAnzahl?: number;
}

export interface WebTerminAnsichtProps {
  eintraege: readonly WebTerminEintrag[];
  ansicht: WebAnsicht;
  /** Konfis sehen "Team gesucht" nicht. */
  teamZeigen: boolean;
}

/** Die Zahlen der Spalte "Plätze": Plaetze, Team, Warteliste. */
const PLAETZE = new Set<Fakt['art']>(['plaetze', 'team', 'warteliste', 'teamWarteliste']);
/** Die Zahlen der Spalte "Punkte": Punkte und ihre Art. */
const PUNKTE = new Set<Fakt['art']>(['punkte', 'punkteart']);

/** Datum als Zeitpunkt zum Sortieren; fehlt es oder ist es unlesbar, steht die Zeile unten. */
const zeitpunkt = (wert?: string | null): number | null => {
  const ms = wert ? new Date(wert).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

const spaltenFuer = (teamZeigen: boolean): Array<WebSpalte<WebTerminEintrag>> => [
  {
    schluessel: 'event',
    kopf: 'Event',
    breite: '28%',
    sortWert: ({ event: e }) => e.name,
    zelle: ({ event: e, href, unterzeile }) => (
      <>
        <WebLink href={href} className="web-link--zeile web-link--text web-termin-titel">
          <span style={{ textDecoration: titelDekoration('liste', e) }}>{e.name}</span>
          {istAbgesagt(e) && <span className="web-nur-vorlesen">, abgesagt</span>}
        </WebLink>
        {unterzeile && <span className="web-zelle-leise">{unterzeile}</span>}
        <WebAbsageZeile event={e} />
      </>
    ),
  },
  {
    schluessel: 'wann',
    kopf: 'Wann',
    breite: '140px',
    sortWert: ({ event: e }) => zeitpunkt(e.event_date),
    zelle: ({ event: e }) => {
      const { datum, zeit } = zeitspanneKurz(e);
      return (
        <>
          <span className="web-zelle-titel">{datum}</span>
          {zeit && <span className="web-zelle-leise">{zeit}</span>}
        </>
      );
    },
  },
  {
    schluessel: 'ort',
    kopf: 'Ort',
    breite: '15%',
    optional: true,
    sortWert: ({ event: e }) => e.location || kategorienText(e) || null,
    zelle: ({ event: e }) => {
      const kategorien = kategorienText(e);
      return e.location || kategorien ? (
        <>
          {e.location && <span className="web-zelle-titel web-zelle-normal">{e.location}</span>}
          {kategorien && <span className="web-zelle-leise">{kategorien}</span>}
        </>
      ) : <span className="web-gedaempft">–</span>;
    },
  },
  {
    schluessel: 'plaetze',
    kopf: 'Plätze',
    breite: '120px',
    sortWert: ({ event: e, fakten }) => (fakten.some((f) => PLAETZE.has(f.art)) ? e.registered_count || 0 : null),
    zelle: ({ fakten }) => {
      const zahlen = fakten.filter((f) => PLAETZE.has(f.art));
      return zahlen.length > 0 ? <WebFakten fakten={zahlen} spalte /> : <span className="web-gedaempft">–</span>;
    },
  },
  {
    schluessel: 'punkte',
    kopf: 'Punkte',
    breite: '104px',
    optional: true,
    sortWert: ({ event: e, fakten }) => (fakten.some((f) => PUNKTE.has(f.art)) ? e.points || 0 : null),
    zelle: ({ fakten }) => {
      const punkte = fakten.filter((f) => PUNKTE.has(f.art));
      return punkte.length > 0 ? <WebFakten fakten={punkte} spalte /> : <span className="web-gedaempft">–</span>;
    },
  },
  {
    schluessel: 'status',
    kopf: 'Status',
    breite: '168px',
    sortWert: ({ status, statusZeigen = true }) => (statusZeigen ? status.text : null),
    zelle: ({ event: e, status, statusZeigen = true }) => (
      <WebTerminMarken status={status} event={e} teamZeigen={teamZeigen} statusZeigen={statusZeigen} />
    ),
  },
];

const WebTerminAnsicht: React.FC<WebTerminAnsichtProps> = ({ eintraege, ansicht, teamZeigen }) => {
  if (ansicht === 'liste') {
    return (
      <div className="web-karte">
        <WebTabelle
          beschriftung="Events"
          spalten={spaltenFuer(teamZeigen)}
          zeilen={eintraege}
          zeileSchluessel={(z) => z.event.id}
          zeileKlasse={(z) => (z.gedaempft || z.gesperrt ? 'web-zeile--gedaempft' : undefined)}
          fest
        />
      </div>
    );
  }
  return (
    <div className="web-termin-raster">
      {eintraege.map((z) => (
        <WebTerminKarte
          key={z.event.id}
          event={z.event}
          href={z.href}
          status={z.status}
          fakten={z.fakten}
          gedaempft={z.gedaempft}
          gesperrt={z.gesperrt}
          statusZeigen={z.statusZeigen}
          teamZeigen={teamZeigen}
          unterzeile={z.unterzeile}
          materialAnzahl={z.materialAnzahl}
        />
      ))}
    </div>
  );
};

export default WebTerminAnsicht;
