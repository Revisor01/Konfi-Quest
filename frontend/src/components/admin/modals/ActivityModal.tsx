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
  IonList,
  IonListHeader,
  IonIcon,
  IonTextarea,
  IonCard,
  IonCardContent,
  IonCheckbox
} from '@ionic/react';
import { closeOutline, checkmarkOutline, flash, calendar, home, people } from 'ionicons/icons';
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
  const [loading, setLoading] = useState(false);

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
    if (!selectedActivity) return;

    setLoading(true);
    try {
      await api.post(`/admin/konfis/${konfiId}/activities`, {
        activity_id: selectedActivity,
        completed_date: selectedDate,
        comment: comment
      });

      await onSave();
      handleClose();
    } catch (err) {
 console.error('Error saving activity:', err);
    } finally {
      setLoading(false);
    }
  };

  // Farben für Aktivitäten
  const gottesdienstColor = '#3b82f6'; // Blau
  const gemeindeColor = '#059669'; // Dunkelgrün

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Aktivität hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!selectedActivity || loading}>
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Datum & Kommentar */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={calendar} />
            </div>
            <IonLabel>Datum & Kommentar</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Datum *</IonLabel>
                  <IonInput
                    type="date"
                    value={selectedDate}
                    onIonInput={(e) => setSelectedDate(e.detail.value!)}
                    disabled={loading}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Kommentar (optional)</IonLabel>
                  <IonTextarea
                    value={comment}
                    onIonInput={(e) => setComment(e.detail.value!)}
                    placeholder="Zusätzliche Informationen..."
                    rows={3}
                    disabled={loading}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Aktivität auswählen */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={flash} />
            </div>
            <IonLabel>Aktivität auswählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activities
                  .sort((a, b) => {
                    if (a.type !== b.type) {
                      return a.type.localeCompare(b.type);
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .map(activity => {
                    const isSelected = selectedActivity === activity.id;
                    // Gottesdienst blau, Gemeinde dunkelgrün
                    const typeColor = activity.type === 'gottesdienst' ? gottesdienstColor : gemeindeColor;

                    return (
                      <div
                        key={activity.id}
                        className="app-list-item"
                        onClick={() => !loading && setSelectedActivity(activity.id)}
                        style={{
                          cursor: loading ? 'default' : 'pointer',
                          opacity: loading ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0',
                          borderLeftColor: typeColor,
                          backgroundColor: isSelected ? `${typeColor}10` : undefined
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div
                            className="app-icon-circle"
                            style={{ backgroundColor: typeColor }}
                          >
                            <IonIcon icon={activity.type === 'gottesdienst' ? home : people} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="app-list-item__title">{activity.name}</div>
                            <div className="app-list-item__subtitle">
                              {activity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'} - {activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'}
                            </div>
                          </div>
                        </div>
                        <IonCheckbox
                          checked={isSelected}
                          disabled={loading}
                          style={{
                            '--checkbox-background-checked': typeColor,
                            '--border-color-checked': typeColor,
                            '--checkmark-color': 'white'
                          }}
                        />
                      </div>
                    );
                  })}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityModal;
