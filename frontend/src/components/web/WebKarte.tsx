// Karte mit Kopf der Web-Fassung: auf Wunsch der farbige Kreis der App,
// Titel (links), kleiner Untertitel, eine Aktion rechts ("Alle Anfragen →"). `bund`: Inhalt ohne Innenabstand, fuer
// Tabellen und Listen, die bis an die Kanten reichen. Die Karte ist ein
// Bereich (<section>), der nach seiner Ueberschrift benannt ist.

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';

export interface WebKarteProps {
  titel: string;
  untertitel?: React.ReactNode;
  /** Meist ein Link: "Alle Anfragen →". */
  aktion?: React.ReactNode;
  bund?: boolean;
  children: React.ReactNode;
  /** Ueberschrift als h2 (Vorgabe) -- oder h3 in einer Karte unter einer eigenen h2. */
  ebene?: 2 | 3;
  /**
   * Der farbige Kreis vor dem Titel, wie die Abschnitte der App
   * (app-section-icon): Symbol und Farbe (events, konfis, info, success ...).
   */
  symbol?: { icon: string; farbe: string };
}

const WebKarte: React.FC<WebKarteProps> = ({ titel, untertitel, aktion, bund = false, children, ebene = 2, symbol }) => {
  const Titel = ebene === 3 ? 'h3' : 'h2';
  const titelId = useId();
  return (
    <section className="web-karte" aria-labelledby={titelId}>
      <header className="web-karte__kopf">
        {symbol && (
          <span className={`app-section-icon app-section-icon--${symbol.farbe} web-karte__symbol`} aria-hidden="true">
            <IonIcon icon={symbol.icon} />
          </span>
        )}
        <div className="web-karte__kopftext">
          <Titel id={titelId} className="web-karte__titel">{titel}</Titel>
          {untertitel && <p className="web-karte__untertitel">{untertitel}</p>}
        </div>
        {aktion && <div className="web-karte__aktion">{aktion}</div>}
      </header>
      <div className={bund ? 'web-karte__inhalt web-karte__inhalt--bund' : 'web-karte__inhalt'}>{children}</div>
    </section>
  );
};

export default WebKarte;
