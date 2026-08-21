import React, { useMemo } from 'react';
import {
  IonIcon,
  IonList,
  IonListHeader,
  IonLabel,
  IonCard,
  IonCardContent
} from '@ionic/react';
import {
  flag,
  flagOutline,
  timeOutline,
  personOutline,
  ribbonOutline,
  archiveOutline,
  checkmarkCircle,
  paperPlaneOutline,
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
import { EmptyState, SectionHeader } from '../../shared';
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
  // Zusaetzlicher Inhalt DIREKT UNTER dem SectionHeader (Leitungs-Sicht:
  // Verwalten|Mitmachen). Gleiches Muster wie EventsView/RequestsView.
  headerSlot?: React.ReactNode;
}

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

  if (days >= 1) return days === 1 ? '1 Tag' : `${days} Tage`;
  if (hours >= 1) return hours === 1 ? '1 Stunde' : `${hours} Stunden`;
  if (minutes >= 1) return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
  return 'endet gleich';
};

const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Laufzeitraum einer beendeten Challenge: "14.07. – 21.07.2026". Liegt der
 * Start im selben Jahr wie das Ende, faellt das Jahr beim Start weg — nur
 * das Enddatum traegt es dann. Bei fehlendem/ungueltigem Start faellt die
 * Funktion auf das reine Enddatum zurueck.
 */
const formatDateRange = (startValue?: string | null, endValue?: string | null): string => {
  const end = formatDate(endValue);
  if (!startValue) return end;
  const start = new Date(startValue);
  const endDate = endValue ? new Date(endValue) : null;
  if (isNaN(start.getTime()) || !endDate || isNaN(endDate.getTime())) return end;

  const sameYear = start.getFullYear() === endDate.getFullYear();
  const startFormatted = start.toLocaleDateString(
    'de-DE',
    sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }
  );
  return `${startFormatted} – ${end}`;
};

const ChallengesView: React.FC<ChallengesViewProps> = ({
  active,
  archive,
  marks,
  onSelectChallenge,
  onSubmit,
  headerSlot
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

      <SectionHeader
        title="Challenges"
        subtitle="Mach mit und sammle Abzeichen!"
        icon={flagOutline}
        preset="challenges"
        stats={[
          { value: active.length, label: 'AKTIV' },
          { value: marks.length, label: 'ABZEICHEN' },
          { value: archive.length, label: 'ARCHIV' }
        ]}
      />

      {headerSlot}

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
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '12px' }}>
              {/* Alle laufenden Challenges gleichwertig, einheitliches
                  Listen-Item wie bei Events/Badges — keine Leitkarte mehr. */}
              {sortedActive.map((challenge) => {
                const author = getAuthorLabel(challenge);
                return (
                  <div
                    key={challenge.id}
                    className="app-list-item app-list-item--challenges"
                    onClick={() => onSelectChallenge(challenge)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {challenge.has_submission && (
                      <div className="app-corner-badges">
                        <div
                          className="app-corner-badge app-corner-badge--queue"
                          style={{ backgroundColor: 'var(--app-color-challenges)' }}
                          title="Du hast bereits eingereicht"
                        >
                          <IonIcon icon={paperPlaneOutline} />
                        </div>
                      </div>
                    )}
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--challenges">
                          <IonIcon icon={getChallengeBadgeIcon(challenge.badge_icon)} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title" style={{ paddingRight: challenge.has_submission ? '36px' : '0' }}>
                            {challenge.title}
                          </div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={timeOutline} className="app-icon-color--challenges" />
                              {formatRemaining(challenge.ends_at)}
                            </span>
                            {author && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={personOutline} className="app-icon-color--challenges" />
                                {author}
                              </span>
                            )}
                          </div>
                          {/* Beschreibungs-Anriss: 2 Zeilen, Rest im Detail */}
                          {challenge.description && (
                            <div
                              style={{
                                fontSize: '0.82rem', lineHeight: 1.4, color: '#666',
                                marginTop: '6px', whiteSpace: 'pre-wrap',
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden'
                              }}
                            >
                              {challenge.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </IonCardContent>
          </IonCard>
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
                  // Ohne eigenen Beitrag dezent ausgrauen — weiterhin lesbar
                  // und tappbar, aber sichtbar von "erledigt" unterschieden.
                  const participated = !!challenge.has_submission;
                  return (
                    <div
                      key={challenge.id}
                      className="app-list-item app-list-item--challenges"
                      onClick={() => onSelectChallenge(challenge)}
                      style={{ cursor: 'pointer', position: 'relative', opacity: participated ? 1 : 0.55 }}
                    >
                      {challenge.has_submission && (
                        <div className="app-corner-badges">
                          <div
                            className="app-corner-badge app-corner-badge--queue"
                            style={{ backgroundColor: 'var(--app-color-challenges)' }}
                            title="Du hast bereits eingereicht"
                          >
                            <IonIcon icon={paperPlaneOutline} />
                          </div>
                        </div>
                      )}
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle app-icon-circle--challenges">
                            <IonIcon icon={getChallengeBadgeIcon(challenge.badge_icon)} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title" style={{ paddingRight: challenge.has_submission ? '36px' : '0' }}>
                              {challenge.title}
                            </div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={timeOutline} className="app-icon-color--challenges" />
                                {formatDateRange(challenge.starts_at, challenge.ends_at)}
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
