// Zwei Spalten der Detailseiten: links der Hauptinhalt (Schriftwechsel,
// Antwort), rechts eine schmale Seite mit Karten (Angaben, Bearbeiten). Auf
// schmalerem Fenster stehen sie untereinander, die Seite nach dem Hauptinhalt.
// Mit `seiteLinks` steht die schmale Seite vorn (Liste links, Bearbeiten
// rechts: Textbausteine) -- im Dokument dann auch zuerst.

import React from 'react';

export interface WebSpaltenProps {
  haupt: React.ReactNode;
  seite: React.ReactNode;
  /** Name der schmalen Spalte fuer Vorleseprogramme. */
  seiteBeschriftung: string;
  /** Die schmale Spalte links statt rechts. */
  seiteLinks?: boolean;
}

const WebSpalten: React.FC<WebSpaltenProps> = ({ haupt, seite, seiteBeschriftung, seiteLinks = false }) => {
  const hauptSpalte = <div className="web-spalten__haupt" key="haupt">{haupt}</div>;
  const seitenSpalte = <aside className="web-spalten__seite" aria-label={seiteBeschriftung} key="seite">{seite}</aside>;
  return (
    <div className={seiteLinks ? 'web-spalten web-spalten--links' : 'web-spalten'}>
      {seiteLinks ? [seitenSpalte, hauptSpalte] : [hauptSpalte, seitenSpalte]}
    </div>
  );
};

export default WebSpalten;
