import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonProgressBar,
  IonAvatar,
  IonChip,
  IonBadge
} from '@ionic/react';
import {
  calendar,
  trophy,
  star,
  flash,
  sparkles,
  location,
  time,
  checkmarkCircle,
  book,
  ribbon,
  people,
  statsChart,
  flame,
  rocket,
  heart,
  diamond,
  gift
} from 'ionicons/icons';

interface DashboardData {
  konfi: {
    id: number;
    display_name: string;
    jahrgang_name: string;
    gottesdienst_points: number;
    gemeinde_points: number;
    confirmation_date?: string;
    confirmation_location?: string;
  };
  total_points: number;
  recent_badges: any[];
  badge_count: number;
  recent_events: any[];
  event_count: number;
  ranking: any[];
  days_to_confirmation?: number;
  confirmation_date?: string;
  level_info?: {
    current_level?: {
      id: number;
      name: string;
      title: string;
      icon: string;
      color: string;
      points_required: number;
    };
    next_level?: {
      id: number;
      name: string;
      title: string;
      icon: string;
      color: string;
      points_required: number;
    };
    progress_percentage: number;
    points_to_next_level: number;
  };
}

interface DailyVerse {
  losungstext: string;
  losungsvers: string;
  lehrtext: string;
  lehrtextvers: string;
  date?: string;
  translation?: string;
  fallback?: boolean;
  cached?: boolean;
}

interface BadgeStats {
  totalAvailable: number;
  totalEarned: number;
  secretAvailable: number;
  secretEarned: number;
}

interface DashboardViewProps {
  dashboardData: DashboardData;
  dailyVerse: DailyVerse | null;
  badgeStats: BadgeStats;
  upcomingEvents: any[];
  targetGottesdienst: number;
  targetGemeinde: number;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  dailyVerse,
  badgeStats,
  upcomingEvents,
  targetGottesdienst,
  targetGemeinde
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const gottesdienstPoints = dashboardData.konfi.gottesdienst_points || 0;
  const gemeindePoints = dashboardData.konfi.gemeinde_points || 0;
  const totalPoints = dashboardData.total_points || 0;
  const maxPoints = targetGottesdienst + targetGemeinde;

  // Berechne Fortschritt als Prozent
  const overallProgress = Math.min((totalPoints / maxPoints) * 100, 100);

  return (
    <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', padding: '16px' }}>
      {/* Header mit Gradient und Name/Level */}
      <div style={{
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(255, 107, 107, 0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Überschrift Hintergrund */}
        <div style={{
          position: 'absolute',
          top: '-5px',
          left: '12px',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: '4.5rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            KONFI
          </h2>
          <h2 style={{
            fontSize: '4.5rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            QUEST
          </h2>
        </div>
        
        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          paddingTop: '80px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <IonAvatar style={{ width: '80px', height: '80px' }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '1.8rem',
                border: '4px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)'
              }}>
                {getInitials(dashboardData.konfi.display_name)}
              </div>
            </IonAvatar>
            
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '800',
                margin: '0 0 4px 0',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                Hey {dashboardData.konfi.display_name}!
              </h1>
              <p style={{
                fontSize: '1.1rem',
                margin: '0 0 8px 0',
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '600'
              }}>
                {dashboardData.konfi.jahrgang_name}
              </p>
              
              {/* Level Anzeige */}
              {dashboardData.level_info?.current_level && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {dashboardData.level_info.current_level.icon}
                  </span>
                  <span style={{ 
                    color: 'white', 
                    fontWeight: '700',
                    fontSize: '0.9rem'
                  }}>
                    {dashboardData.level_info.current_level.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid - XX/XX Format */}
          <IonGrid style={{ padding: '0' }}>
            <IonRow>
              <IonCol size="4">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <IonIcon 
                    icon={star} 
                    style={{ 
                      fontSize: '2rem', 
                      color: '#ffd700', 
                      marginBottom: '8px',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                    }} 
                  />
                  <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'white' }}>
                    {totalPoints}/{maxPoints}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                    Gesamt
                  </div>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <IonIcon 
                    icon={trophy} 
                    style={{ 
                      fontSize: '2rem', 
                      color: '#ff9500', 
                      marginBottom: '8px',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                    }} 
                  />
                  <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'white' }}>
                    {badgeStats.totalEarned}/{badgeStats.totalAvailable}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                    Badges
                  </div>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <IonIcon 
                    icon={statsChart} 
                    style={{ 
                      fontSize: '2rem', 
                      color: '#2dd36f', 
                      marginBottom: '8px',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                    }} 
                  />
                  <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'white' }}>
                    {Math.round(overallProgress)}%
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                    Fortschritt
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* Level Progress */}
          {dashboardData.level_info?.next_level && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '16px',
              padding: '16px',
              marginTop: '16px',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600' }}>
                  Nächstes Level: {dashboardData.level_info.next_level.title}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'white' }}>
                  {dashboardData.level_info.progress_percentage}%
                </span>
              </div>
              
              <IonProgressBar 
                value={dashboardData.level_info.progress_percentage / 100}
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  '--progress-background': 'linear-gradient(90deg, #4facfe, #00f2fe)',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
              
              <div style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.8)',
                marginTop: '4px',
                textAlign: 'center'
              }}>
                Noch {dashboardData.level_info.points_to_next_level} Punkte
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2x2 Grid für Cards */}
      <IonGrid style={{ padding: '0' }}>
        <IonRow>
          {/* Countdown bis zur Konfirmation */}
          <IonCol size="6">
            {dashboardData.days_to_confirmation !== undefined ? (
              <IonCard style={{ 
                margin: '0 8px 16px 0',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                border: 'none',
                height: '140px'
              }}>
                <IonCardContent style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon 
                      icon={calendar} 
                      style={{ 
                        fontSize: '2rem', 
                        color: 'white',
                        marginBottom: '8px',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                      }} 
                    />
                    <div style={{ 
                      fontSize: '2rem', 
                      fontWeight: '800',
                      color: 'white',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      {dashboardData.days_to_confirmation}
                    </div>
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Tage bis Konfi
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            ) : (
              <IonCard style={{ 
                margin: '0 8px 16px 0',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                border: 'none',
                height: '140px'
              }}>
                <IonCardContent style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon 
                      icon={heart} 
                      style={{ 
                        fontSize: '2rem', 
                        color: '#ff6b6b',
                        marginBottom: '8px'
                      }} 
                    />
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: '700',
                      color: '#333'
                    }}>
                      Konfi-Zeit
                    </div>
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: '#666',
                      fontWeight: '500'
                    }}>
                      Genieße jeden Tag!
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            )}
          </IonCol>

          {/* Tageslosung */}
          <IonCol size="6">
            <IonCard style={{ 
              margin: '0 0 16px 8px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              height: '140px'
            }}>
              <IonCardContent style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {dailyVerse ? (
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon 
                      icon={book} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'white',
                        marginBottom: '8px'
                      }} 
                    />
                    <div style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: '600',
                      color: 'white',
                      lineHeight: '1.3',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      "{dailyVerse.losungstext.substring(0, 60)}..."
                    </div>
                    <div style={{ 
                      fontSize: '0.6rem', 
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontWeight: '500'
                    }}>
                      {dailyVerse.losungsvers}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon 
                      icon={book} 
                      style={{ 
                        fontSize: '2rem', 
                        color: 'white',
                        marginBottom: '8px'
                      }} 
                    />
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: '700',
                      color: 'white'
                    }}>
                      Tageslosung
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>

        <IonRow>
          {/* Recent Badges - 2er Grid */}
          <IonCol size="6">
            <IonCard style={{ 
              margin: '0 8px 16px 0',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)',
              border: 'none',
              height: '140px'
            }}>
              <IonCardContent style={{ padding: '16px', height: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <IonIcon 
                    icon={trophy} 
                    style={{ 
                      fontSize: '1.2rem', 
                      color: 'white'
                    }} 
                  />
                  <span style={{ 
                    fontWeight: '700', 
                    fontSize: '0.9rem',
                    color: 'white'
                  }}>
                    Neueste Badges
                  </span>
                </div>

                {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {dashboardData.recent_badges.slice(0, 2).map((badge, index) => (
                      <div 
                        key={badge.id || index}
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '12px',
                          padding: '8px',
                          textAlign: 'center',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <IonIcon 
                          icon={trophy} 
                          style={{ 
                            fontSize: '1.5rem', 
                            color: 'white',
                            marginBottom: '4px'
                          }}
                        />
                        <div style={{
                          fontSize: '0.6rem',
                          fontWeight: '600',
                          color: 'white',
                          lineHeight: '1.2',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {badge.name}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <IonIcon 
                      icon={rocket} 
                      style={{ 
                        fontSize: '2rem', 
                        color: 'white',
                        marginBottom: '4px'
                      }}
                    />
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: 'white',
                      fontWeight: '600'
                    }}>
                      Erstes Badge wartet!
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonCol>

          {/* Top 3 Ranking */}
          <IonCol size="6">
            <IonCard style={{ 
              margin: '0 0 16px 8px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              height: '140px'
            }}>
              <IonCardContent style={{ padding: '16px', height: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <IonIcon 
                    icon={flame} 
                    style={{ 
                      fontSize: '1.2rem', 
                      color: '#ffd700'
                    }} 
                  />
                  <span style={{ 
                    fontWeight: '700', 
                    fontSize: '0.9rem',
                    color: 'white'
                  }}>
                    Top 3
                  </span>
                </div>

                {dashboardData.ranking && dashboardData.ranking.length > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
                    {(() => {
                      const topThree = dashboardData.ranking.slice(0, 3);
                      // Podest-Anordnung: 2. Platz - 1. Platz - 3. Platz
                      const podiumOrder = topThree.length >= 2 
                        ? [topThree[1], topThree[0], topThree[2]].filter(Boolean)
                        : topThree;
                      
                      const realRanks = podiumOrder.map(player => 
                        dashboardData.ranking.findIndex(p => p.id === player.id) + 1
                      );
                      
                      const heights = ['36px', '44px', '28px']; // Höhen für Podest-Effekt
                      const medalColors = {1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32'};
                      
                      return podiumOrder.map((player, visualIndex) => {
                        const realRank = realRanks[visualIndex];
                        const isMe = player.id === dashboardData.konfi.id;
                        
                        return (
                          <div 
                            key={player.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              flex: 1,
                              marginBottom: visualIndex === 1 ? '0' : visualIndex === 0 ? '8px' : '16px'
                            }}
                          >
                            <IonAvatar style={{ 
                              width: heights[visualIndex], 
                              height: heights[visualIndex],
                              marginBottom: '4px'
                            }}>
                              <div style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                background: isMe 
                                  ? 'linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)'
                                  : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: visualIndex === 1 ? '0.8rem' : '0.6rem',
                                border: `2px solid ${medalColors[realRank]}`,
                                boxShadow: `0 2px 8px ${medalColors[realRank]}50`
                              }}>
                                {getInitials(player.display_name)}
                              </div>
                            </IonAvatar>
                            <div style={{ 
                              width: '18px', 
                              height: '18px', 
                              borderRadius: '50%',
                              background: medalColors[realRank],
                              marginBottom: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.6rem',
                              fontWeight: '800',
                              color: 'white',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}>
                              {realRank}
                            </div>
                            <div style={{
                              fontSize: '0.55rem',
                              fontWeight: '600',
                              color: isMe ? '#ffd700' : 'white',
                              textAlign: 'center'
                            }}>
                              {player.display_name.split(' ')[0]}
                            </div>
                            <div style={{
                              fontSize: '0.5rem',
                              fontWeight: '500',
                              color: 'rgba(255, 255, 255, 0.8)'
                            }}>
                              {player.points}P
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <IonIcon 
                      icon={flame} 
                      style={{ 
                        fontSize: '2rem', 
                        color: 'white',
                        marginBottom: '4px'
                      }}
                    />
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: 'white',
                      fontWeight: '600'
                    }}>
                      Sei der Erste!
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>
      </IonGrid>

      {/* Nächste Events - Full Width */}
      {upcomingEvents && upcomingEvents.length > 0 && (
        <IonCard style={{ 
          margin: '0 0 16px 0',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
          border: 'none'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '16px'
            }}>
              <IonIcon 
                icon={calendar} 
                style={{ 
                  fontSize: '1.5rem', 
                  color: '#ff6b6b'
                }} 
              />
              <h2 style={{ 
                fontWeight: '700', 
                fontSize: '1.2rem',
                margin: '0',
                color: '#333'
              }}>
                Deine nächsten Events
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingEvents.slice(0, 3).map(event => (
                <div 
                  key={event.id}
                  style={{
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{
                        margin: '0 0 4px 0',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#333'
                      }}>
                        {event.name || event.title}
                      </h4>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.75rem',
                        color: '#666'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={calendar} style={{ fontSize: '0.75rem' }} />
                          {new Date(event.event_date || event.date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </span>
                        {event.location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={location} style={{ fontSize: '0.75rem' }} />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {event.is_registered && (
                      <IonChip 
                        style={{ 
                          '--background': '#2dd36f',
                          '--color': 'white',
                          height: '24px',
                          fontSize: '0.7rem'
                        }}
                      >
                        <IonIcon icon={checkmarkCircle} />
                        <span>Angemeldet</span>
                      </IonChip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </IonCardContent>
        </IonCard>
      )}
    </div>
  );
};

export default DashboardView;