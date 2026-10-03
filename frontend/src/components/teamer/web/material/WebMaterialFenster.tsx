// Das Fenster "Material ansehen" in der Web-Fassung: Titel in der Kopfzeile, darunter
// die Angaben zum Material (Beschreibung, Details, Links, Dateien) untereinander.
// Es oeffnet aus den Events (Team- und Leitungsansicht) und aus dem Kalender;
// Laden, Dateien und Links kommen von der Seite (TeamerMaterialDetailPage).
//
// Ohne Glocke und Gemeinde-Umschalter, wie in der App: Das Postfach ist selbst ein
// Fenster und wuerde ueber diesem liegen, ein Gemeinde-Wechsel baute den Router
// unter dem offenen Fenster um.

import React from 'react';
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/react';
import AppKopfzeile from '../../../shared/AppKopfzeile';
import { ICON_DATEI_GEFUELLT, ICON_SCHLIESSEN } from '../../../shared/icons';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import WebMaterialInhalt from './WebMaterialInhalt';
import type { LadendeDatei, MaterialDatei, MaterialDetailDaten } from './materialTypen';

export interface WebMaterialFensterProps {
  material: MaterialDetailDaten | null;
  laedt: boolean;
  onSchliessen: () => void;
  ladendeDatei?: LadendeDatei | null;
  onDatei: (datei: MaterialDatei) => void;
  onLink: (url: string) => void;
  pageRef?: React.Ref<HTMLElement>;
}

const WebMaterialFenster: React.FC<WebMaterialFensterProps> = ({ material, laedt, onSchliessen, ladendeDatei, onDatei, onLink, pageRef }) => (
  <IonPage ref={pageRef}>
    <AppKopfzeile
      titel={material?.title || 'Material'}
      glocke={false}
      gemeindeUmschalter={false}
      links={(
        <IonButton className="app-modal-close-btn" onClick={onSchliessen} aria-label="Schließen">
          <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
        </IonButton>
      )}
    />
    <IonContent className="web-inhalt" fullscreen>
      <div className="web-seite">
        {laedt ? (
          <WebLaden karten={1} text="Das Material wird geladen." />
        ) : !material ? (
          <WebLeer icon={ICON_DATEI_GEFUELLT} titel="Nicht gefunden" text="Das Material konnte nicht geladen werden." />
        ) : (
          <WebMaterialInhalt material={material} ladendeDatei={ladendeDatei} onDatei={onDatei} onLink={onLink} />
        )}
      </div>
    </IonContent>
  </IonPage>
);

export default WebMaterialFenster;
