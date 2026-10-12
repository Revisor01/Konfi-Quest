// Der Rumpf JEDER Detailseite der Web-Fassung (11.10.2026, herausgelöst aus
// WebDetailSeite; docs/planung/support-detailseiten.md, „Rahmen und Maße"):
//
//   [Hinweis, z. B. abgesagt oder der Stand eines Vorgangs]
//   [Kennzahl] [Kennzahl] [Kennzahl] ...
//   Hauptinhalt, breit               |  Angaben (Karte), schmal
//                                    |  und was dazugehoert
//
// WebDetailSeite setzt ihn unter ihren Kopf; der Lesebereich des Supports
// (web/WebVorgangDetail, neben der Liste) setzt ihn unter seinen eigenen Kopf
// (WebLesen) -- derselbe Code rendert den Rumpf aller Detailseiten. Eine
// zweite WebDetailSeite im Lesebereich ginge nicht: Sie bringt eine eigene
// IonPage mit, und eine zweite IonPage neben der Liste ergäbe die bekannte
// weiße Seite (webDetailSeiteEinGeruest).
//
// Ob eine oder zwei Spalten, entscheidet WebSpalten nach der Breite des
// nächsten Containers: auf einer Detailseite .web-seite, im Lesebereich
// .web-postfach__lesen (theme/web/support.css).

import React from 'react';
import WebSpalten from './WebSpalten';
import WebKachel, { type WebKachelProps } from './WebKachel';
import WebKarte from './WebKarte';
import WebAngaben, { type WebAngabe } from './WebAngaben';

export interface WebDetailRumpfProps {
  /** Ein Hinweis über den Kennzahlen (abgesagt, offline, der Stand eines Vorgangs). */
  hinweis?: React.ReactNode;
  /** Die Kennzahl-Kacheln unter dem Hinweis, über beide Spalten. */
  kennzahlen?: ReadonlyArray<WebKachelProps>;
  /** Links, breit: das Eigentliche der Seite. */
  haupt?: React.ReactNode;
  /** Die Karte "Angaben", oben in der schmalen Spalte. */
  angaben?: ReadonlyArray<WebAngabe>;
  /** Name der Angaben-Liste für Vorleseprogramme ("Angaben zum Event"). */
  angabenBeschriftung?: string;
  /** In der Angaben-Karte vor der Liste (z. B. ein Offline-Hinweis). */
  angabenVorspann?: React.ReactNode;
  /** Rechts, schmal, unter den Angaben: was zu ihnen gehört. */
  seite?: React.ReactNode;
  /** Name der schmalen Spalte für Vorleseprogramme (Vorgabe "Angaben"). */
  seiteBeschriftung?: string;
}

const WebDetailRumpf: React.FC<WebDetailRumpfProps> = ({
  hinweis, kennzahlen = [], haupt, angaben, angabenBeschriftung, angabenVorspann, seite, seiteBeschriftung = 'Angaben',
}) => {
  const angabenKarte = angaben ? (
    <WebKarte titel="Angaben">
      {angabenVorspann}
      <WebAngaben angaben={angaben} beschriftung={angabenBeschriftung} />
    </WebKarte>
  ) : null;
  return (
    <div className="web-detail">
      {hinweis}
      {kennzahlen.length > 0 && (
        <div className="web-raster web-raster--kacheln web-detail__kennzahlen">
          {kennzahlen.map((k) => <WebKachel key={k.label} {...k} />)}
        </div>
      )}
      <WebSpalten haupt={haupt ?? null} seite={<>{angabenKarte}{seite}</>} seiteBeschriftung={seiteBeschriftung} />
    </div>
  );
};

export default WebDetailRumpf;
