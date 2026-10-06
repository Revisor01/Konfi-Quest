// Level der Gemeinde in der Web-Fassung, /admin/settings/levels (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): eine Tabelle mit
// Symbol in der Farbe des Levels, Titel, Beschreibung und den noetigen Punkten.
//
// Daten und Fenster kommen von der Seite (AdminLevelsPage): Das Formular ist
// dasselbe Fenster wie in der App (LevelManagementModal), das Loeschen fragt
// dieselbe Rueckfrage. Wie dort darf jede Leitung anlegen, bearbeiten und
// loeschen -- der Server haelt die Rechte.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_POKAL_GEFUELLT } from '../../../shared/icons';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebSymbol, WebZeilenAktionen, WebZeilenKnopf } from './WebLeitungBausteine';
import type { LevelEintrag } from './verwaltungTypen';

export interface WebLevelsProps {
  levels: readonly LevelEintrag[];
  laedt: boolean;
  pageRef?: React.Ref<HTMLElement>;
  onAnlegen: () => void;
  onBearbeiten: (level: LevelEintrag) => void;
  onLoeschen: (level: LevelEintrag) => void;
}

const WebLevels: React.FC<WebLevelsProps> = ({ levels, laedt, pageRef, onAnlegen, onBearbeiten, onLoeschen }) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Level" zurueck={zurueck} pageRef={pageRef}>
        <WebLaden karten={1} text="Die Level werden geladen." />
      </WebSeite>
    );
  }

  const spalten: Array<WebSpalte<LevelEintrag>> = [
    {
      schluessel: 'level',
      kopf: 'Level',
      breite: '30%',
      zelle: (l) => (
        <span className="web-person-zelle">
          <WebSymbol icon={getIconFromString(l.icon || 'trophy')} ton="level" farbe={l.color || undefined} />
          <WebZeilenKnopf onClick={() => onBearbeiten(l)} aria-label={`${l.title} bearbeiten`}>{l.title}</WebZeilenKnopf>
        </span>
      ),
    },
    {
      schluessel: 'beschreibung',
      kopf: 'Beschreibung',
      zelle: (l) => (l.description
        ? <span className="web-zelle-leise">{l.description}</span>
        : <span className="web-gedaempft">Keine Beschreibung</span>),
    },
    {
      schluessel: 'punkte',
      kopf: 'Ab Punkten',
      zahl: true,
      breite: '120px',
      zelle: (l) => <span className="web-zelle-titel">{l.points_required}</span>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (l) => (
        <WebZeilenAktionen
          name={l.title}
          onBearbeiten={() => onBearbeiten(l)}
          onLoeschen={() => onLoeschen(l)}
          loeschenTitel="Level löschen"
        />
      ),
    },
  ];

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Level"
      untertitel="Punkte-Level und Belohnungen"
      aktionen={(
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Level
        </WebKnopf>
      )}
      zurueck={zurueck}
      pageRef={pageRef}
    >
      <WebKarte titel="Level" untertitel={mitEinheit(levels.length, 'Level', 'Level')} bund={levels.length > 0}>
        {levels.length === 0 ? (
          <WebLeer icon={ICON_POKAL_GEFUELLT} titel="Keine Level gefunden" text="Noch keine Level angelegt." />
        ) : (
          <WebTabelle
            beschriftung="Level"
            spalten={spalten}
            zeilen={levels}
            zeileSchluessel={(l) => l.id}
            mittig
          />
        )}
      </WebKarte>
    </WebSeite>
  );
};

export default WebLevels;
