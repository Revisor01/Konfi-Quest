import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonLabel,
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
  documentOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

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

interface DashboardEvent {
  id: number;
  title: string;
  event_date: string;
  location: string;
  is_registered: boolean;
}

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

  const statusLabel = cert.status === 'valid' ? 'Gültig' : cert.status === 'expired' ? 'Abgelaufen' : 'Nicht erhalten';
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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [loadingVerse, setLoadingVerse] = useState(true);
  const [showLosung, setShowLosung] = useState(true);

  // Certificate Popover
  const certPopoverRef = React.useRef<Certificate | null>(null);
  const [presentCertPopover, dismissCertPopover] = useIonPopover(CertPopoverContent, {
    dataRef: certPopoverRef
  });

  const getFirstName = (name: string) => name.split(' ')[0];

  const getGreeting = (displayName: string): string => {
    const firstName = getFirstName(displayName);
    // Moin-Variante bei jedem 5. Laden
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

  const loadDashboard = async () => {
    try {
      const response = await api.get('/teamer/dashboard');
      setDashboardData(response.data);
    } catch (err) {
      console.error('Dashboard laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTageslosung = async () => {
    setShowLosung(Math.random() > 0.5);
    try {
      const response = await api.get('/konfi/tageslosung');
      if (response.data && response.data.success) {
        const { losung, lehrtext } = response.data.data;
        setDailyVerse({
          losungstext: losung?.text,
          losungsvers: losung?.reference,
          lehrtext: lehrtext?.text,
          lehrtextvers: lehrtext?.reference
        });
      } else {
        setDailyVerse(null);
      }
    } catch {
      setDailyVerse(null);
    } finally {
      setLoadingVerse(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadTageslosung();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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
            await Promise.all([loadDashboard(), loadTageslosung()]);
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Begrüßung */}
        {dashboardData && (
          <div className="app-dashboard-header">
            {/* Dekorative Kreise im Hintergrund */}
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
              <p className="app-dashboard-subtitle">Teamer</p>
            </div>
          </div>
        )}

        {/* Zertifikate */}
        {config?.show_zertifikate !== false && dashboardData && dashboardData.certificates.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon" style={{ backgroundColor: '#5b21b6' }}>
                <IonIcon icon={ribbon} />
              </div>
              <IonLabel>Zertifikate</IonLabel>
            </IonListHeader>
            <div style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '8px',
              paddingLeft: '16px',
              paddingRight: '16px',
              WebkitOverflowScrolling: 'touch'
            }}>
              {dashboardData.certificates.map((cert) => {
                const isValid = cert.status === 'valid';
                const isExpired = cert.status === 'expired';
                const isNotEarned = cert.status === 'not_earned';

                const bgColor = isValid ? '#059669' : isExpired ? '#ef4444' : '#e5e7eb';
                const textColor = isNotEarned ? '#9ca3af' : 'white';

                return (
                  <div
                    key={cert.id}
                    onClick={(e) => {
                      certPopoverRef.current = cert;
                      presentCertPopover({ event: e as any });
                    }}
                    style={{
                      minWidth: '160px',
                      maxWidth: '160px',
                      borderRadius: '16px',
                      padding: '16px',
                      background: isNotEarned ? '#f3f4f6' : `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}cc 100%)`,
                      opacity: isNotEarned ? 0.4 : 1,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: isNotEarned ? 'none' : `0 4px 12px ${bgColor}40`,
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isNotEarned ? '#d1d5db' : 'rgba(255,255,255,0.2)',
                      color: textColor
                    }}>
                      <IonIcon
                        icon={getIconFromString(cert.icon)}
                        style={{ fontSize: '1.4rem', opacity: isNotEarned ? 0.5 : 1 }}
                      />
                    </div>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: textColor,
                      textAlign: 'center',
                      lineHeight: '1.2'
                    }}>
                      {cert.name}
                    </span>
                    {isValid && cert.issued_date && (
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>
                        Seit {new Date(cert.issued_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {isExpired && (
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
                        Abgelaufen
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </IonList>
        )}

        {/* Nächste Events */}
        {config?.show_events !== false && dashboardData && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={calendar} />
              </div>
              <IonLabel>Nächste Events</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {dashboardData.events.length === 0 ? (
                  <div className="app-empty-state">
                    <p className="app-empty-state__text">Keine anstehenden Events</p>
                  </div>
                ) : (
                  <>
                    {dashboardData.events.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="app-list-item app-list-item--events"
                        style={{ marginBottom: '8px', position: 'relative', overflow: 'hidden' }}
                      >
                        {event.is_registered && (
                          <div className="app-corner-badge" style={{ backgroundColor: '#059669' }}>
                            Angemeldet
                          </div>
                        )}
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-icon-circle app-icon-circle--events">
                              <IonIcon icon={calendar} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title app-list-item__title--badge-space">
                                {event.title}
                              </div>
                              <div className="app-list-item__meta">
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={calendar} className="app-icon-color--events" />
                                  {formatDate(event.event_date)}
                                </span>
                                {event.location && (
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={location} className="app-icon-color--events" />
                                    {event.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '8px',
                        cursor: 'pointer',
                        color: '#5b21b6',
                        fontWeight: '600',
                        fontSize: '0.85rem'
                      }}
                      onClick={() => history.push('/teamer/events')}
                    >
                      Alle anzeigen
                      <IonIcon icon={chevronForward} />
                    </div>
                  </>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Badges */}
        {config?.show_badges !== false && dashboardData && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--badges">
                <IonIcon icon={trophy} />
              </div>
              <IonLabel>Badges</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {dashboardData.badges.earned_count === 0 ? (
                  <div className="app-empty-state">
                    <p className="app-empty-state__text">Noch keine Badges erhalten</p>
                  </div>
                ) : (
                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => history.push('/teamer/profil')}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      {dashboardData.badges.recent.slice(0, 3).map((badge) => (
                        <div
                          key={badge.id}
                          style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(245,158,11,0.3)'
                          }}
                        >
                          <IonIcon icon={getIconFromString(badge.icon)} style={{ fontSize: '1.2rem' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>
                        {dashboardData.badges.earned_count} von {dashboardData.badges.total_count} Badges
                      </span>
                      <IonIcon icon={chevronForward} style={{ color: '#5b21b6', fontSize: '1.1rem' }} />
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Tageslosung */}
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

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default TeamerDashboardPage;
