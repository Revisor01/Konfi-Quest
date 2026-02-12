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
  IonList,
  IonListHeader,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  personOutline,
  mailOutline,
  bookOutline
} from 'ionicons/icons';
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
            <IonButton onClick={onClose} disabled={saving}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Name Sektion */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--info">
              <IonIcon icon={personOutline} />
            </div>
            <IonLabel>Name</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Anzeigename *</IonLabel>
                  <IonInput
                    value={formData.display_name}
                    onIonInput={(e) => setFormData({
                      ...formData,
                      display_name: e.detail.value!
                    })}
                    placeholder="Dein Name"
                    disabled={saving}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* E-Mail Sektion */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--info">
              <IonIcon icon={mailOutline} />
            </div>
            <IonLabel>E-Mail (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">E-Mail-Adresse</IonLabel>
                  <IonInput
                    type="email"
                    value={formData.email}
                    onIonInput={(e) => setFormData({
                      ...formData,
                      email: e.detail.value!
                    })}
                    placeholder="deine@email.de"
                    disabled={saving}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Bibel-Übersetzung Sektion */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--info">
              <IonIcon icon={bookOutline} />
            </div>
            <IonLabel>Bibel-Übersetzung</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonSelect
                    value={formData.bible_translation}
                    onIonChange={(e) => setFormData({
                      ...formData,
                      bible_translation: e.detail.value
                    })}
                    interface="action-sheet"
                    cancelText="Abbrechen"
                    disabled={saving}
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
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default EditProfileModal;
