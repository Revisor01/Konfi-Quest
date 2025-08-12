import React, { useState, useEffect } from 'react';
import {
  IonProgressBar,
  IonAvatar,
  IonIcon
} from '@ionic/react';
import { 
  time,
  location,
  calendar,
  eyeOff,
  star
} from 'ionicons/icons';
import api from '../../../services/api';

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
  badgeStats: _badgeStats,
  upcomingEvents,
  targetGottesdienst,
  targetGemeinde
}) => {
  const [actualDailyVerse, setActualDailyVerse] = useState<any>(null);
  const [loadingVerse, setLoadingVerse] = useState(true);

  // Load Tageslosung directly from backend
  useEffect(() => {
    const loadTageslosung = async () => {
      try {
        console.log('Loading Tageslosung from backend...');
        const response = await api.get('/konfi/tageslosung');
        
        if (response.data && response.data.success) {
          const { losung, lehrtext } = response.data.data;
          setActualDailyVerse({
            losungstext: losung?.text,
            losungsvers: losung?.reference,
            lehrtext: lehrtext?.text,
            lehrtextvers: lehrtext?.reference
          });
          console.log('Tageslosung loaded successfully from backend');
        } else {
          console.error('Invalid response from backend:', response.data);
          setActualDailyVerse(null);
        }
      } catch (error: any) {
        console.error('Failed to load Tageslosung from backend:', error);
        setActualDailyVerse(null);
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

  const getFirstName = (name: string) => {
    return name.split(' ')[0];
  };


  const formatTimeUntil = (dateString: string) => {
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    if (diffDays < 0) return 'Vorbei';
    if (diffDays === 1) return '1 Tag';
    if (diffDays < 7) return `${diffDays} Tage`;
    if (diffDays < 14) return '1 Woche';
    if (diffDays < 21) return '2 Wochen';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} Wochen`;
    // Verwende weiterhin Tage für längere Zeiträume statt Monate
    if (diffDays < 365) return `${diffDays} Tage`;
    return `${Math.floor(diffDays / 365)} Jahr${Math.floor(diffDays / 365) > 1 ? 'e' : ''}`;
  };

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const getBadgeColor = (badge: any) => {
    if (badge.color) return badge.color;
    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32'; // Bronze
      if (badge.criteria_value <= 15) return '#c0c0c0'; // Silver
      return '#ffd700'; // Gold
    }
    return '#667eea'; // Default
  };

  const gottesdienstPoints = dashboardData.konfi.gottesdienst_points || 0;
  const gemeindePoints = dashboardData.konfi.gemeinde_points || 0;
  const totalTarget = targetGottesdienst + targetGemeinde;
  const totalCurrentPoints = gottesdienstPoints + gemeindePoints;

  // Separate confirmation events from regular events
  const allUpcomingEvents = upcomingEvents
    .filter(e => new Date(e.event_date || e.date) >= new Date())
    .sort((a, b) => new Date(a.event_date || a.date).getTime() - new Date(b.event_date || b.date).getTime());

  const confirmationEvents = allUpcomingEvents
    .filter(e => e.title?.toLowerCase().includes('konfirmation') || e.name?.toLowerCase().includes('konfirmation'));

  const regularEvents = allUpcomingEvents
    .filter(e => !e.title?.toLowerCase().includes('konfirmation') && !e.name?.toLowerCase().includes('konfirmation'))
    .slice(0, 3);

  const nextConfirmationEvent = confirmationEvents.length > 0 ? confirmationEvents[0] : null;

  return (
    <div style={{ padding: '16px' }}>
      
      {/* Header Card mit kombiniertem Progress */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
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
                  {dashboardData.level_info.current_level.title}
                </div>
              )}
            </div>
          </div>

          {/* Kombinierter Gesamtprogress */}
          {(targetGottesdienst > 0 || targetGemeinde > 0) && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '16px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'baseline', 
                gap: '8px', 
                marginBottom: '12px',
                justifyContent: 'center'
              }}>
                <span style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '900', 
                  color: 'white' 
                }}>
                  {totalCurrentPoints}
                </span>
                <span style={{ 
                  fontSize: '1.5rem', 
                  color: 'rgba(255, 255, 255, 0.7)' 
                }}>
                  / {totalTarget}
                </span>
              </div>
              
              {/* Zwei kleine Progress Bars */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {targetGottesdienst > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginBottom: '4px'
                    }}>
                      Gottesdienst: {gottesdienstPoints}/{targetGottesdienst}
                    </div>
                    <IonProgressBar 
                      value={Math.min(gottesdienstPoints / targetGottesdienst, 1)}
                      style={{
                        '--progress-background': 'rgba(255, 255, 255, 0.9)',
                        '--background': 'rgba(255, 255, 255, 0.3)',
                        'height': '4px',
                        'borderRadius': '2px'
                      }}
                    />
                  </div>
                )}
                {targetGemeinde > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginBottom: '4px'
                    }}>
                      Gemeinde: {gemeindePoints}/{targetGemeinde}
                    </div>
                    <IonProgressBar 
                      value={Math.min(gemeindePoints / targetGemeinde, 1)}
                      style={{
                        '--progress-background': 'rgba(255, 255, 255, 0.9)',
                        '--background': 'rgba(255, 255, 255, 0.3)',
                        'height': '4px',
                        'borderRadius': '2px'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

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
                  {dashboardData.level_info.points_to_next_level ? `noch ${dashboardData.level_info.points_to_next_level} Punkte` : `${dashboardData.level_info.progress_percentage}%`}
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

      {/* Konfirmation Card */}
      {(dashboardData.days_to_confirmation !== null && dashboardData.days_to_confirmation !== undefined) || nextConfirmationEvent ? (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
          borderRadius: '20px',
          padding: '0',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(30, 58, 138, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '160px'
        }}>
          {/* Background Text */}
          <div style={{
            position: 'absolute',
            top: '-15px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              DEINE
            </h2>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              KONFIRMATION
            </h2>
          </div>

          <div style={{ 
            position: 'relative', 
            zIndex: 2, 
            padding: '60px 24px 24px 24px',
            textAlign: 'center'
          }}>
            {dashboardData.days_to_confirmation !== null && dashboardData.days_to_confirmation !== undefined ? (
              <>
                <div style={{ fontSize: '3.5rem', fontWeight: '900', color: 'white', lineHeight: '1', marginBottom: '8px' }}>
                  {dashboardData.days_to_confirmation}
                </div>
                <div style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '12px' }}>
                  {dashboardData.days_to_confirmation === 1 
                    ? `Genau 1 Tag bis zu deiner Konfirmation` 
                    : `Noch genau ${dashboardData.days_to_confirmation} Tage bis zu deiner Konfirmation`
                  }
                </div>
              </>
            ) : nextConfirmationEvent ? (
              <>
                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', lineHeight: '1', marginBottom: '8px' }}>
                  {formatTimeUntil(nextConfirmationEvent.event_date || nextConfirmationEvent.date)}
                </div>
                <div style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '12px' }}>
                  bis zu deiner Konfirmation
                </div>
              </>
            ) : null}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {nextConfirmationEvent && (
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <IonIcon icon={calendar} style={{ fontSize: '0.85rem' }} />
                  {formatEventDate(nextConfirmationEvent.event_date || nextConfirmationEvent.date)} um {formatEventTime(nextConfirmationEvent.event_date || nextConfirmationEvent.date)}
                </div>
              )}
              {(dashboardData.konfi.confirmation_location || nextConfirmationEvent?.location) && (
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: 'rgba(255, 255, 255, 0.75)', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <IonIcon icon={location} style={{ fontSize: '0.85rem' }} />
                  {dashboardData.konfi.confirmation_location || nextConfirmationEvent?.location}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Tageslosung - nur wenn echte API-Daten verfügbar */}
      {!loadingVerse && actualDailyVerse && (actualDailyVerse.losungstext || actualDailyVerse.lehrtext) && (
        <div style={{
          background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
          borderRadius: '20px',
          padding: '0',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(23, 162, 184, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '160px'
        }}>
          {/* Background Text */}
          <div style={{
            position: 'absolute',
            top: '-15px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              TAGES
            </h2>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              LOSUNG
            </h2>
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 24px 24px 24px' }}>
            {(() => {
              // Zeige beide Texte (AT und NT) wenn verfügbar
              const hasLosung = actualDailyVerse.losungstext;
              const hasLehrtext = actualDailyVerse.lehrtext;
              
              if (hasLosung && hasLehrtext) {
                // Beide verfügbar - zufällig einen auswählen oder beide zeigen
                const showLosung = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % 2 === 0; // Wechselt täglich
                
                return (
                  <div>
                    <div style={{ marginBottom: hasLosung && hasLehrtext ? '20px' : '0' }}>
                      <blockquote style={{ 
                        fontSize: '1.2rem', 
                        lineHeight: '1.5',
                        fontStyle: 'italic',
                        marginBottom: '12px',
                        color: 'white',
                        fontWeight: '400',
                        margin: '0 0 12px 0',
                        textAlign: 'center',
                        fontFamily: 'Georgia, serif'
                      }}>
                        "{showLosung ? actualDailyVerse.losungstext : actualDailyVerse.lehrtext}"
                      </blockquote>
                      <cite style={{ 
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.85)',
                        textAlign: 'center',
                        fontWeight: '600',
                        display: 'block',
                        fontStyle: 'normal'
                      }}>
                        {showLosung ? actualDailyVerse.losungsvers : actualDailyVerse.lehrtextvers}
                      </cite>
                      
                      {/* Zeige auch den anderen Text kleiner */}
                      <div style={{ 
                        marginTop: '16px',
                        padding: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <div style={{ 
                          fontSize: '0.9rem', 
                          lineHeight: '1.4',
                          fontStyle: 'italic',
                          marginBottom: '6px',
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontWeight: '400',
                          textAlign: 'center',
                          fontFamily: 'Georgia, serif'
                        }}>
                          "{!showLosung ? actualDailyVerse.losungstext : actualDailyVerse.lehrtext}"
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                          textAlign: 'center',
                          fontWeight: '500',
                          fontStyle: 'normal'
                        }}>
                          {!showLosung ? actualDailyVerse.losungsvers : actualDailyVerse.lehrtextvers}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Nur einer verfügbar
                const text = hasLosung ? actualDailyVerse.losungstext : actualDailyVerse.lehrtext || actualDailyVerse.text;
                const reference = hasLosung ? actualDailyVerse.losungsvers : actualDailyVerse.lehrtextvers || actualDailyVerse.reference;
                
                return (
                  <div>
                    <blockquote style={{ 
                      fontSize: '1.25rem', 
                      lineHeight: '1.5',
                      fontStyle: 'italic',
                      marginBottom: '16px',
                      color: 'white',
                      fontWeight: '400',
                      margin: '0 0 16px 0',
                      textAlign: 'center',
                      fontFamily: 'Georgia, serif'
                    }}>
                      "{text}"
                    </blockquote>
                    <cite style={{ 
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.85)',
                      textAlign: 'center',
                      fontWeight: '500',
                      display: 'block',
                      fontStyle: 'normal'
                    }}>
                      {reference}
                    </cite>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {/* Badges Section */}
      {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #ff9500 0%, #e63946 100%)',
          borderRadius: '20px',
          padding: '0',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(255, 149, 0, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '180px'
        }}>
          {/* Background Text */}
          <div style={{
            position: 'absolute',
            top: '-15px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              NEUE
            </h2>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              BADGES
            </h2>
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 20px 20px' }}>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {dashboardData.recent_badges.slice(0, 2).map((badge, index) => (
                <div key={badge.id} style={{
                  margin: '0',
                  background: `
                    radial-gradient(circle at 50% 50%, 
                      rgba(255,255,255,0.95) 0%, 
                      rgba(248,250,252,0.9) 40%,
                      rgba(241,245,249,0.85) 100%
                    )
                  `,
                  backdropFilter: 'blur(10px)',
                  border: `3px dashed ${getBadgeColor(badge)}50`,
                  boxShadow: `
                    0 10px 30px rgba(0,0,0,0.1),
                    0 5px 15px ${getBadgeColor(badge)}20,
                    inset 0 -2px 4px rgba(0,0,0,0.05)
                  `,
                  position: 'relative',
                  aspectRatio: '1',
                  width: '140px',
                  borderRadius: '20px',
                  transform: index === 0 ? 'rotate(-3deg)' : 'rotate(3deg)',
                  overflow: 'visible'
                }}>
                  {/* NEU Stern - außerhalb des Containers */}
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '-8px',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(251,191,36,0.4)',
                    zIndex: 10,
                    transform: 'rotate(15deg)'
                  }}>
                    <IonIcon icon={star} style={{ 
                      fontSize: '1.2rem', 
                      color: 'white',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                    }} />
                  </div>

                  <div style={{ 
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    position: 'relative'
                  }}>
                    
                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {/* Header mit Icon und Status */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                        {/* Badge Icon */}
                        <div style={{
                          width: '45px',
                          height: '45px',
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${getBadgeColor(badge)} 0%, ${getBadgeColor(badge)}dd 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.8rem',
                          boxShadow: `
                            0 4px 15px ${getBadgeColor(badge)}40,
                            inset 0 -2px 4px rgba(0,0,0,0.2),
                            inset 0 2px 4px rgba(255,255,255,0.3)
                          `,
                          position: 'relative',
                          flexShrink: 0,
                          border: `2px solid rgba(255,255,255,0.4)`
                        }}>
                          {badge.is_hidden && (
                            <div style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              background: '#ff6b35',
                              color: 'white',
                              fontSize: '0.5rem',
                              fontWeight: '600',
                              padding: '2px 4px',
                              borderRadius: '6px',
                              zIndex: 2
                            }}>
                              ●
                            </div>
                          )}
                          <div style={{ 
                            color: 'white',
                            textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }}>
                            {badge.icon}
                          </div>
                        </div>

                      </div>

                      {/* Badge Name */}
                      <h4 style={{
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        color: '#1f2937',
                        margin: '0 0 6px 0',
                        lineHeight: '1.2',
                        textAlign: 'center'
                      }}>
                        {badge.name}
                      </h4>

                      {/* Badge Beschreibung */}
                      <p style={{
                        fontSize: '0.7rem',
                        color: '#6b7280',
                        margin: '0 0 8px 0',
                        lineHeight: '1.3',
                        flex: 1,
                        textAlign: 'center'
                      }}>
                        {badge.description}
                      </p>

                      {/* Earned Date als Stempel-Datum */}
                      {badge.earned_at && (
                        <div style={{
                          fontSize: '0.6rem',
                          color: getBadgeColor(badge),
                          fontWeight: '700',
                          marginTop: 'auto',
                          textAlign: 'center',
                          borderTop: `1px dashed ${getBadgeColor(badge)}30`,
                          paddingTop: '6px'
                        }}>
                          {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                        </div>
                      )}

                      {/* Progress oder Kriterium */}
                      <div style={{
                        fontSize: '0.55rem',
                        color: '#9ca3af',
                        fontWeight: '500',
                        marginTop: '4px',
                        textAlign: 'center'
                      }}>
                        {badge.criteria_type === 'total_points' && `${badge.criteria_value} Punkte erreicht`}
                        {badge.criteria_type === 'gottesdienst_points' && `${badge.criteria_value} Gottesdienst-Punkte erreicht`}
                        {badge.criteria_type === 'gemeinde_points' && `${badge.criteria_value} Gemeinde-Punkte erreicht`}
                        {badge.criteria_type === 'activity_count' && `${badge.criteria_value} Aktivitäten abgeschlossen`}
                        {badge.criteria_type === 'custom' && badge.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        </div>
      )}

      {/* Events Section */}
      {regularEvents && regularEvents.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          borderRadius: '20px',
          padding: '0',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(220, 38, 38, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '180px'
        }}>
          {/* Background Text */}
          <div style={{
            position: 'absolute',
            top: '-15px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              NÄCHSTE
            </h2>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              EVENTS
            </h2>
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 20px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {regularEvents.map((event) => (
                <div key={event.id} style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: event.cancelled ? '2px dashed rgba(255,255,255,0.3)' : 'none'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: '700', 
                      color: 'white',
                      marginBottom: '4px',
                      textDecoration: event.cancelled ? 'line-through' : 'none'
                    }}>
                      {event.title || event.name}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '0.8rem', 
                        color: 'rgba(255, 255, 255, 0.8)' 
                      }}>
                        <IonIcon icon={calendar} style={{ fontSize: '0.9rem' }} />
                        {formatEventDate(event.event_date || event.date)}
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '0.8rem', 
                        color: 'rgba(255, 255, 255, 0.8)' 
                      }}>
                        <IonIcon icon={time} style={{ fontSize: '0.9rem' }} />
                        {formatEventTime(event.event_date || event.date)}
                      </div>
                      {event.location && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          fontSize: '0.8rem', 
                          color: 'rgba(255, 255, 255, 0.8)' 
                        }}>
                          <IonIcon icon={location} style={{ fontSize: '0.9rem' }} />
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{
                    background: event.cancelled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'white',
                    whiteSpace: 'nowrap'
                  }}>
                    {event.cancelled ? 'ABGESAGT' : `In ${formatTimeUntil(event.event_date || event.date)}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ranking Section */}
      {dashboardData.ranking && dashboardData.ranking.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #28a745 0%, #155724 100%)',
          borderRadius: '20px',
          padding: '0',
          boxShadow: '0 8px 32px rgba(40, 167, 69, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '180px'
        }}>
          {/* Background Text */}
          <div style={{
            position: 'absolute',
            top: '-15px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '3.5rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              RANKING
            </h2>
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 20px 20px' }}>
            {(() => {
              // Finde die Position des aktuellen Konfis
              const myRank = dashboardData.ranking.findIndex(p => p.id === dashboardData.konfi.id);
              const currentPlayer = dashboardData.ranking[myRank];
              const rank = myRank + 1;
              
              return (
                <div style={{ textAlign: 'center' }}>
                  {/* Platzierungsanzeige */}
                  <div style={{
                    width: '80px', height: '80px',
                    margin: '0 auto 16px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.15) 100%)', 
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2), 0 0 15px rgba(255,255,255,0.1)'
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: '900',
                      color: 'white',
                      textShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {rank}
                    </div>
                  </div>
                  
                  {/* Name und Punkte */}
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '800',
                    color: 'white',
                    marginBottom: '6px',
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    {currentPlayer?.display_name}
                  </div>
                  
                  <div style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    marginBottom: '12px'
                  }}>
                    {currentPlayer?.points} Punkte
                  </div>
                  
                  {/* Status-Info */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    {rank === 1 && `🥇 Du bist auf Platz 1 von ${dashboardData.ranking.length}!`}
                    {rank === 2 && `🥈 Du bist auf Platz 2 von ${dashboardData.ranking.length}!`}
                    {rank === 3 && `🥉 Du bist auf Platz 3 von ${dashboardData.ranking.length}!`}
                    {rank > 3 && `Du bist auf Platz ${rank} von ${dashboardData.ranking.length}`}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;