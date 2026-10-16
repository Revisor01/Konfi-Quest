// „Konto löschen" (das eigene) als Dialog der Web-Fassung (Simon, 15.10.2026:
// im Browser ab 992 px bekommt jedes Formular, das noch ein App-Modal öffnet,
// ein kompaktes Web-Fenster; in den Apps und darunter bleibt das Modal).
// Geöffnet aus dem Profil aller drei Rollen über „Konto löschen".
//
// In der Optik einer Rückfrage vor dem Löschen (rueckfrage="loeschen":
// Mülleimer über dem Titel, der Knopf rot gefüllt) -- mit derselben Sicherung
// wie in der App (useKontoLoeschen): derselbe Warntext unter dem Titel (was mit
// dem Konto verschwindet), das eigene Passwort, derselbe Aufruf
// (POST /auth/delete-account), dieselben Meldungen. Wie in den übrigen
// Fenstern bleibt der Knopf bedienbar, damit die Prüfung sagen kann, was
// fehlt; alle Meldungen stehen im Dialog. Enter im Passwortfeld löscht wie
// der Knopf. Während des Löschens schließt nichts den Dialog.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SICHTBAR, ICON_VERBORGEN } from '../../icons';
import { OFFLINE_AKTION_MELDUNG } from '../../../../utils/offlineAktion';
import { useKontoLoeschen } from '../../useKontoLoeschen';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';

export interface WebKontoLoeschenDialogProps {
  onSchliessen: () => void;
}

const WebKontoLoeschenDialog: React.FC<WebKontoLoeschenDialogProps> = ({ onSchliessen }) => {
  const {
    password, setPassword, showPassword, setShowPassword, inlineError, isSubmitting, isOnline, loeschen, hinweis,
  } = useKontoLoeschen({ onGeloescht: onSchliessen, fehlerImFormular: true });

  return (
    <WebDialog
      titel="Konto löschen"
      beschreibung={hinweis}
      rueckfrage="loeschen"
      onSchliessen={onSchliessen}
      onAbsenden={() => { if (!isSubmitting && isOnline) void loeschen(); }}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="gefahr" absenden disabled={isSubmitting || !isOnline}>
            {isSubmitting ? 'Wird gelöscht …' : 'Konto endgültig löschen'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {!isOnline && <WebHinweis art="warnung" titel="Du bist offline">{OFFLINE_AKTION_MELDUNG}</WebHinweis>}
        {inlineError && <WebHinweis art="fehler" rolle="alert">{inlineError}</WebHinweis>}
        <WebFeld
          label="Dein Passwort"
          pflicht
          typ={showPassword ? 'text' : 'password'}
          autocomplete="current-password"
          wert={password}
          onWert={setPassword}
          platzhalter="Passwort zur Bestätigung eingeben"
          deaktiviert={isSubmitting}
        />
        <div className="web-formular__knoepfe">
          <WebKnopf klein art="text" onClick={() => setShowPassword(!showPassword)}>
            <IonIcon icon={showPassword ? ICON_VERBORGEN : ICON_SICHTBAR} aria-hidden="true" />
            {showPassword ? 'Passwort verbergen' : 'Passwort zeigen'}
          </WebKnopf>
        </div>
      </div>
    </WebDialog>
  );
};

export default WebKontoLoeschenDialog;
