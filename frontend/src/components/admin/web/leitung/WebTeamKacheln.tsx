// Das Team als Karten im Raster (/admin/konfis, Reiter "Team", Ansicht
// "Kacheln"): je Teamer:in eine Karte mit dem, was die Team-Tabelle zeigt --
// Name, Benutzername, Jahrgaenge, Badges, Zertifikate, "im Team seit" -- und,
// nur fuer die Gemeindeleitung, Loeschen. Die ganze Karte fuehrt auf dieselbe
// Detailseite wie in der Tabelle. Die Reihenfolge ist die der Liste.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_DATEI, ICON_LOESCHEN } from '../../../shared/icons';
import WebKnopf from '../../../web/WebKnopf';
import WebTreffer from '../../../web/WebTreffer';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { initialen, teamerName } from '../../../../utils/konfiListe';
import type { TeamerListenEintrag } from '../../../../types/user';
import { WebAvatar, WebPersonenKachel } from './WebLeitungBausteine';

export interface WebTeamKachelnProps {
  team: readonly TeamerListenEintrag[];
  suche: string;
  /** Loeschen auf der Karte; fehlt es, steht der Knopf nicht da. */
  onLoeschen?: (teamer: TeamerListenEintrag) => void;
}

const WebTeamKacheln: React.FC<WebTeamKachelnProps> = ({ team, suche, onLoeschen }) => (
  <ul className="web-personenkacheln" aria-label="Team">
    {team.map((t) => {
      const badges = t.badge_count || 0;
      const zertifikate = t.cert_count || 0;
      return (
        <WebPersonenKachel
          key={t.id}
          href={`/admin/konfis/${t.id}`}
          avatar={<WebAvatar text={initialen(teamerName(t)) || '??'} farbe="teamer" />}
          name={<WebTreffer text={teamerName(t)} suche={suche} />}
          untertitel={t.username ? <span className="web-zelle-leise web-einzeilig"><WebTreffer text={t.username} suche={suche} /></span> : undefined}
          aktion={onLoeschen ? (
            <WebKnopf klein vorn art="gefahr" symbol onClick={() => onLoeschen(t)} aria-label={`${teamerName(t)} löschen`} title="Teamer:in löschen">
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          ) : undefined}
        >
          <p className="web-personenkachel__meta">{t.jahrgang_name || 'Kein Jahrgang'}</p>
          <div className="web-personenkachel__fuss">
            <span className="web-zahl-mit-symbol" title={`${badges} Badges`}>
              <IonIcon icon={ICON_ABZEICHEN} className="web-zahl-mit-symbol__symbol" aria-hidden="true" />
              {mitEinheit(badges, 'Badge', 'Badges')}
            </span>
            <span className="web-zahl-mit-symbol" title={`${zertifikate} Zertifikate`}>
              <IonIcon icon={ICON_DATEI} className="web-zahl-mit-symbol__symbol" aria-hidden="true" />
              {mitEinheit(zertifikate, 'Zertifikat', 'Zertifikate')}
            </span>
            {t.teamer_since && <span>Im Team seit {new Date(t.teamer_since).getFullYear()}</span>}
          </div>
        </WebPersonenKachel>
      );
    })}
  </ul>
);

export default WebTeamKacheln;
