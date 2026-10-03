// Die Events der Leitung als Tabelle (Web-Fassung von Mitmachen, 03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Dieselben Listen wie die App (aktuelleTermine, zuVerbuchendeTermine,
// vergangeneTermine aus shared/eventFormatting.ts): Aktuell, Verbuchen,
// Vergangen -- dazu Abgesagt. Filter nach Jahrgang, Kategorie und Art
// (Pflicht, Konfirmation, nur Team) und die Suche. Eine Zeile oeffnet das Event
// (echter Link); Kopieren, Absagen, Absage zuruecknehmen und Loeschen laufen
// ueber die Funktionen der Seite (AdminEventsPage) -- mit denselben
// Rueckfragen und Modalen wie in der App.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_BEARBEITEN,
  ICON_GESPERRT,
  ICON_KOPIEREN,
  ICON_LOESCHEN,
  ICON_RUECKGAENGIG,
  ICON_TERMIN,
} from '../../../shared/icons';
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
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebAuswahl from '../../../web/WebAuswahl';
import WebKnopf from '../../../web/WebKnopf';
import WebLink from '../../../web/WebLink';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import WebTreffer from '../../../web/WebTreffer';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import { WebAbsageZeile, WebFakten, WebTerminMarken } from '../../../shared/web/termine/WebTerminBausteine';
import { ZEIT_FILTER, type TerminAktionen, type ZeitFilter } from './typen';
import '../../../../theme/web/termine.css';

const LEER_TEXT: Record<ZeitFilter, string> = {
  aktuell: 'Keine anstehenden Events',
  verbuchen: 'Keine Events zum Verbuchen',
  vergangen: 'Keine vergangenen Events',
  abgesagt: 'Keine abgesagten Events',
};

const ART_OPTIONEN: Array<{ wert: ArtFilter; label: string }> = [
  { wert: 'alle', label: 'Alle Arten' },
  { wert: 'pflicht', label: 'Pflicht-Events' },
  { wert: 'konfirmation', label: 'Konfirmation' },
  { wert: 'team', label: 'Nur Team' },
];

export interface WebEventsTabelleProps {
  /** GET /events ohne die abgesagten. */
  events: readonly Event[];
  /** GET /events/cancelled. */
  abgesagte: readonly Event[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  /** Terminverwaltung ist Leitungssache (utils/terminRechte.ts). */
  darfVerwalten: boolean;
  aktionen: TerminAktionen;
}

const WebEventsTabelle: React.FC<WebEventsTabelleProps> = ({ events, abgesagte, jahrgaenge, darfVerwalten, aktionen }) => {
  const [zeit, setZeit] = useFilterAusAdresse<ZeitFilter>('/admin/events', ZEIT_FILTER, 'aktuell');
  const [suche, setSuche] = useState('');
  const [jahrgang, setJahrgang] = useState('alle');
  const [kategorie, setKategorie] = useState('alle');
  const [art, setArt] = useState<ArtFilter>('alle');

  const kategorien = useMemo(() => {
    const namen = new Set<string>();
    for (const e of [...events, ...abgesagte]) for (const n of kategorienNamen(e)) namen.add(n);
    return [...namen].sort((a, b) => a.localeCompare(b, 'de'));
  }, [events, abgesagte]);

  const passt = useMemo(() => (e: Event): boolean => {
    if (jahrgang !== 'alle' && !terminImJahrgang(e, Number(jahrgang))) return false;
    if (kategorie !== 'alle' && !kategorienNamen(e).includes(kategorie)) return false;
    if (!terminHatArt(e, art)) return false;
    return terminSuchtTreffer(e, suche);
  }, [jahrgang, kategorie, art, suche]);

  // Die Listen der vier Reiter, jeweils mit den gemeinsamen Filtern.
  const listen = useMemo(() => {
    const offen = [...events];
    const zu = [...abgesagte];
    return {
      aktuell: aktuelleTermine(offen, zu).filter(passt),
      verbuchen: zuVerbuchendeTermine(offen).filter(passt),
      vergangen: vergangeneTermine(offen, zu).filter(passt),
      abgesagt: abgesagteTermine(offen, zu).filter(passt),
    } satisfies Record<ZeitFilter, Event[]>;
  }, [events, abgesagte, passt]);

  const sichtbar = listen[zeit];
  const sucht = suchbegriff(suche) !== '';
  const gefiltert = sucht || jahrgang !== 'alle' || kategorie !== 'alle' || art !== 'alle';

  const zuruecksetzen = () => {
    setSuche('');
    setJahrgang('alle');
    setKategorie('alle');
    setArt('alle');
  };

  const spalten: Array<WebSpalte<Event>> = [
    {
      schluessel: 'event',
      kopf: 'Event',
      breite: '25%',
      zelle: (e) => {
        const abgesagtes = istAbgesagt(e);
        return (
          <>
            <WebLink
              href={`/admin/events/${e.id}`}
              className="web-link--zeile web-link--text web-termin-titel"
            >
              <span style={{ textDecoration: titelDekoration('liste', e) }}>
                <WebTreffer text={e.name} suche={suche} />
              </span>
              {abgesagtes && <span className="web-nur-vorlesen">, abgesagt</span>}
            </WebLink>
            {e.jahrgang_names && <span className="web-zelle-leise">{e.jahrgang_names.split(',').map((n) => n.trim()).join(' · ')}</span>}
            <WebAbsageZeile event={e} />
          </>
        );
      },
    },
    {
      schluessel: 'wann',
      kopf: 'Wann',
      breite: '140px',
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
      zelle: (e) => {
        const punkte = leitungFakten(e).filter((f) => f.art === 'punkte' || f.art === 'punkteart');
        return punkte.length > 0 ? <WebFakten fakten={punkte} spalte /> : <span className="web-gedaempft">–</span>;
      },
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '168px',
      zelle: (e) => {
        const s = leitungListeStatus(e);
        return <WebTerminMarken status={s} event={e} teamZeigen serieZeigen />;
      },
    },
  ];

  if (darfVerwalten) {
    spalten.push({
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '176px',
      klasse: 'web-spalte-termin-aktionen',
      zelle: (e) => {
        const abgesagtes = istAbgesagt(e);
        return (
          <div className="web-termin-aktionen">
            {abgesagtes && (
              <WebKnopf klein symbol vorn aria-label="Absage zurücknehmen" title="Absage zurücknehmen" onClick={() => aktionen.zuruecknehmen(e)}>
                <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
              </WebKnopf>
            )}
            <WebKnopf klein symbol vorn aria-label="Event kopieren" title="Event kopieren" onClick={() => aktionen.kopieren(e)}>
              <IonIcon icon={ICON_KOPIEREN} aria-hidden="true" />
            </WebKnopf>
            <WebKnopf
              klein
              symbol
              vorn
              aria-label={abgesagtes ? 'Absagegrund bearbeiten' : 'Event absagen'}
              title={abgesagtes ? 'Absagegrund bearbeiten' : 'Event absagen'}
              onClick={() => aktionen.absagen(e)}
            >
              <IonIcon icon={abgesagtes ? ICON_BEARBEITEN : ICON_GESPERRT} aria-hidden="true" />
            </WebKnopf>
            <WebKnopf klein symbol vorn art="gefahr" aria-label="Event löschen" title="Event löschen" onClick={() => aktionen.loeschen(e)}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          </div>
        );
      },
    });
  }

  return (
    <>
      <div className="web-werkzeuge">
        <WebChips<ZeitFilter>
          beschriftung="Events nach Zeitraum"
          wert={zeit}
          onWert={setZeit}
          chips={[
            { wert: 'aktuell', label: 'Aktuell', zahl: listen.aktuell.length },
            { wert: 'verbuchen', label: 'Verbuchen', zahl: listen.verbuchen.length, rot: true, zahlText: 'zum Verbuchen' },
            { wert: 'vergangen', label: 'Vergangen', zahl: listen.vergangen.length },
            { wert: 'abgesagt', label: 'Abgesagt', zahl: listen.abgesagt.length },
          ]}
        />
      </div>

      <div className="web-filter">
        {jahrgaenge.length > 0 && (
          <WebAuswahl
            label="Jahrgang"
            wert={jahrgang}
            onWert={setJahrgang}
            optionen={[{ wert: 'alle', label: 'Alle Jahrgänge' }, ...jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name }))]}
          />
        )}
        {kategorien.length > 0 && (
          <WebAuswahl
            label="Kategorie"
            wert={kategorie}
            onWert={setKategorie}
            optionen={[{ wert: 'alle', label: 'Alle Kategorien' }, ...kategorien.map((k) => ({ wert: k, label: k }))]}
          />
        )}
        <WebAuswahl label="Art" wert={art} onWert={(w) => setArt(w as ArtFilter)} optionen={ART_OPTIONEN} />
        {gefiltert && (
          <WebKnopf art="text" klein onClick={zuruecksetzen}>Filter zurücksetzen</WebKnopf>
        )}
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Events durchsuchen" platzhalter="Name oder Ort suchen" wert={suche} onWert={setSuche} />
        </div>
      </div>

      <div className="web-karte">
        {sichtbar.length > 0 ? (
          <WebTabelle
            beschriftung="Events"
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(e) => e.id}
            zeileKlasse={(e) => (leitungListeStatus(e).gedaempft ? 'web-zeile--gedaempft' : undefined)}
            fest
          />
        ) : (
          <WebLeer
            icon={ICON_TERMIN}
            titel={gefiltert ? 'Keine Treffer' : 'Keine Events gefunden'}
            text={gefiltert ? 'Zu diesen Filtern gibt es hier kein Event.' : LEER_TEXT[zeit]}
            aktion={gefiltert ? <WebKnopf onClick={zuruecksetzen}>Filter zurücksetzen</WebKnopf> : undefined}
          />
        )}
      </div>
    </>
  );
};

export default WebEventsTabelle;
