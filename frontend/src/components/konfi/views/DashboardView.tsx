import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  IonProgressBar,
  IonIcon,
  useIonAlert,
  useIonPopover
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
  hammer,
  chevronForward
} from 'ionicons/icons';
import { Badge, DashboardEvent, RankingEntry } from '../../../types/dashboard';

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
const getIconFromString = (iconName: string | undefined): string => {
  if (!iconName) return trophy;
  return BADGE_ICONS[iconName]?.icon || trophy;
};
import api from '../../../services/api';

// Level Popover Content Komponente
interface LevelPopoverData {
  level: { id: number; name: string; title: string; icon: string; color: string; points_required: number } | null;
  isReached: boolean;
}

const LevelPopoverContent: React.FC<{
  dataRef: React.RefObject<LevelPopoverData>;
}> = ({ dataRef }) => {
  const data = dataRef.current;
  if (!data || !data.level) return null;
  const level = data.level;
  const isReached = data.isReached;

  return (
    <div style={{ padding: '12px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isReached
            ? `linear-gradient(145deg, ${level.color || '#667eea'} 0%, ${level.color || '#667eea'}cc 100%)`
            : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
          boxShadow: isReached
            ? `0 2px 8px ${level.color || '#667eea'}40`
            : '0 1px 4px rgba(0,0,0,0.1)'
        }}>
          <IonIcon
            icon={getIconFromString(level.icon)}
            style={{
              fontSize: '1.4rem',
              color: isReached ? 'white' : '#999'
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '700', color: '#333', whiteSpace: 'nowrap' }}>
            {level.title}
          </h3>
          <p style={{
            margin: '0',
            fontSize: '0.8rem',
            color: '#666',
            lineHeight: '1.3'
          }}>
            {level.points_required} Punkte erforderlich
          </p>
        </div>
      </div>
      <div style={{
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: isReached ? '#22c55e' : '#8e8e93',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '8px',
          fontSize: '0.7rem',
          fontWeight: '600'
        }}>
          {isReached && <IonIcon icon={checkmarkCircle} style={{ fontSize: '0.75rem' }} />}
          {isReached ? 'Erreicht' : 'Noch nicht erreicht'}
        </div>
      </div>
    </div>
  );
};

// Badge Popover Content Komponente fuer Dashboard
const DashboardBadgePopoverContent: React.FC<{
  dataRef: React.RefObject<{ badge: Badge | null; isEarned: boolean; getBadgeColor: (badge: Badge) => string }>;
}> = ({ dataRef }) => {
  const data = dataRef.current;
  if (!data || !data.badge) return null;
  const badge = data.badge;
  const isEarned = data.isEarned;
  const badgeColor = data.getBadgeColor(badge);

  return (
    <div style={{ padding: '12px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isEarned
            ? `linear-gradient(145deg, ${badgeColor} 0%, ${badgeColor}cc 100%)`
            : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
          boxShadow: isEarned
            ? `0 2px 8px ${badgeColor}40`
            : '0 1px 4px rgba(0,0,0,0.1)'
        }}>
          <IonIcon
            icon={isEarned ? getIconFromString(badge.icon) : eyeOff}
            style={{
              fontSize: '1.4rem',
              color: isEarned ? 'white' : '#999'
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '700', color: '#333', whiteSpace: 'nowrap' }}>
            {badge.name}
          </h3>
          <p style={{
            margin: '0',
            fontSize: '0.8rem',
            color: '#666',
            lineHeight: '1.3'
          }}>
            {badge.description || 'Keine Beschreibung'}
          </p>
        </div>
      </div>
      <div style={{
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {isEarned ? (
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
            {badge.earned_at && (
              <span style={{ fontSize: '0.7rem', color: '#888' }}>
                {new Date(badge.earned_at).toLocaleDateString('de-DE', {
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
  );
};

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
  recent_badges: Badge[];
  badge_count: number;
  recent_events: DashboardEvent[];
  event_count: number;
  ranking: RankingEntry[];
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
  text?: string;
  reference?: string;
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
  available: Badge[];
  earned: Badge[];
}

interface DashboardConfig {
  show_konfirmation: boolean;
  show_events: boolean;
  show_losung: boolean;
  show_badges: boolean;
  show_ranking: boolean;
}

interface DashboardViewProps {
  dashboardData: DashboardData;
  dailyVerse: DailyVerse | null;
  badgeStats: BadgeStats;
  allBadges: AllBadgesData;
  upcomingEvents: DashboardEvent[];
  targetGottesdienst: number;
  targetGemeinde: number;
  gottesdienstEnabled?: boolean;
  gemeindeEnabled?: boolean;
  onOpenPointsHistory?: () => void;
  dashboardConfig?: DashboardConfig;
}

const getGreeting = (name: string): string => {
  const hour = new Date().getHours();
  let greeting: string;
  if (hour < 12) {
    greeting = 'Guten Morgen';
  } else if (hour < 18) {
    greeting = 'Guten Tag';
  } else {
    greeting = 'Guten Abend';
  }
  return `${greeting}, ${name}!`;
};

const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardData,
  dailyVerse,
  badgeStats,
  allBadges,
  upcomingEvents,
  targetGottesdienst,
  targetGemeinde,
  gottesdienstEnabled = true,
  gemeindeEnabled = true,
  onOpenPointsHistory,
  dashboardConfig
}) => {
  const history = useHistory();
  const [presentAlert] = useIonAlert();
  const [actualDailyVerse, setActualDailyVerse] = useState<DailyVerse | null>(null);
  const [loadingVerse, setLoadingVerse] = useState(true);
  const [showLosung, setShowLosung] = useState(true); // Wechselt bei jedem Reload

  // Level Popover via useIonPopover
  const levelPopoverRef = useRef<LevelPopoverData>({ level: null, isReached: false });
  const [presentLevelPopover, dismissLevelPopover] = useIonPopover(LevelPopoverContent, {
    dataRef: levelPopoverRef
  });

  // Badge Popover via useIonPopover
  const badgePopoverRef = useRef<{ badge: Badge | null; isEarned: boolean; getBadgeColor: (badge: Badge) => string }>({
    badge: null, isEarned: false, getBadgeColor: () => '#667eea'
  });
  const [presentBadgePopover, dismissBadgePopover] = useIonPopover(DashboardBadgePopoverContent, {
    dataRef: badgePopoverRef
  });

  // Load Tageslosung directly from backend
  useEffect(() => {
    if (dashboardConfig?.show_losung === false) {
      setLoadingVerse(false);
      setActualDailyVerse(null);
      return;
    }

    // Wechsle bei jedem Reload zwischen AT und NT
    setShowLosung(Math.random() > 0.5);

    const loadTageslosung = async () => {
      try {
        const response = await api.get('/konfi/tageslosung');
        
        if (response.data && response.data.success) {
          const { losung, lehrtext } = response.data.data;
          setActualDailyVerse({
            losungstext: losung?.text,
            losungsvers: losung?.reference,
            lehrtext: lehrtext?.text,
            lehrtextvers: lehrtext?.reference
          });
        } else {
 console.error('Invalid response from backend:', response.data);
          setActualDailyVerse(null);
        }
      } catch (error: unknown) {
 console.error('Failed to load Tageslosung from backend:', error);
        setActualDailyVerse(null);
      } finally {
        setLoadingVerse(false);
      }
    };

    loadTageslosung();
  }, [dailyVerse, dashboardConfig?.show_losung]);

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


  const formatTimeUntil = (dateString: string | undefined) => {
    if (!dateString) return '';
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

  const formatEventTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEventDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const getBadgeColor = (badge: Badge) => {
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
  const showBothTypes = gottesdienstEnabled && gemeindeEnabled;
  const totalTarget = showBothTypes ? targetGottesdienst + targetGemeinde : (gottesdienstEnabled ? targetGottesdienst : targetGemeinde);
  const totalCurrentPoints = (gottesdienstEnabled ? gottesdienstPoints : 0) + (gemeindeEnabled ? gemeindePoints : 0);

  // Filter nur Events wo Konfi angemeldet ist (confirmed oder waitlist)
  const myRegisteredEvents = useMemo(() => upcomingEvents
    .filter(e => e.is_registered || e.booking_status === 'waitlist')
    .filter(e => new Date(e.event_date || e.date || '') >= new Date())
    .sort((a, b) => new Date(a.event_date || a.date || '').getTime() - new Date(b.event_date || b.date || '').getTime()),
  [upcomingEvents]);

  const confirmationEvents = useMemo(() => myRegisteredEvents
    .filter(e => e.title?.toLowerCase().includes('konfirmation') || e.name?.toLowerCase().includes('konfirmation')),
  [myRegisteredEvents]);

  const regularEvents = useMemo(() => myRegisteredEvents
    .filter(e => !e.title?.toLowerCase().includes('konfirmation') && !e.name?.toLowerCase().includes('konfirmation'))
    .slice(0, 3),
  [myRegisteredEvents]);

  const nextConfirmationEvent = confirmationEvents.length > 0 ? confirmationEvents[0] : null;

  // Badge-Berechnungen memoisiert
  const earnedIds = useMemo(() => new Set(allBadges.earned.map((b: Badge) => b.id)), [allBadges.earned]);
  const recentBadgeIds = useMemo(() => new Set(dashboardData.recent_badges?.map((b: Badge) => b.id) || []), [dashboardData.recent_badges]);

  const visibleBadges = useMemo(() => [
    ...allBadges.earned.filter((b: Badge) => !b.is_hidden),
    ...allBadges.available.filter((b: Badge) => !earnedIds.has(b.id) && !b.is_hidden)
  ].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [allBadges, earnedIds]);

  const secretEarned = useMemo(() => allBadges.earned.filter((b: Badge) => b.is_hidden), [allBadges.earned]);
  const secretNotEarnedCount = badgeStats.secretAvailable - badgeStats.secretEarned;

  const recentSecretCount = useMemo(() =>
    secretEarned.filter((b: Badge) => recentBadgeIds.has(b.id)).length,
    [secretEarned, recentBadgeIds]
  );
  const recentVisibleCount = useMemo(() =>
    (dashboardData.recent_badges || []).length - recentSecretCount,
    [dashboardData.recent_badges, recentSecretCount]
  );

  return (
    <div style={{ padding: '16px' }}>
      
      {/* Header Card mit ActivityRings */}
      <div className="app-dashboard-header">
        {/* Dekorative Kreise im Hintergrund */}
        <div className="app-dashboard-header__circle" style={{
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          background: 'rgba(255, 255, 255, 0.08)'
        }}/>
        <div className="app-dashboard-header__circle" style={{
          top: '60px',
          right: '30px',
          width: '60px',
          height: '60px'
        }}/>
        <div className="app-dashboard-header__circle" style={{
          bottom: '-30px',
          left: '-30px',
          width: '100px',
          height: '100px'
        }}/>
        <div className="app-dashboard-header__circle" style={{
          bottom: '40px',
          left: '40px',
          width: '40px',
          height: '40px'
        }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Begruessing */}
          <h2 className="app-dashboard-greeting">
            {getGreeting(getFirstName(dashboardData.konfi.display_name))}
          </h2>
          <p className="app-dashboard-subtitle">
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
              gottesdienstEnabled={gottesdienstEnabled}
              gemeindeEnabled={gemeindeEnabled}
              size={180}
            />
          </div>

          {/* Level Badge + Icons */}
          {dashboardData.level_info?.current_level && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <div className="app-dashboard-glass-chip" style={{ marginBottom: '12px' }}>
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
                          levelPopoverRef.current = { level, isReached };
                          presentLevelPopover({
                            event: e.nativeEvent,
                            side: 'top',
                            alignment: 'center'
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
      {dashboardConfig?.show_konfirmation !== false && ((dashboardData.days_to_confirmation !== null && dashboardData.days_to_confirmation !== undefined) || nextConfirmationEvent) ? (
        <div className="app-dashboard-section app-dashboard-section--konfirmation">
          {/* Background Text */}
          <div className="app-dashboard-section__bg-text">
            <h2 className="app-dashboard-section__bg-label">
              DEINE
            </h2>
            <h2 className="app-dashboard-section__bg-label">
              KONFIRMATION
            </h2>
          </div>

          <div className="app-dashboard-section__content" style={{ textAlign: 'center' }}>
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
            
            <div className="app-dashboard-meta" style={{ justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {nextConfirmationEvent && (
                <>
                  <IonIcon icon={calendar} style={{ fontSize: '0.85rem' }} />
                  <span>{formatEventDate(nextConfirmationEvent.event_date || nextConfirmationEvent.date)} um {formatEventTime(nextConfirmationEvent.event_date || nextConfirmationEvent.date)}</span>
                </>
              )}
              {nextConfirmationEvent && (dashboardData.konfi.confirmation_location || nextConfirmationEvent?.location) && (
                <span className="app-dashboard-dot" />
              )}
              {(dashboardData.konfi.confirmation_location || nextConfirmationEvent?.location) && (
                <>
                  <IonIcon icon={location} style={{ fontSize: '0.85rem' }} />
                  <span>{dashboardData.konfi.confirmation_location || nextConfirmationEvent?.location}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Events Section - direkt nach Konfirmation */}
      {dashboardConfig?.show_events !== false && regularEvents && regularEvents.length > 0 && (
        <div className="app-dashboard-section app-dashboard-section--events">
          {/* Background Text */}
          <div className="app-dashboard-section__bg-text">
            <h2 className="app-dashboard-section__bg-label">
              DEINE
            </h2>
            <h2 className="app-dashboard-section__bg-label">
              EVENTS
            </h2>
          </div>

          {/* Zusaetzlicher Indikator */}
          <div className="app-dashboard-glass-chip" style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            fontSize: '0.7rem',
            fontWeight: '700',
            zIndex: 3
          }}>
            {regularEvents.length === 1 ? 'DEIN EVENT' : `DEINE ${regularEvents.length} EVENTS`}
          </div>

          <div className="app-dashboard-section__content app-dashboard-section__content--compact">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {regularEvents.map((event) => {
                // Warteliste: booking_status kann 'waitlist' oder 'pending' sein
                const isWaitlist = event.booking_status === 'waitlist' || event.booking_status === 'pending';
                return (
                  <div
                    key={event.id}
                    onClick={() => history.push(`/konfi/events/${event.id}`)}
                    className="app-dashboard-glass-card"
                    style={{
                      background: isWaitlist
                        ? 'rgba(251, 191, 36, 0.25)'
                        : undefined,
                      position: 'relative',
                      overflow: 'hidden',
                      border: event.cancelled
                        ? '2px dashed rgba(255,255,255,0.3)'
                        : isWaitlist
                          ? '2px solid rgba(251, 191, 36, 0.5)'
                          : 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, background 0.2s ease'
                    }}>
                    {/* Eselsohr oben rechts */}
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      background: event.cancelled
                        ? 'rgba(255,255,255,0.3)'
                        : isWaitlist
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'rgba(255,255,255,0.25)',
                      borderRadius: '0 10px 0 10px',
                      padding: '4px 10px',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      color: 'white',
                      whiteSpace: 'nowrap',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px'
                    }}>
                      {event.cancelled ? 'ABGESAGT' :
                       isWaitlist ?
                         `Warteliste #${event.waitlist_position || '?'}` :
                         formatTimeUntil(event.event_date || event.date)}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: 'white',
                        marginBottom: '4px',
                        paddingRight: '80px',
                        textDecoration: event.cancelled ? 'line-through' : 'none'
                      }}>
                        {event.title || event.name}
                      </div>
                      <div className="app-dashboard-meta" style={{ flexWrap: 'wrap' }}>
                        <IonIcon icon={calendar} style={{ fontSize: '0.9rem' }} />
                        <span>{formatEventDate(event.event_date || event.date)}</span>
                        <span className="app-dashboard-dot" />
                        <IonIcon icon={time} style={{ fontSize: '0.9rem' }} />
                        <span>
                          {event.booked_timeslot_start
                            ? `${formatEventTime(event.booked_timeslot_start)}${event.booked_timeslot_end ? ` - ${formatEventTime(event.booked_timeslot_end)}` : ''}`
                            : formatEventTime(event.event_date || event.date)
                          }
                        </span>
                        {event.location && (
                          <>
                            <span className="app-dashboard-dot" />
                            <IonIcon icon={location} style={{ fontSize: '0.9rem' }} />
                            <span>{event.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tageslosung - nur wenn echte API-Daten verfügbar */}
      {dashboardConfig?.show_losung !== false && !loadingVerse && actualDailyVerse && (actualDailyVerse.losungstext || actualDailyVerse.lehrtext) && (
        <div className="app-dashboard-section app-dashboard-section--tageslosung">
          {/* Background Text */}
          <div className="app-dashboard-section__bg-text">
            <h2 className="app-dashboard-section__bg-label">
              TAGES
            </h2>
            <h2 className="app-dashboard-section__bg-label">
              LOSUNG
            </h2>
          </div>

          <div className="app-dashboard-section__content">
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
                  <blockquote className="app-dashboard-quote">
                    "{text}"
                  </blockquote>
                  <cite className="app-dashboard-cite">
                    {reference}
                  </cite>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Badges Section - Level-artiges Design mit Icons */}
      {dashboardConfig?.show_badges !== false && (allBadges.available.length > 0 || allBadges.earned.length > 0) && (
        <div className="app-dashboard-section app-dashboard-section--badges">
          {/* Background Text */}
          <div className="app-dashboard-section__bg-text">
            <h2 className="app-dashboard-section__bg-label">
              DEINE
            </h2>
            <h2 className="app-dashboard-section__bg-label">
              BADGES
            </h2>
          </div>

          <div className="app-dashboard-section__content" style={{ padding: '60px 20px 24px 20px' }}>
            {/* Badge Stats Chips */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}>
              <div className="app-dashboard-glass-chip" style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.9rem'
              }}>
                <span style={{ fontWeight: '800' }}>{badgeStats.totalEarned}/{badgeStats.totalAvailable}</span>
                <span style={{ opacity: 0.8, marginLeft: '4px' }}>sichtbar</span>
                {recentVisibleCount > 0 && (
                  <>
                    <span className="app-dashboard-dot" />
                    <span style={{ fontWeight: '800' }}>{recentVisibleCount} {recentVisibleCount === 1 ? 'neuer' : 'neue'}</span>
                  </>
                )}
              </div>
            </div>

            {/* Badge Icons Grid - wie Level Icons */}
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
                            badgePopoverRef.current = { badge, isEarned, getBadgeColor };
                            presentBadgePopover({
                              event: e.nativeEvent,
                              side: 'top',
                              alignment: 'center',
                              cssClass: 'badge-detail-popover'
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
                        justifyContent: 'center',
                        marginBottom: '12px'
                      }}>
                        <div className="app-dashboard-glass-chip" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: '800' }}>{badgeStats.secretEarned}/{badgeStats.secretAvailable}</span>
                          <span style={{ opacity: 0.8, marginLeft: '4px' }}>geheim</span>
                          {recentSecretCount > 0 && (
                            <>
                              <span className="app-dashboard-dot" />
                              <span style={{ fontWeight: '800' }}>{recentSecretCount} {recentSecretCount === 1 ? 'neuer' : 'neue'}</span>
                            </>
                          )}
                        </div>
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
                                badgePopoverRef.current = { badge, isEarned: true, getBadgeColor };
                                presentBadgePopover({
                                  event: e.nativeEvent,
                                  side: 'top',
                                  alignment: 'center',
                                  cssClass: 'badge-detail-popover'
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
                                  : '2px solid rgba(255, 255, 255, 0.3)',
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
                              background: 'rgba(255, 255, 255, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px dashed rgba(255, 255, 255, 0.35)',
                              opacity: 0.6
                            }}
                          >
                            <IonIcon
                              icon={helpCircle}
                              style={{
                                fontSize: '1.2rem',
                                color: 'rgba(255, 255, 255, 0.5)'
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
            </>

            {/* Link zu allen Badges */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <div
                className="app-dashboard-glass-chip"
                onClick={() => history.push('/konfi/badges')}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Alle Badges anzeigen</span>
                <IonIcon icon={chevronForward} style={{ fontSize: '0.9rem' }} />
              </div>
            </div>
          </div>

          {/* CSS Animation für Badges */}
          <style>{`
            @keyframes badgePulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.08); }
            }
          `}</style>
        </div>
      )}

      {/* Ranking Section */}
      {dashboardConfig?.show_ranking !== false && dashboardData.ranking && dashboardData.ranking.length > 0 && (
        <div className="app-dashboard-section app-dashboard-section--ranking">
          {/* Background Text */}
          <div className="app-dashboard-section__bg-text">
            <h2 className="app-dashboard-section__bg-label">
              DEIN
            </h2>
            <h2 className="app-dashboard-section__bg-label">
              RANKING
            </h2>
          </div>

          <div className="app-dashboard-section__content app-dashboard-section__content--compact">
            {/* Platzierung Header - wie Punkte-Display */}
            <div className="app-dashboard-glass-card" style={{
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
              
              <div className="app-dashboard-meta" style={{ justifyContent: 'center', fontSize: '0.9rem' }}>
                <IonIcon icon={trophy} style={{ fontSize: '0.9rem' }} />
                <span>Platz {dashboardData.rank_in_jahrgang || 1}</span>
                <span className="app-dashboard-dot" />
                <span>{dashboardData.konfi.jahrgang_name}</span>
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
                    
                    const entry = item as { id?: number | string; display_name?: string; points?: number; initials?: string; actualRank?: number; rank?: number; isCurrentUser?: boolean; isNeighbor?: boolean; separator?: boolean };
                    const isCurrentUser = entry.isCurrentUser || entry.id === dashboardData.konfi.id;
                    const rank = entry.actualRank ?? entry.rank ?? 0;
                    
                    return (
                      <div key={entry.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: isCurrentUser
                          ? 'rgba(255, 255, 255, 0.2)'
                          : entry.isNeighbor
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '12px',
                        border: isCurrentUser
                          ? '2px solid rgba(255, 255, 255, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.15)',
                        opacity: entry.isNeighbor ? 0.7 : 1
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
                          {entry.initials}
                        </div>

                        {/* Name und Punkte */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'white',
                            marginBottom: '2px'
                          }}>
                            {entry.display_name}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            {entry.points} Punkte
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