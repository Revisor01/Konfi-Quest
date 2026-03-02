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
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  briefcaseOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangeRoleTitleModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialRoleTitle?: string;
}

const ChangeRoleTitleModal: React.FC<ChangeRoleTitleModalProps> = ({
  onClose,
  onSuccess,
  initialRoleTitle = ''
}) => {
  const { setSuccess, setError } = useApp();
  const [roleTitle, setRoleTitle] = useState(initialRoleTitle);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/auth/update-role-title', {
        role_title: roleTitle.trim()
      });
      setSuccess('Funktionsbeschreibung erfolgreich aktualisiert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren der Funktionsbeschreibung');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Funktionsbeschreibung</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={saving} className="app-modal-close-btn">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving} className="app-modal-submit-btn app-modal-submit-btn--settings">
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Funktionsbeschreibung Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper" style={{ marginTop: '8px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={briefcaseOutline} />
            </div>
            <IonLabel>Deine Funktion</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-info-box">
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Funktionsbeschreibung</IonLabel>
                  <IonInput
                    value={roleTitle}
                    onIonInput={(e) => setRoleTitle(e.detail.value!)}
                    placeholder="z.B. Pastor, Diakonin, Jugendmitarbeiter"
                    disabled={saving}
                    clearInput={true}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Hinweis Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className="app-card app-info-box--purple">
            <IonCardContent className="app-info-box">
              <p style={{ margin: 0 }}>
                Deine Funktionsbeschreibung wird anderen Nutzern im Chat und an anderen Stellen angezeigt.
                Sie ersetzt nicht deine Rolle (Admin, Teamer), sondern ergänzt sie.
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Beispiele: Pastor, Diakonin, Jugendmitarbeiter, Gemeindediakon, Pfarrerin
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ChangeRoleTitleModal;
