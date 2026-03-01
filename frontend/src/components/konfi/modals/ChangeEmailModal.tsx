import React, { useState, useEffect } from 'react';
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
  IonInput,
  IonList,
  IonListHeader,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  mailOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangeEmailModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialEmail?: string;
}

const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  onClose,
  onSuccess,
  initialEmail = ''
}) => {
  const { setSuccess, setError } = useApp();
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current email from server when modal opens
  useEffect(() => {
    const loadCurrentEmail = async () => {
      try {
        const response = await api.get('/auth/me');
        setEmail(response.data.email || '');
      } catch (err) {
 console.error('Error loading email:', err);
        // Fallback to initialEmail prop
        setEmail(initialEmail);
      } finally {
        setLoading(false);
      }
    };
    loadCurrentEmail();
  }, []);

  const handleSave = async () => {
    // E-Mail ist optional, aber wenn angegeben muss sie gültig sein
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Ungültige E-Mail-Adresse');
        return;
      }
    }

    setSaving(true);
    try {
      await api.post('/auth/update-email', {
        email: email.trim() || null
      });
      setSuccess('E-Mail-Adresse erfolgreich aktualisiert');
      onSuccess();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      if (errorMsg?.includes('bereits verwendet') || err.response?.status === 409) {
        setError('Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.');
      } else {
        setError(errorMsg || 'Fehler beim Aktualisieren der E-Mail-Adresse');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>E-Mail ändern</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={saving}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving || loading}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* E-Mail-Adresse Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={mailOutline} />
            </div>
            <IonLabel>E-Mail-Adresse</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-info-box">
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">E-Mail-Adresse (optional)</IonLabel>
                  {loading ? (
                    <div style={{ padding: '12px 0' }}>
                      <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
                    </div>
                  ) : (
                    <IonInput
                      type="email"
                      value={email}
                      onIonInput={(e) => setEmail(e.detail.value!)}
                      placeholder="deine@email.de"
                      disabled={saving}
                      clearInput={true}
                    />
                  )}
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Hinweis Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className="app-card app-info-box--purple">
            <IonCardContent className="app-info-box">
              <p style={{ margin: 0 }}>
                Diese E-Mail-Adresse wird für Passwort-Reset und Benachrichtigungen verwendet.
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ChangeEmailModal;
