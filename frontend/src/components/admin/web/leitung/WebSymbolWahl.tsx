// Ein Icon aus dem gemeinsamen Vorrat waehlen (utils/badgeIcons), in den
// Dialogen der Web-Fassung fuer Level und Zertifikate (11.10.2026). Die App
// zeigt dafuer ein Akkordeon mit allen 95 Icons untereinander; hier oben das
// gewaehlte Icon mit Namen, darunter die Kategorien als Chips und die Icons
// der gewaehlten Kategorie als Raster -- so bleibt der Dialog kurz.
//
// Ein <fieldset> mit <legend>; jedes Icon ist ein Knopf mit seinem Namen
// (aria-pressed zeigt das gewaehlte). Das gewaehlte Icon steht in der Farbe,
// die der Aufrufer mitgibt (Farbe des Levels, Farbe des Teams).

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHOICES, getIconFromString, type IconChoice } from '../../../../utils/badgeIcons';
import WebChips from '../../../web/WebChips';
import WebKreis, { type WebKreisSymbolTon } from '../../../web/WebKreis';

interface IconGruppe {
  kategorie: string;
  icons: Array<{ schluessel: string; daten: IconChoice }>;
}

/** Die Icons nach Kategorie, in der Reihenfolge des Vorrats. */
const GRUPPEN: IconGruppe[] = Object.entries(ICON_CHOICES).reduce((gruppen: IconGruppe[], [schluessel, daten]) => {
  const gruppe = gruppen.find((g) => g.kategorie === daten.category);
  if (gruppe) gruppe.icons.push({ schluessel, daten });
  else gruppen.push({ kategorie: daten.category, icons: [{ schluessel, daten }] });
  return gruppen;
}, []);

export interface WebSymbolWahlProps {
  label: string;
  /** Schluessel des gewaehlten Icons (wie gespeichert, z. B. "trophy"). */
  wert: string;
  onWert: (schluessel: string) => void;
  /** Farbe des gewaehlten Icons als CSS-Wert. */
  farbe: string;
  /** Ton des Kreises vor dem Namen, wenn keine eigene Farbe gilt. */
  ton: WebKreisSymbolTon;
  /** Zeichen, wenn der gespeicherte Name nicht im Vorrat steht. */
  rueckfall?: string;
  pflicht?: boolean;
  deaktiviert?: boolean;
}

const WebSymbolWahl: React.FC<WebSymbolWahlProps> = ({ label, wert, onWert, farbe, ton, rueckfall, pflicht = false, deaktiviert = false }) => {
  const gewaehlt: IconChoice | undefined = ICON_CHOICES[wert];
  const [kategorie, setKategorie] = useState(gewaehlt?.category ?? GRUPPEN[0].kategorie);
  const gruppe = GRUPPEN.find((g) => g.kategorie === kategorie) ?? GRUPPEN[0];

  return (
    <fieldset
      className="web-wahl web-symbolwahl"
      disabled={deaktiviert}
      style={{ '--web-symbolwahl-farbe': farbe } as React.CSSProperties}
    >
      <legend className={pflicht ? 'web-feld__label web-feld__label--pflicht web-wahl__legende' : 'web-feld__label web-wahl__legende'}>{label}</legend>
      <p className="web-symbolwahl__gewaehlt">
        <WebKreis icon={getIconFromString(wert, rueckfall)} ton={ton} farbe={farbe} />
        <span>{gewaehlt ? `${gewaehlt.name} (${gewaehlt.category})` : 'Ein Icon außerhalb der Auswahl'}</span>
      </p>
      <WebChips
        beschriftung={`${label}: Kategorie`}
        chips={GRUPPEN.map((g) => ({ wert: g.kategorie, label: g.kategorie }))}
        wert={gruppe.kategorie}
        onWert={setKategorie}
      />
      <div className="web-symbolwahl__raster" role="group" aria-label={`${label}: ${gruppe.kategorie}`}>
        {gruppe.icons.map(({ schluessel, daten }) => (
          <button
            key={schluessel}
            type="button"
            className="web-symbolwahl__knopf"
            aria-pressed={wert === schluessel}
            aria-label={daten.name}
            title={daten.name}
            onClick={() => onWert(schluessel)}
          >
            <IonIcon icon={daten.icon} aria-hidden="true" />
          </button>
        ))}
      </div>
    </fieldset>
  );
};

export default WebSymbolWahl;
