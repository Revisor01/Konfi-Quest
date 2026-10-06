// Die eigenen Aktivitaeten (Antraege) als Tabelle -- fuer Konfis und das Team
// in der Web-Fassung von Mitmachen (03.10.2026). Was man gemeldet hat, mit
// Status als Marke und als Filter (Offen, Angerechnet, Abgelehnt, Alle).
// Ansehen oeffnet das Fenster der App (RequestDetailModal), Loeschen laeuft
// ueber die Rueckfrage der Seite -- nur offene Meldungen lassen sich loeschen.
//
// Teamer:innen melden reinen Nachweis: keine Punkte, keine Art (teamerMode).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_KAMERA_GEFUELLT, ICON_LOESCHEN, ICON_TEXTDOKUMENT } from '../../icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { suchTreffer, suchbegriff, type PillTon } from '../../../../utils/supportWeb';
import type { ActivityRequest } from '../../../konfi/modals/RequestDetailModal';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import WebTreffer from '../../../web/WebTreffer';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import { EIGENER_ANTRAG_FILTER, type EigenerAntragFilter } from './terminFilter';
import '../../../../theme/web/termine.css';

const STATUS_VON_FILTER: Record<Exclude<EigenerAntragFilter, 'alle'>, ActivityRequest['status']> = {
  offen: 'pending',
  angerechnet: 'approved',
  abgelehnt: 'rejected',
};

// Die Konfi-Antragsliste sagt "Angerechnet" (Reiter und Marke gleich).
const STATUS: Record<ActivityRequest['status'], { text: string; ton: PillTon }> = {
  pending: { text: 'Offen', ton: 'warnung' },
  approved: { text: 'Angerechnet', ton: 'erfolg' },
  rejected: { text: 'Abgelehnt', ton: 'fehler' },
};

export interface WebEigeneAntraegeProps {
  antraege: readonly ActivityRequest[];
  /** Die Adresse der Seite -- die Adresse darf den Filter vorgeben (`?filter=offen`). */
  pfad: string;
  /** Der Filter, mit dem die Seite beginnt: Konfis sehen zuerst die offenen, das Team alle. */
  standardFilter: EigenerAntragFilter;
  /** Team: reiner Nachweis ohne Punkte. */
  teamerMode: boolean;
  onOeffnen: (antrag: ActivityRequest) => void;
  onLoeschen: (antrag: ActivityRequest) => void;
}

const WebEigeneAntraege: React.FC<WebEigeneAntraegeProps> = ({ antraege: roh, pfad, standardFilter, teamerMode, onOeffnen, onLoeschen }) => {
  const antraege = useMemo<ActivityRequest[]>(() => (Array.isArray(roh) ? [...roh] : []), [roh]);
  const [filter, setFilter] = useFilterAusAdresse<EigenerAntragFilter>(pfad, EIGENER_ANTRAG_FILTER, standardFilter);
  const [suche, setSuche] = useState('');

  const zaehlen = useMemo(() => ({
    offen: antraege.filter((a) => a.status === 'pending').length,
    angerechnet: antraege.filter((a) => a.status === 'approved').length,
    abgelehnt: antraege.filter((a) => a.status === 'rejected').length,
    alle: antraege.length,
  }), [antraege]);

  const sichtbar = useMemo(() => antraege
    .filter((a) => (filter === 'alle' ? true : a.status === STATUS_VON_FILTER[filter]))
    .filter((a) => !suchbegriff(suche) || suchTreffer(a.activity_name || '', suche).length > 0),
  [antraege, filter, suche]);

  const sucht = suchbegriff(suche) !== '';

  const spalten: Array<WebSpalte<ActivityRequest>> = [
    {
      schluessel: 'aktivitaet',
      kopf: 'Aktivität',
      breite: '38%',
      zelle: (a) => (
        <>
          <button type="button" className="web-link web-link--zeile web-link--text web-link--knopf" onClick={() => onOeffnen(a)}>
            <WebTreffer text={a.activity_name} suche={suche} />
          </button>
          {a.comment && <span className="web-zelle-leise web-einzeilig" title={a.comment}>„{a.comment}“</span>}
          {a.status === 'rejected' && a.admin_comment && (
            <span className="web-zelle-leise"><strong>Grund der Ablehnung: </strong>{a.admin_comment}</span>
          )}
        </>
      ),
    },
    {
      schluessel: 'datum',
      kopf: 'Stattgefunden',
      breite: '128px',
      zelle: (a) => (
        <>
          <span className="web-zelle-titel web-zelle-normal">{datumKurz(a.requested_date)}</span>
          {a.photo_filename && (
            <span className="web-zelle-leise web-mit-symbol">
              <IonIcon icon={ICON_KAMERA_GEFUELLT} className="app-icon-color--konfis" aria-hidden="true" />
              Foto
            </span>
          )}
        </>
      ),
    },
  ];

  if (!teamerMode) {
    spalten.push({
      schluessel: 'punkte',
      kopf: 'Punkte',
      breite: '120px',
      optional: true,
      zelle: (a) => (
        <>
          {a.activity_points ? <span className="web-zelle-titel">{a.activity_points}P</span> : null}
          <span className="web-zelle-leise">{a.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</span>
        </>
      ),
    });
  }

  spalten.push(
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '128px',
      zelle: (a) => <WebPill ton={STATUS[a.status].ton} punkt>{STATUS[a.status].text}</WebPill>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '136px',
      zelle: (a) => (
        <div className="web-termin-aktionen">
          <WebKnopf klein vorn aria-label={`${a.activity_name} ansehen`} onClick={() => onOeffnen(a)}>Ansehen</WebKnopf>
          {a.status === 'pending' && (
            <WebKnopf klein symbol vorn art="gefahr" aria-label="Aktivität löschen" title="Aktivität löschen" onClick={() => onLoeschen(a)}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          )}
        </div>
      ),
    },
  );

  return (
    <>
      <div className="web-werkzeuge">
        <WebChips<EigenerAntragFilter>
          beschriftung="Aktivitäten nach Status"
          wert={filter}
          onWert={setFilter}
          chips={[
            { wert: 'offen', label: 'Offen', zahl: zaehlen.offen },
            { wert: 'angerechnet', label: 'Angerechnet', zahl: zaehlen.angerechnet },
            { wert: 'abgelehnt', label: 'Abgelehnt', zahl: zaehlen.abgelehnt },
            { wert: 'alle', label: 'Alle', zahl: zaehlen.alle },
          ]}
        />
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Aktivitäten durchsuchen" platzhalter="Aktivität suchen" wert={suche} onWert={setSuche} />
        </div>
      </div>

      <div className="web-karte">
        {sichtbar.length > 0 ? (
          <WebTabelle
            beschriftung="Deine Aktivitäten"
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(a) => a.id}
            mittig
            fest
          />
        ) : (
          <WebLeer
            icon={ICON_TEXTDOKUMENT}
            titel={sucht ? 'Keine Treffer' : 'Keine Aktivitäten gefunden'}
            text={sucht ? `Zu „${suche.trim()}“ gibt es in dieser Auswahl keine Aktivität.` : 'Noch keine Aktivitäten gemeldet'}
            aktion={sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined}
          />
        )}
      </div>
    </>
  );
};

export default WebEigeneAntraege;
