// „Nicht dabei" mit Grund als Fenster der Web-Fassung (Simon, 15.10.2026:
// im Browser ab 992 px bekommt jedes Formular, das noch ein Modal der App
// öffnet, ein kompaktes Fenster). Geöffnet an drei Stellen, jeweils statt des
// Modals der App:
//
//   Team    „Nicht dabei" / „Nicht mehr dabei" unter /teamer/events
//           (statt teamer/modals/TeamerAbsageModal.tsx),
//   Leitung die eigene Absage unter /admin/events/:id (ebenfalls das Modal
//           des Teams),
//   Konfi   „Abmelden", „Von der Warteliste abmelden" und die Abmeldung vom
//           Pflicht-Event unter /konfi/events/:id (statt
//           konfi/modals/UnregisterModal.tsx).
//
// Unter 992 px und in den Apps bleiben die Modale. Regeln und Texte sind
// dieselben (shared/useAbsageFormular.ts): beim Team der Grund freiwillig,
// nach einer Zusage Pflicht; bei Konfis immer ein Grund, am Pflicht-Event
// mindestens fünf Zeichen und der Satz über die Eltern; Konfis ohne Netz
// gesperrt. Gesendet wird über dieselbe Funktion der Seite wie in der App --
// dieselbe Route, derselbe Rumpf, dieselbe Warteschlange.
//
// Wie die übrigen Fenster der Web-Fassung: Der Knopf zum Absenden lässt sich
// klicken, solange nichts gesendet wird; fehlt der Grund, sagt es das Fenster
// selbst. Während gesendet wird, schließt nichts das Fenster (Abbrechen, X,
// Escape, Klick daneben). Eine Ablehnung des Servers steht im Fenster, das
// dann offen bleibt; die nächste Eingabe räumt sie weg. Eine Rückfrage vor
// dem Verwerfen gibt es nicht -- die App fragt hier auch nicht.

import React from 'react';
import { useAbsageFormular, type AbsageRolle } from '../../useAbsageFormular';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebAbsageDialogProps {
  rolle: AbsageRolle;
  /** Team: die Absage nimmt eine Zusage zurück (Grund Pflicht). Konfi: Pflicht-Event. */
  pflicht: boolean;
  eventName: string;
  /**
   * Senden über die Funktion der Seite, mit `melden` für eine Meldung im
   * Fenster. true: angekommen oder eingereiht -- das Fenster schließt.
   */
  onAbsage: (grund: string, melden: (text: string) => void) => Promise<boolean>;
  onSchliessen: () => void;
}

const WebAbsageDialog: React.FC<WebAbsageDialogProps> = ({ rolle, pflicht, eventName, onAbsage, onSchliessen }) => {
  const {
    texte, grund, setGrund, mindestens, offlineGesperrt, isSubmitting, absenden, zaehler, fehler, fehlerLeeren,
  } = useAbsageFormular({
    rolle,
    pflicht,
    onAbsage: (text, melden) => onAbsage(text, melden ?? (() => undefined)),
    onFertig: () => onSchliessen(),
    fehlerImDialog: true,
  });

  const schliessen = () => {
    if (!isSubmitting) onSchliessen();
  };

  return (
    <WebDialog
      titel={texte.titel}
      beschreibung={`${texte.fuer} ${eventName}`}
      onSchliessen={schliessen}
      onAbsenden={() => { if (!isSubmitting) void absenden(); }}
      gesperrt={isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={schliessen} disabled={isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="gefahr" absenden disabled={isSubmitting || offlineGesperrt}>{texte.bestaetigen}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {offlineGesperrt && (
          <WebHinweis art="warnung">Du bist offline. Abmelden geht erst wieder mit Internetverbindung.</WebHinweis>
        )}
        {texte.elternHinweis && (
          <WebHinweis art="hinweis">
            {texte.erklaerung} <strong>{texte.elternHinweis}</strong>
          </WebHinweis>
        )}
        <WebTextfeld
          label={texte.grund}
          pflicht={mindestens > 0}
          zeilen={4}
          wert={grund}
          onWert={(wert) => { fehlerLeeren(); setGrund(wert); }}
          platzhalter={texte.platzhalter}
          // Unter dem Feld: beim Team der Satz der App, am Pflicht-Event der Zähler („4/5 Zeichen").
          hinweis={zaehler ?? (texte.elternHinweis ? undefined : texte.erklaerung)}
          deaktiviert={isSubmitting}
        />
      </div>
    </WebDialog>
  );
};

export default WebAbsageDialog;
