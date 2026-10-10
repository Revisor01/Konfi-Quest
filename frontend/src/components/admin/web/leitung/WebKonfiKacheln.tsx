// Die Konfis als Karten im Raster (/admin/konfis, Ansicht "Kacheln"), gebaut
// wie die Challenge-Karte (WebBildKarte; Simon, 07.10.2026): im Kopf die
// Initialen und der Jahrgang -- gruen, wenn das Punkteziel erreicht ist --,
// darunter Name, Benutzername, die drei Balken (Gottesdienst, Gemeinde,
// Gesamt), Badges und letzte Aktivitaet; im Fuss Loeschen mit derselben
// Rueckfrage wie in der Tabelle (sie steht in der Seite). Die ganze Karte ist
// ein Link auf die Detailseite. Die
// Reihenfolge der Karten ist die der Liste -- sortiert hat WebKonfis.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_LOESCHEN, ICON_UHRZEIT } from '../../../shared/icons';
import { KENNZAHL_SYMBOL } from '../../../web/kennzahlSymbole';
import WebKnopf from '../../../web/WebKnopf';
import WebBildKarte, { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebTreffer from '../../../web/WebTreffer';
import { datumKurz } from '../../../../utils/dateUtils';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { jahrgangVon, konfiPunkte, initialen, type KonfiListenEintrag } from '../../../../utils/konfiListe';
import { WebFortschritt } from './WebLeitungBausteine';

export interface WebKonfiKachelnProps {
  konfis: readonly KonfiListenEintrag[];
  suche: string;
  /** Loeschen auf der Karte; fehlt es, steht der Knopf nicht da. */
  onLoeschen?: (konfi: KonfiListenEintrag) => void;
}

const WebKonfiKacheln: React.FC<WebKonfiKachelnProps> = ({ konfis, suche, onLoeschen }) => (
  <ul className="web-bildkarten" aria-label="Konfis">
    {konfis.map((k) => {
      const p = konfiPunkte(k);
      const badges = k.badgeCount || 0;
      return (
        <li key={k.id} className="web-bildkarten__eintrag">
          <WebBildKarte
            akzent={p.erreicht ? 'var(--app-color-success)' : 'var(--app-color-konfis)'}
            akzentDunkel={p.erreicht ? 'var(--app-color-success-strong)' : 'var(--app-color-konfis-dunkel)'}
            symbol={<WebBildKarteSymbol text={initialen(k.name)} />}
            // Name im Kopf (Simon, 07.10.2026: „konfi name in den kopf").
            label={[jahrgangVon(k) || 'Kein Jahrgang', p.erreicht ? 'Ziel erreicht' : ''].filter(Boolean).join(' · ')}
            titelImKopf
            titel={<WebTreffer text={k.name} suche={suche} />}
            href={`/admin/konfis/${k.id}`}
            unterzeile={k.username ? <WebTreffer text={k.username} suche={suche} /> : undefined}
            angaben={[
              { ...KENNZAHL_SYMBOL.badges, inhalt: mitEinheit(badges, 'Badge', 'Badges') },
              k.letzte_aktivitaet && { icon: ICON_UHRZEIT, inhalt: `Zuletzt aktiv ${datumKurz(k.letzte_aktivitaet)}` },
            ]}
            fuss={onLoeschen ? (
              <WebKnopf klein art="gefahr" vorn onClick={() => onLoeschen(k)} aria-label={`${k.name} löschen`}>
                <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                Löschen
              </WebKnopf>
            ) : undefined}
          >
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
          </WebBildKarte>
        </li>
      );
    })}
  </ul>
);

export default WebKonfiKacheln;
