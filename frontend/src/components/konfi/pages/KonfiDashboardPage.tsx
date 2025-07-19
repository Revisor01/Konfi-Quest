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
  IonButton,
  IonItem,
  IonLabel,
  IonChip,
  IonList,
  IonBadge,
  IonProgressBar,
  IonAvatar
} from '@ionic/react';
import {
  star,
  calendar,
  trophy,
  flash,
  statsChart,
  checkmark,
  time,
  ribbon,
  gift,
  flame,
  heart,
  sparkles,
  rocket,
  medal
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface DashboardStats {
  total_points: number;
  badge_count: number;
  activity_count: number;
  event_count: number;
  pending_requests: number;
  recent_badges: Badge[];
  upcoming_events: Event[];
  progress_to_next_badge?: {
    badge_name: string;
    current_points: number;
    required_points: number;
    progress_percentage: number;
  };
}

interface Badge {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  points_required: number;
  earned_at?: string;
}

interface Event {
  id: number;
  title: string;
  date: string;
  location?: string;
  points: number;
  is_registered: boolean;
  registration_deadline?: string;
}

const KonfiDashboardPage: React.FC = () => {
  const { user, setError } = useApp();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/dashboard');
      setStats(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Dashboard-Daten');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Hallo';
    return 'Guten Abend';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBadgeIcon = (badge: Badge) => {
    switch (badge.icon) {
      case 'star': return star;
      case 'trophy': return trophy;
      case 'medal': return medal;
      case 'ribbon': return ribbon;
      case 'flame': return flame;
      case 'heart': return heart;
      case 'sparkles': return sparkles;
      case 'rocket': return rocket;
      default: return gift;
    }
  };

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'gold': return '#ffd700';
      case 'silver': return '#c0c0c0';
      case 'bronze': return '#cd7f32';
      case 'blue': return '#3880ff';
      case 'green': return '#2dd36f';
      case 'purple': return '#8b5cf6';
      case 'orange': return '#ff6b35';
      case 'red': return '#f53d3d';
      default: return '#667eea';
    }
  };

  if (loading) {
    return <LoadingSpinner message="Dashboard wird geladen..." />;
  }

  if (!stats) {
    return (
      <IonPage>
        <IonContent>
          <p style={{ textAlign: 'center', marginTop: '50px' }}>
            Fehler beim Laden der Dashboard-Daten
          </p>
        </IonContent>
      </IonPage>
    );
  }

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
            <IonTitle size="large" style={{ color: 'black' }}>Dashboard</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadDashboardData();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Begrüßung */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
        }}>
          <IonCardContent style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <IonIcon icon={sparkles} style={{ fontSize: '2rem', marginBottom: '12px' }} />
              <h1 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: '600' }}>
                {getGreeting()}, {user?.display_name?.split(' ')[0] || 'Konfi'}! 
              </h1>
              <p style={{ margin: '0', fontSize: '1rem', opacity: 0.9 }}>
                Du hast bereits <strong>{stats.total_points} Punkte</strong> gesammelt! 🎉
              </p>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Hauptstatistiken */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      <IonIcon icon={star} style={{ fontSize: '1.8rem', color: 'white' }} />
                    </div>
                    <h2 style={{ margin: '0', fontSize: '1.8rem', color: '#ff6b35' }}>
                      {stats.total_points}
                    </h2>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                      Punkte
                    </p>
                  </div>
                </IonCol>
                <IonCol size="6">
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      <IonIcon icon={trophy} style={{ fontSize: '1.8rem', color: '#b8860b' }} />
                    </div>
                    <h2 style={{ margin: '0', fontSize: '1.8rem', color: '#b8860b' }}>
                      {stats.badge_count}
                    </h2>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                      Badges
                    </p>
                  </div>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="4">
                  <div style={{ textAlign: 'center', padding: '8px' }}>
                    <IonIcon icon={flash} style={{ fontSize: '1.5rem', color: '#2dd36f', marginBottom: '4px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.2rem', color: '#2dd36f' }}>
                      {stats.activity_count}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                      Aktivitäten
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center', padding: '8px' }}>
                    <IonIcon icon={calendar} style={{ fontSize: '1.5rem', color: '#3880ff', marginBottom: '4px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.2rem', color: '#3880ff' }}>
                      {stats.event_count}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                      Events
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center', padding: '8px' }}>
                    <IonIcon icon={time} style={{ fontSize: '1.5rem', color: '#ffcc00', marginBottom: '4px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.2rem', color: '#ffcc00' }}>
                      {stats.pending_requests}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                      Anträge
                    </p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Fortschritt zum nächsten Badge */}
        {stats.progress_to_next_badge && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <IonIcon icon={rocket} style={{ fontSize: '1.2rem', color: '#8b5cf6', marginRight: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Nächstes Badge
                </h3>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '500' }}>
                {stats.progress_to_next_badge.badge_name}
              </p>
              <IonProgressBar 
                value={stats.progress_to_next_badge.progress_percentage / 100}
                style={{ 
                  height: '8px', 
                  borderRadius: '4px',
                  '--progress-background': 'linear-gradient(90deg, #8b5cf6, #a855f7)'
                }}
              />
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                {stats.progress_to_next_badge.current_points} / {stats.progress_to_next_badge.required_points} Punkte
                ({Math.round(stats.progress_to_next_badge.progress_percentage)}%)
              </p>
            </IonCardContent>
          </IonCard>
        )}

        {/* Neueste Badges */}
        {stats.recent_badges && stats.recent_badges.length > 0 && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <IonIcon icon={sparkles} style={{ fontSize: '1.2rem', color: '#ffd700', marginRight: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Neueste Badges
                </h3>
                <IonButton 
                  fill="clear" 
                  size="small" 
                  routerLink="/konfi/badges"
                  style={{ marginLeft: 'auto' }}
                >
                  Alle anzeigen
                </IonButton>
              </div>
              <IonList style={{ margin: '0' }}>
                {stats.recent_badges.slice(0, 3).map((badge) => (
                  <IonItem 
                    key={badge.id} 
                    lines="none"
                    style={{ '--padding-start': '0', '--inner-padding-end': '0' }}
                  >
                    <IonAvatar slot="start">
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${getBadgeColor(badge.color)}, ${getBadgeColor(badge.color)}aa)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IonIcon 
                          icon={getBadgeIcon(badge)} 
                          style={{ fontSize: '1.5rem', color: 'white' }} 
                        />
                      </div>
                    </IonAvatar>
                    <IonLabel>
                      <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                        {badge.name}
                      </h3>
                      {badge.description && (
                        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 4px 0' }}>
                          {badge.description}
                        </p>
                      )}
                      {badge.earned_at && (
                        <IonChip color="success" style={{ fontSize: '0.7rem', height: '20px' }}>
                          <IonIcon icon={checkmark} style={{ fontSize: '0.8rem', marginRight: '2px' }} />
                          Erhalten am {formatDate(badge.earned_at)}
                        </IonChip>
                      )}
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {/* Anstehende Events */}
        {stats.upcoming_events && stats.upcoming_events.length > 0 && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <IonIcon icon={calendar} style={{ fontSize: '1.2rem', color: '#3880ff', marginRight: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Anstehende Events
                </h3>
                <IonButton 
                  fill="clear" 
                  size="small" 
                  routerLink="/konfi/events"
                  style={{ marginLeft: 'auto' }}
                >
                  Alle anzeigen
                </IonButton>
              </div>
              <IonList style={{ margin: '0' }}>
                {stats.upcoming_events.slice(0, 3).map((event) => (
                  <IonItem 
                    key={event.id} 
                    button
                    lines="none"
                    style={{ '--padding-start': '0', '--inner-padding-end': '0' }}
                  >
                    <div slot="start" style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '12px',
                      background: event.is_registered 
                        ? 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)'
                        : 'linear-gradient(135deg, #3880ff 0%, #3171e0 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      <IonIcon 
                        icon={event.is_registered ? checkmark : calendar} 
                        style={{ fontSize: '1.3rem', color: 'white' }} 
                      />
                    </div>
                    <IonLabel>
                      <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                        {event.title}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 4px 0' }}>
                        {formatDate(event.date)} um {formatTime(event.date)}
                        {event.location && ` • ${event.location}`}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <IonChip 
                          color={event.is_registered ? 'success' : 'primary'}
                          style={{ fontSize: '0.7rem', height: '20px' }}
                        >
                          {event.is_registered ? 'Angemeldet' : 'Verfügbar'}
                        </IonChip>
                        <IonChip color="warning" style={{ fontSize: '0.7rem', height: '20px' }}>
                          {event.points} {event.points === 1 ? 'Punkt' : 'Punkte'}
                        </IonChip>
                      </div>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {/* Schnellzugriffe */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Schnellzugriffe
            </h3>
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <IonButton 
                    expand="block" 
                    fill="outline"
                    routerLink="/konfi/events"
                    style={{ 
                      height: '60px',
                      '--border-radius': '12px',
                      '--border-color': '#3880ff',
                      '--color': '#3880ff'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <IonIcon icon={calendar} style={{ fontSize: '1.5rem', marginBottom: '4px' }} />
                      <div style={{ fontSize: '0.85rem' }}>Events buchen</div>
                    </div>
                  </IonButton>
                </IonCol>
                <IonCol size="6">
                  <IonButton 
                    expand="block" 
                    fill="outline"
                    routerLink="/konfi/requests"
                    style={{ 
                      height: '60px',
                      '--border-radius': '12px',
                      '--border-color': '#2dd36f',
                      '--color': '#2dd36f'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <IonIcon icon={flash} style={{ fontSize: '1.5rem', marginBottom: '4px' }} />
                      <div style={{ fontSize: '0.85rem' }}>Antrag stellen</div>
                    </div>
                  </IonButton>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="6">
                  <IonButton 
                    expand="block" 
                    fill="outline"
                    routerLink="/konfi/badges"
                    style={{ 
                      height: '60px',
                      '--border-radius': '12px',
                      '--border-color': '#ffd700',
                      '--color': '#b8860b'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <IonIcon icon={trophy} style={{ fontSize: '1.5rem', marginBottom: '4px' }} />
                      <div style={{ fontSize: '0.85rem' }}>Meine Badges</div>
                    </div>
                  </IonButton>
                </IonCol>
                <IonCol size="6">
                  <IonButton 
                    expand="block" 
                    fill="outline"
                    routerLink="/konfi/profile"
                    style={{ 
                      height: '60px',
                      '--border-radius': '12px',
                      '--border-color': '#8b5cf6',
                      '--color': '#8b5cf6'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <IonIcon icon={statsChart} style={{ fontSize: '1.5rem', marginBottom: '4px' }} />
                      <div style={{ fontSize: '0.85rem' }}>Mein Profil</div>
                    </div>
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Motivational Quote */}
        <IonCard style={{
          margin: '16px 16px 32px 16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
          color: 'white'
        }}>
          <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
            <IonIcon icon={heart} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
            <p style={{ margin: '0', fontSize: '0.95rem', fontStyle: 'italic' }}>
              "Der Glaube ist wie ein Muskel – je mehr du ihn übst, desto stärker wird er!" 💪
            </p>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;