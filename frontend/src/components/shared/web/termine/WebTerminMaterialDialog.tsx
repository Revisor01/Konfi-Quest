// Material aus einem Event als Fenster der Web-Fassung (Simon, 15.10.2026,
// Seiten-Inventar: im Browser ab 992 px jedes Fenster kompakt). Geöffnet von
// der Seite eines Events bei der Leitung (EventDetailView) und beim Team
// (TeamerEventsPage), jeweils im breiten Layout; unter 992 px und in den Apps
// bleibt das Modal der App (teamer/pages/TeamerMaterialDetailPage.tsx).
//
// Das Fenster ist dasselbe wie unter „Material verwalten"
// (admin/web/leitung/WebMaterialDialog), hier zum Lesen -- wie in der App, wo
// das Material aus einem Event nur angesehen wird. Geladen wird wie in der App
// (useMaterialAnsicht: erst der Server, ohne Netz der zuletzt geladene Stand);
// Dateien öffnen über den gemeinsamen Weg mit dem Betrachter der App
// (useDateiOeffnen), Links im Browser. Solange geladen wird oder wenn das
// Material fehlt, steht das im Fenster selbst.

import React from 'react';
import { useMaterialAnsicht } from '../../../teamer/pages/useMaterialAnsicht';
import type { Material } from '../../../admin/modals/useMaterialFormular';
import WebMaterialDialog from '../../../admin/web/leitung/WebMaterialDialog';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';

export interface WebTerminMaterialDialogProps {
  materialId: number;
  onSchliessen: () => void;
}

const WebTerminMaterialDialog: React.FC<WebTerminMaterialDialogProps> = ({ materialId, onSchliessen }) => {
  // Die Lese-Ansicht von WebMaterialDialog zählt „Material angesehen" selbst.
  const { material, loading } = useMaterialAnsicht<Material>(materialId, { angesehenMelden: false });

  if (loading || !material) {
    return (
      <WebDialog
        titel="Material ansehen"
        onSchliessen={onSchliessen}
        aktionen={<WebKnopf art="primaer" onClick={onSchliessen}>Schließen</WebKnopf>}
      >
        {loading
          ? <p className="web-wahl__leer" role="status">Das Material wird geladen.</p>
          : <WebHinweis art="fehler" titel="Nicht gefunden" rolle="alert">Das Material konnte nicht geladen werden.</WebHinweis>}
      </WebDialog>
    );
  }

  return <WebMaterialDialog material={material} nurLesen onSchliessen={onSchliessen} onGespeichert={onSchliessen} />;
};

export default WebTerminMaterialDialog;
