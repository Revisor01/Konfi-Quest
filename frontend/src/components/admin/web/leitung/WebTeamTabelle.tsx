// Die Team-Tabelle der Web-Fassung (/admin/konfis, Ansicht "Team"): Name,
// Jahrgaenge, Badges, Zertifikate, Teamer:in seit und -- nur fuer die
// Gemeindeleitung -- Loeschen. Der Name fuehrt auf dieselbe Detailseite wie bei
// den Konfis (die Seite zeigt dort die Teamer-Ansicht).

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_DATEI, ICON_LOESCHEN } from '../../../shared/icons';
import WebLink from '../../../web/WebLink';
import WebKnopf from '../../../web/WebKnopf';
import WebTreffer from '../../../web/WebTreffer';
import { initialen, teamerName } from '../../../../utils/konfiListe';
import type { TeamerListenEintrag } from '../../../../types/user';
import WebSortTabelle, { type WebSortSpalte, type WebSortierung } from './WebSortTabelle';
import { WebAvatar } from './WebLeitungBausteine';

export interface WebTeamTabelleProps {
  team: readonly TeamerListenEintrag[];
  suche: string;
  sortierung: WebSortierung;
  onSortieren: (schluessel: string) => void;
  onLoeschen?: (teamer: TeamerListenEintrag) => void;
}

const WebTeamTabelle: React.FC<WebTeamTabelleProps> = ({ team, suche, sortierung, onSortieren, onLoeschen }) => {
  const spalten: Array<WebSortSpalte<TeamerListenEintrag>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      sortierbar: true,
      zelle: (t) => (
        <span className="web-person-zelle">
          <WebAvatar text={initialen(teamerName(t)) || '??'} farbe="teamer" />
          <span className="web-person-zelle__text">
            <WebLink href={`/admin/konfis/${t.id}`} className="web-link--zeile web-link--text web-einzeilig">
              <WebTreffer text={teamerName(t)} suche={suche} />
            </WebLink>
            {t.username && <span className="web-zelle-leise web-einzeilig"><WebTreffer text={t.username} suche={suche} /></span>}
          </span>
        </span>
      ),
    },
    {
      schluessel: 'jahrgaenge',
      kopf: 'Jahrgänge',
      breite: '24%',
      zelle: (t) => t.jahrgang_name || <span className="web-gedaempft">Kein Jahrgang</span>,
    },
    {
      schluessel: 'badges',
      kopf: 'Badges',
      sortierbar: true,
      zahl: true,
      breite: '96px',
      zelle: (t) => (
        <span className="web-zahl-mit-symbol" title={`${t.badge_count || 0} Badges`}>
          <IonIcon icon={ICON_ABZEICHEN} className="web-zahl-mit-symbol__symbol" aria-hidden="true" />
          {t.badge_count || 0}
        </span>
      ),
    },
    {
      schluessel: 'zertifikate',
      kopf: 'Zertifikate',
      sortierbar: true,
      zahl: true,
      breite: '112px',
      zelle: (t) => (
        <span className="web-zahl-mit-symbol" title={`${t.cert_count || 0} Zertifikate`}>
          <IonIcon icon={ICON_DATEI} className="web-zahl-mit-symbol__symbol" aria-hidden="true" />
          {t.cert_count || 0}
        </span>
      ),
    },
    {
      schluessel: 'seit',
      kopf: 'Im Team seit',
      breite: '120px',
      optional: true,
      zelle: (t) => (t.teamer_since ? String(new Date(t.teamer_since).getFullYear()) : <span className="web-gedaempft">–</span>),
    },
    ...(onLoeschen ? [{
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-schmal',
      zelle: (t: TeamerListenEintrag) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein vorn art="gefahr" symbol onClick={() => onLoeschen(t)} aria-label={`${teamerName(t)} löschen`} title="Teamer:in löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      ),
    }] : []),
  ];

  return (
    <WebSortTabelle
      beschriftung="Team"
      spalten={spalten}
      zeilen={team}
      zeileSchluessel={(t) => t.id}
      mittig
      fest
      sortierung={sortierung}
      onSortieren={onSortieren}
    />
  );
};

export default WebTeamTabelle;
