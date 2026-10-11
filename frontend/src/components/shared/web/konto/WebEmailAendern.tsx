// „E-Mail ändern" als Dialog der Web-Fassung (Browser ab 992 px, Simon
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Geöffnet aus
// dem Profil aller drei Rollen (Leitung, Team, Konfi). Ein Feld mit der
// Adresse, darunter der Hinweis der App; Fehler stehen über dem Feld.
//
// Die Logik ist die der App (useEmailAendern): aktuelle Adresse vom Server,
// freiwillig, eine angegebene muss gültig sein, Server-Meldungen wie dort.
// Was danach neu geladen wird, sagt die Seite (onGespeichert).

import React from 'react';
import { OFFLINE_AKTION_MELDUNG } from '../../../../utils/offlineAktion';
import { EMAIL_HINWEIS, useEmailAendern } from '../../useEmailAendern';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';

export interface WebEmailAendernProps {
  /** Die Adresse, die die Seite kennt; gilt, bis der Server die aktuelle liefert. */
  initialEmail?: string;
  onSchliessen: () => void;
  /** Gespeichert: Die Seite schließt den Dialog und lädt neu. */
  onGespeichert: () => void;
}

const WebEmailAendern: React.FC<WebEmailAendernProps> = ({ initialEmail = '', onSchliessen, onGespeichert }) => {
  const { email, setEmail, laedt, isSubmitting, isOnline, fehler, speichern } = useEmailAendern({
    initialEmail,
    onErfolg: onGespeichert,
    fehlerImFormular: true,
  });

  return (
    <WebDialog
      titel="E-Mail ändern"
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting || laedt || !isOnline}>Speichern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {!isOnline && <WebHinweis art="warnung" titel="Du bist offline">{OFFLINE_AKTION_MELDUNG}</WebHinweis>}
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        <WebFeld
          label="E-Mail-Adresse (optional)"
          typ="email"
          autocomplete="email"
          wert={email}
          onWert={setEmail}
          platzhalter="deine@email.de"
          deaktiviert={isSubmitting}
          hinweis={EMAIL_HINWEIS}
        />
      </div>
    </WebDialog>
  );
};

export default WebEmailAendern;
