// Die Events der Leitung (Web-Fassung von Mitmachen, /admin/events, 03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6) -- als Liste (Tabelle) oder
// als Kacheln; der Browser merkt sich die Wahl (useAnsicht, Simon, 06.10.2026).
// Die Seite gehoert der Leitung und startet deshalb mit der Liste.
//
// Dieselben Listen wie die App (aktuelleTermine, zuVerbuchendeTermine,
// vergangeneTermine aus shared/eventFormatting.ts): Aktuell, Verbuchen,
// Vergangen -- dazu Abgesagt -- als Reiter; jeder zaehlt seine Liste nach
// allen Filtern, rot ist die Zahl, hinter der Arbeit wartet (Verbuchen).
// Filter nach Jahrgang, Kategorie und Art (Pflicht, Konfirmation, nur Team)
// und die Suche in Name, Titel und Ort. Eine Zeile oeffnet das Event (echter
// Link); Kopieren, Absagen, Absage zuruecknehmen und Loeschen laufen ueber die
// Funktionen der Seite (AdminEventsPage) -- mit denselben Rueckfragen und
// Modalen wie in der App.
//
// Rahmen, Werkzeugzeile und Zustaende stellt WebListenSeite (10.10.2026); hier
// stehen nur Spalten, Karte und Daten -- bis dahin lagen Tabelle und Kacheln
// in eigenen Dateien (WebEventsTabelle, WebEventsKacheln).

import React, { useMemo, useState } from 'react';
import { ICON_TERMIN } from '../../../shared/icons';
import {
  aktuelleTermine,
  istAbgesagt,
  kategorienText,
  titelDekoration,
  vergangeneTermine,
  zuVerbuchendeTermine,
} from '../../../shared/eventFormatting';
import { suchbegriff } from '../../../../utils/supportWeb';
import {
  abgesagteTermine,
  jahrgaengeZeile,
  kategorienNamen,
  leitungFakten,
  leitungListeStatus,
  terminHatArt,
  terminImJahrgang,
  terminSuchtTreffer,
  zeitspanneKurz,
  type ArtFilter,
} from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebKnopf from '../../../web/WebKnopf';
import WebLink from '../../../web/WebLink';
import WebTreffer from '../../../web/WebTreffer';
import WebListenSeite, { type WebListenFilter } from '../../../web/WebListenSeite';
import type { WebSpalte } from '../../../web/WebListe';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import { terminKarte } from '../../../shared/web/termine/WebTerminKarte';
import { WebTerminSymbol, WebAbsageZeile, WebFakten, WebTerminMarken } from '../../../shared/web/termine/WebTerminBausteine';
import WebEventAktionen from './WebEventAktionen';
import { ZEIT_FILTER, type TerminAktionen, type ZeitFilter } from './typen';
import '../../../../theme/web/termine.css';
import { leerVon } from '../../../../seiten/beschreibung';
import {
  JAHRGANG_FILTER,
  KATEGORIE_FILTER,
  LEITUNG_ART,
  LEITUNG_EVENTS_LEER_TITEL,
  LEITUNG_EVENTS_TITEL,
  LEITUNG_EVENTS_UNTERTITEL,
  LEITUNG_ZEITRAUM,
  LEITUNG_ZEITRAUM_BESCHRIFTUNG,
} from '../../../../seiten/mitmachenLeitung';
import { terminStatusRang } from '../../../../utils/statusReihenfolge';

export interface WebEventsLeitungProps {
  /** GET /events ohne die abgesagten. */
  events: readonly Event[];
  /** GET /events/cancelled. */
  abgesagte: readonly Event[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  /** Terminverwaltung ist Leitungssache (utils/terminRechte.ts). */
  darfVerwalten: boolean;
  aktionen: TerminAktionen;
  /** Die Events werden geladen (der erste Stand fehlt noch). */
  laedt?: boolean;
  /** Das Laden ist gescheitert, und es gibt keinen Stand: erneut versuchen. */
  fehler?: { onErneut: () => void };
  /** Knoepfe im Kopf (Legende, Aktualisieren, Neues Event) -- von Mitmachen. */
  kopfAktionen?: React.ReactNode;
  /** Ueber der Werkzeugzeile: die Reiter von Mitmachen. */
  oben?: React.ReactNode;
  /** Fuer die Modale, die ueber dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
  /**
   * Ohne eigene IonPage: Mitmachen haelt EINE IonPage fuer beide Reiter
   * (WebMitmachenLeitung). Bringt jeder Reiter seine eigene mit, baut React
   * sie beim Wechsel neu, und die neue bleibt weiss (ion-page-invisible).
   */
  ohneIonPage?: boolean;
}

/** Datum als Zeitpunkt zum Sortieren; fehlt es oder ist es unlesbar, steht die Zeile unten. */
const zeitpunkt = (wert?: string | null): number | null => {
  const ms = wert ? new Date(wert).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

const eventSpalten = (suche: string, darfVerwalten: boolean, aktionen: TerminAktionen): Array<WebSpalte<Event>> => [
  {
    schluessel: 'event',
    kopf: 'Event',
    breite: '25%',
    sortWert: (e) => e.name,
    zelle: (e) => {
      const jahrgaenge = jahrgaengeZeile(e);
      return (
        <span className="web-person-zelle">
          <WebTerminSymbol status={leitungListeStatus(e)} event={e} />
          <span className="web-person-zelle__text">
            <WebLink href={`/admin/events/${e.id}`} className="web-link--zeile web-link--text web-termin-titel">
              <span style={{ textDecoration: titelDekoration('liste', e) }}>
                <WebTreffer text={e.name} suche={suche} />
              </span>
              {istAbgesagt(e) && <span className="web-nur-vorlesen">, abgesagt</span>}
            </WebLink>
            {jahrgaenge && <span className="web-zelle-leise">{jahrgaenge}</span>}
            <WebAbsageZeile event={e} />
          </span>
        </span>
      );
    },
  },
  {
    schluessel: 'wann',
    kopf: 'Wann',
    breite: '140px',
    sortWert: (e) => zeitpunkt(e.event_date),
    zelle: (e) => {
      const { datum, zeit: uhr } = zeitspanneKurz(e);
      return (
        <>
          <span className="web-zelle-titel">{datum}</span>
          {uhr && <span className="web-zelle-leise">{uhr}</span>}
        </>
      );
    },
  },
  {
    schluessel: 'ort',
    kopf: 'Ort',
    breite: '15%',
    optional: true,
    sortWert: (e) => e.location || kategorienText(e) || null,
    zelle: (e) => {
      const kategorienZeile = kategorienText(e);
      return e.location || kategorienZeile ? (
        <>
          {e.location && <span className="web-zelle-titel web-zelle-normal"><WebTreffer text={e.location} suche={suche} /></span>}
          {kategorienZeile && <span className="web-zelle-leise">{kategorienZeile}</span>}
        </>
      ) : <span className="web-gedaempft">–</span>;
    },
  },
  {
    schluessel: 'teilnahme',
    kopf: 'Teilnahme',
    breite: '120px',
    sortWert: (e) => e.registered_count || 0,
    zelle: (e) => {
      const zahlen = leitungFakten(e).filter((f) => f.art === 'plaetze' || f.art === 'team' || f.art === 'warteliste');
      return zahlen.length > 0 ? <WebFakten fakten={zahlen} spalte /> : <span className="web-gedaempft">–</span>;
    },
  },
  {
    schluessel: 'punkte',
    kopf: 'Punkte',
    breite: '104px',
    optional: true,
    sortWert: (e) => e.points || 0,
    zelle: (e) => {
      const punkte = leitungFakten(e).filter((f) => f.art === 'punkte' || f.art === 'punkteart');
      return punkte.length > 0 ? <WebFakten fakten={punkte} spalte /> : <span className="web-gedaempft">–</span>;
    },
  },
  {
    schluessel: 'status',
    kopf: 'Status',
    breite: '168px',
    sortWert: (e) => terminStatusRang(leitungListeStatus(e).text),
    zelle: (e) => <WebTerminMarken status={leitungListeStatus(e)} event={e} teamZeigen serieZeigen />,
  },
  // Kopieren, Absagen, Loeschen: mehr als Bearbeiten/Loeschen der Liste, deshalb eine eigene Spalte.
  ...(darfVerwalten ? [{
    schluessel: 'aktionen',
    kopf: 'Aktionen',
    kopfVersteckt: true,
    breite: '176px',
    klasse: 'web-spalte-termin-aktionen',
    zelle: (e: Event) => <WebEventAktionen event={e} aktionen={aktionen} />,
  }] : []),
];

const WebEventsLeitung: React.FC<WebEventsLeitungProps> = ({
  events, abgesagte, jahrgaenge, darfVerwalten, aktionen, laedt = false, fehler, kopfAktionen, oben, pageRef, ohneIonPage = false,
}) => {
  const [zeit, setZeit] = useFilterAusAdresse<ZeitFilter>('/admin/events', ZEIT_FILTER, 'aktuell');
  const [suche, setSuche] = useState('');
  const [jahrgang, setJahrgang] = useState('alle');
  const [kategorie, setKategorie] = useState('alle');
  const [art, setArt] = useState<string>('alle');

  const kategorien = useMemo(() => {
    const namen = new Set<string>();
    for (const e of [...events, ...abgesagte]) for (const n of kategorienNamen(e)) namen.add(n);
    return [...namen].sort((a, b) => a.localeCompare(b, 'de'));
  }, [events, abgesagte]);

  // Die Listen der vier Reiter -- vor Filtern und Suche; die filtert die Huelle.
  const listen = useMemo(() => {
    const offen = [...events];
    const zu = [...abgesagte];
    return {
      aktuell: aktuelleTermine(offen, zu),
      verbuchen: zuVerbuchendeTermine(offen),
      vergangen: vergangeneTermine(offen, zu),
      abgesagt: abgesagteTermine(offen, zu),
    } satisfies Record<ZeitFilter, Event[]>;
  }, [events, abgesagte]);

  const filter: Array<WebListenFilter<Event> | false> = [
    jahrgaenge.length > 0 && {
      beschriftung: JAHRGANG_FILTER.label,
      darstellung: 'auswahl',
      wahlen: [
        { schluessel: 'alle', label: JAHRGANG_FILTER.alle },
        ...jahrgaenge.map((j) => ({ schluessel: String(j.id), label: j.name, passt: (e: Event) => terminImJahrgang(e, j.id) })),
      ],
      wert: jahrgang,
      onWert: setJahrgang,
    },
    kategorien.length > 0 && {
      beschriftung: KATEGORIE_FILTER.label,
      darstellung: 'auswahl',
      wahlen: [
        { schluessel: 'alle', label: KATEGORIE_FILTER.alle },
        ...kategorien.map((k) => ({ schluessel: k, label: k, passt: (e: Event) => kategorienNamen(e).includes(k) })),
      ],
      wert: kategorie,
      onWert: setKategorie,
    },
    {
      beschriftung: 'Art',
      darstellung: 'auswahl',
      wahlen: LEITUNG_ART.map((a) => ({ ...a, passt: (e: Event) => terminHatArt(e, a.schluessel as ArtFilter) })),
      wert: art,
      onWert: setArt,
    },
  ];

  // Die Zahl am Reiter zaehlt seine Liste nach allen Filtern und der Suche -- wie die Huelle filtert.
  const passt = (e: Event): boolean => filter.every((f) => !f || (f.wahlen.find((w) => w.schluessel === f.wert)?.passt?.(e) ?? true))
    && terminSuchtTreffer(e, suche);
  const zahlen = Object.fromEntries(ZEIT_FILTER.map((z) => [z, listen[z].filter(passt).length])) as Record<ZeitFilter, number>;

  const sucht = suchbegriff(suche) !== '';
  const gefiltert = sucht || jahrgang !== 'alle' || kategorie !== 'alle' || art !== 'alle';
  const zuruecksetzen = () => {
    setSuche('');
    setJahrgang('alle');
    setKategorie('alle');
    setArt('alle');
  };
  // Waehrend des ersten Ladens (oder nach einem Fehler) steht keine Zahl an den Reitern.
  const ohneStand = laedt || Boolean(fehler);

  return (
    <WebListenSeite<Event, ZeitFilter>
      bereich="Mitmachen"
      titel={LEITUNG_EVENTS_TITEL}
      untertitel={LEITUNG_EVENTS_UNTERTITEL}
      aktionen={kopfAktionen}
      pageRef={pageRef}
      ohneIonPage={ohneIonPage}
      oben={oben}
      reiter={{
        beschriftung: LEITUNG_ZEITRAUM_BESCHRIFTUNG,
        // Reiter aus der gemeinsamen Beschreibung (seiten/mitmachenLeitung.ts).
        wahlen: LEITUNG_ZEITRAUM,
        wert: zeit,
        onWert: setZeit,
        zahlen: ohneStand ? undefined : zahlen,
        farbe: { verbuchen: 'rot' },
      }}
      filter={filter}
      suche={{
        beschriftung: 'Events durchsuchen',
        platzhalter: 'Name oder Ort suchen',
        wert: suche,
        onWert: setSuche,
        // Dieselben Felder wie terminSuchtTreffer (Name, Titel, Ort).
        felder: (e) => [e.name, e.title, e.location],
      }}
      werkzeuge={gefiltert ? <WebKnopf art="text" klein onClick={zuruecksetzen}>Filter zurücksetzen</WebKnopf> : undefined}
      ansicht={{ seite: 'events-leitung', vorgabe: 'liste' }}
      eintraege={listen[zeit]}
      liste={{
        beschriftung: 'Events',
        spalten: eventSpalten(suche, darfVerwalten, aktionen),
        zeileSchluessel: (e) => e.id,
        zeileKlasse: (e) => (leitungListeStatus(e).gedaempft ? 'web-zeile--gedaempft' : undefined),
        fest: true,
      }}
      kacheln={{
        beschriftung: 'Events',
        schluessel: (e) => e.id,
        karte: (e) => {
          const status = leitungListeStatus(e);
          return terminKarte({
            event: e,
            href: `/admin/events/${e.id}`,
            status,
            fakten: leitungFakten(e),
            gedaempft: status.gedaempft,
            teamZeigen: true,
            serieZeigen: true,
            unterzeile: jahrgaengeZeile(e),
            suche,
          });
        },
        // Dieselben Knoepfe wie am Zeilenende, mit Wort.
        fuss: darfVerwalten ? (e) => <WebEventAktionen event={e} aktionen={aktionen} mitText /> : undefined,
      }}
      leer={{
        icon: ICON_TERMIN,
        titel: gefiltert ? 'Keine Treffer' : LEITUNG_EVENTS_LEER_TITEL,
        text: gefiltert ? 'Zu diesen Filtern gibt es hier kein Event.' : leerVon(LEITUNG_ZEITRAUM, zeit),
        aktion: gefiltert ? <WebKnopf onClick={zuruecksetzen}>Filter zurücksetzen</WebKnopf> : undefined,
      }}
      inhaltLaden={laedt ? 'Die Events werden geladen.' : undefined}
      inhaltFehler={!laedt && fehler ? { text: 'Die Events konnten nicht geladen werden.', onErneut: fehler.onErneut } : undefined}
    />
  );
};

export default WebEventsLeitung;
