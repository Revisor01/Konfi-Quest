// Anfragen in der Web-Fassung der Support-Ansicht, /admin/support/anfragen
// (docs/planung/support-web.md, Entscheidung 1).
//
// Jede Anfrage aus dem Formular der Startseite (POST /api/anfragen) als Zeile
// einer Tabelle: Eingang, Gemeinde, Kontakt, Kirchenkreis/Landeskirche,
// Wunschlizenz, Status, ungelesene Mails. Filter-Chips mit der Zahl je Status,
// Live-Suche. Geladen wird einmal alles (GET /support/anfragen) und im
// Browser gefiltert -- so stehen die Zahlen an allen Chips zugleich da.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_MAIL } from '../../shared/icons';
import api from '../../../services/api';
import type { GemeindeAnfrage } from '../../../types/support';
import { ANFRAGE_STATUS } from '../../../utils/supportAnfragen';
import { lizenzFinden } from '../../../utils/lizenzen';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import {
  ANFRAGEN_FILTER,
  ANFRAGE_TON,
  anfragenFiltern,
  anfragenSortieren,
  anfragenZaehlen,
  suchbegriff,
  ungelesenVonAnfrage,
  type AnfragenFilter,
} from '../../../utils/supportWeb';
import WebSeite from './WebSeite';
import WebKnopf from './WebKnopf';
import WebLink from './WebLink';
import WebPill from './WebPill';
import WebChips from './WebChips';
import WebSuche from './WebSuche';
import WebTabelle, { type WebSpalte } from './WebTabelle';
import WebTreffer from './WebTreffer';
import { WebFehler, WebLaden, WebLeer } from './WebZustaende';
import { useWebDaten } from './useWebDaten';
import { useFilterAusAdresse } from './useFilterAusAdresse';

async function ladeAnfragen(): Promise<GemeindeAnfrage[]> {
  const antwort = await api.get('/support/anfragen');
  if (!Array.isArray(antwort.data)) throw new Error('Die Anfragen kamen in einer unbekannten Form');
  return antwort.data as GemeindeAnfrage[];
}

const LEER_TEXT: Record<AnfragenFilter, string> = {
  offen: 'Keine Anfrage wartet auf Bearbeitung.',
  neu: 'Keine neuen Anfragen.',
  in_arbeit: 'Keine Anfragen in Arbeit.',
  angelegt: 'Noch keine Anfrage wurde zur Gemeinde.',
  abgelehnt: 'Keine abgelehnten Anfragen.',
  alle: 'Noch keine Anfragen über die Startseite.',
  ungelesen: 'Keine Anfrage hat ungelesene Mails.',
};

const WebAnfragen: React.FC = () => {
  const { daten, laedt, neuLaden } = useWebDaten(ladeAnfragen);
  const [filter, setFilter] = useFilterAusAdresse<AnfragenFilter>('/admin/support/anfragen', ANFRAGEN_FILTER, 'alle');
  const [suche, setSuche] = useState('');

  const anfragen = useMemo(() => daten ?? [], [daten]);
  const zaehlen = useMemo(() => anfragenZaehlen(anfragen), [anfragen]);
  // Neueste zuerst, unabhaengig von der Reihenfolge des Servers.
  const sichtbar = useMemo(() => anfragenSortieren(anfragenFiltern(anfragen, filter, suche)), [anfragen, filter, suche]);
  const sucht = suchbegriff(suche) !== '';

  const spalten: Array<WebSpalte<GemeindeAnfrage>> = [
    {
      schluessel: 'eingang',
      kopf: 'Eingang',
      breite: '128px',
      zelle: (a) => (
        <>
          <span title={datumUhrzeit(a.created_at)}>{zeitpunktText(a.created_at)}</span>
          <span className="web-zelle-leise">{datumUhrzeit(a.created_at, { ohneJahr: true })}</span>
        </>
      ),
    },
    {
      schluessel: 'gemeinde',
      kopf: 'Gemeinde',
      breite: '21%',
      zelle: (a) => {
        const ungelesen = ungelesenVonAnfrage(a);
        return (
          <WebLink
            href={`/admin/support/anfragen/${a.id}`}
            className={`web-link--zeile web-link--text${ungelesen > 0 ? ' web-ungelesen' : ''}`}
          >
            <WebTreffer text={a.gemeinde} suche={suche} />
            {ungelesen > 0 && <span className="web-nur-vorlesen">, {ungelesen} ungelesene {ungelesen === 1 ? 'Mail' : 'Mails'}</span>}
          </WebLink>
        );
      },
    },
    {
      schluessel: 'kontakt',
      kopf: 'Kontakt',
      breite: '22%',
      zelle: (a) => (
        <>
          <span className="web-einzeilig">
            <WebTreffer text={a.kontakt_name} suche={suche} />
            {a.funktion ? <span className="web-gedaempft"> ({a.funktion})</span> : null}
          </span>
          <a className="web-link web-vorn web-zelle-leise web-einzeilig" href={`mailto:${a.email}`}>
            <WebTreffer text={a.email} suche={suche} />
          </a>
        </>
      ),
    },
    {
      schluessel: 'zuordnung',
      kopf: 'Kirchenkreis',
      breite: '17%',
      optional: true,
      zelle: (a) => (a.kirchenkreis || a.landeskirche ? (
        <>
          {a.kirchenkreis && <span className="web-einzeilig"><WebTreffer text={a.kirchenkreis} suche={suche} /></span>}
          {a.landeskirche && <span className="web-zelle-leise web-einzeilig"><WebTreffer text={a.landeskirche} suche={suche} /></span>}
        </>
      ) : <span className="web-gedaempft">–</span>),
    },
    {
      schluessel: 'lizenz',
      kopf: 'Wunschlizenz',
      breite: '110px',
      optional: true,
      zelle: (a) => lizenzFinden(a.wunsch_lizenz)?.name ?? <span className="web-gedaempft">–</span>,
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '104px',
      zelle: (a) => <WebPill ton={ANFRAGE_TON[a.status]}>{(ANFRAGE_STATUS[a.status] ?? ANFRAGE_STATUS.neu).label}</WebPill>,
    },
    {
      schluessel: 'ungelesen',
      kopf: 'Ungelesen',
      breite: '92px',
      zahl: true,
      zelle: (a) => {
        const n = ungelesenVonAnfrage(a);
        return n > 0 ? <span className="web-chip__zahl web-chip__zahl--rot">{n}</span> : <span className="web-gedaempft">–</span>;
      },
    },
  ];

  let inhalt: React.ReactNode;
  if (laedt) {
    inhalt = <WebLaden karten={2} text="Die Anfragen werden geladen." />;
  } else if (!daten) {
    inhalt = <WebFehler text="Die Anfragen konnten nicht geladen werden." onErneut={() => { void neuLaden(); }} />;
  } else {
    inhalt = (
      <>
        <div className="web-werkzeuge">
          <WebChips<AnfragenFilter>
            beschriftung="Anfragen nach Status"
            wert={filter}
            onWert={setFilter}
            chips={[
              { wert: 'alle', label: 'Alle', zahl: zaehlen.alle },
              { wert: 'offen', label: 'Offen', zahl: zaehlen.offen, zahlText: 'neu oder in Arbeit' },
              { wert: 'neu', label: 'Neu', zahl: zaehlen.neu },
              { wert: 'in_arbeit', label: 'In Arbeit', zahl: zaehlen.in_arbeit },
              { wert: 'angelegt', label: 'Angelegt', zahl: zaehlen.angelegt },
              { wert: 'abgelehnt', label: 'Abgelehnt', zahl: zaehlen.abgelehnt },
              { wert: 'ungelesen', label: 'Ungelesen', zahl: zaehlen.ungelesen, rot: true, zahlText: 'mit ungelesenen Mails' },
            ]}
          />
          <div className="web-werkzeuge__rechts">
            <WebSuche
              beschriftung="Anfragen durchsuchen"
              platzhalter="Gemeinde oder Kontakt suchen"
              wert={suche}
              onWert={setSuche}
            />
          </div>
        </div>

        <div className="web-karte">
          {sichtbar.length > 0 ? (
            <WebTabelle
              beschriftung="Anfragen"
              spalten={spalten}
              zeilen={sichtbar}
              zeileSchluessel={(a) => a.id}
              zeileKlasse={(a) => (ungelesenVonAnfrage(a) > 0 ? 'web-zeile--ungelesen' : undefined)}
              mittig
              fest
            />
          ) : (
            <WebLeer
              icon={ICON_MAIL}
              titel={sucht ? 'Keine Treffer' : 'Keine Anfragen'}
              text={sucht ? `Zu „${suche.trim()}“ gibt es in dieser Auswahl keine Anfrage.` : LEER_TEXT[filter]}
              aktion={sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined}
            />
          )}
        </div>
      </>
    );
  }

  const untertitel = daten
    ? `${zaehlen.alle} ${zaehlen.alle === 1 ? 'Anfrage' : 'Anfragen'} aus dem Formular auf der Startseite${sucht || filter !== 'alle' ? ` · ${sichtbar.length} in dieser Auswahl` : ''}`
    : 'Anfragen aus dem Formular auf der Startseite';

  return (
    <WebSeite
      bereich="Support"
      titel="Anfragen"
      untertitel={untertitel}
      aktionen={(
        <WebKnopf onClick={() => { void neuLaden(); }}>
          <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
          Aktualisieren
        </WebKnopf>
      )}
    >
      {inhalt}
    </WebSeite>
  );
};

export default WebAnfragen;
