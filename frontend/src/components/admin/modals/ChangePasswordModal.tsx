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
  IonInput,
  IonList,
  IonListHeader,
  IonSpinner,
  IonText
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

      <IonContent className="app-gradient-background">
        {/* Aktuelles Passwort Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--warning">
              <IonIcon icon={lockClosedOutline} />
            </div>
            <IonLabel>Aktuelles Passwort</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0' }}>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonIcon icon={keyOutline} slot="start" style={{ color: '#f59e0b' }} />
                <IonLabel position="stacked">Aktuelles Passwort *</IonLabel>
                <IonInput
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, current_password: e.detail.value! }))}
                  placeholder="Aktuelles Passwort eingeben"
                  disabled={saving}
                />
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  <IonIcon icon={showPasswords.current ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Neues Passwort Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={keyOutline} />
            </div>
            <IonLabel>Neues Passwort</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0' }}>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonIcon icon={keyOutline} slot="start" style={{ color: '#22c55e' }} />
                <IonLabel position="stacked">Neues Passwort *</IonLabel>
                <IonInput
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, new_password: e.detail.value! }))}
                  placeholder="Neues Passwort eingeben"
                  disabled={saving}
                />
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  <IonIcon icon={showPasswords.new ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonIcon icon={keyOutline} slot="start" style={{ color: '#22c55e' }} />
                <IonLabel position="stacked">Neues Passwort bestätigen *</IonLabel>
                <IonInput
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.detail.value! }))}
                  placeholder="Neues Passwort bestätigen"
                  disabled={saving}
                />
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  <IonIcon icon={showPasswords.confirm ? eyeOffOutline : eyeOutline} />
                </IonButton>
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Validation Feedback */}
        {passwordData.new_password && passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonCard className="app-card" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <IonCardContent style={{ padding: '12px 16px' }}>
                <IonText color="danger">
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    Die Passwörter stimmen nicht überein.
                  </p>
                </IonText>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Hinweis Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--info">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className="app-card" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <IonCardContent style={{ padding: '16px' }}>
              <IonText color="primary">
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Das Passwort muss mindestens 6 Zeichen lang sein.
                </p>
              </IonText>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ChangePasswordModal;
