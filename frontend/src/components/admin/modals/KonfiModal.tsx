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
  IonIcon
} from '@ionic/react';
import { close, checkmark } from 'ionicons/icons';

interface Jahrgang {
  id: number;
  name: string;
}

interface KonfiModalProps {
  jahrgaenge: Jahrgang[];
  onClose: () => void;
  onSave: (konfiData: any) => void;
}

const KonfiModal: React.FC<KonfiModalProps> = ({ jahrgaenge, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [jahrgang, setJahrgang] = useState('');

  const handleSave = () => {
    if (!name.trim() || !jahrgang) return;

    const konfiData = {
      name: name.trim(),
      jahrgang_id: jahrgaenge.find(jg => jg.name === jahrgang)?.id || 1
    };

    onSave(konfiData);
  };

  const isValid = name.trim().length > 0 && jahrgang;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Konfi erstellen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton 
              onClick={handleSave} 
              disabled={!isValid}
              color="primary"
            >
              <IonIcon icon={checkmark} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        <IonList style={{ padding: '0' }}>
          <IonItem>
            <IonLabel position="stacked">Name *</IonLabel>
            <IonInput
              value={name}
              onIonInput={(e) => setName(e.detail.value!)}
              placeholder="Vor- und Nachname"
              clearInput={true}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Jahrgang *</IonLabel>
            <IonSelect
              value={jahrgang}
              onIonChange={(e) => setJahrgang(e.detail.value)}
              placeholder="Jahrgang wählen"
              interface="action-sheet"
              interfaceOptions={{
                header: 'Jahrgang auswählen'
              }}
            >
              {jahrgaenge.map(jg => (
                <IonSelectOption key={jg.id} value={jg.name}>
                  {jg.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default KonfiModal;