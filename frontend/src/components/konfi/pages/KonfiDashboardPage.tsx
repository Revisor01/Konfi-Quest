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
                  {(() => {
                    // Podium-Reihenfolge: 2nd, 1st, 3rd (klassische Darstellung)
                    const topThree = dashboardData.ranking.slice(0, 3);
                    if (topThree.length >= 2) {
                      const reordered = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
                      return reordered.map((player: any, visualIndex: number) => {
                        // Bestimme die echte Position
                        const realRank = dashboardData.ranking.findIndex((p: any) => p.id === player.id) + 1;
                        const heights = ['160px', '180px', '140px']; // 2nd, 1st, 3rd visual heights
                        const colors = [
                          'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)', // Silber (2nd)
                          'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', // Gold (1st)
                          'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)'  // Bronze (3rd)
                        ];
                        const emojis = ['🥈', '🥇', '🥉'];
                    
                    return (
                      <div
                        key={player.id}
                        style={{
                          width: '90px',
                          height: heights[visualIndex],
                          background: colors[visualIndex],
                          borderRadius: '16px 16px 0 0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          padding: '12px 8px',
                          color: 'white',
                          position: 'relative',
                          border: player.id === dashboardData.konfi.id ? '3px solid #2dd36f' : 'none',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                          transform: visualIndex === 1 ? 'scale(1.05)' : 'scale(1)'
                        }}
                      >
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
                          {emojis[visualIndex]}
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
                      });
                    } else {
                      // Fallback für weniger als 2 Spieler
                      return dashboardData.ranking.slice(0, 3).map((player: any, index: number) => {
                        const heights = ['180px', '160px', '140px'];
                        const colors = [
                          'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                          'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
                          'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)'
                        ];
                        const emojis = ['🥇', '🥈', '🥉'];
                        
                        return (
                          <div key={player.id} style={{
                            width: '90px',
                            height: heights[index],
                            background: colors[index],
                            borderRadius: '16px 16px 0 0',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            padding: '12px 8px',
                            color: 'white',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                            transform: index === 0 ? 'scale(1.05)' : 'scale(1)',
                            position: 'relative',
                            border: player.id === dashboardData.konfi.id ? '3px solid #2dd36f' : 'none'
                          }}>
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
                                fontWeight: '600',
                                fontSize: '0.9rem'
                              }}>
                                {player.initials}
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
                      });
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Achievements Grid - ORANGE */}
          <div style={{
            background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
            borderRadius: '24px',
            padding: '0',
            marginBottom: '20px',
            boxShadow: '0 20px 40px rgba(255, 149, 0, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px'
          }}>
            {/* Überschrift - groß und überlappend */}
            <div style={{
              position: 'absolute',
              top: '-20px',
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
                  {dashboardData.badge_count || 0}
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
                  {dashboardData.event_count || 0}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Events
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
                        ? 'rgba(255, 193, 7, 0.3)'
                        : 'rgba(255, 255, 255, 0.25)',
                      border: index === 0 
                        ? '2px solid rgba(255, 193, 7, 0.6)'
                        : '2px solid rgba(255, 255, 255, 0.4)',
                      backdropFilter: 'blur(15px)',
                      borderRadius: '16px',
                      padding: '16px',
                      position: 'relative',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
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
          {/* Events Section - Immer anzeigen */}
          {(
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
                padding: '60px 24px 24px 24px'
              }}>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {upcomingEvents.length > 0 ? upcomingEvents.map((event, index) => (
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
                  )) : (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '16px',
                      padding: '24px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '2rem',
                        marginBottom: '12px'
                      }}>
                        📅
                      </div>
                      <h4 style={{
                        margin: '0 0 8px 0',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: 'white'
                      }}>
                        Keine bevorstehenden Events
                      </h4>
                      <p style={{
                        margin: '0',
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        Schau später wieder vorbei oder melde dich für neue Events an!
                      </p>
                    </div>
                  )}
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