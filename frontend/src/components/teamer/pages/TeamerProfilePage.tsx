import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonIcon,
  IonCard,
  IonCardContent,
  IonButton,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import {
  mailOutline,
  keyOutline,
  briefcaseOutline,
  calendarOutline,
  settingsOutline,
  trophy,
  logOutOutline,
  ribbon,
  schoolOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useHistory } from 'react-router-dom';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import { logout } from '../../../services/auth';
import { setUser as setTokenStoreUser, clearAuth } from '../../../services/tokenStore';
import ChangeEmailModal from '../../konfi/modals/ChangeEmailModal';
import ChangePasswordModal from '../../konfi/modals/ChangePasswordModal';
import ChangeRoleTitleModal from '../../admin/modals/ChangeRoleTitleModal';
import LoadingSpinner from '../../common/LoadingSpinner';
import { triggerPullHaptic } from '../../../utils/haptics';

interface TeamerProfile {
  user: {
    display_name: string;
    username: string;
    email: string;
    role_title: string;
    teamer_since: string | null;
    organization_name: string;
  };
  konfi_data: {
    gottesdienst_points: number;
    gemeinde_points: number;
    jahrgang_name: string;
    badges: Array<{
      badge_id: number;
      name: string;
      icon: string;
      color: string;
      awarded_date: string;
    }>;
  };
}

const TeamerProfilePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('profile');
  const { user, setUser, setError } = useApp();
  const [presentAlert] = useIonAlert();
  const history = useHistory();

  // Offline-Query: Profil
  const { data: profile, loading, refresh } = useOfflineQuery<TeamerProfile>(
    'teamer:profile:' + user?.id,
    async () => { const res = await api.get('/teamer/profile'); return res.data; },
    { ttl: CACHE_TTL.PROFILE }
  );

  // Modals
  const [presentEmailModal, dismissEmailModal] = useIonModal(ChangeEmailModal, {
    onClose: () => dismissEmailModal(),
    onSuccess: async () => {
      dismissEmailModal();
      await refresh();
      try {
        const response = await api.get('/auth/me');
        if (user) {
          const updatedUser = { ...user, email: response.data.email };
          await setTokenStoreUser(updatedUser);
          setUser(updatedUser);
        }
      } catch (err) {
        console.error('Error refreshing user:', err);
      }
    },
    sectionIconClass: 'app-section-icon--teamer',
    submitBtnClass: 'app-modal-submit-btn--teamer',
    infoBoxClass: 'app-info-box--teamer'
  });

  const [presentPasswordModal, dismissPasswordModal] = useIonModal(ChangePasswordModal, {
    onClose: () => dismissPasswordModal(),
    onSuccess: () => dismissPasswordModal(),
    sectionIconClass: 'app-section-icon--teamer',
    submitBtnClass: 'app-modal-submit-btn--teamer'
  });

  const [presentRoleTitleModal, dismissRoleTitleModal] = useIonModal(ChangeRoleTitleModal, {
    onClose: () => dismissRoleTitleModal(),
    onSuccess: () => {
      dismissRoleTitleModal();
      refresh();
    },
    initialRoleTitle: profile?.user.role_title || '',
    sectionIconClass: 'app-section-icon--teamer',
    submitBtnClass: 'app-modal-submit-btn--teamer',
    infoBoxClass: 'app-info-box--teamer'
  });

  // Logout
  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Willst du dich wirklich abmelden?',
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
              await clearAuth();
              window.location.href = '/';
            }
          }
        }
      ]
    });
  };

  const itemStyle: Record<string, string> = {
    '--background': 'transparent',
    '--padding-start': '0',
    '--padding-end': '0',
    '--inner-padding-end': '0',
    '--inner-border-width': '0',
    '--border-style': 'none',
    '--min-height': 'auto'
  };

  if (loading) {
    return <LoadingSpinner message="Profil wird geladen..." />;
  }

  if (!profile) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <p>Fehler beim Laden des Profils</p>
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={handleLogout}
              style={{ marginTop: '24px', height: '48px', borderRadius: '12px', fontWeight: '600' }}
            >
              <IonIcon icon={logOutOutline} slot="start" />
              Abmelden
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Profil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Profil</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refresh().then(() => e.detail.complete());
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {/* A. Detail-Header */}
        <div className="app-detail-header" style={{
          background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
          boxShadow: '0 20px 40px rgba(225, 29, 72, 0.3)'
        }}>
          <div className="app-detail-header__content" style={{ padding: '70px 24px 24px 24px', alignItems: 'center', textAlign: 'center' }}>
            <div className="app-icon-circle" style={{
              width: '80px', height: '80px',
              background: 'rgba(255, 255, 255, 0.2)',
              marginBottom: '16px',
              color: 'white', fontSize: '2rem', fontWeight: '600',
              border: '3px solid rgba(255, 255, 255, 0.3)'
            }}>
              {profile.user.display_name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
            <h1 className="app-detail-header__title">{profile.user.display_name}</h1>
            <p className="app-detail-header__subtitle">
              {profile.user.role_title || 'Teamer:in'}
            </p>
            <div className="app-detail-header__info-row" style={{ justifyContent: 'center' }}>
              {profile.user.email && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={mailOutline} style={{ fontSize: '0.85rem' }} />
                  {profile.user.email}
                </div>
              )}
              {profile.user.teamer_since && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={calendarOutline} style={{ fontSize: '0.85rem' }} />
                  Dabei seit {new Date(profile.user.teamer_since).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* B. Konto-Einstellungen */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon" style={{ backgroundColor: '#e11d48' }}>
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
                  onClick={() => presentRoleTitleModal({ presentingElement: pageRef.current ?? undefined })}
                  detail={false}
                  lines="none"
                  style={{ ...itemStyle, marginBottom: '8px' } as any}
                >
                  <div className="app-list-item" style={{ width: '100%', borderLeftColor: '#e11d48' }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle" style={{ backgroundColor: '#e11d48' }}>
                          <IonIcon icon={briefcaseOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Funktionsbeschreibung</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {profile.user.role_title ? `Aktuell: ${profile.user.role_title}` : 'z.B. Jugendleiter:in'}
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
                  onClick={() => presentEmailModal({ presentingElement: pageRef.current ?? undefined })}
                  detail={false}
                  lines="none"
                  style={{ ...itemStyle, marginBottom: '8px' } as any}
                >
                  <div className="app-list-item" style={{ width: '100%', borderLeftColor: '#e11d48' }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle" style={{ backgroundColor: '#e11d48' }}>
                          <IonIcon icon={mailOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">E-Mail-Adresse ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {profile.user.email ? `Aktuell: ${profile.user.email}` : 'E-Mail für Benachrichtigungen'}
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
                  onClick={() => presentPasswordModal({ presentingElement: pageRef.current ?? undefined })}
                  detail={false}
                  lines="none"
                  style={itemStyle as any}
                >
                  <div className="app-list-item" style={{ width: '100%', borderLeftColor: '#e11d48' }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle" style={{ backgroundColor: '#e11d48' }}>
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

        {/* C. Inhalt */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon" style={{ backgroundColor: '#e11d48' }}>
              <IonIcon icon={ribbon} />
            </div>
            <IonLabel>Inhalt</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div
                className="app-list-item app-settings-item"
                style={{ borderLeftColor: '#f59e0b' }}
                onClick={() => history.push('/teamer/profile/badges')}
              >
                <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: '#f59e0b' }}>
                  <IonIcon icon={trophy} />
                </div>
                <div className="app-flex-fill">
                  <h2 className="app-settings-item__title">Badges</h2>
                  <p className="app-settings-item__subtitle">Teamer-Badges und Fortschritt</p>
                </div>
              </div>

              {profile.konfi_data?.jahrgang_name && (
                <div
                  className="app-list-item app-settings-item"
                  style={{ borderLeftColor: '#5b21b6' }}
                  onClick={() => history.push('/teamer/profile/konfi-stats')}
                >
                  <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: '#5b21b6' }}>
                    <IonIcon icon={schoolOutline} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Konfi-Historie</h2>
                    <p className="app-settings-item__subtitle">Punkte und Badges aus der Konfi-Zeit</p>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* D. Logout-Button */}
        <div style={{ padding: '0 16px', marginTop: '16px' }}>
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={handleLogout}
            style={{
              height: '48px',
              borderRadius: '12px',
              fontWeight: '600'
            }}
          >
            <IonIcon icon={logOutOutline} slot="start" />
            Abmelden
          </IonButton>
        </div>


        <div style={{ height: '32px' }} />
      </IonContent>
    </IonPage>
  );
};

export default TeamerProfilePage;
