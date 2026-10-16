// „Event absagen" und „Absagegrund bearbeiten" als Dialog der Web-Fassung
// (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes Formular
// als kompaktes Fenster). Geöffnet von der Seite eines Events
// (EventDetailView) und aus den Zeilen und Karten der Liste
// (AdminEventsPage), jeweils im breiten Layout; unter 992 px und in den Apps
// bleibt das Modal der App (modals/TerminAbsagenModal.tsx).
//
// Dieselbe Logik wie in der App (useTerminAbsagen): derselbe freiwillige
// Grund mit 500 Zeichen, dieselben Eckdaten (Datum, Zahl der Angemeldeten),
// derselbe Hinweis, wer mitliest und ob eine Mitteilung rausgeht, dasselbe
// Speichern über die Seite (PUT /events/:id/cancel bzw.
// PUT /events/:id/absagegrund). Lehnt der Server ab, steht seine Begründung im
// Dialog, und er bleibt offen. Während des Speicherns schließt nichts den
// Dialog. Eine Rückfrage beim Schließen gibt es nicht -- die App fragt auch
// nicht.

import React from 'react';
import { absageEckdaten, absageHinweis, useTerminAbsagen, type AbsageModus } from '../../modals/useTerminAbsagen';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebTerminAbsagenDialogProps {
  terminName: string;
  /** Datum als fertiger Text, z. B. "Sa., 20.09.2026". */
  terminDatum: string;
  konfiAnzahl: number;
  modus: AbsageModus;
  grundVorgabe?: string;
  /** Wie in der App: die Seite speichert; wirft sie, bleibt der Dialog mit Meldung offen. */
  onSave: (grund: string) => Promise<void> | void;
  onSchliessen: () => void;
}

const WebTerminAbsagenDialog: React.FC<WebTerminAbsagenDialogProps> = ({
  terminName, terminDatum, konfiAnzahl, modus, grundVorgabe = '', onSave, onSchliessen,
}) => {
  const f = useTerminAbsagen({ modus, grundVorgabe, onSave, onFertig: onSchliessen, fehlerImDialog: true });
  const abbrechen = () => { if (!f.isSubmitting) onSchliessen(); };
  const speichern = () => { if (!f.isSubmitting && f.isOnline) void f.handleSave(); };
  return (
    <WebDialog
      titel={f.istGrundModus ? 'Absagegrund bearbeiten' : 'Event absagen'}
      beschreibung={`„${terminName}“ · ${absageEckdaten(terminDatum, konfiAnzahl, modus)}`}
      onSchliessen={abbrechen}
      onAbsenden={speichern}
      gesperrt={f.isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={abbrechen} disabled={f.isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art={f.istGrundModus ? 'primaer' : 'gefahr'} absenden disabled={f.isSubmitting || !f.isOnline}>
            {f.istGrundModus ? 'Absagegrund speichern' : 'Event absagen'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {f.fehler && <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>}
        {!f.isOnline && <WebHinweis art="warnung">Du bist offline. Absagen geht erst wieder mit Internetverbindung.</WebHinweis>}
        <WebTextfeld
          label={f.istGrundModus ? 'Grund' : 'Grund (optional)'}
          zeilen={3}
          platzhalter="z. B. „Heizung im Gemeindehaus defekt“"
          hinweis={absageHinweis(modus)}
          wert={f.grundText}
          onWert={(wert) => f.setGrundText(wert.slice(0, 500))}
          deaktiviert={f.isSubmitting}
        />
      </div>
    </WebDialog>
  );
};

export default WebTerminAbsagenDialog;
