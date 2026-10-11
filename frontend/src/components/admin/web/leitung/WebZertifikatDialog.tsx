// Zertifikat anlegen oder bearbeiten als Dialog der Web-Fassung
// (/admin/settings/certificates ab 992 px; Simon, 11.10.2026: „Web braucht
// eigene kompaktere Modale überall"). Dieselben Felder wie das Modal der App
// (CertificateModal in admin/pages/AdminCertificatesPage.tsx): Name und Icon,
// das Icon aus demselben Vorrat (WebSymbolWahl). Die Logik ist dieselbe
// (useZertifikatFormular): ohne Netz geht das Zertifikat in die
// Warteschlange, Fehler stehen im Dialog. Während gespeichert wird, schließt
// nichts den Dialog (Abbrechen, X, Escape, Klick daneben), wie das X der
// App: Eine Ablehnung des Servers ginge sonst ins Leere.

import React from 'react';
import { ICON_ABZEICHEN_GEFUELLT } from '../../../shared/icons';
import { useZertifikatFormular, type ZertifikatVorlage } from '../../useZertifikatFormular';
import { OFFLINE_HINWEIS } from '../../stammdatenFormular';
import WebDialog from '../../../web/WebDialog';
import WebFeld from '../../../web/WebFeld';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import WebSymbolWahl from './WebSymbolWahl';

export interface WebZertifikatDialogProps {
  /** Das Zertifikat zum Bearbeiten; null legt ein neues an. */
  zertifikat: ZertifikatVorlage | null;
  onSchliessen: () => void;
  /** Nach dem Speichern (auch eingereiht): die Liste neu laden. */
  onGespeichert: () => void;
}

const WebZertifikatDialog: React.FC<WebZertifikatDialogProps> = ({ zertifikat, onSchliessen, onGespeichert }) => {
  const { name, setName, icon, setIcon, loading, fehler, isOnline, speichern } = useZertifikatFormular(zertifikat, {
    onFertig: () => {
      onGespeichert();
      onSchliessen();
    },
    fehlerImDialog: true,
  });

  return (
    <WebDialog
      titel={zertifikat ? 'Zertifikat bearbeiten' : 'Neues Zertifikat'}
      beschreibung="Zertifikate fürs Team, die du danach einzelnen Teamer:innen zuweist."
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      gesperrt={loading}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={loading}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={loading}>{zertifikat ? 'Speichern' : 'Anlegen'}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        {!isOnline && <WebHinweis art="hinweis">{OFFLINE_HINWEIS}</WebHinweis>}
        <WebFeld
          label="Name"
          pflicht
          wert={name}
          onWert={setName}
          platzhalter="z.B. JuLeiCa, Teamer-Card"
          deaktiviert={loading}
        />
        <WebSymbolWahl
          label="Icon"
          wert={icon}
          onWert={setIcon}
          farbe="var(--app-color-teamer)"
          ton="teamer"
          rueckfall={ICON_ABZEICHEN_GEFUELLT}
          deaktiviert={loading}
        />
      </div>
    </WebDialog>
  );
};

export default WebZertifikatDialog;
