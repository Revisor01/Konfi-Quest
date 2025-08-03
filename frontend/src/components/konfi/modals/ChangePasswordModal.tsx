import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonCard,
  IonCardContent,
  IonList
} from '@ionic/react';
import { close, save } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.current_password) {
      setError('Aktuelles Passwort ist erforderlich');
      return;
    }
    
    if (!formData.new_password) {
      setError('Neues Passwort ist erforderlich');
      return;
    }
    
    if (formData.new_password !== formData.confirm_password) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    
    if (formData.new_password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setSaving(true);
    try {
      await api.put('/konfi/profile/password', {
        current_password: formData.current_password,
        new_password: formData.new_password
      });
      setSuccess('Passwort erfolgreich geändert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    } finally {
      setSaving(false);
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
            <IonButton 
              onClick={handleSave}
              disabled={saving}
              color="primary"
            >
              <IonIcon icon={save} slot="start" />
              Ändern
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        <IonCard style={{ margin: '16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none">
                <IonLabel position="stacked">Aktuelles Passwort</IonLabel>
                <IonInput
                  type="password"
                  value={formData.current_password}
                  onIonInput={(e) => setFormData({
                    ...formData,
                    current_password: e.detail.value!
                  })}
                  placeholder="Aktuelles Passwort eingeben"
                />
              </IonItem>
              
              <IonItem lines="none">
                <IonLabel position="stacked">Neues Passwort</IonLabel>
                <IonInput
                  type="password"
                  value={formData.new_password}
                  onIonInput={(e) => setFormData({
                    ...formData,
                    new_password: e.detail.value!
                  })}
                  placeholder="Neues Passwort eingeben"
                />
              </IonItem>
              
              <IonItem lines="none">
                <IonLabel position="stacked">Passwort bestätigen</IonLabel>
                <IonInput
                  type="password"
                  value={formData.confirm_password}
                  onIonInput={(e) => setFormData({
                    ...formData,
                    confirm_password: e.detail.value!
                  })}
                  placeholder="Neues Passwort wiederholen"
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ChangePasswordModal;