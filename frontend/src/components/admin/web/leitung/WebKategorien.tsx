// Kategorien der Gemeinde in der Web-Fassung, /admin/settings/categories
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6):
// Liste mit Name und Beschreibung oder Kacheln, Anlegen oben rechts,
// Bearbeiten und Loeschen in der Zeile bzw. im Fuss der Kachel.
//
// Rahmen, Umschalter Liste | Kacheln und Zustaende stellt WebListenSeite
// (10.10.2026); hier stehen nur Spalten, Karte und Daten.
//
// Daten, Rechte und Fenster kommen von der Seite (AdminCategoriesPage): Das
// Formular ist dasselbe Fenster wie in der App (CategoryModal), das Loeschen
// fragt dieselbe Rueckfrage.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_KATEGORIE, ICON_KATEGORIE_GEFUELLT } from '../../../shared/icons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebAktion, type WebSpalte } from '../../../web/WebListe';
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

const ZURUECK = { href: '/admin/settings', text: 'Mehr' };

const WebKategorien: React.FC<WebKategorienProps> = ({
  kategorien, laedt, darfAnlegen, darfBearbeiten, darfLoeschen, pageRef, onAnlegen, onBearbeiten, onLoeschen,
}) => {
  const bearbeiten: WebAktion<KategorieEintrag> | undefined = darfBearbeiten
    ? { onKlick: onBearbeiten, beschriftung: (k) => `${k.name} bearbeiten`, titel: () => 'Bearbeiten' }
    : undefined;
  const loeschen: WebAktion<KategorieEintrag> | undefined = darfLoeschen
    ? { onKlick: onLoeschen, beschriftung: (k) => `${k.name} löschen`, titel: () => 'Kategorie löschen' }
    : undefined;

  const spalten: Array<WebSpalte<KategorieEintrag>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      breite: '32%',
      sortWert: (k) => k.name,
      zelle: (k) => (
        <WebNameZelle
          kreis={<WebKreis icon={ICON_KATEGORIE_GEFUELLT} ton="categories" />}
          titel={k.name}
          onKlick={darfBearbeiten ? () => onBearbeiten(k) : undefined}
          beschriftung={`${k.name} bearbeiten`}
        />
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
  ];

  return (
    <WebListenSeite<KategorieEintrag>
      bereich="Verwaltung"
      titel="Kategorien"
      untertitel={laedt ? undefined : `Kategorien für Aktivitäten und Events · ${mitEinheit(kategorien.length, 'Kategorie', 'Kategorien')}`}
      aktionen={!laedt && darfAnlegen ? (
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neue Kategorie
        </WebKnopf>
      ) : undefined}
      zurueck={ZURUECK}
      pageRef={pageRef}
      laden={laedt ? { text: 'Die Kategorien werden geladen.' } : undefined}
      ansicht={{ seite: 'kategorien', vorgabe: 'liste' }}
      eintraege={kategorien}
      liste={{ beschriftung: 'Kategorien', spalten, zeileSchluessel: (k) => k.id, mittig: true, bearbeiten, loeschen }}
      kacheln={{
        beschriftung: 'Kategorien',
        schluessel: (k) => k.id,
        bearbeiten,
        loeschen,
        karte: (k) => ({
          akzent: 'var(--app-color-categories)',
          akzentDunkel: 'var(--app-color-categories-dunkel)',
          symbol: <WebBildKarteSymbol icon={ICON_KATEGORIE_GEFUELLT} />,
          label: 'Kategorie',
          titelImKopf: true,
          titel: k.name,
          onTitel: darfBearbeiten ? () => onBearbeiten(k) : undefined,
          titelBeschriftung: `${k.name} bearbeiten`,
          text: k.description || 'Keine Beschreibung',
        }),
      }}
      leer={{ icon: ICON_KATEGORIE, titel: 'Keine Kategorien gefunden', text: 'Noch keine Kategorien angelegt.' }}
    />
  );
};

export default WebKategorien;
