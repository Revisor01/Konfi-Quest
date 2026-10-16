// „Notiz hinzufügen" und „Notiz bearbeiten" als Dialog der Web-Fassung
// (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes Formular
// als kompaktes Fenster). Geöffnet aus dem Menü „Weitere Aktionen" einer
// Person mit Eintrag auf der Seite eines Events (EventDetailView im breiten
// Layout); unter 992 px und in den Apps bleibt das Modal der App
// (modals/AnwesenheitNotizModal.tsx).
//
// Dieselbe Logik wie in der App (useNotizFormular): ein Feld, Speichern erst
// mit einer Änderung, ein geleertes Feld löscht eine vorhandene Notiz, und
// „Notiz löschen" steht nur da, wenn es eine gibt. Lehnt der Server ab, steht
// die Meldung im Dialog, und er bleibt offen.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_LOESCHEN } from '../../../shared/icons';
import { useNotizFormular } from '../../modals/useAnwesenheitTexte';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebNotizDialogProps {
  teilnehmerName: string;
  notiz?: string | null;
  /** Wie in der App: leer heißt löschen; wirft die Seite, bleibt der Dialog mit Meldung offen. */
  onSave: (notiz: string) => Promise<void> | void;
  onSchliessen: () => void;
}

const WebNotizDialog: React.FC<WebNotizDialogProps> = ({ teilnehmerName, notiz, onSave, onSchliessen }) => {
  const f = useNotizFormular({ notiz, onSave, onFertig: onSchliessen, fehlerImDialog: true });
  const abbrechen = () => { if (!f.isSubmitting) onSchliessen(); };
  const speichern = () => { if (!f.isSubmitting && f.isOnline) void f.handleSave(); };
  return (
    <WebDialog
      titel={`Notiz zu ${teilnehmerName}`}
      onSchliessen={abbrechen}
      onAbsenden={speichern}
      gesperrt={f.isSubmitting}
      aktionen={(
        <>
          {/* Löschen nur, wenn es etwas zu löschen gibt. */}
          {f.hatBestehendeNotiz && (
            <WebKnopf art="gefahr" onClick={() => { void f.handleLoeschen(); }} disabled={f.isSubmitting || !f.isOnline}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              Notiz löschen
            </WebKnopf>
          )}
          <WebKnopf onClick={abbrechen} disabled={f.isSubmitting}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={!f.darfSpeichern || f.isSubmitting || !f.isOnline}>
            Notiz speichern
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {f.fehler && <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>}
        {!f.isOnline && <WebHinweis art="warnung">Du bist offline. Speichern geht erst wieder mit Internetverbindung.</WebHinweis>}
        <WebTextfeld
          label="Notiz"
          zeilen={4}
          platzhalter="z. B. „ging um 14 Uhr“"
          wert={f.text}
          onWert={(wert) => f.setText(wert.slice(0, 500))}
          deaktiviert={f.isSubmitting}
        />
      </div>
    </WebDialog>
  );
};

export default WebNotizDialog;
