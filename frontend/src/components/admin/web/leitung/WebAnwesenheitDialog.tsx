// „Anwesenheit" als Dialog der Web-Fassung (Simon, 13.10.2026: „anwesenheiten
// glaube ich auch nicht" im neuen Web-Look). Geöffnet im breiten Layout aus der
// Konfis-Liste (AdminKonfisPage, alle Jahrgänge der Seite) und aus der
// Konfirmations-Karte der Detailseite (KonfiDetailView, auf den Jahrgang der
// Konfi vorausgewählt); unter 992 px und in den Apps bleibt das Modal der App
// (modals/AttendanceMatrixModal.tsx).
//
// Dieselbe Logik wie in der App (useAnwesenheitsMatrix): Jahrgang, Suche,
// Umschalten zwischen Anwesenheit und Konfisprüchen, dieselben Zellen und
// dieselbe Summe, „per E-Mail an dich" mit derselben Route. Ein breites
// Fenster (bis 1120 px); die Tabelle rollt darin waagerecht und senkrecht,
// Kopfzeile und Namen bleiben stehen. Was die App nur als Zeichen zeigt, steht
// hier für Vorleseprogramme auch in Worten in der Zelle; der Name eines Events
// steht unter seinem Datum im Kopf (in der App nach Antippen).
//
// Fehler (Laden, E-Mail) und die Bestätigung der E-Mail stehen im Fenster.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ABSAGE,
  ICON_BUCH,
  ICON_ENTFERNEN_GEFUELLT,
  ICON_GRUPPE,
  ICON_KREIS_LEER,
  ICON_MAIL,
  ICON_TERMIN,
  ICON_ZUSAGE_GEFUELLT,
} from '../../../shared/icons';
import { datumKurz, uhrzeit } from '../../../../utils/dateUtils';
import type { MatrixZellStatus } from '../../../../utils/anwesenheitsMatrix';
import {
  LEERE_ZEILE,
  ZELL_TEXT,
  matrixDatum,
  useAnwesenheitsMatrix,
  type MatrixAnsicht,
  type MatrixJahrgang,
} from '../../modals/useAnwesenheitsMatrix';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebSuche from '../../../web/WebSuche';
import { WebLeer } from '../../../web/WebZustaende';
import '../../../../theme/web/leitung.css';

export interface WebAnwesenheitDialogProps {
  jahrgaenge: MatrixJahrgang[];
  /** Vorausgewählter Jahrgang (Detailseite einer Konfi); sonst der erste. */
  initialJahrgangId?: number;
  onSchliessen: () => void;
}

/** Die Zeichen der Zellen -- dieselben wie in der App. */
const ZELL_SYMBOL: Record<MatrixZellStatus, string> = {
  present: ICON_ZUSAGE_GEFUELLT,
  absent: ICON_ABSAGE,
  opted_out: ICON_ENTFERNEN_GEFUELLT,
  excused: ICON_ENTFERNEN_GEFUELLT,
  open: ICON_KREIS_LEER,
};
const LEGENDE: MatrixZellStatus[] = ['present', 'absent', 'opted_out', 'excused', 'open'];

const ANSICHTEN: ReadonlyArray<{ wert: MatrixAnsicht; label: string }> = [
  { wert: 'anwesenheit', label: 'Anwesenheit' },
  { wert: 'sprueche', label: 'Konfispruch' },
];

const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

const Punkt: React.FC<{ status: MatrixZellStatus }> = ({ status }) => (
  <span className={`web-anwesenheit__punkt web-anwesenheit__punkt--${status}`} aria-hidden="true">
    <IonIcon icon={ZELL_SYMBOL[status]} />
  </span>
);

const WebAnwesenheitDialog: React.FC<WebAnwesenheitDialogProps> = ({ jahrgaenge, initialJahrgangId, onSchliessen }) => {
  const {
    jahrgangId, setJahrgangId, loading, data, searchTerm, setSearchTerm, viewMode, setViewMode,
    sprueche, spruecheLoading, sending, handleSendEmail, filteredSprueche, filteredKonfis,
    getCellStatus, zellHinweis, konfiStats, meldung,
  } = useAnwesenheitsMatrix({ jahrgaenge, initialJahrgangId, meldungenImFenster: true });
  const jahrgangName = jahrgaenge.find((j) => j.id === jahrgangId)?.name ?? data?.jahrgang.name ?? '';

  const anwesenheit = () => {
    if (loading) return <p className="web-gedaempft" role="status">Die Anwesenheit wird geladen.</p>;
    if (!data) return <WebLeer icon={ICON_TERMIN} titel="Keine Daten" text="Wähle einen Jahrgang." />;
    if (data.events.length === 0) return <WebLeer icon={ICON_TERMIN} titel="Keine Pflicht-Events" text="Für diesen Jahrgang gibt es keine Pflicht-Events." />;
    if (data.konfis.length === 0) return <WebLeer icon={ICON_GRUPPE} titel="Keine Konfis" text="Dieser Jahrgang hat noch keine Konfis." />;
    return (
      <>
        <p className="web-anwesenheit__zahl">
          {mehrzahl(data.events.length, 'Pflicht-Event', 'Pflicht-Events')} · {mehrzahl(filteredKonfis.length, 'Konfi', 'Konfis')}
        </p>
        {filteredKonfis.length === 0 ? (
          <p className="web-wahl__leer">Keine Konfi passt zu „{searchTerm.trim()}“.</p>
        ) : (
          // Die Hülle rollt; mit Tab erreichbar, damit sie sich auch mit den Pfeiltasten rollen lässt.
          <div className="web-anwesenheit__huelle" role="region" aria-label={`Anwesenheit ${jahrgangName}`} tabIndex={0}>
            <table className="web-anwesenheit__tabelle">
              <thead>
                <tr>
                  <th scope="col" className="web-anwesenheit__name">Konfi</th>
                  {data.events.map((e) => (
                    <th key={e.id} scope="col" className="web-anwesenheit__event" title={`${e.name}, ${datumKurz(e.event_date)}`}>
                      <span className="web-anwesenheit__datum">{matrixDatum(e.event_date)}</span>
                      <span className="web-anwesenheit__eventname">{e.name}</span>
                    </th>
                  ))}
                  {/* Nenner ohne abgemeldete Termine (Befund 4, 25.08.2026), wie in der App. */}
                  <th scope="col" className="web-anwesenheit__summe" title="Anwesend von den Pflicht-Events ohne Abmeldungen">
                    <span aria-hidden="true">Σ</span>
                    <span className="web-nur-vorlesen">Anwesend von den Pflicht-Events ohne Abmeldungen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredKonfis.map((k) => {
                  const stats = konfiStats.get(k.user_id) || LEERE_ZEILE;
                  return (
                    <tr key={k.user_id}>
                      <th scope="row" className="web-anwesenheit__name">{k.display_name}</th>
                      {data.events.map((e) => {
                        const status = getCellStatus(k.user_id, e.id);
                        const hinweis = zellHinweis(k.user_id, e.id);
                        const text = hinweis ? `${ZELL_TEXT[status]}: ${hinweis}` : ZELL_TEXT[status];
                        return (
                          <td key={e.id} className="web-anwesenheit__zelle" title={text} data-status={status}>
                            <Punkt status={status} />
                            <span className="web-nur-vorlesen">{text}</span>
                          </td>
                        );
                      })}
                      <td className="web-anwesenheit__summe">{stats.present}/{stats.nenner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ul className="web-anwesenheit__legende" aria-label="Legende">
          {LEGENDE.map((status) => (
            <li key={status} className="web-anwesenheit__legende-eintrag">
              <Punkt status={status} />
              {ZELL_TEXT[status]}
            </li>
          ))}
        </ul>
      </>
    );
  };

  const konfisprueche = () => {
    if (spruecheLoading) return <p className="web-gedaempft" role="status">Die Konfisprüche werden geladen.</p>;
    if (!sprueche || filteredSprueche.length === 0) {
      return <WebLeer icon={ICON_BUCH} titel="Keine Konfisprüche" text="Für diesen Jahrgang gibt es noch keine Konfis oder keine Treffer." />;
    }
    return (
      <>
        <p className="web-anwesenheit__zahl">{mehrzahl(filteredSprueche.length, 'Konfi', 'Konfis')}</p>
        <div className="web-anwesenheit__huelle" role="region" aria-label={`Konfisprüche ${jahrgangName}`} tabIndex={0}>
          <table className="web-anwesenheit__tabelle web-anwesenheit__tabelle--sprueche">
            <thead>
              <tr>
                <th scope="col" className="web-anwesenheit__name">Konfi</th>
                <th scope="col">Konfirmation</th>
                <th scope="col">Buch / Stelle</th>
                <th scope="col">Konfispruch</th>
              </tr>
            </thead>
            <tbody>
              {filteredSprueche.map((s) => (
                <tr key={s.user_id}>
                  <th scope="row" className="web-anwesenheit__name">{s.display_name}</th>
                  <td>
                    {s.konfirmation_date
                      ? `${datumKurz(s.konfirmation_date)}, ${uhrzeit(s.konfirmation_date)} Uhr`
                      : <span className="web-gedaempft">nicht gebucht</span>}
                  </td>
                  <td>{s.konfspruch?.reference || <span className="web-gedaempft">–</span>}</td>
                  <td>
                    {s.konfspruch?.text
                      ? s.konfspruch.text
                      : <span className="web-gedaempft">{s.konfspruch ? '(Übersetzung fehlt)' : 'noch keiner'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <WebDialog
      weit
      titel={viewMode === 'sprueche' ? 'Konfisprüche' : 'Anwesenheit'}
      onSchliessen={onSchliessen}
      aktionen={(
        <>
          <WebKnopf onClick={() => { void handleSendEmail(); }} disabled={sending || !jahrgangId}>
            <IonIcon icon={ICON_MAIL} aria-hidden="true" />
            {sending ? 'Wird gesendet …' : 'Per E-Mail an dich senden'}
          </WebKnopf>
          <WebKnopf art="primaer" onClick={onSchliessen}>Schließen</WebKnopf>
        </>
      )}
    >
      <div className="web-anwesenheit">
        <div className="web-anwesenheit__werkzeuge">
          <WebSuche beschriftung="Konfi suchen" platzhalter="Name oder Benutzername" wert={searchTerm} onWert={setSearchTerm} />
          <WebAuswahl
            label="Jahrgang"
            wert={jahrgangId === null ? '' : String(jahrgangId)}
            onWert={(w) => setJahrgangId(w === '' ? null : Number(w))}
            optionen={jahrgaenge.length > 0
              ? jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name }))
              : [{ wert: '', label: 'Keine Jahrgänge' }]}
            deaktiviert={jahrgaenge.length === 0}
          />
          <div className="web-ansicht-umschalter" role="group" aria-label="Ansicht">
            {ANSICHTEN.map((a) => (
              <button
                key={a.wert}
                type="button"
                className="web-ansicht-umschalter__knopf"
                aria-pressed={viewMode === a.wert}
                onClick={() => setViewMode(a.wert)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {meldung && (
          <WebHinweis art={meldung.art} rolle={meldung.art === 'fehler' ? 'alert' : 'status'}>{meldung.text}</WebHinweis>
        )}
        {viewMode === 'sprueche' ? konfisprueche() : anwesenheit()}
      </div>
    </WebDialog>
  );
};

export default WebAnwesenheitDialog;
