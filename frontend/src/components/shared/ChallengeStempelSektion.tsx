import React from 'react';
import { IonCard, IonCardContent, IonIcon, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_CHALLENGE_GEFUELLT } from './icons';
import { getIconFromString } from '../../utils/badgeIcons';
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
}

const ChallengeStempelSektion: React.FC<ChallengeStempelSektionProps> = ({ marks }) => {
  if (!marks || marks.length === 0) return null;

  return (
    <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
      <IonListHeader>
        <div className="app-section-icon app-section-icon--challenges">
          <IonIcon icon={ICON_ABZEICHEN} />
        </div>
        <IonLabel>Deine Stempel</IonLabel>
      </IonListHeader>
      <IonCard className="app-card">
        <IonCardContent style={{ padding: 'var(--app-abstand-basis) var(--app-abstand-mittel)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--app-abstand-mittel)',
            }}
          >
            {marks.map((mark) => (
              <div
                key={mark.challenge_id}
                title={mark.title}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--app-abstand-kompakt)',
                  padding: 'var(--app-abstand-mittel) var(--app-abstand-eng)',
                  borderRadius: 'var(--app-radius-gross)',
                  background: 'rgba(var(--app-color-challenges-rgb), 0.08)',
                  border: '2px solid rgba(var(--app-color-challenges-rgb), 0.25)',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: 'var(--app-radius-kreis)',
                    background:
                      'linear-gradient(135deg, var(--app-color-challenges) 0%, var(--app-color-challenges-dunkel) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--app-schatten-glow-challenges)',
                    flexShrink: 0,
                  }}
                >
                  <IonIcon
                    icon={getIconFromString(mark.badge_icon, ICON_CHALLENGE_GEFUELLT)}
                    style={{ fontSize: 'var(--app-text-ueberschrift)', color: 'white' }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 'var(--app-text-meta)',
                    fontWeight: 'var(--app-schrift-halbfett)',
                    color: 'var(--app-text-ios)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {mark.badge_name}
                </div>
              </div>
            ))}
          </div>
        </IonCardContent>
      </IonCard>
    </IonList>
  );
};

export default ChallengeStempelSektion;
