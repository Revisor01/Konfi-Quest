// „Passwort ändern" als Dialog der Web-Fassung (Browser ab 992 px, Simon
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Geöffnet aus
// dem Profil aller drei Rollen (Leitung, Team, Konfi).
//
// Aufbau wie in der App, nur kompakt: das aktuelle Passwort, darunter das
// neue und seine Bestätigung nebeneinander, die Anforderungen als Liste mit
// Haken (sie beschreiben das neue Feld, aria-describedby) und ein Knopf, der
// alle drei Felder zeigt oder verbirgt. Fehler -- aus der Prüfung oder vom
// Server, mit denselben Texten wie in der App -- stehen über den Feldern.
// Der Knopf „Speichern" bleibt bedienbar, damit die Prüfung sagen kann, was
// fehlt; nur ohne Netz und während des Speicherns ist er gesperrt.
//
// Die Logik ist die der App (usePasswortAendern).

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_SICHTBAR,
  ICON_VERBORGEN,
  ICON_WARNHINWEIS_GEFUELLT,
  ICON_ZUSAGE_GEFUELLT,
} from '../../icons';
import { OFFLINE_AKTION_MELDUNG } from '../../../../utils/offlineAktion';
import { PASSWORT_ANFORDERUNGEN, usePasswortAendern } from '../../usePasswortAendern';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import '../../../../theme/web/start.css';

export interface WebPasswortAendernProps {
  onSchliessen: () => void;
  /** Gespeichert: Die Seite schließt den Dialog. */
  onGespeichert: () => void;
}

const WebPasswortAendern: React.FC<WebPasswortAendernProps> = ({ onSchliessen, onGespeichert }) => {
  const regelnId = useId();
  const {
    werte, setWert, sichtbar, alleSichtbar, pruefung, passwordsMatch, isValid, isSubmitting, isOnline, fehler, speichern,
  } = usePasswortAendern({ onErfolg: onGespeichert, fehlerImFormular: true });
  const alleLesbar = sichtbar.current && sichtbar.new && sichtbar.confirm;
  const typ = (an: boolean) => (an ? 'text' : 'password');

  return (
    <WebDialog
      titel="Passwort ändern"
      beschreibung="Auf allen anderen Geräten endet danach die Anmeldung."
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={isSubmitting || !isOnline}>Speichern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {!isOnline && <WebHinweis art="warnung" titel="Du bist offline">{OFFLINE_AKTION_MELDUNG}</WebHinweis>}
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        <WebFeld
          label="Aktuelles Passwort"
          pflicht
          typ={typ(sichtbar.current)}
          autocomplete="current-password"
          wert={werte.current_password}
          onWert={(w) => setWert('current_password', w)}
          deaktiviert={isSubmitting}
        />

        <h3 className="web-gruppe">Neues Passwort</h3>
        <div className="web-feldpaar">
          <WebFeld
            label="Neues Passwort"
            pflicht
            typ={typ(sichtbar.new)}
            autocomplete="new-password"
            wert={werte.new_password}
            onWert={(w) => setWert('new_password', w)}
            deaktiviert={isSubmitting}
            beschriebenVon={regelnId}
          />
          <WebFeld
            label="Neues Passwort bestätigen"
            pflicht
            typ={typ(sichtbar.confirm)}
            autocomplete="new-password"
            wert={werte.confirm_password}
            onWert={(w) => setWert('confirm_password', w)}
            deaktiviert={isSubmitting}
          />
        </div>

        <div id={regelnId} className="web-passwort-regeln">
          <div className="web-feld__label">Passwort-Anforderungen</div>
          <ul className="web-passwort-regeln__liste">
            {PASSWORT_ANFORDERUNGEN.map(({ schluessel, label }) => {
              const erfuellt = pruefung[schluessel];
              return (
                <li key={schluessel} className={erfuellt ? 'web-passwort-regel web-passwort-regel--erfuellt' : 'web-passwort-regel'}>
                  <IonIcon icon={erfuellt ? ICON_ZUSAGE_GEFUELLT : ICON_WARNHINWEIS_GEFUELLT} className="web-passwort-regel__symbol" aria-hidden="true" />
                  {label}{' '}
                  <span className="web-nur-vorlesen">{erfuellt ? '(erfüllt)' : '(fehlt noch)'}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {werte.new_password && werte.confirm_password && !passwordsMatch && (
          <WebHinweis art="fehler" rolle="status">Die Passwörter stimmen nicht überein.</WebHinweis>
        )}
        {isValid && <WebHinweis art="erfolg">Alle Anforderungen erfüllt - bereit zum Speichern</WebHinweis>}

        <div className="web-formular__knoepfe">
          <WebKnopf klein art="text" onClick={() => alleSichtbar(!alleLesbar)}>
            <IonIcon icon={alleLesbar ? ICON_VERBORGEN : ICON_SICHTBAR} aria-hidden="true" />
            {alleLesbar ? 'Passwörter verbergen' : 'Passwörter zeigen'}
          </WebKnopf>
        </div>
      </div>
    </WebDialog>
  );
};

export default WebPasswortAendern;
