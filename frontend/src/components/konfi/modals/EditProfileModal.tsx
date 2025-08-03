import React, { useState, useEffect } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardContent,
  IonList
} from '@ionic/react';
import { close, save } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface EditProfileModalProps {
  konfi?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  konfi,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    bible_translation: 'LUT'
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (konfi) {
      setFormData({
        display_name: konfi.display_name || '',
        email: konfi.email || '',
        bible_translation: konfi.bible_translation || 'LUT'
      });
    }
  }, [konfi]);

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setSaving(true);
    try {
      await api.put('/konfi/profile', formData);
      setSuccess('Profil erfolgreich aktualisiert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Profil bearbeiten</IonTitle>
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
              Speichern
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        <IonCard style={{ margin: '16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none">
                <IonLabel position="stacked">Name</IonLabel>
                <IonInput
                  value={formData.display_name}
                  onIonInput={(e) => setFormData({
                    ...formData,
                    display_name: e.detail.value!
                  })}
                  placeholder="Dein Name"
                />
              </IonItem>
              
              <IonItem lines="none">
                <IonLabel position="stacked">E-Mail (optional)</IonLabel>
                <IonInput
                  type="email"
                  value={formData.email}
                  onIonInput={(e) => setFormData({
                    ...formData,
                    email: e.detail.value!
                  })}
                  placeholder="deine@email.de"
                />
              </IonItem>
              
              <IonItem lines="none">
                <IonLabel position="stacked">Bibel-Übersetzung</IonLabel>
                <IonSelect
                  value={formData.bible_translation}
                  onIonChange={(e) => setFormData({
                    ...formData,
                    bible_translation: e.detail.value
                  })}
                >
                  <IonSelectOption value="LUT">Lutherbibel 2017</IonSelectOption>
                  <IonSelectOption value="EU">Einheitsübersetzung</IonSelectOption>
                  <IonSelectOption value="NeUe">Neue evangelistische Übersetzung</IonSelectOption>
                  <IonSelectOption value="ELB">Elberfelder Bibel</IonSelectOption>
                  <IonSelectOption value="BIGS">Bibel in gerechter Sprache</IonSelectOption>
                  <IonSelectOption value="GNB">Gute Nachricht Bibel</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default EditProfileModal;