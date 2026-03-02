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
  useIonModal
} from '@ionic/react';
import {
  personOutline,
  keyOutline,
  mailOutline,
  arrowBack,
  informationCircleOutline,
  briefcaseOutline,
  settingsOutline,
  shieldOutline,
  calendarOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import ChangeEmailModal from '../modals/ChangeEmailModal';
import ChangePasswordModal from '../modals/ChangePasswordModal';
import ChangeRoleTitleModal from '../modals/ChangeRoleTitleModal';

const AdminProfilePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-profile');
  const { user, setUser, setSuccess, setError } = useApp();
  const [profileData, setProfileData] = useState<{ role_title?: string; email?: string; created_at?: string }>({});

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
    // initialEmail wird nicht mehr benötigt - Modal lädt selbst vom Server
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

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
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
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Admin-Profil</IonTitle>
          </IonToolbar>
        </IonHeader>
        {/* Header - Dashboard-Style mit app-detail-header CSS-Klassen */}
        <div className="app-detail-header" style={{
          background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
          boxShadow: '0 20px 40px rgba(91, 33, 182, 0.3)'
        }}>
          <div className="app-detail-header__content" style={{ padding: '70px 24px 24px 24px', alignItems: 'center', textAlign: 'center' }}>
            {/* Avatar */}
            <div className="app-icon-circle" style={{
              width: '80px', height: '80px',
              background: 'rgba(255, 255, 255, 0.2)',
              marginBottom: '16px',
              color: 'white', fontSize: '2rem', fontWeight: '600',
              border: '3px solid rgba(255, 255, 255, 0.3)'
            }}>
              {user?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <h1 className="app-detail-header__title">{user?.display_name || 'Administrator'}</h1>
            <p className="app-detail-header__subtitle">
              {profileData.role_title
                ? `Administrator - ${profileData.role_title}`
                : 'Administrator'}
            </p>
            <div className="app-detail-header__info-row" style={{ justifyContent: 'center' }}>
              {(profileData.email || user?.email) && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={mailOutline} style={{ fontSize: '0.85rem' }} />
                  {profileData.email || user?.email}
                </div>
              )}
              {profileData.created_at && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={calendarOutline} style={{ fontSize: '0.85rem' }} />
                  Seit {new Date(profileData.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
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

      </IonContent>
    </IonPage>
  );
};

export default AdminProfilePage;
