// Bausteine der Web-Fassung von Mitmachen (Events), 03.10.2026 -- fuer alle drei
// Rollen: Reiter oben, Marken, Zahlen mit Symbol, Angaben, Absage, Hinweise
// der Teilnehmerliste und der Link nach draussen.
//
// Sie kennen keine Rolle und laden nichts; was sie zeigen, kommt aus
// utils/termineWeb.ts. Die Seiten der Rollen setzen sie zusammen
// (components/<rolle>/web/termine/).

import React, { useCallback } from 'react';
import { IonIcon, useIonRouter } from '@ionic/react';
import {
  ICON_FLAMME_GEFUELLT,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_LISTE,
  ICON_PERSON_HINZUFUEGEN_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_SCHUTZ_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../../icons';
import SegmentZahl from '../../SegmentZahl';
import WebPill from '../../../web/WebPill';
import WebHinweis from '../../../web/WebHinweis';
import WebAngaben from '../../../web/WebAngaben';
import { linkOeffnen } from '../../../../services/systemDialoge';
import {
  absageUrheberZeile,
  absagegrundUrheberZeile,
  checkinZeile,
  notizUrheberZeile,
  urheberZeile,
} from '../../../../utils/anwesenheitUrheber';
import { teilnahmeDarstellung } from '../../../../utils/teilnahmeStatus';
import type { Fakt, FaktArt, TerminAngabe, TerminStatus } from '../../../../utils/termineWeb';
import type { Event, Participant } from '../../../../types/event';
import type { PillTon } from '../../../../utils/supportWeb';
import '../../../../theme/web/termine.css';

// --- Link nach draussen ----------------------------------------------------

/** Ein Link auf eine fremde Seite (Karte): ueber die Huelle der App, damit die App-Sperre nicht ausloest. */
export const WebExternLink: React.FC<{ href: string; children: React.ReactNode; title?: string }> = ({ href, children, title }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="web-link"
    title={title}
    onClick={(e) => { e.preventDefault(); linkOeffnen(href); }}
  >
    {children}
  </a>
);

// --- Reiter oben -----------------------------------------------------------

export interface WebReiterEintrag {
  schluessel: string;
  label: string;
  href: string;
  aktiv: boolean;
  /** Orange Zahl am Reiter: Wartendes (Verbuchen, Entscheidungen). */
  zahl?: number;
  /** Satz dazu fuer Vorleseprogramme, z. B. "Events warten auf Verbuchung". */
  zahlText?: string;
}

/**
 * Die Reiter oben auf der Seite als echte Links: Mittelklick oeffnet einen neuen
 * Tab, die Adresse traegt die Wahl (`?segment=`). Der Klick bleibt in der App
 * (useIonRouter, wie die Leiste links und WebLink).
 */
export const WebReiter: React.FC<{ beschriftung: string; eintraege: readonly WebReiterEintrag[] }> = ({ beschriftung, eintraege }) => {
  const router = useIonRouter();
  const oeffne = useCallback((ereignis: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (ereignis.button !== 0 || ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey) return;
    ereignis.preventDefault();
    router.push(href, 'none', 'push');
  }, [router]);

  return (
    <nav className="web-reiter" aria-label={beschriftung}>
      {eintraege.map((e) => (
        <a
          key={e.schluessel}
          href={e.href}
          className={e.aktiv ? 'web-reiter__link web-reiter__link--aktiv' : 'web-reiter__link'}
          aria-current={e.aktiv ? 'page' : undefined}
          onClick={(ereignis) => oeffne(ereignis, e.href)}
        >
          {e.label}
          {e.zahl !== undefined && <SegmentZahl anzahl={e.zahl} label={e.zahlText} />}
        </a>
      ))}
    </nav>
  );
};

// --- Marken: Status und Merkmale ---------------------------------------------

/** Die Merkmale eines Events als Marken (Pflicht, Konfirmation, Team, Serie) -- ohne den Status. */
export const WebMerkmale: React.FC<{
  event: Pick<Event, 'mandatory' | 'is_konfirmation' | 'teamer_only' | 'teamer_needed' | 'is_series'>;
  /** Konfis geht "Team gesucht" nichts an. */
  teamZeigen: boolean;
  serieZeigen?: boolean;
  /** Der Status sagt "Pflicht" schon selbst -- dann steht die Marke nicht doppelt da. */
  ohnePflicht?: boolean;
}> = ({ event, teamZeigen, serieZeigen = false, ohnePflicht = false }) => (
  <>
    {/* Farben und Symbole wie die Eck-Badges der App (EventCornerBadges). */}
    {event.mandatory && !ohnePflicht && <WebPill title="Pflichtveranstaltung" icon={ICON_SCHUTZ_GEFUELLT} farbe="var(--app-color-events)">Pflicht</WebPill>}
    {event.is_konfirmation && <WebPill title="Konfirmation" icon={ICON_FLAMME_GEFUELLT} farbe="var(--app-color-konfis)">Konfirmation</WebPill>}
    {teamZeigen && event.teamer_only && <WebPill title="Nur Team" icon={ICON_GRUPPE_GEFUELLT} farbe="var(--app-color-teamer)">Nur Team</WebPill>}
    {teamZeigen && !event.teamer_only && event.teamer_needed && <WebPill title="Team gesucht" icon={ICON_PERSON_HINZUFUEGEN_GEFUELLT} farbe="var(--app-color-teamer)">Team gesucht</WebPill>}
    {serieZeigen && event.is_series && <WebPill title="Teil einer Event-Serie" icon={ICON_TERMIN_GEFUELLT} farbe="var(--app-color-info)">Serie</WebPill>}
  </>
);

/** Status und Merkmale in einer Reihe. */
export const WebTerminMarken: React.FC<{
  status: Pick<TerminStatus, 'text' | 'ton'>;
  event: Pick<Event, 'mandatory' | 'is_konfirmation' | 'teamer_only' | 'teamer_needed' | 'is_series'>;
  teamZeigen: boolean;
  serieZeigen?: boolean;
  statusZeigen?: boolean;
}> = ({ status, event, teamZeigen, serieZeigen, statusZeigen = true }) => (
  <span className="web-pillreihe">
    {statusZeigen && (status.text.startsWith('Pflicht')
      // Der Stand sagt schon "Pflicht": dann im Aussehen des Merkmals, mit Schild.
      ? <WebPill title="Pflichtveranstaltung" icon={ICON_SCHUTZ_GEFUELLT} farbe="var(--app-color-events)">{status.text}</WebPill>
      : <WebPill ton={status.ton as PillTon} punkt>{status.text}</WebPill>)}
    <WebMerkmale event={event} teamZeigen={teamZeigen} serieZeigen={serieZeigen} ohnePflicht={status.text.startsWith('Pflicht')} />
  </span>
);

// --- Zahlen mit Symbol ----------------------------------------------------------

const FAKT_NAME: Record<FaktArt, string> = {
  plaetze: 'Plätze',
  team: 'Team',
  warteliste: 'Warteliste',
  teamWarteliste: 'Team-Warteliste',
  punkte: 'Punkte',
  punkteart: 'Punkteart',
};

const faktSymbol = (f: Fakt): { icon: string; klasse: string } => {
  switch (f.art) {
    case 'team': return { icon: ICON_GRUPPE_GEFUELLT, klasse: 'app-icon-color--team' };
    case 'warteliste':
    case 'teamWarteliste': return { icon: ICON_LISTE, klasse: 'app-icon-color--waitlist' };
    case 'punkte': return { icon: ICON_POKAL_GEFUELLT, klasse: 'app-icon-color--points' };
    case 'punkteart':
      return f.punkteart === 'gottesdienst'
        ? { icon: ICON_GOTTESDIENST_GEFUELLT, klasse: 'app-icon-color--gottesdienst' }
        : { icon: ICON_GEMEINDE_GEFUELLT, klasse: 'app-icon-color--gemeinde' };
    default: return { icon: ICON_GRUPPE_GEFUELLT, klasse: 'app-icon-color--participants' };
  }
};

/** Die Zahlen eines Events (Plaetze, Team, Warteliste, Punkte) als Zeile mit kleinen Symbolen. */
export const WebFakten: React.FC<{ fakten: readonly Fakt[]; gedaempft?: boolean; spalte?: boolean }> = ({ fakten, gedaempft = false, spalte = false }) => {
  if (fakten.length === 0) return null;
  return (
    <ul className={spalte ? 'web-fakten web-fakten--spalte' : 'web-fakten'}>
      {fakten.map((f) => {
        const { icon, klasse } = faktSymbol(f);
        return (
          <li key={f.art} className="web-fakt">
            <IonIcon icon={icon} className={`web-fakt__symbol ${gedaempft ? 'app-icon-color--muted' : klasse}`} aria-hidden="true" />
            <span className="web-nur-vorlesen">{FAKT_NAME[f.art]}: </span>
            {f.text}
          </li>
        );
      })}
    </ul>
  );
};

// --- Angaben --------------------------------------------------------------------

/**
 * Die Angaben eines Events als Liste "Bezeichnung -- Wert". Der Ort fuehrt zur
 * Karte; das Material ruft `onMaterial` (springt zum Abschnitt oder oeffnet es).
 */
/**
 * Die Punkteart haengt am Wert: "Typ" zeigt Kirche oder Gemeinde wie die App.
 * Alle uebrigen Angaben holen ihr Symbol aus components/web/angabeSymbole.ts.
 */
const typSymbol = (a: TerminAngabe): { icon?: string; iconKlasse?: string } => {
  if (a.label !== 'Typ') return {};
  const gottesdienst = a.zeilen[0] === 'Gottesdienst';
  return {
    icon: gottesdienst ? ICON_GOTTESDIENST_GEFUELLT : ICON_GEMEINDE_GEFUELLT,
    iconKlasse: gottesdienst ? 'app-icon-color--gottesdienst' : 'app-icon-color--gemeinde',
  };
};

export const WebTerminAngaben: React.FC<{
  angaben: readonly TerminAngabe[];
  beschriftung?: string;
  onMaterial?: () => void;
}> = ({ angaben, beschriftung = 'Angaben zum Event', onMaterial }) => (
  <WebAngaben
    beschriftung={beschriftung}
    angaben={angaben.map((a) => ({
      label: a.label,
      ...typSymbol(a),
      wert: a.ortLink
        ? <WebExternLink href={a.ortLink} title="Auf der Karte zeigen">{a.zeilen[0]}</WebExternLink>
        : a.materialSprung && onMaterial
          ? <button type="button" className="web-link web-link--knopf" onClick={onMaterial}>{a.zeilen[0]}</button>
          : a.zeilen.length > 1
            ? <>{a.zeilen.map((z) => <span key={z} className="web-angabe-zeile">{z}</span>)}</>
            : a.zeilen[0],
    }))}
  />
);

// --- Absage ---------------------------------------------------------------------

/**
 * Der Hinweis auf einen abgesagten Termin im Detail: der Grund (oder der Satz,
 * dass keiner angegeben ist) und wer abgesagt hat. Nur Auskunft, keine Knoepfe
 * (Simon, 16.09.2026) -- geaendert wird ueber die Aktionen der Leitung.
 */
export const WebAbsage: React.FC<{ event: Event }> = ({ event }) => {
  const grund = event.cancelled_reason?.trim() || '';
  const absager = absageUrheberZeile(event);
  const grundVon = absagegrundUrheberZeile(event);
  return (
    <WebHinweis art="fehler" rolle="status" titel="Dieses Event ist abgesagt">
      <span className="web-absage">
        {grund
          ? <span><strong>Grund: </strong>{grund}</span>
          : <span className="web-gedaempft">Kein Grund zur Absage angegeben.</span>}
        {absager && <span className="web-zelle-leise">{absager}</span>}
        {grundVon && <span className="web-zelle-leise">{grundVon}</span>}
      </span>
    </WebHinweis>
  );
};

/** Der Grund einer Absage in der Karte oder Zeile: eine Zeile, nur wenn es einen gibt. */
export const WebAbsageZeile: React.FC<{ event: Event }> = ({ event }) => {
  const grund = event.cancelled_reason?.trim();
  if (!grund) return null;
  return <span className="web-zelle-leise web-absage-zeile"><strong>Abgesagt: </strong>{grund}</span>;
};

// --- Teilnehmerliste: Hinweise einer Zeile -----------------------------------------

/**
 * Was zu einer Person der Teilnehmerliste noch zu sagen ist: Selbstabmeldung
 * mit Grund, nachgetragene Abmeldung, wer es eingetragen hat, der Check-in und
 * die Notiz. Dieselben Zeilen wie die Listen der App (EventDetailView, Wer kommt).
 */
export const WebTeilnahmeHinweise: React.FC<{ person: Participant }> = ({ person }) => {
  const d = teilnahmeDarstellung(person);
  const urheber = urheberZeile(person);
  const checkin = checkinZeile(person);
  const notizUrheber = person.attendance_note ? notizUrheberZeile(person) : null;
  return (
    <>
      {person.status === 'opted_out' && (person.opt_out_reason || person.absage_nach_zusage) && (
        <span className="web-zelle-leise">
          {person.absage_nach_zusage && <strong>Nach Zusage abgesagt{person.opt_out_reason ? ': ' : ''}</strong>}
          {!person.absage_nach_zusage && person.attendance_status && <strong>Hatte sich abgemeldet{person.opt_out_reason ? ': ' : ''}</strong>}
          {person.opt_out_reason}
        </span>
      )}
      {(d.istAbgemeldet || d.istNachgetragen) && person.excuse_reason && (
        <span className="web-zelle-leise"><strong>Abgemeldet: </strong>{person.excuse_reason}</span>
      )}
      {urheber && <span className="web-zelle-leise">{urheber}</span>}
      {checkin && <span className="web-zelle-leise">{checkin}</span>}
      {person.attendance_note && <span className="web-zelle-leise"><strong>Notiz: </strong>{person.attendance_note}</span>}
      {notizUrheber && <span className="web-zelle-leise">{notizUrheber}</span>}
    </>
  );
};
