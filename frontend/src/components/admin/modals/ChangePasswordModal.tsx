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
  eye,
  eyeOff,
  checkmark
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSuccess }) => {
  const { setSuccess, setError } = useApp();
  
  // Password form state
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

  const handleChangePassword = async () => {
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

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.current_password,
        newPassword: passwordData.new_password
      });
      setSuccess('Passwort erfolgreich geändert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Passwort ändern</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleChangePassword}>
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
                <IonLabel position="stacked">Aktuelles Passwort *</IonLabel>
                <IonInput
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, current_password: e.detail.value! }))}
                  placeholder="Aktuelles Passwort eingeben"
                />
                <IonButton 
                  slot="end" 
                  fill="clear" 
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  <IonIcon icon={showPasswords.current ? eyeOff : eye} />
                </IonButton>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Neues Passwort *</IonLabel>
                <IonInput
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, new_password: e.detail.value! }))}
                  placeholder="Neues Passwort eingeben"
                />
                <IonButton 
                  slot="end" 
                  fill="clear" 
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  <IonIcon icon={showPasswords.new ? eyeOff : eye} />
                </IonButton>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Neues Passwort bestätigen *</IonLabel>
                <IonInput
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onIonInput={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.detail.value! }))}
                  placeholder="Neues Passwort bestätigen"
                />
                <IonButton 
                  slot="end" 
                  fill="clear" 
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  <IonIcon icon={showPasswords.confirm ? eyeOff : eye} />
                </IonButton>
              </IonItem>
            </IonCardContent>
          </IonCard>

          <IonCard style={{ background: 'rgba(56, 128, 255, 0.1)' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={checkmark} color="primary" />
                <p style={{ margin: '0', fontSize: '0.9rem', color: '#3880ff' }}>
                  Das Passwort muss mindestens 6 Zeichen lang sein.
                </p>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ChangePasswordModal;