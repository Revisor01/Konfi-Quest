// „Benachrichtigungen" als Dialog der Web-Fassung (Simon, 15.10.2026: im
// Browser ab 992 px bekommt jedes Formular, das noch ein App-Modal öffnet, ein
// kompaktes Web-Fenster; in den Apps und darunter bleibt das Modal). Geöffnet
// aus dem Profil aller drei Rollen.
//
// Dieselbe Logik wie im Modal der App (usePushAuswahl): dieselben Gruppen, die
// der Server für die Rolle liefert, der Hauptschalter oben, jeder Wechsel geht
// sofort an PUT /notifications/preferences. Solange gespeichert wird, sind die
// Schalter gesperrt und nichts schließt den Dialog. Meldungen stehen im Dialog.

import React from 'react';
import { PUSH_NICHT_ERLAUBT, PUSH_POSTFACH_HINWEIS, usePushAuswahl, type PushEinstellungen } from '../../usePushAuswahl';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebSchalter from '../../../web/WebSchalter';

export interface WebPushAuswahlDialogProps {
  onSchliessen: () => void;
  /** Nach jeder gespeicherten Änderung, damit der Stand in der Zeile mitzieht. */
  onGeaendert?: (e: PushEinstellungen) => void;
}

const WebPushAuswahlDialog: React.FC<WebPushAuswahlDialogProps> = ({ onSchliessen, onGeaendert }) => {
  const { einstellungen, laedt, speichert, hauptSchalten, gruppeSchalten, erlaubt, erlauben, fehler } = usePushAuswahl({
    onGeaendert,
    fehlerImDialog: true,
  });

  return (
    <WebDialog
      titel="Benachrichtigungen"
      beschreibung="Welche Mitteilungen aufs Handy kommen. Jeder Wechsel gilt sofort."
      onSchliessen={onSchliessen}
      gesperrt={speichert}
      aktionen={<WebKnopf art="primaer" onClick={onSchliessen} disabled={speichert}>Fertig</WebKnopf>}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!erlaubt && (
          <>
            <WebHinweis art="warnung">{PUSH_NICHT_ERLAUBT}</WebHinweis>
            <div className="web-formular__knoepfe">
              <WebKnopf klein onClick={erlauben}>Mitteilungen erlauben</WebKnopf>
            </div>
          </>
        )}
        {laedt || !einstellungen ? (
          laedt ? <p className="web-wahl__leer" role="status">Die Einstellungen werden geladen.</p> : null
        ) : (
          <fieldset className="web-wahl">
            <legend className="web-feld__label web-wahl__legende">Aufs Handy</legend>
            <WebSchalter
              label="Alle Mitteilungen"
              hinweis="Hauptschalter für die Gruppen darunter"
              an={einstellungen.push_enabled}
              onAn={hauptSchalten}
              deaktiviert={speichert}
            />
            {einstellungen.gruppen.map((g) => (
              <WebSchalter
                key={g.id}
                label={g.name}
                hinweis={g.beschreibung || undefined}
                an={g.aktiv}
                onAn={(an) => gruppeSchalten(g.id, an)}
                deaktiviert={speichert || !einstellungen.push_enabled}
              />
            ))}
          </fieldset>
        )}
        <WebHinweis art="hinweis">{PUSH_POSTFACH_HINWEIS}</WebHinweis>
      </div>
    </WebDialog>
  );
};

export default WebPushAuswahlDialog;
