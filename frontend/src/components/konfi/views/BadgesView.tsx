import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel
} from '@ionic/react';
import {
  trophy,
  eyeOff,
  statsChart,
  trophyOutline,
  medal,
  ribbon,
  star,
  checkmarkCircle,
  diamond,
  shield,
  flame,
  flash,
  rocket,
  sparkles,
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
  compass,
  pin,
  flag,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer,
  lockClosed,
  layersOutline,
  gridOutline,
  prismOutline,
  cubeOutline,
  handLeft
} from 'ionicons/icons';

// Badge Icon Mapping
const BADGE_ICONS: Record<string, { icon: string; name: string; category: string }> = {
  trophy: { icon: trophy, name: 'Pokal', category: 'Erfolg' },
  medal: { icon: medal, name: 'Medaille', category: 'Erfolg' },
  ribbon: { icon: ribbon, name: 'Band', category: 'Erfolg' },
  star: { icon: star, name: 'Stern', category: 'Erfolg' },
  checkmarkCircle: { icon: checkmarkCircle, name: 'Bestanden', category: 'Erfolg' },
  diamond: { icon: diamond, name: 'Diamant', category: 'Erfolg' },
  shield: { icon: shield, name: 'Schild', category: 'Erfolg' },
  flame: { icon: flame, name: 'Flamme', category: 'Engagement' },
  flash: { icon: flash, name: 'Blitz', category: 'Engagement' },
  rocket: { icon: rocket, name: 'Rakete', category: 'Engagement' },
  sparkles: { icon: sparkles, name: 'Funken', category: 'Engagement' },
  thumbsUp: { icon: thumbsUp, name: 'Daumen hoch', category: 'Engagement' },
  heart: { icon: heart, name: 'Herz', category: 'Gemeinschaft' },
  people: { icon: people, name: 'Gruppe', category: 'Gemeinschaft' },
  personAdd: { icon: personAdd, name: 'Neue Person', category: 'Gemeinschaft' },
  chatbubbles: { icon: chatbubbles, name: 'Chat', category: 'Gemeinschaft' },
  gift: { icon: gift, name: 'Geschenk', category: 'Gemeinschaft' },
  book: { icon: book, name: 'Buch', category: 'Lernen' },
  school: { icon: school, name: 'Schule', category: 'Lernen' },
  construct: { icon: construct, name: 'Werkzeug', category: 'Lernen' },
  brush: { icon: brush, name: 'Pinsel', category: 'Lernen' },
  colorPalette: { icon: colorPalette, name: 'Farbpalette', category: 'Lernen' },
  sunny: { icon: sunny, name: 'Sonne', category: 'Natur' },
  moon: { icon: moon, name: 'Mond', category: 'Natur' },
  leaf: { icon: leaf, name: 'Blatt', category: 'Natur' },
  rose: { icon: rose, name: 'Rose', category: 'Natur' },
  calendar: { icon: calendar, name: 'Kalender', category: 'Zeit' },
  today: { icon: today, name: 'Heute', category: 'Zeit' },
  time: { icon: time, name: 'Uhr', category: 'Zeit' },
  timer: { icon: timer, name: 'Timer', category: 'Zeit' },
  stopwatch: { icon: stopwatch, name: 'Stoppuhr', category: 'Zeit' },
  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitäten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitäten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitäten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitäten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitäten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitäten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitäten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitäten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitäten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitäten' },
  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebäude', category: 'Orte' },
  location: { icon: location, name: 'Standort', category: 'Orte' },
  navigate: { icon: navigate, name: 'Navigation', category: 'Orte' },
  compass: { icon: compass, name: 'Kompass', category: 'Orte' },
  pin: { icon: pin, name: 'Pin', category: 'Orte' },
  flag: { icon: flag, name: 'Flagge', category: 'Orte' },
  informationCircle: { icon: informationCircle, name: 'Info', category: 'Sonstiges' },
  helpCircle: { icon: helpCircle, name: 'Hilfe', category: 'Sonstiges' },
  alertCircle: { icon: alertCircle, name: 'Warnung', category: 'Sonstiges' },
  hammer: { icon: hammer, name: 'Hammer', category: 'Sonstiges' }
};

// Helper function to get icon from string
const getIconFromString = (iconName: string): string => {
  return BADGE_ICONS[iconName]?.icon || trophy;
};

interface Badge {
  id: number;
  name: string;
  description?: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string;
  is_hidden: boolean;
  is_active: boolean;
  color?: string;
  is_earned: boolean;
  earned_at?: string;
  progress_points?: number;
  progress_percentage?: number;
}

interface BadgesViewProps {
  badges: Badge[];
  badgeStats: {
    totalVisible: number;
    totalSecret: number;
  };
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

const BadgesView: React.FC<BadgesViewProps> = ({
  badges,
  badgeStats,
  selectedFilter,
  onFilterChange
}) => {

  // Badges nach Kategorien gruppieren - ALLE 13 Typen
  const getBadgeCategories = () => {
    // Erst filtern
    let filtered = badges;
    switch (selectedFilter) {
      case 'nicht_erhalten':
        filtered = badges.filter(badge => !badge.is_earned);
        break;
      case 'in_arbeit':
        filtered = badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0);
        break;
      default:
        filtered = badges;
    }

    // ALLE Kategorien aus der Datenbank
    // Geheime Badges erscheinen in ihrer normalen Kategorie (mit GEHEIM-Label)
    const categories: { key: string; title: string; icon: string; color: string; badges: Badge[] }[] = [
      // Punkte-basierte Badges
      {
        key: 'total_points',
        title: 'Punkte-Sammler',
        icon: trophy,
        color: '#ffd700',
        badges: filtered
          .filter(b => b.criteria_type === 'total_points')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'gottesdienst_points',
        title: 'Gottesdienst-Held',
        icon: sunny,
        color: '#ff9500',
        badges: filtered
          .filter(b => b.criteria_type === 'gottesdienst_points')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'gemeinde_points',
        title: 'Gemeinde-Star',
        icon: people,
        color: '#2dd36f',
        badges: filtered
          .filter(b => b.criteria_type === 'gemeinde_points')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'bonus_points',
        title: 'Bonus-Jaeger',
        icon: gift,
        color: '#ff6b9d',
        badges: filtered
          .filter(b => b.criteria_type === 'bonus_points')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'both_categories',
        title: 'Allrounder',
        icon: layersOutline,
        color: '#5856d6',
        badges: filtered
          .filter(b => b.criteria_type === 'both_categories')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      // Aktivitäten-basierte Badges
      {
        key: 'activity_count',
        title: 'Aktiv dabei',
        icon: checkmarkCircle,
        color: '#3880ff',
        badges: filtered
          .filter(b => b.criteria_type === 'activity_count')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'unique_activities',
        title: 'Vielseitig',
        icon: gridOutline,
        color: '#10dc60',
        badges: filtered
          .filter(b => b.criteria_type === 'unique_activities')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'activity_combination',
        title: 'Kombinier-Profi',
        icon: prismOutline,
        color: '#7044ff',
        badges: filtered
          .filter(b => b.criteria_type === 'activity_combination')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'category_activities',
        title: 'Kategorie-Meister',
        icon: cubeOutline,
        color: '#0cd1e8',
        badges: filtered
          .filter(b => b.criteria_type === 'category_activities')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'specific_activity',
        title: 'Spezialist',
        icon: handLeft,
        color: '#ffce00',
        badges: filtered
          .filter(b => b.criteria_type === 'specific_activity')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      // Zeit-basierte Badges
      {
        key: 'streak',
        title: 'Serien-Champion',
        icon: flame,
        color: '#eb445a',
        badges: filtered
          .filter(b => b.criteria_type === 'streak')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      {
        key: 'time_based',
        title: 'Zeitreisender',
        icon: time,
        color: '#8e8e93',
        badges: filtered
          .filter(b => b.criteria_type === 'time_based')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      },
      // Event-basierte Badges
      {
        key: 'event_count',
        title: 'Event-Champion',
        icon: calendar,
        color: '#e63946',
        badges: filtered
          .filter(b => b.criteria_type === 'event_count')
          .sort((a, b) => a.criteria_value - b.criteria_value)
      }
    ];

    // Nur Kategorien mit Badges anzeigen
    return categories.filter(cat => cat.badges.length > 0);
  };

  const badgeCategories = getBadgeCategories();

  // Check if there are undiscovered secret badges
  const earnedSecretCount = badges.filter(b => b.is_earned && b.is_hidden).length;
  const hasUndiscoveredSecrets = badgeStats.totalSecret > earnedSecretCount;

  const getBadgeColor = (badge: Badge) => {
    if (badge.color) {
      return badge.color;
    }

    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32';
      if (badge.criteria_value <= 15) return '#c0c0c0';
      return '#ffd700';
    }
    return '#667eea';
  };

  // CSS für Animationen
  const shimmerKeyframes = `
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.3); }
      50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.5); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-3px); }
    }
  `;

  return (
    <div>
      <style>{shimmerKeyframes}</style>

      {/* Achievements Header - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #ff9500 0%, #e63946 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(255, 149, 0, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '220px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Überschrift - groß und überlappend */}
        <div style={{
          position: 'absolute',
          top: '-5px',
          left: '12px',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: '4rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            BADGES
          </h2>
        </div>

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '70px 24px 24px 24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <IonGrid style={{ padding: '0', margin: '0 4px' }}>
            <IonRow>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={trophy}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{badges.filter(b => b.is_earned && !b.is_hidden).length}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalVisible}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Badges
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={statsChart}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{Math.round((badges.filter(b => b.is_earned).length / (badgeStats.totalVisible + badgeStats.totalSecret)) * 100) || 0}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>%</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Gesamt
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={eyeOff}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{badges.filter(b => b.is_earned && b.is_hidden).length}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalSecret}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Geheim
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Filter Navigation */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonSegment
            value={selectedFilter}
            onIonChange={(e) => onFilterChange(e.detail.value as string)}
            style={{
              '--background': '#f8f9fa',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="nicht_erhalten">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Offen</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="in_arbeit">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>In Arbeit</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Badges nach Kategorien - VERTIKALES GRID */}
      <div style={{ paddingBottom: '16px' }}>
        {badgeCategories.length === 0 ? (
          <IonCard style={{ margin: '16px' }}>
            <IonCardContent>
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={trophyOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#ff9500',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Sammle Punkte für deine ersten Badges!</p>
              </div>
            </IonCardContent>
          </IonCard>
        ) : (
          badgeCategories.map((category) => {
            const earnedCount = category.badges.filter(b => b.is_earned).length;
            const totalCount = category.badges.length;
            const progressPercent = Math.round((earnedCount / totalCount) * 100);

            return (
              <div key={category.key} style={{ marginBottom: '28px' }}>
                {/* Kategorie Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}cc 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 4px 12px ${category.color}40`
                    }}>
                      <IonIcon
                        icon={category.icon}
                        style={{ fontSize: '1.3rem', color: 'white' }}
                      />
                    </div>
                    <div>
                      <h3 style={{
                        margin: '0',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#333'
                      }}>
                        {category.title}
                      </h3>
                      <span style={{
                        fontSize: '0.85rem',
                        color: '#888'
                      }}>
                        {earnedCount} von {totalCount}
                      </span>
                    </div>
                  </div>

                  {/* Progress Circle */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    position: 'relative'
                  }}>
                    <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        fill="none"
                        stroke="#e8e8e8"
                        strokeWidth="4"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        fill="none"
                        stroke={category.color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${progressPercent * 1.257} 125.7`}
                      />
                    </svg>
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: progressPercent === 100 && hasUndiscoveredSecrets ? '0.6rem' : '0.7rem',
                      fontWeight: '700',
                      color: category.color
                    }}>
                      {progressPercent === 100 && hasUndiscoveredSecrets ? '100%?' : `${progressPercent}%`}
                    </span>
                  </div>
                </div>

                {/* 2-Spalten Grid Container */}
                <IonGrid style={{ padding: '0 12px' }}>
                  <IonRow>
                    {category.badges.map((badge) => {
                      const badgeColor = getBadgeColor(badge);
                      const isEarned = badge.is_earned;
                      const hasProgress = !isEarned && badge.progress_percentage && badge.progress_percentage > 0;

                      return (
                        <IonCol size="6" sizeMd="3" key={badge.id} style={{ padding: '6px' }}>
                          <div style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            padding: '16px 12px',
                            textAlign: 'center',
                            position: 'relative',
                            border: isEarned
                              ? `2px solid ${badgeColor}40`
                              : '2px solid #f0f0f0',
                            boxShadow: isEarned
                              ? `0 6px 20px ${badgeColor}15`
                              : '0 2px 8px rgba(0,0,0,0.04)',
                            minHeight: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                          }}>

                            {/* Geheim-Badge Indikator */}
                            {badge.is_hidden && (
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                                color: 'white',
                                fontSize: '0.55rem',
                                fontWeight: '700',
                                padding: '3px 6px',
                                borderRadius: '8px',
                                boxShadow: '0 2px 6px rgba(255, 107, 53, 0.3)'
                              }}>
                                GEHEIM
                              </div>
                            )}

                            {/* Badge Icon Container */}
                            <div style={{
                              width: '70px',
                              height: '70px',
                              borderRadius: '50%',
                              marginBottom: '12px',
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isEarned
                                ? `linear-gradient(145deg, ${badgeColor} 0%, ${badgeColor}cc 100%)`
                                : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
                              boxShadow: isEarned
                                ? `0 6px 16px ${badgeColor}40`
                                : '0 3px 10px rgba(0,0,0,0.12)',
                              animation: isEarned ? 'float 3s ease-in-out infinite' : 'none'
                            }}>
                              {/* Äußerer Ring für erreichte Badges */}
                              {isEarned && (
                                <div style={{
                                  position: 'absolute',
                                  top: '-3px',
                                  left: '-3px',
                                  right: '-3px',
                                  bottom: '-3px',
                                  borderRadius: '50%',
                                  border: `2px solid ${badgeColor}50`,
                                  animation: 'pulse-glow 2.5s ease-in-out infinite'
                                }} />
                              )}

                              {/* Progress Ring für Badges in Arbeit */}
                              {hasProgress && (
                                <svg
                                  style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    left: '-5px',
                                    width: '80px',
                                    height: '80px',
                                    transform: 'rotate(-90deg)'
                                  }}
                                >
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r="36"
                                    fill="none"
                                    stroke="#e0e0e0"
                                    strokeWidth="3"
                                  />
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r="36"
                                    fill="none"
                                    stroke="#667eea"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(badge.progress_percentage || 0) * 2.26} 226`}
                                  />
                                </svg>
                              )}

                              {/* Lock Icon für nicht erreichte Badges */}
                              {!isEarned && !hasProgress && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '-2px',
                                  right: '-2px',
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: '#8e8e93',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                }}>
                                  <IonIcon icon={lockClosed} style={{ fontSize: '0.7rem', color: 'white' }} />
                                </div>
                              )}

                              {/* Badge Icon */}
                              <IonIcon
                                icon={getIconFromString(badge.icon)}
                                style={{
                                  fontSize: '2.2rem',
                                  color: isEarned ? 'white' : '#888',
                                  filter: isEarned
                                    ? 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))'
                                    : 'none',
                                  opacity: isEarned ? 1 : 0.6
                                }}
                              />
                            </div>

                            {/* Badge Name */}
                            <h4 style={{
                              margin: '0 0 6px 0',
                              fontSize: '0.95rem',
                              fontWeight: '700',
                              color: isEarned ? '#333' : '#888',
                              lineHeight: '1.2',
                              minHeight: '2.4em',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {badge.name}
                            </h4>

                            {/* Badge Beschreibung */}
                            <p style={{
                              margin: '0 0 10px 0',
                              fontSize: '0.8rem',
                              color: isEarned ? '#666' : '#aaa',
                              lineHeight: '1.35',
                              flex: 1,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {badge.description}
                            </p>

                            {/* Status Badge */}
                            {isEarned ? (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  background: `linear-gradient(135deg, ${badgeColor} 0%, ${badgeColor}dd 100%)`,
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  padding: '5px 10px',
                                  borderRadius: '16px',
                                  boxShadow: `0 3px 10px ${badgeColor}35`
                                }}>
                                  <IonIcon icon={checkmarkCircle} style={{ fontSize: '0.8rem' }} />
                                  ERREICHT
                                </div>
                                {badge.earned_at && (
                                  <div style={{
                                    marginTop: '6px',
                                    fontSize: '0.7rem',
                                    color: '#888'
                                  }}>
                                    am {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                                  </div>
                                )}
                              </div>
                            ) : hasProgress ? (
                              <div style={{ width: '100%' }}>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '5px'
                                }}>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    color: '#667eea'
                                  }}>
                                    Fortschritt
                                  </span>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    color: '#667eea'
                                  }}>
                                    {badge.progress_points}/{badge.criteria_value}
                                  </span>
                                </div>
                                <div style={{
                                  height: '5px',
                                  background: '#e8e8e8',
                                  borderRadius: '3px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${badge.progress_percentage}%`,
                                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: '3px'
                                  }} />
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#f0f0f0',
                                color: '#999',
                                fontSize: '0.65rem',
                                fontWeight: '600',
                                padding: '5px 10px',
                                borderRadius: '16px'
                              }}>
                                <IonIcon icon={lockClosed} style={{ fontSize: '0.7rem' }} />
                                GESPERRT
                              </div>
                            )}
                          </div>
                        </IonCol>
                      );
                    })}
                  </IonRow>
                </IonGrid>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BadgesView;
