// Die Antraege der Leitung als Tabelle (Web-Fassung von Mitmachen, 03.10.2026):
// was Konfis und Team als Aktivitaet gemeldet haben und auf eine Entscheidung
// wartet. Status als Marke und als Filter (Offen, Verbucht, Abgelehnt, Alle).
//
// Entschieden wird im Fenster "Aktivitaet pruefen" (ActivityRequestModal) --
// dort stehen Nachweisfoto, Kommentar und die Entscheidung mit Grund; die
// Tabelle oeffnet es nur (wie die Zeile in der App). Zuruecksetzen laeuft
// ueber dieselbe Rueckfrage wie in der App (AdminEventsPage).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ANTWORTEN, ICON_KAMERA_GEFUELLT, ICON_TEXTDOKUMENT } from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { suchTreffer, suchbegriff, type PillTon } from '../../../../utils/supportWeb';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebHinweis from '../../../web/WebHinweis';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import WebTreffer from '../../../web/WebTreffer';
import { WebLeer } from '../../../web/WebZustaende';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import { ANTRAG_FILTER, type AntragAktionen, type AntragFilter, type AntragZeile } from './typen';
import '../../../../theme/web/termine.css';

const STATUS_VON_FILTER: Record<Exclude<AntragFilter, 'alle'>, AntragZeile['status']> = {
  offen: 'pending',
  verbucht: 'approved',
  abgelehnt: 'rejected',
};

// "Verbucht" statt "Genehmigt" (Entscheidung 28.08.2026): Es beschreibt, was
// passiert ist -- die Punkte sind gutgeschrieben --, nicht einen Verwaltungsakt.
const STATUS: Record<AntragZeile['status'], { text: string; ton: PillTon }> = {
  pending: { text: 'Offen', ton: 'warnung' },
  approved: { text: 'Verbucht', ton: 'erfolg' },
  rejected: { text: 'Abgelehnt', ton: 'fehler' },
};

const LEER_TEXT: Record<AntragFilter, string> = {
  offen: 'Keine Aktivitäten warten auf eine Entscheidung.',
  verbucht: 'Noch keine Aktivität verbucht.',
  abgelehnt: 'Keine abgelehnte Aktivität.',
  alle: 'Konfirmand:innen können Aktivitäten beantragen.',
};

export interface WebAntraegeProps {
  antraege: readonly AntragZeile[];
  /**
   * Der Server hat die Konfi-Antraege wegen fehlender Jahrgangs-Zuweisung
   * ausgeblendet (Header X-Kein-Jahrgang-Zugewiesen, Entscheidung 31.08.2026).
   */
  ohneJahrgang: boolean;
  aktionen: AntragAktionen;
}

const WebAntraege: React.FC<WebAntraegeProps> = ({ antraege: roh, ohneJahrgang, aktionen }) => {
  // Defensive: bei kaputten oder gecachten Antworten (Objekt statt Array) leer.
  const antraege = useMemo<AntragZeile[]>(() => (Array.isArray(roh) ? [...roh] : []), [roh]);
  const [filter, setFilter] = useFilterAusAdresse<AntragFilter>('/admin/events', ANTRAG_FILTER, 'offen');
  const [suche, setSuche] = useState('');

  const zaehlen = useMemo(() => ({
    offen: antraege.filter((a) => a.status === 'pending').length,
    verbucht: antraege.filter((a) => a.status === 'approved').length,
    abgelehnt: antraege.filter((a) => a.status === 'rejected').length,
    alle: antraege.length,
  }), [antraege]);

  // Neueste zuerst.
  const sichtbar = useMemo(() => {
    const passtZurSuche = (a: AntragZeile) => !suchbegriff(suche)
      || suchTreffer(a.konfi_name || '', suche).length > 0
      || suchTreffer(a.activity_name || '', suche).length > 0;
    return antraege
      .filter((a) => (filter === 'alle' ? true : a.status === STATUS_VON_FILTER[filter]))
      .filter(passtZurSuche)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [antraege, filter, suche]);

  const sucht = suchbegriff(suche) !== '';

  const spalten: Array<WebSpalte<AntragZeile>> = [
    {
      schluessel: 'eingang',
      kopf: 'Eingang',
      breite: '112px',
      zelle: (a) => <span title={a.created_at}>{datumKurz(a.created_at)}</span>,
    },
    {
      schluessel: 'person',
      kopf: 'Von',
      breite: '22%',
      zelle: (a) => (
        <>
          <span className="web-zelle-titel"><WebTreffer text={a.konfi_name} suche={suche} /></span>
          {a.activity_target_role === 'teamer'
            ? <span className="web-zelle-leise">Team</span>
            : a.jahrgang_name && <span className="web-zelle-leise">{a.jahrgang_name}</span>}
        </>
      ),
    },
    {
      schluessel: 'aktivitaet',
      kopf: 'Aktivität',
      zelle: (a) => (
        <>
          <span className="web-zelle-titel"><WebTreffer text={a.activity_name} suche={suche} /></span>
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
      breite: '120px',
      optional: true,
      zelle: (a) => (
        <>
          {datumKurz(a.requested_date)}
          {a.photo_filename && (
            <span className="web-zelle-leise web-mit-symbol">
              <IonIcon icon={ICON_KAMERA_GEFUELLT} className="app-icon-color--konfis" aria-hidden="true" />
              Foto
            </span>
          )}
        </>
      ),
    },
    {
      schluessel: 'punkte',
      kopf: 'Punkte',
      breite: '112px',
      optional: true,
      // Antraege des Teams sind reiner Nachweis: keine Punkte, keine Art.
      zelle: (a) => (a.activity_target_role === 'teamer'
        ? <span className="web-gedaempft">–</span>
        : (
          <>
            {a.activity_points ? <span className="web-zelle-titel">{a.activity_points}P</span> : null}
            <span className="web-zelle-leise">{a.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</span>
          </>
        )),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '112px',
      zelle: (a) => <WebPill ton={STATUS[a.status].ton} punkt>{STATUS[a.status].text}</WebPill>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '184px',
      zelle: (a) => (
        <div className="web-termin-aktionen">
          {a.status === 'pending' ? (
            <WebKnopf klein art="primaer" vorn onClick={() => aktionen.pruefen(a)} aria-label={`Aktivität von ${a.konfi_name} prüfen`}>
              Prüfen
            </WebKnopf>
          ) : (
            <>
              <WebKnopf klein vorn onClick={() => aktionen.pruefen(a)} aria-label={`Aktivität von ${a.konfi_name} ansehen`}>
                Ansehen
              </WebKnopf>
              <WebKnopf klein symbol vorn aria-label="Aktivität zurücksetzen" title="Zurücksetzen und wieder als offen markieren" onClick={() => aktionen.zuruecksetzen(a)}>
                <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
              </WebKnopf>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {ohneJahrgang && (
        <WebHinweis art="hinweis" titel="Kein Jahrgang zugewiesen">
          Dir ist noch kein Jahrgang zugewiesen, deshalb siehst du keine Meldungen von Konfis. Die Gemeindeleitung kann das in den Einstellungen ändern.
        </WebHinweis>
      )}
      <div className="web-werkzeuge">
        <WebChips<AntragFilter>
          beschriftung="Aktivitäten nach Status"
          wert={filter}
          onWert={setFilter}
          chips={[
            { wert: 'offen', label: 'Offen', zahl: zaehlen.offen, rot: true, zahlText: 'warten auf Entscheidung' },
            { wert: 'verbucht', label: 'Verbucht', zahl: zaehlen.verbucht },
            { wert: 'abgelehnt', label: 'Abgelehnt', zahl: zaehlen.abgelehnt },
            { wert: 'alle', label: 'Alle', zahl: zaehlen.alle },
          ]}
        />
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Aktivitäten durchsuchen" platzhalter="Person oder Aktivität suchen" wert={suche} onWert={setSuche} />
        </div>
      </div>

      <div className="web-karte">
        {sichtbar.length > 0 ? (
          <WebTabelle
            beschriftung="Gemeldete Aktivitäten"
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(a) => a.id}
            zeileKlasse={(a) => (a.status === 'pending' ? undefined : 'web-zeile--gedaempft')}
            mittig
            fest
          />
        ) : (
          <WebLeer
            icon={ICON_TEXTDOKUMENT}
            titel={ohneJahrgang && antraege.length === 0 ? 'Kein Jahrgang zugewiesen' : sucht ? 'Keine Treffer' : 'Keine Aktivitäten vorhanden'}
            text={sucht ? `Zu „${suche.trim()}“ gibt es in dieser Auswahl keine Aktivität.` : LEER_TEXT[filter]}
            aktion={sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined}
          />
        )}
      </div>
    </>
  );
};

export default WebAntraege;
