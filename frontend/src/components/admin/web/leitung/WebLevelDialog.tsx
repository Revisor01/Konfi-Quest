// Level anlegen oder bearbeiten als Dialog der Web-Fassung
// (/admin/settings/levels ab 992 px; Simon, 11.10.2026: „Web braucht eigene
// kompaktere Modale überall"). Dieselben Felder in derselben Reihenfolge wie
// das Modal der App (admin/modals/LevelManagementModal.tsx): Titel und
// benötigte Punkte nebeneinander, Beschreibung, Icon (WebSymbolWahl) und
// Level-Farbe. Die Logik ist dieselbe (useLevelFormular): ohne Netz geht das
// Level in die Warteschlange, Fehler stehen im Dialog. Während gespeichert
// wird, schließt nichts den Dialog (Abbrechen, X, Escape, Klick daneben),
// wie das X der App: Eine Ablehnung des Servers ginge sonst ins Leere.
//
// Die Punkte sind hier ein Zahlenfeld ab 0 statt des Schiebereglers 1 bis 40
// der App. Ein neues Level beginnt bei 0 Punkten, das erste Level einer
// Gemeinde steht oft bei 0, aeltere Level stehen auch ueber 40 -- die App
// speichert solche Werte unveraendert, solange der Regler nicht bewegt wird.
// Ein Feld mit 1 bis 40 wuerde sie hier sperren.
//
// Die Farbe ist vorbelegt als #rrggbb (levelFarbeAlsHex): ein neues Level mit
// der Farbe der Level, wie das Farbfeld sie zeigt. Gespeichert wird, was das
// Farbfeld zeigt. Das Token var(--app-color-level), mit dem die App ein
// neues Level beginnt, nimmt der Server nicht an (levels.color varchar(7),
// 500; Gegenpruefung 11.10.2026).

import React, { useId, useMemo } from 'react';
import { NEUES_LEVEL, levelFarbeAlsHex, useLevelFormular, type LevelFormularDaten } from '../../useLevelFormular';
import { OFFLINE_HINWEIS } from '../../stammdatenFormular';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';
import WebSymbolWahl from './WebSymbolWahl';

export interface WebLevelDialogProps {
  /** Das Level zum Bearbeiten; null legt ein neues an. */
  level: LevelFormularDaten | null;
  onSchliessen: () => void;
  /** Nach dem Speichern (auch eingereiht): die Liste neu laden. */
  onGespeichert: () => void;
}

const WebLevelDialog: React.FC<WebLevelDialogProps> = ({ level, onSchliessen, onGespeichert }) => {
  const farbId = useId();
  // Neu oder bearbeitet: dieselben Werte, nur die Farbe sicher als #rrggbb.
  const vorlage = useMemo<LevelFormularDaten>(() => {
    const basis = level ?? NEUES_LEVEL;
    return { ...basis, color: levelFarbeAlsHex(basis.color) };
  }, [level]);
  const { formData, aendern, loading, isSubmitting, fehler, isOnline, speichern } = useLevelFormular(vorlage, {
    onFertig: () => {
      onGespeichert();
      onSchliessen();
    },
    fehlerImDialog: true,
  });
  // Es wird gesendet, solange der Doppelklick-Schutz (isSubmitting) oder das
  // Speichern (loading) läuft -- dieselbe Bedingung wie am Haken der App.
  const sendet = loading || isSubmitting;
  const farbe = levelFarbeAlsHex(formData.color);
  const punkte = formData.points_required;

  return (
    <WebDialog
      titel={level ? 'Level bearbeiten' : 'Neues Level'}
      beschreibung="Level sind die Stufen, die sich aus dem Punktestand ergeben. Sie gelten für die ganze Gemeinde."
      breit
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      gesperrt={sendet}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={sendet}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={sendet}>{level ? 'Speichern' : 'Anlegen'}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!isOnline && <WebHinweis art="hinweis">{OFFLINE_HINWEIS}</WebHinweis>}
        <div className="web-feldpaar">
          <WebFeld
            label="Titel"
            pflicht
            wert={formData.title}
            onWert={(title) => aendern({ title })}
            platzhalter="z.B. Anfänger, Bronze, Meister"
            deaktiviert={loading}
          />
          <WebFeld
            label="Benötigte Punkte"
            pflicht
            typ="number"
            min={0}
            schritt={1}
            wert={Number.isFinite(punkte) ? String(punkte) : ''}
            onWert={(w) => aendern({ points_required: w.trim() === '' ? Number.NaN : Number(w) })}
            hinweis="Ab dieser Punktzahl gilt das Level. Zwei Level dürfen nicht dieselbe Punktzahl haben."
            deaktiviert={loading}
          />
        </div>
        <WebTextfeld
          label="Beschreibung"
          zeilen={3}
          wert={formData.description ?? ''}
          onWert={(description) => aendern({ description })}
          platzhalter="Optionale Beschreibung..."
          deaktiviert={loading}
        />
        <WebSymbolWahl
          label="Icon"
          pflicht
          wert={formData.icon || 'trophy'}
          onWert={(icon) => aendern({ icon })}
          farbe={farbe}
          ton="level"
          deaktiviert={loading}
        />
        <div className="web-feld">
          <label htmlFor={farbId} className="web-feld__label">Level-Farbe</label>
          <input
            id={farbId}
            type="color"
            className="web-farbwahl"
            value={formData.color}
            onChange={(e) => aendern({ color: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>
    </WebDialog>
  );
};

export default WebLevelDialog;
