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
  IonProgressBar
} from '@ionic/react';
import {
  home,
  people
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
}

interface Settings {
  target_gottesdienst?: number;
  target_gemeinde?: number;
}

const KonfiDashboardPage: React.FC = () => {
  const { user, setError } = useApp();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load dashboard data and settings
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

  const handleRefresh = async (event: CustomEvent) => {
    await loadDashboardData();
    event.detail.complete();
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

  const gottesdienstPoints = dashboardData.konfi.gottesdienst_points || 0;
  const gemeindePoints = dashboardData.konfi.gemeinde_points || 0;
  const targetGottesdienst = settings.target_gottesdienst || 12;
  const targetGemeinde = settings.target_gemeinde || 8;

  const gottesdienstProgress = Math.min((gottesdienstPoints / targetGottesdienst) * 100, 100);
  const gemeindeProgress = Math.min((gemeindePoints / targetGemeinde) * 100, 100);

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>
              Dashboard
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Welcome Header */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}>
          <IonCardContent style={{ padding: '24px', textAlign: 'center' }}>
            <h1 style={{
              color: 'white',
              fontSize: '1.6rem',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }}>
              Willkommen, {dashboardData.konfi.display_name}!
            </h1>
            
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.1rem',
              margin: '0 0 16px 0',
              fontWeight: '500'
            }}>
              Achievement Center
            </p>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontWeight: '600',
              fontSize: '0.9rem',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              display: 'inline-block'
            }}>
              {dashboardData.total_points} Punkte
            </div>
          </IonCardContent>
        </IonCard>

        {/* Points Overview */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px'
        }}>
          <IonCardContent style={{ padding: '20px' }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '1.2rem',
              fontWeight: '600',
              textAlign: 'center'
            }}>
              Fortschritt
            </h3>

            <div style={{ marginBottom: '24px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '16px',
                color: 'white',
                marginBottom: '16px'
              }}>
                <h4 style={{
                  margin: '0 0 12px 0',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <IonIcon icon={home} style={{ fontSize: '1.2rem' }} />
                  Gottesdienst
                </h4>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}>
                    {gottesdienstPoints} / {targetGottesdienst}
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    opacity: 0.9
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

              <div style={{
                background: 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)',
                borderRadius: '12px',
                padding: '16px',
                color: 'white'
              }}>
                <h4 style={{
                  margin: '0 0 12px 0',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <IonIcon icon={people} style={{ fontSize: '1.2rem' }} />
                  Gemeinde
                </h4>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}>
                    {gemeindePoints} / {targetGemeinde}
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    opacity: 0.9
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
                    '--background': 'rgba(255, 255, 255, 0.3)',
                    maxWidth: '100%'
                  }}
                />
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Recent Achievements */}
        {dashboardData.recent_badges && dashboardData.recent_badges.length > 0 && (
          <IonCard style={{
            margin: '16px',
            borderRadius: '16px'
          }}>
            <IonCardContent style={{ padding: '20px' }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '1.2rem',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                Neueste Badges
              </h3>
              
              {dashboardData.recent_badges.slice(0, 3).map((badge: any, index: number) => (
                <div
                  key={badge.id || index}
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#8B4513',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      fontSize: '1.2rem'
                    }}>
                      {badge.icon || '🏆'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{
                        margin: '0',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}>
                        {badge.name}
                      </h4>
                    </div>
                  </div>
                </div>
              ))}
            </IonCardContent>
          </IonCard>
        )}

        {(!dashboardData.recent_badges || dashboardData.recent_badges.length === 0) && (
          <IonCard style={{
            margin: '16px',
            borderRadius: '16px'
          }}>
            <IonCardContent style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{
                margin: '0',
                fontSize: '0.9rem',
                color: '#666'
              }}>
                Noch keine Badges erhalten
              </p>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;