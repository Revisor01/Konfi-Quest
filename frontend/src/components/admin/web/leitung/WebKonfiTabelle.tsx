// Die Konfi-Tabelle der Web-Fassung (/admin/konfis): Name, Jahrgang, Punkte je
// Art und gesamt mit Fortschritt, Badges, letzte Aktivitaet (sobald die Liste
// sie liefert) und die Aktionen der Zeile. Der Name ist ein echter Link auf die
// Detailseite -- sein Netz spannt sich ueber die ganze Zeile.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_BONUS, ICON_LOESCHEN } from '../../../shared/icons';
import WebLink from '../../../web/WebLink';
import WebKnopf from '../../../web/WebKnopf';
import WebTreffer from '../../../web/WebTreffer';
import { datumKurz } from '../../../../utils/dateUtils';
import { jahrgangVon, konfiPunkte, initialen, type KonfiListenEintrag } from '../../../../utils/konfiListe';
import WebSortTabelle, { type WebSortSpalte, type WebSortierung } from './WebSortTabelle';
import { WebAvatar, WebFortschritt } from './WebLeitungBausteine';

export interface WebKonfiTabelleProps {
  konfis: readonly KonfiListenEintrag[];
  suche: string;
  sortierung: WebSortierung;
  onSortieren: (schluessel: string) => void;
  /** Aktionen der Zeile; fehlt eine, steht der Knopf nicht da. */
  onPunkte?: (konfi: KonfiListenEintrag) => void;
  onLoeschen?: (konfi: KonfiListenEintrag) => void;
}

const WebKonfiTabelle: React.FC<WebKonfiTabelleProps> = ({ konfis, suche, sortierung, onSortieren, onPunkte, onLoeschen }) => {
  const mitAktivitaet = konfis.some((k) => !!k.letzte_aktivitaet);
  const mitAktionen = !!onPunkte || !!onLoeschen;

  const spalten: Array<WebSortSpalte<KonfiListenEintrag>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      sortierbar: true,
      zelle: (k) => {
        const p = konfiPunkte(k);
        return (
          <span className="web-person-zelle">
            <WebAvatar text={initialen(k.name)} farbe={p.erreicht ? 'erreicht' : 'konfis'} />
            <span className="web-person-zelle__text">
              <WebLink href={`/admin/konfis/${k.id}`} className="web-link--zeile web-link--text web-einzeilig">
                <WebTreffer text={k.name} suche={suche} />
              </WebLink>
              {k.username && <span className="web-zelle-leise web-einzeilig"><WebTreffer text={k.username} suche={suche} /></span>}
            </span>
          </span>
        );
      },
    },
    {
      schluessel: 'jahrgang',
      kopf: 'Jahrgang',
      sortierbar: true,
      breite: '14%',
      zelle: (k) => jahrgangVon(k) || <span className="web-gedaempft">Kein Jahrgang</span>,
    },
    {
      schluessel: 'gottesdienst',
      kopf: 'Gottesdienst',
      breite: '128px',
      optional: true,
      zelle: (k) => {
        const p = konfiPunkte(k);
        return p.gottesdienstAn
          ? <WebFortschritt wert={p.gottesdienst} ziel={p.zielGottesdienst} art="gottesdienst" einheit="Gottesdienst-Punkten" />
          : <span className="web-gedaempft" title="Für diesen Jahrgang abgeschaltet">–</span>;
      },
    },
    {
      schluessel: 'gemeinde',
      kopf: 'Gemeinde',
      breite: '128px',
      optional: true,
      zelle: (k) => {
        const p = konfiPunkte(k);
        return p.gemeindeAn
          ? <WebFortschritt wert={p.gemeinde} ziel={p.zielGemeinde} art="gemeinde" einheit="Gemeinde-Punkten" />
          : <span className="web-gedaempft" title="Für diesen Jahrgang abgeschaltet">–</span>;
      },
    },
    {
      schluessel: 'punkte',
      kopf: 'Gesamt',
      sortierbar: true,
      breite: '148px',
      zelle: (k) => {
        const p = konfiPunkte(k);
        return <WebFortschritt wert={p.gesamt} ziel={p.zielGesamt} art="gesamt" erreicht={p.erreicht} prozent={p.prozentGesamt} einheit="Punkten gesamt" />;
      },
    },
    {
      schluessel: 'badges',
      kopf: 'Badges',
      sortierbar: true,
      zahl: true,
      breite: '92px',
      optional: true,
      zelle: (k) => (
        <span className="web-zahl-mit-symbol" title={`${k.badgeCount || 0} Badges`}>
          <IonIcon icon={ICON_ABZEICHEN} className="web-zahl-mit-symbol__symbol" aria-hidden="true" />
          {k.badgeCount || 0}
        </span>
      ),
    },
    ...(mitAktivitaet ? [{
      schluessel: 'aktivitaet',
      kopf: 'Letzte Aktivität',
      breite: '128px',
      optional: true,
      zelle: (k: KonfiListenEintrag) => (k.letzte_aktivitaet ? datumKurz(k.letzte_aktivitaet) : <span className="web-gedaempft">–</span>),
    }] : []),
    ...(mitAktionen ? [{
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (k: KonfiListenEintrag) => (
        <div className="web-zeilenaktionen">
          {onPunkte && (
            <WebKnopf klein vorn onClick={() => onPunkte(k)} aria-label={`Punkte an ${k.name} vergeben`}>
              <IonIcon icon={ICON_BONUS} aria-hidden="true" />
              <span className="web-knopf__text">Punkte</span>
            </WebKnopf>
          )}
          {onLoeschen && (
            <WebKnopf klein vorn art="gefahr" symbol onClick={() => onLoeschen(k)} aria-label={`${k.name} löschen`} title="Konfi löschen">
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <WebSortTabelle
      beschriftung="Konfis"
      spalten={spalten}
      zeilen={konfis}
      zeileSchluessel={(k) => k.id}
      mittig
      sortierung={sortierung}
      onSortieren={onSortieren}
    />
  );
};

export default WebKonfiTabelle;
