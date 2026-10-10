// Das Team als Karten im Raster (/admin/konfis, Reiter "Team", Ansicht
// "Kacheln"), gebaut wie die Challenge-Karte (WebBildKarte; Simon,
// 07.10.2026): je Teamer:in eine Karte mit dem, was die Team-Tabelle zeigt --
// Name, Benutzername, Jahrgaenge, Badges, Zertifikate, "im Team seit" -- und,
// nur fuer die Gemeindeleitung, Loeschen. Die ganze Karte fuehrt auf dieselbe
// Detailseite wie in der Tabelle. Die Reihenfolge ist die der Liste.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_GRUPPE, ICON_LOESCHEN } from '../../../shared/icons';
import { KENNZAHL_SYMBOL } from '../../../web/kennzahlSymbole';
import WebKnopf from '../../../web/WebKnopf';
import WebBildKarte, { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebTreffer from '../../../web/WebTreffer';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { initialen, teamerName } from '../../../../utils/konfiListe';
import type { TeamerListenEintrag } from '../../../../types/user';

export interface WebTeamKachelnProps {
  team: readonly TeamerListenEintrag[];
  suche: string;
  /** Loeschen auf der Karte; fehlt es, steht der Knopf nicht da. */
  onLoeschen?: (teamer: TeamerListenEintrag) => void;
}

const WebTeamKacheln: React.FC<WebTeamKachelnProps> = ({ team, suche, onLoeschen }) => (
  <ul className="web-bildkarten" aria-label="Team">
    {team.map((t) => {
      const badges = t.badge_count || 0;
      const zertifikate = t.cert_count || 0;
      return (
        <li key={t.id} className="web-bildkarten__eintrag">
          <WebBildKarte
            akzent="var(--app-color-teamer)"
            akzentDunkel="var(--app-color-teamer-dunkel)"
            symbol={<WebBildKarteSymbol text={initialen(teamerName(t)) || '??'} />}
            label={t.teamer_since ? `Teamer:in · im Team seit ${new Date(t.teamer_since).getFullYear()}` : 'Teamer:in'}
            titelImKopf
            titel={<WebTreffer text={teamerName(t)} suche={suche} />}
            href={`/admin/konfis/${t.id}`}
            unterzeile={t.username ? <WebTreffer text={t.username} suche={suche} /> : undefined}
            angaben={[
              { icon: ICON_GRUPPE, inhalt: t.jahrgang_name || 'Kein Jahrgang' },
              { ...KENNZAHL_SYMBOL.badges, inhalt: mitEinheit(badges, 'Badge', 'Badges') },
              { ...KENNZAHL_SYMBOL.zertifikate, inhalt: mitEinheit(zertifikate, 'Zertifikat', 'Zertifikate') },
            ]}
            fuss={onLoeschen ? (
              <WebKnopf klein art="gefahr" vorn onClick={() => onLoeschen(t)} aria-label={`${teamerName(t)} löschen`}>
                <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                Löschen
              </WebKnopf>
            ) : undefined}
          />
        </li>
      );
    })}
  </ul>
);

export default WebTeamKacheln;
