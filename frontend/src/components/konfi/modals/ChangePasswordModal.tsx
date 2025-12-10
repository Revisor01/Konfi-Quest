import React, { useState } from 'react';
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
  keyOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSuccess }) => {
  const { setSuccess, setError } = useApp();
  const [saving, setSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const handleSave = async () => {
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      setError('Alle Passwort-Felder sind erforderlich');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Neue Passwörter stimmen nicht überein');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('Neues Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.current_password,
        newPassword: passwordData.new_password
      });
      setSuccess('Passwort erfolgreich geändert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    } finally {
      setSaving(false);
    }
  };

  const isValid = passwordData.current_password &&
    passwordData.new_password &&
    passwordData.confirm_password &&
    passwordData.new_password === passwordData.confirm_password &&
    passwordData.new_password.length >= 6;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Passwort ändern</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={saving}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving || !isValid}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Aktuelles Passwort */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#f59e0b',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={lockClosedOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Aktuelles Passwort
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
                <IonLabel position="stacked">Aktuelles Passwort *</IonLabel>
                <IonInput
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, current_password: e.detail.value! }))}
                  placeholder="Aktuelles Passwort eingeben"
                  disabled={saving}
                />
                <IonButton
                  fill="clear"
                  slot="end"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  style={{ marginTop: '20px' }}
                >
                  <IonIcon icon={showPasswords.current ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Neues Passwort */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#22c55e',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={keyOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Neues Passwort
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
              {/* Neues Passwort */}
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">Neues Passwort *</IonLabel>
                <IonInput
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, new_password: e.detail.value! }))}
                  placeholder="Neues Passwort eingeben"
                  disabled={saving}
                />
                <IonButton
                  fill="clear"
                  slot="end"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  style={{ marginTop: '20px' }}
                >
                  <IonIcon icon={showPasswords.new ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>

              {/* Passwort bestätigen */}
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
                <IonLabel position="stacked">Neues Passwort bestätigen *</IonLabel>
                <IonInput
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.detail.value! }))}
                  placeholder="Neues Passwort bestätigen"
                  disabled={saving}
                />
                <IonButton
                  fill="clear"
                  slot="end"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  style={{ marginTop: '20px' }}
                >
                  <IonIcon icon={showPasswords.confirm ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Validation Feedback */}
        {passwordData.new_password && passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
          <IonCard style={{
            margin: '0 16px 16px 16px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.08)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <IonCardContent style={{ padding: '12px 16px' }}>
              <IonText color="danger">
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Die Passwörter stimmen nicht überein.
                </p>
              </IonText>
            </IonCardContent>
          </IonCard>
        )}

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
                Das Passwort muss mindestens 6 Zeichen lang sein.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ChangePasswordModal;
