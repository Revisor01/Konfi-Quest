import React from 'react';
import { IonButton, IonContent } from '@ionic/react';
import AppKopfzeile from './AppKopfzeile';
import EmptyState from './EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_CHALLENGE, ICON_JAHRGANG, ICON_OFFLINE, ICON_WARNUNG } from './icons';

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
export type ChallengeHinweisArt =
  /** Laedt noch. */
  | 'laedt'
  /** 404: geloescht, fremde Gemeinde, (fuer Konfis) noch nicht gestartet. */
  | 'weg'
  /** 403 bei Konfis: gehoert zu einem anderen Jahrgang. */
  | 'nichtFuerDich'
  /** 403 bei Team und Leitung: kein zugewiesener Jahrgang der Challenge. */
  | 'jahrgang'
  /** Ohne Netz und ohne gespeicherten Stand. */
  | 'offline'
  /** Unerwarteter Serverfehler. */
  | 'fehler';

const TEXTE: Record<Exclude<ChallengeHinweisArt, 'laedt'>, { icon: string; titel: string; text: string }> = {
  weg: {
    icon: ICON_CHALLENGE,
    titel: 'Diese Challenge gibt es nicht mehr',
    text: 'Sie wurde wohl gelöscht. Alle übrigen Challenges findest du in der Liste.',
  },
  nichtFuerDich: {
    icon: ICON_JAHRGANG,
    titel: 'Diese Challenge ist nicht für dich',
    text: 'Sie gehört zu einem anderen Jahrgang. Deine Challenges findest du in der Liste.',
  },
  // Wortgleich mit dem Termin (admin/views/EventDetailView, jahrgangFehlt):
  // derselbe Grund, dieselben Worte.
  jahrgang: {
    icon: ICON_JAHRGANG,
    titel: 'Nicht deinem Jahrgang zugeordnet',
    text: 'Diese Challenge gehört zu einem Jahrgang, dem du nicht zugewiesen bist. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern.',
  },
  offline: {
    icon: ICON_OFFLINE,
    titel: 'Keine Verbindung',
    text: 'Diese Challenge wurde noch nicht geladen — dafür brauchst du eine Verbindung.',
  },
  fehler: {
    icon: ICON_WARNUNG,
    titel: 'Die Challenge ließ sich nicht laden',
    text: 'Versuch es gleich noch einmal.',
  },
};

interface ChallengeHinweisProps {
  art: ChallengeHinweisArt;
  /** Zurueck zur Liste -- mit Verlauf zurueck, ohne (nach einem Push) auf die Liste. */
  onBack: () => void;
  /** Bei 'offline' und 'fehler': neu laden. */
  onNochmal?: () => void;
}

const ChallengeHinweis: React.FC<ChallengeHinweisProps> = ({ art, onBack, onNochmal }) => (
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

export default ChallengeHinweis;
