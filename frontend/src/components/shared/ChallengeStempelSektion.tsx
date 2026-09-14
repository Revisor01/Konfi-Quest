import React from 'react';
import { IonCard, IonCardContent, IonIcon, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_CHALLENGE_GEFUELLT } from './icons';
import { getIconFromString } from '../../utils/badgeIcons';
import KachelRaster from './KachelRaster';
import type { ChallengeMark } from '../../types/challenges';

/**
 * Die eigenen Challenge-Stempel im Profil — bei Konfis wie bei Teamer:innen
 * (Simon, 12.09.2026: "nach den badges auch die stempel sehen").
 *
 * Bewusst OHNE Zaehler und ohne Fortschritt, wie ueberall bei Challenges: ein
 * Stempel belegt, dass jemand dabei war, er ist keine Sammelmenge.
 *
 * Wer noch keinen Stempel hat, sieht den Abschnitt GAR NICHT — eine Kachel mit
 * einer Null darauf ist keine Erinnerung. Die Challenges-Seite selbst zeigt
 * stattdessen einen Leertext, dort gehoert er hin.
 *
 * Die Kacheln tragen dieselbe Optik wie die Stempel-Reihe in der
 * Challenges-Ansicht (konfi/views/ChallengesView.tsx) — eine Person soll an
 * beiden Stellen dasselbe wiedererkennen.
 */
interface ChallengeStempelSektionProps {
  marks: ChallengeMark[];
  /**
   * Ueberschrift des Abschnitts. Im eigenen Profil bleibt es bei "Deine
   * Stempel"; in der Detailansicht der Leitung schaut jemand auf eine ANDERE
   * Person, dort waere "Deine" schlicht falsch.
   */
  titel?: string;
}

const ChallengeStempelSektion: React.FC<ChallengeStempelSektionProps> = ({ marks, titel = 'Deine Stempel' }) => {
  if (!marks || marks.length === 0) return null;

  return (
    <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
      <IonListHeader>
        <div className="app-section-icon app-section-icon--challenges">
          <IonIcon icon={ICON_ABZEICHEN} />
        </div>
        <IonLabel>{titel}</IonLabel>
      </IonListHeader>
      <IonCard className="app-card">
        <IonCardContent style={{ padding: 'var(--app-abstand-basis) var(--app-abstand-mittel)' }}>
          <KachelRaster
            eintraege={marks.map((mark) => ({
              schluessel: mark.challenge_id,
              icon: getIconFromString(mark.badge_icon, ICON_CHALLENGE_GEFUELLT),
              name: mark.badge_name,
              titel: mark.title,
              // Die Challenge-Farbe statt einer eigenen je Stempel: ein
              // Stempel gehoert zu den Challenges, nicht zu einer Kategorie.
              farbe: 'var(--app-color-challenges)',
            }))}
          />
        </IonCardContent>
      </IonCard>
    </IonList>
  );
};

export default ChallengeStempelSektion;
