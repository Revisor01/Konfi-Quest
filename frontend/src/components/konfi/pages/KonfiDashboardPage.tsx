import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonProgressBar,
  IonAvatar
} from '@ionic/react';
import {
  home,
  people,
  trophy,
  star
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface DashboardData {
  konfi: {
    id: number;
    display_name: string;
    jahrgang_name: string;
    gottesdienst_points: number;
    gemeinde_points: number;
    confirmation_date?: string;
  };
  total_points: number;
  recent_badges: any[];
  badge_count: number;
  recent_events: any[];
  event_count: number;
  ranking: any[];
  days_to_confirmation?: number;
  confirmation_date?: string;
}

interface Event {
  id: number;
  title: string;
  event_date: string;
  date?: string;
  start_time?: string;
  location?: string;
  registered: boolean;
  is_registered?: boolean;
}

interface Settings {
  target_gottesdienst?: number;
  target_gemeinde?: number;
}

interface BadgeStats {
  totalAvailable: number;
  totalEarned: number;
  secretAvailable: number;
  secretEarned: number;
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

const KonfiDashboardPage: React.FC = () => {
  const { user, setError } = useApp();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [showLehrtext, setShowLehrtext] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [badgeStats, setBadgeStats] = useState<BadgeStats>({ totalAvailable: 0, totalEarned: 0, secretAvailable: 0, secretEarned: 0 });
  const [loading, setLoading] = useState(true);

  // Level System - dynamisch skaliert mit besserer Progression
  const getLevelInfo = (points: number, maxPoints: number) => {
    const levelTitles = [
      'Novize', 'Lehrling', 'Gehilfe', 'Geselle', 'Fachmann', 
      'Experte', 'Meister', 'Virtuose', 'Legende', 'Heiliger'
    ];
    
    // Dynamische Level-Berechnung basierend auf Prozent-Completion
    const completionPercent = Math.min((points / maxPoints) * 100, 300); // Cap bei 300%
    
    let currentLevel: number;
    let titleIndex: number;
    
    if (completionPercent <= 100) {
      // 0-100%: Level 1-5 (Novize bis Fachmann)
      currentLevel = Math.floor(completionPercent / 20) + 1; // 20% pro Level
      titleIndex = Math.min(currentLevel - 1, 4);
    } else {
      // 100%+: Level 6-10 (Experte bis Heiliger)
      const overPercent = completionPercent - 100; // 0-200%
      currentLevel = 5 + Math.floor(overPercent / 40) + 1; // 40% pro Level über 100%
      titleIndex = Math.min(4 + Math.floor(overPercent / 40) + 1, levelTitles.length - 1);
    }
    
    // Berechne Punkte für aktuelles Level
    let pointsForCurrentLevel: number;
    let pointsForNextLevel: number;
    
    if (currentLevel <= 5) {
      // Level 1-5: Gleichmäßige Verteilung bis 100%
      pointsForCurrentLevel = Math.floor(maxPoints * (currentLevel - 1) * 0.2);
      pointsForNextLevel = Math.floor(maxPoints * currentLevel * 0.2);
    } else {
      // Level 6+: Höhere Anforderungen
      const basePoints = maxPoints; // 100% erreicht
      const levelOver5 = currentLevel - 5;
      pointsForCurrentLevel = basePoints + Math.floor(maxPoints * (levelOver5 - 1) * 0.4);
      pointsForNextLevel = basePoints + Math.floor(maxPoints * levelOver5 * 0.4);
    }
    
    const pointsInCurrentLevel = points - pointsForCurrentLevel;
    const pointsToNextLevel = Math.max(0, pointsForNextLevel - points);
    const totalForLevel = pointsForNextLevel - pointsForCurrentLevel;
    
    return {
      level: currentLevel,
      title: levelTitles[titleIndex],
      pointsInLevel: Math.max(0, pointsInCurrentLevel),
      pointsToNext: pointsToNextLevel,
      totalForLevel: totalForLevel,
      progress: totalForLevel > 0 ? (pointsInCurrentLevel / totalForLevel) * 100 : 100
    };
  };

  useEffect(() => {
    loadDashboardData();
    loadDailyVerse();
    loadUpcomingEvents();
    loadBadgeStats();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [dashboardResponse, settingsResponse] = await Promise.all([
        api.get('/konfi/dashboard'),
        api.get('/settings').catch(() => ({ data: {} }))
      ]);
      
      setDashboardData(dashboardResponse.data);
      setSettings(settingsResponse.data);
    } catch (err) {
      setError('Fehler beim Laden der Dashboard-Daten');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyVerse = async () => {
    try {
      // Echte Tageslosung von API laden
      const response = await api.get('/konfi/tageslosung');
      
      if (response.data.success && response.data.data) {
        const apiData = response.data.data;
        
        // Random zwischen Losung und Lehrtext wählen
        const useLosung = Math.random() > 0.5;
        
        // Entferne eckige Klammern aus den Texten
        const cleanText = (text: string) => text?.replace(/\[|\]/g, '') || '';
        
        setDailyVerse({
          losungstext: cleanText(apiData.losung?.text) || "Der HERR ist mein Hirte, mir wird nichts mangeln.",
          losungsvers: apiData.losung?.reference || "Psalm 23,1",
          lehrtext: cleanText(apiData.lehrtext?.text) || "Jesus spricht: Ich bin der gute Hirte.",
          lehrtextvers: apiData.lehrtext?.reference || "Johannes 10,11",
          date: apiData.date || new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
          translation: apiData.translation?.name || 'Lutherbibel 2017',
          fallback: response.data.fallback || false,
          cached: response.data.cached || false
        });
        
        setShowLehrtext(useLosung);
      } else {
        throw new Error('Invalid API response');
      }
    } catch (err) {
      console.log('Could not load daily verse from API, using fallback:', err);
      
      // Fallback-Daten wenn API nicht funktioniert
      const fallbackVerses = [
        {
          losungstext: "Der HERR ist mein Hirte, mir wird nichts mangeln.",
          losungsvers: "Psalm 23,1",
          lehrtext: "Jesus spricht: Ich bin der gute Hirte. Der gute Hirte lässt sein Leben für die Schafe.",
          lehrtextvers: "Johannes 10,11"
        }
      ];
      
      const randomVerse = fallbackVerses[0];
      setShowLehrtext(Math.random() > 0.5);
      
      setDailyVerse({
        ...randomVerse,
        date: new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
        translation: 'Lutherbibel 2017 (Offline)',
        fallback: true
      });
    }
  };

  const loadUpcomingEvents = async () => {
    try {
      const response = await api.get('/konfi/events');
      // Show next 3 upcoming events (both registered and available)
      const upcomingEvents = response.data
        .filter((event: any) => new Date(event.event_date || event.date) >= new Date())
        .slice(0, 3);
      setUpcomingEvents(upcomingEvents);
    } catch (err) {
      console.error('Error loading events:', err);
      // Events nicht kritisch für Dashboard
    }
  };

  const loadBadgeStats = async () => {
    try {
      const response = await api.get('/konfi/badges');
      const { available, earned, stats } = response.data;
      
      // Count visible badges earned vs available
      const visibleEarned = earned.filter((badge: any) => !badge.is_hidden).length;
      const visibleTotal = stats?.totalVisible || 0;
      
      // Count secret badges earned vs total secret
      const secretEarned = earned.filter((badge: any) => badge.is_hidden === true).length;
      const secretTotal = stats?.totalSecret || 0;
      
      setBadgeStats({
        totalAvailable: visibleTotal,
        totalEarned: visibleEarned, 
        secretAvailable: secretTotal,
        secretEarned: secretEarned
      });
    } catch (err) {
      console.error('Error loading badge stats:', err);
      // Badge stats nicht kritisch für Dashboard
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadDashboardData(), loadDailyVerse(), loadUpcomingEvents(), loadBadgeStats()]);
    event.detail.complete();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Konfi Quest wird geladen..." />;
  }

  if (!dashboardData) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Konfi Quest</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <p style={{ textAlign: 'center', marginTop: '50px' }}>
            Keine Dashboard-Daten verfügbar
          </p>
        </IonContent>
      </IonPage>
    );
  }

  const gottesdienstPoints = dashboardData.konfi.gottesdienst_points || 0;
  const gemeindePoints = dashboardData.konfi.gemeinde_points || 0;
  const targetGottesdienst = settings.target_gottesdienst || 10;
  const targetGemeinde = settings.target_gemeinde || 10;
  const maxPoints = targetGottesdienst + targetGemeinde;
  const levelInfo = getLevelInfo(dashboardData.total_points, maxPoints);

  const gottesdienstProgress = Math.min((gottesdienstPoints / targetGottesdienst) * 100, 100);
  const gemeindeProgress = Math.min((gemeindePoints / targetGemeinde) * 100, 100);

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Konfi Quest</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent 
        fullscreen
        style={{ 
          '--background': '#f8f9fa'
        }}
      >
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black', fontWeight: '700' }}>
              Konfi Quest
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px' }}>
          {/* Konfi Info Header - LILA */}
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
            borderRadius: '24px',
            padding: '24px',
            textAlign: 'left',
            marginBottom: '16px',
            boxShadow: '0 20px 40px rgba(139, 92, 246, 0.3)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Hintergrund Text */}
            <div style={{
              position: 'absolute',
              top: '-15px',
              left: '16px',
              zIndex: 1
            }}>
              <h2 style={{
                fontSize: '5rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.08)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-3px'
              }}>
                KONFI
              </h2>
              <h2 style={{
                fontSize: '5rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.08)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-3px'
              }}>
                QUEST
              </h2>
            </div>
            
            {/* Content */}
            <div style={{
              position: 'relative',
              zIndex: 2
            }}>
            <h1 style={{
              fontSize: '1.8rem',
              fontWeight: '800',
              margin: '0 0 8px 0',
              color: 'white'
            }}>
              Hey {dashboardData.konfi.display_name}!
            </h1>
            <p style={{
              fontSize: '1rem',
              margin: '0 0 16px 0',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '500'
            }}>
              {dashboardData.konfi.jahrgang_name}
            </p>
            
            {/* Gesamtprogress */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '1rem', color: 'white', fontWeight: '600' }}>
                  Gesamtfortschritt
                </span>
                <span style={{ fontSize: '1rem', color: 'white', fontWeight: '600' }}>
                  {dashboardData.total_points} / {maxPoints} Punkte
                </span>
              </div>
              
              <IonProgressBar 
                value={Math.min(dashboardData.total_points / maxPoints, 1)}
                style={{
                  height: '10px',
                  borderRadius: '5px',
                  '--progress-background': 'linear-gradient(90deg, #2dd36f, #26c764)',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
              
              {/* Einzelfortschritte - schmale Progress Bars */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>Gottesdienst</span>
                    <span>{gottesdienstPoints}/{targetGottesdienst}</span>
                  </div>
                  <IonProgressBar 
                    value={Math.min(gottesdienstPoints / targetGottesdienst, 1)}
                    style={{
                      height: '4px',
                      borderRadius: '2px',
                      '--progress-background': '#3880ff',
                      '--background': 'rgba(255, 255, 255, 0.3)'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>Gemeinde</span>
                    <span>{gemeindePoints}/{targetGemeinde}</span>
                  </div>
                  <IonProgressBar 
                    value={Math.min(gemeindePoints / targetGemeinde, 1)}
                    style={{
                      height: '4px',
                      borderRadius: '2px',
                      '--progress-background': '#2dd36f',
                      '--background': 'rgba(255, 255, 255, 0.3)'
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Level & Points Display */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                borderRadius: '15px',
                padding: '12px 20px',
                color: 'white',
                minWidth: '120px'
              }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0' }}>
                  {dashboardData.total_points}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                  Punkte
                </div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '15px',
                padding: '12px 20px',
                color: 'white',
                minWidth: '120px'
              }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0' }}>
                  Level {levelInfo.level}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                  {levelInfo.title}
                </div>
              </div>
            </div>

            {/* Level Progress */}
            <div style={{
              background: '#f8f9fa',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: '600' }}>
                  Noch {levelInfo.pointsToNext} Punkte bis Level {levelInfo.level + 1}
                </span>
                <span style={{ fontSize: '0.9rem', color: '#666' }}>
                  {Math.round(levelInfo.progress)}%
                </span>
              </div>
              
              <IonProgressBar 
                value={levelInfo.progress / 100}
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  '--progress-background': 'linear-gradient(90deg, #ff6b35, #f7931e)',
                  '--background': '#e9ecef'
                }}
              />
            </div>
            </div>
          </div>

          {/* Tageslosung Grid - BLAU */}
          {dailyVerse && (
            <div style={{
              background: 'linear-gradient(135deg, #3880ff 0%, #3171e0 100%)',
              borderRadius: '24px',
              padding: '0',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(56, 128, 255, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '12px',
                zIndex: 2
              }}>
                <h2 style={{
                  fontSize: '4rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.15)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  TAGES
                </h2>
                <h2 style={{
                  fontSize: '4rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.15)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  LOSUNG
                </h2>
              </div>
              
              {/* Content - über die Überschrift */}
              <div style={{
                position: 'relative',
                zIndex: 3,
                padding: '60px 24px 40px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <blockquote style={{
                  margin: '0 0 24px 0',
                  fontSize: '1.3rem',
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                  color: 'white',
                  fontWeight: '500',
                  textAlign: 'center'
                }}>
                  "{showLehrtext ? dailyVerse.lehrtext : dailyVerse.losungstext}"
                </blockquote>
                
                <cite style={{
                  fontSize: '1rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: '600',
                  fontStyle: 'normal',
                  textAlign: 'center',
                  letterSpacing: '0.5px'
                }}>
                  — {showLehrtext ? dailyVerse.lehrtextvers : dailyVerse.losungsvers}
                </cite>
              </div>
            </div>
          )}

          {/* Events - ROT */}
          <div style={{
            background: 'linear-gradient(135deg, #eb445a 0%, #d73847 100%)',
            borderRadius: '24px',
            padding: '0',
            marginBottom: '16px',
            boxShadow: '0 20px 40px rgba(235, 68, 90, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Überschrift - groß und überlappend */}
            <div style={{
              position: 'absolute',
              top: '-10px',
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
                MEINE
              </h2>
              <h2 style={{
                fontSize: '4rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-2px'
              }}>
                EVENTS
              </h2>
            </div>
            
            {/* Content */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              padding: '60px 24px 24px 24px',
              flex: 1
            }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                {upcomingEvents.length > 0 ? upcomingEvents.map((event, index) => (
                  <div
                    key={event.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '16px',
                      color: 'white'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0
                      }}>
                        📅
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <h4 style={{
                            margin: '0',
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: 'white',
                            flex: 1
                          }}>
                            {event.title}
                          </h4>
                          {event.is_registered && (
                            <div style={{
                              background: 'rgba(46, 211, 111, 0.8)',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: '600'
                            }}>
                              ✓ Angemeldet
                            </div>
                          )}
                        </div>
                        <p style={{
                          margin: '0',
                          fontSize: '0.85rem',
                          color: 'rgba(255, 255, 255, 0.9)'
                        }}>
                          {new Date(event.event_date || event.date || '').toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                          {event.start_time && ` • ${event.start_time}`}
                          {event.location && ` • ${event.location}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '24px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      marginBottom: '8px'
                    }}>
                      📅
                    </div>
                    <h4 style={{
                      margin: '0 0 4px 0',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: 'white'
                    }}>
                      Keine bevorstehenden Events
                    </h4>
                    <p style={{
                      margin: '0',
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      Schau später wieder vorbei oder melde dich für neue Events an!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Konfirmationsdatum Card - ORANGE */}
          {dashboardData.days_to_confirmation && (
            <div style={{
              background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
              borderRadius: '24px',
              padding: '0',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(255, 149, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '12px',
                zIndex: 1
              }}>
                <h2 style={{
                  fontSize: '3.5rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.1)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  KONFI
                </h2>
              </div>
              
              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '60px 24px 24px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  color: 'white',
                  marginBottom: '8px'
                }}>
                  {dashboardData.days_to_confirmation}
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '8px',
                  fontWeight: '600'
                }}>
                  Tage bis zur Konfirmation
                </div>
                {dashboardData.confirmation_date && (
                  <div style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500'
                  }}>
                    {new Date(dashboardData.confirmation_date).toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Leaderboard - GRÜN */}
          {dashboardData.ranking && dashboardData.ranking.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)',
              borderRadius: '24px',
              padding: '0',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(45, 211, 111, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '280px'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-10px',
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
                  LEADER
                </h2>
                <h2 style={{
                  fontSize: '4.5rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.1)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  BOARD
                </h2>
              </div>
              
              {/* Podium Top 3 */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '50px 24px 0 24px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'end',
                  gap: '4px',
                  marginBottom: '24px',
                  height: '120px'
                }}>
                  {(() => {
                    const topThree = dashboardData.ranking.slice(0, 3);
                    if (topThree.length === 0) return null;
                    
                    // Immer 2-1-3 Reihenfolge für Podium
                    const podiumOrder = topThree.length >= 2 ? 
                      [topThree[1], topThree[0], topThree[2]].filter(Boolean) : 
                      [topThree[0]];
                    
                    return podiumOrder.map((player: any, visualIndex: number) => {
                      const realRank = dashboardData.ranking.findIndex((p: any) => p.id === player.id) + 1;
                      const heights = ['90px', '120px', '70px'];
                      const scales = [0.85, 1, 0.75];
                      const emojis = ['🥈', '🥇', '🥉'];
                      const isMe = player.id === dashboardData.konfi.id;
                      
                      return (
                        <div
                          key={player.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            transform: `scale(${scales[visualIndex]})`,
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {/* Medal */}
                          <div style={{
                            fontSize: '2rem',
                            marginBottom: '4px',
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                          }}>
                            {emojis[visualIndex]}
                          </div>
                          
                          {/* Avatar */}
                          <div style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            background: isMe ? 
                              'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)' :
                              'rgba(255, 255, 255, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '1.1rem',
                            border: isMe ? '3px solid rgba(255, 255, 255, 0.6)' : '2px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                            marginBottom: '8px'
                          }}>
                            {getInitials(player.display_name)}
                          </div>
                          
                          {/* Name & Points */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              color: 'white',
                              fontWeight: '700',
                              fontSize: '0.9rem',
                              marginBottom: '2px'
                            }}>
                              {player.display_name.split(' ')[0]}
                              {isMe && ' ✨'}
                            </div>
                            <div style={{
                              color: 'rgba(255, 255, 255, 0.8)',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              {player.points} P
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                {/* Rest der Rangliste */}
                {dashboardData.ranking.length > 3 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      marginBottom: '12px',
                      textAlign: 'center'
                    }}>
                      Weitere Teilnehmer
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {dashboardData.ranking.slice(3, 8).map((player: any, index: number) => {
                        const rank = index + 4;
                        const isMe = player.id === dashboardData.konfi.id;
                        
                        return (
                          <div
                            key={player.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '8px 12px',
                              borderRadius: '12px',
                              background: isMe ? 
                                'rgba(255, 107, 53, 0.2)' :
                                'rgba(255, 255, 255, 0.1)',
                              border: isMe ? '2px solid rgba(255, 107, 53, 0.4)' : 'none'
                            }}
                          >
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '700'
                            }}>
                              {rank}
                            </div>
                            
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isMe ? 
                                'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)' :
                                'rgba(255, 255, 255, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              {getInitials(player.display_name)}
                            </div>
                            
                            <div style={{ flex: 1 }}>
                              <div style={{
                                color: 'white',
                                fontSize: '0.9rem',
                                fontWeight: '600'
                              }}>
                                {player.display_name.split(' ')[0]}
                                {isMe && ' (Du)'}
                              </div>
                            </div>
                            
                            <div style={{
                              color: 'rgba(255, 255, 255, 0.8)',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}>
                              {player.points}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Achievements - ORANGE */}
          <div style={{
            background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
            borderRadius: '24px',
            padding: '0',
            marginBottom: '16px',
            boxShadow: '0 20px 40px rgba(255, 149, 0, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Überschrift - groß und überlappend */}
            <div style={{
              position: 'absolute',
              top: '-10px',
              left: '12px',
              zIndex: 1
            }}>
              <h2 style={{
                fontSize: '3.5rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-2px'
              }}>
                ACHIEVE
              </h2>
              <h2 style={{
                fontSize: '3.5rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-2px'
              }}>
                MENTS
              </h2>
            </div>
            
            {/* Content */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              padding: '60px 24px 24px 24px',
              flex: 1
            }}>
              {/* Badge Stats */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '20px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: 'white',
                  textAlign: 'center',
                  minWidth: '140px'
                }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>
                    {badgeStats.totalEarned}/{badgeStats.totalAvailable}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Badges
                  </div>
                </div>
                
                {badgeStats.secretAvailable > 0 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: 'white',
                    textAlign: 'center',
                    minWidth: '140px'
                  }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>
                      {badgeStats.secretEarned}/{badgeStats.secretAvailable}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Geheime
                    </div>
                  </div>
                )}
              </div>
              
              {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {dashboardData.recent_badges.slice(0, 3).map((badge: any, index: number) => (
                    <div
                      key={badge.id || index}
                      style={{
                        background: index === 0 
                          ? 'rgba(255, 255, 255, 0.3)'
                          : 'rgba(255, 255, 255, 0.15)',
                        border: index === 0 
                          ? '2px solid rgba(255, 255, 255, 0.6)'
                          : '2px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '16px',
                        padding: '16px',
                        position: 'relative'
                      }}
                    >
                      {index === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          textTransform: 'uppercase'
                        }}>
                          Neu
                        </div>
                      )}
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        <div style={{ fontSize: '2.5rem' }}>
                          {badge.icon || '🏆'}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            margin: '0 0 4px 0',
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: 'white'
                          }}>
                            {badge.name}
                          </h4>
                          {badge.description && (
                            <p style={{
                              margin: '0 0 6px 0',
                              fontSize: '0.85rem',
                              color: 'rgba(255, 255, 255, 0.8)',
                              lineHeight: '1.3'
                            }}>
                              {badge.description}
                            </p>
                          )}
                          {badge.earned_at && (
                            <p style={{
                              margin: '0',
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.6)'
                            }}>
                              {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 20px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  border: '2px dashed rgba(255, 255, 255, 0.3)'
                }}>
                  <h4 style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    margin: '0 0 12px 0',
                    color: 'white'
                  }}>
                    Erstes Achievement wartet!
                  </h4>
                  <p style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    margin: '0'
                  }}>
                    Sammle Punkte um dein erstes Badge zu bekommen!
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;