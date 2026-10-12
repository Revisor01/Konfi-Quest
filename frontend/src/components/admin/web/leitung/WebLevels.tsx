// Level der Gemeinde in der Web-Fassung, /admin/settings/levels (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): Liste mit
// Symbol in der Farbe des Levels, Titel, Beschreibung und den noetigen
// Punkten -- oder dieselben Level als Kacheln.
//
// Rahmen, Umschalter Liste | Kacheln und Zustaende stellt WebListenSeite
// (10.10.2026); hier stehen nur Spalten, Karte und Daten.
//
// Daten und Fenster kommen von der Seite (AdminLevelsPage): Das Formular ist
// ein eigener Dialog (WebLevelDialog, 11.10.2026) mit der Logik des
// App-Modals (useLevelFormular), das Loeschen fragt dieselbe Rueckfrage. Wie dort darf jede Leitung anlegen, bearbeiten und
// loeschen -- der Server haelt die Rechte.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_POKAL_GEFUELLT } from '../../../shared/icons';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebAktion, type WebSpalte } from '../../../web/WebListe';
import type { LevelEintrag } from './verwaltungTypen';

export interface WebLevelsProps {
  levels: readonly LevelEintrag[];
  laedt: boolean;
  pageRef?: React.Ref<HTMLElement>;
  onAnlegen: () => void;
  onBearbeiten: (level: LevelEintrag) => void;
  onLoeschen: (level: LevelEintrag) => void;
}

const ZURUECK = { href: '/admin/settings', text: 'Mehr' };

const symbolVon = (l: LevelEintrag): string => getIconFromString(l.icon || 'trophy');

const WebLevels: React.FC<WebLevelsProps> = ({ levels, laedt, pageRef, onAnlegen, onBearbeiten, onLoeschen }) => {
  const bearbeiten: WebAktion<LevelEintrag> = { onKlick: onBearbeiten, beschriftung: (l) => `${l.title} bearbeiten`, titel: () => 'Bearbeiten' };
  const loeschen: WebAktion<LevelEintrag> = { onKlick: onLoeschen, beschriftung: (l) => `${l.title} löschen`, titel: () => 'Level löschen' };

  const spalten: Array<WebSpalte<LevelEintrag>> = [
    {
      schluessel: 'level',
      kopf: 'Level',
      breite: '30%',
      sortWert: (l) => l.title,
      zelle: (l) => (
        <WebNameZelle
          kreis={<WebKreis icon={symbolVon(l)} ton="level" farbe={l.color || undefined} />}
          titel={l.title}
          onKlick={() => onBearbeiten(l)}
          beschriftung={`${l.title} bearbeiten`}
        />
      ),
    },
    {
      schluessel: 'beschreibung',
      kopf: 'Beschreibung',
      sortWert: (l) => l.description,
      zelle: (l) => (l.description
        ? <span className="web-zelle-leise">{l.description}</span>
        : <span className="web-gedaempft">Keine Beschreibung</span>),
    },
    {
      schluessel: 'punkte',
      kopf: 'Ab Punkten',
      zahl: true,
      breite: '120px',
      sortWert: (l) => l.points_required,
      zelle: (l) => <span className="web-zelle-titel">{l.points_required}</span>,
    },
  ];

  return (
    <WebListenSeite<LevelEintrag>
      bereich="Verwaltung"
      titel="Level"
      untertitel={laedt ? undefined : `Punkte-Level und Belohnungen · ${mitEinheit(levels.length, 'Level', 'Level')}`}
      aktionen={laedt ? undefined : (
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Level
        </WebKnopf>
      )}
      zurueck={ZURUECK}
      pageRef={pageRef}
      laden={laedt ? { text: 'Die Level werden geladen.' } : undefined}
      ansicht={{ seite: 'levels', vorgabe: 'liste' }}
      eintraege={levels}
      liste={{ beschriftung: 'Level', spalten, zeileSchluessel: (l) => l.id, mittig: true, bearbeiten, loeschen }}
      kacheln={{
        beschriftung: 'Level',
        schluessel: (l) => l.id,
        bearbeiten,
        loeschen,
        karte: (l) => ({
          // Die Farbe des Levels aus den Daten; ohne sie die Bereichsfarbe.
          akzent: l.color || 'var(--app-color-level)',
          akzentDunkel: l.color || 'var(--app-color-level-dunkel)',
          symbol: <WebBildKarteSymbol icon={symbolVon(l)} />,
          label: `Ab ${l.points_required} ${l.points_required === 1 ? 'Punkt' : 'Punkten'}`,
          titelImKopf: true,
          titel: l.title,
          onTitel: () => onBearbeiten(l),
          titelBeschriftung: `${l.title} bearbeiten`,
          text: l.description || 'Keine Beschreibung',
        }),
      }}
      leer={{ icon: ICON_POKAL_GEFUELLT, titel: 'Keine Level gefunden', text: 'Noch keine Level angelegt.' }}
    />
  );
};

export default WebLevels;
