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
  };
  total_points: number;
  recent_badges: any[];
  ranking?: Array<{
    name: string;
    points: number;
    initials: string;
  }>;
  days_to_confirmation?: number;
  confirmation_date?: string;
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
      const response = await api.get('/konfi/dashboard');
      setDashboardData(response.data);
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

        {/* Welcome Header */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
            <h1 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '1.5rem', 
              fontWeight: '600',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Hallo {dashboardData.konfi.name}! 👋
            </h1>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: '0' }}>
              Jahrgang {dashboardData.konfi.jahrgang_name}
            </p>
          </IonCardContent>
        </IonCard>

        {/* Points Overview with Progress Bars */}
        <IonGrid style={{ padding: '0 16px' }}>
          <IonRow>
            <IonCol size="12" sizeMd="6">
              <IonCard style={{ borderRadius: '16px', height: '100%' }}>
                <IonCardContent style={{ padding: '20px' }}>
                  <h3 style={{ 
                    fontWeight: '600', 
                    margin: '0 0 12px 0',
                    color: '#3498db',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <IonIcon icon={sparkles} style={{ fontSize: '1.2rem' }} />
                    Gottesdienst
                  </h3>
                  <div style={{ 
                    fontSize: '2rem', 
                    fontWeight: '700',
                    color: '#3498db',
                    marginBottom: '8px'
                  }}>
                    {dashboardData.konfi.gottesdienst_points}/10
                  </div>
                  <IonProgressBar 
                    value={Math.min(dashboardData.konfi.gottesdienst_points / 10, 1)}
                    style={{ 
                      height: '8px', 
                      borderRadius: '4px',
                      '--progress-background': dashboardData.konfi.gottesdienst_points >= 10 ? '#2dd36f' : 
                                             dashboardData.konfi.gottesdienst_points >= 7.5 ? '#ffc409' : '#3498db'
                    }}
                  />
                  {dashboardData.konfi.gottesdienst_points >= 10 && (
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: '#2dd36f', 
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <IonIcon icon={star} style={{ fontSize: '0.8rem' }} />
                      Ziel erreicht!
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonCol>
            
            <IonCol size="12" sizeMd="6">
              <IonCard style={{ borderRadius: '16px', height: '100%' }}>
                <IonCardContent style={{ padding: '20px' }}>
                  <h3 style={{ 
                    fontWeight: '600', 
                    margin: '0 0 12px 0',
                    color: '#e74c3c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <IonIcon icon={heart} style={{ fontSize: '1.2rem' }} />
                    Gemeinde
                  </h3>
                  <div style={{ 
                    fontSize: '2rem', 
                    fontWeight: '700',
                    color: '#e74c3c',
                    marginBottom: '8px'
                  }}>
                    {dashboardData.konfi.gemeinde_points}/10
                  </div>
                  <IonProgressBar 
                    value={Math.min(dashboardData.konfi.gemeinde_points / 10, 1)}
                    style={{ 
                      height: '8px', 
                      borderRadius: '4px',
                      '--progress-background': dashboardData.konfi.gemeinde_points >= 10 ? '#2dd36f' : 
                                             dashboardData.konfi.gemeinde_points >= 7.5 ? '#ffc409' : '#e74c3c'
                    }}
                  />
                  {dashboardData.konfi.gemeinde_points >= 10 && (
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: '#2dd36f', 
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <IonIcon icon={star} style={{ fontSize: '0.8rem' }} />
                      Ziel erreicht!
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* Total Points Card */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
          color: 'white',
          boxShadow: '0 10px 30px rgba(255, 107, 53, 0.3)'
        }}>
          <IonCardContent style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '8px' }}>
              {dashboardData.total_points}
            </div>
            <div style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
              Gesamtpunkte
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '24px',
              fontSize: '0.9rem',
              opacity: 0.9
            }}>
              <span>📖 {dashboardData.konfi.gottesdienst_points}</span>
              <span>🤝 {dashboardData.konfi.gemeinde_points}</span>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Quick Actions */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent style={{ padding: '20px' }}>
            <h3 style={{ 
              fontSize: '1.1rem', 
              fontWeight: '600', 
              margin: '0 0 16px 0'
            }}>
              Schnell-Aktionen
            </h3>
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <div 
                    style={{
                      background: 'linear-gradient(135deg, #3880ff 0%, #3171e0 100%)',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(56, 128, 255, 0.3)'
                    }}
                    onClick={() => {
                      // TODO: Navigation zu Anträge
                      window.location.href = '/konfi/requests';
                    }}
                  >
                    <IonIcon icon={calendar} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                      Aktivität beantragen
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                      Neue Punkte beantragen
                    </div>
                  </div>
                </IonCol>
                <IonCol size="6">
                  <div 
                    style={{
                      background: 'linear-gradient(135deg, #ffc409 0%, #ffb300 100%)',
                      color: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(255, 196, 9, 0.3)'
                    }}
                    onClick={() => {
                      // TODO: Navigation zu Badges
                      window.location.href = '/konfi/badges';
                    }}
                  >
                    <IonIcon icon={trophy} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                      Meine Badges
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                      Erreichte Auszeichnungen
                    </div>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Badges Section */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent style={{ padding: '20px' }}>
            <h2 style={{ 
              fontSize: '1.2rem', 
              fontWeight: '600', 
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <IonIcon icon={trophy} style={{ color: '#FFD700' }} />
              Meine Badges
            </h2>
            
            {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {dashboardData.recent_badges.slice(0, 6).map((badge, index) => (
                    <div 
                      key={badge.id || index}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                        color: 'white',
                        minWidth: '70px',
                        boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                        {badge.icon_name || '🏆'}
                      </div>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: '600',
                        textAlign: 'center',
                        lineHeight: '1.2'
                      }}>
                        {badge.name}
                      </span>
                    </div>
                  ))}
                </div>
                {dashboardData.recent_badges.length > 6 && (
                  <p style={{ 
                    textAlign: 'center', 
                    fontSize: '0.9rem', 
                    color: '#3880ff',
                    margin: '0',
                    cursor: 'pointer'
                  }}
                  onClick={() => window.location.href = '/konfi/badges'}
                  >
                    Alle Badges im Badge-Bereich ansehen →
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '3rem', 
                  marginBottom: '12px', 
                  opacity: 0.3 
                }}>
                  🏆
                </div>
                <p style={{ 
                  color: '#666', 
                  fontSize: '0.9rem',
                  margin: '0 0 8px 0'
                }}>
                  Noch keine Badges erreicht
                </p>
                <p style={{ 
                  color: '#999', 
                  fontSize: '0.8rem',
                  margin: '0'
                }}>
                  Sammle Punkte um dein erstes Badge zu bekommen! 🎯
                </p>
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* Top 3 Ranking */}
        {dashboardData.ranking && dashboardData.ranking.length > 0 && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent style={{ padding: '20px' }}>
              <h2 style={{ 
                fontSize: '1.2rem', 
                fontWeight: '600', 
                margin: '0 0 16px 0',
                textAlign: 'center'
              }}>
                🏆 Top 3 Ranking
              </h2>
              
              <IonGrid>
                <IonRow>
                  {dashboardData.ranking.slice(0, 3).map((konfi, index) => (
                    <IonCol key={index} size="4">
                      <div style={{ textAlign: 'center' }}>
                        <IonAvatar style={{ 
                          margin: '0 auto 8px auto',
                          width: '50px',
                          height: '50px'
                        }}>
                          <div style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}>
                            {konfi.initials}
                          </div>
                        </IonAvatar>
                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.8rem', 
                          fontWeight: '600' 
                        }}>
                          {konfi.points} Punkte
                        </p>
                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.7rem', 
                          color: '#666' 
                        }}>
                          #{index + 1}
                        </p>
                      </div>
                    </IonCol>
                  ))}
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>
        )}

        {/* Confirmation Countdown */}
        {dashboardData.days_to_confirmation && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent style={{ padding: '20px', textAlign: 'center' }}>
              <IonIcon icon={calendar} style={{ 
                fontSize: '2rem', 
                color: '#9b59b6', 
                marginBottom: '12px' 
              }} />
              <h2 style={{ 
                fontSize: '1.2rem', 
                fontWeight: '600', 
                margin: '0 0 8px 0' 
              }}>
                Noch {dashboardData.days_to_confirmation} Tage
              </h2>
              <p style={{ 
                margin: '0', 
                fontSize: '0.9rem', 
                color: '#666' 
              }}>
                bis zu deiner Konfirmation
              </p>
              {dashboardData.confirmation_date && (
                <p style={{ 
                  margin: '8px 0 0 0', 
                  fontSize: '0.8rem', 
                  color: '#9b59b6',
                  fontWeight: '500'
                }}>
                  am {new Date(dashboardData.confirmation_date).toLocaleDateString('de-DE')}
                </p>
              )}
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;