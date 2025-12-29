import React from 'react';
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
  IonList,
  IonListHeader,
  IonButton,
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
  flash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import PushNotificationSettings from '../../common/PushNotificationSettings';
import { logout } from '../../../services/auth';

const AdminSettingsPage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-settings');
  const { user } = useApp();
  const [presentAlert] = useIonAlert();

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
              <div className="app-section-icon app-section-icon--primary">
                <IonIcon icon={shield} />
              </div>
              <IonLabel>Verwaltung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem
                    button
                    routerLink="/admin/users"
                    lines="none"
                    className="app-list-item app-list-item--users"
                    style={{
                      '--background': 'transparent',
                      '--padding-start': '0',
                      '--inner-padding-end': '0'
                    }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users" slot="start" style={{ marginRight: '12px' }}>
                      <IonIcon icon={people} />
                    </div>
                    <IonLabel>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Benutzer:innen</h2>
                      <p style={{ fontSize: '0.8rem', color: '#666' }}>Admins, Teamer:innen und Rollen verwalten</p>
                    </IonLabel>
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* System-Administration - NUR für super_admin */}
        {user?.role_name === 'super_admin' && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--success">
                <IonIcon icon={business} />
              </div>
              <IonLabel>System-Administration</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem
                    button
                    routerLink="/admin/organizations"
                    lines="none"
                    className="app-list-item app-list-item--success"
                    style={{
                      '--background': 'transparent',
                      '--padding-start': '0',
                      '--inner-padding-end': '0'
                    }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--success" slot="start" style={{ marginRight: '12px' }}>
                      <IonIcon icon={business} />
                    </div>
                    <IonLabel>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Organisationen</h2>
                      <p style={{ fontSize: '0.8rem', color: '#666' }}>Gemeinden und Organisationen verwalten</p>
                    </IonLabel>
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* BLOCK 2: Inhalt */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={pricetag} />
            </div>
            <IonLabel>Inhalt</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }} lines="none">
                <IonItem
                  button
                  routerLink="/admin/activities"
                  lines="none"
                  className="app-list-item app-list-item--activities"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '0',
                    marginBottom: '8px'
                  }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--activities" slot="start" style={{ marginRight: '12px' }}>
                    <IonIcon icon={flash} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Aktivitäten</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Aktivitäten und Punkte verwalten</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  button
                  routerLink="/admin/settings/categories"
                  lines="none"
                  className="app-list-item app-list-item--badges"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '0',
                    marginBottom: '8px'
                  }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--badges" slot="start" style={{ marginRight: '12px' }}>
                    <IonIcon icon={pricetag} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Kategorien</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Kategorien für Aktivitäten und Events</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  button
                  routerLink="/admin/settings/jahrgaenge"
                  lines="none"
                  className="app-list-item app-list-item--primary"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '0',
                    marginBottom: '8px'
                  }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--primary" slot="start" style={{ marginRight: '12px' }}>
                    <IonIcon icon={school} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Jahrgänge</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Konfirmand:innen verwalten</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  button
                  routerLink="/admin/settings/levels"
                  lines="none"
                  className="app-list-item app-list-item--level"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '0'
                  }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--level" slot="start" style={{ marginRight: '12px' }}>
                    <IonIcon icon={trophy} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Level-System</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Punkte-Level und Belohnungen</p>
                  </IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        <div style={{ margin: '0 16px 16px 16px' }}>
          <PushNotificationSettings />
        </div>

        {/* Konto */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--primary">
              <IonIcon icon={person} />
            </div>
            <IonLabel>Konto</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }} lines="none">
                <IonItem
                  button
                  routerLink="/admin/profile"
                  lines="none"
                  className="app-list-item app-list-item--primary"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '0'
                  }}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--primary" slot="start" style={{ marginRight: '12px' }}>
                    <IonIcon icon={person} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Profil</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Passwort und E-Mail ändern</p>
                  </IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        <div style={{ margin: '16px', paddingBottom: '16px' }}>
          <IonButton
            expand="block"
            color="danger"
            fill="outline"
            onClick={handleLogout}
          >
            <IonIcon icon={logOut} slot="start" />
            Abmelden
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettingsPage;
