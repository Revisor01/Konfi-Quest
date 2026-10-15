// „Dein Konfispruch" als Dialog der Web-Fassung (Simon, 15.10.2026: im Browser
// ab 992 px bekommt jedes Formular, das noch ein App-Modal öffnet, ein
// kompaktes Web-Fenster; in den Apps und darunter bleibt das Modal). Geöffnet
// von der Karte „Dein Konfispruch" auf der Startseite von Konfis und Team.
//
// Dieselbe Logik wie in der App (useKonfispruchWahl): dieselben Sprüche der
// Gemeinde (GET …/konfsprueche), dieselben Übersetzungen mit ihrer
// Quellenangabe, „Aus Liste" oder „Eigener Spruch", dieselbe Prüfung mit
// denselben Texten, derselbe Aufruf (PATCH …/profile). Meldungen stehen im
// Dialog; die nächste Eingabe räumt sie weg. Der Dialog ist ein Formular:
// Enter in der Bibelstelle oder auf einem Spruch speichert. Während des
// Speicherns schließt nichts den Dialog.

import React, { useId } from 'react';
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';
import {
  EIGENER_SPRUCH_HINWEIS,
  SPRUCHLISTE_FEHLER,
  TRANSLATION_COPYRIGHT,
  TRANSLATION_KEYS,
  TRANSLATION_LABELS,
  useKonfispruchWahl,
  type CurrentKonfspruch,
  type KonfispruchModus,
  type Translation,
} from '../useKonfispruchWahl';
import WebAuswahl from '../../web/WebAuswahl';
import WebDialog from '../../web/WebDialog';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebTextfeld from '../../web/WebTextfeld';
import '../../../theme/web/start.css';

export interface WebKonfispruchDialogProps {
  /** Der gespeicherte Spruch: Mit ihm beginnt die Auswahl. */
  current?: CurrentKonfspruch | null;
  /** '/konfi' (Konfis) oder '/teamer' (Team) -- dieselben Wege wie in der App. */
  apiBasePath?: '/konfi' | '/teamer';
  onSchliessen: () => void;
  /** Gespeichert: Die Seite schließt den Dialog und lädt neu. */
  onGespeichert: () => void;
}

const MODI: ReadonlyArray<{ wert: KonfispruchModus; label: string }> = [
  { wert: 'liste', label: 'Aus Liste' },
  { wert: 'freitext', label: 'Eigener Spruch' },
];

const WebKonfispruchDialog: React.FC<WebKonfispruchDialogProps> = ({ current, apiBasePath = '/konfi', onSchliessen, onGespeichert }) => {
  const {
    isOnline, isSubmitting, mode, setMode, loading, loadError, sprueche, translation, setTranslation,
    selectedSpruchId, setSelectedSpruchId, freitext, setFreitext, freitextReferenz, setFreitextReferenz, speichern, fehler,
  } = useKonfispruchWahl({ current, apiBasePath, onErfolg: onGespeichert, fehlerImDialog: true });
  const gruppe = useId();

  const liste = () => {
    if (loading) return <p className="web-wahl__leer" role="status">Die Sprüche werden geladen.</p>;
    if (loadError) return <WebHinweis art="fehler" rolle="status">{SPRUCHLISTE_FEHLER}</WebHinweis>;
    if (sprueche.length === 0) return <p className="web-wahl__leer" role="status">Es sind noch keine Sprüche hinterlegt</p>;
    return (
      <div className="web-wahl__liste web-profil-wahl web-profil-wahl--spruch">
        {sprueche.map((spruch) => {
          const text = spruch.uebersetzungen?.[translation] || '';
          const gewaehlt = selectedSpruchId === spruch.id;
          return (
            <label key={spruch.id} className={gewaehlt ? 'web-wahl__zeile web-wahl__zeile--gewaehlt' : 'web-wahl__zeile'}>
              <input
                type="radio"
                className="web-wahl__radio"
                name={gruppe}
                value={spruch.id}
                checked={gewaehlt}
                onChange={() => setSelectedSpruchId(spruch.id)}
              />
              <span className="web-wahl__text">
                <span className="web-wahl__titel">{spruch.reference}</span>
                <span className="web-wahl__beschreibung">{text || <em>Text wird noch ergänzt</em>}</span>
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <WebDialog
      titel="Dein Konfispruch"
      onSchliessen={onSchliessen}
      onAbsenden={() => { if (!isSubmitting && isOnline) void speichern(); }}
      gesperrt={isSubmitting}
      breit
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting || !isOnline}>Speichern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {!isOnline && <WebHinweis art="warnung" titel="Du bist offline">{OFFLINE_AKTION_MELDUNG}</WebHinweis>}
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}

        {/* Aus der Liste oder ein eigener Spruch -- wie das Segment der App. */}
        <div>
          <div className="web-ansicht-umschalter" role="group" aria-label="Art des Spruchs">
            {MODI.map((m) => (
              <button
                key={m.wert}
                type="button"
                className="web-ansicht-umschalter__knopf"
                aria-pressed={mode === m.wert}
                disabled={isSubmitting}
                onClick={() => setMode(m.wert)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'liste' ? (
          <>
            <WebAuswahl
              label="Übersetzung"
              wert={translation}
              onWert={(w) => setTranslation(w as Translation)}
              optionen={TRANSLATION_KEYS.map((key) => ({ wert: key, label: TRANSLATION_LABELS[key] }))}
              deaktiviert={isSubmitting}
            />
            <fieldset className="web-wahl" disabled={isSubmitting}>
              <legend className="web-feld__label web-wahl__legende">Spruch wählen</legend>
              {liste()}
              <p className="web-feld__hinweis">{TRANSLATION_COPYRIGHT[translation]}</p>
            </fieldset>
          </>
        ) : (
          <>
            <WebTextfeld
              label="Spruchtext"
              pflicht
              zeilen={3}
              wert={freitext}
              onWert={setFreitext}
              platzhalter="Gib deinen Konfirmationsspruch ein"
              deaktiviert={isSubmitting}
            />
            <WebFeld
              label="Bibelstelle"
              pflicht
              wert={freitextReferenz}
              onWert={setFreitextReferenz}
              platzhalter="z.B. Joh 3,16"
              deaktiviert={isSubmitting}
              hinweis={EIGENER_SPRUCH_HINWEIS}
            />
          </>
        )}
      </div>
    </WebDialog>
  );
};

export default WebKonfispruchDialog;
