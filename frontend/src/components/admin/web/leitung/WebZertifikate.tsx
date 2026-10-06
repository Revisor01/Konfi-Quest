// Zertifikate fuers Team in der Web-Fassung, /admin/settings/certificates
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): ein
// Raster aus Kacheln, je eine mit Symbol, Name und den Aktionen. Ein Zertifikat
// hat nur Namen und Symbol -- eine Tabelle waere fast leer.
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
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebSymbol, WebZeilenAktionen } from './WebLeitungBausteine';
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

const WebZertifikate: React.FC<WebZertifikateProps> = ({ zertifikate, laedt, darfVerwalten, pageRef, onAnlegen, onBearbeiten, onLoeschen }) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Zertifikate" zurueck={zurueck} pageRef={pageRef}>
        <WebLaden karten={1} text="Die Zertifikate werden geladen." />
      </WebSeite>
    );
  }

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Zertifikate"
      untertitel="Zertifikate fürs Team"
      aktionen={darfVerwalten ? (
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Zertifikat
        </WebKnopf>
      ) : undefined}
      zurueck={zurueck}
      pageRef={pageRef}
    >
      <WebKarte titel="Zertifikate" untertitel={mitEinheit(zertifikate.length, 'Zertifikat', 'Zertifikate')}>
        {zertifikate.length === 0 ? (
          <WebLeer icon={ICON_ABZEICHEN_GEFUELLT} titel="Keine Zertifikate" text="Noch keine Zertifikate angelegt." />
        ) : (
          <ul className="web-kachelliste" aria-label="Zertifikate">
            {zertifikate.map((z) => (
              <li key={z.id} className="web-kachelliste__eintrag">
                <WebSymbol icon={getIconFromString(z.icon, ICON_ABZEICHEN_GEFUELLT)} ton="teamer" gross />
                <span className="web-kachelliste__name">{z.name}</span>
                {darfVerwalten && (
                  <WebZeilenAktionen
                    name={z.name}
                    onBearbeiten={() => onBearbeiten(z)}
                    onLoeschen={() => onLoeschen(z)}
                    loeschenTitel="Zertifikat löschen"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </WebKarte>
    </WebSeite>
  );
};

export default WebZertifikate;
