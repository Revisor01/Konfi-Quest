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
  useIonAlert,
  useIonModal
} from '@ionic/react';
import AdminInvitePage from './AdminInvitePage';
import {
  people,
  shield,
  business,
  pricetag,
  school,
  person,
  trophy,
  ribbon,
  logOut,
  flash,
  notifications,
  qrCode,
  appsOutline,
  document as documentIcon
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { logout } from '../../../services/auth';
import { clearAuth } from '../../../services/tokenStore';
import { useHistory } from 'react-router-dom';

const AdminSettingsPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-settings');
  const { user, pushNotificationsPermission, requestPushPermissions } = useApp();
  const [presentAlert] = useIonAlert();
  const history = useHistory();

  const [presentInviteModal, dismissInviteModal] = useIonModal(AdminInvitePage, {
    onClose: () => dismissInviteModal(),
    dismiss: () => dismissInviteModal()
  });

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
              await clearAuth();
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
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Mehr</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Konto */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={person} />
            </div>
            <IonLabel>Konto</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div
                className="app-list-item app-list-item--users app-settings-item"
                onClick={() => history.push('/admin/profile')}
              >
                <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                  <IonIcon icon={person} />
                </div>
                <div className="app-flex-fill">
                  <h2 className="app-settings-item__title">Profil</h2>
                  <p className="app-settings-item__subtitle">Passwort und E-Mail ändern</p>
                </div>
              </div>

              <div
                className="app-list-item app-list-item--users app-settings-item"
                onClick={() => pushNotificationsPermission !== 'granted' && requestPushPermissions()}
                style={{
                  cursor: pushNotificationsPermission !== 'granted' ? 'pointer' : 'default',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {pushNotificationsPermission === 'granted' && (
                  <div
                    className="app-corner-badge"
                    style={{ backgroundColor: '#059669' }}
                  >
                    Aktiviert
                  </div>
                )}
                <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                  <IonIcon icon={notifications} />
                </div>
                <div className="app-flex-fill">
                  <h2 className="app-settings-item__title">Benachrichtigungen</h2>
                  <p className="app-settings-item__subtitle">Chat-Nachrichten und Updates</p>
                </div>
              </div>

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* BLOCK 1: Verwaltung - für org_admin UND super_admin */}
        {(user?.role_name === 'org_admin' || user?.role_name === 'super_admin') && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={shield} />
              </div>
              <IonLabel>Verwaltung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div
                  className="app-list-item app-list-item--users app-settings-item"
                  onClick={() => history.push('/admin/users')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                    <IonIcon icon={people} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Benutzer:innen</h2>
                    <p className="app-settings-item__subtitle">Admins, Teamer:innen und Rollen verwalten</p>
                  </div>
                </div>

                {user?.role_name === 'org_admin' && (
                  <div
                    className="app-list-item app-list-item--users app-settings-item"
                    onClick={() => history.push('/admin/settings/dashboard')}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                      <IonIcon icon={appsOutline} />
                    </div>
                    <div className="app-flex-fill">
                      <h2 className="app-settings-item__title">Dashboard</h2>
                      <p className="app-settings-item__subtitle">Sichtbare Bereiche für Konfis und Teamer:innen</p>
                    </div>
                  </div>
                )}

                <div
                  className="app-list-item app-list-item--users app-settings-item"
                  onClick={() => presentInviteModal({ presentingElement: presentingElement })}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                    <IonIcon icon={qrCode} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Konfis einladen</h2>
                    <p className="app-settings-item__subtitle">QR-Code für Selbstregistrierung</p>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* System-Administration - NUR für super_admin */}
        {user?.role_name === 'super_admin' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={business} />
              </div>
              <IonLabel>System-Administration</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div
                  className="app-list-item app-list-item--success app-settings-item"
                  onClick={() => history.push('/admin/organizations')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--success">
                    <IonIcon icon={business} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Organisationen</h2>
                    <p className="app-settings-item__subtitle">Gemeinden und Organisationen verwalten</p>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* BLOCK 2: Inhalt -- nur für org_admin/teamer, NICHT für super_admin */}
        {user?.role_name !== 'super_admin' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={pricetag} />
              </div>
              <IonLabel>Inhalt</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div
                  className="app-list-item app-list-item--activities app-settings-item"
                  onClick={() => history.push('/admin/activities')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--activities">
                    <IonIcon icon={flash} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Aktivitäten</h2>
                    <p className="app-settings-item__subtitle">Aktivitäten und Punkte verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--badges app-settings-item"
                  onClick={() => history.push('/admin/badges')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--badges">
                    <IonIcon icon={ribbon} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Badges</h2>
                    <p className="app-settings-item__subtitle">Auszeichnungen und Erfolge verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--jahrgang app-settings-item"
                  onClick={() => history.push('/admin/settings/jahrgaenge')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                    <IonIcon icon={school} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Jahrgänge</h2>
                    <p className="app-settings-item__subtitle">Konfirmand:innen verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--categories app-settings-item"
                  onClick={() => history.push('/admin/settings/categories')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--categories">
                    <IonIcon icon={pricetag} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Kategorien</h2>
                    <p className="app-settings-item__subtitle">Kategorien für Aktivitäten und Events</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--level app-settings-item"
                  onClick={() => history.push('/admin/settings/levels')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--level">
                    <IonIcon icon={trophy} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Level</h2>
                    <p className="app-settings-item__subtitle">Punkte-Level und Belohnungen</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--material app-settings-item"
                  onClick={() => history.push('/admin/material')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--material">
                    <IonIcon icon={documentIcon} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Material</h2>
                    <p className="app-settings-item__subtitle">Materialien und Dokumente verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--purple app-settings-item"
                  onClick={() => history.push('/admin/settings/certificates')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--purple">
                    <IonIcon icon={ribbon} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Zertifikate</h2>
                    <p className="app-settings-item__subtitle">Teamer:innen-Zertifikate verwalten</p>
                  </div>
                </div>

              </IonCardContent>
            </IonCard>
          </IonList>
        )}


        <div className="app-segment-wrapper">
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={handleLogout}
            className="app-action-button"
          >
            <IonIcon icon={logOut} slot="start" />
            Abmelden
          </IonButton>
        </div>

        <div className="ion-padding-bottom"></div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettingsPage;
