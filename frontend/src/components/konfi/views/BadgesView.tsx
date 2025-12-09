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
  IonLabel,
  IonProgressBar
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
  lockClosed
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
  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitaeten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitaeten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitaeten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitaeten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitaeten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitaeten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitaeten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitaeten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitaeten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitaeten' },
  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebaeude', category: 'Orte' },
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

  const getFilteredBadges = () => {
    let filtered;
    switch (selectedFilter) {
      case 'alle':
        filtered = badges;
        break;
      case 'nicht_erhalten':
        filtered = badges.filter(badge => !badge.is_earned);
        break;
      case 'in_arbeit':
        filtered = badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0);
        break;
      default:
        filtered = badges;
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getBadgeColor = (badge: Badge) => {
    if (badge.color) {
      return badge.color;
    }

    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32'; // Bronze
      if (badge.criteria_value <= 15) return '#c0c0c0'; // Silver
      return '#ffd700'; // Gold
    }
    return '#667eea'; // Default
  };

  const filteredBadges = getFilteredBadges();

  // CSS für Animationen
  const shimmerKeyframes = `
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2); }
      50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.3); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-5px); }
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
                    <span style={{ fontSize: '1.5rem' }}>{Math.round((badges.filter(b => b.is_earned).length / badges.length) * 100) || 0}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>%</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Erreicht
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
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem'  }}>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="nicht_erhalten">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem'  }}>Nicht erhalten</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="in_arbeit">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem'  }}>In Arbeit</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Badges Grid - Neues ansprechendes Design */}
      <div style={{ padding: '0 16px 16px 16px' }}>
        {filteredBadges.length === 0 ? (
          <IonCard>
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
          <IonGrid style={{ padding: '0' }}>
            <IonRow>
              {filteredBadges.map((badge) => {
                const badgeColor = getBadgeColor(badge);
                const isEarned = badge.is_earned;
                const hasProgress = !isEarned && badge.progress_percentage && badge.progress_percentage > 0;

                return (
                  <IonCol size="6" sizeMd="4" sizeLg="3" key={badge.id} style={{ padding: '6px' }}>
                    <div style={{
                      background: isEarned
                        ? `linear-gradient(145deg, ${badgeColor}15 0%, ${badgeColor}08 50%, #ffffff 100%)`
                        : 'linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%)',
                      borderRadius: '20px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      position: 'relative',
                      border: isEarned
                        ? `2px solid ${badgeColor}40`
                        : '2px solid #e8e8e8',
                      boxShadow: isEarned
                        ? `0 8px 24px ${badgeColor}25, 0 4px 12px rgba(0,0,0,0.08)`
                        : '0 4px 12px rgba(0,0,0,0.06)',
                      transition: 'all 0.3s ease',
                      overflow: 'hidden'
                    }}>
                      {/* Shimmer-Effekt für erreichte Badges */}
                      {isEarned && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: `linear-gradient(90deg, transparent 0%, ${badgeColor}10 50%, transparent 100%)`,
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 3s ease-in-out infinite',
                          pointerEvents: 'none'
                        }} />
                      )}

                      {/* Geheim-Badge Indikator */}
                      {badge.is_hidden && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                          color: 'white',
                          fontSize: '0.6rem',
                          fontWeight: '700',
                          padding: '4px 8px',
                          borderRadius: '10px',
                          boxShadow: '0 2px 8px rgba(255, 107, 53, 0.4)',
                          zIndex: 10
                        }}>
                          GEHEIM
                        </div>
                      )}

                      {/* Badge Icon Container - Groß und rund */}
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        margin: '0 auto 16px auto',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isEarned
                          ? `linear-gradient(145deg, ${badgeColor} 0%, ${badgeColor}cc 100%)`
                          : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
                        boxShadow: isEarned
                          ? `0 8px 20px ${badgeColor}50, inset 0 2px 4px rgba(255,255,255,0.3)`
                          : '0 4px 12px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.2)',
                        animation: isEarned ? 'float 3s ease-in-out infinite' : 'none'
                      }}>
                        {/* Äußerer Ring für erreichte Badges */}
                        {isEarned && (
                          <div style={{
                            position: 'absolute',
                            top: '-4px',
                            left: '-4px',
                            right: '-4px',
                            bottom: '-4px',
                            borderRadius: '50%',
                            border: `3px solid ${badgeColor}60`,
                            animation: 'pulse-glow 2s ease-in-out infinite'
                          }} />
                        )}

                        {/* Progress Ring für Badges in Arbeit */}
                        {hasProgress && (
                          <svg
                            style={{
                              position: 'absolute',
                              top: '-6px',
                              left: '-6px',
                              width: '92px',
                              height: '92px',
                              transform: 'rotate(-90deg)'
                            }}
                          >
                            <circle
                              cx="46"
                              cy="46"
                              r="42"
                              fill="none"
                              stroke="#e0e0e0"
                              strokeWidth="4"
                            />
                            <circle
                              cx="46"
                              cy="46"
                              r="42"
                              fill="none"
                              stroke="#667eea"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${(badge.progress_percentage || 0) * 2.64} 264`}
                              style={{
                                transition: 'stroke-dasharray 0.5s ease'
                              }}
                            />
                          </svg>
                        )}

                        {/* Lock Icon für nicht erreichte Badges */}
                        {!isEarned && !hasProgress && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#8e8e93',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}>
                            <IonIcon icon={lockClosed} style={{ fontSize: '0.75rem', color: 'white' }} />
                          </div>
                        )}

                        {/* Badge Icon */}
                        <IonIcon
                          icon={getIconFromString(badge.icon)}
                          style={{
                            fontSize: '2.5rem',
                            color: isEarned ? 'white' : '#888',
                            filter: isEarned
                              ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                              : 'none',
                            opacity: isEarned ? 1 : 0.6
                          }}
                        />
                      </div>

                      {/* Badge Name */}
                      <h3 style={{
                        margin: '0 0 6px 0',
                        fontSize: '0.95rem',
                        fontWeight: '700',
                        color: isEarned ? '#333' : '#888',
                        lineHeight: '1.2'
                      }}>
                        {badge.name}
                      </h3>

                      {/* Badge Beschreibung */}
                      <p style={{
                        margin: '0 0 12px 0',
                        fontSize: '0.75rem',
                        color: isEarned ? '#666' : '#aaa',
                        lineHeight: '1.4',
                        minHeight: '2.8em',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {badge.description}
                      </p>

                      {/* Status Badge */}
                      {isEarned ? (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: `linear-gradient(135deg, ${badgeColor} 0%, ${badgeColor}dd 100%)`,
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          boxShadow: `0 4px 12px ${badgeColor}40`
                        }}>
                          <IonIcon icon={checkmarkCircle} style={{ fontSize: '0.85rem' }} />
                          FREIGESCHALTET
                        </div>
                      ) : hasProgress ? (
                        <div style={{ width: '100%' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px'
                          }}>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              color: '#667eea'
                            }}>
                              In Arbeit
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
                            height: '6px',
                            background: '#e8e8e8',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${badge.progress_percentage}%`,
                              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: '3px',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#f0f0f0',
                          color: '#999',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          padding: '6px 12px',
                          borderRadius: '20px'
                        }}>
                          <IonIcon icon={lockClosed} style={{ fontSize: '0.75rem' }} />
                          GESPERRT
                        </div>
                      )}

                      {/* Datum für erreichte Badges */}
                      {isEarned && badge.earned_at && (
                        <div style={{
                          marginTop: '8px',
                          fontSize: '0.65rem',
                          color: '#999'
                        }}>
                          Erreicht am {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                        </div>
                      )}

                      {/* Punkte-Anzeige */}
                      {badge.criteria_value > 0 && badge.criteria_type === 'total_points' && (
                        <div style={{
                          position: 'absolute',
                          bottom: '10px',
                          left: '10px',
                          fontSize: '0.6rem',
                          fontWeight: '700',
                          color: isEarned ? badgeColor : '#bbb',
                          background: isEarned ? `${badgeColor}15` : '#f5f5f5',
                          padding: '3px 8px',
                          borderRadius: '8px'
                        }}>
                          {badge.criteria_value} Pkt
                        </div>
                      )}
                    </div>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        )}
      </div>
    </div>
  );
};

export default BadgesView;
