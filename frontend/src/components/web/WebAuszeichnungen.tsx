// Badges und Stempel sehen in der Web-Fassung ueberall gleich aus (Simon,
// 07.10.2026: „badge und stempel sollten gleich aussehen", „unter challenges
// muss stempel genau wie in der konfi ansicht aussehen"): ein Raster aus
// Kreis und Name -- auf der Seite einer Person und in den Challenges. Der Kreis ist der der
// Badge-Seite der Konfis (WebBadgeSymbol) -- erreicht in der Farbe des
// Badges bzw. in der Challenge-Farbe, offen gestrichelt und gedaempft.
// Beim Darueberfahren und beim Fokus zeigt jeder Eintrag seine Info; der
// Inhalt ist derselbe wie im Popover der App.

import React from 'react';
import WebBadgeSymbol from '../konfi/web/WebBadgeSymbol';
import WebInfoTipp from './WebInfoTipp';

export interface WebAuszeichnung {
  schluessel: string;
  name: string;
  /** Das aufgeloeste Symbol (getIconFromString). */
  icon: string;
  /** Farbe des Kreises: Datenwert des Badges oder ein Token. */
  farbe: string;
  erreicht: boolean;
  info: React.ReactNode;
  /** Ein Klick fuehrt hierhin (ein Stempel zu seiner Challenge). */
  href?: string;
}

const WebAuszeichnungen: React.FC<{ eintraege: readonly WebAuszeichnung[]; beschriftung: string }> = ({ eintraege, beschriftung }) => (
  <ul className="web-auszeichnungen" aria-label={beschriftung}>
    {eintraege.map((e) => (
      <li key={e.schluessel} className={`web-auszeichnung${e.erreicht ? '' : ' web-auszeichnung--offen'}`}>
        <WebInfoTipp info={e.info} klasse="web-auszeichnung__knopf" href={e.href}>
          <WebBadgeSymbol icon={e.icon} farbe={e.farbe} erreicht={e.erreicht} />
          <span className="web-auszeichnung__name">{e.name}</span>
        </WebInfoTipp>
      </li>
    ))}
  </ul>
);

export default WebAuszeichnungen;
