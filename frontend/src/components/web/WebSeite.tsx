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
  /** Kreis vor dem Titel (WebKreis, gross) -- auf Detailseiten derselbe wie in der Zeile der Liste. */
  kreis?: React.ReactNode;
  /**
   * Ohne eigene IonPage: Kopfzeile und Inhalt stehen in der IonPage der
   * Seite drumherum. Fuer Seiten, die EINE IonPage fuer alle Zustaende halten
   * (Challenges): einen Tausch der IonPage bemerkt der IonRouterOutlet nicht,
   * die neue Seite bliebe weiss (MainTabs.tsx, SeiteMitChunk).
   */
  ohneIonPage?: boolean;
}

const WebSeite: React.FC<WebSeiteProps> = ({
  bereich, titel, untertitel, aktionen, children, pageRef, wartung = false, zurueck, kreis, ohneIonPage = false,
}) => {
  const titelText = (
    <>
      <h1 className="web-titel">{titel}</h1>
      {untertitel && <p className="web-untertitel">{untertitel}</p>}
    </>
  );
  const inhalt = (
    <>
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
            {kreis ? (
              <div className="web-kopf__text web-kopf__text--kreis">
                {kreis}
                <div className="web-kopf__titelblock">{titelText}</div>
              </div>
            ) : <div className="web-kopf__text">{titelText}</div>}
            {aktionen && <div className="web-kopf__aktionen">{aktionen}</div>}
          </header>
          {children}
        </div>
      </IonContent>
    </>
  );
  return ohneIonPage ? inhalt : <IonPage ref={pageRef}>{inhalt}</IonPage>;
};

export default WebSeite;
