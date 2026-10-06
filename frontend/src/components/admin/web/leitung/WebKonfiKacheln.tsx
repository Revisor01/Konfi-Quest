// Die Konfis als Karten im Raster (/admin/konfis, Ansicht "Kacheln"): je Konfi
// eine Karte mit Kreis, Name, Benutzername, Jahrgang, den drei Balken
// (Gottesdienst, Gemeinde, Gesamt) und der Zahl der Badges. Die ganze Karte ist
// ein Link auf die Detailseite; Loeschen ist ein kleiner Knopf darauf, mit
// derselben Rueckfrage wie in der Tabelle (sie steht in der Seite). Die
// Reihenfolge der Karten ist die der Liste -- sortiert hat WebKonfis.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_LOESCHEN } from '../../../shared/icons';
import WebKnopf from '../../../web/WebKnopf';
import WebTreffer from '../../../web/WebTreffer';
import { datumKurz } from '../../../../utils/dateUtils';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { jahrgangVon, konfiPunkte, initialen, type KonfiListenEintrag } from '../../../../utils/konfiListe';
import { WebAvatar, WebFortschritt, WebPersonenKachel } from './WebLeitungBausteine';

export interface WebKonfiKachelnProps {
  konfis: readonly KonfiListenEintrag[];
  suche: string;
  /** Loeschen auf der Karte; fehlt es, steht der Knopf nicht da. */
  onLoeschen?: (konfi: KonfiListenEintrag) => void;
}

const WebKonfiKacheln: React.FC<WebKonfiKachelnProps> = ({ konfis, suche, onLoeschen }) => (
  <ul className="web-personenkacheln" aria-label="Konfis">
    {konfis.map((k) => {
      const p = konfiPunkte(k);
      const badges = k.badgeCount || 0;
      return (
        <WebPersonenKachel
          key={k.id}
          href={`/admin/konfis/${k.id}`}
          avatar={<WebAvatar text={initialen(k.name)} farbe={p.erreicht ? 'erreicht' : 'konfis'} />}
          name={<WebTreffer text={k.name} suche={suche} />}
          untertitel={k.username ? <span className="web-zelle-leise web-einzeilig"><WebTreffer text={k.username} suche={suche} /></span> : undefined}
          aktion={onLoeschen ? (
            <WebKnopf klein vorn art="gefahr" symbol onClick={() => onLoeschen(k)} aria-label={`${k.name} löschen`} title="Konfi löschen">
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          ) : undefined}
        >
          <p className="web-personenkachel__meta">{jahrgangVon(k) || 'Kein Jahrgang'}</p>
          <div className="web-personenkachel__balken">
            <WebFortschritt
              beschriftung="Gottesdienst"
              name="Gottesdienst-Punkte"
              art="gottesdienst"
              wert={p.gottesdienst}
              ziel={p.zielGottesdienst}
              abgeschaltet={!p.gottesdienstAn}
            />
            <WebFortschritt
              beschriftung="Gemeinde"
              name="Gemeinde-Punkte"
              art="gemeinde"
              wert={p.gemeinde}
              ziel={p.zielGemeinde}
              abgeschaltet={!p.gemeindeAn}
            />
            <WebFortschritt
              beschriftung="Gesamt"
              name="Punkte gesamt"
              art="gesamt"
              wert={p.gesamt}
              ziel={p.zielGesamt}
              prozent={p.prozentGesamt}
            />
          </div>
          <div className="web-personenkachel__fuss">
            <span className="web-zahl-mit-symbol" title={`${badges} Badges`}>
              <IonIcon icon={ICON_ABZEICHEN} className="web-zahl-mit-symbol__symbol" aria-hidden="true" />
              {mitEinheit(badges, 'Badge', 'Badges')}
            </span>
            {k.letzte_aktivitaet && <span>Zuletzt aktiv {datumKurz(k.letzte_aktivitaet)}</span>}
          </div>
        </WebPersonenKachel>
      );
    })}
  </ul>
);

export default WebKonfiKacheln;
