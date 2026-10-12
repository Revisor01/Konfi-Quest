// Kategorie anlegen oder bearbeiten als Dialog der Web-Fassung
// (/admin/settings/categories ab 992 px; Simon, 11.10.2026: „Web braucht
// eigene kompaktere Modale überall"). Dieselben Felder wie das Modal der App
// (CategoryModal in admin/pages/AdminCategoriesPage.tsx): Name und
// Beschreibung. Die Logik ist dieselbe (useKategorieFormular): ohne Netz geht
// die Kategorie in die Warteschlange, Fehler stehen im Dialog. Während
// gespeichert wird, schließt nichts den Dialog (Abbrechen, X, Escape, Klick
// daneben), wie das X der App: Eine Ablehnung des Servers ginge sonst ins
// Leere.

import React from 'react';
import { useKategorieFormular, type KategorieVorlage } from '../../useKategorieFormular';
import { OFFLINE_HINWEIS } from '../../stammdatenFormular';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebTextfeld from '../../../web/WebTextfeld';

export interface WebKategorieDialogProps {
  /** Die Kategorie zum Bearbeiten; null legt eine neue an. */
  kategorie: KategorieVorlage | null;
  onSchliessen: () => void;
  /** Nach dem Speichern (auch eingereiht): die Liste neu laden. */
  onGespeichert: () => void;
}

const WebKategorieDialog: React.FC<WebKategorieDialogProps> = ({ kategorie, onSchliessen, onGespeichert }) => {
  const { formData, aendern, loading, fehler, isOnline, speichern } = useKategorieFormular(kategorie, {
    onFertig: () => {
      onGespeichert();
      onSchliessen();
    },
    fehlerImDialog: true,
  });

  return (
    <WebDialog
      titel={kategorie ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
      beschreibung="Kategorien sortieren Aktivitäten und Events der ganzen Gemeinde."
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      gesperrt={loading}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={loading}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={loading}>{kategorie ? 'Speichern' : 'Anlegen'}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!isOnline && <WebHinweis art="hinweis">{OFFLINE_HINWEIS}</WebHinweis>}
        <WebFeld
          label="Name"
          pflicht
          wert={formData.name}
          onWert={(name) => aendern({ name })}
          platzhalter="z.B. Ausflug, Gottesdienst"
          deaktiviert={loading}
        />
        <WebTextfeld
          label="Beschreibung"
          zeilen={3}
          wert={formData.description}
          onWert={(description) => aendern({ description })}
          platzhalter="Beschreibung der Kategorie..."
          deaktiviert={loading}
        />
      </div>
    </WebDialog>
  );
};

export default WebKategorieDialog;
