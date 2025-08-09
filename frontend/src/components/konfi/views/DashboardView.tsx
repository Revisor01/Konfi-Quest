import React, { useState, useEffect } from 'react';
import {
  IonProgressBar,
  IonAvatar,
  IonBadge,
  IonIcon
} from '@ionic/react';
import { 
  trophy,
  checkmarkCircle,
  hourglass,
  time,
  location
} from 'ionicons/icons';
import axios from 'axios';

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
  const [actualDailyVerse, setActualDailyVerse] = useState<any>(null);
  const [loadingVerse, setLoadingVerse] = useState(true);

  // Load Tageslosung from API based on user's translation setting
  useEffect(() => {
    const loadTageslosung = async () => {
      try {
        // Get user's bible translation setting (default to BIGS)
        const translation = localStorage.getItem('bible_translation') || 'BIGS';
        const response = await axios.get(
          `https://losung.konfi-quest.de/?api_key=ksadh8324oijcff45rfdsvcvhoids44&translation=${translation}`
        );
        
        if (response.data) {
          setActualDailyVerse(response.data);
        }
      } catch (error) {
        console.error('Failed to load Tageslosung:', error);
        // Use fallback if provided
        if (dailyVerse) {
          setActualDailyVerse(dailyVerse);
        }
      } finally {
        setLoadingVerse(false);
      }
    };

    loadTageslosung();
  }, [dailyVerse]);

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

  const formatTimeUntil = (dateString: string) => {
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    if (diffDays < 0) return 'Vorbei';
    if (diffDays < 7) return `in ${diffDays} Tagen`;
    if (diffDays < 30) return `in ${Math.floor(diffDays / 7)} Wochen`;
    return `in ${Math.floor(diffDays / 30)} Monaten`;
  };

  const gottesdienstPoints = dashboardData.konfi.gottesdienst_points || 0;
  const gemeindePoints = dashboardData.konfi.gemeinde_points || 0;
  const totalPoints = dashboardData.total_points || 0;

  // Get next upcoming event
  const nextEvent = upcomingEvents
    .filter(e => !e.cancelled && new Date(e.event_date || e.date) >= new Date())
    .sort((a, b) => new Date(a.event_date || a.date).getTime() - new Date(b.event_date || b.date).getTime())[0];

  const cancelledEvents = upcomingEvents.filter(e => e.cancelled && e.is_registered);

  return (
    <div style={{ padding: '16px' }}>
      
      {/* Header Card - Dunkles Lila */}
      <div style={{
        background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '16px',
        boxShadow: '0 10px 40px rgba(91, 33, 182, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '150px',
          height: '150px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '50%'
        }}/>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <IonAvatar style={{ width: '60px', height: '60px' }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '1.5rem',
                backdropFilter: 'blur(10px)'
              }}>
                {getInitials(dashboardData.konfi.display_name)}
              </div>
            </IonAvatar>
            
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '1.8rem',
                fontWeight: '800',
                margin: '0 0 4px 0',
                color: 'white'
              }}>
                Hey {dashboardData.konfi.display_name}!
              </h2>
              <p style={{
                fontSize: '1rem',
                margin: '0 0 4px 0',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                {dashboardData.konfi.jahrgang_name}
              </p>
              {dashboardData.level_info?.current_level && (
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '8px',
                  padding: '4px 12px',
                  fontSize: '0.85rem',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  Level {dashboardData.level_info.current_level.title}
                </div>
              )}
            </div>
          </div>

          {/* Level Progress */}
          {dashboardData.level_info?.next_level && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px'
              }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                  Nächstes Level: {dashboardData.level_info.next_level.title}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                  {dashboardData.level_info.progress_percentage}%
                </span>
              </div>
              <IonProgressBar 
                value={dashboardData.level_info.progress_percentage / 100}
                style={{
                  '--progress-background': 'rgba(255, 255, 255, 0.8)',
                  '--background': 'rgba(255, 255, 255, 0.2)',
                  'height': '6px',
                  'borderRadius': '3px'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistiken Cards - Volle Breite */}
      <div style={{ marginBottom: '16px' }}>
        {/* Gottesdienst Progress */}
        {targetGottesdienst > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '12px',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.25)'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: 'white'
            }}>
              Gottesdienst
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'white' }}>
                {gottesdienstPoints}
              </span>
              <span style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                / {targetGottesdienst}
              </span>
            </div>
            <IonProgressBar 
              value={Math.min(gottesdienstPoints / targetGottesdienst, 1)}
              style={{
                '--progress-background': 'rgba(255, 255, 255, 0.9)',
                '--background': 'rgba(255, 255, 255, 0.3)',
                'height': '8px',
                'borderRadius': '4px'
              }}
            />
          </div>
        )}

        {/* Gemeinde Progress */}
        {targetGemeinde > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #2dd36f 0%, #10dc60 100%)',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '12px',
            boxShadow: '0 8px 32px rgba(45, 211, 111, 0.25)'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: 'white'
            }}>
              Gemeinde
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'white' }}>
                {gemeindePoints}
              </span>
              <span style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                / {targetGemeinde}
              </span>
            </div>
            <IonProgressBar 
              value={Math.min(gemeindePoints / targetGemeinde, 1)}
              style={{
                '--progress-background': 'rgba(255, 255, 255, 0.9)',
                '--background': 'rgba(255, 255, 255, 0.3)',
                'height': '8px',
                'borderRadius': '4px'
              }}
            />
          </div>
        )}
      </div>

      {/* Tage bis Konfirmation - Profil Gradient */}
      {dashboardData.days_to_confirmation !== null && dashboardData.days_to_confirmation !== undefined && (
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: 'white', lineHeight: '1' }}>
                {dashboardData.days_to_confirmation}
              </div>
              <div style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '4px' }}>
                Tage bis zur Konfirmation
              </div>
              {dashboardData.konfi.confirmation_location && (
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <IonIcon icon={location} style={{ fontSize: '1rem' }} />
                  {dashboardData.konfi.confirmation_location}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tageslosung - Chat Gradient */}
      {actualDailyVerse && !loadingVerse && (
        <div style={{
          background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(23, 162, 184, 0.25)'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'white'
          }}>
            Tageslosung
          </h3>
          <div style={{ color: 'white' }}>
            <p style={{ 
              fontSize: '1rem', 
              lineHeight: '1.5',
              fontStyle: 'italic',
              marginBottom: '8px'
            }}>
              "{actualDailyVerse.losungstext || actualDailyVerse.text}"
            </p>
            <p style={{ 
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.8)',
              textAlign: 'right'
            }}>
              {actualDailyVerse.losungsvers || actualDailyVerse.reference}
            </p>
          </div>
        </div>
      )}

      {/* Neue Badges - Orange Gradient */}
      {badgeStats.totalEarned > 0 && dashboardData.recent_badges.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #ff9500 0%, #e63946 100%)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(255, 149, 0, 0.25)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'white'
          }}>
            Neue Badges
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {dashboardData.recent_badges.slice(0, 4).map((badge) => (
              <div 
                key={badge.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem'
                }}>
                  {badge.icon || '🏆'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: '600',
                    color: 'white',
                    lineHeight: '1.2'
                  }}>
                    {badge.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events - Rot Gradient */}
      {nextEvent && (
        <div style={{
          background: 'linear-gradient(135deg, #eb445a 0%, #e91e63 100%)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(235, 68, 90, 0.25)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'white'
          }}>
            Nächstes Event
          </h3>
          <div style={{ color: 'white' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px' }}>
              {nextEvent.title || nextEvent.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <IonIcon icon={time} />
              {formatTimeUntil(nextEvent.event_date || nextEvent.date)}
            </div>
            {nextEvent.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '4px' }}>
                <IonIcon icon={location} />
                {nextEvent.location}
              </div>
            )}
            {nextEvent.on_waitlist && (
              <IonBadge color="warning" style={{ marginTop: '8px' }}>
                Auf Warteliste
              </IonBadge>
            )}
          </div>
        </div>
      )}

      {/* Abgesagte Events */}
      {cancelledEvents.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(220, 53, 69, 0.25)'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'white'
          }}>
            Abgesagt
          </h3>
          {cancelledEvents.map((event) => (
            <div key={event.id} style={{ 
              color: 'white',
              padding: '8px 0',
              borderBottom: cancelledEvents.indexOf(event) < cancelledEvents.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'
            }}>
              <div style={{ fontSize: '1rem', fontWeight: '600' }}>
                {event.title || event.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                {formatDate(event.event_date || event.date)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ranking - Aktivitäten Grün */}
      {dashboardData.ranking && dashboardData.ranking.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #2dd36f 0%, #10dc60 100%)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(45, 211, 111, 0.25)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'white'
          }}>
            Ranking
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
            {(() => {
              const topThree = dashboardData.ranking.slice(0, 3);
              // Podium order: 2nd - 1st - 3rd
              const podiumOrder = topThree.length >= 2 
                ? [topThree[1], topThree[0], topThree[2]].filter(Boolean)
                : topThree;
              
              const realRanks = podiumOrder.map(player => 
                dashboardData.ranking.findIndex(p => p.id === player.id) + 1
              );
              
              const heights = ['60px', '80px', '40px'];
              const medalColors: { [key: number]: string } = {1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32'};
              
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
                      flex: 1
                    }}
                  >
                    <IonAvatar style={{ 
                      width: visualIndex === 1 ? '50px' : '40px', 
                      height: visualIndex === 1 ? '50px' : '40px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: isMe 
                          ? 'rgba(255, 255, 255, 0.9)'
                          : 'rgba(255, 255, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isMe ? '#2dd36f' : 'white',
                        fontWeight: '700',
                        fontSize: visualIndex === 1 ? '1rem' : '0.8rem',
                        border: `2px solid ${medalColors[realRank] || 'rgba(255,255,255,0.5)'}`
                      }}>
                        {getInitials(player.display_name)}
                      </div>
                    </IonAvatar>
                    
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      width: '100%',
                      height: heights[visualIndex],
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '800',
                        color: 'white'
                      }}>
                        {realRank}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontWeight: '600'
                      }}>
                        {player.points} Pkt
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;