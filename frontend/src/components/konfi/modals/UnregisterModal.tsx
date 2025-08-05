import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonTextarea,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList
} from '@ionic/react';
import { close, checkmark } from 'ionicons/icons';

interface UnregisterModalProps {
  eventName: string;
  onClose: () => void;
  onUnregister: (reason: string) => void;
  dismiss: (data?: string, role?: string) => void;
}

const UnregisterModal: React.FC<UnregisterModalProps> = ({ 
  eventName, 
  onClose, 
  onUnregister,
  dismiss 
}) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) {
      return;
    }
    onUnregister(reason.trim());
    dismiss(reason.trim(), 'confirm');
  };

  const handleClose = () => {
    dismiss(undefined, 'cancel');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Abmeldung</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Überschrift außerhalb der Card */}
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
            <IonIcon icon={close} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Abmeldung von "{eventName}"
          </h2>
        </div>

        {/* Card ohne Header */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none" style={{ paddingBottom: '12px' }}>
                <IonLabel position="stacked">
                  <strong>Grund für die Abmeldung *</strong>
                </IonLabel>
                <IonTextarea
                  value={reason}
                  onIonInput={(e) => setReason(e.detail.value!)}
                  placeholder="Bitte gib einen Grund für deine Abmeldung an..."
                  rows={4}
                  style={{
                    '--background': '#f8f9fa',
                      '--border-radius': '8px',
                      '--padding-start': '12px',
                      '--padding-end': '12px',
                      '--padding-top': '12px',
                      '--padding-bottom': '12px',
                      marginTop: '8px'
                  }}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Button-Bereich mit speziellem Abmelde-Styling */}
        <div style={{ margin: '0 16px 48px 16px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <IonButton 
              expand="block" 
              fill="outline" 
              color="medium"
              onClick={handleClose}
              style={{ flex: '1', height: '44px', borderRadius: '8px' }}
            >
              <IonIcon icon={close} slot="start" />
              Abbrechen
            </IonButton>
            <IonButton 
              expand="block" 
              color="danger"
              onClick={handleSubmit}
              disabled={!reason.trim()}
              style={{ flex: '1', height: '44px', borderRadius: '8px' }}
            >
              <IonIcon icon={checkmark} slot="start" />
              Abmelden
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default UnregisterModal;