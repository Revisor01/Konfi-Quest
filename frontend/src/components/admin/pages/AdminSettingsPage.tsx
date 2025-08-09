import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon
} from '@ionic/react';
import {
  people,
  shield,
  business,
  pricetag,
  school,
  person,
  trophy
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import ChatPermissionsSettings from '../settings/ChatPermissionsSettings';
import PushNotificationSettings from '../../common/PushNotificationSettings';

const AdminSettingsPage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-settings');
  const { user } = useApp();

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Mehr</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {(user?.permissions?.includes('admin.users.view') ||
          user?.permissions?.includes('admin.roles.view') ||
          user?.permissions?.includes('admin.organizations.view')) && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>System-Verwaltung</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {user?.permissions?.includes('admin.users.view') && (
                <IonItem
                  button={user?.permissions?.includes('admin.users.edit')}
                  routerLink={user?.permissions?.includes('admin.users.edit') ? "/admin/users" : undefined}
                  style={{
                    opacity: user?.permissions?.includes('admin.users.edit') ? 1 : 0.5,
                    cursor: user?.permissions?.includes('admin.users.edit') ? 'pointer' : 'not-allowed'
                  }}
                >
                  <IonIcon icon={people} slot="start" color="primary" />
                  <IonLabel>
                    <h2>Benutzer</h2>
                    <p>Systembenutzer und Zugriffsrechte verwalten</p>
                  </IonLabel>
                </IonItem>
              )}
              {user?.permissions?.includes('admin.roles.view') && (
                <IonItem
                  button={user?.permissions?.includes('admin.roles.edit')}
                  routerLink={user?.permissions?.includes('admin.roles.edit') ? "/admin/roles" : undefined}
                  style={{
                    opacity: user?.permissions?.includes('admin.roles.edit') ? 1 : 0.5,
                    cursor: user?.permissions?.includes('admin.roles.edit') ? 'pointer' : 'not-allowed'
                  }}
                >
                  <IonIcon icon={shield} slot="start" color="tertiary" />
                  <IonLabel>
                    <h2>Rollen</h2>
                    <p>Benutzerrollen und Berechtigungen verwalten</p>
                  </IonLabel>
                </IonItem>
              )}
              {user?.permissions?.includes('admin.organizations.view') && (
                <IonItem
                  button={user?.permissions?.includes('admin.organizations.edit')}
                  routerLink={user?.permissions?.includes('admin.organizations.edit') ? "/admin/organizations" : undefined}
                  style={{
                    opacity: user?.permissions?.includes('admin.organizations.edit') ? 1 : 0.5,
                    cursor: user?.permissions?.includes('admin.organizations.edit') ? 'pointer' : 'not-allowed'
                  }}
                >
                  <IonIcon icon={business} slot="start" color="success" />
                  <IonLabel>
                    <h2>Organisationen</h2>
                    <p>Gemeinden und Organisationen verwalten</p>
                  </IonLabel>
                </IonItem>
              )}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Inhalts-Verwaltung</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem button routerLink="/admin/settings/categories">
              <IonIcon icon={pricetag} slot="start" color="warning" />
              <IonLabel>
                <h2>Kategorien</h2>
                <p>Kategorien für Aktivitäten und Events verwalten</p>
              </IonLabel>
            </IonItem>
            <IonItem button routerLink="/admin/settings/jahrgaenge">
              <IonIcon icon={school} slot="start" color="primary" />
              <IonLabel>
                <h2>Jahrgänge</h2>
                <p>Konfirmanden-Jahrgänge verwalten</p>
              </IonLabel>
            </IonItem>
            <IonItem button routerLink="/admin/settings/levels">
              <IonIcon icon={trophy} slot="start" color="secondary" />
              <IonLabel>
                <h2>Level-System</h2>
                <p>Punkte-Level und Belohnungen verwalten</p>
              </IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>

        <ChatPermissionsSettings />
        <PushNotificationSettings />

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Konto</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem button routerLink="/admin/profile">
              <IonIcon icon={person} slot="start" color="primary" />
              <IonLabel>
                <h2>Profil</h2>
                <p>Passwort und E-Mail ändern</p>
              </IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettingsPage;