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
  IonList,
  IonIcon,
  IonTextarea,
  IonSelect,
  IonSelectOption
} from '@ionic/react';
import { close, checkmark } from 'ionicons/icons';
import api from '../../../services/api';

interface BonusModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
}

const BonusModal: React.FC<BonusModalProps> = ({ konfiId, onClose, onSave, dismiss }) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const [name, setName] = useState('');
  const [points, setPoints] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [type, setType] = useState('gemeinde');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = async () => {
    if (!name.trim() || points <= 0) return;

    try {
      await api.post(`/konfis/${konfiId}/bonus-points`, {
        points: points,
        type: type,
        description: `${name.trim()}${reason.trim() ? ': ' + reason.trim() : ''}`,
        completed_date: selectedDate
      });
      await onSave();
      handleClose();
    } catch (err) {
      console.error('Error saving bonus points:', err);
    }
  };

  const isValid = name.trim().length > 0 && points > 0;

  const bonusTypes = [
    { value: 'gemeinde', label: 'Gemeinde-Bonuspunkte' },
    { value: 'gottesdienst', label: 'Gottesdienst-Bonuspunkte' }
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Bonuspunkte hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>
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
            <IonLabel position="stacked">Bezeichnung *</IonLabel>
            <IonInput
              value={name}
              onIonInput={(e) => setName(e.detail.value!)}
              placeholder="z.B. Hilfe beim Aufräumen"
              clearInput={true}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Punkte *</IonLabel>
            <IonInput
              type="number"
              value={points}
              onIonInput={(e) => setPoints(parseInt(e.detail.value!) || 1)}
              placeholder="Anzahl Bonuspunkte"
              min="1"
              max="20"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Kategorie</IonLabel>
            <IonSelect
              value={type}
              onIonChange={(e) => setType(e.detail.value)}
              interface="action-sheet"
            >
              {bonusTypes.map(bonusType => (
                <IonSelectOption key={bonusType.value} value={bonusType.value}>
                  {bonusType.label}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Datum *</IonLabel>
            <IonInput
              type="date"
              value={selectedDate}
              onIonInput={(e) => setSelectedDate(e.detail.value!)}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Begründung</IonLabel>
            <IonTextarea
              value={reason}
              onIonInput={(e) => setReason(e.detail.value!)}
              placeholder="Warum werden diese Bonuspunkte vergeben?"
              rows={4}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default BonusModal;