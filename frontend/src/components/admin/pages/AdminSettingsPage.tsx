import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonLabel,
  IonIcon,
  IonList,
  IonListHeader,
  IonButton,
  IonNote,
  useIonAlert
} from '@ionic/react';
import {
  people,
  shield,
  business,
  pricetag,
  school,
  person,
  trophy,
  logOut,
  flash,
  notifications,
  chevronForward,
  statsChart,
  qrCode
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { logout } from '../../../services/auth';
import { useHistory } from 'react-router-dom';

const AdminSettingsPage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-settings');
  const { user, pushNotificationsPermission, requestPushPermissions } = useApp();
  const [presentAlert] = useIonAlert();
  const history = useHistory();

  const getPushPermissionText = () => {
    switch (pushNotificationsPermission) {
      case 'granted': return 'Aktiviert';
      case 'denied': return 'Deaktiviert';
      case 'prompt': return 'Nicht gefragt';
      default: return 'Unbekannt';
    }
  };

  const getPushPermissionColor = () => {
    switch (pushNotificationsPermission) {
      case 'granted': return '#34c759';
      case 'denied': return '#dc3545';
      default: return '#ff9500';
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
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Mehr</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Mehr</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* BLOCK 1: Verwaltung - für org_admin UND super_admin */}
        {(user?.role_name === 'org_admin' || user?.role_name === 'super_admin') && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={shield} />
              </div>
              <IonLabel>Verwaltung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    className="app-list-item app-list-item--users"
                    onClick={() => history.push('/admin/users')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                      <IonIcon icon={people} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Benutzer:innen</h2>
                      <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Admins, Teamer:innen und Rollen verwalten</p>
                    </div>
                    <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                  </div>

                  <div
                    className="app-list-item app-list-item--activities"
                    onClick={() => history.push('/admin/settings/goals')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--activities">
                      <IonIcon icon={statsChart} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Punkte-Ziele</h2>
                      <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Ziel-Punkte für Gottesdienst und Gemeinde</p>
                    </div>
                    <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                  </div>

                  <div
                    className="app-list-item app-list-item--jahrgang"
                    onClick={() => history.push('/admin/settings/invite')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                      <IonIcon icon={qrCode} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Konfis einladen</h2>
                      <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>QR-Code für Selbstregistrierung</p>
                    </div>
                    <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* System-Administration - NUR für super_admin */}
        {user?.role_name === 'super_admin' && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={business} />
              </div>
              <IonLabel>System-Administration</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    className="app-list-item app-list-item--success"
                    onClick={() => history.push('/admin/organizations')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--success">
                      <IonIcon icon={business} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Organisationen</h2>
                      <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Gemeinden und Organisationen verwalten</p>
                    </div>
                    <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* BLOCK 2: Inhalt */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={pricetag} />
            </div>
            <IonLabel>Inhalt</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  className="app-list-item app-list-item--activities"
                  onClick={() => history.push('/admin/activities')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--activities">
                    <IonIcon icon={flash} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Aktivitäten</h2>
                    <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Aktivitäten und Punkte verwalten</p>
                  </div>
                  <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                </div>

                <div
                  className="app-list-item app-list-item--badges"
                  onClick={() => history.push('/admin/settings/categories')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--badges">
                    <IonIcon icon={pricetag} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Kategorien</h2>
                    <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Kategorien für Aktivitäten und Events</p>
                  </div>
                  <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                </div>

                <div
                  className="app-list-item app-list-item--jahrgang"
                  onClick={() => history.push('/admin/settings/jahrgaenge')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                    <IonIcon icon={school} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Jahrgänge</h2>
                    <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Konfirmand:innen verwalten</p>
                  </div>
                  <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                </div>

                <div
                  className="app-list-item app-list-item--level"
                  onClick={() => history.push('/admin/settings/levels')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--level">
                    <IonIcon icon={trophy} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Level-System</h2>
                    <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Punkte-Level und Belohnungen</p>
                  </div>
                  <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Konto */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={person} />
            </div>
            <IonLabel>Konto</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  className="app-list-item app-list-item--primary"
                  onClick={() => history.push('/admin/profile')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--primary">
                    <IonIcon icon={person} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Profil</h2>
                    <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Passwort und E-Mail ändern</p>
                  </div>
                  <IonIcon icon={chevronForward} style={{ color: '#c7c7cc', fontSize: '1.2rem' }} />
                </div>

                <div
                  className="app-list-item app-list-item--warning"
                  onClick={() => pushNotificationsPermission !== 'granted' && requestPushPermissions()}
                  style={{
                    cursor: pushNotificationsPermission !== 'granted' ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                    <IonIcon icon={notifications} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#333' }}>Push-Benachrichtigungen</h2>
                    <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '2px 0 0 0' }}>Chat-Nachrichten und Updates</p>
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    color: getPushPermissionColor(),
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: `${getPushPermissionColor()}15`
                  }}>
                    {getPushPermissionText()}
                  </span>
                </div>

                <div
                  className="app-list-item app-list-item--danger"
                  onClick={handleLogout}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                    <IonIcon icon={logOut} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: 0, color: '#dc3545' }}>Abmelden</h2>
                    <p style={{ fontSize: '0.75rem', color: '#dc3545', margin: '2px 0 0 0', opacity: 0.7 }}>Von diesem Gerät abmelden</p>
                  </div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        <div style={{ height: '16px' }}></div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettingsPage;
