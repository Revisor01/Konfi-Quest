import React, { useState, useEffect, useRef } from 'react';
import { useActionGuard } from '../../../hooks/useActionGuard';
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
  useIonAlert
} from '@ionic/react';
import { closeOutline, checkmarkOutline, flash, calendar, home, people, pricetag } from 'ionicons/icons';
import api from '../../../services/api';

interface Activity {
  id: number;
  name: string;
  points: number;
  type: string;
  categories?: { id: number; name: string }[];
}

interface ActivityModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
  targetRole?: string;
}

const ActivityModal: React.FC<ActivityModalProps> = ({ konfiId, onClose, onSave, dismiss, targetRole }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { isSubmitting, guard } = useActionGuard();
  const [isDirty, setIsDirty] = useState(false);
  const [presentAlert] = useIonAlert();
  const initializedRef = useRef(false);

  // isDirty nach Initialisierung tracken
  useEffect(() => {
    if (initializedRef.current) {
      setIsDirty(true);
    }
  }, [selectedActivity, comment, selectedDate]);

  useEffect(() => {
    setTimeout(() => { initializedRef.current = true; }, 100);
  }, []);

  const doClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    if (isDirty) {
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Verwerfen', role: 'destructive', handler: () => doClose() }
        ]
      });
    } else {
      doClose();
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const url = targetRole ? `/admin/activities?target_role=${targetRole}` : '/admin/activities';
      const response = await api.get(url);
      setActivities(response.data);
    } catch (err) {
 console.error('Error loading activities:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedActivity) return;

    await guard(async () => {
      try {
        await api.post(`/admin/konfis/${konfiId}/activities`, {
          activity_id: selectedActivity,
          completed_date: selectedDate,
          comment: comment
        });

        setIsDirty(false);
        await onSave();
        doClose();
      } catch (err) {
        console.error('Error saving activity:', err);
      }
    });
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
            <IonButton onClick={handleClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!selectedActivity || isSubmitting} className="app-modal-submit-btn app-modal-submit-btn--activities">
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Datum & Kommentar */}
        <IonList inset={true} className="app-modal-section">
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
                    disabled={isSubmitting}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Kommentar (optional)</IonLabel>
                  <IonTextarea
                    value={comment}
                    onIonInput={(e) => setComment(e.detail.value!)}
                    placeholder="Zusätzliche Informationen..."
                    rows={3}
                    disabled={isSubmitting}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Aktivität auswählen */}
        <IonList inset={true} className="app-modal-section">
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
                        className="app-list-item app-list-item--activities"
                        onClick={() => !isSubmitting && setSelectedActivity(activity.id)}
                        style={{
                          cursor: isSubmitting ? 'default' : 'pointer',
                          opacity: isSubmitting ? 0.6 : 1,
                          marginBottom: '0',
                          borderLeftColor: typeColor,
                          backgroundColor: isSelected ? `${typeColor}10` : undefined,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Corner Badge - nur bei Nicht-Teamer anzeigen */}
                        {targetRole !== 'teamer' && (
                          <div
                            className="app-corner-badge"
                            style={{ backgroundColor: typeColor }}
                          >
                            +{activity.points}P
                          </div>
                        )}

                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div
                              className="app-icon-circle app-icon-circle--lg"
                              style={{ backgroundColor: typeColor }}
                            >
                              <IonIcon icon={activity.type === 'gottesdienst' ? home : people} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title" style={{ paddingRight: '60px' }}>
                                {activity.name}
                              </div>
                              {activity.categories && activity.categories.length > 0 && (
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={pricetag} style={{ color: '#ff9500' }} />
                                    {activity.categories.map(cat => cat.name).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
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
