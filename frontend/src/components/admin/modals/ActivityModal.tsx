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
  IonIcon,
  IonTextarea,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonCheckbox
} from '@ionic/react';
import { closeOutline, checkmarkOutline, trophy, calendar, home, people } from 'ionicons/icons';
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
            <IonButton onClick={handleClose} style={{
              '--background': '#f8f9fa',
              '--background-hover': '#e9ecef',
              '--color': '#6c757d',
              '--border-radius': '8px'
            }}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSave}
              disabled={!selectedActivity}
            >
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Aktivität */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#2dd36f',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={trophy} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Aktivität
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none" style={{ paddingBottom: '8px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Aktivität *</IonLabel>
              </IonItem>
              {activities
                .sort((a, b) => {
                  if (a.type !== b.type) {
                    return a.type.localeCompare(b.type);
                  }
                  return a.name.localeCompare(b.name);
                })
                .map(activity => (
                  <IonItem
                    key={activity.id}
                    lines="none"
                    button
                    detail={false}
                    onClick={() => setSelectedActivity(activity.id)}
                    style={{
                      '--min-height': '56px',
                      '--padding-start': '16px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      backgroundColor: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      flexShrink: 0
                    }}>
                      <IonIcon
                        icon={activity.type === 'gottesdienst' ? home : people}
                        style={{ fontSize: '0.9rem', color: 'white' }}
                      />
                    </div>
                    <IonLabel>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>{activity.name}</h2>
                      <p style={{ fontSize: '0.8rem', color: '#666' }}>
                        {activity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'} • {activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'}
                      </p>
                    </IonLabel>
                    <IonCheckbox
                      slot="end"
                      checked={selectedActivity === activity.id}
                    />
                  </IonItem>
                ))}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Datum & Kommentar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#007aff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={calendar} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Datum & Kommentar
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonLabel position="stacked">Datum *</IonLabel>
                <IonInput
                  type="date"
                  value={selectedDate}
                  onIonInput={(e) => setSelectedDate(e.detail.value!)}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonLabel position="stacked">Kommentar (optional)</IonLabel>
                <IonTextarea
                  value={comment}
                  onIonInput={(e) => setComment(e.detail.value!)}
                  placeholder="Zusätzliche Informationen..."
                  rows={4}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
};

export default ActivityModal;