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
  };
  total_points: number;
  recent_badges: any[];
  ranking: any[];
}

interface Event {
  id: number;
  title: string;
  event_date: string;
  start_time?: string;
  location?: string;
  registered: boolean;
}

interface Settings {
  target_gottesdienst?: number;
  target_gemeinde?: number;
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
  const [loading, setLoading] = useState(true);

  // Level System - skaliert auf max Punkte
  const getLevelInfo = (points: number, maxPoints: number) => {
    const pointsPerLevel = Math.max(10, Math.floor(maxPoints / 8)); // 8 Level bis max
    const currentLevel = Math.floor(points / pointsPerLevel) + 1;
    const pointsInCurrentLevel = points % pointsPerLevel;
    const pointsToNextLevel = pointsPerLevel - pointsInCurrentLevel;
    
    const levelTitles = [
      'Novize', 'Lehrling', 'Gehilfe', 'Geselle', 'Fachmann', 
      'Experte', 'Meister', 'Virtuose', 'Legende', 'Heiliger'
    ];
    
    const titleIndex = Math.min(Math.floor((currentLevel - 1) / 2), levelTitles.length - 1);
    const levelTitle = levelTitles[titleIndex];
    
    return {
      level: currentLevel,
      title: levelTitle,
      pointsInLevel: pointsInCurrentLevel,
      pointsToNext: pointsToNextLevel,
      totalForLevel: pointsPerLevel,
      progress: (pointsInCurrentLevel / pointsPerLevel) * 100
    };
  };

  useEffect(() => {
    loadDashboardData();
    loadDailyVerse();
    loadUpcomingEvents();
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
        
        setDailyVerse({
          losungstext: apiData.losung?.text || "Der HERR ist mein Hirte, mir wird nichts mangeln.",
          losungsvers: apiData.losung?.reference || "Psalm 23,1",
          lehrtext: apiData.lehrtext?.text || "Jesus spricht: Ich bin der gute Hirte.",
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
      const registeredEvents = response.data.filter((event: any) => event.registered);
      setUpcomingEvents(registeredEvents.slice(0, 3)); // Nur die nächsten 3 angemeldeten Events
    } catch (err) {
      console.error('Error loading events:', err);
      // Events nicht kritisch für Dashboard
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadDashboardData(), loadDailyVerse(), loadUpcomingEvents()]);
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
  const targetGottesdienst = settings.target_gottesdienst || 12;
  const targetGemeinde = settings.target_gemeinde || 8;
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
          {/* Welcome Header */}
          <div style={{
            background: 'linear-gradient(135deg, #3880ff 0%, #3171e0 100%)',
            borderRadius: '24px',
            padding: '32px 24px',
            textAlign: 'center',
            marginBottom: '20px',
            boxShadow: '0 20px 40px rgba(56, 128, 255, 0.3)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Hintergrund Text */}
            <div style={{
              position: 'absolute',
              top: '-15px',
              left: '20px',
              zIndex: 1
            }}>
              <h2 style={{
                fontSize: '6rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-3px'
              }}>
                KONFI
              </h2>
              <h2 style={{
                fontSize: '6rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
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
              fontSize: '2rem',
              fontWeight: '800',
              margin: '0 0 16px 0',
              color: 'white'
            }}>
              Hey {dashboardData.konfi.display_name}!
            </h1>
            
            {/* Gesamtprogress */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
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
                value={dashboardData.total_points / maxPoints}
                style={{
                  height: '12px',
                  borderRadius: '6px',
                  '--progress-background': 'linear-gradient(90deg, #2dd36f, #26c764)',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
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

          {/* Tageslosung Grid */}
          {dailyVerse && (
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '24px',
              padding: '0',
              marginBottom: '20px',
              boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
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
                left: '20px',
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

          {/* Fortschritt Grid */}
          <div style={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            borderRadius: '24px',
            padding: '0',
            marginBottom: '20px',
            boxShadow: '0 20px 40px rgba(255, 107, 53, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '320px'
          }}>
            {/* Überschrift - groß und überlappend */}
            <div style={{
              position: 'absolute',
              top: '-15px',
              left: '20px',
              zIndex: 1
            }}>
              <h2 style={{
                fontSize: '5rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-3px'
              }}>
                FORT
              </h2>
              <h2 style={{
                fontSize: '5rem',
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.1)',
                margin: '0',
                lineHeight: '0.8',
                letterSpacing: '-3px'
              }}>
                SCHRITT
              </h2>
            </div>
            
            {/* Content */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              padding: '32px 24px'
            }}>

            {/* Gottesdienst */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '20px',
              color: 'white',
              marginBottom: '16px'
            }}>
              <h4 style={{
                margin: '0 0 16px 0',
                fontSize: '1.1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <IonIcon icon={home} style={{ fontSize: '1.3rem' }} />
                Gottesdienst
              </h4>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  {gottesdienstPoints} / {targetGottesdienst} Punkte
                </span>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {Math.round(gottesdienstProgress)}%
                </span>
              </div>
              
              <IonProgressBar 
                value={gottesdienstProgress / 100}
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  '--progress-background': '#ffd700',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
            </div>

            {/* Gemeinde */}
            <div style={{
              background: 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)',
              borderRadius: '16px',
              padding: '20px',
              color: 'white'
            }}>
              <h4 style={{
                margin: '0 0 16px 0',
                fontSize: '1.1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <IonIcon icon={people} style={{ fontSize: '1.3rem' }} />
                Gemeinde
              </h4>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  {gemeindePoints} / {targetGemeinde} Punkte
                </span>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {Math.round(gemeindeProgress)}%
                </span>
              </div>
              
              <IonProgressBar 
                value={gemeindeProgress / 100}
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  '--progress-background': '#00d4aa',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
            </div>
            </div>
          </div>

          {/* Leaderboard Grid */}
          {dashboardData.ranking && dashboardData.ranking.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)',
              borderRadius: '24px',
              padding: '0',
              marginBottom: '20px',
              boxShadow: '0 20px 40px rgba(45, 211, 111, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '280px'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '20px',
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
              
              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '50px 24px 24px 24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'end',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '200px'
                }}>
                  {dashboardData.ranking.slice(0, 3).map((player: any, index: number) => {
                    // Korrekte Reihenfolge: 1st, 2nd, 3rd
                    const heights = ['180px', '160px', '140px']; // 1st, 2nd, 3rd
                    const actualIndex = index; // Direkt verwenden
                    const rank = index + 1;
                    
                    const colors = [
                      'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', // Gold
                      'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)', // Silber  
                      'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)'  // Bronze
                    ];
                    
                    const emojis = ['🥇', '🥈', '🥉'];
                    
                    return (
                      <div
                        key={player.id}
                        style={{
                          width: '90px',
                          height: heights[index],
                          background: colors[index],
                          borderRadius: '12px 12px 0 0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          padding: '12px 8px',
                          color: 'white',
                          position: 'relative',
                          border: player.id === dashboardData.konfi.id ? '3px solid #2dd36f' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
                          {emojis[index]}
                        </div>
                        
                        <IonAvatar style={{ width: '40px', height: '40px', marginBottom: '8px' }}>
                          <div style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '0.9rem'
                          }}>
                            {getInitials(player.display_name)}
                          </div>
                        </IonAvatar>
                        
                        <div style={{
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          lineHeight: '1.2'
                        }}>
                          <div style={{ fontWeight: '700', marginBottom: '2px' }}>
                            {player.display_name.split(' ')[0]}
                            {player.id === dashboardData.konfi.id && ' (Du!)'}
                          </div>
                          <div style={{ opacity: 0.9 }}>
                            {player.points}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Achievements Grid */}
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
            borderRadius: '24px',
            padding: '0',
            marginBottom: '20px',
            boxShadow: '0 20px 40px rgba(139, 92, 246, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px'
          }}>
            {/* Überschrift - groß und überlappend */}
            <div style={{
              position: 'absolute',
              top: '-20px',
              left: '20px',
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
                ACHIEVE
              </h2>
              <h2 style={{
                fontSize: '4rem',
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
              padding: '60px 24px 24px 24px'
            }}>
            
            {/* Badge Stats */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: 'white',
                textAlign: 'center',
                minWidth: '100px'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  {dashboardData.recent_badges?.length || 0}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Badges
                </div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: 'white',
                textAlign: 'center',
                minWidth: '100px'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  {Math.floor((dashboardData.recent_badges?.length || 0) * 0.3)}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Geheime
                </div>
              </div>
            </div>
            
            {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {dashboardData.recent_badges.slice(0, 3).map((badge: any, index: number) => (
                  <div
                    key={badge.id || index}
                    style={{
                      background: index === 0 
                        ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 152, 0, 0.3))'
                        : 'rgba(255, 255, 255, 0.2)',
                      border: index === 0 
                        ? '2px solid rgba(255, 193, 7, 0.6)'
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
                        background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
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
                          color: '#333'
                        }}>
                          {badge.name}
                        </h4>
                        {badge.description && (
                          <p style={{
                            margin: '0 0 6px 0',
                            fontSize: '0.85rem',
                            color: '#666',
                            lineHeight: '1.3'
                          }}>
                            {badge.description}
                          </p>
                        )}
                        {badge.earned_at && (
                          <p style={{
                            margin: '0',
                            fontSize: '0.75rem',
                            color: '#999'
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
                background: 'rgba(255, 255, 255, 0.1)',
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

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #eb445a 0%, #d73847 100%)',
              borderRadius: '24px',
              padding: '0',
              marginBottom: '20px',
              boxShadow: '0 20px 40px rgba(235, 68, 90, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '300px'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-20px',
                left: '20px',
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
                padding: '60px 24px 24px 24px'
              }}>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {upcomingEvents.map((event, index) => (
                    <div
                      key={event.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '16px',
                        padding: '16px',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem'
                        }}>
                          📅
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            margin: '0 0 4px 0',
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: 'white'
                          }}>
                            {event.title}
                          </h4>
                          <p style={{
                            margin: '0',
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.8)'
                          }}>
                            {new Date(event.event_date).toLocaleDateString('de-DE', {
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
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;