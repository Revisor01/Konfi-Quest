import React from 'react';
import { IonButton, IonContent } from '@ionic/react';
import AppKopfzeile from './AppKopfzeile';
import EmptyState from './EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { HINWEIS_TEXTE as TEXTE, type ChallengeHinweisArt } from './challengeHinweisTexte';

export type { ChallengeHinweisArt };

/**
 * Was die Seite einer Challenge zeigt, solange sie keine Challenge zeigen
 * kann (2.4.0) -- fuer Konfis, Team und Leitung gleich.
 *
 * Seit eine Challenge eine eigene Adresse hat, kann ein Push-Tipp, ein
 * Postfach-Eintrag oder ein geteilter Link direkt hineinfuehren -- auch zu
 * einer Challenge, die inzwischen geloescht ist oder die diese Person nicht
 * sieht. Der fruehere Dialog kannte den Fall nicht: Er ging nur aus der
 * Liste auf, also nur fuer Challenges, die es gab. Statt einer leeren Seite
 * oder eines roten Fehlerkastens steht hier, was los ist, und der Weg
 * zurueck zur Liste.
 *
 * KEINE EIGENE IonPage: Kopfzeile und Inhalt stehen in der IonPage der
 * Seite, die je Route genau einmal montiert wird. Ein Wechsel von "laedt"
 * zur Challenge tauscht damit nur den Inhalt, nicht die Seite -- einen
 * Tausch der IonPage bemerkt der IonRouterOutlet nicht, die neue Seite
 * bliebe weiss (MainTabs.tsx, SeiteMitChunk; Test keinTauschImOutlet).
 */
interface ChallengeHinweisProps {
  art: ChallengeHinweisArt;
  /** Zurueck zur Liste -- mit Verlauf zurueck, ohne (nach einem Push) auf die Liste. */
  onBack: () => void;
  /** Bei 'offline' und 'fehler': neu laden. */
  onNochmal?: () => void;
}

// Nur die App: Im breiten Browserfenster zeigen die Web-Fassungen der Seite
// (WebChallengeLeitungDetail, WebKonfiChallengeDetail) auch diese Zustaende
// selbst, unter dem Kopf der Detailseite (webChallengeZustand).
const ChallengeHinweis: React.FC<ChallengeHinweisProps> = ({ art, onBack, onNochmal }) => {
  return (
    <>
      <AppKopfzeile titel="Challenge" onZurueck={onBack} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        {art === 'laedt' ? (
          <LoadingSpinner message="Challenge wird geladen..." />
        ) : (
          <>
            <EmptyState
              icon={TEXTE[art].icon}
              title={TEXTE[art].titel}
              message={TEXTE[art].text}
              iconColor="var(--app-color-challenges)"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)', padding: '0 var(--app-abstand-basis)' }}>
              {onNochmal && (art === 'offline' || art === 'fehler') && (
                <IonButton expand="block" fill="outline" onClick={onNochmal}>
                  Erneut versuchen
                </IonButton>
              )}
              <IonButton expand="block" onClick={onBack}>
                Zu den Challenges
              </IonButton>
            </div>
          </>
        )}
      </IonContent>
    </>
  );
};

export default ChallengeHinweis;
