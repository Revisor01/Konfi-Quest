import React from 'react';
import {
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonNote,
  IonCard,
  IonCardContent,
  IonList
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
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#ff9500',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
          flexShrink: 0
        }}>
          <IonIcon icon={notifications} style={{ fontSize: '1rem', color: 'white' }} />
        </div>
        <h2 style={{
          fontWeight: '600',
          fontSize: '1.1rem',
          margin: '0',
          color: '#333'
        }}>
          Push Notifications
        </h2>
      </div>
      <IonCard style={{
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0',
        margin: '0'
      }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonList style={{ background: 'transparent' }} lines="none">
            <IonItem
              lines="none"
              style={{
                '--min-height': '56px',
                '--padding-start': '16px',
                '--background': '#fbfbfb',
                '--border-radius': '12px',
                margin: '6px 0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #e0e0e0',
                borderRadius: '12px'
              }}
            >
              <div slot="start" style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#ff9500',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <IonIcon icon={notifications} style={{ fontSize: '1.2rem', color: 'white' }} />
              </div>
              <IonLabel>
                <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Chat-Benachrichtigungen</h2>
                <p style={{ fontSize: '0.8rem', color: '#666' }}>Erhalte Push-Benachrichtigungen für neue Chat-Nachrichten</p>
              </IonLabel>
              <IonNote slot="end" color={getPermissionColor()}>
                {getPermissionText()}
              </IonNote>
            </IonItem>
          </IonList>

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
    </div>
  );
};

export default PushNotificationSettings;
