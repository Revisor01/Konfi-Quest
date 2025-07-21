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
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonBadge,
  IonAvatar,
  IonProgressBar
} from '@ionic/react';
import {
  star,
  trophy,
  heart,
  sparkles,
  calendar
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface DashboardData {
  konfi: {
    id: number;
    name: string;
    jahrgang_name: string;
    gottesdienst_points: number;
    gemeinde_points: number;
    activities?: any[];
    bonus_points?: any[];
  };
  total_points: number;
  recent_badges: any[];
  next_event?: {
    id: number;
    title: string;
    date: string;
    points: number;
    event_type: string;
  };
  confirmation_event?: {
    date: string;
    days_remaining: number;
  };
  // Progress requirements
  required_gottesdienst_points: number;
  required_gemeinde_points: number;
  required_total_points: number;
}

const KonfiDashboardPage: React.FC = () => {
  const { user, setError } = useApp();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error('Keine Benutzer-ID verfügbar');
      }
      
      // Use existing endpoints to get dashboard data
      const [konfiResponse, badgesResponse, eventsResponse] = await Promise.all([
        api.get(`/konfi/profile`),
        api.get(`/konfi/badges`).catch(() => ({ data: { earned: [], available: [] } })), // Fallback für Badges
        api.get('/events').catch(() => ({ data: [] })) // Get events to find next registered event and confirmation
      ]);
      
      const konfiData = konfiResponse.data;
      const badgesData = badgesResponse.data;
      const eventsData = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];
      
      // Find next registered event for this konfi
      const registeredEvents = eventsData.filter((event: any) => 
        event.registrations && event.registrations.some((reg: any) => reg.konfi_id === user.id)
      );
      
      const upcomingEvents = registeredEvents
        .filter((event: any) => new Date(event.date) > new Date())
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const nextEvent = upcomingEvents[0] || null;
      
      // Find confirmation event
      const confirmationEvent = eventsData.find((event: any) => 
        event.event_type === 'konfirmation' && 
        event.registrations && event.registrations.some((reg: any) => reg.konfi_id === user.id)
      );
      
      let confirmationData = null;
      if (confirmationEvent) {
        const confirmationDate = new Date(confirmationEvent.date);
        const today = new Date();
        const daysRemaining = Math.ceil((confirmationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        confirmationData = {
          date: confirmationEvent.date,
          days_remaining: daysRemaining
        };
      }
      
      // Build dashboard data
      // Check if API has calculated points or if we need to calculate from activities
      let gottesdienstPoints = konfiData.gottesdienst_points;
      let gemeindePoints = konfiData.gemeinde_points;
      let totalPoints = konfiData.total_points;
      
      // If points are null/undefined, calculate from activities + bonus
      if (gottesdienstPoints === null || gottesdienstPoints === undefined || 
          gemeindePoints === null || gemeindePoints === undefined) {
        
        console.log('📊 API points are null, calculating from activities + bonus');
        
        // Base points from activities
        const baseGottesdienstPoints = konfiData.activities
          ?.filter((activity: any) => activity.type === 'gottesdienst')
          ?.reduce((sum: number, activity: any) => sum + (activity.points || 0), 0) || 0;
        
        const baseGemeindePoints = konfiData.activities
          ?.filter((activity: any) => activity.type === 'gemeinde')
          ?.reduce((sum: number, activity: any) => sum + (activity.points || 0), 0) || 0;
        
        // Bonus points categorized by type - use bonusPoints (not bonus_points!)
        let bonusGottesdienstPoints = 0;
        let bonusGemeindePoints = 0;
        
        if (konfiData.bonusPoints && Array.isArray(konfiData.bonusPoints)) {
          bonusGottesdienstPoints = konfiData.bonusPoints
            .filter((bonus: any) => bonus.type === 'gottesdienst')
            .reduce((sum: number, bonus: any) => sum + (bonus.points || 0), 0);
          
          bonusGemeindePoints = konfiData.bonusPoints
            .filter((bonus: any) => bonus.type === 'gemeinde')
            .reduce((sum: number, bonus: any) => sum + (bonus.points || 0), 0);
        }
        
        console.log('🔍 Bonus points debug (FIXED):', {
          bonusPointsRaw: konfiData.bonusPoints,
          bonusPointsLength: konfiData.bonusPoints?.length || 0,
          gottesdienst: bonusGottesdienstPoints,
          gemeinde: bonusGemeindePoints,
          total: bonusGottesdienstPoints + bonusGemeindePoints
        });
        
        // Total per category (activities + bonus)
        gottesdienstPoints = baseGottesdienstPoints + bonusGottesdienstPoints;
        gemeindePoints = baseGemeindePoints + bonusGemeindePoints;
        totalPoints = gottesdienstPoints + gemeindePoints;
        
        console.log('📊 Calculated points with bonus by category:', {
          baseGottesdienst: baseGottesdienstPoints,
          baseGemeinde: baseGemeindePoints,
          bonusGottesdienst: bonusGottesdienstPoints,
          bonusGemeinde: bonusGemeindePoints,
          finalGottesdienst: gottesdienstPoints,
          finalGemeinde: gemeindePoints,
          total: totalPoints,
          activities: konfiData.activities?.length || 0,
          bonusEntries: konfiData.bonus_points?.length || 0
        });
      } else {
        // Use API points directly
        totalPoints = totalPoints || (gottesdienstPoints + gemeindePoints);
        console.log('📊 Using API points:', { gottesdienstPoints, gemeindePoints, totalPoints });
      }

      const mockDashboardData: DashboardData = {
        konfi: {
          id: konfiData.id,
          name: konfiData.name,
          jahrgang_name: konfiData.jahrgang_name,
          gottesdienst_points: gottesdienstPoints,
          gemeinde_points: gemeindePoints,
          activities: konfiData.activities,
          bonus_points: konfiData.bonus_points
        },
        total_points: totalPoints,
        recent_badges: badgesData.earned ? badgesData.earned.slice(0, 4) : [],
        next_event: nextEvent ? {
          id: nextEvent.id,
          title: nextEvent.title,
          date: nextEvent.date,
          points: nextEvent.points || 0,
          event_type: nextEvent.event_type
        } : undefined,
        confirmation_event: confirmationData || undefined,
        required_gottesdienst_points: 10, // TODO: Get from admin settings
        required_gemeinde_points: 10, // TODO: Get from admin settings  
        required_total_points: 20 // TODO: Get from admin settings
      };
      
      setDashboardData(mockDashboardData);
    } catch (err) {
      setError('Fehler beim Laden der Dashboard-Daten');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadDashboardData();
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
    return <LoadingSpinner fullScreen message="Dashboard wird geladen..." />;
  }

  if (!dashboardData) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Dashboard</IonTitle>
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Hero Header mit integrierten Progress-Balken */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '40px 20px 32px 20px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative elements */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            fontSize: '1.5rem',
            opacity: 0.3
          }}>⭐</div>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '2rem', 
              fontWeight: '700',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Hey {dashboardData.konfi.name}! 🎉
            </h1>
            <p style={{ 
              opacity: 0.9, 
              fontSize: '1.1rem', 
              margin: '0',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              {dashboardData.konfi.jahrgang_name} • Deine Quest geht weiter!
            </p>
          </div>
          
          {/* Main Points Display mit Progress */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ 
              fontSize: '3.5rem', 
              fontWeight: '800', 
              marginBottom: '8px',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {dashboardData.total_points}
            </div>
            <div style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: '20px' }}>
              🏆 Gesamtpunkte
            </div>
            
            {/* Gesamt Progress */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: '600', fontSize: '1rem' }}>🎯 Quest-Fortschritt</span>
                <span style={{ fontWeight: '700', fontSize: '1rem' }}>
                  {dashboardData.total_points}/{dashboardData.required_total_points}
                </span>
              </div>
              <IonProgressBar 
                value={Math.min(dashboardData.total_points / dashboardData.required_total_points, 1)}
                style={{ 
                  height: '12px',
                  borderRadius: '6px',
                  '--progress-background': 'rgba(255, 255, 255, 0.9)'
                }}
              />
              <div style={{ 
                fontSize: '0.9rem',
                marginTop: '6px',
                opacity: 0.9,
                textAlign: 'center'
              }}>
                {Math.round((dashboardData.total_points / dashboardData.required_total_points) * 100)}% erreicht
              </div>
            </div>
            
            {/* Individual Progress Bars */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: dashboardData.required_gottesdienst_points > 0 && dashboardData.required_gemeinde_points > 0 ? '1fr 1fr' : '1fr',
              gap: '16px'
            }}>
              {dashboardData.required_gottesdienst_points > 0 && (
                <div>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>📖 Gottesdienst</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                      {dashboardData.konfi.gottesdienst_points}/{dashboardData.required_gottesdienst_points}
                    </span>
                  </div>
                  <IonProgressBar 
                    value={Math.min(dashboardData.konfi.gottesdienst_points / dashboardData.required_gottesdienst_points, 1)}
                    style={{ 
                      height: '8px',
                      borderRadius: '4px',
                      '--progress-background': 'rgba(255, 255, 255, 0.8)'
                    }}
                  />
                </div>
              )}
              
              {dashboardData.required_gemeinde_points > 0 && (
                <div>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>🤝 Gemeinde</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                      {dashboardData.konfi.gemeinde_points}/{dashboardData.required_gemeinde_points}
                    </span>
                  </div>
                  <IonProgressBar 
                    value={Math.min(dashboardData.konfi.gemeinde_points / dashboardData.required_gemeinde_points, 1)}
                    style={{ 
                      height: '8px',
                      borderRadius: '4px',
                      '--progress-background': 'rgba(255, 255, 255, 0.8)'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nächstes Event - nur anzeigen wenn Event gebucht */}
        {dashboardData.next_event && (
          <IonCard style={{ 
            margin: '16px', 
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
            color: 'white',
            boxShadow: '0 10px 30px rgba(255, 107, 107, 0.3)'
          }}>
            <IonCardContent style={{ padding: '24px' }}>
              <h3 style={{ 
                margin: '0 0 16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '1.3rem',
                fontWeight: '700'
              }}>
                <IonIcon icon={calendar} style={{ fontSize: '1.4rem' }} />
                Dein nächstes Event
              </h3>
              <div style={{ 
                padding: '20px',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{ 
                  fontWeight: '700', 
                  marginBottom: '8px',
                  fontSize: '1.1rem'
                }}>
                  {dashboardData.next_event.event_type === 'gottesdienst' ? '⛪' : '🎉'} {dashboardData.next_event.title}
                </div>
                <div style={{ 
                  fontSize: '1rem', 
                  marginBottom: '12px',
                  opacity: 0.9
                }}>
                  📅 {new Date(dashboardData.next_event.date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '0.9rem'
                }}>
                  {dashboardData.next_event.points > 0 && (
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontWeight: '600'
                    }}>
                      🎁 +{dashboardData.next_event.points} Punkte
                    </span>
                  )}
                  <span style={{ fontWeight: '600' }}>
                    ⏰ {Math.ceil((new Date(dashboardData.next_event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Tage
                  </span>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}


        {/* Badge-Sammlung - Vereinfacht */}
        <IonCard style={{ 
          margin: '16px', 
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
          color: '#8B4513',
          boxShadow: '0 10px 30px rgba(255, 215, 0, 0.3)'
        }}>
          <IonCardContent style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏆</div>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.4rem', 
              fontWeight: '700'
            }}>
              Badge-Sammlung
            </h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '800', 
                  marginBottom: '4px' 
                }}>
                  {dashboardData.recent_badges?.length || 0}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Badges erhalten
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '800', 
                  marginBottom: '4px' 
                }}>
                  {dashboardData.recent_badges?.filter((badge: any) => badge.is_hidden).length || 0}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Geheime entdeckt
                </div>
              </div>
            </div>
            
            <div 
              style={{ 
                background: 'rgba(139, 69, 19, 0.1)',
                color: '#8B4513',
                padding: '12px 20px',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => window.location.href = '/konfi/badges'}
            >
              🎯 Alle Badges ansehen →
            </div>
          </IonCardContent>
        </IonCard>


        {/* Konfirmations-Status */}
        <IonCard style={{ 
          margin: '16px', 
          borderRadius: '20px',
          background: dashboardData.confirmation_event 
            ? 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)' 
            : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          color: 'white',
          boxShadow: dashboardData.confirmation_event 
            ? '0 10px 30px rgba(168, 85, 247, 0.3)'
            : '0 10px 30px rgba(107, 114, 128, 0.3)'
        }}>
          <IonCardContent style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
              {dashboardData.confirmation_event ? '🎓' : '📅'}
            </div>
            
            {dashboardData.confirmation_event ? (
              <>
                <h2 style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: '700', 
                  margin: '0 0 8px 0',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  ✨ Noch {dashboardData.confirmation_event.days_remaining} Tage
                </h2>
                <p style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '1rem', 
                  opacity: 0.9
                }}>
                  bis zu deiner Konfirmation! 🎉
                </p>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <p style={{ 
                    margin: '0', 
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    📅 {new Date(dashboardData.confirmation_event.date).toLocaleDateString('de-DE', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: '700', 
                  margin: '0 0 8px 0',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  Kein Konfirmationstermin
                </h2>
                <p style={{ 
                  margin: '0', 
                  fontSize: '1rem', 
                  opacity: 0.9
                }}>
                  Du hast noch keinen Termin gebucht. Sprich mit deinem Pastor! 🙏
                </p>
              </>
            )}
          </IonCardContent>
        </IonCard>

        {/* Points Details Anzeige */}
        <IonCard style={{ 
          margin: '16px', 
          borderRadius: '16px',
          background: '#f8f9fa'
        }}>
          <IonCardContent style={{ padding: '20px' }}>
            <h3 style={{ 
              fontSize: '1.1rem', 
              fontWeight: '600', 
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#333'
            }}>
              📊 Deine Punkte im Detail
            </h3>
            
            {/* Punkte-Übersicht */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '8px' 
              }}>
                <span style={{ color: '#666' }}>📖 Gottesdienst-Punkte:</span>
                <strong style={{ color: '#333' }}>{dashboardData.konfi.gottesdienst_points}</strong>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '8px' 
              }}>
                <span style={{ color: '#666' }}>🤝 Gemeinde-Punkte:</span>
                <strong style={{ color: '#333' }}>{dashboardData.konfi.gemeinde_points}</strong>
              </div>
              <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #ddd' }} />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '1.1rem' 
              }}>
                <span style={{ fontWeight: '600', color: '#333' }}>🏆 Gesamt:</span>
                <strong style={{ color: '#3880ff', fontSize: '1.2rem' }}>{dashboardData.total_points}</strong>
              </div>
            </div>

            {/* Aktivitäten Details */}
            {dashboardData.konfi.activities && dashboardData.konfi.activities.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '600', 
                  margin: '0 0 12px 0',
                  color: '#333'
                }}>
                  🎯 Deine Aktivitäten:
                </h4>
                {dashboardData.konfi.activities.map((activity: any, index: number) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    padding: '4px 0'
                  }}>
                    <span style={{ color: '#666' }}>
                      {activity.type === 'gottesdienst' ? '📖' : '🤝'} {activity.name}
                    </span>
                    <span style={{ 
                      fontWeight: '500',
                      color: activity.type === 'gottesdienst' ? '#8b5cf6' : '#10b981'
                    }}>
                      +{activity.points}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Bonus-Punkte Details */}
            {dashboardData.konfi.bonus_points && Array.isArray(dashboardData.konfi.bonus_points) && dashboardData.konfi.bonus_points.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '600', 
                  margin: '0 0 12px 0',
                  color: '#333'
                }}>
                  ⭐ Deine Bonuspunkte:
                </h4>
                {dashboardData.konfi.bonus_points.map((bonus: any, index: number) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    padding: '4px 0'
                  }}>
                    <span style={{ color: '#666' }}>
                      {bonus.type === 'gottesdienst' ? '📖' : '🤝'} {bonus.description}
                    </span>
                    <span style={{ 
                      fontWeight: '500',
                      color: '#ffa500'
                    }}>
                      +{bonus.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ 
              fontSize: '0.8rem', 
              color: '#999', 
              textAlign: 'center',
              fontStyle: 'italic',
              marginTop: '12px'
            }}>
              {dashboardData.konfi.activities?.length || 0} Aktivitäten • 
              {dashboardData.konfi.bonus_points?.length || 0} Bonus-Einträge
            </div>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;