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
  IonCardContent
} from '@ionic/react';
import { close, checkmark } from 'ionicons/icons';

interface UnregisterModalProps {
  eventName: string;
  onClose: () => void;
  onUnregister: (reason: string) => void;
  dismiss?: () => void;
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
  };

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
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
        <div style={{ padding: '16px' }}>
          <IonCard style={{ margin: '0', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <IonCardContent>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                Abmeldung von "{eventName}"
              </h3>
              
              <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
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

              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
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
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default UnregisterModal;