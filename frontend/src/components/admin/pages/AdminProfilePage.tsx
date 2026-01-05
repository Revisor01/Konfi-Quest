import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonButtons,
  IonList,
  IonListHeader,
  IonGrid,
  IonRow,
  IonCol,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import {
  personOutline,
  keyOutline,
  mailOutline,
  arrowBack,
  logOutOutline,
  informationCircleOutline,
  briefcaseOutline,
  settingsOutline,
  shieldOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import { logout } from '../../../services/auth';
import ChangeEmailModal from '../modals/ChangeEmailModal';
import ChangePasswordModal from '../modals/ChangePasswordModal';
import ChangeRoleTitleModal from '../modals/ChangeRoleTitleModal';

const AdminProfilePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-profile');
  const { user, setUser, setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  const [profileData, setProfileData] = useState<{ role_title?: string; email?: string }>({});

  // Profildaten laden
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get('/auth/me');
        setProfileData(response.data);
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    };
    loadProfile();
  }, []);

  // Email Modal mit useIonModal Hook
  const [presentEmailModalHook, dismissEmailModalHook] = useIonModal(ChangeEmailModal, {
    onClose: () => dismissEmailModalHook(),
    onSuccess: async () => {
      dismissEmailModalHook();
      // User-Daten im Context aktualisieren
      try {
        const response = await api.get('/auth/me');
        setProfileData(response.data);
        // User im Context und localStorage aktualisieren
        if (user) {
          const updatedUser = { ...user, email: response.data.email };
          localStorage.setItem('konfi_user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      } catch (err) {
        console.error('Error refreshing user:', err);
      }
    }
    // initialEmail wird nicht mehr benoetigt - Modal laedt selbst vom Server
  });

  // Password Modal mit useIonModal Hook
  const [presentPasswordModalHook, dismissPasswordModalHook] = useIonModal(ChangePasswordModal, {
    onClose: () => dismissPasswordModalHook(),
    onSuccess: () => dismissPasswordModalHook()
  });

  // RoleTitle Modal mit useIonModal Hook
  const [presentRoleTitleModalHook, dismissRoleTitleModalHook] = useIonModal(ChangeRoleTitleModal, {
    onClose: () => dismissRoleTitleModalHook(),
    onSuccess: () => {
      dismissRoleTitleModalHook();
      // Profil neu laden
      api.get('/auth/me').then(res => setProfileData(res.data)).catch(console.error);
    },
    initialRoleTitle: profileData.role_title || ''
  });

  const handleOpenEmailModal = () => {
    presentEmailModalHook({
      presentingElement: presentingElement || undefined
    });
  };

  const handleOpenPasswordModal = () => {
    presentPasswordModalHook({
      presentingElement: presentingElement || undefined
    });
  };

  const handleOpenRoleTitleModal = () => {
    presentRoleTitleModalHook({
      presentingElement: presentingElement || undefined
    });
  };

  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Möchten Sie sich wirklich abmelden?',
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

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start">
          <IonButton onClick={() => window.history.back()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonButtons>
          <IonTitle>Admin-Profil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        {/* Header - Dashboard-Style */}
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(139, 92, 246, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '200px',
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
              PROFIL
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
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {/* Avatar */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: 'white',
              fontSize: '2rem',
              fontWeight: '600',
              border: '3px solid rgba(255, 255, 255, 0.3)'
            }}>
              {user?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'white'
            }}>
              {user?.display_name || 'Administrator'}
            </h1>
            <p style={{
              margin: '0',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.9rem'
            }}>
              {profileData.role_title
                ? `Administrator - ${profileData.role_title}`
                : 'Administrator'}
            </p>
          </div>
        </div>

        {/* Konto-Einstellungen - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={settingsOutline} />
            </div>
            <IonLabel>Konto-Einstellungen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                {/* Funktionsbeschreibung */}
                <IonItem
                  button
                  onClick={handleOpenRoleTitleModal}
                  detail={false}
                  lines="none"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--padding-end': '0',
                    '--inner-padding-end': '0',
                    '--inner-border-width': '0',
                    '--border-style': 'none',
                    '--min-height': 'auto',
                    marginBottom: '8px'
                  }}
                >
                  <div
                    className="app-list-item app-list-item--purple"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--purple">
                          <IonIcon icon={briefcaseOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Funktionsbeschreibung</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {profileData.role_title ? `Aktuell: ${profileData.role_title}` : 'z.B. Pastor, Diakonin'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* E-Mail ändern */}
                <IonItem
                  button
                  onClick={handleOpenEmailModal}
                  detail={false}
                  lines="none"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--padding-end': '0',
                    '--inner-padding-end': '0',
                    '--inner-border-width': '0',
                    '--border-style': 'none',
                    '--min-height': 'auto',
                    marginBottom: '8px'
                  }}
                >
                  <div
                    className="app-list-item app-list-item--purple"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--purple">
                          <IonIcon icon={mailOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">E-Mail-Adresse ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {(profileData.email || user?.email) ? `Aktuell: ${profileData.email || user?.email}` : 'E-Mail für Benachrichtigungen'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* Passwort ändern */}
                <IonItem
                  button
                  onClick={handleOpenPasswordModal}
                  detail={false}
                  lines="none"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--padding-end': '0',
                    '--inner-padding-end': '0',
                    '--inner-border-width': '0',
                    '--border-style': 'none',
                    '--min-height': 'auto'
                  }}
                >
                  <div
                    className="app-list-item app-list-item--purple"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--purple">
                          <IonIcon icon={keyOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Passwort ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">Sicherheitseinstellungen</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* App-Info - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <IonLabel>App-Info</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <div className="app-list-item app-list-item--purple">
                <div className="app-list-item__row">
                  <div className="app-list-item__main">
                    <div className="app-icon-circle app-icon-circle--purple">
                      <IonIcon icon={shieldOutline} />
                    </div>
                    <div className="app-list-item__content">
                      <div className="app-list-item__title">Konfi Quest</div>
                      <div className="app-list-item__meta">
                        <span className="app-list-item__meta-item">Version 2.0 - Ionic 8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Logout - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px 16px 16px 16px' }}>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonButton
                expand="block"
                color="danger"
                fill="outline"
                onClick={handleLogout}
              >
                <IonIcon icon={logOutOutline} slot="start" />
                Abmelden
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonList>

      </IonContent>
    </IonPage>
  );
};

export default AdminProfilePage;
