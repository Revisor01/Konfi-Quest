// Kategorien der Gemeinde in der Web-Fassung, /admin/settings/categories
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): eine
// Tabelle mit Name und Beschreibung, Anlegen oben rechts, Bearbeiten und
// Loeschen in der Zeile.
//
// Daten, Rechte und Fenster kommen von der Seite (AdminCategoriesPage): Das
// Formular ist dasselbe Fenster wie in der App (CategoryModal), das Loeschen
// fragt dieselbe Rueckfrage.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_KATEGORIE, ICON_KATEGORIE_GEFUELLT } from '../../../shared/icons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebSymbol, WebZeilenAktionen, WebZeilenKnopf } from './WebLeitungBausteine';
import type { KategorieEintrag } from './verwaltungTypen';

export interface WebKategorienProps {
  kategorien: readonly KategorieEintrag[];
  laedt: boolean;
  darfAnlegen: boolean;
  darfBearbeiten: boolean;
  darfLoeschen: boolean;
  pageRef?: React.Ref<HTMLElement>;
  onAnlegen: () => void;
  onBearbeiten: (kategorie: KategorieEintrag) => void;
  onLoeschen: (kategorie: KategorieEintrag) => void;
}

const WebKategorien: React.FC<WebKategorienProps> = ({
  kategorien, laedt, darfAnlegen, darfBearbeiten, darfLoeschen, pageRef, onAnlegen, onBearbeiten, onLoeschen,
}) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Kategorien" zurueck={zurueck} pageRef={pageRef}>
        <WebLaden karten={1} text="Die Kategorien werden geladen." />
      </WebSeite>
    );
  }

  const aktionen = darfAnlegen ? (
    <WebKnopf art="primaer" onClick={onAnlegen}>
      <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
      Neue Kategorie
    </WebKnopf>
  ) : undefined;

  const spalten: Array<WebSpalte<KategorieEintrag>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      breite: '32%',
      sortWert: (k) => k.name,
      zelle: (k) => (
        <span className="web-person-zelle">
          <WebSymbol icon={ICON_KATEGORIE_GEFUELLT} ton="categories" />
          {darfBearbeiten
            ? <WebZeilenKnopf onClick={() => onBearbeiten(k)} aria-label={`${k.name} bearbeiten`}>{k.name}</WebZeilenKnopf>
            : <span className="web-zelle-titel web-einzeilig">{k.name}</span>}
        </span>
      ),
    },
    {
      schluessel: 'beschreibung',
      kopf: 'Beschreibung',
      sortWert: (k) => k.description,
      zelle: (k) => (k.description
        ? <span className="web-zelle-leise">{k.description}</span>
        : <span className="web-gedaempft">Keine Beschreibung</span>),
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (k) => (
        <WebZeilenAktionen
          name={k.name}
          onBearbeiten={darfBearbeiten ? () => onBearbeiten(k) : undefined}
          onLoeschen={darfLoeschen ? () => onLoeschen(k) : undefined}
          loeschenTitel="Kategorie löschen"
        />
      ),
    },
  ];

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Kategorien"
      untertitel="Kategorien für Aktivitäten und Events"
      aktionen={aktionen}
      zurueck={zurueck}
      pageRef={pageRef}
    >
      <WebKarte titel="Kategorien" untertitel={mitEinheit(kategorien.length, 'Kategorie', 'Kategorien')} bund={kategorien.length > 0}>
        {kategorien.length === 0 ? (
          <WebLeer
            icon={ICON_KATEGORIE}
            titel="Keine Kategorien gefunden"
            text="Noch keine Kategorien angelegt."
          />
        ) : (
          <WebTabelle
            beschriftung="Kategorien"
            spalten={spalten}
            zeilen={kategorien}
            zeileSchluessel={(k) => k.id}
            mittig
          />
        )}
      </WebKarte>
    </WebSeite>
  );
};

export default WebKategorien;
