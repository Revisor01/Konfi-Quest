// Der Rahmen jeder Challenge-Seite in der Web-Fassung (Browser ab 992 px):
// die schmale Kopfzeile der App mit der Glocke, darunter der breite Inhalt
// mit Weg zurueck, Titel, Untertitel und Aktionen -- derselbe Aufbau wie
// WebSeite (components/web/WebSeite.tsx), aber OHNE eigene IonPage.
//
// WARUM OHNE IonPage: Die Seite einer Challenge haelt EINE IonPage fuer alle
// Zustaende (laedt, Hinweis, Challenge); der IonRouterOutlet registriert sie
// beim Einhaengen und bemerkt einen Tausch nicht -- die neue Seite bliebe
// weiss (MainTabs.tsx, SeiteMitChunk; Test keinTauschImOutlet). Getauscht
// wird deshalb nur der Inhalt darin, und der kommt von hier. Die Listen
// haben ihre IonPage selbst und nehmen WebSeite.

import React from 'react';
import { IonContent, IonIcon } from '@ionic/react';
import AppKopfzeile from '../../AppKopfzeile';
import { ICON_ZURUECK } from '../../icons';
import WebLink from '../../../web/WebLink';
import '../../../../theme/web/challenges.css';

export interface WebChallengeRahmenProps {
  titel: string;
  untertitel?: React.ReactNode;
  /** Knoepfe rechts neben dem Titel. */
  aktionen?: React.ReactNode;
  /** Der Weg zurueck als Link zur Liste ("Alle Challenges"). */
  zurueck?: { href: string; text: string };
  children: React.ReactNode;
}

const WebChallengeRahmen: React.FC<WebChallengeRahmenProps> = ({ titel, untertitel, aktionen, zurueck, children }) => (
  <>
    <AppKopfzeile titel="Challenges" gemeindeUmschalter={false} />
    <IonContent className="web-inhalt" fullscreen>
      <div className="web-seite">
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
            {untertitel && <div className="web-untertitel">{untertitel}</div>}
          </div>
          {aktionen && <div className="web-kopf__aktionen">{aktionen}</div>}
        </header>
        {children}
      </div>
    </IonContent>
  </>
);

export default WebChallengeRahmen;
