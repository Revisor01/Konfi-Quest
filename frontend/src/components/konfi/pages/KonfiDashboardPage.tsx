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

// CSS Animations for Gaming Elements
const gamingStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.2; }
  }
  
  @keyframes shine {
    0% { left: -100%; }
    100% { left: 100%; }
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  
  @keyframes twinkle {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(255, 193, 7, 0.3); }
    50% { box-shadow: 0 0 30px rgba(255, 193, 7, 0.6); }
  }
`;

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
      {/* Inject Gaming CSS */}
      <style dangerouslySetInnerHTML={{__html: gamingStyles}} />
      
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>🚀 Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ 
        background: 'linear-gradient(180deg, #ff9500 0%, #ff6b35 50%, #f7931e 100%)',
        minHeight: '100vh'
      }}>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'white' }}>
            <IonTitle size="large" style={{ color: 'white', fontWeight: '700' }}>
              🚀 Dashboard  
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Gaming-Style Hero Section */}
        <div style={{ 
          position: 'relative',
          padding: '20px',
          paddingTop: '40px',
          overflow: 'hidden'
        }}>
          {/* Floating Elements */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            fontSize: '2rem',
            opacity: 0.3,
            animation: 'float 3s ease-in-out infinite'
          }}>🎮</div>
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            fontSize: '1.5rem',
            opacity: 0.2,
            animation: 'float 4s ease-in-out infinite reverse'
          }}>⚡</div>

          {/* Level-Up Style Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '8px 16px',
              borderRadius: '20px',
              marginBottom: '12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              <span style={{ 
                color: 'white', 
                fontSize: '0.9rem', 
                fontWeight: '600',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}>
                {dashboardData.konfi.jahrgang_name} • Level {Math.floor(dashboardData.total_points / 5) + 1}
              </span>
            </div>
            
            <h1 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '2.2rem', 
              fontWeight: '800',
              color: 'white',
              textShadow: '0 3px 6px rgba(0,0,0,0.4)',
              background: 'linear-gradient(45deg, #fff, #ffeb3b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Hey {dashboardData.konfi.name}! 🔥
            </h1>
            <p style={{ 
              opacity: 0.9, 
              fontSize: '1.1rem', 
              margin: '0',
              color: 'white',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              fontWeight: '500'
            }}>
              Deine Quest läuft auf Hochtouren! 🚀
            </p>
          </div>

          {/* XP/Points Gaming Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            padding: '28px',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Gaming Glow Effect */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, rgba(255,235,59,0.1) 0%, transparent 70%)',
              animation: 'pulse 4s ease-in-out infinite'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 2 }}>
              {/* XP Points Display */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  fontSize: '4rem', 
                  fontWeight: '900', 
                  color: '#fff',
                  textShadow: '0 4px 8px rgba(0,0,0,0.3)',
                  marginBottom: '8px',
                  position: 'relative'
                }}>
                  {dashboardData.total_points}
                  <span style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-20px',
                    fontSize: '1.5rem',
                    opacity: 0.8
                  }}>XP</span>
                </div>
                <div style={{ 
                  fontSize: '1.3rem', 
                  color: 'rgba(255,255,255,0.9)', 
                  fontWeight: '600',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  🎯 Quest Progress
                </div>
              </div>

              {/* Progress Bar - Gaming Style */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ 
                    fontWeight: '700', 
                    fontSize: '1.1rem', 
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }}>
                    🏆 Gesamtfortschritt
                  </span>
                  <span style={{ 
                    fontWeight: '700', 
                    fontSize: '1.1rem',
                    color: '#ffeb3b',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }}>
                    {dashboardData.total_points}/{dashboardData.required_total_points}
                  </span>
                </div>
                
                {/* Custom Progress Bar */}
                <div style={{
                  background: 'rgba(255,255,255,0.2)',
                  height: '16px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.3)',
                  position: 'relative'
                }}>
                  <div style={{
                    background: 'linear-gradient(90deg, #4caf50, #8bc34a, #cddc39)',
                    height: '100%',
                    width: `${Math.min((dashboardData.total_points / dashboardData.required_total_points) * 100, 100)}%`,
                    borderRadius: '10px',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)',
                    transition: 'width 1s ease-out',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Shine Effect */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      animation: 'shine 2s ease-in-out infinite'
                    }}></div>
                  </div>
                </div>
                
                <div style={{ 
                  fontSize: '1rem',
                  marginTop: '8px',
                  color: 'rgba(255,255,255,0.9)',
                  textAlign: 'center',
                  fontWeight: '600',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}>
                  🎮 {Math.round((dashboardData.total_points / dashboardData.required_total_points) * 100)}% Complete!
                </div>
              </div>

              {/* Category Progress - Gaming Stats */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: dashboardData.required_gottesdienst_points > 0 && dashboardData.required_gemeinde_points > 0 ? '1fr 1fr' : '1fr',
                gap: '16px'
              }}>
                {dashboardData.required_gottesdienst_points > 0 && (
                  <div style={{
                    background: 'rgba(63,81,181,0.3)',
                    borderRadius: '16px',
                    padding: '16px',
                    border: '1px solid rgba(63,81,181,0.5)'
                  }}>
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>⛪ Gottesdienst</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffeb3b' }}>
                        {dashboardData.konfi.gottesdienst_points}/{dashboardData.required_gottesdienst_points}
                      </span>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      height: '8px',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: 'linear-gradient(90deg, #3f51b5, #5c6bc0)',
                        height: '100%',
                        width: `${Math.min((dashboardData.konfi.gottesdienst_points / dashboardData.required_gottesdienst_points) * 100, 100)}%`,
                        borderRadius: '6px',
                        transition: 'width 0.8s ease-out'
                      }}></div>
                    </div>
                  </div>
                )}
                
                {dashboardData.required_gemeinde_points > 0 && (
                  <div style={{
                    background: 'rgba(76,175,80,0.3)',
                    borderRadius: '16px',
                    padding: '16px',
                    border: '1px solid rgba(76,175,80,0.5)'
                  }}>
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>🤝 Gemeinde</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffeb3b' }}>
                        {dashboardData.konfi.gemeinde_points}/{dashboardData.required_gemeinde_points}
                      </span>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      height: '8px',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: 'linear-gradient(90deg, #4caf50, #66bb6a)',
                        height: '100%',
                        width: `${Math.min((dashboardData.konfi.gemeinde_points / dashboardData.required_gemeinde_points) * 100, 100)}%`,
                        borderRadius: '6px',
                        transition: 'width 0.8s ease-out'
                      }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Gaming Events Section */}
        {dashboardData.next_event && (
          <div style={{ 
            margin: '20px', 
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Gaming Header */}
            <div style={{
              background: 'linear-gradient(90deg, rgba(33,150,243,0.8), rgba(33,150,243,0.6))',
              padding: '16px 24px',
              borderBottom: '2px solid rgba(255,255,255,0.2)'
            }}>
              <h3 style={{ 
                margin: '0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '1.4rem',
                fontWeight: '800',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🎯 Nächste Mission
              </h3>
            </div>
            
            <div style={{ padding: '24px' }}>
              {/* Event Display - Gaming Style */}
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                marginBottom: '20px',
                position: 'relative'
              }}>
                {/* Achievement Badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
                  borderRadius: '12px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  boxShadow: '0 4px 8px rgba(255,107,53,0.3)'
                }}>
                  {dashboardData.next_event.points > 0 ? `+${dashboardData.next_event.points} XP` : 'EVENT'}
                </div>
                
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                  }}>
                    {dashboardData.next_event.event_type === 'gottesdienst' ? '⛪' : '🎉'}
                  </div>
                  <div style={{ flex: 1, paddingRight: '80px' }}>
                    <div style={{ 
                      fontWeight: '800', 
                      fontSize: '1.3rem',
                      marginBottom: '6px',
                      color: 'white',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      {dashboardData.next_event.title}
                    </div>
                    <div style={{ 
                      fontSize: '1rem', 
                      color: 'rgba(255,255,255,0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: '600'
                    }}>
                      🕒 {new Date(dashboardData.next_event.date).toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Gaming-Style Countdown */}
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <span style={{ 
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    ⏳ Countdown: {Math.ceil((new Date(dashboardData.next_event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Tage
                  </span>
                  <span style={{ 
                    fontWeight: '700',
                    color: '#4caf50',
                    fontSize: '0.9rem',
                    background: 'rgba(76,175,80,0.2)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(76,175,80,0.3)'
                  }}>
                    ✅ READY
                  </span>
                </div>
              </div>
              
              {/* Action Button - Gaming Style */}
              <div 
                style={{ 
                  background: 'linear-gradient(90deg, rgba(33,150,243,0.8), rgba(33,150,243,0.6))',
                  color: 'white',
                  padding: '16px 24px',
                  borderRadius: '16px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'center',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  boxShadow: '0 8px 16px rgba(33,150,243,0.3)'
                }}
                onClick={() => window.location.href = '/konfi/events'}
              >
                🎮 Alle Missionen anzeigen →
              </div>
            </div>
          </div>
        )}

        {/* Achievements Section - Gaming Style */}
        <div style={{ 
          margin: '20px', 
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* Gaming Header */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(255,193,7,0.9), rgba(255,152,0,0.8))',
            padding: '16px 24px',
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            position: 'relative'
          }}>
            {/* Trophy Animation Background */}
            <div style={{
              position: 'absolute',
              top: '50%',
              right: '20px',
              transform: 'translateY(-50%)',
              fontSize: '2rem',
              opacity: 0.3,
              animation: 'bounce 2s ease-in-out infinite'
            }}>🏆</div>
            
            <h3 style={{ 
              margin: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '1.4rem',
              fontWeight: '800',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              🎖️ Achievement Center
            </h3>
          </div>
          
          <div style={{ padding: '24px' }}>
            {/* Achievement Stats */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                background: 'rgba(255,193,7,0.2)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                border: '2px solid rgba(255,193,7,0.3)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontSize: '1.2rem',
                  opacity: 0.4
                }}>⭐</div>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '900', 
                  marginBottom: '8px',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  {dashboardData.recent_badges?.length || 0}
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  Achievements
                </div>
              </div>
              
              <div style={{
                background: 'rgba(156,39,176,0.2)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                border: '2px solid rgba(156,39,176,0.3)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontSize: '1.2rem',
                  opacity: 0.4
                }}>🔮</div>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '900', 
                  marginBottom: '8px',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  {dashboardData.recent_badges?.filter((badge: any) => badge.is_hidden).length || 0}
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  Secret Found
                </div>
              </div>
            </div>

            {/* Recent Achievements Display */}
            {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 ? (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: '700', 
                  margin: '0 0 20px 0',
                  textAlign: 'center',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  🌟 Latest Unlocked
                </h4>
                
                <div style={{ 
                  display: 'flex',
                  gap: '16px',
                  overflowX: 'auto',
                  paddingBottom: '12px',
                  justifyContent: dashboardData.recent_badges.slice(0, 3).length < 3 ? 'center' : 'flex-start'
                }}>
                  {dashboardData.recent_badges.slice(0, 3).map((badge: any, index: number) => (
                    <div
                      key={badge.id || index}
                      style={{
                        minWidth: '140px',
                        background: index === 0 
                          ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 152, 0, 0.3))'
                          : 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '20px',
                        padding: '20px 16px',
                        textAlign: 'center',
                        position: 'relative',
                        border: index === 0 
                          ? '3px solid rgba(255, 193, 7, 0.6)'
                          : '2px solid rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(15px)',
                        boxShadow: index === 0 
                          ? '0 12px 30px rgba(255, 193, 7, 0.4)'
                          : '0 8px 20px rgba(0,0,0,0.1)',
                        transform: index === 0 ? 'scale(1.08)' : 'scale(1)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {/* Badge Icon with Glow */}
                      <div style={{ 
                        fontSize: '3rem', 
                        marginBottom: '12px',
                        filter: index === 0 
                          ? 'drop-shadow(0 0 20px rgba(255, 193, 7, 0.8))' 
                          : 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
                        position: 'relative'
                      }}>
                        {badge.icon || '🏆'}
                        {/* Sparkle Effect for Latest Badge */}
                        {index === 0 && (
                          <>
                            <div style={{
                              position: 'absolute',
                              top: '-5px',
                              right: '-5px',
                              fontSize: '0.8rem',
                              opacity: 0.8,
                              animation: 'twinkle 1.5s ease-in-out infinite'
                            }}>✨</div>
                            <div style={{
                              position: 'absolute',
                              bottom: '-5px',
                              left: '-5px',
                              fontSize: '0.6rem',
                              opacity: 0.6,
                              animation: 'twinkle 2s ease-in-out infinite reverse'
                            }}>⭐</div>
                          </>
                        )}
                      </div>
                      
                      {/* Badge Name */}
                      <div style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: '800',
                        marginBottom: '6px',
                        lineHeight: '1.2',
                        maxHeight: '2.4em',
                        overflow: 'hidden',
                        color: 'white',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {badge.name}
                      </div>
                      
                      {/* Badge Description - nur für neuestes Badge */}
                      {index === 0 && badge.description && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: 'rgba(255,255,255,0.8)',
                          lineHeight: '1.2',
                          maxHeight: '2.4em',
                          overflow: 'hidden',
                          marginBottom: '8px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {badge.description}
                        </div>
                      )}
                      
                      {/* "NEW" Badge für das erste Badge */}
                      {index === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          boxShadow: '0 4px 12px rgba(255, 107, 53, 0.5)',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}>
                          NEW!
                        </div>
                      )}
                      
                      {/* Earned Date */}
                      {badge.awarded_date && (
                        <div style={{ 
                          fontSize: '0.7rem', 
                          color: 'rgba(255,255,255,0.7)',
                          marginTop: '8px',
                          fontWeight: '500'
                        }}>
                          🗓️ {new Date(badge.awarded_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* More Badges Hint */}
                {dashboardData.recent_badges.length > 3 && (
                  <div style={{
                    textAlign: 'center',
                    marginTop: '16px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.8)'
                  }}>
                    🎯 +{dashboardData.recent_badges.length - 3} more achievement{dashboardData.recent_badges.length - 3 !== 1 ? 's' : ''} unlocked!
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '24px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                marginBottom: '20px',
                border: '2px dashed rgba(255,255,255,0.3)'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.6 }}>🎯</div>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: '700', 
                  color: 'white',
                  marginBottom: '6px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  First Achievement Awaits!
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: '500'
                }}>
                  Complete activities and missions to unlock badges 🏆
                </div>
              </div>
            )}
            
            {/* Action Button - Gaming Style */}
            <div 
              style={{ 
                background: 'linear-gradient(90deg, rgba(255,193,7,0.8), rgba(255,152,0,0.6))',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '16px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textAlign: 'center',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                boxShadow: '0 8px 16px rgba(255,193,7,0.3)'
              }}
              onClick={() => window.location.href = '/konfi/badges'}
            >
              🎖️ Achievement Gallery →
            </div>
          </div>
        </div>


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