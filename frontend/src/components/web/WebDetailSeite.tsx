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
// Begleitsaetze zu den Aktionen (Abmeldefrist, "Ohne Netz nicht moeglich", wer
// den Beitrag sieht) stehen als `hinweis` ueber den Kennzahlen.

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
  haupt?: React.ReactNode;
  /** Rechts, schmal: die Angaben und was zu ihnen gehoert. */
  seite?: React.ReactNode;
  /**
   * Statt Kennzahlen und Spalten: Laden, Fehler oder ein Hinweis
   * (nicht zugeordnet). Jede Detailseite gibt in ALLEN Zustaenden dieses
   * Geruest zurueck, nie zwischendurch WebSeite: Ein anderer Baustein an
   * der Wurzel laesst React die IonPage neu bauen, und die neue bleibt
   * nach dem schon gelaufenen Seitenuebergang unsichtbar
   * (ion-page-invisible) -- weisse Seite bis zum zweiten Klick (Simon,
   * 07.10.2026).
   */
  zustand?: React.ReactNode;
  /** Name der schmalen Spalte fuer Vorleseprogramme (Vorgabe "Angaben"). */
  seiteBeschriftung?: string;
  /** Fuer Modale, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
}

/** Alles unter dem Kopf: Hinweis, Kennzahlen, links der Hauptinhalt, rechts die Angaben. */
export type WebDetailInhaltProps = Pick<WebDetailSeiteProps, 'hinweis' | 'kennzahlen' | 'seiteBeschriftung'>
  & Required<Pick<WebDetailSeiteProps, 'haupt' | 'seite'>>;

/**
 * Der Inhalt der Detailseite ohne eigenen Rahmen. Die Seiten einer Challenge
 * halten EINE IonPage fuer alle Zustaende (laedt, Hinweis, Challenge) und
 * setzen ihren Kopf deshalb in WebChallengeRahmen; ein Tausch der Seite
 * beim Laden brachte Ionic zum Absturz (TypeError in readDimensions). Sie
 * nehmen den Inhalt von hier, damit unter dem Kopf trotzdem dasselbe steht
 * wie auf jeder anderen Detailseite.
 */
export const WebDetailInhalt: React.FC<WebDetailInhaltProps> = ({
  hinweis, kennzahlen = [], haupt, seite, seiteBeschriftung = 'Angaben',
}) => (
  <div className="web-detail">
    {hinweis}
    {kennzahlen.length > 0 && (
      <div className="web-raster web-raster--kacheln web-detail__kennzahlen">
        {kennzahlen.map((k) => <WebKachel key={k.label} {...k} />)}
      </div>
    )}
    <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung={seiteBeschriftung} />
  </div>
);

const WebDetailSeite: React.FC<WebDetailSeiteProps> = ({
  bereich, zurueck, titel, kennzeichen, aktionen, hinweis, kennzahlen, haupt, seite, seiteBeschriftung, zustand, pageRef,
}) => (
  <WebSeite bereich={bereich} titel={titel} untertitel={kennzeichen} aktionen={aktionen} zurueck={zurueck} pageRef={pageRef}>
    {zustand !== undefined
      ? zustand
      : <WebDetailInhalt hinweis={hinweis} kennzahlen={kennzahlen} haupt={haupt ?? null} seite={seite ?? null} seiteBeschriftung={seiteBeschriftung} />}
  </WebSeite>
);

export default WebDetailSeite;
