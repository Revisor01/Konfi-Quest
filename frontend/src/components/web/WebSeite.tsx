// Das Gerüst jeder Web-Seite der Support-Ansicht: die schmale Kopfzeile der
// App (Glocke), darunter der Inhalt mit eigenem Seitenkopf -- Titel,
// Untertitel, Aktionen rechts. Der Inhalt ist breiter als in der App
// (theme/web-ansicht.css, `web-inhalt`).
//
// Die Kopfzeile nennt nur den BEREICH ("Support", "Verwaltung"), der Titel
// der Seite steht im Inhalt -- so steht nichts doppelt, und links in der
// Leiste ist der Eintrag derselbe Name wie die Ueberschrift.

import React from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import AppKopfzeile from '../shared/AppKopfzeile';
import WartungsHinweis from '../shared/WartungsHinweis';
import { ICON_ZURUECK } from '../shared/icons';
import WebLink from './WebLink';

export interface WebSeiteProps {
  /** Name des Bereichs in der Kopfzeile ("Support", "Verwaltung"). */
  bereich: string;
  titel: string;
  untertitel?: React.ReactNode;
  /** Knoepfe rechts neben dem Titel. */
  aktionen?: React.ReactNode;
  children: React.ReactNode;
  /** Fuer Modale, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
  /** Wartungshinweis des Betriebs ueber dem Seitenkopf. */
  wartung?: boolean;
  /** Der Weg zurueck auf Detailseiten: ein Link zur Liste ("Alle Anfragen"). */
  zurueck?: { href: string; text: string };
}

const WebSeite: React.FC<WebSeiteProps> = ({ bereich, titel, untertitel, aktionen, children, pageRef, wartung = false, zurueck }) => (
  <IonPage ref={pageRef}>
    <AppKopfzeile titel={bereich} gemeindeUmschalter={false} />
    <IonContent className="web-inhalt" fullscreen>
      <div className="web-seite">
        {wartung && <WartungsHinweis style={{ margin: 0 }} />}
        {zurueck && (
          <nav className="web-zurueck" aria-label="Zurück">
            <WebLink href={zurueck.href}>
              <IonIcon icon={ICON_ZURUECK} aria-hidden="true" />
              {zurueck.text}
            </WebLink>
          </nav>
        )}
        <header className="web-kopf">
          <div className="web-kopf__text">
            <h1 className="web-titel">{titel}</h1>
            {untertitel && <p className="web-untertitel">{untertitel}</p>}
          </div>
          {aktionen && <div className="web-kopf__aktionen">{aktionen}</div>}
        </header>
        {children}
      </div>
    </IonContent>
  </IonPage>
);

export default WebSeite;
