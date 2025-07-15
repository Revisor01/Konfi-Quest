import React, { useState, useEffect } from 'react';
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
  IonIcon,
  IonTextarea
} from '@ionic/react';
import { close, checkmark } from 'ionicons/icons';
import api from '../../../services/api';

interface Activity {
  id: number;
  name: string;
  points: number;
  category: string;
}

interface ActivityModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
}

const ActivityModal: React.FC<ActivityModalProps> = ({ konfiId, onClose, onSave }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [customPoints, setCustomPoints] = useState<number>(1);
  const [customCategory, setCustomCategory] = useState('gottesdienst');
  const [comment, setComment] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await api.get('/activities');
      setActivities(response.data);
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const handleSave = async () => {
    try {
      if (useCustom) {
        // Custom activity - erst Aktivität erstellen, dann zuweisen
        const activityRes = await api.post('/activities', {
          name: customName,
          points: customPoints,
          type: customCategory,
          category: 'custom'
        });
        
        await api.post(`/konfis/${konfiId}/activities`, {
          activityId: activityRes.data.id,
          completed_date: selectedDate
        });
      } else {
        // Predefined activity
        if (!selectedActivity) return;
        await api.post(`/konfis/${konfiId}/activities`, {
          activityId: selectedActivity,
          completed_date: selectedDate
        });
      }
      await onSave();
      onClose();
    } catch (err) {
      console.error('Error saving activity:', err);
    }
  };

  const isValid = useCustom ? 
    customName.trim().length > 0 && customPoints > 0 : 
    selectedActivity !== null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Aktivität hinzufügen</IonTitle>
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
            <IonLabel position="stacked">Typ</IonLabel>
            <IonSelect
              value={useCustom ? 'custom' : 'predefined'}
              onIonChange={(e) => setUseCustom(e.detail.value === 'custom')}
              interface="action-sheet"
            >
              <IonSelectOption value="predefined">Vordefinierte Aktivität</IonSelectOption>
              <IonSelectOption value="custom">Eigene Aktivität</IonSelectOption>
            </IonSelect>
          </IonItem>

          {!useCustom ? (
            <IonItem>
              <IonLabel position="stacked">Aktivität *</IonLabel>
              <IonSelect
                value={selectedActivity}
                onIonChange={(e) => setSelectedActivity(e.detail.value)}
                placeholder="Aktivität wählen"
                interface="action-sheet"
              >
                {activities.map(activity => (
                  <IonSelectOption key={activity.id} value={activity.id}>
                    {activity.name} ({activity.points} Pkt, {activity.category})
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          ) : (
            <>
              <IonItem>
                <IonLabel position="stacked">Name *</IonLabel>
                <IonInput
                  value={customName}
                  onIonInput={(e) => setCustomName(e.detail.value!)}
                  placeholder="Aktivitätsname"
                  clearInput={true}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Punkte *</IonLabel>
                <IonInput
                  type="number"
                  value={customPoints}
                  onIonInput={(e) => setCustomPoints(parseInt(e.detail.value!) || 1)}
                  placeholder="Punktzahl"
                  min="1"
                  max="50"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Kategorie *</IonLabel>
                <IonSelect
                  value={customCategory}
                  onIonChange={(e) => setCustomCategory(e.detail.value)}
                  interface="action-sheet"
                >
                  <IonSelectOption value="gottesdienst">Gottesdienst</IonSelectOption>
                  <IonSelectOption value="gemeinde">Gemeinde</IonSelectOption>
                </IonSelect>
              </IonItem>
            </>
          )}

          <IonItem>
            <IonLabel position="stacked">Datum *</IonLabel>
            <IonInput
              type="date"
              value={selectedDate}
              onIonInput={(e) => setSelectedDate(e.detail.value!)}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Kommentar</IonLabel>
            <IonTextarea
              value={comment}
              onIonInput={(e) => setComment(e.detail.value!)}
              placeholder="Optionaler Kommentar..."
              rows={3}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityModal;