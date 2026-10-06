// Die Angaben zu einem Material in der Web-Fassung: Beschreibung, Details, Links
// und Dateien, jeweils als Karte. Eine Stelle fuer die Seite des Teams
// (zweispaltig: links Beschreibung und Dateien, rechts Details und Links) und
// fuer das Fenster der Details, das Events und der Kalender oeffnen (eine
// Spalte untereinander).
//
// Was beim Antippen passiert, kommt von der Seite: Dateien laufen ueber den
// gemeinsamen Weg von Chat und Challenges (Medien-Cache, Fortschritt, Betrachter),
// Links ueber die Pruefung auf http/https und die anonyme Messung der Seite. Die
// Links sind echte Links (neuer Tab per Mittelklick, Adresse sichtbar).

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_DATEI, ICON_LINK } from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { hostAus, materialLinks } from '../../../../utils/linkDisplay';
import { ladeText } from '../../../../utils/fortschritt';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebKarte from '../../../web/WebKarte';
import WebAngaben, { type WebAngabe } from '../../../web/WebAngaben';
import WebSpalten from '../../../web/WebSpalten';
import { WebLeer } from '../../../web/WebZustaende';
import { WebExternLink, WebExternSymbol } from '../../../admin/web/leitung/WebLeitungBausteine';
import { dateiGroesse, dateiSymbol } from './materialAnzeige';
import type { LadendeDatei, MaterialDatei, MaterialDetailDaten } from './materialTypen';

export interface WebMaterialInhaltProps {
  material: MaterialDetailDaten;
  ladendeDatei?: LadendeDatei | null;
  onDatei: (datei: MaterialDatei) => void;
  onLink: (url: string) => void;
  /** Ueberschriften der Karten als h2 (Vorgabe) oder h3 unter einer eigenen h2. */
  ebene?: 2 | 3;
  /** Eine Spalte untereinander (Vorgabe, fuers Fenster) oder zwei Spalten (die Seite). */
  spalten?: boolean;
}

const WebMaterialInhalt: React.FC<WebMaterialInhaltProps> = ({ material, ladendeDatei, onDatei, onLink, ebene = 2, spalten = false }) => {
  const links = materialLinks(material);
  const dateien = material.files ?? [];
  const events = material.events ?? [];
  const jahrgaenge = material.jahrgaenge ?? [];

  const angaben: WebAngabe[] = [
    ...(material.ist_global ? [{ label: 'Sichtbar für', wert: 'Das ganze Team der Gemeinde' }] : []),
    ...(events.length > 0 ? [{ label: events.length === 1 ? 'Event' : 'Events', wert: events.map((e) => e.name).join(', ') }] : []),
    ...(jahrgaenge.length > 0 ? [{ label: jahrgaenge.length === 1 ? 'Jahrgang' : 'Jahrgänge', wert: jahrgaenge.map((j) => j.name).join(', ') }] : []),
    { label: 'Erstellt am', wert: datumKurz(material.created_at) },
    ...(material.admin_name ? [{ label: 'Erstellt von', wert: material.admin_name }] : []),
  ];

  const beschreibung = material.description ? (
    <WebKarte titel="Beschreibung" ebene={ebene}>
      <p className="web-beschreibung">{material.description}</p>
    </WebKarte>
  ) : null;

  const details = (
    <WebKarte titel="Details" ebene={ebene}>
      <WebAngaben angaben={angaben} beschriftung="Details zum Material" />
    </WebKarte>
  );

  const linkKarte = links.length > 0 ? (
        <WebKarte titel={links.length === 1 ? 'Link' : 'Links'} ebene={ebene}>
          <ul className="web-material-liste">
            {links.map((url) => (
              <li key={url}>
                <WebExternLink href={url} className="web-material-eintrag" onOeffnen={onLink}>
                  <span className="web-symbol web-symbol--material" aria-hidden="true"><IonIcon icon={ICON_LINK} /></span>
                  <span className="web-material-eintrag__text">
                    <span className="web-zelle-titel web-einzeilig">{hostAus(url)}</span>
                    <span className="web-zelle-leise">Im Browser öffnen</span>
                  </span>
                  <WebExternSymbol />
                </WebExternLink>
              </li>
            ))}
          </ul>
        </WebKarte>
  ) : null;

  const dateiKarte = (
      <WebKarte titel="Dateien" untertitel={mitEinheit(dateien.length, 'Datei', 'Dateien')} ebene={ebene}>
        {dateien.length === 0 ? (
          <WebLeer icon={ICON_DATEI} titel="Keine Dateien" text="Dieses Material hat keine angehängten Dateien." />
        ) : (
          <ul className="web-material-liste">
            {dateien.map((d) => {
              const laedt = ladendeDatei?.pfad === d.stored_name;
              return (
                <li key={d.id}>
                  <button type="button" className="web-material-eintrag" onClick={() => onDatei(d)}>
                    <span className="web-symbol web-symbol--material" aria-hidden="true"><IonIcon icon={dateiSymbol(d.mime_type)} /></span>
                    <span className="web-material-eintrag__text">
                      <span className="web-zelle-titel web-einzeilig">{d.original_name}</span>
                      <span className="web-zelle-leise" aria-live={laedt ? 'polite' : undefined}>
                        {laedt ? ladeText(ladendeDatei?.prozent) : dateiGroesse(d.file_size)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </WebKarte>
  );

  if (spalten) {
    return (
      <WebSpalten
        haupt={<>{beschreibung}{dateiKarte}</>}
        seite={<>{details}{linkKarte}</>}
        seiteBeschriftung="Details und Links"
      />
    );
  }
  return <>{beschreibung}{details}{linkKarte}{dateiKarte}</>;
};

export default WebMaterialInhalt;
