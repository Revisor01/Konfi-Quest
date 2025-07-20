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
  IonInput,
  IonModal,
  IonButtons,
  IonTextarea,
  IonAvatar,
  IonProgressBar,
  IonAlert,
  useIonAlert
} from '@ionic/react';
import {
  person,
  school,
  calendar,
  star,
  trophy,
  flash,
  statsChart,
  logOut,
  create,
  save,
  close,
  checkmark,
  time,
  heart,
  sparkles,
  ribbon,
  gift,
  flame,
  rocket,
  eye,
  eyeOff,
  key
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface KonfiProfile {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  jahrgang_name: string;
  jahrgang_year: number;
  created_at: string;
  last_login_at?: string;
  // Statistics
  total_points: number;
  badge_count: number;
  activity_count: number;
  event_count: number;
  pending_requests: number;
  rank_in_jahrgang?: number;
  total_in_jahrgang?: number;
  recent_activities: RecentActivity[];
  progress_overview: ProgressOverview;
}

interface RecentActivity {
  id: number;
  title: string;
  type: 'activity' | 'event' | 'badge' | 'request';
  points: number;
  date: string;
  icon?: string;
}

interface ProgressOverview {
  next_badge?: {
    name: string;
    points_needed: number;
    progress_percentage: number;
  };
  monthly_points: {
    month: string;
    points: number;
  }[];
  achievements: {
    total_activities: number;
    total_events: number;
    total_badges: number;
    streak_days?: number;
  };
}

const KonfiProfilePage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  
  const [profile, setProfile] = useState<KonfiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  // Edit form state
  const [editData, setEditData] = useState({
    display_name: '',
    email: ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/profile');
      setProfile(response.data);
    } catch (err) {
      setError('Fehler beim Laden des Profils');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async () => {
    if (!editData.display_name.trim()) {
      setError('Anzeigename ist erforderlich');
      return;
    }

    try {
      await api.put('/konfi/profile', {
        display_name: editData.display_name.trim(),
        email: editData.email.trim() || null
      });
      setSuccess('Profil erfolgreich aktualisiert');
      setIsEditModalOpen(false);
      await loadProfile();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren des Profils');
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      setError('Alle Passwort-Felder sind erforderlich');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Neue Passwörter stimmen nicht überein');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('Neues Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    try {
      await api.put('/konfi/profile/password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setSuccess('Passwort erfolgreich geändert');
      setIsPasswordModalOpen(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    }
  };

  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Möchtest du dich wirklich abmelden?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: () => {
            localStorage.removeItem('konfi_token');
            localStorage.removeItem('konfi_user');
            window.location.href = '/';
          }
        }
      ]
    });
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getActivityIcon = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'badge': return trophy;
      case 'event': return calendar;
      case 'activity': return flash;
      case 'request': return checkmark;
      default: return star;
    }
  };

  const getActivityColor = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'badge': return '#ffd700';
      case 'event': return '#3880ff';
      case 'activity': return '#2dd36f';
      case 'request': return '#ffcc00';
      default: return '#667eea';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <LoadingSpinner message="Profil wird geladen..." />;
  }

  if (!profile) {
    return (
      <IonPage>
        <IonContent>
          <p style={{ textAlign: 'center', marginTop: '50px' }}>
            Fehler beim Laden des Profils
          </p>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Profil</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Profil</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadProfile();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Profil Header */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
          color: 'white',
          boxShadow: '0 10px 30px rgba(139, 92, 246, 0.3)'
        }}>
          <IonCardContent style={{ padding: '32px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <IonAvatar style={{ 
                width: '80px', 
                height: '80px', 
                margin: '0 auto 16px',
                border: '4px solid rgba(255, 255, 255, 0.3)'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1.5rem'
                }}>
                  {getInitials(profile.display_name || profile.name)}
                </div>
              </IonAvatar>
              
              <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '600' }}>
                {profile.display_name}
              </h1>
              <p style={{ margin: '0 0 4px 0', opacity: 0.9, fontSize: '1rem' }}>
                @{profile.username}
              </p>
              <p style={{ margin: '0', opacity: 0.8, fontSize: '0.9rem' }}>
                {profile.jahrgang_name} ({profile.jahrgang_year})
              </p>
            </div>

            <IonGrid>
              <IonRow>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '1.8rem', fontWeight: '700' }}>
                      {profile.total_points}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                      Punkte
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '1.8rem', fontWeight: '700' }}>
                      {profile.badge_count}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                      Badges
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '1.8rem', fontWeight: '700' }}>
                      #{profile.rank_in_jahrgang || '?'}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                      Rang
                    </p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>

            {profile.rank_in_jahrgang && profile.total_in_jahrgang && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Jahrgang-Ranking</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                    {profile.rank_in_jahrgang} von {profile.total_in_jahrgang}
                  </span>
                </div>
                <IonProgressBar 
                  value={1 - (profile.rank_in_jahrgang - 1) / (profile.total_in_jahrgang - 1)}
                  style={{ 
                    height: '6px', 
                    borderRadius: '3px',
                    '--progress-background': 'rgba(255, 255, 255, 0.9)'
                  }}
                />
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* Quick Stats */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Meine Aktivitäten
            </h3>
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <div style={{ textAlign: 'center', padding: '12px' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px'
                    }}>
                      <IonIcon icon={flash} style={{ fontSize: '1.3rem', color: 'white' }} />
                    </div>
                    <h4 style={{ margin: '0', fontSize: '1.2rem', color: '#2dd36f' }}>
                      {profile.activity_count}
                    </h4>
                    <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                      Aktivitäten
                    </p>
                  </div>
                </IonCol>
                <IonCol size="6">
                  <div style={{ textAlign: 'center', padding: '12px' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3880ff 0%, #3171e0 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px'
                    }}>
                      <IonIcon icon={calendar} style={{ fontSize: '1.3rem', color: 'white' }} />
                    </div>
                    <h4 style={{ margin: '0', fontSize: '1.2rem', color: '#3880ff' }}>
                      {profile.event_count}
                    </h4>
                    <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                      Events
                    </p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Next Badge Progress */}
        {profile.progress_overview.next_badge && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <IonIcon icon={rocket} style={{ fontSize: '1.2rem', color: '#ff6b35', marginRight: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Nächstes Badge
                </h3>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '500' }}>
                {profile.progress_overview.next_badge.name}
              </p>
              <IonProgressBar 
                value={profile.progress_overview.next_badge.progress_percentage / 100}
                style={{ 
                  height: '8px', 
                  borderRadius: '4px',
                  marginBottom: '8px',
                  '--progress-background': 'linear-gradient(90deg, #ff6b35, #f7931e)'
                }}
              />
              <p style={{ margin: '0', fontSize: '0.85rem', color: '#666' }}>
                Noch {profile.progress_overview.next_badge.points_needed} Punkte bis zum nächsten Badge
                ({Math.round(profile.progress_overview.next_badge.progress_percentage)}%)
              </p>
            </IonCardContent>
          </IonCard>
        )}

        {/* Recent Activities */}
        {profile.recent_activities && profile.recent_activities.length > 0 && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                Letzte Aktivitäten
              </h3>
              <IonList style={{ margin: '0' }}>
                {profile.recent_activities.slice(0, 5).map((activity, index) => (
                  <IonItem 
                    key={index} 
                    lines={index === profile.recent_activities.length - 1 ? 'none' : 'inset'}
                    style={{ '--padding-start': '0', '--inner-padding-end': '0' }}
                  >
                    <div slot="start" style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${getActivityColor(activity)} 0%, ${getActivityColor(activity)}cc 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      <IonIcon 
                        icon={getActivityIcon(activity)} 
                        style={{ fontSize: '1.1rem', color: 'white' }} 
                      />
                    </div>
                    <IonLabel>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: '500' }}>
                        {activity.title}
                      </h4>
                      <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                        {formatDateTime(activity.date)} • {activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'}
                      </p>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {/* Account Settings */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Konto-Einstellungen
            </h3>
            
            <IonItem button onClick={() => {
              setEditData({
                display_name: profile.display_name,
                email: profile.email || ''
              });
              setIsEditModalOpen(true);
            }}>
              <IonIcon icon={person} slot="start" color="primary" />
              <IonLabel>
                <h3>Profil bearbeiten</h3>
                <p>Name und E-Mail ändern</p>
              </IonLabel>
              <IonIcon icon={create} slot="end" style={{ color: '#ccc' }} />
            </IonItem>

            <IonItem button onClick={() => setIsPasswordModalOpen(true)}>
              <IonIcon icon={key} slot="start" color="warning" />
              <IonLabel>
                <h3>Passwort ändern</h3>
                <p>Sicherheitseinstellungen</p>
              </IonLabel>
              <IonIcon icon={create} slot="end" style={{ color: '#ccc' }} />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Account Info */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Konto-Informationen
            </h3>
            
            <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
              <IonIcon icon={person} slot="start" color="primary" />
              <IonLabel>
                <h4>Benutzername</h4>
                <p>{profile.username}</p>
              </IonLabel>
            </IonItem>

            {profile.email && (
              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonIcon icon={person} slot="start" color="primary" />
                <IonLabel>
                  <h4>E-Mail</h4>
                  <p>{profile.email}</p>
                </IonLabel>
              </IonItem>
            )}

            <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
              <IonIcon icon={school} slot="start" color="tertiary" />
              <IonLabel>
                <h4>Jahrgang</h4>
                <p>{profile.jahrgang_name} ({profile.jahrgang_year})</p>
              </IonLabel>
            </IonItem>

            <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
              <IonIcon icon={calendar} slot="start" color="success" />
              <IonLabel>
                <h4>Mitglied seit</h4>
                <p>{formatDate(profile.created_at)}</p>
              </IonLabel>
            </IonItem>

            {profile.last_login_at && (
              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonIcon icon={time} slot="start" color="medium" />
                <IonLabel>
                  <h4>Letzter Login</h4>
                  <p>{formatDateTime(profile.last_login_at)}</p>
                </IonLabel>
              </IonItem>
            )}
          </IonCardContent>
        </IonCard>

        {/* Logout */}
        <IonCard style={{ margin: '16px 16px 32px 16px', borderRadius: '16px' }}>
          <IonCardContent>
            <IonButton 
              expand="block" 
              color="danger" 
              fill="outline"
              onClick={handleLogout}
            >
              <IonIcon icon={logOut} slot="start" />
              Abmelden
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Edit Profile Modal */}
        <IonModal isOpen={isEditModalOpen} onDidDismiss={() => setIsEditModalOpen(false)}>
          <IonPage>
            <IonHeader>
              <IonToolbar>
                <IonTitle>Profil bearbeiten</IonTitle>
                <IonButtons slot="start">
                  <IonButton onClick={() => setIsEditModalOpen(false)}>
                    <IonIcon icon={close} />
                  </IonButton>
                </IonButtons>
                <IonButtons slot="end">
                  <IonButton onClick={handleEditProfile}>
                    <IonIcon icon={save} />
                  </IonButton>
                </IonButtons>
              </IonToolbar>
            </IonHeader>
            <IonContent>
              <div style={{ padding: '16px' }}>
                <IonCard>
                  <IonCardContent>
                    <IonItem>
                      <IonLabel position="stacked">Anzeigename *</IonLabel>
                      <IonInput
                        value={editData.display_name}
                        onIonInput={(e) => setEditData(prev => ({ ...prev, display_name: e.detail.value! }))}
                        placeholder="Dein Name"
                      />
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">E-Mail (optional)</IonLabel>
                      <IonInput
                        type="email"
                        value={editData.email}
                        onIonInput={(e) => setEditData(prev => ({ ...prev, email: e.detail.value! }))}
                        placeholder="deine@email.de"
                      />
                    </IonItem>
                  </IonCardContent>
                </IonCard>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>

        {/* Change Password Modal */}
        <IonModal isOpen={isPasswordModalOpen} onDidDismiss={() => setIsPasswordModalOpen(false)}>
          <IonPage>
            <IonHeader>
              <IonToolbar>
                <IonTitle>Passwort ändern</IonTitle>
                <IonButtons slot="start">
                  <IonButton onClick={() => setIsPasswordModalOpen(false)}>
                    <IonIcon icon={close} />
                  </IonButton>
                </IonButtons>
                <IonButtons slot="end">
                  <IonButton onClick={handleChangePassword}>
                    <IonIcon icon={save} />
                  </IonButton>
                </IonButtons>
              </IonToolbar>
            </IonHeader>
            <IonContent>
              <div style={{ padding: '16px' }}>
                <IonCard>
                  <IonCardContent>
                    <IonItem>
                      <IonLabel position="stacked">Aktuelles Passwort *</IonLabel>
                      <IonInput
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.current_password}
                        onIonInput={(e) => setPasswordData(prev => ({ ...prev, current_password: e.detail.value! }))}
                        placeholder="Aktuelles Passwort eingeben"
                      />
                      <IonButton 
                        slot="end" 
                        fill="clear" 
                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      >
                        <IonIcon icon={showPasswords.current ? eyeOff : eye} />
                      </IonButton>
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Neues Passwort *</IonLabel>
                      <IonInput
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.new_password}
                        onIonInput={(e) => setPasswordData(prev => ({ ...prev, new_password: e.detail.value! }))}
                        placeholder="Neues Passwort eingeben"
                      />
                      <IonButton 
                        slot="end" 
                        fill="clear" 
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      >
                        <IonIcon icon={showPasswords.new ? eyeOff : eye} />
                      </IonButton>
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Neues Passwort bestätigen *</IonLabel>
                      <IonInput
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirm_password}
                        onIonInput={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.detail.value! }))}
                        placeholder="Neues Passwort bestätigen"
                      />
                      <IonButton 
                        slot="end" 
                        fill="clear" 
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      >
                        <IonIcon icon={showPasswords.confirm ? eyeOff : eye} />
                      </IonButton>
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                <IonCard style={{ background: 'rgba(56, 128, 255, 0.1)' }}>
                  <IonCardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={checkmark} color="primary" />
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#3880ff' }}>
                        Das Passwort muss mindestens 6 Zeichen lang sein.
                      </p>
                    </div>
                  </IonCardContent>
                </IonCard>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default KonfiProfilePage;