// „Funktionsbeschreibung" als Dialog der Web-Fassung (Simon, 15.10.2026: im
// Browser ab 992 px bekommt jedes Formular, das noch ein App-Modal öffnet, ein
// kompaktes Web-Fenster; in den Apps und darunter bleibt das Modal). Geöffnet
// aus dem Profil von Team und Leitung.
//
// Die Logik ist die der App (useFunktionsbeschreibung): dasselbe Feld, derselbe
// Aufruf (POST /auth/update-role-title), dieselbe Warteschlange ohne Netz,
// dieselben Texte. Fehler stehen im Dialog über dem Feld; Enter im Feld
// speichert. Während des Speicherns schließt nichts den Dialog.

import React from 'react';
import { OFFLINE_AKTION_MELDUNG } from '../../../../utils/offlineAktion';
import {
  FUNKTION_BEISPIELE,
  FUNKTION_HINWEIS,
  FUNKTION_PLATZHALTER,
  useFunktionsbeschreibung,
} from '../../useFunktionsbeschreibung';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';

export interface WebFunktionDialogProps {
  /** Die gespeicherte Beschreibung. */
  initialRoleTitle?: string;
  onSchliessen: () => void;
  /** Gespeichert (oder ohne Netz eingereiht): Die Seite schließt und lädt neu. */
  onGespeichert: () => void;
}

const WebFunktionDialog: React.FC<WebFunktionDialogProps> = ({ initialRoleTitle = '', onSchliessen, onGespeichert }) => {
  const { roleTitle, setRoleTitle, isSubmitting, isOnline, fehler, speichern } = useFunktionsbeschreibung({
    initialRoleTitle,
    onErfolg: onGespeichert,
    fehlerImFormular: true,
  });

  return (
    <WebDialog
      titel="Funktionsbeschreibung"
      onSchliessen={onSchliessen}
      onAbsenden={() => { if (!isSubmitting && isOnline) void speichern(); }}
      gesperrt={isSubmitting}
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
        <WebFeld
          label="Funktionsbeschreibung"
          wert={roleTitle}
          onWert={setRoleTitle}
          platzhalter={FUNKTION_PLATZHALTER}
          deaktiviert={isSubmitting}
          hinweis={`${FUNKTION_HINWEIS} ${FUNKTION_BEISPIELE}`}
        />
      </div>
    </WebDialog>
  );
};

export default WebFunktionDialog;
