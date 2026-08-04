import React, { useMemo } from 'react';
import {
  IonIcon,
  IonList,
  IonListHeader,
  IonLabel,
  IonCard,
  IonCardContent,
  IonButton
} from '@ionic/react';
import {
  flag,
  flagOutline,
  timeOutline,
  personOutline,
  ribbonOutline,
  archiveOutline,
  checkmarkCircle,
  chevronForward,
  sparkles,
  compass,
  rocket,
  flame,
  trophy,
  medal,
  ribbon,
  star,
  diamond,
  shield,
  flash,
  thumbsUp,
  heart,
  people,
  personAdd,
  chatbubbles,
  gift,
  book,
  school,
  construct,
  brush,
  colorPalette,
  sunny,
  moon,
  leaf,
  rose,
  calendar,
  today,
  time,
  timer,
  stopwatch,
  restaurant,
  fitness,
  bicycle,
  car,
  airplane,
  boat,
  camera,
  image,
  musicalNote,
  balloon,
  home,
  business,
  location,
  navigate,
  pin,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer
} from 'ionicons/icons';
import { EmptyState } from '../../shared';
import type { KonfiChallenge, ChallengeMark } from '../../../types/challenges';

// Icon-Vorrat der Challenge-Abzeichen. Bewusst als eigene, schlanke Map hier —
// der Admin-Auswahldialog (ChallengeManageModal) haelt denselben Schluessel-
// Vorrat, aber ihn zu importieren wuerde das komplette Verwaltungs-Modal in das
// Konfi-Bundle ziehen. Schluessel muessen mit dem Admin-Vorrat uebereinstimmen.
const CHALLENGE_BADGE_ICONS: Record<string, string> = {
  flag, sparkles, compass, rocket, flame,
  trophy, medal, ribbon, star, checkmarkCircle, diamond, shield,
  flash, thumbsUp, heart, people, personAdd, chatbubbles, gift,
  book, school, construct, brush, colorPalette,
  sunny, moon, leaf, rose,
  calendar, today, time, timer, stopwatch,
  restaurant, fitness, bicycle, car, airplane, boat, camera, image, musicalNote, balloon,
  home, business, location, navigate, pin,
  informationCircle, helpCircle, alertCircle, hammer
};

/** Loest den gespeicherten Icon-Namen einer Challenge auf (Fallback: Flagge). */
export const getChallengeBadgeIcon = (iconName?: string | null): string =>
  CHALLENGE_BADGE_ICONS[iconName || ''] || flag;

// Konfi-Sicht der Challenges. Bewusst OHNE Zaehler/Fortschritt/Rangliste — der
// Kern des Features ist die eigene Deutung, nicht die Menge (siehe Konzept).
// Aufbau immer: (1) aktive Challenges als grosse Karten, (2) eigene Abzeichen
// als Icon-Reihe, (3) Archiv.

interface ChallengesViewProps {
  active: KonfiChallenge[];
  archive: KonfiChallenge[];
  marks: ChallengeMark[];
  onSelectChallenge: (challenge: KonfiChallenge) => void;
  onSubmit: (challenge: KonfiChallenge) => void;
}

const TYPE_LABEL: Record<string, string> = {
  wahrnehmung: 'Wahrnehmung',
  beitrag: 'Beitrag',
  praxis: 'Praxis',
  frei: 'Challenge'
};

/** Urheber-Zeile: Freitext hat Vorrang, sonst der aufgeloeste Benutzername. */
export const getAuthorLabel = (challenge: KonfiChallenge): string | null => {
  const freetext = challenge.author_freetext?.trim();
  if (freetext) return freetext;
  const name = challenge.author_display_name?.trim();
  if (name) return name;
  return null;
};

/** Verbleibende Zeit bis ends_at, kindgerecht formuliert. */
export const formatRemaining = (endsAt: string): string => {
  const end = new Date(endsAt).getTime();
  if (isNaN(end)) return '';
  const diff = end - Date.now();
  if (diff <= 0) return 'Zeit abgelaufen';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return days === 1 ? 'noch 1 Tag' : `noch ${days} Tage`;
  if (hours >= 1) return hours === 1 ? 'noch 1 Stunde' : `noch ${hours} Stunden`;
  if (minutes >= 1) return minutes === 1 ? 'noch 1 Minute' : `noch ${minutes} Minuten`;
  return 'endet gleich';
};

const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const ChallengesView: React.FC<ChallengesViewProps> = ({
  active,
  archive,
  marks,
  onSelectChallenge,
  onSubmit
}) => {
  // Aktive Challenges: die knappste Frist zuerst — was zuerst endet, steht oben.
  const sortedActive = useMemo(
    () => [...active].sort(
      (a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
    ),
    [active]
  );

  // Archiv: zuletzt beendete zuerst.
  const sortedArchive = useMemo(
    () => [...archive].sort(
      (a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()
    ),
    [archive]
  );

  return (
    <div style={{ paddingBottom: '24px' }}>

      {/* --- 1. Aktive Challenges --- */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--challenges">
            <IonIcon icon={flagOutline} />
          </div>
          <IonLabel>Aktuelle Challenges</IonLabel>
        </IonListHeader>

        {sortedActive.length === 0 ? (
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <EmptyState
                icon={flagOutline}
                title="Gerade läuft keine Challenge"
                message="Sobald eine neue Challenge startet, findest du sie hier — und bekommst eine Nachricht."
                iconColor="var(--app-color-challenges)"
              />
            </IonCardContent>
          </IonCard>
        ) : (
          sortedActive.map((challenge) => {
            const author = getAuthorLabel(challenge);
            const hasMark = marks.some((m) => m.challenge_id === challenge.id);
            // Ein weiterer Beitrag ist moeglich, solange die Challenge Mehrfach-
            // Einreichungen erlaubt oder noch gar nichts eingereicht wurde.
            const canSubmitMore = challenge.allow_multiple || !hasMark;

            return (
              <IonCard
                key={challenge.id}
                className="app-card"
                style={{ marginBottom: '12px' }}
              >
                <IonCardContent style={{ padding: '0' }}>
                  {/* Kopf im Challenge-Rosa */}
                  <div
                    onClick={() => onSelectChallenge(challenge)}
                    style={{
                      background: 'linear-gradient(135deg, var(--app-color-challenges) 0%, #be123c 100%)',
                      padding: '18px 16px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div
                        style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <IonIcon icon={getChallengeBadgeIcon(challenge.badge_icon)} style={{ fontSize: '1.2rem', color: 'white' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, fontWeight: 700 }}>
                          {TYPE_LABEL[challenge.challenge_type] || 'Challenge'}
                        </div>
                        <div className="app-headline" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                          {challenge.title}
                        </div>
                      </div>
                      {hasMark && (
                        <IonIcon
                          icon={checkmarkCircle}
                          style={{ fontSize: '1.4rem', color: 'white', flexShrink: 0 }}
                          title="Du hast schon etwas eingereicht"
                        />
                      )}
                    </div>

                    <div style={{ fontSize: '0.92rem', lineHeight: 1.45, opacity: 0.95, whiteSpace: 'pre-wrap' }}>
                      {challenge.description}
                    </div>

                    <div
                      style={{
                        display: 'flex', flexWrap: 'wrap', gap: '8px 14px',
                        marginTop: '14px', fontSize: '0.8rem', opacity: 0.92
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <IonIcon icon={timeOutline} />
                        {formatRemaining(challenge.ends_at)}
                      </span>
                      {author && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <IonIcon icon={personOutline} />
                          Gestellt von {author}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aktionen. Wenn nur EIN Beitrag erlaubt ist und der Konfi
                      bereits eingereicht hat, fuehrt der Hauptbutton bewusst ins
                      Detail statt ins Einreichen (das Backend wuerde ablehnen). */}
                  <div style={{ display: 'flex', gap: '8px', padding: '12px 12px' }}>
                    <IonButton
                      expand="block"
                      style={{
                        flex: 1, margin: 0,
                        '--background': 'var(--app-color-challenges)',
                        '--background-activated': '#9d174d',
                        '--border-radius': '10px'
                      }}
                      onClick={() => (canSubmitMore ? onSubmit(challenge) : onSelectChallenge(challenge))}
                    >
                      {canSubmitMore
                        ? (hasMark ? 'Noch etwas einreichen' : 'Mitmachen')
                        : 'Dein Beitrag'}
                    </IonButton>
                    <IonButton
                      fill="clear"
                      style={{ margin: 0, '--color': 'var(--app-color-challenges)' }}
                      onClick={() => onSelectChallenge(challenge)}
                    >
                      Details
                      <IonIcon icon={chevronForward} slot="end" />
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            );
          })
        )}
      </IonList>

      {/* --- 2. Deine Abzeichen (bewusst OHNE Zaehler) --- */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--challenges">
            <IonIcon icon={ribbonOutline} />
          </div>
          <IonLabel>Deine Abzeichen</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: marks.length === 0 ? '16px' : '16px 12px' }}>
            {marks.length === 0 ? (
              <EmptyState
                icon={ribbonOutline}
                title="Noch keine Abzeichen"
                message="Für jede Challenge, bei der du mitmachst, bekommst du ein eigenes Abzeichen."
                iconColor="var(--app-color-challenges)"
              />
            ) : (
              <div
                style={{
                  display: 'flex', gap: '14px', overflowX: 'auto',
                  paddingBottom: '4px', WebkitOverflowScrolling: 'touch'
                }}
              >
                {marks.map((mark) => (
                  <div
                    key={mark.challenge_id}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '6px', minWidth: '74px', maxWidth: '92px', flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        width: '52px', height: '52px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--app-color-challenges) 0%, #be123c 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(var(--app-color-challenges-rgb), 0.35)'
                      }}
                    >
                      <IonIcon
                        icon={getChallengeBadgeIcon(mark.badge_icon)}
                        style={{ fontSize: '1.5rem', color: 'white' }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem', fontWeight: 600, color: '#3c3c43',
                        textAlign: 'center', lineHeight: 1.2
                      }}
                    >
                      {mark.badge_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* --- 3. Archiv --- */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--challenges">
            <IonIcon icon={archiveOutline} />
          </div>
          <IonLabel>Vorbei</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: sortedArchive.length === 0 ? '16px' : '12px' }}>
            {sortedArchive.length === 0 ? (
              <EmptyState
                icon={archiveOutline}
                title="Noch nichts im Archiv"
                message="Beendete Challenges kannst du hier später in Ruhe nachlesen."
                iconColor="var(--app-color-challenges)"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sortedArchive.map((challenge) => {
                  const hasMark = marks.some((m) => m.challenge_id === challenge.id);
                  return (
                    <div
                      key={challenge.id}
                      className="app-list-item app-list-item--challenges"
                      onClick={() => onSelectChallenge(challenge)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      {hasMark && (
                        <div className="app-corner-badges">
                          <div className="app-corner-badge app-corner-badge--challenges" style={{ whiteSpace: 'nowrap' }}>
                            <IonIcon icon={flag} style={{ fontSize: '0.7rem', marginRight: '3px' }} />
                            Dabei
                          </div>
                        </div>
                      )}
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle app-icon-circle--challenges">
                            <IonIcon icon={getChallengeBadgeIcon(challenge.badge_icon)} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title" style={{ paddingRight: hasMark ? '70px' : '0' }}>
                              {challenge.title}
                            </div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={timeOutline} className="app-icon-color--challenges" />
                                bis {formatDate(challenge.ends_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>

    </div>
  );
};

export default ChallengesView;
