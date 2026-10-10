// Zertifikate fuers Team in der Web-Fassung, /admin/settings/certificates
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6):
// Kacheln mit Symbol und Name oder dieselben Zertifikate als Liste. Ein
// Zertifikat hat nur Namen und Symbol -- deshalb beginnt die Seite mit den
// Kacheln.
//
// Rahmen, Umschalter Liste | Kacheln und Zustaende stellt WebListenSeite
// (10.10.2026); hier stehen nur Spalten, Karte und Daten.
//
// Daten, Rechte und Fenster kommen von der Seite (AdminCertificatesPage): Das
// Formular ist dasselbe Fenster wie in der App (CertificateModal), das
// Loeschen fragt dieselbe Rueckfrage. Anlegen, Bearbeiten und Loeschen nur fuer
// Gemeindeleitung und Leitung.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN_GEFUELLT, ICON_HINZUFUEGEN } from '../../../shared/icons';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebAktion, type WebSpalte } from '../../../web/WebListe';
import type { ZertifikatTyp } from './verwaltungTypen';

export interface WebZertifikateProps {
  zertifikate: readonly ZertifikatTyp[];
  laedt: boolean;
  /** Anlegen, Bearbeiten und Loeschen: Gemeindeleitung und Leitung. */
  darfVerwalten: boolean;
  pageRef?: React.Ref<HTMLElement>;
  onAnlegen: () => void;
  onBearbeiten: (zertifikat: ZertifikatTyp) => void;
  onLoeschen: (zertifikat: ZertifikatTyp) => void;
}

const ZURUECK = { href: '/admin/settings', text: 'Mehr' };

const symbolVon = (z: ZertifikatTyp): string => getIconFromString(z.icon, ICON_ABZEICHEN_GEFUELLT);

const WebZertifikate: React.FC<WebZertifikateProps> = ({ zertifikate, laedt, darfVerwalten, pageRef, onAnlegen, onBearbeiten, onLoeschen }) => {
  const bearbeiten: WebAktion<ZertifikatTyp> | undefined = darfVerwalten
    ? { onKlick: onBearbeiten, beschriftung: (z) => `${z.name} bearbeiten`, titel: () => 'Bearbeiten' }
    : undefined;
  const loeschen: WebAktion<ZertifikatTyp> | undefined = darfVerwalten
    ? { onKlick: onLoeschen, beschriftung: (z) => `${z.name} löschen`, titel: () => 'Zertifikat löschen' }
    : undefined;

  const spalten: Array<WebSpalte<ZertifikatTyp>> = [
    {
      schluessel: 'name',
      kopf: 'Zertifikat',
      sortWert: (z) => z.name,
      zelle: (z) => (
        <WebNameZelle
          kreis={<WebKreis icon={symbolVon(z)} ton="teamer" />}
          titel={z.name}
          onKlick={darfVerwalten ? () => onBearbeiten(z) : undefined}
          beschriftung={`${z.name} bearbeiten`}
        />
      ),
    },
  ];

  return (
    <WebListenSeite<ZertifikatTyp>
      bereich="Verwaltung"
      titel="Zertifikate"
      untertitel={laedt ? undefined : `Zertifikate fürs Team · ${mitEinheit(zertifikate.length, 'Zertifikat', 'Zertifikate')}`}
      aktionen={!laedt && darfVerwalten ? (
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Zertifikat
        </WebKnopf>
      ) : undefined}
      zurueck={ZURUECK}
      pageRef={pageRef}
      laden={laedt ? { text: 'Die Zertifikate werden geladen.' } : undefined}
      ansicht={{ seite: 'zertifikate', vorgabe: 'kacheln' }}
      eintraege={zertifikate}
      liste={{ beschriftung: 'Zertifikate', spalten, zeileSchluessel: (z) => z.id, mittig: true, bearbeiten, loeschen }}
      kacheln={{
        beschriftung: 'Zertifikate',
        schluessel: (z) => z.id,
        bearbeiten,
        loeschen,
        karte: (z) => ({
          akzent: 'var(--app-color-teamer)',
          akzentDunkel: 'var(--app-color-teamer-dunkel)',
          symbol: <WebBildKarteSymbol icon={symbolVon(z)} />,
          label: 'Zertifikat',
          titelImKopf: true,
          titel: z.name,
          onTitel: darfVerwalten ? () => onBearbeiten(z) : undefined,
          titelBeschriftung: `${z.name} bearbeiten`,
        }),
      }}
      leer={{ icon: ICON_ABZEICHEN_GEFUELLT, titel: 'Keine Zertifikate', text: 'Noch keine Zertifikate angelegt.' }}
    />
  );
};

export default WebZertifikate;
