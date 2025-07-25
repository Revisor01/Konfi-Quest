import React from 'react';
import {
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonNote,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle
} from '@ionic/react';
import { notifications } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../../contexts/AppContext';

const PushNotificationSettings: React.FC = () => {
  const { pushNotificationsPermission, requestPushPermissions } = useApp();

  const getPermissionText = () => {
    switch (pushNotificationsPermission) {
      case 'granted':
        return 'Aktiviert';
      case 'denied':
        return 'Deaktiviert';
      case 'prompt':
        return 'Nicht gefragt';
      default:
        return 'Unbekannt';
    }
  };

  const getPermissionColor = () => {
    switch (pushNotificationsPermission) {
      case 'granted':
        return 'success';
      case 'denied':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>Push Notifications</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonItem>
          <IonIcon icon={notifications} slot="start" color="primary" />
          <IonLabel>
            <h2>Chat-Benachrichtigungen</h2>
            <p>Erhalte Push-Benachrichtigungen für neue Chat-Nachrichten</p>
          </IonLabel>
          <IonNote slot="end" color={getPermissionColor()}>
            {getPermissionText()}
          </IonNote>
        </IonItem>
        
        {pushNotificationsPermission !== 'granted' && (
          <IonButton
            expand="block"
            fill="outline"
            onClick={requestPushPermissions}
            style={{ marginTop: '16px' }}
          >
            Push-Benachrichtigungen aktivieren
          </IonButton>
        )}

        {pushNotificationsPermission === 'denied' && (
          <>
            <IonNote color="medium" style={{ fontSize: '0.9em', marginTop: '8px', display: 'block' }}>
              Push-Benachrichtigungen wurden deaktiviert. 
              Du kannst sie in den Geräteeinstellungen wieder aktivieren.
            </IonNote>
            <IonButton
              expand="block"
              fill="clear"
              size="small"
              onClick={() => {
                // iOS Settings Link
                if (Capacitor.getPlatform() === 'ios') {
                  window.open('app-settings:', '_system');
                } else {
                  // Fallback für andere Plattformen
                  console.log('📱 Please enable notifications in device settings');
                }
              }}
              style={{ marginTop: '8px' }}
            >
              Zu den Einstellungen
            </IonButton>
          </>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default PushNotificationSettings;