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
  type: string;
}

interface ActivityModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
}

const ActivityModal: React.FC<ActivityModalProps> = ({ konfiId, onClose, onSave, dismiss }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await api.get('/admin/activities');
      setActivities(response.data);
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const handleSave = async () => {
    try {
      if (!selectedActivity) return;
      
      await api.post(`/admin/konfis/${konfiId}/activities`, {
        activity_id: selectedActivity,
        completed_date: selectedDate,
        comment: comment
      });
      
      await onSave();
      handleClose();
    } catch (err) {
      console.error('Error saving activity:', err);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Aktivität hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!selectedActivity}>
              <IonIcon icon={checkmark} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem>
            <IonLabel position="stacked">Aktivität</IonLabel>
            <IonSelect
              value={selectedActivity}
              onSelectionChange={(e) => setSelectedActivity(e.detail.value)}
              placeholder="Aktivität wählen"
            >
              {activities.map(activity => (
                <IonSelectOption key={activity.id} value={activity.id}>
                  {activity.name} ({activity.points} Punkte, {activity.type})
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Datum</IonLabel>
            <IonInput
              type="date"
              value={selectedDate}
              onIonInput={(e) => setSelectedDate(e.detail.value!)}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Kommentar (optional)</IonLabel>
            <IonTextarea
              value={comment}
              onIonInput={(e) => setComment(e.detail.value!)}
              placeholder="Zusätzliche Informationen..."
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityModal;