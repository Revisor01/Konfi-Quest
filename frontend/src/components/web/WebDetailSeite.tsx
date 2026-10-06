// Das eine Geruest JEDER Detailseite der Web-Fassung -- Event und Challenge,
// fuer Leitung, Team und Konfis (Simon, 06.10.2026: „die sollten gleich
// strukturiert sein"; Aufbau „Inhalt links, Angaben rechts"):
//
//   Zurueck-Link
//   Titel                                   Aktionen (alle als Knoepfe)
//   Kennzeichen (Status, Zeit)
//   [Hinweis, z. B. abgesagt]
//   [Kennzahl] [Kennzahl] [Kennzahl] ...
//   Hauptinhalt, breit               |  Angaben, schmal
//   (Teilnehmende, Beitraege)        |  (und was dazugehoert: Stempel)
//
// Die Seiten reichen nur Inhalte herein; wo etwas steht, entscheidet allein
// dieses Geruest. Keine eigene Aktionen-Karte, keine gespiegelten Spalten.

import React from 'react';
import WebSeite from './WebSeite';
import WebSpalten from './WebSpalten';
import WebKachel, { type WebKachelProps } from './WebKachel';

export interface WebDetailSeiteProps {
  /** Name des Bereichs in der Kopfzeile ("Mitmachen", "Challenges"). */
  bereich: string;
  /** Der Weg zurueck zur Liste ("Alle Events"). */
  zurueck: { href: string; text: string };
  titel: string;
  /** Unter dem Titel: Status-Pills und Zeitangabe -- nur Inline-Inhalt. */
  kennzeichen?: React.ReactNode;
  /** Alle Aktionen der Seite als Knoepfe oben rechts; die wichtigste mit art="primaer". */
  aktionen?: React.ReactNode;
  /** Ein Hinweis ueber den Kennzahlen (abgesagt, offline). */
  hinweis?: React.ReactNode;
  /** Die Kennzahl-Kacheln unter dem Kopf, ueber beide Spalten. */
  kennzahlen?: ReadonlyArray<WebKachelProps>;
  /** Links, breit: das Eigentliche der Seite. */
  haupt: React.ReactNode;
  /** Rechts, schmal: die Angaben und was zu ihnen gehoert. */
  seite: React.ReactNode;
  /** Name der schmalen Spalte fuer Vorleseprogramme (Vorgabe "Angaben"). */
  seiteBeschriftung?: string;
  /** Fuer Modale, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
}

const WebDetailSeite: React.FC<WebDetailSeiteProps> = ({
  bereich, zurueck, titel, kennzeichen, aktionen, hinweis, kennzahlen = [], haupt, seite,
  seiteBeschriftung = 'Angaben', pageRef,
}) => (
  <WebSeite bereich={bereich} titel={titel} untertitel={kennzeichen} aktionen={aktionen} zurueck={zurueck} pageRef={pageRef}>
    <div className="web-detail">
      {hinweis}
      {kennzahlen.length > 0 && (
        <div className="web-raster web-raster--kacheln web-detail__kennzahlen">
          {kennzahlen.map((k) => <WebKachel key={k.label} {...k} />)}
        </div>
      )}
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung={seiteBeschriftung} />
    </div>
  </WebSeite>
);

export default WebDetailSeite;
