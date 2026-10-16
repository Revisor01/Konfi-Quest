// „Abgemeldet eintragen" und „Abmeldung bearbeiten" als Dialog der
// Web-Fassung (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes
// Formular als kompaktes Fenster). Geöffnet aus dem Menü „Weitere Aktionen"
// einer Person auf der Seite eines Events (EventDetailView im breiten
// Layout); unter 992 px und in den Apps bleibt das Modal der App
// (modals/AbmeldungNachtragenModal.tsx).
//
// Dieselbe Logik wie in der App (useAbmeldungFormular): dieselben zwei
// Felder (Grund, Notiz), derselbe Hinweis auf die Folge, dasselbe Speichern
// über die Seite (Status 'excused' mit Grund und Notiz). Lehnt der Server
// ab, steht die Meldung im Dialog, und er bleibt offen. Während des
// Speicherns schließt nichts den Dialog. Eine Rückfrage beim Schließen gibt
// es nicht -- die App fragt auch nicht.

import React from 'react';
import { useAbmeldungFormular } from '../../modals/useAnwesenheitTexte';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebAbmeldungDialogProps {
  teilnehmerName: string;
  grund?: string | null;
  notiz?: string | null;
  /** Wie in der App: die Seite trägt ein; wirft sie, bleibt der Dialog mit Meldung offen. */
  onSave: (grund: string, notiz: string) => Promise<void> | void;
  onSchliessen: () => void;
}

const WebAbmeldungDialog: React.FC<WebAbmeldungDialogProps> = ({ teilnehmerName, grund, notiz, onSave, onSchliessen }) => {
  const f = useAbmeldungFormular({ grund, notiz, onSave, onFertig: onSchliessen, fehlerImDialog: true });
  const abbrechen = () => { if (!f.isSubmitting) onSchliessen(); };
  return (
    <WebDialog
      titel={`Abmeldung von ${teilnehmerName}`}
      onSchliessen={abbrechen}
      onAbsenden={() => { if (!f.isSubmitting && f.isOnline) void f.handleSave(); }}
      gesperrt={f.isSubmitting}
      aktionen={(
        <>
          <WebKnopf onClick={abbrechen} disabled={f.isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={f.isSubmitting || !f.isOnline}>
            Abmeldung speichern
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {f.fehler && <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>}
        {!f.isOnline && <WebHinweis art="warnung">Du bist offline. Speichern geht erst wieder mit Internetverbindung.</WebHinweis>}
        {/* Kurz und richtig: die Folge, die in diesem Moment eintritt.
            Der Erklaertext zur Abmeldung steht im Handbuch. */}
        <WebTextfeld
          label="Grund"
          zeilen={3}
          platzhalter="z. B. „krank, Mutter hat angerufen“"
          hinweis="Keine Punkte. Die Konfi bekommt eine Mitteilung, dass die Abmeldung eingetragen wurde."
          wert={f.grundText}
          onWert={(wert) => f.setGrundText(wert.slice(0, 500))}
          deaktiviert={f.isSubmitting}
        />
        <WebTextfeld
          label="Notiz (optional)"
          zeilen={3}
          platzhalter="z. B. „Attest liegt vor“"
          wert={f.notizText}
          onWert={(wert) => f.setNotizText(wert.slice(0, 500))}
          deaktiviert={f.isSubmitting}
        />
      </div>
    </WebDialog>
  );
};

export default WebAbmeldungDialog;
