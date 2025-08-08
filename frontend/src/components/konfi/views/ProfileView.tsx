import React, { useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonAvatar,
  IonProgressBar,
  useIonModal,
  useIonAlert,
  useIonActionSheet,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonInput
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
  key,
  book,
  location
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import { logout } from '../../../services/auth';

interface KonfiProfile {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  jahrgang_name: string;
  jahrgang_year: number;
  confirmation_date?: string;
  confirmation_location?: string;
  created_at: string;
  last_login_at?: string;
  bible_translation?: string;
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

interface ProfileViewProps {
  profile: KonfiProfile;
  onReload: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ profile, onReload }) => {
  const { user, setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  const [presentActionSheet] = useIonActionSheet();
  const { pageRef, presentingElement } = useModalPage('profile');
  
  const [selectedTranslation, setSelectedTranslation] = useState<string>(profile.bible_translation || 'LUT');
  const [earnedBadgesCount, setEarnedBadgesCount] = useState<number>(0);
  
  // Load badges for accurate count
  React.useEffect(() => {
    const loadBadges = async () => {
      try {
        const response = await api.get('/konfi/badges');
        const badges = [...(response.data.available || []), ...(response.data.earned || [])];
        const earnedCount = badges.filter((badge: any) => badge.earned || badge.is_earned).length;
        setEarnedBadgesCount(earnedCount);
      } catch (err) {
        console.warn('Could not load badges for count:', err);
      }
    };
    loadBadges();
  }, []);
  
  // Edit form state (only email now)
  const [editData, setEditData] = useState({
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

  const handleEditProfile = async () => {
    try {
      // Update email if changed
      if (editData.email.trim() !== (profile?.email || '')) {
        await api.post('/auth/update-email', {
          email: editData.email.trim() || null
        });
      }
      
      setSuccess('E-Mail erfolgreich aktualisiert');
      await onReload();
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
      await api.post('/auth/change-password', {
        currentPassword: passwordData.current_password,
        newPassword: passwordData.new_password
      });
      setSuccess('Passwort erfolgreich geändert');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    }
  };

  const handleTranslationChange = async (translation: string) => {
    try {
      await api.put('/konfi/bible-translation', { translation });
      setSelectedTranslation(translation);
      setSuccess(`Bibelübersetzung auf ${getTranslationName(translation)} geändert`);
      // Update profile to reflect the change
      await onReload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern der Bibelübersetzung');
    }
  };

  const getTranslationName = (code: string) => {
    const translations = {
      'LUT': 'Lutherbibel 2017',
      'ELB': 'Elberfelder Bibel',
      'GNB': 'Gute Nachricht Bibel',
      'BIGS': 'Bibel in gerechter Sprache',
      'NIV': 'New International Version',
      'LSG': 'Louis Segond 1910',
      'RVR60': 'Reina-Valera 1960'
    };
    return translations[code as keyof typeof translations] || code;
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
          handler: async () => {
            try {
              await logout();
              window.location.href = '/';
            } catch (error) {
              console.error('Logout error:', error);
              // Fallback: direct logout even if token removal fails
              localStorage.removeItem('konfi_token');
              localStorage.removeItem('konfi_user');
              window.location.href = '/';
            }
          }
        }
      ]
    });
  };

  // Modal with useIonModal Hook for Email Edit
  const [presentEmailModal, dismissEmailModal] = useIonModal(() => (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => dismissEmailModal()}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonTitle>E-Mail ändern</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={async () => {
              await handleEditProfile();
              dismissEmailModal();
            }}>
              <IonIcon icon={checkmark} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Überschrift außerhalb der Card gemäß MODAL_STYLING_GUIDE */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#007aff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={person} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            E-Mail-Adresse
          </h2>
        </div>
        
        {/* Card ohne Header */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none">
                <IonLabel position="stacked">E-Mail (optional)</IonLabel>
                <IonInput
                  type="email"
                  value={editData.email}
                  onIonInput={(e) => setEditData(prev => ({ ...prev, email: e.detail.value! }))}
                  placeholder="deine@email.de"
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  ), {
    onDismiss: () => dismissEmailModal(),
    presentingElement: presentingElement
  });

  // Modal with useIonModal Hook for Password Change
  const [presentPasswordModal, dismissPasswordModal] = useIonModal(() => (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => dismissPasswordModal()}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonTitle>Passwort ändern</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={async () => {
              await handleChangePassword();
              dismissPasswordModal();
            }} disabled={!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}>
              <IonIcon icon={checkmark} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Passwort-Sektion */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#e74c3c',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={key} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Sicherheitseinstellungen
          </h2>
        </div>
        
        {/* Passwort-Felder */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none">
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
                  size="small"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  <IonIcon icon={showPasswords.current ? eyeOff : eye} />
                </IonButton>
              </IonItem>

              <IonItem lines="none">
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
                  size="small"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  <IonIcon icon={showPasswords.new ? eyeOff : eye} />
                </IonButton>
              </IonItem>

              <IonItem lines="none">
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
                  size="small"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  <IonIcon icon={showPasswords.confirm ? eyeOff : eye} />
                </IonButton>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Hinweis-Card */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'rgba(56, 128, 255, 0.1)' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={checkmark} color="primary" />
              <p style={{ margin: '0', fontSize: '0.9rem', color: '#3880ff' }}>
                Das Passwort muss mindestens 6 Zeichen lang sein.
              </p>
            </div>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  ), {
    onDismiss: () => dismissPasswordModal(),
    presentingElement: presentingElement
  });

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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unbekannt';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Ungültiges Datum';
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return 'Unbekannt';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Ungültiges Datum';
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      {/* Profile Header - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(139, 92, 246, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '220px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Überschrift - groß und überlappend */}
        <div style={{
          position: 'absolute',
          top: '-5px',
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
            {profile.display_name.toUpperCase()}
          </h2>
        </div>
        
        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '70px 24px 24px 24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <IonGrid style={{ padding: '0', margin: '0 4px' }}>
            <IonRow>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon 
                    icon={star} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{profile.total_points || 0}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Punkte
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon 
                    icon={trophy} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{earnedBadgesCount}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Badges
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon 
                    icon={flash} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{(profile.event_count || 0) + (profile.activity_count || 0)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Aktionen
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Persönliche Informationen - Erweitert */}
      <IonCard style={{ margin: '16px', borderRadius: '12px' }}>
        <IonCardContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <IonAvatar style={{ 
              width: '60px', 
              height: '60px',
              flexShrink: 0
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '1.2rem'
              }}>
                {getInitials(profile.display_name)}
              </div>
            </IonAvatar>
            
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: '600' }}>
                {profile.display_name}
              </h2>
              <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
                {profile.username ? `${profile.username}` : '...'}
              </p>
              <p style={{ margin: '0', color: '#999', fontSize: '0.85rem' }}>
                {profile.jahrgang_name}
              </p>
              {profile.email && (
                <p style={{ margin: '0', color: '#999', fontSize: '0.85rem' }}>
                  {profile.email}
                </p>
              )}
              <p style={{ margin: '0', color: '#999', fontSize: '0.85rem' }}>
                Mitglied seit {formatDate(profile.created_at)}
              </p>
            </div>
          </div>
        </IonCardContent>
      </IonCard>

      {/* Konfirmationstermin Card - Schön gestylt */}
      <IonCard style={{ 
        margin: '16px', 
        borderRadius: '12px',
        background: profile.confirmation_date ? 'linear-gradient(135deg, #f0e6ff 0%, #e6d9ff 100%)' : '#fff',
        border: profile.confirmation_date ? '1px solid #d4b5fd' : '1px solid #e0e0e0'
      }}>
        <IonCardContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '48px', 
              height: '48px',
              backgroundColor: '#8b5cf6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
              flexShrink: 0
            }}>
              <IonIcon 
                icon={calendar} 
                style={{ 
                  fontSize: '1.5rem', 
                  color: 'white'
                }} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ 
                margin: '0 0 6px 0', 
                fontSize: '1rem', 
                fontWeight: '700',
                color: '#8b5cf6',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Konfirmationstermin
              </h3>
              {profile.confirmation_date ? (
                <div>
                  <p style={{ 
                    margin: '0 0 4px 0', 
                    color: '#333', 
                    fontSize: '1.1rem', 
                    fontWeight: '600' 
                  }}>
                    {formatDate(profile.confirmation_date)}
                  </p>
                  <p style={{ 
                    margin: '0 0 4px 0', 
                    color: '#666', 
                    fontSize: '0.9rem' 
                  }}>
                    {new Date(profile.confirmation_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </p>
                  {profile.confirmation_location && (
                    <p 
                      style={{ 
                        margin: '0', 
                        color: '#8b5cf6', 
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onClick={() => {
                        if (profile.confirmation_location) {
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.confirmation_location)}`, '_blank');
                        }
                      }}
                    >
                      <IonIcon icon={location} style={{ fontSize: '1rem' }} />
                      {profile.confirmation_location}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
                  {profile.jahrgang_name && profile.jahrgang_year 
                    ? `Noch kein Termin gebucht`
                    : 'Kein Termin verfügbar'
                  }
                </p>
              )}
            </div>
          </div>
        </IonCardContent>
      </IonCard>

      {/* Next Badge Progress */}
      {profile.progress_overview?.next_badge && (
        <IonCard style={{ margin: '16px', borderRadius: '12px' }}>
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
        <IonCard style={{ margin: '16px', borderRadius: '12px' }}>
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
      <IonCard style={{ margin: '16px', borderRadius: '12px' }}>
        <IonCardContent>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
            Konto-Einstellungen
          </h3>
          
          <IonItem button onClick={() => {
            setEditData({
              email: profile?.email || user?.email || ''
            });
            presentEmailModal({
              presentingElement: presentingElement
            });
          }}>
            <IonIcon icon={person} slot="start" color="primary" />
            <IonLabel>
              <h3>E-Mail-Adresse ändern</h3>
              <p>{user?.email ? `Aktuell: ${user.email}` : 'E-Mail für Benachrichtigungen'}</p>
            </IonLabel>
            <IonIcon icon={create} slot="end" style={{ color: '#ccc' }} />
          </IonItem>

          <IonItem button onClick={() => {
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
            presentPasswordModal({
              presentingElement: presentingElement
            });
          }}>
            <IonIcon icon={key} slot="start" color="warning" />
            <IonLabel>
              <h3>Passwort ändern</h3>
              <p>Sicherheitseinstellungen</p>
            </IonLabel>
            <IonIcon icon={create} slot="end" style={{ color: '#ccc' }} />
          </IonItem>

          <IonItem button onClick={() => {
            presentActionSheet({
              header: 'Bibelübersetzung wählen',
              subHeader: 'Für die Tageslosung',
              buttons: [
                {
                  text: 'Lutherbibel 2017',
                  role: selectedTranslation === 'LUT' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('LUT')
                },
                {
                  text: 'Elberfelder Bibel',
                  role: selectedTranslation === 'ELB' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('ELB')
                },
                {
                  text: 'Gute Nachricht Bibel',
                  role: selectedTranslation === 'GNB' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('GNB')
                },
                {
                  text: 'Bibel in gerechter Sprache',
                  role: selectedTranslation === 'BIGS' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('BIGS')
                },
                {
                  text: 'New International Version',
                  role: selectedTranslation === 'NIV' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('NIV')
                },
                {
                  text: 'Louis Segond 1910',
                  role: selectedTranslation === 'LSG' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('LSG')
                },
                {
                  text: 'Reina-Valera 1960',
                  role: selectedTranslation === 'RVR60' ? 'selected' : undefined,
                  handler: () => handleTranslationChange('RVR60')
                },
                {
                  text: 'Abbrechen',
                  role: 'cancel'
                }
              ]
            });
          }}>
            <IonIcon icon={book} slot="start" color="tertiary" />
            <IonLabel>
              <h3>Bibelübersetzung</h3>
              <p>{getTranslationName(selectedTranslation)}</p>
            </IonLabel>
            <IonIcon icon={create} slot="end" style={{ color: '#ccc' }} />
          </IonItem>
        </IonCardContent>
      </IonCard>

      {/* Logout */}
      <IonCard style={{ margin: '16px 16px 32px 16px', borderRadius: '12px' }}>
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
    </div>
  );
};

export default ProfileView;