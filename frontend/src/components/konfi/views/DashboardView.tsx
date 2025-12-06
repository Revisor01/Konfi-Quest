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
  star,
  trophy,
  medal,
  ribbon,
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
  today,
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
  navigate,
  compass,
  pin,
  flag,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer
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
  rank_in_jahrgang?: number;
  total_in_jahrgang?: number;
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
  const [showLosung, setShowLosung] = useState(true); // Wechselt bei jedem Reload

  // Load Tageslosung directly from backend
  useEffect(() => {
    // Wechsle bei jedem Reload zwischen AT und NT
    setShowLosung(Math.random() > 0.5);
    
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

  // Filter nur Events wo Konfi angemeldet ist (confirmed oder waitlist)
  const myRegisteredEvents = upcomingEvents
    .filter(e => e.is_registered || (e as any).booking_status === 'waitlist')
    .filter(e => new Date(e.event_date || e.date) >= new Date())
    .sort((a, b) => new Date(a.event_date || a.date).getTime() - new Date(b.event_date || b.date).getTime());

  const confirmationEvents = myRegisteredEvents
    .filter(e => e.title?.toLowerCase().includes('konfirmation') || e.name?.toLowerCase().includes('konfirmation'));

  const regularEvents = myRegisteredEvents
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
            top: '-5px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '2.9rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              DEINE
            </h2>
            <h2 style={{
              fontSize: '2.9rem',
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
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          borderRadius: '20px',
          padding: '0',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(6, 182, 212, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '160px'
        }}>
          {/* Background Text */}
          <div style={{
            position: 'absolute',
            top: '-5px',
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
              // Wähle nur einen Text aus - wechselnd zwischen AT und NT
              const hasLosung = actualDailyVerse.losungstext;
              const hasLehrtext = actualDailyVerse.lehrtext;
              
              // showLosung wird bereits per State bei jedem Reload gewechselt
              
              let text, reference;
              if (hasLosung && hasLehrtext) {
                // Beide verfügbar - wähle einen aus
                text = showLosung ? actualDailyVerse.losungstext : actualDailyVerse.lehrtext;
                reference = showLosung ? actualDailyVerse.losungsvers : actualDailyVerse.lehrtextvers;
              } else {
                // Nur einer verfügbar
                text = hasLosung ? actualDailyVerse.losungstext : actualDailyVerse.lehrtext || actualDailyVerse.text;
                reference = hasLosung ? actualDailyVerse.losungsvers : actualDailyVerse.lehrtextvers || actualDailyVerse.reference;
              }
              
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
            })()}
          </div>
        </div>
      )}

      {/* Events Section - jetzt vor Badges */}
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
            top: '-5px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '2.8rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              DEINE
            </h2>
            <h2 style={{
              fontSize: '2.8rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              EVENTS
            </h2>
          </div>

          {/* Zusätzlicher Indikator */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '0.7rem',
            color: 'white',
            fontWeight: '700',
            zIndex: 3
          }}>
{regularEvents.length === 0 ? 'DEINE EVENTS' : `DEINE ${regularEvents.length} EVENTS`}
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 20px 20px' }}>
            {regularEvents.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '0.9rem'
              }}>
                Keine Events gebucht
              </div>
            ) : (
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
                    {event.cancelled ? 'ABGESAGT' : 
                     (event as any).booking_status === 'waitlist' ? 
                       `WARTELISTE (${(event as any).waitlist_position || 1})` :
                       `In ${formatTimeUntil(event.event_date || event.date)}`}
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badges Section - jetzt nach Events */}
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
            top: '-5px',
            left: '10px',
            zIndex: 1
          }}>
                        <h2 style={{
              fontSize: '2.8rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              DEINE
            </h2>
            <h2 style={{
              fontSize: '2.8rem',
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
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '12px', 
              justifyItems: 'center',
              maxWidth: '320px',
              margin: '0 auto'
            }}>
              {/* Zeige alle neuen Badges, mindestens aber 2 Plätze */}
              {Array.from({ length: Math.max(2, dashboardData.recent_badges.length) }).map((_, index) => {
                const badge = dashboardData.recent_badges[index];
                if (!badge) {
                  // Placeholder für leere Slots
                  return (
                    <div key={`placeholder-${index}`} style={{
                      width: '140px',
                      aspectRatio: '1',
                      opacity: 0
                    }} />
                  );
                }
                return (
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
                  transform: `rotate(${index % 2 === 0 ? '-3deg' : '3deg'})`,
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
                      {/* Header mit Icon und Datum */}
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
                          <IonIcon
                            icon={getIconFromString(badge.icon)}
                            style={{
                              fontSize: '1.5rem',
                              color: 'white',
                              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))'
                            }}
                          />
                        </div>

                        {/* Earned Date oben rechts */}
                        {badge.earned_at && (
                          <div style={{
                            fontSize: '0.6rem',
                            color: getBadgeColor(badge),
                            fontWeight: '700',
                            textAlign: 'right',
                            lineHeight: '1.2'
                          }}>
                            {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>

                      {/* Badge Name */}
                      <h4 style={{
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        color: '#1f2937',
                        margin: '0 0 6px 0',
                        lineHeight: '1.2',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {badge.name}
                      </h4>

                      {/* Badge Beschreibung */}
                      <p style={{
                        fontSize: '0.65rem',
                        color: '#6b7280',
                        margin: '0 0 6px 0',
                        lineHeight: '1.2',
                        textAlign: 'center',
                        height: '24px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {badge.description}
                      </p>

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
                );
              })}
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
            top: '-5px',
            left: '10px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '2.9rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.08)',
              margin: '0',
              lineHeight: '0.9',
              letterSpacing: '-2px'
            }}>
              DEIN
            </h2>
            <h2 style={{
              fontSize: '2.9rem',
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
            {/* Platzierung Header - wie Punkte-Display */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'baseline', 
                gap: '8px', 
                marginBottom: '8px',
                justifyContent: 'center'
              }}>
                <span style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '900', 
                  color: 'white' 
                }}>
                  {dashboardData.rank_in_jahrgang || 1}
                </span>
                <span style={{ 
                  fontSize: '1.5rem', 
                  color: 'rgba(255, 255, 255, 0.7)' 
                }}>
                  / {dashboardData.total_in_jahrgang || 1}
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <IonIcon icon={trophy} style={{ 
                  fontSize: '0.9rem', 
                  color: 'rgba(255, 255, 255, 0.8)' 
                }} />
                <span style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textAlign: 'center'
                }}>
                  Deine Platzierung im Jahrgang
                </span>
              </div>
            </div>

            {/* Intelligente Ranking-Liste */}
            {(() => {
              const currentUserRank = dashboardData.rank_in_jahrgang || 1;
              const totalRanking = dashboardData.ranking;
              const playersToShow = [];
              
              // Immer Platz 1 zeigen
              if (totalRanking.length > 0) {
                playersToShow.push({ ...totalRanking[0], actualRank: 1 });
              }
              
              // Falls User nicht auf Platz 1-3 ist, zeige Nachbarn
              if (currentUserRank > 3) {
                // Trennlinie einfügen falls nötig
                if (currentUserRank > 2) {
                  playersToShow.push({ separator: true });
                }
                
                // Nachbarn um User herum zeigen (User ± 1)
                const startRank = Math.max(1, currentUserRank - 1);
                const endRank = Math.min(dashboardData.total_in_jahrgang || currentUserRank, currentUserRank + 1);
                
                // Erstelle Mock-Player für Nachbarn basierend auf Backend-Ranking-Daten
                for (let rank = startRank; rank <= endRank; rank++) {
                  if (rank === currentUserRank) {
                    // Aktueller User
                    playersToShow.push({
                      id: dashboardData.konfi.id,
                      display_name: dashboardData.konfi.display_name,
                      points: (dashboardData.konfi.gottesdienst_points || 0) + (dashboardData.konfi.gemeinde_points || 0),
                      initials: getInitials(dashboardData.konfi.display_name),
                      actualRank: rank,
                      isCurrentUser: true
                    });
                  } else {
                    // Nachbar-Platz (wir können nur schätzen, da Backend nur Top 3 liefert)
                    playersToShow.push({
                      id: `neighbor-${rank}`,
                      display_name: rank === startRank ? 'Konfi vor dir' : 'Konfi nach dir',
                      points: rank < currentUserRank ? 
                        (dashboardData.konfi.gottesdienst_points || 0) + (dashboardData.konfi.gemeinde_points || 0) + (currentUserRank - rank) :
                        Math.max(0, (dashboardData.konfi.gottesdienst_points || 0) + (dashboardData.konfi.gemeinde_points || 0) - (rank - currentUserRank)),
                      initials: '??',
                      actualRank: rank,
                      isNeighbor: true
                    });
                  }
                }
              } else {
                // User ist in Top 3, zeige normale Top 3
                for (let i = 1; i < Math.min(3, totalRanking.length); i++) {
                  playersToShow.push({ ...totalRanking[i], actualRank: i + 1 });
                }
              }
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {playersToShow.map((item, index) => {
                    if (item.separator) {
                      return (
                        <div key="separator" style={{
                          height: '1px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          margin: '8px 0',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.6)',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: '500'
                          }}>
                            ...
                          </div>
                        </div>
                      );
                    }
                    
                    const isCurrentUser = item.isCurrentUser || item.id === dashboardData.konfi.id;
                    const rank = item.actualRank;
                    
                    return (
                      <div key={item.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: isCurrentUser 
                          ? 'rgba(255, 255, 255, 0.2)' 
                          : item.isNeighbor
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '12px',
                        border: isCurrentUser 
                          ? '2px solid rgba(255, 255, 255, 0.4)' 
                          : '1px solid rgba(255, 255, 255, 0.15)',
                        opacity: item.isNeighbor ? 0.7 : 1
                      }}>
                        {/* Ranking Position */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: rank === 1 
                            ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)'
                            : rank === 2 
                            ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)'
                            : rank === 3 
                            ? 'linear-gradient(135deg, #cd7f32 0%, #deb887 100%)'
                            : 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: rank <= 3 ? '#1a1a1a' : 'white',
                          fontWeight: '700',
                          fontSize: '0.9rem'
                        }}>
                          {rank}
                        </div>

                        {/* Avatar */}
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          backdropFilter: 'blur(10px)'
                        }}>
                          {item.initials}
                        </div>

                        {/* Name und Punkte */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'white',
                            marginBottom: '2px'
                          }}>
                            {item.display_name}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            {item.points} Punkte
                          </div>
                        </div>
                      </div>
                    );
                  })}
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