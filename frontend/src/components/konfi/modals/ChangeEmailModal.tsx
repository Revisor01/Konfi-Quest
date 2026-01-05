import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonButtons,
  IonInput,
  IonSpinner,
  IonText,
  IonItem,
  IonLabel,
  IonList
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
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren der E-Mail-Adresse');
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

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: E-Mail-Adresse */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#667eea',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={mailOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            E-Mail-Adresse
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
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
                  />
                )}
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Info-Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={informationCircleOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Hinweis
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonText color="primary">
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                Diese E-Mail-Adresse wird für Passwort-Reset und Benachrichtigungen verwendet. Das Feld ist optional.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ChangeEmailModal;
