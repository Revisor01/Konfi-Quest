// Die Huelle JEDER Detailseite der Web-Fassung (06.10.2026, ausgebaut
// 10.10.2026; Simon: „web soll eine kachel-, liste-, details-logik haben für
// alle seiten ... ich will die arbeiten am web so einfach wie möglich
// machen"). Was WebListenSeite fuer Listen ist, ist sie fuer Detailseiten --
// Event, Challenge, Konfi, Support-Vorgang, Mail:
//
//   Zurueck-Link
//   [Kreis] Titel                           Aktionen (alle als Knoepfe)
//           Kennzeichen (Status, Zeit)
//   [Hinweis, z. B. abgesagt]
//   [Kennzahl] [Kennzahl] [Kennzahl] ...
//   Hauptinhalt, breit               |  Angaben (Karte), schmal
//   (Teilnehmende, Beitraege)        |  und was dazugehoert
//
// Die Seiten reichen nur Inhalte herein; wo etwas steht, entscheidet allein
// diese Huelle. Keine eigene Aktionen-Karte, keine gespiegelten Spalten.
// Begleitsaetze zu den Aktionen (Abmeldefrist, "Ohne Netz nicht moeglich")
// stehen als `hinweis` ueber den Kennzahlen.
//
// Zustaende: `laden`, `fehler` und `leer` (nicht gefunden, nicht zugeordnet)
// stehen statt Kennzahlen und Spalten -- unter demselben Kopf. Jede
// Detailseite gibt in ALLEN Zustaenden diese Huelle zurueck, nie
// zwischendurch WebSeite: Ein anderer Baustein an der Wurzel laesst React die
// IonPage neu bauen, und die neue bleibt nach dem schon gelaufenen
// Seitenuebergang unsichtbar (ion-page-invisible) -- weisse Seite bis zum
// zweiten Klick (Simon, 07.10.2026).
//
// Tabellen in Detailseiten laufen ueber WebDetailListe (unten): eine Karte mit
// Titel, Aktion, der Tabelle (WebListe), Leerzustand und "Alle anzeigen".

import React, { useState } from 'react';
import WebSeite from './WebSeite';
import WebSpalten from './WebSpalten';
import WebKachel, { type WebKachelProps } from './WebKachel';
import WebKarte from './WebKarte';
import WebKnopf from './WebKnopf';
import WebAngaben, { type WebAngabe } from './WebAngaben';
import WebListe, { type WebListeProps, type WebSortierung } from './WebListe';
import { WebFehler, WebLaden, WebLeer, type WebLeerProps } from './WebZustaende';
import { naechsteSortierung, sortiereZeilen } from '../../utils/tabelleSortieren';

export interface WebDetailSeiteProps {
  /** Name des Bereichs in der Kopfzeile ("Mitmachen", "Challenges"). */
  bereich: string;
  /** Der Weg zurueck zur Liste ("Alle Events"). */
  zurueck: { href: string; text: string };
  titel: string;
  /** Kreis vor dem Titel (WebKreis, gross): derselbe wie in der Zeile der Liste. */
  kreis?: React.ReactNode;
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
  /** Die Karte "Angaben", oben in der schmalen Spalte. */
  angaben?: ReadonlyArray<WebAngabe>;
  /** Name der Angaben-Liste fuer Vorleseprogramme ("Angaben zum Event"). */
  angabenBeschriftung?: string;
  /** In der Angaben-Karte vor der Liste (z. B. ein Offline-Hinweis). */
  angabenVorspann?: React.ReactNode;
  /** Rechts, schmal, unter den Angaben: was zu ihnen gehoert. */
  seite?: React.ReactNode;
  /** Die Seite laedt: Platzhalter statt des Inhalts, mit diesem Satz fuer Vorleseprogramme. */
  laden?: string;
  /** Die Seite konnte nicht geladen werden. */
  fehler?: { text: string; onErneut: () => void };
  /** Statt des Inhalts: nicht gefunden, nicht zugeordnet -- in einer Karte, mit Aktion. */
  leer?: WebLeerProps;
  /** Ein eigener Zustand statt des Inhalts (geht vor laden, fehler und leer). */
  zustand?: React.ReactNode;
  /** Name der schmalen Spalte fuer Vorleseprogramme (Vorgabe "Angaben"). */
  seiteBeschriftung?: string;
  /** Fuer Modale, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
  /** Ohne eigene IonPage (Challenges halten EINE IonPage fuer alle Zustaende; WebSeite). */
  ohneIonPage?: boolean;
  /** Nach dem Inhalt: Fenster der Seite (Dialoge). */
  children?: React.ReactNode;
}

const WebDetailSeite: React.FC<WebDetailSeiteProps> = ({
  bereich, zurueck, titel, kreis, kennzeichen, aktionen, hinweis, kennzahlen = [], haupt, angaben, angabenBeschriftung,
  angabenVorspann, seite, laden, fehler, leer, zustand, seiteBeschriftung = 'Angaben', pageRef, ohneIonPage, children,
}) => {
  let inhalt: React.ReactNode;
  if (zustand !== undefined) {
    inhalt = zustand;
  } else if (laden !== undefined) {
    inhalt = <WebLaden karten={2} text={laden} />;
  } else if (fehler) {
    inhalt = <WebFehler text={fehler.text} onErneut={fehler.onErneut} />;
  } else if (leer) {
    inhalt = <div className="web-karte"><WebLeer {...leer} /></div>;
  } else {
    const angabenKarte = angaben ? (
      <WebKarte titel="Angaben">
        {angabenVorspann}
        <WebAngaben angaben={angaben} beschriftung={angabenBeschriftung} />
      </WebKarte>
    ) : null;
    inhalt = (
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
  }
  // Ohne Inhalt keine Kennzeichen und Aktionen: sie gehoeren zu dem, was gezeigt wird.
  const mitInhalt = zustand === undefined && laden === undefined && !fehler && !leer;
  return (
    <WebSeite
      bereich={bereich}
      titel={titel}
      kreis={mitInhalt ? kreis : undefined}
      untertitel={mitInhalt ? kennzeichen : undefined}
      aktionen={mitInhalt ? aktionen : undefined}
      zurueck={zurueck}
      pageRef={pageRef}
      ohneIonPage={ohneIonPage}
    >
      {inhalt}
      {children}
    </WebSeite>
  );
};

export default WebDetailSeite;

// --- Tabellen in Detailseiten ---------------------------------------------------

export interface WebDetailListeProps<T> extends Omit<WebListeProps<T>, 'beschriftung' | 'leer' | 'sortierung' | 'onSortieren'> {
  /** Titel der Karte; zugleich Name der Tabelle, wenn `beschriftung` fehlt. */
  titel: string;
  untertitel?: React.ReactNode;
  /** Knopf oder Link rechts im Kopf der Karte ("Aktivität eintragen"). */
  aktion?: React.ReactNode;
  beschriftung?: string;
  /**
   * Ohne Zeilen: ein Leerzustand (Symbol, Titel, Satz) oder ein leiser Satz.
   * Fehlt er, steht die Karte ohne Zeilen leer da.
   */
  leer?: WebLeerProps | string;
  /** Ueber der Tabelle, in derselben Karte: Offenes (Antraege, zu verbuchende Termine). */
  oben?: React.ReactNode;
  /**
   * Nur die ersten n Zeilen, darunter "Alle n anzeigen". Sortiert wird dann
   * die GANZE Liste, bevor gekuerzt wird -- sonst ordnete ein Klick auf den
   * Spaltenkopf nur die sichtbaren Zeilen um.
   */
  kurz?: number;
  /** Nach der Tabelle, in der Karte (Fenster der Zeilen). */
  children?: React.ReactNode;
}

/** Eine Karte mit Tabelle: Titel, Aktion, Offenes oben, Zeilen (WebListe), Leerzustand, "Alle anzeigen". */
export function WebDetailListe<T>({
  titel, untertitel, aktion, beschriftung, leer, oben, kurz, children, zeilen, spalten, ...liste
}: WebDetailListeProps<T>): React.ReactElement {
  const [alle, setAlle] = useState(false);
  const [sortierung, setSortierung] = useState<WebSortierung | null>(null);
  const gekuerzt = kurz !== undefined && zeilen.length > kurz;

  // Mit `kurz` haelt die Karte die Ordnung (ganze Liste), sonst sortiert die Tabelle selbst.
  let tabelle: React.ReactNode = null;
  if (zeilen.length > 0) {
    if (kurz !== undefined) {
      const spalte = sortierung ? spalten.find((s) => s.schluessel === sortierung.schluessel && s.sortWert) : undefined;
      const geordnet = sortierung && spalte?.sortWert ? sortiereZeilen(zeilen, spalte.sortWert, sortierung.richtung) : zeilen;
      tabelle = (
        <WebListe
          {...liste}
          beschriftung={beschriftung ?? titel}
          spalten={spalten}
          zeilen={alle ? geordnet : geordnet.slice(0, kurz)}
          sortierung={sortierung ?? undefined}
          onSortieren={(schluessel) => setSortierung((jetzt) => naechsteSortierung(jetzt, schluessel))}
        />
      );
    } else {
      tabelle = <WebListe {...liste} beschriftung={beschriftung ?? titel} spalten={spalten} zeilen={zeilen} />;
    }
  }

  const leerInhalt = zeilen.length === 0 && !oben && leer !== undefined
    ? (typeof leer === 'string' ? <p className="web-gedaempft" role="status">{leer}</p> : <WebLeer {...leer} />)
    : null;
  // Bis an die Kanten, sobald Zeilen, Offenes oder ein Leerzustand mit eigenem Abstand dastehen.
  const bund = zeilen.length > 0 || Boolean(oben) || (leerInhalt !== null && typeof leer !== 'string');

  return (
    <WebKarte titel={titel} untertitel={untertitel} aktion={aktion} bund={bund}>
      {oben}
      {tabelle}
      {leerInhalt}
      {gekuerzt && (
        <div className="web-karte__fuss">
          <WebKnopf art="text" klein onClick={() => setAlle((a) => !a)}>
            {alle ? 'Weniger anzeigen' : `Alle ${zeilen.length} anzeigen`}
          </WebKnopf>
        </div>
      )}
      {children}
    </WebKarte>
  );
}

// --- Uebergang ------------------------------------------------------------------

/** Nur bis die Challenge-Seiten umgestellt sind: der Inhalt ohne Kopf. */
export const WebDetailInhalt: React.FC<Pick<WebDetailSeiteProps, 'hinweis' | 'kennzahlen' | 'seiteBeschriftung'> & { haupt: React.ReactNode; seite: React.ReactNode }> = ({
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
