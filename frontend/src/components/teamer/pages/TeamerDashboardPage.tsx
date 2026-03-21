import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  useIonPopover
} from '@ionic/react';
import {
  home,
  ribbon,
  calendar,
  trophy,
  medal,
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
  business,
  navigate,
  compass,
  pin,
  flag,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer,
  location,
  chevronForward,
  medkit,
  documentOutline,
  bagHandle
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import LoadingSpinner from '../../common/LoadingSpinner';
import { triggerPullHaptic } from '../../../utils/haptics';

// Badge/Certificate Icon Mapping (shared with DashboardView)
const ICON_MAP: Record<string, string> = {
  trophy, medal, ribbon, star, checkmarkCircle, diamond, shield,
  flame, flash, rocket, sparkles, thumbsUp, heart, people, personAdd,
  chatbubbles, gift, book, school, construct, brush, colorPalette,
  sunny, moon, leaf, rose, calendar, today, time, timer, stopwatch,
  restaurant, fitness, bicycle, car, airplane, boat, camera, image,
  musicalNote, balloon, home, business, location, navigate, compass,
  pin, flag, informationCircle, helpCircle, alertCircle, hammer,
  medkit, documentOutline
};

const getIconFromString = (iconName: string | undefined): string => {
  if (!iconName) return trophy;
  return ICON_MAP[iconName] || trophy;
};

interface Certificate {
  id: number;
  name: string;
  icon: string;
  issued_date: string | null;
  expiry_date: string | null;
  status: 'valid' | 'expired' | 'not_earned';
}

// DashboardEvent kommt aus types/event ueber types/dashboard Re-Export
type DashboardEvent = import('../../../types/event').Event;

interface Badge {
  id: number;
  name: string;
  icon?: string;
  awarded_date?: string;
}

interface DashboardConfig {
  show_zertifikate: boolean;
  show_events: boolean;
  show_badges: boolean;
  show_losung: boolean;
}

interface DashboardData {
  greeting: { display_name: string; hour: number };
  certificates: Certificate[];
  events: DashboardEvent[];
  badges: { recent: Badge[]; earned_count: number; total_count: number };
  config: DashboardConfig;
}

interface DailyVerse {
  losungstext: string;
  losungsvers: string;
  lehrtext: string;
  lehrtextvers: string;
}

// Certificate Popover Content
const CertPopoverContent: React.FC<{
  dataRef: React.RefObject<Certificate | null>;
}> = ({ dataRef }) => {
  const cert = dataRef.current;
  if (!cert) return null;

  const statusLabel = cert.status === 'valid' ? 'Gueltig' : cert.status === 'expired' ? 'Abgelaufen' : 'Nicht erhalten';
  const statusColor = cert.status === 'valid' ? '#059669' : cert.status === 'expired' ? '#ef4444' : '#9ca3af';

  return (
    <div style={{ padding: '12px', background: 'white', minWidth: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: statusColor, color: 'white'
        }}>
          <IonIcon icon={getIconFromString(cert.icon)} style={{ fontSize: '1.2rem' }} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>{cert.name}</h3>
          <span style={{ fontSize: '0.75rem', color: statusColor, fontWeight: '600' }}>{statusLabel}</span>
        </div>
      </div>
      {cert.issued_date && (
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
          Ausgestellt: {new Date(cert.issued_date).toLocaleDateString('de-DE')}
        </div>
      )}
      {cert.expiry_date && (
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          Ablauf: {new Date(cert.expiry_date).toLocaleDateString('de-DE')}
        </div>
      )}
    </div>
  );
};

const TeamerDashboardPage: React.FC = () => {
  const history = useHistory();
  const { user } = useApp();
  const [showLosung] = useState(() => Math.random() > 0.5);

  // Certificate Popover
  const certPopoverRef = React.useRef<Certificate | null>(null);
  const [presentCertPopover] = useIonPopover(CertPopoverContent, {
    dataRef: certPopoverRef
  });

  // Offline-Query: Dashboard
  const { data: dashboardData, loading, refresh: refreshDashboard } = useOfflineQuery<DashboardData>(
    'teamer:dashboard:' + user?.id,
    async () => { const res = await api.get('/teamer/dashboard'); return res.data; },
    { ttl: CACHE_TTL.DASHBOARD }
  );

  // Offline-Query: Tageslosung
  const { data: dailyVerse, loading: loadingVerse, refresh: refreshVerse } = useOfflineQuery<DailyVerse | null>(
    'teamer:tageslosung:' + new Date().toISOString().split('T')[0],
    async () => {
      const response = await api.get('/teamer/tageslosung');
      if (response.data && response.data.success) {
        const { losung, lehrtext } = response.data.data;
        return {
          losungstext: losung?.text,
          losungsvers: losung?.reference,
          lehrtext: lehrtext?.text,
          lehrtextvers: lehrtext?.reference
        };
      }
      return null;
    },
    { ttl: CACHE_TTL.TAGESLOSUNG }
  );

  const getFirstName = (name: string) => name.split(' ')[0];

  const getGreeting = (displayName: string): string => {
    const firstName = getFirstName(displayName);
    if (Math.random() < 0.2) {
      return `Moin, ${firstName}!`;
    }

    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return `Guten Morgen, ${firstName}!`;
    if (hour >= 11 && hour < 14) return `Guten Mittag, ${firstName}!`;
    if (hour >= 14 && hour < 18) return `Guten Tag, ${firstName}!`;
    if (hour >= 18 && hour < 22) return `Guten Abend, ${firstName}!`;
    return `Gute Nacht, ${firstName}!`;
  };

  // 1:1 aus DashboardView.tsx
  const formatTimeUntil = (dateString: string | undefined) => {
    if (!dateString) return '';
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    if (diffDays < 0) return 'Vorbei';
    if (diffDays < 7) return `${diffDays} Tage`;
    if (diffDays < 14) return '1 Woche';
    if (diffDays < 21) return '2 Wochen';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} Wochen`;
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

  const config = dashboardData?.config;

  if (loading) {
    return <LoadingSpinner fullScreen message="Dashboard wird geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Konfi Quest</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Konfi Quest</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await Promise.all([refreshDashboard(), refreshVerse()]);
            e.detail.complete();
          }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px' }}>
          {/* Begruessung */}
          {dashboardData && (
            <div className="app-dashboard-header" style={{
              background: 'linear-gradient(135deg, #e11d48 0%, #be185d 50%, #9f1239 100%)'
            }}>
              <div className="app-dashboard-header__circle" style={{
                top: '-40px', right: '-40px', width: '140px', height: '140px',
                background: 'rgba(255, 255, 255, 0.08)'
              }}/>
              <div className="app-dashboard-header__circle" style={{
                top: '60px', right: '30px', width: '60px', height: '60px'
              }}/>
              <div className="app-dashboard-header__circle" style={{
                bottom: '-30px', left: '-30px', width: '100px', height: '100px'
              }}/>
              <div className="app-dashboard-header__circle" style={{
                bottom: '40px', left: '40px', width: '40px', height: '40px'
              }}/>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <h2 className="app-dashboard-greeting">
                  {getGreeting(dashboardData.greeting.display_name)}
                </h2>
                <p className="app-dashboard-subtitle">Teamer:in</p>
              </div>
            </div>
          )}

          {/* Zertifikate */}
          {config?.show_zertifikate !== false && dashboardData && dashboardData.certificates.length > 0 && (
            <div className="app-dashboard-section" style={{
              background: 'linear-gradient(135deg, #e11d48 0%, #be185d 100%)'
            }}>
              <div className="app-dashboard-section__bg-text">
                <h2 className="app-dashboard-section__bg-label">DEINE</h2>
                <h2 className="app-dashboard-section__bg-label">ZERTIFIKATE</h2>
              </div>

              <div className="app-dashboard-glass-chip" style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                fontSize: '0.7rem',
                fontWeight: '700',
                zIndex: 3
              }}>
                {dashboardData.certificates.filter(c => c.status === 'valid').length}/{dashboardData.certificates.length} ERHALTEN
              </div>

              <div className="app-dashboard-section__content" style={{ padding: '60px 16px 20px 16px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px'
                }}>
                  {dashboardData.certificates.map((cert) => {
                    const isValid = cert.status === 'valid';
                    const isExpired = cert.status === 'expired';
                    const isNotEarned = cert.status === 'not_earned';

                    return (
                      <div
                        key={cert.id}
                        onClick={(e) => {
                          certPopoverRef.current = cert;
                          presentCertPopover({ event: e as any });
                        }}
                        style={{
                          borderRadius: '12px',
                          padding: '12px 10px',
                          background: isNotEarned
                            ? 'rgba(255, 255, 255, 0.1)'
                            : isValid
                              ? 'rgba(5, 150, 105, 0.3)'
                              : 'rgba(239, 68, 68, 0.3)',
                          border: isNotEarned
                            ? '2px dashed rgba(255, 255, 255, 0.2)'
                            : isValid
                              ? '2px solid rgba(5, 150, 105, 0.5)'
                              : '2px solid rgba(239, 68, 68, 0.5)',
                          opacity: isNotEarned ? 0.5 : 1,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'transform 0.2s ease'
                        }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isNotEarned
                            ? 'rgba(255, 255, 255, 0.15)'
                            : isValid
                              ? 'rgba(5, 150, 105, 0.5)'
                              : 'rgba(239, 68, 68, 0.5)',
                          color: 'white'
                        }}>
                          <IonIcon
                            icon={getIconFromString(cert.icon)}
                            style={{ fontSize: '1.1rem', opacity: isNotEarned ? 0.5 : 1 }}
                          />
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          color: 'white',
                          textAlign: 'center',
                          lineHeight: '1.15',
                          opacity: isNotEarned ? 0.6 : 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as any
                        }}>
                          {cert.name}
                        </span>
                        {isValid && cert.issued_date && (
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                            Seit {new Date(cert.issued_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {isExpired && (
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                            Abgelaufen
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Events - 1:1 wie Konfi DashboardView */}
          {config?.show_events !== false && dashboardData && (
            <div className="app-dashboard-section app-dashboard-section--events">
              <div className="app-dashboard-section__bg-text">
                <h2 className="app-dashboard-section__bg-label">DEINE</h2>
                <h2 className="app-dashboard-section__bg-label">EVENTS</h2>
              </div>

              <div className="app-dashboard-glass-chip" style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                fontSize: '0.7rem',
                fontWeight: '700',
                zIndex: 3
              }}>
                {dashboardData.events.length === 1 ? 'DEIN EVENT' : `DEINE ${dashboardData.events.length} EVENTS`}
              </div>

              <div className="app-dashboard-section__content app-dashboard-section__content--compact">
                {dashboardData.events.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.7)' }}>
                    Keine anstehenden Events
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dashboardData.events.map((event) => {
                      const isWaitlist = event.booking_status === 'waitlist' || event.booking_status === 'pending';
                      return (
                        <div
                          key={event.id}
                          className="app-dashboard-glass-card"
                          onClick={() => history.push('/teamer/events', { selectedEventId: event.id })}
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
                          }}
                        >
                          {/* Eselsohr oben rechts - 1:1 wie Konfi */}
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
                               'Warteliste' :
                               formatTimeUntil(event.event_date)}
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
                              {event.title}
                            </div>
                            <div className="app-dashboard-meta" style={{ flexWrap: 'wrap' }}>
                              <IonIcon icon={calendar} style={{ fontSize: '0.9rem' }} />
                              <span>{formatEventDate(event.event_date)}</span>
                              <span className="app-dashboard-dot" />
                              <IonIcon icon={time} style={{ fontSize: '0.9rem' }} />
                              <span>{formatEventTime(event.event_date)}</span>
                              {event.location && (
                                <>
                                  <span className="app-dashboard-dot" />
                                  <IonIcon icon={location} style={{ fontSize: '0.9rem' }} />
                                  <span>{event.location}</span>
                                </>
                              )}
                            </div>
                            {event.bring_items && (
                              <div className="app-dashboard-meta" style={{ marginTop: '4px', color: 'rgba(255,255,255,0.9)' }}>
                                <IonIcon icon={bagHandle} style={{ fontSize: '0.9rem', color: '#c4b5fd' }} />
                                <span style={{ fontWeight: '600' }}>Mitbringen: {event.bring_items}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div
                      className="app-dashboard-glass-chip"
                      onClick={() => history.push('/teamer/events')}
                      style={{
                        alignSelf: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Alle Events anzeigen <IonIcon icon={chevronForward} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tageslosung - VOR Badges */}
          {config?.show_losung !== false && !loadingVerse && dailyVerse && (dailyVerse.losungstext || dailyVerse.lehrtext) && (
            <div className="app-dashboard-section app-dashboard-section--tageslosung">
              <div className="app-dashboard-section__bg-text">
                <h2 className="app-dashboard-section__bg-label">TAGES</h2>
                <h2 className="app-dashboard-section__bg-label">LOSUNG</h2>
              </div>
              <div className="app-dashboard-section__content">
                {(() => {
                  const hasLosung = dailyVerse.losungstext;
                  const hasLehrtext = dailyVerse.lehrtext;

                  let text, reference;
                  if (hasLosung && hasLehrtext) {
                    text = showLosung ? dailyVerse.losungstext : dailyVerse.lehrtext;
                    reference = showLosung ? dailyVerse.losungsvers : dailyVerse.lehrtextvers;
                  } else {
                    text = hasLosung ? dailyVerse.losungstext : dailyVerse.lehrtext;
                    reference = hasLosung ? dailyVerse.losungsvers : dailyVerse.lehrtextvers;
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

          {/* Badges - NACH Tageslosung */}
          {config?.show_badges !== false && dashboardData && (
            <div className="app-dashboard-section app-dashboard-section--badges">
              <div className="app-dashboard-section__bg-text">
                <h2 className="app-dashboard-section__bg-label">DEINE</h2>
                <h2 className="app-dashboard-section__bg-label">BADGES</h2>
              </div>

              <div className="app-dashboard-section__content" style={{ padding: '60px 20px 24px 20px' }}>
                {dashboardData.badges.earned_count === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.7)' }}>
                    Noch keine Badges erhalten
                  </div>
                ) : (
                  <>
                    {/* Badge Stats Chip */}
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
                        <span style={{ fontWeight: '800' }}>{dashboardData.badges.earned_count}/{dashboardData.badges.total_count}</span>
                        <span style={{ opacity: 0.8, marginLeft: '4px' }}>erhalten</span>
                      </div>
                    </div>

                    {/* Badge Icons Grid */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      justifyContent: 'center',
                      marginBottom: '16px'
                    }}>
                      {dashboardData.badges.recent.map((badge) => (
                        <div
                          key={badge.id}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer'
                          }}
                        >
                          <IonIcon
                            icon={getIconFromString(badge.icon)}
                            style={{
                              fontSize: '1.2rem',
                              color: 'white',
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Alle Badges Link */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div
                        className="app-dashboard-glass-chip"
                        onClick={() => history.push('/teamer/profil')}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        Alle Badges anzeigen <IonIcon icon={chevronForward} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default TeamerDashboardPage;
