import React, { useState } from 'react';
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
  IonButton,
  IonButtons,
  IonInput
} from '@ionic/react';
import {
  close,
  save,
  information
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangeEmailModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialEmail?: string;
}

const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({ onClose, onSuccess, initialEmail = '' }) => {
  const { setSuccess, setError } = useApp();
  const [emailData, setEmailData] = useState({
    email: initialEmail
  });

  const handleUpdateEmail = async () => {
    if (!emailData.email.trim()) {
      setError('E-Mail-Adresse ist erforderlich');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.email)) {
      setError('Ungültige E-Mail-Adresse');
      return;
    }

    try {
      await api.post('/auth/update-email', {
        email: emailData.email.trim()
      });
      setSuccess('E-Mail-Adresse erfolgreich aktualisiert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren der E-Mail-Adresse');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>E-Mail-Adresse ändern</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleUpdateEmail}>
              <IonIcon icon={save} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: '16px' }}>
          <IonCard>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">E-Mail-Adresse *</IonLabel>
                <IonInput
                  type="email"
                  value={emailData.email}
                  onIonInput={(e) => setEmailData(prev => ({ ...prev, email: e.detail.value! }))}
                  placeholder="admin@konfi-quest.de"
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard style={{ background: 'rgba(56, 128, 255, 0.1)' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={information} color="primary" />
                <p style={{ margin: '0', fontSize: '0.9rem', color: '#3880ff' }}>
                  Diese E-Mail-Adresse wird für Passwort-Reset und Benachrichtigungen verwendet.
                </p>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ChangeEmailModal;