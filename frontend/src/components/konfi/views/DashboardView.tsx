import React, { useState, useEffect } from 'react';
import {
  IonProgressBar,
  IonIcon,
  useIonAlert,
  IonPopover
} from '@ionic/react';
import ActivityRings from '../../admin/views/ActivityRings';
import { useHistory } from 'react-router-dom';
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
    level_index: number;
    total_levels: number;
    all_levels?: Array<{
      id: number;
      name: string;
      title: string;
      icon: string;
      color: string;
      points_required: number;
    }>;
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

interface AllBadgesData {
  available: any[];
  earned: any[];
}

interface DashboardViewProps {
  dashboardData: DashboardData;
  dailyVerse: DailyVerse | null;
  badgeStats: BadgeStats;
  allBadges: AllBadgesData;
  upcomingEvents: any[];
  targetGottesdienst: number;
  targetGemeinde: number;
  onOpenPointsHistory?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  dailyVerse,
  badgeStats,
  allBadges,
  upcomingEvents,
  targetGottesdienst,
  targetGemeinde,
  onOpenPointsHistory
}) => {
  const history = useHistory();
  const [presentAlert] = useIonAlert();
  const [actualDailyVerse, setActualDailyVerse] = useState<any>(null);
  const [loadingVerse, setLoadingVerse] = useState(true);
  const [showLosung, setShowLosung] = useState(true); // Wechselt bei jedem Reload

  // Level Popover State
  const [levelPopover, setLevelPopover] = useState<{
    isOpen: boolean;
    event: Event | undefined;
    level: any | null;
    isReached: boolean;
  }>({ isOpen: false, event: undefined, level: null, isReached: false });

  // Badge Popover State
  const [badgePopover, setBadgePopover] = useState<{
    isOpen: boolean;
    event: Event | undefined;
    badge: any | null;
    isEarned: boolean;
  }>({ isOpen: false, event: undefined, badge: null, isEarned: false });

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
      
      {/* Header Card mit ActivityRings */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #4c1d95 100%)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '16px',
        boxShadow: '0 10px 40px rgba(91, 33, 182, 0.35)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dekorative Kreise im Hintergrund */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '50%'
        }}/>
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '30px',
          width: '60px',
          height: '60px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '50%'
        }}/>
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '50%'
        }}/>
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '40px',
          width: '40px',
          height: '40px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '50%'
        }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Begrüßung */}
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: '800',
            margin: '0 0 4px 0',
            color: 'white',
            textAlign: 'center'
          }}>
            Hey {getFirstName(dashboardData.konfi.display_name)}!
          </h2>
          <p style={{
            fontSize: '1rem',
            margin: '0 0 20px 0',
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center'
          }}>
            {dashboardData.konfi.jahrgang_name}
          </p>

          {/* Activity Rings - klickbar für Punkte-Historie */}
          <div
            onClick={onOpenPointsHistory}
            style={{
              cursor: onOpenPointsHistory ? 'pointer' : 'default',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <ActivityRings
              totalPoints={totalCurrentPoints}
              gottesdienstPoints={gottesdienstPoints}
              gemeindePoints={gemeindePoints}
              gottesdienstGoal={targetGottesdienst}
              gemeindeGoal={targetGemeinde}
              size={180}
            />
          </div>

          {/* Level Badge + Icons */}
          {dashboardData.level_info?.current_level && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <div style={{
                display: 'inline-block',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '0.9rem',
                color: 'white',
                fontWeight: '600',
                marginBottom: '12px'
              }}>
                {dashboardData.level_info.current_level.title}
              </div>

              {/* Level Icons Row - erreichte farbig, nicht erreichte ausgegraut */}
              {dashboardData.level_info?.all_levels && dashboardData.level_info.all_levels.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  {dashboardData.level_info.all_levels.map((level, index) => {
                    const isReached = index < dashboardData.level_info!.level_index;
                    const isCurrent = index === dashboardData.level_info!.level_index - 1;
                    return (
                      <div
                        key={level.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLevelPopover({
                            isOpen: true,
                            event: e.nativeEvent,
                            level: level,
                            isReached: isReached
                          });
                        }}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: isReached
                            ? `linear-gradient(135deg, ${level.color || '#667eea'} 0%, ${level.color || '#667eea'}dd 100%)`
                            : 'rgba(255, 255, 255, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isReached
                            ? `0 4px 12px ${level.color || '#667eea'}50`
                            : 'none',
                          border: isCurrent
                            ? '2px solid rgba(255, 255, 255, 0.8)'
                            : isReached
                            ? '2px solid rgba(255, 255, 255, 0.3)'
                            : '2px dashed rgba(255, 255, 255, 0.2)',
                          transition: 'all 0.3s ease',
                          opacity: isReached ? 1 : 0.5,
                          cursor: 'pointer'
                        }}
                      >
                        <IonIcon
                          icon={getIconFromString(level.icon)}
                          style={{
                            fontSize: '1.2rem',
                            color: isReached ? 'white' : 'rgba(255, 255, 255, 0.4)',
                            filter: isReached ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' : 'none'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
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

      {/* Events Section - direkt nach Konfirmation */}
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
            {regularEvents.length === 1 ? 'DEIN EVENT' : `DEINE ${regularEvents.length} EVENTS`}
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 20px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {regularEvents.map((event) => {
                // Warteliste: booking_status kann 'waitlist' oder 'pending' sein
                const isWaitlist = (event as any).booking_status === 'waitlist' || (event as any).booking_status === 'pending';
                return (
                  <div
                    key={event.id}
                    onClick={() => history.push(`/konfi/events/${event.id}`)}
                    style={{
                      background: isWaitlist
                        ? 'rgba(251, 191, 36, 0.25)'
                        : 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: event.cancelled
                        ? '2px dashed rgba(255,255,255,0.3)'
                        : isWaitlist
                          ? '2px solid rgba(251, 191, 36, 0.5)'
                          : 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, background 0.2s ease'
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
                          {event.booked_timeslot_start
                            ? `${formatEventTime(event.booked_timeslot_start)}${event.booked_timeslot_end ? ` - ${formatEventTime(event.booked_timeslot_end)}` : ''}`
                            : formatEventTime(event.event_date || event.date)
                          }
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
                      background: event.cancelled
                        ? 'rgba(255,255,255,0.2)'
                        : isWaitlist
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'rgba(255,255,255,0.25)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: 'white',
                      whiteSpace: 'nowrap',
                      boxShadow: isWaitlist ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none'
                    }}>
                      {event.cancelled ? 'ABGESAGT' :
                       isWaitlist ?
                         `WARTELISTE #${(event as any).waitlist_position || '?'}` :
                         `In ${formatTimeUntil(event.event_date || event.date)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      {/* Badges Section - Level-artiges Design mit Icons */}
      {(allBadges.available.length > 0 || allBadges.earned.length > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, #ff9500 0%, #e63946 100%)',
          borderRadius: '20px',
          padding: '0',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(255, 149, 0, 0.25)',
          position: 'relative',
          overflow: 'hidden'
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

          <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 24px 20px' }}>
            {/* Badge Stats Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}>
              {/* Sichtbare Badges */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '8px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>
                  {badgeStats.totalEarned}/{badgeStats.totalAvailable}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>
                  SICHTBAR
                </div>
              </div>

              {/* Geheime Badges */}
              {badgeStats.secretAvailable > 0 && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.4)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '8px 14px',
                  textAlign: 'center',
                  border: '1px solid rgba(139, 92, 246, 0.5)'
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>
                    {badgeStats.secretEarned}/{badgeStats.secretAvailable}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>
                    GEHEIM
                  </div>
                </div>
              )}

              {/* Neue Badges Indikator */}
              {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '12px',
                  padding: '8px 14px',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  animation: 'newBadgePulse 2s ease-in-out infinite'
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>
                    +{dashboardData.recent_badges.length}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
                    NEU
                  </div>
                </div>
              )}
            </div>

            {/* Badge Icons Grid - wie Level Icons */}
            {(() => {
              // Kombiniere alle Badges: earned + available (nicht earned)
              const earnedIds = new Set(allBadges.earned.map((b: any) => b.id));
              const recentBadgeIds = new Set(dashboardData.recent_badges?.map((b: any) => b.id) || []);

              // Sichtbare Badges (nicht hidden, ausser sie sind earned)
              const visibleBadges = [
                ...allBadges.earned.filter((b: any) => !b.is_hidden),
                ...allBadges.available.filter((b: any) => !earnedIds.has(b.id) && !b.is_hidden)
              ].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

              // Geheime Badges (hidden) - zeige nur erreichte + Platzhalter für nicht erreichte
              const secretEarned = allBadges.earned.filter((b: any) => b.is_hidden);
              const secretNotEarnedCount = badgeStats.secretAvailable - badgeStats.secretEarned;

              return (
                <>
                  {/* Sichtbare Badges */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    justifyContent: 'center',
                    marginBottom: secretEarned.length > 0 || secretNotEarnedCount > 0 ? '16px' : '0'
                  }}>
                    {visibleBadges.map((badge) => {
                      const isEarned = earnedIds.has(badge.id);
                      const isRecent = recentBadgeIds.has(badge.id);
                      const badgeColor = getBadgeColor(badge);

                      return (
                        <div
                          key={badge.id}
                          onClick={(e) => {
                            setBadgePopover({
                              isOpen: true,
                              event: e.nativeEvent,
                              badge: badge,
                              isEarned: isEarned
                            });
                          }}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: isEarned
                              ? `linear-gradient(135deg, ${badgeColor} 0%, ${badgeColor}dd 100%)`
                              : 'rgba(255, 255, 255, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isEarned
                              ? isRecent
                                ? `0 0 0 3px #10b981, 0 0 20px rgba(16, 185, 129, 0.6)`
                                : `0 4px 12px ${badgeColor}50`
                              : 'none',
                            border: isRecent
                              ? '3px solid #10b981'
                              : isEarned
                              ? '2px solid rgba(255, 255, 255, 0.3)'
                              : '2px dashed rgba(255, 255, 255, 0.25)',
                            transition: 'all 0.3s ease',
                            opacity: isEarned ? 1 : 0.5,
                            cursor: 'pointer',
                            position: 'relative',
                            animation: isRecent ? 'badgePulse 2s ease-in-out infinite' : 'none'
                          }}
                        >
                          <IonIcon
                            icon={isEarned ? getIconFromString(badge.icon) : eyeOff}
                            style={{
                              fontSize: isEarned ? '1.4rem' : '1rem',
                              color: isEarned ? 'white' : 'rgba(255, 255, 255, 0.4)',
                              filter: isEarned ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' : 'none'
                            }}
                          />
                          {/* NEU Indikator für kürzlich erreichte */}
                          {isRecent && (
                            <div style={{
                              position: 'absolute',
                              top: '-6px',
                              right: '-6px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: '2px solid white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.5)'
                            }}>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>!</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Geheime Badges Sektion */}
                  {(secretEarned.length > 0 || secretNotEarnedCount > 0) && (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ height: '1px', flex: 1, maxWidth: '60px', background: 'rgba(255, 255, 255, 0.3)' }} />
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                          GEHEIM
                        </span>
                        <div style={{ height: '1px', flex: 1, maxWidth: '60px', background: 'rgba(255, 255, 255, 0.3)' }} />
                      </div>

                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        justifyContent: 'center'
                      }}>
                        {/* Erreichte geheime Badges */}
                        {secretEarned.map((badge) => {
                          const isRecent = recentBadgeIds.has(badge.id);
                          const badgeColor = getBadgeColor(badge);

                          return (
                            <div
                              key={badge.id}
                              onClick={(e) => {
                                setBadgePopover({
                                  isOpen: true,
                                  event: e.nativeEvent,
                                  badge: badge,
                                  isEarned: true
                                });
                              }}
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${badgeColor} 0%, ${badgeColor}dd 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isRecent
                                  ? `0 0 0 3px #10b981, 0 0 20px rgba(16, 185, 129, 0.6)`
                                  : `0 4px 12px ${badgeColor}50`,
                                border: isRecent
                                  ? '3px solid #10b981'
                                  : '2px solid rgba(139, 92, 246, 0.5)',
                                cursor: 'pointer',
                                position: 'relative',
                                animation: isRecent ? 'badgePulse 2s ease-in-out infinite' : 'none'
                              }}
                            >
                              <IonIcon
                                icon={getIconFromString(badge.icon)}
                                style={{
                                  fontSize: '1.4rem',
                                  color: 'white',
                                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                                }}
                              />
                              {isRecent && (
                                <div style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  border: '2px solid white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.5)'
                                }}>
                                  <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>!</span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Platzhalter für nicht erreichte geheime Badges */}
                        {Array.from({ length: secretNotEarnedCount }).map((_, index) => (
                          <div
                            key={`secret-placeholder-${index}`}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background: 'rgba(168, 85, 247, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px dashed rgba(168, 85, 247, 0.5)',
                              opacity: 0.7
                            }}
                          >
                            <IonIcon
                              icon={helpCircle}
                              style={{
                                fontSize: '1.2rem',
                                color: 'rgba(168, 85, 247, 0.7)'
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {/* Link zu allen Badges */}
            <div
              onClick={() => history.push('/konfi/badges')}
              style={{
                marginTop: '16px',
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >
              <span style={{
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.9)',
                textDecoration: 'underline'
              }}>
                Alle Badges anzeigen
              </span>
            </div>
          </div>

          {/* CSS Animation für neue Badges */}
          <style>{`
            @keyframes badgePulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.08); }
            }
            @keyframes newBadgePulse {
              0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }
              50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6); }
            }
          `}</style>
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

      {/* Level Popover - mit solidem Hintergrund */}
      <IonPopover
        isOpen={levelPopover.isOpen}
        event={levelPopover.event}
        onDidDismiss={() => setLevelPopover({ isOpen: false, event: undefined, level: null, isReached: false })}
        side="top"
        alignment="center"
        style={{
          '--background': '#ffffff'
        }}
      >
        {levelPopover.level && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            minWidth: '180px',
            background: '#ffffff'
          }}>
            {/* Level Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: levelPopover.isReached
                ? `linear-gradient(135deg, ${levelPopover.level.color || '#667eea'} 0%, ${levelPopover.level.color || '#667eea'}dd 100%)`
                : '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              boxShadow: levelPopover.isReached
                ? `0 4px 12px ${levelPopover.level.color || '#667eea'}50`
                : 'none'
            }}>
              <IonIcon
                icon={getIconFromString(levelPopover.level.icon)}
                style={{
                  fontSize: '1.5rem',
                  color: levelPopover.isReached ? 'white' : '#9ca3af'
                }}
              />
            </div>

            {/* Level Title */}
            <div style={{
              fontWeight: '700',
              fontSize: '1.1rem',
              color: levelPopover.level.color || '#667eea',
              marginBottom: '8px'
            }}>
              {levelPopover.level.title}
            </div>

            {/* Points Required */}
            <div style={{
              fontSize: '0.85rem',
              color: '#666',
              marginBottom: '12px'
            }}>
              {levelPopover.level.points_required} Punkte erforderlich
            </div>

            {/* Status Badge */}
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: '600',
              background: levelPopover.isReached ? '#dcfce7' : '#f3f4f6',
              color: levelPopover.isReached ? '#16a34a' : '#6b7280'
            }}>
              {levelPopover.isReached ? 'Erreicht!' : 'Noch nicht erreicht'}
            </div>
          </div>
        )}
      </IonPopover>

      {/* Badge Popover - kompakt wie BadgesView */}
      <IonPopover
        isOpen={badgePopover.isOpen}
        event={badgePopover.event}
        onDidDismiss={() => setBadgePopover({ isOpen: false, event: undefined, badge: null, isEarned: false })}
        side="top"
        alignment="center"
        style={{
          '--width': '260px',
          '--background': 'white'
        } as any}
      >
        {badgePopover.badge && (
          <div style={{ padding: '12px', background: 'white', position: 'relative', overflow: 'hidden' }}>
            {/* Geheim Eselsohr */}
            {badgePopover.badge.is_hidden && (
              <div
                className="app-corner-badge"
                style={{
                  background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                  fontSize: '0.5rem',
                  padding: '3px 8px'
                }}
              >
                GEHEIM
              </div>
            )}

            {/* Kompakte Darstellung */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Badge Icon - kleiner */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: badgePopover.isEarned
                  ? `linear-gradient(145deg, ${getBadgeColor(badgePopover.badge)} 0%, ${getBadgeColor(badgePopover.badge)}cc 100%)`
                  : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
                boxShadow: badgePopover.isEarned
                  ? `0 2px 8px ${getBadgeColor(badgePopover.badge)}40`
                  : '0 1px 4px rgba(0,0,0,0.1)'
              }}>
                <IonIcon
                  icon={badgePopover.isEarned ? getIconFromString(badgePopover.badge.icon) : eyeOff}
                  style={{
                    fontSize: '1.4rem',
                    color: badgePopover.isEarned ? 'white' : '#999'
                  }}
                />
              </div>

              {/* Text Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '700', color: '#333' }}>
                  {badgePopover.badge.name}
                </h3>
                <p style={{
                  margin: '0',
                  fontSize: '0.8rem',
                  color: '#666',
                  lineHeight: '1.3'
                }}>
                  {badgePopover.badge.description || 'Keine Beschreibung'}
                </p>
              </div>
            </div>

            {/* Status und Datum */}
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {badgePopover.isEarned ? (
                <>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#22c55e',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    <IonIcon icon={checkmarkCircle} style={{ fontSize: '0.75rem' }} />
                    Erreicht
                  </div>
                  {badgePopover.badge.earned_at && (
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>
                      {new Date(badgePopover.badge.earned_at).toLocaleDateString('de-DE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  )}
                </>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#8e8e93',
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  fontWeight: '600'
                }}>
                  Noch nicht erreicht
                </div>
              )}
            </div>
          </div>
        )}
      </IonPopover>

    </div>
  );
};

export default DashboardView;