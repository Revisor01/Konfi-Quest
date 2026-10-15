// „Event einer Serie löschen" als kleines Fenster der Web-Fassung (Simon,
// 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes Fenster kompakt).
// Geöffnet über „Event löschen" an einem Event einer Serie in der Liste der
// Leitung (AdminEventsPage im breiten Layout); unter 992 px und in den Apps
// bleibt das Aktionsmenü der App.
//
// Dieselben Wege mit denselben Namen wie im Aktionsmenü (utils/serieLoeschen.ts):
// nur dieses, dieses und alle folgenden (wenn es sie gibt), die ganze Serie.
// Die Wahl schließt das Fenster; danach folgen dieselben Rückfragen der Seite
// wie in der App, die nennen, was verloren geht.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_LOESCHEN } from '../../../shared/icons';
import type { SerienLoeschWahl, SerienTermin } from '../../../../utils/serieLoeschen';
import WebDialog from '../../../web/WebDialog';
import WebKnopf from '../../../web/WebKnopf';
import '../../../../theme/web/termine.css';

export interface WebSerieLoeschenDialogProps<E extends SerienTermin> {
  wahl: SerienLoeschWahl<E>;
  onNurDieses: () => void;
  onMehrere: (events: E[], label: string) => void;
  onSchliessen: () => void;
}

function WebSerieLoeschenDialog<E extends SerienTermin>({ wahl, onNurDieses, onMehrere, onSchliessen }: WebSerieLoeschenDialogProps<E>) {
  // Erst schließen, dann die Rückfrage der Seite -- zwei Fenster übereinander
  // hätten zwei Fokusfallen.
  const waehle = (weiter: () => void) => () => { onSchliessen(); weiter(); };
  return (
    <WebDialog
      titel={wahl.titel}
      beschreibung={wahl.satz}
      rueckfrage="loeschen"
      onSchliessen={onSchliessen}
      aktionen={<WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>}
    >
      <div className="web-teilnehmer-menue">
        <WebKnopf onClick={waehle(onNurDieses)}>
          <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          {wahl.nurDiesesText}
        </WebKnopf>
        {wahl.folgende && wahl.folgendeText && (
          <WebKnopf art="gefahr" onClick={waehle(() => onMehrere(wahl.folgende as E[], 'dieses und alle folgenden'))}>
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            {wahl.folgendeText}
          </WebKnopf>
        )}
        <WebKnopf art="gefahr" onClick={waehle(() => onMehrere(wahl.ganzeSerie, 'die ganze Serie'))}>
          <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          {wahl.ganzeSerieText}
        </WebKnopf>
      </div>
    </WebDialog>
  );
}

export default WebSerieLoeschenDialog;
