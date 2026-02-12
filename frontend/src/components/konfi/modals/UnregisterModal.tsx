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
  IonList,
  IonListHeader
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  calendarOutline,
  chatbubbleOutline
} from 'ionicons/icons';

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
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSubmit} disabled={!reason.trim()}>
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Event Info */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={calendarOutline} />
            </div>
            <IonLabel>Abmeldung von</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>
                {eventName}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Grund Sektion */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={chatbubbleOutline} />
            </div>
            <IonLabel>Grund für die Abmeldung</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value!)}
                    placeholder="Bitte gib einen Grund für deine Abmeldung an..."
                    rows={4}
                    autoGrow={true}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default UnregisterModal;
