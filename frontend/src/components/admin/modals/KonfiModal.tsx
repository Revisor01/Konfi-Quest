import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonList,
  IonListHeader,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonText
} from '@ionic/react';
import { closeOutline, checkmarkOutline, personOutline, informationCircleOutline } from 'ionicons/icons';

interface Jahrgang {
  id: number;
  name: string;
}

interface KonfiModalProps {
  jahrgaenge: Jahrgang[];
  onClose: () => void;
  onSave: (konfiData: any) => void;
  dismiss?: () => void;
}

const KonfiModal: React.FC<KonfiModalProps> = ({ jahrgaenge, onClose, onSave, dismiss }) => {
  const [name, setName] = useState('');
  const [jahrgang, setJahrgang] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !jahrgang) return;

    setLoading(true);
    try {
      const konfiData = {
        name: name.trim(),
        jahrgang_id: jahrgaenge.find(jg => jg.name === jahrgang)?.id || 1
      };

      await onSave(konfiData);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0 && jahrgang;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Konfi erstellen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!isValid || loading}>
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Name Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--primary">
              <IonIcon icon={personOutline} />
            </div>
            <IonLabel>Konfi Daten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={name}
                    onIonInput={(e) => setName(e.detail.value!)}
                    placeholder="Vor- und Nachname"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Jahrgang *</IonLabel>
                  <IonSelect
                    value={jahrgang}
                    onIonChange={(e) => setJahrgang(e.detail.value)}
                    placeholder="Jahrgang wählen"
                    disabled={loading}
                    interface="popover"
                  >
                    {jahrgaenge.map(jg => (
                      <IonSelectOption key={jg.id} value={jg.name}>
                        {jg.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Hinweis Sektion - iOS26 Pattern in Lila */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--primary">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className="app-card" style={{ background: 'rgba(91, 33, 182, 0.08)', border: '1px solid rgba(91, 33, 182, 0.2)' }}>
            <IonCardContent style={{ padding: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: '#5b21b6' }}>
                Benutzername und Passwort werden automatisch generiert. Du kannst das Passwort später in der Detailansicht einsehen oder zurücksetzen.
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default KonfiModal;