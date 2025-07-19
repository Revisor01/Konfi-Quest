import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonModal
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import ActivitiesView from '../ActivitiesView';
import LoadingSpinner from '../../common/LoadingSpinner';
import ActivityManagementModal from '../modals/ActivityManagementModal';

interface Activity {
  id: number;
  name: string;
  description?: string;
  points: number;
  type: 'gottesdienst' | 'gemeinde';
  category?: string;
  created_at: string;
}

const AdminActivitiesPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('activities');
  
  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalActivityId, setModalActivityId] = useState<number | null>(null);

  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  const [presentActivityModalHook, dismissActivityModalHook] = useIonModal(ActivityManagementModal, {
    activityId: modalActivityId,
    onClose: () => {
      dismissActivityModalHook();
      setSelectedActivity(null);
      setModalActivityId(null);
    },
    onSuccess: () => {
      dismissActivityModalHook();
      setSelectedActivity(null);
      setModalActivityId(null);
      loadActivities();
    }
  });

  useEffect(() => {
    loadActivities();
    
    // Event-Listener für Updates
    const handleActivitiesUpdated = () => {
      loadActivities();
    };
    
    window.addEventListener('activities-updated', handleActivitiesUpdated);
    
    return () => {
      window.removeEventListener('activities-updated', handleActivitiesUpdated);
    };
  }, []);


  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await api.get('/activities');
      setActivities(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Aktivitäten');
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (activity: Activity) => {
    if (!window.confirm(`Aktivität "${activity.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/activities/${activity.id}`);
      setSuccess(`Aktivität "${activity.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadActivities();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Löschen der Aktivität');
      }
    }
  };

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setModalActivityId(activity.id);
    presentActivityModalHook({
      presentingElement: presentingElement
    });
  };

  const presentActivityModal = () => {
    setSelectedActivity(null);
    setModalActivityId(null);
    presentActivityModalHook({
      presentingElement: presentingElement
    });
  };


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Aktivitäten</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={presentActivityModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Aktivitäten</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadActivities();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Aktivitäten werden geladen..." />
        ) : (
          <ActivitiesView 
            activities={activities}
            onUpdate={loadActivities}
            onAddActivityClick={presentActivityModal}
            onSelectActivity={handleSelectActivity}
            onDeleteActivity={handleDeleteActivity}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminActivitiesPage;